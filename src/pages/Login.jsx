import { useState, useEffect, useRef, useCallback } from "react";
import { KeyRound, LockKeyhole, UserRound, Delete, Zap, ShieldAlert, Timer, ArrowLeft } from "lucide-react";
import { localStore } from "@/api/localStore";
import { useAuth } from "@/lib/AuthContext";

// ─── PIN Lockout helpers ──────────────────────────────────────────────────────
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 2 * 60 * 1000; // 2 minutes

function lockoutKey(username) { return `dhv-lockout-${username.toLowerCase()}`; }
function attemptsKey(username) { return `dhv-attempts-${username.toLowerCase()}`; }

function getLockout(username) {
  try {
    const raw = sessionStorage.getItem(lockoutKey(username));
    if (!raw) return null;
    const { until } = JSON.parse(raw);
    if (Date.now() >= until) { sessionStorage.removeItem(lockoutKey(username)); return null; }
    return until;
  } catch { return null; }
}

function setLockout(username) {
  sessionStorage.setItem(lockoutKey(username), JSON.stringify({ until: Date.now() + LOCKOUT_MS }));
  sessionStorage.setItem(attemptsKey(username), "0");
}

function getAttempts(username) {
  return parseInt(sessionStorage.getItem(attemptsKey(username)) || "0", 10);
}

function incrementAttempts(username) {
  const n = getAttempts(username) + 1;
  sessionStorage.setItem(attemptsKey(username), String(n));
  return n;
}

function clearAttempts(username) {
  sessionStorage.removeItem(attemptsKey(username));
  sessionStorage.removeItem(lockoutKey(username));
}
// ─────────────────────────────────────────────────────────────────────────────

// PIN login steps
const STEP = { USERNAME: "username", PIN: "pin" };

