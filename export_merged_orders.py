"""
Export a merged Orders Excel file with ONLY the columns used by the dashboard.

COMPLETE AUDIT of columns used across ALL dashboard components:

  process_dashboard_data.py  - col_map defines the core mapping
  backend/data_processor.py  - same col_map + dumps entire df as BOOKING_LOG
  scripts/generate_booking_data.py - explicitly maps ALL fields for booking log
  
  Frontend components that consume BOOKING_LOG_DATA fields:
    ContractDashboard.tsx  - b.contract, b.branch, b.mscWeek, b.teu, b.loadPort,
                            b.dischargePort, b.order, b.buyer, b.depVessel,
                            b.depVoyage, b.etd, b.eta, b.supplier, b.region,
                            b.plannedCarrier, b.carrierName
    ContractDataExplorer.tsx - FULL booking log table with ALL fields:
                            row.contract, row.order, row.etd, row.eta,
                            row.depVessel, row.depVoyage, row.arrVessel, row.arrVoyage,
                            row.buyer, row.supplier, row.goodsOrigin, row.loadPort,
                            row.dischargePort, row.goodsDest, row.houseBill, row.masterBill,
                            row.branch, row.totalTeu, row.totalFeu, row.mscWeek,
                            row.country, row.year, row.qtr, row.region
    ProcurementDashboard.tsx - b.qtr (quarterly grouping), b.eta, b.order,
                            b.carrierName, b.plannedCarrier, b.teu, b.branch

  Raw Excel Column            -> Dashboard Internal Name -> Used In
  ───────────────────────────────────────────────────────────────────
  Contract / Contract #       -> contract                -> All dashboards
  Order Number                -> order                   -> Booking log, dedup
  Est. Departure              -> etd                     -> Year, dates
  Est. Arrival                -> eta                     -> Dates, live feed
  Departure Vessel            -> depVessel               -> Booking log
  Departure Voyage            -> depVoyage               -> Booking log
  Arrival Vessel              -> arrVessel               -> Data Explorer
  Arrival Voyage              -> arrVoyage               -> Data Explorer
  Buyer                       -> buyer                   -> Booking log
  Supplier                    -> supplier                -> Booking log
  Goods Origin                -> goodsOrigin             -> Data Explorer
  Load Port                   -> loadPort                -> Origin filtering
  Discharge Port              -> dischargePort           -> Dest filtering
  Goods Destination           -> goodsDest               -> Data Explorer
  House Bill                  -> houseBill               -> Data Explorer
  Master Bill                 -> masterBill              -> Data Explorer
  Branch / Created Branch     -> branch                  -> Branch/hub util
  Week No / CW Week No       -> week/mscWeek            -> Weekly trends
  Total TEU / TEU variants    -> teu/totalTeu            -> All TEU calcs
  No of Containers            -> totalFeu (derived)      -> Data Explorer
  Region                      -> region                  -> Region grouping
  Planned Carrier             -> plannedCarrier          -> Carrier breakdown
  Carrier Name                -> carrierName             -> Carrier fallback
"""

import pandas as pd
import os
import glob

ROOT_DIR = r'D:\Dashboards'

# All the source order file directories
ORDER_DIRS = [
    ROOT_DIR,
    os.path.join(ROOT_DIR, 'data_source'),
    os.path.join(ROOT_DIR, 'Carrier Allocation Data Orders'),
]

# The exact raw column names the dashboard uses (case-insensitive matching)
# Maps raw_col_lower -> canonical_output_name
USED_COLUMNS_MAP = {
    # Core columns mapped in col_map
    'contract': 'Contract',
    'contract #': 'Contract',
    'branch': 'Branch',
    'created branch': 'Branch',
    'week no': 'Week No',
    'cw week no': 'Week No',
    'order number': 'Order Number',
    'est. departure': 'Est. Departure',
    'est. arrival': 'Est. Arrival',
    'departure vessel': 'Departure Vessel',
    'departure voyage': 'Departure Voyage',
    'buyer': 'Buyer',
    'supplier': 'Supplier',
    'load port': 'Load Port',
    'discharge port': 'Discharge Port',
    'region': 'Region',
    'planned carrier': 'Planned Carrier',
    'carrier name': 'Carrier Name',
    
    # Columns used by ContractDataExplorer full table
    'arrival vessel': 'Arrival Vessel',
    'arrival voyage': 'Arrival Voyage',
    'goods origin': 'Goods Origin',
    'goods destination': 'Goods Destination',
    'house bill': 'House Bill',
    'master bill': 'Master Bill',
    
    # TEU variants — will be normalized to a single "Total TEU" column
    'total teu': 'Total TEU',
    'teu': 'Total TEU',
    'teu count _x001f_': 'Total TEU',
    'teu _x001f_': 'Total TEU',
    'total teu _x001f_': 'Total TEU',
    
    # Containers (used for totalFeu derivation in Data Explorer)
    'no of containers': 'No of Containers',
    'no of containers _x001f_': 'No of Containers',
}

