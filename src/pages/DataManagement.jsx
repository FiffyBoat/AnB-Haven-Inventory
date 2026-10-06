import { useRef, useState } from "react";
import { Download, FileUp, HardDriveDownload, ShieldCheck } from "lucide-react";
import { localStore } from "@/api/localStore";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";

const dateForFile = () => new Date().toISOString().replace(/[:.]/g, "-");

export default function DataManagement() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const inputRef = useRef(null);
  const [restoring, setRestoring] = useState(false);

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

  if (user?.role !== "admin") return <div className="bg-white rounded-lg p-12 text-center"><p className="text-sm text-neutral-400">Only the owner can manage backups.</p></div>;

  return (
    <div className="max-w-3xl flex flex-col gap-4">
      <div><h1 className="text-2xl font-heading font-light text-[#111111]">Data & Backup</h1><p className="text-sm text-neutral-500 mt-1">Keep an offline copy of the records stored in this browser.</p></div>
      <section className="bg-white rounded-lg p-6 border border-neutral-100">
        <div className="flex items-start gap-3"><ShieldCheck size={20} className="text-[#5c8f45] mt-0.5" /><div><h2 className="text-base font-medium text-[#111111]">Create a backup</h2><p className="text-sm text-neutral-500 mt-1">Downloads all products, stock movements, sales, customers, suppliers, and employee accounts into one JSON file.</p></div></div>
        <button onClick={downloadBackup} className="mt-5 h-11 px-4 rounded-md bg-[#111111] text-white text-sm font-medium flex items-center gap-2 border-0"><Download size={16} /> Download backup</button>
      </section>
      <section className="bg-white rounded-lg p-6 border border-neutral-100">
        <div className="flex items-start gap-3"><HardDriveDownload size={20} className="text-[#b56800] mt-0.5" /><div><h2 className="text-base font-medium text-[#111111]">Restore a backup</h2><p className="text-sm text-neutral-500 mt-1">Use only a backup created by this app. Restoring replaces all current local records and signs you out.</p></div></div>
        <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={restoreBackup} />
        <button disabled={restoring} onClick={() => inputRef.current?.click()} className="mt-5 h-11 px-4 rounded-md bg-[#fff3e6] text-[#111111] text-sm font-medium flex items-center gap-2 border border-[#ffd49b] disabled:opacity-50"><FileUp size={16} /> {restoring ? "Restoring..." : "Choose backup to restore"}</button>
      </section>
    </div>
  );
}
