import { Outlet, useLocation } from "react-router-dom";
import { Link } from "react-router-dom";
import {
  LayoutDashboard, ShoppingCart, Package, Truck, Users, UserRound, ReceiptText, UserCog, Database, ClipboardCheck, ListChecks, ShoppingBag, History,
} from "lucide-react";
import NavItem from "@/components/NavItem";
import TabletBottomNav from "@/components/TabletBottomNav";
import { useAuth } from "@/lib/AuthContext";

const OWNER_NAV = [
  { name: "Dashboard", path: "/", icon: LayoutDashboard },
  { name: "POS", path: "/pos", icon: ShoppingCart },
  { name: "Products", path: "/products", icon: Package },
  { name: "Stock Count", path: "/stock-count", icon: ListChecks },
  { name: "Reorder List", path: "/reorder", icon: ShoppingBag },
  { name: "Activity Log", path: "/activity", icon: History },
  { name: "Purchases", path: "/purchases", icon: Truck },
  { name: "Suppliers", path: "/suppliers", icon: Truck },
  { name: "Customers", path: "/customers", icon: UserRound },
  { name: "Sales", path: "/sales", icon: ReceiptText },
  { name: "Daily Closing", path: "/closing", icon: ClipboardCheck },
  { name: "Team", path: "/team", icon: UserCog },
  { name: "Data & Backup", path: "/data", icon: Database },
];

const CASHIER_NAV = [
  { name: "POS", path: "/pos", icon: ShoppingCart },
  { name: "Sales", path: "/sales", icon: ReceiptText },
  { name: "Customers", path: "/customers", icon: UserRound },
];

export default function AppShell({ children, pageLabel = "Inventory & POS" }) {
  const { user: currentUser, logout } = useAuth();
  const location = useLocation();
  const isOwner = currentUser?.role === "admin";
  const navItems = isOwner ? OWNER_NAV : CASHIER_NAV;

  return (
    <main className="w-full flex flex-col justify-start items-start bg-figma-color-9 min-h-screen font-paragraph" style={{ paddingTop: 16, paddingBottom: 80, paddingLeft: 16, paddingRight: 16, boxSizing: "border-box" }}>
      <header className="flex flex-row justify-between items-center w-full self-stretch">
        <div className="flex flex-row justify-start items-center gap-2">
          <Link to="/" className="flex flex-row justify-center items-center bg-[#111111] rounded-full shrink-0" style={{ width: 50, height: 50 }}>
            <span className="text-figma-14 font-semibold text-white">ANB</span>
          </Link>
          <Link to="/" className="flex flex-row justify-start items-center bg-[#111111] rounded-[32px]" style={{ height: 50, paddingLeft: 16, paddingRight: 16 }}>
            <p className="text-figma-14 font-normal leading-figma-18 text-figma-secondary">
              <span className="font-semibold">Haven</span> Ventures
            </p>
          </Link>
          <div className="hidden sm:flex flex-row justify-start items-center rounded-[32px]" style={{ height: 50, paddingLeft: 16, paddingRight: 16, background: "#FF9000" }}>
            <p className="text-figma-14 font-normal leading-figma-18 text-[#111111]">{pageLabel}</p>
          </div>
        </div>
        <div className="flex flex-row items-center justify-end" style={{ gap: 4 }}>
          <div className="hidden md:flex flex-row items-center rounded-[100px] bg-white" style={{ height: 50, paddingLeft: 16, paddingRight: 16, gap: 8 }}>
            <span className="text-figma-14 text-[#111111]">{currentUser?.full_name || ""}</span>
            <span className="text-figma-14 font-medium px-2 py-0.5 rounded-full" style={{ background: isOwner ? "#111111" : "#FF9000", color: isOwner ? "#fff" : "#111111" }}>
              {isOwner ? "Owner" : "Cashier"}
            </span>
          </div>
          <button
            onClick={logout}
            className="flex items-center justify-center gap-2 w-[50px] h-[50px] rounded-full bg-[#DFDFDF] md:w-auto md:h-[50px] md:rounded-[100px] md:pl-2 md:pr-4"
            style={{ border: "none", cursor: "pointer", flexShrink: 0, transition: "background 0.18s" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#FFFFFF")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#DFDFDF")}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#111111", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {currentUser ? (
                <span className="text-sm" style={{ fontFamily: "Inter, sans-serif", fontWeight: 400, color: "#FFFFFF", lineHeight: 1 }}>
                  {currentUser.full_name ? currentUser.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : ""}
                </span>
              ) : (
                <span className="text-sm text-white">?</span>
              )}
            </div>
            <span className="hidden md:flex text-sm" style={{ fontFamily: "Inter, sans-serif", fontWeight: 400, color: "#111111", lineHeight: 1 }}>
              {currentUser ? "Sign Out" : "Sign In"}
            </span>
          </button>
        </div>
      </header>

      <div className="flex flex-row justify-start items-start w-full self-stretch mt-8">
        <nav className="hidden lg:flex flex-col justify-start items-start gap-1 shrink-0" style={{ width: 224, minWidth: 224, position: "sticky", top: 16, alignSelf: "flex-start", paddingLeft: 16 }}>
          {navItems.map((item) => (
            <NavItem key={item.path} {...item} />
          ))}
        </nav>
        <div className="flex-1 flex lg:justify-center" style={{ minWidth: 0 }}>
          <div className="w-full lg:max-w-[1360px] lg:pl-8 pl-0 pr-0">{children}</div>
        </div>
      </div>
      <TabletBottomNav items={navItems} activePath={location.pathname} />
    </main>
  );
}
