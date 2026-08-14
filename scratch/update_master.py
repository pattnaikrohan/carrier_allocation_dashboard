import pandas as pd
import re
import os, sys

# Load files
new = pd.read_excel(r'd:\Dashboards\Contract List 120626.xlsx')
old = pd.read_excel(r'd:\Dashboards\Contract_Master_All_Data Update.xlsx')

new_ids = set(new['Contract#'].dropna().astype(str).str.strip().tolist())
old_ids = set(old['Contract #'].dropna().astype(str).str.strip().tolist())

only_in_new = new_ids - old_ids
only_in_old = old_ids - new_ids
in_both = new_ids & old_ids

# Step 1: Keep existing rows for contracts that are in both files
# (preserves the granular Office Allocation breakdown)
keep_rows = old[old['Contract #'].astype(str).str.strip().isin(in_both)].copy()

# Step 2: Update Priority for existing contracts if changed
for cid in in_both:
    new_row = new[new['Contract#'].astype(str).str.strip() == cid].iloc[0]
    new_priority = new_row['Priority']
    new_free_time = new_row['Free Time']
    new_owner = new_row['Contract Owner']
    mask = keep_rows['Contract #'].astype(str).str.strip() == cid
    if pd.notna(new_priority):
        keep_rows.loc[mask, 'Priority'] = new_priority
    if pd.notna(new_free_time):
        keep_rows.loc[mask, 'Free Time'] = new_free_time
    if pd.notna(new_owner):
        keep_rows.loc[mask, 'Contract Owner'] = new_owner

# Step 3: Build new rows for contracts only in new file
new_rows_list = []
for cid in sorted(only_in_new):
    rows = new[new['Contract#'].astype(str).str.strip() == cid]
    for _, row in rows.iterrows():
        carrier = str(row['Title']).strip()
        # Map carrier names to match existing format
        carrier_map = {'CMA': 'CMACGM', 'Maersk': 'Maersk', 'MSC': 'MSC', 'PIL': 'PIL', 'MGF': 'MGF', 'OOCL': 'OOCL', 'HMM': 'HMM'}
        carrier_mapped = carrier_map.get(carrier, carrier)
        
        origin = str(row['Origin']).strip() if pd.notna(row['Origin']) else ''
        dest = str(row['Destination']).strip() if pd.notna(row['Destination']) else ''
        rate_type = str(row['Rate Type']).strip() if pd.notna(row['Rate Type']) else 'FAK'
        
        # Determine contract type
        if 'NAC' in rate_type.upper():
            contract_type = 'NAC'
        elif 'BUNDLE' in rate_type.upper() or 'SCFI' in rate_type.upper():
            contract_type = 'BUNDLE'
        else:
            contract_type = 'FAK'
        
        # Parse allocation into Office Allocation format
        alloc_raw = row['Allocation'] if pd.notna(row['Allocation']) else None
        alloc_total = 'NIL'
        office_alloc = None
        
        if alloc_raw:
            # Try to extract TEU/FEU numbers
            numbers = re.findall(r'(\d+)\s*(?:TEU|FEU)', str(alloc_raw), re.IGNORECASE)
            if numbers:
                total = sum(int(n) for n in numbers)
                alloc_total = f'{total} TEU per week'
            office_alloc = str(alloc_raw)
        
        start_date = row['Start Date'] if pd.notna(row['Start Date']) else 'Various'
        expiry_date = row['Expired Date'] if pd.notna(row['Expired Date']) else 'Various'
        
        new_row = {
            'Carrier': carrier_mapped,
            'Contract #': cid,
            'Origin': origin,
            'Destination': dest,
            'Contract Type': contract_type,
            'Contract Name': rate_type,
            'Rate Type': rate_type,
            'Start Date': start_date,
            'Expiry Date': expiry_date,
            'Priority': row['Priority'] if pd.notna(row['Priority']) else 'Normal',
            'Free Time': row['Free Time'] if pd.notna(row['Free Time']) else '14 days at POD',
            'Allocation Total': alloc_total,
            'Office Allocation': office_alloc,
            'Contract Owner': row['Contract Owner'] if pd.notna(row['Contract Owner']) else 'AAW',
        }
        new_rows_list.append(new_row)

new_rows_df = pd.DataFrame(new_rows_list)

# Step 4: Combine — existing (minus removed) + new
result = pd.concat([keep_rows, new_rows_df], ignore_index=True)

# Sort by Carrier then Contract #
result = result.sort_values(['Carrier', 'Contract #']).reset_index(drop=True)

print(f'=== RESULT ===')
print(f'Old master: {len(old)} rows')
print(f'Kept (existing): {len(keep_rows)} rows')
print(f'Added (new): {len(new_rows_df)} rows')
print(f'Removed: {len(only_in_old)} contracts')
print(f'Final: {len(result)} rows')
print(f'\nContracts in final: {sorted(result["Contract #"].astype(str).str.strip().unique().tolist())}')

# Save
output_path = r'd:\Dashboards\Contract_Master_All_Data Update.xlsx'
result.to_excel(output_path, index=False)
print(f'\nSaved to: {output_path}')

# Also show what was added
print('\n=== NEW ROWS ADDED ===')
print(new_rows_df[['Carrier', 'Contract #', 'Origin', 'Destination', 'Contract Type', 'Allocation Total', 'Office Allocation']].to_string())
