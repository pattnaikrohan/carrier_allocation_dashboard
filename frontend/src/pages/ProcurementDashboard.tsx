import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import {
  ComposedChart, Bar, Line, PieChart, Pie,
  XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts';

import { useNavigate } from 'react-router-dom';
import {
  QUARTERLY_ALLOC_UTIL, CARRIER_BREAKDOWN,
  BOOKING_LOG_DATA, CONTRACT_UTIL_DATA, WEEKLY_TREND_DATA,
} from '../BookingData';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const BRANCHES = [
  { code: 'SYD', name: 'Sydney',    color: '#a855f7', rawCodes: ['SY1'] },
  { code: 'MEL', name: 'Melbourne', color: '#c084fc', rawCodes: ['ME1'] },
  { code: 'BNE', name: 'Brisbane',  color: '#d8b4fe', rawCodes: ['BN1'] },
  { code: 'FRE', name: 'Fremantle', color: '#e879f9', rawCodes: ['FR1', 'PR1'] },
  { code: 'ADL', name: 'Adelaide',  color: '#f0abfc', rawCodes: ['AD1'] },
  { code: 'PIL', name: 'PIL',       color: '#818cf8', rawCodes: ['PIL'] },
  { code: 'PRJ', name: 'Projects',  color: '#6ee7b7', rawCodes: ['PRJ'] },
  { code: 'AKL', name: 'Auckland',  color: '#67e8f9', rawCodes: ['AKL'] },
  { code: 'OTH', name: 'Other',     color: '#94a3b8', rawCodes: ['OTH'] },
];

const BRANCH_COLOR: Record<string, string> = Object.fromEntries(
  BRANCHES.map(b => [b.code, b.color])
);

// Map a raw booking branch code (e.g. 'SY1') → display branch code (e.g. 'SYD')
const RAW_TO_DISPLAY: Record<string, string> = {};
BRANCHES.forEach(b => b.rawCodes.forEach(r => { RAW_TO_DISPLAY[r] = b.code; }));

const ALL_WEEKS = WEEKLY_TREND_DATA.map(w => w.week);




/**
 * Status label logic (applied to utilisation %):
 *   Overutilised >100%:   carrier filled beyond allocation — very healthy
 *   On Track 81–100%:     allocation filling well — target zone
 *   Underperforming 50–80%: below target, action recommended
 *   Low Uptake <50%:      critical underutilisation, allocation at risk
 */
const getStatus = (pct: number) => {
  if (pct > 100) return { label: '↑ Overutilised',    cls: 'bg-emerald-400/10 text-emerald-300 border border-emerald-400/30', bar: 'bg-emerald-400' };
  if (pct > 80)  return { label: '✓ On Track',         cls: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30', bar: 'bg-emerald-500' };
  if (pct >= 50) return { label: '▼ Underperforming',  cls: 'bg-rose-500/10 text-rose-400 border border-rose-500/30',         bar: 'bg-rose-500'   };
  return           { label: '⚠ Low Uptake',            cls: 'bg-rose-900/40 text-rose-300 border border-rose-600/30',          bar: 'bg-rose-700'   };
};

// ─── TOOLTIP ─────────────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0b0f19]/90 backdrop-blur border border-white/10 p-4 rounded-2xl shadow-xl">
      <p className="text-[10px] font-black uppercase tracking-widest text-white mb-3 pb-2 border-b border-white/5">
        {label ?? payload[0]?.payload?.name ?? payload[0]?.payload?.quarter ?? payload[0]?.payload?.carrier}
      </p>
      {payload.map((e: any, i: number) => (
        <div key={i} className="flex items-center gap-3 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: e.color }} />
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{e.name}</span>
          <span className="text-xs font-mono font-bold text-white ml-auto">
            {e.value}{e.name === 'Utilisation %' ? '%' : ' TEU'}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── KPI MODAL ───────────────────────────────────────────────────────────────

interface KpiModalData {
  title: string;
  value: string | number;
  sub: string;
  detail: string;
  rows?: { label: string; value: string | number; color?: string }[];
}

const KpiModal: React.FC<{ data: KpiModalData; onClose: () => void }> = ({ data, onClose }) => (
  <AnimatePresence>
    <motion.div
      className="fixed inset-0 z-[800] flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div
        className="relative z-10 bg-[#0b0f19] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-[0_40px_80px_rgba(0,0,0,0.8)]"
        initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">{data.sub}</p>
            <h2 className="text-2xl font-display font-black text-white">{data.title}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="text-4xl font-display font-black text-white mb-4">{data.value}</div>
        <p className="text-sm text-slate-400 leading-relaxed mb-6">{data.detail}</p>
        {data.rows && data.rows.length > 0 && (
          <div className="space-y-2">
            {data.rows.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 bg-white/[0.03] rounded-xl border border-white/5">
                <span className="text-[11px] text-slate-400 uppercase font-bold tracking-widest">{r.label}</span>
                <span className="font-mono text-sm font-bold" style={{ color: r.color ?? '#fff' }}>{r.value}</span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  </AnimatePresence>
);

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

const ProcurementDashboard: React.FC = () => {
  const navigate = useNavigate();

  // ── Filters ──────────────────────────────────────────────────────────────
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [selectedWeek,   setSelectedWeek]   = useState('ALL');
  const [selectedContract, setSelectedContract] = useState('ALL');

  // Matrix-specific filters
  const [matrixBranchFilter,   setMatrixBranchFilter]   = useState('ALL');
  const [matrixContractFilter, setMatrixContractFilter] = useState('ALL');

  // Sync UI state
  const [isSyncing,       setIsSyncing]       = useState(false);
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);
  const [syncState,       setSyncState]       = useState<'IDLE'|'SYNCING'|'LOCKED'>('IDLE');
  const [lastSync,        setLastSync]        = useState('');
  const [mounted,         setMounted]         = useState(false);

  // KPI click modal
  const [kpiModal, setKpiModal] = useState<KpiModalData | null>(null);

  useEffect(() => {
    setLastSync(new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    setMounted(true);
  }, []);

  // ── Derived: filtered bookings ────────────────────────────────────────────
  const filteredBookings = useMemo(() => {
    return BOOKING_LOG_DATA.filter(b => {
      const weekMatch     = selectedWeek === 'ALL' || `WK ${b.mscWeek}` === selectedWeek;
      const contractMatch = selectedContract === 'ALL' || b.contract === selectedContract;
      const branchMatch   = selectedBranch === 'ALL' || (() => {
        const br = BRANCHES.find(x => x.code === selectedBranch);
        return br ? br.rawCodes.includes(b.branch) : b.branch === selectedBranch;
      })();
      return weekMatch && contractMatch && branchMatch;
    });
  }, [selectedBranch, selectedWeek, selectedContract]);

  // ── Derived: KPI numbers from REAL data ──────────────────────────────────
  const kpiData = useMemo(() => {
    // Total allocation: from CONTRACT_UTIL_DATA filtered by selected contract, scaled by weeks
    const activeWeekCount = selectedWeek === 'ALL' ? ALL_WEEKS.length : 1;
    const totalWeeks      = ALL_WEEKS.length || 1;
    const weekScale       = activeWeekCount / totalWeeks;

    const relevantContracts = selectedContract === 'ALL'
      ? CONTRACT_UTIL_DATA
      : CONTRACT_UTIL_DATA.filter(c => c.id === selectedContract);

    // Allocation: scale weekly alloc by week coverage
    const totalAlloc = relevantContracts.reduce((s, c) => s + c.alloc * weekScale, 0);

    // Booked: sum from filtered bookings
    const totalBooked = filteredBookings.reduce((s, b) => s + (b.teu || 0), 0);
    const utilPct     = totalAlloc > 0 ? (totalBooked / totalAlloc) * 100 : 0;

    // Underperforming (contract-level, ≤80%)
    const underCount = relevantContracts.filter(c => {
      const cBooked = BOOKING_LOG_DATA.filter(b => {
        const wm = selectedWeek === 'ALL' || `WK ${b.mscWeek}` === selectedWeek;
        const brm = selectedBranch === 'ALL' || (() => {
          const br = BRANCHES.find(x => x.code === selectedBranch);
          return br ? br.rawCodes.includes(b.branch) : b.branch === selectedBranch;
        })();
        return b.contract === c.id && wm && brm;
      }).reduce((s, b) => s + b.teu, 0);
      const cAlloc = c.alloc * weekScale;
      return cAlloc > 0 && (cBooked / cAlloc) <= 0.8;
    }).length;

    const healthyCount = relevantContracts.filter(c => {
      const cBooked = BOOKING_LOG_DATA.filter(b => {
        const wm = selectedWeek === 'ALL' || `WK ${b.mscWeek}` === selectedWeek;
        const brm = selectedBranch === 'ALL' || (() => {
          const br = BRANCHES.find(x => x.code === selectedBranch);
          return br ? br.rawCodes.includes(b.branch) : b.branch === selectedBranch;
        })();
        return b.contract === c.id && wm && brm;
      }).reduce((s, b) => s + b.teu, 0);
      const cAlloc = c.alloc * weekScale;
      return cAlloc > 0 && (cBooked / cAlloc) > 0.8;
    }).length;

    return { totalAlloc, totalBooked, utilPct, underCount, healthyCount, totalContracts: relevantContracts.length };
  }, [filteredBookings, selectedContract, selectedWeek, selectedBranch]);

  // ── Derived: contract-level data for the matrix/chart ────────────────────
  const contractMatrixData = useMemo(() => {
    const activeWeekCount = selectedWeek === 'ALL' ? ALL_WEEKS.length : 1;
    const totalWeeks      = ALL_WEEKS.length || 1;
    const weekScale       = activeWeekCount / totalWeeks;

    return CONTRACT_UTIL_DATA
      .filter(c => matrixContractFilter === 'ALL' || c.id === matrixContractFilter)
      .map(c => {
        // bookings for this contract filtered by week + branch
        const cBookings = BOOKING_LOG_DATA.filter(b => {
          const wm  = selectedWeek === 'ALL' || `WK ${b.mscWeek}` === selectedWeek;
          const brm = (() => {
            const eff = matrixBranchFilter !== 'ALL' ? matrixBranchFilter : selectedBranch;
            if (eff === 'ALL') return true;
            const br = BRANCHES.find(x => x.code === eff);
            return br ? br.rawCodes.includes(b.branch) : b.branch === eff;
          })();
          return b.contract === c.id && wm && brm;
        });

        const booked = cBookings.reduce((s, b) => s + b.teu, 0);
        const alloc  = c.alloc * weekScale;
        const pct    = alloc > 0 ? Math.round((booked / alloc) * 100) : 0;
        const avail  = alloc - booked;

        // Branch-level booked TEU breakdown
        const getBranchTeu = (codes: string[]) =>
          cBookings.filter(b => codes.includes(b.branch)).reduce((s, b) => s + b.teu, 0);

        return {
          id:        c.id,
          carrier:   c.carrier,
          lane:      c.lane,
          Allocated: Math.round(alloc),
          Booked:    Math.round(booked),
          Utilisation: pct,
          avail:     Math.round(avail),
          status:    getStatus(pct),
          sydTeu: Math.round(getBranchTeu(['SY1'])),
          melTeu: Math.round(getBranchTeu(['ME1'])),
          bneTeu: Math.round(getBranchTeu(['BN1'])),
          freTeu: Math.round(getBranchTeu(['FR1', 'PR1'])),
          adlTeu: Math.round(getBranchTeu(['AD1'])),
        };
      })
      .filter(c => !(matrixBranchFilter !== 'ALL' && c.Allocated === 0));
  }, [selectedWeek, selectedBranch, matrixContractFilter, matrixBranchFilter]);

  const carrierDonutData = useMemo(() => {
    const bkSource = selectedBranch === 'ALL' && selectedWeek === 'ALL' && selectedContract === 'ALL'
      ? CARRIER_BREAKDOWN.filter(c => c.carrier !== '0').slice(0, 8).map((c, i) => ({
          name: c.carrier.replace(/_[A-Z]{2}$/, ''),
          value: Math.round(c.teu), pct: c.pct,
          color: ['#a855f7','#06b6d4','#f43f5e','#f59e0b','#10b981','#818cf8','#e879f9','#67e8f9'][i % 8],
        }))
      : (() => {
          const map: Record<string, number> = {};
          filteredBookings.forEach(b => {
            // Check both camelCase (from ingestion) and Pascal Case (from raw)
            const rawVal = b.plannedCarrier || b.carrierName || b['Planned Carrier'] || b['Carrier Name'] || 'Unknown';
            const c = String(rawVal).replace(/_[A-Z]{2}$/, '').replace(/_AU\d*$/, '');
            map[c] = (map[c] || 0) + (b.teu || 0);
          });
          const total = Object.values(map).reduce((s, v) => s + v, 0) || 1;
          return Object.entries(map)
            .filter(([k]) => k !== '0')
            .map(([name, teu]) => ({ name, value: Math.round(teu), pct: Math.round(teu/total*100) }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8)
            .map((c, i) => ({ ...c, color: ['#a855f7','#06b6d4','#f43f5e','#f59e0b','#10b981','#818cf8','#e879f9','#67e8f9'][i % 8] }));
        })();
    return bkSource;
  }, [filteredBookings, selectedBranch, selectedWeek, selectedContract]);

  // ── Derived: quarterly data – uses qtr field from bookings ───────────────
  const quarterlyData = useMemo(() => {
    if (selectedBranch === 'ALL' && selectedWeek === 'ALL' && selectedContract === 'ALL') {
      return QUARTERLY_ALLOC_UTIL;
    }
    // Group filtered bookings by their qtr field
    const qMap: Record<string, { alloc: number; booked: number }> = {};
    filteredBookings.forEach(b => {
      const q = b.qtr || 'Q?';
      if (!qMap[q]) qMap[q] = { alloc: 0, booked: 0 };
      qMap[q].booked += (b.teu || 0);
    });
    // Scale allocation by how many weeks of each quarter are selected
    QUARTERLY_ALLOC_UTIL.forEach(qa => {
      if (!qMap[qa.quarter]) qMap[qa.quarter] = { alloc: 0, booked: qMap[qa.quarter]?.booked || 0 };
      const relContracts = selectedContract === 'ALL' ? CONTRACT_UTIL_DATA : CONTRACT_UTIL_DATA.filter(c => c.id === selectedContract);
      const wksInQ = ALL_WEEKS.filter(w => {
        const wNum = parseInt(w.split(' ')[1]);
        const q = `Q${Math.ceil(wNum / 13) || 1}`;
        return q === qa.quarter && (selectedWeek === 'ALL' || w === selectedWeek);
      }).length;
      const qTotalWks = ALL_WEEKS.filter(w => {
        const wNum = parseInt(w.split(' ')[1]);
        return `Q${Math.ceil(wNum/13)||1}` === qa.quarter;
      }).length || 1;
      const scale = wksInQ / qTotalWks;
      relContracts.forEach(c => { qMap[qa.quarter].alloc += c.alloc * scale; });
    });
    return Object.entries(qMap).sort(([a],[b])=>a.localeCompare(b)).map(([quarter, d]) => ({
      quarter,
      Allocation:  Math.round(d.alloc),
      Utilisation: Math.round(d.booked),
      UtilPct:     d.alloc > 0 ? Math.round(d.booked / d.alloc * 100) : 0,
    }));
  }, [filteredBookings, selectedBranch, selectedWeek, selectedContract]);

  // ── Live Feed: last 20 bookings matching filters ──────────────────────────
  const liveFeed = useMemo(() => {
    return filteredBookings
      .filter(b => b.teu > 0)
      .slice(-40).reverse().slice(0, 20)
      .map((b, i) => {
        const etaDate = b.eta ? b.eta.slice(0, 10) : '—';
        return {
          ref:          b.order || `CWO-${880000 + i}`,
          contract:     b.contract || 'N/A',
          branch:       b.branch,
          displayBranch: RAW_TO_DISPLAY[b.branch] || b.branch,
          cargo:        `${(b.teu || 0).toFixed(1)} TEU`,
          carrier:      (b.carrierName || b.plannedCarrier || '—').replace(/_[A-Z]{2}$/, ''),
          teu:          b.teu || 0,
          isLarge:      (b.teu || 0) >= 6,
          eta:          etaDate,
          color:        BRANCH_COLOR[RAW_TO_DISPLAY[b.branch] || ''] || '#94a3b8',
        };
      });
  }, [filteredBookings]);

  // ── Sync handler (scramble effect) ───────────────────────────────────────
  const triggerSync = useCallback(() => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncState('SYNCING');
    setShowSyncSuccess(false);
    setTimeout(() => setSyncState('LOCKED'), 1800);
    setTimeout(() => {
      setIsSyncing(false);
      setLastSync(new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setShowSyncSuccess(true);
      setTimeout(() => setShowSyncSuccess(false), 3500);
    }, 2800);
  }, [isSyncing]);

  // ── Sub-components ────────────────────────────────────────────────────────

  const TacticalNumber: React.FC<{ value: string | number }> = ({ value }) => {
    const [scrambled, setScrambled] = useState(value);
    useEffect(() => {
      if (syncState === 'SYNCING') {
        const t = setInterval(() => setScrambled(Math.floor(Math.random() * 9999).toString()), 60);
        return () => clearInterval(t);
      } else { setScrambled(value); }
    }, [syncState, value]);
    return (
      <motion.span
        key={String(syncState === 'LOCKED' ? 'locked' : 'scramble') + String(value)}
        initial={syncState === 'SYNCING' ? { filter: 'blur(4px)', opacity: 0.6 } : { filter: 'blur(0px)', opacity: 1 }}
        animate={{ filter: 'blur(0px)', opacity: 1 }}
        className="inline-block"
      >
        {scrambled}
      </motion.span>
    );
  };

  /** KPI card with 3D tilt + click modal */
  const KpiCard: React.FC<{
    label: string; value: string | number; sub: string;
    icon: string; topColor: string; bgColor: string; textColor: string;
    idx: number; modalData: KpiModalData;
  }> = ({ label, value, sub, icon, topColor, bgColor, textColor, idx, modalData }) => {
    const mx = useMotionValue(0); const my = useMotionValue(0);
    const rx = useTransform(my, [-0.5, 0.5], [10, -10]);
    const ry = useTransform(mx, [-0.5, 0.5], [-10, 10]);
    return (
      <motion.div
        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 * idx, ease: 'easeOut' }}
        style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }}
        onMouseMove={e => { const r = e.currentTarget.getBoundingClientRect(); mx.set((e.clientX - r.left)/r.width - 0.5); my.set((e.clientY - r.top)/r.height - 0.5); }}
        onMouseLeave={() => { mx.set(0); my.set(0); }}
        onClick={() => setKpiModal(modalData)}
        className={`bg-[#0a0f1c]/90 backdrop-blur-2xl border border-white/5 border-t-[2px] ${topColor} rounded-[20px] p-6 relative cursor-pointer hover:shadow-[0_20px_50px_rgba(168,85,247,0.25)] transition-all duration-500 overflow-hidden group`}
      >
        <div className={`absolute -right-8 -top-8 w-28 h-28 rounded-full blur-[50px] opacity-20 group-hover:opacity-80 transition-opacity duration-700 ${bgColor}`} />
        <div className={`absolute top-5 right-5 w-10 h-10 rounded-xl flex items-center justify-center text-xl ${bgColor} border border-white/5`}>{icon}</div>
        <div className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-500 mb-2">{label}</div>
        <div className={`text-4xl font-display font-black tracking-tighter mb-1 drop-shadow-[0_0_10px_currentColor] ${textColor}`}>
          <TacticalNumber value={value} />
        </div>
        <div className="text-[10px] font-mono text-slate-400">{sub}</div>
        <div className="absolute bottom-3 right-4 text-[8px] text-slate-600 uppercase tracking-widest">Click for details</div>
      </motion.div>
    );
  };

  const ScanningOverlay = () => (
    <AnimatePresence>
      {isSyncing && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[500] pointer-events-none overflow-hidden"
        >
          <style>{`.glow-laser{box-shadow:0 0 40px #a855f7,0 0 80px #c084fc;}.refraction{backdrop-filter:hue-rotate(25deg) contrast(1.2) brightness(1.15) blur(3px);}`}</style>
          <motion.div animate={{ top: ['-20%', '120%'] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-x-0 h-[300px] refraction z-[501]">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-500/10 to-transparent" />
          </motion.div>
          <motion.div animate={{ top: ['-10%', '110%'] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            className="absolute left-0 w-full h-[3px] bg-white z-[502] glow-laser" />
        </motion.div>
      )}
    </AnimatePresence>
  );

  const SyncNotification = () => (
    <AnimatePresence>
      {showSyncSuccess && (
        <motion.div initial={{ opacity: 0, y: -40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
          className="fixed top-28 left-1/2 -translate-x-1/2 z-[501] px-8 py-3 rounded-2xl bg-[#05070a]/90 backdrop-blur-3xl border border-emerald-500/30 shadow-xl flex items-center gap-4 relative overflow-hidden"
        >
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/40">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          </div>
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Status: OK</span>
            <span className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Data Stream Synchronized</span>
          </div>
          <div className="absolute bottom-0 left-0 h-[2px] bg-emerald-500 rounded-full" style={{ animation: 'syncProg 3.5s linear forwards' }} />
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ── KPI modal builders ────────────────────────────────────────────────────
  const makeAllocModal = (): KpiModalData => ({
    title: 'Total Allocation',
    value: `${Math.round(kpiData.totalAlloc).toLocaleString()} TEU`,
    sub: selectedWeek === 'ALL' ? 'All Weeks' : selectedWeek,
    detail: `Total contracted TEU allocation across ${kpiData.totalContracts} active contract(s) for the selected timeframe and branch.`,
    rows: CONTRACT_UTIL_DATA
      .filter(c => selectedContract === 'ALL' || c.id === selectedContract)
      .slice(0, 8)
      .map(c => ({
        label: `${c.id} – ${c.carrier}`,
        value: `${Math.round(c.alloc * (selectedWeek === 'ALL' ? 1 : 1 / (ALL_WEEKS.length || 1))).toLocaleString()} TEU`,
        color: '#94a3b8',
      })),
  });

  const makeBookedModal = (): KpiModalData => ({
    title: 'Booked Volume',
    value: `${Math.round(kpiData.totalBooked).toLocaleString()} TEU`,
    sub: `${Math.round(kpiData.utilPct)}% utilised`,
    detail: `Actual bookings recorded for the selected filter combination. ${filteredBookings.length} booking(s) matched.`,
    rows: BRANCHES.map(b => {
      const teu = filteredBookings.filter(bk => b.rawCodes.includes(bk.branch)).reduce((s, bk) => s + bk.teu, 0);
      return { label: b.name, value: `${Math.round(teu)} TEU`, color: teu > 0 ? b.color : '#475569' };
    }).filter(r => r.value !== '0 TEU'),
  });

  const makeUnderModal = (): KpiModalData => ({
    title: 'Underperforming Contracts',
    value: kpiData.underCount,
    sub: '≤80% utilisation threshold',
    detail: `Contracts where booked volume is ≤80% of the period allocation. These represent underutilisation risk and should be actioned.`,
    rows: contractMatrixData
      .filter(c => c.Utilisation <= 80)
      .map(c => ({
        label: `${c.id} – ${c.carrier}`,
        value: `${c.Utilisation}%`,
        color: '#f43f5e',
      })),
  });

  const makeHealthyModal = (): KpiModalData => ({
    title: 'Healthy Contracts',
    value: kpiData.healthyCount,
    sub: '>80% weekly avg utilisation',
    detail: `Contracts meeting or exceeding the 80% utilisation target.`,
    rows: contractMatrixData
      .filter(c => c.Utilisation > 80)
      .map(c => ({
        label: `${c.id} – ${c.carrier}`,
        value: `${c.Utilisation}%`,
        color: '#10b981',
      })),
  });

  // ── Available options for dropdowns ──────────────────────────────────────
  const availableContracts = useMemo(() =>
    ['ALL', ...Array.from(new Set(BOOKING_LOG_DATA.map(b => b.contract))).sort()],
    []
  );

  // ── JSX ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#02050A] text-[#f8fafc] overflow-x-hidden relative pb-16">
      <style>{`
        @keyframes syncProg { 0%{width:0%} 100%{width:100%} }
        .glow-emerald { box-shadow: 0 0 15px rgba(16,185,129,0.4); }
        .glow-rose    { box-shadow: 0 0 15px rgba(244,63,94,0.4);  }
      `}</style>

      <ScanningOverlay />
      <SyncNotification />

      {/* KPI detail modal */}
      {kpiModal && <KpiModal data={kpiModal} onClose={() => setKpiModal(null)} />}

      {/* Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-900/10 blur-[150px] rounded-full" />
      </div>

      <main className="w-full max-w-[1920px] mx-auto flex flex-col pt-6 relative z-10 px-4 md:px-8">

        {/* ── Control Bar ── */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-[#0a0f1c]/60 backdrop-blur-3xl border border-white/5 rounded-3xl shadow-lg sticky top-6 z-40 mb-8"
        >
          <div className="flex flex-wrap items-center gap-4">
            {/* Back */}
            <button onClick={() => navigate('/')}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] hover:bg-white/[0.08] rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 hover:text-white transition-all border border-white/5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Back
            </button>

            <div className="h-8 w-px bg-white/10" />

            {/* Week filter */}
            <div className="flex flex-col gap-1">
              <span className="text-[8px] font-black text-purple-400 tracking-[0.3em] uppercase">Week</span>
              <select value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)}
                className="bg-[#05070a] border border-white/10 rounded-xl px-3 py-2 text-[10px] font-bold text-white appearance-none cursor-pointer focus:outline-none focus:border-purple-500/50 min-w-[90px]">
                <option value="ALL">All Weeks</option>
                {ALL_WEEKS.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>

            {/* Contract filter */}
            <div className="flex flex-col gap-1">
              <span className="text-[8px] font-black text-cyan-400 tracking-[0.3em] uppercase">Contract</span>
              <select value={selectedContract} onChange={e => setSelectedContract(e.target.value)}
                className="bg-[#05070a] border border-white/10 rounded-xl px-3 py-2 text-[10px] font-bold text-white appearance-none cursor-pointer focus:outline-none focus:border-cyan-500/50 min-w-[110px]">
                {availableContracts.map(c => <option key={c} value={c}>{c === 'ALL' ? 'All Contracts' : c}</option>)}
              </select>
            </div>

            <div className="h-8 w-px bg-white/10" />

            {/* Branch selector pills */}
            <div className="flex flex-col gap-1">
              <span className="text-[8px] font-black text-purple-400 tracking-[0.3em] uppercase">Branch Node</span>
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => setSelectedBranch('ALL')}
                  className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-200 ${selectedBranch === 'ALL' ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)] border border-purple-400' : 'bg-transparent border border-white/5 text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                  Global
                </button>
                {BRANCHES.map(b => (
                  <button key={b.code} onClick={() => setSelectedBranch(b.code)}
                    className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-200 ${selectedBranch === b.code ? 'text-white shadow-lg border' : 'bg-transparent border border-white/5 text-slate-400 hover:bg-white/5 hover:text-white'}`}
                    style={selectedBranch === b.code ? { background: b.color + '33', borderColor: b.color + '88', color: b.color } : {}}>
                    {b.code}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end hidden lg:flex">
              <span className="text-[8px] font-black text-slate-500 tracking-[0.3em] uppercase">Network Status</span>
              <span className="font-mono text-xs text-emerald-400 font-bold">CW1 LINKED · {lastSync}</span>
            </div>
            {/* Reset */}
            <button onClick={() => { setSelectedBranch('ALL'); setSelectedWeek('ALL'); setSelectedContract('ALL'); }}
              className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all bg-white/[0.03] border border-white/5 text-slate-300 hover:text-white hover:border-rose-500/50 hover:bg-rose-500/10"
              title="Reset filters">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <button onClick={triggerSync}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-full font-black text-white text-xs tracking-[0.2em] shadow-[0_0_25px_rgba(168,85,247,0.4)] transition-all flex items-center gap-2 border border-purple-400/50">
              <svg className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              SYNC
            </button>
          </div>
        </motion.div>

        {/* Active filter chips */}
        {(selectedBranch !== 'ALL' || selectedWeek !== 'ALL' || selectedContract !== 'ALL') && (
          <div className="flex gap-2 flex-wrap mb-4">
            {selectedWeek !== 'ALL' && (
              <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-bold text-emerald-400">
                {selectedWeek}
                <button onClick={() => setSelectedWeek('ALL')} className="hover:text-white">×</button>
              </span>
            )}
            {selectedContract !== 'ALL' && (
              <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-[10px] font-bold text-cyan-400">
                {selectedContract}
                <button onClick={() => setSelectedContract('ALL')} className="hover:text-white">×</button>
              </span>
            )}
            {selectedBranch !== 'ALL' && (
              <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/25 text-[10px] font-bold text-purple-400">
                {selectedBranch}
                <button onClick={() => setSelectedBranch('ALL')} className="hover:text-white">×</button>
              </span>
            )}
          </div>
        )}

        <div className="flex flex-col gap-6 w-full">

          {/* ── KPI Cards (all from real data, click → modal) ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 perspective-1000">
            <KpiCard
              idx={0} icon="📦" topColor="border-t-purple-500" bgColor="bg-purple-500/20" textColor="text-white"
              label="Total Allocation" value={Math.round(kpiData.totalAlloc).toLocaleString()}
              sub={`TEU · ${selectedWeek === 'ALL' ? 'All Weeks' : selectedWeek}`}
              modalData={makeAllocModal()}
            />
            <KpiCard
              idx={1} icon="🛳" topColor="border-t-cyan-400" bgColor="bg-cyan-400/20" textColor="text-cyan-300"
              label="Booked Volume" value={Math.round(kpiData.totalBooked).toLocaleString()}
              sub={`${Math.round(kpiData.utilPct)}% utilised network`}
              modalData={makeBookedModal()}
            />
            <KpiCard
              idx={2} icon="⚠️" topColor="border-t-rose-500" bgColor="bg-rose-500/20" textColor="text-rose-400"
              label="Underperforming (≤80%)" value={kpiData.underCount}
              sub="Contracts at utilisation risk"
              modalData={makeUnderModal()}
            />
            <KpiCard
              idx={3} icon="✓" topColor="border-t-emerald-500" bgColor="bg-emerald-500/20" textColor="text-emerald-400"
              label="Healthy Contracts" value={kpiData.healthyCount}
              sub=">80% weekly avg utilisation"
              modalData={makeHealthyModal()}
            />
          </div>

          {/* ── Charts Row ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: 440 }}>

            {/* Quarterly Allocation vs Utilisation */}
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}
              className="bg-[#0b0f19]/80 border border-white/5 rounded-3xl p-6 shadow-lg relative overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse shadow-[0_0_8px_#a855f7]" />
                  Quarterly Allocation vs Utilisation
                </h3>
                <span className="px-2 py-1 bg-[#05070a] rounded font-mono text-[9px] text-purple-400 border border-white/10">TEU</span>
              </div>
              <div className="h-[330px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={mounted ? quarterlyData : []} margin={{ left: -20, right: 0, bottom: 0, top: 10 }} barGap={4}>
                    <defs>
                      <linearGradient id="gPurple" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a855f7" /><stop offset="100%" stopColor="#a855f7" stopOpacity={0.2} /></linearGradient>
                      <linearGradient id="gCyan"   x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#06b6d4" /><stop offset="100%" stopColor="#06b6d4" stopOpacity={0.2} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="quarter" stroke="#64748b" tickLine={false} axisLine={false} fontSize={10} />
                    <YAxis stroke="#64748b" tickLine={false} axisLine={false} fontSize={10} />
                    <RechartsTooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                    <Bar dataKey="Allocation"  fill="url(#gPurple)" name="Allocation"   radius={[4,4,0,0]} barSize={16} isAnimationActive />
                    <Bar dataKey="Utilisation" fill="url(#gCyan)"   name="Utilisation"  radius={[4,4,0,0]} barSize={16} isAnimationActive />
                    <Line type="monotone" dataKey="UtilPct" name="Utilisation %" stroke="#f43f5e" strokeWidth={2.5} dot={{ fill: '#0a0f1c', stroke: '#f43f5e', strokeWidth: 2, r: 4 }} activeDot={{ r: 7 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Carrier Breakdown (reactive to filters) */}
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}
              className="bg-[#0b0f19]/80 border border-white/5 rounded-3xl p-6 shadow-lg relative overflow-hidden">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white flex items-center gap-2 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_#06b6d4]" /> Carrier Breakdown
              </h3>
              <p className="text-[9px] text-slate-500 mb-4 tracking-widest">% of bookings by TEU · {selectedBranch !== 'ALL' ? selectedBranch : 'All Branches'}</p>
              <div className="h-[350px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={mounted ? carrierDonutData : []} cx="50%" cy="50%" innerRadius="60%" outerRadius="82%"
                      paddingAngle={5} dataKey="value" stroke="transparent" cornerRadius={4} isAnimationActive animationDuration={1500}>
                      {carrierDonutData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <RechartsTooltip content={<ChartTooltip />} />
                    <Legend iconSize={8} layout="horizontal" verticalAlign="bottom"
                      wrapperStyle={{ fontSize: '9px', fontWeight: 600, color: '#94a3b8', paddingTop: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ paddingBottom: 40 }}>
                  <div className="text-center">
                    <span className="text-3xl font-black text-white leading-none">
                      {carrierDonutData.reduce((sum, d) => sum + d.value, 0).toLocaleString()}
                    </span>
                    <p className="text-[7.5px] text-cyan-400 uppercase tracking-[0.2em] font-black mt-2">Total TEUs</p>
                    <div className="mt-1 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                       <span className="text-[8px] text-cyan-300 font-bold uppercase">{carrierDonutData.length} Carriers</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Carrier Utilisation — real data: allocated vs booked per carrier */}
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 }}
              className="bg-[#0b0f19]/80 border border-white/5 rounded-3xl p-6 shadow-lg relative overflow-hidden flex flex-col">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white flex items-center gap-2 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" /> Carrier Utilisation
              </h3>
              <p className="text-[9px] text-slate-500 mb-3 tracking-widest">Allocated vs Actual Bookings by Carrier</p>
              <div className="mb-3 px-3 py-2 rounded-xl bg-amber-500/5 border border-amber-500/20 text-[9px] text-amber-400/80 leading-relaxed">
                <span className="font-black">Data:</span> CW booking log. Allocated = contracted weekly TEU from contract register. Booked = actual TEU. Red ≤80%, Green &gt;80%.
              </div>
              <div className="flex-1 overflow-y-auto elegant-scrollbar space-y-1.5 max-h-[310px]">
                {CARRIER_BREAKDOWN
                  .filter(c => c.carrier !== '0')
                  .map(c => ({ ...c, displayName: c.carrier.replace(/_[A-Z]{2}$/, '') }))
                  .sort((a, b) => b.teu - a.teu)
                  .slice(0, 10)
                  .map((r, i) => {
                    const booked = filteredBookings
                      .filter(b => (b.carrierName || b.plannedCarrier || '').replace(/_[A-Z]{2}$/, '') === r.displayName)
                      .reduce((s, b) => s + (b.teu || 0), 0);
                    const alloc = r.teu;
                    const pct   = alloc > 0 ? Math.round((booked / alloc) * 100) : 0;
                    const bar   = pct > 80 ? '#10b981' : '#f43f5e';
                    const txt   = pct > 80 ? 'text-emerald-400' : 'text-rose-400';
                    return (
                      <div key={i} className="px-3 py-2 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono text-[10px] font-black text-white tracking-widest">{r.displayName}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] text-slate-500">{r.bookings} bkgs</span>
                            <span className={`font-mono text-xs font-black ${txt}`}>{pct}%</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(pct, 100)}%`, background: bar }} />
                          </div>
                          <span className="text-[8px] text-slate-600 font-mono shrink-0">{Math.round(booked)}/{Math.round(alloc)}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </motion.div>
          </div>

          {/* ── Contract Utilisation Matrix + Live Feed ── */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
            className="grid grid-cols-1 xl:grid-cols-4 gap-6">

            {/* Matrix */}
            <div className="xl:col-span-3 bg-[#0b0f19]/80 border border-white/5 rounded-3xl overflow-hidden shadow-lg flex flex-col">

              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/5 flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="text-xs font-black text-white tracking-[0.2em] uppercase">Contract Utilisation Matrix</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-widest">
                      {filteredBookings.length} bookings · {contractMatrixData.length} contracts
                    </div>
                  </div>
                  <div className="px-3 py-1.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono font-bold">
                    {contractMatrixData.length} ACTIVE
                  </div>
                </div>
                {/* Matrix sub-filters */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex flex-col gap-1">
                    <span className="text-[8px] font-black text-purple-400 tracking-widest uppercase">Branch</span>
                    <select value={matrixBranchFilter} onChange={e => setMatrixBranchFilter(e.target.value)}
                      className="bg-[#05070a] border border-white/10 rounded-xl px-3 py-2 text-[10px] font-bold text-white appearance-none cursor-pointer focus:outline-none focus:border-purple-500/50">
                      <option value="ALL">All Branches</option>
                      {BRANCHES.map(b => <option key={b.code} value={b.code}>{b.code} – {b.name}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[8px] font-black text-cyan-400 tracking-widest uppercase">Contract</span>
                    <select value={matrixContractFilter} onChange={e => setMatrixContractFilter(e.target.value)}
                      className="bg-[#05070a] border border-white/10 rounded-xl px-3 py-2 text-[10px] font-bold text-white appearance-none cursor-pointer focus:outline-none focus:border-cyan-500/50">
                      <option value="ALL">All Contracts</option>
                      {CONTRACT_UTIL_DATA.map(c => <option key={c.id} value={c.id}>{c.id}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Bar chart */}
              <div className="h-[300px] p-6 pb-2 border-b border-white/5">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={mounted ? contractMatrixData : []} margin={{ top: 10, right: 30, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="bgBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1e1b4b" stopOpacity={0.8} /><stop offset="100%" stopColor="#0f172a" stopOpacity={0.4} /></linearGradient>
                      <linearGradient id="cyanBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#06b6d4" /><stop offset="100%" stopColor="#06b6d4" stopOpacity={0.2} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="id" stroke="#64748b" tickLine={false} axisLine={false} fontSize={10} fontFamily="monospace" />
                    <YAxis yAxisId="l" stroke="#64748b" tickLine={false} axisLine={false} fontSize={10} />
                    <YAxis yAxisId="r" orientation="right" stroke="#f43f5e" tickLine={false} axisLine={false} fontSize={10} tickFormatter={v => `${v}%`} />
                    <RechartsTooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar yAxisId="l" dataKey="Allocated" fill="url(#bgBar)" barSize={20} radius={[6,6,0,0]} name="Allocated" isAnimationActive stroke="#4f46e5" strokeOpacity={0.3} strokeWidth={1} />
                    <Bar yAxisId="l" dataKey="Booked"    fill="url(#cyanBar)" barSize={20} radius={[6,6,0,0]} name="Booked"    isAnimationActive />
                    <Line yAxisId="r" type="monotone" dataKey="Utilisation" stroke="#f43f5e" strokeWidth={2.5} name="Utilisation %"
                      dot={{ fill: '#0a0f1c', stroke: '#f43f5e', strokeWidth: 2, r: 4 }} activeDot={{ r: 7 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Table */}
              <div className="overflow-x-auto elegant-scrollbar">
                <table className="w-full text-left whitespace-nowrap">
                  <thead className="bg-[#05070a]/60">
                    <tr className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-bold border-b border-white/5">
                      <th className="px-6 py-3">Contract</th>
                      <th className="px-6 py-3">Carrier</th>
                      <th className="px-6 py-3 text-right">Allocated</th>
                      <th className="px-6 py-3 text-right">Booked</th>
                      <th className="px-6 py-3 text-right" title="Remaining unfilled allocation. Red = under-booked.">Under-filled</th>
                      <th className="px-6 py-3 w-40">Utilisation</th>
                      <th className="px-3 py-3 text-center text-purple-400" title="Sydney TEU booked">SYD</th>
                      <th className="px-3 py-3 text-center text-purple-300" title="Melbourne TEU booked">MEL</th>
                      <th className="px-3 py-3 text-center text-purple-200" title="Brisbane TEU booked">BNE</th>
                      <th className="px-3 py-3 text-center text-fuchsia-400" title="Fremantle TEU booked">FRE</th>
                      <th className="px-3 py-3 text-center text-violet-300" title="Adelaide TEU booked">ADL</th>
                      <th className="px-6 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contractMatrixData.map(ct => (
                      <tr key={ct.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors group">
                        <td className="px-6 py-5 font-mono text-xs font-bold text-cyan-300">{ct.id}</td>
                        <td className="px-6 py-5">
                          <div className="text-sm text-white font-bold group-hover:text-cyan-300 transition-colors">{ct.carrier}</div>
                          <div className="text-[10px] text-slate-500 uppercase tracking-widest">{ct.lane}</div>
                        </td>
                        <td className="px-6 py-5 font-mono text-sm text-slate-300 text-right">
                          <TacticalNumber value={ct.Allocated.toLocaleString()} />
                        </td>
                        <td className={`px-6 py-5 font-mono text-sm text-right font-bold ${ct.Utilisation <= 80 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          <TacticalNumber value={ct.Booked.toLocaleString()} />
                        </td>
                        <td className={`px-6 py-5 font-mono text-sm text-right font-bold ${ct.avail > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {ct.avail > 0 ? (
                            <span title="Under-filled: allocation not met"><TacticalNumber value={ct.avail.toLocaleString()} /> ▼</span>
                          ) : (
                            <span title="Fully or over-utilised"><TacticalNumber value={Math.abs(ct.avail).toLocaleString()} /> ↑</span>
                          )}
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(ct.Utilisation, 100)}%` }}
                                transition={{ duration: 1, ease: 'easeOut' }}
                                className={`h-full rounded-full ${ct.status.bar}`} />
                            </div>
                            <span className="font-mono text-xs font-bold text-white w-10 text-right">
                              <TacticalNumber value={ct.Utilisation} />%
                            </span>
                          </div>
                        </td>
                        {/* Branch breakdown columns */}
                        <td className="px-3 py-5 text-center font-mono text-[10px] text-purple-300">{(ct as any).sydTeu > 0 ? (ct as any).sydTeu : <span className="text-slate-700">—</span>}</td>
                        <td className="px-3 py-5 text-center font-mono text-[10px] text-purple-200">{(ct as any).melTeu > 0 ? (ct as any).melTeu : <span className="text-slate-700">—</span>}</td>
                        <td className="px-3 py-5 text-center font-mono text-[10px] text-purple-100">{(ct as any).bneTeu > 0 ? (ct as any).bneTeu : <span className="text-slate-700">—</span>}</td>
                        <td className="px-3 py-5 text-center font-mono text-[10px] text-fuchsia-400">{(ct as any).freTeu > 0 ? (ct as any).freTeu : <span className="text-slate-700">—</span>}</td>
                        <td className="px-3 py-5 text-center font-mono text-[10px] text-violet-300">{(ct as any).adlTeu > 0 ? (ct as any).adlTeu : <span className="text-slate-700">—</span>}</td>
                        <td className="px-6 py-5 text-right">
                          <span className={`px-3 py-1.5 rounded text-[9px] font-black tracking-widest uppercase ${ct.status.cls}`}>
                            {ct.status.label}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {contractMatrixData.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-500 text-xs font-mono uppercase tracking-widest">
                          No contracts match the current filter selection
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Live Feed */}
            <div className="flex flex-col bg-[#0b0f19]/80 border border-white/5 rounded-3xl overflow-hidden shadow-lg relative">
              <div className="absolute inset-x-0 -top-px h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-80" />
              <div className="flex items-center justify-between p-5 border-b border-white/5">
                <div className="text-xs font-black text-cyan-200 tracking-[0.2em] uppercase">📡 Live Feed</div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-slate-500 font-mono">{liveFeed.length} items</span>
                  <div className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[9px] font-mono font-bold animate-pulse">CW1</div>
                </div>
              </div>
              <div className="px-5 py-2 border-b border-white/5 bg-rose-500/5">
                <p className="text-[9px] text-rose-400/80 font-mono">⚠ LARGE BOOKING flagged at ≥ 6 TEU</p>
              </div>
              <div className="overflow-y-auto elegant-scrollbar flex-1 max-h-[700px]">
                {liveFeed.length === 0 && (
                  <div className="p-8 text-center text-xs text-slate-500 font-mono">No records match current filters</div>
                )}
                <AnimatePresence>
                  {liveFeed.map((f, i) => (
                    <motion.div key={`${f.ref}-${i}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }} layout
                      className={`flex gap-3 p-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors ${f.isLarge ? 'bg-rose-500/5' : ''}`}>
                      <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: f.color, boxShadow: `0 0 8px ${f.color}` }} />
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-[11px] font-bold text-white mb-1">{f.ref}</div>
                        <div className="text-[10px] text-slate-400 truncate uppercase tracking-wider">{f.contract} / {f.cargo}</div>
                        <div className="text-[9px] text-slate-600 truncate font-mono">{f.carrier}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] font-black text-slate-300 mb-0.5 tracking-widest">{f.displayBranch}</div>
                        <div className="text-[9px] text-slate-600 font-mono">{f.eta}</div>
                        {f.isLarge && (
                          <div className="mt-1 px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-[8px] font-black text-rose-400 uppercase">LARGE</div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default ProcurementDashboard;
