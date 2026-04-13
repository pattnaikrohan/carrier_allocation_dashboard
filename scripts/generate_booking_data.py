import pandas as pd
import json
import math
import numpy as np
import re
import os
from datetime import datetime

# Paths
orders_path = r'D:\Dashboards\Orders 10 APril.xlsx'
master_path = r'D:\Dashboards\Contract_Master_All_Data.xlsx'
carrier_profiles_path = r'D:\Dashboards\Carrier Profiles.xlsx'

print("Loading Master Data Sources...")
master_df = pd.read_excel(master_path)
carrier_df = pd.read_excel(carrier_profiles_path)
orders_df = pd.read_excel(orders_path)

# Build Carrier Map from Profiles
carrier_meta = {}
# Columns found: ['Code', 'Full Name', ...]
for _, row in carrier_df.iterrows():
    code = str(row['Code']).strip() if 'Code' in row else str(row.get('Client Code', '')).strip()
    name = str(row['Full Name']).strip() if 'Full Name' in row else str(row.get('Organization Name', '')).strip()
    if code:
        carrier_meta[code] = name

# Helper to parse allocation strings
def parse_allocation_to_teu(alloc_str):
    if not isinstance(alloc_str, str) or not alloc_str:
        try:
            val = float(alloc_str)
            if not math.isnan(val): return val
        except:
            pass
        return 0
    
    # Matches: [Number] [Unit (FEU/TEU)]
    matches = re.findall(r'([\d.]+)\s*(FEU|TEU)', alloc_str, re.IGNORECASE)
    total_teu = 0
    if not matches:
        # Try to find just a number
        num_match = re.search(r'([\d.]+)', alloc_str)
        if num_match:
            return float(num_match.group(1))
        return 0
        
    for val, unit in matches:
        try:
            v = float(val)
            if unit.upper() == 'FEU':
                total_teu += v * 2
            else:
                total_teu += v
        except:
            continue
    return total_teu

# Build Master Map
contract_master_map = {}
for _, row in master_df.iterrows():
    c_id = str(row['Contract #']).strip()
    if not c_id: continue
    
    alloc_teu = parse_allocation_to_teu(row['Allocation'])
    
    contract_master_map[c_id] = {
        "carrier": str(row['Carrier']),
        "origin": str(row['Origin']),
        "destination": str(row['Destination']),
        "type": str(row['Contract Type']),
        "rateType": str(row['Rate Type']),
        "expiry": str(row['Expiry Date']),
        "priority": str(row['Priority']),
        "freeTime": str(row['Free Time']),
        "allocation": alloc_teu,
        "owner": str(row['Contract Owner']),
        "rawAlloc": str(row['Allocation'])
    }

print(f"Loaded {len(contract_master_map)} master contracts and {len(carrier_meta)} carrier profiles.")

# Clean Orders
for col in orders_df.columns:
    if orders_df[col].dtype == 'object':
        orders_df[col] = orders_df[col].fillna('').astype(str)
    else:
        orders_df[col] = orders_df[col].fillna(0)

def safe_get(d, col, default=""):
    return str(d[col]).strip() if col in d and str(d[col]).strip() != '' else default

def get_region(port):
    port = str(port).upper()
    if any(x in port for x in ['CN', 'HK', 'TW', 'KR', 'JP']): return 'NEA'
    if any(x in port for x in ['SG', 'MY', 'VN', 'TH', 'ID', 'PH']): return 'SEA'
    if any(x in port for x in ['DE', 'NL', 'FR', 'GB', 'IT', 'ES', 'PL', 'GR', 'DK']): return 'EUROPE'
    if any(x in port for x in ['US', 'CA', 'MX', 'BR', 'AR', 'CL']): return 'AMERICAS'
    if any(x in port for x in ['AU', 'NZ', 'FJ', 'PG']): return 'OCEANIA'
    if any(x in port for x in ['AE', 'IN', 'PK', 'SA', 'TR']): return 'MIDDLE EAST'
    return 'OTHER'

booking_log_data = []

# MSC Week Mapping
def date_to_week(date_str):
    if not date_str or date_str == '0' or date_str == '' or date_str == 'nan': return '12' # Fallback
    try:
        dt = pd.to_datetime(date_str)
        return str(dt.isocalendar()[1])
    except:
        return '12'

print("Processing Orders...")

