import snowflake.connector
import pandas as pd
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization

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

# Check discharge port -> branch correlation for rows WITH branch
cs.execute('''
    SELECT "Discharge Port", "Branch", COUNT(*) as cnt 
    FROM DEV.RAW.TEST_ORDER 
    WHERE "Branch" IS NOT NULL 
    GROUP BY "Discharge Port", "Branch" 
    ORDER BY cnt DESC 
    LIMIT 20
''')
df = cs.fetch_pandas_all()
print("=== DISCHARGE PORT -> BRANCH (for rows WITH branch) ===")
print(df.to_string())

print()

# Check discharge ports for rows WITHOUT branch
cs.execute('''
    SELECT "Discharge Port", COUNT(*) as cnt, SUM("Total TEU") as total_teu 
    FROM DEV.RAW.TEST_ORDER 
    WHERE "Branch" IS NULL 
    GROUP BY "Discharge Port" 
    ORDER BY cnt DESC 
    LIMIT 20
''')
df2 = cs.fetch_pandas_all()
print("=== DISCHARGE PORT (for rows WITHOUT branch) ===")
print(df2.to_string())

ctx.close()
