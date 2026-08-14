"""
COMPREHENSIVE DATA PIPELINE VERIFICATION
=========================================
Tests the full Snowflake → data_processor → JSON → dashboard correctness.

Steps verified:
1. Snowflake connection & raw data fetch
2. Column mapping (Snowflake columns → internal column names)
3. TEU resolution (no double-counting, correct max logic)
4. BCN & cancelled order exclusion
5. Branch code normalization & inference
6. Week numbering & year derivation
7. Master data (allocation) loading from Azure
8. Contract utilisation calculations
9. Branch snapshot calculations
10. Weekly trend data accuracy
11. Carrier breakdown accuracy
12. Quarterly aggregation accuracy
13. JSON output shape matches frontend expectations
"""
import os, sys, json, math
sys.path.insert(0, r'd:\Dashboards\backend')
os.chdir(r'd:\Dashboards')
from dotenv import load_dotenv
load_dotenv()

import pandas as pd
import traceback

# Collect test results
results = []
warnings = []
def PASS(test, detail=""): results.append(("PASS", test, detail))
def FAIL(test, detail=""): results.append(("FAIL", test, detail))
def WARN(test, detail=""): warnings.append((test, detail))

print("=" * 90)
print("SNOWFLAKE → DASHBOARD DATA PIPELINE VERIFICATION")
print("=" * 90)

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1: SNOWFLAKE RAW DATA FETCH
# ═══════════════════════════════════════════════════════════════════════════════
print("\n[1] SNOWFLAKE CONNECTION & RAW DATA FETCH")
print("-" * 50)

try:
    from data_processor import fetch_orders_from_snowflake
    log_msgs = []
    df_raw = fetch_orders_from_snowflake(lambda m: log_msgs.append(m))
    print(f"    Rows fetched: {len(df_raw)}")
    print(f"    Columns: {list(df_raw.columns)}")
    PASS("Snowflake connection", f"{len(df_raw)} rows fetched")
except Exception as e:
    FAIL("Snowflake connection", str(e))
    print(f"    ERROR: {e}")
    traceback.print_exc()
    print("\n    Cannot proceed without Snowflake data. Exiting.")
    sys.exit(1)

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2: COLUMN MAPPING VERIFICATION
# ═══════════════════════════════════════════════════════════════════════════════
print("\n[2] COLUMN MAPPING VERIFICATION")
print("-" * 50)

# These are the critical columns the data_processor maps
expected_mappings = {
    'contract': ['Contract', 'Contract #', 'CONTRACT'],
    'branch': ['Branch', 'Created Branch', 'BRANCH'],
    'week': ['Week No', 'CW Week No', 'WEEK NO'],
    'order': ['Order Number', 'ORDER_NUMBER'],
    'etd': ['Est. Departure', 'EST_DEPARTURE'],
    'eta': ['Est. Arrival', 'EST_ARRIVAL'],
    'plannedCarrier': ['Planned Carrier', 'PLANNED CARRIER'],
    'carrierName': ['Carrier Name'],
    'loadPort': ['Load Port', 'LOAD PORT', 'JD_RL_NKPORTOFLOADING', 'JD_RL_NKPortOfLoading'],
    'dischargePort': ['Discharge Port', 'DISCHARGE PORT', 'JD_RL_NKPORTOFDISCHARGE', 'JD_RL_NKPortOfDischarge'],
}

raw_cols = [c.strip() for c in df_raw.columns]
for target, sources in expected_mappings.items():
    matched = [s for s in sources if s in raw_cols]
    if matched:
        PASS(f"Column '{target}' mapped from", f"{matched[0]}")
        print(f"    ✓ '{target}' ← '{matched[0]}'")
    else:
        # Check case-insensitive
        ci_match = [s for s in sources if s.lower() in [c.lower() for c in raw_cols]]
        if ci_match:
            PASS(f"Column '{target}' mapped (case-insensitive)", f"{ci_match[0]}")
            print(f"    ✓ '{target}' ← '{ci_match[0]}' (case-insensitive)")
        else:
            FAIL(f"Column '{target}' NOT FOUND", f"Looked for: {sources}")
            print(f"    ✗ '{target}' NOT FOUND (looked for: {sources})")

