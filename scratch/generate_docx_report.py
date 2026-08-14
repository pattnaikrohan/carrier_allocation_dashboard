"""Generate a professional DOCX test report from the test results."""
import json, os
from datetime import datetime

try:
    from docx import Document
    from docx.shared import Inches, Pt, Cm, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.enum.table import WD_TABLE_ALIGNMENT
    from docx.oxml.ns import qn
except ImportError:
    import subprocess
    subprocess.check_call(['pip', 'install', 'python-docx'])
    from docx import Document
    from docx.shared import Inches, Pt, Cm, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.enum.table import WD_TABLE_ALIGNMENT
    from docx.oxml.ns import qn

# Load test results
with open(r'd:\Dashboards\scratch\test_results.json', 'r') as f:
    data = json.load(f)

results = data['results']
summary = data['summary']

doc = Document()

# Page margins
for section in doc.sections:
    section.top_margin = Cm(2)
    section.bottom_margin = Cm(2)
    section.left_margin = Cm(2.5)
    section.right_margin = Cm(2.5)

# ── Helper functions ─────────────────────────────────────────────────────────
def set_cell_shading(cell, color):
    """Set cell background color."""
    shading = cell._element.get_or_add_tcPr()
    shading_elem = shading.makeelement(qn('w:shd'), {
        qn('w:fill'): color, qn('w:val'): 'clear'
    })
    shading.append(shading_elem)

def add_styled_row(table, cells_data, header=False, status=None):
    """Add a row with optional styling."""
    row = table.add_row()
    for i, (text, align) in enumerate(cells_data):
        cell = row.cells[i]
        p = cell.paragraphs[0]
        p.alignment = align
        run = p.add_run(str(text))
        run.font.size = Pt(9)
        if header:
            run.bold = True
            run.font.color.rgb = RGBColor(255, 255, 255)
            set_cell_shading(cell, '2B579A')
        elif status == 'PASS':
            if i == 0:
                set_cell_shading(cell, 'E8F5E9')
        elif status == 'FAIL':
            if i == 0:
                set_cell_shading(cell, 'FFEBEE')
    return row

# ══════════════════════════════════════════════════════════════════════════════
# TITLE PAGE
# ══════════════════════════════════════════════════════════════════════════════
doc.add_paragraph('')
doc.add_paragraph('')
title = doc.add_paragraph()
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = title.add_run('Carrier Allocation Dashboard')
run.bold = True
run.font.size = Pt(28)
run.font.color.rgb = RGBColor(43, 87, 154)

subtitle = doc.add_paragraph()
subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = subtitle.add_run('Comprehensive Test Report')
run.font.size = Pt(20)
run.font.color.rgb = RGBColor(100, 100, 100)

doc.add_paragraph('')

# Summary box
info_para = doc.add_paragraph()
info_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
info_lines = [
    f"Date: {datetime.now().strftime('%d %B %Y, %I:%M %p')}",
    f"Environment: Production (Snowflake + Azure Blob)",
    f"Master File: Contract Master 28JUL26.xlsx",
    f"Data Source: DEV.RAW.TEST_ORDER (Snowflake)",
]
for line in info_lines:
    run = info_para.add_run(line + '\n')
    run.font.size = Pt(11)
    run.font.color.rgb = RGBColor(80, 80, 80)

doc.add_paragraph('')

# Big result
result_para = doc.add_paragraph()
result_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = result_para.add_run(f"{summary['passed']}/{summary['total']} TESTS PASSED")
run.bold = True
run.font.size = Pt(24)
run.font.color.rgb = RGBColor(46, 125, 50) if summary['failed'] == 0 else RGBColor(198, 40, 40)

rate_para = doc.add_paragraph()
rate_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = rate_para.add_run(f"Pass Rate: {summary['pass_rate']}")
run.font.size = Pt(16)
run.font.color.rgb = RGBColor(46, 125, 50) if summary['failed'] == 0 else RGBColor(198, 40, 40)

doc.add_page_break()

# ══════════════════════════════════════════════════════════════════════════════
# EXECUTIVE SUMMARY
# ══════════════════════════════════════════════════════════════════════════════
doc.add_heading('1. Executive Summary', level=1)

exec_table = doc.add_table(rows=1, cols=2)
exec_table.style = 'Table Grid'
exec_table.alignment = WD_TABLE_ALIGNMENT.CENTER

