"""
Quick test: Compare DEV.RAW.TEST_ORDER vs PROD.RAW.TEST_ORDER
"""
import pandas as pd
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from data_processor import fetch_orders_from_snowflake
import snowflake.connector
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization

def log(msg):
    print(msg)

# Fetch from PROD
print("=" * 80)
print("FETCHING FROM PROD.RAW.TEST_ORDER")
print("=" * 80)

key_content = os.getenv('SF_PRIVATE_KEY_CONTENT')
if key_content:
    key_content = key_content.replace('\\n', '\n')
    key_bytes = key_content.encode('utf-8')
else:
    key_path = os.getenv('SF_PRIVATE_KEY_PATH', 'scratch/snowflake_key.pem')
    if not os.path.exists(key_path):
        repo_root = os.path.dirname(os.path.abspath(__file__))
        alt_path = os.path.join(repo_root, key_path)
        if os.path.exists(alt_path):
            key_path = alt_path
    with open(key_path, "rb") as key:
        key_bytes = key.read()

p_key = serialization.load_pem_private_key(key_bytes, password=None, backend=default_backend())
pkb = p_key.private_bytes(
    encoding=serialization.Encoding.DER,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption()
)

ctx = snowflake.connector.connect(
    user=os.getenv('SF_USER', 'TEST_AI_AUTO'),
    account=os.getenv('SF_ACCOUNT', 'SGLYREN-GG43054'),
    private_key=pkb,
    warehouse=os.getenv('SF_WAREHOUSE', 'DEV_COMPUTE_WH'),
    database='PROD',
    schema='RAW'
)

cs = ctx.cursor()
print("Querying PROD.RAW.TEST_ORDER...")
cs.execute("SELECT * FROM PROD.RAW.TEST_ORDER")
df_prod = cs.fetch_pandas_all()
ctx.close()
print(f"PROD rows: {len(df_prod)}")
print(f"PROD columns: {list(df_prod.columns)}")

# Also fetch DEV for comparison
print("\n" + "=" * 80)
print("FETCHING FROM DEV.RAW.TEST_ORDER")
print("=" * 80)
df_dev = fetch_orders_from_snowflake(log)
print(f"DEV rows: {len(df_dev)}")

# Compare
print("\n" + "=" * 80)
print("COMPARISON: DEV vs PROD")
print("=" * 80)
print(f"  DEV rows:  {len(df_dev)}")
print(f"  PROD rows: {len(df_prod)}")
print(f"  Difference: {len(df_prod) - len(df_dev)}")

# Normalize PROD TEU
teu_cols = [c for c in df_prod.columns if 'teu' in c.lower()]
if teu_cols:
    teu_vals = df_prod[teu_cols].apply(pd.to_numeric, errors='coerce').fillna(0)
    df_prod['Total TEU'] = teu_vals.max(axis=1)
else:
    df_prod['Total TEU'] = 0

# Dedup PROD
if 'ORDER_NUMBER' in df_prod.columns:
    before = len(df_prod)
    df_prod = df_prod.drop_duplicates(subset=['ORDER_NUMBER'], keep='last')
    print(f"  PROD after dedup: {len(df_prod)} (removed {before - len(df_prod)} dupes)")

print(f"\n  PROD Total TEU: {df_prod['Total TEU'].sum():.1f}")
print(f"  DEV Total TEU:  {df_dev['Total TEU'].sum():.1f}")

# Apply same column mapping to PROD
col_map = {
    'Contract': 'contract', 'Contract #': 'contract', 'CONTRACT': 'contract',
    'Branch': 'branch', 'Created Branch': 'branch', 'BRANCH': 'branch',
    'Week No': 'week', 'CW Week No': 'week', 'WEEK NO': 'week',
    'ORDER_NUMBER': 'order', 'EST_DEPARTURE': 'etd',
    'CANCELLED_ORDERS': 'cancelled_orders',
    'Load Port': 'loadPort', 'Discharge Port': 'dischargePort',
    'Planned Carrier': 'plannedCarrier',
}
df_prod.columns = df_prod.columns.str.strip()
col_map_lower = {k.lower(): v for k, v in col_map.items()}
existing_cols = {col: col_map_lower[col.lower()] for col in df_prod.columns if col.lower() in col_map_lower}

teu_candidates = [c for c in df_prod.columns if 'teu' in c.lower()]
if teu_candidates:
    teu_frame = df_prod[teu_candidates].apply(pd.to_numeric, errors='coerce').fillna(0)
    df_prod['teu'] = teu_frame.max(axis=1)