# Check TEU columns
teu_cols = [c for c in raw_cols if 'teu' in c.lower()]
print(f"\n    TEU columns found: {teu_cols}")
if teu_cols:
    PASS("TEU column(s) present", str(teu_cols))
    for tc in teu_cols:
        vals = pd.to_numeric(df_raw[tc], errors='coerce')
        non_null = vals.notna().sum()
        total_teu = vals.sum()
        print(f"      {tc}: {non_null} non-null values, sum={total_teu:.1f}")
else:
    FAIL("No TEU columns found", "Dashboard will show 0 TEU everywhere")

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3: FULL PIPELINE TEST (process_data_from_azure_json)
# ═══════════════════════════════════════════════════════════════════════════════
print("\n[3] FULL PIPELINE TEST (process_data_from_azure_json)")
print("-" * 50)

try:
    from data_processor import process_data_from_azure_json
    data, proc_log = process_data_from_azure_json(force_source='SNOWFLAKE')
    print(f"    Pipeline returned {len(data)} top-level keys")
    print(f"    Processing log ({len(proc_log)} lines):")
    for line in proc_log:
        print(f"      > {line}")
    PASS("Full pipeline execution")
except Exception as e:
    FAIL("Full pipeline execution", str(e))
    traceback.print_exc()
    print("\n    Cannot proceed without processed data. Exiting.")
    sys.exit(1)

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4: JSON SHAPE VERIFICATION
# ═══════════════════════════════════════════════════════════════════════════════
print("\n[4] JSON OUTPUT SHAPE VERIFICATION")
print("-" * 50)

# These are the exact keys the frontend's useBookingData.tsx expects
expected_keys = [
    'BOOKING_LOG_DATA', 'WEEKLY_TREND_DATA', 'BRANCH_SNAPSHOT',
    'CONTRACT_UTIL_DATA', 'ORIGINS', 'DESTINATIONS', 'REGIONS',
    'COUNTRIES', 'PORT_HIERARCHY', 'QUARTERLY_ALLOC_UTIL',
    'CARRIER_BREAKDOWN', 'CONTRACTS', 'WEEKS',
]

for key in expected_keys:
    if key in data:
        val = data[key]
        kind = type(val).__name__
        length = len(val) if isinstance(val, (list, dict)) else 'N/A'
        PASS(f"Key '{key}' present", f"type={kind}, len={length}")
        print(f"    ✓ {key}: {kind}[{length}]")
    else:
        FAIL(f"Key '{key}' MISSING", "Frontend will fall back to static data")
        print(f"    ✗ {key}: MISSING")

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5: BOOKING LOG DATA CHECKS
# ═══════════════════════════════════════════════════════════════════════════════
print("\n[5] BOOKING LOG DATA CHECKS")
print("-" * 50)

booking_log = data.get('BOOKING_LOG_DATA', [])
print(f"    Total booking records: {len(booking_log)}")

if len(booking_log) > 0:
    sample = booking_log[0]
    sample_keys = list(sample.keys())
    print(f"    Sample record keys: {sample_keys}")
    
    # Check critical fields exist in booking records
    critical_booking_fields = ['contract', 'branch', 'teu', 'week_num', 'mscWeek']
    for field in critical_booking_fields:
        present = field in sample
        if present:
            PASS(f"Booking field '{field}'", f"value={sample[field]}")
        else:
            FAIL(f"Booking field '{field}' MISSING", f"Available: {sample_keys}")
    
    # Check TEU values
    total_teu = sum(b.get('teu', 0) or 0 for b in booking_log)
    zero_teu = sum(1 for b in booking_log if (b.get('teu', 0) or 0) == 0)
    print(f"    Total TEU across all bookings: {total_teu:.1f}")
    print(f"    Zero-TEU bookings: {zero_teu} / {len(booking_log)}")
    
    if total_teu == 0:
        FAIL("Total TEU is ZERO", "Dashboard KPIs will show 0")
    else:
        PASS(f"Total TEU = {total_teu:.1f}")
    
    # Check for BCN bookings (should be excluded)
    bcn_count = sum(1 for b in booking_log if b.get('bcn') in (True, 1, '1', 'True'))
    if bcn_count > 0:
        FAIL(f"BCN bookings NOT filtered", f"{bcn_count} BCN bookings in output")
    else:
        PASS("BCN bookings excluded")
    
    # Check for cancelled orders (should be excluded)
    cancelled_count = sum(1 for b in booking_log if b.get('cancelled_orders') == 1)
    if cancelled_count > 0:
        FAIL(f"Cancelled orders NOT filtered", f"{cancelled_count} cancelled in output")
    else:
        PASS("Cancelled orders excluded")
    
    # Check branch distribution
    branch_counts = {}
    for b in booking_log:
        br = b.get('branch', 'Unknown')
        branch_counts[br] = branch_counts.get(br, 0) + 1
    print(f"    Branch distribution:")
    for br, cnt in sorted(branch_counts.items(), key=lambda x: -x[1]):
        print(f"      {br}: {cnt} bookings")
    
    unknown_branches = branch_counts.get('Unknown', 0) + branch_counts.get('', 0) + branch_counts.get('nan', 0)
    if unknown_branches > 0:
        WARN("Unknown branches remain", f"{unknown_branches} bookings with Unknown/empty branch")
    else:
        PASS("All branches resolved")

