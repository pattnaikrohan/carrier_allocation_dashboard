import os
from azure.storage.blob import BlobServiceClient
from dotenv import load_dotenv
load_dotenv()
client = BlobServiceClient(account_url=f'https://{os.getenv(''AZURE_STORAGE_ACCOUNT'')}.blob.core.windows.net', credential=f'?{os.getenv(''AZURE_SAS_TOKEN'')}')
blobs = list(client.get_container_client(os.getenv(''AZURE_CONTAINER_NAME'', ''carrier-allocation'')).list_blobs())
print([(b.name, b.size) for b in blobs])
