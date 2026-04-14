import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

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
  selectedLane?: string;
  onLaneChange?: (lane: string) => void;
  selectedAllocation?: string;
  onAllocationChange?: (val: string) => void;
  selectedPriority?: string;
  onPriorityChange?: (val: string) => void;
  selectedRegion?: string;
  onRegionChange?: (val: string) => void;
  selectedCountry?: string;
  onCountryChange?: (val: string) => void;
  selectedPortName?: string;
  onPortNameChange?: (val: string) => void;
  selectedPortCode?: string;
  onPortCodeChange?: (val: string) => void;
  isSyncing?: boolean;
  availableWeeks?: string[];
  availableContracts?: string[];
  availableOrigins?: string[];
  availableDestinations?: string[];
  availableLanes?: string[];
  availableAllocations?: string[];
  availablePriorities?: string[];
  availableRegions?: string[];
  availableCountries?: string[];
  availablePortNames?: string[];
  availablePortCodes?: string[];
  onSync?: () => void;
}

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
  selectedLane = 'ALL',
  onLaneChange,
  selectedAllocation = 'ALL',
  onAllocationChange,
  selectedPriority = 'ALL',
  onPriorityChange,
  selectedRegion = 'ALL',
  onRegionChange,
  selectedCountry = 'ALL',
  onCountryChange,
  selectedPortName = 'ALL',
  onPortNameChange,
  selectedPortCode = 'ALL',
  onPortCodeChange,
  isSyncing,
  onSync,
  availableWeeks = [],
  availableContracts = [],
  availableOrigins = [],
  availableDestinations = [],
  availableLanes = [],
  availableAllocations = [],
  availablePriorities = [],
  availableRegions = [],
  availableCountries = [],
  availablePortNames = [],
  availablePortCodes = []
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';

  // Individual Menu States
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  if (isHome) return null;

  const filters = [
    { label: 'Week', val: selectedWeek, items: ['ALL', ...availableWeeks], onSelect: onWeekChange, color: 'emerald' },
    { label: 'Contract', val: selectedContract, items: availableContracts, onSelect: onContractChange, color: 'cyan', hasSearch: true },
    { label: 'Trade Lane', val: selectedLane, items: ['ALL', ...availableLanes], onSelect: onLaneChange, color: 'violet' },
    { label: 'Origin', val: selectedOrigin, items: ['ALL', ...availableOrigins], onSelect: onOriginChange, color: 'indigo', hasSearch: true },
    { label: 'Dest.', val: selectedDestination, items: ['ALL', ...availableDestinations], onSelect: onDestinationChange, color: 'amber', hasSearch: true },
    { label: 'Region', val: selectedRegion, items: ['ALL', ...availableRegions], onSelect: onRegionChange, color: 'fuchsia' },
    { label: 'Country', val: selectedCountry, items: ['ALL', ...availableCountries], onSelect: onCountryChange, color: 'pink', hasSearch: true },
    { label: 'Port', val: selectedPortName, items: ['ALL', ...availablePortNames], onSelect: onPortNameChange, color: 'rose', hasSearch: true },
    { label: 'Code', val: selectedPortCode, items: ['ALL', ...availablePortCodes], onSelect: onPortCodeChange, color: 'sky', hasSearch: true },
    { label: 'Alloc.', val: selectedAllocation, items: ['ALL', ...availableAllocations], onSelect: onAllocationChange, color: 'rose', hasSearch: true },
    { label: 'Prio.', val: selectedPriority, items: ['ALL', ...availablePriorities], onSelect: onPriorityChange, color: 'orange' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-[60] flex justify-center pt-6 pointer-events-none">
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[1920px] mx-auto px-4 md:px-6 pointer-events-auto min-h-[140px] flex items-center justify-center"
      >
        <div className="flex items-center gap-4 p-3 quantum-glass rounded-[32px] min-h-[110px] w-full border border-white/[0.08] shadow-[0_30px_70px_rgba(0,0,0,0.9),inset_0_1px_1px_rgba(255,255,255,0.1)] relative overflow-visible backdrop-blur-3xl px-6 flex-col md:flex-row">

          {/* Identity Segment */}
          <div className="flex items-center bg-black/50 rounded-[20px] px-5 h-[64px] border border-white/[0.03] shadow-inner relative z-10 group/id shrink-0 cursor-pointer self-start md:self-center" onClick={() => navigate('/')}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${showBack ? 'bg-white/[0.03] border-white/[0.08] group-hover/id:border-cyan-500/50 group-hover/id:bg-cyan-500/10' : 'bg-cyan-500/10 border-cyan-500/20'}`}>
              {showBack ? (
                <svg className="w-4 h-4 text-slate-400 transition-transform group-hover/id:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
              ) : (
                <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              )}
            </div>
            <div className="hidden sm:flex flex-col ml-4">
              <span className="text-[8px] font-black text-cyan-500/60 uppercase tracking-[0.4em] leading-none mb-1">UNIT</span>
              <span className="text-[12px] font-black uppercase tracking-[0.2em] text-white">Quantum</span>
            </div>
          </div>

          <div className="w-[1px] h-6 bg-white/5 mx-1 relative z-10 shrink-0" />

          {/* Individual Filter Dropdowns (Grid based for 2 lines) */}
          <div className="flex-1 w-full grid grid-cols-2 min-[480px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 py-1">
            {filters.map((f, i) => (
              <div key={f.label} className="relative w-full overflow-visible" style={{ zIndex: openMenu === f.label ? 40 : 20 - i }}>
                <button
                  onClick={() => setOpenMenu(openMenu === f.label ? null : f.label)}
                  className={`w-full flex items-center justify-between px-3.5 h-[52px] rounded-2xl border transition-all duration-500 relative group overflow-hidden ${openMenu === f.label
                      ? `bg-${f.color}-500/15 border-${f.color}-500/40 text-${f.color}-300 ring-1 ring-${f.color}-500/20`
                      : f.val !== 'ALL'
                        ? 'bg-white/[0.06] border-white/15 text-white hover:bg-white/[0.1] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]'
                        : 'bg-[#0b0f19]/80 border-white/[0.03] text-slate-400 hover:border-white/[0.08] hover:bg-white/[0.05]'
                    }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out" />

                  <div className="flex flex-col items-start min-w-0 pr-1">
                    <span className={`text-[7px] font-bold uppercase tracking-[0.2em] mb-0.5 transition-colors ${openMenu === f.label || f.val !== 'ALL' ? 'text-white/70' : 'text-slate-500/60'}`}>{f.label}</span>
                    <span className="text-[11px] font-bold uppercase tracking-widest truncate w-full text-left antialiased">{f.val === 'ALL' ? 'GLOBAL' : f.val}</span>
                  </div>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors shrink-0 ${openMenu === f.label ? `bg-${f.color}-500/20 text-${f.color}-300` : 'bg-white/5 text-slate-500 group-hover:bg-white/10 group-hover:text-slate-300'}`}>
                    <svg className={`w-3 h-3 transition-transform duration-300 ${openMenu === f.label ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </button>

                <AnimatePresence>
                  {openMenu === f.label && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute top-[56px] left-0 min-w-[240px] bg-[#111622] border border-white/10 rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.9)] p-2 z-30"
                      >
                        <FilterSelect
                          items={f.items}
                          selected={f.val}
                          onSelect={(val) => { f.onSelect?.(val); setOpenMenu(null); }}
                          accentColor={f.color}
                          hasSearch={f.hasSearch}
                          height="400px"
                        />
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>

          <div className="hidden md:block w-[1px] h-10 bg-white/5 mx-2 relative z-10 shrink-0" />

          {/* Commands Segment */}
          <div className="flex items-center gap-3 relative z-10 shrink-0 self-start md:self-center">
            <button
              onClick={() => {
                onContractChange?.('ALL'); onWeekChange?.('ALL'); onOriginChange?.('ALL'); onDestinationChange?.('ALL'); onLaneChange?.('ALL'); onAllocationChange?.('ALL'); onPriorityChange?.('ALL');
                onRegionChange?.('ALL'); onCountryChange?.('ALL'); onPortNameChange?.('ALL'); onPortCodeChange?.('ALL');
              }}
              className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all bg-white/[0.03] border border-white/5 text-slate-500 hover:text-white hover:border-rose-500/50 hover:bg-rose-500/10 group/reset"
              title="Reset All"
            >
              <svg className="w-4 h-4 transition-transform group-hover/reset:-rotate-180 duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <button
              onClick={onSync}
              disabled={isSyncing}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all group/sync relative overflow-hidden ${isSyncing ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-400' : 'bg-white/[0.03] border border-white/5 text-slate-500 hover:text-white hover:border-cyan-500/50 hover:bg-cyan-500/10'
                }`}
            >
              <motion.div animate={isSyncing ? { rotate: 360 } : { rotate: 0 }} transition={{ duration: 2, repeat: isSyncing ? Infinity : 0, ease: "linear" }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </motion.div>
            </button>
          </div>
        </div>
      </motion.nav>
    </header>
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

  return (
    <div className="flex flex-col gap-2">
      {hasSearch && (
        <div className="px-2 pb-1 border-b border-white/5 mb-1 mt-1">
          <input
            type="text" autoFocus placeholder="Refine..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-mono text-white placeholder:text-slate-700 focus:outline-none focus:border-cyan-500/30 transition-all"
          />
        </div>
      )}
      <div className={`overflow-y-auto elegant-scrollbar pr-1 mt-2`} style={{ maxHeight: height }}>
        {filteredItems.map((item, idx) => (
          <button
            key={item + idx}
            onClick={() => onSelect?.(item)}
            className={`w-full text-left px-4 py-3 rounded-xl text-[12px] md:text-[13px] font-black uppercase tracking-widest transition-all mb-1 flex items-center justify-between ${selected === item
              ? `bg-${accentColor}-500/10 text-${accentColor}-400 border border-${accentColor}-500/20 shadow-[0_0_15px_rgba(var(--${accentColor}-rgb),0.1)]`
              : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
          >
            <span className="truncate">{item === 'ALL' ? 'Global' : item}</span>
            {selected === item && <div className={`w-1 h-1 rounded-full bg-${accentColor}-400 shadow-[0_0_8px_currentColor]`} />}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Navbar;
