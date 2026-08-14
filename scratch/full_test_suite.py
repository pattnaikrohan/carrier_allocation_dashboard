"""
COMPREHENSIVE TEST SUITE — Carrier Allocation Dashboard
Tests the entire pipeline: Snowflake → Master File → Data Processor → JSON Output
Generates structured results for the DOCX report.
"""
import os, sys, json, math, time
sys.path.insert(0, r'd:\Dashboards\backend')
os.chdir(r'd:\Dashboards')
from dotenv import load_dotenv
load_dotenv()

import pandas as pd
from data_processor import (
    build_master_dict, parse_office_alloc, parse_compass_total,
    process_data_from_azure_json, normalize_region, normalize_dest,
    _resolve_master_col
)

results = []
def test(category, name, passed, detail=""):
    status = "PASS" if passed else "FAIL"
    results.append({"category": category, "name": name, "status": status, "detail": detail})
    print(f"  {'✓' if passed else '✗'} [{status}] {name}: {detail}")

print("=" * 80)
print("COMPREHENSIVE TEST SUITE — Carrier Allocation Dashboard")
print("=" * 80)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1: UNIT TESTS — parse_compass_total()
# ═══════════════════════════════════════════════════════════════════════════════
print("\n[1] UNIT TESTS — parse_compass_total()")
print("-" * 50)

compass_tests = [
    ("4 TEU PER WEEK", 4),
    ("6 TEU PER WEEK", 6),
    ("SHANGHAI to AUEC - 2 TEU per week", 2),
    ("QINGDAO to EC - 7 TEU per week on A3X", 7),
    ("QINGDAO to AUEC - 20 TEU per week", 20),
    ("5 TEU PER WEEK", 5),
    # Multi-line: sum all TEU
    ("EX XIAMEN TO AUEC - 10 TEU NOR \nEX XIAMEN TO AUEC - 4 TEU HQ \nEX QINGDAO TO AUEC 4 TEU HQ \nPER WEEK", 18),
    # FEU conversion: 5 FEU = 10 TEU, 4 FEU = 8 TEU, 1.5 FEU = 3 TEU
    ("QINGDAO to AUWC - 5 FEU per week\nQINGDAO to EC - 4 FEU per week\nQINGDAO to EC - 1.5 FEU per week on A3X", 21),
    # Edge cases
    (None, 0),
    ("", 0),
    (float('nan'), 0),
]
for input_val, expected in compass_tests:
    actual = parse_compass_total(input_val)
    ok = actual == expected
    test("parse_compass_total", f"Input: {repr(input_val)[:50]}", ok,
         f"expected={expected}, got={actual}")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2: UNIT TESTS — parse_office_alloc()
# ═══════════════════════════════════════════════════════════════════════════════
print("\n[2] UNIT TESTS — parse_office_alloc()")
print("-" * 50)

alloc_tests = [
    # SHARED returns all zeros
    ("SHARED", {}, 0),
    # Single branch
    ("AAW ADL - THAILAND to AU - 4 TEU per week", {'adl': 4}, 4),
    ("AAW BNE - 5 TEU PER WEEK", {'bne': 5}, 5),
    # Multi-branch comma separated
    ("AAW ADL = 8 TEU, AAW FRE = 8 TEU PER WEEK", {'adl': 8, 'fre': 8}, 16),
    ("AAW BNE= 18 TEU, AAW ADL = 8 TEU, AAW FRE = 4 TEU, AAW MEL= 6 TEU, AAW SYD = 6 TEU \nPER WEEK",
     {'bne': 18, 'adl': 8, 'fre': 4, 'mel': 6, 'syd': 6}, 42),
    # PRJ prefix
    ("AAW PRJ EX XIAMEN TO AUEC - 10 TEU NOR \nEX XIAMEN TO AUEC - 4 TEU HQ \nEX QINGDAO TO AUEC 4 TEU HQ \nPER WEEK",
     {'prj': 10}, 10),
    # ADL single with route detail
    ("AAW ADL - QINGDAO to AUEC - 20 TEU per week", {'adl': 20}, 20),
    # Edge: None
    (None, {}, 0),
    (float('nan'), {}, 0),
]
for input_val, expected_branches, expected_total in alloc_tests:
    actual = parse_office_alloc(input_val)
    actual_total = sum(actual.values())
    actual_nonzero = {k: v for k, v in actual.items() if v > 0}
    total_ok = actual_total == expected_total
    branches_ok = actual_nonzero == expected_branches
    ok = total_ok and branches_ok
    test("parse_office_alloc", f"Input: {repr(input_val)[:55]}", ok,
         f"expected total={expected_total} branches={expected_branches}, got total={actual_total} branches={actual_nonzero}")

