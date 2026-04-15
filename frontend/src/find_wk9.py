import json
import re

with open("D:/Dashboards/frontend/src/BookingData.ts", encoding="utf-8") as f:
    text = f.read()

# Grab the array content for BOOKING_LOG_DATA
match = re.search(r'export const BOOKING_LOG_DATA = \[(.*?)\];', text, re.DOTALL)
if match:
    arr_text = '[' + match.group(1) + ']'
    data = json.loads(arr_text)
    
    wk9_sum = 0
    wk9_items = []
    for item in data:
        if item.get('mscWeek') == "9.0":
            wk9_sum += item.get('teu', 0)
            wk9_items.append(item)
    
    print("WK9 Total Elements:", len(wk9_items))
    print("WK9 Total TEU:", wk9_sum)
    for i in wk9_items:
        print(f"TEU: {i['teu']}, Origin: {i['originRegion']}, Dest: {i['destRegion']}")
