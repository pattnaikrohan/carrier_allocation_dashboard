"""Upload the new master file to Azure Blob Storage."""
import os, sys
sys.path.insert(0, r'd:\Dashboards\backend')
os.chdir(r'd:\Dashboards')
from dotenv import load_dotenv
load_dotenv()

from data_processor import _upload_blob_file

container = os.getenv('AZURE_CONTAINER_NAME', 'carrier-allocation')
master_file = os.getenv('MASTER_FILE_NAME', 'Contract_Master_All_Data Update.xlsx')

local_path = r'D:\Dashboards\Contract Master 28JUL26.xlsx'

print(f"Uploading: {local_path}")
print(f"  -> Container: {container}")
print(f"  -> Blob name: {master_file}")

with open(local_path, 'rb') as f:
    data = f.read()

print(f"  File size: {len(data)} bytes")

result = _upload_blob_file(container, master_file, data)
print(f"  Upload result: {result}")
print("Done!")
