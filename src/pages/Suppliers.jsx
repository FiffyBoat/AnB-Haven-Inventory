import { useState, useEffect } from "react";
import { localStore } from "@/api/localStore";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Truck } from "lucide-react";

const empty = { name: "", contact_person: "", phone: "", email: "", address: "", notes: "" };

export default function Suppliers() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    localStore.entities.Supplier.list()
      .then((s) => { setSuppliers(s); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(refresh, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const openNew = () => { setEditId(null); setForm(empty); setOpen(true); };
  const openEdit = (s) => { setEditId(s.id); setForm({ name: s.name, contact_person: s.contact_person || "", phone: s.phone || "", email: s.email || "", address: s.address || "", notes: s.notes || "" }); setOpen(true); };

  const submit = async () => {
    if (!form.name.trim()) { toast({ title: "Supplier name is required", variant: "destructive" }); return; }
    setBusy(true);
    try {
      const data = { ...form, name: form.name.trim() };
      if (editId) await localStore.entities.Supplier.update(editId, data);
      else await localStore.entities.Supplier.create(data);
      setOpen(false);
      refresh();
    } catch (err) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-40">
      <div className="w-8 h-8 border-4 border-figma-accent border-t-[#111111] rounded-full animate-spin" />
    </div>
  );

  const inputCls = "w-full h-11 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:border-[#FF9000]";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-light text-[#111111]">Suppliers</h1>
          <p className="text-sm text-neutral-500 mt-1">{suppliers.length} supplier(s)</p>
        </div>
        <button onClick={openNew} className="h-11 px-5 rounded-full bg-[#FF9000] text-sm font-medium text-[#111111] flex items-center gap-2 cursor-pointer border-none">
          <Plus size={15} /> New Supplier
        </button>
      </div>

      <div className="bg-white rounded-3xl overflow-hidden">
        {suppliers.length === 0 ? (
          <div className="p-12 text-center">
            <Truck size={32} className="text-neutral-300 mx-auto" />
            <p className="text-sm text-neutral-400 mt-3">No suppliers yet — add one to start recording purchases.</p>
          </div>
        ) : suppliers.map((s) => (
          <button key={s.id} onClick={() => openEdit(s)} className="w-full flex items-center justify-between px-5 py-4 border-b border-neutral-100 last:border-0 hover:bg-neutral-50 cursor-pointer border-x-0 border-t-0 bg-transparent text-left">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#111111]">{s.name}</p>
              <p className="text-xs text-neutral-500 truncate">{[s.contact_person, s.phone, s.email].filter(Boolean).join(" · ") || "No contact details"}</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full font-medium shrink-0" style={{
              background: s.status === "inactive" ? "#FDEAE6" : "#EFF6EC",
              color: s.status === "inactive" ? "#F13A15" : "#616E5D",
            }}>{s.status || "active"}</span>
          </button>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium text-[#111111] mb-4">{editId ? "Edit Supplier" : "New Supplier"}</p>
            <div className="space-y-2">
              <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Supplier name *" className={inputCls} />
              <input value={form.contact_person} onChange={(e) => set("contact_person", e.target.value)} placeholder="Contact person" className={inputCls} />
              <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Phone" className={inputCls} />
              <input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="Email" className={inputCls} />
              <input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Address" className={inputCls} />
              <input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Notes" className={inputCls} />
            </div>
            <button disabled={busy} onClick={submit} className="w-full h-12 mt-4 rounded-full bg-[#111111] text-white text-sm cursor-pointer border-none disabled:opacity-40">
              {busy ? "Saving…" : "Save Supplier"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
