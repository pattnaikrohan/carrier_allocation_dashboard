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
import snowflake.connector
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization

def fetch_orders_from_snowflake(log_func):
    """Fetch orders data from Snowflake using JWT authentication."""
    log_func("Connecting to Snowflake...")
    
    key_content = os.getenv('SF_PRIVATE_KEY_CONTENT')
    if key_content:
        # Handle newlines if Azure squashes them
        key_content = key_content.replace('\\n', '\n')
        key_bytes = key_content.encode('utf-8')
    else:
        key_path = os.getenv('SF_PRIVATE_KEY_PATH', 'scratch/snowflake_key.pem')
        if not os.path.exists(key_path):
            repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            alt_path = os.path.join(repo_root, key_path)
            if os.path.exists(alt_path):
                key_path = alt_path
        with open(key_path, "rb") as key:
            key_bytes = key.read()

    p_key = serialization.load_pem_private_key(
        key_bytes,
        password=None,
        backend=default_backend()
    )

    pkb = p_key.private_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption())

    ctx = snowflake.connector.connect(
        user=os.getenv('SF_USER', 'TEST_AI_AUTO'),
        account=os.getenv('SF_ACCOUNT', 'SGLYREN-GG43054'),
        private_key=pkb,
        warehouse=os.getenv('SF_WAREHOUSE', 'DEV_COMPUTE_WH'),
        database=os.getenv('SF_DATABASE', 'DEV'),
        schema=os.getenv('SF_SCHEMA', 'PUBLIC')
    )

    cs = ctx.cursor()
    log_func("Querying Snowflake DEV.RAW.TEST_ORDER...")
    cs.execute("SELECT * FROM DEV.RAW.TEST_ORDER")
    df = cs.fetch_pandas_all()
    ctx.close()
    
    log_func(f"Fetched {len(df)} rows from Snowflake.")
    
    # Normalize TEU column
    teu_cols = [c for c in df.columns if 'teu' in c.lower()]
    if teu_cols:
        teu_vals = df[teu_cols].apply(pd.to_numeric, errors='coerce').fillna(0)
        df['Total TEU'] = teu_vals.max(axis=1)
        df = df.drop(columns=[c for c in teu_cols if c != 'Total TEU'])
    else:
        df['Total TEU'] = 0
        
    df = df.drop_duplicates(subset=['ORDER_NUMBER'], keep='last') if 'ORDER_NUMBER' in df.columns else df
    return df

def fetch_orders_from_azure(log_func, container):
    """Fetch orders data from Azure Blob Storage."""
    log_func("Fetching Orders from Azure Blob Storage...")
    all_orders = _get_all_blobs(container, 'Orders*.xlsx')
    order_frames = []
    for stream, name in all_orders:
        log_func(f"Reading Orders from Azure: {name}")
        df_part = pd.read_excel(stream)
        df_part.columns = df_part.columns.str.strip()
        # Normalize TEU
        teu_cols = [c for c in df_part.columns if 'teu' in c.lower()]
        if teu_cols:
            teu_vals = df_part[teu_cols].apply(pd.to_numeric, errors='coerce').fillna(0)
            df_part['Total TEU'] = teu_vals.max(axis=1)
            df_part = df_part.drop(columns=[c for c in teu_cols if c != 'Total TEU'])
        else:
            df_part['Total TEU'] = 0
        log_func(f"  -> {len(df_part)} rows, TEU column normalized")
        order_frames.append(df_part)
    df = pd.concat(order_frames, ignore_index=True)
    df = df.drop_duplicates(subset=['Order Number'], keep='last') if 'Order Number' in df.columns else df
    log_func(f"Merged {len(all_orders)} Orders file(s) -> {len(df)} unique rows")
    return df



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


# ── Region Normalization ─────────────────────────────────────────────────────
_NEA_PORTS = ['qingdao', 'cnqin', 'yantian', 'cnyan', 'ningbo', 'cnnbo', 'cnnbg',
              'shanghai', 'cnsha', 'cnsgh', 'changzhou', 'cncgb', 'xiamen', 'cnxmn']
_SEA_PORTS = ['thailand', 'thai', 'vietnam', 'vnhph', 'vndad', 'vnsgn',
              'indonesia', 'idjkt', 'malaysia', 'mypkg', 'mypen', 'philippines', 'phmnl',
              'singapore', 'sgsin', 'cambodia', 'myanmar']