# Verify PER WEEK false positive is fixed
print("\n  --- PER WEEK false positive regression test ---")
fpr_input = "AAW ADL - QINGDAO to AUWC - 10 TEU per week\nQINGDAO to EC - 8 TEU per week\nQINGDAO to EC - 3 TEU per week on A3X"
fpr_result = parse_office_alloc(fpr_input)
fpr_fre = fpr_result.get('fre', 0)
test("parse_office_alloc", "PER WEEK false positive (FRE should be 0)", fpr_fre == 0,
     f"fre={fpr_fre} (should be 0, 'PER' in 'PER WEEK' must not match Fremantle)")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3: UNIT TESTS — _resolve_master_col()
# ═══════════════════════════════════════════════════════════════════════════════
print("\n[3] UNIT TESTS — _resolve_master_col()")
print("-" * 50)

# Simulate row with new format columns
mock_row_new = pd.Series({'Contract#': 'ABC123', 'Title': 'Maersk', 'Compass Office Allocation': 'SHARED'})
mock_row_old = pd.Series({'Contract #': 'XYZ456', 'Carrier': 'CMA', 'Office Allocation': 'SYD 10'})

val1 = _resolve_master_col(mock_row_new, 'Contract#', 'Contract #', default='')
test("_resolve_master_col", "New format Contract# found", val1 == 'ABC123', f"got={val1}")

val2 = _resolve_master_col(mock_row_old, 'Contract#', 'Contract #', default='')
test("_resolve_master_col", "Old format Contract # fallback", val2 == 'XYZ456', f"got={val2}")

val3 = _resolve_master_col(mock_row_new, 'Title', 'Carrier', default='Unknown')
test("_resolve_master_col", "New format Title found", val3 == 'Maersk', f"got={val3}")

val4 = _resolve_master_col(mock_row_old, 'Title', 'Carrier', default='Unknown')
test("_resolve_master_col", "Old format Carrier fallback", val4 == 'CMA', f"got={val4}")

val5 = _resolve_master_col(mock_row_new, 'Nonexistent', default='DEFAULT')
test("_resolve_master_col", "Missing column returns default", val5 == 'DEFAULT', f"got={val5}")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4: INTEGRATION TEST — build_master_dict() with new master file
# ═══════════════════════════════════════════════════════════════════════════════
print("\n[4] INTEGRATION TEST — build_master_dict()")
print("-" * 50)

df_master = pd.read_excel(r'D:\Dashboards\Contract Master 28JUL26.xlsx')
test("build_master_dict", "Master file loaded", len(df_master) > 0, f"{len(df_master)} rows")

logs = []
master_dict, cid_to_keys = build_master_dict(df_master, lambda m: logs.append(m))

test("build_master_dict", "Master dict not empty", len(master_dict) > 0, f"{len(master_dict)} compound keys")
test("build_master_dict", "Contracts not empty", len(cid_to_keys) > 0, f"{len(cid_to_keys)} contracts")

# Verify specific contracts
mk_299424850 = master_dict.get('299424850__NEA_AU')
if mk_299424850:
    test("build_master_dict", "299424850 carrier=Maersk", mk_299424850['carrier'] == 'Maersk', f"got={mk_299424850['carrier']}")
    test("build_master_dict", "299424850 alloc=58 TEU/wk", mk_299424850['allocTotal'] == 58, f"got={mk_299424850['allocTotal']}")
    test("build_master_dict", "299424850 shared=False", mk_299424850['shared'] == False, f"got={mk_299424850['shared']}")
    oa = mk_299424850['officeAlloc']
    test("build_master_dict", "299424850 BNE=18", oa.get('bne') == 18, f"got={oa.get('bne')}")
    test("build_master_dict", "299424850 ADL=16", oa.get('adl') == 16, f"got={oa.get('adl')}")
    test("build_master_dict", "299424850 SYD=6", oa.get('syd') == 6, f"got={oa.get('syd')}")
else:
    test("build_master_dict", "299424850 found", False, "Key not found")

mk_shared = master_dict.get('299992850__EUR_AU')
if mk_shared:
    test("build_master_dict", "299992850 shared=True", mk_shared['shared'] == True, f"got={mk_shared['shared']}")
    test("build_master_dict", "299992850 alloc=4 TEU/wk", mk_shared['allocTotal'] == 4, f"got={mk_shared['allocTotal']}")
    oa_sum = sum(mk_shared['officeAlloc'].values())
    test("build_master_dict", "299992850 officeAlloc all zero (SHARED)", oa_sum == 0, f"got sum={oa_sum}")
