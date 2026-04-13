import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { ComposedChart, Area, Line, BarChart, Bar, PieChart, Pie, RadarChart, PolarGrid, PolarAngleAxis, Radar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, Legend, ScatterChart, Scatter, ZAxis } from 'recharts';
import { useNavigate } from 'react-router-dom';

// --- DATA ---
const BRANCHES = [
  { code: 'SYD', name: 'Sydney', color: '#a855f7' },
  { code: 'MEL', name: 'Melbourne', color: '#c084fc' },
  { code: 'BNE', name: 'Brisbane', color: '#d8b4fe' },
  { code: 'PER', name: 'Perth', color: '#e879f9' },
  { code: 'ADL', name: 'Adelaide', color: '#f0abfc' },
];

const INIT_CONTRACTS = [
  { id: 'EVG-2601', carrier: 'Evergreen Line', lane: 'AUS–NCSA', alloc: 200, br: { SYD: { a: 60, b: 72 }, MEL: { a: 55, b: 68 }, BNE: { a: 40, b: 44 }, PER: { a: 28, b: 30 }, ADL: { a: 17, b: 17 } } },
  { id: 'MSC-2602', carrier: 'MSC', lane: 'AUS–MEX', alloc: 150, br: { SYD: { a: 45, b: 55 }, MEL: { a: 40, b: 48 }, BNE: { a: 30, b: 22 }, PER: { a: 20, b: 14 }, ADL: { a: 15, b: 9 } } },
  { id: 'CMA-2603', carrier: 'CMA CGM', lane: 'AUS–EUR', alloc: 180, br: { SYD: { a: 55, b: 70 }, MEL: { a: 50, b: 55 }, BNE: { a: 35, b: 30 }, PER: { a: 25, b: 18 }, ADL: { a: 15, b: 9 } } },
  { id: 'ONE-2604', carrier: 'ONE (Ocean Network)', lane: 'AUS–NEA', alloc: 120, br: { SYD: { a: 36, b: 20 }, MEL: { a: 32, b: 18 }, BNE: { a: 24, b: 10 }, PER: { a: 16, b: 4 }, ADL: { a: 12, b: 2 } } },
  { id: 'HMM-2605', carrier: 'HMM', lane: 'AUS–SEA', alloc: 100, br: { SYD: { a: 30, b: 35 }, MEL: { a: 28, b: 30 }, BNE: { a: 20, b: 15 }, PER: { a: 13, b: 7 }, ADL: { a: 9, b: 4 } } },
];

const INIT_FEED = [
  { ref: 'CWO-8823451', contract: 'EVG-2601', branch: 'SYD', cargo: '2×FCL 40HC', time: '2 min ago', color: '#a855f7' },
  { ref: 'CWO-8823448', contract: 'CMA-2603', branch: 'MEL', cargo: '1×FCL 20GP', time: '8 min ago', color: '#c084fc' },
  { ref: 'CWO-8823445', contract: 'MSC-2602', branch: 'BNE', cargo: '3×FCL 40HC', time: '14 min ago', color: '#d8b4fe' },
];

const SPEND_TREND = [
  { month: 'Oct', CapEx: 120, OpEx: 240, Total: 360 },
  { month: 'Nov', CapEx: 135, OpEx: 220, Total: 355 },
  { month: 'Dec', CapEx: 140, OpEx: 280, Total: 420 },
  { month: 'Jan', CapEx: 155, OpEx: 320, Total: 475 },
  { month: 'Feb', CapEx: 170, OpEx: 290, Total: 460 },
  { month: 'Mar', CapEx: 190, OpEx: 350, Total: 540 },
];

const CATEGORY_PIE = [
  { name: 'Logistics', value: 45, color: '#a855f7' },
  { name: 'IT Infra', value: 25, color: '#06b6d4' },
  { name: 'Marketing', value: 15, color: '#f43f5e' },
  { name: 'Facilities', value: 10, color: '#f59e0b' },
  { name: 'Legal', value: 5, color: '#10b981' },
];