_EUR_PORTS = ['europe', 'hamburg', 'deham', 'rotterdam', 'nlrtm', 'antwerp', 'beanr',
              'felixstowe', 'gbfxt', 'le havre', 'frleh']

def normalize_region(origin_str):
    """Map a master-data Origin value to a standard region code."""
    if origin_str is None:
        return 'Unknown'
    s = str(origin_str).strip()
    if not s or s.lower() == 'nan':
        return 'Unknown'
    s_upper = s.upper()
    if s_upper in ('NEA', 'SEA', 'EUR'):
        return s_upper
    if s_upper in ('NORTH EUR',):
        return 'EUR'
    if s_upper in ('AU', 'AU/ NZ', 'AU/NZ', 'AU, NZ'):
        return 'AU'
    if s_upper == 'NZ':
        return 'NZ'
    s_lower = s.lower()
    for p in _NEA_PORTS:
        if p in s_lower:
            return 'NEA'
    for p in _SEA_PORTS:
        if p in s_lower:
            return 'SEA'
    for p in _EUR_PORTS:
        if p in s_lower:
            return 'EUR'
    if s_upper.startswith('US'):
        return 'Americas'
    return s

def normalize_dest(dest_str):
    """Map a master-data Destination value to a standard destination code."""
    if dest_str is None:
        return 'Unknown'
    s = str(dest_str).strip().upper()
    if not s or s == 'NAN':
        return 'Unknown'
    if s in ('AUEC', 'AUWC', 'AUDRW'):
        return 'AU'
    if s in ('AU', 'AU/ NZ', 'AU/NZ', 'AU, NZ'):
        return 'AU'
    if s in ('AUEC/ NZAKL',):
        return 'AU/NZ'
    if s in ('NZ', 'NZAKL'):
        return 'NZ'
    if s in ('AMRWC', 'AMREC'):
        return 'Americas'
    return s

