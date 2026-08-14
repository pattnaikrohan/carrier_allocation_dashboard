import os
from dotenv import load_dotenv

load_dotenv('d:/Dashboards/.env')
os.environ['SF_ACCOUNT'] = 'SGLYREN-GG43054'
os.environ['SF_USER'] = 'TEST_AI_AUTO'
os.environ['SF_WAREHOUSE'] = 'DEV_COMPUTE_WH'
os.environ['SF_DATABASE'] = 'DEV'
os.environ['SF_SCHEMA'] = 'PUBLIC'
os.environ['SF_PRIVATE_KEY_PATH'] = 'd:/Dashboards/scratch/snowflake_key.pem'

import sys
sys.path.append('d:/Dashboards/backend')
from data_processor import process_data_from_azure_json

print("=== VERIFYING SNOWFLAKE ===")
sf_data, _ = process_data_from_azure_json("SNOWFLAKE")
wk_sf = next((w for w in sf_data['WEEKS'] if w['week'] == 'WK 26-2026'), None)
if wk_sf:
    print(f"Snowflake - Week: WK 26-2026")
    print(f"Snowflake - Total Allocation: {wk_sf['totalAlloc']}")
    print(f"Snowflake - Total Booked: {wk_sf['totalBooked']}")
else:
    print("Snowflake - Week WK 26-2026 not found!")

print("\n=== VERIFYING AZURE BLOB ===")
az_data, _ = process_data_from_azure_json("AZURE_BLOB")
wk_az = next((w for w in az_data['WEEKS'] if w['week'] == 'WK 26-2026'), None)
if wk_az:
    print(f"Azure Blob - Week: WK 26-2026")
    print(f"Azure Blob - Total Allocation: {wk_az['totalAlloc']}")
    print(f"Azure Blob - Total Booked: {wk_az['totalBooked']}")
else:
    print("Azure Blob - Week WK 26-2026 not found!")
