import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import CompassLogo from '../components/CompassLogo';
import HUD from '../components/HUD';

/* ─── SVG Icons ──────────────────────────────────────────────────────────── */

const ContractIcon = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full relative z-10 drop-shadow-[0_0_15px_rgba(103,232,249,0.5)]">
    <rect x="12" y="6" width="34" height="46" rx="4" fill="rgba(6,182,212,0.1)" stroke="#67e8f9" strokeWidth="2" />
    <line x1="20" y1="17" x2="38" y2="17" stroke="#67e8f9" strokeWidth="2" strokeLinecap="round" />
    <line x1="20" y1="24" x2="38" y2="24" stroke="#67e8f9" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
    <line x1="20" y1="31" x2="32" y2="31" stroke="#67e8f9" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
    <circle cx="36" cy="42" r="8" fill="#030712" stroke="#67e8f9" strokeWidth="2" />
    <path d="M32 42l2.5 2.5 4.5-5" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ProcurementIcon = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full relative z-10 drop-shadow-[0_0_15px_rgba(192,132,252,0.5)]">
    <path d="M32 6l22 12.7v25.6L32 57 10 44.3V18.7L32 6z" fill="rgba(168,85,247,0.1)" stroke="#c084fc" strokeWidth="2" />
    <path d="M32 16l13 7.5v15L32 46 19 38.5v-15L32 16z" fill="rgba(168,85,247,0.2)" stroke="#c084fc" strokeWidth="1" opacity="0.8" />
    <circle cx="32" cy="32" r="5" fill="#c084fc" />
    <circle cx="32" cy="32" r="2" fill="#fff" />
  </svg>
);

/* ─── Corner Marks ───────────────────────────────────────────────────────── */

const CornerMarks: React.FC<{ color: string; visible: boolean }> = ({ color, visible }) => {
  const op = visible ? 1 : 0.2;
  const t = 'opacity 0.4s ease';
  const s = 1.5;
  return (
    <>
      {/* Top-left */}
      <svg style={{ position: 'absolute', top: 10, left: 10, zIndex: 20, opacity: op, transition: t }} width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M14 1 L1 1 L1 14" stroke={color} strokeWidth={s} strokeLinecap="round" />
      </svg>
      {/* Top-right */}
      <svg style={{ position: 'absolute', top: 10, right: 10, zIndex: 20, opacity: op, transition: t }} width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M0 1 L13 1 L13 14" stroke={color} strokeWidth={s} strokeLinecap="round" />
      </svg>
      {/* Bottom-right */}
      <svg style={{ position: 'absolute', bottom: 10, right: 10, zIndex: 20, opacity: op, transition: t }} width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M13 0 L13 13 L0 13" stroke={color} strokeWidth={s} strokeLinecap="round" />
      </svg>
      {/* Bottom-left */}
      <svg style={{ position: 'absolute', bottom: 10, left: 10, zIndex: 20, opacity: op, transition: t }} width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M1 0 L1 13 L14 13" stroke={color} strokeWidth={s} strokeLinecap="round" />
      </svg>
    </>
  );
};

/* ─── Accent Config ──────────────────────────────────────────────────────── */

const ACCENT = {
  cyan: {
    text: '#67e8f9',
    glow: 'rgba(6,182,212,0.45)',
    glowHover: 'rgba(6,182,212,0.85)',
    badge: 'rgba(6,182,212,0.08)',
    badgeBorder: 'rgba(6,182,212,0.28)',
    dot: '#22d3ee',
    conic: '#06b6d4',
    topGlow: 'rgba(6,182,212,0.14)',
    shimmer: 'rgba(6,182,212,0.22)',
  },
  purple: {
    text: '#c084fc',
    glow: 'rgba(168,85,247,0.45)',
    glowHover: 'rgba(168,85,247,0.85)',
    badge: 'rgba(168,85,247,0.08)',
    badgeBorder: 'rgba(168,85,247,0.28)',
    dot: '#a855f7',
    conic: '#a855f7',
    topGlow: 'rgba(168,85,247,0.14)',
    shimmer: 'rgba(168,85,247,0.22)',
  },
};

const CARDS = [
  {
    id: 'contract',
    title: 'Contractual Nav-Charts',
    subtitle: 'VESSEL_REGISTRY // 01',
    route: '/contract',
    accent: 'cyan' as const,
    icon: <ContractIcon />,
    stats: ['142 Active Vessels', '97.3% Fleet SLA'],
  },
  {
    id: 'procurement',
    title: 'Procurement Log-Book',
    subtitle: 'SUPPLY_MANIFEST // 02',
    route: '/procurement',
    accent: 'purple' as const,
    icon: <ProcurementIcon />,
    stats: ['89 Active Charters', '$78.2M Allocated'],
  },
];

