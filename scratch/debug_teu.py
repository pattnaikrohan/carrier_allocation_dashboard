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
    df_part = pd.read_excel(stream)
    df_part['__source_file__'] = name
    order_frames.append(df_part)
df = pd.concat(order_frames, ignore_index=True)
df.columns = df.columns.str.strip()

# Show WK4 rows before dedup (should have rows from April file)
wk4 = df[df['Week No'].astype(str).str.contains('^4', na=False)]
print(f'WK4 rows before dedup: {len(wk4)}')
print('Sources:', wk4['__source_file__'].value_counts().to_dict())

# Check TEU columns for WK4 from April
april_wk4 = wk4[wk4['__source_file__'] == 'Orders 10 APril.xlsx'].head(3)
teu_cols = [c for c in df.columns if 'teu' in c.lower()]
print(f'\nTEU columns: {teu_cols}')
for c in teu_cols:
    print(f'  April WK4 {c}: {april_wk4[c].tolist()[:3]}')

# Now dedup
df = df.drop_duplicates(subset=['Order Number'], keep='last') if 'Order Number' in df.columns else df

wk4_after = df[df['Week No'].astype(str).str.contains('^4', na=False)]
print(f'\nWK4 rows after dedup: {len(wk4_after)}')
print('Sources:', wk4_after['__source_file__'].value_counts().to_dict())

for c in teu_cols:
    print(f'  After dedup WK4 {c}: non-null={wk4_after[c].notna().sum()}, sum={pd.to_numeric(wk4_after[c], errors="coerce").sum():.1f}')

# The critical question: after dedup, what's in Total TEU for rows from April?
april_survivors = wk4_after[wk4_after['__source_file__'] == 'Orders 10 APril.xlsx']
print(f'\nApril survivors in WK4: {len(april_survivors)}')
for c in teu_cols:
    vals = pd.to_numeric(april_survivors[c], errors='coerce')
    print(f'  {c}: non-null={vals.notna().sum()}, sum={vals.sum():.1f}')
