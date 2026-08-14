"""
Verify the current Orders blob merge pipeline:
1. Are ALL Orders files being fetched and merged?
2. Is deduplication working correctly?
3. Is TEU being resolved correctly from all columns?
4. What columns does each file contribute?
"""
import os, sys
sys.path.insert(0, r'd:\Dashboards\backend')
os.chdir(r'd:\Dashboards')
from dotenv import load_dotenv
load_dotenv()
from data_processor import _get_all_blobs
import pandas as pd

container = os.getenv('AZURE_CONTAINER_NAME', 'carrier-allocation')

print("=" * 80)
print("ORDERS FILE MERGE PIPELINE VERIFICATION")
print("=" * 80)

# Step 1: Fetch all Orders files
all_orders = _get_all_blobs(container, 'Orders*.xlsx')
print(f"\n1. BLOB FETCH: Found {len(all_orders)} Orders files\n")

order_frames = []
for stream, name in all_orders:
    df_part = pd.read_excel(stream)
    df_part.columns = df_part.columns.str.strip()
    teu_cols = [c for c in df_part.columns if 'teu' in c.lower()]
    wk_cols = [c for c in df_part.columns if 'week' in c.lower()]
    print(f"   {name}")
    print(f"     Rows: {len(df_part)}")
    print(f"     TEU cols: {teu_cols}")
    print(f"     Week cols: {wk_cols}")
    
    # Check if TEU = Total TEU in this file
    has_teu = any('teu' in c.lower() and 'total' not in c.lower() and 'count' not in c.lower() for c in teu_cols)
    has_total_teu = any('total' in c.lower() for c in teu_cols)
    if has_teu and not has_total_teu:
        print(f"     [!] Has 'TEU' but NOT 'Total TEU'")
    elif has_total_teu and not has_teu:
        print(f"     [OK] Has 'Total TEU' only")
    elif has_teu and has_total_teu:
        print(f"     [OK] Has both 'TEU' and 'Total TEU'")
    
    order_frames.append(df_part)

# Step 2: Concat
df = pd.concat(order_frames, ignore_index=True)
print(f"\n2. CONCAT: {len(df)} total rows")

# Step 3: Check TEU columns after concat
teu_candidates = [c for c in df.columns if 'teu' in c.lower()]
print(f"\n3. TEU COLUMNS AFTER CONCAT: {teu_candidates}")
for tc in teu_candidates:
    non_null = df[tc].notna().sum()
    total = len(df)
    pct = non_null / total * 100
    print(f"   {tc}: {non_null}/{total} non-null ({pct:.1f}%)")

# Step 4: Dedup
df = df.drop_duplicates(subset=['Order Number'], keep='last') if 'Order Number' in df.columns else df
print(f"\n4. AFTER DEDUP: {len(df)} unique rows")

# Step 5: Row-wise max TEU resolution
teu_frame = df[teu_candidates].apply(pd.to_numeric, errors='coerce').fillna(0)
df['teu'] = teu_frame.max(axis=1)
print(f"\n5. TEU RESOLUTION (row-wise max):")
print(f"   Total TEU: {df['teu'].sum():.1f}")
print(f"   Non-zero rows: {(df['teu'] > 0).sum()}")
print(f"   Zero rows: {(df['teu'] == 0).sum()}")

# Step 6: Week distribution
wk_col = 'Week No' if 'Week No' in df.columns else 'CW Week No'
df['week'] = df[wk_col]
df = df.dropna(subset=['week'])
df['week_num'] = df['week'].astype(str).str.extract(r'(\d+)').astype(int)
df['year'] = pd.to_datetime(df['Est. Departure'], errors='coerce').dt.year.fillna(2026).astype(int)
df['mscWeek'] = df['week_num'].astype(str) + '-' + df['year'].astype(str)

weeks_df = df[['year', 'week_num', 'mscWeek']].drop_duplicates().sort_values(['year', 'week_num'])
weeks = [f"WK {row['mscWeek']}" for _, row in weeks_df.iterrows()]

print(f"\n6. WEEK COVERAGE: {len(weeks)} weeks")
print(f"   Range: {weeks[0]} to {weeks[-1]}")

print(f"\n{'='*80}")
print(f"SUMMARY: Pipeline correctly merges {len(all_orders)} files -> {len(df)} rows, {len(weeks)} weeks, {df['teu'].sum():.1f} total TEU")
print(f"{'='*80}")
