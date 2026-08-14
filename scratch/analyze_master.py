import pandas as pd
df = pd.read_excel(r'D:\Dashboards\Contract Master 28JUL26.xlsx')

print('=== ROWS WITH NON-SHARED OFFICE ALLOCATION ===')
for i, row in df.iterrows():
    oa = str(row.get('Compass Office Allocation', '')).strip()
    if oa and oa.upper() != 'SHARED' and oa.upper() != 'NAN':
        cid = row.get('Contract#', '')
        carrier = row.get('Title', '')
        total = row.get('Compass Allocation Total', '')
        print(f'  Row {i}: Contract={cid} Carrier={carrier}')
        print(f'    Office Alloc: {repr(oa)}')
        print(f'    Total Alloc:  {repr(total)}')
        print()

print()
print('=== ROWS WITH SHARED ALLOCATION ===')
count = 0
for i, row in df.iterrows():
    oa = str(row.get('Compass Office Allocation', '')).strip()
    if oa.upper() == 'SHARED':
        total = row.get('Compass Allocation Total')
        cid = row.get('Contract#', '')
        carrier = row.get('Title', '')
        print(f'  Contract={cid} Carrier={carrier} Total={repr(total)}')
        count += 1
print(f'  Total SHARED rows: {count}')

print()
print('=== ROWS WITH NO ALLOCATION (NaN) ===')
count2 = 0
for i, row in df.iterrows():
    oa = row.get('Compass Office Allocation')
    total = row.get('Compass Allocation Total')
    if pd.isna(oa) and pd.isna(total):
        cid = row.get('Contract#', '')
        carrier = row.get('Title', '')
        print(f'  Contract={cid} Carrier={carrier}')
        count2 += 1
print(f'  Total no-alloc rows: {count2}')
