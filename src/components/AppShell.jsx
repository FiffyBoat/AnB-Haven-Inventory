import { useState, useEffect, useCallback } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard, ShoppingCart, Package, Truck, UserRound, ReceiptText,
  UserCog, Database, ClipboardCheck, ListChecks, ShoppingBag, History,
  LockKeyhole, ShieldAlert, Delete, Zap, KeyRound, Timer, ArrowLeft,
  ShieldCheck, Receipt,
} from "lucide-react";
import NavItem from "@/components/NavItem";
import TabletBottomNav from "@/components/TabletBottomNav";
import SyncStatusBadge from "@/components/SyncStatusBadge";
import { useAuth } from "@/lib/AuthContext";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";

const OWNER_NAV = [
  { name: "Dashboard",       path: "/",          icon: LayoutDashboard },
  { name: "POS",             path: "/pos",        icon: ShoppingCart },
  { name: "Products",        path: "/products",   icon: Package },
  { name: "Warranty & IMEI", path: "/warranty",   icon: ShieldCheck },
  { name: "Store Expenses",  path: "/expenses",   icon: Receipt },
  { name: "Daily Closing",   path: "/closing",    icon: ClipboardCheck },
  { name: "Stock Count",     path: "/stock-count",icon: ListChecks },
  { name: "Reorder List",    path: "/reorder",    icon: ShoppingBag },
  { name: "Sales",           path: "/sales",      icon: ReceiptText },
  { name: "Customers",       path: "/customers",  icon: UserRound },
  { name: "Purchases",       path: "/purchases",  icon: Truck },
  { name: "Suppliers",       path: "/suppliers",  icon: Truck },
  { name: "Activity Log",    path: "/activity",   icon: History },
  { name: "Team",            path: "/team",       icon: UserCog },
  { name: "Data & Backup",   path: "/data",       icon: Database },
];

const CASHIER_NAV = [
  { name: "POS",             path: "/pos",       icon: ShoppingCart },
  { name: "Sales",           path: "/sales",     icon: ReceiptText },
  { name: "Customers",       path: "/customers", icon: UserRound },
  { name: "Warranty & IMEI", path: "/warranty",  icon: ShieldCheck },
];

// ── PIN lockout helpers ───────────────────────────────────────────────────────
const LOCK_MAX = 5;
const LOCK_MS  = 2 * 60 * 1000;
const lockKey  = (u) => `dhv-lockout-${u}`;
const attKey   = (u) => `dhv-attempts-${u}`;
function getLockout(u)    { try { const r = sessionStorage.getItem(lockKey(u)); if (!r) return null; const { until } = JSON.parse(r); if (Date.now() >= until) { sessionStorage.removeItem(lockKey(u)); return null; } return until; } catch { return null; } }
function doSetLockout(u)  { sessionStorage.setItem(lockKey(u), JSON.stringify({ until: Date.now() + LOCK_MS })); sessionStorage.setItem(attKey(u), "0"); }
function getAttempts(u)   { return parseInt(sessionStorage.getItem(attKey(u)) || "0", 10); }
function incAttempts(u)   { const n = getAttempts(u) + 1; sessionStorage.setItem(attKey(u), String(n)); return n; }
function clearAttempts(u) { sessionStorage.removeItem(attKey(u)); sessionStorage.removeItem(lockKey(u)); }