export default function Login() {
  const { login, loginWithPin } = useAuth();

  // ── Shared ──
  const [loginMode, setLoginMode] = useState("pin"); // "pin" | "password"
  const [resetMode, setResetMode] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // ── PIN mode state ──
  const [step, setStep] = useState(STEP.USERNAME);
  const [cashierInput, setCashierInput] = useState(""); // username typed by cashier
  const [confirmedUsername, setConfirmedUsername] = useState(""); // after Continue
  const [pin, setPin] = useState("");
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const usernameRef = useRef(null);

  // ── Password mode state ──
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const isLockedOut = lockoutSeconds > 0;
  const [isCloudReady, setIsCloudReady] = useState(() => localStore.sync.getState().isConfigured);

  // Proactively pull cloud data immediately on login page mount
  useEffect(() => {
    localStore.sync.triggerSync();
    const unsubscribe = localStore.sync.subscribe((state) => {
      setIsCloudReady(state.isConfigured && state.isOnline);
    });
    return unsubscribe;
  }, []);

  // Focus username input when shown
  useEffect(() => {
    if (loginMode === "pin" && step === STEP.USERNAME && usernameRef.current) {
      usernameRef.current.focus();
    }
  }, [loginMode, step]);

  // Lockout countdown for the confirmed username
  useEffect(() => {
    if (!confirmedUsername) { setLockoutSeconds(0); return; }
    const check = () => {
      const until = getLockout(confirmedUsername);
      if (!until) { setLockoutSeconds(0); return; }
      setLockoutSeconds(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    };
    check();
    const iv = setInterval(check, 1000);
    return () => clearInterval(iv);
  }, [confirmedUsername]);

  const resetPinFlow = useCallback(() => {
    setStep(STEP.USERNAME);
    setCashierInput("");
    setConfirmedUsername("");
    setPin("");
    setMessage("");
    setLockoutSeconds(0);
  }, []);

  // ── Step 1: Confirm username ──────────────────────────────────────────────
  const handleContinue = async (e) => {
    e?.preventDefault();
    const trimmed = cashierInput.trim().toLowerCase();
    if (!trimmed) { setMessage("Please enter your username or cashier ID."); return; }
    // Check lockout before proceeding
    const until = getLockout(trimmed);
    if (until) {
      setConfirmedUsername(trimmed);
      setStep(STEP.PIN);
      setMessage("");
      return;
    }

    // Check if account exists locally. If not, fetch latest staff accounts from cloud right now!
    const staff = await localStore.auth.listActiveStaff();
    const exists = staff.some((s) => s.username?.toLowerCase() === trimmed);
    if (!exists && localStore.sync.getState().isOnline) {
      setBusy(true);
      try {
        await localStore.sync.pullEntityDirectly("User");
      } catch {
        // Continue
      } finally {
        setBusy(false);
      }
    }

    setConfirmedUsername(trimmed);
    setStep(STEP.PIN);
    setMessage("");
    setPin("");
  };

  // ── Step 2: PIN entry ─────────────────────────────────────────────────────
  const handlePinSubmit = useCallback(
    async (codeToSubmit) => {
      if (isLockedOut) return;
      setBusy(true);
      setMessage("");
      try {
        await loginWithPin(confirmedUsername, codeToSubmit);
        clearAttempts(confirmedUsername);
        localStorage.setItem("dhv-last-cashier", confirmedUsername);
      } catch (error) {
        const attempts = incrementAttempts(confirmedUsername);
        const remaining = MAX_ATTEMPTS - attempts;
        if (remaining <= 0) {
          setLockout(confirmedUsername);
          setLockoutSeconds(Math.ceil(LOCKOUT_MS / 1000));
          setMessage("Too many incorrect attempts. PIN entry locked for 2 minutes.");
        } else {
          setMessage(
            `Incorrect PIN. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
          );
        }
        setPin("");
      } finally {
        setBusy(false);
      }
    },
    [confirmedUsername, loginWithPin, isLockedOut]
  );

  const handleDigit = (digit) => {
    if (busy || isLockedOut || pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    setMessage("");
    if (next.length === 4) handlePinSubmit(next);
  };

  const handleBackspace = () => { if (!busy && !isLockedOut) { setPin((p) => p.slice(0, -1)); setMessage(""); } };
  const handleClear = () => { if (!busy && !isLockedOut) { setPin(""); setMessage(""); } };

  // Physical keyboard in PIN step
  useEffect(() => {
    if (loginMode !== "pin" || step !== STEP.PIN || resetMode) return;
    const onKey = (e) => {
      if (e.key >= "0" && e.key <= "9") { e.preventDefault(); handleDigit(e.key); }
      else if (e.key === "Backspace") { e.preventDefault(); handleBackspace(); }
      else if (e.key === "Escape") { e.preventDefault(); resetPinFlow(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loginMode, step, resetMode, pin, busy, isLockedOut, confirmedUsername, handlePinSubmit, resetPinFlow]);

  // ── Password login ────────────────────────────────────────────────────────
  const signInPassword = async (e) => {
    e.preventDefault();
    setBusy(true); setMessage("");
    try { await login(username, password); }
    catch (err) { setMessage(err.message); }
    finally { setBusy(false); }
  };

  const requestReset = async (e) => {
    e.preventDefault();
    setBusy(true); setMessage("");
    try {
      await localStore.users.requestPasswordReset(username);
      setMessage("Your request was sent to the owner for approval.");
    } catch (err) { setMessage(err.message); }
    finally { setBusy(false); }
  };

  const switchMode = (mode) => {
    setLoginMode(mode);
    setMessage("");
    resetPinFlow();
  };

  // Lockout display helpers
  const lockMins = String(Math.floor(lockoutSeconds / 60)).padStart(1, "0");
  const lockSecs = String(lockoutSeconds % 60).padStart(2, "0");

  return (
    <main className="min-h-screen bg-[#f4f4f1] flex items-center justify-center p-4 font-paragraph">
      <section className="w-full max-w-sm bg-white border border-neutral-200 rounded-2xl p-7 shadow-sm">

        {/* Brand */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#111111] text-white flex items-center justify-center font-bold text-xs shrink-0">DHV</div>
            <div>
              <h1 className="text-base font-bold text-[#111111] leading-tight">Danny&apos;s Heaven Ventures</h1>
              <p className="text-[11px] text-neutral-400">Takoradi · Phones, Laptops &amp; Accessories</p>
            </div>
          </div>
          {isCloudReady && (
            <div
              className="flex items-center gap-1.5 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100 shrink-0 font-medium select-none"
              title="Cloud connected: all staff accounts in sync"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Live Cloud</span>
            </div>
          )}
        </div>

        {/* Tab switcher */}
        {!resetMode && (
          <div className="flex bg-neutral-100 p-1 rounded-xl mb-5 gap-1">
            {[["pin", <Zap key="z" size={13} />, "Quick PIN"], ["password", <KeyRound key="k" size={13} />, "Password"]].map(
              ([mode, icon, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => switchMode(mode)}
                  className={`flex-1 py-2 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1 transition-all border-0 cursor-pointer ${
                    loginMode === mode
                      ? "bg-white text-[#111111] shadow-sm font-semibold"
                      : "text-neutral-500 hover:text-neutral-800 bg-transparent"
                  }`}
                >
                  <span className={loginMode === mode && mode === "pin" ? "text-[#ff9000]" : ""}>{icon}</span>
                  {label}
                </button>
              )
            )}
          </div>
        )}

        {/* ══ PIN MODE ══════════════════════════════════════════════════════ */}
        {loginMode === "pin" && !resetMode && (
          <div>
            {/* ── Step 1: Username ─────────────────────────────────────── */}
            {step === STEP.USERNAME && (
              <div>
                <p className="text-sm font-semibold text-[#111111] mb-1">Enter your username</p>
                <p className="text-xs text-neutral-500 mb-4">Type your cashier username, then press Continue.</p>
                <form onSubmit={handleContinue} className="space-y-3">
                  <div className="relative">
                    <UserRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      ref={usernameRef}
                      type="text"
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      value={cashierInput}
                      onChange={(e) => { setCashierInput(e.target.value); setMessage(""); }}
                      placeholder="Username or cashier ID"
                      className="w-full h-11 pl-9 pr-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-[#ff9000] transition-colors"
                    />
                  </div>
                  {message && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 font-medium">
                      {message}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={!cashierInput.trim()}
                    className="w-full h-11 rounded-xl bg-[#111111] text-white text-sm font-medium disabled:opacity-40 cursor-pointer hover:bg-neutral-800 transition-colors"
                  >
                    Continue →
                  </button>
                </form>
              </div>
            )}

            {/* ── Step 2: PIN ──────────────────────────────────────────── */}
            {step === STEP.PIN && (
              <div>
                {/* Back + identity bar */}
                <div className="flex items-center gap-2 mb-4">
                  <button
                    type="button"
                    onClick={resetPinFlow}
                    className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center border-0 cursor-pointer transition-colors shrink-0"
                    title="Back"
                  >
                    <ArrowLeft size={15} className="text-neutral-600" />
                  </button>
                  <div className="flex-1 min-w-0 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2">
                    <p className="text-[11px] text-neutral-400">Signing in as</p>
                    <p className="text-sm font-bold text-[#111111] font-mono truncate">{confirmedUsername}</p>
                  </div>
                </div>

                {/* Lockout banner */}
                {isLockedOut && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2.5 mb-3">
                    <ShieldAlert size={17} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-red-700">PIN entry locked</p>
                      <p className="text-xs text-red-500 mt-0.5">
                        Too many failed attempts. Try again in{" "}
                        <span className="font-mono font-bold">{lockMins}:{lockSecs}</span>
                      </p>
                    </div>
                    <Timer size={15} className="text-red-400 ml-auto shrink-0 mt-0.5" />
                  </div>
                )}

                {/* PIN dots */}
                <div className="flex flex-col items-center py-3">
                  <div className="flex items-center gap-5">
                    {[0, 1, 2, 3].map((idx) => {
                      const filled = pin.length > idx;
                      return (
                        <div
                          key={idx}
                          className={`w-4 h-4 rounded-full transition-all duration-150 ${
                            isLockedOut
                              ? "border-2 border-red-200 bg-red-100"
                              : filled
                              ? "bg-[#111111] scale-125"
                              : "border-2 border-neutral-300 bg-neutral-100"
                          }`}
                        />
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-2">Enter your 4-digit PIN</p>
                </div>

                {/* Error message */}
                {message && !isLockedOut && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 text-center my-2 font-medium">
                    {message}
                  </p>
                )}

                {/* Numpad */}
                <div className={`grid grid-cols-3 gap-2 mt-1 ${isLockedOut ? "opacity-40 pointer-events-none select-none" : ""}`}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                      key={num}
                      type="button"
                      disabled={busy || isLockedOut}
                      onClick={() => handleDigit(String(num))}
                      className="h-12 rounded-xl bg-neutral-50 hover:bg-neutral-100 active:bg-neutral-200 border border-neutral-200 text-lg font-semibold text-[#111111] transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={busy || isLockedOut || pin.length === 0}
                    onClick={handleClear}
                    className="h-12 rounded-xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-xs font-medium text-neutral-500 transition-all active:scale-95 cursor-pointer disabled:opacity-40"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    disabled={busy || isLockedOut}
                    onClick={() => handleDigit("0")}
                    className="h-12 rounded-xl bg-neutral-50 hover:bg-neutral-100 active:bg-neutral-200 border border-neutral-200 text-lg font-semibold text-[#111111] transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    disabled={busy || isLockedOut || pin.length === 0}
                    onClick={handleBackspace}
                    className="h-12 rounded-xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-600 transition-all active:scale-95 cursor-pointer disabled:opacity-40"
                  >
                    <Delete size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ PASSWORD MODE ═════════════════════════════════════════════════ */}
        {(loginMode === "password" || resetMode) && (
          <div>
            <h2 className="text-lg font-semibold text-[#111111]">
              {resetMode ? "Request password reset" : "Sign in"}
            </h2>
            <p className="text-xs text-neutral-500 mt-1">
              {resetMode ? "The owner must approve a new password." : "Enter your username and password."}
            </p>

            <form className="mt-5 space-y-4" onSubmit={resetMode ? requestReset : signInPassword}>
              <label className="block">
                <span className="text-xs text-neutral-500">Username</span>
                <div className="relative mt-1">
                  <UserRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    autoComplete="username"
                    autoCapitalize="none"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full h-11 pl-9 pr-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-[#ff9000] transition-colors"
                  />
                </div>
              </label>

              {!resetMode && (
                <label className="block">
                  <span className="text-xs text-neutral-500">Password</span>
                  <div className="relative mt-1">
                    <LockKeyhole size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full h-11 pl-9 pr-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-[#ff9000] transition-colors"
                    />
                  </div>
                </label>
              )}

              {message && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{message}</p>}

              <button
                disabled={busy}
                className="w-full h-11 rounded-xl bg-[#111111] text-white text-sm font-medium disabled:opacity-50 cursor-pointer hover:bg-neutral-800 transition-colors"
              >
                {busy ? "Please wait…" : resetMode ? "Request approval" : "Sign in"}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-neutral-100 flex items-center justify-between">
              <button
                onClick={() => { setResetMode((v) => !v); setMessage(""); }}
                className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-[#111111] bg-transparent border-0 p-0 cursor-pointer transition-colors"
              >
                <KeyRound size={13} /> {resetMode ? "Back to sign in" : "Forgot password?"}
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
