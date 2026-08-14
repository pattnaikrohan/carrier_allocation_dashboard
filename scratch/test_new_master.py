"""Test the new master file parsing logic against Contract Master 28JUL26.xlsx"""
import os, sys
sys.path.insert(0, r'd:\Dashboards\backend')
os.chdir(r'd:\Dashboards')
from dotenv import load_dotenv
load_dotenv()

import pandas as pd
from data_processor import build_master_dict, parse_office_alloc, parse_compass_total

df = pd.read_excel(r'D:\Dashboards\Contract Master 28JUL26.xlsx')
print(f"Master file loaded: {len(df)} rows")
print(f"Columns: {list(df.columns)}")

print("\n=== TESTING parse_compass_total ===")
test_cases = [
    '4 TEU PER WEEK',
    '6 TEU PER WEEK',
    'SHANGHAI to AUEC - 2 TEU per week',
    'QINGDAO to AUWC - 5 FEU per week\nQINGDAO to EC - 4 FEU per week\nQINGDAO to EC - 1.5 FEU per week on A3X',
    'EX XIAMEN TO AUEC - 10 TEU NOR \nEX XIAMEN TO AUEC - 4 TEU HQ \nEX QINGDAO TO AUEC 4 TEU HQ \nPER WEEK',
    'QINGDAO to EC - 7 TEU per week on A3X',
    'QINGDAO to AUEC - 20 TEU per week',
    None,
]
for tc in test_cases:
    result = parse_compass_total(tc)
    print(f"  {repr(tc)[:60]:60s} -> {result} TEU")

print("\n=== TESTING parse_office_alloc (new format) ===")
alloc_cases = [
    'SHARED',
    'AAW ADL - THAILAND to AU - 4 TEU per week',
    'AAW BNE - 5 TEU PER WEEK',
    'AAW ADL - QINGDAO to AUWC - 10 TEU per week\nQINGDAO to EC - 8 TEU per week\nQINGDAO to EC - 3 TEU per week on A3X',
    'AAW PRJ EX XIAMEN TO AUEC - 10 TEU NOR \nEX XIAMEN TO AUEC - 4 TEU HQ \nEX QINGDAO TO AUEC 4 TEU HQ \nPER WEEK',
    'AAW ADL = 8 TEU, AAW FRE = 8 TEU PER WEEK',
    'AAW BNE= 18 TEU, AAW ADL = 8 TEU, AAW FRE = 4 TEU, AAW MEL= 6 TEU, AAW SYD = 6 TEU \nPER WEEK',
    None,
]
for ac in alloc_cases:
    result = parse_office_alloc(ac)
    nonzero = {k: v for k, v in result.items() if v > 0}
    total = sum(result.values())
    print(f"  {repr(ac)[:70]:70s} -> total={total}, branches={nonzero}")

print("\n=== TESTING build_master_dict with new master file ===")
logs = []
master_dict, cid_to_keys = build_master_dict(df, lambda m: logs.append(m))

for msg in logs:
    print(f"  LOG: {msg}")

print(f"\n  Total compound keys: {len(master_dict)}")
print(f"  Total contracts: {len(cid_to_keys)}")

total_alloc = sum(m.get('allocTotal', 0) for m in master_dict.values())
print(f"  Total allocation: {total_alloc} TEU/week")

print("\n  Per-contract breakdown:")
for ck, minfo in sorted(master_dict.items()):
    cid = minfo['cid']
    carrier = minfo['carrier']
    alloc = minfo['allocTotal']
    oa = minfo['officeAlloc']
    nonzero_oa = {k: v for k, v in oa.items() if v > 0}
    lane = minfo['lane']
    print(f"    {ck}: carrier={carrier}, alloc={alloc} TEU/wk, lane={lane}, offices={nonzero_oa}")
