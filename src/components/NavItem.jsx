import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

export default function NavItem({ name, path, icon: Icon }) {
  const location = useLocation();
  const isSelected = location.pathname === path || location.pathname.startsWith(path + "/");

  if (isSelected) {
    return (
      <Link to={path} className="flex flex-row items-center gap-1 w-full" style={{ height: 60 }}>
        <div className="flex items-center justify-center bg-white rounded-[32px] shadow-sm shrink-0" style={{ width: 60, height: 60 }}>
          {Icon && <Icon size={16} color="#111111" strokeWidth={2} />}
        </div>
        <div className="flex items-center bg-white rounded-[32px] shadow-sm grow px-4" style={{ height: 60 }}>
          <p className="text-figma-14 font-medium leading-figma-18 text-[#111111]">{name}</p>
        </div>
      </Link>
    );
  }

  return (
    <motion.div
      className="w-full group"
      animate={{ height: 40 }}
      whileHover={{ height: 60 }}
      transition={{ type: "spring", stiffness: 400, damping: 35 }}
      style={{ overflow: "hidden" }}
    >
      <Link to={path} className="flex flex-row items-center gap-3 rounded-[32px] w-full h-full bg-figma-accent px-4 cursor-pointer">
        {Icon && <Icon size={16} color="#111111" strokeWidth={2} className="shrink-0" />}
        <p style={{ fontSize: 14, fontFamily: "Inter, sans-serif", fontWeight: 400, color: "#111111", lineHeight: "18px" }} className="grow transition-all duration-150">{name}</p>
      </Link>
    </motion.div>
  );
}