// ── Full-screen lock overlay shown after auto sign-out ───────────────────────
function LockScreen({ lockedUser, onUnlocked }) {
  const { login, loginWithPin } = useAuth();
  const [mode, setMode]       = useState("pin");
  const [pin, setPin]         = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy]       = useState(false);
  const [message, setMessage] = useState("");
  const [lockSecs, setLockSecs] = useState(0);

  const username = (lockedUser?.username || "").toLowerCase();

  // Lockout countdown
  useEffect(() => {
    const check = () => {
      const until = getLockout(username);
      setLockSecs(until ? Math.max(0, Math.ceil((until - Date.now()) / 1000)) : 0);
    };
    check();
    const iv = setInterval(check, 1000);
    return () => clearInterval(iv);
  }, [username]);

  const isLockedOut = lockSecs > 0;

  const submitPin = useCallback(async (code) => {
    if (isLockedOut) return;
    setBusy(true); setMessage("");
    try {
      await loginWithPin(username, code);
      clearAttempts(username);
      onUnlocked();
    } catch {
      const n = incAttempts(username);
      const left = LOCK_MAX - n;
      if (left <= 0) {
        doSetLockout(username);
        setLockSecs(Math.ceil(LOCK_MS / 1000));
        setMessage("Too many incorrect PINs. Locked for 2 minutes.");
      } else {
        setMessage(`Incorrect PIN. ${left} attempt${left === 1 ? "" : "s"} remaining.`);
      }
      setPin("");
    } finally { setBusy(false); }
  }, [username, loginWithPin, isLockedOut, onUnlocked]);

  const handleDigit = (d) => {
    if (busy || isLockedOut || pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setMessage("");
    if (next.length === 4) submitPin(next);
  };
  const handleBackspace = () => { if (!busy && !isLockedOut) setPin((p) => p.slice(0, -1)); };

  const submitPassword = async (e) => {
    e.preventDefault();
    setBusy(true); setMessage("");
    try {
      await login(username, password);
      onUnlocked();
    } catch (err) { setMessage(err.message); }
    finally { setBusy(false); }
  };

  // Physical keyboard for PIN pad
  useEffect(() => {
    if (mode !== "pin") return;
    const onKey = (e) => {
      if (e.key >= "0" && e.key <= "9") { e.preventDefault(); handleDigit(e.key); }
      else if (e.key === "Backspace")    { e.preventDefault(); handleBackspace(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const lockMins    = String(Math.floor(lockSecs / 60)).padStart(1, "0");
  const lockSecsStr = String(lockSecs % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-[9999] bg-[#111111]/95 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-7 w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-14 h-14 rounded-full bg-[#111111] flex items-center justify-center mb-3">
            <LockKeyhole size={24} className="text-[#ff9000]" />
          </div>
          <h2 className="text-lg font-bold text-[#111111]">Session locked</h2>
          <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
            Signed out due to inactivity.<br />
            <span className="font-semibold text-[#111111]">
              {lockedUser?.full_name || lockedUser?.username || "User"}
            </span>, sign in to continue.
          </p>
        </div>

        {/* Mode tabs */}
        <div className="flex bg-neutral-100 p-1 rounded-xl mb-4 gap-1">
          {[["pin", <Zap key="z" size={13} />, "Quick PIN"], ["password", <KeyRound key="k" size={13} />, "Password"]].map(
            ([m, icon, label]) => (
              <button key={m} type="button"
                onClick={() => { setMode(m); setMessage(""); setPin(""); }}
                className={`flex-1 py-2 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1 transition-all border-0 cursor-pointer ${
                  mode === m ? "bg-white text-[#111111] shadow-sm font-semibold" : "text-neutral-500 hover:text-neutral-800 bg-transparent"
                }`}>
                <span className={mode === m && m === "pin" ? "text-[#ff9000]" : ""}>{icon}</span>
                {label}
              </button>
            )
          )}
        </div>

        {/* PIN mode */}
        {mode === "pin" && (
          <div>
            <div className="flex flex-col items-center py-2 mb-1">
              <div className="flex items-center gap-5">
                {[0,1,2,3].map((idx) => (
                  <div key={idx} className={`w-4 h-4 rounded-full transition-all duration-150 ${
                    isLockedOut ? "border-2 border-red-200 bg-red-100"
                    : pin.length > idx ? "bg-[#111111] scale-125" : "border-2 border-neutral-300 bg-neutral-100"
                  }`} />
                ))}
              </div>
              <p className="text-[11px] text-neutral-400 mt-2">Enter your 4-digit PIN</p>
            </div>

            {isLockedOut && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2 mb-2">
                <ShieldAlert size={16} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-red-700">PIN locked</p>
                  <p className="text-xs text-red-500 mt-0.5">Try again in <span className="font-mono font-bold">{lockMins}:{lockSecsStr}</span></p>
                </div>
                <Timer size={14} className="text-red-400 ml-auto" />
              </div>
            )}

            {message && !isLockedOut && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 text-center mb-2 font-medium">{message}</p>
            )}

            <div className={`grid grid-cols-3 gap-2 ${isLockedOut ? "opacity-40 pointer-events-none" : ""}`}>
              {[1,2,3,4,5,6,7,8,9].map((n) => (
                <button key={n} type="button" disabled={busy || isLockedOut}
                  onClick={() => handleDigit(String(n))}
                  className="h-12 rounded-xl bg-neutral-50 hover:bg-neutral-100 active:bg-neutral-200 border border-neutral-200 text-lg font-semibold text-[#111111] transition-all active:scale-95 cursor-pointer disabled:opacity-50">
                  {n}
                </button>
              ))}
              <button type="button" disabled={busy || isLockedOut || pin.length === 0}
                onClick={() => { setPin(""); setMessage(""); }}
                className="h-12 rounded-xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-xs font-medium text-neutral-500 transition-all active:scale-95 cursor-pointer disabled:opacity-40">
                Clear
              </button>
              <button type="button" disabled={busy || isLockedOut}
                onClick={() => handleDigit("0")}
                className="h-12 rounded-xl bg-neutral-50 hover:bg-neutral-100 active:bg-neutral-200 border border-neutral-200 text-lg font-semibold text-[#111111] transition-all active:scale-95 cursor-pointer disabled:opacity-50">
                0
              </button>
              <button type="button" disabled={busy || isLockedOut || pin.length === 0}
                onClick={handleBackspace}
                className="h-12 rounded-xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-600 transition-all active:scale-95 cursor-pointer disabled:opacity-40">
                <Delete size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Password mode */}
        {mode === "password" && (
          <form onSubmit={submitPassword} className="space-y-3">
            <div className="relative">
              <LockKeyhole size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input type="password" autoComplete="current-password" value={password}
                onChange={(e) => { setPassword(e.target.value); setMessage(""); }}
                placeholder="Password" autoFocus
                className="w-full h-11 pl-9 pr-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-[#ff9000] transition-colors" />
            </div>
            {message && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{message}</p>}
            <button type="submit" disabled={busy || !password}
              className="w-full h-11 rounded-xl bg-[#111111] text-white text-sm font-medium disabled:opacity-40 cursor-pointer hover:bg-neutral-800 transition-colors">
              {busy ? "Verifying…" : "Sign in"}
            </button>
          </form>
        )}
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

  // Lock-screen: captures the user snapshot before clearing the session
  const [locked, setLocked]         = useState(false);
  const [lockedUser, setLockedUser] = useState(null);

  const handleAutoLogout = useCallback(() => {
    setLockedUser(currentUser);   // snapshot before logout clears the user
    logout();                     // clears session — no ghost session remains
    setLocked(true);
  }, [currentUser, logout]);

  const handleUnlocked = useCallback(() => {
    setLocked(false);
    setLockedUser(null);
  }, []);

  useInactivityLogout({
    enabled: Boolean(currentUser) && !locked,
    onLogout: handleAutoLogout,
    onWarn:   () => {},  // lock immediately — no warning countdown
    onActive: () => {},
  });

  return (
    <main
      className="w-full flex flex-col justify-start items-start bg-figma-color-9 min-h-screen font-paragraph"
      style={{ paddingTop: 16, paddingBottom: 80, paddingLeft: 16, paddingRight: 16, boxSizing: "border-box" }}
    >
      {/* Lock screen overlay — shown after inactivity sign-out */}
      {locked && (
        <LockScreen lockedUser={lockedUser} onUnlocked={handleUnlocked} />
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
            onClick={handleAutoLogout}
            className="flex items-center justify-center gap-1.5 h-[50px] px-3 rounded-full bg-neutral-100 hover:bg-neutral-200 text-[#111111] transition-colors border-0 cursor-pointer"
            title="Lock terminal immediately"
          >
            <LockKeyhole size={16} className="text-neutral-600" />
            <span className="hidden sm:inline text-xs font-semibold">Lock</span>
          </button>

          <button
            onClick={handleAutoLogout}
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
              Lock
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