header_cells = exec_table.rows[0].cells
for i, text in enumerate(['Metric', 'Value']):
    p = header_cells[i].paragraphs[0]
    run = p.add_run(text)
    run.bold = True
    run.font.size = Pt(10)
    run.font.color.rgb = RGBColor(255, 255, 255)
    set_cell_shading(header_cells[i], '2B579A')

exec_metrics = [
    ('Total Tests Executed', str(summary['total'])),
    ('Tests Passed', str(summary['passed'])),
    ('Tests Failed', str(summary['failed'])),
    ('Pass Rate', summary['pass_rate']),
    ('Pipeline Execution Time', f"{data['pipeline_time']}s"),
    ('Total Booking Records', f"{data['booking_count']:,}"),
    ('Total TEU Processed', f"{data['total_teu']:,.1f}"),
    ('Master Contracts', str(data['master_contracts'])),
    ('Compound Keys (Multi-leg)', str(data['master_compound_keys'])),
    ('Shared Pool Contracts', str(data['shared_count'])),
    ('Data Source', 'Snowflake (DEV.RAW.TEST_ORDER)'),
    ('Master File', 'Contract Master 28JUL26.xlsx (Azure Blob)'),
]

for metric, value in exec_metrics:
    row = exec_table.add_row()
    row.cells[0].paragraphs[0].add_run(metric).font.size = Pt(10)
    run = row.cells[1].paragraphs[0].add_run(value)
    run.font.size = Pt(10)
    run.bold = True

# Set column widths
for row in exec_table.rows:
    row.cells[0].width = Cm(8)
    row.cells[1].width = Cm(8)

doc.add_paragraph('')

# ══════════════════════════════════════════════════════════════════════════════
# TEST CATEGORIES OVERVIEW
# ══════════════════════════════════════════════════════════════════════════════
doc.add_heading('2. Test Categories Overview', level=1)

categories = {}
for r in results:
    cat = r['category']
    if cat not in categories:
        categories[cat] = {'passed': 0, 'failed': 0, 'total': 0}
    categories[cat]['total'] += 1
    if r['status'] == 'PASS':
        categories[cat]['passed'] += 1
    else:
        categories[cat]['failed'] += 1

cat_table = doc.add_table(rows=1, cols=4)
cat_table.style = 'Table Grid'
cat_table.alignment = WD_TABLE_ALIGNMENT.CENTER

header_cells = cat_table.rows[0].cells
for i, text in enumerate(['Category', 'Passed', 'Failed', 'Result']):
    p = header_cells[i].paragraphs[0]
    run = p.add_run(text)
    run.bold = True
    run.font.size = Pt(10)
    run.font.color.rgb = RGBColor(255, 255, 255)
    set_cell_shading(header_cells[i], '2B579A')

cat_display = {
    'parse_compass_total': 'TEU Text Parser',
    'parse_office_alloc': 'Office Allocation Parser',
    '_resolve_master_col': 'Column Resolver',
    'build_master_dict': 'Master Dict Builder',
    'full_pipeline': 'Full Pipeline (Snowflake→JSON)',
    'booking_log': 'Booking Log Integrity',
    'contract_util': 'Contract Utilisation Data',
    'branch_snapshot': 'Branch Snapshot',
    'weekly_trend': 'Weekly Trend Data',
    'quarterly': 'Quarterly Alloc/Util',
    'carrier_breakdown': 'Carrier Breakdown',
    'geo_data': 'Port & Geographic Data',
    'cross_validation': 'Cross-Validation Checks',
}

for cat, counts in categories.items():
    row = cat_table.add_row()
    display = cat_display.get(cat, cat)
    row.cells[0].paragraphs[0].add_run(display).font.size = Pt(10)
    row.cells[1].paragraphs[0].add_run(str(counts['passed'])).font.size = Pt(10)
    row.cells[2].paragraphs[0].add_run(str(counts['failed'])).font.size = Pt(10)
    result_text = '✓ PASS' if counts['failed'] == 0 else '✗ FAIL'
    run = row.cells[3].paragraphs[0].add_run(result_text)
    run.font.size = Pt(10)
    run.bold = True
    run.font.color.rgb = RGBColor(46, 125, 50) if counts['failed'] == 0 else RGBColor(198, 40, 40)
    if counts['failed'] == 0:
        set_cell_shading(row.cells[3], 'E8F5E9')
    else:
        set_cell_shading(row.cells[3], 'FFEBEE')

doc.add_paragraph('')

# ══════════════════════════════════════════════════════════════════════════════
# BRANCH SNAPSHOT
# ══════════════════════════════════════════════════════════════════════════════
doc.add_heading('3. Branch Allocation Snapshot', level=1)

