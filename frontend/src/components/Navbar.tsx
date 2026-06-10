import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import compassLogo from '../assets/compass_logo_final.svg';
import aawLogo from '../assets/aaw.png';

interface HierarchyNode {
  label: string;
  children?: HierarchyNode[];
}

interface NavbarProps {
  showBack?: boolean;
  selectedWeek?: string;
  onWeekChange?: (week: string) => void;
  selectedContract?: string;
  onContractChange?: (contract: string) => void;
  selectedOrigin?: string;
  onOriginChange?: (origin: string) => void;
  selectedDestination?: string;
  onDestinationChange?: (dest: string) => void;
  selectedBranch?: string;
  onBranchChange?: (val: string) => void;
  selectedCarrier?: string;
  onCarrierChange?: (val: string) => void;
  formatContractLabel?: (val: string) => string;
  availableCarriers?: string[];
  isSyncing?: boolean;
  availableWeeks?: string[];
  availableContracts?: string[];
  availableOrigins?: (string | HierarchyNode)[];
  availableDestinations?: (string | HierarchyNode)[];
  availableBranches?: string[];
  onSync?: () => void;
}

// Branch list – FRE replaces PER; PIL, PRJ, AKL, OTH are new
const ALL_BRANCHES = ['ALL', 'SYD', 'MEL', 'BNE', 'FRE', 'ADL', 'PIL', 'PRJ', 'AKL', 'OTH'];

