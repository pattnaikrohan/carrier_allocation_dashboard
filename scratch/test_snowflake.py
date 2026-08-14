import snowflake.connector
import os
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.asymmetric import dsa
from cryptography.hazmat.primitives import serialization

try:
    with open("d:/Dashboards/scratch/snowflake_key.pem", "rb") as key:
        p_key= serialization.load_pem_private_key(
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
    cs.execute('SELECT ORDER_NUMBER, CONTRACT, "Total TEU", "Load Port", "Discharge Port" FROM DEV.RAW.TEST_ORDER WHERE CONTRACT IS NOT NULL AND CONTRACT != \'\' AND "Total TEU" > 0 LIMIT 5')
    df = cs.fetch_pandas_all()
    print("CONNECTION SUCCESS!")
    print(df.columns.tolist())
    print(df)
    ctx.close()
except Exception as e:
    print(f"FAILED TO CONNECT: {e}")
print(df.columns.tolist())