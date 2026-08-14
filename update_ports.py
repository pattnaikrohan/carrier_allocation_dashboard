import os

def replace_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    target = '''    # 3. Read Hardcoded Port Listing
    port_map = {}
    port_hierarchy = []
    try:
        import os
        repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        local_port_file = os.path.join(repo_root, 'World_Container_Ports.xlsx')
        log(f"Reading Port Codes from hardcoded file: {local_port_file}")
        df_ports = pd.read_excel(local_port_file)
        df_ports.columns = df_ports.columns.str.strip()
        for _, row in df_ports.iterrows():
            code = str(row.get('UN/LOCODE', '')).strip().upper()
            if code and code != 'NAN':
                info = {
                    'code': code,
                    'name': str(row.get('Port', code)).strip().title(),
                    'country': str(row.get('Country', 'Unknown')).strip().title(),
                    'region': str(row.get('Region', 'Other')).strip().title(),
                    'lane': str(row.get('Tradelane', 'General')).strip().title()
                }
                port_map[code] = info
                port_hierarchy.append(info)
    except Exception as e:
        log(f"Warning: Could not read hardcoded port listing file: {e}")'''

    replacement = '''    # 3. Fetch Port Listing
    port_map = {}
    port_hierarchy = []
    port_file_name = 'World_Container_Ports.xlsx'
    df_ports = None

    try:
        port_stream = _get_blob_file(container, port_file_name)
        log(f"Reading Port Codes from Azure: {port_file_name}")
        df_ports = pd.read_excel(port_stream)
    except Exception as e:
        log(f"Blob '{port_file_name}' not found in Azure or fetch failed. Falling back to local hardcoded file.")

    if df_ports is None:
        try:
            import os
            repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            local_port_file = os.path.join(repo_root, port_file_name)
            log(f"Reading Port Codes from hardcoded file: {local_port_file}")
            df_ports = pd.read_excel(local_port_file)
        except Exception as e:
            log(f"Warning: Could not read hardcoded port listing file: {e}")

    if df_ports is not None:
        try:
            df_ports.columns = df_ports.columns.str.strip()
            for _, row in df_ports.iterrows():
                code = str(row.get('UN/LOCODE', '')).strip().upper()
                if code and code != 'NAN':
                    info = {
                        'code': code,
                        'name': str(row.get('Port', code)).strip().title(),
                        'country': str(row.get('Country', 'Unknown')).strip().title(),
                        'region': str(row.get('Region', 'Other')).strip().title(),
                        'lane': str(row.get('Tradelane', 'General')).strip().title()
                    }
                    port_map[code] = info
                    port_hierarchy.append(info)
        except Exception as e:
            log(f"Warning: Error processing port listing data: {e}")'''

    if target in content:
        content = content.replace(target, replacement)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print('Updated ' + filepath)
    else:
        print('Target not found in ' + filepath)

replace_in_file('d:\\Dashboards\\backend\\data_processor.py')
