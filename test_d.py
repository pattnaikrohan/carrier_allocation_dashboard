import json
import re

with open('d:/Dashboards/frontend/src/BookingData.ts', 'r', encoding='utf-8') as f:
    content = f.read()

match = re.search(r'export const CONTRACT_UTIL_DATA = (\[.*?\]);', content, re.DOTALL)
if match:
    data = json.loads(match.group(1))
    print(f"Total rows in CONTRACT_UTIL_DATA: {len(data)}")
    for d in data[:3]:
        print(d)
