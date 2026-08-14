import os

def replace_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    target = '''    # PORT_HIERARCHY generation — use World_Container_Ports.xlsx for accurate mapping
    port_file_path = os.path.join(ROOT_DIR, 'World_Container_Ports.xlsx')
    
    port_lookup = {}
    port_hierarchy = []
    
    try:
        print(f"Reading Port Codes from hardcoded file: {port_file_path}")
        df_ports = pd.read_excel(port_file_path)
        df_ports.columns = df_ports.columns.str.strip()
        for _, row in df_ports.iterrows():
            locode = str(row.get('UN/LOCODE', '')).strip().upper()
            if locode and locode != 'NAN':
                info = {
                    'code': locode,
                    'name': str(row.get('Port', locode)).strip().title(),
                    'country': str(row.get('Country', 'Unknown')).strip().title(),
                    'region': str(row.get('Region', 'Other')).strip().title(),
                    'lane': str(row.get('Tradelane', 'General')).strip().title()
                }
                port_lookup[locode] = info
                port_hierarchy.append(info)
        print(f"  Loaded {len(port_lookup)} port codes from listing.")
    except Exception as e:
        print(f"Warning: Could not process port code listing: {e}")'''

    replacement = '''    # PORT_HIERARCHY generation — use World_Container_Ports.xlsx for accurate mapping
    port_lookup = {}
    port_hierarchy = []
    
    # Try fetching from Azure first
    port_file_name = 'World_Container_Ports.xlsx'
    df_ports = None
    
    # Use get_static_file which already has Azure logic built-in and falls back to local
    port_listing_source = get_static_file(port_file_name, os.path.join(ROOT_DIR, port_file_name))
    
    if port_listing_source:
        try:
            print(f"Reading Port Codes from: {port_listing_source if isinstance(port_listing_source, str) else 'Azure Memory Stream'}")
            df_ports = pd.read_excel(port_listing_source)
            df_ports.columns = df_ports.columns.str.strip()
            for _, row in df_ports.iterrows():
                locode = str(row.get('UN/LOCODE', '')).strip().upper()
                if locode and locode != 'NAN':
                    info = {
                        'code': locode,
                        'name': str(row.get('Port', locode)).strip().title(),
                        'country': str(row.get('Country', 'Unknown')).strip().title(),
                        'region': str(row.get('Region', 'Other')).strip().title(),
                        'lane': str(row.get('Tradelane', 'General')).strip().title()
                    }
                    port_lookup[locode] = info
                    port_hierarchy.append(info)
            print(f"  Loaded {len(port_lookup)} port codes from listing.")
        except Exception as e:
            print(f"Warning: Could not process port code listing: {e}")'''

    if target in content:
        content = content.replace(target, replacement)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print('Updated ' + filepath)
    else:
        print('Target not found in ' + filepath)

replace_in_file('d:\\Dashboards\\process_dashboard_data.py')
