"""
Use the actual data_processor to calculate KPI values.
"""
import sys
sys.path.insert(0, 'D:/Dashboards')
sys.path.insert(0, 'D:/Dashboards/backend')

from backend.data_processor import process_data_from_azure
import json

ts_content, log_lines = process_data_from_azure(force_source='SNOWFLAKE')

# Parse out the key data structures
import re

def extract_json(ts, varname):
    pattern = rf'export const {varname} = ([\s\S]*?);(?:\s*export|\s*$)'
    match = re.search(pattern, ts)
    if match:
        return json.loads(match.group(1))
    return None

branch_snapshot = extract_json(ts_content, 'BRANCH_SNAPSHOT')
contract_util = extract_json(ts_content, 'CONTRACT_UTIL_DATA')
weeks = extract_json(ts_content, 'WEEKS')

print("=" * 60)
print("EXPECTED KPI CARD VALUES (ALL filter)")
print("=" * 60)

if branch_snapshot:
    total_alloc = sum(b['alloc'] for b in branch_snapshot)
    total_booked = sum(b['booked'] for b in branch_snapshot)
    overall_util = round((total_booked / total_alloc * 100), 1) if total_alloc > 0 else 0.0
    
    print(f"\nTOTAL ALLOCATION:  {total_alloc:,.0f}")
    print(f"TOTAL BOOKED:      {total_booked:,.1f}")
    print(f"OVERALL UTIL %:    {overall_util}%")
    print(f"ACTIVE WEEKS:      ALL ({len(weeks)} weeks)")

    print(f"\n{'='*60}")
    print(f"BRANCH PERFORMANCE SNAPSHOT")
    print(f"{'='*60}")
    print(f"{'Branch':<15} {'Alloc':>10} {'Booked':>10} {'Available':>10} {'Util %':>10}")
    print(f"{'-'*55}")
    for b in branch_snapshot:
        print(f"{b['branch']:<15} {b['alloc']:>10,.1f} {b['booked']:>10,.1f} {b['avail']:>10,.1f} {b['util']:>9.1f}%")

if contract_util:
    underperf = sum(1 for c in contract_util if c.get('util', 0) <= 80 and c.get('contractType', '') not in ('OTH', 'SPOT', 'AGENT'))
    low_util = sum(1 for c in contract_util if c.get('util', 0) < 50)
    print(f"\nUNDERPERFORMING CONTRACTS (util <= 80%): {underperf}")
    print(f"LOW UTILISATION CONTRACTS (util < 50%):   {low_util}")

print(f"\n{'='*60}")
print("LOG OUTPUT:")
print("=" * 60)
for line in log_lines:
    print(line)
