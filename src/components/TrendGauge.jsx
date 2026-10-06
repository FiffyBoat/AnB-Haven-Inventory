import { useRef, useEffect, useState } from "react";
import { motion, useMotionValue, useTransform, animate, useInView } from "framer-motion";

// Animated orange dot that travels along the arc
function AnimatedGaugeDot({ cx, cy, dotR, targetVal, isInView, score }) {
  const angleMotion = useMotionValue(180);
  const dotX = useTransform(angleMotion, a => {
    const clamped = Math.min(180, Math.max(0, a));
    return cx + dotR * Math.cos((clamped * Math.PI) / 180);
  });
  const dotY = useTransform(angleMotion, a => {
    const clamped = Math.min(180, Math.max(0, a));
    return cy - dotR * Math.sin((clamped * Math.PI) / 180);
  });
  const [pos, setPos] = useState({ x: cx - dotR, y: cy });
  const animControls = useRef(null);
  const [showScore, setShowScore] = useState(false);
  const [isTouch] = useState(() => window.matchMedia('(pointer: coarse)').matches);

  useEffect(() => {
    const unsubX = dotX.on('change', x => setPos(p => ({ ...p, x })));
    const unsubY = dotY.on('change', y => setPos(p => ({ ...p, y })));
    return () => { unsubX(); unsubY(); };
  }, [dotX, dotY]);

  useEffect(() => {
    if (animControls.current) { animControls.current.stop(); animControls.current = null; }
    if (!isInView) { angleMotion.set(180); return; }
    const mapped = (targetVal / 100) * 60;
    const targetAngle = 180 - Math.min(60, Math.max(0, mapped)) * 3;
    animControls.current = animate(angleMotion, targetAngle, {
      type: "spring", stiffness: 60, damping: 18, delay: 0.1,
    });
    return () => { if (animControls.current) animControls.current.stop(); };
  }, [targetVal, isInView]);

  const handlers = isTouch
    ? { onClick: () => setShowScore(s => !s) }
    : { onMouseEnter: () => setShowScore(true), onMouseLeave: () => setShowScore(false) };

  return (
    <g style={{ cursor: 'pointer' }} {...handlers}>
      <motion.circle cx={dotX} cy={dotY} r={16} fill="#FF9000" />
      {showScore && (
        <text
          x={pos.x}
          y={pos.y}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#FFFFFF"
          style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontWeight: 300, fontSize: 14, pointerEvents: 'none' }}
        >
          {score}
        </text>
      )}
    </g>
  );
}

// trend_score: 0–100
export default function TrendGauge({ score = 0 }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: false, margin: "0px" });

  const tickExtra = 12;
  const dotInset = 22;
  const pad = tickExtra + 4;
  const arcR = 100;
  const cx = arcR;
  const cy = arcR;
  const tickR = arcR + tickExtra;
  const dotR = arcR - dotInset;

  const ticks = [0, 20, 40, 60, 80, 100].map(v => {
    const a = ((180 - (v / 100) * 180) * Math.PI) / 180;
    return { x: cx + tickR * Math.cos(a), y: cy - tickR * Math.sin(a) };
  });

  const vx = -pad;
  const vy = cy - tickR - 4;
  const vw = 2 * arcR + 2 * pad;
  const vh = cy - vy;
  const arcLen = Math.PI * arcR;

  return (
    <div ref={ref}>
      <svg
        width="100%"
        viewBox={`${vx} ${vy} ${vw} ${vh}`}
        style={{ display: 'block', overflow: 'visible' }}
        preserveAspectRatio="xMidYMax meet"
      >
        {/* Semicircle arc */}
        <path
          d={`M ${cx - arcR} ${cy} A ${arcR} ${arcR} 0 0 1 ${cx + arcR} ${cy}`}
          fill="none"
          stroke="#DFDFDF"
          strokeWidth="1"
          strokeLinecap="round"
          strokeDasharray={arcLen}
          strokeDashoffset={isInView ? 0 : arcLen}
          style={{ transition: isInView ? 'stroke-dashoffset 1.2s cubic-bezier(0,0,0.2,1)' : 'none' }}
        />
        {/* Tick dots */}
        {ticks.map((t, i) => {
          const opacity = 0.2 + (i / (ticks.length - 1)) * 0.7;
          const delay = Math.pow(i / (ticks.length - 1), 0.4) * 1.1;
          return (
            <circle
              key={i}
              cx={t.x} cy={t.y} r={1.5}
              fill={`rgba(52,52,52,${opacity.toFixed(2)})`}
              style={{
                opacity: isInView ? 1 : 0,
                transition: isInView ? `opacity 0.15s ease-out ${delay.toFixed(2)}s` : 'none',
              }}
            />
          );
        })}
        {/* Orange dot */}
        <AnimatedGaugeDot cx={cx} cy={cy} dotR={dotR} targetVal={score} isInView={isInView} score={score} />
      </svg>
    </div>
  );
}