/* ─── Quantum Vortex Background ─────────────────────────────────────────── */

const QuantumVortex = () => (
  <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
    {/* Nebula Layers */}
    <div
      className="quantum-nebula"
      style={{
        background: 'radial-gradient(circle at 30% 20%, rgba(6,182,212,0.15) 0%, transparent 50%)',
        animation: 'nebula-float 25s infinite ease-in-out alternate'
      }}
    />
    <div
      className="quantum-nebula"
      style={{
        background: 'radial-gradient(circle at 70% 80%, rgba(168,85,247,0.15) 0%, transparent 50%)',
        animation: 'nebula-float 30s infinite ease-in-out alternate-reverse'
      }}
    />

    {/* Mercator Navigation Grid */}
    <div className="absolute inset-0 opacity-[0.07]">
      <div
        className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.3)_1px,transparent_1px)] bg-[size:100px_100px]"
        style={{
          transform: 'perspective(1000px) rotateX(45deg) translateY(0px)',
          maskImage: 'radial-gradient(circle at center, black 30%, transparent 80%)',
          animation: 'grid-drift 20s linear infinite'
        }}
      />
      {/* Rhumb Lines (Diagonal navigation lines) */}
      <div
        className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_200px,rgba(34,211,238,0.1)_201px,rgba(34,211,238,0.1)_202px)]"
        style={{ opacity: 0.5 }}
      />
      <div
        className="absolute inset-0 bg-[repeating-linear-gradient(-45deg,transparent,transparent_200px,rgba(168,85,247,0.1)_201px,rgba(168,85,247,0.1)_202px)]"
        style={{ opacity: 0.5 }}
      />
    </div>

    {/* Center Glow */}
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 blur-[120px] rounded-full" />
  </div>
);

/* ─── Targeting Reticle Component ────────────────────────────────────────── */

