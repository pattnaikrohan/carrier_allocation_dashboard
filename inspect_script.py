import pandas as pd

files = [
    'Contract_Master_All_Data Update.xlsx',
    'CONTRACT_PORT_CODE_LISTING.xlsx',
    'Orders 10 APril.xlsx',
    'Carrier Profiles.xlsx'
]

for f in files:
    try:
        print(f"\n--- {f} ---")
        xls = pd.ExcelFile(f)
        print(f"Sheets: {xls.sheet_names}")
        for sheet in xls.sheet_names:
            df = pd.read_excel(f, sheet_name=sheet, nrows=1)
            print(f"Sheet '{sheet}' Columns: {list(df.columns)}")
    except Exception as e:
        print(f"Error reading {f}: {e}")