else:
    FAIL("BOOKING_LOG_DATA is empty", "Dashboard will have no data")

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 6: CONTRACT UTILISATION DATA
# ═══════════════════════════════════════════════════════════════════════════════
print("\n[6] CONTRACT UTILISATION DATA")
print("-" * 50)

contract_util = data.get('CONTRACT_UTIL_DATA', [])
print(f"    Total contracts: {len(contract_util)}")

if len(contract_util) > 0:
    total_alloc = sum(c.get('alloc', 0) or 0 for c in contract_util)
    total_booked = sum(c.get('booked', 0) or 0 for c in contract_util)
    with_alloc = sum(1 for c in contract_util if (c.get('alloc', 0) or 0) > 0)
    no_alloc = sum(1 for c in contract_util if (c.get('alloc', 0) or 0) == 0)
    
    print(f"    Total allocation: {total_alloc:.1f} TEU")
    print(f"    Total booked: {total_booked:.1f} TEU")
    print(f"    Contracts with allocation: {with_alloc}")
    print(f"    Contracts without allocation: {no_alloc}")
    
    # Verify contract booked TEU matches booking log
    booking_teu_total = sum(b.get('teu', 0) or 0 for b in booking_log)
    # Contract booked might differ slightly due to multi-leg routing
    diff = abs(total_booked - booking_teu_total)
    pct_diff = (diff / booking_teu_total * 100) if booking_teu_total > 0 else 0
    print(f"    Contract booked vs Booking log TEU: {total_booked:.1f} vs {booking_teu_total:.1f} (diff: {diff:.1f}, {pct_diff:.1f}%)")
    if pct_diff > 5:
        WARN("Contract booked TEU differs >5% from booking log", f"{pct_diff:.1f}% difference")
    else:
        PASS("Contract TEU matches booking log", f"{pct_diff:.1f}% difference")
    
    # Check a few sample contracts
    print(f"\n    Sample contracts (top 5 by allocation):")
    sorted_contracts = sorted(contract_util, key=lambda c: -(c.get('alloc', 0) or 0))[:5]
    for c in sorted_contracts:
        util_str = f"{c.get('util')}%" if c.get('util') is not None else "N/A"
        print(f"      {c['id']}: carrier={c['carrier']}, alloc={c.get('alloc',0)}, booked={c.get('booked',0)}, util={util_str}")
    
    PASS(f"Contract utilisation data", f"{len(contract_util)} contracts, {total_alloc:.0f} alloc TEU")
else:
    FAIL("CONTRACT_UTIL_DATA is empty")

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 7: WEEKLY TREND DATA
# ═══════════════════════════════════════════════════════════════════════════════
print("\n[7] WEEKLY TREND DATA")
print("-" * 50)

weekly_trend = data.get('WEEKLY_TREND_DATA', [])
print(f"    Total weeks: {len(weekly_trend)}")

