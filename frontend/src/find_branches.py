import sys

with open("D:/Dashboards/frontend/src/BookingData.ts", encoding="utf-8") as f:
    text = f.read()

import re
branches = re.findall(r'"branch":\s*"([^"]+)"', text)
print(set(branches))
