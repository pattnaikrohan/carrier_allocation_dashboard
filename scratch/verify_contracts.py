import json, re

with open('d:/Dashboards/frontend/src/BookingData.ts', 'r') as f:
    content = f.read()

match = re.search(r'export const CONTRACT_UTIL_DATA = (\[.*?\]);', content, re.DOTALL)
if match:
    data = json.loads(match.group(1))
    print(f'Total contract entries: {len(data)}')
    print()
    
    for d in data:
        if d['id'] in ('299424850', '4319-1-LT', 'AUT26705', 'AUT26704', '299944496'):
            print(f"Contract: {d['id']}")
            print(f"  Lane: {d['lane']}")
            print(f"  Origin Region: {d.get('originRegion', 'N/A')}")
            print(f"  Dest Region: {d.get('destRegion', 'N/A')}")
            print(f"  Origins: {d.get('origins', 'N/A')}")
            print(f"  POL Breakdown: {json.dumps(d.get('polBreakdown', 'N/A'), indent=4)}")
            print(f"  Alloc: {d['alloc']}, Booked: {d['booked']}, Util: {d['util']}%")
            print()
else:
    print('Could not find CONTRACT_UTIL_DATA')