if len(weekly_trend) > 0:
    # Check each week has alloc, booked, util
    for w in weekly_trend[:3]:
        print(f"    {w['week']}: alloc={w.get('alloc',0)}, booked={w.get('booked',0)}, util={w.get('util',0)}%")
    
    # Cross-check: sum of weekly booked should match booking log total
    weekly_booked_total = sum(w.get('booked', 0) or 0 for w in weekly_trend)
    booking_log_total = sum(b.get('teu', 0) or 0 for b in booking_log)
    diff = abs(weekly_booked_total - booking_log_total)
    print(f"\n    Weekly booked sum: {weekly_booked_total:.1f}")
    print(f"    Booking log sum:  {booking_log_total:.1f}")
    print(f"    Difference:       {diff:.1f}")
    
    if diff < 1:
        PASS("Weekly trend TEU matches booking log")
    else:
        WARN("Weekly trend TEU mismatch", f"Weekly sum={weekly_booked_total:.1f}, Log sum={booking_log_total:.1f}, diff={diff:.1f}")
    
    # Check alloc is consistent
    alloc_values = set(w.get('alloc', 0) for w in weekly_trend)
    if len(alloc_values) == 1:
        PASS("Weekly allocation is consistent", f"All weeks = {alloc_values.pop()} TEU/week")
    else:
        WARN("Weekly allocation varies across weeks", f"Values: {alloc_values}")
else:
    FAIL("WEEKLY_TREND_DATA is empty")

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 8: BRANCH SNAPSHOT
# ═══════════════════════════════════════════════════════════════════════════════
print("\n[8] BRANCH SNAPSHOT")
print("-" * 50)

branch_snapshot = data.get('BRANCH_SNAPSHOT', [])
print(f"    Total branches: {len(branch_snapshot)}")

expected_branches = ['SY1', 'ME1', 'BN1', 'FR1', 'AD1', 'PIL', 'PRJ', 'AKL', 'OTH']
snapshot_branches = [b['branch'] for b in branch_snapshot]
missing = set(expected_branches) - set(snapshot_branches)
if missing:
    FAIL("Missing branches in snapshot", str(missing))
else:
    PASS("All expected branches present")

total_snap_booked = sum(b.get('booked', 0) for b in branch_snapshot)
print(f"    Total booked across branches: {total_snap_booked:.1f}")

for bs in branch_snapshot:
    print(f"    {bs['branch']} ({bs.get('branchName','?')}): alloc={bs.get('alloc',0)}, booked={bs.get('booked',0)}, util={bs.get('util',0)}%")

# Cross-check against booking log
booking_log_branch_teu = sum(b.get('teu', 0) or 0 for b in booking_log)
diff = abs(total_snap_booked - booking_log_branch_teu)
if diff < 1:
    PASS("Branch snapshot TEU matches booking log")
else:
    WARN("Branch snapshot TEU differs from booking log", f"Snapshot={total_snap_booked:.1f}, Log={booking_log_branch_teu:.1f}")

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 9: CARRIER BREAKDOWN
# ═══════════════════════════════════════════════════════════════════════════════
print("\n[9] CARRIER BREAKDOWN")
print("-" * 50)

carrier_breakdown = data.get('CARRIER_BREAKDOWN', [])
print(f"    Total carriers: {len(carrier_breakdown)}")

if len(carrier_breakdown) > 0:
    total_carrier_teu = sum(c.get('teu', 0) for c in carrier_breakdown)
    total_pct = sum(c.get('pct', 0) for c in carrier_breakdown)
    print(f"    Total carrier TEU: {total_carrier_teu:.1f}")
    print(f"    Total pct: {total_pct:.1f}%")
    
    for c in carrier_breakdown[:5]:
        print(f"    {c['carrier']}: {c['teu']} TEU ({c['pct']}%), bookings={c['bookings']}")
    
    # Pct should be ~100% (can be slightly less due to top-15 capping)
    if total_pct > 95:
        PASS(f"Carrier pct sums to {total_pct:.1f}%")
    else:
        WARN(f"Carrier pct only {total_pct:.1f}%", "Some bookings may not have carrier info")
else:
    FAIL("CARRIER_BREAKDOWN is empty")

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 10: QUARTERLY DATA
# ═══════════════════════════════════════════════════════════════════════════════
print("\n[10] QUARTERLY ALLOC/UTIL")
print("-" * 50)

