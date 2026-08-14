import snowflake.connector
import os
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization

try:
    with open("d:/Dashboards/scratch/snowflake_key.pem", "rb") as key:
        p_key = serialization.load_pem_private_key(
            key.read(),
            password=None,
            backend=default_backend()
        )

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
    
    # 1. Get ALL column names
    cs.execute('SELECT * FROM DEV.RAW.TEST_ORDER LIMIT 1')
    df = cs.fetch_pandas_all()
    print("=== ALL COLUMNS ===")
    print(df.columns.tolist())
    
    # 2. Get unique Branch values
    cs.execute('SELECT DISTINCT "Branch" FROM DEV.RAW.TEST_ORDER WHERE "Branch" IS NOT NULL LIMIT 50')
    df2 = cs.fetch_pandas_all()
    print("\n=== UNIQUE BRANCH VALUES ===")
    print(df2.values.tolist())
    
    # 3. Count per branch
    cs.execute('SELECT "Branch", COUNT(*) as cnt, SUM("Total TEU") as total_teu FROM DEV.RAW.TEST_ORDER GROUP BY "Branch" ORDER BY cnt DESC')
    df3 = cs.fetch_pandas_all()
    print("\n=== BRANCH COUNTS ===")
    print(df3.to_string())
    
    # 4. Get a sample row
    cs.execute('SELECT * FROM DEV.RAW.TEST_ORDER WHERE "Branch" IS NOT NULL LIMIT 3')
    df4 = cs.fetch_pandas_all()
    print("\n=== SAMPLE ROWS ===")
    print(df4.to_string())
    
    ctx.close()
except Exception as e:
    print(f"FAILED: {e}")
    import traceback
    traceback.print_exc()
