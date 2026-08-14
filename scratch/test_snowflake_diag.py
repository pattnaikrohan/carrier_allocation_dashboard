"""
Quick diagnostic: test Snowflake data for Carrier Allocation Dashboard.
Checks DEV.RAW.TEST_ORDER table — connection, schema, row count, data quality.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend
import snowflake.connector
import pandas as pd

def get_connection():
    key_path = os.path.join(r'd:\Dashboards', 'scratch', 'snowflake_key.pem')
    if not os.path.exists(key_path):
        print(f"  Key file not found at: {key_path}")
        key_content = os.getenv('SF_PRIVATE_KEY_CONTENT')
        if key_content:
            key_content = key_content.replace('\\n', '\n')
            key_bytes = key_content.encode('utf-8')
        else:
            raise FileNotFoundError(f"No key file at {key_path} and SF_PRIVATE_KEY_CONTENT not set")
    else:
        with open(key_path, 'rb') as f:
            key_bytes = f.read()

    p_key = serialization.load_pem_private_key(key_bytes, password=None, backend=default_backend())
    pkb = p_key.private_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption())

    return snowflake.connector.connect(
        user=os.getenv('SF_USER', 'TEST_AI_AUTO'),
        account=os.getenv('SF_ACCOUNT', 'SGLYREN-GG43054'),
        private_key=pkb,
        warehouse=os.getenv('SF_WAREHOUSE', 'DEV_COMPUTE_WH'),
        database=os.getenv('SF_DATABASE', 'DEV'),
        schema=os.getenv('SF_SCHEMA', 'PUBLIC'))

def main():
    print("=" * 70)
    print("  Carrier Allocation Dashboard - Snowflake Data Diagnostic")
    print("=" * 70)

    # 1. Connection
    print("\n[1] Connecting to Snowflake...")
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT CURRENT_ROLE(), CURRENT_WAREHOUSE(), CURRENT_DATABASE(), CURRENT_SCHEMA(), CURRENT_TIMESTAMP()")
        role, wh, db, schema, ts = cur.fetchone()
        print(f"    OK | Role={role}, WH={wh}, DB={db}, Schema={schema}")
    except Exception as e:
        print(f"    FAILED: {e}")
        return

    # 2. Check table existence
    print("\n[2] Checking DEV.RAW.TEST_ORDER table...")
    try:
        cur.execute("SELECT COUNT(*) FROM DEV.RAW.TEST_ORDER")
        count = cur.fetchone()[0]
        print(f"    OK | {count:,} total rows")
    except Exception as e:
        print(f"    FAILED: {e}")
        # Try to discover what tables exist
        print("\n    Searching for available tables...")
        try:
            cur.execute("SHOW TABLES IN DEV.RAW")
            tables = cur.fetchall()
            cols = [d[0] for d in cur.description]
            name_idx = cols.index('name') if 'name' in cols else 1
            print(f"    Tables in DEV.RAW:")
            for t in tables:
                print(f"      - {t[name_idx]}")
        except Exception as e2:
            print(f"    Could not list tables: {e2}")
            try:
                cur.execute("SHOW SCHEMAS IN DEV")
                schemas = cur.fetchall()
                cols = [d[0] for d in cur.description]
                name_idx = cols.index('name') if 'name' in cols else 1
                print(f"    Schemas in DEV:")
                for s in schemas:
                    print(f"      - {s[name_idx]}")
            except:
                pass
        return

    # 3. Column schema
    print("\n[3] Column schema...")
    try:
        cur.execute("SELECT * FROM DEV.RAW.TEST_ORDER LIMIT 1")
        cols = [desc[0] for desc in cur.description]
        print(f"    {len(cols)} columns: {cols}")
    except Exception as e:
        print(f"    FAILED: {e}")

    # 4. Fetch full data via pandas (same path as the dashboard)
    print("\n[4] Fetching full data via pandas...")
    try:
        cur.execute("SELECT * FROM DEV.RAW.TEST_ORDER")
        df = cur.fetch_pandas_all()
        print(f"    OK | {len(df)} rows x {len(df.columns)} columns")
        print(f"    Columns: {list(df.columns)}")
    except Exception as e:
        print(f"    FAILED: {e}")
        return

    # 5. Column mapping check
    print("\n[5] Column mapping check (dashboard expects these)...")
    expected = {
        'Contract': ['CONTRACT', 'CONTRACT #', 'CONTRACT_NUMBER'],
        'Order Number': ['ORDER_NUMBER', 'ORDER NUMBER', 'ORDER_NUM'],
        'Branch': ['BRANCH', 'CREATED BRANCH', 'CREATED_BRANCH'],
        'Week No': ['WEEK_NO', 'WEEK NO', 'CW WEEK NO', 'CW_WEEK_NO'],
        'Est. Departure': ['EST_DEPARTURE', 'EST. DEPARTURE', 'ESTIMATED_DEPARTURE'],
        'Est. Arrival': ['EST_ARRIVAL', 'EST. ARRIVAL', 'ESTIMATED_ARRIVAL'],
        'Load Port': ['LOAD_PORT', 'LOAD PORT'],
        'Discharge Port': ['DISCHARGE_PORT', 'DISCHARGE PORT'],
        'Buyer': ['BUYER'],
        'Supplier': ['SUPPLIER'],
        'Region': ['REGION'],
        'Total TEU': ['TOTAL_TEU', 'TOTAL TEU', 'TEU'],
        'Planned Carrier': ['PLANNED_CARRIER', 'PLANNED CARRIER'],
        'Carrier Name': ['CARRIER_NAME', 'CARRIER NAME'],
    }
    
    cols_upper = [c.upper() for c in df.columns]
    for dashboard_name, candidates in expected.items():
        found = None
        for cand in candidates:
            if cand.upper() in cols_upper:
                found = cand
                break
        status = "OK" if found else "MISSING"
        print(f"    {status:7} {dashboard_name:20} -> {found or 'NOT FOUND in: ' + str(list(df.columns))}")

    # 6. Data quality
    print("\n[6] Data quality checks...")
    print(f"    Total rows: {len(df)}")
    
    # Null checks
    for col in df.columns:
        null_count = df[col].isna().sum()
        empty_count = (df[col].astype(str).str.strip() == '').sum() if df[col].dtype == 'object' else 0
        total_bad = null_count + empty_count
        pct = total_bad / len(df) * 100 if len(df) > 0 else 0
        if pct > 20:
            print(f"    WARN {col}: {total_bad}/{len(df)} null/empty ({pct:.1f}%)")

    # TEU check
    teu_cols = [c for c in df.columns if 'teu' in c.lower()]
    if teu_cols:
        for tc in teu_cols:
            vals = pd.to_numeric(df[tc], errors='coerce')
            print(f"\n    TEU column '{tc}':")
            print(f"      Non-null: {vals.notna().sum()}/{len(df)}")
            print(f"      Min={vals.min()}, Max={vals.max()}, Mean={vals.mean():.2f}, Sum={vals.sum():.1f}")
    else:
        print("    WARN: No TEU column found!")

    # Contract distribution
    contract_col = None
    for c in df.columns:
        if c.upper() in ('CONTRACT', 'CONTRACT #', 'CONTRACT_NUMBER'):
            contract_col = c
            break
    if contract_col:
        contracts = df[contract_col].dropna().unique()
        print(f"\n    Unique contracts: {len(contracts)}")
        print(f"    Sample contracts: {list(contracts[:10])}")

    # Branch distribution
    branch_col = None
    for c in df.columns:
        if c.upper() in ('BRANCH', 'CREATED BRANCH', 'CREATED_BRANCH'):
            branch_col = c
            break
    if branch_col:
        branch_dist = df[branch_col].value_counts().head(10)
        print(f"\n    Branch distribution (top 10):")
        for b, cnt in branch_dist.items():
            print(f"      {b}: {cnt}")

    # Week distribution
    week_col = None
    for c in df.columns:
        if 'week' in c.lower():
            week_col = c
            break
    if week_col:
        weeks = sorted(df[week_col].dropna().unique())
        print(f"\n    Weeks in data ({len(weeks)}): {list(weeks[:10])}{'...' if len(weeks) > 10 else ''}")

    # 7. Sample rows
    print(f"\n[7] Sample rows (first 3):")
    for i, (_, row) in enumerate(df.head(3).iterrows()):
        print(f"    Row {i+1}: {dict(row)}")

    cur.close()
    conn.close()
    print("\n" + "=" * 70)
    print("  Diagnostic complete.")
    print("=" * 70)

if __name__ == "__main__":
    main()
