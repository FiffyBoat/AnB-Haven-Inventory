import { useState } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard, ShoppingCart, Package, Truck, UserRound, ReceiptText,
  UserCog, Database, ClipboardCheck, ListChecks, ShoppingBag, History,
  Clock, AlertTriangle,
} from "lucide-react";
import NavItem from "@/components/NavItem";
import TabletBottomNav from "@/components/TabletBottomNav";
import SyncStatusBadge from "@/components/SyncStatusBadge";
import { useAuth } from "@/lib/AuthContext";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";

const OWNER_NAV = [
  { name: "Dashboard",    path: "/",          icon: LayoutDashboard },
  { name: "POS",          path: "/pos",        icon: ShoppingCart },
  { name: "Products",     path: "/products",   icon: Package },
  { name: "Stock Count",  path: "/stock-count",icon: ListChecks },
  { name: "Reorder List", path: "/reorder",    icon: ShoppingBag },
  { name: "Activity Log", path: "/activity",   icon: History },
  { name: "Purchases",    path: "/purchases",  icon: Truck },
  { name: "Suppliers",    path: "/suppliers",  icon: Truck },
  { name: "Customers",    path: "/customers",  icon: UserRound },
  { name: "Sales",        path: "/sales",      icon: ReceiptText },
  { name: "Daily Closing",path: "/closing",    icon: ClipboardCheck },
  { name: "Team",         path: "/team",       icon: UserCog },
  { name: "Data & Backup",path: "/data",       icon: Database },
];

const CASHIER_NAV = [
  { name: "POS",       path: "/pos",       icon: ShoppingCart },
  { name: "Sales",     path: "/sales",     icon: ReceiptText },
  { name: "Customers", path: "/customers", icon: UserRound },
];