const CARRIER_EFFICIENCIES = [
  { carrier: 'EVG', index: 95, target: 90 },
  { carrier: 'MSC', index: 82, target: 90 },
  { carrier: 'CMA', index: 78, target: 90 },
  { carrier: 'ONE', index: 90, target: 90 },
  { carrier: 'HMM', index: 85, target: 90 },
];

const getStatus = (pct: number) => {
  if (pct > 100) return { label: '⚠ Overbooked', cls: 'bg-rose-500/10 text-rose-400 border border-rose-500/30', bar: 'bg-rose-500 glow-rose' };
  if (pct >= 90) return { label: '↑ Near Full', cls: 'bg-amber-500/10 text-amber-400 border border-amber-500/30', bar: 'bg-amber-500 glow-amber' };
  if (pct >= 50) return { label: '✓ On Track', cls: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30', bar: 'bg-emerald-500 glow-emerald' };
  return { label: '▼ Low Uptake', cls: 'bg-purple-900/40 text-purple-300 border border-purple-500/20', bar: 'bg-purple-500 glow-purple' };
};

const ProcurementDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [currentBranch, setCurrentBranch] = useState('ALL');
  const [weekOffset, setWeekOffset] = useState(0);

  // Real-time Sync Engine
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);
  const [syncState, setSyncState] = useState<'IDLE' | 'SYCHRONIZING' | 'LOCKED'>('IDLE');

  const [contracts, setContracts] = useState(INIT_CONTRACTS);
  const [feed, setFeed] = useState(INIT_FEED);
  const [lastSync, setLastSync] = useState('');

  // Staggered component mount trigger
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLastSync(new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    setMounted(true);
  }, []);

  const wk = () => ((12 + weekOffset - 1) % 52) + 1;
  const yr = () => 2026 + Math.floor((12 + weekOffset - 1) / 52);

  const triggerSync = () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncState('SYCHRONIZING');
    setShowSyncSuccess(false);

    setTimeout(() => {
      setSyncState('LOCKED');
      const idx = Math.floor(Math.random() * contracts.length);
      const ct = { ...contracts[idx] };
      const bk = BRANCHES[Math.floor(Math.random() * BRANCHES.length)];
      const newContracts = [...contracts];
      const brData = { ...ct.br };
      const v = brData[bk.code as keyof typeof brData];
      if (v) {
        brData[bk.code as keyof typeof brData] = { ...v, b: Math.max(0, v.b + Math.floor(Math.random() * 5) - 1) };
        ct.br = brData;
        newContracts[idx] = ct;
      }
      setContracts(newContracts);
    }, 1800);

    setTimeout(() => {
      setIsSyncing(false);
      setLastSync(new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setShowSyncSuccess(true);
      setTimeout(() => setShowSyncSuccess(false), 3500);
    }, 2800);
  };

  const nums = (ct: any, branch: string) => {
    if (branch === 'ALL') return { alloc: ct.alloc, booked: Object.values(ct.br).reduce((s: any, v: any) => s + v.b, 0) as number };
    const v = ct.br[branch];
    return v ? { alloc: v.a, booked: v.b } : { alloc: 0, booked: 0 };
  };

  let ta = 0, tb = 0, over = 0, under = 0;
  contracts.forEach(ct => {
    const { alloc, booked } = nums(ct, currentBranch);
    ta += alloc; tb += booked;
    const p = alloc > 0 ? booked / alloc : 0;
    if (p > 1) over++;
    if (p < 0.5) under++;
  });
  const totalPct = ta > 0 ? Math.round((tb / ta) * 100) : 0;

  // Preparing Data for Contract Graph View
  const contractGraphData = contracts.map(ct => {
    const { alloc, booked } = nums(ct, currentBranch);
    const pct = alloc ? Math.round((booked / alloc) * 100) : 0;
    return {
      id: ct.id,
      carrier: ct.carrier,
      Allocated: alloc,
      Booked: booked,
      Utilisation: pct
    };
  });

  // --- COMPONENTS ---

  const TacticalNumber: React.FC<{ value: string | number }> = ({ value }) => {
    const [scrambled, setScrambled] = useState(value);
    useEffect(() => {
      if (syncState === 'SYCHRONIZING') {
        const interval = setInterval(() => { setScrambled(Math.floor(Math.random() * 9999).toString()); }, 50);
        return () => clearInterval(interval);
      } else {
        setScrambled(value);
      }
    }, [syncState, value]);

    return (
      <motion.span key={syncState === 'LOCKED' ? 'locked' : 'scrambling'} initial={syncState === 'SYCHRONIZING' ? { filter: 'blur(3px)', opacity: 0.6 } : { filter: 'blur(0px)', opacity: 1 }} animate={{ filter: 'blur(0px)', opacity: 1 }} className="inline-block transition-all duration-300">
        {scrambled}
      </motion.span>
    );
  };

  const useCardTilt = () => {
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);
    const rotateX = useTransform(mouseY, [-0.5, 0.5], [12, -12]);
    const rotateY = useTransform(mouseX, [-0.5, 0.5], [-12, 12]);
    const handleMouseMove = (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
      mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
    };
    const handleMouseLeave = () => { mouseX.set(0); mouseY.set(0); };
    return { rotateX, rotateY, handleMouseMove, handleMouseLeave };
  };

  const QuantumKpiCard: React.FC<{ k: any; i: number }> = ({ k, i }) => {
    const { rotateX, rotateY, handleMouseMove, handleMouseLeave } = useCardTilt();
    return (
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + (i * 0.1), ease: "easeOut" }} style={{ rotateX, rotateY, transformStyle: "preserve-3d" }} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} className={`bg-[#0a0f1c]/90 backdrop-blur-2xl border border-white/5 border-t-[2px] ${k.c} rounded-[20px] p-6 relative hover:shadow-[0_20px_50px_rgba(168,85,247,0.2)] transition-all duration-500 overflow-hidden group`}>
        <div className={`absolute -right-12 -top-12 w-32 h-32 rounded-full blur-[50px] opacity-20 group-hover:opacity-100 transition-opacity duration-700 ${k.bg.replace('/20', '')}`} />
        <div className={`absolute top-5 right-5 w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] ${k.bg} backdrop-blur-md border border-white/5`}>{k.ic}</div>
        <div className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-500 mb-2 relative z-10">{k.l}</div>
        <div className={`text-4xl font-display font-black tracking-tighter mb-1 relative z-10 drop-shadow-[0_0_10px_currentColor] ${k.color}`}><TacticalNumber value={k.v} /></div>
        <div className="text-[10px] font-mono text-slate-400 relative z-10">{k.s}</div>
      </motion.div>
    );
  };

  const ScanningOverlay = () => {
    const [hex, setHex] = useState('0x6F2A');
    useEffect(() => {
      if (!isSyncing) return;
      const interval = setInterval(() => { setHex('0x' + Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase()); }, 50);
      return () => clearInterval(interval);
    }, [isSyncing]);

    return (
      <AnimatePresence>
        {isSyncing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[500] pointer-events-none overflow-hidden">
            <style>{`
              .glow-laser { box-shadow: 0 0 40px #a855f7, 0 0 80px #c084fc, 0 0 150px #d8b4fe; }
              .refraction { backdrop-filter: hue-rotate(25deg) contrast(1.2) brightness(1.2) blur(3px); }
            `}</style>

            <motion.div animate={{ top: ['-20%', '120%'] }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} className="absolute inset-x-0 h-[300px] refraction z-[501]">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-500/10 to-transparent" />
            </motion.div>
            <motion.div animate={{ top: ['-10%', '110%'] }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} className="absolute left-0 w-full h-[3px] bg-white z-[502] glow-laser" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(168,85,247,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(168,85,247,0.05)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)] opacity-30 z-[500]" />
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  const SyncNotification = () => (
    <AnimatePresence>
      {showSyncSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -40, scale: 0.9, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -20, scale: 0.95, filter: 'blur(10px)' }}
          className="fixed top-28 left-1/2 -translate-x-1/2 z-[501] px-8 py-3 rounded-2xl bg-[#05070a]/90 backdrop-blur-3xl border border-emerald-500/30 shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex items-center gap-4 group"
        >
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/40 relative overflow-hidden">
            <div className="absolute inset-0 bg-emerald-400/20 blur-md animate-pulse" />
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          </div>
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest leading-none mb-1">Status: OK</span>
            <span className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Data Stream Synchronized</span>
          </div>
          {/* Internal Progress Glow */}
          <div className="absolute bottom-0 left-0 h-[2px] bg-emerald-500 rounded-full animate-[sync-progress_3.5s_linear_forwards]" />
        </motion.div>
      )}
    </AnimatePresence>
  );

  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#0b0f19]/80 backdrop-blur-3xl border border-white/10 p-5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.05)]">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white mb-4 pb-2 border-b border-white/5">{label || payload[0]?.payload?.name || payload[0]?.payload?.carrier}</p>
          <div className="flex flex-col gap-2">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center gap-4">
                <div className="w-2.5 h-2.5 rounded shadow-[0_0_10px_currentColor]" style={{ background: entry.color, color: entry.color }} />
                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">{entry.name}</span>
                <span className="text-sm font-mono font-bold text-white ml-auto">{entry.value} {entry.name === 'Utilisation' ? '%' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-[#02050A] text-[#f8fafc] font-inter overflow-x-hidden relative selection:bg-purple-500/30 pb-16">
      <style>{`
        .glow-emerald { box-shadow: 0 0 15px rgba(16,185,129,0.4); }
        .glow-amber { box-shadow: 0 0 15px rgba(245,158,11,0.4); }
        .glow-rose { box-shadow: 0 0 15px rgba(244,63,94,0.4); }
        .glow-purple { box-shadow: 0 0 15px rgba(168,85,247,0.4); }
        
        @keyframes sync-progress {
            0% { width: 0%; }
            100% { width: 100%; }
        }
      `}</style>

      <ScanningOverlay />
      <SyncNotification />

      {/* Cinematic Background Orbs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 blur-[150px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-900/10 blur-[150px] rounded-full mix-blend-screen" />
      </div>

      <main className="w-full max-w-[1920px] mx-auto flex flex-col pt-6 relative z-10 px-4 md:px-8">

        {/* Full-width Control Bar with embedded BACK BUTTON */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-between gap-6 px-6 py-5 bg-[#0a0f1c]/50 backdrop-blur-3xl border border-white/5 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.05)] sticky top-6 z-40 mb-8">
          <div className="flex items-center gap-6">

            <button onClick={() => navigate('/')} className="flex items-center gap-2 pl-4 pr-5 py-2.5 bg-white/[0.03] hover:bg-white/[0.08] rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 hover:text-white transition-all border border-white/5 hover:border-white/20">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              EXIT GATE
            </button>

            <div className="h-10 w-px bg-white/5 mx-2" />

            <div className="flex flex-col gap-1 hidden sm:flex">
              <span className="text-[8px] font-black text-purple-500 tracking-[0.3em] uppercase">Timeframe</span>
              <div className="flex items-center gap-1 bg-[#05070a] border border-white/5 rounded-full p-1 shadow-inner">
                <button onClick={() => setWeekOffset(p => p - 1)} className="w-8 h-8 flex items-center justify-center text-purple-500 bg-transparent hover:bg-purple-500/20 rounded-full transition-all">‹</button>
                <div className="font-mono text-sm px-4 text-white font-bold drop-shadow-md">WK {wk().toString().padStart(2, '0')}</div>
                <button onClick={() => setWeekOffset(p => p + 1)} className="w-8 h-8 flex items-center justify-center text-purple-500 bg-transparent hover:bg-purple-500/20 rounded-full transition-all">›</button>
              </div>
            </div>

            <div className="h-10 w-px bg-white/5 mx-2 hidden lg:block" />

            <div className="flex flex-col gap-1 hidden md:flex">
              <span className="text-[8px] font-black text-purple-500 tracking-[0.3em] uppercase">Branch Node</span>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setCurrentBranch('ALL')} className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${currentBranch === 'ALL' ? 'bg-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.5)] border border-purple-400' : 'bg-transparent border border-white/5 text-slate-400 hover:bg-white/5 hover:text-white'}`}>Global</button>
                {BRANCHES.map(b => (
                  <button key={b.code} onClick={() => setCurrentBranch(b.code)} className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${currentBranch === b.code ? 'bg-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.5)] border border-purple-400' : 'bg-transparent border border-white/5 text-slate-400 hover:bg-white/5 hover:text-white'}`}>{b.code}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end hidden lg:flex">
              <span className="text-[8px] font-black text-slate-500 tracking-[0.3em] uppercase">Network Status</span>
              <span className="font-mono text-xs text-emerald-400 font-bold drop-shadow-[0_0_8px_currentColor]">CW1 LINKED · {lastSync}</span>
            </div>
            <button
              onClick={triggerSync}
              className="relative group px-10 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-full font-black text-white shadow-[0_0_30px_rgba(168,85,247,0.4)] transition-all overflow-hidden flex items-center gap-3 border border-purple-400/50"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              <span className="relative z-10 flex items-center gap-3 text-xs tracking-[0.2em]">
                <svg className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                INITIATE SYNC
              </span>
            </button>
          </div>
        </motion.div>

        <div className="flex flex-col gap-6 w-full">
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 perspective-1000">
            {[
              { c: 'border-t-purple-500', ic: '📦', bg: 'bg-purple-500/20 text-purple-400', color: 'text-white', l: 'Total Allocation', v: ta, s: `TEU · WK ${wk()}` },
              { c: 'border-t-cyan-400', ic: '🛳', bg: 'bg-cyan-400/20 text-cyan-400', color: 'text-cyan-300', l: 'Booked Volume', v: tb, s: `${totalPct}% utilised network` },
              { c: 'border-t-rose-500', ic: '⚠️', bg: 'bg-rose-500/20 text-rose-400', color: 'text-rose-400', l: 'Critical Overbooked', v: over, s: 'Action immediately' },
              { c: 'border-t-emerald-500', ic: '✓', bg: 'bg-emerald-500/20 text-emerald-400', color: 'text-emerald-400', l: 'Healthy Contracts', v: contracts.length - over - under, s: 'Optimal allocation band' }
            ].map((k, i) => (<QuantumKpiCard key={i} k={k} i={i} />))}
          </div>

          {/* THREE AMAZING CHARTS ROW */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[450px]">

            {/* 1. Spend Trend (Composed Bar/Line Chart) */}
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5, duration: 0.8 }} className="bg-[#0b0f19]/80 border border-white/5 rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.05)] relative overflow-hidden group">
              {/* Removed metallic layer */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_center,_rgba(168,85,247,0.07)_0%,_rgba(0,0,0,0)_60%)] pointer-events-none z-0" />

              <div className="flex justify-between items-center mb-8 relative z-10">
                <div className="flex flex-col">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white flex items-center gap-3"><span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse shadow-[0_0_10px_#a855f7]" /> Quarterly Spend Analytics</h3>
                </div>
                <div className="px-3 py-1 bg-[#05070a] rounded-md font-mono text-[9px] text-purple-400 tracking-widest border border-white/10 shadow-inner">USD X1000</div>
              </div>
              <div className="h-[320px] w-full relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={mounted ? SPEND_TREND : []} margin={{ left: -20, right: 0, bottom: 0, top: 10 }} barGap={8}>
                    <defs>
                      <linearGradient id="barColorPurple" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a855f7" stopOpacity={1} /><stop offset="100%" stopColor="#a855f7" stopOpacity={0.2} /></linearGradient>
                      <linearGradient id="barColorCyan" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#06b6d4" stopOpacity={1} /><stop offset="100%" stopColor="#06b6d4" stopOpacity={0.2} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="month" stroke="#64748b" tickLine={false} axisLine={false} fontSize={10} fontFamily="Inter" />
                    <YAxis stroke="#64748b" tickLine={false} axisLine={false} fontSize={10} fontFamily="Inter" />
                    <RechartsTooltip content={<CustomChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                    <Bar dataKey="CapEx" fill="url(#barColorPurple)" radius={[4, 4, 0, 0]} isAnimationActive={true} animationDuration={2500} animationEasing="ease-in-out" barSize={12} />
                    <Bar dataKey="OpEx" fill="url(#barColorCyan)" radius={[4, 4, 0, 0]} isAnimationActive={true} animationDuration={2500} animationEasing="ease-in-out" barSize={12} />
                    <Line type="monotone" dataKey="Total" stroke="#f43f5e" strokeWidth={3} isAnimationActive={true} animationDuration={2500} animationEasing="ease-in-out" dot={{ fill: '#0a0f1c', stroke: '#f43f5e', strokeWidth: 2, r: 4 }} activeDot={{ r: 8, stroke: '#fff', fill: '#f43f5e' }} style={{ filter: 'drop-shadow(0px 5px 10px rgba(244,63,94,0.5))' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* 2. Spend Breakdown (Premium Segmented Cyber Donut) */}
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6, duration: 0.8 }} className="bg-[#0b0f19]/80 border border-white/5 rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.05)] relative overflow-hidden group">
              {/* Removed metallic layer */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_center,_rgba(6,182,212,0.07)_0%,_rgba(0,0,0,0)_60%)] pointer-events-none z-0" />

              <div className="flex justify-between items-center mb-0 relative z-10">
                <div className="flex flex-col">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white flex items-center gap-3"><span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_10px_#06b6d4]" /> Spend Breakdown</h3>
                </div>
              </div>

              <div className="h-[340px] w-full relative z-10 flex pb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      <filter id="cyberGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                      </filter>
                    </defs>
                    <Pie
                      data={mounted ? CATEGORY_PIE : []}
                      cx="50%" cy="50%"
                      innerRadius="65%" outerRadius="85%"
                      paddingAngle={6}
                      dataKey="value"
                      stroke="transparent"
                      cornerRadius={4}
                      isAnimationActive={true}
                      animationDuration={2500}
                      animationEasing="ease-in-out"
                    >
                      {CATEGORY_PIE.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} filter="url(#cyberGlow)" />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<CustomChartTooltip />} />
                    <Legend iconSize={8} layout="horizontal" verticalAlign="bottom" wrapperStyle={{ fontSize: '11px', fontFamily: 'Inter', fontWeight: 600, color: '#94a3b8', paddingTop: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>

                <div className="absolute inset-0 flex items-center justify-center pointer-events-none mb-4">
                  <div className="flex flex-col items-center">
                    <span className="text-3xl font-display font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]"><TacticalNumber value="100" />%</span>
                    <span className="text-[8px] tracking-[0.3em] font-black uppercase text-cyan-500 mt-1">Allocated</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* 3. Carrier Efficiencies (High-Tech Radar Web) */}
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.7, duration: 0.8 }} className="bg-[#0b0f19]/80 border border-white/5 rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.05)] relative overflow-hidden group">
              {/* Removed metallic layer */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_center,_rgba(16,185,129,0.07)_0%,_rgba(0,0,0,0)_60%)] pointer-events-none z-0" />

              <div className="flex justify-between items-center mb-0 relative z-10">
                <div className="flex flex-col">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white flex items-center gap-3"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]" /> Carrier Efficiencies</h3>
                </div>
              </div>
              <div className="h-[360px] w-full relative z-10 -mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={mounted ? CARRIER_EFFICIENCIES : []}>
                    <defs>
                      <linearGradient id="areaEmerald" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.5} /><stop offset="100%" stopColor="#10b981" stopOpacity={0.1} /></linearGradient>
                    </defs>
                    <PolarGrid stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
                    <PolarAngleAxis dataKey="carrier" tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace', fontWeight: 700 }} />

                    {/* Target Threshold Web (Background) */}
                    <Radar name="Benchmark" dataKey="target" stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 4" fill="transparent" isAnimationActive={true} animationDuration={2500} animationEasing="ease-in-out" />

                    {/* Real Data Efficiency Web (Foreground) */}
                    <Radar name="Efficiency Index" dataKey="index" stroke="#10b981" strokeWidth={2} fill="url(#areaEmerald)" fillOpacity={1} isAnimationActive={true} animationDuration={2500} animationEasing="ease-in-out" dot={{ r: 4, fill: '#10b981', stroke: '#fff', strokeWidth: 1 }} />

                    <RechartsTooltip content={<CustomChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'Inter', fontWeight: 600, color: '#94a3b8' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          {/* CONTRACT UTILISATION MATRIX (COMBINED CHART + TABLE) */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.8 }} className="grid grid-cols-1 xl:grid-cols-4 gap-6">

            <div className="xl:col-span-3 bg-[#0b0f19]/80 border border-white/5 rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.05)] flex flex-col relative group">
              {/* Removed metallic layer */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_center,_rgba(34,211,238,0.04)_0%,_rgba(0,0,0,0)_60%)] pointer-events-none z-0" />

              <div className="flex items-center justify-between p-7 border-b border-white/5 bg-gradient-to-r from-white/[0.05] to-transparent relative z-10">
                <div className="flex items-center gap-6">
                  <div className="flex flex-col">
                    <div className="text-xs font-black text-white tracking-[0.2em] uppercase">Contract Utilisation Matrix</div>
                    <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-bold">Real-time allocation vs actuals</div>
                  </div>
                  <div className="text-[10px] font-mono font-bold px-4 py-1.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.3)]">{contracts.length} ACTIVE</div>
                </div>
              </div>

              <div className="flex-1 w-full relative flex flex-col z-10">

                <div className="w-full h-[350px] p-8 pb-4 border-b border-white/5">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={mounted ? contractGraphData : []} margin={{ top: 20, right: 30, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="purpleBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a855f7" stopOpacity={1} /><stop offset="100%" stopColor="#a855f7" stopOpacity={0.1} /></linearGradient>
                        <linearGradient id="cyanBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#06b6d4" stopOpacity={1} /><stop offset="100%" stopColor="#06b6d4" stopOpacity={0.1} /></linearGradient>
                        <linearGradient id="bgBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1e1b4b" stopOpacity={0.8} /><stop offset="100%" stopColor="#0f172a" stopOpacity={0.4} /></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="id" stroke="#64748b" tickLine={false} axisLine={false} fontSize={10} fontFamily="monospace" fontWeight="bold" />
                      <YAxis yAxisId="left" stroke="#64748b" tickLine={false} axisLine={false} fontSize={10} fontFamily="Inter" />
                      <YAxis yAxisId="right" orientation="right" stroke="#f43f5e" tickLine={false} axisLine={false} fontSize={10} fontFamily="Inter" tickFormatter={(v) => `${v}%`} />
                      <RechartsTooltip content={<CustomChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />

                      <Bar yAxisId="left" dataKey="Allocated" fill="url(#bgBar)" barSize={24} radius={[6, 6, 0, 0]} isAnimationActive={true} animationDuration={2500} animationEasing="ease-in-out" stroke="#4f46e5" strokeOpacity={0.3} strokeWidth={1} />
                      <Bar yAxisId="left" dataKey="Booked" fill="url(#cyanBar)" barSize={24} radius={[6, 6, 0, 0]} isAnimationActive={true} animationDuration={2500} animationEasing="ease-in-out" />
                      <Line yAxisId="right" type="monotone" dataKey="Utilisation" stroke="#f43f5e" strokeWidth={3} isAnimationActive={true} animationDuration={2500} animationEasing="ease-in-out" dot={{ fill: '#0a0f1c', stroke: '#f43f5e', strokeWidth: 2, r: 5 }} activeDot={{ r: 8, stroke: '#fff', fill: '#f43f5e' }} style={{ filter: 'drop-shadow(0px 5px 10px rgba(244,63,94,0.5))' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                <div className="overflow-x-auto min-h-[400px] elegant-scrollbar">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-[#05070a]/50">
                      <tr className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-bold border-b border-white/5">
                        <th className="px-7 py-4">Contract Ref</th>
                        <th className="px-7 py-4">Global Carrier</th>
                        <th className="px-7 py-4 text-right">Allocated</th>
                        <th className="px-7 py-4 text-right">Booked</th>
                        <th className="px-7 py-4 text-right">Variance</th>
                        <th className="px-7 py-4 w-56">Utilisation Gradient</th>
                        <th className="px-7 py-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contracts.map((ct) => {
                        const { alloc, booked } = nums(ct, currentBranch);
                        if (!alloc) return null;
                        const pct = Math.round((booked / alloc) * 100);
                        const avail = alloc - booked;
                        const st = getStatus(pct);
                        return (
                          <tr key={ct.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors group">
                            <td className="px-7 py-6 font-mono text-xs text-cyan-300 font-bold drop-shadow-[0_0_5px_currentColor]">{ct.id}</td>
                            <td className="px-7 py-6">
                              <div className="text-sm text-white font-bold group-hover:text-cyan-300 transition-colors">{ct.carrier}</div>
                              <div className="text-[10px] text-slate-500 mt-1 tracking-widest uppercase font-bold">{ct.lane}</div>
                            </td>
                            <td className="px-7 py-6 font-mono text-sm text-slate-300 text-right"><TacticalNumber value={alloc} /></td>
                            <td className={`px-7 py-6 font-mono text-sm text-right ${pct > 100 ? 'text-rose-400 font-bold drop-shadow-[0_0_5px_currentColor]' : pct < 50 ? 'text-amber-400' : 'text-slate-300'}`}><TacticalNumber value={booked} /></td>
                            <td className={`px-7 py-6 font-mono text-sm text-right ${avail < 0 ? 'text-rose-400 font-black' : 'text-slate-300'}`}><TacticalNumber value={Math.abs(avail)} /> {avail < 0 && '▼'}</td>
                            <td className="px-7 py-6">
                              <div className="flex items-center gap-4">
                                <div className="flex-1 h-2 bg-[#02050A] rounded-full overflow-hidden border border-white/5 relative shadow-inner">
                                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(pct, 100)}%` }} transition={{ duration: 1.5, ease: "easeOut" }} className={`absolute top-0 left-0 h-full rounded-full ${st.bar} shadow-[0_0_15px_currentColor]`} />
                                </div>
                                <span className="font-mono text-xs text-white w-10 text-right font-bold"><TacticalNumber value={pct} />%</span>
                              </div>
                            </td>
                            <td className="px-7 py-6 text-right">
                              <span className={`inline-flex px-3 py-1.5 rounded text-[9px] font-black tracking-[0.2em] uppercase ${st.cls}`}>{st.label}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="bg-[#0b0f19]/80 border border-white/5 rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.05)] flex flex-col flex-1 relative group">
                {/* Removed metallic layer */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_center,_rgba(6,182,212,0.04)_0%,_rgba(0,0,0,0)_60%)] pointer-events-none z-0" />

                <div className="absolute inset-x-0 -top-px h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-80 shadow-[0_0_10px_#06b6d4] z-10" />
                <div className="flex items-center justify-between p-6 border-b border-white/5 z-10">
                  <div className="text-xs font-black text-cyan-200 tracking-[0.2em] uppercase">📡 Live Feed</div>
                  <div className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 animate-pulse drop-shadow-[0_0_8px_#06b6d4]">CW1</div>
                </div>
                <div className="overflow-y-auto elegant-scrollbar flex-1 max-h-[750px] z-10">
                  {feed.length === 0 && <div className="p-8 text-center text-xs text-slate-500 font-mono">No network events</div>}
                  <AnimatePresence>
                    {feed.map((f, i) => (
                      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ type: "spring" }} layout key={`${f.ref}-${i}`} className="flex gap-4 p-5 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 shadow-[0_0_10px_currentColor]" style={{ background: f.color, color: f.color }} />
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-[11px] font-bold text-white mb-1 drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]">{f.ref}</div>
                          <div className="text-[10px] text-slate-400 truncate uppercase tracking-wider font-bold">{f.contract} <span className="opacity-50">/</span> {f.cargo}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[10px] font-black text-slate-300 mb-1 tracking-widest uppercase">{f.branch}</div>
                          <div className="font-mono text-[9px] text-slate-500">{f.time}</div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </div>

          </motion.div>

        </div>

      </main>
    </div>
  );
};

export default ProcurementDashboard;