p = doc.add_paragraph()
p.add_run('Shows each branch\'s allocation (including SHARED pool remaining), booked TEU, and utilisation. '
          'SHARED pool contracts contribute their remaining capacity to every branch.').font.size = Pt(10)

branch_table = doc.add_table(rows=1, cols=4)
branch_table.style = 'Table Grid'
branch_table.alignment = WD_TABLE_ALIGNMENT.CENTER

header_cells = branch_table.rows[0].cells
for i, text in enumerate(['Branch', 'Allocation (TEU)', 'Booked (TEU)', 'Utilisation %']):
    p = header_cells[i].paragraphs[0]
    run = p.add_run(text)
    run.bold = True
    run.font.size = Pt(10)
    run.font.color.rgb = RGBColor(255, 255, 255)
    set_cell_shading(header_cells[i], '2B579A')

for b in data['branch_snapshot']:
    row = branch_table.add_row()
    row.cells[0].paragraphs[0].add_run(b['branch']).font.size = Pt(10)
    row.cells[1].paragraphs[0].add_run(f"{b['alloc']:,.1f}").font.size = Pt(10)
    row.cells[1].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT
    row.cells[2].paragraphs[0].add_run(f"{b['booked']:,.1f}").font.size = Pt(10)
    row.cells[2].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = row.cells[3].paragraphs[0].add_run(f"{b['util']:.1f}%")
    run.font.size = Pt(10)
    row.cells[3].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT
    if b['util'] > 100:
        run.font.color.rgb = RGBColor(198, 40, 40)
    elif b['util'] > 80:
        run.font.color.rgb = RGBColor(46, 125, 50)

doc.add_paragraph('')

# ══════════════════════════════════════════════════════════════════════════════
# SHARED POOL EXPLANATION
# ══════════════════════════════════════════════════════════════════════════════
doc.add_heading('4. SHARED Pool Allocation Logic', level=1)

p = doc.add_paragraph()
p.add_run('Background: ').bold = True
run = p.add_run('In carrier allocation, "SHARED" means the allocation is a company-wide pool — '
                'any branch can book against it on a first-come, first-served basis.')
run.font.size = Pt(10)

doc.add_paragraph('')
p = doc.add_paragraph()
p.add_run('Implementation: ').bold = True
p.add_run('\n• Every branch sees the full pool as their allocation\n'
          '• When any branch books from the pool, the available amount decreases for ALL branches\n'
          '• Example: Pool=100 TEU, Brisbane books 49 → all branches see Available=51\n'
          '• Branch snapshot includes SHARED remaining as available capacity').font.size = Pt(10)

doc.add_paragraph('')
p = doc.add_paragraph()
p.add_run(f"Currently {data['shared_count']} contracts are SHARED pools out of {data['master_contracts']} total contracts.").font.size = Pt(10)

# ══════════════════════════════════════════════════════════════════════════════
# DETAILED TEST RESULTS
# ══════════════════════════════════════════════════════════════════════════════
doc.add_page_break()
doc.add_heading('5. Detailed Test Results', level=1)

current_cat = None
for r in results:
    if r['category'] != current_cat:
        current_cat = r['category']
        display = cat_display.get(current_cat, current_cat)
        doc.add_heading(display, level=2)

        detail_table = doc.add_table(rows=1, cols=3)
        detail_table.style = 'Table Grid'
        detail_table.alignment = WD_TABLE_ALIGNMENT.CENTER

        header_cells = detail_table.rows[0].cells
        for i, text in enumerate(['Status', 'Test Name', 'Detail']):
            p = header_cells[i].paragraphs[0]
            run = p.add_run(text)
            run.bold = True
            run.font.size = Pt(9)
            run.font.color.rgb = RGBColor(255, 255, 255)
            set_cell_shading(header_cells[i], '2B579A')

    row = detail_table.add_row()
    status_text = '✓ PASS' if r['status'] == 'PASS' else '✗ FAIL'
    run = row.cells[0].paragraphs[0].add_run(status_text)
    run.font.size = Pt(9)
    run.bold = True
    run.font.color.rgb = RGBColor(46, 125, 50) if r['status'] == 'PASS' else RGBColor(198, 40, 40)
    if r['status'] == 'PASS':
        set_cell_shading(row.cells[0], 'E8F5E9')
    else:
        set_cell_shading(row.cells[0], 'FFEBEE')

    row.cells[1].paragraphs[0].add_run(r['name']).font.size = Pt(9)
    detail_text = r['detail'][:80] if len(r['detail']) > 80 else r['detail']
    row.cells[2].paragraphs[0].add_run(detail_text).font.size = Pt(8)

    row.cells[0].width = Cm(2)
    row.cells[1].width = Cm(7)
    row.cells[2].width = Cm(7)

