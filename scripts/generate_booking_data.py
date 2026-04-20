import pandas as pd
import json
import re
import math
import os

# Paths
ORDERS_PATH = 'D:/Dashboards/Orders 1Feb2026_30Jun2026.xlsx'
MASTER_PATH = 'D:/Dashboards/Contract_Master_All_Data Update.xlsx'
PORT_CODE_PATH = 'D:/Dashboards/CONTRACT_PORT_CODE_LISTING.xlsx'
CARRIER_PATH = 'D:/Dashboards/Carrier Profiles.xlsx'
OUTPUT_TS_PATH = 'D:/Dashboards/frontend/src/BookingData.ts'


def safe_str(val):
    if val is None:
        return '0'
    try:
        if pd.isna(val):
            return '0'
    except Exception:
        pass
    return str(val).strip()


def safe_float(val):
    if val is None:
        return 0.0
    try:
        if pd.isna(val):
            return 0.0
    except Exception:
        pass
    try:
        return float(val)
    except Exception:
        return 0.0


def safe_int(val):
    if val is None:
        return 0
    try:
        if pd.isna(val):
            return 0
    except Exception:
        pass
    try:
        return int(float(val))
    except Exception:
        return 0


def parse_alloc_str(s):
    if s is None or (isinstance(s, float) and math.isnan(s)):
        return 0
    s = str(s).upper()
    match = re.search(r'(\d+)', s)
    if match:
        return int(match.group(1))
    return 0


def parse_office_alloc(s):
    """Parse office allocation string into branch dict.
    e.g. 'AAW BNE = 2 TEU, AAW ADL= 6 TEU, AAW MEL= 4 TEU'
    FRE replaces PER; PIL, PRJ, AKL, OTH are new branches.
    """
    branch_map = {
        'syd': 0, 'mel': 0, 'bne': 0,
        'fre': 0, 'adl': 0,
        'pil': 0, 'prj': 0, 'akl': 0, 'oth': 0
    }
    if s is None or (isinstance(s, float) and math.isnan(s)):
        return branch_map
    s = str(s).upper()
    patterns = {
        'syd': r'SYD[^\d]*(\d+)',
        'mel': r'MEL[^\d]*(\d+)',
        'bne': r'BNE[^\d]*(\d+)',
        'fre': r'(?:FRE|PER)[^\d]*(\d+)',  # FRE was previously PER
        'adl': r'ADL[^\d]*(\d+)',
        'pil': r'PIL[^\d]*(\d+)',
        'prj': r'PRJ[^\d]*(\d+)',
        'akl': r'AKL[^\d]*(\d+)',
        'oth': r'OTH[^\d]*(\d+)',
    }
    for k, pat in patterns.items():
        m = re.search(pat, s)
        if m:
            branch_map[k] = int(m.group(1))
    return branch_map


def to_js(var_name, obj):
    """Serialise Python object to a TypeScript export const statement."""
    jsn = json.dumps(obj, indent=2, default=str)
    jsn = re.sub(r'\bNaN\b', '0', jsn)
    jsn = re.sub(r'\bInfinity\b', '0', jsn)
    return f"export const {var_name} = {jsn};\n"


