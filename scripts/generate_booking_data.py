import pandas as pd
import json
import re
import math
import os

# Paths
ORDERS_PATH = 'D:/Dashboards/Orders 10 APril.xlsx'
MASTER_PATH = 'D:/Dashboards/Contract_Master_All_Data Update.xlsx'
PORT_CODE_PATH = 'D:/Dashboards/CONTRACT_PORT_CODE_LISTING.xlsx'
CARRIER_PATH = 'D:/Dashboards/Carrier Profiles.xlsx'
OUTPUT_TS_PATH = 'D:/Dashboards/frontend/src/BookingData.ts'

def safe_str(val):
    if pd.isna(val) or val is None:
        return '0'
    return str(val).strip()

def safe_float(val):
    if pd.isna(val) or val is None:
        return 0.0
    try:
        return float(val)
    except:
        return 0.0

def safe_int(val):
    if pd.isna(val) or val is None:
        return 0
    try:
        return int(float(val))
    except:
        return 0

def parse_alloc_str(s):
    if pd.isna(s): return 0
    s = str(s).upper()
    match = re.search(r'(\d+)', s)
    if match: return int(match.group(1))
    return 0

def parse_office_alloc(s):
    # e.g., "AAW BNE = 2 TEU, AAW ADL= 6 TEU, AAW MEL= 4 TEU"
    branch_map = {'syd': 0, 'mel': 0, 'bne': 0, 'per': 0, 'adl': 0}
    if pd.isna(s): return branch_map
    s = str(s).upper()
    patterns = {
        'syd': r'SYD[^\d]*(\d+)',
        'mel': r'MEL[^\d]*(\d+)',
        'bne': r'BNE[^\d]*(\d+)',
        'per': r'PER[^\d]*(\d+)',
        'adl': r'ADL[^\d]*(\d+)'
    }
    for k, pat in patterns.items():
        m = re.search(pat, s)
        if m: branch_map[k] = int(m.group(1))
    return branch_map

