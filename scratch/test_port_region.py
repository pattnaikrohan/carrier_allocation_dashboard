import pandas as pd
import json

from backend.data_processor import process_data_from_azure_json
import os

print("Running test...")
df = pd.read_excel('D:/Dashboards/Orders_12 June.xlsx')

port_df = pd.read_excel('D:/Dashboards/World_Container_Ports.xlsx')
port_map = {}
for _, row in port_df.iterrows():
    p = str(row.get('UN/LOCODE', '')).strip().upper()
    cname = str(row.get('Country', '')).strip()
    if p:
        port_map[p] = {'name': str(row.get('Port Name', '')).strip(), 'region': str(row.get('Region', '')).strip()}

_region_map = {
    'North East Asia': 'NEA', 'South East Asia': 'SEA', 'Europe': 'EUR',
    'Oceania': 'AU', 'Americas': 'Americas', 'Asia': 'NEA',
}
port_name_to_region = {}
for code, info in port_map.items():
    name_upper = info.get('name', '').strip().upper()
    if name_upper:
        region_raw = info.get('region', '')
        port_name_to_region[name_upper] = _region_map.get(region_raw, region_raw)
    region_raw = info.get('region', '')
    port_name_to_region[code] = _region_map.get(region_raw, region_raw)

def normalize_region(val):
    if not val or str(val).lower() == 'nan':
        return 'Unknown'
    val = str(val).strip().upper()
    if 'QINGDAO' in val or 'YANTIAN' in val or 'SHANGHAI' in val or 'NINGBO' in val or 'XINGANG' in val or 'NANSHA' in val or 'XIAMEN' in val:
        return 'NEA'
    if 'HO CHI MINH' in val or 'LAEM CHABANG' in val or 'JAKARTA' in val or 'PORT KELANG' in val or 'THAILAND' in val:
        return 'SEA'
    if 'EUR' in val:
        return 'EUR'
    if 'AU' in val:
        return 'AU'
    return val

def get_port_region(port_value):
    if not port_value or str(port_value) == 'nan':
        return 'Unknown'
    p_upper = str(port_value).strip().upper()
    if p_upper in port_name_to_region:
        return port_name_to_region[p_upper]
    return normalize_region(port_value)

bookings = df[df['Contract #'] == '299424850']
for _, row in bookings.iterrows():
    lp = row.get('Load Port')
    teu = row.get('Total TEU')
    if pd.notna(lp):
        resolved_name = port_map.get(str(lp).strip().upper(), {}).get('name', lp)
        region = get_port_region(resolved_name)
        print(f"Booking TEU: {teu}, Load Port: {lp} -> {resolved_name} -> Region: {region}")