else:
    df_prod['teu'] = 0

df_prod = df_prod.rename(columns=existing_cols)
df_prod = df_prod.loc[:, ~df_prod.columns.duplicated()]

# Filter cancelled
if 'cancelled_orders' in df_prod.columns:
    df_prod['cancelled_orders'] = pd.to_numeric(df_prod['cancelled_orders'], errors='coerce').fillna(0)
    cancelled = (df_prod['cancelled_orders'] == 1).sum()
    df_prod = df_prod[df_prod['cancelled_orders'] != 1]
    print(f"\n  PROD cancelled orders excluded: {int(cancelled)}")
    print(f"  PROD rows after filter: {len(df_prod)}")

# Contract
if 'contract' not in df_prod.columns:
    df_prod['contract'] = 'OTHER'
    print("  WARNING: 'contract' column NOT found in PROD!")
else:
    df_prod['contract'] = df_prod['contract'].fillna('OTHER').astype(str)
    df_prod['contract'] = df_prod['contract'].replace({'nan': 'OTHER', 'Unassigned': 'OTHER', '': 'OTHER'})

# Branch
if 'branch' not in df_prod.columns:
    df_prod['branch'] = 'Unknown'
    print("  WARNING: 'branch' column NOT found in PROD!")
else:
    df_prod['branch'] = df_prod['branch'].fillna('Unknown').astype(str)

branch_code_map = {'BR1': 'BN1', 'BLL': 'ME1', 'CCC': 'OTH'}
df_prod['branch'] = df_prod['branch'].replace(branch_code_map)

# Branch inference
discharge_port_col = None
for col in df_prod.columns:
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
    unknown_mask = df_prod['branch'].isin(['Unknown', 'nan', ''])
    if unknown_mask.any():
        dp_upper = df_prod.loc[unknown_mask, discharge_port_col].astype(str).str.strip().str.upper()
        inferred = dp_upper.map(discharge_to_branch)
        inferred_count = inferred.notna().sum()
        df_prod.loc[unknown_mask, 'branch'] = df_prod.loc[unknown_mask, 'branch'].where(inferred.isna(), inferred)
        still_unknown = df_prod['branch'].isin(['Unknown', 'nan', ''])
        remaining_oth = int(still_unknown.sum())
        df_prod.loc[still_unknown, 'branch'] = 'OTH'
        print(f"  PROD branch inference: {int(inferred_count)} inferred, {remaining_oth} -> OTH")

# Week and year
if 'week' not in df_prod.columns:
    df_prod['week'] = '1'
    print("  WARNING: 'week' column NOT found in PROD!")

df_prod = df_prod.dropna(subset=['week'])
df_prod['week_num'] = df_prod['week'].astype(str).str.extract(r'(\d+)').astype(int)
df_prod['year'] = pd.to_datetime(df_prod['etd'], errors='coerce').dt.year.fillna(2026).astype(int)
df_prod['mscWeek'] = df_prod['week_num'].astype(str) + '-' + df_prod['year'].astype(str)

print(f"\n  PROD year range: {df_prod['year'].min()} to {df_prod['year'].max()}")
print(f"  PROD unique weeks: {df_prod['mscWeek'].nunique()}")
print(f"  PROD total TEU after filters: {df_prod['teu'].sum():.1f}")

# Per-week comparison for 2026
print("\n" + "=" * 80)
print("PROD vs DEV: Weekly TEU comparison (2026)")
print("=" * 80)
print(f"  {'Week':<15} {'PROD TEU':>12} {'DEV TEU':>12} {'Delta':>10} {'Match':>6}")
print(f"  {'-'*15} {'-'*12} {'-'*12} {'-'*10} {'-'*6}")

weeks_prod = sorted(df_prod[df_prod['year'] == 2026]['week_num'].unique())
weeks_dev_data = df_dev.copy()
# Process DEV the same way for fair comparison
weeks_dev_data.columns = weeks_dev_data.columns.str.strip()
existing_cols_dev = {col: col_map_lower[col.lower()] for col in weeks_dev_data.columns if col.lower() in col_map_lower}
weeks_dev_data = weeks_dev_data.rename(columns=existing_cols_dev)
weeks_dev_data = weeks_dev_data.loc[:, ~weeks_dev_data.columns.duplicated()]
if 'cancelled_orders' in weeks_dev_data.columns:
    weeks_dev_data['cancelled_orders'] = pd.to_numeric(weeks_dev_data['cancelled_orders'], errors='coerce').fillna(0)
    weeks_dev_data = weeks_dev_data[weeks_dev_data['cancelled_orders'] != 1]
