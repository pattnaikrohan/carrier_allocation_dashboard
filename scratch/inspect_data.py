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

# Check before dedup
print('Total rows before dedup:', len(df))
df = df.drop_duplicates(subset=['Order Number'], keep='last') if 'Order Number' in df.columns else df
print('Total rows after dedup:', len(df))

# Show week column type and unique values
wk_col = 'Week No'
print(f'\nWeek column type: {df[wk_col].dtype}')
wk_vals = sorted(df[wk_col].dropna().unique().tolist(), key=lambda x: str(x))
print(f'Unique week values ({df[wk_col].nunique()}): {wk_vals}')

# Simulate the mscWeek construction
df['week'] = df[wk_col]
df = df.dropna(subset=['week'])
df['week_num'] = df['week'].astype(str).str.extract(r'(\d+)').astype(int)
df['year'] = pd.to_datetime(df['Est. Departure'], errors='coerce').dt.year.fillna(2026).astype(int)
df['mscWeek'] = df['week_num'].astype(str) + '-' + df['year'].astype(str)

msc_vals = sorted(df['mscWeek'].unique().tolist())
print(f'\nmscWeek unique values ({len(msc_vals)}): {msc_vals}')

# Show what AVAILABLE_WEEKS would look like
weeks_df = df[['year', 'week_num', 'mscWeek']].drop_duplicates().sort_values(['year', 'week_num'])
weeks = [f"WK {row['mscWeek']}" for _, row in weeks_df.iterrows()]
print(f'\nAVAILABLE_WEEKS ({len(weeks)}): {weeks}')

# Check TEU
teu_col = next((c for c in df.columns if c.lower() in ['total teu', 'teu', 'teu count _x001f_', 'teu _x001f_']), None)
print(f'\nTEU column resolved: {teu_col}')
if teu_col:
    print(f'TEU dtype: {df[teu_col].dtype}')
    print(f'TEU sum: {df[teu_col].sum():.1f}')
    print(f'TEU null count: {df[teu_col].isna().sum()}')

# Show per-week TEU breakdown
print('\nPer-week TEU breakdown:')
if teu_col:
    for wk in weeks:
        wk_num = wk.split(' ')[1]
        wk_df = df[df['mscWeek'] == wk_num]
        teu_sum = wk_df[teu_col].sum()
        print(f'  {wk}: {len(wk_df)} bookings, {teu_sum:.1f} TEU')
