import { useMemo, useRef, useEffect, useState } from "react";

export default function InventoryChartMobile({ data }) {
  const containerRef = useRef(null);
  const chartRowRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [chartRowHeight, setChartRowHeight] = useState(0);
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

  useEffect(() => {
    if (!chartRowRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setChartRowHeight(entry.contentRect.height);
    });
    observer.observe(chartRowRef.current);
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
  const mobileXLabels = [0, 100000, 200000];
  const dotR = 8;
  const leftPad = 16;
  const rightPad = 16;
  const topPad = 16;
  const bottomPad = 16;
  const labelGap = 16;
  const dateColWidth = 44;
  const dateToChartGap = 8;
  const labelRowHeight = 13;

  const { width: totalWidth, height: totalHeight } = containerSize;
  const effectiveWidth = totalWidth > 0 ? totalWidth : 300;
  const effectiveHeight = totalHeight > 0 ? totalHeight : 300;
  const chartAreaWidth = Math.max(50, effectiveWidth - leftPad - dateColWidth - dateToChartGap - rightPad);
  const chartHeight = chartRowHeight > 0 ? chartRowHeight : 510;
  const labelHalfHeight = 6.5;

  const getY = (i) => {
    const n = weeklyData.length;
    if (n <= 1) return chartHeight / 2;
    return dotR + (i / (n - 1)) * (chartHeight - 2 * dotR);
  };

  const toX = (val) => {
    const clamped = Math.max(0, Math.min(val, maxVal));
    const usable = chartAreaWidth - 2 * dotR;
    return dotR + (clamped / maxVal) * usable;
  };

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
    <div
      ref={containerRef}
      className="flex flex-col w-full"
      style={{ height: 560, boxSizing: 'border-box' }}
    >
      <div ref={chartRowRef} className="flex flex-row" style={{ gap: dateToChartGap, height: 510, flexShrink: 0 }}>
        {/* Date labels */}
        <div className="shrink-0 relative" style={{ width: dateColWidth, height: '100%' }}>
          {weeklyData.map((pt, i) => {
            const y = getY(i);
            return (
              <span key={i} style={{
                position: 'absolute', top: y - labelHalfHeight, left: 0,
                textAlign: 'left', fontFamily: 'Hanken Grotesk, sans-serif',
                fontSize: 11, fontWeight: 300, color: '#343434', lineHeight: '14px', whiteSpace: 'nowrap',
              }}>
                {formatDate(pt.date)}
              </span>
            );
          })}
        </div>

        {/* Chart SVG */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative', height: '100%' }}>
          {totalWidth > 0 && (
            <svg key={animKey} viewBox={`0 0 ${chartAreaWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block', overflow: 'visible', width: '100%', height: '100%' }}>
              {weeklyData.map((pt, i) => {
                const y = getY(i);
                const x = toX(pt.value);
                const prev = weeklyData[i - 1];
                const isUp = i === 0 ? null : pt.value >= (prev?.value ?? pt.value);
                const dotColor = i === 0 ? '#FF9000' : isUp ? '#64E13C' : '#F13A15';
                return (
                  <g key={i} style={{ cursor: i === 0 ? 'default' : 'pointer' }}
                    onMouseEnter={() => {
                      if (i === 0) return;
                      const pct = (prev && prev.value > 0)
                        ? Math.abs(((pt.value - prev.value) / prev.value) * 100).toFixed(1) : null;
                      setHoveredDot({ index: i, x, y, value: pt.value, date: pt.date, pct, isUp });
                    }}
                    onMouseLeave={() => setHoveredDot(null)}
                  >
                    <line x1={0} y1={y} x2={chartAreaWidth} y2={y} stroke="#EFEFEF" strokeWidth={1} />
                    <circle cx={dotR} cy={y} r={dotR} fill={dotColor}>
                      <animate attributeName="cx" from={dotR} to={x} dur="0.6s" begin={`${i * 0.05}s`} fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.0 0.0 0.2 1.0" />
                    </circle>
                  </g>
                );
              })}
            </svg>
          )}

          {hoveredDot && (() => {
            const color = hoveredDot.isUp ? '#64E13C' : '#F13A15';
            const tooltipW = 140;
            let left = hoveredDot.x - tooltipW / 2;
            if (left < 0) left = 0;
            if (left + tooltipW > chartAreaWidth) left = chartAreaWidth - tooltipW;
            const top = Math.max(0, hoveredDot.y - 72 - 12);
            return (
              <div style={{
                position: 'absolute', left, top, width: tooltipW,
                background: '#111111', borderRadius: 16, padding: 12,
                display: 'flex', flexDirection: 'column', gap: 6, pointerEvents: 'none',
                animation: 'dotTooltipGrow 0.18s cubic-bezier(0.4,0,0.2,1) both',
              }}>
                <style>{`@keyframes dotTooltipGrow { from { transform: scale(0.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
                <p style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontSize: 14, fontWeight: 300, color, margin: 0 }}>
                  ${Math.round(hoveredDot.value).toLocaleString()}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 400, color: '#FFFFFF' }}>
                    {formatDate(hoveredDot.date)}
                  </span>
                  {hoveredDot.pct !== null && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 400, color }}>
                      {hoveredDot.isUp
                        ? <span style={{ width: 0, height: 0, borderLeft: '3px solid transparent', borderRight: '3px solid transparent', borderBottom: `5px solid ${color}`, display: 'inline-block' }} />
                        : <span style={{ width: 0, height: 0, borderLeft: '3px solid transparent', borderRight: '3px solid transparent', borderTop: `5px solid ${color}`, display: 'inline-block' }} />
                      }
                      {hoveredDot.pct}%
                    </span>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* X-axis value labels */}
      <div style={{
        display: 'flex', flexDirection: 'row', justifyContent: 'space-between',
        paddingLeft: dateColWidth + dateToChartGap + dotR,
        paddingRight: dotR, marginTop: labelGap,
      }}>
        {mobileXLabels.map((v) => (
          <span key={v} style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontSize: 11, fontWeight: 300, color: '#343434', lineHeight: '14px' }}>
            ${v === 0 ? '0k' : `${v / 1000}k`}
          </span>
        ))}
      </div>
    </div>
  );
}