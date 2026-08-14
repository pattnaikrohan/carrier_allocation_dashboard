import os
import sys

from dotenv import load_dotenv
load_dotenv('d:/Dashboards/.env')
os.environ['SF_ACCOUNT'] = 'SGLYREN-GG43054'
os.environ['SF_USER'] = 'TEST_AI_AUTO'
os.environ['SF_WAREHOUSE'] = 'DEV_COMPUTE_WH'
os.environ['SF_DATABASE'] = 'DEV'
os.environ['SF_SCHEMA'] = 'PUBLIC'
os.environ['SF_PRIVATE_KEY_PATH'] = 'd:/Dashboards/scratch/snowflake_key.pem'

sys.path.append('d:/Dashboards/backend')
from data_processor import process_data_from_azure_json

def get_ui_kpis(data, week_label):
    bookings = [b for b in data['BOOKING_LOG_DATA'] if f"WK {b.get('mscWeek')}" == week_label]
    
    total_alloc = 0
    total_booked = 0
    
    weekScale = 1 / max(len(data['WEEKS']), 1)
    if len(data['WEEKS']) > 0:
        weekScale = 1 / len(data['WEEKS'])
    else:
        weekScale = 1
        
    for c in data['CONTRACT_UTIL_DATA']:
        contract_bookings = [b for b in bookings if b.get('contract') == c['id']]
        booked = sum(float(b.get('teu') or 0) for b in contract_bookings)
        scaled_alloc = (c.get('allocTotal', c.get('alloc', 0))) * weekScale
        total_alloc += scaled_alloc
        total_booked += booked
        
    return total_alloc, total_booked

print("=== VERIFYING SNOWFLAKE ===")
sf_data, _ = process_data_from_azure_json("SNOWFLAKE")
alloc_sf, booked_sf = get_ui_kpis(sf_data, 'WK 26-2026')
print(f"Snowflake - Total Allocation: {alloc_sf}")
print(f"Snowflake - Total Booked: {booked_sf}")

print("\n=== VERIFYING AZURE BLOB ===")
az_data, _ = process_data_from_azure_json("AZURE_BLOB")
alloc_az, booked_az = get_ui_kpis(az_data, 'WK 26-2026')
print(f"Azure Blob - Total Allocation: {alloc_az}")
print(f"Azure Blob - Total Booked: {booked_az}")
