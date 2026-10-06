import { ArrowUp, ArrowDown, Minus } from "lucide-react";

const directionConfig = {
  up: { icon: ArrowUp, color: "text-green-600", bg: "bg-green-100" },
  down: { icon: ArrowDown, color: "text-red-600", bg: "bg-red-100" },
  stable: { icon: Minus, color: "text-yellow-600", bg: "bg-yellow-100" },
};

export default function TrendGaugeCard({ trend }) {
  const { icon: DirIcon, color, bg } = directionConfig[trend.direction] || directionConfig.stable;
  const rotation = (trend.trend_score / 100) * 180 - 90;

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-sm hover:shadow-md transition-shadow">
      <h3 className="font-semibold text-sm text-foreground mb-4">{trend.category}</h3>

      {/* Gauge */}
      <div className="flex justify-center mb-4">
        <div className="relative w-28 h-14 overflow-hidden">
          <svg viewBox="0 0 120 60" className="w-full h-full">
            <path d="M10 55 A50 50 0 0 1 110 55" fill="none" stroke="hsl(var(--border))" strokeWidth="8" strokeLinecap="round" />
            <path d="M10 55 A50 50 0 0 1 110 55" fill="none" stroke="hsl(var(--accent))" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${(trend.trend_score / 100) * 157} 157`} />
            <line x1="60" y1="55" x2="60" y2="20" stroke="hsl(var(--foreground))" strokeWidth="2" strokeLinecap="round"
              transform={`rotate(${rotation}, 60, 55)`} />
          </svg>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-lg font-bold text-foreground">
            {trend.trend_score}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${bg} ${color}`}>
          <DirIcon className="w-3 h-3" />
          {trend.direction}
        </div>
        <span className={`text-sm font-semibold ${trend.forecast_change_pct >= 0 ? "text-green-600" : "text-red-600"}`}>
          {trend.forecast_change_pct >= 0 ? "+" : ""}{trend.forecast_change_pct}%
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-3">{trend.period}</p>
      {trend.source && <p className="text-xs text-muted-foreground">Source: {trend.source}</p>}
    </div>
  );
}