import os, sys
sys.path.insert(0, r'd:\Dashboards\backend')
os.chdir(r'd:\Dashboards')
from dotenv import load_dotenv
load_dotenv()
from data_processor import _get_all_blobs
import pandas as pd

container = os.getenv('AZURE_CONTAINER_NAME', 'carrier-allocation')
all_orders = _get_all_blobs(container, 'Orders*.xlsx')
order_frames = []
for stream, name in all_orders:
    order_frames.append(pd.read_excel(stream))
df = pd.concat(order_frames, ignore_index=True)
df.columns = df.columns.str.strip()
df = df.drop_duplicates(subset=['Order Number'], keep='last') if 'Order Number' in df.columns else df

# NEW: row-wise max across TEU columns
teu_candidates = [c for c in df.columns if 'teu' in c.lower()]
print(f'TEU candidate columns: {teu_candidates}')
if teu_candidates:
    teu_frame = df[teu_candidates].apply(pd.to_numeric, errors='coerce').fillna(0)
    df['teu'] = teu_frame.max(axis=1)
else:
    df['teu'] = 0

print(f'TEU sum: {df["teu"].sum():.1f}')
print(f'TEU null count: {df["teu"].isna().sum()}')
print(f'TEU zero count: {(df["teu"] == 0).sum()} out of {len(df)}')

# Week processing
wk_col = 'Week No'
df['week'] = df[wk_col]
df = df.dropna(subset=['week'])
df['week_num'] = df['week'].astype(str).str.extract(r'(\d+)').astype(int)
df['year'] = pd.to_datetime(df['Est. Departure'], errors='coerce').dt.year.fillna(2026).astype(int)
df['mscWeek'] = df['week_num'].astype(str) + '-' + df['year'].astype(str)

weeks_df = df[['year', 'week_num', 'mscWeek']].drop_duplicates().sort_values(['year', 'week_num'])
weeks = [f"WK {row['mscWeek']}" for _, row in weeks_df.iterrows()]

print('\nPer-week TEU breakdown (ROW-WISE MAX FIX):')
for wk in weeks:
    wk_num = wk.split(' ')[1]
    wk_df = df[df['mscWeek'] == wk_num]
    teu_sum = wk_df['teu'].sum()
    print(f'  {wk}: {len(wk_df)} bookings, {teu_sum:.1f} TEU')
