import { useState, useEffect } from "react";
import { localStore } from "@/api/localStore";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Truck, Edit2, Trash2, Search, X } from "lucide-react";

const empty = { name: "", contact_person: "", phone: "", email: "", address: "", notes: "", status: "active" };

export default function Suppliers() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    localStore.entities.Supplier.list()
      .then((s) => {
        setSuppliers(s);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };
  useEffect(refresh, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const openNew = () => {
    setEditId(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (s) => {
    setEditId(s.id);
    setForm({
      name: s.name,
      contact_person: s.contact_person || "",
      phone: s.phone || "",
      email: s.email || "",
      address: s.address || "",
      notes: s.notes || "",
      status: s.status || "active",
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim()) {
      toast({ title: "Supplier name is required", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const data = { ...form, name: form.name.trim() };
      if (editId) {
        await localStore.entities.Supplier.update(editId, data);
        toast({ title: "Supplier updated", description: `${data.name} was saved.` });
      } else {
        await localStore.entities.Supplier.create(data);
        toast({ title: "Supplier created", description: `${data.name} was added.` });
      }
      setOpen(false);
      refresh();
    } catch (err) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const deleteSupplier = async () => {
    if (!editId) return;
    if (!window.confirm(`Are you sure you want to delete supplier "${form.name}"?`)) return;
    setBusy(true);
    try {
      await localStore.entities.Supplier.delete(editId);
      toast({ title: "Supplier deleted", description: `${form.name} was removed.` });
      setOpen(false);
      refresh();
    } catch (err) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const filtered = suppliers.filter((s) => {
    const q = query.trim().toLowerCase();
    return !q || [s.name, s.contact_person, s.phone, s.email].some((f) => f && String(f).toLowerCase().includes(q));
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <div className="w-8 h-8 border-4 border-figma-accent border-t-[#111111] rounded-full animate-spin" />
      </div>
    );
  }

  const inputCls =
    "w-full h-11 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:border-[#FF9000] bg-white";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-light text-[#111111]">Suppliers</h1>
          <p className="text-sm text-neutral-500 mt-1">{suppliers.length} vendor / supplier account(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 h-11 px-3.5 rounded-full bg-white border border-neutral-200">
            <Search size={15} className="text-neutral-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search suppliers…"
              className="text-sm bg-transparent focus:outline-none w-44"
            />
          </div>
          <button
            onClick={openNew}
            className="h-11 px-5 rounded-full bg-[#FF9000] text-sm font-medium text-[#111111] flex items-center gap-2 cursor-pointer border-none hover:bg-[#ff9d2e] transition-colors"
          >
            <Plus size={15} /> New Supplier
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl overflow-hidden border border-neutral-100 shadow-sm">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Truck size={32} className="text-neutral-300 mx-auto" />
            <p className="text-sm text-neutral-400 mt-3">
              {query ? "No suppliers match your search." : "No suppliers yet — add one to start recording purchases."}
            </p>
          </div>
        ) : (
          filtered.map((s) => (
            <div
              key={s.id}
              className="w-full flex items-center justify-between px-5 py-4 border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors"
            >
              <div className="min-w-0 pr-4">
                <p className="text-sm font-semibold text-[#111111]">{s.name}</p>
                <p className="text-xs text-neutral-500 truncate mt-0.5">
                  {[s.contact_person, s.phone, s.email].filter(Boolean).join(" · ") || "No contact details"}
                </p>
                {s.address && <p className="text-[11px] text-neutral-400 truncate mt-0.5">{s.address}</p>}
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <span
                  className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{
                    background: s.status === "inactive" ? "#FDEAE6" : "#EFF6EC",
                    color: s.status === "inactive" ? "#F13A15" : "#616E5D",
                  }}
                >
                  {s.status || "active"}
                </span>
                <button
                  onClick={() => openEdit(s)}
                  className="p-2 text-neutral-500 hover:text-[#111111] rounded-full hover:bg-neutral-200/60 cursor-pointer border-none bg-transparent transition-colors"
                  title="Edit supplier"
                >
                  <Edit2 size={15} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-3xl p-6 w-full max-w-md max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <p className="text-base font-semibold text-[#111111]">
                {editId ? "Edit Supplier Details" : "New Supplier"}
              </p>
              <button
                onClick={() => setOpen(false)}
                className="text-neutral-400 hover:text-[#111111] border-none bg-transparent cursor-pointer p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Company / Supplier Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. Franko Trading Ltd"
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Contact Person</label>
                  <input
                    value={form.contact_person}
                    onChange={(e) => set("contact_person", e.target.value)}
                    placeholder="e.g. John Mensah"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Phone</label>
                  <input
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder="e.g. 0244123456"
                    type="tel"
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Email</label>
                  <input
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="sales@vendor.com"
                    type="email"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => set("status", e.target.value)}
                    className={inputCls}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Office / Warehouse Address</label>
                <input
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder="e.g. Market Circle, Takoradi"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Notes / Terms</label>
                <input
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Payment terms, delivery days, etc."
                  className={inputCls}
                />
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <button
                disabled={busy}
                onClick={submit}
                className="w-full h-12 rounded-full bg-[#111111] text-white text-sm font-semibold cursor-pointer border-none disabled:opacity-40 hover:bg-neutral-800 transition-colors"
              >
                {busy ? "Saving…" : editId ? "Save Supplier Changes" : "Save Supplier"}
              </button>
              {editId && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={deleteSupplier}
                  className="w-full h-10 rounded-full border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Delete Supplier
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
