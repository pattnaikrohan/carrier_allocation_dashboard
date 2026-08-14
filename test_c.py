import json
import re

with open('d:/Dashboards/frontend/src/BookingData.ts', 'r', encoding='utf-8') as f:
    content = f.read()

match = re.search(r'export const BRANCH_SNAPSHOT = (\[.*?\]);', content, re.DOTALL)
if match:
    data = json.loads(match.group(1))
    for d in data:
        print(f"{d['branchName']}: {d['booked']}")
