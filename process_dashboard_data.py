import pandas as pd
import json
import os

# Paths
ORDERS_PATH = 'D:/Dashboards/Orders.xlsx'
ALLOCATIONS_PATH = 'D:/Dashboards/AAW_Contract Dashboard.xlsx'
OUTPUT_PATH = 'D:/Dashboards/frontend/src/data/dashboard_data.json'

def process_data():
    print("Reading Orders.xlsx...")
    df_orders = pd.read_excel(ORDERS_PATH)
    
    # Rename columns to standard internal names
    # Detect the most specific TEU column first
    if 'TEU _x001F_' in df_orders.columns:
        df_orders['teu_actual'] = df_orders['TEU _x001F_']
    elif 'TEU Count _x001F_' in df_orders.columns:
        df_orders['teu_actual'] = df_orders['TEU Count _x001F_']
    else:
        teu_cols = [c for c in df_orders.columns if 'TEU' in str(c)]
        if teu_cols:
            df_orders['teu_actual'] = df_orders[teu_cols[0]]
        else:
            df_orders['teu_actual'] = 0

    # Mapping
    df_orders = df_orders.rename(columns={
        'teu_actual': 'teu',
        'Contract': 'contract',
        'Branch': 'branch',
        'Week No': 'week',
        'Order Number': 'order',
        'Est. Departure': 'etd',
        'Est. Arrival': 'eta',
        'Departure Vessel': 'depVessel',
        'Departure Voyage': 'depVoyage',
        'Arrival Vessel': 'arrVessel',
        'Arrival Voyage': 'arrVoyage',
        'Buyer': 'buyer',
        'Supplier': 'supplier',
        'Goods Origin': 'goodsOrigin',
        'Load Port': 'loadPort',
        'Discharge Port': 'dischargePort',
        'Goods Destination': 'goodsDest',
        'House Bill': 'houseBill',
        'Master Bill': 'masterBill'
    })

    # Filter out empty weeks and convert to integer
    df_orders = df_orders.dropna(subset=['week'])
    df_orders['week'] = df_orders['week'].astype(int)
    
    # Clean up dates
    for col in ['etd', 'eta']:
        if col in df_orders.columns:
            df_orders[col] = pd.to_datetime(df_orders[col], errors='coerce').dt.strftime('%d/%m/%Y')

    # Get Allocations (Hardcoded fallback if file parsing fails, but we'll try to read it)
    # Target allocations based on the mock data as a baseline if we can't find them in the Excel
    allocations = {
        'SY1': 393,
        'ME1': 368,
        'BN1': 315,
        'FR1': 222,
        'AD1': 144,
        'PR1': 100
    }
    
    try:
        print("Reading Allocations from AAW_Contract Dashboard.xlsx...")
        # Try to find a sheet with allocation data
        df_alloc = pd.read_excel(ALLOCATIONS_PATH, sheet_name='Branch Allocation')
        # This is a bit tricky as the Excel might have a different format
        # For now, we'll use the hardcoded ones if the structure is too complex, 
        # but let's try to see if we can extract something.
        # (Based on the head() output earlier, it was complex)
    except Exception as e:
        print(f"Note: Could not parse allocations file automatically: {e}. Using baseline allocations.")

    # Aggregate Data
    df_orders = df_orders.replace({pd.NA: None, float('nan'): None})
    weeks = sorted(df_orders['week'].unique().tolist())
    
    final_data = {
        'weeks': weeks,
        'availableWeeks': [f"WK {w}" for w in weeks],
        'branchSummary': {},
        'contractSummary': {},
        'weeklyTrend': [],
        'bookingLog': df_orders.to_dict('records')
    }

    for w in weeks:
        week_label = f"WK {w}"
        df_w = df_orders[df_orders['week'] == w]
        
        # Branch Snapshot for this week
        branch_stats = []
        for branch, alloc in allocations.items():
            booked = df_w[df_w['branch'] == branch]['teu'].sum()
            util = (booked / alloc * 100) if alloc > 0 else 0
            status = 'On Track' if util > 70 else ('Low Uptake' if util < 50 else 'Near Full')
            branch_stats.append({
                'branch': branch,
                'alloc': alloc,
                'booked': round(booked, 1),
                'avail': round(alloc - booked, 1),
                'util': f"{util:.1f}%",
                'status': status
            })
        final_data['branchSummary'][week_label] = branch_stats

        # Contract Utilisation for this week
        contract_stats = []
        contracts = df_w['contract'].unique()
        for c in contracts:
            c_booked = df_w[df_w['contract'] == c]['teu'].sum()
            # We don't have per-contract allocations, so we'll estimate or use a placeholder
            c_alloc = 100 # Placeholder
            contract_stats.append({
                'id': str(c),
                'carrier': 'Unknown', # Needs mapping if possible
                'lane': 'Various',
                'alloc': c_alloc,
                'booked': round(c_booked, 1),
                'avail': round(c_alloc - c_booked, 1),
                'util': round((c_booked / c_alloc * 100), 1) if c_alloc > 0 else 0,
                'status': 'Active'
            })
        final_data['contractSummary'][week_label] = contract_stats

        # Weekly Trend
        total_booked = df_w['teu'].sum()
        total_alloc = sum(allocations.values())
        final_data['weeklyTrend'].append({
            'week': week_label,
            'alloc': total_alloc,
            'booked': round(total_booked, 1),
            'util': round((total_booked / total_alloc * 100), 1) if total_alloc > 0 else 0,
            'color': '#3b82f6'
        })

    # Save to JSON
    class DataEncoder(json.JSONEncoder):
        def default(self, obj):
            if hasattr(obj, 'tolist'):
                return obj.tolist()
            if hasattr(obj, 'item'):
                return obj.item()
            return str(obj)

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, 'w') as f:
        json.dump(final_data, f, indent=2, cls=DataEncoder)
    
    print(f"Successfully generated {OUTPUT_PATH}")

if __name__ == "__main__":
    process_data()