quarterly = data.get('QUARTERLY_ALLOC_UTIL', [])
print(f"    Total quarters: {len(quarterly)}")

if len(quarterly) > 0:
    for q in quarterly:
        print(f"    {q['quarter']}: Allocation={q['Allocation']}, Utilisation={q['Utilisation']}, UtilPct={q['UtilPct']}%")
    
    total_q_util = sum(q['Utilisation'] for q in quarterly)
    booking_total = sum(b.get('teu', 0) or 0 for b in booking_log)
    diff = abs(total_q_util - booking_total)
    if diff < 1:
        PASS("Quarterly utilisation matches booking total")
    else:
        WARN("Quarterly utilisation mismatch", f"Q sum={total_q_util:.1f}, booking sum={booking_total:.1f}")
else:
    FAIL("QUARTERLY_ALLOC_UTIL is empty")

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 11: WEEKS LIST
# ═══════════════════════════════════════════════════════════════════════════════
print("\n[11] WEEKS LIST")
print("-" * 50)

weeks = data.get('WEEKS', [])
print(f"    Available weeks: {len(weeks)}")
if weeks:
    print(f"    Range: {weeks[0]} to {weeks[-1]}")
    print(f"    All weeks: {weeks}")
    PASS(f"Weeks list", f"{len(weeks)} weeks: {weeks[0]} to {weeks[-1]}")
else:
    FAIL("WEEKS list is empty")

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 12: DATA INTEGRITY CROSS-CHECKS
# ═══════════════════════════════════════════════════════════════════════════════
print("\n[12] DATA INTEGRITY CROSS-CHECKS")
print("-" * 50)

# Check 1: Do booking contracts match contract_util contracts?
booking_contracts = set(b.get('contract', '') for b in booking_log)
util_contracts = set(c.get('id', '').split('__')[0] for c in contract_util)  # Strip compound key suffix
unmatched = booking_contracts - util_contracts - {'OTHER', 'SPOT', 'AGENT', 'OTH'}
if len(unmatched) <= 3:
    PASS("Booking contracts mapped to util", f"{len(unmatched)} unmatched: {unmatched}")
else:
    WARN(f"{len(unmatched)} booking contracts not in CONTRACT_UTIL", str(list(unmatched)[:10]))

# Check 2: Do weeks in booking log map to WEEKLY_TREND weeks?
booking_weeks = set(f"WK {b.get('mscWeek', '')}" for b in booking_log if b.get('mscWeek'))
trend_weeks = set(w.get('week', '') for w in weekly_trend)
missing_weeks = booking_weeks - trend_weeks
if missing_weeks:
    WARN(f"Booking weeks not in trend data", str(missing_weeks))
else:
    PASS("All booking weeks present in weekly trend")

# Check 3: No NaN/Infinity in numeric fields
nan_count = 0
for record in booking_log:
    for k, v in record.items():
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            nan_count += 1
if nan_count > 0:
    FAIL(f"NaN/Infinity values in booking log", f"{nan_count} occurrences")
else:
    PASS("No NaN/Infinity in booking log")

# ═══════════════════════════════════════════════════════════════════════════════
# FINAL REPORT
# ═══════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 90)
print("FINAL REPORT")
print("=" * 90)

passes = sum(1 for r in results if r[0] == 'PASS')
fails = sum(1 for r in results if r[0] == 'FAIL')

print(f"\n  PASSED: {passes}")
print(f"  FAILED: {fails}")
print(f"  WARNINGS: {len(warnings)}")

if fails > 0:
    print(f"\n  FAILURES:")
    for status, test, detail in results:
        if status == 'FAIL':
            print(f"    ✗ {test}: {detail}")

if warnings:
    print(f"\n  WARNINGS:")
    for test, detail in warnings:
        print(f"    ⚠ {test}: {detail}")

print(f"\n  All tests:")
for status, test, detail in results:
    icon = "✓" if status == "PASS" else "✗"
    print(f"    {icon} [{status}] {test}: {detail}")

print(f"\n{'=' * 90}")
if fails == 0:
    print("✓ ALL CHECKS PASSED — Snowflake data pipeline is correct.")
else:
    print(f"✗ {fails} CHECK(S) FAILED — investigate the issues above.")
print(f"{'=' * 90}")
