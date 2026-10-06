import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { localStore } from "@/api/localStore";
import { useToast } from "@/components/ui/use-toast";
import { formatGhs, formatDateTime } from "@/lib/format";
import { Plus, Trash2, Truck } from "lucide-react";

const emptyItem = { product_id: "", quantity: "", unit_cost: "", identifiers: "" };

export default function Purchases() {
  const location = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("UNPAID");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [expanded, setExpanded] = useState(null);

  const refresh = () => {
    Promise.all([
      localStore.entities.Purchase.list("-created_date", 100),
      localStore.entities.Supplier.list(),
      localStore.entities.Product.list(),
    ]).then(([p, s, pr]) => {
      setPurchases(p); setSuppliers(s); setProducts(pr); setLoading(false);
    }).catch(() => setLoading(false));
  };
  useEffect(refresh, []);

  useEffect(() => {
    const suggestedItems = location.state?.suggestedItems;
    if (!Array.isArray(suggestedItems) || !suggestedItems.length) return;
    setItems(suggestedItems.map((item) => ({ ...emptyItem, ...item })));
    setOpen(true);
  }, [location.state]);

  const setItem = (i, k, v) => setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  const productById = (id) => products.find((p) => p.id === id);
  const tracked = (id) => { const p = productById(id); return p && (p.track_imei || p.track_serial); };

  const submit = async () => {
    const clean = items
      .filter((it) => it.product_id && Number(it.quantity) > 0)
      .map((it) => ({
        product_id: it.product_id,
        quantity: Number(it.quantity),
        unit_cost: Number(it.unit_cost) || 0,
        unit_identifiers: it.identifiers.split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
      }));
    if (!supplierId) { toast({ title: "Select a supplier", variant: "destructive" }); return; }
    if (clean.length === 0) { toast({ title: "Add at least one product", variant: "destructive" }); return; }
    setBusy(true);
    try {
      const res = await localStore.functions.invoke("createPurchase", { supplier_id: supplierId, items: clean, payment_status: paymentStatus, notes });
      if (res.data?.error) throw new Error(res.data.error);
      toast({ title: "Stock received", description: "Inventory updated with a ledger entry." });
      setOpen(false);
      setSupplierId(""); setNotes(""); setItems([{ ...emptyItem }]);
      refresh();
    } catch (err) {
      toast({ title: "Purchase failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-40">
      <div className="w-8 h-8 border-4 border-figma-accent border-t-[#111111] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-light text-[#111111]">Purchases</h1>
          <p className="text-sm text-neutral-500 mt-1">Record stock received from suppliers</p>
        </div>
        <button onClick={() => setOpen(true)} className="h-11 px-5 rounded-full bg-[#FF9000] text-sm font-medium text-[#111111] flex items-center gap-2 cursor-pointer border-none">
          <Plus size={15} /> New Purchase
        </button>
      </div>

      <div className="bg-white rounded-3xl overflow-hidden">
        {purchases.length === 0 ? (
          <div className="p-12 text-center">
            <Truck size={32} className="text-neutral-300 mx-auto" />
            <p className="text-sm text-neutral-400 mt-3">No purchases recorded yet.</p>
          </div>
        ) : purchases.map((p) => (
          <div key={p.id} className="border-b border-neutral-100 last:border-0">
            <button onClick={() => setExpanded(expanded === p.id ? null : p.id)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-neutral-50 cursor-pointer border-none bg-transparent text-left">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#111111]">{p.purchase_number} · {p.supplier_name}</p>
                <p className="text-xs text-neutral-500">{formatDateTime(p.created_date)} · {(p.items || []).length} product line(s) · {p.created_by_name}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-medium text-[#111111]">{formatGhs(p.total)}</p>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
                  background: p.payment_status === "PAID" ? "#EFF6EC" : "#FFF3E6",
                  color: p.payment_status === "PAID" ? "#616E5D" : "#D9624A",
                }}>{p.payment_status}</span>
              </div>
            </button>
            {expanded === p.id && (
              <div className="px-5 pb-4 bg-neutral-50/60">
                {(p.items || []).map((it, i) => (
                  <div key={i} className="flex items-start justify-between py-2 border-b border-neutral-100 last:border-0">
                    <div>
                      <p className="text-sm text-[#111111]">{it.product_name}</p>
                      <p className="text-xs text-neutral-500">{it.quantity} × {formatGhs(it.unit_cost)}</p>
                      {(it.unit_identifiers || []).length > 0 && (
                        <p className="text-xs text-neutral-400 mt-0.5">Units: {it.unit_identifiers.join(", ")}</p>
                      )}
                    </div>
                    <p className="text-sm text-[#111111]">{formatGhs(it.total_cost)}</p>
                  </div>
                ))}
                {p.notes && <p className="text-xs text-neutral-500 mt-2">Notes: {p.notes}</p>}
              </div>
            )}
          </div>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-2xl my-8">
            <p className="text-base font-medium text-[#111111]">New Purchase</p>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <label className="text-xs text-neutral-500">Supplier *</label>
                <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full mt-1 h-11 rounded-xl border border-neutral-200 px-3 text-sm bg-white focus:outline-none focus:border-[#FF9000]">
                  <option value="">Select supplier…</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-neutral-500">Payment status</label>
                <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className="w-full mt-1 h-11 rounded-xl border border-neutral-200 px-3 text-sm bg-white focus:outline-none focus:border-[#FF9000]">
                  <option value="UNPAID">Unpaid</option>
                  <option value="PARTIAL">Partial</option>
                  <option value="PAID">Paid</option>
                </select>
              </div>
            </div>

            <p className="text-xs text-neutral-500 mt-4 mb-2">Items</p>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {items.map((it, i) => (
                <div key={i} className="rounded-2xl bg-neutral-50 p-3">
                  <div className="flex gap-2">
                    <select value={it.product_id} onChange={(e) => setItem(i, "product_id", e.target.value)}
                      className="flex-1 h-11 rounded-xl border border-neutral-200 px-3 text-sm bg-white focus:outline-none focus:border-[#FF9000]">
                      <option value="">Select product…</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input type="number" min="1" value={it.quantity} onChange={(e) => setItem(i, "quantity", e.target.value)} placeholder="Qty"
                      className="w-20 h-11 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:border-[#FF9000]" />
                    <input type="number" min="0" step="0.01" value={it.unit_cost} onChange={(e) => setItem(i, "unit_cost", e.target.value)} placeholder="Unit cost"
                      className="w-28 h-11 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:border-[#FF9000]" />
                    <button onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))} className="w-11 h-11 rounded-xl bg-white border border-neutral-200 flex items-center justify-center text-neutral-400 hover:text-[#D9624A] cursor-pointer">
                      <Trash2 size={15} />
                    </button>
                  </div>
                  {tracked(it.product_id) && (
                    <textarea value={it.identifiers} onChange={(e) => setItem(i, "identifiers", e.target.value)}
                      placeholder="Enter IMEI/serial numbers — one per line (must match quantity)"
                      className="w-full mt-2 h-20 rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-[#FF9000]" />
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setItems((prev) => [...prev, { ...emptyItem }])} className="mt-2 flex items-center gap-1.5 text-sm text-neutral-500 hover:text-[#111111] cursor-pointer border-none bg-transparent px-0">
              <Plus size={14} /> Add another product
            </button>

            <div className="mt-3">
              <label className="text-xs text-neutral-500">Notes</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional"
                className="w-full mt-1 h-11 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:border-[#FF9000]" />
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setOpen(false)} className="flex-1 h-12 rounded-full bg-neutral-100 text-sm text-[#111111] cursor-pointer border-none">Cancel</button>
              <button disabled={busy} onClick={submit} className="flex-1 h-12 rounded-full bg-[#111111] text-white text-sm cursor-pointer border-none disabled:opacity-40">
                {busy ? "Receiving…" : "Receive Stock"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