def main():
    print("Loading datasets...")
    df_ports = pd.read_excel(PORT_CODE_PATH)
    df_master = pd.read_excel(MASTER_PATH)

    # Use data_only via openpyxl so formula cells return their cached values
    df_orders = pd.read_excel(ORDERS_PATH, engine='openpyxl')
    print(f"  Orders file: {len(df_orders)} rows, columns: {list(df_orders.columns)}")

    # ── 1. Port Code Hierarchy ────────────────────────────────────────────────
    port_hierarchy = []
    port_dict = {}
    for _, row in df_ports.iterrows():
        code = str(row['PORT CODE']).strip() if pd.notna(row['PORT CODE']) else ''
        if not code:
            continue
        entry = {
            "region":  str(row['REGION']).strip()   if pd.notna(row.get('REGION'))    else 'UNKNOWN',
            "country": str(row['COUNTRY ']).strip() if pd.notna(row.get('COUNTRY '))  else 'UNKNOWN',
            "name":    str(row['PORT NAME']).strip() if pd.notna(row.get('PORT NAME')) else code,
            "code":    code,
        }
        port_hierarchy.append(entry)
        port_dict[code] = entry

    # ── 2. Contract Master Dict ───────────────────────────────────────────────
    master_dict = {}
    for _, row in df_master.iterrows():
        cid = str(row['Contract #']).strip() if pd.notna(row.get('Contract #')) else ''
        if not cid:
            continue
        valid_alloc = parse_alloc_str(row.get('Allocation Total'))
        valid_office_alloc = parse_office_alloc(row.get('Office Allocation'))

        if cid not in master_dict:
            master_dict[cid] = {
                'carrier':       str(row['Carrier']).strip() if pd.notna(row.get('Carrier')) else 'Unknown Carrier',
                'allocTotalStr': str(row['Allocation Total']).strip() if pd.notna(row.get('Allocation Total')) else '0',
                'allocTotal':    valid_alloc,
                'officeAlloc':   valid_office_alloc,
                'priority':      str(row['Priority']).strip() if pd.notna(row.get('Priority')) else 'Normal',
                'lane':          f"{str(row.get('Origin','')).strip()} to {str(row.get('Destination','')).strip()}",
            }
        else:
            master_dict[cid]['allocTotal'] += valid_alloc
            for br, vl in valid_office_alloc.items():
                master_dict[cid]['officeAlloc'][br] = master_dict[cid]['officeAlloc'].get(br, 0) + vl

    # ── 3. Orders / Booking Log ───────────────────────────────────────────────
    booking_log_data = []
    origins, destinations, lanes = set(), set(), set()
    allocations_set, priorities, contracts, weeks = set(), set(), set(), set()
    regions, countries, port_names, port_codes = set(), set(), set(), set()

    for entry in port_hierarchy:
        regions.add(entry['region'])
        countries.add(entry['country'])
        port_names.add(entry['name'])
        port_codes.add(entry['code'])

    # Resolve numeric TEU column (file has formula strings in 'TEU _x001F_'; numeric in 'TEU')
    teu_col = None
    for candidate in ['TEU', 'TEU _x001F_', 'TEU Count _x001F_']:
        if candidate in df_orders.columns:
            sample = df_orders[candidate].dropna().head(10)
            if len(sample) and all(isinstance(v, (int, float)) for v in sample):
                teu_col = candidate
                print(f"  Using TEU column: '{teu_col}'")
                break

    cont_col = next((c for c in ['No of Containers _x001F_', 'No of Containers'] if c in df_orders.columns), None)
    week_col = next((c for c in ['Week No', 'CW Week No'] if c in df_orders.columns), None)

    for _, row in df_orders.iterrows():
        cid = safe_str(row.get('Contract', '0'))

        load_port      = safe_str(row.get('Load Port', '0'))
        discharge_port = safe_str(row.get('Discharge Port', '0'))

        o_meta = port_dict.get(load_port, {})
        d_meta = port_dict.get(discharge_port, {})

        o_region  = o_meta.get('region',  load_port if load_port != '0' else 'UNKNOWN')
        d_region  = d_meta.get('region',  discharge_port if discharge_port != '0' else 'UNKNOWN')
        o_name    = o_meta.get('name',    load_port)
        d_name    = d_meta.get('name',    discharge_port)
        o_country = o_meta.get('country', 'UNKNOWN')

        lane = f"{o_region} to {d_region}"

        origins.add(o_name)
        destinations.add(d_name)
        lanes.add(lane)
        contracts.add(cid)

        master_info = master_dict.get(cid, {
            'carrier':       safe_str(row.get('Planned Carrier', 'Unknown Carrier')),
            'allocTotalStr': '0',
            'allocTotal':    0,
            'officeAlloc':   {k: 0 for k in ['syd','mel','bne','fre','adl','pil','prj','akl','oth']},
            'priority':      'Normal',
            'lane':          lane,
        })

        allocations_set.add(master_info['allocTotalStr'])
        priorities.add(master_info['priority'])

        wk = safe_str(row.get(week_col, '0')) if week_col else '0'
        week_label = f"WK {wk}" if wk not in ('0', '') else ''
        if week_label:
            weeks.add(week_label)

        raw_branch = safe_str(row.get('Branch', '0'))

        # Resolve TEU numerically
        teu_val = safe_float(row.get(teu_col, 0)) if teu_col else 0.0
        if teu_val == 0 and cont_col:
            teu_val = safe_float(row.get(cont_col, 0))

        try:
            wk_int   = int(wk)
            qtr_label = f"Q{math.ceil(wk_int / 13)}"
        except Exception:
            qtr_label = 'Q1'

        item = {
            "contract":      cid,
            "order":         safe_str(row.get('Order Number', '0')),
            "etd":           safe_str(row.get('Est. Departure', '0')),
            "eta":           safe_str(row.get('Est. Arrival',   '0')),
            "depVessel":     safe_str(row.get('Departure Vessel', '0')),
            "depVoyage":     safe_str(row.get('Departure Voyage', '0')),
            "arrVessel":     safe_str(row.get('Arrival Vessel', '0')),
            "arrVoyage":     safe_str(row.get('Arrival Voyage',  '0')),
            "buyer":         safe_str(row.get('Buyer', '0')),
            "supplier":      safe_str(row.get('Supplier', '0')),
            "goodsOrigin":   safe_str(row.get('Goods Origin', '0')),
            "goodsDest":     safe_str(row.get('Goods Destination', '0')),
            "loadPort":      load_port,
            "dischargePort": discharge_port,
            "houseBill":     safe_str(row.get('House Bill', '0')),
            "masterBill":    safe_str(row.get('Master Bill', '0')),
            "branch":        raw_branch,
            "plannedCarrier": safe_str(row.get('Planned Carrier', '0')),
            "carrierName":   master_info['carrier'],
            "priority":      master_info['priority'],
            "teu":           teu_val,
            "totalTeu":      teu_val,
            "totalFeu":      round(teu_val / 2, 2),
            "containers":    safe_int(row.get(cont_col, 0)) if cont_col else 0,
            "mscWeek":       wk,
            "lane":          lane,
            "originRegion":  o_region,
            "destRegion":    d_region,
            "country":       o_country,
            "year":          2026,
            "qtr":           qtr_label,
            "region":        safe_str(row.get('Region', o_region)),
        }
        booking_log_data.append(item)

    print(f"  Parsed {len(booking_log_data)} booking rows")

    # ── 4. Weekly Trend Data ──────────────────────────────────────────────────
    sorted_weeks = sorted(
        list(weeks),
        key=lambda w: int(w.split(' ')[1]) if ' ' in w and w.split(' ')[1].isdigit() else 0
    )
    active_week_count = max(len(sorted_weeks), 1)

    weekly_trend_data = []
    for w in sorted_weeks:
        w_num      = w.split(' ')[1] if ' ' in w else w
        w_bookings = [b for b in booking_log_data if b['mscWeek'] == w_num]
        booked     = sum(b['teu'] for b in w_bookings)

        active_contracts = set(b['contract'] for b in w_bookings)
        alloc = sum(master_dict.get(c, {}).get('allocTotal', 0) for c in active_contracts)

        util = (booked / alloc * 100) if alloc > 0 else 0
        weekly_trend_data.append({
            "week":   w,
            "alloc":  round(alloc, 1),
            "booked": round(booked, 1),
            "util":   round(util,   1),
        })

    # ── 5. Branch Snapshot ────────────────────────────────────────────────────
    std_branches = [
        ('SYDNEY',    'SY1', 'syd'),
        ('MELBOURNE', 'ME1', 'mel'),
        ('BRISBANE',  'BN1', 'bne'),
        ('FREMANTLE', 'FR1', 'fre'),   # formerly PER / PR1
        ('ADELAIDE',  'AD1', 'adl'),
        ('PIL',       'PIL', 'pil'),
        ('PROJECTS',  'PRJ', 'prj'),
        ('AUCKLAND',  'AKL', 'akl'),
        ('OTHER',     'OTH', 'oth'),
    ]

    branch_snapshot = []
    for bname, bcode, bnorm in std_branches:
        b_bookings = [b for b in booking_log_data if b['branch'] in [bcode, bnorm, bnorm.upper()]]
        booked     = sum(b['teu'] for b in b_bookings)
        alloc_pw   = sum(master_dict.get(c, {}).get('officeAlloc', {}).get(bnorm, 0) for c in master_dict)
        total_alloc = alloc_pw * active_week_count

        util = (booked / total_alloc * 100) if total_alloc > 0 else 0

        # NEW colour logic: ≤80% = underperforming risk
        if util > 80:
            status = 'Healthy'
        elif util > 50:
            status = 'Underperforming'
        else:
            status = 'Low Uptake'

        branch_snapshot.append({
            "branch":     bcode,
            "branchName": bname,
            "alloc":      round(total_alloc, 1),
            "booked":     round(booked,      1),
            "avail":      round(total_alloc - booked, 1),
            "util":       round(util,         1),
            "status":     status,
        })

    # ── 6. Contract Utilisation Data ─────────────────────────────────────────
    contract_util_data = []
    for cid in sorted(contracts):
        minfo      = master_dict.get(cid, {})
        c_bookings = [b for b in booking_log_data if b['contract'] == cid]
        booked     = sum(b['teu'] for b in c_bookings)

        alloc_week       = minfo.get('allocTotal', 0)
        total_alloc_period = alloc_week * active_week_count
        util = (booked / total_alloc_period * 100) if total_alloc_period > 0 else 0

        def gbranch(bnorm_key, *bcodes):
            bk = sum(b['teu'] for b in c_bookings if b['branch'] in list(bcodes) + [bnorm_key, bnorm_key.upper()])
            al = minfo.get('officeAlloc', {}).get(bnorm_key, 0) * active_week_count
            return {"alloc": al, "booked": round(bk, 1), "util": round(bk / al * 100, 1) if al > 0 else 0}

        contract_util_data.append({
            "id":       cid,
            "carrier":  minfo.get('carrier', 'Unknown'),
            "lane":     minfo.get('lane',    'Unknown'),
            "notes":    minfo.get('allocTotalStr', ''),
            "priority": minfo.get('priority', 'Normal'),
            "alloc":    round(total_alloc_period, 1),
            "booked":   round(booked, 1),
            "avail":    round(total_alloc_period - booked, 1),
            "util":     round(util, 1),
            "status":   'Overutilised' if util > 100 else ('Healthy' if util > 80 else 'Underperforming'),
            "syd":      gbranch('syd', 'SY1'),
            "mel":      gbranch('mel', 'ME1'),
            "bne":      gbranch('bne', 'BN1'),
            "fre":      gbranch('fre', 'FR1'),
            "adl":      gbranch('adl', 'AD1'),
            "pil":      gbranch('pil', 'PIL'),
            "prj":      gbranch('prj', 'PRJ'),
            "akl":      gbranch('akl', 'AKL'),
            "oth":      gbranch('oth', 'OTH'),
            # Backward-compat alias
            "per":      gbranch('fre', 'FR1'),
        })

    # ── 7. Quarterly Allocation vs Utilisation ────────────────────────────────
    quarterly_data: dict = {}
    for b in booking_log_data:
        try:
            wk_int = int(b['mscWeek'])
        except Exception:
            continue
        q = f"Q{math.ceil(wk_int / 13)}"
        if q not in quarterly_data:
            quarterly_data[q] = {'booked': 0.0, 'alloc': 0.0}
        quarterly_data[q]['booked'] += b['teu']

    # Distribute weekly contract allocations into quarters
    for cid, minfo in master_dict.items():
        alloc_pw = minfo.get('allocTotal', 0)
        for w in sorted_weeks:
            try:
                wk_int = int(w.split(' ')[1])
            except Exception:
                continue
            q = f"Q{math.ceil(wk_int / 13)}"
            if q not in quarterly_data:
                quarterly_data[q] = {'booked': 0.0, 'alloc': 0.0}
            quarterly_data[q]['alloc'] += alloc_pw

    quarterly_alloc_util = []
    for q in sorted(quarterly_data.keys()):
        qd   = quarterly_data[q]
        util = (qd['booked'] / qd['alloc'] * 100) if qd['alloc'] > 0 else 0
        quarterly_alloc_util.append({
            "quarter":     q,
            "Allocation":  round(qd['alloc'],  1),
            "Utilisation": round(qd['booked'], 1),
            "UtilPct":     round(util,         1),
        })

    # ── 8. Carrier Breakdown ─────────────────────────────────────────────────
    carrier_booking_map: dict = {}
    for b in booking_log_data:
        carrier = b.get('plannedCarrier', '') or ''
        if carrier in ('0', ''):
            carrier = b.get('carrierName', 'Unknown') or 'Unknown'
        if carrier not in carrier_booking_map:
            carrier_booking_map[carrier] = {'bookings': 0, 'teu': 0.0}
        carrier_booking_map[carrier]['bookings'] += 1
        carrier_booking_map[carrier]['teu']      += b['teu']

    total_carrier_teu = sum(v['teu'] for v in carrier_booking_map.values()) or 1.0
    carrier_breakdown = sorted(
        [
            {
                "carrier":  k,
                "bookings": v['bookings'],
                "teu":      round(v['teu'], 1),
                "pct":      round(v['teu'] / total_carrier_teu * 100, 1),
            }
            for k, v in carrier_booking_map.items()
        ],
        key=lambda x: -x['teu'],
    )[:15]  # top 15 carriers by TEU

    # Add allocation from master contracts per carrier (for bar comparison)
    alloc_by_carrier: dict = {}
    for cid, minfo in master_dict.items():
        c = minfo.get('carrier', 'Unknown')
        alloc_by_carrier[c] = alloc_by_carrier.get(c, 0) + minfo.get('allocTotal', 0) * active_week_count
    for entry in carrier_breakdown:
        entry['allocated'] = round(alloc_by_carrier.get(entry['carrier'], 0), 1)

    # ── 9. Write TypeScript output ────────────────────────────────────────────
    print("Writing TS Output...")
    with open(OUTPUT_TS_PATH, 'w', encoding='utf-8') as f:
        f.write('// Auto-generated by generate_booking_data.py\n')
        f.write(f'// Source: {ORDERS_PATH}\n\n')
        f.write(to_js('ORIGINS',             sorted(origins)))
        f.write(to_js('DESTINATIONS',        sorted(destinations)))
        f.write(to_js('LANES',               sorted(lanes)))
        f.write(to_js('ALLOCATIONS',         sorted(allocations_set)))
        f.write(to_js('PRIORITIES',          sorted(priorities)))
        f.write(to_js('CONTRACTS',           sorted(contracts)))
        f.write(to_js('WEEKS',               sorted_weeks))
        f.write(to_js('REGIONS',             sorted(regions)))
        f.write(to_js('COUNTRIES',           sorted(countries)))
        f.write(to_js('PORT_NAMES',          sorted(port_names)))
        f.write(to_js('PORT_CODES',          sorted(port_codes)))
        f.write(to_js('PORT_HIERARCHY',      port_hierarchy))
        f.write(to_js('BOOKING_LOG_DATA',    booking_log_data))
        f.write(to_js('WEEKLY_TREND_DATA',   weekly_trend_data))
        f.write(to_js('BRANCH_SNAPSHOT',     branch_snapshot))
        f.write(to_js('CONTRACT_UTIL_DATA',  contract_util_data))
        f.write(to_js('QUARTERLY_ALLOC_UTIL', quarterly_alloc_util))
        f.write(to_js('CARRIER_BREAKDOWN',   carrier_breakdown))

    print(f"Done! {len(booking_log_data)} bookings · {len(contract_util_data)} contracts · {len(sorted_weeks)} weeks")


if __name__ == '__main__':
    main()