else:
    test("build_master_dict", "299992850 found", False, "Key not found")

# Verify total allocation
total_alloc = sum(m.get('allocTotal', 0) for m in master_dict.values())
test("build_master_dict", "Total allocation > 0", total_alloc > 0, f"{total_alloc} TEU/week")

# Count shared contracts
shared_count = sum(1 for m in master_dict.values() if m.get('shared'))
non_shared_count = sum(1 for m in master_dict.values() if not m.get('shared'))
test("build_master_dict", "Shared contracts detected", shared_count > 0, f"{shared_count} shared, {non_shared_count} branch-specific")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5: FULL PIPELINE TEST — process_data_from_azure_json()
# ═══════════════════════════════════════════════════════════════════════════════
print("\n[5] FULL PIPELINE TEST — Snowflake → Dashboard JSON")
print("-" * 50)

start = time.time()
result, log_lines = process_data_from_azure_json(force_source='SNOWFLAKE')
elapsed = round(time.time() - start, 1)
test("full_pipeline", "Pipeline executed successfully", result is not None, f"in {elapsed}s")

# Check all 13 required keys
required_keys = ['BOOKING_LOG_DATA', 'WEEKLY_TREND_DATA', 'BRANCH_SNAPSHOT', 'CONTRACT_UTIL_DATA',
                 'ORIGINS', 'DESTINATIONS', 'REGIONS', 'COUNTRIES', 'PORT_HIERARCHY',
                 'QUARTERLY_ALLOC_UTIL', 'CARRIER_BREAKDOWN', 'CONTRACTS', 'WEEKS']
for key in required_keys:
    present = key in result
    length = len(result[key]) if present else 0
    test("full_pipeline", f"Key '{key}' present", present, f"len={length}")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 6: BOOKING LOG DATA INTEGRITY
# ═══════════════════════════════════════════════════════════════════════════════
print("\n[6] BOOKING LOG DATA INTEGRITY")
print("-" * 50)

bookings = result['BOOKING_LOG_DATA']
test("booking_log", "Booking records exist", len(bookings) > 0, f"{len(bookings)} records")

# Check required fields in sample record
sample = bookings[0]
req_fields = ['order', 'contract', 'branch', 'teu', 'week_num', 'year', 'mscWeek']
for f in req_fields:
    test("booking_log", f"Field '{f}' in booking record", f in sample, f"value={sample.get(f)}")

# Total TEU
total_teu = sum(b.get('teu', 0) or 0 for b in bookings)
test("booking_log", "Total TEU > 0", total_teu > 0, f"{total_teu} TEU")

# No NaN/Infinity
nan_count = sum(1 for b in bookings for v in b.values() if isinstance(v, float) and (math.isnan(v) or math.isinf(v)))
test("booking_log", "No NaN/Infinity values", nan_count == 0, f"{nan_count} found")

# Branch distribution
branch_counts = {}
for b in bookings:
    br = b.get('branch', 'Unknown')
    branch_counts[br] = branch_counts.get(br, 0) + 1
test("booking_log", "Multiple branches present", len(branch_counts) >= 5, f"{len(branch_counts)} branches: {sorted(branch_counts.keys())}")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 7: CONTRACT UTILISATION DATA
# ═══════════════════════════════════════════════════════════════════════════════
print("\n[7] CONTRACT UTILISATION DATA")
print("-" * 50)

contracts = result['CONTRACT_UTIL_DATA']
test("contract_util", "Contracts exist", len(contracts) > 0, f"{len(contracts)} contracts")

# Total booked TEU across contracts should match booking log
contract_teu = sum(c.get('booked', 0) or 0 for c in contracts)
diff_pct = abs(contract_teu - total_teu) / total_teu * 100 if total_teu > 0 else 0
test("contract_util", "Contract TEU matches booking log", diff_pct < 1, f"contract={contract_teu}, booking={total_teu}, diff={diff_pct:.2f}%")

# Contracts with allocation
with_alloc = [c for c in contracts if (c.get('alloc') or 0) > 0]
without_alloc = [c for c in contracts if (c.get('alloc') or 0) == 0]
test("contract_util", "Some contracts have allocation", len(with_alloc) > 0, f"{len(with_alloc)} with, {len(without_alloc)} without")

