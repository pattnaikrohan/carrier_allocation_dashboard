import pandas as pd

new = pd.read_excel(r'd:\Dashboards\Contract List 120626.xlsx')
old = pd.read_excel(r'd:\Dashboards\Contract_Master_All_Data Update.xlsx')

new_ids = set(new['Contract#'].dropna().astype(str).str.strip().tolist())
old_ids = set(old['Contract #'].dropna().astype(str).str.strip().tolist())

print('=== CONTRACTS IN NEW FILE ===')
for c in sorted(new_ids): print(f'  {c}')

print(f'\n=== COMPARISON ===')
print(f'New file: {len(new_ids)} unique contracts')
print(f'Old file: {len(old_ids)} unique contracts')

only_in_new = new_ids - old_ids
only_in_old = old_ids - new_ids
in_both = new_ids & old_ids

print(f'\nIn both: {len(in_both)}')
for c in sorted(in_both): print(f'  {c}')

print(f'\nNEW contracts (only in new file): {len(only_in_new)}')
for c in sorted(only_in_new):
    rows = new[new['Contract#'].astype(str).str.strip() == c]
    row = rows.iloc[0]
    title = row['Title']
    origin = row['Origin']
    dest = row['Destination']
    print(f'  {c} - {title} - {origin} to {dest}')

print(f'\nREMOVED contracts (only in old file): {len(only_in_old)}')
for c in sorted(only_in_old, key=str): print(f'  {c}')

# Show old master column structure for mapping
print('\n=== OLD MASTER COLUMNS ===')
for col in old.columns:
    print(f'  {col}')

print('\n=== NEW FILE COLUMNS ===')
for col in new.columns:
    print(f'  {col}')