def main():
    print("Loading datasets...")
    df_ports = pd.read_excel(PORT_CODE_PATH)
    df_master = pd.read_excel(MASTER_PATH)
    df_orders = pd.read_excel(ORDERS_PATH)
    
    # 1. Port Code Hierarchy
    port_hierarchy = []
    port_dict = {} # port_code -> {region, country, name}
    for _, row in df_ports.iterrows():
        code = str(row['PORT CODE']).strip() if pd.notna(row['PORT CODE']) else ''
        if not code: continue
        entry = {
            "region": str(row['REGION']).strip() if pd.notna(row['REGION']) else 'UNKNOWN',
            "country": str(row['COUNTRY ']).strip() if pd.notna(row['COUNTRY ']) else 'UNKNOWN',
            "name": str(row['PORT NAME']).strip() if pd.notna(row['PORT NAME']) else code,
            "code": code
        }
        port_hierarchy.append(entry)
        port_dict[code] = entry
        
    # 2. Master Dict
    master_dict = {}
    for _, row in df_master.iterrows():
        cid = str(row['Contract #']).strip() if pd.notna(row['Contract #']) else ''
        if not cid: continue
        
        valid_alloc = parse_alloc_str(row['Allocation Total'])
        valid_office_alloc = parse_office_alloc(row['Office Allocation'])
        
        if cid not in master_dict:
            master_dict[cid] = {
                'carrier': str(row['Carrier']).strip() if pd.notna(row['Carrier']) else 'Unknown Carrier',
                'allocTotalStr': str(row['Allocation Total']).strip() if pd.notna(row['Allocation Total']) else '0',
                'allocTotal': valid_alloc,
                'officeAlloc': valid_office_alloc,
                'priority': str(row['Priority']).strip() if pd.notna(row['Priority']) else 'Normal',
                'lane': f"{str(row['Origin']).strip() if pd.notna(row['Origin']) else ''} to {str(row['Destination']).strip() if pd.notna(row['Destination']) else ''}"
            }
        else:
            master_dict[cid]['allocTotal'] += valid_alloc
            for br, vl in valid_office_alloc.items():
                master_dict[cid]['officeAlloc'][br] += vl

    # 3. Orders Log
    booking_log_data = []
    origins, destinations, lanes, allocations_set, priorities, contracts, weeks = set(), set(), set(), set(), set(), set(), set()
    regions, countries, port_names, port_codes = set(), set(), set(), set()
    
    for entry in port_hierarchy:
        regions.add(entry['region'])
        countries.add(entry['country'])
        port_names.add(entry['name'])
        port_codes.add(entry['code'])

    # Determine TEU col
    teu_col = 'TEU _x001F_' if 'TEU _x001F_' in df_orders.columns else ('TEU Count _x001F_' if 'TEU Count _x001F_' in df_orders.columns else None)
    cont_col = 'No of Containers _x001F_' if 'No of Containers _x001F_' in df_orders.columns else None
    
    branch_norm = {
        'AD1': 'adl', 'SY1': 'syd', 'BN1': 'bne', 'ME1': 'mel', 'PR1': 'per', 'FR1': 'per'
    }

    for _, row in df_orders.iterrows():
        cid = safe_str(row.get('Contract', '0'))
        
        load_port = safe_str(row.get('Load Port', '0'))
        discharge_port = safe_str(row.get('Discharge Port', '0'))
        
        o_region = port_dict.get(load_port, {}).get('region', load_port if load_port != '0' else 'UNKNOWN')
        d_region = port_dict.get(discharge_port, {}).get('region', discharge_port if discharge_port != '0' else 'UNKNOWN')
        
        o_name = port_dict.get(load_port, {}).get('name', load_port)
        d_name = port_dict.get(discharge_port, {}).get('name', discharge_port)

        lane = f"{o_region} to {d_region}"
        
        origins.add(o_name)
        destinations.add(d_name)
        lanes.add(lane)
        contracts.add(cid)
        
        master_info = master_dict.get(cid, {
            'carrier': 'Unknown Carrier',
            'allocTotalStr': '0',
            'allocTotal': 0,
            'officeAlloc': {'syd':0,'mel':0,'bne':0,'per':0,'adl':0},
            'priority': safe_str(row.get('Order Is Priority', 'Normal')),
            'lane': lane
        })
        
        allocations_set.add(master_info['allocTotalStr'])
        priorities.add(master_info['priority'])
        
        wk = safe_str(row.get('Week No', '0'))
        week_label = f"WK {wk}" if wk != '0' else wk
        weeks.add(week_label)
        
        item = {
            "contract": cid,
            "order": safe_str(row.get('Order Number', '0')),
            "etd": safe_str(row.get('Est. Departure', '0')),
            "eta": safe_str(row.get('Est. Arrival', '0')),
            "depVessel": safe_str(row.get('Departure Vessel', '0')),
            "depVoyage": safe_str(row.get('Departure Voyage', '0')),
            "buyer": safe_str(row.get('Buyer', '0')),
            "supplier": safe_str(row.get('Supplier', '0')),
            "loadPort": load_port,
            "dischargePort": discharge_port,
            "branch": safe_str(row.get('Branch', '0')),
            "carrierName": master_info['carrier'],
            "priority": master_info['priority'],
            "teu": safe_float(row[teu_col]) if teu_col else 0.0,
            "containers": safe_int(row[cont_col]) if cont_col else 0,
            "mscWeek": wk,
            "lane": lane,
            "originRegion": o_region,
            "destRegion": d_region
        }
        booking_log_data.append(item)

    # 4. Weekly Trend Data
    weekly_trend_data = [] # week, alloc, booked, util
    sorted_weeks = sorted(list(weeks))
    for w in sorted_weeks:
        w_num = w.split(' ')[1] if ' ' in w else w
        w_bookings = [b for b in booking_log_data if b['mscWeek'] == w_num]
        booked = sum(b['teu'] for b in w_bookings)
        
        active_contracts = set(b['contract'] for b in w_bookings)
        alloc = sum(master_dict.get(c, {}).get('allocTotal', 0) for c in active_contracts)
        
        util = (booked / alloc * 100) if alloc > 0 else 0
        weekly_trend_data.append({
            "week": w,
            "alloc": alloc,
            "booked": round(booked, 1),
            "util": round(util, 1)
        })

    # 5. Branch Snapshot
    # aggregate over all weeks just for the snapshot cards
    branch_snapshot = []
    # Hardcode the standard active branches
    std_branches = [('SYDNEY', 'SY1', 'syd'), ('MELBOURNE', 'ME1', 'mel'), ('BRISBANE', 'BN1', 'bne'), ('PERTH', 'PR1', 'per'), ('ADELAIDE', 'AD1', 'adl')]
    
    for bname, bcode, bnorm in std_branches:
        b_bookings = [b for b in booking_log_data if b['branch'] in [bcode, bnorm, bnorm.upper()]]
        booked = sum(b['teu'] for b in b_bookings)
        alloc = sum(master_dict.get(c, {}).get('officeAlloc', {}).get(bnorm, 0) for c in master_dict.keys())
        # Actually alloc usually applies to the whole period, but it's "per week". We might want to sum weeks?
        # Let's take weekly alloc * number of active weeks
        active_week_count = len(sorted_weeks)
        total_alloc_period = alloc * active_week_count
        
        util = (booked / total_alloc_period * 100) if total_alloc_period > 0 else 0
        
        branch_snapshot.append({
            "branch": bcode,
            "branchName": bname,
            "alloc": round(total_alloc_period, 1),
            "booked": round(booked, 1),
            "avail": round(total_alloc_period - booked, 1),
            "util": round(util, 1),
            "status": 'On Track' if util > 70 else ('Low Uptake' if util < 40 else 'Near Full')
        })

    # 6. Contract Util Data
    contract_util_data = []
    for cid in contracts:
        minfo = master_dict.get(cid, {})
        c_bookings = [b for b in booking_log_data if b['contract'] == cid]
        booked = sum(b['teu'] for b in c_bookings)
        
        alloc_week = minfo.get('allocTotal', 0)
        total_alloc_period = alloc_week * active_week_count
        util = (booked / total_alloc_period * 100) if total_alloc_period > 0 else 0
        
        def gbranch(bnorm, bcode):
            bk = sum(b['teu'] for b in c_bookings if b['branch'] in [bcode, bnorm, bnorm.upper()])
            al = minfo.get('officeAlloc', {}).get(bnorm, 0) * active_week_count
            return {"alloc": al, "booked": round(bk, 1), "util": round(bk/al*100, 1) if al > 0 else 0}
            
        contract_util_data.append({
            "id": cid,
            "carrier": minfo.get('carrier', 'Unknown'),
            "lane": minfo.get('lane', 'Unknown'),
            "notes": minfo.get('allocTotalStr', ''),
            "priority": minfo.get('priority', 'Normal'),
            "alloc": total_alloc_period,
            "booked": round(booked, 1),
            "avail": round(total_alloc_period - booked, 1),
            "util": round(util, 1),
            "syd": gbranch('syd', 'SY1'),
            "mel": gbranch('mel', 'ME1'),
            "bne": gbranch('bne', 'BN1'),
            "per": gbranch('per', 'PR1'), # Using PR1 for general perth
            "adl": gbranch('adl', 'AD1')
        })

    # Helper function to dump json safely (handling nans and infs)
    def to_js(var_name, obj):
        jsn = json.dumps(obj, indent=2)
        jsn = re.sub(r'NaN', '0', jsn)
        jsn = re.sub(r'Infinity', '0', jsn)
        return f"export const {var_name} = {jsn};\n"

    print("Writing TS Output...")
    with open(OUTPUT_TS_PATH, 'w', encoding='utf-8') as f:
        f.write('// Auto-generated by generate_booking_data.py\n\n')
        f.write(to_js('ORIGINS', sorted(list(origins))))
        f.write(to_js('DESTINATIONS', sorted(list(destinations))))
        f.write(to_js('LANES', sorted(list(lanes))))
        f.write(to_js('ALLOCATIONS', sorted(list(allocations_set))))
        f.write(to_js('PRIORITIES', sorted(list(priorities))))
        f.write(to_js('CONTRACTS', sorted(list(contracts))))
        f.write(to_js('WEEKS', sorted(list(weeks))))
        f.write(to_js('REGIONS', sorted(list(regions))))
        f.write(to_js('COUNTRIES', sorted(list(countries))))
        f.write(to_js('PORT_NAMES', sorted(list(port_names))))
        f.write(to_js('PORT_CODES', sorted(list(port_codes))))
        f.write(to_js('PORT_HIERARCHY', port_hierarchy))
        f.write(to_js('BOOKING_LOG_DATA', booking_log_data))
        f.write(to_js('WEEKLY_TREND_DATA', weekly_trend_data))
        f.write(to_js('BRANCH_SNAPSHOT', branch_snapshot))
        f.write(to_js('CONTRACT_UTIL_DATA', contract_util_data))

    print("Success!")

if __name__ == '__main__':
    main()
