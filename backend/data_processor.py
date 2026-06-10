"""
Cloud-compatible data processing module.
Reads Excel files from Azure Blob Storage, processes them,
and returns the generated BookingData.ts content as a string.
"""
import pandas as pd
import json
import os
import re
import math
import io
from azure.storage.blob import BlobServiceClient


def _get_blob_service_client():
    """Create a BlobServiceClient using SAS token authentication."""
    account = os.getenv('AZURE_STORAGE_ACCOUNT')
    sas = os.getenv('AZURE_SAS_TOKEN')
    account_url = f"https://{account}.blob.core.windows.net"
    return BlobServiceClient(account_url=account_url, credential=f"?{sas}")


def _get_blob_file(container_name, filename):
    """Download a specific blob by name."""
    client = _get_blob_service_client()
    blob_client = client.get_blob_client(container=container_name, blob=filename)
    if blob_client.exists():
        return io.BytesIO(blob_client.download_blob().readall())
    raise FileNotFoundError(f"Blob '{filename}' not found in container '{container_name}'")


def _get_latest_blob(container_name, pattern):
    """Find and download the latest blob matching a glob pattern."""
    client = _get_blob_service_client()
    container_client = client.get_container_client(container_name)
    blobs = list(container_client.list_blobs())

    regex_pattern = pattern.replace('.', '\\.').replace('*', '.*')
    matching = [b for b in blobs if re.match(regex_pattern, b.name, re.IGNORECASE)]

    if not matching:
        raise FileNotFoundError(f"No blobs matching '{pattern}' in container '{container_name}'")

    latest = max(matching, key=lambda b: b.last_modified)
    blob_client = container_client.get_blob_client(latest.name)
    data = blob_client.download_blob().readall()
    return io.BytesIO(data), latest.name


def _get_all_blobs(container_name, pattern):
    """Download ALL blobs matching a glob pattern, returned as list of (BytesIO, name)."""
    client = _get_blob_service_client()
    container_client = client.get_container_client(container_name)
    blobs = list(container_client.list_blobs())

    regex_pattern = pattern.replace('.', '\\.').replace('*', '.*')
    matching = [b for b in blobs if re.match(regex_pattern, b.name, re.IGNORECASE)]

    if not matching:
        raise FileNotFoundError(f"No blobs matching '{pattern}' in container '{container_name}'")

    # Sort by last_modified so newest is last
    matching.sort(key=lambda b: b.last_modified)

    results = []
    for blob_info in matching:
        blob_client = container_client.get_blob_client(blob_info.name)
        data = blob_client.download_blob().readall()
        results.append((io.BytesIO(data), blob_info.name))

    return results


def parse_office_alloc(s):
    branch_map = {'syd': 0, 'mel': 0, 'bne': 0, 'fre': 0, 'adl': 0, 'pil': 0, 'prj': 0, 'akl': 0, 'oth': 0}
    if s is None or (isinstance(s, float) and math.isnan(s)):
        return branch_map
    s = str(s).upper()
    patterns = {
        'syd': r'SYD[^\d]*(\d+)', 'mel': r'MEL[^\d]*(\d+)', 'bne': r'BNE[^\d]*(\d+)',
        'fre': r'(?:FRE|PER)[^\d]*(\d+)', 'adl': r'ADL[^\d]*(\d+)', 'pil': r'PIL[^\d]*(\d+)',
        'prj': r'PRJ[^\d]*(\d+)', 'akl': r'AKL[^\d]*(\d+)', 'oth': r'OTH[^\d]*(\d+)',
    }
    for k, pat in patterns.items():
        m = re.search(pat, s)
        if m:
            branch_map[k] = int(m.group(1))
    return branch_map


