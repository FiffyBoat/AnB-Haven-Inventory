import { motion } from "framer-motion";
import { Link } from "react-router-dom";

export default function StatCard({ label, value, sub, tone = "light", onClick, to }) {
  const bg = tone === "dark" ? "#111111" : tone === "accent" ? "#FF9000" : "#FFFFFF";
  const color = tone === "dark" ? "#FFFFFF" : "#111111";
  const subColor = tone === "dark" ? "rgba(255,255,255,0.7)" : "#343434";

  const inner = (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } }}
      whileHover={{ scale: onClick || to ? 1.02 : 1 }}
      className="flex flex-col w-full"
      style={{ background: bg, borderRadius: 32, padding: 20, cursor: onClick || to ? "pointer" : "default", minHeight: 140 }}>
      <p className="text-figma-14" style={{ color, opacity: 0.85 }}>{label}</p>
      <p className="text-[32px] sm:text-[40px] font-light font-heading leading-none mt-4" style={{ color }}>
        {value}
      </p>
      {sub && <p className="mt-3 text-figma-14" style={{ color: subColor }}>{sub}</p>}
    </motion.div>
  );

  if (to) return <Link to={to} className="w-full">{inner}</Link>;
  return <div onClick={onClick} className="w-full">{inner}</div>;
}