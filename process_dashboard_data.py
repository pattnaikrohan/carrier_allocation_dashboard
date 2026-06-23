import pandas as pd
import json
import os
import glob
import re
import math
import io
from azure.storage.blob import BlobServiceClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Config & Paths
ROOT_DIR = 'D:/Dashboards'
AZURE_ACCOUNT = os.getenv('AZURE_STORAGE_ACCOUNT')
AZURE_SAS_TOKEN = os.getenv('AZURE_SAS_TOKEN')
AZURE_CONTAINER = os.getenv('AZURE_CONTAINER_NAME', 'carrier-allocation')

# Output directly to the file the frontend imports
OUTPUT_PATH = os.path.join(ROOT_DIR, 'frontend/src/BookingData.ts')

def _get_blob_service_client():
    """Create a BlobServiceClient using SAS token authentication."""
    account_url = f"https://{AZURE_ACCOUNT}.blob.core.windows.net"
    return BlobServiceClient(account_url=account_url, credential=f"?{AZURE_SAS_TOKEN}")

def _is_azure_configured():
    """Check if Azure Blob Storage is properly configured."""
    return bool(AZURE_ACCOUNT and AZURE_SAS_TOKEN)

def get_latest_file(pattern, default):
    # Check Azure first if configured
    if _is_azure_configured():
        try:
            print(f"Searching Azure Blob Storage ({AZURE_CONTAINER})...")
            blob_service_client = _get_blob_service_client()
            container_client = blob_service_client.get_container_client(AZURE_CONTAINER)
            blobs = list(container_client.list_blobs())
            print(f"  Found {len(blobs)} blob(s) in container.")
            
            # Convert glob pattern to regex
            regex_pattern = pattern.replace('.', '\\.').replace('*', '.*')
            matching_blobs = [b for b in blobs if re.match(regex_pattern, b.name, re.IGNORECASE)]
            
            if matching_blobs:
                latest_blob = max(matching_blobs, key=lambda b: b.last_modified)
                print(f"  Matched blob: {latest_blob.name} (Modified: {latest_blob.last_modified})")
                blob_client = container_client.get_blob_client(latest_blob.name)
                data = blob_client.download_blob().readall()
                print(f"  Downloaded {len(data)} bytes from Azure.")
                return io.BytesIO(data)
            else:
                print(f"  No blobs matching pattern '{pattern}' found in Azure.")
        except Exception as e:
            print(f"Azure fetch failed: {e}. Falling back to local.")

    # Local fallback
    DATA_SOURCE_DIR = os.path.join(ROOT_DIR, 'data_source')
    files = glob.glob(os.path.join(DATA_SOURCE_DIR, pattern))
    if not files:
        files = glob.glob(os.path.join(ROOT_DIR, pattern))
    
    if files:
        path = max(files, key=os.path.getmtime)
        return path
    return default

def get_static_file(filename, fallback_path):
    if _is_azure_configured():
        try:
            blob_service_client = _get_blob_service_client()
            blob_client = blob_service_client.get_blob_client(container=AZURE_CONTAINER, blob=filename)
            if blob_client.exists():
                print(f"Fetching static file from Azure: {filename}")
                data = blob_client.download_blob().readall()
                print(f"  Downloaded {len(data)} bytes.")
                return io.BytesIO(data)
            else:
                print(f"  Blob '{filename}' not found in Azure.")
        except Exception as e:
            print(f"Azure static fetch failed for {filename}: {e}")
    
    print(f"Using local static file: {fallback_path}")
    return fallback_path

def parse_alloc_str(s):
    if s is None or (isinstance(s, float) and math.isnan(s)): return 0
    match = re.search(r'(\d+)', str(s))
    return int(match.group(1)) if match else 0