const TargetingReticle = ({ active }: { active: boolean }) => (
  <motion.div
    animate={{ opacity: active ? 0.15 : 1, scale: active ? 0.95 : 1 }}
    transition={{ duration: 1.2, ease: "easeInOut" }}
    className="absolute inset-0 flex items-center justify-center pointer-events-none z-0"
  >
    <div className="relative w-96 h-96 scale-150">

      {/* ── Outer ring: cyan, breathes scale + opacity, color fades to bg ── */}
      <motion.div
        className="absolute inset-0 rounded-full"
        animate={{
          rotate: 360,
          scale: [1, 1.06, 1],
          opacity: [0.45, 0.75, 0.45],
        }}
        transition={{
          rotate: { duration: 40, repeat: Infinity, ease: 'linear' },
          scale: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
          opacity: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
        }}
        style={{
          border: '1px dashed rgba(34,211,238,0.7)',
          /* soft glow that bleeds outward and inward */
          boxShadow: `
            0 0 6px 2px rgba(6,182,212,0.35),
            0 0 18px 6px rgba(6,182,212,0.12),
            0 0 40px 12px rgba(6,182,212,0.05),
            inset 0 0 6px 2px rgba(6,182,212,0.18)
          `,
        }}
      />

      {/* ── Blue aura that breathes outward from outer ring ── */}
      <motion.div
        className="absolute rounded-full"
        animate={{
          scale: [1, 1.08, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          inset: '-12px',
          background: 'radial-gradient(circle, transparent 42%, rgba(6,182,212,0.22) 50%, rgba(6,182,212,0.06) 65%, transparent 80%)',
          filter: 'blur(10px)',
        }}
      />

      {/* ── Mid ring: purple, breathes slower, offset phase ── */}
      <motion.div
        className="absolute inset-8 rounded-full"
        animate={{
          rotate: -360,
          scale: [1, 1.07, 1],
          opacity: [0.35, 0.65, 0.35],
        }}
        transition={{
          rotate: { duration: 25, repeat: Infinity, ease: 'linear' },
          scale: { duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1.5 },
          opacity: { duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1.5 },
        }}
        style={{
          border: '1.5px dashed rgba(168,85,247,0.6)',
          boxShadow: `
            0 0 6px 2px rgba(168,85,247,0.3),
            0 0 18px 6px rgba(168,85,247,0.1),
            0 0 40px 12px rgba(168,85,247,0.04),
            inset 0 0 6px 2px rgba(168,85,247,0.15)
          `,
        }}
      />

      {/* ── Purple aura that breathes outward from mid ring ── */}
      <motion.div
        className="absolute rounded-full"
        animate={{
          scale: [1, 1.09, 1],
          opacity: [0.2, 0.5, 0.2],
        }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
        style={{
          inset: '16px',
          background: 'radial-gradient(circle, transparent 35%, rgba(168,85,247,0.2) 46%, rgba(168,85,247,0.06) 62%, transparent 80%)',
          filter: 'blur(12px)',
        }}
      />

      {/* ── Inner tick ring ── */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
        className="absolute inset-16 flex items-center justify-center"
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-3 rounded-full"
            style={{
              background: 'rgba(34,211,238,0.5)',
              boxShadow: '0 0 6px rgba(6,182,212,0.7)',
              transform: `rotate(${i * 30}deg) translateY(-140px)`,
            }}
          />
        ))}
      </motion.div>

      {/* ── Cardinal Directions ── */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {['N', 'E', 'S', 'W'].map((dir, i) => (
          <div
            key={dir}
            className="absolute font-mono text-[10px] tracking-tighter text-cyan-400 opacity-60"
            style={{
              transform: `rotate(${i * 90}deg) translateY(-175px) rotate(-${i * 90}deg)`,
              textShadow: '0 0 5px rgba(34,211,238,0.5)'
            }}
          >
            {dir}
          </div>
        ))}
      </div>
    </div>
  </motion.div>
);


/* ─── Premium Dashboard Card ────────────────────────────────────────────────── */

interface PremiumCardProps {
  card: typeof CARDS[0];
  index: number;
}

const PremiumCard: React.FC<PremiumCardProps> = ({ card, index }) => {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const ac = ACCENT[card.accent];

  const [hovered, setHovered] = useState(false);
  const [mouse, setMouse] = useState<{ x: number; y: number }>({ x: 50, y: 50 });

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 200, damping: 20, mass: 0.5 });
  const sy = useSpring(my, { stiffness: 200, damping: 20, mass: 0.5 });
  const rotateX = useTransform(sy, [-0.5, 0.5], [10, -10]);
  const rotateY = useTransform(sx, [-0.5, 0.5], [-10, 10]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    mx.set(nx);
    my.set(ny);
    setMouse({
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    });
  };

  const handleMouseLeave = () => {
    mx.set(0); my.set(0);
    setMouse({ x: 50, y: 50 });
    setHovered(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, delay: index * 0.2 + 1.2, ease: [0.16, 1, 0.3, 1] }}
      style={{ perspective: '1200px' }}
      className="w-full flex justify-center"
    >
      <motion.div
        ref={ref}
        className="relative rounded-[24px] select-none w-full max-w-[420px] overflow-hidden border border-white/5"
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
        }}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={handleMouseLeave}
        onClick={() => navigate(card.route)}
        whileHover={{
          scale: 1.03,
          boxShadow: `0 40px 100px -20px rgba(0,0,0,0.8), 0 0 80px ${ac.glow}`,
          borderColor: ac.text
        }}
        whileTap={{ scale: 0.98 }}
        transition={{
          type: "spring",
          stiffness: 150,
          damping: 25,
          mass: 0.8,
          boxShadow: { duration: 0.5 },
          borderColor: { duration: 0.5 }
        }}
      >
        {/* Quantum Glass Background */}
        <div className="absolute inset-0 quantum-glass pointer-events-none" />

        {/* Shimmer Effect */}
        <motion.div className="absolute inset-0 pointer-events-none"
          animate={{
            background: `radial-gradient(circle at ${mouse.x}% ${mouse.y}%, rgba(255,255,255,0.08) 0%, transparent 75%)`,
            opacity: hovered ? 1 : 0,
          }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />

        <CornerMarks color={ac.text} visible={hovered} />

        <div className="relative z-10 p-10 flex flex-col items-center text-center">
          {/* Dashboard Icon */}
          <div className="relative mb-8">
            <motion.div
              animate={hovered ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-20 h-20 rounded-2xl flex items-center justify-center quantum-glass relative z-10"
              style={{
                borderColor: ac.badgeBorder,
                background: `linear-gradient(145deg, ${ac.topGlow}, rgba(0,0,0,0.4))`
              }}
            >
              <div className="w-12 h-12">{card.icon}</div>
            </motion.div>
            <div className={`absolute inset-[-10px] blur-2xl opacity-20 rounded-full bg-[${ac.text}]`} />
          </div>

          <span className="text-[10px] font-black tracking-[0.4em] uppercase mb-4 block opacity-60" style={{ color: ac.text }}>
            {card.subtitle}
          </span>

          <h2
            className="text-2xl font-bold text-white uppercase tracking-widest mb-8"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {card.title}
          </h2>

          <div className="flex flex-col gap-3 w-full">
            {card.stats.map((s) => (
              <div
                key={s}
                className="flex items-center justify-between px-5 py-3 rounded-xl quantum-glass text-[11px] font-bold tracking-widest"
                style={{ borderColor: 'rgba(255,255,255,0.05)', fontFamily: "'JetBrains Mono', monospace" }}
              >
                <span className="text-slate-400">{s.split(' ')[1]} {s.split(' ')[2] || ''}</span>
                <span style={{ color: ac.text }}>{s.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ─── Boot Sequence ──────────────────────────────────────────────────────── */

const BootSequence: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const lines = [
    "CHART_PLOTTING_INITIALIZED",
    "> SYNCHRONIZING_NAUTICAL_CHART...",
    "> DECRYPTING_VOYAGE_MATRIX...",
    "> SCANNING_FLEET_TELEMETRY...",
    "> SUCCESS: ADMIRAL_ACCESS_CONFIRMED",
    "BRIDGE_TERMINAL_ONLINE"
  ];
  const [visibleLine, setVisibleLine] = useState(0);

  useEffect(() => {
    let i = 0;
    const iv = setInterval(() => {
      i++;
      if (i >= lines.length) {
        clearInterval(iv);
        setTimeout(onComplete, 600);
      } else {
        setVisibleLine(i);
      }
    }, 150);
    return () => clearInterval(iv);
  }, [onComplete, lines.length]);

  return (
    <motion.div
      exit={{ opacity: 0, filter: 'blur(20px)', scale: 1.05 }}
      transition={{ duration: 0.8 }}
      className="fixed inset-0 z-[100] bg-[#02050A] flex flex-col justify-center px-32"
    >
      <div className="flex flex-col gap-3 font-mono text-[14px] tracking-[0.3em] text-cyan-400">
        {lines.slice(0, visibleLine + 1).map((line, idx) => (
          <motion.div key={idx} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-4">
            <span className="opacity-40">[{idx.toString().padStart(2, '0')}]</span>
            <span className={idx === visibleLine ? 'text-glitch' : ''}>{line}</span>
          </motion.div>
        ))}
      </div>
      <div className="absolute bottom-24 left-32 right-32 h-1 bg-white/5 overflow-hidden rounded-full">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(visibleLine / (lines.length - 1)) * 100}%` }}
          className="h-full bg-cyan-400 shadow-[0_0_20px_0_rgba(34,211,238,0.8)]"
        />
      </div>
    </motion.div>
  );
};

/* ─── Home Page ──────────────────────────────────────────────────────────── */

const Home: React.FC = () => {
  const [booted, setBooted] = useState(false);
  const [logoHovered, setLogoHovered] = useState(false);
  const [showCards, setShowCards] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleGlobalMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX / 0.67, y: e.clientY / 0.67 });
  };

  const handleLogoClick = () => {
    setShowCards(prev => !prev);
  };

  return (
    <div style={{ width: '100%', height: '100vh', overflow: 'hidden', backgroundColor: '#020308' }}>
      <div style={{
        width: '149.2537%',
        height: '149.2537vh',
        transform: 'scale(0.67)',
        transformOrigin: 'top left',
        position: 'relative'
      }}>
        <div
          className="flex flex-col relative overflow-hidden bg-[#020308] cursor-none w-full"
          style={{ height: '149.2537vh' }}
          onMouseMove={handleGlobalMouseMove}
        >
          <AnimatePresence>
            {!booted && <BootSequence onComplete={() => setBooted(true)} />}
          </AnimatePresence>

          {/* Atmospheric VFX */}
          <QuantumVortex />
          <HUD mousePos={mousePos} />

          {/* Background Hero Text / Hallmark */}
          <div className="absolute top-1/2 left-[48%] -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none z-0 select-none w-screen overflow-visible">
            {/* Base Layer */}
            <motion.h1
              animate={{ opacity: logoHovered ? 0.05 : 0.03 }}
              className="font-display font-black text-[21vw] leading-none tracking-tighter mix-blend-overlay bg-gradient-to-r from-cyan-500 to-purple-600 bg-clip-text text-transparent whitespace-nowrap"
            >
              COMPASS
            </motion.h1>

            {/* Glow Sweep Layer (Outline Beam) */}
            <motion.h1
              initial={{ maskPosition: "-100% 0%", opacity: 0 }}
              animate={{
                maskPosition: logoHovered ? "200% 0%" : "-100% 0%",
                opacity: logoHovered ? 0.6 : 0
              }}
              transition={{
                duration: 1.8,
                ease: "easeInOut",
                delay: logoHovered ? 0 : 0.1
              }}
              className="absolute inset-0 font-display font-black text-[21vw] leading-none tracking-tighter mix-blend-overlay text-transparent whitespace-nowrap"
              style={{
                WebkitTextStroke: '1px #22d3ee',
                textShadow: '0 0 10px rgba(34, 211, 238, 0.8), 0 0 20px rgba(34, 211, 238, 0.4)',
                maskImage: 'linear-gradient(90deg, transparent, white 20%, white 80%, transparent)',
                WebkitMaskImage: 'linear-gradient(90deg, transparent, white 20%, white 80%, transparent)',
                maskSize: '40% 100%',
                WebkitMaskSize: '40% 100%',
                maskRepeat: 'no-repeat',
                WebkitMaskRepeat: 'no-repeat'
              }}
            >
              COMPASS
            </motion.h1>
          </div>

          {/* Top Center System Terminal Hint */}
          <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-xl z-[100] px-10 pt-8 pointer-events-none">
            <AnimatePresence mode="wait">
              {booted && (
                <motion.div
                  key={showCards ? 'active' : 'idle'}
                  initial={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -10, filter: 'blur(5px)' }}
                  className="flex flex-col items-center gap-2"
                >
                  <div className="flex items-center justify-center px-8 py-3 rounded-full quantum-glass border border-cyan-500/20 shadow-[0_0_25px_rgba(6,182,212,0.15)] backdrop-blur-md">
                    <motion.div
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="w-1.5 h-1.5 rounded-full bg-cyan-400 mr-4 shadow-[0_0_8px_cyan]"
                    />
                    <span
                      className="text-[13px] font-bold tracking-[0.4em] text-white whitespace-nowrap uppercase"
                      style={{ fontFamily: "'Outfit', sans-serif" }}
                    >
                      {showCards
                        ? "NAUTICAL_MAP_ENGAGED // ACCESS_GRANTED"
                        : "CLICK ON THE LOGO TO GET STARTED"
                      }
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <main className={`flex-1 flex flex-col items-center justify-center w-full px-6 pt-8 pb-16 relative z-10 ${booted ? 'flex' : 'hidden'}`}>

            {/* Central HUD Area */}
            <div className="relative w-full max-w-[1200px] h-[600px] flex items-center justify-center">

              {/* Logo Section (Centered) */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
                className="relative z-20 scale-110"
              >
                <TargetingReticle active={showCards} />

                {/* Logo Click Ripple Effect */}
                <AnimatePresence>
                  {showCards && (
                    <motion.div
                      initial={{ scale: 0, opacity: 1 }}
                      animate={{ scale: 3, opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="absolute inset-0 rounded-full border-2 border-cyan-500/50 blur-sm pointer-events-none z-0"
                    />
                  )}
                </AnimatePresence>

                <div className="relative z-10 p-6">
                  <CompassLogo onHoverChange={setLogoHovered} onClick={handleLogoClick} />
                </div>
              </motion.div>

              {/* Diagonal Dashboard Cards */}
              <AnimatePresence mode="popLayout">
                {showCards && CARDS.map((card, i) => {
                  const isLeft = i === 0;
                  return (
                    <motion.div
                      key={card.id}
                      initial={{
                        opacity: 0,
                        rotateX: 95,
                        rotateY: isLeft ? 20 : -20,
                        x: 0,
                        y: 0,
                        scale: 0,
                        z: -500,
                        filter: 'blur(20px)'
                      }}
                      animate={{
                        opacity: 1,
                        rotateX: 0,
                        rotateY: 0,
                        x: isLeft ? -380 : 380,
                        y: 180,
                        scale: 1,
                        z: 0,
                        filter: 'blur(0px)'
                      }}
                      exit={{
                        opacity: 0,
                        rotateX: -45,
                        x: 0,
                        y: 0,
                        scale: 0,
                        z: -200,
                        filter: 'blur(20px)'
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 110,
                        damping: 20,
                        delay: i * 0.1,
                        opacity: { duration: 0.5 }
                      }}
                      className="absolute z-10 w-[420px] style-3d"
                    >
                      <PremiumCard card={card} index={i} />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2, duration: 1 }}
              className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-6 text-slate-600 font-mono text-[10px] tracking-[0.4em] uppercase"
            >
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                {showCards ? 'SYSTEM_ACTIVE' : 'SYSTEM_WAITING'}
              </div>
              <div className="w-[1px] h-3 bg-slate-800" />
              {showCards ? 'MODULES_LOADED' : 'MODULES_STAGED'}
              <div className="w-[1px] h-3 bg-slate-800" />
              SESSION_READY
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default Home;
