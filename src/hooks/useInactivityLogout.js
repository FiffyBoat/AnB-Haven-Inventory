import { useEffect, useRef, useCallback } from "react";

// Inactivity timeouts (milliseconds)
const IDLE_TIMEOUT_MS = 2 * 60 * 1000;    // 2 min → auto logout
const WARN_BEFORE_MS  = 1 * 60 * 1000;    // 1 min before logout → show warning

// Events that count as "activity"
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];

/**
 * useInactivityLogout
 *
 * Calls `onLogout()` after IDLE_TIMEOUT_MS of no user activity.
 * Calls `onWarn(secondsLeft)` WARN_BEFORE_MS before logout so the UI
 * can show a countdown warning. Calls `onActive()` when the user
 * interacts again while the warning is showing, to dismiss it.
 *
 * @param {object} opts
 * @param {() => void}        opts.onLogout   Called when idle timeout fires.
 * @param {(n: number) => void} opts.onWarn   Called with seconds remaining at the 1-min mark.
 * @param {() => void}        opts.onActive   Called when user is active during warning phase.
 * @param {boolean}           opts.enabled    Set false to disable (e.g. user is logged out).
 */
export function useInactivityLogout({ onLogout, onWarn, onActive, enabled = true }) {
  const logoutTimer  = useRef(null);
  const warnTimer    = useRef(null);
  const warnActive   = useRef(false);

  const clearTimers = useCallback(() => {
    clearTimeout(logoutTimer.current);
    clearTimeout(warnTimer.current);
    logoutTimer.current = null;
    warnTimer.current   = null;
  }, []);

  const startTimers = useCallback(() => {
    clearTimers();

    // Warn 1 minute before logout
    warnTimer.current = setTimeout(() => {
      warnActive.current = true;
      onWarn?.(Math.round(WARN_BEFORE_MS / 1000));
    }, IDLE_TIMEOUT_MS - WARN_BEFORE_MS);

    // Auto logout after full idle period
    logoutTimer.current = setTimeout(() => {
      warnActive.current = false;
      onLogout?.();
    }, IDLE_TIMEOUT_MS);
  }, [clearTimers, onLogout, onWarn]);

  const handleActivity = useCallback(() => {
    if (!enabled) return;
    if (warnActive.current) {
      // User moved during warning — dismiss and restart
      warnActive.current = false;
      onActive?.();
    }
    startTimers();
  }, [enabled, startTimers, onActive]);

  useEffect(() => {
    if (!enabled) { clearTimers(); return; }

    startTimers();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));
    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, handleActivity));
    };
  }, [enabled, handleActivity, startTimers, clearTimers]);
}