// ── Inactivity warning modal ──────────────────────────────────────────────────
function InactivityWarning({ secondsLeft, onStayLoggedIn, onLogoutNow }) {
  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-7 w-full max-w-sm shadow-2xl text-center animate-in fade-in zoom-in duration-200">
        <div className="w-14 h-14 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center mx-auto mb-4">
          <Clock size={24} className="text-amber-500" />
        </div>
        <h2 className="text-lg font-bold text-[#111111]">Still there?</h2>
        <p className="text-sm text-neutral-500 mt-2">
          You&apos;ve been inactive. For security, you&apos;ll be signed out in
        </p>
        <p className="text-4xl font-mono font-black text-[#ff9000] my-4">
          {String(Math.floor(secondsLeft / 60)).padStart(1, "0")}:
          {String(secondsLeft % 60).padStart(2, "0")}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onLogoutNow}
            className="flex-1 h-11 rounded-xl bg-neutral-100 text-neutral-700 text-sm font-medium border-0 cursor-pointer hover:bg-neutral-200 transition-colors"
          >
            Sign out now
          </button>
          <button
            onClick={onStayLoggedIn}
            className="flex-1 h-11 rounded-xl bg-[#111111] text-white text-sm font-bold border-0 cursor-pointer hover:bg-neutral-800 transition-colors"
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AppShell({ children, pageLabel = "Inventory & POS" }) {
  const { user: currentUser, logout } = useAuth();
  const location = useLocation();
  const isOwner = currentUser?.role === "admin";
  const navItems = isOwner ? OWNER_NAV : CASHIER_NAV;

  // Inactivity warning state
  const [warnSeconds, setWarnSeconds]     = useState(0);
  const [showWarning, setShowWarning]     = useState(false);

  const handleWarn = (secs) => {
    setWarnSeconds(secs);
    setShowWarning(true);
    // Count down the displayed seconds
    let remaining = secs;
    const iv = setInterval(() => {
      remaining -= 1;
      setWarnSeconds(remaining);
      if (remaining <= 0) clearInterval(iv);
    }, 1000);
  };

  const handleAutoLogout = () => {
    setShowWarning(false);
    logout();
  };

  const handleStayLoggedIn = () => {
    setShowWarning(false);
    setWarnSeconds(0);
    // activity events will restart the timer automatically via the hook
  };

  useInactivityLogout({
    enabled: Boolean(currentUser),
    onLogout:  handleAutoLogout,
    onWarn:    handleWarn,
    onActive:  handleStayLoggedIn,
  });

  return (
    <main
      className="w-full flex flex-col justify-start items-start bg-figma-color-9 min-h-screen font-paragraph"
      style={{ paddingTop: 16, paddingBottom: 80, paddingLeft: 16, paddingRight: 16, boxSizing: "border-box" }}
    >
      {/* Inactivity warning overlay */}
      {showWarning && (
        <InactivityWarning
          secondsLeft={warnSeconds}
          onStayLoggedIn={handleStayLoggedIn}
          onLogoutNow={handleAutoLogout}
        />
      )}

      <header className="flex flex-row justify-between items-center w-full self-stretch">
        <div className="flex flex-row justify-start items-center gap-2">
          <Link
            to="/"
            className="flex flex-row justify-center items-center bg-[#111111] rounded-full shrink-0"
            style={{ width: 50, height: 50 }}
          >
            <span className="text-figma-14 font-semibold text-white">DHV</span>
          </Link>
          <Link
            to="/"
            className="flex flex-row justify-start items-center bg-[#111111] rounded-[32px]"
            style={{ height: 50, paddingLeft: 16, paddingRight: 16 }}
          >
            <p className="text-figma-14 font-normal leading-figma-18 text-figma-secondary">
              <span className="font-semibold">Danny&apos;s Heaven</span> Ventures
            </p>
          </Link>
          <div
            className="hidden sm:flex flex-row justify-start items-center rounded-[32px]"
            style={{ height: 50, paddingLeft: 16, paddingRight: 16, background: "#FF9000" }}
          >
            <p className="text-figma-14 font-normal leading-figma-18 text-[#111111]">{pageLabel}</p>
          </div>
        </div>

        <div className="flex flex-row items-center justify-end" style={{ gap: 8 }}>
          <SyncStatusBadge />

          {/* Idle indicator — shows when close to timeout */}
          {showWarning && (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200">
              <AlertTriangle size={13} className="text-amber-500" />
              <span className="text-xs text-amber-700 font-medium">Auto sign-out in {warnSeconds}s</span>
            </div>
          )}

          <div
            className="hidden md:flex flex-row items-center rounded-[100px] bg-white"
            style={{ height: 50, paddingLeft: 16, paddingRight: 16, gap: 8 }}
          >
            <span className="text-figma-14 text-[#111111]">{currentUser?.full_name || ""}</span>
            <span
              className="text-figma-14 font-medium px-2 py-0.5 rounded-full"
              style={{ background: isOwner ? "#111111" : "#FF9000", color: isOwner ? "#fff" : "#111111" }}
            >
              {isOwner ? "Owner" : "Cashier"}
            </span>
          </div>

          <button
            onClick={logout}
            className="flex items-center justify-center gap-1.5 h-[50px] px-3 rounded-full bg-neutral-100 hover:bg-neutral-200 text-[#111111] transition-colors border-0 cursor-pointer"
            title="Lock terminal immediately"
          >
            <Clock size={16} className="text-neutral-600" />
            <span className="hidden sm:inline text-xs font-semibold">Lock</span>
          </button>

          <button
            onClick={logout}
            className="flex items-center justify-center gap-2 w-[50px] h-[50px] rounded-full bg-[#DFDFDF] md:w-auto md:h-[50px] md:rounded-[100px] md:pl-2 md:pr-4"
            style={{ border: "none", cursor: "pointer", flexShrink: 0, transition: "background 0.18s" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#FFFFFF")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#DFDFDF")}
          >
            <div
              style={{
                width: 34, height: 34, borderRadius: "50%", background: "#111111",
                flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {currentUser ? (
                <span className="text-sm" style={{ fontFamily: "Inter, sans-serif", fontWeight: 400, color: "#FFFFFF", lineHeight: 1 }}>
                  {currentUser.full_name
                    ? currentUser.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
                    : ""}
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
        <nav
          className="hidden lg:flex flex-col justify-start items-start gap-1 shrink-0"
          style={{ width: 224, minWidth: 224, position: "sticky", top: 16, alignSelf: "flex-start", paddingLeft: 16 }}
        >
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
