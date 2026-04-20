import os
import re

path = 'D:/Dashboards/frontend/src/BookingData.ts'
with open(path, 'r') as f:
    content = f.read()

# Extract CONTRACT_UTIL_DATA and BRANCH_SNAPSHOT
# Use regex to find the json parts
import json

cu_match = re.search(r'export const CONTRACT_UTIL_DATA = (\[.*?\]);', content, re.DOTALL)
bs_match = re.search(r'export const BRANCH_SNAPSHOT = (\[.*?\]);', content, re.DOTALL)

if cu_match and bs_match:
    cu_data = json.loads(cu_match.group(1))
    bs_data = json.loads(bs_match.group(1))
    
    total_cu_alloc = sum(c['alloc'] for c in cu_data)
    total_bs_alloc = sum(b['alloc'] for b in bs_data)
    
    print(f"Total CONTRACT_UTIL_DATA Alloc: {total_cu_alloc}")
    print(f"Total BRANCH_SNAPSHOT Alloc: {total_bs_alloc}")
    
    if abs(total_cu_alloc - total_bs_alloc) < 1:
        print("SUCCESS: Allocations match!")
    else:
        print("FAILURE: Allocations do NOT match!")
else:
    print("Could not find data in file")