def process_data_from_azure() -> str:
    """
    Fetch data from Azure Blob Storage, process it,
    and return the generated BookingData.ts content as a string.
    """
    container = os.getenv('AZURE_CONTAINER_NAME', 'carrier-allocation')
    master_file = os.getenv('MASTER_FILE_NAME', 'Contract_Master_All_Data Update.xlsx')
    port_file = os.getenv('PORT_CODE_FILE_NAME', 'CONTRACT_PORT_CODE_LISTING.xlsx')

    log_lines = []
    def log(msg):
        print(msg)
        log_lines.append(msg)

    # 1. Fetch ALL Orders files and merge them
    all_orders = _get_all_blobs(container, 'Orders*.xlsx')
    order_frames = []
    for stream, name in all_orders:
        log(f"Reading Orders from Azure: {name}")
        order_frames.append(pd.read_excel(stream))
    df = pd.concat(order_frames, ignore_index=True)
    df = df.drop_duplicates(subset=['Order Number'], keep='last') if 'Order Number' in df.columns else df
    log(f"Merged {len(all_orders)} Orders file(s) -> {len(df)} unique rows")

    # 2. Fetch Master Data
    master_stream = _get_blob_file(container, master_file)
    log(f"Reading Master Data from Azure: {master_file}")
    df_master = pd.read_excel(master_stream)

    # Build master dictionary
    master_dict = {}
    for _, row in df_master.iterrows():
        cid = str(row['Contract #']).strip() if pd.notna(row.get('Contract #')) else ''
        if not cid:
            continue
        office_alloc = parse_office_alloc(row.get('Office Allocation'))
        alloc_total = sum(office_alloc.values())
        carrier = str(row.get('Carrier', 'Unknown'))
        priority = str(row.get('Priority', 'Normal'))
        contract_type = str(row.get('Contract Type', 'FAK'))
        contract_name = str(row.get('Contract Name', ''))
        lane = f"{str(row.get('Origin', '')).strip()} to {str(row.get('Destination', '')).strip()}"
        if cid not in master_dict:
            master_dict[cid] = {'carrier': carrier, 'allocTotal': alloc_total, 'officeAlloc': office_alloc, 'priority': priority, 'lane': lane, 'contractType': contract_type, 'contractName': contract_name}
        else:
            master_dict[cid]['allocTotal'] += alloc_total
            for hub, val in office_alloc.items():
                master_dict[cid]['officeAlloc'][hub] = master_dict[cid]['officeAlloc'].get(hub, 0) + val

    # Robust Column Mapping
    df.columns = df.columns.str.strip()
    col_map = {
        'Contract': 'contract', 'Contract #': 'contract',
        'Branch': 'branch', 'Created Branch': 'branch',
        'Week No': 'week', 'CW Week No': 'week',
        'Order Number': 'order', 'Est. Departure': 'etd', 'Est. Arrival': 'eta',
        'Departure Vessel': 'depVessel', 'Departure Voyage': 'depVoyage',
        'Buyer': 'buyer', 'Supplier': 'supplier', 'Load Port': 'loadPort',
        'Discharge Port': 'dischargePort', 'Region': 'region',
        'Planned Carrier': 'plannedCarrier', 'Carrier Name': 'carrierName'
    }
    col_map_lower = {k.lower(): v for k, v in col_map.items()}
    existing_cols = {col: col_map_lower[col.lower()] for col in df.columns if col.lower() in col_map_lower}
    
    teu_col = next((c for c in df.columns if c.lower() in ['total teu', 'teu', 'teu count _x001f_', 'teu _x001f_']), None)
    df['teu'] = df[teu_col] if teu_col else 0
    
    df = df.rename(columns=existing_cols)
    df = df.loc[:, ~df.columns.duplicated()]

    # Fallbacks for critical missing columns
    if 'contract' not in df.columns:
        df['contract'] = 'Unassigned'
    df['contract'] = df['contract'].fillna('Unassigned').astype(str)
    df['contract'] = df['contract'].replace('nan', 'Unassigned')

    if 'branch' not in df.columns:
        df['branch'] = 'Unknown'
    df['branch'] = df['branch'].fillna('Unknown').astype(str)
    
    if 'week' not in df.columns:
        df['week'] = '1'

    df = df.dropna(subset=['week'])
    df['week_num'] = df['week'].astype(str).str.extract(r'(\d+)').astype(int)
    df['year'] = pd.to_datetime(df['etd'], errors='coerce').dt.year.fillna(2026).astype(int)
    df['mscWeek'] = df['week_num'].astype(str) + '-' + df['year'].astype(str)

    # 3. Fetch Port Listing
    port_map = {}
    port_hierarchy = []
    port_file_name = 'World_Container_Ports.xlsx'
    df_ports = None

    try:
        port_stream = _get_blob_file(container, port_file_name)
        log(f"Reading Port Codes from Azure: {port_file_name}")
        df_ports = pd.read_excel(port_stream)
    except Exception as e:
        log(f"Blob '{port_file_name}' not found in Azure or fetch failed. Falling back to local hardcoded file.")

    if df_ports is None:
        try:
            repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            local_port_file = os.path.join(repo_root, port_file_name)
            log(f"Reading Port Codes from hardcoded file: {local_port_file}")
            df_ports = pd.read_excel(local_port_file)
        except Exception as e:
            log(f"Warning: Could not read hardcoded port listing file: {e}")

    if df_ports is not None:
        try:
            df_ports.columns = df_ports.columns.str.strip()
            for _, row in df_ports.iterrows():
                code = str(row.get('UN/LOCODE', '')).strip().upper()
                if code and code != 'NAN':
                    info = {
                        'code': code,
                        'name': str(row.get('Port', code)).strip().title(),
                        'country': str(row.get('Country', 'Unknown')).strip().title(),
                        'region': str(row.get('Region', 'Other')).strip().title(),
                        'lane': str(row.get('Tradelane', 'General')).strip().title()
                    }
                    port_map[code] = info
                    port_hierarchy.append(info)
        except Exception as e:
            log(f"Warning: Error processing port listing data: {e}")

    orig_codes = sorted(df['loadPort'].dropna().unique().tolist())
    dest_codes = sorted(df['dischargePort'].dropna().unique().tolist())

    for p in set(orig_codes + dest_codes):
        if p not in port_map:
            cc = str(p)[:2].upper()
            cname = {'AU': 'Australia', 'CN': 'China', 'HK': 'Hong Kong', 'NZ': 'New Zealand', 'SG': 'Singapore'}.get(cc, cc)
            rname = 'Oceania' if cc in ('AU','NZ') else ('Asia' if cc in ('CN','HK','SG') else 'Other')
            info = {'code': p, 'name': p, 'country': cname, 'region': rname, 'lane': 'General'}
            port_map[p] = info
            port_hierarchy.append(info)

    df['loadPort'] = df['loadPort'].apply(lambda x: port_map.get(x, {}).get('name', x) if pd.notna(x) else x)
    df['dischargePort'] = df['dischargePort'].apply(lambda x: port_map.get(x, {}).get('name', x) if pd.notna(x) else x)

    origins = sorted(df['loadPort'].dropna().unique().tolist())
    destinations = sorted(df['dischargePort'].dropna().unique().tolist())

    unique_weeks_df = df[['year', 'week_num', 'mscWeek']].drop_duplicates().sort_values(['year', 'week_num'])
    weeks = [f"WK {row['mscWeek']}" for _, row in unique_weeks_df.iterrows()]
    active_week_count = max(len(weeks), 1)

    # BRANCH_SNAPSHOT
    branch_snapshot = []
    std_branches = [
        ('SYDNEY', 'SY1', 'syd'), ('MELBOURNE', 'ME1', 'mel'), ('BRISBANE', 'BN1', 'bne'),
        ('FREMANTLE', 'FR1', 'fre'), ('ADELAIDE', 'AD1', 'adl'), ('PIL', 'PIL', 'pil'),
        ('PROJECTS', 'PRJ', 'prj'), ('AUCKLAND', 'AKL', 'akl'), ('OTHER', 'OTH', 'oth')
    ]
    for bname, bcode, bnorm in std_branches:
        b_df = df[df['branch'].isin([bcode, bnorm, bnorm.upper()])]
        booked = round(b_df['teu'].sum(), 1)
        alloc_pw = sum(m.get('officeAlloc', {}).get(bnorm, 0) for m in master_dict.values())
        total_alloc = alloc_pw * active_week_count
        util = (booked / total_alloc * 100) if total_alloc > 0 else 0
        status = 'Healthy' if util > 80 else ('Underperforming' if util > 50 else 'Low Uptake')
        branch_snapshot.append({
            "branch": bcode, "branchName": bname, "alloc": round(total_alloc, 1),
            "booked": booked, "avail": round(total_alloc - booked, 1), "util": round(util, 1), "status": status
        })

    # CONTRACT_UTIL_DATA
    # Iterate over ALL master contracts and any new contracts from the orders
    all_active_cids = set(df['contract'].dropna().unique().tolist())
    all_master_cids = sorted(list(set(master_dict.keys()).union(all_active_cids)))
    contract_util_data = []
    for cid in all_master_cids:
        minfo = master_dict.get(cid, {})
        c_bookings = df[df['contract'] == cid]
        booked = round(c_bookings['teu'].sum(), 1)
        alloc_pw = minfo.get('allocTotal', 0)
        total_alloc = alloc_pw * active_week_count
        util = (booked / total_alloc * 100) if total_alloc > 0 else 0

        def gbr(bnorm, *codes):
            bk = c_bookings[c_bookings['branch'].isin(list(codes) + [bnorm, bnorm.upper()])]['teu'].sum()
            al = minfo.get('officeAlloc', {}).get(bnorm, 0) * active_week_count
            return {"alloc": round(al, 1), "booked": round(bk, 1), "util": round(bk / al * 100, 1) if al > 0 else 0}

        contract_util_data.append({
            "id": str(cid), "carrier": minfo.get('carrier', 'Various'), "lane": minfo.get('lane', 'Unknown'),
            "alloc": round(total_alloc, 1), "booked": booked, "util": round(util, 1),
            "status": 'Overutilised' if util > 100 else ('Healthy' if util > 80 else 'Underperforming'),
            "syd": gbr('syd', 'SY1'), "mel": gbr('mel', 'ME1'), "bne": gbr('bne', 'BN1'),
            "fre": gbr('fre', 'FR1'), "adl": gbr('adl', 'AD1'), "pil": gbr('pil', 'PIL'),
            "prj": gbr('prj', 'PRJ'), "akl": gbr('akl', 'AKL'), "oth": gbr('oth', 'OTH')
        })

    # WEEKLY_TREND_DATA
    weekly_trend_data = []
    total_master_alloc = sum(m.get('allocTotal', 0) for m in master_dict.values())
    for w_label in weeks:
        w_num = w_label.split(' ')[1]
        w_df = df[df['mscWeek'] == w_num]
        booked = round(w_df['teu'].sum(), 1)
        weekly_trend_data.append({
            "week": w_label, "alloc": round(total_master_alloc, 1), "booked": booked,
            "util": round(booked / total_master_alloc * 100, 1) if total_master_alloc > 0 else 0
        })

    # CARRIER_BREAKDOWN
    carrier_map = {}
    for _, row in df.iterrows():
        c = row.get('plannedCarrier') or row.get('carrierName') or 'Various'
        c = str(c).replace('_AU', '').replace('_AU1', '')
        if c not in carrier_map:
            carrier_map[c] = {'teu': 0, 'bookings': 0}
        carrier_map[c]['teu'] += row['teu']
        carrier_map[c]['bookings'] += 1
    total_teu = df['teu'].sum() or 1
    carrier_breakdown = sorted([
        {"carrier": k, "bookings": v['bookings'], "teu": round(v['teu'], 1),
         "pct": round(v['teu'] / total_teu * 100, 1),
         "allocated": round(sum(m.get('allocTotal', 0) for m in master_dict.values() if m.get('carrier') == k) * active_week_count, 1)}
        for k, v in carrier_map.items()
    ], key=lambda x: -x['teu'])[:15]

    # QUARTERLY
    q_data = {}
    for _, row in df.iterrows():
        q = f"Q{math.ceil(row['week_num'] / 13)} {row['year']}"
        if q not in q_data:
            q_data[q] = {'booked': 0, 'alloc': 0}
        q_data[q]['booked'] += row['teu']
    for cid, minfo in master_dict.items():
        al = minfo.get('allocTotal', 0)
        for w in weeks:
            wn_str = w.split(' ')[1]
            wn = int(wn_str.split('-')[0])
            year = wn_str.split('-')[1]
            q = f"Q{math.ceil(wn / 13)} {year}"
            if q not in q_data:
                q_data[q] = {'booked': 0, 'alloc': 0}
            q_data[q]['alloc'] += al
    quarterly_alloc_util = [
        {"quarter": q, "Allocation": round(d['alloc'], 1), "Utilisation": round(d['booked'], 1),
         "UtilPct": round(d['booked'] / d['alloc'] * 100, 1) if d['alloc'] > 0 else 0}
        for q, d in sorted(q_data.items())
    ]

    # BOOKING_LOG
    booking_log = df.replace({pd.NA: None, float('nan'): None}).to_dict('records')

    # PORT_HIERARCHY (Already built above)

    # JSON encoder
    class CustomEncoder(json.JSONEncoder):
        def default(self, obj):
            if hasattr(obj, 'tolist'): return obj.tolist()
            if hasattr(obj, 'item'): return obj.item()
            if hasattr(obj, 'isoformat'): return obj.isoformat()
            return super().default(obj)

    def clean_list(items):
        if items is None: return []
        if hasattr(items, 'tolist'): items = items.tolist()
        return sorted(list(set([str(x) for x in items if pd.notna(x) and str(x) != 'nan'])))

    ts_content = f"""// Auto-generated — do not edit manually
export const ORIGINS = {json.dumps(clean_list(origins), indent=2, cls=CustomEncoder)};
export const DESTINATIONS = {json.dumps(clean_list(destinations), indent=2, cls=CustomEncoder)};
export const LANES = {json.dumps(sorted((df['loadPort'].fillna('N/A').astype(str) + " to " + df['dischargePort'].fillna('N/A').astype(str)).unique().tolist()), indent=2, cls=CustomEncoder)};
export const ALLOCATIONS = ["Regular FAK", "Contractual"];
export const PRIORITIES = ["High", "Medium", "Low"];
export const CONTRACTS = {json.dumps(clean_list(all_master_cids), indent=2, cls=CustomEncoder)};
export const WEEKS = {json.dumps(weeks, indent=2, cls=CustomEncoder)};
export const REGIONS = {json.dumps(sorted(list(set([h['region'] for h in port_hierarchy]))), indent=2, cls=CustomEncoder)};
export const COUNTRIES = {json.dumps(sorted(list(set([h['country'] for h in port_hierarchy]))), indent=2, cls=CustomEncoder)};
export const PORT_NAMES = {json.dumps(clean_list(origins + destinations), indent=2, cls=CustomEncoder)};
export const PORT_CODES = [];
export const PORT_HIERARCHY = {json.dumps(port_hierarchy, indent=2, cls=CustomEncoder)};

export const BOOKING_LOG_DATA = {json.dumps(booking_log, indent=2, cls=CustomEncoder)};
export const BRANCH_SNAPSHOT = {json.dumps(branch_snapshot, indent=2, cls=CustomEncoder)};
export const CONTRACT_UTIL_DATA = {json.dumps(contract_util_data, indent=2, cls=CustomEncoder)};
export const WEEKLY_TREND_DATA = {json.dumps(weekly_trend_data, indent=2, cls=CustomEncoder)};
export const QUARTERLY_ALLOC_UTIL = {json.dumps(quarterly_alloc_util, indent=2, cls=CustomEncoder)};
export const CARRIER_BREAKDOWN = {json.dumps(carrier_breakdown, indent=2, cls=CustomEncoder)};
"""

    log(f"Generated BookingData.ts ({len(ts_content)} chars)")
    return ts_content, log_lines


