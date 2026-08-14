import pandas as pd
import re

new = pd.read_excel(r'd:\Dashboards\Contract List 120626.xlsx')
old = pd.read_excel(r'd:\Dashboards\Contract_Master_All_Data Update.xlsx')

# Show existing rows for contracts that are in both — check if data changed
in_both = set(new['Contract#'].dropna().astype(str).str.strip()) & set(old['Contract #'].dropna().astype(str).str.strip())

print("=== CHECKING EXISTING CONTRACTS FOR CHANGES ===")
for cid in sorted(in_both):
    old_rows = old[old['Contract #'].astype(str).str.strip() == cid]
    new_rows = new[new['Contract#'].astype(str).str.strip() == cid]
    
    # Compare key fields
    old_origins = sorted(old_rows['Origin'].dropna().unique().tolist())
    new_origins = sorted(new_rows['Origin'].dropna().unique().tolist())
    old_dests = sorted(old_rows['Destination'].dropna().unique().tolist())
    new_dests = sorted(new_rows['Destination'].dropna().unique().tolist())
    old_priority = sorted(old_rows['Priority'].dropna().unique().tolist())
    new_priority = sorted(new_rows['Priority'].dropna().unique().tolist())
    
    changed = (old_origins != new_origins) or (old_dests != new_dests) or (old_priority != new_priority)
    if changed:
        print(f'\n  {cid} - CHANGED:')
        if old_origins != new_origins:
            print(f'    Origin: {old_origins} -> {new_origins}')
        if old_dests != new_dests:
            print(f'    Dest: {old_dests} -> {new_dests}')
        if old_priority != new_priority:
            print(f'    Priority: {old_priority} -> {new_priority}')

print("\n\n=== NEW CONTRACTS DETAIL ===")
only_in_new = set(new['Contract#'].dropna().astype(str).str.strip()) - set(old['Contract #'].dropna().astype(str).str.strip())
for cid in sorted(only_in_new):
    rows = new[new['Contract#'].astype(str).str.strip() == cid]
    print(f'\n  Contract: {cid}')
    for _, row in rows.iterrows():
        print(f'    Carrier: {row["Title"]}')
        print(f'    Origin: {row["Origin"]}')
        print(f'    Destination: {row["Destination"]}')
        print(f'    Rate Type: {row["Rate Type"]}')
        print(f'    Start: {row["Start Date"]}')
        print(f'    Expiry: {row["Expired Date"]}')
        print(f'    Priority: {row["Priority"]}')
        print(f'    Free Time: {row["Free Time"]}')
        print(f'    Allocation: {row["Allocation"]}')
        print(f'    Owner: {row["Contract Owner"]}')
        print()

print("\n=== REMOVED CONTRACTS (in old, not in new) ===")
only_in_old = set(old['Contract #'].dropna().astype(str).str.strip()) - set(new['Contract#'].dropna().astype(str).str.strip())
for cid in sorted(only_in_old, key=str):
    rows = old[old['Contract #'].astype(str).str.strip() == str(cid)]
    print(f'  {cid}: {len(rows)} rows, Carrier={rows.iloc[0]["Carrier"]}')

# Also check the Allocation field to understand Office Allocation mapping
print("\n=== ALLOCATION FIELD IN NEW FILE ===")
for _, row in new.iterrows():
    alloc = row['Allocation']
    if pd.notna(alloc):
        print(f'  {row["Contract#"]}: {alloc}')