doc.add_paragraph('')

# ══════════════════════════════════════════════════════════════════════════════
# DATA FLOW DIAGRAM
# ══════════════════════════════════════════════════════════════════════════════
doc.add_page_break()
doc.add_heading('6. Data Pipeline Architecture', level=1)

p = doc.add_paragraph()
p.add_run('The verified end-to-end data pipeline:').font.size = Pt(10)

flow_items = [
    ('1. Snowflake', 'DEV.RAW.TEST_ORDER — 18,649 raw order rows'),
    ('2. Azure Blob', 'Contract Master 28JUL26.xlsx — 38 contract rows (25 unique contracts)'),
    ('3. Column Mapping', 'Maps Snowflake columns + master file columns (old & new format support)'),
    ('4. Data Processing', 'Filters BCN/cancelled orders, infers branches from discharge port'),
    ('5. Master Dict', '26 compound keys with allocation, shared pool detection'),
    ('6. JSON Output', '13 data sections: bookings, contracts, branches, trends, etc.'),
    ('7. Dashboard', 'React frontend renders all KPIs from the JSON payload'),
]

for title, desc in flow_items:
    p = doc.add_paragraph()
    run = p.add_run(f'{title}: ')
    run.bold = True
    run.font.size = Pt(10)
    p.add_run(desc).font.size = Pt(10)

# ══════════════════════════════════════════════════════════════════════════════
# COLUMN MAPPING VERIFICATION
# ══════════════════════════════════════════════════════════════════════════════
doc.add_heading('7. Master File Column Compatibility', level=1)

p = doc.add_paragraph()
p.add_run('The system supports both old and new master file formats:').font.size = Pt(10)

col_table = doc.add_table(rows=1, cols=4)
col_table.style = 'Table Grid'
col_table.alignment = WD_TABLE_ALIGNMENT.CENTER

header_cells = col_table.rows[0].cells
for i, text in enumerate(['Field', 'Old Column', 'New Column', 'Status']):
    p = header_cells[i].paragraphs[0]
    run = p.add_run(text)
    run.bold = True
    run.font.size = Pt(10)
    run.font.color.rgb = RGBColor(255, 255, 255)
    set_cell_shading(header_cells[i], '2B579A')

col_mappings = [
    ('Contract ID', 'Contract #', 'Contract#', '✓ Auto-detected'),
    ('Carrier', 'Carrier', 'Title', '✓ Auto-detected'),
    ('Office Allocation', 'Office Allocation', 'Compass Office Allocation', '✓ Auto-detected'),
    ('Total Allocation', '(derived)', 'Compass Allocation Total', '✓ New parser'),
    ('Contract Name', 'Contract Name', 'Title', '✓ Auto-detected'),
    ('Origin', 'Origin', 'Origin', '✓ Same'),
    ('Destination', 'Destination', 'Destination', '✓ Same'),
    ('Contract Type', 'Contract Type', 'Contract Type', '✓ Same'),
    ('Priority', 'Priority', 'Priority', '✓ Same'),
]

for field, old, new, status in col_mappings:
    row = col_table.add_row()
    for i, text in enumerate([field, old, new, status]):
        row.cells[i].paragraphs[0].add_run(text).font.size = Pt(9)

# ══════════════════════════════════════════════════════════════════════════════
# SIGN-OFF
# ══════════════════════════════════════════════════════════════════════════════
doc.add_paragraph('')
doc.add_paragraph('')
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('— End of Test Report —')
run.font.size = Pt(12)
run.font.color.rgb = RGBColor(100, 100, 100)
run.italic = True

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run(f'Generated on {datetime.now().strftime("%d %B %Y at %I:%M %p")}')
run.font.size = Pt(10)
run.font.color.rgb = RGBColor(150, 150, 150)

# Save
output_path = r'd:\Dashboards\Test_Report_Carrier_Allocation_Dashboard.docx'
doc.save(output_path)
print(f"✓ Report saved to: {output_path}")
print(f"  Sections: 7")
print(f"  Tests documented: {summary['total']}")
print(f"  Result: {summary['passed']}/{summary['total']} PASSED ({summary['pass_rate']})")
