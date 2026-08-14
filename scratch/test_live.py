import urllib.request
import json
req = urllib.request.Request('https://carrier-allocation-dashboard.azurewebsites.net/api/sync', method='POST')
try:
    with urllib.request.urlopen(req) as response:
        payload = json.loads(response.read().decode())
        data = payload.get('data', {})
        found = False
        for c in data.get('CONTRACT_UTIL_DATA', []):
            if c['id'] == '299424850':
                print(f"Lane: {c['lane']}, Alloc: {c['alloc']}, Booked: {c['booked']}")
                found = True
        if not found:
            print('Contract 299424850 not found in API response')
except Exception as e:
    print('Error:', e)
