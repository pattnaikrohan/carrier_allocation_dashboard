import os
from dotenv import load_dotenv

# Load root .env
load_dotenv('d:/Dashboards/.env')
# Also need snowflake env vars since they aren't in .env but were provided by user
os.environ['SF_ACCOUNT'] = "SGLYREN-GG43054"
os.environ['SF_USER'] = "TEST_AI_AUTO"
os.environ['SF_WAREHOUSE'] = "DEV_COMPUTE_WH"
os.environ['SF_DATABASE'] = "DEV"
os.environ['SF_SCHEMA'] = "PUBLIC"
os.environ['SF_PRIVATE_KEY_PATH'] = "d:/Dashboards/scratch/snowflake_key.pem"

import sys
sys.path.append('d:/Dashboards/backend')
from data_processor import process_data_from_azure_json

print("--- TESTING SNOWFLAKE SOURCE ---")
json_data_sf, log_sf = process_data_from_azure_json(force_source="SNOWFLAKE")
print(f"Log: {log_sf}")
print(f"Contracts loaded: {len(json_data_sf.get('CONTRACTS', []))}")

print("\n--- TESTING AZURE BLOB SOURCE ---")
json_data_az, log_az = process_data_from_azure_json(force_source="AZURE_BLOB")
print(f"Log: {log_az}")
print(f"Contracts loaded: {len(json_data_az.get('CONTRACTS', []))}")