# SHARED contracts have shared=True and branch alloc = pool
shared_contracts = [c for c in contracts if c.get('shared')]
test("contract_util", "SHARED contracts flagged", len(shared_contracts) > 0, f"{len(shared_contracts)} shared contracts")

for sc in shared_contracts:
    # Each branch should see alloc = contract total alloc (pool)
    contract_alloc = sc['alloc']
    for branch_key in ['syd', 'mel', 'bne', 'fre', 'adl', 'prj', 'akl']:
        bd = sc.get(branch_key, {})
        branch_alloc = bd.get('alloc', 0)
        ok = branch_alloc == contract_alloc
        test("contract_util", f"SHARED {sc['id'][:20]} {branch_key} alloc=pool", ok,
             f"branch_alloc={branch_alloc}, pool={contract_alloc}")
        # avail should be pool - total booked (same for all branches)
        if 'avail' in bd:
            expected_avail = max(contract_alloc - sc['booked'], 0)
            ok2 = bd['avail'] == expected_avail
            test("contract_util", f"SHARED {sc['id'][:20]} {branch_key} avail=remaining", ok2,
                 f"avail={bd['avail']}, expected={expected_avail}")
        break  # Only test first branch per contract to keep report manageable

# Non-shared contracts have branch-specific alloc
non_shared_with_alloc = [c for c in contracts if not c.get('shared') and (c.get('alloc') or 0) > 0]
for nsc in non_shared_with_alloc[:3]:
    branch_sum = sum(nsc.get(b, {}).get('alloc', 0) for b in ['syd', 'mel', 'bne', 'fre', 'adl', 'pil', 'prj', 'akl', 'oth'])
    test("contract_util", f"Non-shared {nsc['id'][:25]} branch sum ≈ total",
         abs(branch_sum - nsc['alloc']) < 1, f"sum={branch_sum}, total={nsc['alloc']}")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 8: BRANCH SNAPSHOT
# ═══════════════════════════════════════════════════════════════════════════════
print("\n[8] BRANCH SNAPSHOT")
print("-" * 50)

branches = result['BRANCH_SNAPSHOT']
test("branch_snapshot", "All 9 branches present", len(branches) == 9, f"{len(branches)} branches")

expected_branches = {'SY1', 'ME1', 'BN1', 'FR1', 'AD1', 'PIL', 'PRJ', 'AKL', 'OTH'}
actual_branches = {b['branch'] for b in branches}
test("branch_snapshot", "Expected branch codes", actual_branches == expected_branches, f"got={actual_branches}")

# Total booked across branches should match booking log
branch_total_booked = sum(b.get('booked', 0) for b in branches)
test("branch_snapshot", "Branch booked = booking log TEU", abs(branch_total_booked - total_teu) < 1,
     f"branch_total={branch_total_booked}, booking_log={total_teu}")

# All branches should have allocation > 0 (because of SHARED pool)
for b in branches:
    test("branch_snapshot", f"{b['branchName']} has allocation (incl. shared pool)",
         b['alloc'] > 0, f"alloc={b['alloc']}, booked={b['booked']}, util={b['util']}%")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 9: WEEKLY TREND DATA
# ═══════════════════════════════════════════════════════════════════════════════
print("\n[9] WEEKLY TREND DATA")
print("-" * 50)

weekly = result['WEEKLY_TREND_DATA']
test("weekly_trend", "Weekly data exists", len(weekly) > 0, f"{len(weekly)} weeks")

# Total booked across weeks should match booking log
weekly_booked = sum(w.get('booked', 0) or 0 for w in weekly)
test("weekly_trend", "Weekly booked = booking log TEU", abs(weekly_booked - total_teu) < 1,
     f"weekly={weekly_booked}, booking_log={total_teu}")

# All weeks should have consistent allocation
alloc_values = [w.get('alloc', 0) for w in weekly if w.get('alloc', 0) > 0]
if alloc_values:
    all_same = len(set(alloc_values)) == 1
    test("weekly_trend", "Consistent weekly allocation", all_same,
         f"unique values: {sorted(set(alloc_values))}")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 10: QUARTERLY ALLOC/UTIL
# ═══════════════════════════════════════════════════════════════════════════════
print("\n[10] QUARTERLY ALLOC/UTIL")
print("-" * 50)

quarterly = result['QUARTERLY_ALLOC_UTIL']
test("quarterly", "Quarterly data exists", len(quarterly) > 0, f"{len(quarterly)} quarters")

