"""Quick verify: what should the KPI cards show after fixes."""
import snowflake.connector
import pandas as pd
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization

with open("d:/Dashboards/scratch/snowflake_key.pem", "rb") as key:
    p_key = serialization.load_pem_private_key(key.read(), password=None, backend=default_backend())
pkb = p_key.private_bytes(encoding=serialization.Encoding.DER, format=serialization.PrivateFormat.PKCS8, encryption_algorithm=serialization.NoEncryption())
ctx = snowflake.connector.connect(user='TEST_AI_AUTO', account='SGLYREN-GG43054', private_key=pkb, warehouse='DEV_COMPUTE_WH', database='DEV', schema='PUBLIC')
cs = ctx.cursor()
cs.execute("SELECT * FROM DEV.RAW.TEST_ORDER")
df = cs.fetch_pandas_all()
ctx.close()

# Dedup
df = df.drop_duplicates(subset=['ORDER_NUMBER'], keep='last')

# TEU
teu_cols = [c for c in df.columns if 'teu' in c.lower()]
if teu_cols:
    df['teu'] = df[teu_cols].apply(pd.to_numeric, errors='coerce').fillna(0).max(axis=1)

# Filter cancelled
if 'CANCELLED_ORDERS' in df.columns:
    df['CANCELLED_ORDERS'] = pd.to_numeric(df['CANCELLED_ORDERS'], errors='coerce').fillna(0)
    cancelled = (df['CANCELLED_ORDERS'] == 1).sum()
    df = df[df['CANCELLED_ORDERS'] != 1]
    print(f"Excluded {cancelled} cancelled orders")

total_rows = len(df)
total_teu = df['teu'].sum()
print(f"Total rows after dedup+cancel filter: {total_rows}")
print(f"Total TEU from Snowflake: {total_teu:.0f}")

# Check branch distribution 
branch_col = 'Branch' if 'Branch' in df.columns else None
if branch_col:
    branch_counts = df.groupby(branch_col)['teu'].sum().sort_values(ascending=False)
    print(f"\nBranch TEU from Snowflake (raw):")
    for b, t in branch_counts.items():
        print(f"  {b}: {t:.0f}")
    null_teu = df[df[branch_col].isna()]['teu'].sum()
    print(f"  NULL branch: {null_teu:.0f}")

# Contract matching 
contract_col = 'CONTRACT' if 'CONTRACT' in df.columns else None
if contract_col:
    df['contract'] = df[contract_col].fillna('').astype(str).replace({'': 'OTHER', 'nan': 'OTHER'})
    print(f"\nTop 10 contracts by TEU:")
    top = df.groupby('contract')['teu'].sum().sort_values(ascending=False).head(10)
    for c, t in top.items():
        print(f"  {c}: {t:.0f}")

    # Count how many TEU match master contracts
    master = pd.read_excel('Contract_Master_All_Data Update.xlsx')
    master_ids = set(master['Contract #'].dropna().astype(str).str.strip().unique())
    matched = df[df['contract'].isin(master_ids)]['teu'].sum()
    unmatched = total_teu - matched
    print(f"\nTEU matching master contracts: {matched:.0f}")
    print(f"TEU NOT matching any master contract: {unmatched:.0f}")
    print(f"\n=== EXPECTED KPI CARDS ===")
    print(f"TOTAL BOOKED should be: {total_teu:.0f} (ALL bookings from Snowflake)")
