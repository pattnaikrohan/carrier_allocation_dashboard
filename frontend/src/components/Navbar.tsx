import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

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
  isSyncing,
  onSync,
  availableWeeks = [],
  availableContracts = [],
  availableOrigins = [],
  availableDestinations = [],
  availableBranches = ALL_BRANCHES
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';


  // Individual Menu States
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  
  // Theme Toggle State
  const [isLightMode, setIsLightMode] = useState(false);

  const toggleTheme = () => {
    setIsLightMode(!isLightMode);
    document.documentElement.classList.toggle('light-mode');
  };

  if (isHome) return null;

  const filters = [
    { label: 'Week', val: selectedWeek, items: ['ALL', ...availableWeeks], onSelect: onWeekChange, color: 'emerald' },
    { label: 'Contract', val: selectedContract, items: availableContracts, onSelect: onContractChange, color: 'cyan', hasSearch: true },
    { label: 'Origin', val: selectedOrigin, items: availableOrigins, onSelect: onOriginChange, color: 'indigo', isHierarchical: true },
    { label: 'Dest.', val: selectedDestination, items: availableDestinations, onSelect: onDestinationChange, color: 'amber', isHierarchical: true },
    { label: 'Branch', val: selectedBranch, items: availableBranches, onSelect: onBranchChange, color: 'sky' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-[60] flex justify-center pt-6 pointer-events-none">
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[1920px] mx-auto px-4 md:px-6 pointer-events-auto min-h-[100px] flex items-center justify-center"
      >
        <div className="flex items-center gap-3 p-2.5 bg-[#0b0f19] rounded-[24px] min-h-[72px] w-max border border-white/[0.12] shadow-[0_20px_50px_rgba(0,0,0,0.9)] relative overflow-visible px-5 flex-row">

          {/* Identity Segment */}
          <div className="flex items-center bg-black/50 rounded-[16px] px-4 h-[48px] border border-white/[0.03] shadow-inner relative z-10 group/id shrink-0 cursor-pointer" onClick={() => navigate('/')}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${showBack ? 'bg-white/[0.03] border-white/[0.08] group-hover/id:border-cyan-500/50 group-hover/id:bg-cyan-500/10' : 'bg-cyan-500/10 border-cyan-500/20'}`}>
              {showBack ? (
                <svg className="w-3.5 h-3.5 text-slate-300 transition-transform group-hover/id:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
              ) : (
                <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              )}
            </div>
            <div className="hidden sm:flex flex-col ml-3">
              <span className="text-[7px] font-black text-white/40 uppercase tracking-[0.4em] leading-none mb-0.5">UNIT</span>
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">Quantum</span>
            </div>
          </div>

          <div className="w-[1px] h-6 bg-white/5 mx-1 relative z-10 shrink-0" />

          {/* Individual Filter Dropdowns */}
          <div className="flex items-center gap-2">
            {filters.map((f, i) => (
              <div key={f.label} className="relative overflow-visible" style={{ zIndex: openMenu === f.label ? 40 : 20 - i }}>
                <button
                  onClick={() => setOpenMenu(openMenu === f.label ? null : f.label)}
                  className={`flex items-center gap-3 px-4 h-[44px] rounded-[14px] border transition-all duration-500 relative group min-w-[120px] ${openMenu === f.label
                    ? `bg-${f.color}-500/15 border-${f.color}-500/40 text-${f.color}-300 ring-1 ring-${f.color}-500/20`
                    : f.val !== 'ALL'
                      ? 'bg-white/[0.06] border-white/10 text-white hover:bg-white/[0.1] shadow-inner'
                      : 'bg-[#0b0f19]/60 border-white/[0.03] text-slate-400 hover:border-white/[0.1] hover:bg-white/[0.03]'
                    }`}
                >
                  <div className="flex flex-col items-start min-w-0 pr-1">
                    <span className={`text-[8px] font-black uppercase tracking-[0.15em] mb-0.5 transition-colors ${openMenu === f.label || f.val !== 'ALL' ? 'text-white/60' : 'text-slate-500'}`}>{f.label}</span>
                    <span className="text-[10.5px] font-bold uppercase tracking-widest truncate w-full text-left antialiased">{f.val === 'ALL' ? 'Select' : f.val}</span>
                  </div>
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors shrink-0 ${openMenu === f.label ? `bg-${f.color}-500/20 text-${f.color}-300` : 'bg-white/5 text-slate-500 group-hover:text-slate-300'}`}>
                    <svg className={`w-2.5 h-2.5 transition-transform duration-300 ${openMenu === f.label ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
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
                        className={`absolute top-[48px] bg-[#0d111a] border border-white/15 rounded-[24px] shadow-[0_30px_70px_rgba(0,0,0,1)] p-2 z-50 ${
                          f.label === 'Origin' || f.label === 'Dest.' ? 'right-0 origin-top-right' : 
                          'left-1/2 -translate-x-1/2 origin-top'
                        } ${f.isHierarchical ? 'min-w-[720px]' : 'min-w-[220px]'}`}
                      >
                        {f.isHierarchical ? (
                          <HierarchicalSelect
                            data={f.items as HierarchyNode[]}
                            selected={f.val}
                            onSelect={(val) => { f.onSelect?.(val); setOpenMenu(null); }}
                            accentColor={f.color}
                          />
                        ) : (
                          <FilterSelect
                            items={f.items as string[]}
                            selected={f.val}
                            onSelect={(val) => { f.onSelect?.(val); setOpenMenu(null); }}
                            accentColor={f.color}
                            hasSearch={f.hasSearch}
                            height="350px"
                          />
                        )}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>

          <div className="w-[1px] h-8 bg-white/5 mx-1 relative z-10 shrink-0" />

          {/* Commands Segment */}
          <div className="flex items-center gap-2 relative z-10 shrink-0">
            <button
              onClick={() => {
                onContractChange?.('ALL'); onWeekChange?.('ALL'); onOriginChange?.('ALL'); onDestinationChange?.('ALL');
                onBranchChange?.('ALL');
              }}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all bg-white/[0.03] border border-white/5 text-slate-400 hover:text-white hover:border-rose-500/50 hover:bg-rose-500/10 group/reset"
              title="Reset All"
            >
              <svg className="w-3.5 h-3.5 transition-transform group-hover/reset:-rotate-180 duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <button
              onClick={toggleTheme}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${isLightMode ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-white/[0.03] border-white/5 text-slate-400 hover:text-amber-400 hover:border-amber-500/50 hover:bg-amber-500/10'}`}
              title="Toggle Theme"
            >
              {isLightMode ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              )}
            </button>

            <button
              onClick={onSync}
              disabled={isSyncing}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all group/sync relative overflow-hidden ${isSyncing ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-400' : 'bg-white/[0.03] border border-white/5 text-slate-400 hover:text-white hover:border-cyan-500/50 hover:bg-cyan-500/10'
                }`}
            >
              <motion.div animate={isSyncing ? { rotate: 360 } : { rotate: 0 }} transition={{ duration: 2, repeat: isSyncing ? Infinity : 0, ease: "linear" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </motion.div>
            </button>
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
}> = ({ data, selected, onSelect, accentColor }) => {
  const [activePath, setActivePath] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'indigo': return { active: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', dot: 'bg-indigo-400' };
      case 'amber': return { active: 'bg-amber-500/10 text-amber-400 border-amber-500/20', dot: 'bg-amber-400' };
      default: return { active: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', dot: 'bg-cyan-400' };
    }
  };
  const colors = getColorClasses(accentColor);

  const getNodesAtLevel = (level: number) => {
    if (level === 0) return data.filter(n => n.label.toLowerCase().includes(search.toLowerCase()) || (n.children && n.children.some(c => c.label.toLowerCase().includes(search.toLowerCase()))));
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
      <div className="px-3 pt-1 pb-2 border-b border-white/5">
        <input
          type="text"
          autoFocus
          placeholder="Refine Network..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-[10px] font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/30 transition-all"
        />
      </div>

      <div className="flex flex-row items-stretch divide-x divide-white/10 h-[400px]">
        {[0, 1, 2].map((level) => {
          const nodes = getNodesAtLevel(level);
          const labels = ['Region', 'Country', 'Port'];

          return (
            <div key={level} className="flex-1 min-w-[230px] flex flex-col h-full overflow-hidden bg-[#0d111a]">
              <div className="px-4 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-white/[0.03] mb-2">
                {labels[level]}
              </div>
              <div className="flex-1 overflow-y-auto elegant-scrollbar px-2 pb-4">
                {nodes.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[10px] text-slate-600 font-bold uppercase tracking-widest italic">
                    Select {labels[level-1]}
                  </div>
                ) : (
                  nodes.map((node) => {
                    const hasChildren = node.children && node.children.length > 0;
                    const isActive = activePath[level] === node.label;
                    const isSelected = selected === node.label;

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
                        className={`w-full text-left px-3 py-2 rounded-xl text-[10.5px] font-black uppercase tracking-widest transition-all mb-0.5 flex items-center justify-between group/item ${
                          isSelected ? colors.active : 
                          isActive ? 'bg-white/10 text-white shadow-md' : 
                          'text-slate-400 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span className="truncate">{node.label === 'ALL' ? 'Please Select' : node.label}</span>
                        {hasChildren && (
                          <svg className={`w-3 h-3 transition-transform duration-300 ${isActive ? 'translate-x-0.5 text-white' : 'text-slate-600 group-hover/item:text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
}> = ({ items, selected, onSelect, accentColor, hasSearch, height = "auto" }) => {
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
          active: 'bg-slate-500/10 text-slate-300 border border-slate-500/20',
          dot: 'bg-slate-400',
          shadow: '0 0 15px rgba(148,163,184,0.1)'
        };
    }
  };

  const colors = getColorClasses();

  return (
    <div className="flex flex-col gap-2">
      {hasSearch && (
        <div className="px-2 pb-1 border-b border-white/5 mb-1 mt-1">
          <input
            type="text"
            autoFocus
            placeholder="Refine..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-mono text-white placeholder:text-slate-300 focus:outline-none focus:border-cyan-500/30 transition-all"
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
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            style={
              selected === item
                ? { boxShadow: colors.shadow }
                : undefined
            }
          >
            <span className="truncate">
              {item === 'ALL' ? 'Please Select' : item}
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
