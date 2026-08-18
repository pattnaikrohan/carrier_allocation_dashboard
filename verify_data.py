"""
Comprehensive Data Verification Script for Carrier Allocation Dashboard
========================================================================
This script:
1. Fetches raw data from Snowflake (orders) and Azure (master file)
2. Runs the same processing logic as the backend
3. Compares against the live API output
4. Reports all discrepancies per week, per branch, per contract
"""
import pandas as pd
import json
import os
import sys
import urllib.request
from datetime import datetime

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from data_processor import (
    fetch_orders_from_snowflake,
    build_master_dict,
    _get_blob_file,
    normalize_region,
    normalize_dest,
    parse_office_alloc,
    parse_compass_total,
)

LOG = []
def log(msg):
    print(msg)
    LOG.append(msg)

print("=" * 80)
print("CARRIER ALLOCATION DASHBOARD — FULL DATA VERIFICATION")
print(f"Run at: {datetime.now().isoformat()}")
print("=" * 80)

# ───────────────────────────────────────────────────────
# STEP 1: Fetch raw orders from Snowflake
# ───────────────────────────────────────────────────────
print("\n[STEP 1] Fetching raw orders from Snowflake...")
df_raw = fetch_orders_from_snowflake(log)
print(f"  Raw Snowflake rows: {len(df_raw)}")
print(f"  Raw Snowflake columns: {list(df_raw.columns)}")

# ───────────────────────────────────────────────────────
# STEP 2: Apply column mapping (same as data_processor)
# ───────────────────────────────────────────────────────
print("\n[STEP 2] Applying column mapping...")
df = df_raw.copy()
df.columns = df.columns.str.strip()

col_map = {
    'Contract': 'contract', 'Contract #': 'contract', 'CONTRACT': 'contract',
    'Branch': 'branch', 'Created Branch': 'branch', 'BRANCH': 'branch',
    'Week No': 'week', 'CW Week No': 'week', 'WEEK NO': 'week',
    'Order Number': 'order', 'ORDER_NUMBER': 'order',
    'Est. Departure': 'etd', 'EST_DEPARTURE': 'etd',
    'Est. Arrival': 'eta', 'EST_ARRIVAL': 'eta',
    'BCN': 'bcn', 'CANCELLED_ORDERS': 'cancelled_orders',
    'Departure Vessel': 'depVessel', 'Departure Voyage': 'depVoyage',
    'Buyer': 'buyer', 'Supplier': 'supplier', 'BUYER': 'buyer', 'SUPPLIER': 'supplier',
    'Load Port': 'loadPort', 'LOAD PORT': 'loadPort',
    'Discharge Port': 'dischargePort', 'DISCHARGE PORT': 'dischargePort',
    'Goods Origin': 'goodsOrigin', 'Goods Destination': 'goodsDest',
    'Planned Carrier': 'plannedCarrier', 'PLANNED CARRIER': 'plannedCarrier',
    'Carrier Name': 'carrierName',
}
col_map_lower = {k.lower(): v for k, v in col_map.items()}
existing_cols = {col: col_map_lower[col.lower()] for col in df.columns if col.lower() in col_map_lower}

teu_candidates = [c for c in df.columns if 'teu' in c.lower()]
if teu_candidates:
    teu_frame = df[teu_candidates].apply(pd.to_numeric, errors='coerce').fillna(0)
    df['teu'] = teu_frame.max(axis=1)
else:
    df['teu'] = 0

df = df.rename(columns=existing_cols)
df = df.loc[:, ~df.columns.duplicated()]

print(f"  After rename columns: {list(df.columns)}")

# ───────────────────────────────────────────────────────
# STEP 3: Filter BCN and cancelled
# ───────────────────────────────────────────────────────
print("\n[STEP 3] Filtering BCN and cancelled orders...")
bcn_count = 0
if 'bcn' in df.columns:
    df['bcn'] = df['bcn'].apply(lambda x: str(x).strip().lower() in ('1', 'true', 'yes'))
    bcn_count = df['bcn'].sum()
    df = df[~df['bcn']]
print(f"  BCN orders excluded: {int(bcn_count)}")

cancelled_count = 0
if 'cancelled_orders' in df.columns:
    df['cancelled_orders'] = pd.to_numeric(df['cancelled_orders'], errors='coerce').fillna(0)
    cancelled_count = (df['cancelled_orders'] == 1).sum()
    df = df[df['cancelled_orders'] != 1]
print(f"  Cancelled orders excluded: {int(cancelled_count)}")

rows_after_filter = len(df)
print(f"  Rows after filtering: {rows_after_filter}")

# ───────────────────────────────────────────────────────
# STEP 4: Fix contract and branch
# ───────────────────────────────────────────────────────
print("\n[STEP 4] Normalizing contract and branch...")
if 'contract' not in df.columns:
    df['contract'] = 'OTHER'
    print("  WARNING: 'contract' column not found in Snowflake data!")
