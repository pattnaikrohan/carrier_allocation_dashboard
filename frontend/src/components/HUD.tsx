import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const HUD: React.FC<{ mousePos: { x: number; y: number } }> = ({ mousePos }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const toDMS = (coord: number, isLat: boolean) => {
    const abs = Math.abs(coord);
    const d = Math.floor(abs / 10);
    const m = Math.floor((abs % 10) * 6);
    const s = Math.floor(((abs % 10) * 6 % 1) * 60);
    const dir = isLat ? (coord >= 0 ? 'N' : 'S') : (coord >= 0 ? 'E' : 'W');
    return `${d}° ${m}' ${s}" ${dir}`;
  };

  return (
    <div
      className="fixed inset-0 pointer-events-none z-50 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-500/60 overflow-hidden"
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >

      {/* Mouse Crosshair HUD */}
      <motion.div
        className="absolute w-12 h-12 flex items-center justify-center"
        animate={{ x: mousePos.x - 24, y: mousePos.y - 24 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300, mass: 0.5 }}
      >
        <div className="absolute inset-0 border border-cyan-500/20 rounded-full" />
        <div className="w-1 h-1 bg-cyan-400 rounded-full shadow-[0_0_8px_cyan]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-2 bg-cyan-400" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1px] h-2 bg-cyan-400" />
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-[1px] bg-cyan-400" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-[1px] bg-cyan-400" />

        <div className="absolute -right-24 -top-4 whitespace-nowrap opacity-40 leading-relaxed">
          LAT: {toDMS(mousePos.y, true)}<br />
          LNG: {toDMS(mousePos.x, false)}
        </div>
      </motion.div>

      {/* Top Left: Navigation Info */}
      <div className="absolute top-10 left-10 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 bg-cyan-500 animate-pulse shadow-[0_0_10px_cyan]" />
          <span
            className="font-black text-cyan-400 text-sm tracking-widest"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            NAVAL_BRIDGE // ADMIRAL_DECK
          </span>
        </div>
        <div className="h-[1px] w-64 bg-gradient-to-r from-cyan-500/50 to-transparent" />
        <div className="flex flex-col opacity-80 gap-0.5 text-[11px] tracking-widest">
          <span>VOYAGE: 342:15:09:22</span>
          <span>CORE: MARITIME_QUANTUM</span>
          <span className="text-cyan-400/90 font-bold">SOG: 24.5 KTS</span>
          <span className="text-cyan-400/90 font-bold">COG: 182.4° T</span>
        </div>
      </div>

      {/* Top Right: Fleet Telemetry */}
      <div className="absolute top-10 right-10 text-right flex flex-col gap-2">
        <div
          className="font-black text-cyan-400 text-base tracking-widest"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {formatTime(time)} UTC
        </div>
        <div className="h-[1px] w-64 bg-gradient-to-l from-cyan-500/50 to-transparent self-end" />
        <div className="flex flex-col opacity-80 gap-0.5 text-[11px] tracking-widest">
          <span>SATELLITE LINK: ACTIVE</span>
          <span>AIS STATE: BROADCASTING</span>
          <span>SAT_STRENGTH: 98%</span>
        </div>
      </div>

      {/* Bottom Left: Depth & Power */}
      <div className="absolute bottom-16 left-10 flex flex-col gap-3">
        <div className="flex gap-1.5 h-10 items-end">
          {Array.from({ length: 24 }).map((_, i) => (
            <motion.div
              key={i}
              className="w-1.5 bg-cyan-400/40"
              animate={{ height: [`${20 + Math.random() * 80}%`, `${10 + Math.random() * 90}%`, `${20 + Math.random() * 80}%`] }}
              transition={{ duration: 0.5 + Math.random(), repeat: Infinity }}
            />
          ))}
        </div>
        <div className="h-[1px] w-64 bg-gradient-to-r from-cyan-500/50 to-transparent" />
        <div className="flex flex-col opacity-80 gap-0.5 text-[11px] tracking-widest">
          <span className="text-cyan-400/90 font-bold">SOUNDING: 12.4 FATHOMS</span>
          <span>TRIM: [|||||||||| ] +0.4°</span>
          <span>FUEL: [|||       ] 32%</span>
        </div>
      </div>

      {/* Bottom Right: Status Control */}
      <div className="absolute bottom-16 right-10 text-right flex flex-col gap-2">
        <div className="flex items-center justify-end gap-3">
          <span
            className="font-black text-cyan-400 text-sm tracking-widest"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            VESSEL_OPERATIONAL
          </span>
          <div className="w-2.5 h-2.5 bg-cyan-500 animate-pulse-fast shadow-[0_0_10px_cyan]" />
        </div>
        <div className="h-[1px] w-64 bg-gradient-to-l from-cyan-500/50 to-transparent self-end" />
        <div className="flex flex-col opacity-80 gap-0.5 text-[11px] tracking-widest">
          <span>USER: FLEET_ADMIRAL</span>
          <span>ALERTS: NONE</span>
          <span>DRIFT: 0.2nm/h</span>
        </div>
      </div>

      {/* Scanning Grids */}
      <div className="absolute inset-0 pointer-events-none opacity-5 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(rgba(34,211,238,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.2)_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>
    </div>
  );
};

export default HUD;