if 'week' in weeks_dev_data.columns:
    weeks_dev_data = weeks_dev_data.dropna(subset=['week'])
    weeks_dev_data['week_num'] = weeks_dev_data['week'].astype(str).str.extract(r'(\d+)').astype(int)
    weeks_dev_data['year'] = pd.to_datetime(weeks_dev_data['etd'], errors='coerce').dt.year.fillna(2026).astype(int)
    weeks_dev_data['mscWeek'] = weeks_dev_data['week_num'].astype(str) + '-' + weeks_dev_data['year'].astype(str)
    teu_cands = [c for c in weeks_dev_data.columns if 'teu' in c.lower()]
    if teu_cands:
        weeks_dev_data['teu'] = weeks_dev_data[teu_cands].apply(pd.to_numeric, errors='coerce').fillna(0).max(axis=1)

all_weeks = sorted(set(weeks_prod) | set(weeks_dev_data[weeks_dev_data['year'] == 2026]['week_num'].unique()))
total_delta = 0
mismatch_count = 0
for wn in all_weeks:
    prod_teu = df_prod[(df_prod['year'] == 2026) & (df_prod['week_num'] == wn)]['teu'].sum()
    dev_teu = weeks_dev_data[(weeks_dev_data['year'] == 2026) & (weeks_dev_data['week_num'] == wn)]['teu'].sum()
    delta = prod_teu - dev_teu
    total_delta += abs(delta)
    match = "PASS" if abs(delta) < 0.1 else "FAIL"
    if abs(delta) >= 0.1:
        mismatch_count += 1
    if prod_teu > 0 or dev_teu > 0:
        print(f"  WK {wn}-2026     {prod_teu:>12.1f} {dev_teu:>12.1f} {delta:>+10.1f} {match:>6}")

print(f"\n  Total mismatches: {mismatch_count}")
print(f"  Total delta: {total_delta:.1f} TEU")

# Per-branch comparison
print("\n" + "=" * 80)
print("PROD vs DEV: Branch TEU comparison")
print("=" * 80)
std_branches = [
    ('SYDNEY', 'SY1', 'syd'), ('MELBOURNE', 'ME1', 'mel'), ('BRISBANE', 'BN1', 'bne'),
    ('FREMANTLE', 'FR1', 'fre'), ('ADELAIDE', 'AD1', 'adl'), ('PIL', 'PIL', 'pil'),
    ('PROJECTS', 'PRJ', 'prj'), ('AUCKLAND', 'AKL', 'akl'), ('OTHER', 'OTH', 'oth')
]
print(f"  {'Branch':<15} {'PROD TEU':>12} {'DEV TEU':>12} {'Delta':>10} {'Match':>6}")
print(f"  {'-'*15} {'-'*12} {'-'*12} {'-'*10} {'-'*6}")

# Process DEV branches same way
dev_processed = weeks_dev_data.copy()
if 'branch' not in dev_processed.columns:
    dev_processed['branch'] = 'OTH'
dev_processed['branch'] = dev_processed['branch'].fillna('Unknown').astype(str).replace(branch_code_map)
dev_processed.loc[dev_processed['branch'].isin(['Unknown', 'nan', '']), 'branch'] = 'OTH'

for bname, bcode, bnorm in std_branches:
    prod_b = df_prod[df_prod['branch'].isin([bcode, bnorm, bnorm.upper()])]['teu'].sum()
    dev_b = dev_processed[dev_processed['branch'].isin([bcode, bnorm, bnorm.upper()])]['teu'].sum()
    delta = prod_b - dev_b
    match = "PASS" if abs(delta) < 0.1 else "FAIL"
    print(f"  {bname:<15} {prod_b:>12.1f} {dev_b:>12.1f} {delta:>+10.1f} {match:>6}")

# Per-contract top 20
print("\n" + "=" * 80)
print("PROD: Top 20 contracts by booked TEU")
print("=" * 80)
contract_teu = df_prod.groupby('contract')['teu'].agg(['sum', 'count']).sort_values('sum', ascending=False)
print(f"  {'Contract':<25} {'TEU':>10} {'Orders':>8}")
print(f"  {'-'*25} {'-'*10} {'-'*8}")
for cid, row in contract_teu.head(20).iterrows():
    print(f"  {str(cid):<25} {row['sum']:>10.1f} {int(row['count']):>8}")

print("\n" + "=" * 80)
print("VERIFICATION COMPLETE")
print("=" * 80)