def process_data_from_azure_json() -> tuple:
    """
    Fetch data from Azure Blob Storage, process it,
    and return the result as a JSON-serializable Python dict.
    This is the runtime-fetch counterpart of process_data_from_azure().
    """
    container = os.getenv('AZURE_CONTAINER_NAME', 'carrier-allocation')
    master_file = os.getenv('MASTER_FILE_NAME', 'Contract_Master_All_Data Update.xlsx')
    port_file = os.getenv('PORT_CODE_FILE_NAME', 'CONTRACT_PORT_CODE_LISTING.xlsx')

    log_lines = []
    def log(msg):
        print(msg)
        log_lines.append(msg)

    # 1. Fetch ALL Orders files and merge them
    all_orders = _get_all_blobs(container, 'Orders*.xlsx')
    order_frames = []
    for stream, name in all_orders:
        log(f"Reading Orders from Azure: {name}")
        order_frames.append(pd.read_excel(stream))
    df = pd.concat(order_frames, ignore_index=True)
    df = df.drop_duplicates(subset=['Order Number'], keep='last') if 'Order Number' in df.columns else df
    log(f"Merged {len(all_orders)} Orders file(s) -> {len(df)} unique rows")

    # 2. Fetch Master Data
    master_stream = _get_blob_file(container, master_file)
    log(f"Reading Master Data from Azure: {master_file}")
    df_master = pd.read_excel(master_stream)

    # Build master dictionary
    master_dict = {}
    for _, row in df_master.iterrows():
        cid = str(row['Contract #']).strip() if pd.notna(row.get('Contract #')) else ''
        if not cid:
            continue
        office_alloc = parse_office_alloc(row.get('Office Allocation'))
        alloc_total = sum(office_alloc.values())
        carrier = str(row.get('Carrier', 'Unknown'))
        priority = str(row.get('Priority', 'Normal'))
        contract_type = str(row.get('Contract Type', 'FAK'))
        contract_name = str(row.get('Contract Name', ''))
        lane = f"{str(row.get('Origin', '')).strip()} to {str(row.get('Destination', '')).strip()}"
        if cid not in master_dict:
            master_dict[cid] = {'carrier': carrier, 'allocTotal': alloc_total, 'officeAlloc': office_alloc, 'priority': priority, 'lane': lane, 'contractType': contract_type, 'contractName': contract_name}
        else:
            master_dict[cid]['allocTotal'] += alloc_total
            for hub, val in office_alloc.items():
                master_dict[cid]['officeAlloc'][hub] = master_dict[cid]['officeAlloc'].get(hub, 0) + val

    # Robust Column Mapping
    df.columns = df.columns.str.strip()
    col_map = {
        'Contract': 'contract', 'Contract #': 'contract',
        'Branch': 'branch', 'Created Branch': 'branch',
        'Week No': 'week', 'CW Week No': 'week',
        'Order Number': 'order', 'Est. Departure': 'etd', 'Est. Arrival': 'eta',
        'Departure Vessel': 'depVessel', 'Departure Voyage': 'depVoyage',
        'Buyer': 'buyer', 'Supplier': 'supplier', 'Load Port': 'loadPort',
        'Discharge Port': 'dischargePort', 'Region': 'region',
        'Planned Carrier': 'plannedCarrier', 'Carrier Name': 'carrierName'
    }
    col_map_lower = {k.lower(): v for k, v in col_map.items()}
    existing_cols = {col: col_map_lower[col.lower()] for col in df.columns if col.lower() in col_map_lower}
    
    teu_col = next((c for c in df.columns if c.lower() in ['total teu', 'teu', 'teu count _x001f_', 'teu _x001f_']), None)
    df['teu'] = df[teu_col] if teu_col else 0
    
    df = df.rename(columns=existing_cols)
    df = df.loc[:, ~df.columns.duplicated()]

    # Fallbacks for critical missing columns
    if 'contract' not in df.columns:
        df['contract'] = 'Unassigned'
    df['contract'] = df['contract'].fillna('Unassigned').astype(str)
    df['contract'] = df['contract'].replace('nan', 'Unassigned')

    if 'branch' not in df.columns:
        df['branch'] = 'Unknown'
    df['branch'] = df['branch'].fillna('Unknown').astype(str)
    
    if 'week' not in df.columns:
        df['week'] = '1'

    df = df.dropna(subset=['week'])
    df['week_num'] = df['week'].astype(str).str.extract(r'(\d+)').astype(int)
    df['year'] = pd.to_datetime(df['etd'], errors='coerce').dt.year.fillna(2026).astype(int)
    df['mscWeek'] = df['week_num'].astype(str) + '-' + df['year'].astype(str)

    # 3. Fetch Port Listing
    port_map = {}
    port_hierarchy = []
    port_file_name = 'World_Container_Ports.xlsx'
    df_ports = None

    try:
        port_stream = _get_blob_file(container, port_file_name)
        log(f"Reading Port Codes from Azure: {port_file_name}")
        df_ports = pd.read_excel(port_stream)
    except Exception as e:
        log(f"Blob '{port_file_name}' not found in Azure or fetch failed. Falling back to local hardcoded file.")

    if df_ports is None:
        try:
            repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            local_port_file = os.path.join(repo_root, port_file_name)
            log(f"Reading Port Codes from hardcoded file: {local_port_file}")
            df_ports = pd.read_excel(local_port_file)
        except Exception as e:
            log(f"Warning: Could not read hardcoded port listing file: {e}")

    if df_ports is not None:
        try:
            df_ports.columns = df_ports.columns.str.strip()
            for _, row in df_ports.iterrows():
                code = str(row.get('UN/LOCODE', '')).strip().upper()
                if code and code != 'NAN':
                    info = {
                        'code': code,
                        'name': str(row.get('Port', code)).strip().title(),
                        'country': str(row.get('Country', 'Unknown')).strip().title(),
                        'region': str(row.get('Region', 'Other')).strip().title(),
                        'lane': str(row.get('Tradelane', 'General')).strip().title()
                    }
                    port_map[code] = info
                    port_hierarchy.append(info)
        except Exception as e:
            log(f"Warning: Error processing port listing data: {e}")

    orig_codes = sorted(df['loadPort'].dropna().unique().tolist())
    dest_codes = sorted(df['dischargePort'].dropna().unique().tolist())

    for p in set(orig_codes + dest_codes):
        if p not in port_map:
            cc = str(p)[:2].upper()
            cname = {'AU': 'Australia', 'CN': 'China', 'HK': 'Hong Kong', 'NZ': 'New Zealand', 'SG': 'Singapore'}.get(cc, cc)
            rname = 'Oceania' if cc in ('AU','NZ') else ('Asia' if cc in ('CN','HK','SG') else 'Other')
            info = {'code': p, 'name': p, 'country': cname, 'region': rname, 'lane': 'General'}
            port_map[p] = info
            port_hierarchy.append(info)

    df['loadPort'] = df['loadPort'].apply(lambda x: port_map.get(x, {}).get('name', x) if pd.notna(x) else x)
    df['dischargePort'] = df['dischargePort'].apply(lambda x: port_map.get(x, {}).get('name', x) if pd.notna(x) else x)

    origins = sorted(df['loadPort'].dropna().unique().tolist())
    destinations = sorted(df['dischargePort'].dropna().unique().tolist())

    unique_weeks_df = df[['year', 'week_num', 'mscWeek']].drop_duplicates().sort_values(['year', 'week_num'])
    weeks = [f"WK {row['mscWeek']}" for _, row in unique_weeks_df.iterrows()]
    active_week_count = max(len(weeks), 1)

    # BRANCH_SNAPSHOT
    branch_snapshot = []
    std_branches = [
        ('SYDNEY', 'SY1', 'syd'), ('MELBOURNE', 'ME1', 'mel'), ('BRISBANE', 'BN1', 'bne'),
        ('FREMANTLE', 'FR1', 'fre'), ('ADELAIDE', 'AD1', 'adl'), ('PIL', 'PIL', 'pil'),
        ('PROJECTS', 'PRJ', 'prj'), ('AUCKLAND', 'AKL', 'akl'), ('OTHER', 'OTH', 'oth')
    ]
    for bname, bcode, bnorm in std_branches:
        b_df = df[df['branch'].isin([bcode, bnorm, bnorm.upper()])]
        booked = round(b_df['teu'].sum(), 1)
        alloc_pw = sum(m.get('officeAlloc', {}).get(bnorm, 0) for m in master_dict.values())
        total_alloc = alloc_pw * active_week_count
        util = (booked / total_alloc * 100) if total_alloc > 0 else 0
        status = 'Healthy' if util > 80 else ('Underperforming' if util > 50 else 'Low Uptake')
        branch_snapshot.append({
            "branch": bcode, "branchName": bname, "alloc": round(total_alloc, 1),
            "booked": booked, "avail": round(total_alloc - booked, 1), "util": round(util, 1), "status": status
        })

    # CONTRACT_UTIL_DATA
    # Iterate over ALL master contracts and any new contracts from the orders
    all_active_cids = set(df['contract'].dropna().unique().tolist())
    all_master_cids = sorted(list(set(master_dict.keys()).union(all_active_cids)))
    contract_util_data = []
    for cid in all_master_cids:
        minfo = master_dict.get(cid, {})
        c_bookings = df[df['contract'] == cid]
        booked = round(c_bookings['teu'].sum(), 1)
        alloc_pw = minfo.get('allocTotal', 0)
        total_alloc = alloc_pw * active_week_count
        util = (booked / total_alloc * 100) if total_alloc > 0 else 0

        def gbr(bnorm, *codes):
            bk = c_bookings[c_bookings['branch'].isin(list(codes) + [bnorm, bnorm.upper()])]['teu'].sum()
            al = minfo.get('officeAlloc', {}).get(bnorm, 0) * active_week_count
            return {"alloc": round(al, 1), "booked": round(bk, 1), "util": round(bk / al * 100, 1) if al > 0 else 0}

        contract_util_data.append({
            "id": str(cid), "carrier": minfo.get('carrier', 'Various'), "lane": minfo.get('lane', 'Unknown'),
            "contractType": minfo.get('contractType', 'FAK'), "contractName": minfo.get('contractName', ''),
            "alloc": round(total_alloc, 1), "booked": booked, "util": round(util, 1),
            "status": 'Overutilised' if util > 100 else ('Healthy' if util > 80 else 'Underperforming'),
            "syd": gbr('syd', 'SY1'), "mel": gbr('mel', 'ME1'), "bne": gbr('bne', 'BN1'),
            "fre": gbr('fre', 'FR1'), "adl": gbr('adl', 'AD1'), "pil": gbr('pil', 'PIL'),
            "prj": gbr('prj', 'PRJ'), "akl": gbr('akl', 'AKL'), "oth": gbr('oth', 'OTH')
        })

    # WEEKLY_TREND_DATA
    weekly_trend_data = []
    total_master_alloc = sum(m.get('allocTotal', 0) for m in master_dict.values())
    for w_label in weeks:
        w_num = w_label.split(' ')[1]
        w_df = df[df['mscWeek'] == w_num]
        booked = round(w_df['teu'].sum(), 1)
        weekly_trend_data.append({
            "week": w_label, "alloc": round(total_master_alloc, 1), "booked": booked,
            "util": round(booked / total_master_alloc * 100, 1) if total_master_alloc > 0 else 0
        })

    # CARRIER_BREAKDOWN
    carrier_map = {}
    for _, row in df.iterrows():
        c = row.get('plannedCarrier') or row.get('carrierName') or 'Various'
        c = str(c).replace('_AU', '').replace('_AU1', '')
        if c not in carrier_map:
            carrier_map[c] = {'teu': 0, 'bookings': 0}
        carrier_map[c]['teu'] += row['teu']
        carrier_map[c]['bookings'] += 1
    total_teu = df['teu'].sum() or 1
    carrier_breakdown = sorted([
        {"carrier": k, "bookings": v['bookings'], "teu": round(v['teu'], 1),
         "pct": round(v['teu'] / total_teu * 100, 1),
         "allocated": round(sum(m.get('allocTotal', 0) for m in master_dict.values() if m.get('carrier') == k) * active_week_count, 1)}
        for k, v in carrier_map.items()
    ], key=lambda x: -x['teu'])[:15]

    # QUARTERLY
    q_data = {}
    for _, row in df.iterrows():
        q = f"Q{math.ceil(row['week_num'] / 13)} {row['year']}"
        if q not in q_data:
            q_data[q] = {'booked': 0, 'alloc': 0}
        q_data[q]['booked'] += row['teu']
    for cid, minfo in master_dict.items():
        al = minfo.get('allocTotal', 0)
        for w in weeks:
            wn_str = w.split(' ')[1]
            wn = int(wn_str.split('-')[0])
            year = wn_str.split('-')[1]
            q = f"Q{math.ceil(wn / 13)} {year}"
            if q not in q_data:
                q_data[q] = {'booked': 0, 'alloc': 0}
            q_data[q]['alloc'] += al
    quarterly_alloc_util = [
        {"quarter": q, "Allocation": round(d['alloc'], 1), "Utilisation": round(d['booked'], 1),
         "UtilPct": round(d['booked'] / d['alloc'] * 100, 1) if d['alloc'] > 0 else 0}
        for q, d in sorted(q_data.items())
    ]

    # BOOKING_LOG — convert to JSON-safe dicts
    booking_log = df.replace({pd.NA: None, float('nan'): None}).to_dict('records')
    # Ensure datetime objects are serialized
    for record in booking_log:
        for key, val in record.items():
            if hasattr(val, 'isoformat'):
                record[key] = val.isoformat()
            elif hasattr(val, 'item'):
                record[key] = val.item()

    # PORT_HIERARCHY (Already built above)

    def clean_list(items):
        if items is None: return []
        if hasattr(items, 'tolist'): items = items.tolist()
        return sorted(list(set([str(x) for x in items if pd.notna(x) and str(x) != 'nan'])))

    result = {
        "ORIGINS": clean_list(origins),
        "DESTINATIONS": clean_list(destinations),
        "CONTRACTS": clean_list(all_master_cids),
        "WEEKS": weeks,
        "REGIONS": sorted(list(set([h['region'] for h in port_hierarchy]))),
        "COUNTRIES": sorted(list(set([h['country'] for h in port_hierarchy]))),
        "PORT_HIERARCHY": port_hierarchy,
        "BOOKING_LOG_DATA": booking_log,
        "BRANCH_SNAPSHOT": branch_snapshot,
        "CONTRACT_UTIL_DATA": contract_util_data,
        "WEEKLY_TREND_DATA": weekly_trend_data,
        "QUARTERLY_ALLOC_UTIL": quarterly_alloc_util,
        "CARRIER_BREAKDOWN": carrier_breakdown,
    }

    # Sanitize entire result — replace NaN/Infinity with None (JSON-safe)
    result = _sanitize_for_json(result)

    log(f"Generated JSON data ({len(booking_log)} booking records)")
    return result, log_lines


def _sanitize_for_json(obj):
    """Recursively replace NaN, Infinity, -Infinity with None so JSON serialization doesn't fail."""
    if isinstance(obj, dict):
        return {k: _sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_sanitize_for_json(item) for item in obj]
    elif isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    # Handle numpy types that might sneak through
    elif hasattr(obj, 'item'):
        val = obj.item()
        if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
            return None
        return val
    return obj
