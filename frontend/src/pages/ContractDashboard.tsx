import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { ComposedChart, Area, Line, Bar, BarChart, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import Navbar from '../components/Navbar';
import { BOOKING_LOG_DATA, WEEKLY_TREND_DATA, BRANCH_SNAPSHOT, CONTRACT_UTIL_DATA, ORIGINS, DESTINATIONS, LANES, ALLOCATIONS, PRIORITIES, REGIONS, PORT_HIERARCHY } from '../BookingData';




const AVAILABLE_WEEKS = WEEKLY_TREND_DATA.map(w => w.week);
const totalAlloc = CONTRACT_UTIL_DATA.reduce((sum, item) => sum + item.alloc, 0);
const totalBook = CONTRACT_UTIL_DATA.reduce((sum, item) => sum + item.booked, 0);
const totalUtl = totalAlloc > 0 ? (totalBook / totalAlloc) * 100 : 0;
const overbooked = CONTRACT_UTIL_DATA.filter(c => c.booked > c.alloc).length;
const lowUtil = CONTRACT_UTIL_DATA.filter(c => c.util < 50).length;
const noNodeNum = 'node-';

const KPI_DATA = [
  { id: 'alloc', label: 'TOTAL ALLOCATION', value: totalAlloc.toLocaleString(), sub: 'Max Capacity', accentColor: 'text-indigo-400', shadow: 'shadow-[0_4px_30px_rgba(99,102,241,0.15)]', type: 'bar', percent: 100, barColor: 'bg-indigo-500' },
  { id: 'book', label: 'TOTAL BOOKED', value: round(totalBook).toLocaleString(), sub: 'TEUs Confirmed', accentColor: 'text-cyan-400', shadow: 'shadow-[0_4px_30px_rgba(34,211,238,0.15)]', type: 'bar', percent: totalUtl, barColor: 'bg-cyan-400' },
  { id: 'util', label: 'OVERALL UTIL %', value: Math.round(totalUtl).toString(), decimal: '%', sub: 'Target: 80%', accentColor: 'text-emerald-400', shadow: 'shadow-[0_4px_30px_rgba(52,211,153,0.15)]', type: 'ring', percent: totalUtl, ringColor: '#34d399' },
  { id: 'ovr', label: 'OVERBOOKED', value: overbooked.toString(), sub: 'Active Contracts', accentColor: 'text-rose-500', shadow: 'shadow-[0_4px_30px_rgba(244,63,94,0.15)]', type: 'alert', isPulse: true },
  { id: 'low', label: 'LOW UTILISATION', value: lowUtil.toString(), sub: 'Underperforming', accentColor: 'text-amber-400', shadow: 'shadow-[0_4px_30px_rgba(251,191,36,0.15)]', type: 'text' },
  { id: 'wk', label: 'ACTIVE WEEKS', value: AVAILABLE_WEEKS.length.toString(), sub: 'FY 2025', accentColor: 'text-slate-300', shadow: 'shadow-[0_4px_30px_rgba(148,163,184,0.10)]', type: 'calendar' },
];

const SIDE_TAGS = ['Branch Summary', 'Performance Charts', 'Week Analysis', 'Booking Log', 'Contract Utilisation', 'Branch Allocation'];

function round(num: number) { return Math.round(num); }

/* ─── Component ─── */


const ContractDashboard: React.FC = () => {
  const [activeTag, setActiveTag] = useState('Branch Summary');
  const [selectedWeek, setSelectedWeek] = useState(AVAILABLE_WEEKS[AVAILABLE_WEEKS.length - 1] || 'WK 12');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeKpi, setActiveKpi] = useState<any | null>(null);
  const [isMatrixPreviewOpen, setIsMatrixPreviewOpen] = useState(false);

  const [isBookingBranchModalOpen, setIsBookingBranchModalOpen] = useState(false);
  const [isBookingContractModalOpen, setIsBookingContractModalOpen] = useState(false);
  const [isBookingTableModalOpen, setIsBookingTableModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState('ALL');
  const [selectedOrigin, setSelectedOrigin] = useState('ALL');
  const [selectedDestination, setSelectedDestination] = useState('ALL');
  const [selectedLane, setSelectedLane] = useState('ALL');
  const [selectedAllocation, setSelectedAllocation] = useState('ALL');
  const [selectedPriority, setSelectedPriority] = useState('ALL');
  const [selectedRegion, setSelectedRegion] = useState('ALL');
  const [selectedCountry, setSelectedCountry] = useState('ALL');
  const [selectedPortName, setSelectedPortName] = useState('ALL');
  const [selectedPortCode, setSelectedPortCode] = useState('ALL');
  const [isCuTableModalOpen, setIsCuTableModalOpen] = useState(false);
  const [isBranchTableModalOpen, setIsBranchTableModalOpen] = useState(false);
  const [activeCuKpi, setActiveCuKpi] = useState<any | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);

  // Real-time Data Sync Engine (Scramble-to-Lock)
  const [syncState, setSyncState] = useState<'IDLE' | 'SYCHRONIZING' | 'LOCKED'>('IDLE');

  const handleSyncTrigger = () => {
    setIsSyncing(true);
    setSyncState('SYCHRONIZING');
    setShowSyncSuccess(false);

    // Total scan cycle is 2.8s, but numbers lock at 1.8s (matching line sweep)
    setTimeout(() => {
      setSyncState('LOCKED');
    }, 1800);

    setTimeout(() => {
      setIsSyncing(false);
      setShowSyncSuccess(true);
      setTimeout(() => setShowSyncSuccess(false), 3500);
    }, 2800);
  };

  const TacticalNumber: React.FC<{ value: string | number }> = ({ value }) => {
    const [scrambled, setScrambled] = useState(value);

    useEffect(() => {
      if (syncState === 'SYCHRONIZING') {
        const interval = setInterval(() => {
          setScrambled(Math.floor(Math.random() * 1000).toString());
        }, 80);
        return () => clearInterval(interval);
      } else {
        setScrambled(value);
      }
    }, [syncState, value]);

    return (
      <motion.span
        key={syncState === 'LOCKED' ? 'locked' : 'scrambling'}
        initial={syncState === 'SYCHRONIZING' ? { filter: 'blur(4px)', opacity: 0.6 } : { filter: 'blur(0px)', opacity: 1 }}
        animate={{ filter: 'blur(0px)', opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {scrambled}
      </motion.span>
    );
  };

  // Reactive helper deactivated as we use real data now


  // Derive available contracts from master log
  // Reactive helper deactivated as we use real data now

  // Re-computed Reactive KPIs from Real Data
  const currentWeekTrendRaw = WEEKLY_TREND_DATA.find(i => i.week === selectedWeek) || WEEKLY_TREND_DATA[0];

  // Advanced multi-dimensional trend filtering
  const getFilteredData = () => {
    return BOOKING_LOG_DATA.filter(b => {
      const matchWeek = selectedWeek === 'ALL' || `WK ${b.mscWeek}` === selectedWeek;
      const matchContract = selectedContract === 'ALL' || b.contract === selectedContract;

      const master = CONTRACT_UTIL_DATA.find(c => c.id === b.contract);

      // Match Origin/Dest by looking in the split tokens or the booking data
      const matchOrigin = selectedOrigin === 'ALL' ||
        b.loadPort === selectedOrigin ||
        b.originRegion === selectedOrigin ||
        (master && master.notes && master.notes.toLowerCase().includes(selectedOrigin.toLowerCase()));

      const matchDest = selectedDestination === 'ALL' ||
        b.dischargePort === selectedDestination ||
        b.destRegion === selectedDestination;

      const matchLane = selectedLane === 'ALL' || b.lane === selectedLane;
      const matchPriority = selectedPriority === 'ALL' || b.priority === selectedPriority;
      const matchAlloc = selectedAllocation === 'ALL' || (master && master.notes === selectedAllocation);

      // Hierarchical Filter Matches
      const oPortMeta = PORT_HIERARCHY.find(p => p.code === b.loadPort || p.name === b.loadPort);
      const dPortMeta = PORT_HIERARCHY.find(p => p.code === b.dischargePort || p.name === b.dischargePort);

      const getRegionRobust = (locCode: string, altRegion: string) => {
        if (!locCode) return altRegion;
        const cc = locCode.substring(0, 2).toUpperCase();
        if (['CN', 'JP', 'KR', 'TW', 'HK'].includes(cc)) return 'NEA';
        if (['VN', 'TH', 'ID', 'MY', 'SG', 'PH', 'KH', 'MM'].includes(cc)) return 'SEA';
        if (['AU', 'NZ', 'PG', 'FJ'].includes(cc)) return 'OCE';
        if (['DE', 'NL', 'BE', 'IT', 'FR', 'GB', 'ES', 'PT', 'SE', 'DK', 'FI', 'NO', 'PL'].includes(cc)) return 'EUR';
        if (['US', 'CA', 'MX'].includes(cc)) return 'NAM';
        return altRegion;
      };

      const finalORegion = oPortMeta?.region || getRegionRobust(b.loadPort, b.originRegion);
      const finalDRegion = dPortMeta?.region || getRegionRobust(b.dischargePort, b.destRegion);

      const matchRegion = selectedRegion === 'ALL' || 
        finalORegion === selectedRegion || 
        finalDRegion === selectedRegion ||
        (b.lane && b.lane.includes(selectedRegion)) ||
        b.originRegion === selectedRegion ||
        b.destRegion === selectedRegion;

      const matchCountry = selectedCountry === 'ALL' || (oPortMeta?.country === selectedCountry) || (dPortMeta?.country === selectedCountry);
      const matchPortName = selectedPortName === 'ALL' || (oPortMeta?.name === selectedPortName) || (dPortMeta?.name === selectedPortName);
      const matchPortCode = selectedPortCode === 'ALL' || (oPortMeta?.code === selectedPortCode) || (dPortMeta?.code === selectedPortCode);

      return matchWeek && matchContract && matchOrigin && matchDest && matchLane && matchPriority && matchAlloc &&
        matchRegion && matchCountry && matchPortName && matchPortCode;
    });
  };

  const filteredBookings = getFilteredData();

  const activeWeekCount = selectedWeek === 'ALL' ? AVAILABLE_WEEKS.length : 1;
  const weekScale = activeWeekCount / AVAILABLE_WEEKS.length;

  const getContractMetrics = () => {
    const bookedNode = filteredBookings.reduce((sum, b) => sum + (b.teu || 0), 0);
    
    const isAllFiltersClear = selectedContract === 'ALL' && 
      selectedOrigin === 'ALL' && 
      selectedDestination === 'ALL' && 
      selectedLane === 'ALL' &&
      selectedAllocation === 'ALL' &&
      selectedPriority === 'ALL' &&
      selectedRegion === 'ALL' &&
      selectedCountry === 'ALL' &&
      selectedPortName === 'ALL' &&
      selectedPortCode === 'ALL';

    let allocNode = 0;

    if (isAllFiltersClear) {
      allocNode = currentWeekTrendRaw.alloc;
    } else {
      const contractSummaryItem = CONTRACT_UTIL_DATA
        .find(c => c.id === selectedContract || c.carrier === selectedContract);

      const activeContractIds = new Set(filteredBookings.map(b => b.contract));
      allocNode = contractSummaryItem 
        ? Math.round(contractSummaryItem.alloc * weekScale)
        : CONTRACT_UTIL_DATA
            .filter(c => activeContractIds.has(c.id))
            .reduce((sum, c) => sum + Math.round(c.alloc * weekScale), 0);
    }

    const utilNode = allocNode > 0 ? (bookedNode / allocNode) * 100 : 0;

    return { alloc: allocNode, booked: bookedNode, util: utilNode };
  };

  const contractMetrics = getContractMetrics();

  const reactiveKpis = [
    { ...KPI_DATA[0], value: contractMetrics.alloc.toLocaleString() },
    { ...KPI_DATA[1], value: contractMetrics.booked.toLocaleString(), percent: contractMetrics.util },
    { ...KPI_DATA[2], value: contractMetrics.util.toFixed(1), percent: contractMetrics.util },
    {
      ...KPI_DATA[3], value: CONTRACT_UTIL_DATA
        .filter(c => (selectedContract === 'ALL' || c.id === selectedContract) && c.util > 100).length.toString()
    },
    {
      ...KPI_DATA[4], value: CONTRACT_UTIL_DATA
        .filter(c => (selectedContract === 'ALL' || c.id === selectedContract) && c.util < 50).length.toString()
    },
    { ...KPI_DATA[5], value: selectedWeek === 'ALL' ? 'ALL' : selectedWeek.split(' ')[1] },
  ];

  // Performance Matrix Derivation
  const CONTRACT_WEEKLY_BREAKDOWN = Array.from(new Set(filteredBookings.map(b => b.contract))).map(cid => {
    const contractBookings = filteredBookings.filter(b => b.contract === cid);
    const weeklyData: Record<string, any> = {};

    AVAILABLE_WEEKS.forEach(wk => {
      const wkNum = wk.split(' ')[1];
      const wkBookings = contractBookings.filter(b => b.mscWeek === wkNum);
      const booked = wkBookings.reduce((s, b) => s + b.teu, 0);
      const master = CONTRACT_UTIL_DATA.find(c => c.id === cid);
      const weeklyAlloc = master ? (master.alloc / AVAILABLE_WEEKS.length) : 0;
      weeklyData[wk] = { alloc: weeklyAlloc, booked, util: weeklyAlloc > 0 ? (booked / weeklyAlloc) * 100 : 0 };
    });

    return {
      contract: cid,
      type: 'TOTAL',
      data: weeklyData
    };
  });


  const reactiveBranchSnapshot = (() => {
    const knownBranches = new Set(BRANCH_SNAPSHOT.map(b => b.branch));
    const snapshot = BRANCH_SNAPSHOT.map(b => {
      // If contract or week is selected, we need to show hub performance appropriately
      const scaledAlloc = Math.round(b.alloc * weekScale);
      
      // Auto-merge Fremantle (FR1) into Perth (PR1) if it appears in bookings
      const matchBranches = b.branch === 'PR1' ? ['PR1', 'FR1'] : [b.branch];
      const hubBookings = filteredBookings.filter(row => matchBranches.includes(row.branch));
      const booked = hubBookings.reduce((sum, row) => sum + (row.teu || 0), 0);
      const utilFloat = scaledAlloc > 0 ? (booked / scaledAlloc) * 100 : 0;
      
      return { ...b, alloc: scaledAlloc, booked, avail: scaledAlloc - booked, util: Number(utilFloat.toFixed(1)), utilFloat };
    });

    // Check if any bookings are completely unmatched and create OTHER category
    const unmatchedBookings = filteredBookings.filter(b => !knownBranches.has(b.branch) && b.branch !== 'FR1');
    const otherBooked = unmatchedBookings.reduce((sum, b) => sum + (b.teu || 0), 0);
    
    if (otherBooked > 0) {
      snapshot.push({
        branch: 'OTH',
        branchName: 'OTHER PORTS',
        alloc: 0,
        booked: otherBooked,
        avail: -otherBooked,
        util: 0,
        utilFloat: 0,
        status: 'Unplanned'
      });
    }

    return snapshot;
  })();

  const reactiveContractUtilData = CONTRACT_UTIL_DATA
    .filter(c => selectedContract === 'ALL' || c.id === selectedContract)
    .map(c => {
      const scaledAlloc = Math.round(c.alloc * weekScale);
      const contractBookings = filteredBookings.filter(b => b.contract === c.id);
      const booked = contractBookings.reduce((sum, b) => sum + (b.teu || 0), 0);
      const util = scaledAlloc > 0 ? (booked / scaledAlloc) * 100 : 0;

      const getBranchBooked = (branchCodes: string[]) => {
        return contractBookings
          .filter(b => branchCodes.includes(b.branch))
          .reduce((sum, b) => sum + (b.teu || 0), 0);
      };

      return {
        ...c,
        alloc: scaledAlloc,
        booked,
        util,
        syd: { ...c.syd, booked: getBranchBooked(['SYDNEY', 'SY1']) },
        mel: { ...c.mel, booked: getBranchBooked(['MELBOURNE', 'ME1']) },
        bne: { ...c.bne, booked: getBranchBooked(['BRISBANE', 'BN1']) },
        per: { ...c.per, booked: getBranchBooked(['PERTH', 'PR1']) },
        adl: { ...c.adl, booked: getBranchBooked(['ADELAIDE', 'AD1']) }
      };
    });

  // Simplified booking aggregations for summary insights
  const reactiveBookingBranchSummary = filteredBookings
    .reduce((acc, curr) => {
      const existing = acc.find(a => a.branch === curr.branch);
      if (existing) {
        existing.teu += curr.teu || 0;
        existing.bookings += 1;
      } else {
        acc.push({ branch: curr.branch, code: curr.branch, teu: curr.teu || 0, bookings: 1 });
      }
      return acc;
    }, [] as any[]);

  // Derive reactive weekly trend
  const reactiveWeeklyTrendData = AVAILABLE_WEEKS.map(wk => {
    const wkNum = wk.split(' ')[1];
    const wkBookings = filteredBookings.filter(b => b.mscWeek === wkNum);
    const booked = wkBookings.reduce((sum, b) => sum + (b.teu || 0), 0);

    // Determine the relevant allocation scope based on filters
    let relevantContracts = CONTRACT_UTIL_DATA;
    if (selectedContract !== 'ALL') relevantContracts = relevantContracts.filter(c => c.id === selectedContract);
    if (selectedDestination !== 'ALL') relevantContracts = relevantContracts.filter(c => c.lane === selectedDestination);
    if (selectedPriority !== 'ALL') relevantContracts = relevantContracts.filter(c => c.priority === selectedPriority);

    const alloc = relevantContracts.reduce((sum, c) => sum + (c.alloc || 0), 0);
    const util = alloc > 0 ? (booked / alloc) * 100 : 0;

    return {
      week: wk,
      alloc: round(alloc),
      booked: Number(booked.toFixed(1)),
      util: Number(util.toFixed(1))
    };
  });

  const reactiveBookingContractBreakdown = filteredBookings
    .reduce((acc, curr) => {
      const existing = acc.find(a => a.contract === curr.contract);
      if (existing) {
        existing.teu += curr.teu || 0;
        existing.bookings += 1;
      } else {
        acc.push({ contract: curr.contract, teu: curr.teu || 0, bookings: 1 });
      }
      return acc;
    }, [] as any[]);

  // Dynamic Booking Interpretation Engines (Reactive)
  const highestBranch = reactiveBookingBranchSummary.length > 0
    ? reactiveBookingBranchSummary.reduce((max, obj) => (obj.code !== 'ALL' && obj.teu > max.teu) ? obj : max, reactiveBookingBranchSummary[0])
    : { branch: 'N/A', code: 'N/A', teu: 0 };

  const branchInsight = highestBranch.branch !== 'N/A'
    ? `Dominant volume flows heavily through ${highestBranch.branch} (${highestBranch.teu.toFixed(1)} TEU), vastly outpacing other tracking allocations across the operation.`
    : "No booking activity detected for the selected filters.";

  const highestContract = reactiveBookingContractBreakdown.length > 0
    ? reactiveBookingContractBreakdown.reduce((max, obj) => (obj.teu > max.teu) ? obj : max, reactiveBookingContractBreakdown[0])
    : { contract: 'N/A', teu: 0, bookings: 0 };

  const totalContractTeu = reactiveBookingContractBreakdown.reduce((sum, obj) => sum + obj.teu, 0);
  const contractInsight = highestContract.contract !== 'N/A'
    ? `The ${highestContract.contract} contract anchors the dataset, carrying ${totalContractTeu > 0 ? ((highestContract.teu / totalContractTeu) * 100).toFixed(1) : 0}% of total region capacity with ${highestContract.bookings} recorded bookings.`
    : "No contract-specific volume detected currently.";

  // Dynamic Contract Utilisation Insights (Reactive)
  const cuTotalAlloc = reactiveContractUtilData.reduce((s, r) => s + r.alloc, 0);
  const cuTotalBooked = reactiveContractUtilData.reduce((s, r) => s + r.booked, 0);
  const cuOverallUtil = cuTotalAlloc > 0 ? ((cuTotalBooked / cuTotalAlloc) * 100).toFixed(1) : "0.0";
  const cuOverbooked = reactiveContractUtilData.filter(r => r.util > 100);
  const cuNearFull = reactiveContractUtilData.filter(r => r.util >= 85 && r.util <= 100);
  const cuLowUptake = reactiveContractUtilData.filter(r => r.util < 50);

  const cuTopCarrier = reactiveContractUtilData.length > 0
    ? reactiveContractUtilData.reduce((max, r) => r.booked > max.booked ? r : max, reactiveContractUtilData[0])
    : null;

  const cuLowestCarrier = reactiveContractUtilData.length > 0
    ? reactiveContractUtilData.reduce((min, r) => r.util < min.util ? r : min, reactiveContractUtilData[0])
    : null;

  const cuGraphInsight = (() => {
    if (!cuTopCarrier || !cuLowestCarrier) return "No carrier allocation data available for current selection.";
    const parts: string[] = [];
    if (cuOverbooked.length > 0) parts.push(`${cuOverbooked.length} carrier${cuOverbooked.length > 1 ? 's' : ''} (${cuOverbooked.map(r => r.id).join(', ')}) exceed capacity`);
    if (cuNearFull.length > 0) parts.push(`${cuNearFull.length} near-full (85%+)`);
    if (cuLowUptake.length > 0) parts.push(`${cuLowUptake.length} under 50% fill rate`);
    return `Network operating at ${cuOverallUtil}% overall efficiency across ${reactiveContractUtilData.length} carriers. ${parts.length > 0 ? parts.join('; ') + '. ' : ''}${cuTopCarrier.carrier} leads bookings at ${cuTopCarrier.booked} TEU (${cuTopCarrier.util.toFixed(1)}% util), while ${cuLowestCarrier.carrier} is the lowest at ${cuLowestCarrier.util.toFixed(1)}%.`;
  })();

  const branchMatrixTotals = {
    syd: { alloc: reactiveContractUtilData.reduce((s, r) => s + r.syd.alloc, 0), booked: reactiveContractUtilData.reduce((s, r) => s + r.syd.booked, 0) },
    mel: { alloc: reactiveContractUtilData.reduce((s, r) => s + r.mel.alloc, 0), booked: reactiveContractUtilData.reduce((s, r) => s + r.mel.booked, 0) },
    bne: { alloc: reactiveContractUtilData.reduce((s, r) => s + r.bne.alloc, 0), booked: reactiveContractUtilData.reduce((s, r) => s + r.bne.booked, 0) },
    per: { alloc: reactiveContractUtilData.reduce((s, r) => s + r.per.alloc, 0), booked: reactiveContractUtilData.reduce((s, r) => s + r.per.booked, 0) },
    adl: { alloc: reactiveContractUtilData.reduce((s, r) => s + r.adl.alloc, 0), booked: reactiveContractUtilData.reduce((s, r) => s + r.adl.booked, 0) }
  };

  // 3D Tilt Hook for KPI Cards
  const useCardTilt = () => {
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);
    const rotateX = useTransform(mouseY, [-0.5, 0.5], [10, -10]);
    const rotateY = useTransform(mouseX, [-0.5, 0.5], [-10, 10]);

    const handleMouseMove = (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      mouseX.set(x);
      mouseY.set(y);
    };

    const handleMouseLeave = () => {
      mouseX.set(0);
      mouseY.set(0);
    };

    return { rotateX, rotateY, handleMouseMove, handleMouseLeave };
  };

  const DigitalRain = () => (
    <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none overflow-hidden data-stream-bg">
      <div className="flex justify-around w-full h-full">
        {Array.from({ length: 40 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ y: "-100%" }}
            animate={{ y: "100%" }}
            transition={{ duration: 5 + Math.random() * 10, repeat: Infinity, ease: "linear", delay: Math.random() * 5 }}
            className="w-[1px] h-full bg-gradient-to-b from-transparent via-cyan-500 to-transparent"
          />
        ))}
      </div>
    </div>
  );

  const QuantumKpiCard: React.FC<{ kpi: any; idx: number; onClick: () => void }> = ({ kpi, idx, onClick }) => {
    const { rotateX, rotateY, handleMouseMove, handleMouseLeave } = useCardTilt();
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ opacity: { delay: idx * 0.1, duration: 0.6 }, scale: { delay: idx * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] } }}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={onClick}
        className="flex flex-col p-3 lg:p-4 quantum-glass rounded-[24px] relative overflow-hidden group cursor-pointer min-w-0 hover:quantum-glass-active transition-all duration-300 shadow-2xl"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
        <div className="absolute top-0 left-[20%] right-[20%] h-[1px] opacity-100 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_rgba(34,211,238,1)] transition-transform duration-700 group-hover:scale-150" />
        <span className="text-[9px] lg:text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2 relative z-10 transition-colors break-words">
          {kpi.label}
        </span>
        <div className="flex-1 flex flex-col justify-center relative z-10 w-full min-w-0">
          {kpi.type === 'ring' && (
            <div className="flex flex-col xl:flex-row items-start xl:items-center gap-2 py-1 w-full min-w-0">
              <div className="relative w-10 h-10 lg:w-12 lg:h-12 shrink-0 flex items-center justify-center">
                <svg className="w-10 h-10 lg:w-12 lg:h-12 transform -rotate-90">
                  <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-slate-800 lg:hidden" />
                  <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-800 hidden lg:block" />
                  <circle cx="20" cy="20" r="16" stroke={kpi.ringColor} strokeWidth="3" fill="transparent" strokeDasharray="100" strokeDashoffset={100 - (100 * (kpi.percent || 0)) / 100} className="transition-all duration-1000 ease-out drop-shadow-md lg:hidden" strokeLinecap="round" />
                  <circle cx="24" cy="24" r="20" stroke={kpi.ringColor} strokeWidth="4" fill="transparent" strokeDasharray="125" strokeDashoffset={125 - (125 * (kpi.percent || 0)) / 100} className="transition-all duration-1000 ease-out drop-shadow-md hidden lg:block" strokeLinecap="round" />
                </svg>
                <span className="absolute text-[8px] lg:text-[9px] text-white font-bold"><TacticalNumber value={kpi.value} /></span>
              </div>
              <div className="min-w-0 flex-1">
                <span className={`text-lg lg:text-xl xl:text-2xl font-display font-bold tracking-tight ${kpi.accentColor} truncate block`}>
                  <TacticalNumber value={kpi.value} /><span className="text-[10px] lg:text-xs opacity-60 ml-0.5">{kpi.decimal}</span>
                </span>
              </div>
            </div>
          )}
          {kpi.type === 'bar' && (
            <div className="flex flex-col py-1 min-w-0">
              <span className={`text-xl lg:text-2xl xl:text-3xl font-display font-bold tracking-tight ${kpi.accentColor} mb-2 truncate`}>
                <TacticalNumber value={kpi.value} />
              </span>
              <div className="w-full h-1 lg:h-1.5 bg-slate-800 rounded-full overflow-hidden shrink-0">
                <motion.div initial={{ width: 0 }} animate={{ width: `${kpi.percent}%` }} transition={{ duration: 1 }} className={`h-full ${kpi.barColor}`} />
              </div>
            </div>
          )}
          {kpi.type === 'alert' && (
            <div className="flex items-center gap-1.5 lg:gap-2 py-1 w-full min-w-0">
              <span className={`text-2xl lg:text-3xl xl:text-4xl font-display font-bold tracking-tight ${kpi.accentColor} drop-shadow-lg ${kpi.isPulse ? 'animate-pulse' : ''} truncate`}>
                <TacticalNumber value={kpi.value} />
              </span>
              <div className="bg-rose-500/10 px-1.5 py-1 rounded border border-rose-500/20 shrink-0">
                <svg className="w-3 h-3 lg:w-4 lg:h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
            </div>
          )}
          {(kpi.type === 'text' || kpi.type === 'calendar') && (
            <div className="py-1 w-full min-w-0">
              <span className={`text-xl lg:text-2xl xl:text-3xl font-display font-bold tracking-tight ${kpi.accentColor} truncate block`}>
                <TacticalNumber value={kpi.value} />
              </span>
            </div>
          )}
        </div>
        <span className="block text-[9px] lg:text-[10px] xl:text-xs mt-2 lg:mt-3 text-slate-300 font-medium tracking-wide truncate">
          {kpi.sub}
        </span>
      </motion.div>
    );
  };

  const ScanningOverlay = () => {
    // Dynamic Hex Generator for flickers
    const [hex, setHex] = useState('0x6F2A');
    useEffect(() => {
      if (!isSyncing) return;
      const interval = setInterval(() => {
        setHex('0x' + Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase());
      }, 80);
      return () => clearInterval(interval);
    }, [isSyncing]);

    const NeuralSwarm = () => {
      const particles = Array.from({ length: 40 });
      return (
        <div className="absolute inset-0 overflow-hidden z-[201] pointer-events-none">
          {particles.map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{
                top: ['-10%', '110%'],
                opacity: [0, 1, 1, 0.4, 0],
                x: [Math.random() * 20 - 10, Math.random() * 20 - 10],
              }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: "linear",
                delay: Math.random() * 0.4,
              }}
              className="absolute w-[2px] h-[2px] bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.8)]"
              style={{ left: `${Math.random() * 100}%` }}
            />
          ))}
        </div>
      );
    };

    const DataNodePings = () => (
      <div className="absolute inset-0 z-[204] pointer-events-none">
        {[0.2, 0.4, 0.6, 0.8].map((y, i) => (
          <motion.div
            key={`side-${i}`}
            initial={{ opacity: 0 }}
            animate={isSyncing ? { opacity: [0, 1, 0], scale: [0.5, 1.5, 0.5] } : { opacity: 0 }}
            transition={{ duration: 0.4, delay: y * 1.8, repeat: Infinity }}
            className="absolute left-[340px] w-4 h-4 bg-cyan-400 blur-sm rounded-full shadow-[0_0_15px_cyan]"
            style={{ top: `${y * 100}%` }}
          />
        ))}
        {[0.1, 0.5, 0.9].map((x, i) => (
          <motion.div
            key={`top-${i}`}
            initial={{ opacity: 0 }}
            animate={isSyncing ? { opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] } : { opacity: 0 }}
            transition={{ duration: 0.3, delay: x * 1.8, repeat: Infinity }}
            className="absolute top-[100px] w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_10px_indigo]"
            style={{ left: `${400 + x * 1400}px` }}
          />
        ))}
      </div>
    );

    return (
      <AnimatePresence>
        {isSyncing && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] pointer-events-none"
          >
            <motion.div
              animate={{ top: ['-20%', '120%'] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
              className="absolute inset-x-0 h-[400px] bg-gradient-to-b from-transparent via-cyan-500/[0.03] to-transparent backdrop-blur-[2px] z-[202]"
              style={{ filter: 'hue-rotate(15deg) contrast(1.05)' }}
            />
            <motion.div
              animate={{ top: ['-15%', '115%'] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
              className="absolute left-0 w-full h-[14%] bg-cyan-400/[0.04] shadow-[0_0_150px_rgba(34,211,238,0.2),inset_0__0_20px_rgba(255,255,255,0.1)] z-[202] border-y border-white/20"
              style={{ backdropFilter: 'brightness(1.15) contrast(1.1) blur(2.5px)' }}
            >
              <div className="flex items-center justify-center h-full overflow-hidden opacity-30">
                <span className="text-[14px] font-mono font-black text-cyan-400 tracking-[3em] uppercase animate-pulse">{hex}</span>
              </div>
            </motion.div>
            <NeuralSwarm />
            <motion.div
              animate={{ top: ['-14%', '106%'] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "linear", delay: 0.08 }}
              className="absolute left-0 w-full h-48 bg-gradient-to-b from-cyan-500/20 via-cyan-500/[0.05] to-transparent blur-3xl z-[201]"
            />
            <motion.div
              animate={{ top: ['-10%', '110%'] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
              className="absolute left-0 w-full h-[3px] bg-white z-[203] shadow-[0_0_80px_cyan,0_0_150px_rgba(34,211,238,0.6)]"
            >
              <div className="absolute inset-x-0 -top-px h-[1px] bg-rose-500 opacity-50 blur-[2px]" />
              <div className="absolute inset-x-0 -bottom-px h-[1px] bg-blue-500 opacity-50 blur-[2px]" />
            </motion.div>
            <DataNodePings />
            <div className="absolute inset-0 bg-cyan-500/[0.012] animate-pulse-fast pointer-events-none" />
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
          className="fixed top-28 left-1/2 -translate-x-1/2 z-[101] px-8 py-3 rounded-2xl quantum-glass border border-emerald-500/30 shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex items-center gap-4 group"
        >
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/40 relative">
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

  return (
    <div
      className="min-h-screen flex flex-col text-slate-200 relative overflow-x-hidden"
      style={{ backgroundColor: '#030712' }}
    >
      <DigitalRain />
      <ScanningOverlay />
      <SyncNotification />
      <div className="absolute inset-0 z-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      <div className="absolute top-[-20%] left-[-10%] w-[1200px] h-[1000px] bg-indigo-500/10 rounded-full blur-[150px] pointer-events-none z-0" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[1000px] h-[800px] bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none z-0" />

      <div className="z-20 relative">
        <Navbar
          showBack
          selectedWeek={selectedWeek}
          onWeekChange={setSelectedWeek}
          selectedContract={selectedContract}
          onContractChange={setSelectedContract}
          selectedOrigin={selectedOrigin}
          onOriginChange={setSelectedOrigin}
          selectedDestination={selectedDestination}
          onDestinationChange={setSelectedDestination}
          selectedLane={selectedLane}
          onLaneChange={setSelectedLane}
          selectedAllocation={selectedAllocation}
          onAllocationChange={setSelectedAllocation}
          selectedPriority={selectedPriority}
          onPriorityChange={setSelectedPriority}
          selectedRegion={selectedRegion}
          onRegionChange={(val) => { setSelectedRegion(val); setSelectedCountry('ALL'); setSelectedPortName('ALL'); setSelectedPortCode('ALL'); }}
          selectedCountry={selectedCountry}
          onCountryChange={(val) => { setSelectedCountry(val); setSelectedPortName('ALL'); setSelectedPortCode('ALL'); }}
          selectedPortName={selectedPortName}
          onPortNameChange={(val) => { setSelectedPortName(val); setSelectedPortCode('ALL'); }}
          selectedPortCode={selectedPortCode}
          onPortCodeChange={setSelectedPortCode}
          isSyncing={isSyncing}
          onSync={handleSyncTrigger}
          availableWeeks={AVAILABLE_WEEKS}
          availableContracts={['ALL', ...Array.from(new Set(CONTRACT_UTIL_DATA.map(c => c.id)))]}
          availableOrigins={ORIGINS}
          availableDestinations={DESTINATIONS}
          availableLanes={LANES}
          availableAllocations={ALLOCATIONS}
          availablePriorities={PRIORITIES}
          availableRegions={REGIONS}
          availableCountries={Array.from(new Set(PORT_HIERARCHY.filter(p => selectedRegion === 'ALL' || p.region === selectedRegion).map(p => p.country)))}
          availablePortNames={Array.from(new Set(PORT_HIERARCHY.filter(p => (selectedRegion === 'ALL' || p.region === selectedRegion) && (selectedCountry === 'ALL' || p.country === selectedCountry)).map(p => p.name)))}
          availablePortCodes={Array.from(new Set(PORT_HIERARCHY.filter(p => (selectedRegion === 'ALL' || p.region === selectedRegion) && (selectedCountry === 'ALL' || p.country === selectedCountry) && (selectedPortName === 'ALL' || p.name === selectedPortName)).map(p => p.code)))}
        />
      </div>

      <main className="flex-1 w-full max-w-[1820px] mx-auto px-4 md:px-6 pt-[240px] pb-12 grid grid-cols-1 md:grid-cols-[320px_1fr] gap-8 relative z-10 items-start">

        <aside className="w-full hidden md:flex flex-col bg-[#0b0f19]/80 backdrop-blur-3xl border border-white/5 rounded-[40px] shadow-[0_40px_80px_rgba(0,0,0,0.9),inset_0_1px_1px_rgba(255,255,255,0.05)] group/sidebar overflow-hidden relative h-full">


          <div className="p-6 pb-0 relative z-20">
            <div className="flex items-center gap-4 mb-6">
              <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 8, ease: "linear" }} className="absolute inset-0 border border-cyan-500/30 rounded-xl" />
                <div className="absolute inset-0 bg-cyan-500/20 rounded-xl rotate-45 animate-pulse" />
                <svg className="w-7 h-7 text-cyan-400 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-cyan-500/60 uppercase tracking-[0.4em] leading-none">Intelligence</span>
                <h2 className="text-2xl font-display font-black text-white tracking-widest uppercase mt-1">Contract<span className="text-cyan-400 font-light">.AI</span></h2>
              </div>
            </div>
            <div className="h-[1px] w-full bg-gradient-to-r from-cyan-500/50 via-white/10 to-transparent" />
          </div>

          <div className="flex-1 overflow-y-auto elegant-scrollbar hover-scrollbar px-5 py-8 flex flex-col gap-6 relative z-10">
            {SIDE_TAGS.map((tag, idx) => {
              const shortCode = ['BS', 'PC', 'WA', 'BL', 'CU', 'BA'][idx];
              const nodeNum = '0' + (idx + 1);
              const isActive = activeTag === tag;

              return (
                <button
                  key={tag}
                  onClick={() => setActiveTag(tag)}
                  className="group/node relative w-full text-left outline-none"
                >
                  <div className={`absolute -inset-x-2 -inset-y-3 rounded-2xl border transition-all duration-500 ${isActive
                    ? 'border-cyan-500/40 bg-cyan-500/[0.03] shadow-[0_0_30px_rgba(34,211,238,0.1)]'
                    : 'border-white/[0.02] bg-transparent group-hover/node:border-white/10'
                    }`} />

                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border font-mono text-[9px] font-black tracking-tighter transition-colors ${isActive ? 'bg-cyan-500 text-black border-cyan-400' : 'bg-slate-900 text-slate-300 border-white/5 group-hover/node:text-slate-300'
                          }`}>
                          <span className="opacity-50">{shortCode}</span>
                          <span className="w-[1px] h-2 bg-current opacity-20" />
                          <span>{nodeNum}</span>
                        </div>

                        <div className="flex items-end gap-[1px] h-2.5 opacity-50 group-hover/node:opacity-100 transition-opacity">
                          {[1, 2, 3, 4, 5].map(i => (
                            <motion.div
                              key={i}
                              animate={{ height: isActive ? [4, 10, 4] : [4, 6, 4] }}
                              transition={{ repeat: Infinity, duration: 1, delay: i * 0.15 }}
                              className={`w-[2px] rounded-full ${isActive ? 'bg-cyan-400' : 'bg-slate-700'}`}
                            />
                          ))}
                        </div>
                      </div>

                      <div className={`text-xs font-black uppercase tracking-[0.25em] transition-all duration-300 ${isActive
                        ? 'text-white translate-x-1'
                        : 'text-slate-300 group-hover/node:text-slate-300'
                        }`}>
                        {tag}
                      </div>
                    </div>

                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-500 ${isActive
                      ? 'bg-cyan-500 text-black shadow-[0_0_20px_rgba(34,211,238,0.6)] scale-110'
                      : 'bg-white/[0.03] border border-white/5 text-slate-400 group-hover/node:bg-white/[0.08] group-hover/node:text-slate-400'
                      }`}>
                      <svg className={`w-4 h-4 transition-transform ${isActive ? 'translate-x-0.5' : 'group-hover/node:translate-x-1'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </div>
                  </div>

                  {/* High-Fidelity Corner Scopes (Targeting details) */}
                  {isActive && (
                    <>
                      <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-cyan-400 rounded-tl-sm -translate-x-1 -translate-y-1" />
                      <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-cyan-400 rounded-br-sm translate-x-1 translate-y-1" />
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {/* SIDEBAR TELEMETRY FOOTER REMOVED PER USER REQUEST */}
        </aside>

        {/* Main Content Area - Detached Floating Glass Pane */}
        <div className="flex-1 min-w-0 w-full relative h-full rounded-[40px] bg-[#0b0f19]/70 backdrop-blur-3xl border border-white/5 shadow-[0_50px_100px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.1)] p-8 md:p-14">

          {/* Branch Summary View */}
          {activeTag === 'Branch Summary' && (
            <motion.div
              key={selectedWeek + activeTag}
              initial={{ opacity: 0, filter: 'blur(10px)', y: 20 }} animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col gap-10 w-full"
            >

              {/* Ultra-Premium Header */}
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end pb-8 border-b border-white/[0.05] relative">
                <div className="absolute -bottom-[1px] left-0 w-1/3 h-[1px] bg-gradient-to-r from-cyan-500 to-transparent" />
                <div className="flex flex-col gap-3">
                  <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 w-max mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-[pulse-ring_2s_infinite] shadow-[0_0_10px_rgba(34,211,238,1)]" />
                    <span className="text-[10px] font-bold tracking-[0.2em] text-cyan-400 uppercase">Live Operations Intelligence</span>
                  </div>
                  <h1 className="text-5xl md:text-6xl text-white font-display font-light tracking-tighter">
                    Analytics <span className="font-bold aurora-text animate-[glow-pulse_4s_ease-in-out_infinite] drop-shadow-[0_0_15px_rgba(6,182,212,0.4)]">Nexus</span>
                  </h1>
                </div>
                <div className="mt-6 lg:mt-0 px-5 py-3 bg-[#050505]/60 border border-slate-700/80 rounded-2xl flex items-center gap-4 backdrop-blur-3xl shadow-[0_10px_30px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.05)] transform hover:scale-105 transition-transform duration-500 cursor-default">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-semibold tracking-widest text-slate-300 uppercase">Mission Time</span>
                    <span className="text-sm font-bold tracking-wide text-white"><TacticalNumber value={selectedWeek} /> <span className="text-slate-400 font-medium">| FY 2026</span></span>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-[0_0_20px_rgba(52,211,153,0.5)] text-white relative overflow-hidden">
                    <div className="absolute inset-0 bg-white/20 opacity-0 hover:opacity-100 transition-opacity" />
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  </div>
                </div>
              </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4 xl:gap-6 w-full perspective-1000">
                {reactiveKpis.map((kpi, idx) => (
                  <QuantumKpiCard key={idx} kpi={kpi} idx={idx} onClick={() => setActiveKpi(kpi)} />
                ))}
              </div>

              {/* ── Inline Branch Performance Snapshot Matrix ── */}
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-[28px] bg-[#0b0f19]/80 border border-white/5 backdrop-blur-3xl shadow-[0_20px_40px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.04)] overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05]">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                      <h3 className="text-slate-200 font-semibold text-xs tracking-widest uppercase">Branch Performance Snapshot</h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">Live · Reacts to all active filters</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest">{reactiveBranchSnapshot.length} Hubs</span>
                  </div>
                </div>

                {/* Column Headers */}
                <div className="grid grid-cols-[minmax(120px,2fr)_1fr_1fr_1fr_1.4fr_1.2fr] gap-x-4 bg-white/[0.02] border-b border-white/[0.04] px-6 py-2.5">
                  <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-[0.18em]">Hub</span>
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.18em] text-right">Alloc (TEU)</span>
                  <span className="text-[9px] font-bold text-cyan-500 uppercase tracking-[0.18em] text-right">Booked</span>
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.18em] text-right">Available</span>
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.18em] text-right pr-2">Utilisation</span>
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.18em] text-center">Status</span>
                </div>

                {/* Data Rows */}
                <div className="divide-y divide-white/[0.025]">
                  {reactiveBranchSnapshot.map((row, i) => {
                    const isOverbooked = row.util > 100;
                    const isOnTrack = row.status === 'On Track';
                    const isNearFull = row.status === 'Near Full';
                    const s = isOverbooked
                      ? { badge: 'bg-rose-500/10 text-rose-400 border-rose-500/25', dot: 'bg-rose-400', util: 'text-rose-400', bar: 'bg-rose-400' }
                      : isOnTrack
                        ? { badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25', dot: 'bg-emerald-400', util: 'text-emerald-400', bar: 'bg-emerald-400' }
                        : isNearFull
                          ? { badge: 'bg-amber-500/10 text-amber-400 border-amber-500/25', dot: 'bg-amber-400', util: 'text-amber-400', bar: 'bg-amber-400' }
                          : { badge: 'bg-slate-800/60 text-slate-400 border-slate-700/40', dot: 'bg-slate-600', util: 'text-slate-400', bar: 'bg-slate-600' };
                    return (
                      <div key={i} className="grid grid-cols-[minmax(120px,2fr)_1fr_1fr_1fr_1.4fr_1.2fr] gap-x-4 px-6 py-3 items-center hover:bg-white/[0.015] transition-colors">
                        {/* Hub */}
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                          <span className="font-mono font-bold text-slate-200 text-[12px] tracking-wide">{row.branch}</span>
                          {row.branchName && <span className="text-[10px] text-slate-500 truncate hidden md:block">{row.branchName}</span>}
                        </div>
                        {/* Alloc */}
                        <span className="font-mono text-slate-400 text-[12px] text-right tabular-nums">{row.alloc}</span>
                        {/* Booked */}
                        <div className="flex justify-end">
                          <span className={`font-mono font-bold text-[12px] px-2 py-0.5 rounded-md border tabular-nums ${row.booked > 0 ? 'text-cyan-400 border-cyan-500/20 bg-cyan-500/5' : 'text-slate-600 border-slate-700/30'}`}>
                            {row.booked.toFixed(1)}
                          </span>
                        </div>
                        {/* Available */}
                        <span className={`font-mono text-[12px] text-right tabular-nums ${row.avail < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                          {row.avail < 0 ? `(${Math.abs(row.avail).toFixed(1)})` : row.avail.toFixed(1)}
                        </span>
                        {/* Utilisation + bar */}
                        <div className="flex flex-col items-end gap-1 pr-2">
                          <span className={`font-mono font-semibold text-[12px] tabular-nums ${s.util}`}>{row.util.toFixed(1)}%</span>
                          <div className="w-16 h-[3px] bg-white/5 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${Math.min(row.util, 100)}%` }} />
                          </div>
                        </div>
                        {/* Status */}
                        <div className="flex justify-center">
                          <span className={`px-2.5 py-1 text-[9px] font-bold rounded-full border uppercase tracking-wider whitespace-nowrap ${s.badge}`}>
                            {row.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Totals Footer */}
                <div className="grid grid-cols-[minmax(120px,2fr)_1fr_1fr_1fr_1.4fr_1.2fr] gap-x-4 px-6 py-3 border-t border-white/[0.06] bg-gradient-to-r from-cyan-900/10 to-transparent items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3.5 rounded-full bg-gradient-to-b from-cyan-400 to-indigo-500" />
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">Total</span>
                  </div>
                  <span className="font-mono font-bold text-white text-[12px] text-right tabular-nums">
                    {reactiveBranchSnapshot.reduce((s, r) => s + r.alloc, 0).toFixed(0)}
                  </span>
                  <div className="flex justify-end">
                    <span className="font-mono font-bold text-cyan-400 text-[12px] tabular-nums drop-shadow-[0_0_6px_rgba(34,211,238,0.5)]">
                      {reactiveBranchSnapshot.reduce((s, r) => s + r.booked, 0).toFixed(1)}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-slate-300 text-[12px] text-right tabular-nums">
                    {reactiveBranchSnapshot.reduce((s, r) => s + r.avail, 0).toFixed(1)}
                  </span>
                  <div className="flex justify-end pr-2">
                    {(() => {
                      const tA = reactiveBranchSnapshot.reduce((s, r) => s + r.alloc, 0);
                      const tB = reactiveBranchSnapshot.reduce((s, r) => s + r.booked, 0);
                      return <span className="font-mono font-bold text-white text-[12px]">{tA > 0 ? ((tB / tA) * 100).toFixed(1) : '0.0'}%</span>;
                    })()}
                  </div>
                  <div />
                </div>
              </motion.div>

              {/* Neo-Brutalist Graph Container with Sweep Reflection */}
              <motion.div
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-[40px] bg-[#0b0f19]/80 border border-white/5 backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.9),inset_0_1px_2px_rgba(255,255,255,0.05)] p-8 md:p-10 relative overflow-hidden group"
              >
                {/* Internal Glass Sweep Reflection Layer */}
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-[40px]">
                  <div
                    className="absolute top-0 right-0 bottom-0 left-0 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent w-[300%]"
                    style={{ animation: 'sweep-shine 8s infinite linear' }}
                  />
                </div>

                {/* Internal Deep Glow Effect */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_center,_rgba(99,102,241,0.07)_0%,_rgba(0,0,0,0)_60%)] pointer-events-none z-0" />

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10 pb-6 border-b border-indigo-500/10 relative z-10 transition-transform duration-500">
                  <h2 className="text-xl md:text-2xl font-display font-light text-white tracking-widest flex items-center gap-4 uppercase relative">
                    <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-1.5 h-10 bg-indigo-500 rounded-r-full shadow-[0_0_15px_rgba(99,102,241,0.8)]" />
                    <div className="p-3 bg-[#0b0f19] rounded-xl border border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.2)] text-indigo-400 group-hover:text-indigo-300 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                    </div>
                    <span className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Network Allocation Array</span>
                  </h2>

                  {/* Dedicated Trigger Button */}
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="px-6 py-3 rounded-2xl bg-[#0b0f19] hover:bg-indigo-950/40 border border-white/5 hover:border-cyan-500/50 text-cyan-400 text-xs font-bold uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(34,211,238,0.1)] hover:shadow-[0_0_30px_rgba(34,211,238,0.2)] transition-all flex items-center gap-3 z-20 group/btn"
                  >
                    <svg className="w-4 h-4 group-hover/btn:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                    Open Grid Matrix
                  </button>
                </div>

                <div className="h-[450px] w-full relative z-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={reactiveBranchSnapshot} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} opacity={0.5} />
                      <XAxis dataKey="branch" stroke="#64748b" tickLine={false} axisLine={false} dy={15} fontSize={13} fontWeight={600} />
                      <YAxis stroke="#64748b" tickLine={false} axisLine={false} dx={-10} fontSize={12} />

                      <Tooltip
                        cursor={{ fill: 'rgba(30, 41, 59, 0.2)' }}
                        contentStyle={{ backgroundColor: 'rgba(11, 15, 25, 0.95)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)' }}
                        itemStyle={{ fontFamily: 'monospace', fontWeight: 'bold' }}
                        labelStyle={{ color: '#94a3b8', marginBottom: '8px', fontWeight: '600', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '30px' }} iconType="circle" />

                      <defs>
                        <linearGradient id="colorAllocArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#818cf8" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorAllocBackground" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#312e81" stopOpacity={0.8} />
                          <stop offset="100%" stopColor="#1e1b4b" stopOpacity={0.4} />
                        </linearGradient>
                        <linearGradient id="colorBookedBar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22d3ee" stopOpacity={1} />
                          <stop offset="100%" stopColor="#0891b2" stopOpacity={0.6} />
                        </linearGradient>
                      </defs>

                      {/* Layer 1: Soft glowing area representing the maximum ceiling limit (Allocation) */}
                      <Area type="monotone" dataKey="alloc" name="Base Capacity" fill="url(#colorAllocArea)" stroke="#6366f1" strokeWidth={0} isAnimationActive={true} animationDuration={2500} animationEasing="ease-in-out" />

                      {/* Layer 2: Premium Background bars for Allocation visual scaling */}
                      <Bar dataKey="alloc" name="Planned Ceiling" fill="url(#colorAllocBackground)" radius={[8, 8, 0, 0]} maxBarSize={50} stroke="#6366f1" strokeOpacity={0.3} strokeWidth={1} isAnimationActive={true} animationDuration={2500} animationEasing="ease-in-out" />

                      {/* Layer 3: Vibrant foreground bars for actual Booked */}
                      <Bar dataKey="booked" name="Actual Load" fill="url(#colorBookedBar)" radius={[8, 8, 0, 0]} maxBarSize={30} isAnimationActive={true} animationDuration={2500} animationEasing="ease-in-out">
                        {reactiveBranchSnapshot.map((entry, i) => {
                          const colors: Record<string, string> = {
                            'SYD': '#FF4D4D', 'SY1': '#FF4D4D', 'SYDNEY': '#FF4D4D',
                            'MEL': '#4D96FF', 'ME1': '#4D96FF', 'MELBOURNE': '#4D96FF',
                            'BNE': '#FFD93D', 'BN1': '#FFD93D', 'BRISBANE': '#FFD93D',
                            'PER': '#6BCB77', 'PR1': '#6BCB77', 'PERTH': '#6BCB77',
                            'ADL': '#9B59B6', 'AD1': '#9B59B6', 'ADELAIDE': '#9B59B6'
                          };
                          return <Cell key={i} fill={colors[entry.branch] || colors[entry.code] || '#06b6d4'} />;
                        })}
                      </Bar>

                      {/* Layer 4: Neon tracking line emphasizing the booked trend across branches */}
                      <Line
                        type="monotone"
                        dataKey="booked"
                        name="Flow Vector"
                        stroke="#f8fafc"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        isAnimationActive={true}
                        animationDuration={2500}
                        animationEasing="ease-in-out"
                        dot={(props: any) => {
                          const { cx, cy, index } = props;
                          const currentVal = reactiveBranchSnapshot[index].booked;
                          const prevVal = index === 0 ? currentVal : reactiveBranchSnapshot[index - 1].booked;
                          const isUp = currentVal >= prevVal;
                          const color = isUp ? '#10b981' : '#f43f5e';
                          return (
                            <g key={`dot-${index}`}>
                              <circle cx={cx} cy={cy} r={14} fill={color} opacity={0.15} />
                              <circle cx={cx} cy={cy} r={5} fill="#0b0f19" stroke={color} strokeWidth={2.5} />
                            </g>
                          );
                        }}
                        activeDot={{ r: 8, fill: '#fff', strokeWidth: 0 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Performance Charts View */}
          {activeTag === 'Performance Charts' && (
            <motion.div
              initial={{ opacity: 0, filter: 'blur(10px)', y: 20 }} animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col gap-8 w-full"
            >
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end pb-8 border-b border-white/[0.05] relative">
                <div className="absolute -bottom-[1px] left-0 w-1/3 h-[1px] bg-gradient-to-r from-emerald-500 to-transparent" />
                <div className="flex flex-col gap-3">
                  <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 w-max mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-[pulse-ring_2s_infinite] shadow-[0_0_10px_rgba(52,211,153,1)]" />
                    <span className="text-[10px] font-bold tracking-[0.2em] text-emerald-400 uppercase">Performance Charts Overview</span>
                  </div>
                  <h1 className="text-5xl md:text-6xl text-white font-display font-light tracking-tighter">
                    Week-on-Week <span className="font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Utilisation</span>
                  </h1>
                </div>
              </div>

              {/* HUD Header Control Array (Decommissioned) */}

              {/* Twin Charts Matrix (Moved Top) */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

                {/* Chart 1: Contract Allocation */}
                <div className="rounded-[40px] bg-[#0b0f19]/80 border border-white/5 backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.9),inset_0_1px_2px_rgba(255,255,255,0.05)] p-8 md:p-10 relative overflow-hidden group hover:scale-[1.01] transition-transform duration-500">
                  <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-[40px]">
                    <div className="absolute top-0 right-0 bottom-0 left-0 bg-gradient-to-r from-transparent via-cyan-400/[0.05] to-transparent w-[300%]" style={{ animation: 'sweep-shine 8s infinite linear' }} />
                  </div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_center,_rgba(34,211,238,0.07)_0%,_rgba(0,0,0,0)_60%)] pointer-events-none z-0" />

                  <h4 className="text-[11px] text-slate-300 font-bold uppercase tracking-[0.3em] mb-8 relative z-10 flex items-center justify-between">
                    <span>Contract Target vs Actual</span>
                    <span className="px-3 py-1 bg-white/5 rounded-full font-mono text-[9px] text-emerald-400 border border-emerald-500/20">{selectedWeek === 'ALL' ? 'ALL WKS' : selectedWeek.replace(' ', '')} SYS</span>
                  </h4>

                  <div className="h-[320px] w-full relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={reactiveContractUtilData} margin={{ top: 20, right: 20, bottom: 20, left: -20 }}>
                        <defs>
                          <linearGradient id="cyanNeon" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22d3ee" stopOpacity={1} />
                            <stop offset="100%" stopColor="#0891b2" stopOpacity={0.3} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2dd4bf" vertical={false} opacity={0.05} />
                        <XAxis dataKey="id" stroke="#64748b" tickLine={false} axisLine={false} dy={10} fontSize={11} fontWeight={600} />
                        <YAxis stroke="#475569" tickLine={false} axisLine={false} fontSize={12} />
                        <Tooltip
                          cursor={{ fill: 'rgba(34,211,238,0.05)' }}
                          contentStyle={{ backgroundColor: 'rgba(11, 15, 25, 0.95)', border: '1px solid rgba(34, 211, 238, 0.2)', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.8)' }}
                          itemStyle={{ fontFamily: 'monospace' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                        <Bar dataKey="booked" name="Booked Volume" fill="url(#cyanNeon)" barSize={40} radius={[6, 6, 0, 0]} isAnimationActive={true} animationDuration={2500} animationEasing="ease-in-out" />
                        <Line type="monotone" dataKey="alloc" name="Wk Allocation Target" stroke="#34d399" strokeWidth={4} isAnimationActive={true} animationDuration={2500} animationEasing="ease-in-out" dot={{ r: 4, fill: '#0b0f19', strokeWidth: 3 }} activeDot={{ r: 8, fill: '#fff', strokeWidth: 0 }} style={{ filter: 'drop-shadow(0px 10px 10px rgba(52,211,153,0.5))' }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 2: Branch Utilisation Horizontal */}
                <div className="rounded-[40px] bg-[#0b0f19]/80 border border-white/5 backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.9),inset_0_1px_2px_rgba(255,255,255,0.05)] p-8 md:p-10 relative overflow-hidden group hover:scale-[1.01] transition-transform duration-500">
                  <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-[40px]">
                    <div className="absolute top-0 right-0 bottom-0 left-0 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent w-[300%]" style={{ animation: 'sweep-shine 8s infinite linear' }} />
                  </div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_center,_rgba(99,102,241,0.07)_0%,_rgba(0,0,0,0)_60%)] pointer-events-none z-0" />

                  <h4 className="text-[11px] text-slate-300 font-bold uppercase tracking-[0.3em] mb-8 relative z-10 flex items-center justify-between">
                    <span>Branch Utilisation Coefficient</span>
                    <span className="px-3 py-1 bg-white/5 rounded-full font-mono text-[9px] text-indigo-400 border border-indigo-500/20">{selectedWeek === 'ALL' ? 'ALL WKS' : selectedWeek.replace(' ', '')} RUN</span>
                  </h4>

                  <div className="h-[320px] w-full relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reactiveBranchSnapshot} layout="vertical" margin={{ top: 10, right: 30, bottom: 20, left: 10 }}>
                        <defs>
                          <linearGradient id="indigoNeonHoriz" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#818cf8" stopOpacity={1} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#818cf8" horizontal={false} opacity={0.05} />
                        <XAxis type="number" stroke="#475569" tickLine={false} axisLine={false} dx={0} fontSize={11} tickFormatter={(val) => `${val}%`} />
                        <YAxis type="category" dataKey="branch" stroke="#94a3b8" tickLine={false} axisLine={false} fontSize={12} fontWeight={600} width={80} />
                        <Tooltip
                          cursor={{ fill: 'rgba(99,102,241,0.05)' }}
                          contentStyle={{ backgroundColor: 'rgba(11, 15, 25, 0.95)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.8)' }}
                          formatter={(value: any) => { return [`${Number(value).toFixed(1)}%`, 'Utilisation']; }}
                          itemStyle={{ fontFamily: 'monospace' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                        <Bar dataKey="utilFloat" name="Network Load %" fill="url(#indigoNeonHoriz)" barSize={20} radius={[0, 6, 6, 0]} isAnimationActive={true} animationDuration={2500} animationEasing="ease-in-out" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

              {/* Spread Tables Framework */}
              <div className="flex flex-col gap-8">

                {/* Row 1: Contract Table + Info */}
                <div className="flex flex-col xl:flex-row gap-6">
                  {/* Contract Utilisation Table */}
                  <div className="flex-1 bg-[#0b0f19]/90 border border-white/5 rounded-[24px] overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.6)] flex flex-col group">
                    <div className="bg-gradient-to-r from-indigo-950/40 to-transparent border-b border-indigo-500/20 px-6 py-4 flex items-center justify-between">
                      <h3 className="text-white font-bold tracking-[0.2em] uppercase text-xs flex items-center gap-3 drop-shadow-md">
                        <svg className="w-5 h-5 text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.8)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        Contract Utilisation
                      </h3>
                      <div className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-[9px] font-mono text-indigo-300">LIVE DATA</div>
                    </div>
                    <div className="w-full overflow-x-auto elegant-scrollbar">
                      <table className="w-full text-left border-collapse table-fixed min-w-[900px]">
                        <thead>
                          <tr className="bg-gradient-to-r from-transparent via-cyan-900/10 to-transparent">
                            <th className="px-6 py-4 font-bold text-cyan-400 text-[10px] tracking-[0.2em] font-sans uppercase border-b border-white/10 w-[140px]">Contract</th>
                            <th className="px-6 py-4 font-bold text-cyan-400 text-[10px] tracking-[0.2em] font-sans uppercase border-b border-white/10">Carrier</th>
                            <th className="px-6 py-4 font-bold text-cyan-400 text-[10px] tracking-[0.2em] font-sans uppercase text-center border-b border-white/10">Type</th>
                            <th className="px-6 py-4 font-bold text-cyan-400 text-[10px] tracking-[0.2em] font-sans uppercase text-center border-b border-white/10">Priority</th>
                            <th className="px-6 py-4 font-bold text-cyan-400 text-[10px] tracking-[0.2em] font-sans uppercase text-center border-b border-white/10">Expiry</th>
                            <th className="px-6 py-4 font-bold text-cyan-400 text-[10px] tracking-[0.2em] font-sans uppercase text-right border-b border-white/10">Alloc</th>
                            <th className="px-6 py-4 font-bold text-cyan-400 text-[10px] tracking-[0.2em] font-sans uppercase text-right border-b border-white/10">Booked</th>
                            <th className="px-6 py-4 font-bold text-cyan-400 text-[10px] tracking-[0.2em] font-sans uppercase text-right border-b border-white/10">Util%</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.02]">
                          {(reactiveContractUtilData.length > 0 ? reactiveContractUtilData : []).map((row, i) => (
                            <tr key={i} className="hover:bg-cyan-500/[0.03] transition-colors group/row">
                              <td className="px-6 py-4 border-r border-white/5">
                                <span className="font-sans font-medium text-slate-100 text-[13px] antialiased tracking-wide shadow-sm group-hover/row:text-cyan-400 transition-colors">{row.id}</span>
                              </td>
                              <td className="px-6 py-4 border-r border-white/5 text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                                {row.carrier}
                              </td>
                              <td className="px-6 py-4 text-center border-r border-white/5">
                                <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">{row.type}</span>
                              </td>
                              <td className="px-6 py-4 text-center border-r border-white/5">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md border text-[10px] font-sans font-medium antialiased shadow-inner ${row.priority === 'High' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
                                  row.priority === 'Medium' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                                    'bg-slate-500/10 border-slate-700/50 text-slate-400'
                                  }`}>
                                  <span className={`w-1 h-1 rounded-full ${row.priority === 'High' ? 'bg-rose-500 shadow-[0_0_5px_rgba(244,63,94,0.8)]' :
                                    row.priority === 'Medium' ? 'bg-amber-500 shadow-[0_0_5px_rgba(251,191,36,0.8)]' :
                                      'bg-slate-500'
                                    }`} /> {row.priority}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center border-r border-white/5">
                                <div className="flex flex-col items-center">
                                  <span className="text-[11px] text-slate-300">{row.expiry}</span>
                                  {row.expiry !== 'N/A' && !row.expiry.includes('2026') && (
                                    <span className="text-[8px] text-rose-500 font-bold uppercase animate-pulse">Critical</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right border-r border-white/5">
                                <span className="font-display font-medium text-lg text-slate-300 antialiased tracking-wide">{row.alloc}</span>
                              </td>
                              <td className="px-6 py-4 text-right border-r border-white/5">
                                <span className="font-display font-medium text-lg text-cyan-400 antialiased tracking-wide drop-shadow-[0_0_8px_rgba(34,211,238,0.4)] group-hover/row:text-cyan-300 transition-colors">{row.booked.toFixed(1)}</span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex flex-col items-end gap-1.5">
                                  <span className={`font-display font-medium text-base antialiased tracking-wide ${row.util > 100 ? 'text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.3)]' : 'text-slate-200'}`}>{row.util.toFixed(1)}%</span>
                                  <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden shadow-inner">
                                    <div className={`h-full rounded-full ${row.util > 100 ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]' : 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]'}`} style={{ width: `${Math.min(row.util, 100)}%` }} />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gradient-to-r from-indigo-900/20 to-indigo-900/40 relative group/foot">
                            <td colSpan={5} className="px-6 py-5 font-bold text-white tracking-[0.3em] text-[10px] border-r border-indigo-500/20 uppercase text-center relative">
                              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent" />
                              Network Aggregate Performance
                            </td>
                            <td className="px-6 py-5 border-r border-indigo-500/20 relative">
                              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent" />
                              <span className="block font-mono font-bold text-white text-lg text-right drop-shadow-md">{cuTotalAlloc.toFixed(0)}</span>
                            </td>
                            <td className="px-6 py-5 border-r border-indigo-500/20 relative">
                              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent" />
                              <span className="block font-mono font-bold text-emerald-400 text-lg text-right drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]">{cuTotalBooked.toFixed(1)}</span>
                            </td>
                            <td className="px-6 py-5 relative">
                              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent" />
                              <span className="block font-mono font-bold text-white text-lg text-right drop-shadow-md">{cuOverallUtil}%</span>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Basic Info Panel */}
                  <div className="xl:w-[240px] 2xl:w-[280px] shrink-0 bg-[#0b0f19] border border-white/5 rounded-[24px] p-8 shadow-inner flex flex-col justify-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/5 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                    <h4 className="text-cyan-400 font-bold uppercase tracking-[0.2em] text-xs mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" /> Data Insight
                    </h4>
                    <h2 className="text-xl text-slate-200 font-medium mb-3">Contract Matrix</h2>
                    <p className="text-xs text-slate-300 leading-relaxed mb-6">
                      This data matrix isolates performance across individual contracted agreements, comparing total TEU booked against the weekly designated allocation limits.
                    </p>
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                        <span className="text-xs text-slate-400 font-mono">Monitored Contracts</span>
                        <span className="text-xs font-bold text-slate-200">3 Active Series</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                        <span className="text-xs text-slate-400 font-mono">Highest Network Draw</span>
                        <span className="text-xs font-bold text-amber-400">129% (4319-1-LT)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Row 2: Branch Table + Info */}
                <div className="flex flex-col xl:flex-row gap-6">
                  {/* Branch Utilisation Table */}
                  <div className="flex-1 bg-[#0b0f19]/90 border border-white/5 rounded-[24px] overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.6)] flex flex-col group">
                    <div className="bg-gradient-to-r from-cyan-950/40 to-transparent border-b border-cyan-500/20 px-6 py-4 flex items-center justify-between">
                      <h3 className="text-white font-bold tracking-[0.2em] uppercase text-xs flex items-center gap-3 drop-shadow-md">
                        <svg className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        Branch Utilisation
                      </h3>
                      <div className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-[9px] font-mono text-cyan-300">LIVE DATA</div>
                    </div>
                    <div className="w-full overflow-x-auto elegant-scrollbar">
                      <table className="w-full text-left border-collapse table-fixed min-w-[900px]">
                        <thead>
                          <tr className="bg-gradient-to-r from-transparent via-indigo-900/10 to-transparent">
                            <th className="px-6 py-4 font-bold text-indigo-400 text-[10px] tracking-[0.2em] font-sans uppercase text-center border-b border-white/10 w-24">Code</th>
                            <th className="px-6 py-4 font-bold text-indigo-400 text-[10px] tracking-[0.2em] font-sans uppercase border-b border-white/10">Branch Name</th>
                            <th className="px-6 py-4 font-bold text-indigo-400 text-[10px] tracking-[0.2em] font-sans uppercase text-right border-b border-white/10">Wk Allocation</th>
                            <th className="px-6 py-4 font-bold text-indigo-400 text-[10px] tracking-[0.2em] font-sans uppercase text-right border-b border-white/10">Booked (TEU)</th>
                            <th className="px-6 py-4 font-bold text-indigo-400 text-[10px] tracking-[0.2em] font-sans uppercase text-right border-b border-white/10">Utilisation %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.02]">
                          {reactiveBranchSnapshot.map((row, i) => (
                            <tr key={i} className="hover:bg-indigo-500/[0.03] transition-colors group/row">
                              <td className="px-6 py-4 border-r border-white/5 flex justify-center">
                                <span className="inline-flex items-center justify-center min-w-[40px] h-7 px-2 rounded-md bg-slate-900/80 text-[11px] font-sans font-medium text-slate-300 antialiased border border-slate-700/50 shadow-inner group-hover/row:border-cyan-500/50 group-hover/row:text-cyan-400 transition-colors tracking-wide">{row.code}</span>
                              </td>
                              <td className="px-6 py-4 border-r border-white/5">
                                <span className="font-sans font-medium text-slate-100 text-[15px] antialiased tracking-wide shadow-sm">{row.branch}</span>
                              </td>
                              <td className="px-6 py-4 text-right border-r border-white/5">
                                <span className="font-display font-medium text-xl text-slate-300 antialiased tracking-wide">{row.alloc}</span>
                              </td>
                              <td className="px-6 py-4 text-right border-r border-white/5">
                                <span className="font-display font-medium text-xl text-indigo-400 antialiased tracking-wide drop-shadow-[0_0_8px_rgba(99,102,241,0.4)] group-hover/row:text-indigo-300 transition-colors">{row.booked.toFixed(1)}</span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex flex-col items-end gap-1.5">
                                  <span className={`font-display font-medium text-lg antialiased tracking-wide ${row.util > 100 ? 'text-rose-400 drop-shadow-[0_0_10px_rgba(244,63,94,0.3)]' : 'text-slate-200'} ${row.util === 0 ? 'opacity-40' : ''}`}>{row.util.toFixed(0)}%</span>
                                  <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden shadow-inner">
                                    <div className={`h-full rounded-full ${row.util > 100 ? 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.8)]' : 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]'}`} style={{ width: `${Math.min(row.util, 100)}%` }} />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gradient-to-r from-cyan-900/20 to-cyan-900/40 relative group/foot">
                            <td colSpan={2} className="px-6 py-5 font-bold text-white tracking-[0.3em] text-xs border-r border-cyan-500/20 uppercase text-center relative">
                              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
                              Branch Network
                            </td>
                            <td className="px-6 py-5 border-r border-cyan-500/20 relative">
                              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
                              <span className="block font-mono font-bold text-white text-xl text-right drop-shadow-md">{reactiveBranchSnapshot.reduce((s, r) => s + r.alloc, 0).toFixed(0)}</span>
                            </td>
                            <td className="px-6 py-5 border-r border-cyan-500/20 relative">
                              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
                              <span className="block font-mono font-bold text-cyan-400 text-xl text-right drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">{reactiveBranchSnapshot.reduce((s, r) => s + r.booked, 0).toFixed(1)}</span>
                            </td>
                            <td className="px-6 py-5 relative">
                              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
                              <span className="block font-mono font-bold text-white text-xl text-right drop-shadow-md">
                                {(() => {
                                  const tAlloc = reactiveBranchSnapshot.reduce((s, r) => s + r.alloc, 0);
                                  const tBook = reactiveBranchSnapshot.reduce((s, r) => s + r.booked, 0);
                                  return tAlloc > 0 ? ((tBook / tAlloc) * 100).toFixed(0) : 0;
                                })()}%
                              </span>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Basic Info Panel */}
                  <div className="xl:w-[240px] 2xl:w-[280px] shrink-0 bg-[#0b0f19] border border-white/5 rounded-[24px] p-8 shadow-inner flex flex-col justify-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/5 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                    <h4 className="text-indigo-400 font-bold uppercase tracking-[0.2em] text-xs mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" /> Data Insight
                    </h4>
                    <h2 className="text-xl text-slate-200 font-medium mb-3">Branch Network Hubs</h2>
                    <p className="text-xs text-slate-300 leading-relaxed mb-6">
                      The Branch table unpacks regional allocation vs fulfillment percentages. It inherently visualizes geographic load distribution and identifies localized bottlenecks.
                    </p>
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                        <span className="text-xs text-slate-400 font-mono">Geographic Nodes</span>
                        <span className="text-xs font-bold text-slate-200">6 Facilities</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                        <span className="text-xs text-slate-400 font-mono">Most Overbooked</span>
                        <span className="text-xs font-bold text-rose-400">183% (Fremantle)</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          )}

          {/* ────────────────────────────────── CONTRACT UTILISATION VIEW ────────────────────────────────── */}
          {activeTag === 'Contract Utilisation' && (
            <motion.div
              initial={{ opacity: 0, filter: 'blur(10px)', y: 20 }} animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col gap-10 w-full"
            >
              {/* Header */}
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end pb-8 border-b border-white/[0.05] relative">
                <div className="absolute -bottom-[1px] left-0 w-1/3 h-[1px] bg-gradient-to-r from-violet-500 to-transparent" />
                <div className="flex flex-col gap-3">
                  <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 w-max mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-[pulse-ring_2s_infinite] shadow-[0_0_10px_rgba(167,139,250,1)]" />
                    <span className="text-[10px] font-bold tracking-[0.2em] text-violet-400 uppercase">Carrier Capacity Intelligence</span>
                  </div>
                  <h1 className="text-5xl md:text-6xl text-white font-display font-light tracking-tighter">
                    Contract <span className="font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent animate-[glow-pulse_4s_ease-in-out_infinite]">Utilisation</span>
                  </h1>
                </div>
                {/* Summary KPI Pills */}
                <div className="mt-6 lg:mt-0 flex flex-wrap gap-3">
                  {[
                    { label: 'Total Alloc', value: `${cuTotalAlloc}`, color: 'text-violet-400', border: 'border-violet-500/30', bg: 'bg-violet-500/10', sub: 'Network Threshold', trend: 'Fixed Capacity', details: `This represents the total theoretical TEU capacity allocated across all carriers for this reporting period. Current threshold is set at ${cuTotalAlloc} TEU.` },
                    { label: 'Total Booked', value: `${cuTotalBooked}`, color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', sub: 'Confirmed Volume', trend: '+12% vs LW', details: `Confirmed cargo currently assigned to contract allocations. ${cuTotalBooked} TEU has been validated through the booking log against a ${cuTotalAlloc} TEU ceiling.` },
                    { label: 'Overall Util', value: `${cuOverallUtil}%`, color: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-500/10', sub: 'Network Efficiency', trend: 'Critical Level', details: `Operational efficiency at ${cuOverallUtil}%. Ideally, network utilization should hover between 85-95%. Current levels indicate ${parseFloat(cuOverallUtil) < 70 ? 'under-utilized capacity' : 'approaching ceiling'}.` },
                    { label: 'Overbooked', value: `${cuOverbooked.length}`, color: 'text-rose-400', border: 'border-rose-500/30', bg: 'bg-rose-500/10', sub: 'Capacity Breach', trend: 'High Risk', details: `${cuOverbooked.length} carriers have exceeded their contractual allocation. This requires immediate re-routing or spot-market procurement to avoid roll-over risks.` },
                  ].map(p => (
                    <motion.div
                      whileHover={{ scale: 1.05, y: -5 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setActiveCuKpi(p)}
                      key={p.label}
                      className={`px-5 py-3 rounded-2xl ${p.bg} border ${p.border} flex flex-col items-center gap-1 cursor-pointer transition-all hover:shadow-[0_0_20px_rgba(167,139,250,0.2)]`}
                    >
                      <span className={`text-xl font-display font-bold ${p.color}`}>{p.value}</span>
                      <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{p.label}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* ─── "Silk Stream" Radial Scatter + Utilisation Bars Chart Section ─── */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

                {/* Main Silk Stream Chart: Alloc vs Booked Diverging bars */}
                <div className="xl:col-span-8 rounded-[40px] bg-[#0b0f19]/80 border border-white/5 backdrop-blur-3xl shadow-[0_30px_60px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(255,255,255,0.05)] p-8 md:p-10 relative overflow-hidden group">
                  <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-[40px]">
                    <div className="absolute top-0 right-0 bottom-0 left-0 bg-gradient-to-r from-transparent via-violet-400/[0.06] to-transparent w-[300%]" style={{ animation: 'sweep-shine 10s infinite linear' }} />
                  </div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-[radial-gradient(ellipse_at_center,_rgba(167,139,250,0.06)_0%,_rgba(0,0,0,0)_70%)] pointer-events-none z-0" />

                  <div className="flex justify-between items-start mb-8 relative z-10">
                    <div>
                      <h4 className="text-[11px] text-slate-300 font-bold uppercase tracking-[0.3em] flex items-center gap-3 mb-2">
                        <span className="w-2 h-2 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(167,139,250,0.8)]" /> Carrier Allocation vs Booked TEU
                      </h4>
                      {/* Dynamic graph insight text */}
                      <p className="text-xs text-slate-300 leading-relaxed max-w-lg border-l-2 border-violet-500/40 pl-3">{cuGraphInsight}</p>
                    </div>
                    <div className="flex gap-4 shrink-0">
                      <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-violet-500/60" /><span className="text-[9px] text-slate-400 font-bold uppercase">Allocation</span></div>
                      <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-emerald-400/80" /><span className="text-[9px] text-slate-400 font-bold uppercase">Booked</span></div>
                    </div>
                  </div>

                  {/* Custom Silk Stream Utilisation Chart */}
                  <div className="h-[480px] w-full relative z-10 overflow-y-auto elegant-scrollbar pr-2">
                    <div className="flex flex-col gap-3 min-h-full justify-around py-2">
                      {reactiveContractUtilData.map((row, i) => {
                        const statusColor = row.util > 100 ? { bar: 'bg-rose-500', glow: 'shadow-[0_0_12px_rgba(239,68,68,0.6)]', text: 'text-rose-400', badge: 'bg-rose-500/20 border-rose-500/40 text-rose-300' }
                          : row.util >= 85 ? { bar: 'bg-amber-400', glow: 'shadow-[0_0_12px_rgba(251,191,36,0.5)]', text: 'text-amber-400', badge: 'bg-amber-500/20 border-amber-500/40 text-amber-300' }
                            : row.util >= 70 ? { bar: 'bg-emerald-400', glow: 'shadow-[0_0_12px_rgba(52,211,153,0.5)]', text: 'text-emerald-400', badge: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' }
                              : { bar: 'bg-slate-500', glow: '', text: 'text-slate-400', badge: 'bg-slate-700/40 border-slate-600/40 text-slate-400' };
                        const allocPct = Math.min((row.alloc / 280) * 100, 100);
                        const bookedPct = Math.min((row.booked / 280) * 100, 100);
                        return (
                          <div key={row.id} className="group/bar flex items-center gap-4 hover:bg-white/[0.02] rounded-2xl px-3 py-2 transition-all">
                            {/* Label */}
                            <div className="w-[130px] shrink-0 flex flex-col">
                              <span className="text-[11px] font-bold text-white font-mono truncate">{row.id}</span>
                              <span className="text-[9px] text-slate-300 truncate">{row.carrier}</span>
                            </div>
                            {/* Stacked bar area */}
                            <div className="flex-1 flex flex-col gap-1.5 relative">
                              {/* Alloc track */}
                              <div className="relative h-3 bg-slate-900/80 rounded-full overflow-visible">
                                <motion.div
                                  initial={{ width: 0 }} animate={{ width: `${allocPct}%` }} transition={{ duration: 0.8, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                                  className="absolute inset-y-0 left-0 bg-violet-500/50 rounded-full border border-violet-400/30"
                                />
                              </div>
                              {/* Booked track */}
                              <div className="relative h-3 bg-slate-900/80 rounded-full overflow-visible">
                                <motion.div
                                  initial={{ width: 0 }} animate={{ width: `${bookedPct}%` }} transition={{ duration: 1, delay: i * 0.04 + 0.2, ease: [0.16, 1, 0.3, 1] }}
                                  className={`absolute inset-y-0 left-0 ${statusColor.bar} rounded-full ${statusColor.glow} transition-all`}
                                />
                                {/* overflow indicator */}
                                {row.util > 100 && (
                                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-5 bg-rose-500 rounded-r-full shadow-[0_0_10px_rgba(239,68,68,1)] animate-pulse" />
                                )}
                              </div>
                            </div>
                            {/* Util % badge */}
                            <div className="w-[72px] shrink-0 flex flex-col items-end gap-1">
                              <span className={`text-sm font-display font-bold ${statusColor.text}`}>{row.util.toFixed(1)}%</span>
                              <span className={`text-[8px] font-bold px-2 py-0.5 rounded border ${statusColor.badge} uppercase tracking-wide`}>{row.status}</span>
                            </div>
                            {/* TEU numbers */}
                            <div className="w-[80px] shrink-0 text-right hidden md:flex flex-col">
                              <span className="text-[10px] text-slate-300 font-mono">{row.booked}<span className="text-slate-300">/{row.alloc}</span></span>
                              <span className={`text-[9px] font-bold ${row.avail < 0 ? 'text-rose-400' : 'text-slate-300'}`}>{row.avail < 0 ? `+${Math.abs(row.avail)} OVR` : `${row.avail} avail`}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right: Branch Heat Grid */}
                <div className="xl:col-span-4 rounded-[40px] bg-[#050505]/60 border border-white/5 backdrop-blur-3xl shadow-[0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col">
                  <div className="p-8 border-b border-violet-500/20 bg-gradient-to-r from-violet-950/20 to-transparent">
                    <h4 className="text-white font-bold tracking-[0.2em] uppercase text-xs">Branch <span className="text-violet-400">Heat Map</span></h4>
                    <p className="text-[10px] text-slate-300 mt-1">Per-branch booked vs alloc across carriers</p>
                  </div>
                  <div className="flex-1 overflow-y-auto elegant-scrollbar p-4">
                    {/* Column headers */}
                    <div className="grid grid-cols-6 gap-1 mb-2 px-1">
                      <div className="text-[8px] text-slate-400 font-bold uppercase col-span-1">ID</div>
                      {['SYD', 'MEL', 'BNE', 'PER', 'ADL'].map(b => (
                        <div key={b} className="text-[9px] text-slate-300 font-bold uppercase text-center">{b}</div>
                      ))}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {reactiveContractUtilData.map((row) => {
                        const branches = [
                          { b: row.syd, name: 'SYD' }, { b: row.mel, name: 'MEL' },
                          { b: row.bne, name: 'BNE' }, { b: row.per, name: 'PER' },
                          { b: row.adl, name: 'ADL' },
                        ];
                        return (
                          <div key={row.id} className="grid grid-cols-6 gap-1 items-center group/heat hover:bg-white/[0.03] rounded-xl px-1 py-0.5 transition-colors">
                            <span className="text-[9px] text-slate-400 font-mono font-bold truncate col-span-1">{row.id.split('-')[0]}</span>
                            {branches.map(({ b, name }) => {
                              const pct = b.alloc > 0 ? (b.booked / b.alloc) * 100 : 0;
                              const col = pct > 110 ? 'bg-rose-500/80' : pct > 90 ? 'bg-amber-400/70' : pct > 60 ? 'bg-emerald-400/60' : pct > 20 ? 'bg-cyan-500/40' : 'bg-slate-800/60';
                              return (
                                <div key={name} title={`${name}: ${b.booked}/${b.alloc} TEU (${pct.toFixed(0)}%)`}
                                  className={`h-6 rounded-md ${col} flex items-center justify-center transition-all group-hover/heat:scale-105`}>
                                  <span className="text-[8px] font-bold text-white/70">{pct > 0 ? `${pct.toFixed(0)}` : '-'}</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                    {/* Legend */}
                    <div className="mt-4 flex flex-wrap gap-2 px-1 pt-3 border-t border-white/5">
                      {[['bg-rose-500/80', 'Overbooked'], ['bg-amber-400/70', 'Near Full'], ['bg-emerald-400/60', 'On Track'], ['bg-cyan-500/40', 'Low'], ['bg-slate-800/60', 'Empty']].map(([col, lbl]) => (
                        <div key={lbl} className="flex items-center gap-1.5">
                          <div className={`w-3 h-3 rounded-sm ${col}`} />
                          <span className="text-[8px] text-slate-300 uppercase font-bold">{lbl}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ─── Full Data Table ─── */}
              <div className="bg-[#0b0f19]/80 backdrop-blur-3xl border border-white/5 rounded-[32px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative">
                <div className="absolute top-0 right-0 w-96 h-96 bg-violet-500/5 rounded-full blur-[100px] pointer-events-none" />
                <div className="p-6 md:p-8 flex justify-between items-center bg-black/40 border-b border-white/5 relative z-10">
                  <div className="flex flex-col gap-1">
                    <span className="text-white font-bold text-lg tracking-wide">Full Contract Matrix</span>
                    <span className="text-[10px] text-slate-300 uppercase tracking-widest font-bold">
                      {reactiveContractUtilData.length} carriers · Total {cuTotalAlloc} TEU allocated · {cuTotalBooked} TEU booked · {cuOverallUtil}% network utilisation
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setIsCuTableModalOpen(true)}
                      className="px-4 py-2 bg-violet-500/20 border border-violet-500/40 rounded-xl text-violet-400 text-[10px] font-bold uppercase tracking-widest hover:bg-violet-500/40 transition-all flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                      Expand View
                    </button>
                    <span className="text-[10px] font-bold px-3 py-1 bg-violet-500/10 text-violet-400 rounded border border-violet-500/20 uppercase tracking-widest">MSC {selectedWeek}</span>
                  </div>
                </div>

                <div className="overflow-x-auto elegant-scrollbar relative z-10 p-2 md:p-5">
                  <table className="w-full text-left border-collapse table-fixed min-w-[1600px]">
                    <thead>
                      <tr className="bg-slate-900/60">
                        {['Contract ID', 'Carrier', 'Trade Lane', 'Alloc (TEU)', 'Booked (TEU)', 'Avail (TEU)', 'Util %', 'Status', 'SYD A/B', 'MEL A/B', 'BNE A/B', 'PER A/B', 'ADL A/B'].map((h, i) => (
                          <th key={h} className={`px-4 py-4 font-bold text-[10px] tracking-widest uppercase border-b border-white/5 ${i === 7 ? 'text-center' : i >= 8 ? 'text-center text-violet-400' : i >= 4 ? 'text-right text-cyan-400' : 'text-slate-400'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.02]">
                      {reactiveContractUtilData.map((row, i) => {
                        const statusStyle = row.util > 100 ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : row.util >= 85 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : row.util >= 70 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-slate-700/30 text-slate-400 border-slate-600/30';
                        const utilColor = row.util > 100 ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                          : row.util >= 85 ? 'text-amber-400' : row.util >= 70 ? 'text-emerald-400' : 'text-slate-400';
                        return (
                          <tr key={i} className="hover:bg-white/[0.03] transition-colors group/cu">
                            <td className="px-4 py-4 font-mono text-xs font-bold text-violet-300">{row.id}</td>
                            <td className="px-4 py-4 text-xs text-slate-300 font-medium truncate">{row.carrier}</td>
                            <td className="px-4 py-4"><span className="font-mono text-[10px] px-2 py-1 rounded bg-slate-800/60 text-slate-400 border border-slate-700/50">{row.lane}</span></td>
                            <td className="px-4 py-4 text-right font-mono text-sm text-slate-300">{row.alloc}</td>
                            <td className="px-4 py-4 text-right font-mono text-sm font-bold text-cyan-400 drop-shadow-[0_0_6px_rgba(34,211,238,0.3)]">{row.booked}</td>
                            <td className={`px-4 py-4 text-right font-mono text-sm font-bold ${row.avail < 0 ? 'text-rose-400' : 'text-slate-400'}`}>{row.avail}</td>
                            <td className={`px-4 py-4 text-right font-mono text-sm font-bold ${utilColor}`}>
                              <div className="flex flex-col items-end gap-1">
                                <span>{row.util.toFixed(1)}%</span>
                                <div className="w-14 h-1 bg-slate-900 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${row.util > 100 ? 'bg-rose-500' : row.util >= 85 ? 'bg-amber-400' : row.util >= 70 ? 'bg-emerald-400' : 'bg-slate-600'}`} style={{ width: `${Math.min(row.util, 100)}%` }} />
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center"><span className={`text-[9px] font-bold px-2 py-1 rounded border uppercase tracking-wide ${statusStyle}`}>{row.status}</span></td>
                            {[row.syd, row.mel, row.bne, row.per, row.adl].map((b, bi) => {
                              const bPct = b.alloc > 0 ? (b.booked / b.alloc) * 100 : 0;
                              const bCol = bPct > 100 ? 'text-rose-400' : bPct > 85 ? 'text-amber-400' : bPct > 0 ? 'text-slate-300' : 'text-slate-400';
                              return (
                                <td key={bi} className="px-3 py-4 text-center">
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span className={`font-mono text-[10px] font-bold ${bCol}`}>{b.booked}<span className="text-slate-400">/{b.alloc}</span></span>
                                    <div className="w-10 h-1 bg-slate-900 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${bPct > 100 ? 'bg-rose-500' : bPct > 85 ? 'bg-amber-400' : 'bg-violet-500/60'}`} style={{ width: `${Math.min(bPct, 100)}%` }} />
                                    </div>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* ────────────────────────────────── BRANCH ALLOCATION VIEW ────────────────────────────────── */}
          {activeTag === 'Branch Allocation' && (
            <motion.div
              initial={{ opacity: 0, filter: 'blur(10px)', y: 20 }} animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col gap-10 w-full"
            >
              {/* Header */}
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end pb-8 border-b border-white/[0.05] relative">
                <div className="absolute -bottom-[1px] left-0 w-1/3 h-[1px] bg-gradient-to-r from-amber-500 to-transparent" />
                <div className="flex flex-col gap-3">
                  <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 w-max mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_10px_rgba(245,158,11,1)]" />
                    <span className="text-[10px] font-bold tracking-[0.2em] text-amber-400 uppercase">Regional Distribution Flux</span>
                  </div>
                  <h1 className="text-5xl md:text-6xl text-white font-display font-light tracking-tighter">
                    Branch <span className="font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent animate-[glow-pulse_4s_ease-in-out_infinite]">Allocation</span>
                  </h1>
                </div>

                <div className="mt-6 lg:mt-0 flex gap-4">
                  <div className="px-6 py-4 bg-black/40 border border-white/10 rounded-2xl flex flex-col gap-1 backdrop-blur-3xl">
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Global Utilisation</span>
                    <div className="flex items-end gap-2">
                      <span className="text-3xl font-display font-bold text-white">57</span>
                      <span className="text-lg font-bold text-slate-300 mb-1">.1%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ─── Branch Flux Aura Visualization ─── */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                <div className="xl:col-span-12 rounded-[40px] bg-[#0b0f19]/80 border border-white/5 backdrop-blur-3xl shadow-[0_30px_60px_rgba(0,0,0,0.8)] p-10 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(245,158,11,0.05),transparent_70%)]" />

                  <div className="flex justify-between items-start mb-12 relative z-10">
                    <div>
                      <h4 className="text-white font-bold tracking-[0.2em] uppercase text-xs mb-2">Branch Performance <span className="text-amber-400">Flux Aggregate</span></h4>
                      <p className="text-xs text-slate-300 max-w-xl">Multi-branch comparison of theoretical capacity versus actual cargo confirmation across all major tactical hubs.</p>
                    </div>
                  </div>

                  <div className="h-[450px] w-full relative z-10 antialiased">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={reactiveBranchSnapshot} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                        <defs>
                          <linearGradient id="allocAura" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.15} />
                            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                          </linearGradient>
                          <filter id="glow">
                            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                            <feMerge>
                              <feMergeNode in="coloredBlur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" vertical={false} opacity={0.03} />
                        <XAxis
                          dataKey="branch"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 800, letterSpacing: '0.1em' }}
                          dy={20}
                        />
                        <YAxis hide domain={[0, 'dataMax + 100']} />
                        <Tooltip
                          cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-[#050505]/95 backdrop-blur-2xl border border-white/10 p-5 rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.9)]">
                                  <div className="flex items-center gap-2 mb-4">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: data.color }} />
                                    <p className="text-xs font-bold text-white uppercase tracking-[0.2em]">{data.branch} HUB</p>
                                  </div>
                                  <div className="grid grid-cols-2 gap-6">
                                    <div className="flex flex-col">
                                      <span className="text-[9px] text-slate-300 font-bold uppercase mb-1">Total Capacity</span>
                                      <span className="text-xl font-display font-light text-white">{data.alloc} <span className="text-[10px] text-slate-300">TEU</span></span>
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[9px] text-amber-500 font-bold uppercase mb-1">Active Bookings</span>
                                      <span className="text-xl font-display font-bold text-amber-400">{data.booked} <span className="text-[10px] text-amber-600">TEU</span></span>
                                    </div>
                                  </div>
                                  <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className="w-12 h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500" style={{ width: `${data.util}%` }} />
                                      </div>
                                      <span className="text-[10px] font-bold text-emerald-400">{data.util}%</span>
                                    </div>
                                    <span className="text-[9px] text-slate-400 font-mono font-bold tracking-widest">{data.alloc - data.booked} AVAIL</span>
                                  </div>
                                </motion.div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="alloc"
                          stroke="none"
                          fill="url(#allocAura)"
                          isAnimationActive={true}
                          animationDuration={2500}
                          animationEasing="ease-in-out"
                        />
                        <Bar
                          dataKey="alloc"
                          barSize={64}
                          radius={[20, 20, 0, 0]}
                          fill="rgba(255,255,255,0.02)"
                          stroke="rgba(255,255,255,0.05)"
                          isAnimationActive={true}
                          animationDuration={2500}
                          animationEasing="ease-in-out"
                        />
                        <Bar
                          dataKey="booked"
                          barSize={44}
                          radius={[12, 12, 4, 4]}
                          isAnimationActive={true}
                          animationDuration={2500}
                          animationEasing="ease-in-out"
                        >
                          {reactiveBranchSnapshot.map((entry, index) => {
                            const colors: Record<string, string> = {
                              'SYD': '#FF4D4D', 'SY1': '#FF4D4D', 'SYDNEY': '#FF4D4D',
                              'MEL': '#4D96FF', 'ME1': '#4D96FF', 'MELBOURNE': '#4D96FF',
                              'BNE': '#FFD93D', 'BN1': '#FFD93D', 'BRISBANE': '#FFD93D',
                              'PER': '#6BCB77', 'PR1': '#6BCB77', 'PERTH': '#6BCB77',
                              'ADL': '#9B59B6', 'AD1': '#9B59B6', 'ADELAIDE': '#9B59B6'
                            };
                            const color = colors[entry.branch] || colors[entry.code] || '#06b6d4';
                            return <Cell key={`cell-${index}`} fill={color} style={{ filter: `drop-shadow(0 0 15px ${color}44)` }} />;
                          })}
                        </Bar>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* ─── Detailed Carrier-Branch Matrix Table ─── */}
              <div className="bg-[#0b0f19]/80 backdrop-blur-3xl border border-white/5 rounded-[40px] overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.8)] relative">
                <div className="p-8 md:p-10 flex justify-between items-center bg-black/40 border-b border-white/5 relative z-10">
                  <div className="flex flex-col gap-1">
                    <span className="text-white font-bold text-xl tracking-wide">Branch Allocation Breakdown</span>
                    <span className="text-[10px] text-slate-300 uppercase tracking-widest font-bold">Comprehensive Regional Utilisation Matrix</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setIsBranchTableModalOpen(true)}
                      className="px-5 py-2.5 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-400 text-[10px] font-bold uppercase tracking-widest hover:bg-amber-500/40 transition-all flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                      Pop-up View
                    </button>
                    <span className="text-[10px] font-bold px-4 py-2 bg-slate-800 text-slate-400 rounded-lg border border-white/10 uppercase tracking-widest">MSC Week 12</span>
                  </div>
                </div>

                <div className="overflow-x-auto elegant-scrollbar relative z-10 p-5">
                  <table className="w-full text-left border-separate border-spacing-0 min-w-[1600px]">
                    <thead>
                      <tr className="bg-slate-900/60 font-bold">
                        <th rowSpan={2} className="p-6 text-slate-400 text-[10px] tracking-widest uppercase border-b border-r border-white/5 sticky left-0 z-20 bg-slate-900/90 backdrop-blur w-40">Contract ID</th>
                        <th rowSpan={2} className="p-6 text-slate-400 text-[10px] tracking-widest uppercase border-b border-r border-white/5 sticky left-40 z-20 bg-slate-900/90 backdrop-blur w-48">Carrier</th>
                        <th rowSpan={2} className="p-6 text-slate-400 text-[10px] tracking-widest uppercase border-b border-r border-white/5 w-32 text-center">Lane</th>

                        <th colSpan={3} className="px-2 py-4 text-center bg-[#FF4D4D]/10 border-b border-r border-[#FF4D4D]/20 text-[#FF4D4D] text-[10px] font-black uppercase tracking-[0.2em] font-display">Sydney</th>
                        <th colSpan={3} className="px-2 py-4 text-center bg-[#4D96FF]/10 border-b border-r border-[#4D96FF]/20 text-[#4D96FF] text-[10px] font-black uppercase tracking-[0.2em] font-display">Melbourne</th>
                        <th colSpan={3} className="px-2 py-4 text-center bg-[#FFD93D]/10 border-b border-r border-[#FFD93D]/20 text-[#FFD93D] text-[10px] font-black uppercase tracking-[0.2em] font-display">Brisbane</th>
                        <th colSpan={3} className="px-2 py-4 text-center bg-[#6BCB77]/10 border-b border-r border-[#6BCB77]/20 text-[#6BCB77] text-[10px] font-black uppercase tracking-[0.2em] font-display">Perth</th>
                        <th colSpan={3} className="px-2 py-4 text-center bg-[#9B59B6]/10 border-b border-white/10 text-[#9B59B6] text-[10px] font-black uppercase tracking-[0.2em] font-display">Adelaide</th>
                      </tr>
                      <tr className="bg-slate-900/30 font-bold text-[9px] text-slate-300 uppercase tracking-widest">
                        {['Alloc', 'Booked', 'Util%', 'Alloc', 'Booked', 'Util%', 'Alloc', 'Booked', 'Util%', 'Alloc', 'Booked', 'Util%', 'Alloc', 'Booked', 'Util%'].map((h, i) => (
                          <th key={i} className={`px-2 py-3 text-center border-b border-r border-white/[0.05] ${i % 3 === 2 ? 'bg-white/[0.1]' : ''}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {reactiveContractUtilData.map((row, i) => (
                        <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                          <td className="p-4 font-mono text-xs font-bold text-slate-300 border-r border-white/5 sticky left-0 z-10 bg-[#0b0f19] group-hover:bg-[#111928]">{row.id}</td>
                          <td className="p-4 text-xs text-white border-r border-white/5 font-medium sticky left-40 z-10 bg-[#0b0f19] group-hover:bg-[#111928]">{row.carrier}</td>
                          <td className="p-4 text-center border-r border-white/5"><span className="text-[10px] px-2 py-1 bg-slate-800 rounded font-bold text-slate-400 font-mono tracking-tighter">{row.lane}</span></td>

                          {[row.syd, row.mel, row.bne, row.per, row.adl].map((b, bi) => {
                            const util = b.alloc > 0 ? (b.booked / b.alloc) * 100 : 0;
                            const isCrit = util > 100;
                            const isLow = util < 50 && util > 0;
                            return (
                              <React.Fragment key={bi}>
                                <td className="px-1 py-4 text-center font-mono text-[11px] text-slate-400">{b.alloc}</td>
                                <td className={`px-1 py-4 text-center font-mono text-[11px] font-bold ${isCrit ? 'text-rose-400' : isLow ? 'text-amber-400' : 'text-slate-200'}`}>{b.booked.toFixed(1)}</td>
                                <td className={`px-1 py-4 text-center border-r border-white/5 font-mono text-[11px] font-black ${isCrit ? 'text-rose-400 animate-pulse' : isLow ? 'text-amber-400' : 'text-slate-300'}`}>{util.toFixed(0)}%</td>
                              </React.Fragment>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-black/60 font-black border-t-2 border-amber-500/50">
                        <td colSpan={3} className="p-6 text-amber-400 text-xs tracking-[0.3em] font-display uppercase border-r border-white/10 sticky left-0 z-10 bg-black">Global Branch Totals</td>
                        {[branchMatrixTotals.syd, branchMatrixTotals.mel, branchMatrixTotals.bne, branchMatrixTotals.per, branchMatrixTotals.adl].map((t, ti) => {
                          const util = t.alloc > 0 ? (t.booked / t.alloc) * 100 : 0;
                          return (
                            <React.Fragment key={ti}>
                              <td className="px-1 py-6 text-center font-mono text-base text-white">{t.alloc.toFixed(0)}</td>
                              <td className="px-1 py-6 text-center font-mono text-base text-white">{t.booked.toFixed(1)}</td>
                              <td className={`px-1 py-6 text-center border-r border-white/10 font-mono text-lg ${util > 90 ? 'text-rose-400' : 'text-emerald-400'}`}>{util.toFixed(0)}%</td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* Week Analysis View */}
          {activeTag === 'Week Analysis' && (
            <motion.div
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col gap-10 w-full"
            >
              {/* Ultra-Premium Header */}
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end pb-8 border-b border-white/[0.05] relative">
                <div className="absolute -bottom-[1px] left-0 w-1/3 h-[1px] bg-gradient-to-r from-indigo-500 to-transparent" />
                <div className="flex flex-col gap-3">
                  <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 w-max mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-[pulse-ring_2s_infinite] shadow-[0_0_10px_rgba(99,102,241,1)]" />
                    <span className="text-[10px] font-bold tracking-[0.2em] text-indigo-400 uppercase">Weekly Performance Flux</span>
                  </div>
                  <h1 className="text-5xl md:text-6xl text-white font-display font-light tracking-tighter">
                    Week <span className="font-bold aurora-text animate-[glow-pulse_4s_ease-in-out_infinite] drop-shadow-[0_0_15px_rgba(99,102,241,0.4)]">Analysis</span>
                  </h1>
                </div>
                <div className="mt-6 lg:mt-0 flex items-center gap-4">
                  <div className="mt-6 lg:mt-0 flex flex-col pt-3 pb-4 px-5 bg-gradient-to-br from-indigo-950/40 to-[#050505]/80 border border-indigo-500/30 rounded-[20px] shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                    <div className="text-[10px] font-bold text-white mb-2 flex items-center gap-2">
                      <svg className="w-3 h-3 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 00-2 2z" /></svg>
                      Select Week Range:
                    </div>
                    <div className="flex bg-[#0b0f19] border border-white/10 rounded-xl overflow-hidden shadow-inner">
                      <div className="flex flex-col border-r border-white/5">
                        <div className="px-4 py-1.5 bg-indigo-500/10 text-[9px] font-bold text-indigo-400 uppercase tracking-widest text-center border-b border-white/5">From Week</div>
                        <div className="px-4 py-2.5 text-center text-white font-bold text-sm bg-white/[0.02]">WK 12</div>
                      </div>
                      <div className="flex flex-col">
                        <div className="px-4 py-1.5 bg-indigo-500/10 text-[9px] font-bold text-indigo-400 uppercase tracking-widest text-center border-b border-white/5">To Week</div>
                        <div className="px-4 py-2.5 text-center text-white font-bold text-sm bg-white/[0.02]">WK 19</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Insights Section: Enhanced Graph + Summary Table */}
              <div className="flex flex-col xl:flex-row gap-8">
                {/* Enhanced liquid-glow Trend Visual */}
                <div className="flex-1 rounded-[40px] bg-[#0b0f19]/80 border border-white/5 backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-8 md:p-10 relative overflow-hidden group">
                  <div className="absolute inset-0 z-0 pointer-events-none opacity-20">
                    <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-indigo-500/20 to-transparent" />
                  </div>

                  <div className="flex justify-between items-center mb-10 relative z-10">
                    <h4 className="text-[11px] text-slate-300 font-bold uppercase tracking-[0.3em] flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                      Network Volume Dynamics
                    </h4>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-white shadow-[0_0_5px_white]" /><span className="text-[9px] text-slate-400 font-bold uppercase">Allocation</span></div>
                      <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-indigo-500 shadow-[0_0_5px_rgba(99,102,241,0.5)]" /><span className="text-[9px] text-slate-400 font-bold uppercase">Booked TEU</span></div>
                    </div>
                  </div>

                  <div className="h-[400px] w-full relative z-10 antialiased">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={reactiveWeeklyTrendData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }} barGap={6}>
                        <defs>
                          <linearGradient id="allocGlow" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.9} />
                            <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.1} />
                          </linearGradient>
                          <linearGradient id="bookGlow" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1} />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.4} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" vertical={false} opacity={0.03} />
                        <XAxis dataKey="week" stroke="#64748b" tickLine={false} axisLine={false} dy={15} fontSize={10} fontWeight={700} />
                        <YAxis stroke="#475569" tickLine={false} axisLine={false} fontSize={10} />
                        <Tooltip
                          cursor={{ fill: 'rgba(99,102,241,0.05)' }}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-[#050505]/95 backdrop-blur-3xl border border-white/10 p-4 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)]">
                                  <div className="text-[10px] text-slate-300 font-bold uppercase tracking-widest mb-2 border-b border-white/5 pb-1">{payload[0].payload.week}</div>
                                  <div className="flex flex-col gap-2 pt-1">
                                    <div className="flex justify-between items-center gap-8">
                                      <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_5px_currentColor]"></div><span className="text-[10px] text-slate-400">Total Allocation</span></div>
                                      <span className="font-mono text-xs text-white font-bold">{payload[0].payload.alloc} TEU</span>
                                    </div>
                                    <div className="flex justify-between items-center gap-8">
                                      <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_5px_currentColor]"></div><span className="text-[10px] text-slate-400">Total Booked</span></div>
                                      <span className="font-mono text-xs text-indigo-400 font-bold">{payload[0].payload.booked} TEU</span>
                                    </div>
                                    <div className="flex justify-between items-center gap-8 pt-1.5 border-t border-white/5 mt-1">
                                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Utilisation</span>
                                      <span className={`font-mono text-xs font-bold ${payload[0].payload.util >= 100 ? 'text-rose-400' : 'text-emerald-400'}`}>{payload[0].payload.util}%</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="alloc" barSize={18} radius={[4, 4, 0, 0]} isAnimationActive={true} animationDuration={2500} animationEasing="ease-in-out">
                          {reactiveWeeklyTrendData.map((_entry, index) => (
                            <Cell key={`cell-alloc-${index}`} fill="url(#allocGlow)" style={{ filter: 'drop-shadow(0px 0px 4px rgba(14,165,233,0.3))' }} />
                          ))}
                        </Bar>
                        <Bar dataKey="booked" barSize={18} radius={[4, 4, 0, 0]} isAnimationActive={true} animationDuration={2500} animationEasing="ease-in-out">
                          {reactiveWeeklyTrendData.map((_entry, index) => (
                            <Cell key={`cell-book-${index}`} fill="url(#bookGlow)" style={{ filter: 'drop-shadow(0px 0px 6px rgba(139,92,246,0.6))' }} />
                          ))}
                        </Bar>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Weekly Pulse Summary Table */}
                <div className="xl:w-[420px] bg-[#0b0f19]/80 border border-white/5 rounded-[40px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-3xl flex flex-col group">
                  <div className="px-8 py-7 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                      <h3 className="text-white font-bold tracking-widest uppercase text-xs">Network Pulse</h3>
                    </div>
                    <span className="text-[9px] font-mono text-slate-300">REALTIME SYNC</span>
                  </div>
                  <div className="flex-1 p-2">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-black/20">
                          <th className="px-6 py-3 font-bold text-slate-400 text-[10px] tracking-widest uppercase rounded-tl-2xl">Week</th>
                          <th className="px-4 py-3 font-bold text-slate-400 text-[10px] tracking-widest uppercase text-center">Alloc</th>
                          <th className="px-4 py-3 font-bold text-slate-400 text-[10px] tracking-widest uppercase text-center">Booked</th>
                          <th className="px-6 py-3 font-bold text-slate-400 text-[10px] tracking-widest uppercase text-right rounded-tr-2xl">Util%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.03]">
                        {reactiveWeeklyTrendData.map((row) => (
                          <tr key={row.week} className="hover:bg-white/[0.02] transition-colors group/pulse">
                            <td className="px-6 py-2.5 font-bold text-slate-300 text-xs tracking-wider">{row.week}</td>
                            <td className="px-4 py-2.5 text-center font-mono text-xs text-slate-400">{row.alloc}</td>
                            <td className="px-4 py-2.5 text-center font-mono text-xs text-slate-300 antialiased">{row.booked.toFixed(1)}</td>
                            <td className={`px-6 py-2.5 text-right font-mono font-bold text-sm ${row.util >= 100 ? 'text-rose-400 drop-shadow-[0_0_5px_rgba(244,63,94,0.5)]' : row.util >= 90 ? 'text-amber-400' : 'text-emerald-400 transition-colors group-hover/pulse:text-emerald-300'}`}>
                              {row.util}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Performance Matrix Header HUD */}
              <div className="flex items-center justify-between px-8 py-4 bg-[#050505]/40 border-l border-indigo-500/50 border-r border-indigo-500/50 rounded-2xl">
                <div className="flex items-center gap-6">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Global Matrix</span>
                    <span className="text-xl font-display text-white font-light uppercase tracking-widest">Complex <span className="font-bold text-indigo-400">Node Data</span></span>
                  </div>
                  <div className="h-10 w-[1px] bg-white/10" />
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" /><span className="text-[9px] text-slate-300 font-bold uppercase">Overflow</span></span>
                  </div>
                </div>
                <div className="mt-6 lg:mt-0 px-5 py-3 bg-[#050505]/60 border border-slate-700/80 rounded-2xl flex items-center gap-4 backdrop-blur-3xl shadow-[0_10px_30px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.05)] transform hover:scale-105 transition-transform duration-500 cursor-default">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-semibold tracking-widest text-slate-300 uppercase">Mission Operations</span>
                    <span className="text-sm font-bold tracking-wide text-white">WK 12 <span className="text-indigo-400/80 font-medium">| ACTIVE</span></span>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.5)] text-white relative overflow-hidden">
                    <div className="absolute inset-0 bg-white/20 opacity-0 hover:opacity-100 transition-opacity" />
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                  </div>
                </div>
              </div>

              {/* Top Row: Amazing Graph + Quick Summary Table */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* Ultra-Amazing Liquid Glow Trend Chart */}
                <div className="xl:col-span-8 rounded-[40px] bg-[#0b0f19]/80 border border-white/5 backdrop-blur-3xl shadow-[0_30px_60px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(255,255,255,0.05)] p-10 relative overflow-hidden group">
                  <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-[40px]">
                    <div className="absolute top-0 right-0 bottom-0 left-0 bg-gradient-to-r from-transparent via-indigo-400/[0.08] to-transparent w-[300%]" style={{ animation: 'sweep-shine 8s infinite linear' }} />
                  </div>

                  <div className="flex justify-between items-center mb-10 relative z-10">
                    <h4 className="text-[11px] text-slate-300 font-bold uppercase tracking-[0.3em] flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" /> Network Volume Projection
                    </h4>
                    <div className="px-4 py-1.5 rounded-full bg-black/40 border border-white/10 text-[10px] font-mono text-cyan-400 uppercase tracking-widest shadow-inner">Cumulative Metrics</div>
                  </div>

                  <div className="h-[420px] w-full relative z-10 antialiased">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={reactiveWeeklyTrendData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id="liquidBlue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.6} />
                            <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="glowArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                          <filter id="neonBlur" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
                            <feMerge>
                              <feMergeNode in="blur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>
                        <CartesianGrid strokeDasharray="10 10" stroke="#ffffff" vertical={false} opacity={0.005} />
                        <XAxis dataKey="week" stroke="#ffffff" opacity={0.15} tickLine={false} axisLine={false} dy={20} fontSize={9} fontWeight={900} />
                        <YAxis stroke="#ffffff" opacity={0.15} tickLine={false} axisLine={false} dx={-10} fontSize={9} ticks={[0, 25, 50, 75, 100]} />

                        <Tooltip
                          cursor={{ stroke: 'rgba(255, 255, 255, 0.05)', strokeWidth: 1 }}
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const utilVal = payload[0].payload.util;
                              return (
                                <div className="bg-[#050515]/80 backdrop-blur-3xl border border-white/5 p-8 rounded-[40px] shadow-[0_50px_100px_rgba(0,0,0,1),inset_0_1px_1px_rgba(255,255,255,0.1)] flex flex-col gap-6 min-w-[240px]">
                                  <div className="flex flex-col gap-1">
                                    <div className="text-[9px] uppercase font-bold tracking-[0.5em] text-indigo-500/80 mb-1">Weekly Analysis</div>
                                    <div className="text-2xl text-white font-display font-light tracking-tighter">{label} Snapshot</div>
                                  </div>

                                  <div className="flex flex-col gap-4">
                                    <div className="flex justify-between items-center bg-white/[0.03] p-4 rounded-2xl border border-white/5">
                                      <div className="flex flex-col">
                                        <span className="text-slate-300 text-[8px] uppercase font-bold tracking-widest mb-1">Capacity</span>
                                        <span className="text-xl text-white font-mono font-bold leading-none">{payload[1]?.value || 0}</span>
                                      </div>
                                      <div className="flex flex-col items-end">
                                        <span className="text-slate-300 text-[8px] uppercase font-bold tracking-widest mb-1">Booked</span>
                                        <span className="text-xl text-emerald-400 font-mono font-bold leading-none">{payload[0]?.value || 0}</span>
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-between px-2">
                                      <div className="text-[10px] font-bold text-slate-400">NETWORK EFFICIENCY</div>
                                      <div className={`text-xl font-display font-bold ${utilVal >= 100 ? 'text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.3)]' : 'text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]'}`}>
                                        {utilVal}%
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />

                        <Area type="monotone" dataKey="alloc" fill="url(#liquidBlue)" stroke="none" fillOpacity={0.4} isAnimationActive={true} animationDuration={2500} animationEasing="ease-in-out" />
                        <Area
                          type="monotone"
                          dataKey="booked"
                          fill="url(#glowArea)"
                          stroke="#34d399"
                          strokeWidth={3}
                          fillOpacity={0.6}
                          isAnimationActive={true}
                          animationDuration={2500}
                          animationEasing="ease-in-out"
                          style={{ filter: 'drop-shadow(0px 0px 10px rgba(52,211,153,0.3))' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="alloc"
                          stroke="#ffffff"
                          strokeWidth={3}
                          strokeDasharray="5 5"
                          opacity={0.3}
                          dot={false}
                          isAnimationActive={true}
                          animationDuration={2500}
                          animationEasing="ease-in-out"
                        />
                        <Line
                          type="monotone"
                          dataKey="booked"
                          stroke="none"
                          dot={{ r: 6, fill: '#10b981', fillOpacity: 0.8, stroke: '#ffffff', strokeWidth: 2 }}
                          activeDot={{ r: 10, fill: '#34d399', stroke: '#ffffff', strokeWidth: 4, style: { filter: 'drop-shadow(0px 0px 20px rgba(52,211,153,1))' } }}
                          isAnimationActive={true}
                          animationDuration={2500}
                          animationEasing="ease-in-out"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Network Summary Compact Matrix (From Screenshot) */}
                <div className="xl:col-span-4 rounded-[40px] bg-[#050505]/60 border border-white/5 backdrop-blur-3xl shadow-[0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col">
                  <div className="p-8 border-b border-indigo-500/20 bg-gradient-to-r from-indigo-950/20 to-transparent">
                    <h4 className="text-white font-bold tracking-[0.2em] uppercase text-xs">Weekly <span className="text-indigo-400">Readout Matrix</span></h4>
                  </div>
                  <div className="flex-1 overflow-y-auto elegant-scrollbar p-6">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-black/30">
                          <th className="px-5 py-3 font-bold text-slate-300 text-[10px] tracking-widest uppercase border-b border-white/5">Week</th>
                          <th className="px-5 py-3 font-bold text-slate-300 text-[10px] tracking-widest uppercase text-right border-b border-white/5">Alloc</th>
                          <th className="px-5 py-3 font-bold text-slate-300 text-[10px] tracking-widest uppercase text-right border-b border-white/5">Booked</th>
                          <th className="px-5 py-3 font-bold text-indigo-400 text-[10px] tracking-widest uppercase text-right border-b border-white/5">Util%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.03]">
                        {reactiveWeeklyTrendData.map((row, i) => {
                          const isCurrentWk = row.week === selectedWeek;
                          return (
                            <tr key={noNodeNum + i} className={`transition-colors group ${isCurrentWk ? 'bg-cyan-500/10 border-l-4 border-l-cyan-400' : 'hover:bg-indigo-500/5'}`}>
                              <td className="px-5 py-3 font-display font-bold text-white text-[13px]">
                                <div className="flex items-center gap-2">
                                  {row.week}
                                  {isCurrentWk && <span className="text-[7px] bg-cyan-500 text-black px-1 rounded">CURRENT</span>}
                                </div>
                              </td>
                              <td className="px-5 py-3 font-mono text-slate-400 text-xs text-right group-hover:text-slate-200">{row.alloc}</td>
                              <td className="px-5 py-3 font-mono text-cyan-400 text-xs text-right group-hover:text-cyan-300 font-bold">{row.booked.toFixed(1)}</td>
                              <td className={`px-5 py-3 font-mono text-xs text-right font-bold antialiased ${row.util >= 100 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                <span className="px-2 py-0.5 rounded bg-black/40 border border-white/5">{row.util.toFixed(1)}%</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Performance Matrix Section (Bottom) */}
              <motion.div className="flex flex-col gap-6" key={selectedWeek}>
                {/* Matrix Header with Fullscreen Trigger */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-[#0b0f19] border border-white/5 rounded-[32px] px-10 py-6">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                    </div>
                    <div>
                      <h3 className="text-white font-bold tracking-widest uppercase text-sm">Contract-Branch Performance Matrix</h3>
                      <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest mt-1">Granular Node Utilization Analysis</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsMatrixPreviewOpen(true)}
                    className="group flex items-center gap-4 px-6 py-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-indigo-500 transition-all hover:text-white"
                  >
                    <svg className="w-4 h-4 transition-transform group-hover:scale-125" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                    Launch Matrix Projection
                  </button>
                </div>

                <div className="bg-[#0b0f19]/90 border border-white/5 rounded-[32px] overflow-hidden shadow-2xl">
                  <div className="w-full overflow-x-auto elegant-scrollbar pb-2">
                    <table className="w-full text-left border-collapse table-fixed min-w-[1400px]">
                      <thead>
                        <tr className="bg-black/30 border-b border-white/5 text-antialiased">
                          <th className="px-6 py-5 font-bold text-slate-400 text-[10px] tracking-widest uppercase border-r border-white/5 w-[140px] sticky left-0 bg-[#0b0f19] z-20">IDENTIFIER Node</th>
                          {['WK 12', 'WK 13', 'WK 14', 'WK 15', 'WK 16', 'WK 17', 'WK 18', 'WK 19'].map(wk => (
                            <th key={wk} className="px-2 py-5 font-bold text-indigo-500 text-[10px] tracking-widest uppercase text-center border-r border-white/5 bg-indigo-950/20" colSpan={3}>
                              {wk}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {CONTRACT_WEEKLY_BREAKDOWN.map((contractRow, idx) => (
                          <React.Fragment key={idx}>
                            {/* Contract Header / Total Row */}
                            {contractRow.type === 'TOTAL' ? (
                              <tr className="bg-indigo-900/10 border-b border-white/5 group/row hover:bg-indigo-900/20 transition-colors">
                                <td className="px-6 py-5 font-display font-bold text-white text-xs border-r border-indigo-500/20 sticky left-0 bg-[#0b0f19] z-10">
                                  <div className="flex flex-col">
                                    <span className="text-[8px] text-indigo-400 font-bold tracking-[0.2em] mb-1 uppercase">Contract Total</span>
                                    <span className="truncate">{contractRow.contract}</span>
                                  </div>
                                </td>
                                {AVAILABLE_WEEKS.map(wk => {
                                  const d = (contractRow.data as any)[wk] || { alloc: 0, booked: 0, util: 0 };
                                  const utilColor = d.util >= 100 ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : d.util >= 90 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : d.util > 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-transparent text-slate-400 border-transparent';
                                  return (
                                    <React.Fragment key={wk}>
                                      <td className="px-1 py-4 text-center border-r border-white/5 font-mono text-[10px] text-slate-300">{d.alloc}</td>
                                      <td className="px-1 py-4 text-center border-r border-white/5 font-mono text-[10px] text-slate-300 antialiased">{d.booked.toFixed(1)}</td>
                                      <td className={`px-1 py-4 text-center border-r border-white/5 font-mono font-bold text-[11px] antialiased ${utilColor.split(' ')[1] || ''} transition-colors`}>
                                        <div className={`mx-auto px-1 rounded border ${utilColor.split(' ').slice(0, 1).join('')} ${utilColor.split(' ').slice(2).join('')}`}>
                                          {d.util}%
                                        </div>
                                      </td>
                                    </React.Fragment>
                                  );
                                })}
                              </tr>
                            ) : (
                              /* Detailed Branch Rows */
                              (contractRow as any).branches?.map((branch: any, bIdx: number) => (
                                <tr key={`${idx}-${bIdx}`} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group/branch">
                                  <td className="px-6 py-4 border-r border-white/5 sticky left-0 bg-[#0b0f19] z-10">
                                    <div className="flex items-center gap-3">
                                      <span className="text-[10px] font-mono text-indigo-500/60 font-bold">{branch.code}</span>
                                      <span className="text-xs text-slate-400 group-hover/branch:text-slate-200 transition-colors truncate font-sans font-medium antialiased">{branch.branch}</span>
                                    </div>
                                  </td>
                                  {['WK12', 'WK13', 'WK14', 'WK15', 'WK16', 'WK17', 'WK18', 'WK19'].map(wk => {
                                    const d = (branch.data as any)[wk];
                                    const utilColor = d.util >= 100 ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : d.util >= 90 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : d.util > 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-transparent text-slate-300/40 border-transparent';
                                    return (
                                      <React.Fragment key={wk}>
                                        <td className="px-1 py-4 text-center border-r border-white/5 font-mono text-[9px] text-slate-300 group-hover/branch:text-slate-400">{d.alloc}</td>
                                        <td className="px-1 py-4 text-center border-r border-white/5 font-mono text-[9px] text-slate-300 group-hover/branch:text-slate-400">{d.booked.toFixed(1)}</td>
                                        <td className={`px-1 py-4 text-center border-r border-white/5 font-mono font-medium text-[10px] antialiased ${utilColor.split(' ')[1]}`}>
                                          <div className={`mx-auto px-1 rounded ${utilColor.split(' ').slice(0, 1).join('')} ${utilColor.split(' ').slice(2).join('')}`}>
                                            {d.util > 0 ? `${d.util}%` : '-'}
                                          </div>
                                        </td>
                                      </React.Fragment>
                                    );
                                  })}
                                </tr>
                              ))
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-black/50 border-t border-indigo-500/30 group/grand">
                          <td className="px-6 py-6 sticky left-0 bg-black z-10 border-r border-white/10">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold text-cyan-400 tracking-[0.2em] uppercase">GRAND TOTAL</span>
                              <span className="text-[9px] text-slate-300 font-bold uppercase">All Contracts</span>
                            </div>
                          </td>
                          {reactiveWeeklyTrendData.map((wk, i) => {
                            const utilColor = wk.util >= 100 ? 'text-rose-400' : wk.util >= 90 ? 'text-amber-400' : 'text-emerald-400';
                            return (
                              <React.Fragment key={i}>
                                <td className="px-1 py-6 text-center border-r border-white/5 font-mono font-bold text-xs text-white uppercase">{wk.alloc}</td>
                                <td className="px-1 py-6 text-center border-r border-white/5 font-mono font-bold text-xs text-cyan-400">{wk.booked.toFixed(1)}</td>
                                <td className={`px-1 py-6 text-center border-r border-white/5 font-mono font-bold text-sm ${utilColor} drop-shadow-md`}>{wk.util}%</td>
                              </React.Fragment>
                            );
                          })}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Full Screen Matrix Projection Modal (Moving to Root) */}

          {/* Booking Log View */}
          {activeTag === 'Booking Log' && (
            <motion.div
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col gap-10 w-full"
            >
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end pb-8 border-b border-white/[0.05] relative gap-4">
                <div className="absolute -bottom-[1px] left-0 w-1/3 h-[1px] bg-gradient-to-r from-emerald-500 to-transparent" />
                <div className="flex flex-col gap-3">
                  <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 w-max mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-[pulse-ring_2s_infinite] shadow-[0_0_10px_rgba(52,211,153,1)]" />
                    <span className="text-[10px] font-bold tracking-[0.2em] text-emerald-400 uppercase">Live DB Extractor</span>
                  </div>
                  <h1 className="text-5xl md:text-6xl text-white font-display font-light tracking-tighter">
                    Booking <span className="font-bold aurora-text animate-[glow-pulse_4s_ease-in-out_infinite] drop-shadow-[0_0_15px_rgba(45,212,191,0.4)]">Log</span>
                  </h1>
                </div>
              </div>

              {/* Advanced Analytical Overview Row - Stacking Vertically per User Request */}
              <div className="flex flex-col gap-10 mb-4">
                {/* Branch Summary Advanced Hybrid Graph */}
                <div
                  className="bg-[#0b0f19]/80 border border-white/5 rounded-[40px] p-8 md:p-12 shadow-xl cursor-pointer hover:border-emerald-500/30 hover:shadow-[0_0_40px_rgba(52,211,153,0.15)] transition-all group relative overflow-hidden flex flex-col md:flex-row gap-10 items-center justify-between"
                  onClick={() => setIsBookingBranchModalOpen(true)}
                >
                  <div className="absolute inset-x-0 -bottom-20 h-40 bg-emerald-500/10 blur-[80px] pointer-events-none" />
                  {/* Text Interpretations natively written inside standard TSX layout */}
                  <div className="flex-1 min-w-[200px] flex flex-col gap-4 relative z-10">
                    <h3 className="text-white font-bold tracking-widest text-sm uppercase flex items-center gap-2 mb-2"><span className="w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)]" /> Branch Distribution</h3>
                    <p className="text-slate-400 text-sm leading-relaxed border-l-4 border-emerald-500/50 pl-4 py-1">{branchInsight}</p>
                    <div className="w-max mt-4 px-4 py-2 rounded-xl bg-emerald-500/10 text-[10px] font-bold text-emerald-400 uppercase tracking-widest border border-emerald-500/20 group-hover:bg-emerald-400 group-hover:text-black transition-colors shadow-inner flex items-center gap-2">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg> Expand Raw Metrics
                    </div>
                  </div>
                  <div className="h-64 w-full md:w-1/2 relative z-10 antialiased shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={reactiveBookingBranchSummary.slice(0, reactiveBookingBranchSummary.length - 1)} margin={{ top: 10, right: 0, bottom: -10, left: -20 }}>
                        <defs>
                          <linearGradient id="colorTeu" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#34d399" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="code" stroke="#64748b" tickLine={false} axisLine={false} fontSize={10} fontWeight={700} />
                        <YAxis stroke="#475569" tickLine={false} axisLine={false} fontSize={10} />
                        <Tooltip cursor={{ fill: 'rgba(52,211,153,0.05)' }} contentStyle={{ backgroundColor: '#050505', borderColor: '#334155', borderRadius: '12px' }} itemStyle={{ color: '#ecfeff', fontWeight: 700 }} />
                        <Area type="monotone" dataKey="teu" fillOpacity={1} fill="url(#colorTeu)" stroke="none" isAnimationActive={true} animationDuration={2500} animationEasing="ease-in-out" />
                        <Line type="monotone" dataKey="teu" stroke="#34d399" strokeWidth={3} isAnimationActive={true} animationDuration={2500} animationEasing="ease-in-out" dot={{ r: 4, fill: '#1e293b', stroke: '#34d399', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#34d399', stroke: '#fff', strokeWidth: 2 }} style={{ filter: 'drop-shadow(0px 0px 8px rgba(52,211,153,0.6))' }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Contract Breakdown Radial Graph */}
                <div
                  className="bg-[#0b0f19]/80 border border-white/5 rounded-[40px] p-8 md:p-12 shadow-xl cursor-pointer hover:border-cyan-500/30 hover:shadow-[0_0_40px_rgba(34,211,238,0.15)] transition-all group relative overflow-hidden flex flex-col md:flex-row gap-10 items-center justify-between"
                  onClick={() => setIsBookingContractModalOpen(true)}
                >
                  <div className="absolute inset-x-0 -bottom-20 h-40 bg-cyan-500/10 blur-[80px] pointer-events-none" />
                  {/* Dynamic Text Interpretation */}
                  <div className="flex-1 min-w-[200px] flex flex-col gap-4 relative z-10 md:order-last">
                    <h3 className="text-white font-bold tracking-widest text-sm uppercase flex items-center gap-2 mb-2"><span className="w-2 h-2 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.8)]" /> Contract Uptake</h3>
                    <p className="text-slate-400 text-sm leading-relaxed border-l-4 border-cyan-500/50 pl-4 py-1">{contractInsight}</p>
                    <div className="w-max mt-4 px-4 py-2 rounded-xl bg-cyan-500/10 text-[10px] font-bold text-cyan-400 uppercase tracking-widest border border-cyan-500/20 group-hover:bg-cyan-400 group-hover:text-black transition-colors shadow-inner flex items-center gap-2">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg> View Full Pivot
                    </div>
                  </div>
                  <div className="h-64 w-full md:w-1/2 relative z-10 antialiased shrink-0 md:order-first">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip cursor={{ fill: 'rgba(34,211,238,0.05)' }} contentStyle={{ backgroundColor: '#050505', borderColor: '#334155', borderRadius: '12px' }} itemStyle={{ color: '#ecfeff', fontWeight: 700 }} formatter={(v) => [`${v} TEU`, 'Volume']} />
                        <Pie
                          data={reactiveBookingContractBreakdown}
                          innerRadius={60}
                          outerRadius={85}
                          paddingAngle={5}
                          dataKey="teu"
                          stroke="none"
                        >
                          {reactiveBookingContractBreakdown.map((_, index) => {
                            const colors = ['#22d3ee', '#3b82f6', '#8b5cf6'];
                            return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} style={{ filter: `drop-shadow(0px 0px 8px ${colors[index % colors.length]}aa)` }} />;
                          })}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="bg-[#0b0f19]/80 backdrop-blur-3xl border border-white/5 rounded-[32px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative">
                <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

                <div className="p-6 md:p-8 flex justify-between items-center bg-black/40 border-b border-white/5 relative z-10">
                  <div className="flex items-center gap-4">
                    <span className="text-white font-bold text-lg tracking-wide">Raw Order Trajectory</span>
                    <span className="text-[10px] font-bold px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20 uppercase tracking-widest shadow-[inset_0_0_10px_rgba(52,211,153,0.1)]">CW1 Database Synchronized</span>
                  </div>
                  <button
                    onClick={() => setIsBookingTableModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl transition-colors shadow-[0_0_15px_rgba(16,185,129,0.15)] group"
                  >
                    <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                    <span className="text-xs font-bold uppercase tracking-widest">Fullscreen Projection</span>
                  </button>
                </div>

                <div className="overflow-x-auto elegant-scrollbar relative z-10 p-2 md:p-5">
                  <table className="w-full text-left border-collapse table-fixed min-w-[1400px]">
                    <thead>
                      <tr className="bg-slate-900/60 rounded-xl">
                        <th className="px-6 py-4 font-bold text-slate-400 text-[10px] tracking-widest uppercase border-b border-white/5 rounded-tl-xl">Contract Key</th>
                        <th className="px-6 py-4 font-bold text-slate-400 text-[10px] tracking-widest uppercase border-b border-white/5">Order No.</th>
                        <th className="px-6 py-4 font-bold text-slate-400 text-[10px] tracking-widest uppercase border-b border-white/5 truncate">Client / Source</th>
                        <th className="px-6 py-4 font-bold text-slate-400 text-[10px] tracking-widest uppercase border-b border-white/5">Transit Vessel</th>
                        <th className="px-6 py-4 font-bold text-slate-400 text-[10px] tracking-widest uppercase border-b border-white/5 text-center">ETD</th>
                        <th className="px-6 py-4 font-bold text-slate-400 text-[10px] tracking-widest uppercase border-b border-white/5 text-center">ETA</th>
                        <th className="px-6 py-4 font-bold text-indigo-400 text-[10px] tracking-widest uppercase border-b border-white/5 text-center">Origin → Dest</th>
                        <th className="px-6 py-4 font-bold text-emerald-400 text-[10px] tracking-widest uppercase border-b border-white/5 text-right rounded-tr-xl">TEU (Net)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.02]">
                      {filteredBookings.map((row, i) => {
                        const rTeu = row.teu || 0;
                        return (
                          <tr key={row.order + i} className="hover:bg-white/[0.03] transition-colors group">
                            <td className="px-6 py-5 font-mono text-xs font-bold text-slate-300">{row.contract}</td>
                            <td className="px-6 py-5 font-mono text-xs text-indigo-300">{row.order}</td>
                            <td className="px-6 py-5 text-[10px] text-slate-400 truncate tracking-tighter" title={row.buyer}>{row.buyer}</td>
                            <td className="px-6 py-5 text-xs text-slate-300">{row.depVessel} {row.depVoyage}</td>
                            <td className="px-6 py-5 font-mono text-[10px] text-center text-slate-300">{row.etd}</td>
                            <td className="px-6 py-5 font-mono text-[10px] text-center text-slate-300">{row.eta}</td>
                            <td className="px-6 py-5 text-center font-mono text-[10px] bg-slate-900/40 text-slate-300">{row.loadPort} → {row.dischargePort}</td>
                            <td className="px-6 py-5 font-mono text-sm font-bold text-emerald-400 text-right">{rTeu.toFixed(1)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="bg-slate-900/30 px-6 py-4 flex justify-between items-center border-t border-white/5 relative z-10">
                  <div className="flex items-center gap-2 text-[10px] text-slate-300 uppercase tracking-widest font-bold">
                    <div className="w-2 h-2 rounded-full bg-emerald-500/50 animate-pulse" />
                    Viewing latest {BOOKING_LOG_DATA.length} booking records natively tracked by System
                  </div>
                  <div className="text-[10px] text-slate-300 font-mono tracking-widest border border-slate-700/50 px-2 py-1 flex items-center bg-slate-800/30 rounded">
                    Sync Checksum: 0x9F3EA4
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Placeholder for other tags */}

          {((activeTag as string) !== 'Branch Summary' && (activeTag as string) !== 'Performance Charts' && (activeTag as string) !== 'Week Analysis' && (activeTag as string) !== 'Booking Log' && (activeTag as string) !== 'Contract Utilisation' && (activeTag as string) !== 'Branch Allocation') && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-[600px] text-slate-300 rounded-3xl border border-slate-800 border-dashed bg-slate-900/20 backdrop-blur-sm">
              <svg className="w-12 h-12 mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              <p className="text-xl font-light">The <span className="font-semibold text-cyan-500">{activeTag}</span> module is isolated.</p>
              <p className="text-sm mt-3 text-slate-400">Select <span className="text-slate-400">Branch Summary</span> to view the primary dashboard view.</p>
            </motion.div>
          )}

        </div>
      </main>

      {/* KPI Calculation Breakdown Modal */}
      <AnimatePresence>
        {activeKpi && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Background Overlay */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setActiveKpi(null)}
              className="absolute inset-0 bg-[#000000]/80 backdrop-blur-sm cursor-pointer"
            />

            {/* Wide Compact Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-4xl max-h-[90vh] bg-gradient-to-b from-slate-900/95 to-[#050505]/95 backdrop-blur-3xl shadow-[0_40px_100px_rgba(0,0,0,0.9),inset_0_1px_1px_rgba(255,255,255,0.2)] rounded-[24px] border border-white/10 p-5 overflow-hidden z-10 flex flex-col"
            >
              {/* Top ambient highlight */}
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-50" />

              <div className="flex justify-end mb-2 relative z-20">
                <button
                  onClick={() => setActiveKpi(null)}
                  className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all bg-white/5 hover:bg-rose-500/20 hover:border-rose-500/50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="flex flex-col md:flex-row gap-6 relative z-10 flex-1 min-h-0">

                {/* Left Side: Header & Value */}
                <div className="md:w-[35%] flex flex-col justify-center border-b md:border-b-0 md:border-r border-white/10 pb-4 md:pb-0 md:pr-6">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-400 mb-1 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
                    Data Inspector
                  </h3>
                  <div className="text-[11px] uppercase tracking-widest text-slate-300 mb-2">{activeKpi.label}</div>
                  <div className="flex items-end mb-4">
                    <span className={`text-5xl font-display font-bold ${activeKpi.accentColor} drop-shadow-[0_0_15px_currentColor]`}>{activeKpi.value}</span>
                    {activeKpi.type === 'ring' && <span className="text-xl text-slate-300 font-bold ml-1 mb-1">%</span>}
                  </div>

                  <div className="mt-4 p-3 rounded-xl bg-black/40 border border-white/5 space-y-2">
                    <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest">
                      <span className="text-slate-300">Source</span>
                      <span className="text-indigo-400">Live DB</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest">
                      <span className="text-slate-300">Method</span>
                      <span className="text-emerald-400 border-b border-emerald-400/30 border-dashed">Aggregated</span>
                    </div>
                  </div>
                </div>

                {/* Right Side: Logic Breakdown */}
                <div className="md:w-[65%] bg-[#0b0f19]/80 rounded-[16px] border border-white/5 p-4 shadow-inner overflow-y-auto elegant-scrollbar max-h-[50vh] md:max-h-full">

                  <div className="font-mono text-sm w-full space-y-2">

                    {/* TOTAL ALLOCATION BREAKDOWN */}
                    {activeKpi.label === 'TOTAL ALLOCATION' && (
                      <div className="grid grid-cols-2 gap-2">
                        {reactiveBranchSnapshot.map((b, i) => (
                          <div key={b.branch} className="flex flex-col gap-1.5 p-2 rounded-lg bg-white/[0.02] border border-white/[0.02]">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{b.branch}</span>
                              <span className="font-mono text-sm text-white">{b.alloc}</span>
                            </div>
                            <div className="w-full h-[2px] bg-slate-900 rounded-full overflow-hidden">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${(b.alloc / (contractMetrics.alloc || 1)) * 100}%` }} transition={{ duration: 0.6, delay: i * 0.05 }} className="h-full bg-indigo-500" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* TOTAL BOOKED BREAKDOWN */}
                    {activeKpi.label === 'TOTAL BOOKED' && (
                      <div className="grid grid-cols-2 gap-2">
                        {reactiveBranchSnapshot.map((b, i) => (
                          <div key={b.branch} className="flex flex-col gap-1.5 p-2 rounded-lg bg-white/[0.02] border border-white/[0.02]">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{b.branch}</span>
                              <span className="font-mono text-sm text-white">{b.booked}</span>
                            </div>
                            <div className="w-full h-[2px] bg-slate-900 rounded-full overflow-hidden">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${(b.booked / (contractMetrics.booked || 1)) * 100}%` }} transition={{ duration: 0.6, delay: i * 0.05 }} className="h-full bg-cyan-400" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* UTILISATION BREAKDOWN */}
                    {activeKpi.label === 'OVERALL UTIL %' && (
                      <div className="flex flex-col gap-3">
                        <div className="flex justify-between px-4 py-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl items-center"><span className="text-xs uppercase tracking-widest text-cyan-400">Total Booked</span><span className="text-lg text-white font-bold font-sans">{contractMetrics.booked.toLocaleString()}</span></div>
                        <div className="w-full flex justify-center text-slate-300"><svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 13l-7 7-7-7m14-8l-7 7-7-7" /></svg></div>
                        <div className="flex justify-between px-4 py-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl items-center"><span className="text-xs uppercase tracking-widest text-indigo-400">Total Allocation</span><span className="text-lg text-white font-bold font-sans">{contractMetrics.alloc.toLocaleString()}</span></div>

                        <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl mt-2">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Coefficient</span>
                            <span className="text-lg font-bold text-white font-sans">{contractMetrics.util.toFixed(1)}%</span>
                          </div>
                          <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, contractMetrics.util)}%` }} transition={{ duration: 1, ease: "easeOut" }} className="h-full bg-emerald-400" />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* OVERBOOKED BREAKDOWN */}
                    {activeKpi.label === 'OVERBOOKED' && (
                      <div className="flex flex-col gap-2">
                        {cuOverbooked.length > 0 ? cuOverbooked.map(c => (
                          <div key={c.id} className="flex justify-between items-center p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                            <span className="text-white text-sm truncate max-w-[200px]" title={c.carrier}>{c.id}</span>
                            <span className="text-xs text-rose-400 font-bold whitespace-nowrap">{c.booked.toFixed(1)} / {c.alloc.toFixed(1)}</span>
                          </div>
                        )) : <div className="text-slate-300 italic p-4 text-center">No contracts overbooked</div>}
                      </div>
                    )}

                    {/* LOW UTIL BREAKDOWN */}
                    {activeKpi.label === 'LOW UTILISATION' && (
                      <div className="grid grid-cols-2 gap-2">
                        {reactiveBranchSnapshot.filter(b => parseFloat(b.util.toString()) < 60).map(b => (
                          <div key={b.branch} className="flex justify-between items-center p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <span className="text-white text-sm">{b.branch}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-sm">{b.util}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ACTIVE WEEK */}
                    {activeKpi.label === 'ACTIVE WEEKS' && (
                      <div className="flex flex-col items-center justify-center py-6">
                        <div className="w-16 h-16 rounded-full border border-slate-600 flex items-center justify-center mb-4">
                          <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                        <div className="text-2xl text-white font-display">Week <span className="font-bold text-slate-300">{selectedWeek === 'ALL' ? 'ALL' : selectedWeek.split(' ')[1]}</span></div>
                        <div className="text-sm text-slate-300 mt-2">Active Weeks Monitored: {AVAILABLE_WEEKS.length}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full Screen Matrix Projection Modal (Restored to Root) */}
      <AnimatePresence>
        {isMatrixPreviewOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
              onClick={() => setIsMatrixPreviewOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-lg cursor-pointer"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-7xl max-h-[90vh] bg-[#0b0e14] border border-slate-700/80 shadow-[0_0_80px_rgba(0,0,0,0.8)] rounded-2xl flex flex-col z-10 overflow-hidden"
            >
              <div className="flex justify-between items-center bg-slate-900/80 px-6 py-5 border-b border-slate-800/80">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                  </div>
                  <div>
                    <h3 className="text-slate-200 font-bold tracking-wide text-sm">Matrix <span className="text-indigo-400">Projection Popup</span></h3>
                    <p className="text-xs text-slate-300">Immersive Data Node Inspection Layer</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMatrixPreviewOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700/80 border border-slate-700 hover:border-slate-500 rounded-lg p-2 backdrop-blur"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="flex-1 overflow-auto p-6 md:p-8 bg-slate-950">
                <div className="bg-[#0b0f19] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl scale-[1.02] origin-top mb-10 md:mb-20">
                  <div className="overflow-x-auto elegant-scrollbar w-full pb-4">
                    <table className="w-full text-left border-collapse table-fixed min-w-[1600px]">
                      <thead>
                        <tr className="bg-black/50 border-b border-white/10">
                          <th className="px-8 py-6 font-bold text-slate-400 text-xs tracking-widest uppercase border-r border-white/10 w-[200px] sticky left-0 bg-[#0b0f19] z-20">IDENTIFIER Node</th>
                          {['WK 12', 'WK 13', 'WK 14', 'WK 15', 'WK 16', 'WK 17', 'WK 18', 'WK 19'].map(wk => (
                            <th key={wk} className="px-4 py-6 font-bold text-indigo-400 text-xs tracking-widest uppercase text-center border-r border-white/10 bg-indigo-950/20" colSpan={3}>{wk}</th>
                          ))}
                        </tr>
                        <tr className="bg-black/30 border-b border-white/10">
                          <th className="px-8 py-3 border-r border-white/10 sticky left-0 bg-[#0b0f19] z-20" />
                          {Array(8).fill(0).map((_, i) => (
                            <React.Fragment key={i}>
                              <th className="px-2 py-3 text-[9px] font-bold text-slate-300 text-center border-r border-white/10 uppercase tracking-widest">Allocation</th>
                              <th className="px-2 py-3 text-[9px] font-bold text-slate-300 text-center border-r border-white/10 uppercase tracking-widest">Booked</th>
                              <th className="px-2 py-3 text-[9px] font-bold text-indigo-400 text-center border-r border-white/10 uppercase tracking-widest bg-indigo-500/5">Util%</th>
                            </React.Fragment>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {CONTRACT_WEEKLY_BREAKDOWN.map((contractRow, idx) => (
                          <React.Fragment key={idx}>
                            {contractRow.type === 'TOTAL' ? (
                              <tr className="bg-indigo-900/10 border-b border-white/10 group/prow hover:bg-indigo-900/20 transition-colors">
                                <td className="px-8 py-6 font-display font-bold text-white text-sm border-r border-indigo-500/30 sticky left-0 bg-[#0b0f19] z-10">{contractRow.contract}</td>
                                {['WK12', 'WK13', 'WK14', 'WK15', 'WK16', 'WK17', 'WK18', 'WK19'].map(wk => {
                                  const d = (contractRow.data as any)[wk];
                                  const utilColor = d.util >= 100 ? 'bg-rose-500/30 text-rose-400 border-rose-500/50' : d.util >= 90 ? 'bg-amber-500/30 text-amber-400 border-amber-500/50' : d.util > 0 ? 'bg-emerald-500/30 text-emerald-400 border-emerald-500/50' : 'text-slate-400';
                                  return (
                                    <React.Fragment key={wk}>
                                      <td className="px-2 py-6 text-center border-r border-white/10 font-mono text-xs text-slate-300">{d.alloc}</td>
                                      <td className="px-2 py-6 text-center border-r border-white/10 font-mono text-xs text-slate-300">{d.booked.toFixed(1)}</td>
                                      <td className={`px-2 py-6 text-center border-r border-white/10 font-mono font-bold text-sm ${utilColor}`}>
                                        <div className={`mx-auto px-2 py-1 rounded-lg border ${utilColor}`}>{d.util}%</div>
                                      </td>
                                    </React.Fragment>
                                  );
                                })}
                              </tr>
                            ) : (
                              (contractRow as any).branches?.map((branch: any, bIdx: number) => (
                                <tr key={`${idx}-${bIdx}`} className="border-b border-white/5 hover:bg-white/[0.05] transition-colors group/pbranch">
                                  <td className="px-8 py-5 border-r border-white/10 sticky left-0 bg-[#0b0f19] z-10 flex items-center gap-4">
                                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded font-bold font-mono">{branch.code}</span>
                                    <span className="text-sm text-slate-300 font-medium">{branch.branch}</span>
                                  </td>
                                  {['WK12', 'WK13', 'WK14', 'WK15', 'WK16', 'WK17', 'WK18', 'WK19'].map(wk => {
                                    const d = (branch.data as any)[wk];
                                    const utilColor = d.util >= 100 ? 'text-rose-400' : d.util >= 90 ? 'text-amber-400' : d.util > 0 ? 'text-emerald-400' : 'text-slate-300';
                                    return (
                                      <React.Fragment key={wk}>
                                        <td className="px-2 py-5 text-center border-r border-white/10 font-mono text-xs text-slate-300">{d.alloc}</td>
                                        <td className="px-2 py-5 text-center border-r border-white/10 font-mono text-xs text-slate-300">{d.booked.toFixed(1)}</td>
                                        <td className={`px-2 py-5 text-center border-r border-white/10 font-mono font-bold text-xs ${utilColor}`}>
                                          {d.util > 0 ? `${d.util}%` : '-'}
                                        </td>
                                      </React.Fragment>
                                    );
                                  })}
                                </tr>
                              ))
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-black/80 border-t-2 border-indigo-500/50">
                          <td className="px-8 py-8 sticky left-0 bg-black z-10 font-display font-bold text-white text-xl uppercase tracking-tighter shadow-[20px_0_40px_rgba(0,0,0,0.5)]">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-cyan-400 tracking-[0.2em] uppercase">GRAND TOTAL</span>
                              <span className="text-xs text-slate-300 font-bold uppercase mt-1">All Contracts</span>
                            </div>
                          </td>
                          {reactiveWeeklyTrendData.map((wk, i) => (
                            <React.Fragment key={i}>
                              <td className="px-2 py-8 text-center border-r border-white/10 font-mono font-bold text-lg text-white">{wk.alloc}</td>
                              <td className="px-2 py-8 text-center border-r border-white/10 font-mono font-bold text-lg text-white">{wk.booked.toFixed(1)}</td>
                              <td className={`px-2 py-8 text-center border-r border-white/10 font-mono font-bold text-xl ${wk.util >= 100 ? 'text-rose-400' : 'text-emerald-400'} drop-shadow-[0_0_10px_currentColor]`}>{wk.util}%</td>
                            </React.Fragment>
                          ))}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Booking Branch Modal */}
      <AnimatePresence>
        {isBookingBranchModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} onClick={() => setIsBookingBranchModalOpen(false)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-lg" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-4xl bg-[#0b0e14] border border-slate-700/80 shadow-[0_0_80px_rgba(0,0,0,0.8)] rounded-2xl flex flex-col z-10 overflow-hidden">
              <div className="flex justify-between items-center bg-slate-900/80 px-6 py-5 border-b border-slate-800/80">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  </div>
                  <div>
                    <h3 className="text-slate-200 font-bold tracking-wide text-sm">Branch <span className="text-emerald-400">Summary</span></h3>
                    <p className="text-xs text-slate-300">Booking Log Aggregate View</p>
                  </div>
                </div>
                <button onClick={() => setIsBookingBranchModalOpen(false)} className="text-slate-400 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700/80 border border-slate-700 hover:border-slate-500 rounded-lg p-2 backdrop-blur">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-8">
                <div className="bg-[#0b0f19] border border-white/10 rounded-[20px] overflow-hidden shadow-2xl">
                  <table className="w-full text-left border-collapse table-auto">
                    <thead>
                      <tr className="bg-[#1e293b]/50 border-b border-white/10">
                        <th className="px-6 py-4 font-bold text-slate-400 text-xs tracking-widest uppercase text-center w-24">Code</th>
                        <th className="px-6 py-4 font-bold text-slate-400 text-xs tracking-widest uppercase">Branch Name</th>
                        <th className="px-6 py-4 font-bold text-emerald-400 text-xs tracking-widest uppercase text-right">Total TEU</th>
                        <th className="px-6 py-4 font-bold text-slate-400 text-xs tracking-widest uppercase text-right">Bookings</th>
                        <th className="px-6 py-4 font-bold text-slate-400 text-xs tracking-widest uppercase text-right">Contracts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {reactiveBookingBranchSummary.map((row, i) => (
                        <tr key={i} className={row.code === 'ALL' ? 'bg-emerald-900/20' : 'hover:bg-white/[0.02] transition-colors'}>
                          <td className={`px-6 py-4 font-mono text-sm font-bold text-center ${row.code === 'ALL' ? 'text-white' : 'text-slate-300'}`}>{row.code}</td>
                          <td className={`px-6 py-4 font-medium ${row.code === 'ALL' ? 'text-white' : 'text-slate-300'}`}>{row.branch}</td>
                          <td className="px-6 py-4 font-mono text-base font-bold text-emerald-400 text-right drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]">{row.teu.toFixed(1)}</td>
                          <td className={`px-6 py-4 font-mono text-sm text-right ${row.code === 'ALL' ? 'text-white font-bold' : 'text-slate-400'}`}>{row.bookings}</td>
                          <td className={`px-6 py-4 font-mono text-sm text-right ${row.code === 'ALL' ? 'text-white font-bold' : 'text-slate-400'}`}>{row.contracts || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Booking Contract Modal */}
      <AnimatePresence>
        {isBookingContractModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} onClick={() => setIsBookingContractModalOpen(false)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-lg" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-4xl bg-[#0b0e14] border border-slate-700/80 shadow-[0_0_80px_rgba(0,0,0,0.8)] rounded-2xl flex flex-col z-10 overflow-hidden">
              <div className="flex justify-between items-center bg-slate-900/80 px-6 py-5 border-b border-slate-800/80">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <div>
                    <h3 className="text-slate-200 font-bold tracking-wide text-sm">Contract <span className="text-cyan-400">Breakdown</span></h3>
                    <p className="text-xs text-slate-300">Log Aggregate Pivot</p>
                  </div>
                </div>
                <button onClick={() => setIsBookingContractModalOpen(false)} className="text-slate-400 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700/80 border border-slate-700 hover:border-slate-500 rounded-lg p-2 backdrop-blur">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-8">
                <div className="bg-[#0b0f19] border border-white/10 rounded-[20px] overflow-hidden shadow-2xl">
                  <table className="w-full text-left border-collapse table-auto">
                    <thead>
                      <tr className="bg-[#1e293b]/50 border-b border-white/10">
                        <th className="px-6 py-4 font-bold text-slate-400 text-xs tracking-widest uppercase">Contract</th>
                        <th className="px-6 py-4 font-bold text-slate-400 text-xs tracking-widest uppercase text-center w-32">Region</th>
                        <th className="px-6 py-4 font-bold text-cyan-400 text-xs tracking-widest uppercase text-right w-40">Total TEU</th>
                        <th className="px-6 py-4 font-bold text-slate-400 text-xs tracking-widest uppercase text-right w-40">Bookings</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {reactiveBookingContractBreakdown.map((row, i) => (
                        <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-4 font-mono text-sm font-bold text-slate-300">{row.contract}</td>
                          <td className="px-6 py-4 font-mono text-sm font-bold text-cyan-400 text-center"><div className="px-2 py-1 bg-cyan-500/10 rounded border border-cyan-500/20 w-min mx-auto">{row.region}</div></td>
                          <td className="px-6 py-4 font-mono text-base font-bold text-white text-right">{row.teu.toFixed(1)}</td>
                          <td className="px-6 py-4 font-mono text-sm font-bold text-slate-400 text-right">{row.bookings}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Fullscreen Raw Order Trajectory Modal */}
      <AnimatePresence>
        {isBookingTableModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} onClick={() => setIsBookingTableModalOpen(false)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-lg" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-[95vw] h-[90vh] bg-[#0b0e14] border border-slate-700/80 shadow-[0_0_80px_rgba(0,0,0,0.8)] rounded-3xl flex flex-col z-10 overflow-hidden">
              <div className="flex justify-between items-center bg-black/60 px-8 py-6 border-b border-white/10 shrink-0">
                <div className="flex flex-col gap-1">
                  <h3 className="text-white font-display font-light text-3xl tracking-tighter">Raw Order <span className="font-bold text-emerald-400">Trajectory</span></h3>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Live DB Fullscreen Projection ({BOOKING_LOG_DATA.length} Entries)</p>
                  </div>
                </div>
                <button onClick={() => setIsBookingTableModalOpen(false)} className="text-slate-400 hover:text-white transition-colors bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/50 rounded-xl p-3 backdrop-blur shadow-2xl">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="flex-1 overflow-auto elegant-scrollbar p-6 md:p-10 bg-slate-950">
                <div className="bg-[#0b0f19] border border-white/10 rounded-[20px] overflow-hidden shadow-2xl scale-[1.01] origin-top mb-10 pb-4">
                  <div className="overflow-x-auto elegant-scrollbar">
                    <table className="w-full text-left border-collapse table-fixed min-w-[3500px]">
                      <thead>
                        <tr className="bg-slate-900/60 font-bold border-b-2 border-emerald-500/20">
                          <th className="px-8 py-5 text-slate-400 text-xs tracking-widest uppercase sticky left-0 z-20 bg-slate-900/90 backdrop-blur w-48">Contract Key</th>
                          <th className="px-8 py-5 text-slate-400 text-xs tracking-widest uppercase sticky left-48 z-20 bg-slate-900/90 backdrop-blur w-48">Order No.</th>
                          <th className="px-8 py-5 text-slate-400 text-xs tracking-widest uppercase">Buyer</th>
                          <th className="px-8 py-5 text-slate-400 text-xs tracking-widest uppercase">Supplier</th>
                          <th className="px-8 py-5 text-slate-400 text-xs tracking-widest uppercase">ETD</th>
                          <th className="px-8 py-5 text-slate-400 text-xs tracking-widest uppercase">ETA</th>
                          <th className="px-8 py-5 text-slate-400 text-xs tracking-widest uppercase">Dep. Vessel</th>
                          <th className="px-8 py-5 text-slate-400 text-xs tracking-widest uppercase">Dep. Voyage</th>
                          <th className="px-8 py-5 text-slate-400 text-xs tracking-widest uppercase">Arr. Vessel</th>
                          <th className="px-8 py-5 text-slate-400 text-xs tracking-widest uppercase">Arr. Voyage</th>
                          <th className="px-8 py-5 text-slate-400 text-xs tracking-widest uppercase">Origin</th>
                          <th className="px-8 py-5 text-slate-400 text-xs tracking-widest uppercase text-center">Load Port</th>
                          <th className="px-8 py-5 text-slate-400 text-xs tracking-widest uppercase text-center">Discharge Port</th>
                          <th className="px-8 py-5 text-slate-400 text-xs tracking-widest uppercase text-center">Destination</th>
                          <th className="px-8 py-5 text-slate-400 text-xs tracking-widest uppercase">House Bill</th>
                          <th className="px-8 py-5 text-slate-400 text-xs tracking-widest uppercase">Master Bill</th>
                          <th className="px-8 py-5 text-indigo-400 text-xs tracking-widest uppercase text-center">Branch</th>
                          <th className="px-8 py-5 text-emerald-400 text-xs tracking-widest uppercase text-right">TEU</th>
                          <th className="px-8 py-5 text-slate-400 text-xs tracking-widest uppercase text-right">Containers</th>
                          <th className="px-8 py-5 text-slate-400 text-xs tracking-widest uppercase text-center">MSC Wk No</th>
                          <th className="px-8 py-5 text-slate-400 text-xs tracking-widest uppercase text-right">Total TEU</th>
                          <th className="px-8 py-5 text-slate-400 text-xs tracking-widest uppercase text-right">Total FEU</th>
                          <th className="px-8 py-5 text-slate-400 text-xs tracking-widest uppercase text-center">MSC Week</th>
                          <th className="px-8 py-5 text-slate-400 text-xs tracking-widest uppercase text-center">Country</th>
                          <th className="px-8 py-5 text-slate-400 text-xs tracking-widest uppercase text-center">Year</th>
                          <th className="px-8 py-5 text-slate-400 text-xs tracking-widest uppercase text-center">QTR</th>
                          <th className="px-8 py-5 text-cyan-400 text-xs tracking-widest uppercase text-center">Region</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {BOOKING_LOG_DATA.filter(b => (selectedWeek === 'ALL' || `WK ${b.mscWeek}` === selectedWeek) && (selectedContract === 'ALL' || b.contract === selectedContract)).map((row, i) => (
                          <tr key={noNodeNum + i} className="hover:bg-white/[0.03] transition-colors group">
                            <td className="px-8 py-6 font-mono text-sm font-bold text-slate-200 sticky left-0 z-10 bg-[#0b0f19] border-r border-white/5 group-hover:bg-[#111928] transition-colors flex items-center gap-4">
                              <div className="w-2 h-2 rounded-full bg-slate-700 group-hover:bg-emerald-400 transition-colors" />
                              {row.contract}
                            </td>
                            <td className="px-8 py-6 font-mono text-sm text-indigo-300 font-bold sticky left-48 z-10 bg-[#0b0f19] border-r border-white/5 group-hover:bg-[#111928]">{row.order}</td>
                            <td className="px-8 py-6 text-sm text-slate-300 truncate max-w-xs" title={row.buyer}>{row.buyer}</td>
                            <td className="px-8 py-6 text-sm text-slate-400 truncate max-w-xs" title={row.supplier}>{row.supplier}</td>
                            <td className="px-8 py-6 font-mono text-xs text-slate-400 whitespace-nowrap">{row.etd}</td>
                            <td className="px-8 py-6 font-mono text-xs text-slate-400 whitespace-nowrap">{row.eta}</td>
                            <td className="px-8 py-6 text-sm text-slate-300 whitespace-nowrap">{row.depVessel}</td>
                            <td className="px-8 py-6 font-mono text-xs text-slate-300 whitespace-nowrap">{row.depVoyage}</td>
                            <td className="px-8 py-6 text-sm text-slate-300 whitespace-nowrap">-</td>
                            <td className="px-8 py-6 font-mono text-xs text-slate-300 whitespace-nowrap">-</td>
                            <td className="px-8 py-6 text-xs text-indigo-400 font-medium uppercase">{row.originRegion}</td>
                            <td className="px-8 py-6 font-mono text-xs text-center text-slate-300 bg-slate-900/20">{row.loadPort}</td>
                            <td className="px-8 py-6 font-mono text-xs text-center text-slate-300 bg-slate-900/20">{row.dischargePort}</td>
                            <td className="px-8 py-6 text-xs text-indigo-400 font-medium uppercase">{row.destRegion}</td>
                            <td className="px-8 py-6 font-mono text-[11px] text-slate-300">N/A</td>
                            <td className="px-8 py-6 font-mono text-[11px] text-slate-300">N/A</td>
                            <td className="px-8 py-6 text-center"><div className="text-xs font-bold px-3 py-1 bg-indigo-500/10 text-indigo-300 rounded border border-indigo-500/20 font-mono tracking-widest">{row.branch}</div></td>
                            <td className="px-8 py-6 font-mono text-lg font-bold text-emerald-400 text-right drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]">{(row.teu || 0).toFixed(2)}</td>
                            <td className="px-8 py-6 font-mono text-sm text-slate-400 text-right">{row.containers || '-'}</td>
                            <td className="px-8 py-6 font-mono text-xs text-center text-slate-300">{row.mscWeek}</td>
                            <td className="px-8 py-6 font-mono text-sm text-slate-400 text-right">{(row.teu || 0).toFixed(2)}</td>
                            <td className="px-8 py-6 font-mono text-sm text-slate-400 text-right">-</td>
                            <td className="px-8 py-6 font-mono text-xs text-center text-slate-300 whitespace-nowrap">WK {row.mscWeek}</td>
                            <td className="px-8 py-6 font-mono text-xs text-center text-slate-400">-</td>
                            <td className="px-8 py-6 font-mono text-xs text-center text-slate-400">2026</td>
                            <td className="px-8 py-6 font-mono text-xs text-center text-slate-400">-</td>
                            <td className="px-8 py-6 text-center"><div className="px-2 py-1 bg-cyan-500/10 rounded border border-cyan-500/20 text-cyan-400 text-[10px] font-bold uppercase tracking-widest">{row.destRegion || '-'}</div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Premium Dark Theme Pop-up Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-12">
            {/* Elegant Dimmed Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-lg cursor-pointer"
            />

            {/* Modal Content - Glassmorphism Grid */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-5xl bg-[#0b0e14] border border-slate-700/80 shadow-[0_0_80px_rgba(0,0,0,0.8)] rounded-2xl overflow-hidden flex flex-col"
            >
              <div className="flex justify-between items-center bg-slate-900/80 px-6 py-5 border-b border-slate-800/80">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  </div>
                  <div>
                    <h3 className="text-slate-200 font-bold tracking-wide text-sm">Branch Performance Snapshot Matrix</h3>
                    <p className="text-xs text-slate-300">Live operational readout from Cargowise DB</p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700/80 border border-slate-700 hover:border-slate-500 rounded-lg p-2 backdrop-blur">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="overflow-x-auto p-6 bg-slate-950">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="px-5 py-3 font-semibold text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">Operational Hub</th>
                      <th className="px-5 py-3 font-semibold text-slate-400 text-xs uppercase tracking-wider text-right border-b border-slate-800">Allocation <span className="text-slate-400">(TEU)</span></th>
                      <th className="px-5 py-3 font-semibold text-cyan-500/80 text-xs uppercase tracking-wider text-right border-b border-slate-800">Booked <span className="text-slate-400">(TEU)</span></th>
                      <th className="px-5 py-3 font-semibold text-slate-400 text-xs uppercase tracking-wider text-right border-b border-slate-800">Available</th>
                      <th className="px-5 py-3 font-semibold text-slate-400 text-xs uppercase tracking-wider text-right border-b border-slate-800">Utilisation %</th>
                      <th className="px-5 py-3 font-semibold text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800 text-center">Status Flag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {reactiveBranchSnapshot.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-900/50 transition-colors group">
                        <td className="px-5 py-4 font-semibold text-slate-300 flex items-center gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-600 group-hover:bg-cyan-500 transition-colors" />
                          {row.branch}
                        </td>
                        <td className="px-5 py-4 text-right text-slate-400 font-mono">{row.alloc}</td>
                        <td className="px-5 py-4 text-right">
                          <span className={`font-mono font-bold px-2 py-1 rounded bg-slate-900 border ${row.status === 'Low Uptake' ? 'text-amber-400 border-amber-500/20 shadow-[0_0_10px_rgba(251,191,36,0.1)]' : 'text-cyan-400 border-cyan-500/20'}`}>
                            {row.booked}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right text-slate-300 font-mono">{row.avail}</td>
                        <td className={`px-5 py-4 text-right font-mono font-semibold ${row.status === 'Low Uptake' ? 'text-slate-400' : 'text-emerald-400'}`}>{row.util}</td>
                        <td className="px-5 py-4 text-center">
                          <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${row.status === 'On Track'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                            }`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-slate-900/50 px-6 py-4 flex justify-between items-center border-t border-slate-800/80">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-2 h-2 rounded-full bg-emerald-500/50 animate-pulse" />
                  System Auto-Generated
                </div>
                <div className="text-xs text-slate-300 font-mono">
                  Report ID: CW-190326-0634
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Contract Utilisation KPI Summary Modal */}
      <AnimatePresence>
        {activeCuKpi && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActiveCuKpi(null)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 30 }} className="relative w-full max-w-lg bg-[#0b0e14] border border-violet-500/30 shadow-[0_0_80px_rgba(139,92,246,0.2)] rounded-3xl overflow-hidden z-20">
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-violet-400 uppercase tracking-[0.2em]">{activeCuKpi.sub}</span>
                    <h3 className="text-3xl font-display font-light text-white">{activeCuKpi.label}</h3>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-bold ${activeCuKpi.color} ${activeCuKpi.bg} border ${activeCuKpi.border}`}>
                    {activeCuKpi.trend}
                  </div>
                </div>

                <div className="text-5xl font-display font-bold text-white mb-6 tracking-tighter">
                  {activeCuKpi.value}
                </div>

                <div className="bg-white/5 rounded-2xl p-5 border border-white/5 mb-8">
                  <p className="text-slate-400 text-sm leading-relaxed font-light italic">
                    "{activeCuKpi.details}"
                  </p>
                </div>

                <button
                  onClick={() => setActiveCuKpi(null)}
                  className="w-full py-4 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-2xl transition-all shadow-[0_10px_20px_rgba(124,58,237,0.3)] active:scale-95"
                >
                  Understood
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Fullscreen Contract Matrix Modal */}
      <AnimatePresence>
        {isCuTableModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCuTableModalOpen(false)} className="absolute inset-0 bg-slate-950/90 backdrop-blur-2xl" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 40 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 40 }} className="relative w-full max-w-[95vw] h-[90vh] bg-[#0b0e14] border border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.8)] rounded-3xl overflow-hidden z-20 flex flex-col">
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-black/40">
                <div className="flex flex-col gap-1">
                  <h3 className="text-3xl font-display font-light text-white">Full Carrier <span className="font-bold text-violet-400">Capacity Matrix</span></h3>
                  <p className="text-xs text-slate-300 uppercase tracking-widest font-bold">Comprehensive Multi-Carrier Allocation Breakdown</p>
                </div>
                <button
                  onClick={() => setIsCuTableModalOpen(false)}
                  className="w-12 h-12 bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/50 rounded-2xl flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-2xl"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="flex-1 overflow-auto elegant-scrollbar p-8">
                {/* Re-using the table content here */}
                <div className="bg-[#0b0f19] border border-white/10 rounded-[32px] overflow-hidden overflow-x-auto elegant-scrollbar">
                  <table className="w-full text-left border-collapse table-fixed min-w-[1600px]">
                    <thead>
                      <tr className="bg-slate-900/60 font-bold border-b border-white/10">
                        {['Contract ID', 'Carrier', 'Trade Lane', 'Alloc (TEU)', 'Booked (TEU)', 'Avail (TEU)', 'Util %', 'Status', 'SYD A/B', 'MEL A/B', 'BNE A/B', 'PER A/B', 'ADL A/B'].map((h, i) => (
                          <th key={h} className={`px-6 py-5 font-bold text-xs tracking-widest uppercase ${i === 7 ? 'text-center' : i >= 8 ? 'text-center text-violet-400' : i >= 4 ? 'text-right text-cyan-400' : 'text-slate-400'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {reactiveContractUtilData.map((row, i) => {
                        const statusStyle = row.util > 100 ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : row.util >= 85 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : row.util >= 70 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-slate-700/30 text-slate-400 border-slate-600/30';
                        return (
                          <tr key={i} className="hover:bg-white/[0.03] transition-colors group/mod">
                            <td className="px-6 py-6 font-mono text-sm font-bold text-violet-300">{row.id}</td>
                            <td className="px-6 py-6 text-sm text-slate-300 font-medium">{row.carrier}</td>
                            <td className="px-6 py-6 font-mono text-xs text-slate-300">{row.lane}</td>
                            <td className="px-6 py-6 text-right font-mono text-base text-slate-300">{row.alloc}</td>
                            <td className="px-6 py-6 text-right font-mono text-base font-bold text-cyan-400">{row.booked}</td>
                            <td className={`px-6 py-6 text-right font-mono text-base font-bold ${row.avail < 0 ? 'text-rose-400' : 'text-slate-400'}`}>{row.avail}</td>
                            <td className={`px-6 py-6 text-right font-mono text-base font-bold ${row.util > 100 ? 'text-rose-400' : row.util >= 85 ? 'text-amber-400' : 'text-emerald-400'}`}>{row.util.toFixed(1)}%</td>
                            <td className="px-6 py-6 text-center"><span className={`text-[10px] font-bold px-3 py-1 rounded border uppercase tracking-wider ${statusStyle}`}>{row.status}</span></td>
                            {[row.syd, row.mel, row.bne, row.per, row.adl].map((b, bi) => (
                              <td key={bi} className="px-6 py-6 text-center font-mono text-sm">
                                <span className={b.booked > b.alloc ? 'text-rose-400' : 'text-slate-300'}>{b.booked}</span>
                                <span className="text-slate-400">/{b.alloc}</span>
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="p-8 bg-black/40 border-t border-white/5 flex justify-between items-center text-xs text-slate-300 font-bold uppercase tracking-[0.3em]">
                <div>Network Integrity Verified</div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                  Live Data Stream
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Fullscreen Branch Allocation Matrix Modal */}
      <AnimatePresence>
        {isBranchTableModalOpen && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsBranchTableModalOpen(false)} className="absolute inset-0 bg-slate-950/90 backdrop-blur-2xl" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 40 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 40 }} className="relative w-full max-w-[95vw] h-[90vh] bg-[#0b0e14] border border-white/10 shadow-[0_60px_120px_rgba(0,0,0,1)] rounded-[40px] overflow-hidden z-20 flex flex-col">
              <div className="p-10 border-b border-white/5 flex justify-between items-center bg-black/40">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <h3 className="text-4xl font-display font-light text-white">Branch <span className="font-bold text-amber-400">Allocation breakdown</span></h3>
                  </div>
                  <p className="text-xs text-slate-300 uppercase tracking-widest font-black ml-5">Global Hub Strategic Capacity matrix | LIVE</p>
                </div>
                <button
                  onClick={() => setIsBranchTableModalOpen(false)}
                  className="w-16 h-16 bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/50 rounded-3xl flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-2xl"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="flex-1 overflow-auto elegant-scrollbar p-10 bg-[#050505]/40">
                <div className="bg-[#0b0f19] border border-white/10 rounded-[30px] overflow-hidden shadow-2xl overflow-x-auto elegant-scrollbar">
                  {/* Re-using the same table structure for the modal */}
                  <table className="w-full text-left border-separate border-spacing-0 min-w-[1600px]">
                    <thead>
                      <tr className="bg-slate-900/60 font-bold border-b-2 border-amber-500/20">
                        <th rowSpan={2} className="p-8 text-slate-400 text-xs tracking-[0.2em] font-black uppercase border-r border-white/10 sticky left-0 z-20 bg-slate-900/95 backdrop-blur w-44">Contract ID</th>
                        <th rowSpan={2} className="p-8 text-slate-400 text-xs tracking-[0.2em] font-black uppercase border-r border-white/10 sticky left-44 z-20 bg-slate-900/95 backdrop-blur w-56">Carrier</th>
                        <th rowSpan={2} className="p-8 text-slate-400 text-xs tracking-[0.2em] font-black uppercase border-r border-white/10 w-32 text-center">Lane</th>
                        <th colSpan={3} className="px-2 py-6 text-center bg-rose-500/10 border-b border-r border-rose-500/20 text-rose-400 text-xs font-black uppercase tracking-[0.3em] font-display selection:bg-rose-500/30">Sydney</th>
                        <th colSpan={3} className="px-2 py-6 text-center bg-cyan-500/10 border-b border-r border-cyan-500/20 text-cyan-400 text-xs font-black uppercase tracking-[0.3em] font-display">Melbourne</th>
                        <th colSpan={3} className="px-2 py-6 text-center bg-amber-500/10 border-b border-r border-amber-500/20 text-amber-400 text-xs font-black uppercase tracking-[0.3em] font-display">Brisbane</th>
                        <th colSpan={3} className="px-2 py-6 text-center bg-emerald-500/10 border-b border-r border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-[0.3em] font-display">Perth</th>
                        <th colSpan={3} className="px-2 py-6 text-center bg-indigo-500/10 border-b border-white/10 text-indigo-400 text-xs font-black uppercase tracking-[0.3em] font-display">Adelaide</th>
                      </tr>
                      <tr className="bg-slate-950 font-black text-[10px] text-slate-400 uppercase tracking-widest">
                        {['Alloc', 'Booked', 'Util%', 'Alloc', 'Booked', 'Util%', 'Alloc', 'Booked', 'Util%', 'Alloc', 'Booked', 'Util%', 'Alloc', 'Booked', 'Util%'].map((h, i) => (
                          <th key={i} className={`px-4 py-5 text-center border-b border-r border-white/[0.05] ${i % 3 === 2 ? 'bg-white/[0.01]' : ''}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {reactiveContractUtilData.map((row, i) => (
                        <tr key={i} className="hover:bg-white/[0.04] transition-all duration-300">
                          <td className="p-8 font-mono text-sm font-black text-slate-200 border-r border-white/5 sticky left-0 z-10 bg-[#0b0f19]">{row.id}</td>
                          <td className="p-8 text-sm text-white border-r border-white/5 font-bold sticky left-44 z-10 bg-[#0b0f19]">{row.carrier}</td>
                          <td className="p-8 text-center border-r border-white/5"><span className="text-xs px-3 py-1.5 bg-slate-800 rounded-lg font-black text-slate-400 font-mono tracking-tighter border border-white/5">{row.lane}</span></td>
                          {[row.syd, row.mel, row.bne, row.per, row.adl].map((b, bi) => {
                            const util = b.alloc > 0 ? (b.booked / b.alloc) * 100 : 0;
                            return (
                              <React.Fragment key={bi}>
                                <td className="px-2 py-8 text-center font-mono text-xs text-slate-300">{b.alloc}</td>
                                <td className={`px-2 py-8 text-center font-mono text-sm font-black ${util > 100 ? 'text-rose-400' : 'text-slate-200'}`}>{b.booked}</td>
                                <td className={`px-2 py-8 text-center border-r border-white/5 font-mono text-[11px] font-black ${util > 100 ? 'text-rose-400' : 'text-slate-300'}`}>{util.toFixed(0)}%</td>
                              </React.Fragment>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default ContractDashboard;