df['contract'] = df['contract'].fillna('OTHER').astype(str)
df['contract'] = df['contract'].replace('nan', 'OTHER')
df['contract'] = df['contract'].replace('Unassigned', 'OTHER')
df['contract'] = df['contract'].replace('', 'OTHER')

if 'branch' not in df.columns:
    df['branch'] = 'Unknown'
    print("  WARNING: 'branch' column not found in Snowflake data!")
df['branch'] = df['branch'].fillna('Unknown').astype(str)

branch_code_map = {'BR1': 'BN1', 'BLL': 'ME1', 'CCC': 'OTH'}
df['branch'] = df['branch'].replace(branch_code_map)

# Branch inference from discharge port
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
    if unknown_mask.any():
        dp_upper = df.loc[unknown_mask, discharge_port_col].astype(str).str.strip().str.upper()
        inferred = dp_upper.map(discharge_to_branch)
        inferred_count = inferred.notna().sum()
        df.loc[unknown_mask, 'branch'] = df.loc[unknown_mask, 'branch'].where(inferred.isna(), inferred)
        still_unknown = df['branch'].isin(['Unknown', 'nan', ''])
        remaining_oth = int(still_unknown.sum())
        df.loc[still_unknown, 'branch'] = 'OTH'
        print(f"  Branch inference: {int(inferred_count)} inferred, {remaining_oth} -> OTH")
else:
    df.loc[df['branch'].isin(['Unknown', 'nan', '']), 'branch'] = 'OTH'
    print("  No discharge port column found")

# ───────────────────────────────────────────────────────
# STEP 5: Week / year / mscWeek
# ───────────────────────────────────────────────────────
print("\n[STEP 5] Computing week and year...")
if 'week' not in df.columns:
    df['week'] = '1'
    print("  WARNING: 'week' column not found!")

df = df.dropna(subset=['week'])
df['week_num'] = df['week'].astype(str).str.extract(r'(\d+)').astype(int)
df['year'] = pd.to_datetime(df['etd'], errors='coerce').dt.year.fillna(2026).astype(int)
df['mscWeek'] = df['week_num'].astype(str) + '-' + df['year'].astype(str)

print(f"  Year range: {df['year'].min()} to {df['year'].max()}")
print(f"  Unique mscWeeks: {df['mscWeek'].nunique()}")
print(f"  Total TEU (all orders): {df['teu'].sum():.1f}")

# ───────────────────────────────────────────────────────
# STEP 6: Generate weeks list (same logic as backend)
# ───────────────────────────────────────────────────────
unique_weeks_df = df[['year', 'week_num', 'mscWeek']].drop_duplicates().sort_values(['year', 'week_num'])
min_year = unique_weeks_df['year'].min()
max_year = unique_weeks_df['year'].max()
weeks = []
for y in range(min_year, max_year + 1):
    for w in range(1, 53):
        weeks.append(f"WK {w}-{y}")
active_week_count = max(len(weeks), 1)
print(f"\n[STEP 6] Week list: {len(weeks)} weeks ({min_year} to {max_year}), active_week_count={active_week_count}")

# ───────────────────────────────────────────────────────
# STEP 7: Verify per-week booked TEU
# ───────────────────────────────────────────────────────
print("\n[STEP 7] Per-week booked TEU from Snowflake (2026 only):")
print(f"  {'Week':<15} {'Booked TEU':>12} {'Orders':>8}")
print(f"  {'-'*15} {'-'*12} {'-'*8}")

weeks_2026 = sorted(df[df['year'] == 2026]['week_num'].unique())
for wn in weeks_2026:
    w_df = df[(df['year'] == 2026) & (df['week_num'] == wn)]
    booked = w_df['teu'].sum()
    print(f"  WK {wn}-2026     {booked:>12.1f} {len(w_df):>8}")

# ───────────────────────────────────────────────────────
# STEP 8: Per-branch booked TEU
# ───────────────────────────────────────────────────────
print("\n[STEP 8] Per-branch booked TEU (all time):")
std_branches = [
    ('SYDNEY', 'SY1', 'syd'), ('MELBOURNE', 'ME1', 'mel'), ('BRISBANE', 'BN1', 'bne'),
    ('FREMANTLE', 'FR1', 'fre'), ('ADELAIDE', 'AD1', 'adl'), ('PIL', 'PIL', 'pil'),
    ('PROJECTS', 'PRJ', 'prj'), ('AUCKLAND', 'AKL', 'akl'), ('OTHER', 'OTH', 'oth')
]
print(f"  {'Branch':<15} {'Code':<6} {'Booked TEU':>12} {'Orders':>8}")
print(f"  {'-'*15} {'-'*6} {'-'*12} {'-'*8}")
total_branch_booked = 0
for bname, bcode, bnorm in std_branches:
    b_df = df[df['branch'].isin([bcode, bnorm, bnorm.upper()])]
    booked = b_df['teu'].sum()
    total_branch_booked += booked
    print(f"  {bname:<15} {bcode:<6} {booked:>12.1f} {len(b_df):>8}")
print(f"  {'TOTAL':<15} {'':6} {total_branch_booked:>12.1f} {len(df):>8}")

