import sys
with open(r'D:\Dashboards\frontend\src\pages\ContractDashboard.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Remove duplicate availableContracts at line 11
text = text.replace("const availableContracts = ['ALL', ...Array.from(new Set(BOOKING_LOG_DATA.map(b => b.contract)))].sort();\n\nconst totalAlloc", 'const totalAlloc', 1)

# 2. Fix the missing replace for row.id and row.lane
text = text.replace('>{row.contract}</span>', '>{row.id}</span>')
text = text.replace('/> {row.region}', '/> {row.lane}')

# 3. Fix branch code remove
text = text.replace('<span className="text-[10px] font-mono text-slate-500">{row.code}</span>', '')
text = text.replace('<span className=\'text-[10px] font-mono text-slate-500\'>{row.code}</span>', '')

# 4. Fix util parseFloat string matching
text = text.replace("{row.util > 90 ? 'text-", "{parseFloat(str(row.util)) > 90 ? 'text-")
text = text.replace("{row.util > 90", "{parseFloat(row.util as string) > 90")
text = text.replace('Math.min(row.util, 100)', 'Math.min(parseFloat(row.util as string), 100)')

# 5. Fix mscWeek in trend mapping and filter
text = text.replace('row.mscWeek} className="hover:bg-white/[0.02]', 'row.week} className="hover:bg-white/[0.02]')
text = text.replace('>{row.mscWeek}</td>', '>{row.week}</td>')
text = text.replace('{row.mscWeek}\\n', '{row.week}\\n')
text = text.replace('>{row.mscWeek}</div>', '>{row.week}</div>')

with open(r'D:\Dashboards\frontend\src\pages\ContractDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print('Patched successfully!')
