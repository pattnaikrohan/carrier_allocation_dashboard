"""Test the SHARED pool logic."""
import os, sys
sys.path.insert(0, r'd:\Dashboards\backend')
os.chdir(r'd:\Dashboards')
from dotenv import load_dotenv
load_dotenv()

from data_processor import process_data_from_azure_json
import json

result, log_lines = process_data_from_azure_json(force_source='SNOWFLAKE')

print("=== SHARED CONTRACTS ===")
for c in result['CONTRACT_UTIL_DATA']:
    if c.get('shared'):
        print(f"\n  {c['id']} ({c['carrier']}, {c['lane']})")
        print(f"    alloc={c['alloc']}, booked={c['booked']}, avail={c['avail']}")
        # Show branch breakdown
        for b in ['syd', 'mel', 'bne', 'fre', 'adl', 'prj', 'akl']:
            bd = c.get(b, {})
            if bd.get('booked', 0) > 0 or bd.get('alloc', 0) > 0:
                print(f"    {b}: alloc={bd['alloc']}, booked={bd['booked']}, avail={bd.get('avail', 'N/A')}")

print("\n=== BRANCH SNAPSHOT ===")
for b in result['BRANCH_SNAPSHOT']:
    print(f"  {b['branchName']:12s}: alloc={b['alloc']:>8.1f}, booked={b['booked']:>8.1f}, avail={b['avail']:>8.1f}, util={b['util']:.1f}%")