# The final output columns in desired order
FINAL_COLUMNS = [
    'Order Number',
    'Contract',
    'Branch',
    'Week No',
    'Est. Departure',
    'Est. Arrival',
    'Departure Vessel',
    'Departure Voyage',
    'Arrival Vessel',
    'Arrival Voyage',
    'Buyer',
    'Supplier',
    'Goods Origin',
    'Load Port',
    'Discharge Port',
    'Goods Destination',
    'House Bill',
    'Master Bill',
    'Planned Carrier',
    'Carrier Name',
    'Total TEU',
    'No of Containers',
    'Region',
]


def find_all_order_files():
    """Find all Orders*.xlsx files across known directories."""
    all_files = []
    for d in ORDER_DIRS:
        if os.path.isdir(d):
            files = glob.glob(os.path.join(d, 'Orders*.xlsx'))
            all_files.extend(files)
    # Deduplicate by absolute path
    seen = set()
    unique = []
    for f in all_files:
        abs_path = os.path.abspath(f)
        if abs_path not in seen:
            seen.add(abs_path)
            unique.append(abs_path)
    return sorted(unique)


def normalize_columns(df):
    """Rename columns to their canonical dashboard names, keeping only used ones."""
    df.columns = df.columns.str.strip()
    
    # Resolve TEU first — take the max of all TEU variant columns
    teu_lower_names = {'total teu', 'teu', 'teu count _x001f_', 'teu _x001f_', 'total teu _x001f_'}
    teu_cols = [c for c in df.columns if c.lower() in teu_lower_names]
    if teu_cols:
        teu_vals = df[teu_cols].apply(pd.to_numeric, errors='coerce').fillna(0)
        df['Total TEU'] = teu_vals.max(axis=1)
        # Drop original TEU variant cols (we now have a clean 'Total TEU')
        df = df.drop(columns=[c for c in teu_cols if c != 'Total TEU'], errors='ignore')
    else:
        df['Total TEU'] = 0

    # Resolve container columns
    cont_lower_names = {'no of containers', 'no of containers _x001f_'}
    cont_cols = [c for c in df.columns if c.lower() in cont_lower_names]
    if cont_cols:
        cont_vals = df[cont_cols].apply(pd.to_numeric, errors='coerce').fillna(0)
        df['No of Containers'] = cont_vals.max(axis=1)
        df = df.drop(columns=[c for c in cont_cols if c != 'No of Containers'], errors='ignore')

    # Rename remaining columns to canonical names
    rename_map = {}
    for col in df.columns:
        canonical = USED_COLUMNS_MAP.get(col.lower())
        if canonical and canonical != col:
            rename_map[col] = canonical
    
    df = df.rename(columns=rename_map)
    # Remove duplicates after renaming
    df = df.loc[:, ~df.columns.duplicated()]
    
    # Keep only the final columns that exist
    keep = [c for c in FINAL_COLUMNS if c in df.columns]
    return df[keep]


def main():
    files = find_all_order_files()
    print(f"Found {len(files)} Orders file(s):")
    for f in files:
        print(f"  - {os.path.basename(f)}")
    
    frames = []
    for filepath in files:
        try:
            df = pd.read_excel(filepath)
            print(f"\n  Reading: {os.path.basename(filepath)} ({len(df)} rows)")
            print(f"    Raw columns: {list(df.columns)}")
            df = normalize_columns(df)
            print(f"    Kept columns: {list(df.columns)}")
            frames.append(df)
        except Exception as e:
            print(f"  WARNING: Skipped {os.path.basename(filepath)}: {e}")
    
    if not frames:
        print("\nERROR: No data found!")
        return
    
    merged = pd.concat(frames, ignore_index=True)
    print(f"\nTotal rows before dedup: {len(merged)}")
    
    # Deduplicate by Order Number, keeping the latest entry
    if 'Order Number' in merged.columns:
        merged = merged.drop_duplicates(subset=['Order Number'], keep='last')
    print(f"Total rows after dedup:  {len(merged)}")
    
    # Sort by Est. Departure descending
    if 'Est. Departure' in merged.columns:
        merged['_sort'] = pd.to_datetime(merged['Est. Departure'], errors='coerce')
        merged = merged.sort_values('_sort', ascending=False).drop(columns=['_sort'])
    
    output_path = os.path.join(ROOT_DIR, 'Merged_Orders_Dashboard_Columns.xlsx')
    merged.to_excel(output_path, index=False, sheet_name='Merged Orders')
    print(f"\nSUCCESS: Exported to: {output_path}")
    print(f"   {len(merged)} rows x {len(merged.columns)} columns")
    print(f"   Columns: {list(merged.columns)}")


if __name__ == '__main__':
    main()