for _, row in orders_df.iterrows():
    teu = float(row.get('TEU _x001F_', 0.0))
    contract = str(row.get('Contract', 'UNKNOWN')).strip()
    order = str(row.get('Order Number', 'UNKNOWN'))
    branch = str(row.get('Created Branch', row.get('Branch', 'UNKNOWN')))
    
    # Resolve Date/Week
    etd = safe_get(row, 'Est. Departure', '')
    msc_week = safe_get(row, 'Week No', '')
    if not msc_week or msc_week == '0' or msc_week == 'nan' or msc_week == '':
        msc_week = date_to_week(etd)
    msc_week = msc_week.split('.')[0] # Remove decimal
    
    loadPort = safe_get(row, 'Load Port', '')
    dischargePort = safe_get(row, 'Discharge Port', '')
    
    origin_region = get_region(loadPort)
    dest_region = get_region(dischargePort)
    lane = f"{origin_region} to {dest_region}"
    
    master = contract_master_map.get(contract, {})
    carrier_code = master.get('carrier', safe_get(row, 'Planned Carrier', 'UNKNOWN'))
    carrier_name = carrier_meta.get(carrier_code, carrier_code)
    priority = master.get('priority', 'Normal')
    
    booking_log_data.append({
        "contract": contract,
        "order": order,
        "etd": etd.split(' ')[0],
        "eta": safe_get(row, 'Est. Arrival', '').split(' ')[0],
        "depVessel": safe_get(row, 'Departure Vessel', ''),
        "depVoyage": safe_get(row, 'Departure Voyage', ''),
        "buyer": safe_get(row, 'Buyer', ''),
        "supplier": safe_get(row, 'Supplier', ''),
        "loadPort": loadPort,
        "dischargePort": dischargePort,
        "branch": branch,
        "carrierName": carrier_name,
        "priority": priority,
        "teu": teu,
        "containers": int(row.get('No of Containers _x001F_', 0)),
        "mscWeek": msc_week,
        "lane": lane,
        "originRegion": origin_region,
        "destRegion": dest_region
    })

# AGGREGATIONS

def split_and_clean(series):
    items = []
    for val in series.dropna().unique():
        # Split by comma, semicolon, or slash
        parts = re.split(r'[,;/]', str(val))
        for p in parts:
            clean = p.strip()
            if clean and clean != 'nan':
                items.append(clean)
    return sorted(list(set(items)))

# 1. Filters Constants from Master Data for precision
master_origins = split_and_clean(master_df['Origin'])
master_destinations = split_and_clean(master_df['Destination'])

# Derive Lanes from Master if 'Trade Lane' is missing
if 'Trade Lane' in master_df.columns:
    master_lanes = split_and_clean(master_df['Trade Lane'])
else:
    # Build unique Lane combinations
    lane_tokens = []
    for _, row in master_df.iterrows():
        if pd.notna(row['Origin']) and pd.notna(row['Destination']):
            origins = [o.strip() for o in re.split(r'[,;/]', str(row['Origin'])) if o.strip()]
            dests = [d.strip() for d in re.split(r'[,;/]', str(row['Destination'])) if d.strip()]
            for o in origins:
                for d in dests:
                    lane_tokens.append(f"{o} to {d}")
    master_lanes = sorted(list(set(lane_tokens)))

master_allocations = split_and_clean(master_df['Allocation'])
master_priorities = split_and_clean(master_df['Priority'])

contracts_list = sorted(list(set(b['contract'] for b in booking_log_data)))
weeks_list = sorted(list(set(f"WK {b['mscWeek']}" for b in booking_log_data)), key=lambda x: int(x.split(' ')[1]) if x.split(' ')[1].isdigit() else 0)

# 2. Weekly Trend
week_stats = {}
for b in booking_log_data:
    wk = f"WK {b['mscWeek']}"
    if wk not in week_stats: week_stats[wk] = 0
    week_stats[wk] += b['teu']

total_master_alloc = sum(m['allocation'] for m in contract_master_map.values())
weekly_trend_data = []
for wk in weeks_list:
    booked = week_stats.get(wk, 0)
    alloc = total_master_alloc if total_master_alloc > 0 else max(booked * 1.2, 50)
    weekly_trend_data.append({
        "week": wk,
        "alloc": round(alloc, 1),
        "booked": round(booked, 1),
        "util": round((booked/alloc)*100, 1) if alloc > 0 else 0
    })

# 3. Branch Snapshot
branch_stats = {}
branch_teu = {}
for b in booking_log_data:
    br = b['branch']
    if br not in branch_teu: 
        branch_teu[br] = 0
        branch_stats[br] = {"booked": 0, "bookings": 0}
    branch_teu[br] += b['teu']
    branch_stats[br]["booked"] += b['teu']
    branch_stats[br]["bookings"] += 1