def parse_office_alloc(s):
    branch_map = {'syd': 0, 'mel': 0, 'bne': 0, 'fre': 0, 'adl': 0, 'pil': 0, 'prj': 0, 'akl': 0, 'oth': 0}
    if s is None or (isinstance(s, float) and math.isnan(s)): return branch_map
    s = str(s).upper()
    patterns = {
        'syd': r'SYD[^\d]*(\d+)', 'mel': r'MEL[^\d]*(\d+)', 'bne': r'BNE[^\d]*(\d+)',
        'fre': r'(?:FRE|PER)[^\d]*(\d+)', 'adl': r'ADL[^\d]*(\d+)', 'pil': r'PIL[^\d]*(\d+)',
        'prj': r'PRJ[^\d]*(\d+)', 'akl': r'AKL[^\d]*(\d+)', 'oth': r'OTH[^\d]*(\d+)',
    }
    for k, pat in patterns.items():
        m = re.search(pat, s)
        if m: branch_map[k] = int(m.group(1))
    return branch_map

# ── Region Normalization ─────────────────────────────────────────────────────
# Maps raw Origin strings from the master data to standard trade-lane region codes.
_NEA_PORTS = ['qingdao', 'cnqin', 'yantian', 'cnyan', 'ningbo', 'cnnbo', 'cnnbg',
              'shanghai', 'cnsha', 'cnsgh', 'changzhou', 'cncgb', 'xiamen', 'cnxmn']
_SEA_PORTS = ['thailand', 'thai', 'vietnam', 'vnhph', 'vndad', 'vnsgn',
              'indonesia', 'idjkt', 'malaysia', 'mypkg', 'mypen', 'philippines', 'phmnl',
              'singapore', 'sgsin', 'cambodia', 'myanmar']
_EUR_PORTS = ['europe', 'hamburg', 'deham', 'rotterdam', 'nlrtm', 'antwerp', 'beanr',
              'felixstowe', 'gbfxt', 'le havre', 'frleh']

def normalize_region(origin_str):
    """Map a master-data Origin value to a standard region code (NEA/SEA/EUR/AU/NZ/Americas)."""
    if origin_str is None:
        return 'Unknown'
    s = str(origin_str).strip()
    if not s or s.lower() == 'nan':
        return 'Unknown'
    # Already a standard region
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
    # Check NEA ports
    for p in _NEA_PORTS:
        if p in s_lower:
            return 'NEA'
    # Check SEA ports
    for p in _SEA_PORTS:
        if p in s_lower:
            return 'SEA'
    # Check EUR
    for p in _EUR_PORTS:
        if p in s_lower:
            return 'EUR'
    # US origins
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
    # Normalize AU variants
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

