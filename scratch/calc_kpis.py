"""
Simulate the full data_processor pipeline with branch inference
to calculate the exact KPI card values for the dashboard.
"""
import snowflake.connector
import pandas as pd
import math
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization

# --- Connect to Snowflake ---
with open("d:/Dashboards/scratch/snowflake_key.pem", "rb") as key:
    p_key = serialization.load_pem_private_key(key.read(), password=None, backend=default_backend())

pkb = p_key.private_bytes(
    encoding=serialization.Encoding.DER,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption())

ctx = snowflake.connector.connect(
    user='TEST_AI_AUTO', account='SGLYREN-GG43054', private_key=pkb,
    warehouse='DEV_COMPUTE_WH', database='DEV', schema='PUBLIC')

cs = ctx.cursor()
cs.execute("SELECT * FROM DEV.RAW.TEST_ORDER")
df = cs.fetch_pandas_all()
ctx.close()

print(f"Fetched {len(df)} rows from Snowflake")
print(f"Columns: {df.columns.tolist()}")

# --- TEU normalization ---
teu_cols = [c for c in df.columns if 'teu' in c.lower()]
if teu_cols:
    teu_vals = df[teu_cols].apply(pd.to_numeric, errors='coerce').fillna(0)
    df['Total TEU'] = teu_vals.max(axis=1)
    df = df.drop(columns=[c for c in teu_cols if c != 'Total TEU'])

df = df.drop_duplicates(subset=['ORDER_NUMBER'], keep='last') if 'ORDER_NUMBER' in df.columns else df
print(f"After dedup: {len(df)} rows")