branch_snapshot = []
for br_id, booked in branch_teu.items():
    alloc = max(booked * 1.3, 20)
    util = (booked / alloc) * 100 if alloc > 0 else 0
    branch_snapshot.append({
        "branch": br_id,
        "code": br_id,
        "alloc": round(alloc, 1),
        "booked": round(booked, 1),
        "avail": round(alloc - booked, 1),
        "util": f"{round(util, 1)}%",
        "status": "On Track" if util < 90 else "Critical"
    })

# 4. Contract Util Data
contract_stats = {}
for b in booking_log_data:
    ctr = b['contract']
    if ctr not in contract_stats: contract_stats[ctr] = {"booked": 0, "branches": {}, "bookings": 0, "region": b['originRegion']}
    contract_stats[ctr]["booked"] += b['teu']
    contract_stats[ctr]["bookings"] += 1
    br = b['branch']
    if br not in contract_stats[ctr]["branches"]: contract_stats[ctr]["branches"][br] = 0
    contract_stats[ctr]["branches"][br] += b['teu']

contract_util_data = []
for ctr, dat in contract_stats.items():
    master = contract_master_map.get(ctr, {})
    alloc = master.get('allocation', 0)
    if alloc == 0: alloc = max(dat['booked'] * 1.1, 5)
    
    booked = dat['booked']
    util = (booked / alloc) * 100 if alloc > 0 else 0
    
    contract_util_data.append({
        "id": ctr,
        "carrier": master.get('carrier', 'UNKNOWN'),
        "lane": master.get('destination', 'UNKNOWN'),
        "type": master.get('type', 'FAK'),
        "priority": master.get('priority', 'Medium'),
        "expiry": master.get('expiry', 'N/A'),
        "alloc": round(alloc, 1),
        "booked": round(booked, 1),
        "avail": round(alloc - booked, 1),
        "util": round(util, 1),
        "status": "Active" if util < 95 else "Overloaded",
        "verif": ctr in contract_master_map,
        "owner": master.get('owner', 'N/A'),
        "notes": master.get('rawAlloc', ''),
        # Proportional mock splits for standard branch columns
        "syd": {"booked": round(dat['branches'].get('SYDNEY', dat['branches'].get('SY1', 0)), 1), "alloc": round(alloc * 0.3, 1)},
        "mel": {"booked": round(dat['branches'].get('MELBOURNE', dat['branches'].get('ME1', 0)), 1), "alloc": round(alloc * 0.3, 1)},
        "bne": {"booked": round(dat['branches'].get('BRISBANE', dat['branches'].get('BN1', 0)), 1), "alloc": round(alloc * 0.2, 1)},
        "per": {"booked": round(dat['branches'].get('PERTH', dat['branches'].get('PR1', 0)), 1), "alloc": round(alloc * 0.1, 1)},
        "adl": {"booked": round(dat['branches'].get('ADELAIDE', dat['branches'].get('AD1', 0)), 1), "alloc": round(alloc * 0.1, 1)}
    })

# EXPORT

print(f"Exporting to BookingData.ts...")
output = f"""
export const ORIGINS = {json.dumps(master_origins)};
export const DESTINATIONS = {json.dumps(master_destinations)};
export const LANES = {json.dumps(master_lanes)};
export const ALLOCATIONS = {json.dumps(master_allocations)};
export const PRIORITIES = {json.dumps(master_priorities)};
export const CONTRACTS = {json.dumps(contracts_list)};
export const WEEKS = {json.dumps(weeks_list)};

export const BOOKING_LOG_DATA = {json.dumps(booking_log_data, indent=2)};
export const WEEKLY_TREND_DATA = {json.dumps(weekly_trend_data, indent=2)};
export const BRANCH_SNAPSHOT = {json.dumps(branch_snapshot, indent=2)};
export const CONTRACT_UTIL_DATA = {json.dumps(contract_util_data, indent=2)};

// Summary aggregates
export const BOOKING_BRANCH_SUMMARY = {json.dumps([{"code": "ALL", "branch": "All Branches", "teu": round(sum(b['teu'] for b in booking_log_data), 1), "bookings": len(booking_log_data), "contracts": len(contract_stats)}] + [{"code": k, "branch": k, "teu": round(v['booked'], 1), "bookings": v['bookings'], "contracts": 1} for k, v in branch_stats.items()], indent=2)};
export const BOOKING_CONTRACT_BREAKDOWN = {json.dumps([{"contract": k, "teu": round(v['booked'], 1), "region": v['region'], "bookings": v['bookings']} for k, v in list(contract_stats.items())[:15]], indent=2)};
"""

with open(r'D:\Dashboards\frontend\src\BookingData.ts', 'w', encoding='utf-8') as f:
    f.write(output)

print("Done!")
