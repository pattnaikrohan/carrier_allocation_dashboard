import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

import { BOOKING_LOG_DATA, CONTRACT_UTIL_DATA } from '../BookingData';

/* ─── Main Component ─── */

const ContractDataExplorer: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'booking' | 'utilisation'>('booking');

  return (
    <div className="min-h-screen flex flex-col text-slate-200" style={{ background: 'linear-gradient(180deg, #0f111a 0%, #06070a 100%)' }}>
      <Navbar showBack />

      <main className="flex-1 w-full px-6 pt-32 pb-24 max-w-[100vw] overflow-hidden">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button 
            onClick={() => navigate('/contract')}
            className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors mb-4 text-sm font-medium"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-white tracking-tight mb-2">Master Data Explorer</h1>
          <p className="text-slate-400">Deep-dive raw reporting from AAW_Contract Dashboard.xlsx</p>
        </motion.div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 mb-6">
          <button
            onClick={() => setActiveTab('booking')}
            className={`pb-3 px-4 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'booking' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            Booking Log (Full Extract)
          </button>
          <button
            onClick={() => setActiveTab('utilisation')}
            className={`pb-3 px-4 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'utilisation' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            Master Utilisation Grid
          </button>
        </div>

        {/* Data Container with horizontal scroll */}
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={activeTab}
          className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl shadow-xl backdrop-blur-sm overflow-hidden"
        >
          <div className="w-full overflow-x-auto max-h-[70vh] elegant-scrollbar">
            
            {/* BOOKING LOG TABLE */}
            {activeTab === 'booking' && (
              <table className="w-max text-left border-collapse whitespace-nowrap">
                <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur shadow-sm">
                  <tr className="text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700">
                    <th className="px-4 py-3 font-semibold sticky left-0 z-20 bg-slate-900/95 border-r border-slate-700">Contract</th>
                    <th className="px-4 py-3 font-semibold sticky left-[125px] z-20 bg-slate-900/95 shadow-[4px_0_15px_-3px_rgba(0,0,0,0.5)]">Order No</th>
                    <th className="px-4 py-3 font-semibold">Est. Dep</th>
                    <th className="px-4 py-3 font-semibold">Est. Arr</th>
                    <th className="px-4 py-3 font-semibold">Dep Vessel</th>
                    <th className="px-4 py-3 font-semibold">Dep Voy</th>
                    <th className="px-4 py-3 font-semibold">Arr Vessel</th>
                    <th className="px-4 py-3 font-semibold">Arr Voy</th>
                    <th className="px-4 py-3 font-semibold">Buyer</th>
                    <th className="px-4 py-3 font-semibold">Supplier</th>
                    <th className="px-4 py-3 font-semibold">Origin</th>
                    <th className="px-4 py-3 font-semibold">Load Port</th>
                    <th className="px-4 py-3 font-semibold">Disc Port</th>
                    <th className="px-4 py-3 font-semibold">Dest</th>
                    <th className="px-4 py-3 font-semibold">HBL</th>
                    <th className="px-4 py-3 font-semibold">MBL</th>
                    <th className="px-4 py-3 font-semibold">Branch</th>
                    <th className="px-4 py-3 font-semibold text-right text-cyan-400">Tot TEU</th>
                    <th className="px-4 py-3 font-semibold text-right">Tot FEU</th>
                    <th className="px-4 py-3 font-semibold">MSC Wk</th>
                    <th className="px-4 py-3 font-semibold">Country</th>
                    <th className="px-4 py-3 font-semibold">Year</th>
                    <th className="px-4 py-3 font-semibold">QTR</th>
                    <th className="px-4 py-3 font-semibold">Region</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-sm">
                  {BOOKING_LOG_DATA.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-cyan-300 sticky left-0 z-10 bg-slate-900/50 backdrop-blur border-r border-slate-700/50">{row.contract}</td>
                      <td className="px-4 py-3 text-white font-medium sticky left-[125px] z-10 bg-slate-900/50 backdrop-blur shadow-[4px_0_15px_-3px_rgba(0,0,0,0.3)]">{row.order}</td>
                      <td className="px-4 py-3 text-slate-400 font-mono">{row.etd}</td>
                      <td className="px-4 py-3 text-slate-400 font-mono">{row.eta}</td>
                      <td className="px-4 py-3">{row.depVessel}</td>
                      <td className="px-4 py-3 text-slate-400">{row.depVoyage}</td>
                      <td className="px-4 py-3">{row.arrVessel}</td>
                      <td className="px-4 py-3 text-slate-400">{row.arrVoyage}</td>
                      <td className="px-4 py-3">{row.buyer}</td>
                      <td className="px-4 py-3">{row.supplier}</td>
                      <td className="px-4 py-3 text-slate-400 font-mono">{row.goodsOrigin}</td>
                      <td className="px-4 py-3 text-slate-400 font-mono">{row.loadPort}</td>
                      <td className="px-4 py-3 text-slate-400 font-mono">{row.dischargePort}</td>
                      <td className="px-4 py-3 text-slate-400 font-mono">{row.goodsDest}</td>
                      <td className="px-4 py-3 font-mono text-slate-300">{row.houseBill}</td>
                      <td className="px-4 py-3 font-mono text-slate-300">{row.masterBill}</td>
                      <td className="px-4 py-3">{row.branch}</td>
                      <td className="px-4 py-3 text-right font-bold text-cyan-400 bg-cyan-500/5">{row.totalTeu.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right">{row.totalFeu.toFixed(1)}</td>
                      <td className="px-4 py-3">{row.mscWeek}</td>
                      <td className="px-4 py-3 text-slate-400 font-mono">{row.country}</td>
                      <td className="px-4 py-3">{row.year}</td>
                      <td className="px-4 py-3 text-center">{row.qtr}</td>
                      <td className="px-4 py-3">{row.region}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* MASTER UTILISATION TABLE */}
            {activeTab === 'utilisation' && (
              <table className="w-max text-left border-collapse whitespace-nowrap">
                <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur shadow-sm">
                  {/* Super Headers */}
                  <tr className="border-b border-slate-700/50">
                    <th colSpan={8} className="px-4 py-2 border-r border-slate-700 text-center text-xs text-slate-500 uppercase tracking-widest bg-slate-800/30">Total Allocations</th>
                    <th colSpan={2} className="px-4 py-2 border-r border-slate-700 text-center text-xs text-indigo-400 uppercase tracking-widest bg-indigo-500/10">Sydney</th>
                    <th colSpan={2} className="px-4 py-2 border-r border-slate-700 text-center text-xs text-purple-400 uppercase tracking-widest bg-purple-500/10">Melbourne</th>
                    <th colSpan={2} className="px-4 py-2 border-r border-slate-700 text-center text-xs text-pink-400 uppercase tracking-widest bg-pink-500/10">Brisbane</th>
                    <th colSpan={2} className="px-4 py-2 border-r border-slate-700 text-center text-xs text-amber-400 uppercase tracking-widest bg-amber-500/10">Perth</th>
                    <th colSpan={2} className="px-4 py-2 text-center text-xs text-cyan-400 uppercase tracking-widest bg-cyan-500/10">Adelaide</th>
                  </tr>
                  <tr className="text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700">
                    <th className="px-4 py-3 font-semibold sticky left-0 z-20 bg-slate-900/95 border-r border-slate-700">Contract ID</th>
                    <th className="px-4 py-3 font-semibold sticky left-[150px] z-20 bg-slate-900/95 shadow-[4px_0_15px_-3px_rgba(0,0,0,0.5)]">Carrier</th>
                    <th className="px-4 py-3 font-semibold">Lane</th>
                    <th className="px-4 py-3 font-semibold text-right">Alloc</th>
                    <th className="px-4 py-3 font-semibold text-right">Booked</th>
                    <th className="px-4 py-3 font-semibold text-right">Avail</th>
                    <th className="px-4 py-3 font-semibold text-right">Util %</th>
                    <th className="px-4 py-3 font-semibold border-r border-slate-700">Status</th>
                    
                    {/* Branch Columns */}
                    <th className="px-3 py-3 font-semibold text-right bg-indigo-500/5">Alloc</th><th className="px-3 py-3 font-semibold text-right border-r border-slate-700 bg-indigo-500/5">Book</th>
                    <th className="px-3 py-3 font-semibold text-right bg-purple-500/5">Alloc</th><th className="px-3 py-3 font-semibold text-right border-r border-slate-700 bg-purple-500/5">Book</th>
                    <th className="px-3 py-3 font-semibold text-right bg-pink-500/5">Alloc</th><th className="px-3 py-3 font-semibold text-right border-r border-slate-700 bg-pink-500/5">Book</th>
                    <th className="px-3 py-3 font-semibold text-right bg-amber-500/5">Alloc</th><th className="px-3 py-3 font-semibold text-right border-r border-slate-700 bg-amber-500/5">Book</th>
                    <th className="px-3 py-3 font-semibold text-right bg-cyan-500/5">Alloc</th><th className="px-3 py-3 font-semibold text-right bg-cyan-500/5">Book</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-sm">
                  {CONTRACT_UTIL_DATA.map((row, i) => {
                    const isOver = row.util > 100;
                    return (
                    <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-cyan-300 sticky left-0 z-10 bg-slate-900/50 backdrop-blur border-r border-slate-700/50">{row.id}</td>
                      <td className="px-4 py-3 font-bold text-white sticky left-[150px] z-10 bg-slate-900/50 backdrop-blur shadow-[4px_0_15px_-3px_rgba(0,0,0,0.3)]">{row.carrier}</td>
                      <td className="px-4 py-3 text-slate-400">{row.lane}</td>
                      <td className="px-4 py-3 text-right font-mono">{row.alloc}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-200">{row.booked}</td>
                      <td className={`px-4 py-3 text-right font-mono ${row.avail < 0 ? 'text-rose-400' : 'text-slate-400'}`}>{row.avail}</td>
                      <td className={`px-4 py-3 text-right font-mono font-bold ${isOver ? 'text-rose-500 bg-rose-500/10' : 'text-emerald-400 bg-emerald-500/10'}`}>{row.util}%</td>
                      <td className="px-4 py-3 border-r border-slate-700">
                        <span className={`px-2 py-1 rounded text-xs border ${isOver ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 
                          row.status === 'Warning' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                          {row.status}
                        </span>
                      </td>

                      {/* Branch Data cells */}
                      <td className="px-3 py-3 text-right font-mono text-slate-400 bg-indigo-500/5">{row.syd.alloc}</td><td className={`px-3 py-3 text-right font-mono border-r border-slate-700/30 bg-indigo-500/5 ${row.syd.booked > row.syd.alloc ? 'text-rose-400' : 'text-slate-200'}`}>{row.syd.booked}</td>
                      <td className="px-3 py-3 text-right font-mono text-slate-400 bg-purple-500/5">{row.mel.alloc}</td><td className={`px-3 py-3 text-right font-mono border-r border-slate-700/30 bg-purple-500/5 ${row.mel.booked > row.mel.alloc ? 'text-rose-400' : 'text-slate-200'}`}>{row.mel.booked}</td>
                      <td className="px-3 py-3 text-right font-mono text-slate-400 bg-pink-500/5">{row.bne.alloc}</td><td className={`px-3 py-3 text-right font-mono border-r border-slate-700/30 bg-pink-500/5 ${row.bne.booked > row.bne.alloc ? 'text-rose-400' : 'text-slate-200'}`}>{row.bne.booked}</td>
                      <td className="px-3 py-3 text-right font-mono text-slate-400 bg-amber-500/5">{row.per.alloc}</td><td className={`px-3 py-3 text-right font-mono border-r border-slate-700/30 bg-amber-500/5 ${row.per.booked > row.per.alloc ? 'text-rose-400' : 'text-slate-200'}`}>{row.per.booked}</td>
                      <td className="px-3 py-3 text-right font-mono text-slate-400 bg-cyan-500/5">{row.adl.alloc}</td><td className={`px-3 py-3 text-right font-mono bg-cyan-500/5 ${row.adl.booked > row.adl.alloc ? 'text-rose-400' : 'text-slate-200'}`}>{row.adl.booked}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default ContractDataExplorer;