def process_data():
    # 1. Fetch Orders
    orders_source = get_latest_file('Orders*.xlsx', os.path.join(ROOT_DIR, 'Orders.xlsx'))
    print(f"Reading Orders from: {orders_source if isinstance(orders_source, str) else 'Azure Memory Stream'}")
    df = pd.read_excel(orders_source)
    
    # 2. Load Master Data
    master_source = get_static_file('Contract_Master_All_Data Update.xlsx', os.path.join(ROOT_DIR, 'Contract_Master_All_Data Update.xlsx'))
    print(f"Reading Master Data from: {master_source if isinstance(master_source, str) else 'Azure Memory Stream'}")
    df_master = pd.read_excel(master_source)
    # Build master dict with compound keys: (cid, origin_region, dest_region)
    # This ensures contracts with the same ID but different trade lanes get separate entries.
    master_dict = {}      # keyed by compound_key -> info
    cid_to_keys = {}      # cid -> [compound_key, ...] for booking assignment
    for _, row in df_master.iterrows():
        cid = str(row['Contract #']).strip() if pd.notna(row.get('Contract #')) else ''
        if not cid: continue
        
        office_alloc = parse_office_alloc(row.get('Office Allocation'))
        alloc_total = sum(office_alloc.values())
        
        carrier = str(row.get('Carrier', 'Unknown'))
        priority = str(row.get('Priority', 'Normal'))
        raw_origin = str(row.get('Origin', '')).strip() if pd.notna(row.get('Origin')) else ''
        raw_dest = str(row.get('Destination', '')).strip() if pd.notna(row.get('Destination')) else ''
        origin_region = normalize_region(raw_origin)
        dest_region = normalize_dest(raw_dest)
        lane = f"{origin_region} to {dest_region}"
        contract_type = str(row.get('Contract Type', '')).strip() if pd.notna(row.get('Contract Type')) else ''
        contract_name = str(row.get('Contract Name', '')).strip() if pd.notna(row.get('Contract Name')) else ''
        expiry = str(row.get('Expiry Date', '')).strip() if pd.notna(row.get('Expiry Date')) else 'N/A'
        if hasattr(row.get('Expiry Date'), 'strftime'):
            expiry = row['Expiry Date'].strftime('%Y-%m-%d')

        compound_key = f"{cid}__{origin_region}_{dest_region}"

        if compound_key not in master_dict:
            master_dict[compound_key] = {
                'cid': cid,
                'carrier': carrier,
                'allocTotal': alloc_total,
                'officeAlloc': office_alloc,
                'priority': priority,
                'lane': lane,
                'originRegion': origin_region,
                'destRegion': dest_region,
                'rawOrigins': [raw_origin],
                'rawDests': [raw_dest],
                'polBreakdown': [],  # Ports of Loading detail
                'contractType': contract_type,
                'contractName': contract_name,
                'expiry': expiry,
            }
        else:
            master_dict[compound_key]['allocTotal'] += alloc_total
            master_dict[compound_key]['rawOrigins'].append(raw_origin)
            master_dict[compound_key]['rawDests'].append(raw_dest)
            for hub, val in office_alloc.items():
                master_dict[compound_key]['officeAlloc'][hub] = master_dict[compound_key]['officeAlloc'].get(hub, 0) + val

        # Track which compound keys belong to each contract ID
        if cid not in cid_to_keys:
            cid_to_keys[cid] = []
        if compound_key not in cid_to_keys[cid]:
            cid_to_keys[cid].append(compound_key)

        # Build POL breakdown from specific port origins
        if raw_origin and raw_origin not in ('NEA', 'SEA', 'EUR', 'AU', 'NZ', 'NORTH EUR') and alloc_total > 0:
            master_dict[compound_key]['polBreakdown'].append({
                'port': raw_origin,
                'dest': raw_dest,
                'teuPerWeek': alloc_total,
            })
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
    
    # Aggregates
    origins = sorted(df['loadPort'].dropna().unique().tolist())
    destinations = sorted(df['dischargePort'].dropna().unique().tolist())
    contracts = sorted(df['contract'].dropna().unique().tolist())
    
    unique_weeks_df = df[['year', 'week_num', 'mscWeek']].drop_duplicates().sort_values(['year', 'week_num'])
    weeks = [f"WK {row['mscWeek']}" for _, row in unique_weeks_df.iterrows()]
    active_week_count = max(len(weeks), 1)

    # PORT_HIERARCHY generation — load EARLY so port_lookup is available for
    # contract-leg booking assignment in CONTRACT_UTIL_DATA below.
    port_lookup = {}
    port_hierarchy = []
    
    port_file_name = 'World_Container_Ports.xlsx'
    df_ports = None
    port_listing_source = get_static_file(port_file_name, os.path.join(ROOT_DIR, port_file_name))
    
    if port_listing_source:
        try:
            print(f"Reading Port Codes from: {port_listing_source if isinstance(port_listing_source, str) else 'Azure Memory Stream'}")
            df_ports = pd.read_excel(port_listing_source)
            df_ports.columns = df_ports.columns.str.strip()
            for _, row in df_ports.iterrows():
                locode = str(row.get('UN/LOCODE', '')).strip().upper()
                if locode and locode != 'NAN':
                    info = {
                        'code': locode,
                        'name': str(row.get('Port', locode)).strip().title(),
                        'country': str(row.get('Country', 'Unknown')).strip().title(),
                        'region': str(row.get('Region', 'Other')).strip().title(),
                        'lane': str(row.get('Tradelane', 'General')).strip().title()
                    }
                    port_lookup[locode] = info
                    port_hierarchy.append(info)
            print(f"  Loaded {len(port_lookup)} port codes from listing.")
        except Exception as e:
            print(f"Warning: Could not process port code listing: {e}")

    COUNTRY_FALLBACK = {
        'AU': ('Australia', 'Oceania'), 'NZ': ('New Zealand', 'Oceania'),
        'BE': ('Belgium', 'Europe'), 'CN': ('China', 'Asia'),
        'GB': ('UK', 'Europe'), 'HK': ('Hong Kong', 'Asia'),
        'ID': ('Indonesia', 'Asia'), 'IN': ('India', 'Asia'),
        'JP': ('Japan', 'Asia'), 'MY': ('Malaysia', 'Asia'),
        'TH': ('Thailand', 'Asia'), 'TW': ('Taiwan', 'Asia'),
        'VN': ('Vietnam', 'Asia'), 'US': ('USA', 'Americas'),
        'DE': ('Germany', 'Europe'), 'NL': ('Netherlands', 'Europe'),
        'ES': ('Spain', 'Europe'), 'IE': ('Ireland', 'Europe'),
        'FJ': ('Fiji', 'Oceania'), 'AR': ('Argentina', 'Americas'),
        'KR': ('South Korea', 'Asia'), 'SG': ('Singapore', 'Asia'),
        'PH': ('Philippines', 'Asia'),
    }
    
    all_ports = set(origins + destinations)
    for p in all_ports:
        p_upper = str(p).strip().upper()
        if p_upper not in port_lookup:
            cc = p_upper[:2]
            cname, rname = COUNTRY_FALLBACK.get(cc, (cc, 'Other'))
            info = {
                "code": p,
                "name": p,
                "country": cname,
                "region": rname,
                "lane": "General"
            }
            port_lookup[p_upper] = info
            port_hierarchy.append(info)

    df['loadPort'] = df['loadPort'].apply(lambda x: port_lookup.get(str(x).strip().upper(), {}).get('name', x) if pd.notna(x) else x)
    df['dischargePort'] = df['dischargePort'].apply(lambda x: port_lookup.get(str(x).strip().upper(), {}).get('name', x) if pd.notna(x) else x)

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
        # Sum branch allocation across all contract legs (using compound keys)
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
    # (port_lookup is keyed by LOCODE, but loadPort has been resolved to names by now)
    _region_map = {
        'North East Asia': 'NEA', 'South East Asia': 'SEA', 'Europe': 'EUR',
        'Oceania': 'AU', 'Americas': 'Americas', 'Asia': 'NEA',
    }
    port_name_to_region = {}
    for code, info in port_lookup.items():
        name_upper = info.get('name', '').strip().upper()
        if name_upper:
            region_raw = info.get('region', '')
            port_name_to_region[name_upper] = _region_map.get(region_raw, region_raw)
        # Also keep code-based lookup
        region_raw = info.get('region', '')
        port_name_to_region[code] = _region_map.get(region_raw, region_raw)

    def get_port_region(port_value):
        """Look up a booking's load port (already resolved to a name) to get its trade lane region."""
        if not port_value or str(port_value) == 'nan':
            return 'Unknown'
        p_upper = str(port_value).strip().upper()
        # Try name-based lookup first (since loadPort is already resolved to names)
        if p_upper in port_name_to_region:
            return port_name_to_region[p_upper]
        # Fallback to normalize_region which handles partial name matching
        return normalize_region(port_value)

    # Iterate over ALL compound keys from master + any booking-only contracts
    all_active_cids = set(df['contract'].dropna().unique().tolist())
    processed_cids = set()  # track which raw CIDs have master entries
    contract_util_data = []

    for compound_key, minfo in sorted(master_dict.items()):
        cid = minfo['cid']
        processed_cids.add(compound_key)
        origin_region = minfo.get('originRegion', 'Unknown')
        dest_region = minfo.get('destRegion', 'Unknown')

        # Get all bookings for this contract ID
        c_all_bookings = df[df['contract'] == cid]

        # If this CID has multiple legs, assign bookings to the correct leg
        # based on the booking's load port region
        keys_for_cid = cid_to_keys.get(cid, [compound_key])
        if len(keys_for_cid) > 1:
            # Filter bookings whose load port region matches this leg's origin region
            mask = c_all_bookings['loadPort'].apply(
                lambda lp: get_port_region(lp) == origin_region
            )
            c_bookings = c_all_bookings[mask]
        else:
            c_bookings = c_all_bookings

        booked = round(c_bookings['teu'].sum(), 1)
        alloc_pw = minfo.get('allocTotal', 0)
        total_alloc = alloc_pw * active_week_count
        util = (booked / total_alloc * 100) if total_alloc > 0 else 0
        
        def gbr(bnorm, *codes):
            bk = c_bookings[c_bookings['branch'].isin(list(codes) + [bnorm, bnorm.upper()])]['teu'].sum()
            al = minfo.get('officeAlloc', {}).get(bnorm, 0) * active_week_count
            return {"alloc": round(al, 1), "booked": round(bk, 1), "util": round(bk/al*100, 1) if al > 0 else 0}

        contract_util_data.append({
            "id": str(cid), "carrier": minfo.get('carrier', 'Various'), "lane": minfo.get('lane', 'Unknown'),
            "contractType": minfo.get('contractType', ''), "contractName": minfo.get('contractName', ''),
            "expiry": minfo.get('expiry', 'N/A'),
            "originRegion": origin_region,
            "destRegion": dest_region,
            "origins": list(set(minfo.get('rawOrigins', []))),
            "destinations": list(set(minfo.get('rawDests', []))),
            "polBreakdown": minfo.get('polBreakdown', []),
            "alloc": round(total_alloc, 1), "booked": booked, "util": round(util, 1),
            "status": 'Overutilised' if util > 100 else ('Healthy' if util > 80 else 'Underperforming'),
            "avail": round(total_alloc - booked, 1),
            "syd": gbr('syd', 'SY1'), "mel": gbr('mel', 'ME1'), "bne": gbr('bne', 'BN1'),
            "fre": gbr('fre', 'FR1'), "adl": gbr('adl', 'AD1'), "pil": gbr('pil', 'PIL'),
            "prj": gbr('prj', 'PRJ'), "akl": gbr('akl', 'AKL'), "oth": gbr('oth', 'OTH')
        })

    # Add booking-only contracts (no master entry)
    for cid in sorted(all_active_cids - processed_cids):
        c_bookings = df[df['contract'] == cid]
        booked = round(c_bookings['teu'].sum(), 1)
        def gbr_orphan(bnorm, *codes):
            bk = c_bookings[c_bookings['branch'].isin(list(codes) + [bnorm, bnorm.upper()])]['teu'].sum()
            return {"alloc": 0, "booked": round(bk, 1), "util": 0}
        contract_util_data.append({
            "id": str(cid), "carrier": 'Various', "lane": 'Unknown',
            "contractType": '', "contractName": '', "expiry": 'N/A',
            "originRegion": 'Unknown', "destRegion": 'Unknown',
            "origins": [], "destinations": [], "polBreakdown": [],
            "alloc": 0, "booked": booked, "util": 0, "status": 'Underperforming', "avail": -booked,
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
            "util": round(booked/total_master_alloc*100, 1) if total_master_alloc > 0 else 0
        })

    # CARRIER_BREAKDOWN
    carrier_map = {}
    for _, row in df.iterrows():
        # Heuristic: Priority to plannedCarrier if available, then carrierName, then default to Various
        c = row.get('plannedCarrier') or row.get('carrierName') or 'Various'
        c = str(c).replace('_AU', '').replace('_AU1', '') # Clean the codes
        if c not in carrier_map: carrier_map[c] = {'teu': 0, 'bookings': 0}
        carrier_map[c]['teu'] += row['teu']
        carrier_map[c]['bookings'] += 1
    total_teu = df['teu'].sum() or 1
    carrier_breakdown = sorted([
        {
            "carrier": k, "bookings": v['bookings'], "teu": round(v['teu'], 1),
            "pct": round(v['teu']/total_teu*100, 1),
            "allocated": round(sum(m.get('allocTotal', 0) for m in master_dict.values() if m.get('carrier', '') == k) * active_week_count, 1)
        } for k, v in carrier_map.items()
    ], key=lambda x: -x['teu'])[:15]

    # QUARTERLY_ALLOC_UTIL
    q_data = {}
    for _, row in df.iterrows():
        q = f"Q{math.ceil(row['week_num'] / 13)} {row['year']}"
        if q not in q_data: q_data[q] = {'booked': 0, 'alloc': 0}
        q_data[q]['booked'] += row['teu']
    for cid, minfo in master_dict.items():
        al = minfo.get('allocTotal', 0)
        for w in weeks:
            wn_str = w.split(' ')[1]
            wn = int(wn_str.split('-')[0])
            year = wn_str.split('-')[1]
            q = f"Q{math.ceil(wn / 13)} {year}"
            if q not in q_data: q_data[q] = {'booked': 0, 'alloc': 0}
            q_data[q]['alloc'] += al
    quarterly_alloc_util = [
        {"quarter": q, "Allocation": round(d['alloc'], 1), "Utilisation": round(d['booked'], 1), "UtilPct": round(d['booked']/d['alloc']*100, 1) if d['alloc'] > 0 else 0}
        for q, d in sorted(q_data.items())
    ]

    # BOOKING_LOG
    booking_log = df.replace({pd.NA: None, float('nan'): None}).to_dict('records')

    # PORT_HIERARCHY already built above (before BRANCH_SNAPSHOT)

    # Construct TS
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

    ts_content = f"""// Auto-generated restored logic
export const ORIGINS = {json.dumps(clean_list(origins), indent=2, cls=CustomEncoder)};
export const DESTINATIONS = {json.dumps(clean_list(destinations), indent=2, cls=CustomEncoder)};
export const LANES = {json.dumps(sorted((df['loadPort'].fillna('N/A').astype(str) + " to " + df['dischargePort'].fillna('N/A').astype(str)).unique().tolist()), indent=2, cls=CustomEncoder)};
export const ALLOCATIONS = ["Regular FAK", "Contractual"];
export const PRIORITIES = ["High", "Medium", "Low"];
export const CONTRACTS = {json.dumps(clean_list(list(processed_cids) + list(all_active_cids - processed_cids)), indent=2, cls=CustomEncoder)};
export const WEEKS = {json.dumps(weeks, indent=2, cls=CustomEncoder)};
export const REGIONS = {json.dumps(sorted(list(set([h['region'] for h in port_hierarchy]))), indent=2, cls=CustomEncoder)};
export const COUNTRIES = {json.dumps(sorted(list(set([h['country'] for h in port_hierarchy]))), indent=2, cls=CustomEncoder)};
export const PORT_NAMES = {json.dumps(clean_list(origins + destinations), indent=2, cls=CustomEncoder)};
export const PORT_CODES = [];
export const PORT_HIERARCHY = {json.dumps(port_hierarchy, indent=2, cls=CustomEncoder)};
export const ALL_CARRIERS = {json.dumps(sorted(list(set([m.get('carrier', 'Various') for m in master_dict.values()]))), indent=2, cls=CustomEncoder)};

export const BOOKING_LOG_DATA = {json.dumps(booking_log, indent=2, cls=CustomEncoder)};
export const BRANCH_SNAPSHOT = {json.dumps(branch_snapshot, indent=2, cls=CustomEncoder)};
export const CONTRACT_UTIL_DATA = {json.dumps(contract_util_data, indent=2, cls=CustomEncoder)};
export const WEEKLY_TREND_DATA = {json.dumps(weekly_trend_data, indent=2, cls=CustomEncoder)};
export const QUARTERLY_ALLOC_UTIL = {json.dumps(quarterly_alloc_util, indent=2, cls=CustomEncoder)};
export const CARRIER_BREAKDOWN = {json.dumps(carrier_breakdown, indent=2, cls=CustomEncoder)};
"""
    with open(OUTPUT_PATH, 'w') as f: f.write(ts_content)
    print(f"Successfully restored data to {OUTPUT_PATH}")

if __name__ == "__main__":
    process_data()
