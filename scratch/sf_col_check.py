import sys, os
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend
import snowflake.connector

key_path = r'd:\Dashboards\scratch\snowflake_key.pem'
with open(key_path, 'rb') as f:
    key_bytes = f.read()
p_key = serialization.load_pem_private_key(key_bytes, password=None, backend=default_backend())
pkb = p_key.private_bytes(encoding=serialization.Encoding.DER, format=serialization.PrivateFormat.PKCS8, encryption_algorithm=serialization.NoEncryption())
conn = snowflake.connector.connect(user='TEST_AI_AUTO', account='SGLYREN-GG43054', private_key=pkb, warehouse='DEV_COMPUTE_WH', database='DEV', schema='PUBLIC')
cur = conn.cursor()

total_r = cur.execute('SELECT COUNT(*) FROM DEV.RAW.TEST_ORDER').fetchone()
total = total_r[0]
print(f'Total rows: {total}')

cur.execute('SELECT * FROM DEV.RAW.TEST_ORDER LIMIT 0')
cols = [d[0] for d in cur.description]
print(f'Columns ({len(cols)}): {cols}')

for col in cols:
    cur.execute(f'SELECT COUNT(*) FROM DEV.RAW.TEST_ORDER WHERE "{col}" IS NOT NULL AND CAST("{col}" AS VARCHAR) != \'\'')
    nn = cur.fetchone()[0]
    pct = nn/total*100 if total else 0
    flag = 'OK' if pct > 70 else 'LOW' if pct > 30 else 'BAD'
    print(f'  {flag:3} {col}: {nn}/{total} ({pct:.1f}%)')

cur.execute('SELECT MIN("Week No"), MAX("Week No") FROM DEV.RAW.TEST_ORDER WHERE "Week No" IS NOT NULL')
wmin, wmax = cur.fetchone()
print(f'\nWeek range: {wmin} to {wmax}')

cur.execute('SELECT MIN("EST_DEPARTURE"), MAX("EST_DEPARTURE") FROM DEV.RAW.TEST_ORDER WHERE "EST_DEPARTURE" IS NOT NULL')
dmin, dmax = cur.fetchone()
print(f'ETD range: {dmin} to {dmax}')

# Check Branch distinct values
cur.execute('SELECT "Branch", COUNT(*) AS cnt FROM DEV.RAW.TEST_ORDER WHERE "Branch" IS NOT NULL AND "Branch" != \'\' GROUP BY "Branch" ORDER BY cnt DESC')
print('\nBranch distribution:')
for row in cur.fetchall():
    print(f'  {row[0]}: {row[1]}')

# Check Contract non-empty samples
cur.execute('SELECT DISTINCT "CONTRACT" FROM DEV.RAW.TEST_ORDER WHERE "CONTRACT" IS NOT NULL AND "CONTRACT" != \'\' LIMIT 20')
contracts = [r[0] for r in cur.fetchall()]
print(f'\nContracts with data ({len(contracts)}): {contracts}')

cur.close(); conn.close()