def process_data_from_azure(force_source: str = None) -> str:
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

    # 1. Fetch Orders based on feature toggle
    data_source = (force_source or os.getenv('DATA_SOURCE', 'SNOWFLAKE')).upper()
    if data_source == 'SNOWFLAKE':
        try:
            df = fetch_orders_from_snowflake(log)
        except Exception as e:
            log(f"Snowflake fetch failed: {e}. Falling back to Azure Blob...")
            df = fetch_orders_from_azure(log, container)
    else:
        df = fetch_orders_from_azure(log, container)

    # 2. Fetch Master Data
    try:
        master_stream = _get_blob_file(container, master_file)
        log(f"Reading Master Data from Azure: {master_file}")
        df_master = pd.read_excel(master_stream)
    except Exception as e:
        log(f"Could not fetch Master Data from Azure ({e}). Falling back to local file.")
        repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        local_master = os.path.join(repo_root, master_file)
        df_master = pd.read_excel(local_master)

    # Build master dict with compound keys for multi-leg contracts
    master_dict = {}
    cid_to_keys = {}
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
        raw_origin = str(row.get('Origin', '')).strip() if pd.notna(row.get('Origin')) else ''
        raw_dest = str(row.get('Destination', '')).strip() if pd.notna(row.get('Destination')) else ''
        origin_region = normalize_region(raw_origin)
        dest_region = normalize_dest(raw_dest)
        lane = f"{origin_region} to {dest_region}"
        compound_key = f"{cid}__{origin_region}_{dest_region}"

        if compound_key not in master_dict:
            master_dict[compound_key] = {
                'cid': cid, 'carrier': carrier, 'allocTotal': alloc_total,
                'officeAlloc': office_alloc, 'priority': priority, 'lane': lane,
                'originRegion': origin_region, 'destRegion': dest_region,
                'rawOrigins': [raw_origin], 'rawDests': [raw_dest],
                'polBreakdown': [],
                'contractType': contract_type, 'contractName': contract_name,
            }
        else:
            master_dict[compound_key]['allocTotal'] += alloc_total
            master_dict[compound_key]['rawOrigins'].append(raw_origin)
            master_dict[compound_key]['rawDests'].append(raw_dest)
            for hub, val in office_alloc.items():
                master_dict[compound_key]['officeAlloc'][hub] = master_dict[compound_key]['officeAlloc'].get(hub, 0) + val

        if cid not in cid_to_keys:
            cid_to_keys[cid] = []
        if compound_key not in cid_to_keys[cid]:
            cid_to_keys[cid].append(compound_key)

        if raw_origin and raw_origin not in ('NEA', 'SEA', 'EUR', 'AU', 'NZ', 'NORTH EUR') and alloc_total > 0:
            master_dict[compound_key]['polBreakdown'].append({
                'port': raw_origin, 'dest': raw_dest, 'teuPerWeek': alloc_total,
            })


    # Robust Column Mapping
    df.columns = df.columns.str.strip()
    col_map = {
        'Contract': 'contract', 'Contract #': 'contract', 'CONTRACT': 'contract',
        'Branch': 'branch', 'Created Branch': 'branch', 'BRANCH': 'branch',
        'Week No': 'week', 'CW Week No': 'week', 'WEEK NO': 'week',
        'Order Number': 'order', 'ORDER_NUMBER': 'order', 'Est. Departure': 'etd', 'EST_DEPARTURE': 'etd', 'Est. Arrival': 'eta', 'EST_ARRIVAL': 'eta',
        'BCN': 'bcn', 'CANCELLED_ORDERS': 'cancelled_orders', 'Cancelled_Orders': 'cancelled_orders', 'cancelled_orders': 'cancelled_orders',
        'Departure Vessel': 'depVessel', 'Departure Voyage': 'depVoyage', 'DEPARTURE VESSEL': 'depVessel', 'DEPARTURE VOYAGE': 'depVoyage',
        'Buyer': 'buyer', 'Supplier': 'supplier', 'BUYER': 'buyer', 'SUPPLIER': 'supplier', 'Load Port': 'loadPort', 'LOAD PORT': 'loadPort',
        'Discharge Port': 'dischargePort', 'DISCHARGE PORT': 'dischargePort', 'Region': 'region',
        'Planned Carrier': 'plannedCarrier', 'PLANNED CARRIER': 'plannedCarrier', 'Carrier Name': 'carrierName'
    }
    col_map_lower = {k.lower(): v for k, v in col_map.items()}
    existing_cols = {col: col_map_lower[col.lower()] for col in df.columns if col.lower() in col_map_lower}
    
    # TEU Resolution: 'Total TEU' was already normalized per-file above,
    # but apply row-wise max as a safety net in case any variant columns survived.
    teu_candidates = [c for c in df.columns if 'teu' in c.lower()]
    if teu_candidates:
        teu_frame = df[teu_candidates].apply(pd.to_numeric, errors='coerce').fillna(0)
        df['teu'] = teu_frame.max(axis=1)
    else:
        df['teu'] = 0
    
    df = df.rename(columns=existing_cols)
    df = df.loc[:, ~df.columns.duplicated()]

    # --- Filter out BCN orders (item #1) ---
    if 'bcn' in df.columns:
        df['bcn'] = df['bcn'].apply(lambda x: str(x).strip().lower() in ('1', 'true', 'yes'))
        bcn_count = df['bcn'].sum()
        df = df[~df['bcn']]
        log(f"Excluded {int(bcn_count)} BCN orders")

    # --- Filter out cancelled orders (item #6) ---
    if 'cancelled_orders' in df.columns:
        df['cancelled_orders'] = pd.to_numeric(df['cancelled_orders'], errors='coerce').fillna(0)
        cancelled_count = (df['cancelled_orders'] == 1).sum()
        df = df[df['cancelled_orders'] != 1]
        log(f"Excluded {int(cancelled_count)} cancelled orders")

    # Fallbacks for critical missing columns
    if 'contract' not in df.columns:
        df['contract'] = 'OTHER'
    df['contract'] = df['contract'].fillna('OTHER').astype(str)
    df['contract'] = df['contract'].replace('nan', 'OTHER')
    df['contract'] = df['contract'].replace('Unassigned', 'OTHER')
    df['contract'] = df['contract'].replace('', 'OTHER')  # Fix empty string contracts

    if 'branch' not in df.columns:
        df['branch'] = 'Unknown'
    df['branch'] = df['branch'].fillna('Unknown').astype(str)

    # --- Normalize branch codes ---
    branch_code_map = {
        'BR1': 'BN1',   # Brisbane alternate code
        'BLL': 'ME1',   # Ballarat → Melbourne hub
        'CCC': 'OTH',   # Unknown code → Other
    }
    df['branch'] = df['branch'].replace(branch_code_map)

    # --- Infer branch from Discharge Port when branch is Unknown ---
    discharge_port_col = None
    for col in df.columns:
        if col.lower().replace(' ', '') in ('dischargeport', 'discharge_port'):
            discharge_port_col = col
            break

    if discharge_port_col is not None:
        discharge_to_branch = {
            'AUSYD': 'SY1', 'AUMEL': 'ME1', 'AUBNE': 'BN1',
            'AUFRE': 'FR1', 'AUPER': 'FR1', 'AUADL': 'AD1',
            'NZAKL': 'AKL', 'NZTRG': 'AKL', 'NZLYT': 'AKL', 'NZCHC': 'AKL',
            'GBFXT': 'PRJ', 'GBSOU': 'PRJ', 'NLRTM': 'PRJ',
            'BEANR': 'PRJ', 'DEHAM': 'PRJ',
            'USNYC': 'PRJ', 'USLAX': 'PRJ', 'USOAK': 'PRJ',
            'USLGB': 'PRJ', 'USLUI': 'PRJ',
            'CAYVR': 'PRJ', 'CATOR': 'PRJ',
        }

        unknown_mask = df['branch'].isin(['Unknown', 'nan', ''])
        inferred_count = 0
        remaining_oth = 0
        if unknown_mask.any() and discharge_port_col in df.columns:
            dp_upper = df.loc[unknown_mask, discharge_port_col].astype(str).str.strip().str.upper()
            inferred = dp_upper.map(discharge_to_branch)
            inferred_count = inferred.notna().sum()
            df.loc[unknown_mask, 'branch'] = df.loc[unknown_mask, 'branch'].where(
                inferred.isna(), inferred
            )
            # Remaining unknowns -> OTH
            still_unknown = df['branch'].isin(['Unknown', 'nan', ''])
            remaining_oth = int(still_unknown.sum())
            df.loc[still_unknown, 'branch'] = 'OTH'

        log(f"Branch inference: {int(inferred_count)} rows inferred from discharge port, "
            f"{remaining_oth} remaining as OTH")
    else:
        # No discharge port column, just map unknowns to OTH
        df.loc[df['branch'].isin(['Unknown', 'nan', '']), 'branch'] = 'OTH'
        log("No discharge port column found for branch inference")

    
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
    # Build a reverse lookup: port name → trade lane region code
    _region_map = {
        'North East Asia': 'NEA', 'South East Asia': 'SEA', 'Europe': 'EUR',
        'Oceania': 'AU', 'Americas': 'Americas', 'Asia': 'NEA',
    }
    port_name_to_region = {}
    for code, info in port_map.items():
        name_upper = info.get('name', '').strip().upper()
        if name_upper:
            region_raw = info.get('region', '')
            port_name_to_region[name_upper] = _region_map.get(region_raw, region_raw)
        region_raw = info.get('region', '')
        port_name_to_region[code] = _region_map.get(region_raw, region_raw)

    def get_port_region(port_value):
        if not port_value or str(port_value) == 'nan':
            return 'Unknown'
        p_upper = str(port_value).strip().upper()
        if p_upper in port_name_to_region:
            return port_name_to_region[p_upper]
        return normalize_region(port_value)

    all_active_cids = set(df['contract'].dropna().unique().tolist())
    processed_cids = set()
    processed_master_cids = set()
    contract_util_data = []

    for compound_key, minfo in sorted(master_dict.items()):
        cid = minfo['cid']
        processed_cids.add(cid)
        origin_region = minfo.get('originRegion', 'Unknown')

        c_all_bookings = df[df['contract'] == cid]
        keys_for_cid = cid_to_keys.get(cid, [compound_key])
        if len(keys_for_cid) > 1 and not c_all_bookings.empty:
            mask = c_all_bookings['loadPort'].apply(lambda lp: get_port_region(lp) == origin_region)
            c_bookings = c_all_bookings[mask]
        else:
            c_bookings = c_all_bookings

        booked = round(c_bookings['teu'].sum(), 1)
        alloc_pw = minfo.get('allocTotal', 0)
        total_alloc = alloc_pw * active_week_count
        # Item #7: No calculation for OTH/SPOT/AGENT
        no_calc = cid.upper() in ('OTH', 'SPOT', 'AGENT', 'OTHER')
        # Item #9: No percentage when no allocation
        if no_calc:
            util = None
            status = 'N/A'
        elif total_alloc > 0:
            util = round(booked / total_alloc * 100, 1)
            status = 'Overutilised' if util > 100 else ('Healthy' if util > 80 else 'Underperforming')
        else:
            util = None
            status = 'No Allocation'

        def gbr(bnorm, *codes):
            bk = c_bookings[c_bookings['branch'].isin(list(codes) + [bnorm, bnorm.upper()])]['teu'].sum()
            al = minfo.get('officeAlloc', {}).get(bnorm, 0) * active_week_count
            return {"alloc": round(al, 1), "booked": round(bk, 1), "util": round(bk / al * 100, 1) if al > 0 else 0}

        contract_util_data.append({
            "id": compound_key, "carrier": minfo.get('carrier', 'Various'), "lane": minfo.get('lane', 'Unknown'),
            "contractType": minfo.get('contractType', ''), "contractName": minfo.get('contractName', ''),
            "originRegion": minfo.get('originRegion', 'Unknown'),
            "destRegion": minfo.get('destRegion', 'Unknown'),
            "origins": list(set(minfo.get('rawOrigins', []))),
            "destinations": list(set(minfo.get('rawDests', []))),
            "polBreakdown": minfo.get('polBreakdown', []),
            "alloc": round(total_alloc, 1), "booked": booked, "util": util,
            "noCalc": no_calc,
            "status": status,
            "avail": round(total_alloc - booked, 1),
            "syd": gbr('syd', 'SY1'), "mel": gbr('mel', 'ME1'), "bne": gbr('bne', 'BN1'),
            "fre": gbr('fre', 'FR1'), "adl": gbr('adl', 'AD1'), "pil": gbr('pil', 'PIL'),
            "prj": gbr('prj', 'PRJ'), "akl": gbr('akl', 'AKL'), "oth": gbr('oth', 'OTH')
        })

    for cid in sorted(all_active_cids - processed_cids):
        c_bookings = df[df['contract'] == cid]
        booked = round(c_bookings['teu'].sum(), 1)
        no_calc = cid.upper() in ('OTH', 'SPOT', 'AGENT', 'OTHER')
        def gbr_orphan(bnorm, *codes):
            bk = c_bookings[c_bookings['branch'].isin(list(codes) + [bnorm, bnorm.upper()])]['teu'].sum()
            return {"alloc": 0, "booked": round(bk, 1), "util": 0}
        contract_util_data.append({
            "id": str(cid), "carrier": 'Various', "lane": 'Unknown',
            "contractType": '', "contractName": '',
            "originRegion": 'Unknown', "destRegion": 'Unknown',
            "origins": [], "destinations": [], "polBreakdown": [],
            "alloc": 0, "booked": booked, "util": None if no_calc else 0,
            "noCalc": no_calc,
            "status": 'N/A' if no_calc else 'No Allocation', "avail": -booked,
            "syd": gbr_orphan('syd', 'SY1'), "mel": gbr_orphan('mel', 'ME1'), "bne": gbr_orphan('bne', 'BN1'),
            "fre": gbr_orphan('fre', 'FR1'), "adl": gbr_orphan('adl', 'AD1'), "pil": gbr_orphan('pil', 'PIL'),
            "prj": gbr_orphan('prj', 'PRJ'), "akl": gbr_orphan('akl', 'AKL'), "oth": gbr_orphan('oth', 'OTH')
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
export const CONTRACTS = {json.dumps(clean_list(list(processed_cids) + list(all_active_cids - processed_master_cids)), indent=2, cls=CustomEncoder)};
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


def process_data_from_azure_json(force_source: str = None) -> tuple:
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

    # 1. Fetch Orders based on feature toggle
    data_source = (force_source or os.getenv('DATA_SOURCE', 'SNOWFLAKE')).upper()
    if data_source == 'SNOWFLAKE':
        try:
            df = fetch_orders_from_snowflake(log)
        except Exception as e:
            if force_source:
                log(f"Snowflake fetch failed explicitly: {e}")
                raise e
            log(f"Snowflake fetch failed: {e}. Falling back to Azure Blob...")
            df = fetch_orders_from_azure(log, container)
    else:
        df = fetch_orders_from_azure(log, container)

    # 2. Fetch Master Data
    try:
        master_stream = _get_blob_file(container, master_file)
        log(f"Reading Master Data from Azure: {master_file}")
        df_master = pd.read_excel(master_stream)
    except Exception as e:
        log(f"Could not fetch Master Data from Azure ({e}). Falling back to local file.")
        repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        local_master = os.path.join(repo_root, master_file)
        df_master = pd.read_excel(local_master)

    # Build master dict with compound keys for multi-leg contracts
    master_dict = {}
    cid_to_keys = {}
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
        raw_origin = str(row.get('Origin', '')).strip() if pd.notna(row.get('Origin')) else ''
        raw_dest = str(row.get('Destination', '')).strip() if pd.notna(row.get('Destination')) else ''
        origin_region = normalize_region(raw_origin)
        dest_region = normalize_dest(raw_dest)
        lane = f"{origin_region} to {dest_region}"
        compound_key = f"{cid}__{origin_region}_{dest_region}"

        if compound_key not in master_dict:
            master_dict[compound_key] = {
                'cid': cid, 'carrier': carrier, 'allocTotal': alloc_total,
                'officeAlloc': office_alloc, 'priority': priority, 'lane': lane,
                'originRegion': origin_region, 'destRegion': dest_region,
                'rawOrigins': [raw_origin], 'rawDests': [raw_dest],
                'polBreakdown': [],
                'contractType': contract_type, 'contractName': contract_name,
            }
        else:
            master_dict[compound_key]['allocTotal'] += alloc_total
            master_dict[compound_key]['rawOrigins'].append(raw_origin)
            master_dict[compound_key]['rawDests'].append(raw_dest)
            for hub, val in office_alloc.items():
                master_dict[compound_key]['officeAlloc'][hub] = master_dict[compound_key]['officeAlloc'].get(hub, 0) + val

        if cid not in cid_to_keys:
            cid_to_keys[cid] = []
        if compound_key not in cid_to_keys[cid]:
            cid_to_keys[cid].append(compound_key)

        if raw_origin and raw_origin not in ('NEA', 'SEA', 'EUR', 'AU', 'NZ', 'NORTH EUR') and alloc_total > 0:
            master_dict[compound_key]['polBreakdown'].append({
                'port': raw_origin, 'dest': raw_dest, 'teuPerWeek': alloc_total,
            })


    # Robust Column Mapping
    df.columns = df.columns.str.strip()
    col_map = {
        'Contract': 'contract', 'Contract #': 'contract', 'CONTRACT': 'contract',
        'Branch': 'branch', 'Created Branch': 'branch', 'BRANCH': 'branch',
        'Week No': 'week', 'CW Week No': 'week', 'WEEK NO': 'week',
        'Order Number': 'order', 'ORDER_NUMBER': 'order', 'Est. Departure': 'etd', 'EST_DEPARTURE': 'etd', 'Est. Arrival': 'eta', 'EST_ARRIVAL': 'eta',
        'BCN': 'bcn', 'CANCELLED_ORDERS': 'cancelled_orders', 'Cancelled_Orders': 'cancelled_orders', 'cancelled_orders': 'cancelled_orders',
        'Departure Vessel': 'depVessel', 'Departure Voyage': 'depVoyage', 'DEPARTURE VESSEL': 'depVessel', 'DEPARTURE VOYAGE': 'depVoyage',
        'Buyer': 'buyer', 'Supplier': 'supplier', 'BUYER': 'buyer', 'SUPPLIER': 'supplier', 'Load Port': 'loadPort', 'LOAD PORT': 'loadPort',
        'Discharge Port': 'dischargePort', 'DISCHARGE PORT': 'dischargePort', 'Region': 'region',
        'Planned Carrier': 'plannedCarrier', 'PLANNED CARRIER': 'plannedCarrier', 'Carrier Name': 'carrierName'
    }
    col_map_lower = {k.lower(): v for k, v in col_map.items()}
    existing_cols = {col: col_map_lower[col.lower()] for col in df.columns if col.lower() in col_map_lower}
    
    # TEU Resolution: 'Total TEU' was already normalized per-file above,
    # but apply row-wise max as a safety net in case any variant columns survived.
    teu_candidates = [c for c in df.columns if 'teu' in c.lower()]
    if teu_candidates:
        teu_frame = df[teu_candidates].apply(pd.to_numeric, errors='coerce').fillna(0)
        df['teu'] = teu_frame.max(axis=1)
    else:
        df['teu'] = 0
    
    df = df.rename(columns=existing_cols)
    df = df.loc[:, ~df.columns.duplicated()]

    # --- Filter out BCN orders (item #1) ---
    if 'bcn' in df.columns:
        df['bcn'] = df['bcn'].apply(lambda x: str(x).strip().lower() in ('1', 'true', 'yes'))
        bcn_count = df['bcn'].sum()
        df = df[~df['bcn']]
        log(f"Excluded {int(bcn_count)} BCN orders")

    # --- Filter out cancelled orders (item #6) ---
    if 'cancelled_orders' in df.columns:
        df['cancelled_orders'] = pd.to_numeric(df['cancelled_orders'], errors='coerce').fillna(0)
        cancelled_count = (df['cancelled_orders'] == 1).sum()
        df = df[df['cancelled_orders'] != 1]
        log(f"Excluded {int(cancelled_count)} cancelled orders")

    # Fallbacks for critical missing columns
    if 'contract' not in df.columns:
        df['contract'] = 'OTHER'
    df['contract'] = df['contract'].fillna('OTHER').astype(str)
    df['contract'] = df['contract'].replace('nan', 'OTHER')
    df['contract'] = df['contract'].replace('Unassigned', 'OTHER')
    df['contract'] = df['contract'].replace('', 'OTHER')  # Fix empty string contracts

    if 'branch' not in df.columns:
        df['branch'] = 'Unknown'
    df['branch'] = df['branch'].fillna('Unknown').astype(str)

    # --- Normalize branch codes ---
    branch_code_map = {
        'BR1': 'BN1',   # Brisbane alternate code
        'BLL': 'ME1',   # Ballarat -> Melbourne hub
        'CCC': 'OTH',   # Unknown code -> Other
    }
    df['branch'] = df['branch'].replace(branch_code_map)

    # --- Infer branch from Discharge Port when branch is Unknown ---
    discharge_port_col = None
    for col in df.columns:
        if col.lower().replace(' ', '') in ('dischargeport', 'discharge_port'):
            discharge_port_col = col
            break

    if discharge_port_col is not None:
        discharge_to_branch = {
            'AUSYD': 'SY1', 'AUMEL': 'ME1', 'AUBNE': 'BN1',
            'AUFRE': 'FR1', 'AUPER': 'FR1', 'AUADL': 'AD1',
            'NZAKL': 'AKL', 'NZTRG': 'AKL', 'NZLYT': 'AKL', 'NZCHC': 'AKL',
            'GBFXT': 'PRJ', 'GBSOU': 'PRJ', 'NLRTM': 'PRJ',
            'BEANR': 'PRJ', 'DEHAM': 'PRJ',
            'USNYC': 'PRJ', 'USLAX': 'PRJ', 'USOAK': 'PRJ',
            'USLGB': 'PRJ', 'USLUI': 'PRJ',
            'CAYVR': 'PRJ', 'CATOR': 'PRJ',
        }

        unknown_mask = df['branch'].isin(['Unknown', 'nan', ''])
        inferred_count = 0
        remaining_oth = 0
        if unknown_mask.any() and discharge_port_col in df.columns:
            dp_upper = df.loc[unknown_mask, discharge_port_col].astype(str).str.strip().str.upper()
            inferred = dp_upper.map(discharge_to_branch)
            inferred_count = inferred.notna().sum()
            df.loc[unknown_mask, 'branch'] = df.loc[unknown_mask, 'branch'].where(
                inferred.isna(), inferred
            )
            # Remaining unknowns -> OTH
            still_unknown = df['branch'].isin(['Unknown', 'nan', ''])
            remaining_oth = int(still_unknown.sum())
            df.loc[still_unknown, 'branch'] = 'OTH'

        log(f"Branch inference: {int(inferred_count)} rows inferred from discharge port, "
            f"{remaining_oth} remaining as OTH")
    else:
        # No discharge port column, just map unknowns to OTH
        df.loc[df['branch'].isin(['Unknown', 'nan', '']), 'branch'] = 'OTH'
        log("No discharge port column found for branch inference")
    
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
    # Build a reverse lookup: port name → trade lane region code
    _region_map = {
        'North East Asia': 'NEA', 'South East Asia': 'SEA', 'Europe': 'EUR',
        'Oceania': 'AU', 'Americas': 'Americas', 'Asia': 'NEA',
    }
    port_name_to_region = {}
    for code, info in port_map.items():
        name_upper = info.get('name', '').strip().upper()
        if name_upper:
            region_raw = info.get('region', '')
            port_name_to_region[name_upper] = _region_map.get(region_raw, region_raw)
        region_raw = info.get('region', '')
        port_name_to_region[code] = _region_map.get(region_raw, region_raw)

    def get_port_region(port_value):
        if not port_value or str(port_value) == 'nan':
            return 'Unknown'
        p_upper = str(port_value).strip().upper()
        if p_upper in port_name_to_region:
            return port_name_to_region[p_upper]
        return normalize_region(port_value)

    all_active_cids = set(df['contract'].dropna().unique().tolist())
    processed_cids = set()
    processed_master_cids = set()
    contract_util_data = []

    for compound_key, minfo in sorted(master_dict.items()):
        cid = minfo['cid']
        
        if compound_key in processed_cids:
            continue
        processed_cids.add(compound_key)
        processed_master_cids.add(cid)
        
        origin_region = minfo.get('originRegion', 'Unknown')
        dest_region = minfo.get('destRegion', 'Unknown')
        
        c_all_bookings = df[df['contract'] == cid]
        keys_for_cid = cid_to_keys.get(cid, [compound_key])
        if len(keys_for_cid) > 1 and not c_all_bookings.empty:
            mask = c_all_bookings['loadPort'].apply(lambda lp: get_port_region(lp) == origin_region)
            c_bookings = c_all_bookings[mask]
        else:
            c_bookings = c_all_bookings

        booked = round(c_bookings['teu'].sum(), 1)
        alloc_pw = minfo.get('allocTotal', 0)
        total_alloc = alloc_pw * active_week_count
        # Item #7: No calculation for OTH/SPOT/AGENT
        no_calc = cid.upper() in ('OTH', 'SPOT', 'AGENT', 'OTHER')
        # Item #9: No percentage when no allocation
        if no_calc:
            util = None
            status = 'N/A'
        elif total_alloc > 0:
            util = round(booked / total_alloc * 100, 1)
            status = 'Overutilised' if util > 100 else ('Healthy' if util > 80 else 'Underperforming')
        else:
            util = None
            status = 'No Allocation'

        def gbr(bnorm, *codes):
            bk = c_bookings[c_bookings['branch'].isin(list(codes) + [bnorm, bnorm.upper()])]['teu'].sum()
            al = minfo.get('officeAlloc', {}).get(bnorm, 0) * active_week_count
            return {"alloc": round(al, 1), "booked": round(bk, 1), "util": round(bk / al * 100, 1) if al > 0 else 0}

        contract_util_data.append({
            "id": compound_key, "carrier": minfo.get('carrier', 'Various'), "lane": minfo.get('lane', 'Unknown'),
            "contractType": minfo.get('contractType', 'FAK'), "contractName": minfo.get('contractName', ''),
            "originRegion": minfo.get('originRegion', 'Unknown'),
            "destRegion": minfo.get('destRegion', 'Unknown'),
            "origins": list(set(minfo.get('rawOrigins', []))),
            "destinations": list(set(minfo.get('rawDests', []))),
            "polBreakdown": minfo.get('polBreakdown', []),
            "alloc": round(total_alloc, 1), "booked": booked, "util": util,
            "noCalc": no_calc,
            "status": status,
            "avail": round(total_alloc - booked, 1),
            "syd": gbr('syd', 'SY1'), "mel": gbr('mel', 'ME1'), "bne": gbr('bne', 'BN1'),
            "fre": gbr('fre', 'FR1'), "adl": gbr('adl', 'AD1'), "pil": gbr('pil', 'PIL'),
            "prj": gbr('prj', 'PRJ'), "akl": gbr('akl', 'AKL'), "oth": gbr('oth', 'OTH')
        })

    for cid in sorted(all_active_cids - processed_master_cids):
        c_bookings = df[df['contract'] == cid]
        booked = round(c_bookings['teu'].sum(), 1)
        no_calc = cid.upper() in ('OTH', 'SPOT', 'AGENT', 'OTHER')
        def gbr_orphan(bnorm, *codes):
            bk = c_bookings[c_bookings['branch'].isin(list(codes) + [bnorm, bnorm.upper()])]['teu'].sum()
            return {"alloc": 0, "booked": round(bk, 1), "util": 0}
        contract_util_data.append({
            "id": str(cid), "carrier": 'Various', "lane": 'Unknown',
            "contractType": '', "contractName": '',
            "originRegion": 'Unknown', "destRegion": 'Unknown',
            "origins": [], "destinations": [], "polBreakdown": [],
            "alloc": 0, "booked": booked, "util": None if no_calc else 0,
            "noCalc": no_calc,
            "status": 'N/A' if no_calc else 'No Allocation', "avail": -booked,
            "syd": gbr_orphan('syd', 'SY1'), "mel": gbr_orphan('mel', 'ME1'), "bne": gbr_orphan('bne', 'BN1'),
            "fre": gbr_orphan('fre', 'FR1'), "adl": gbr_orphan('adl', 'AD1'), "pil": gbr_orphan('pil', 'PIL'),
            "prj": gbr_orphan('prj', 'PRJ'), "akl": gbr_orphan('akl', 'AKL'), "oth": gbr_orphan('oth', 'OTH')
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
        "CONTRACTS": clean_list(list(processed_cids) + list(all_active_cids - processed_master_cids)),
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
