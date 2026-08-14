import os
import snowflake.connector
import pandas as pd
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization

def get_snowflake_data():
    print("Connecting to Snowflake...")
    key_path = os.getenv('SF_PRIVATE_KEY_PATH', 'scratch/snowflake_key.pem')
    if not os.path.exists(key_path):
        key_path = 'd:/Dashboards/scratch/snowflake_key.pem'
        
    with open(key_path, "rb") as key:
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
        user=os.getenv('SF_USER', 'TEST_AI_AUTO'),
        account=os.getenv('SF_ACCOUNT', 'SGLYREN-GG43054'),
        private_key=pkb,
        warehouse=os.getenv('SF_WAREHOUSE', 'COMPASS_WH'),
        database=os.getenv('SF_DATABASE', 'DEV'),
        schema=os.getenv('SF_SCHEMA', 'RAW')
    )

    cs = ctx.cursor()
    print("Querying Snowflake DEV.RAW.TEST_ORDER...")
    cs.execute("SELECT * FROM DEV.RAW.TEST_ORDER")
    df = cs.fetch_pandas_all()
    ctx.close()
    print(f"Fetched {len(df)} total rows from Snowflake.")
    return df

if __name__ == '__main__':
    df = get_snowflake_data()
    print("Columns:", df.columns.tolist())
    
    # Find week column
    week_cols = [c for c in df.columns if 'week' in c.lower()]
    print("Week columns found:", week_cols)
    
    if week_cols:
        w_col = week_cols[0]
        # Check unique values
        print(f"Sample values in {w_col}:", df[w_col].unique()[:20])
        
        # Extract numeric week number
        df['week_num_clean'] = df[w_col].astype(str).str.extract(r'(\d+)').fillna(0).astype(int)
        
        df_week28 = df[df['week_num_clean'] == 28].copy()
        df_week28 = df_week28.drop(columns=['week_num_clean'])
        print(f"Found {len(df_week28)} rows for Week 28!")
        
        out_path = 'D:/Dashboards/Snowflake_Week_28_Data.xlsx'
        df_week28.to_excel(out_path, index=False)
        print(f"Successfully saved to {out_path}")
    else:
        print("No week column found! Saving all data...")
        out_path = 'D:/Dashboards/Snowflake_All_Data.xlsx'
        df.to_excel(out_path, index=False)
        print(f"Saved all to {out_path}")
