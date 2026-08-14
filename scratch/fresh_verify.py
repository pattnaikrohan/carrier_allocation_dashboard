import os, sys
sys.path.insert(0, r'd:\Dashboards\backend')
os.chdir(r'd:\Dashboards')
from dotenv import load_dotenv
load_dotenv()
from data_processor import _get_all_blobs
import pandas as pd

container = os.getenv('AZURE_CONTAINER_NAME', 'carrier-allocation')
all_orders = _get_all_blobs(container, 'Orders*.xlsx')

print("=== FILES FETCHED FROM AZURE ===")
order_frames = []
for stream, name in all_orders:
    df_part = pd.read_excel(stream)
    df_part.columns = df_part.columns.str.strip()
    teu_cols = [c for c in df_part.columns if 'teu' in c.lower()]
    print(f"  {name}: {len(df_part)} rows, TEU cols: {teu_cols}")
    order_frames.append(df_part)

df = pd.concat(order_frames, ignore_index=True)
df.columns = df.columns.str.strip()

print(f"\n=== BEFORE DEDUP: {len(df)} rows ===")
df = df.drop_duplicates(subset=['Order Number'], keep='last') if 'Order Number' in df.columns else df
print(f"=== AFTER DEDUP: {len(df)} rows ===")

# Row-wise max TEU (the fix)
teu_candidates = [c for c in df.columns if 'teu' in c.lower()]
print(f"\nTEU columns found: {teu_candidates}")
teu_frame = df[teu_candidates].apply(pd.to_numeric, errors='coerce').fillna(0)
df['teu'] = teu_frame.max(axis=1)

# Also show what each individual TEU column contributes
for tc in teu_candidates:
    col_sum = pd.to_numeric(df[tc], errors='coerce').fillna(0).sum()
    non_zero = (pd.to_numeric(df[tc], errors='coerce').fillna(0) > 0).sum()
    print(f"  {tc}: sum={col_sum:.1f}, non-zero rows={non_zero}")

print(f"\nFinal teu column: sum={df['teu'].sum():.1f}, non-zero rows={(df['teu'] > 0).sum()}")

# Week processing
wk_col = 'Week No'
df['week'] = df[wk_col]
df = df.dropna(subset=['week'])
df['week_num'] = df['week'].astype(str).str.extract(r'(\d+)').astype(int)
df['year'] = pd.to_datetime(df['Est. Departure'], errors='coerce').dt.year.fillna(2026).astype(int)
df['mscWeek'] = df['week_num'].astype(str) + '-' + df['year'].astype(str)

weeks_df = df[['year', 'week_num', 'mscWeek']].drop_duplicates().sort_values(['year', 'week_num'])
weeks = [f"WK {row['mscWeek']}" for _, row in weeks_df.iterrows()]

grand_total_teu = 0
grand_total_bookings = 0
print("\n=== PER-WEEK BREAKDOWN ===")
print(f"{'Week':<15} {'Bookings':>10} {'TEU':>12}")
print("-" * 40)
for wk in weeks:
    wk_num = wk.split(' ')[1]
    wk_df = df[df['mscWeek'] == wk_num]
    teu_sum = wk_df['teu'].sum()
    grand_total_teu += teu_sum
    grand_total_bookings += len(wk_df)
    print(f"{wk:<15} {len(wk_df):>10} {teu_sum:>12.1f}")

print("-" * 40)
print(f"{'TOTAL':<15} {grand_total_bookings:>10} {grand_total_teu:>12.1f}")
print(f"\n=== WK 26 DETAIL ===")
wk26 = df[df['mscWeek'] == '26-2026']
print(f"Bookings: {len(wk26)}")
print(f"TEU: {wk26['teu'].sum():.1f}")
