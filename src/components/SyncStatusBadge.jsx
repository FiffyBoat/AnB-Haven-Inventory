import { useState, useEffect } from "react";
import {
  Cloud,
  RefreshCw,
  CheckCircle2,
  WifiOff,
  AlertCircle,
  Database,
  ArrowRight,
} from "lucide-react";
import { syncManager } from "@/api/syncManager";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

function formatRelativeTime(isoString) {
  if (!isoString) return "Never";
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (seconds < 5) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(isoString).toLocaleDateString();
}

export default function SyncStatusBadge() {
  const [syncState, setSyncState] = useState(() => syncManager.getState());
  const [open, setOpen] = useState(false);
  const [manualSyncing, setManualSyncing] = useState(false);

  useEffect(() => {
    const unsubscribe = syncManager.subscribe((state) => {
      setSyncState(state);
    });
    return unsubscribe;
  }, []);

  const handleManualSync = async () => {
    setManualSyncing(true);
    try {
      await syncManager.triggerSync();
    } finally {
      setManualSyncing(false);
    }
  };

  const { isOnline, isSyncing, pendingCount, lastSyncTime, syncError, isConfigured } = syncState;

  // Render badge based on state
  let badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
  let badgeIcon = <CheckCircle2 size={13} className="text-emerald-600" />;
  let badgeText = "Synced";

  if (!isConfigured) {
    badgeColor = "bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200/80";
    badgeIcon = <Cloud size={13} className="text-neutral-500" />;
    badgeText = "Setup Cloud";
  } else if (!isOnline) {
    badgeColor = "bg-amber-50 text-amber-700 border-amber-200";
    badgeIcon = <WifiOff size={13} className="text-amber-600" />;
    badgeText = pendingCount > 0 ? `Offline (${pendingCount})` : "Offline";
  } else if (isSyncing || manualSyncing) {
    badgeColor = "bg-blue-50 text-blue-700 border-blue-200";
    badgeIcon = <RefreshCw size={13} className="text-blue-600 animate-spin" />;
    badgeText = "Syncing...";
  } else if (syncError) {
    badgeColor = "bg-rose-50 text-rose-700 border-rose-200";
    badgeIcon = <AlertCircle size={13} className="text-rose-600" />;
    badgeText = "Sync Issue";
  } else if (pendingCount > 0) {
    badgeColor = "bg-amber-50 text-amber-700 border-amber-200";
    badgeIcon = <RefreshCw size={13} className="text-amber-600" />;
    badgeText = `${pendingCount} queued`;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`h-9 px-3 rounded-full text-xs font-medium flex items-center gap-1.5 border transition-all cursor-pointer ${badgeColor}`}
        title="Click to view cloud sync status & controls"
      >
        {badgeIcon}
        <span className="hidden sm:inline">{badgeText}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6">
          <DialogHeader className="pb-3 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-neutral-100 text-[#111111]">
                <Database size={18} />
              </div>
              <div>
                <DialogTitle className="text-lg font-heading font-light text-[#111111]">
                  Cloud Sync &amp; Remote Access
                </DialogTitle>
                <DialogDescription className="text-xs text-neutral-500">
                  Real-time synchronization for shop &amp; remote owner
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 my-2 text-xs">
            {/* Connection Status Card */}
            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-between">
              <div>
                <p className="font-semibold text-neutral-500 uppercase tracking-wider text-[11px]">
                  Connection Mode
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isOnline ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  <p className="text-sm font-semibold text-[#111111]">
                    {isOnline ? "Online (Connected)" : "Offline (Local Storage Mode)"}
                  </p>
                </div>
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  isConfigured
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-neutral-200 text-neutral-700"
                }`}
              >
                {isConfigured ? "Cloud Active" : "Not Configured"}
              </span>
            </div>

            {/* Sync metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-white border border-neutral-200/80">
                <p className="text-neutral-400 text-[11px] font-medium uppercase tracking-wider">
                  Pending Offline Queue
                </p>
                <p className="text-xl font-bold text-[#111111] mt-0.5">
                  {pendingCount} <span className="text-xs font-normal text-neutral-500">records</span>
                </p>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Auto-syncs when online
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-neutral-200/80">
                <p className="text-neutral-400 text-[11px] font-medium uppercase tracking-wider">
                  Last Synced
                </p>
                <p className="text-sm font-semibold text-[#111111] mt-1.5">
                  {formatRelativeTime(lastSyncTime)}
                </p>
                <p className="text-[11px] text-neutral-400 mt-1 truncate">
                  {lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "No sync yet"}
                </p>
              </div>
            </div>

            {syncError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Sync notice</p>
                  <p className="text-[11px] mt-0.5">{syncError}</p>
                </div>
              </div>
            )}

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={handleManualSync}
                disabled={!isOnline || !isConfigured || isSyncing || manualSyncing}
                className="w-full h-11 rounded-xl bg-[#111111] hover:bg-neutral-800 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw
                  size={14}
                  className={isSyncing || manualSyncing ? "animate-spin" : ""}
                />
                {isSyncing || manualSyncing ? "Synchronizing Data..." : "Sync Now"}
              </button>

              <Link
                to="/data"
                onClick={() => setOpen(false)}
                className="w-full h-10 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-[#111111] font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                Configure Supabase Connection <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
