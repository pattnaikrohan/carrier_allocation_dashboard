import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { ComposedChart, Area, Line, Bar, BarChart, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import Navbar from '../components/Navbar';
import { useBookingData } from '../data/useBookingData';




// KPI template — actual values are computed reactively inside the component via `reactiveKpis`
const noNodeNum = 'node-';

const KPI_DATA = [
  { id: 'alloc', label: 'TOTAL ALLOCATION', value: '0', sub: 'Max Capacity', accentColor: 'text-indigo-400', shadow: 'shadow-[0_4px_30px_rgba(99,102,241,0.15)]', type: 'bar', percent: 100, barColor: 'bg-indigo-500' },
  { id: 'book', label: 'TOTAL BOOKED', value: '0', sub: 'TEUs Confirmed', accentColor: 'text-cyan-400', shadow: 'shadow-[0_4px_30px_rgba(34,211,238,0.15)]', type: 'bar', percent: 0, barColor: 'bg-cyan-400' },
  { id: 'util', label: 'OVERALL UTIL %', value: '0', decimal: '%', sub: 'Target: >80%', accentColor: 'text-emerald-400', shadow: 'shadow-[0_4px_30px_rgba(52,211,153,0.15)]', type: 'ring', percent: 0, ringColor: '#34d399' },
  { id: 'undr', label: 'UNDERPERFORMING CONTRACT (≤80%)', value: '0', sub: 'Utilisation at risk', accentColor: 'text-rose-500', shadow: 'shadow-[0_4px_30px_rgba(244,63,94,0.15)]', type: 'alert', isPulse: true },
  { id: 'low', label: 'LOW UTILISATION CONTRACT', value: '0', sub: 'Below 50%', accentColor: 'text-amber-400', shadow: 'shadow-[0_4px_30px_rgba(251,191,36,0.15)]', type: 'text' },
  { id: 'wk', label: 'ACTIVE WEEKS', value: '0', sub: 'FY 2026', accentColor: 'text-slate-300', shadow: 'shadow-[0_4px_30px_rgba(148,163,184,0.10)]', type: 'calendar' },
];


const SIDE_TAGS = ['Branch Summary', 'Contract Utilisation', 'Booking Log'];

function round(num: number) { return Math.round(num); }

/** Format Contract display: Contract ID | Carrier | Contract Name */
function formatContract(c: any): string {
  if (!c) return 'Unknown';
  const id = c.id || c.contract || c;
  const carrier = c.carrier ? ` | ${c.carrier}` : '';
  const name = c.contractName ? ` | ${c.contractName}` : '';
  return `${id}${carrier}${name}`;
}

/** Convert ISO datetime string to DD/MM/YYYY */
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return String(dateStr);
  }
}

/**
 * Global colour helper — enforces the underutilisation-risk rule:
 *   util ≤ 80%  → Red   (Underperforming / risk)
 *   util 80-100% → Emerald (Healthy)
 *   util > 100%  → Cyan   (Overutilised — still healthy)
 */
function getUtilColor(util: number, mode: 'text' | 'bg' | 'bar' | 'badge' = 'text') {
  if (mode === 'text') {
    if (util > 100) return 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]';
    if (util > 80) return 'text-emerald-400';
    return 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]';
  }
  if (mode === 'bar') {
    if (util > 100) return 'bg-cyan-400';
    if (util > 80) return 'bg-emerald-500';
    return 'bg-rose-500';
  }
  if (mode === 'badge') {
    if (util > 100) return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
    if (util > 80) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  }
  // bg mode
  if (util > 80) return 'bg-emerald-500/20';
  return 'bg-rose-500/20';
}

/* ─── Component ─── */