# --- Column mapping ---
df.columns = df.columns.str.strip()
col_map = {
    'Contract': 'contract', 'Contract #': 'contract', 'CONTRACT': 'contract',
    'Branch': 'branch', 'Created Branch': 'branch', 'BRANCH': 'branch',
    'Week No': 'week', 'CW Week No': 'week', 'WEEK NO': 'week',
    'Order Number': 'order', 'ORDER_NUMBER': 'order',
    'Est. Departure': 'etd', 'EST_DEPARTURE': 'etd',
    'Est. Arrival': 'eta', 'EST_ARRIVAL': 'eta',
    'Discharge Port': 'dischargePort', 'DISCHARGE PORT': 'dischargePort',
    'Load Port': 'loadPort', 'LOAD PORT': 'loadPort',
    'CANCELLED_ORDERS': 'cancelled_orders',
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

# --- Filter cancelled orders ---
if 'cancelled_orders' in df.columns:
    df['cancelled_orders'] = pd.to_numeric(df['cancelled_orders'], errors='coerce').fillna(0)
    cancelled_count = (df['cancelled_orders'] == 1).sum()
    df = df[df['cancelled_orders'] != 1]
    print(f"Excluded {int(cancelled_count)} cancelled orders")

# --- Contract fallbacks ---
if 'contract' not in df.columns:
    df['contract'] = 'OTHER'
df['contract'] = df['contract'].fillna('OTHER').astype(str)
df['contract'] = df['contract'].replace({'nan': 'OTHER', 'Unassigned': 'OTHER', '': 'OTHER'})

# --- Branch fallbacks + inference ---
if 'branch' not in df.columns:
    df['branch'] = 'Unknown'
df['branch'] = df['branch'].fillna('Unknown').astype(str)

# Normalize branch codes
branch_code_map = {'BR1': 'BN1', 'BLL': 'ME1', 'CCC': 'OTH'}
df['branch'] = df['branch'].replace(branch_code_map)

# Infer branch from Discharge Port
discharge_port_col = None
for col in df.columns:
    if col.lower().replace(' ', '') in ('dischargeport', 'discharge_port'):
        discharge_port_col = col
        break

if discharge_port_col:
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
        df.loc[still_unknown, 'branch'] = 'OTH'
        print(f"Branch inference: {int(inferred_count)} inferred, {int(still_unknown.sum())} remaining as OTH")

# --- Week processing ---
if 'week' not in df.columns:
    df['week'] = '1'
df = df.dropna(subset=['week'])
df['week_num'] = df['week'].astype(str).str.extract(r'(\d+)').astype(int)
df['year'] = pd.to_datetime(df['etd'], errors='coerce').dt.year.fillna(2026).astype(int)
df['mscWeek'] = df['week_num'].astype(str) + '-' + df['year'].astype(str)

# --- Read Master Data ---
master_file = 'Contract_Master_All_Data Update.xlsx'
import os
repo_root = os.path.dirname(os.path.abspath(__file__))
df_master = pd.read_excel(os.path.join(repo_root, '..', master_file))

def parse_office_alloc(val):
    if pd.isna(val) or not str(val).strip():
        return {}
    result = {}
    for part in str(val).split(','):
        part = part.strip()
        if ':' in part:
            k, v = part.split(':', 1)
            try:
                result[k.strip().lower()] = float(v.strip())
            except ValueError:
                pass
    return result

master_dict = {}
for _, row in df_master.iterrows():
    cid = str(row['Contract #']).strip() if pd.notna(row.get('Contract #')) else ''
    if not cid:
        continue
    office_alloc = parse_office_alloc(row.get('Office Allocation'))
    alloc_total = sum(office_alloc.values())
    master_dict[cid] = master_dict.get(cid, {'officeAlloc': {}, 'allocTotal': 0})
    master_dict[cid]['allocTotal'] += alloc_total
    for hub, val in office_alloc.items():
        master_dict[cid]['officeAlloc'][hub] = master_dict[cid]['officeAlloc'].get(hub, 0) + val

# --- Calculate KPIs ---
weeks = sorted(list(set([f"WK {r['week_num']}-{r['year']}" for _, r in df.iterrows()])))
active_week_count = max(len(weeks), 1)

print(f"\n{'='*60}")
print(f"EXPECTED DASHBOARD KPI CARD VALUES (ALL filter)")
print(f"{'='*60}")

# Total Allocation
total_alloc_pw = sum(sum(m['officeAlloc'].values()) for m in master_dict.values())
total_alloc = round(total_alloc_pw * active_week_count, 1)
print(f"\nTOTAL ALLOCATION: {total_alloc:,.0f}")
print(f"  (Weekly: {total_alloc_pw:.1f} x {active_week_count} weeks)")

# Total Booked
total_booked = round(df['teu'].sum(), 1)
print(f"\nTOTAL BOOKED: {total_booked:,.1f}")

# Overall Util %
overall_util = round((total_booked / total_alloc * 100), 1) if total_alloc > 0 else 0
print(f"\nOVERALL UTIL %: {overall_util}%")

# Active Weeks
print(f"\nACTIVE WEEKS: {active_week_count} (FY 2026)")

# Branch breakdown
print(f"\n{'='*60}")
print(f"BRANCH PERFORMANCE SNAPSHOT")
print(f"{'='*60}")
print(f"{'Branch':<12} {'Alloc':>10} {'Booked':>10} {'Available':>10} {'Util %':>10}")
print(f"{'-'*52}")

std_branches = [
    ('SYDNEY', 'SY1', 'syd'), ('MELBOURNE', 'ME1', 'mel'), ('BRISBANE', 'BN1', 'bne'),
    ('FREMANTLE', 'FR1', 'fre'), ('ADELAIDE', 'AD1', 'adl'), ('PIL', 'PIL', 'pil'),
    ('PROJECTS', 'PRJ', 'prj'), ('AUCKLAND', 'AKL', 'akl'), ('OTHER', 'OTH', 'oth')
]
underperf_count = 0
low_util_count = 0

for bname, bcode, bnorm in std_branches:
    b_df = df[df['branch'].isin([bcode, bnorm, bnorm.upper()])]
    booked = round(b_df['teu'].sum(), 1)
    alloc_pw = sum(m.get('officeAlloc', {}).get(bnorm, 0) for m in master_dict.values())
    total_a = round(alloc_pw * active_week_count, 1)
    util = round((booked / total_a * 100), 1) if total_a > 0 else 0
    avail = round(total_a - booked, 1)
    print(f"{bcode:<12} {total_a:>10,.1f} {booked:>10,.1f} {avail:>10,.1f} {util:>9.1f}%")

# Contract-level stats
print(f"\n{'='*60}")
print(f"CONTRACT STATS")
print(f"{'='*60}")

# Count unique contracts with allocation
contracts_with_alloc = len(master_dict)
print(f"Total contracts with allocation: {contracts_with_alloc}")

# Count underperforming (util <= 80%)
# Count low utilisation (util < 50%)
contract_utils = []
for cid, minfo in master_dict.items():
    alloc = minfo['allocTotal'] * active_week_count
    cid_bookings = df[df['contract'] == cid]['teu'].sum()
    util = (cid_bookings / alloc * 100) if alloc > 0 else 0
    contract_utils.append({'cid': cid, 'alloc': alloc, 'booked': cid_bookings, 'util': util})
    if util <= 80:
        underperf_count += 1
    if util < 50:
        low_util_count += 1

print(f"\nUNDERPERFORMING CONTRACTS (util <= 80%): {underperf_count}")
print(f"LOW UTILISATION CONTRACTS (util < 50%): {low_util_count}")

# Top 5 contracts by utilisation
sorted_contracts = sorted(contract_utils, key=lambda x: x['util'], reverse=True)
print(f"\nTop 5 contracts by utilisation:")
for c in sorted_contracts[:5]:
    print(f"  {c['cid']}: alloc={c['alloc']:.0f}, booked={c['booked']:.0f}, util={c['util']:.1f}%")

print(f"\nBottom 5 contracts by utilisation:")
for c in sorted_contracts[-5:]:
    print(f"  {c['cid']}: alloc={c['alloc']:.0f}, booked={c['booked']:.0f}, util={c['util']:.1f}%")
