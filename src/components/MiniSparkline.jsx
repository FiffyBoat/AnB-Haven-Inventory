import { ResponsiveContainer, AreaChart, Area } from "recharts";

export default function MiniSparkline({ data = [], color = "#1e40af" }) {
  if (!data.length) return <div className="w-20 h-8" />;
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div className="w-20 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Area type="monotone" dataKey="v" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={1.5} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}