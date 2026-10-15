import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { localStore } from "@/api/localStore";
import { useToast } from "@/components/ui/use-toast";
import { formatGhs, formatDateTime } from "@/lib/format";
import { Plus, Trash2, Truck, Hash, CheckCircle2, Clock3, ChevronDown, ChevronUp } from "lucide-react";

const emptyItem = { product_id: "", quantity: "", unit_cost: "", identifiers: "", defer_identifiers: false };

// ── Pending-unit assignment panel ─────────────────────────────────────────────
// Shows purchases that have tracked products with missing IMEI/serial numbers
// so the user can come back later and assign them.
function PendingUnitsPanel({ products, onRefresh }) {
  const { toast } = useToast();
  const [rows, setRows] = useState([]); // { purchase, item, product, missing }
  const [inputs, setInputs] = useState({}); // purchaseItemKey → textarea value
  const [busy, setBusy] = useState({});

  useEffect(() => {
    localStore.entities.Purchase.list("-created_date", 200).then((purchases) => {
      const pending = [];
      purchases.forEach((p) => {
        (p.items || []).forEach((it, idx) => {
          const prod = products.find((pr) => pr.id === it.product_id);
          if (!prod) return;
          if (!prod.track_imei && !prod.track_serial) return;
          const assigned = (it.unit_identifiers || []).filter(Boolean).length;
          const missing = (it.quantity || 0) - assigned;
          if (missing > 0) {
            pending.push({ purchase: p, item: it, itemIdx: idx, product: prod, missing });
          }
        });
      });
      setRows(pending);
    });
  }, [products]);

  if (rows.length === 0) return null;

  const key = (r) => `${r.purchase.id}-${r.itemIdx}`;

  const assign = async (row) => {
    const k = key(row);
    const raw = (inputs[k] || "").split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    if (raw.length === 0) { toast({ title: "No identifiers entered", variant: "destructive" }); return; }
    if (raw.length > row.missing) {
      toast({ title: `Too many — only ${row.missing} unit(s) still pending`, variant: "destructive" });
      return;
    }
    setBusy((b) => ({ ...b, [k]: true }));
    try {
      // Merge new identifiers into the existing item
      const existing = (row.item.unit_identifiers || []).filter(Boolean);
      const merged = [...existing, ...raw];
      await localStore.functions.invoke("assignPurchaseIdentifiers", {
        purchase_id: row.purchase.id,
        item_index: row.itemIdx,
        unit_identifiers: merged,
      });
      toast({ title: "Identifiers assigned", description: `${raw.length} unit(s) linked to ${row.product.name}` });
      setInputs((prev) => ({ ...prev, [k]: "" }));
      onRefresh();
    } catch (err) {
      toast({ title: "Failed to assign", description: err.message, variant: "destructive" });
    } finally {
      setBusy((b) => ({ ...b, [k]: false }));
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Clock3 size={17} className="text-amber-600" />
        <p className="text-sm font-semibold text-amber-800">
          Pending IMEI / Serial Numbers ({rows.length} product line{rows.length !== 1 ? "s" : ""})
        </p>
      </div>
      <div className="space-y-4">
        {rows.map((row) => {
          const k = key(row);
          return (
            <div key={k} className="bg-white rounded-2xl p-4 border border-amber-100">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="text-sm font-medium text-[#111111]">{row.product.name}</p>
                  <p className="text-xs text-neutral-500">
                    PO: {row.purchase.purchase_number} · {formatDateTime(row.purchase.created_date)}
                  </p>
                  <p className="text-xs text-amber-700 font-medium mt-0.5">
                    {row.missing} {row.product.track_imei ? "IMEI" : "serial"}{row.missing !== 1 ? "s" : ""} still needed
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 shrink-0">
                  {row.product.track_imei ? "IMEI" : "SERIAL"}
                </span>
              </div>
              <textarea
                value={inputs[k] || ""}
                onChange={(e) => setInputs((prev) => ({ ...prev, [k]: e.target.value }))}
                placeholder={`Enter ${row.product.track_imei ? "IMEI" : "serial"} numbers — one per line or comma-separated (up to ${row.missing})`}
                rows={3}
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-[#FF9000] resize-none"
              />
              <button
                disabled={busy[k] || !inputs[k]?.trim()}
                onClick={() => assign(row)}
                className="mt-2 h-9 px-4 rounded-xl bg-[#111111] text-white text-xs font-medium cursor-pointer border-none disabled:opacity-40 flex items-center gap-1.5"
              >
                <CheckCircle2 size={13} />
                {busy[k] ? "Saving…" : "Assign"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

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
  const isTracked = (id) => { const p = productById(id); return p && (p.track_imei || p.track_serial); };
  const trackLabel = (id) => { const p = productById(id); return p?.track_imei ? "IMEI" : "Serial"; };

  const submit = async () => {
    const clean = items
      .filter((it) => it.product_id && Number(it.quantity) > 0)
      .map((it) => {
        const qty = Number(it.quantity);
        const ids = it.identifiers.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
        // Validate: if identifiers provided and not deferred, count must match
        if (isTracked(it.product_id) && !it.defer_identifiers && ids.length > 0 && ids.length !== qty) {
          throw new Error(
            `${productById(it.product_id)?.name}: entered ${ids.length} identifier(s) but quantity is ${qty}. Either match the count or tick "Enter later".`
          );
        }
        return {
          product_id: it.product_id,
          quantity: qty,
          unit_cost: Number(it.unit_cost) || 0,
          unit_identifiers: it.defer_identifiers ? [] : ids,
        };
      });

    if (!supplierId) { toast({ title: "Select a supplier", variant: "destructive" }); return; }
    if (clean.length === 0) { toast({ title: "Add at least one product", variant: "destructive" }); return; }

    setBusy(true);
    try {
      const res = await localStore.functions.invoke("createPurchase", {
        supplier_id: supplierId, items: clean, payment_status: paymentStatus, notes,
      });
      if (res.data?.error) throw new Error(res.data.error);

      const hasPending = items.some(
        (it) => it.product_id && isTracked(it.product_id) && it.defer_identifiers
      );
      toast({
        title: "Stock received",
        description: hasPending
          ? "Inventory updated. Some IMEI/serial numbers are pending — assign them from the Pending panel."
          : "Inventory updated with a ledger entry.",
      });
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

      {/* ── Pending IMEI/serial panel ── */}
      <PendingUnitsPanel products={products} onRefresh={refresh} />

      {/* ── Purchase list ── */}
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
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className="text-sm font-medium text-[#111111]">{formatGhs(p.total)}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
                    background: p.payment_status === "PAID" ? "#EFF6EC" : "#FFF3E6",
                    color: p.payment_status === "PAID" ? "#616E5D" : "#D9624A",
                  }}>{p.payment_status}</span>
                </div>
                {expanded === p.id ? <ChevronUp size={16} className="text-neutral-400" /> : <ChevronDown size={16} className="text-neutral-400" />}
              </div>
            </button>
            {expanded === p.id && (
              <div className="px-5 pb-4 bg-neutral-50/60">
                {(p.items || []).map((it, i) => {
                  const assigned = (it.unit_identifiers || []).filter(Boolean).length;
                  const prod = products.find((pr) => pr.id === it.product_id);
                  const needsTracking = prod && (prod.track_imei || prod.track_serial);
                  const missing = needsTracking ? (it.quantity - assigned) : 0;
                  return (
                    <div key={i} className="flex items-start justify-between py-2 border-b border-neutral-100 last:border-0">
                      <div>
                        <p className="text-sm text-[#111111]">{it.product_name}</p>
                        <p className="text-xs text-neutral-500">{it.quantity} × {formatGhs(it.unit_cost)}</p>
                        {(it.unit_identifiers || []).length > 0 && (
                          <p className="text-xs text-neutral-400 mt-0.5">Units: {it.unit_identifiers.join(", ")}</p>
                        )}
                        {missing > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 mt-1">
                            <Clock3 size={10} /> {missing} {prod.track_imei ? "IMEI" : "serial"}{missing !== 1 ? "s" : ""} pending
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-[#111111]">{formatGhs(it.total_cost)}</p>
                    </div>
                  );
                })}
                {p.notes && <p className="text-xs text-neutral-500 mt-2">Notes: {p.notes}</p>}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── New Purchase modal ── */}
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
            <div className="space-y-3 max-h-96 overflow-y-auto">
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

                  {/* IMEI / Serial section — shown for tracked products */}
                  {isTracked(it.product_id) && (
                    <div className="mt-2 space-y-2">
                      {/* Defer toggle */}
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={it.defer_identifiers}
                          onChange={(e) => setItem(i, "defer_identifiers", e.target.checked)}
                          className="accent-[#FF9000] w-4 h-4 cursor-pointer" />
                        <span className="text-xs text-neutral-600">
                          Enter {trackLabel(it.product_id)} numbers later (save purchase now)
                        </span>
                      </label>

                      {/* Identifier textarea — hidden when deferred */}
                      {!it.defer_identifiers && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <Hash size={12} className="text-neutral-400" />
                            <span className="text-xs text-neutral-500">
                              {trackLabel(it.product_id)} numbers — one per line or comma-separated
                              {it.quantity ? ` (${it.quantity} required)` : ""}
                            </span>
                          </div>
                          <textarea value={it.identifiers} onChange={(e) => setItem(i, "identifiers", e.target.value)}
                            placeholder={`e.g. 352001234567890${it.quantity > 1 ? "\n352009876543210" : ""}`}
                            rows={Math.min(5, Math.max(2, Number(it.quantity) || 2))}
                            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-[#FF9000] resize-none font-mono text-xs" />
                          {it.quantity && it.identifiers && (() => {
                            const count = it.identifiers.split(/[\n,]/).map((s) => s.trim()).filter(Boolean).length;
                            const needed = Number(it.quantity);
                            if (count === 0) return null;
                            return (
                              <p className={`text-[10px] mt-1 font-medium ${count === needed ? "text-emerald-600" : "text-amber-600"}`}>
                                {count}/{needed} entered{count === needed ? " ✓" : " — must match quantity"}
                              </p>
                            );
                          })()}
                        </div>
                      )}

                      {it.defer_identifiers && (
                        <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                          Stock will be added now. Assign {trackLabel(it.product_id)} numbers from the <strong>Pending</strong> panel after receiving the goods.
                        </p>
                      )}
                    </div>
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
