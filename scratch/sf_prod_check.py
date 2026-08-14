import sys, os
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend
import snowflake.connector

key_path = r'd:\Dashboards\scratch\snowflake_key.pem'
with open(key_path, 'rb') as f:
    key_bytes = f.read()
p_key = serialization.load_pem_private_key(key_bytes, password=None, backend=default_backend())
pkb = p_key.private_bytes(encoding=serialization.Encoding.DER, format=serialization.PrivateFormat.PKCS8, encryption_algorithm=serialization.NoEncryption())

# Use PROD warehouse and role for PROD tables
conn = snowflake.connector.connect(
    user='TEST_AI_AUTO', account='SGLYREN-GG43054', private_key=pkb,
    warehouse='PROD_COMPUTE_WH', role='PROD_ENGINEER',
    database='PROD', schema='RAW')
cur = conn.cursor()

print("=" * 70)
print("  PROD.RAW.TEST_ORDER — Snowflake Diagnostic")
print("=" * 70)

# Row count
total = cur.execute('SELECT COUNT(*) FROM PROD.RAW.TEST_ORDER').fetchone()[0]
print(f'\nTotal rows: {total:,}')

# Columns
cur.execute('SELECT * FROM PROD.RAW.TEST_ORDER LIMIT 0')
cols = [d[0] for d in cur.description]
print(f'Columns ({len(cols)}): {cols}')

# Non-null rates
print('\nColumn fill rates:')
for col in cols:
    cur.execute(f'SELECT COUNT(*) FROM PROD.RAW.TEST_ORDER WHERE "{col}" IS NOT NULL AND CAST("{col}" AS VARCHAR) != \'\'')
    nn = cur.fetchone()[0]
    pct = nn/total*100 if total else 0
    flag = 'OK' if pct > 70 else 'LOW' if pct > 30 else 'BAD'
    print(f'  {flag:3} {col}: {nn:,}/{total:,} ({pct:.1f}%)')

# Week range
try:
    cur.execute('SELECT MIN("Week No"), MAX("Week No") FROM PROD.RAW.TEST_ORDER WHERE "Week No" IS NOT NULL')
    wmin, wmax = cur.fetchone()
    print(f'\nWeek range: {wmin} to {wmax}')
except Exception as e:
    print(f'\nWeek range check failed: {e}')

# Date range
for dcol in ['EST_DEPARTURE', 'Est. Departure', 'ETD']:
    if dcol in cols:
        try:
            cur.execute(f'SELECT MIN("{dcol}"), MAX("{dcol}") FROM PROD.RAW.TEST_ORDER WHERE "{dcol}" IS NOT NULL')
            dmin, dmax = cur.fetchone()
            print(f'ETD range ({dcol}): {dmin} to {dmax}')
        except:
            pass
        break

# Branch distribution
for bcol in ['Branch', 'BRANCH', 'Created Branch']:
    if bcol in cols:
        cur.execute(f'SELECT "{bcol}", COUNT(*) AS cnt FROM PROD.RAW.TEST_ORDER WHERE "{bcol}" IS NOT NULL AND "{bcol}" != \'\' GROUP BY "{bcol}" ORDER BY cnt DESC LIMIT 15')
        rows = cur.fetchall()
        print(f'\nBranch distribution ({bcol}):')
        for r in rows:
            print(f'  {r[0]}: {r[1]:,}')
        break

# Contract distribution
for ccol in ['CONTRACT', 'Contract', 'Contract #']:
    if ccol in cols:
        cur.execute(f'SELECT COUNT(DISTINCT "{ccol}") FROM PROD.RAW.TEST_ORDER WHERE "{ccol}" IS NOT NULL AND "{ccol}" != \'\'')
        n_contracts = cur.fetchone()[0]
        cur.execute(f'SELECT DISTINCT "{ccol}" FROM PROD.RAW.TEST_ORDER WHERE "{ccol}" IS NOT NULL AND "{ccol}" != \'\' LIMIT 25')
        samples = [r[0] for r in cur.fetchall()]
        print(f'\nUnique contracts: {n_contracts}')
        print(f'Sample contracts: {samples}')
        break

# TEU stats
for tcol in ['Total TEU', 'TEU', 'TOTAL_TEU']:
    if tcol in cols:
        cur.execute(f'SELECT COUNT(*), MIN("{tcol}"), MAX("{tcol}"), AVG("{tcol}"), SUM("{tcol}") FROM PROD.RAW.TEST_ORDER WHERE "{tcol}" IS NOT NULL')
        cnt, mn, mx, avg, sm = cur.fetchone()
        print(f'\nTEU stats ({tcol}): {cnt:,} non-null, min={mn}, max={mx}, avg={avg:.2f}, sum={sm:,.0f}')
        break

# Sample rows
print('\nSample rows (first 3):')
cur.execute('SELECT * FROM PROD.RAW.TEST_ORDER LIMIT 3')
for i, row in enumerate(cur.fetchall()):
    d = dict(zip(cols, row))
    print(f'  Row {i+1}: {d}')

cur.close(); conn.close()
print('\n' + '=' * 70)
print('  Done.')
print('=' * 70)
