import { useMemo, useRef, useEffect, useState } from "react";

export default function InventoryChartDesktop({ data, showDates = false }) {
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [hoveredDot, setHoveredDot] = useState(null);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setAnimKey(k => k + 1);
    }, { threshold: 0.1 });
    io.observe(containerRef.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const weeklyData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const step = Math.max(1, Math.floor(data.length / 13));
    const points = [];
    for (let i = 0; i < data.length; i += step) points.push(data[i]);
    const last = data[data.length - 1];
    if (points[points.length - 1] !== last) points.push(last);
    return points.slice(0, 13);
  }, [data]);

  const maxVal = 200000;
  const yLabels = [200000, 150000, 100000, 50000, 0];
  const dotR = 8;
  const gapDotsLine = 20;
  const smallDotR = 2;
  const yAxisWidth = 36;
  const gap = 8;

  const { width: totalWidth, height: totalHeight } = containerSize;
  const effectiveHeight = totalHeight > 0 ? totalHeight : 300;
  const chartAreaWidth = Math.max(0, totalWidth - yAxisWidth - gap);
  const bottomDotsH = showDates ? gapDotsLine + 16 : gapDotsLine + smallDotR * 2;
  const chartHeight = Math.max(50, effectiveHeight - bottomDotsH);

  const toY = (val) => {
    const clamped = Math.max(0, Math.min(val, maxVal));
    const usable = chartHeight - 2 * dotR;
    return dotR + (1 - clamped / maxVal) * usable;
  };

  const sidePad = 16;
  const getX = (i) => {
    if (weeklyData.length <= 1) return chartAreaWidth / 2;
    return sidePad + (i / (weeklyData.length - 1)) * (chartAreaWidth - 2 * sidePad);
  };

  const smallDotY = chartHeight + gapDotsLine + smallDotR;
  const svgHeight = chartHeight + bottomDotsH;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${parseInt(month)}.${parseInt(day)}.${year?.slice(2)}`;
  };

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height: 200 }}>
        <p style={{ fontSize: 14, color: '#999' }}>No movement data yet</p>
      </div>
    );
  }

  return (
    <div className="flex flex-row w-full h-full" style={{ gap, minHeight: 200 }}>
      {/* Y-axis labels */}
      <div className="flex flex-col justify-between shrink-0" style={{ width: yAxisWidth, height: chartHeight, paddingTop: dotR, paddingBottom: dotR }}>
        {yLabels.map((v) => (
          <span key={v} style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontSize: 11, fontWeight: 300, color: '#343434', lineHeight: '14px', whiteSpace: 'nowrap' }}>
            ${v === 0 ? '0k' : `${v / 1000}k`}
          </span>
        ))}
      </div>

      {/* Chart area */}
      <div ref={containerRef} className="flex-1" style={{ minHeight: 0, minWidth: 0, position: 'relative', height: '100%', overflow: 'hidden' }}>
        {totalWidth > 0 && (
          <>
            <svg key={animKey} width="100%" height={svgHeight} viewBox={`0 0 ${chartAreaWidth} ${svgHeight}`} style={{ display: 'block', overflow: 'visible' }}>
              {weeklyData.map((pt, i) => {
                const x = getX(i);
                const y = toY(pt.value);
                const prev = weeklyData[i - 1];
                const isUp = i === 0 ? null : pt.value >= (prev?.value ?? pt.value);
                const dotColor = i === 0 ? '#FF9000' : isUp ? '#64E13C' : '#F13A15';
                const pct = (prev && prev.value > 0)
                  ? Math.abs(((pt.value - prev.value) / prev.value) * 100).toFixed(1) : null;
                const bottomY = chartHeight - dotR;
                const delay = i * 0.05;

                return (
                  <g key={i} style={{ cursor: i === 0 ? 'default' : 'pointer' }}
                    onMouseEnter={() => {
                      if (i === 0) return;
                      setHoveredDot({ index: i, x, y, value: pt.value, date: pt.date, pct, isUp });
                    }}
                    onMouseLeave={() => setHoveredDot(null)}
                  >
                    <line x1={x} y1={0} x2={x} y2={chartHeight} stroke="#EFEFEF" strokeWidth={1} />
                    <circle cx={x} cy={bottomY} r={dotR} fill={dotColor}>
                      <animate attributeName="cy" from={bottomY} to={y} dur="0.6s" begin={`${delay}s`} fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.0 0.0 0.2 1.0" />
                    </circle>
                    {showDates ? (
                      <text x={x} y={smallDotY + smallDotR + 2} textAnchor="middle"
                        style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontSize: 11, fontWeight: 300, fill: '#343434' }}>
                        {formatDate(pt.date)}
                      </text>
                    ) : (
                      <circle cx={x} cy={smallDotY} r={smallDotR} fill="#343434" />
                    )}
                  </g>
                );
              })}
            </svg>

            {hoveredDot && (() => {
              const color = hoveredDot.isUp ? '#64E13C' : '#F13A15';
              const tooltipW = 160;
              let left = hoveredDot.x - tooltipW / 2;
              if (left < 0) left = 0;
              if (left + tooltipW > chartAreaWidth) left = chartAreaWidth - tooltipW;
              const top = Math.max(0, hoveredDot.y - 88 - 16);
              return (
                <div style={{
                  position: 'absolute', left, top, width: tooltipW,
                  background: '#111111', borderRadius: 22, padding: 16,
                  display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none',
                  transformOrigin: 'bottom center',
                  animation: 'dotTooltipGrow 0.18s cubic-bezier(0.4,0,0.2,1) both',
                }}>
                  <style>{`@keyframes dotTooltipGrow { from { transform: scale(0.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
                  <p style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontSize: 18, fontWeight: 300, color, lineHeight: '22px', margin: 0 }}>
                    ${Math.round(hoveredDot.value).toLocaleString()}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 400, color: '#FFFFFF' }}>
                      {formatDate(hoveredDot.date)}
                    </span>
                    {hoveredDot.pct !== null && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 400, color }}>
                        {hoveredDot.isUp
                          ? <span style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: `6px solid ${color}`, display: 'inline-block' }} />
                          : <span style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: `6px solid ${color}`, display: 'inline-block' }} />
                        }
                        {hoveredDot.pct}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}