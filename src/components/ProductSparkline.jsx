import { useMemo } from "react";
import { ResponsiveContainer, LineChart, Line } from "recharts";

export default function ProductSparkline({ movements, currentStock }) {
  const data = useMemo(() => {
    const today = new Date();
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - 30);

    const relevant = movements
      .filter(m => m.movement_date >= cutoff.toISOString().split("T")[0])
      .sort((a, b) => new Date(a.movement_date) - new Date(b.movement_date));

    // Build day-by-day from current stock walking backward
    const days = [];
    for (let i = 30; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split("T")[0]);
    }

    let stock = currentStock;
    const stockByDate = {};
    const reversed = [...relevant].reverse();
    for (const m of reversed) {
      if (m.movement_type === "sale") stock += m.quantity;
      else if (m.movement_type === "restock" || m.movement_type === "return") stock -= m.quantity;
      else stock += m.quantity;
    }

    let running = Math.max(0, stock);
    const sortedAsc = [...relevant].sort((a, b) => new Date(a.movement_date) - new Date(b.movement_date));
    let mi = 0;
    for (const day of days) {
      while (mi < sortedAsc.length && sortedAsc[mi].movement_date <= day) {
        const m = sortedAsc[mi];
        if (m.movement_type === "sale") running = Math.max(0, running - m.quantity);
        else if (m.movement_type === "restock" || m.movement_type === "return") running += m.quantity;
        else running = Math.max(0, running - m.quantity);
        mi++;
      }
      stockByDate[day] = running;
    }

    return days.map(d => ({ date: d, stock: stockByDate[d] ?? 0 }));
  }, [movements, currentStock]);

  if (data.length === 0) return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <div style={{ width: 100, height: 30 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="stock" stroke="#6b8fb0" strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}