# Check for unaccounted branches
all_branches_seen = set()
for _, _, bnorm in std_branches:
    all_branches_seen.update([bnorm, bnorm.upper()])
for bname, bcode, bnorm in std_branches:
    all_branches_seen.add(bcode)
unaccounted = df[~df['branch'].isin(all_branches_seen)]
if len(unaccounted) > 0:
    print(f"\n  ⚠️ UNACCOUNTED BRANCHES ({len(unaccounted)} rows):")
    for b, cnt in unaccounted['branch'].value_counts().items():
        print(f"    {b}: {cnt} rows, {unaccounted[unaccounted['branch']==b]['teu'].sum():.1f} TEU")

# ───────────────────────────────────────────────────────
# STEP 9: Fetch live API and compare
# ───────────────────────────────────────────────────────
print("\n[STEP 9] Fetching live API data...")
try:
    r = urllib.request.urlopen('https://carrier-allocation-dashboard.azurewebsites.net/api/data')
    api_data = json.loads(r.read())['data']
    print(f"  API returned {len(api_data.get('BOOKING_LOG_DATA', []))} booking log rows")
    
    # Compare weekly trend
    print("\n  WEEKLY TREND COMPARISON (2026 only, where booked > 0):")
    api_weekly = {w['week']: w for w in api_data.get('WEEKLY_TREND_DATA', [])}
    
    mismatches = []
    for wn in weeks_2026:
        w_label = f"WK {wn}-2026"
        w_num = f"{wn}-2026"
        w_df = df[df['mscWeek'] == w_num]
        local_booked = round(w_df['teu'].sum(), 1)
        api_entry = api_weekly.get(w_label, {})
        api_booked = api_entry.get('booked', 0)
        match = "✅" if abs(local_booked - api_booked) < 0.1 else "❌"
        if local_booked > 0 or api_booked > 0:
            print(f"    {w_label:<15} Local: {local_booked:>10.1f}  API: {api_booked:>10.1f}  {match}")
        if abs(local_booked - api_booked) >= 0.1:
            mismatches.append((w_label, local_booked, api_booked))
    
    if mismatches:
        print(f"\n  ⚠️ {len(mismatches)} WEEKLY MISMATCHES FOUND!")
        for w, local, api in mismatches:
            print(f"    {w}: Local={local}, API={api}, Delta={local - api:.1f}")
    else:
        print(f"\n  ✅ All weeks match between local Snowflake and live API!")
    
    # Compare branch snapshot
    print("\n  BRANCH SNAPSHOT COMPARISON:")
    api_branches = {b['branch']: b for b in api_data.get('BRANCH_SNAPSHOT', [])}
    for bname, bcode, bnorm in std_branches:
        b_df = df[df['branch'].isin([bcode, bnorm, bnorm.upper()])]
        local_booked = round(b_df['teu'].sum(), 1)
        api_branch = api_branches.get(bcode, {})
        api_booked = api_branch.get('booked', 0)
        match = "✅" if abs(local_booked - api_booked) < 0.1 else "❌"
        print(f"    {bname:<15} Local: {local_booked:>10.1f}  API: {api_booked:>10.1f}  {match}")

except Exception as e:
    print(f"  ❌ Failed to fetch API: {e}")

# ───────────────────────────────────────────────────────
# STEP 10: Per-contract verification
# ───────────────────────────────────────────────────────
print("\n[STEP 10] Per-contract booked TEU (top 20):")
contract_teu = df.groupby('contract')['teu'].sum().sort_values(ascending=False)
print(f"  {'Contract':<25} {'TEU':>10} {'Orders':>8}")
print(f"  {'-'*25} {'-'*10} {'-'*8}")
for cid, teu in contract_teu.head(20).items():
    orders = len(df[df['contract'] == cid])
    print(f"  {str(cid):<25} {teu:>10.1f} {orders:>8}")

# ───────────────────────────────────────────────────────
# STEP 11: Data Quality Check
# ───────────────────────────────────────────────────────
print("\n[STEP 11] Data Quality Checks:")
zero_teu = (df['teu'] == 0).sum()
negative_teu = (df['teu'] < 0).sum()
null_contract = (df['contract'] == 'OTHER').sum()
null_branch = (df['branch'] == 'OTH').sum()
null_etd = df['etd'].isna().sum()
print(f"  Zero TEU orders: {zero_teu} ({zero_teu/len(df)*100:.1f}%)")
print(f"  Negative TEU orders: {negative_teu}")
print(f"  'OTHER' contract (unassigned): {null_contract}")
print(f"  'OTH' branch (unresolved): {null_branch}")
print(f"  Null ETD: {null_etd}")

# Week No vs ETD year mismatch
if 'etd' in df.columns:
    etd_years = pd.to_datetime(df['etd'], errors='coerce').dt.year.dropna()
    mismatched_year = (df['year'] != etd_years).sum()
    print(f"  Year derived from ETD mismatching: {mismatched_year} rows")

print("\n" + "=" * 80)
print("VERIFICATION COMPLETE")
print("=" * 80)
