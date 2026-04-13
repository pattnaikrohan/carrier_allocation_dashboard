import React, { useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";

interface CompassLogoProps {
  onHoverChange?: (hovered: boolean) => void;
  onClick?: () => void;
}

const CompassLogo: React.FC<CompassLogoProps> = ({ onHoverChange, onClick }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  // =============================
  // MOUSE TRACKING
  // =============================
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const smoothX = useSpring(mouseX, { stiffness: 80, damping: 20 });
  const smoothY = useSpring(mouseY, { stiffness: 80, damping: 20 });

  // =============================
  // 3D TILT (more subtle + premium)
  // =============================
  const rotateX = useTransform(smoothY, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(smoothX, [-0.5, 0.5], ["-10deg", "10deg"]);

  // =============================
  // DISC ROTATION (controlled)
  // =============================
  const discRotation = useTransform(
    [smoothX, smoothY],
    ([x, y]) => x * 40 + y * -40 // reduced for realism
  );

  // =============================
  // NEEDLE (magnetic feel)
  // =============================
  const needleTarget = useTransform(discRotation, (r) => -r);

  const needleRotation = useSpring(needleTarget, {
    stiffness: 60,
    damping: 14,
    mass: 1.4, // heavier = more realistic
  });

  // =============================
  // EVENTS
  // =============================
  const handleMove = (e: React.MouseEvent) => {
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();

    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseEnter = () => {
    setHovered(true);
    onHoverChange?.(true);
  };

  const reset = () => {
    setHovered(false);
    onHoverChange?.(false);
    mouseX.set(0);
    mouseY.set(0);
  };

  // =============================
  // RENDER
  // =============================
  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={reset}
      onClick={onClick}
      style={{ 
        perspective: 1400
      }}
      className="flex items-center justify-center transition-all duration-300 active:scale-95"
    >
      <motion.div
        style={{
          rotateX,
          rotateY,
        }}
        animate={{
          scale: hovered ? 1.12 : 1,
        }}
        transition={{ type: "spring", stiffness: 180, damping: 18 }}
      >
        {/* 👇 Increased size */}
        <div style={{ width: 520 }}>
          <svg viewBox="0 0 680 520" width="100%">

            {/* ===================== */}
            {/* ROTATING DISC */}
            {/* ===================== */}
            <motion.g
              style={{
                rotate: discRotation,
                transformOrigin: "340px 210px",
              }}
            >
              <circle cx="340" cy="210" r="155" fill="none" stroke="#BABCBE" strokeWidth="0.75" strokeDasharray="2 8" opacity="0.35" />
              <circle cx="340" cy="210" r="132" fill="#00365C" />

              <line x1="212" y1="210" x2="468" y2="210" stroke="#0060A9" opacity="0.15" />
              <line x1="340" y1="82" x2="340" y2="338" stroke="#0060A9" opacity="0.15" />
              <circle cx="340" cy="210" r="80" fill="none" stroke="#0060A9" opacity="0.12" />

              <line x1="340" y1="78" x2="340" y2="96" stroke="#BABCBE" strokeWidth="2.5" />
              <line x1="340" y1="342" x2="340" y2="324" stroke="#BABCBE" strokeWidth="2.5" />
              <line x1="472" y1="210" x2="454" y2="210" stroke="#BABCBE" strokeWidth="2.5" />
              <line x1="208" y1="210" x2="226" y2="210" stroke="#BABCBE" strokeWidth="2.5" />

              <text x="340" y="70" textAnchor="middle" fill="#EC1C24" fontWeight="700">N</text>
              <text x="340" y="358" textAnchor="middle" fill="#BABCBE" opacity="0.6">S</text>
              <text x="486" y="214" textAnchor="middle" fill="#BABCBE" opacity="0.6">E</text>
              <text x="194" y="214" textAnchor="middle" fill="#BABCBE" opacity="0.6">W</text>
            </motion.g>

            {/* ===================== */}
            {/* NEEDLE */}
            {/* ===================== */}
            <g transform="translate(340,210)">
              <motion.g style={{ rotate: needleRotation }}>
                <path d="M4 4 L-6 16 L4 98 L14 16 Z" fill="black" opacity="0.15" />
              </motion.g>

              <motion.g style={{ rotate: needleRotation }}>
                <path d="M0 0 L-10 12 L0 94 L10 12 Z" fill="#BABCBE" opacity="0.7" />
                <path d="M0 0 L-14 -14 L0 -128 L14 -14 Z" fill="#EC1C24" />
              </motion.g>
            </g>

            {/* Rings */}
            <circle cx="340" cy="210" r="132" fill="none" stroke="#0060A9" strokeWidth="7" />
            <path d="M254 133 A132 132 0 0 1 426 133" fill="none" stroke="#0060A9" strokeWidth="7" opacity="0.6" />

            {/* Center */}
            <circle cx="340" cy="210" r="18" fill="#0060A9" />
            <circle cx="340" cy="210" r="11" fill="#00365C" />
            <circle cx="340" cy="210" r="5" fill="#EC1C24" />

            <defs>
              <filter id="textGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur" />
                <feOffset in="blur" dx="0" dy="0" result="offsetBlur" />
                <feFlood floodColor="#22d3ee" floodOpacity="0.8" result="color" />
                <feComposite in="color" in2="offsetBlur" operator="in" result="glow" />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <linearGradient id="compassHighlight" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#22d3ee" />
                <motion.stop
                  animate={{ offset: hovered ? "100%" : "0%" }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
                  stopColor="#22d3ee"
                />
                <motion.stop
                  animate={{ offset: hovered ? "100%" : "0%" }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
                  stopColor="#00365C"
                />
                <stop offset="100%" stopColor="#00365C" />
              </linearGradient>
            </defs>

            {/* Text */}
            <text x="340" y="400" textAnchor="middle" fill="#BABCBE">THE</text>
            <motion.text
              x="344" y="450"
              textAnchor="middle"
              fill="url(#compassHighlight)"
              fontSize="42"
              fontWeight="600"
              style={{
                letterSpacing: '0.1em',
                filter: hovered ? 'url(#textGlow)' : 'none'
              }}
              animate={{
                stroke: hovered ? 'rgba(34, 211, 238, 0.4)' : 'rgba(34, 211, 238, 0)',
                strokeWidth: 1
              }}
              transition={{ duration: 0.4 }}
            >
              COMPASS
            </motion.text>
            <text x="340" y="482" textAnchor="middle" fill="#BABCBE" fontSize="10">
              CARRIER CONTRACTS & ALLOCATION
            </text>
          </svg>
        </div>
      </motion.div>
    </div>
  );
};

export default CompassLogo;