const ContractDashboard: React.FC = () => {
  // Pull live data from context (falls back to static BookingData.ts)
  const {
    BOOKING_LOG_DATA, WEEKLY_TREND_DATA, BRANCH_SNAPSHOT, CONTRACT_UTIL_DATA,
    ORIGINS, DESTINATIONS, REGIONS, COUNTRIES, PORT_HIERARCHY,
    syncData,
  } = useBookingData();

  const AVAILABLE_WEEKS = useMemo(() => WEEKLY_TREND_DATA.map(w => w.week), [WEEKLY_TREND_DATA]);

  const [activeTag, setActiveTag] = useState('Branch Summary');
  const [selectedWeek, setSelectedWeek] = useState(() => {
    // Default to current calendar week
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const pastDays = (now.getTime() - startOfYear.getTime()) / 86400000;
    const currentWeekNum = Math.ceil((pastDays + startOfYear.getDay() + 1) / 7);
    const weeks = WEEKLY_TREND_DATA.map(w => w.week);
    // Find the closest week to current calendar week
    const match = weeks.find(w => {
      const m = w.match(/WK\s+(\d+)/);
      return m && parseInt(m[1], 10) === currentWeekNum;
    });
    return match || weeks[weeks.length - 1] || 'ALL';
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeKpi, setActiveKpi] = useState<any | null>(null);
  const [isMatrixPreviewOpen, setIsMatrixPreviewOpen] = useState(false);

  const [isBookingBranchModalOpen, setIsBookingBranchModalOpen] = useState(false);
  const [isBookingContractModalOpen, setIsBookingContractModalOpen] = useState(false);
  const [isBookingTableModalOpen, setIsBookingTableModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState('ALL');
  const [selectedOrigin, setSelectedOrigin] = useState('ALL');
  const [selectedDestination, setSelectedDestination] = useState('ALL');
  const [selectedBranch, setSelectedBranch] = useState('ALL');  // replaces Allocation
  const [selectedCarrier, setSelectedCarrier] = useState('ALL');
  const [isCuTableModalOpen, setIsCuTableModalOpen] = useState(false);
  const [isBranchTableModalOpen, setIsBranchTableModalOpen] = useState(false);
  const [isBranchSnapshotModalOpen, setIsBranchSnapshotModalOpen] = useState(false);
  const [isHeatmapModalOpen, setIsHeatmapModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeCuKpi, setActiveCuKpi] = useState<any | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [filterMode, setFilterMode] = useState<'ALL' | 'UNDERPERFORMING' | 'LOW_UTIL'>('ALL');
  const [granularity, setGranularity] = useState<'region' | 'country' | 'port'>('port');

  useEffect(() => { setMounted(true); }, []);


  // Real-time Data Sync Engine (Scramble-to-Lock)
  const [syncState, setSyncState] = useState<'IDLE' | 'SYCHRONIZING' | 'LOCKED'>('IDLE');

  const handleSyncTrigger = async () => {
    setIsSyncing(true);
    setSyncState('SYCHRONIZING');
    setShowSyncSuccess(false);

    try {
      const result = await syncData();

      if (result.status === 'success' || result.status === 'partial') {
        setSyncState('LOCKED');
        setTimeout(() => {
          setIsSyncing(false);
          setShowSyncSuccess(true);
          // Data is already updated in-memory via the context — no page reload needed
        }, 1000);
      } else {
        console.error('Sync failed:', result.message);
        setIsSyncing(false);
        setSyncState('IDLE');
        alert(`Sync failed: ${result.message}`);
      }
    } catch (err) {
      console.error('API Error:', err);
      setIsSyncing(false);
      setSyncState('IDLE');
      alert('Could not connect to sync service. Please ensure the backend is running.');
    }
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
  const getBaseFilteredBookings = () => {
    const baseFiltered = BOOKING_LOG_DATA.filter(b => {
      const matchWeek = (() => {
        if (selectedWeek === 'ALL') return true;
        const wkMatch = String(b.mscWeek).match(/^(\d+)/);
        const wNum = wkMatch ? parseInt(wkMatch[1], 10) : null;
        if (!wNum) return `WK ${b.mscWeek}` === selectedWeek;

        if (selectedWeek.startsWith('Month:')) {
          const month = selectedWeek.replace('Month: ', '').trim();
          if (month === 'Jan') return wNum >= 1 && wNum <= 4;
          if (month === 'Feb') return wNum >= 5 && wNum <= 8;
          if (month === 'Mar') return wNum >= 9 && wNum <= 13;
          if (month === 'Apr') return wNum >= 14 && wNum <= 17;
          if (month === 'May') return wNum >= 18 && wNum <= 22;
          if (month === 'Jun') return wNum >= 23 && wNum <= 26;
          if (month === 'Jul') return wNum >= 27 && wNum <= 30;
          if (month === 'Aug') return wNum >= 31 && wNum <= 35;
          if (month === 'Sep') return wNum >= 36 && wNum <= 39;
          if (month === 'Oct') return wNum >= 40 && wNum <= 43;
          if (month === 'Nov') return wNum >= 44 && wNum <= 47;
          if (month === 'Dec') return wNum >= 48 && wNum <= 53;
          return false;
        }

        if (selectedWeek.startsWith('Quarter:')) {
          const quarter = selectedWeek.replace('Quarter: ', '').trim();
          if (quarter === 'Q1') return wNum >= 1 && wNum <= 13;
          if (quarter === 'Q2') return wNum >= 14 && wNum <= 26;
          if (quarter === 'Q3') return wNum >= 27 && wNum <= 39;
          if (quarter === 'Q4') return wNum >= 40 && wNum <= 53;
          return false;
        }

        return `WK ${b.mscWeek}` === selectedWeek;
      })();
      const matchContract = selectedContract === 'ALL' || b.contract === selectedContract;

      const master = CONTRACT_UTIL_DATA.find(c => c.id === b.contract);

      // Hierarchical Filter Matches
      const oPortMeta = PORT_HIERARCHY.find(p => p.code === b.loadPort || p.name === b.loadPort);
      const dPortMeta = PORT_HIERARCHY.find(p => p.code === b.dischargePort || p.name === b.dischargePort);

      // Match Origin/Dest by looking in the split tokens or the booking data
      const matchOrigin = selectedOrigin === 'ALL' ||
        b.loadPort === selectedOrigin ||
        oPortMeta?.name === selectedOrigin ||
        oPortMeta?.code === selectedOrigin ||
        oPortMeta?.lane === selectedOrigin ||
        oPortMeta?.country === selectedOrigin ||
        oPortMeta?.region === selectedOrigin ||
        (master && master.notes && master.notes.toLowerCase().includes(selectedOrigin.toLowerCase()));

      const matchDest = selectedDestination === 'ALL' ||
        b.dischargePort === selectedDestination ||
        dPortMeta?.name === selectedDestination ||
        dPortMeta?.code === selectedDestination ||
        dPortMeta?.lane === selectedDestination ||
        dPortMeta?.country === selectedDestination ||
        dPortMeta?.region === selectedDestination;

      // Branch filter (replaces Allocation filter)
      const matchBranch = selectedBranch === 'ALL' || (() => {
        const branchCodeMap: Record<string, string[]> = {
          SYD: ['SY1'], MEL: ['ME1'], BNE: ['BN1'],
          FRE: ['FR1', 'PR1'], ADL: ['AD1'],
          PIL: ['PIL'], PRJ: ['PRJ'], AKL: ['AKL'], OTH: ['OTH'],
        };
        return (branchCodeMap[selectedBranch] || [selectedBranch]).includes(b.branch);
      })();

      // Carrier filter
      const matchCarrier = selectedCarrier === 'ALL' || (() => {
        if (master) {
          return master.carrier.toLowerCase() === selectedCarrier.toLowerCase();
        }
        return false;
      })();

      return matchWeek && matchContract && matchOrigin && matchDest && matchBranch && matchCarrier;
    });
    return baseFiltered;
  };

  const baseFilteredBookings = getBaseFilteredBookings();

  const activeWeekCount = selectedWeek === 'ALL' ? AVAILABLE_WEEKS.length : 1;
  const weekScale = AVAILABLE_WEEKS.length > 0 ? (activeWeekCount / AVAILABLE_WEEKS.length) : 1;

  // Compute contract metrics based on the BASE filtered bookings
  const reactiveContractUtilData = CONTRACT_UTIL_DATA
    .filter(c => selectedContract === 'ALL' || c.id === selectedContract)
    .filter(c => selectedCarrier === 'ALL' || c.carrier.toLowerCase() === selectedCarrier.toLowerCase())
    .map(c => {
      const scaledAlloc = Math.round(c.alloc * weekScale);
      const contractBookings = baseFilteredBookings.filter(b => b.contract === c.id);
      const booked = contractBookings.reduce((sum, b) => sum + (b.teu || 0), 0);
      const util = scaledAlloc > 0 ? (booked / scaledAlloc) * 100 : 0;

      const getBranchBooked = (branchCodes: string[]) =>
        contractBookings
          .filter(b => b.branch && branchCodes.includes(b.branch))
          .reduce((sum, b) => sum + (b.teu || 0), 0);

      const freBase = c.fre ?? c.per ?? { alloc: 0, booked: 0, util: 0 };

      return {
        ...c,
        contractType: (c as any).contractType ?? 'LT',
        expiry: (c as any).expiry ?? 'N/A',
        alloc: scaledAlloc,
        booked,
        avail: scaledAlloc - booked,
        util,
        syd: { ...(c.syd ?? { alloc: 0, booked: 0, util: 0 }), alloc: Math.round(((c.syd as any)?.alloc || 0) * weekScale), booked: getBranchBooked(['SYDNEY', 'SY1']) },
        mel: { ...(c.mel ?? { alloc: 0, booked: 0, util: 0 }), alloc: Math.round(((c.mel as any)?.alloc || 0) * weekScale), booked: getBranchBooked(['MELBOURNE', 'ME1']) },
        bne: { ...(c.bne ?? { alloc: 0, booked: 0, util: 0 }), alloc: Math.round(((c.bne as any)?.alloc || 0) * weekScale), booked: getBranchBooked(['BRISBANE', 'BN1']) },
        fre: { ...freBase, alloc: Math.round(((freBase as any)?.alloc || 0) * weekScale), booked: getBranchBooked(['FREMANTLE', 'FR1', 'PR1']) },
        per: { ...freBase, alloc: Math.round(((freBase as any)?.alloc || 0) * weekScale), booked: getBranchBooked(['FREMANTLE', 'FR1', 'PR1']) },
        adl: { ...(c.adl ?? { alloc: 0, booked: 0, util: 0 }), alloc: Math.round(((c.adl as any)?.alloc || 0) * weekScale), booked: getBranchBooked(['ADELAIDE', 'AD1']) },
        pil: { ...(c.pil ?? { alloc: 0, booked: 0, util: 0 }), alloc: Math.round(((c.pil as any)?.alloc || 0) * weekScale), booked: getBranchBooked(['PIL']) },
        prj: { ...(c.prj ?? { alloc: 0, booked: 0, util: 0 }), alloc: Math.round(((c.prj as any)?.alloc || 0) * weekScale), booked: getBranchBooked(['PRJ']) },
        akl: { ...(c.akl ?? { alloc: 0, booked: 0, util: 0 }), alloc: Math.round(((c.akl as any)?.alloc || 0) * weekScale), booked: getBranchBooked(['AKL']) },
        oth: { ...(c.oth ?? { alloc: 0, booked: 0, util: 0 }), alloc: Math.round(((c.oth as any)?.alloc || 0) * weekScale), booked: getBranchBooked(['OTH']) },
      };
    })
    // Show contracts that have allocation OR bookings in the selected branch
    .filter(c => {
      if (selectedBranch === 'ALL') return true;
      const branchCodeMap: Record<string, string[]> = {
        SYD: ['SY1'], MEL: ['ME1'], BNE: ['BN1'],
        FRE: ['FR1', 'PR1'], ADL: ['AD1'],
        PIL: ['PIL'], PRJ: ['PRJ'], AKL: ['AKL'], OTH: ['OTH'],
      };
      const codes = branchCodeMap[selectedBranch] || [selectedBranch];
      // Show if the branch has allocation OR bookings (don't require booked > 0)
      return codes.some(code => (c as any)[code.toLowerCase()]?.alloc > 0) || c.booked > 0;
    });

  // Now apply the KPI filter mode to derive the final filteredBookings
  const filteredBookings = (() => {
    if (filterMode === 'UNDERPERFORMING') {
      const underPerformingIds = new Set(reactiveContractUtilData.filter(c => c.alloc > 0 && c.util <= 80).map(c => c.id));
      return baseFilteredBookings.filter(b => underPerformingIds.has(b.contract));
    }
    if (filterMode === 'LOW_UTIL') {
      const lowUtilIds = new Set(reactiveContractUtilData.filter(c => c.util < 50).map(c => c.id));
      return baseFilteredBookings.filter(b => lowUtilIds.has(b.contract));
    }
    return baseFilteredBookings;
  })();



  const contractMetrics = (() => {
    const allocNode = reactiveContractUtilData.reduce((sum, c) => sum + c.alloc, 0);
    const bookedNode = reactiveContractUtilData.reduce((sum, c) => sum + c.booked, 0);
    const utilNode = allocNode > 0 ? (bookedNode / allocNode) * 100 : 0;
    return { alloc: Math.round(allocNode), booked: bookedNode, util: utilNode };
  })();

  const underperformingList = reactiveContractUtilData.filter(c => c.alloc > 0 && c.util <= 80);
  const lowUtilList = reactiveContractUtilData.filter(c => c.util < 50);

  const handleKpiClick = (kpi: any) => {
    if (kpi.id === 'undr') {
      setFilterMode(filterMode === 'UNDERPERFORMING' ? 'ALL' : 'UNDERPERFORMING');
    } else if (kpi.id === 'low') {
      setFilterMode(filterMode === 'LOW_UTIL' ? 'ALL' : 'LOW_UTIL');
    } else {
      setActiveKpi(kpi);
    }
  };

  const reactiveKpis = [
    { ...KPI_DATA[0], value: contractMetrics.alloc.toLocaleString() },
    { ...KPI_DATA[1], value: contractMetrics.booked.toLocaleString(), percent: contractMetrics.util },
    { ...KPI_DATA[2], value: contractMetrics.util.toFixed(1), percent: contractMetrics.util },
    {
      ...KPI_DATA[3],
      value: underperformingList.length.toString(),
      list: underperformingList,
      isActive: filterMode === 'UNDERPERFORMING'
    },
    {
      ...KPI_DATA[4],
      value: lowUtilList.length.toString(),
      list: lowUtilList,
      isActive: filterMode === 'LOW_UTIL'
    },
    { ...KPI_DATA[5], value: selectedWeek === 'ALL' ? 'ALL' : selectedWeek.split(' ')[1] },
  ];

  // Performance Matrix Derivation
  const CONTRACT_WEEKLY_BREAKDOWN = useMemo(() => {
    return Array.from(new Set(filteredBookings.map(b => b.contract))).map(cid => {
      const contractBookings = filteredBookings.filter(b => b.contract === cid);
      const weeklyData: Record<string, any> = {};

      AVAILABLE_WEEKS.forEach(wk => {
        const wkNum = wk.split(' ')[1];
        const wkBookings = contractBookings.filter(b => b.mscWeek === wkNum);
        const booked = wkBookings.reduce((s, b) => s + b.teu, 0);
        const master = CONTRACT_UTIL_DATA.find(c => c.id === cid);
        const weeklyAlloc = master ? (master.alloc / AVAILABLE_WEEKS.length) : 0;
        weeklyData[wk] = { alloc: Math.round(weeklyAlloc), booked, util: Math.round(weeklyAlloc > 0 ? (booked / weeklyAlloc) * 100 : 0) };
      });

      // Hierarchical grouping for detailed rows
      const locationGroups = contractBookings.reduce((acc, curr) => {
        const oPort = PORT_HIERARCHY.find(p => p.code === curr.loadPort || p.name === curr.loadPort);
        let key = curr.branch;
        let label = curr.branch;

        if (granularity === 'country') {
          key = oPort?.country || curr.loadPort;
          label = key;
        } else if (granularity === 'region') {
          key = oPort?.region || curr.loadPort;
          label = key;
        } else if (granularity === 'port') {
          key = curr.loadPort;
          label = oPort?.name || key;
        }

        if (!acc[key]) acc[key] = { label, data: [] };
        acc[key].data.push(curr);
        return acc;
      }, {} as Record<string, { label: string, data: any[] }>);

      const branches = Object.entries(locationGroups).map(([code, group]) => {
        const branchWeekly: Record<string, any> = {};
        AVAILABLE_WEEKS.forEach(wk => {
          const wkNum = wk.split(' ')[1];
          const wkBookings = group.data.filter(b => b.mscWeek === wkNum);
          const booked = wkBookings.reduce((s, b) => s + b.teu, 0);
          branchWeekly[wk] = { alloc: '-', booked, util: 0 };
        });
        return { code, branch: group.label, data: branchWeekly };
      });

      return {
        contract: cid,
        type: 'TOTAL',
        data: weeklyData,
        branches
      };
    });
  }, [filteredBookings, granularity]);

  // NEW: Hierarchical location data for graphs
  const reactiveLocationAggregatedData = useMemo(() => {
    const data = filteredBookings.reduce((acc, curr) => {
      const oPort = PORT_HIERARCHY.find(p => p.code === curr.loadPort || p.name === curr.loadPort);
      const dPort = PORT_HIERARCHY.find(p => p.code === curr.dischargePort || p.name === curr.dischargePort);

      let originKey = curr.loadPort;
      let destKey = curr.dischargePort;

      if (granularity === 'country') {
        originKey = oPort?.country || curr.loadPort;
        destKey = dPort?.country || curr.dischargePort;
      } else if (granularity === 'region') {
        originKey = oPort?.region || curr.loadPort;
        destKey = dPort?.region || curr.dischargePort;
      }

      const label = `${originKey} to ${destKey}`;
      const existing = acc.find(a => a.label === label);
      if (existing) {
        existing.teu += curr.teu || 0;
      } else {
        acc.push({ label, teu: curr.teu || 0 });
      }
      return acc;
    }, [] as any[]);

    return data.sort((a, b) => b.teu - a.teu);
  }, [filteredBookings, granularity]);


  // Transform flat PORT_HIERARCHY into a tree for the Navbar
  const locationHierarchy = useMemo(() => {
    const tree: any[] = [{ label: 'ALL' }];
    const regions = Array.from(new Set(PORT_HIERARCHY.map(p => p.region))).sort();

    regions.forEach(region => {
      if (!region) return;
      const countriesInRegion = Array.from(new Set(
        PORT_HIERARCHY.filter(p => p.region === region).map(p => p.country)
      )).sort();

      tree.push({
        label: region,
        children: countriesInRegion.map(country => {
          const lanesInCountry = Array.from(new Set(
            PORT_HIERARCHY.filter(p => p.country === country).map(p => p.lane)
          )).sort();
          
          return {
            label: country,
            children: lanesInCountry.map(lane => {
              const portsInLane = Array.from(new Set(
                PORT_HIERARCHY.filter(p => p.country === country && p.lane === lane).map(p => p.name)
              )).sort();
              
              return {
                label: lane || 'N/A',
                children: portsInLane.map(port => {
                  const codes = Array.from(new Set(
                    PORT_HIERARCHY.filter(p => p.country === country && p.lane === lane && p.name === port).map(p => p.code)
                  )).sort();
                  
                  return {
                    label: port,
                    children: codes.map(code => ({ label: code }))
                  };
                })
              };
            })
          };
        })
      });
    });
    return tree;
  }, []);

  const reactiveBranchSnapshot = (() => {
    const knownBranches = new Set(BRANCH_SNAPSHOT.map(b => b.branch));
    const snapshot = BRANCH_SNAPSHOT.map(b => {
      const branchKeyMap: Record<string, string> = {
        'SY1': 'syd', 'ME1': 'mel', 'BN1': 'bne', 'FR1': 'fre', 'PR1': 'fre', 'AD1': 'adl', 'PIL': 'pil', 'PRJ': 'prj', 'AKL': 'akl', 'OTH': 'oth'
      };
      const bKey = branchKeyMap[b.branch];
      const scaledAlloc = reactiveContractUtilData.reduce((sum, c) => sum + ((c as any)[bKey]?.alloc || 0), 0);

      // Auto-merge Fremantle (FR1) into Perth (PR1) if it appears in bookings
      const matchBranches = b.branch === 'PR1' ? ['PR1', 'FR1'] : [b.branch];
      const hubBookings = filteredBookings.filter(row => matchBranches.includes(row.branch));
      const booked = reactiveContractUtilData.reduce((sum, c) => sum + ((c as any)[bKey]?.booked || 0), 0);
      const utilFloat = scaledAlloc > 0 ? (booked / scaledAlloc) * 100 : 0;

      const branchCodeMatch = { SY1: 'syd', ME1: 'mel', BN1: 'bne', FR1: 'fre', PR1: 'fre', AD1: 'adl', PIL: 'pil', PRJ: 'prj', AKL: 'akl', OTH: 'oth' }[b.branch];
      
      const allContractsForBranch = CONTRACT_UTIL_DATA.filter(c => {
        const branchAlloc = branchCodeMatch && (c as any)[branchCodeMatch] ? (c as any)[branchCodeMatch].alloc : 0;
        const hasBookings = hubBookings.some(bk => bk.contract === c.id);
        return branchAlloc > 0 || hasBookings;
      });

      const carrierFilteredContractsForBranch = selectedCarrier === 'ALL'
        ? allContractsForBranch
        : allContractsForBranch.filter(c => c.carrier.toLowerCase() === selectedCarrier.toLowerCase());

      const activeContracts = Array.from(new Set([
        ...carrierFilteredContractsForBranch.map(c => c.id),
        ...(selectedCarrier === 'ALL' ? hubBookings.map(bk => bk.contract) : [])
      ])).sort();

      const activeContractsData = activeContracts.map(contractId => {
        const contractBookings = hubBookings.filter(bk => bk.contract === contractId);
        const cBooked = contractBookings.reduce((sum, bk) => sum + (bk.teu || 0), 0);
        const contractObj = CONTRACT_UTIL_DATA.find(c => c.id === contractId);
        const rawAlloc = contractObj && branchCodeMatch && (contractObj as any)[branchCodeMatch] ? (contractObj as any)[branchCodeMatch].alloc : 0;
        const cAlloc = Math.round(rawAlloc * weekScale);
        const cAvail = cAlloc - cBooked;
        const cUtil = cAlloc > 0 ? (cBooked / cAlloc) * 100 : 0;
        return { 
          id: contractId, alloc: cAlloc, booked: cBooked, avail: cAvail, util: cUtil,
          contractType: contractObj ? (contractObj as any).contractType : '',
          carrier: contractObj ? contractObj.carrier : ''
        };
      });

      let status = 'No Allocation';
      if (scaledAlloc > 0) {
        if (utilFloat > 100) status = 'Overutilised';
        else if (utilFloat > 80) status = 'Healthy';
        else if (utilFloat > 50) status = 'Underperforming';
        else status = 'Critical';
      } else if (booked > 0) {
        status = 'Unplanned';
      }

      return { ...b, alloc: scaledAlloc, booked, avail: scaledAlloc - booked, util: Number(utilFloat.toFixed(1)), utilFloat, status, activeContracts, activeContractsData };
    }).filter(b => b.alloc > 0 || b.booked > 0);

    // Check if any bookings are completely unmatched and create OTHER category
    const unmatchedBookings = filteredBookings.filter(b => !knownBranches.has(b.branch) && b.branch !== 'FR1');
    const otherBooked = unmatchedBookings.reduce((sum, b) => sum + (b.teu || 0), 0);

    if (otherBooked > 0) {
      const activeContracts = Array.from(new Set(unmatchedBookings.map(b => b.contract))).sort();
      const activeContractsData = activeContracts.map(contractId => {
        const contractBookings = unmatchedBookings.filter(bk => bk.contract === contractId);
        const cBooked = contractBookings.reduce((sum, bk) => sum + (bk.teu || 0), 0);
        return { id: contractId, alloc: 0, booked: cBooked, avail: -cBooked, util: 0 };
      });
      snapshot.push({
        branch: 'OTH',
        branchName: 'OTHER PORTS',
        alloc: 0,
        booked: otherBooked,
        avail: -otherBooked,
        util: 0,
        utilFloat: 0,
        status: 'Unplanned',
        activeContracts,
        activeContractsData
      } as any);
    }

    if (selectedBranch !== 'ALL') {
      const branchCodeMap: Record<string, string[]> = {
        SYD: ['SY1'], MEL: ['ME1'], BNE: ['BN1'],
        FRE: ['FR1', 'PR1'], ADL: ['AD1'],
        PIL: ['PIL'], PRJ: ['PRJ'], AKL: ['AKL'], OTH: ['OTH'],
      };
      const allowedCodes = branchCodeMap[selectedBranch] || [selectedBranch];
      return snapshot.filter(r => allowedCodes.includes(r.branch));
    }

    return snapshot
      .sort((a, b) => {
        // Sort alphabetically but OTHER/OTH always last
        if (a.branch === 'OTH') return 1;
        if (b.branch === 'OTH') return -1;
        return (a.branchName || a.branch).localeCompare(b.branchName || b.branch);
      });
  })();


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
    syd: { alloc: reactiveContractUtilData.reduce((s, r) => s + (r.syd?.alloc ?? 0), 0), booked: reactiveContractUtilData.reduce((s, r) => s + (r.syd?.booked ?? 0), 0) },
    mel: { alloc: reactiveContractUtilData.reduce((s, r) => s + (r.mel?.alloc ?? 0), 0), booked: reactiveContractUtilData.reduce((s, r) => s + (r.mel?.booked ?? 0), 0) },
    bne: { alloc: reactiveContractUtilData.reduce((s, r) => s + (r.bne?.alloc ?? 0), 0), booked: reactiveContractUtilData.reduce((s, r) => s + (r.bne?.booked ?? 0), 0) },
    fre: { alloc: reactiveContractUtilData.reduce((s, r) => s + (r.fre?.alloc ?? 0), 0), booked: reactiveContractUtilData.reduce((s, r) => s + (r.fre?.booked ?? 0), 0) },
    per: { alloc: reactiveContractUtilData.reduce((s, r) => s + (r.fre?.alloc ?? 0), 0), booked: reactiveContractUtilData.reduce((s, r) => s + (r.fre?.booked ?? 0), 0) },
    adl: { alloc: reactiveContractUtilData.reduce((s, r) => s + (r.adl?.alloc ?? 0), 0), booked: reactiveContractUtilData.reduce((s, r) => s + (r.adl?.booked ?? 0), 0) },
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
                <span className="text-[14px]  font-black text-cyan-400 tracking-[3em] uppercase animate-pulse">{hex}</span>
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

  return (
    <div
      className="min-h-screen flex flex-col text-slate-200 relative overflow-x-hidden"
      style={{ backgroundColor: 'var(--bg-page)' }}
    >
      <DigitalRain />
      <ScanningOverlay />
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
          selectedBranch={selectedBranch}
          onBranchChange={setSelectedBranch}
          selectedCarrier={selectedCarrier}
          onCarrierChange={setSelectedCarrier}
          isSyncing={isSyncing}
          onSync={handleSyncTrigger}
          availableWeeks={[
            'Quarter: Q1', 'Quarter: Q2', 'Quarter: Q3', 'Quarter: Q4', 
            'Month: Jan', 'Month: Feb', 'Month: Mar', 'Month: Apr', 'Month: May', 'Month: Jun', 
            'Month: Jul', 'Month: Aug', 'Month: Sep', 'Month: Oct', 'Month: Nov', 'Month: Dec', 
            ...AVAILABLE_WEEKS
          ]}
          availableContracts={['ALL', ...Array.from(new Set(CONTRACT_UTIL_DATA.map(c => c.id)))]}
          formatContractLabel={(id) => formatContract(CONTRACT_UTIL_DATA.find((c: any) => c.id === id) || id)}
          availableOrigins={locationHierarchy}
          availableDestinations={locationHierarchy}
          availableBranches={['ALL', 'SYD', 'MEL', 'BNE', 'FRE', 'ADL', 'PIL', 'PRJ', 'AKL', 'OTH']}
          availableCarriers={['ALL', ...Array.from(new Set(CONTRACT_UTIL_DATA.map(c => c.carrier))).sort()]}
        />
      </div>

      <main className={`flex-1 w-full max-w-[1820px] mx-auto px-4 md:px-6 pt-[180px] pb-12 grid ${isSidebarCollapsed ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-[320px_1fr]'} gap-8 relative z-10 items-start transition-all duration-500`}>

        {isSidebarCollapsed && (
          <button
            onClick={() => setIsSidebarCollapsed(false)}
            className="fixed left-6 top-[160px] z-[100] w-10 h-10 rounded-xl flex items-center justify-center transition-all bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-cyan-500 dark:hover:text-cyan-400 shadow-lg group cursor-pointer"
            title="Expand Sidebar"
          >
            <svg className="w-5 h-5 transform group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
          </button>
        )}

        <aside className={`${isSidebarCollapsed ? 'hidden' : 'w-full hidden md:flex'} flex-col bg-[#0b0f19]/80 backdrop-blur-3xl border border-white/5 rounded-[40px] shadow-[0_40px_80px_rgba(0,0,0,0.9),inset_0_1px_1px_rgba(255,255,255,0.05)] group/sidebar overflow-hidden relative h-fit shrink-0`}>


          <div className="p-6 pb-0 relative z-20">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 8, ease: "linear" }} className="absolute inset-0 border border-cyan-500/30 rounded-xl" />
                  <div className="absolute inset-0 bg-cyan-500/20 rounded-xl rotate-45 animate-pulse" />
                  <svg className="w-7 h-7 text-cyan-400 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-cyan-500/60 uppercase tracking-[0.4em] leading-none">Intelligence</span>
                  <h2 className="text-2xl font-display font-black text-slate-800 dark:text-white tracking-widest uppercase mt-1">Contract<span className="text-cyan-400 font-light">.AI</span></h2>
                </div>
              </div>

              <button
                onClick={() => setIsSidebarCollapsed(true)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.03] dark:hover:bg-white/[0.08] border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-cyan-500 dark:hover:text-cyan-400 group cursor-pointer"
                title="Collapse Sidebar"
              >
                <svg className="w-4 h-4 transform group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
              </button>
            </div>
            <div className="h-[1px] w-full bg-gradient-to-r from-cyan-500/50 via-white/10 to-transparent" />
          </div>
          <div className="flex-1 overflow-y-auto elegant-scrollbar force-scrollbar hover-scrollbar px-5 py-8 flex flex-col gap-6 relative z-10">
            {SIDE_TAGS.map((tag, idx) => {
              const shortCode = ['BS', 'CU', 'BL'][idx];
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
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border  text-[9px] font-black tracking-tighter transition-colors ${isActive ? 'bg-cyan-500 text-black border-cyan-400' : 'bg-slate-900 text-slate-300 border-white/5 group-hover/node:text-slate-300'
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
        <div className="flex-1 min-w-0 w-full relative h-fit rounded-[40px] bg-[#0b0f19]/70 backdrop-blur-3xl border border-white/5 shadow-[0_50px_100px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.1)] p-8 md:p-14">

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

              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4 xl:gap-6 w-full perspective-1000">
                {reactiveKpis.map((kpi, idx) => (
                  <QuantumKpiCard key={idx} kpi={kpi} idx={idx} onClick={() => handleKpiClick(kpi)} />
                ))}
              </div>

              {/* ── Inline Branch Performance Snapshot Matrix ── */}
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-[28px] bg-[#0b0f19]/80 border border-white/5 backdrop-blur-3xl shadow-[0_20px_40px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.04)] overflow-hidden dashboard-table"
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
                    <span className="text-[10px] items-center flex gap-3 font-semibold text-emerald-400 uppercase tracking-widest">{reactiveBranchSnapshot.length} Hubs
                      <button onClick={() => setIsBranchSnapshotModalOpen(true)} className="w-6 h-6 flex items-center justify-center bg-white/5 rounded-md border border-white/10 hover:bg-emerald-500/20 hover:text-emerald-400 transition-colors text-slate-400">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                      </button>
                    </span>
                  </div>
                </div>

                {/* Column Headers */}
                <div className="grid grid-cols-[minmax(120px,2fr)_1fr_1fr_1fr_1.4fr_1.2fr] gap-x-4 bg-white/[0.02] border-b border-white/[0.04] px-6 py-3 sticky top-0 z-20" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                  <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-[0.18em]">Hub</span>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.18em] text-right">Alloc (TEU)</span>
                  <span className="text-[11px] font-bold text-cyan-500 uppercase tracking-[0.18em] text-right">Booked</span>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.18em] text-right">Available</span>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.18em] text-right pr-2">Utilisation</span>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.18em] text-center">Status</span>
                </div>

                {/* Data Rows */}
                <div className="divide-y divide-white/[0.025]">
                  {reactiveBranchSnapshot.map((row, i) => {
                    // NEW colour logic: Red = underutilisation risk, Green = healthy/overutilised
                    const isHealthy = row.util > 80;
                    const isOverutilised = row.util > 100;
                    const isUnderperforming = !isHealthy && row.util > 50;
                    const isLowUptake = row.util <= 50;
                    const s = isOverutilised
                      ? { badge: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/25', dot: 'bg-emerald-300', util: 'text-emerald-300', bar: 'bg-emerald-400' }
                      : isHealthy
                        ? { badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25', dot: 'bg-emerald-400', util: 'text-emerald-400', bar: 'bg-emerald-500' }
                        : isUnderperforming
                          ? { badge: 'bg-rose-500/10 text-rose-400 border-rose-500/25', dot: 'bg-rose-400', util: 'text-rose-400', bar: 'bg-rose-400' }
                          : { badge: 'bg-orange-500/10 text-orange-400 border-orange-500/25', dot: 'bg-orange-500', util: 'text-orange-400', bar: 'bg-orange-600' };
                    return (
                      <React.Fragment key={i}>
                        <div className="grid grid-cols-[minmax(120px,2fr)_1fr_1fr_1fr_1.4fr_1.2fr] gap-x-4 px-6 py-4 items-center hover:bg-white/[0.015] transition-colors">
                          {/* Hub */}
                          <div className="flex flex-col min-w-0 justify-center">
                            <div className="flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.dot}`} />
                              <span className=" font-bold text-slate-200 text-[14px] tracking-wide">{row.branchName || row.branch}</span>
                              {row.branchName && <span className="text-[12px] text-slate-500 truncate hidden md:block">{row.branchName}</span>}
                            </div>
                          </div>
                          {/* Alloc */}
                          <span className=" text-slate-400 text-[14px] text-right tabular-nums">{row.alloc}</span>
                          {/* Booked */}
                          <div className="flex justify-end">
                            <span className={` font-bold text-[14px] px-2.5 py-0.5 rounded-md border tabular-nums ${row.booked > 0 ? 'text-cyan-400 border-cyan-500/20 bg-cyan-500/5' : 'text-slate-600 border-slate-700/30'}`}>
                              {row.booked.toFixed(1)}
                            </span>
                          </div>
                          {/* Available */}
                          <span className={` text-[14px] text-right tabular-nums ${row.avail < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                            {row.avail < 0 ? `(${Math.abs(row.avail).toFixed(1)})` : row.avail.toFixed(1)}
                          </span>
                          {/* Utilisation + bar */}
                          <div className="flex flex-col items-end gap-1.5 pr-2">
                            <span className={` font-semibold text-[14px] tabular-nums ${s.util}`}>{row.util.toFixed(1)}%</span>
                            <div className="w-20 h-[4px] bg-white/5 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${Math.min(row.util, 100)}%` }} />
                            </div>
                          </div>
                          {/* Status */}
                          <div className="flex justify-center">
                            <span className={`px-3 py-1.5 text-[10px] font-bold rounded-full border uppercase tracking-wider whitespace-nowrap ${s.badge}`}>
                              {row.status}
                            </span>
                          </div>
                        </div>
                        {(row as any).activeContractsData && (row as any).activeContractsData.length > 0 && (
                          <div className="bg-sky-400/10 border-t border-b border-sky-400/20 py-2">
                            {(row as any).activeContractsData.map((c: any, cIdx: number) => (
                              <div key={cIdx} className="grid grid-cols-[minmax(120px,2fr)_1fr_1fr_1fr_1.4fr_1.2fr] gap-x-4 px-6 py-1.5 items-center hover:bg-sky-400/10 transition-colors">
                                <div className="pl-6 flex items-center min-w-0 flex-wrap gap-1">
                                  <span className="text-[12px] text-indigo-300 font-bold whitespace-nowrap" title={formatContract(c)}>↳ {formatContract(c)}</span>
                                  {c.contractType && (
                                    <span className={`ml-1 text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wider ${
                                      c.contractType === 'NAC' ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' :
                                      c.contractType === 'BUNDLE' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                                      'bg-slate-500/15 text-slate-400 border-slate-500/30'
                                    }`}>{c.contractType}</span>
                                  )}
                                </div>
                                <div className="text-[12px] text-slate-300 font-bold  text-right tabular-nums">{c.alloc || '-'}</div>
                                <div className="flex justify-end">
                                  <span className="text-[12px] text-blue-500 font-bold  tabular-nums">{c.booked.toFixed(1)}</span>
                                </div>
                                <span className="text-[12px] text-slate-300 font-bold  text-right tabular-nums">{c.avail < 0 ? `(${Math.abs(c.avail).toFixed(1)})` : c.avail.toFixed(1)}</span>
                                <div className="flex flex-col items-end justify-center pr-2">
                                  <span className="text-[12px] text-slate-300 font-bold  tabular-nums">{c.util.toFixed(1)}%</span>
                                </div>
                                <div></div>
                              </div>
                            ))}
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Totals Footer */}
                <div className="grid grid-cols-[minmax(120px,2fr)_1fr_1fr_1fr_1.4fr_1.2fr] gap-x-4 px-6 py-3 border-t border-white/[0.06] bg-gradient-to-r from-cyan-900/10 to-transparent items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3.5 rounded-full bg-gradient-to-b from-cyan-400 to-indigo-500" />
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">Total</span>
                  </div>
                  <span className=" font-bold text-white text-[12px] text-right tabular-nums">
                    {reactiveBranchSnapshot.reduce((s, r) => s + r.alloc, 0).toFixed(0)}
                  </span>
                  <div className="flex justify-end">
                    <span className=" font-bold text-cyan-400 text-[12px] tabular-nums drop-shadow-[0_0_6px_rgba(34,211,238,0.5)]">
                      {reactiveBranchSnapshot.reduce((s, r) => s + r.booked, 0).toFixed(1)}
                    </span>
                  </div>
                  <span className=" font-bold text-slate-300 text-[12px] text-right tabular-nums">
                    {reactiveBranchSnapshot.reduce((s, r) => s + r.avail, 0).toFixed(1)}
                  </span>
                  <div className="flex justify-end pr-2">
                    {(() => {
                      const tA = reactiveBranchSnapshot.reduce((s, r) => s + r.alloc, 0);
                      const tB = reactiveBranchSnapshot.reduce((s, r) => s + r.booked, 0);
                      return <span className=" font-bold text-white text-[12px]">{tA > 0 ? ((tB / tA) * 100).toFixed(1) : '0.0'}%</span>;
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
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.02)" vertical={false} />
                      <XAxis dataKey="branch" stroke="#475569" tickLine={false} axisLine={false} dy={15} fontSize={12} fontWeight={700} />
                      <YAxis stroke="#475569" tickLine={false} axisLine={false} dx={-10} fontSize={11} />

                      <Tooltip
                        cursor={{ fill: 'rgba(99, 102, 241, 0.04)' }}
                        contentStyle={{
                          backgroundColor: '#02040a',
                          border: '1px solid rgba(34, 211, 238, 0.3)',
                          borderRadius: '20px',
                          padding: '16px',
                          boxShadow: '0 30px 60px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.05)',
                          backdropFilter: 'blur(16px)',
                        }}
                        itemStyle={{ fontFamily: 'monospace', fontWeight: '800', color: '#cbd5e1' }}
                        labelStyle={{ color: '#94a3b8', marginBottom: '8px', fontWeight: '800', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.15em' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '30px' }} iconType="circle" />

                      <defs>
                        <linearGradient id="colorAllocArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.8} />
                          <stop offset="100%" stopColor="#02040a" stopOpacity={0.1} />
                        </linearGradient>
                        <linearGradient id="colorBookedBar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#02040a" stopOpacity={0.2} />
                        </linearGradient>
                      </defs>

                      <Bar
                        dataKey="alloc"
                        name="Allocation"
                        fill="url(#colorAllocArea)"
                        radius={[8, 8, 0, 0]}
                        maxBarSize={32}
                        isAnimationActive={true}
                        animationDuration={1500}
                      />

                      <Bar
                        dataKey="booked"
                        name="Booked TEU"
                        fill="url(#colorBookedBar)"
                        radius={[8, 8, 0, 0]}
                        maxBarSize={32}
                        isAnimationActive={true}
                        animationDuration={1500}
                      />

                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
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
                    { label: 'Total Alloc', value: `${cuTotalAlloc}`, color: 'text-violet-400', border: 'border-violet-500/30', bg: 'bg-violet-500/10', sub: 'Network Threshold', trend: 'Fixed Capacity', details: `Total contracted TEU capacity across all carriers for this period. Threshold: ${cuTotalAlloc} TEU.` },
                    { label: 'Total Booked', value: `${cuTotalBooked}`, color: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-500/10', sub: 'Confirmed Volume', trend: 'Live', details: `Confirmed cargo assigned to contract allocations. ${cuTotalBooked} TEU validated against a ${cuTotalAlloc} TEU ceiling.` },
                    { label: 'Overall Util', value: `${cuOverallUtil}%`, color: parseFloat(cuOverallUtil) > 80 ? 'text-emerald-400' : 'text-rose-400', border: parseFloat(cuOverallUtil) > 80 ? 'border-emerald-500/30' : 'border-rose-500/30', bg: parseFloat(cuOverallUtil) > 80 ? 'bg-emerald-500/10' : 'bg-rose-500/10', sub: parseFloat(cuOverallUtil) > 80 ? 'Healthy' : 'Underutilisation Risk', trend: parseFloat(cuOverallUtil) > 80 ? 'On Track' : 'Attention Required', details: `Network efficiency at ${cuOverallUtil}%. Target is >80%. ${parseFloat(cuOverallUtil) <= 80 ? 'Current levels indicate underutilisation — contracts at risk.' : 'Healthy utilisation across the network.'}` },
                    { label: 'Underperforming (≤80%)', value: `${cuLowUptake.length}`, color: 'text-rose-400', border: 'border-rose-500/30', bg: 'bg-rose-500/10', sub: 'Utilisation Risk', trend: 'Action Required', details: `${cuLowUptake.length} contract(s) are below the 80% utilisation threshold — the primary risk metric. Review allocation commitments and increase bookings to avoid compliance exposure.` },
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

              {/* ─── Contract Utilisation Layout Restructuring (Stakeholder Overhaul) ─── */}
              {/* 1. Full Contract Matrix Table promoted to top visibility */}
              <div className="bg-[#0b0f19]/80 backdrop-blur-3xl border border-white/5 rounded-[32px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative mb-8">
                <div className="absolute top-0 right-0 w-96 h-96 bg-violet-500/5 rounded-full blur-[100px] pointer-events-none" />
                <div className="p-6 md:p-8 flex justify-between items-center bg-black/40 border-b border-white/5 relative z-10">
                  <div className="flex flex-col gap-1">
                    <span className="text-white font-bold text-lg tracking-wide">Full Contract Matrix</span>
                    <span className="text-[10px] text-slate-300 uppercase tracking-widest font-bold">
                      {reactiveContractUtilData.length} Contracts · Total {cuTotalAlloc} TEU allocated · {cuTotalBooked} TEU booked · {cuOverallUtil}% network utilisation
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
                    <span className="text-[10px] font-bold px-3 py-1 bg-violet-500/10 text-violet-400 rounded border border-violet-500/20 uppercase tracking-widest">{selectedWeek === 'ALL' ? 'ALL WEEKS' : selectedWeek}</span>
                  </div>
                </div>

                <div className="overflow-auto force-scrollbar relative z-10 p-2 md:p-5 max-h-[70vh]">
                  <table className="w-full text-left border-collapse table-auto min-w-[2000px] dashboard-table">
                    <thead className="sticky top-0 z-20" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                      <tr className="bg-[#0b0f19]">
                        {['Contract ID', 'Type', 'Carrier', 'Trade Lane', 'Alloc (TEU)', 'Booked (TEU)', 'Avail (TEU)', 'Util %', 'Status', 'SYD (BK/AV)', 'MEL (BK/AV)', 'BNE (BK/AV)', 'FRE (BK/AV)', 'ADL (BK/AV)', 'PIL (BK/AV)', 'PRJ (BK/AV)', 'AKL (BK/AV)', 'OTH (BK/AV)'].map((h, i) => (
                          <th key={h} className={`px-4 py-4 font-bold text-xs tracking-widest uppercase border-b-2 border-violet-500/30 bg-[#0b0f19] ${i === 8 ? 'text-center text-amber-400' : i >= 9 ? 'text-center text-violet-400' : i >= 5 ? 'text-right text-cyan-400' : i === 1 ? 'text-center text-amber-400' : 'text-white'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.02]">
                      {reactiveContractUtilData.map((row, i) => {
                        const statusStyle = row.util > 100 ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25'
                          : row.util >= 85 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                            : row.util >= 70 ? 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/25';
                        return (
                          <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-4  text-[13px] font-bold text-white tracking-wider whitespace-nowrap" title={formatContract(row)}>
                              {formatContract(row)}
                              {(row as any).contractType && (
                                <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wider ${
                                  (row as any).contractType === 'NAC' ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' :
                                  (row as any).contractType === 'BUNDLE' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                                  'bg-slate-500/15 text-slate-400 border-slate-500/30'
                                }`}>{(row as any).contractType}</span>
                              )}
                            </td>
                            <td className="px-4 py-4 text-[11px] font-bold text-amber-400/80 text-center">{(row as any).contractType || '-'}</td>
                            <td className="px-4 py-4 text-[13px] font-bold text-slate-200">{row.carrier}</td>
                            <td className="px-4 py-4 text-[13px] font-bold text-slate-400  tracking-tighter">{row.lane}</td>
                            <td className="px-4 py-4  text-[13px] text-right font-bold text-slate-300">{row.alloc}</td>
                            <td className="px-4 py-4  text-[13px] text-right font-bold text-emerald-400">{row.booked.toFixed(1)}</td>
                            <td className="px-4 py-4  text-[13px] text-right font-bold text-cyan-400">{row.avail}</td>
                            <td className="px-4 py-4 text-right">
                              <div className="flex flex-col items-end gap-1.5">
                                <span className={` text-[13px] font-bold ${getUtilColor(row.util, 'text')}`}>{row.util.toFixed(1)}%</span>
                                <div className="w-16 h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${getUtilColor(row.util, 'bar')}`} style={{ width: `${Math.min(row.util, 100)}%` }} />
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center"><span className={`text-[11px] font-bold px-2 py-1 rounded border uppercase tracking-wide ${statusStyle}`}>{row.status}</span></td>
                            {[row.syd, row.mel, row.bne, row.fre, row.adl, row.pil, row.prj, row.akl, row.oth].map((b, bi) => {
                              const bPct = b && b.alloc > 0 ? (b.booked / b.alloc) * 100 : 0;
                              const alloc = b ? b.alloc : 0;
                              const booked = b ? b.booked : 0;
                              const avail = alloc - booked;
                              return (
                                <td key={bi} className="px-3 py-4 text-center">
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span className={` text-[13px] font-bold ${getUtilColor(bPct, 'text')}`}>{booked}<span className="text-slate-400">/{avail}</span></span>
                                    <div className="w-10 h-1 bg-slate-900 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${getUtilColor(bPct, 'bar')}`} style={{ width: `${Math.min(bPct, 100)}%` }} />
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

              {/* 2. Secondary analysis row: Branch Heat Map & Carrier Breakdown side-by-side */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Left Column: Heat Map Panel */}
                <div className="rounded-[40px] bg-[#050505]/60 border border-white/5 backdrop-blur-3xl shadow-[0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col">
                  <div className="p-8 border-b border-violet-500/20 bg-gradient-to-r from-violet-950/20 to-transparent flex justify-between items-center">
                    <div className="flex flex-col gap-1">
                      <h4 className="text-white font-bold tracking-[0.2em] uppercase text-xs">Branch <span className="text-violet-400">Utilisation Heat Map</span></h4>
                      <p className="text-[10px] text-slate-300 mt-0.5">Shows <span className="text-white font-bold">% of allocated TEU that has been booked</span> for each contract at each branch</p>
                    </div>
                    <button
                      onClick={() => setIsHeatmapModalOpen(true)}
                      className="w-8 h-8 rounded-xl bg-white/5 hover:bg-violet-500/20 border border-white/10 hover:border-violet-500/50 flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-md group cursor-pointer"
                      title="Expand Heat Map"
                    >
                      <svg className="w-4 h-4 transform group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto elegant-scrollbar force-scrollbar p-4 max-h-[350px]">
                    {/* Legend Bar */}
                    <div className="flex items-center gap-4 mb-3 px-2 py-2.5">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest shrink-0">Legend:</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-4 rounded" style={{ backgroundColor: 'rgba(153, 27, 27, 0.8)' }} />
                        <span className="text-[11px] text-slate-300 font-semibold">Critical ≤50%</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-4 rounded" style={{ backgroundColor: 'rgba(244, 63, 94, 0.7)' }} />
                        <span className="text-[11px] text-slate-300 font-semibold">Low ≤80%</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-4 rounded" style={{ backgroundColor: 'rgba(52, 211, 153, 0.6)' }} />
                        <span className="text-[11px] text-slate-300 font-semibold">Healthy &gt;80%</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-4 rounded" style={{ backgroundColor: 'rgba(34, 211, 238, 0.7)' }} />
                        <span className="text-[11px] text-slate-300 font-semibold">Over &gt;100%</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-4 rounded border border-white/10" style={{ backgroundColor: 'rgba(30, 41, 59, 0.6)' }} />
                        <span className="text-[11px] text-slate-500 font-semibold">No Alloc</span>
                      </div>
                    </div>
                    {/* Column headers */}
                    <div className="grid grid-cols-10 gap-1 mb-2 px-1 sticky top-0 z-10 bg-[#0b0f19] py-2 rounded-t-xl" style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}>
                      <div className="text-[10px] text-white font-black uppercase">Contract</div>
                      {['SYD', 'MEL', 'BNE', 'FRE', 'ADL', 'PIL', 'PRJ', 'AKL', 'OTH'].map(b => (
                        <div key={b} className="text-[9px] text-white font-black uppercase text-center">{b}</div>
                      ))}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {reactiveContractUtilData.map((row) => {
                        const branches = [
                          { b: row.syd, name: 'SYD' }, { b: row.mel, name: 'MEL' },
                          { b: row.bne, name: 'BNE' }, { b: row.fre, name: 'FRE' },
                          { b: row.adl, name: 'ADL' }, { b: row.pil, name: 'PIL' },
                          { b: row.prj, name: 'PRJ' }, { b: row.akl, name: 'AKL' },
                          { b: row.oth, name: 'OTH' }
                        ];
                        return (
                          <div key={row.id} className="grid grid-cols-10 gap-1 items-center group/heat hover:bg-white/[0.03] rounded-xl px-1 py-0.5 transition-colors">
                            <span className="text-[8px] text-slate-400  font-bold whitespace-nowrap col-span-1" title={formatContract(row)}>{row.id.split('-')[0]}</span>
                            {branches.map(({ b, name }) => {
                              const pct = b.alloc > 0 ? (b.booked / b.alloc) * 100 : 0;
                              const col = pct <= 0 ? 'bg-slate-800/60' : pct <= 50 ? 'bg-rose-700/80' : pct <= 80 ? 'bg-rose-500/70' : pct <= 100 ? 'bg-emerald-400/60' : 'bg-cyan-400/70';
                              return (
                                <div key={name} title={`${name}: ${b.booked}/${b.alloc} TEU (${pct.toFixed(0)}%)`}
                                  className={`h-7 rounded-md ${col} flex flex-col items-center justify-center transition-all group-hover/heat:scale-105`}>
                                  <span className="text-[9px] font-black text-white drop-shadow-sm">{pct > 0 ? `${pct.toFixed(0)}%` : '-'}</span>
                                  {pct > 0 && <span className="text-[7px] text-white/50  leading-none">{b.booked}/{b.alloc}</span>}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Column: Carrier Breakdown Donut Chart */}
                <div className="rounded-[40px] bg-[#0b0f19] border border-white/5 shadow-[0_30px_60px_rgba(0,0,0,0.8)] p-8 flex flex-col relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full blur-[60px] pointer-events-none" />
                  <h4 className="text-white font-bold tracking-[0.2em] uppercase text-[10px] mb-1">Carrier Breakdown</h4>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-6 font-bold">% of bookings by TEU · All Branches</p>

                  <div className="h-[220px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={(() => {
                            const grouped: Record<string, number> = {};
                            reactiveContractUtilData.filter(d => d.booked > 0).forEach(d => {
                              grouped[d.carrier] = (grouped[d.carrier] || 0) + d.booked;
                            });
                            return Object.entries(grouped).map(([carrier, value]) => ({ name: carrier, value, carrier }));
                          })()}
                          cx="50%" cy="50%"
                          innerRadius={65}
                          outerRadius={85}
                          paddingAngle={5}
                          dataKey="value"
                          stroke="none"
                          isAnimationActive={true}
                        >
                          {(() => {
                            const grouped: Record<string, number> = {};
                            reactiveContractUtilData.filter(d => d.booked > 0).forEach(d => {
                              grouped[d.carrier] = (grouped[d.carrier] || 0) + d.booked;
                            });
                            const distinctColors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#fb923c', '#a855f7'];
                            return Object.keys(grouped).map((carrier, index) => {
                              const color = distinctColors[index % distinctColors.length];
                              return <Cell key={`cell-${index}`} fill={color} style={{ filter: `drop-shadow(0 0 6px ${color}40)` }} />;
                            });
                          })()}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const total = reactiveContractUtilData.reduce((sum, r) => sum + r.booked, 0);
                              const percentage = ((payload[0].value as number / total) * 100).toFixed(1);
                              return (
                                <div style={{ backgroundColor: '#0b0f19', border: '1px solid rgba(139, 92, 246, 0.3)', padding: '16px', borderRadius: '16px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)', opacity: 1, zIndex: 9999 }}>
                                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>{payload[0].payload.carrier}</div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '32px', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Total Booked</span>
                                    <span style={{ fontSize: '12px', fontWeight: 900, color: '#ffffff', fontFamily: 'monospace' }}>{payload[0].value} TEU</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '32px', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '6px', paddingTop: '6px' }}>
                                    <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Network Share</span>
                                    <span style={{ fontSize: '12px', fontWeight: 900, color: '#34d399', fontFamily: 'monospace' }}>{percentage}%</span>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Center Label */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-2xl font-bold text-white tracking-tighter">
                        {reactiveContractUtilData.reduce((sum, r) => sum + r.booked, 0).toFixed(0)}
                      </span>
                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Total TEU</span>
                    </div>
                  </div>

                  {/* Compact Legend Grid - synced with chart colors */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 px-2">
                    {(() => {
                      const grouped: Record<string, number> = {};
                      reactiveContractUtilData.filter(d => d.booked > 0).forEach(d => {
                        grouped[d.carrier] = (grouped[d.carrier] || 0) + d.booked;
                      });
                      const total = Object.values(grouped).reduce((s, v) => s + v, 0);
                      const distinctColors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#fb923c', '#a855f7'];
                      return Object.entries(grouped).map(([carrier, value], i) => (
                        <div key={carrier} className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: distinctColors[i % distinctColors.length] }} />
                          <span className="text-[10px] text-slate-300 whitespace-nowrap font-bold">{carrier}</span>
                          <span className="text-[10px] font-black text-white ml-auto ">{((value / total) * 100).toFixed(0)}%</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

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

              <div className="bg-[#0b0f19]/80 backdrop-blur-3xl border border-white/5 rounded-[32px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative">
                <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

                <div className="p-6 md:p-8 flex justify-between items-center bg-black/40 border-b border-white/5 relative z-10">
                  <div className="flex items-center gap-4">
                    <span className="text-white font-bold text-lg tracking-wide">Raw Order Trajectory</span>
                  </div>
                  <button
                    onClick={() => setIsBookingTableModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl transition-colors shadow-[0_0_15px_rgba(16,185,129,0.15)] group"
                  >
                    <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                    <span className="text-xs font-bold uppercase tracking-widest">Fullscreen Projection</span>
                  </button>
                </div>

                <div className="px-6 py-3 border-b border-white/5 flex flex-wrap items-center gap-4 bg-slate-900/30">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data Quality Rules:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                    <span className="text-[10px] text-slate-300">Zero TEU</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                    <span className="text-[10px] text-slate-300">Missing Port Codes</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                    <span className="text-[10px] text-slate-300">Missing Equipment</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                    <span className="text-[10px] text-slate-300">Suspect Contract</span>
                  </div>

                  <div className="w-px h-4 bg-white/10 mx-2" />
                  
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Branch Legend:</span>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[10px] font-bold text-violet-400">SYD</span>
                    <span className="text-[10px] font-bold text-indigo-400">MEL</span>
                    <span className="text-[10px] font-bold text-amber-400">BNE</span>
                    <span className="text-[10px] font-bold text-fuchsia-400">FRE</span>
                    <span className="text-[10px] font-bold text-rose-400">ADL</span>
                    <span className="text-[10px] font-bold text-sky-400">PIL</span>
                    <span className="text-[10px] font-bold text-emerald-400">PRJ</span>
                    <span className="text-[10px] font-bold text-cyan-400">AKL</span>
                    <span className="text-[10px] font-bold text-slate-400">OTH</span>
                  </div>
                </div>

                <div className="overflow-x-auto pb-4 elegant-scrollbar force-scrollbar relative z-10 p-2 md:p-5">
                  <table className="w-full text-left border-collapse table-auto min-w-[1400px] dashboard-table">
                    <thead>
                      <tr className="bg-slate-900/60 rounded-xl">
                        <th className="px-6 py-4 font-bold text-slate-400 text-[10px] tracking-widest uppercase border-b border-white/5 rounded-tl-xl">Contract Key</th>
                        <th className="px-6 py-4 font-bold text-slate-400 text-[10px] tracking-widest uppercase border-b border-white/5">Order No.</th>
                        {/* NEW: Branch column added per stakeholder request */}
                        <th className="px-6 py-4 font-bold text-sky-400 text-[10px] tracking-widest uppercase border-b border-white/5">Branch</th>
                        <th className="px-6 py-4 font-bold text-slate-400 text-[10px] tracking-widest uppercase border-b border-white/5 truncate">Client / Source</th>
                        <th className="px-6 py-4 font-bold text-slate-400 text-[10px] tracking-widest uppercase border-b border-white/5">Transit Vessel</th>
                        <th className="px-6 py-4 font-bold text-slate-400 text-[10px] tracking-widest uppercase border-b border-white/5 text-center">ETD</th>
                        <th className="px-6 py-4 font-bold text-slate-400 text-[10px] tracking-widest uppercase border-b border-white/5 text-center">ETA</th>
                        <th className="px-6 py-4 font-bold text-indigo-400 text-[10px] tracking-widest uppercase border-b border-white/5 text-center">Origin → Dest</th>
                        <th className="px-6 py-4 font-bold text-emerald-400 text-[10px] tracking-widest uppercase border-b border-white/5 text-right rounded-tr-xl">TEU (Net)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.02]">
                      {filteredBookings.slice(0, 30).map((row, i) => {
                        const rTeu = row.teu || 0;
                        
                        // Data Quality Rules evaluation
                        const hasZeroTeu = rTeu <= 0;
                        const hasMissingPorts = !row.loadPort || !row.dischargePort || row.loadPort === '-' || row.dischargePort === '-';
                        const hasMissingEq = !row.equipment || row.equipment === '-';
                        const contractInfo = CONTRACT_UTIL_DATA.find(c => c.id === row.contract);
                        const isSuspectContract = !contractInfo;
                        
                        // Branch colour for quick visual identification
                        const branchColorMap: Record<string, string> = {
                          SY1: 'text-violet-400', ME1: 'text-indigo-400', BN1: 'text-amber-400',
                          FR1: 'text-fuchsia-400', PR1: 'text-fuchsia-400',
                          AD1: 'text-rose-400', PIL: 'text-sky-400', PRJ: 'text-emerald-400',
                          AKL: 'text-cyan-400', OTH: 'text-slate-400',
                        };
                        const brCls = branchColorMap[row.branch] || 'text-slate-400';
                        return (
                          <tr key={row.order + i} className="hover:bg-white/[0.03] transition-colors group relative">
                            <td className="px-6 py-5  text-xs font-bold text-slate-300 relative">
                              <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col gap-0.5">
                                {hasZeroTeu && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" title="Zero TEU" />}
                                {hasMissingPorts && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" title="Missing Port Codes" />}
                                {hasMissingEq && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" title="Missing Equipment" />}
                                {isSuspectContract && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" title="Suspect Contract" />}
                              </div>
                              <span className="pl-8 flex items-center flex-wrap gap-1">
                                <span className="whitespace-nowrap" title={formatContract(contractInfo || row)}>{formatContract(contractInfo || row)}</span>
                                {contractInfo && (contractInfo as any).contractType && (
                                  <span className={`ml-1 text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wider ${
                                    (contractInfo as any).contractType === 'NAC' ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' :
                                    (contractInfo as any).contractType === 'BUNDLE' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                                    'bg-slate-500/15 text-slate-400 border-slate-500/30'
                                  }`}>{(contractInfo as any).contractType}</span>
                                )}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-xs">
                              <a href={`${import.meta.env.VITE_CARGOWISE_BASE_URL || 'https://cargowise.placeholder.com'}/order/${row.order}`} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-4 decoration-indigo-500/30 hover:decoration-indigo-400 transition-all block truncate max-w-[140px]" title={row.order}>
                                {row.order}
                              </a>
                            </td>
                            {/* Branch cell */}
                            <td className={`px-6 py-5  text-xs font-bold ${brCls}`}>{row.branch}</td>
                            <td className="px-6 py-5 text-xs text-slate-400 truncate tracking-tighter" title={row.buyer}>{row.buyer}</td>
                            <td className="px-6 py-5 text-xs text-slate-300">{row.depVessel} {row.depVoyage}</td>
                            <td className="px-6 py-5  text-xs text-center text-slate-300">{formatDate(row.etd)}</td>
                            <td className="px-6 py-5  text-xs text-center text-slate-300">{formatDate(row.eta)}</td>
                            <td className="px-6 py-5 text-center  text-xs bg-slate-900/40 text-slate-300">{row.loadPort} → {row.dischargePort}</td>
                            <td className={`px-6 py-5  text-xs font-bold text-right ${hasZeroTeu ? 'text-rose-500' : 'text-emerald-400'}`}>{rTeu.toFixed(1)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="bg-slate-900/30 px-6 py-4 flex justify-between items-center border-t border-white/5 relative z-10">
                  <div className="flex items-center gap-2 text-[10px] text-slate-300 uppercase tracking-widest font-bold">
                    <div className="w-2 h-2 rounded-full bg-emerald-500/50 animate-pulse" />
                    Viewing first 30 of {BOOKING_LOG_DATA.length} booking records — Fullscreen for all
                  </div>
                  <div className="text-[10px] text-slate-300  tracking-widest border border-slate-700/50 px-2 py-1 flex items-center bg-slate-800/30 rounded">
                    Sync Checksum: 0x9F3EA4
                  </div>
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
                    <h3 className="text-white font-bold tracking-widest text-sm uppercase flex items-center gap-2 mb-2"><span className="w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)]" /> Network Distribution</h3>
                    <p className="text-slate-400 text-sm leading-relaxed border-l-4 border-emerald-500/50 pl-4 py-1">{branchInsight}</p>
                    <div className="w-max mt-4 px-4 py-2 rounded-xl bg-emerald-500/10 text-[10px] font-bold text-emerald-400 uppercase tracking-widest border border-emerald-500/20 group-hover:bg-emerald-400 group-hover:text-black transition-colors shadow-inner flex items-center gap-2">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg> Expand Raw Metrics
                    </div>
                  </div>
                  <div className="h-64 w-full md:w-1/2 relative z-10 antialiased shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={reactiveLocationAggregatedData.slice(0, 10)} margin={{ top: 10, right: 0, bottom: -10, left: -20 }}>
                        <defs>
                          <linearGradient id="colorTeu" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#34d399" stopOpacity={0.6} />
                            <stop offset="95%" stopColor="#02040a" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.02)" vertical={false} />
                        <XAxis dataKey="label" stroke="#475569" tickLine={false} axisLine={false} fontSize={9} fontWeight={800} />
                        <YAxis stroke="#475569" tickLine={false} axisLine={false} fontSize={9} />
                        <Tooltip
                          cursor={{ fill: 'rgba(52,211,153,0.04)' }}
                          contentStyle={{
                            backgroundColor: '#02040a',
                            border: '1px solid rgba(52, 211, 153, 0.3)',
                            borderRadius: '20px',
                            padding: '12px 16px',
                            boxShadow: '0 25px 50px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.05)',
                            backdropFilter: 'blur(16px)',
                          }}
                          itemStyle={{ fontFamily: 'monospace', fontWeight: '800', color: '#cbd5e1' }}
                          labelStyle={{ color: '#94a3b8', fontWeight: '800', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}
                        />
                        <Area type="monotone" dataKey="teu" fillOpacity={1} fill="url(#colorTeu)" stroke="none" isAnimationActive={true} animationDuration={2500} animationEasing="ease-in-out" />
                        <Line type="monotone" dataKey="teu" stroke="#34d399" strokeWidth={3} isAnimationActive={true} animationDuration={2500} animationEasing="ease-in-out" dot={{ r: 5, fill: '#02040a', stroke: '#34d399', strokeWidth: 2.5 }} activeDot={{ r: 7, fill: '#34d399', stroke: '#fff', strokeWidth: 2 }} style={{ filter: 'drop-shadow(0px 0px 8px rgba(52,211,153,0.6))' }} />
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
                        <Tooltip
                          cursor={{ fill: 'rgba(34,211,238,0.04)' }}
                          contentStyle={{
                            backgroundColor: '#02040a',
                            border: '1px solid rgba(34, 211, 238, 0.3)',
                            borderRadius: '20px',
                            padding: '12px 16px',
                            boxShadow: '0 25px 50px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.05)',
                            backdropFilter: 'blur(16px)',
                          }}
                          itemStyle={{ fontFamily: 'monospace', fontWeight: '800', color: '#cbd5e1' }}
                          labelStyle={{ color: '#94a3b8', fontWeight: '800', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}
                          formatter={(v) => [`${v} TEU`, 'Volume']}
                        />
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
                <div className="md:w-[65%] bg-[#0b0f19]/80 rounded-[16px] border border-white/5 p-4 shadow-inner overflow-y-auto elegant-scrollbar force-scrollbar max-h-[50vh] md:max-h-full">

                  <div className=" text-sm w-full space-y-2">

                    {/* TOTAL ALLOCATION BREAKDOWN */}
                    {activeKpi.label === 'TOTAL ALLOCATION' && (
                      <div className="grid grid-cols-2 gap-2">
                        {reactiveBranchSnapshot.map((b, i) => (
                          <div key={b.branch} className="flex flex-col gap-1.5 p-2 rounded-lg bg-white/[0.02] border border-white/[0.02]">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{b.branch}</span>
                              <span className=" text-sm text-white">{b.alloc}</span>
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
                              <span className=" text-sm text-white">{b.booked}</span>
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

                    {/* UNDERPERFORMING (≤80%) BREAKDOWN */}
                    {(activeKpi.label === 'OVERBOOKED' || activeKpi.label === 'UNDERPERFORMING CONTRACT (≤80%)' || activeKpi.label === 'Underperforming (≤80%)') && (
                      <div className="flex flex-col gap-2">
                        {cuLowUptake.length > 0 ? cuLowUptake.map(c => (
                          <div key={c.id} className="flex justify-between items-center p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                            <span className="text-white text-sm whitespace-nowrap" title={c.carrier}>{c.id} – {c.carrier}</span>
                            <span className="text-xs text-rose-400 font-bold whitespace-nowrap">{c.util.toFixed(1)}% util</span>
                          </div>
                        )) : <div className="text-emerald-400 italic p-4 text-center">✓ All contracts above 80% utilisation</div>}
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
                  <div className="overflow-x-auto elegant-scrollbar force-scrollbar w-full pb-4">
                    <table className="w-full text-left border-collapse table-auto min-w-[1600px]">
                      <thead className="sticky top-0 z-20">
                        <tr className="bg-[#0b0f19] border-b-2 border-indigo-500/30">
                          <th className="px-8 py-5 font-bold text-slate-300 text-[10px] tracking-widest uppercase border-r border-white/10 sticky left-0 bg-[#0b0f19] z-30 shadow-[4px_0_10px_rgba(0,0,0,0.5)]">
                            <div className="flex items-center gap-2">
                              <span>Carrier/Contract</span>
                              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                            </div>
                          </th>
                          {AVAILABLE_WEEKS.slice(-8).map(wk => (
                            <React.Fragment key={wk}>
                              <th colSpan={3} className="px-4 py-3 font-black text-white text-[11px] tracking-[0.3em] uppercase border-r border-white/10 bg-indigo-500/10 shadow-inner">{wk}</th>
                            </React.Fragment>
                          ))}
                        </tr>
                        <tr className="bg-black/50 backdrop-blur-md border-b border-white/10">
                          <th className="px-8 py-3 border-r border-white/10 sticky left-0 bg-black z-30 shadow-[4px_0_10px_rgba(0,0,0,0.3)]"></th>
                          {AVAILABLE_WEEKS.slice(-8).map(wk => (
                            <React.Fragment key={wk}>
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
                                <td className="px-8 py-6 font-display font-bold text-white text-sm border-r border-indigo-500/30 sticky left-0 bg-[#0b0f19] z-30 shadow-[4px_0_10px_rgba(0,0,0,0.5)]">{contractRow.contract}</td>
                                {AVAILABLE_WEEKS.slice(-8).map(wk => {
                                  const d = (contractRow.data as any)[wk] || { alloc: 0, booked: 0, util: 0 };
                                  const utilColor = d.util <= 0 ? 'text-slate-400 border-transparent' : d.util <= 80 ? 'bg-rose-500/30 text-rose-400 border-rose-500/50' : d.util <= 100 ? 'bg-emerald-500/30 text-emerald-400 border-emerald-500/50' : 'bg-cyan-500/30 text-cyan-400 border-cyan-500/50';
                                  return (
                                    <React.Fragment key={wk}>
                                      <td className="px-2 py-6 text-center border-r border-white/10  text-xs text-slate-300">{d.alloc}</td>
                                      <td className="px-2 py-6 text-center border-r border-white/10  text-xs text-slate-300">{d.booked.toFixed(1)}</td>
                                      <td className={`px-2 py-6 text-center border-r border-white/10  font-bold text-sm ${utilColor}`}>
                                        <div className={`mx-auto px-2 py-1 rounded-lg border ${utilColor}`}>{d.util}%</div>
                                      </td>
                                    </React.Fragment>
                                  );
                                })}
                              </tr>
                            ) : (
                              (contractRow as any).branches?.map((branch: any, bIdx: number) => (
                                <tr key={`${idx}-${bIdx}`} className="border-b border-white/5 hover:bg-white/[0.05] transition-colors group/pbranch">
                                  <td className="px-8 py-5 border-r border-white/10 sticky left-0 bg-[#0b0f19] z-30 shadow-[4px_0_10px_rgba(0,0,0,0.5)] flex items-center gap-4">
                                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded font-bold ">{branch.code}</span>
                                    <span className="text-sm text-slate-300 font-medium">{branch.branch}</span>
                                  </td>
                                  {AVAILABLE_WEEKS.slice(-8).map(wk => {
                                    const d = (branch.data as any)[wk] || { alloc: 0, booked: 0, util: 0 };
                                    const utilColor = d.util <= 0 ? 'text-slate-300' : getUtilColor(d.util, 'text');
                                    return (
                                      <React.Fragment key={wk}>
                                        <td className="px-2 py-5 text-center border-r border-white/10  text-xs text-slate-300">{d.alloc}</td>
                                        <td className="px-2 py-5 text-center border-r border-white/10  text-xs text-slate-300">{d.booked.toFixed(1)}</td>
                                        <td className={`px-2 py-5 text-center border-r border-white/10  font-bold text-xs ${utilColor}`}>
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
                              <td className="px-2 py-8 text-center border-r border-white/10  font-bold text-lg text-white">{wk.alloc}</td>
                              <td className="px-2 py-8 text-center border-r border-white/10  font-bold text-lg text-white">{wk.booked.toFixed(1)}</td>
                              <td className={`px-2 py-8 text-center border-r border-white/10  font-bold text-xl ${getUtilColor(wk.util, 'text')} drop-shadow-[0_0_10px_currentColor]`}>{wk.util}%</td>
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
                          <td className={`px-6 py-4  text-sm font-bold text-center ${row.code === 'ALL' ? 'text-white' : 'text-slate-300'}`}>{row.code}</td>
                          <td className={`px-6 py-4 font-medium ${row.code === 'ALL' ? 'text-white' : 'text-slate-300'}`}>{row.branch}</td>
                          <td className="px-6 py-4  text-base font-bold text-emerald-400 text-right drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]">{row.teu.toFixed(1)}</td>
                          <td className={`px-6 py-4  text-sm text-right ${row.code === 'ALL' ? 'text-white font-bold' : 'text-slate-400'}`}>{row.bookings}</td>
                          <td className={`px-6 py-4  text-sm text-right ${row.code === 'ALL' ? 'text-white font-bold' : 'text-slate-400'}`}>{row.contracts || '-'}</td>
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
                          <td className="px-6 py-4  text-sm font-bold text-slate-300">{row.contract}</td>
                          <td className="px-6 py-4  text-sm font-bold text-cyan-400 text-center"><div className="px-2 py-1 bg-cyan-500/10 rounded border border-cyan-500/20 w-min mx-auto">{row.region}</div></td>
                          <td className="px-6 py-4  text-base font-bold text-white text-right">{row.teu.toFixed(1)}</td>
                          <td className="px-6 py-4  text-sm font-bold text-slate-400 text-right">{row.bookings}</td>
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
              <div className="flex-1 overflow-auto premium-scrollbar force-scrollbar p-6 md:p-10 bg-slate-950">
                <div className="bg-[#0b0f19] border border-white/10 rounded-[20px] shadow-2xl scale-[1.01] origin-top mb-10 pb-4 overflow-auto premium-scrollbar force-scrollbar max-h-[calc(90vh-160px)]">
                  <table className="w-full text-left border-collapse table-auto min-w-[4000px]">
                    <thead className="sticky top-0 z-30" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                        <tr className="bg-gradient-to-r from-sky-100 to-sky-200 font-bold border-b-2 border-sky-300">
                          <th className="px-8 py-5 text-sky-800 text-xs tracking-widest uppercase sticky left-0 z-20 bg-sky-100 border-r border-sky-200 w-48">Contract Key</th>
                          <th className="px-8 py-5 text-sky-800 text-xs tracking-widest uppercase sticky left-48 z-20 bg-gradient-to-r from-sky-100 to-sky-200 border-r border-sky-300 shadow-[6px_0_18px_rgba(0,0,0,0.15)] w-72">Order No.</th>
                          <th className="px-8 py-5 text-sky-700 text-xs tracking-widest uppercase">Buyer</th>
                          <th className="px-8 py-5 text-sky-700 text-xs tracking-widest uppercase">Supplier</th>
                          <th className="px-8 py-5 text-sky-700 text-xs tracking-widest uppercase">ETD</th>
                          <th className="px-8 py-5 text-sky-700 text-xs tracking-widest uppercase">ETA</th>
                          <th className="px-8 py-5 text-sky-700 text-xs tracking-widest uppercase">Dep. Vessel</th>
                          <th className="px-8 py-5 text-sky-700 text-xs tracking-widest uppercase">Dep. Voyage</th>
                          <th className="px-8 py-5 text-sky-700 text-xs tracking-widest uppercase">Arr. Vessel</th>
                          <th className="px-8 py-5 text-sky-700 text-xs tracking-widest uppercase">Arr. Voyage</th>
                          <th className="px-8 py-5 text-sky-700 text-xs tracking-widest uppercase">Origin</th>
                          <th className="px-8 py-5 text-sky-700 text-xs tracking-widest uppercase text-center">Load Port</th>
                          <th className="px-8 py-5 text-sky-700 text-xs tracking-widest uppercase text-center">Discharge Port</th>
                          <th className="px-8 py-5 text-sky-700 text-xs tracking-widest uppercase text-center">Destination</th>
                          <th className="px-8 py-5 text-sky-700 text-xs tracking-widest uppercase">House Bill</th>
                          <th className="px-8 py-5 text-sky-700 text-xs tracking-widest uppercase">Master Bill</th>
                          <th className="px-8 py-5 text-sky-700 text-xs tracking-widest uppercase text-center">Branch</th>
                          <th className="px-8 py-5 text-sky-700 text-xs tracking-widest uppercase text-right">TEU</th>
                          <th className="px-8 py-5 text-sky-700 text-xs tracking-widest uppercase text-right">Containers</th>
                          <th className="px-8 py-5 text-sky-700 text-xs tracking-widest uppercase text-center">MSC Wk No</th>
                          <th className="px-8 py-5 text-sky-700 text-xs tracking-widest uppercase text-right">Total TEU</th>
                          <th className="px-8 py-5 text-sky-700 text-xs tracking-widest uppercase text-right">Total FEU</th>
                          <th className="px-8 py-5 text-sky-700 text-xs tracking-widest uppercase text-center">MSC Week</th>
                          <th className="px-8 py-5 text-sky-700 text-xs tracking-widest uppercase text-center">Country</th>
                          <th className="px-8 py-5 text-sky-700 text-xs tracking-widest uppercase text-center">Year</th>
                          <th className="px-8 py-5 text-sky-700 text-xs tracking-widest uppercase text-center">QTR</th>
                          <th className="px-8 py-5 text-sky-700 text-xs tracking-widest uppercase text-center">Region</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredBookings.map((row, i) => {
                          const rTeu = row.teu || 0;
                          
                          // Data Quality Rules evaluation
                          const hasZeroTeu = rTeu <= 0;
                          const hasMissingPorts = !row.loadPort || !row.dischargePort || row.loadPort === '-' || row.dischargePort === '-';
                          const hasMissingEq = !row.equipment || row.equipment === '-';
                          const isSuspectContract = !CONTRACT_UTIL_DATA.find(c => c.id === row.contract);

                          return (
                            <tr key={noNodeNum + i} className="hover:bg-white/[0.03] transition-colors group relative">
                              <td className="px-8 py-5  text-xs font-bold text-sky-900 sticky left-0 z-10 bg-sky-50 border-r border-sky-200 transition-colors duration-200 hover:bg-sky-100">
                                <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col gap-0.5">
                                  {hasZeroTeu && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" title="Zero TEU" />}
                                  {hasMissingPorts && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" title="Missing Port Codes" />}
                                  {hasMissingEq && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" title="Missing Equipment" />}
                                  {isSuspectContract && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" title="Suspect Contract" />}
                                </div>
                                <span className="pl-4">{row.contract}</span>
                              </td>
                              <td className="px-8 py-5  text-xs font-bold sticky left-48 z-10 bg-sky-50 border-r border-sky-300 shadow-[6px_0_18px_rgba(0,0,0,0.15)] transition-colors duration-200 hover:bg-sky-100">
                                <a href={`https://cargowise.placeholder.com/order/${row.order}`} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-4 decoration-indigo-500/30 hover:decoration-indigo-400 transition-all">
                                  {row.order}
                                </a>
                              </td>
                              <td className="px-8 py-5 text-xs text-sky-600 truncate border-r border-slate-700/50 min-w-[280px]" title={row.buyer}>{row.buyer}</td>
                              <td className="px-8 py-5 text-xs text-amber-500/80 truncate min-w-[280px]" title={row.supplier}>{row.supplier}</td>
                              <td className="px-8 py-5  text-xs text-slate-400">{formatDate(row.etd)}</td>
                              <td className="px-8 py-5  text-xs text-slate-400">{formatDate(row.eta)}</td>
                              <td className="px-8 py-5 text-xs text-slate-600">{row.depVessel}</td>
                              <td className="px-8 py-5  text-xs text-slate-300">{row.depVoyage}</td>
                              <td className="px-8 py-5 text-xs text-slate-500">-</td>
                              <td className="px-8 py-5  text-xs text-slate-300">-</td>
                              <td className="px-8 py-5 text-xs text-indigo-400 font-medium uppercase">{row.originRegion}</td>
                              <td className="px-8 py-5  text-xs text-center text-slate-300 bg-slate-900/20">{row.loadPort}</td>
                              <td className="px-8 py-5  text-xs text-center text-slate-300 bg-slate-900/20">{row.dischargePort}</td>
                              <td className="px-8 py-5 text-xs text-indigo-400 font-medium uppercase">{row.destRegion}</td>
                              <td className="px-8 py-5  text-xs text-slate-300">N/A</td>
                              <td className="px-8 py-5  text-xs text-slate-300">N/A</td>
                              <td className="px-8 py-5 text-center"><div className="text-xs font-bold px-3 py-1 bg-indigo-500/10 text-indigo-300 rounded border border-indigo-500/20  tracking-widest">{row.branch}</div></td>
                              <td className={`px-8 py-5  text-xs font-bold text-right ${hasZeroTeu ? 'text-rose-500' : 'text-emerald-400'}`}>{rTeu.toFixed(2)}</td>
                              <td className="px-8 py-5  text-xs text-slate-400 text-right">{row.containers || '-'}</td>
                              <td className="px-8 py-5  text-xs text-center text-slate-300">{row.mscWeek}</td>
                              <td className={`px-8 py-5  text-xs text-right ${hasZeroTeu ? 'text-rose-500' : 'text-slate-400'}`}>{rTeu.toFixed(2)}</td>
                              <td className="px-8 py-5  text-xs text-slate-400 text-right">-</td>
                              <td className="px-8 py-5  text-xs text-center text-slate-300">WK {row.mscWeek}</td>
                              <td className="px-8 py-5  text-xs text-center text-slate-400">-</td>
                              <td className="px-8 py-5  text-xs text-center text-slate-400">2026</td>
                              <td className="px-8 py-5  text-xs text-center text-slate-400">-</td>
                              <td className="px-8 py-5 text-center"><div className="px-2 py-1 bg-cyan-500/10 rounded border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-widest">{row.destRegion || '-'}</div></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
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

              <div className="overflow-x-auto pb-4 p-6 bg-slate-950">
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
                        <td className="px-5 py-4 text-right text-slate-400 ">{row.alloc}</td>
                        <td className="px-5 py-4 text-right">
                          <span className={` font-bold px-2 py-1 rounded bg-slate-900 border ${row.status === 'Low Uptake' ? 'text-amber-400 border-amber-500/20 shadow-[0_0_10px_rgba(251,191,36,0.1)]' : 'text-cyan-400 border-cyan-500/20'}`}>
                            {row.booked}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right text-slate-300 ">{row.avail}</td>
                        <td className={`px-5 py-4 text-right  font-semibold ${row.status === 'Low Uptake' ? 'text-slate-400' : 'text-emerald-400'}`}>{row.util}</td>
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
                <div className="text-xs text-slate-300 ">
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
              <div className="flex-1 overflow-auto elegant-scrollbar force-scrollbar p-8">
                {/* Re-using the table content here */}
                <div className="bg-[#0b0f19] border border-white/10 rounded-[32px] overflow-auto elegant-scrollbar force-scrollbar max-h-[calc(90vh-200px)]">
                  <table className="w-full text-left border-collapse table-auto min-w-[2000px]">
                    <thead className="sticky top-0 z-20" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                      <tr className="bg-[#0b0f19] font-bold border-b-2 border-violet-500/30">
                        {['Contract ID', 'Type', 'Carrier', 'Trade Lane', 'Alloc (TEU)', 'Booked (TEU)', 'Avail (TEU)', 'Util %', 'Status', 'SYD (BK/AV)', 'MEL (BK/AV)', 'BNE (BK/AV)', 'PER (BK/AV)', 'ADL (BK/AV)'].map((h, i) => (
                          <th key={h} className={`px-6 py-5 font-bold text-sm tracking-widest uppercase ${i === 8 ? 'text-center text-amber-400' : i >= 9 ? 'text-center text-violet-400' : i >= 5 ? 'text-right text-cyan-400' : i === 1 ? 'text-center text-amber-400' : 'text-white'}`}>{h}</th>
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
                            <td className="px-6 py-6  text-base font-bold text-violet-300">
                              {row.id}
                              {(row as any).contractType && (
                                <span className={`ml-3 text-[10px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider ${
                                  (row as any).contractType === 'NAC' ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' :
                                  (row as any).contractType === 'BUNDLE' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                                  'bg-slate-500/15 text-slate-400 border-slate-500/30'
                                }`}>{(row as any).contractType}</span>
                              )}
                            </td>
                            <td className="px-6 py-6 text-sm font-bold text-amber-400/80 text-center">{(row as any).contractType || '-'}</td>
                            <td className="px-6 py-6 text-base text-slate-300 font-medium">{row.carrier}</td>
                            <td className="px-6 py-6  text-base text-slate-300">{row.lane}</td>
                            <td className="px-6 py-6 text-right  text-base text-slate-300">{row.alloc}</td>
                            <td className="px-6 py-6 text-right  text-base font-bold text-cyan-400">{row.booked}</td>
                            <td className={`px-6 py-6 text-right  text-base font-bold ${row.avail < 0 ? 'text-rose-400' : 'text-slate-400'}`}>{row.avail}</td>
                            <td className={`px-6 py-6 text-right  text-base font-bold ${getUtilColor(row.util, 'text')}`}>{row.util.toFixed(1)}%</td>
                            <td className="px-6 py-6 text-center"><span className={`text-xs font-bold px-3 py-1 rounded border uppercase tracking-wider ${statusStyle}`}>{row.status}</span></td>
                            {[row.syd, row.mel, row.bne, row.per, row.adl].map((b, bi) => {
                              const avail = b ? b.alloc - b.booked : 0;
                              return (
                                <td key={bi} className="px-6 py-6 text-center  text-base">
                                  <span className={b && b.booked > b.alloc ? 'text-rose-400' : 'text-slate-300'}>{b ? b.booked : 0}</span>
                                  <span className="text-slate-400">/{avail}</span>
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

      {/* Fullscreen Branch Performance Snapshot Modal */}
      <AnimatePresence>
        {isBranchSnapshotModalOpen && (
          <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsBranchSnapshotModalOpen(false)} className="absolute inset-0 bg-slate-950/90 backdrop-blur-2xl" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 40 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 40 }} className="relative w-full max-w-[95vw] h-[90vh] bg-[#0b0e14] border border-white/10 shadow-[0_60px_120px_rgba(0,0,0,1)] rounded-[40px] overflow-hidden z-20 flex flex-col">
              <div className="p-10 border-b border-white/5 flex justify-between items-center bg-black/40">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <h3 className="text-4xl font-display font-light text-white">Branch <span className="font-bold text-emerald-400">Performance Snapshot</span></h3>
                  </div>
                  <p className="text-xs text-slate-300 uppercase tracking-widest font-black ml-5">Expanded Geographic Hub View | LIVE</p>
                </div>
                <button
                  onClick={() => setIsBranchSnapshotModalOpen(false)}
                  className="w-16 h-16 bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/50 rounded-3xl flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-2xl"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="flex-1 p-10 bg-[#050505]/40 overflow-hidden">
                <div className="bg-[#0b0f19] border border-white/10 rounded-[30px] shadow-2xl overflow-auto elegant-scrollbar force-scrollbar max-h-[calc(90vh-200px)]">
                  {/* Re-using the same table structure for the modal */}
                  <table className="w-full text-left border-separate border-spacing-0">
                    <thead className="sticky top-0 z-20" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                      <tr className="bg-[#0b1120] font-bold border-b-2 border-emerald-500/20">
                        <th className="p-8 text-slate-400 text-xs tracking-[0.2em] font-black uppercase border-b border-white/10 w-1/3 bg-[#0b1120]">Hub</th>
                        <th className="p-8 text-slate-400 text-xs tracking-[0.2em] font-black uppercase border-b border-white/10 text-right bg-[#0b1120]">Alloc (TEU)</th>
                        <th className="p-8 text-cyan-400 text-xs tracking-[0.2em] font-black uppercase border-b border-white/10 text-right bg-[#0b1120]">Booked</th>
                        <th className="p-8 text-slate-400 text-xs tracking-[0.2em] font-black uppercase border-b border-white/10 text-right bg-[#0b1120]">Available</th>
                        <th className="p-8 text-slate-400 text-xs tracking-[0.2em] font-black uppercase border-b border-white/10 text-right bg-[#0b1120]">Utilisation</th>
                        <th className="p-8 text-slate-400 text-xs tracking-[0.2em] font-black uppercase border-b border-white/10 text-center bg-[#0b1120]">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {reactiveBranchSnapshot.map((row, i) => {
                        const isHealthy = row.util > 80;
                        const isOverutilised = row.util > 100;
                        const isUnderperforming = !isHealthy && row.util > 50;
                        const s = isOverutilised
                          ? { badge: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/25', dot: 'bg-emerald-300', util: 'text-emerald-300', bar: 'bg-emerald-400' }
                          : isHealthy
                            ? { badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25', dot: 'bg-emerald-400', util: 'text-emerald-400', bar: 'bg-emerald-500' }
                            : isUnderperforming
                              ? { badge: 'bg-rose-500/10 text-rose-400 border-rose-500/25', dot: 'bg-rose-400', util: 'text-rose-400', bar: 'bg-rose-400' }
                              : { badge: 'bg-rose-900/40 text-rose-300 border-rose-700/40', dot: 'bg-rose-700', util: 'text-rose-300', bar: 'bg-rose-700' };
                        return (
                          <React.Fragment key={i}>
                            <tr className="hover:bg-white/[0.04] transition-all duration-300 group/mod">
                              <td className="p-8">
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-3">
                                    <span className={`w-3 h-3 rounded-full shrink-0 ${s.dot}`} />
                                    <span className=" font-bold text-slate-200 text-lg tracking-wide">{row.branch}</span>
                                    {row.branchName && <span className="text-xs text-slate-500">{row.branchName}</span>}
                                  </div>
                                </div>
                              </td>
                              <td className="p-8 text-right  text-xl text-slate-300">{row.alloc}</td>
                              <td className="p-8 text-right  text-xl text-cyan-400 font-bold">{row.booked.toFixed(1)}</td>
                              <td className={`p-8 text-right  text-xl ${row.avail < 0 ? 'text-rose-400' : 'text-slate-400'}`}>{row.avail < 0 ? `(${Math.abs(row.avail).toFixed(1)})` : row.avail.toFixed(1)}</td>
                              <td className={`p-8 text-right  text-xl font-bold ${s.util}`}>{row.util.toFixed(1)}%</td>
                              <td className="p-8 text-center">
                                <span className={`px-4 py-2 text-xs font-bold rounded-full border uppercase tracking-wider ${s.badge}`}>
                                  {row.status}
                                </span>
                              </td>
                            </tr>
                            {(row as any).activeContractsData && (row as any).activeContractsData.length > 0 && (
                              (row as any).activeContractsData.map((c: any, cIdx: number) => (
                                <tr key={`nested-${i}-${cIdx}`} className="bg-sky-400/10 hover:bg-sky-400/20 transition-colors border-b border-sky-400/20">
                                  <td className="pl-16 p-4 border-l-4 border-sky-500/30">
                                    <span className="text-base text-indigo-300 font-bold ">↳ {c.id}</span>
                                  </td>
                                  <td className="p-4 text-right  text-lg text-slate-300 font-bold">{c.alloc || '-'}</td>
                                  <td className="p-4 text-right  text-lg text-blue-500 font-bold">{c.booked.toFixed(1)}</td>
                                  <td className="p-4 text-right  text-lg text-slate-300 font-bold">{c.avail < 0 ? `(${Math.abs(c.avail).toFixed(1)})` : c.avail.toFixed(1)}</td>
                                  <td className="p-4 text-right  text-lg text-slate-300 font-bold">{c.util.toFixed(1)}%</td>
                                  <td className="p-4 text-center"></td>
                                </tr>
                              ))
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
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
              <div className="flex-1 p-10 bg-[#050505]/40 overflow-hidden">
                <div className="bg-[#0b0f19] border border-white/10 rounded-[30px] shadow-2xl overflow-auto elegant-scrollbar force-scrollbar max-h-[calc(90vh-200px)]">
                  {/* Re-using the same table structure for the modal */}
                  <table className="w-full text-left border-collapse table-auto min-w-[2200px]">
                    <thead className="sticky top-0 z-30" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                      <tr className="bg-[#0f172a] border-b border-white/10">
                        <th rowSpan={2} className="w-[320px] p-8 text-slate-300 text-[11px] tracking-[0.2em] font-black uppercase border-r border-white/10 sticky left-0 z-40 bg-[#0f172a] shadow-[4px_0_15px_rgba(0,0,0,0.6)]">
                          <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            Contract ID
                          </div>
                        </th>
                        <th rowSpan={2} className="w-[280px] p-8 text-slate-300 text-[11px] tracking-[0.2em] font-black uppercase border-r border-white/10 sticky left-[320px] z-40 bg-[#0f172a] shadow-[4px_0_15px_rgba(0,0,0,0.4)]">Carrier</th>
                        <th rowSpan={2} className="w-[120px] p-8 text-slate-300 text-[11px] tracking-[0.2em] font-black uppercase border-r border-white/10 text-center bg-[#0f172a]">Lane</th>
                        <th colSpan={3} className="px-2 py-6 text-center bg-rose-500/10 border-b border-r border-rose-500/20 text-rose-400 text-xs font-black uppercase tracking-[0.3em] font-display">Sydney</th>
                        <th colSpan={3} className="px-2 py-6 text-center bg-cyan-500/10 border-b border-r border-cyan-500/20 text-cyan-400 text-xs font-black uppercase tracking-[0.3em] font-display">Melbourne</th>
                        <th colSpan={3} className="px-2 py-6 text-center bg-amber-500/10 border-b border-r border-amber-500/20 text-amber-400 text-xs font-black uppercase tracking-[0.3em] font-display">Brisbane</th>
                        <th colSpan={3} className="px-2 py-6 text-center bg-emerald-500/10 border-b border-r border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-[0.3em] font-display">Perth</th>
                        <th colSpan={3} className="px-2 py-6 text-center bg-indigo-500/10 border-b border-white/10 text-indigo-400 text-xs font-black uppercase tracking-[0.3em] font-display">Adelaide</th>
                      </tr>
                      <tr className="bg-[#0b0f19] border-b border-white/5">
                        {['Alloc', 'Booked', 'Util%', 'Alloc', 'Booked', 'Util%', 'Alloc', 'Booked', 'Util%', 'Alloc', 'Booked', 'Util%', 'Alloc', 'Booked', 'Util%'].map((h, i) => (
                          <th key={i} className={`w-[80px] px-2 py-4 text-center border-b border-r border-white/[0.05] text-[9px] font-black text-slate-400 uppercase tracking-widest ${i % 3 === 2 ? 'bg-white/[0.05] w-[100px]' : 'bg-black/20'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {reactiveContractUtilData.map((row, i) => (
                        <tr key={i} className="hover:bg-white/[0.04] transition-all duration-300 group">
                          <td className="p-8  text-sm font-black text-slate-200 border-r border-white/5 sticky left-0 z-20 bg-[#0b0f19] shadow-[4px_0_10px_rgba(0,0,0,0.3)]">{row.id}</td>
                          <td className="p-8 text-sm text-white border-r border-white/5 font-bold sticky left-[320px] z-20 bg-[#0b0f19] shadow-[4px_0_10px_rgba(0,0,0,0.3)]">{row.carrier}</td>
                          <td className="p-8 text-center border-r border-white/5 bg-[#0b0f19]"><span className="text-xs px-3 py-1.5 bg-slate-800 rounded-lg font-black text-slate-400  tracking-tighter border border-white/5">{row.lane}</span></td>
                          {[row.syd, row.mel, row.bne, row.per, row.adl].map((b, bi) => {
                            const util = b.alloc > 0 ? (b.booked / b.alloc) * 100 : 0;
                            const utilColor = util <= 0 ? 'text-slate-600' : getUtilColor(util, 'text');
                            return (
                              <React.Fragment key={bi}>
                                <td className="px-2 py-8 text-center  text-xs text-slate-400 border-r border-white/5">{b.alloc}</td>
                                <td className={`px-2 py-8 text-center  text-sm font-black border-r border-white/5 ${util > 100 ? 'text-rose-400' : 'text-slate-200'}`}>{b.booked.toFixed(1)}</td>
                                <td className={`px-2 py-8 text-center border-r border-white/5  text-sm font-black ${utilColor} bg-white/[0.02]`}>{util.toFixed(0)}%</td>
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

      {/* Fullscreen Branch Heat Map Modal */}
      <AnimatePresence>
        {isHeatmapModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 md:p-10">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHeatmapModalOpen(false)}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-2xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 40 }}
              className="relative w-full max-w-5xl h-[85vh] bg-[#0b0e14] border border-white/10 shadow-[0_60px_120px_rgba(0,0,0,1)] rounded-[40px] overflow-hidden z-20 flex flex-col"
            >
              {/* Header */}
              <div className="p-8 md:p-10 border-b border-violet-500/20 bg-gradient-to-r from-violet-950/20 to-transparent flex justify-between items-center bg-black/40">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-violet-400 animate-pulse" />
                    <h3 className="text-3xl md:text-4xl font-display font-light text-white">Branch <span className="font-bold text-violet-400">Heat Map</span></h3>
                  </div>
                  <p className="text-xs text-slate-300 uppercase tracking-widest font-black ml-5">Per-branch booked vs alloc capacity across carriers | LIVE</p>
                </div>
                <button
                  onClick={() => setIsHeatmapModalOpen(false)}
                  className="w-14 h-14 bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/50 rounded-2xl flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-2xl cursor-pointer"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto elegant-scrollbar force-scrollbar p-8 md:p-10 bg-[#050505]/40 flex flex-col gap-6">
                {/* Legend Bar */}
                <div className="flex items-center gap-6 px-6 py-4 shrink-0">
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-widest shrink-0">Utilisation Legend:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-5 rounded-md shadow-md" style={{ backgroundColor: 'rgba(153, 27, 27, 0.8)' }} />
                    <span className="text-sm text-slate-200 font-semibold">Critical ≤50%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-5 rounded-md shadow-md" style={{ backgroundColor: 'rgba(244, 63, 94, 0.7)' }} />
                    <span className="text-sm text-slate-200 font-semibold">Low ≤80%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-5 rounded-md shadow-md" style={{ backgroundColor: 'rgba(52, 211, 153, 0.6)' }} />
                    <span className="text-sm text-slate-200 font-semibold">Healthy &gt;80%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-5 rounded-md shadow-md" style={{ backgroundColor: 'rgba(34, 211, 238, 0.7)' }} />
                    <span className="text-sm text-slate-200 font-semibold">Over &gt;100%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-5 rounded-md border border-white/10 shadow-md" style={{ backgroundColor: 'rgba(30, 41, 59, 0.6)' }} />
                    <span className="text-sm text-slate-500 font-semibold">No Allocation</span>
                  </div>
                </div>

                <div className="bg-[#0b0f19] border border-white/5 rounded-[30px] p-6 shadow-2xl overflow-auto max-h-[calc(85vh-280px)]">
                  {/* Column headers */}
                  <div className="grid grid-cols-6 gap-2 mb-4 px-2 sticky top-0 z-10 bg-[#0b0f19] py-3 rounded-t-xl" style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}>
                    <div className="text-xs text-slate-400 font-bold uppercase col-span-1 tracking-wider">Contract ID</div>
                    {['SYDNEY (SYD)', 'MELBOURNE (MEL)', 'BRISBANE (BNE)', 'PERTH (PER)', 'ADELAIDE (ADL)'].map(b => (
                      <div key={b} className="text-xs text-slate-300 font-bold uppercase text-center tracking-wider">{b}</div>
                    ))}
                  </div>

                  {/* Matrix Rows */}
                  <div className="flex flex-col gap-2.5">
                    {reactiveContractUtilData.map((row) => {
                      const branches = [
                        { b: row.syd, name: 'SYD' }, { b: row.mel, name: 'MEL' },
                        { b: row.bne, name: 'BNE' }, { b: row.per, name: 'PER' },
                        { b: row.adl, name: 'ADL' },
                      ];
                      return (
                        <div key={row.id} className="grid grid-cols-6 gap-2 items-center group/heat hover:bg-white/[0.03] rounded-2xl px-2 py-1.5 transition-colors border border-white/[0.02] hover:border-white/5">
                          <span className="text-xs text-slate-300  font-bold truncate col-span-1">{row.id}</span>
                          {branches.map(({ b, name }) => {
                            const pct = b.alloc > 0 ? (b.booked / b.alloc) * 100 : 0;
                            const col = pct <= 0 ? 'bg-slate-800/60' : pct <= 50 ? 'bg-rose-700/80' : pct <= 80 ? 'bg-rose-500/70' : pct <= 100 ? 'bg-emerald-400/60' : 'bg-cyan-400/70';
                            return (
                              <div key={name} title={`${name}: ${b.booked}/${b.alloc} TEU (${pct.toFixed(0)}%)`}
                                className={`h-12 rounded-xl ${col} flex flex-col items-center justify-center transition-all group-hover/heat:scale-[1.02] shadow-inner`}>
                                <span className="text-xs font-black text-white">{pct > 0 ? `${pct.toFixed(0)}%` : '-'}</span>
                                {pct > 0 && <span className="text-[9px] text-white/50  font-bold mt-0.5">{b.booked.toFixed(0)}/{b.alloc.toFixed(0)}</span>}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 px-4 py-5 rounded-2xl bg-white/[0.02] border border-white/5 justify-center">
                  {[
                    ['bg-slate-800/60', 'Critical ≤0% (Empty State)'],
                    ['bg-rose-700/80', 'Critical ≤50% (High Risk)'],
                    ['bg-rose-500/70', 'Underperforming ≤80%'],
                    ['bg-emerald-400/60', 'Healthy >80% (Optimized)'],
                    ['bg-cyan-400/70', 'Overutilised >100% (Ceiling Peak)']
                  ].map(([col, lbl]) => (
                    <div key={lbl} className="flex items-center gap-2.5">
                      <div className={`w-4 h-4 rounded-md ${col} shadow-inner`} />
                      <span className="text-xs text-slate-300 uppercase font-black tracking-wide">{lbl}</span>
                    </div>
                  ))}
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