const Navbar: React.FC<NavbarProps> = ({
  showBack = false,
  selectedWeek = 'ALL',
  onWeekChange,
  selectedContract = 'ALL',
  onContractChange,
  selectedOrigin = 'ALL',
  onOriginChange,
  selectedDestination = 'ALL',
  onDestinationChange,
  selectedBranch = 'ALL',
  onBranchChange,
  selectedCarrier = 'ALL',
  onCarrierChange,
  isSyncing,
  onSync,
  availableWeeks = [],
  availableContracts = [],
  availableOrigins = [],
  availableDestinations = [],
  availableBranches = ALL_BRANCHES,
  availableCarriers = ['ALL', 'Maersk', 'MSC', 'OOCL', 'PIL', 'MGF'],
  formatContractLabel,
}) => {
  const navigate = useNavigate();
  // Individual Menu States
  const [openMenu, setOpenMenu] = useState<string | null>(null);


  // Dynamic Week Hierarchy Construction
  const weekHierarchy: HierarchyNode[] = (() => {
    // 1. Reset / All
    const allNode: HierarchyNode = {
      label: 'ALL',
      children: [
        {
          label: 'CLEAR SELECTION',
          children: [
            { label: 'ALL' }
          ]
        }
      ]
    };

    // 2. Quarters
    const quarters: HierarchyNode[] = [];
    // 3. Months
    const months: HierarchyNode[] = [];

    // Grouping individual weeks by month
    const monthWeeks: Record<string, HierarchyNode[]> = {
      JANUARY: [], FEBRUARY: [], MARCH: [], APRIL: [],
      MAY: [], JUNE: [], JULY: [], AUGUST: [],
      SEPTEMBER: [], OCTOBER: [], NOVEMBER: [], DECEMBER: []
    };
    const otherWeeks: HierarchyNode[] = [];

    availableWeeks.forEach(w => {
      if (w.startsWith('Quarter:')) {
        quarters.push({
          label: w.replace('Quarter: ', '').toUpperCase(),
          children: [{ label: w }]
        });
      } else if (w.startsWith('Month:')) {
        const monthName = w.replace('Month: ', '').trim();
        months.push({
          label: monthName.toUpperCase(),
          children: [{ label: w }]
        });
      } else if (w.toLowerCase().startsWith('wk')) {
        const match = w.match(/wk\s*(\d+)/i);
        if (match) {
          const wNum = parseInt(match[1], 10);
          const weekNode = { label: w };
          if (wNum >= 1 && wNum <= 4) monthWeeks.JANUARY.push(weekNode);
          else if (wNum >= 5 && wNum <= 8) monthWeeks.FEBRUARY.push(weekNode);
          else if (wNum >= 9 && wNum <= 13) monthWeeks.MARCH.push(weekNode);
          else if (wNum >= 14 && wNum <= 17) monthWeeks.APRIL.push(weekNode);
          else if (wNum >= 18 && wNum <= 22) monthWeeks.MAY.push(weekNode);
          else if (wNum >= 23 && wNum <= 26) monthWeeks.JUNE.push(weekNode);
          else if (wNum >= 27 && wNum <= 30) monthWeeks.JULY.push(weekNode);
          else if (wNum >= 31 && wNum <= 35) monthWeeks.AUGUST.push(weekNode);
          else if (wNum >= 36 && wNum <= 39) monthWeeks.SEPTEMBER.push(weekNode);
          else if (wNum >= 40 && wNum <= 43) monthWeeks.OCTOBER.push(weekNode);
          else if (wNum >= 44 && wNum <= 47) monthWeeks.NOVEMBER.push(weekNode);
          else if (wNum >= 48 && wNum <= 53) monthWeeks.DECEMBER.push(weekNode);
          else otherWeeks.push(weekNode);
        } else {
          otherWeeks.push({ label: w });
        }
      }
    });

    const weeksChildren: HierarchyNode[] = [];
    Object.entries(monthWeeks).forEach(([month, weeks]) => {
      if (weeks.length > 0) {
        weeksChildren.push({ label: `${month} WEEKS`, children: weeks });
      }
    });
    if (otherWeeks.length > 0) weeksChildren.push({ label: 'OTHER WEEKS', children: otherWeeks });

    const hierarchy: HierarchyNode[] = [allNode];

    if (quarters.length > 0) {
      hierarchy.push({
        label: 'QUARTERS',
        children: quarters
      });
    }

    if (months.length > 0) {
      hierarchy.push({
        label: 'MONTHS',
        children: months
      });
    }

    if (weeksChildren.length > 0) {
      hierarchy.push({
        label: 'WEEKS',
        children: weeksChildren
      });
    }

    return hierarchy;
  })();

  const filters = [
    {
      label: 'Week',
      val: selectedWeek,
      items: weekHierarchy,
      onSelect: onWeekChange,
      color: 'emerald',
      isHierarchical: true,
      columnLabels: ['Category', 'Sub-Group', 'Timeframe'],
      placeholder: 'Refine Timeframe...'
    },
    { label: 'Contract', val: selectedContract, items: availableContracts, onSelect: onContractChange, color: 'cyan', hasSearch: true, formatLabel: formatContractLabel },
    {
      label: 'Origin',
      val: selectedOrigin,
      items: availableOrigins,
      onSelect: onOriginChange,
      color: 'indigo',
      isHierarchical: true,
      columnLabels: ['Region', 'Country', 'Tradelane', 'Port'],
      placeholder: 'Refine Origin Network...'
    },
    {
      label: 'Dest.',
      val: selectedDestination,
      items: availableDestinations,
      onSelect: onDestinationChange,
      color: 'amber',
      isHierarchical: true,
      columnLabels: ['Region', 'Country', 'Tradelane', 'Port'],
      placeholder: 'Refine Destination Network...'
    },
    { label: 'Branch', val: selectedBranch, items: availableBranches, onSelect: onBranchChange, color: 'sky' },
    { label: 'Carrier', val: selectedCarrier, items: availableCarriers, onSelect: onCarrierChange, color: 'violet' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-[60] flex justify-center pt-6 pointer-events-none">
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[1780px] mx-auto px-4 md:px-6 pointer-events-auto"
      >
        <div className="flex items-center justify-between bg-gradient-to-r from-sky-200/90 via-blue-200/85 to-indigo-200/85 dark:bg-slate-900/70 backdrop-blur-xl rounded-[24px] border border-sky-300/50 dark:border-slate-800 shadow-xl px-3 md:px-5 py-2 min-h-[72px] gap-2 md:gap-4 w-full relative overflow-hidden md:overflow-visible">

          {/* Left Segment: Compass Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <img src={compassLogo} alt="Compass" className="h-16 md:h-24 w-auto object-contain dark:brightness-125 dark:invert" />
          </div>

          {/* Center Segment: Interactive Filter Pill */}
          <div className="flex items-center gap-1 p-1 bg-slate-100/50 dark:bg-slate-950/40 border border-slate-200/30 dark:border-slate-800/40 rounded-[20px] overflow-visible flex-1 justify-center min-w-0">
            {filters.map((f, i) => (
              <div key={f.label} className={`${f.isHierarchical ? '' : 'relative'} overflow-visible flex-1 min-w-0 max-w-[140px]`} style={{ zIndex: openMenu === f.label ? 40 : 20 - i }}>
                <button
                  onClick={() => setOpenMenu(openMenu === f.label ? null : f.label)}
                  className={`flex items-center justify-between gap-1 md:gap-2 px-2 md:px-3 h-[40px] rounded-[14px] border transition-all duration-500 relative group w-full ${openMenu === f.label
                    ? `bg-${f.color}-500/10 dark:bg-${f.color}-500/15 border-${f.color}-500/30 dark:border-${f.color}-500/40 text-${f.color}-600 dark:text-${f.color}-300 ring-1 ring-${f.color}-500/10 dark:ring-${f.color}-500/20`
                    : f.val !== 'ALL'
                      ? 'bg-slate-100 dark:bg-white/[0.06] border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white hover:bg-slate-200 dark:hover:bg-white/[0.1] shadow-inner'
                      : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/[0.1] hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                    }`}
                >
                  <div className="flex flex-col items-start min-w-0 pr-0.5 flex-1">
                    <span className={`text-[7px] md:text-[7.5px] font-black uppercase tracking-[0.1em] md:tracking-[0.15em] mb-0.5 transition-colors ${openMenu === f.label || f.val !== 'ALL' ? 'text-slate-500 dark:text-white/60' : 'text-slate-400 dark:text-slate-500'} truncate w-full text-left`}>{f.label}</span>
                    <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider md:tracking-widest truncate w-full text-left antialiased">{f.val === 'ALL' ? 'Select' : f.val}</span>
                  </div>
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-colors shrink-0 hidden md:flex ${openMenu === f.label ? `bg-${f.color}-500/20 text-${f.color}-600 dark:text-${f.color}-300` : 'bg-slate-200/50 dark:bg-white/5 text-slate-500 dark:text-slate-300'}`}>
                    <svg className={`w-2 h-2 transition-transform duration-300 ${openMenu === f.label ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </button>

                <AnimatePresence>
                  {openMenu === f.label && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        className={`absolute bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[24px] p-2 z-50 shadow-2xl ${f.isHierarchical
                          ? f.label === 'Origin' || f.label === 'Week'
                            ? 'top-[60px] left-0 origin-top-left min-w-[720px]'
                            : 'top-[60px] right-0 origin-top-right min-w-[720px]'
                          : 'top-[44px] left-1/2 -translate-x-1/2 origin-top min-w-[220px]'
                          }`}
                      >
                        {f.isHierarchical ? (
                          <HierarchicalSelect
                            data={f.items as HierarchyNode[]}
                            selected={f.val}
                            onSelect={(val) => {
                              const cleanVal = val === 'CLEAR FILTER' ? 'ALL' : val;
                              f.onSelect?.(cleanVal);
                              setOpenMenu(null);
                            }}
                            accentColor={f.color}
                            columnLabels={f.columnLabels}
                            placeholder={f.placeholder}
                          />
                        ) : (
                          <FilterSelect
                            items={f.items as string[]}
                            selected={f.val}
                            onSelect={(val) => { f.onSelect?.(val); setOpenMenu(null); }}
                            accentColor={f.color}
                            hasSearch={f.hasSearch}
                            height="350px"
                            formatLabel={(f as any).formatLabel}
                          />
                        )}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>

          {/* Right Segment: Actions & AAW Group Logo */}
          <div className="flex items-center gap-2 md:gap-4 shrink-0 overflow-visible">
            {/* Commands Segment */}
            <div className="flex items-center bg-slate-100 dark:bg-[#0b0f19] p-0.5 rounded-lg border border-slate-200 dark:border-white/10 shrink-0 shadow-inner mr-2">
              <button
                onClick={() => {
                  onContractChange?.('ALL'); onWeekChange?.('ALL'); onOriginChange?.('ALL'); onDestinationChange?.('ALL');
                  onBranchChange?.('ALL'); onCarrierChange?.('ALL');
                }}
                className="flex items-center gap-1.5 px-2.5 h-7 rounded-md transition-all text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 group/reset"
                title="Reset All Filters"
              >
                <svg className="w-3 h-3 transition-transform group-hover/reset:-rotate-90 duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                Reset
              </button>
              {onSync && (
                <>
                  <div className="w-[1px] h-3.5 bg-slate-300 dark:bg-slate-700/50 mx-0.5" />
                  <button
                    onClick={onSync}
                    disabled={isSyncing}
                    className={`flex items-center gap-1.5 px-2.5 h-7 rounded-md transition-all text-[10px] font-bold uppercase tracking-widest ${isSyncing
                        ? 'bg-blue-500/20 text-blue-400 cursor-wait'
                        : 'text-slate-500 dark:text-slate-400 hover:text-white hover:bg-blue-500/20 hover:text-blue-400'
                      }`}
                    title="Force Live Data Sync"
                  >
                    <svg className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Sync
                  </button>
                </>
              )}
            </div>

            <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-800 shrink-0 mr-1 md:mr-2" />
            <img src={aawLogo} alt="AAW Group" className="h-8 md:h-10 w-auto invert dark:invert-0 dark:opacity-90 dark:brightness-125 shrink-0 object-contain" />
          </div>

        </div>
      </motion.nav>
    </header>
  );
};

const HierarchicalSelect: React.FC<{
  data: HierarchyNode[];
  selected: string;
  onSelect: (val: string) => void;
  accentColor: string;
  columnLabels?: string[];
  placeholder?: string;
}> = ({ data, selected, onSelect, accentColor, columnLabels = ['Region', 'Country', 'Port'], placeholder = "Refine..." }) => {
  const [activePath, setActivePath] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  // Auto-resolve active path from selected item on open
  React.useEffect(() => {
    if (!selected || selected === 'ALL') {
      setActivePath([]);
      return;
    }
    const findPath = (nodes: HierarchyNode[], target: string, path: string[]): string[] | null => {
      for (const node of nodes) {
        if (node.label === target) {
          return path;
        }
        if (node.children) {
          const res = findPath(node.children, target, [...path, node.label]);
          if (res) return res;
        }
      }
      return null;
    };
    const resolved = findPath(data, selected, []);
    if (resolved) {
      setActivePath(resolved);
    }
  }, [selected, data]);

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'indigo': return { active: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', dot: 'bg-indigo-400' };
      case 'amber': return { active: 'bg-amber-500/10 text-amber-400 border-amber-500/20', dot: 'bg-amber-400' };
      case 'emerald': return { active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-400' };
      default: return { active: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', dot: 'bg-cyan-400' };
    }
  };
  const colors = getColorClasses(accentColor);

  const getNodesAtLevel = (level: number) => {
    if (level === 0) {
      const clearNode: HierarchyNode = { label: 'CLEAR FILTER' };
      const filtered = data.filter(n => n.label.toLowerCase().includes(search.toLowerCase()) || (n.children && n.children.some(c => c.label.toLowerCase().includes(search.toLowerCase()))));
      return [clearNode, ...filtered.filter(n => n.label !== 'ALL' && n.label !== 'CLEAR FILTER')];
    }
    let current = data;
    for (let i = 0; i < level; i++) {
      const found = current.find(n => n.label === activePath[i]);
      if (!found || !found.children) return [];
      current = found.children;
    }
    return current;
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Universal Search */}
      <div className="px-3 pt-1 pb-2 border-b border-slate-200 dark:border-slate-800">
        <input
          type="text"
          autoFocus
          placeholder={placeholder}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-[10px] font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/30 transition-all"
        />
      </div>

      <div className="flex flex-row items-stretch divide-x divide-white/10 h-[400px]">
        {columnLabels.map((label, level) => {
          const nodes = getNodesAtLevel(level);
          const labels = columnLabels;

          return (
            <div key={level} className="flex-1 min-w-[140px] flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900">
              <div className="px-4 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-slate-700 mb-2">
                {labels[level]}
              </div>
              <div className="flex-1 overflow-y-auto elegant-scrollbar px-2 pb-4">
                {nodes.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[10px] text-slate-600 font-bold uppercase tracking-widest italic">
                    Select {labels[level - 1]}
                  </div>
                ) : (
                  nodes.map((node) => {
                    const hasChildren = node.children && node.children.length > 0;
                    const isActive = activePath[level] === node.label;
                    const isSelected = selected === node.label || (node.label === 'CLEAR FILTER' && (selected === 'ALL' || !selected));

                    return (
                      <button
                        key={node.label}
                        onMouseEnter={() => {
                          if (hasChildren) {
                            setActivePath([...activePath.slice(0, level), node.label]);
                          } else {
                            setActivePath(activePath.slice(0, level));
                          }
                        }}
                        onClick={() => onSelect(node.label)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-[10.5px] font-black uppercase tracking-widest transition-all mb-0.5 flex items-center justify-between group/item ${isSelected ? colors.active :
                          isActive ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white shadow-md' :
                            'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                          }`}
                      >
                        <span className="truncate">{node.label === 'ALL' ? 'Select All' : node.label}</span>
                        {hasChildren && (
                          <svg className={`w-3 h-3 transition-transform duration-300 ${isActive ? 'translate-x-0.5 text-slate-900 dark:text-white' : 'text-slate-400 group-hover/item:text-slate-600 dark:text-slate-500 dark:group-hover/item:text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                        {isSelected && !hasChildren && (
                          <div className={`w-1 h-1 rounded-full ${colors.dot} shadow-[0_0_8px_currentColor]`} />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Selection list component used inside each individual overlay
const FilterSelect: React.FC<{
  items: string[];
  selected: string;
  onSelect?: (val: string) => void;
  accentColor: string;
  hasSearch?: boolean;
  height?: string;
  formatLabel?: (val: string) => string;
}> = ({ items, selected, onSelect, accentColor, hasSearch, height = "auto", formatLabel }) => {
  const [search, setSearch] = useState('');
  const filteredItems = items.filter(i => i.toLowerCase().includes(search.toLowerCase()));

  // ✅ SAFE Tailwind mapping (NO dynamic classes)
  const getColorClasses = () => {
    switch (accentColor) {
      case 'cyan':
        return {
          active: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
          dot: 'bg-cyan-400',
          shadow: '0 0 15px rgba(6,182,212,0.1)'
        };
      case 'purple':
      case 'violet':
        return {
          active: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
          dot: 'bg-purple-400',
          shadow: '0 0 15px rgba(168,85,247,0.1)'
        };
      case 'emerald':
        return {
          active: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
          dot: 'bg-emerald-400',
          shadow: '0 0 15px rgba(16,185,129,0.1)'
        };
      case 'amber':
        return {
          active: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
          dot: 'bg-amber-400',
          shadow: '0 0 15px rgba(245,158,11,0.1)'
        };
      default:
        return {
          active: 'bg-slate-500/10 text-slate-800 dark:text-slate-300 border border-slate-500/20',
          dot: 'bg-slate-400',
          shadow: '0 0 15px rgba(148,163,184,0.1)'
        };
    }
  };

  const colors = getColorClasses();

  return (
    <div className="flex flex-col gap-2">
      {hasSearch && (
        <div className="px-2 pb-1 border-b border-slate-200 dark:border-slate-800 mb-1 mt-1">
          <input
            type="text"
            autoFocus
            placeholder="Refine..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-[10px] font-mono text-white placeholder:text-slate-800 dark:text-slate-300 focus:outline-none focus:border-cyan-500/30 transition-all"
          />
        </div>
      )}

      <div className="overflow-y-auto elegant-scrollbar pr-1 mt-1.5" style={{ maxHeight: height }}>
        {filteredItems.map((item, idx) => (
          <button
            key={item + idx}
            onClick={() => onSelect?.(item)}
            className={`w-full text-left px-3 py-2 rounded-lg text-[10.5px] font-black uppercase tracking-widest transition-all mb-0.5 flex items-center justify-between ${selected === item
              ? colors.active
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
              }`}
            style={
              selected === item
                ? { boxShadow: colors.shadow }
                : undefined
            }
          >
            <span className="truncate">
              {item === 'ALL' 
                ? (selected !== 'ALL' && selected ? 'CLEAR' : 'PLEASE SELECT') 
                : (formatLabel ? formatLabel(item) : item)}
            </span>
            {selected === item && (
              <div className={`w-1 h-1 rounded-full ${colors.dot} shadow-[0_0_8px_currentColor]`} />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
export default Navbar;
