import snowflake.connector
import pandas as pd
import os
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization

with open("d:/Dashboards/scratch/snowflake_key.pem", "rb") as key:
    p_key = serialization.load_pem_private_key(key.read(), password=None, backend=default_backend())

pkb = p_key.private_bytes(
    encoding=serialization.Encoding.DER,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption())

ctx = snowflake.connector.connect(
    user='TEST_AI_AUTO',
    account='SGLYREN-GG43054',
    private_key=pkb,
    warehouse='DEV_COMPUTE_WH',
    database='DEV',
    schema='PUBLIC'
)

cs = ctx.cursor()
cs.execute("SELECT * FROM DEV.RAW.TEST_ORDER LIMIT 5")
df = cs.fetch_pandas_all()
ctx.close()

print("=== RAW COLUMNS ===")
print(df.columns.tolist())
print()

# Simulate the data_processor.py column normalization
teu_cols = [c for c in df.columns if 'teu' in c.lower()]
if teu_cols:
    teu_vals = df[teu_cols].apply(pd.to_numeric, errors='coerce').fillna(0)
    df['Total TEU'] = teu_vals.max(axis=1)
    dropped = [c for c in teu_cols if c != 'Total TEU']
    print(f"TEU cols found: {teu_cols}")
    print(f"Columns that will be DROPPED: {dropped}")
    df = df.drop(columns=dropped)

print()
print("=== COLUMNS AFTER TEU NORMALIZATION ===")
print(df.columns.tolist())
print()

# Now simulate the dedup
df = df.drop_duplicates(subset=['ORDER_NUMBER'], keep='last') if 'ORDER_NUMBER' in df.columns else df

print("=== COLUMNS AFTER DEDUP ===")
print(df.columns.tolist())
print()

# Strip and map
df.columns = df.columns.str.strip()
col_map = {
    'Contract': 'contract', 'Contract #': 'contract', 'CONTRACT': 'contract',
    'Branch': 'branch', 'Created Branch': 'branch', 'BRANCH': 'branch',
    'Week No': 'week', 'CW Week No': 'week', 'WEEK NO': 'week',
    'Order Number': 'order', 'ORDER_NUMBER': 'order', 'Est. Departure': 'etd', 'EST_DEPARTURE': 'etd',
}
col_map_lower = {k.lower(): v for k, v in col_map.items()}
existing_cols = {col: col_map_lower[col.lower()] for col in df.columns if col.lower() in col_map_lower}

print("=== COLUMN MAPPING APPLIED ===")
print(existing_cols)
print()

df = df.rename(columns=existing_cols)
df = df.loc[:, ~df.columns.duplicated()]

print("=== FINAL COLUMNS ===")
print(df.columns.tolist())
print()

if 'branch' in df.columns:
    print("=== BRANCH VALUES (first 5) ===")
    print(df['branch'].tolist())
else:
    print("!!! BRANCH COLUMN IS MISSING !!!")