q_util_total = sum(q.get('Utilisation', 0) or 0 for q in quarterly)
test("quarterly", "Quarterly utilisation = booking log TEU", abs(q_util_total - total_teu) < 1,
     f"quarterly={q_util_total}, booking_log={total_teu}")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 11: CARRIER BREAKDOWN
# ═══════════════════════════════════════════════════════════════════════════════
print("\n[11] CARRIER BREAKDOWN")
print("-" * 50)

carriers = result['CARRIER_BREAKDOWN']
test("carrier_breakdown", "Carriers exist", len(carriers) > 0, f"{len(carriers)} carriers")

total_carrier_pct = sum(c.get('pct', 0) or 0 for c in carriers)
test("carrier_breakdown", "Carrier pct sums to ~100%", 90 < total_carrier_pct <= 100,
     f"{total_carrier_pct}%")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 12: PORT HIERARCHY & GEO DATA
# ═══════════════════════════════════════════════════════════════════════════════
print("\n[12] PORT HIERARCHY & GEO DATA")
print("-" * 50)

ports = result['PORT_HIERARCHY']
test("geo_data", "Port hierarchy exists", len(ports) > 0, f"{len(ports)} ports")

regions = result['REGIONS']
test("geo_data", "Regions exist", len(regions) > 0, f"{regions}")

countries = result['COUNTRIES']
test("geo_data", "Countries exist", len(countries) > 0, f"{len(countries)} countries")

origins = result['ORIGINS']
test("geo_data", "Origins exist", len(origins) > 0, f"{len(origins)} origins")

destinations = result['DESTINATIONS']
test("geo_data", "Destinations exist", len(destinations) > 0, f"{len(destinations)} destinations")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 13: CROSS-VALIDATION CHECKS
# ═══════════════════════════════════════════════════════════════════════════════
print("\n[13] CROSS-VALIDATION CHECKS")
print("-" * 50)

# All booking contracts should appear in contract_util_data
booking_cids = set(b.get('contract') for b in bookings if b.get('contract'))
contract_ids = set()
for c in contracts:
    cid = c.get('id', '')
    if '__' in cid:
        contract_ids.add(cid.split('__')[0])
    else:
        contract_ids.add(cid)
unmatched = booking_cids - contract_ids
test("cross_validation", "All booking contracts in util data", len(unmatched) == 0,
     f"{len(unmatched)} unmatched: {unmatched}")

# All booking weeks should appear in weekly trend
booking_weeks = set(f"WK {b.get('mscWeek')}" for b in bookings if b.get('mscWeek'))
trend_weeks = set(w.get('week') for w in weekly)
missing_weeks = booking_weeks - trend_weeks
test("cross_validation", "All booking weeks in weekly trend", len(missing_weeks) == 0,
     f"{len(missing_weeks)} missing")

# Weeks list matches weekly trend
weeks_list = set(result['WEEKS'])
test("cross_validation", "WEEKS list = weekly trend weeks", weeks_list == trend_weeks,
     f"WEEKS={len(weeks_list)}, trend={len(trend_weeks)}")

# ═══════════════════════════════════════════════════════════════════════════════
# FINAL SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 80)
print("FINAL REPORT")
print("=" * 80)

passed = sum(1 for r in results if r['status'] == 'PASS')
failed = sum(1 for r in results if r['status'] == 'FAIL')
total = len(results)

print(f"\n  TOTAL: {total}")
print(f"  PASSED: {passed}")
print(f"  FAILED: {failed}")
print(f"  PASS RATE: {passed/total*100:.1f}%")

if failed > 0:
    print(f"\n  FAILURES:")
    for r in results:
        if r['status'] == 'FAIL':
            print(f"    ✗ [{r['category']}] {r['name']}: {r['detail']}")

# Save results as JSON for DOCX generation
with open(r'd:\Dashboards\scratch\test_results.json', 'w') as f:
    json.dump({
        'results': results,
        'summary': {'total': total, 'passed': passed, 'failed': failed, 'pass_rate': f"{passed/total*100:.1f}%"},
        'pipeline_time': elapsed,
        'booking_count': len(bookings),
        'contract_count': len(contracts),
        'shared_count': len(shared_contracts),
        'total_teu': total_teu,
        'branch_snapshot': [{'branch': b['branchName'], 'alloc': b['alloc'], 'booked': b['booked'], 'util': b['util']} for b in branches],
        'master_contracts': len(cid_to_keys),
        'master_compound_keys': len(master_dict),
    }, f, indent=2)

print(f"\n  Results saved to scratch/test_results.json")
print("=" * 80)
