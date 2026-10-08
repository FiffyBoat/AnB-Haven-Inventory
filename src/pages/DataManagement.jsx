import { useRef, useState, useEffect } from "react";
import {
  Download,
  FileUp,
  HardDriveDownload,
  ShieldCheck,
  Cloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  Smartphone,
  UploadCloud,
  DownloadCloud,
  Wifi,
  WifiOff,
  Code2,
} from "lucide-react";
import { localStore } from "@/api/localStore";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import {
  getStoredSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
  testSupabaseConnection,
  SUPABASE_SQL_SETUP_SCRIPT,
} from "@/api/supabaseClient";
import { syncManager } from "@/api/syncManager";

const dateForFile = () => new Date().toISOString().replace(/[:.]/g, "-");

export default function DataManagement() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const inputRef = useRef(null);
  const [restoring, setRestoring] = useState(false);

  // Cloud Sync state
  const [syncState, setSyncState] = useState(() => syncManager.getState());
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseAnonKey, setSupabaseAnonKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [isPushingAll, setIsPushingAll] = useState(false);
  const [isPullingAll, setIsPullingAll] = useState(false);

  useEffect(() => {
    const config = getStoredSupabaseConfig();
    setSupabaseUrl(config.url || "");
    setSupabaseAnonKey(config.anonKey || "");

    const unsubscribe = syncManager.subscribe((state) => {
      setSyncState(state);
    });
    return unsubscribe;
  }, []);

  const downloadBackup = () => {
    const backup = localStore.backups.create();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `anb-inventory-backup-${dateForFile()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Backup downloaded", description: "Store the JSON file somewhere safe, outside this browser." });
  };

  const restoreBackup = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!window.confirm("Restore this backup? It will replace all current local products, sales, customers, employees, and settings.")) return;
    setRestoring(true);
    try {
      const backup = JSON.parse(await file.text());
      await localStore.backups.restore(backup);
      toast({ title: "Backup restored", description: "Sign in again to use the restored records." });
      setTimeout(logout, 800);
    } catch (error) {
      toast({ title: "Could not restore backup", description: error.message, variant: "destructive" });
    } finally {
      setRestoring(false);
    }
  };

  const handleSaveConfig = (e) => {
    e.preventDefault();
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      toast({
        title: "Missing fields",
        description: "Please enter both your Supabase Project URL and Public Anon Key.",
        variant: "destructive",
      });
      return;
    }
    saveSupabaseConfig(supabaseUrl, supabaseAnonKey);
    toast({
      title: "Cloud settings saved",
      description: "Cloud sync is now configured. Running connection test...",
    });
    handleTestConnection();
  };

  const handleDisconnect = () => {
    if (!window.confirm("Disconnect cloud sync? Local data will remain intact in this browser.")) return;
    clearSupabaseConfig();
    setSupabaseUrl("");
    setSupabaseAnonKey("");
    setTestResult(null);
    toast({ title: "Disconnected", description: "Cloud sync has been disabled on this device." });
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testSupabaseConnection();
      setTestResult(res);
      if (res.success) {
        toast({ title: "Connection verified", description: "Successfully connected to Supabase and verified sync table." });
      } else {
        toast({ title: "Connection check failed", description: res.error, variant: "destructive" });
      }
    } finally {
      setTesting(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SETUP_SCRIPT);
    setCopiedSql(true);
    toast({ title: "SQL copied", description: "Paste this query into the Supabase SQL Editor and click Run." });
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleSyncNow = async () => {
    try {
      await syncManager.triggerSync();
      toast({ title: "Sync finished", description: "Latest sales and inventory records synchronized." });
    } catch (err) {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    }
  };

  const handlePushAll = async () => {
    if (!window.confirm("Upload all existing local products, sales, and customers to Supabase cloud?")) return;
    setIsPushingAll(true);
    try {
      const res = await syncManager.uploadAllLocalDataToCloud();
      toast({
        title: "Initial upload completed",
        description: `Successfully uploaded ${res.totalUploaded} records to your cloud database.`,
      });
    } catch (err) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setIsPushingAll(false);
    }
  };

  const handlePullAll = async () => {
    if (!window.confirm("Download all records from Supabase cloud into this device? Existing matching records will be updated with the latest version.")) return;
    setIsPullingAll(true);
    try {
      const res = await syncManager.downloadAllCloudData();
      toast({
        title: "Download completed",
        description: `Downloaded ${res.totalDownloaded} records from the cloud.`,
      });
    } catch (err) {
      toast({ title: "Download failed", description: err.message, variant: "destructive" });
    } finally {
      setIsPullingAll(false);
    }
  };

  if (user?.role !== "admin") {
    return (
      <div className="bg-white rounded-lg p-12 text-center">
        <p className="text-sm text-neutral-400">Only the owner can manage cloud sync and backups.</p>
      </div>
    );
  }

  const { isOnline, isSyncing, pendingCount, lastSyncTime, syncError, isConfigured } = syncState;

  return (
    <div className="max-w-4xl flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-heading font-light text-[#111111]">Data, Cloud Sync &amp; Remote Access</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Work seamlessly offline at the shop, auto-sync when online, and monitor your business remotely.
        </p>
      </div>

      {/* Cloud Sync Status & Overview Banner */}
      <section className="bg-white rounded-3xl p-6 border border-neutral-100 shadow-sm flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#FF9000] flex items-center justify-center shrink-0">
              <Cloud size={24} />
            </div>
            <div>
              <h2 className="text-lg font-heading font-normal text-[#111111]">Cloud Synchronization Status</h2>
              <div className="flex items-center gap-2 text-xs text-neutral-500 mt-0.5">
                <span className="flex items-center gap-1 font-medium">
                  {isOnline ? (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <Wifi size={13} className="text-emerald-600" /> Device Online
                    </span>
                  ) : (
                    <span className="text-amber-700 flex items-center gap-1">
                      <WifiOff size={13} className="text-amber-600" /> Device Offline
                    </span>
                  )}
                </span>
                <span>·</span>
                <span>
                  {isConfigured ? (
                    <span className="text-emerald-600 font-medium">Cloud Connected</span>
                  ) : (
                    <span className="text-neutral-400">Cloud Not Configured</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncNow}
              disabled={!isOnline || !isConfigured || isSyncing}
              className="h-10 px-4 rounded-full bg-[#111111] hover:bg-neutral-800 text-white font-medium text-xs flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
              {isSyncing ? "Syncing..." : "Sync Now"}
            </button>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Offline Queue</p>
            <p className="text-2xl font-bold text-[#111111] mt-1">
              {pendingCount}{" "}
              <span className="text-xs font-normal text-neutral-500">pending changes</span>
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">
              {pendingCount === 0 ? "All changes pushed to cloud" : "Queued to sync automatically"}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Last Synced</p>
            <p className="text-base font-semibold text-[#111111] mt-2">
              {lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : "Never"}
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">
              {lastSyncTime ? new Date(lastSyncTime).toLocaleDateString() : "Pending first sync"}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Multi-Device Access</p>
            <p className="text-base font-semibold text-emerald-700 mt-2 flex items-center gap-1.5">
              <Smartphone size={16} /> Ready for Mobile
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">Owner can log in from anywhere</p>
          </div>
        </div>

        {syncError && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2 text-xs">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Sync error occurred</p>
              <p className="mt-0.5 text-neutral-600">{syncError}</p>
            </div>
          </div>
        )}
      </section>

      {/* Owner Remote Access Guide */}
      <section className="bg-gradient-to-br from-[#111111] to-neutral-900 text-white rounded-3xl p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-white/10 text-[#FF9000] shrink-0">
            <Smartphone size={24} />
          </div>
          <div>
            <h3 className="text-lg font-heading font-light text-white">
              How the Owner Monitors the Shop Remotely
            </h3>
            <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
              When you are away from the shop (at home, travelling, or on the road), you can open this application on your smartphone, tablet, or laptop.
            </p>
            <div className="grid sm:grid-cols-3 gap-3 mt-4 text-xs">
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                <p className="font-semibold text-[#FF9000]">1. Shop Cashiers</p>
                <p className="text-neutral-400 text-[11px] mt-1">
                  Ring up sales, scan barcodes, and accept payments offline or online without interruptions.
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                <p className="font-semibold text-[#FF9000]">2. Auto Cloud Sync</p>
                <p className="text-neutral-400 text-[11px] mt-1">
                  Transactions and stock levels automatically sync to your secure Supabase cloud database in real time.
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                <p className="font-semibold text-[#FF9000]">3. Owner's Remote View</p>
                <p className="text-neutral-400 text-[11px] mt-1">
                  Log in on your phone to view today's revenue, gross profit, cash in drawer, MoMo collections, and debtors live!
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Supabase Cloud Connection Settings */}
      <section className="bg-white rounded-3xl p-6 border border-neutral-100 shadow-sm flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-heading font-normal text-[#111111]">Supabase Cloud Configuration</h2>
          <p className="text-xs text-neutral-500 mt-1">
            Connect your free Supabase project to enable cloud sync. Your data stays in your own private PostgreSQL database.
          </p>
        </div>

        <form onSubmit={handleSaveConfig} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700">Supabase Project URL</label>
            <input
              type="url"
              placeholder="https://xyzcompany.supabase.co"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border border-neutral-200 text-xs focus:outline-none focus:border-[#111111] transition-colors"
            />
            <p className="text-[11px] text-neutral-400">Found in Supabase Dashboard → Project Settings → API</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700">Supabase Public Anon API Key</label>
            <input
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={supabaseAnonKey}
              onChange={(e) => setSupabaseAnonKey(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border border-neutral-200 text-xs focus:outline-none focus:border-[#111111] transition-colors font-mono"
            />
            <p className="text-[11px] text-neutral-400">Use the public 'anon' key (safe for browser client)</p>
          </div>

          {testResult && (
            <div
              className={`p-3.5 rounded-2xl text-xs flex items-start gap-2.5 ${
                testResult.success
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-rose-50 text-rose-800 border border-rose-200"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-semibold">{testResult.success ? "Connection Verified!" : "Connection Problem"}</p>
                <p className="mt-0.5 text-[11px]">{testResult.error || "Supabase cloud sync is connected and ready."}</p>
                {testResult.tableMissing && (
                  <button
                    type="button"
                    onClick={() => setShowSql(true)}
                    className="mt-2 text-xs font-semibold underline text-rose-800"
                  >
                    View SQL Setup Script to create table
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2.5 pt-2 flex-wrap">
            <button
              type="submit"
              className="h-11 px-5 rounded-full bg-[#111111] hover:bg-neutral-800 text-white font-medium text-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              Save Cloud Settings
            </button>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing || !supabaseUrl || !supabaseAnonKey}
              className="h-11 px-4 rounded-full bg-white hover:bg-neutral-50 text-[#111111] font-medium text-xs flex items-center gap-2 border border-neutral-200 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={13} className={testing ? "animate-spin" : ""} />
              {testing ? "Testing..." : "Test Connection"}
            </button>
            {isConfigured && (
              <button
                type="button"
                onClick={handleDisconnect}
                className="h-11 px-4 rounded-full text-rose-600 hover:bg-rose-50 font-medium text-xs transition-colors cursor-pointer ml-auto"
              >
                Disconnect Cloud
              </button>
            )}
          </div>
        </form>

        {/* Database Table Setup SQL Helper */}
        <div className="pt-4 border-t border-neutral-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#111111] flex items-center gap-1.5">
                <Code2 size={15} className="text-[#FF9000]" /> Supabase Database Table Setup Script
              </p>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Copy and run this once in your Supabase SQL Editor to prepare your cloud table.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopySql}
                className="h-8 px-3 rounded-full bg-neutral-100 hover:bg-neutral-200 text-[#111111] font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedSql ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                {copiedSql ? "Copied!" : "Copy SQL"}
              </button>
              <button
                type="button"
                onClick={() => setShowSql(!showSql)}
                className="text-xs text-neutral-500 hover:text-[#111111] underline cursor-pointer"
              >
                {showSql ? "Hide Script" : "Show Script"}
              </button>
            </div>
          </div>

          {showSql && (
            <div className="mt-3 relative">
              <pre className="p-4 rounded-2xl bg-neutral-900 text-neutral-200 font-mono text-[11px] overflow-x-auto max-h-64">
                {SUPABASE_SQL_SETUP_SCRIPT}
              </pre>
            </div>
          )}
        </div>

        {/* One-Time Data Sync Actions */}
        {isConfigured && (
          <div className="pt-4 border-t border-neutral-100">
            <p className="text-xs font-semibold text-[#111111]">Cloud Migration Tools</p>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Use these one-click buttons to initialize data between the shop and cloud.
            </p>
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <button
                type="button"
                onClick={handlePushAll}
                disabled={isPushingAll || !isOnline}
                className="p-4 rounded-2xl border border-neutral-200 hover:border-neutral-300 bg-white hover:bg-neutral-50 text-left transition-colors flex items-start gap-3 cursor-pointer disabled:opacity-50"
              >
                <div className="p-2.5 rounded-xl bg-orange-50 text-[#FF9000] shrink-0">
                  <UploadCloud size={18} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#111111]">
                    {isPushingAll ? "Uploading All Records..." : "Upload All Local Data to Cloud"}
                  </p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Pushes all current products, sales, and accounts from this PC to your Supabase cloud.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={handlePullAll}
                disabled={isPullingAll || !isOnline}
                className="p-4 rounded-2xl border border-neutral-200 hover:border-neutral-300 bg-white hover:bg-neutral-50 text-left transition-colors flex items-start gap-3 cursor-pointer disabled:opacity-50"
              >
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 shrink-0">
                  <DownloadCloud size={18} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#111111]">
                    {isPullingAll ? "Downloading All Records..." : "Download All Cloud Data to Device"}
                  </p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Pulls all records from the cloud onto this device (ideal when first setting up the owner's phone).
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Manual Local File Backup & Restore (Preserved) */}
      <section className="bg-white rounded-3xl p-6 border border-neutral-100 shadow-sm flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-heading font-normal text-[#111111]">Local File Backups</h2>
          <p className="text-xs text-neutral-500 mt-1">
            Manual emergency file download and restore in case you need an offline hard copy on a USB flash drive.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-neutral-50 border border-neutral-100 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-700 font-semibold text-xs">
                <ShieldCheck size={18} /> Create Local Backup File
              </div>
              <p className="text-xs text-neutral-500 mt-1.5">
                Downloads all products, sales, customers, stock movements, and staff accounts into an encrypted JSON file.
              </p>
            </div>
            <button
              onClick={downloadBackup}
              className="mt-4 h-10 px-4 rounded-full bg-[#111111] hover:bg-neutral-800 text-white text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Download size={14} /> Download Backup (.json)
            </button>
          </div>

          <div className="p-5 rounded-2xl bg-neutral-50 border border-neutral-100 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-amber-700 font-semibold text-xs">
                <HardDriveDownload size={18} /> Restore from Backup File
              </div>
              <p className="text-xs text-neutral-500 mt-1.5">
                Restores records from an existing backup file. Replaces local browser records and signs you out.
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={restoreBackup}
            />
            <button
              disabled={restoring}
              onClick={() => inputRef.current?.click()}
              className="mt-4 h-10 px-4 rounded-full bg-[#fff3e6] hover:bg-[#ffe7cc] text-[#111111] text-xs font-medium flex items-center justify-center gap-2 border border-[#ffd49b] disabled:opacity-50 transition-colors cursor-pointer"
            >
              <FileUp size={14} /> {restoring ? "Restoring..." : "Choose Backup to Restore"}
            </button>
          </div>
        </div>

        <div className="bg-[#fcfcfb] rounded-2xl p-4 border border-neutral-200/80">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Dual-Storage Protection Active
          </p>
          <p className="text-xs text-neutral-600 mt-1">
            Your inventory and sales data are mirrored in both <strong>LocalStorage</strong> and <strong>IndexedDB</strong>. Even without internet, your store operations run at full speed.
          </p>
        </div>
      </section>
    </div>
  );
}
