import { useState, useEffect, useMemo, useRef } from "react";
import { localStore } from "@/api/localStore";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { formatGhs, clientTxId } from "@/lib/format";
import PaymentModal from "@/components/pos/PaymentModal";
import UnitPicker from "@/components/pos/UnitPicker";
import ReceiptModal from "@/components/ReceiptModal";
import ProductGrid from "@/components/pos/ProductGrid";
import { Search, Trash2, Plus, Minus, UserPlus, X } from "lucide-react";

export default function POS() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [saleDiscount, setSaleDiscount] = useState("");
  const [loading, setLoading] = useState(true);
  const [pickerUnits, setPickerUnits] = useState(null);
  const [pickerProduct, setPickerProduct] = useState(null);
  const [payOpen, setPayOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receiptSale, setReceiptSale] = useState(null);
  const [newCust, setNewCust] = useState({ open: false, name: "", phone: "" });
  const searchRef = useRef(null);

  const refresh = () => {
    Promise.all([localStore.entities.Product.list(), localStore.entities.Customer.list()])
      .then(([p, c]) => { setProducts(p); setCustomers(c); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(refresh, []);

  const activeProducts = useMemo(
    () => products.filter((p) => p.status === "active" && (p.current_stock || 0) > 0),
    [products]
  );

  const matchingProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeProducts;
    return activeProducts
      .filter((p) =>
        [p.name, p.sku, p.barcode, p.brand, p.model, p.category].some((f) => f && String(f).toLowerCase().includes(q))
      );
  }, [query, activeProducts]);
  const results = matchingProducts.slice(0, 8);
  const displayedProducts = query ? matchingProducts : activeProducts.slice(0, 48);

  const subtotal = cart.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const discountNum = Math.min(Math.max(0, Number(saleDiscount) || 0), subtotal);
  const total = subtotal - discountNum;

  const addLine = (product, unit = null) => {
    setCart((prev) => {
      if (unit) {
        if (prev.some((l) => l.unit_id === unit.id)) return prev;
        return [...prev, {
          key: unit.id, product_id: product.id, product_name: product.name,
          unit_id: unit.id, identifier: unit.imei_1 || unit.serial_number,
          unit_ids: [unit.id], quantity: 1, unit_price: product.selling_price, unit_cost: product.cost_price,
        }];
      }
      const existing = prev.find((l) => l.product_id === product.id && !l.unit_id);
      if (existing) {
        return prev.map((l) =>
          l === existing ? { ...l, quantity: Math.min(l.quantity + 1, product.current_stock || 0) } : l
        );
      }
      return [...prev, {
        key: product.id, product_id: product.id, product_name: product.name,
        unit_id: null, identifier: "", unit_ids: [], quantity: 1,
        unit_price: product.selling_price, unit_cost: product.cost_price,
      }];
    });
    setQuery("");
  };

  const handleAdd = async (product) => {
    if (product.track_imei || product.track_serial) {
      const units = await localStore.entities.ProductUnit.filter({ product_id: product.id, status: "IN_STOCK" });
      if (units.length === 0) {
        toast({ title: "No units in stock", description: product.name, variant: "destructive" });
        return;
      }
      setPickerProduct(product);
      setPickerUnits(units);
    } else {
      addLine(product);
    }
  };

  // Barcode scanners "type" the code and press Enter.
  const onSearchKey = async (e) => {
    if (e.key !== "Enter" || !query.trim()) return;
    const q = query.trim().toLowerCase();
    const exact = activeProducts.find((p) => p.barcode?.toLowerCase() === q || p.sku?.toLowerCase() === q);
    const target = exact || results[0];
    if (target) await handleAdd(target);
    else toast({ title: "No product found", description: query, variant: "destructive" });
  };

  const changeQty = (key, delta) => {
    setCart((prev) => prev.map((l) => {
      if (l.key !== key) return l;
      const max = products.find((p) => p.id === l.product_id)?.current_stock || 99;
      const q = Math.max(1, Math.min(l.quantity + delta, max));
      return { ...l, quantity: q };
    }));
  };

  const removeLine = (key) => setCart((prev) => prev.filter((l) => l.key !== key));

  const completeSale = async (payments) => {
    setSubmitting(true);
    try {
      const res = await localStore.functions.invoke("createSale", {
        items: cart.map((l) => ({ product_id: l.product_id, unit_ids: l.unit_ids, quantity: l.quantity, discount: 0 })),
        sale_discount: discountNum,
        customer_id: customer?.id || null,
        payments,
        client_transaction_id: clientTxId(),
      });
      const sale = res.data?.sale;
      if (!sale) throw new Error(res.data?.error || "Sale failed");
      setReceiptSale(sale);
      setPayOpen(false);
      setCart([]);
      setCustomer(null);
      setSaleDiscount("");
      refresh();
    } catch (err) {
      toast({ title: "Sale failed", description: err.response?.data?.error || err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const createCustomer = async () => {
    if (!newCust.name.trim()) return;
    try {
      const c = await localStore.entities.Customer.create({ name: newCust.name.trim(), phone: newCust.phone.trim() });
      setCustomers((prev) => [...prev, c]);
      setCustomer(c);
      setNewCust({ open: false, name: "", phone: "" });
    } catch (err) {
      toast({ title: "Could not create customer", description: err.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <div className="w-8 h-8 border-4 border-figma-accent border-t-[#111111] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-4">
      {/* Left: search + product results */}
      <div className="flex flex-col gap-4">
        <div className="bg-white rounded-3xl p-4">
          <div className="flex items-center gap-3 rounded-full bg-neutral-100 px-4 h-13 py-3.5">
            <Search size={18} className="text-neutral-400 shrink-0" />
            <input
              ref={searchRef}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKey}
              placeholder="Scan barcode or search product / SKU…"
              className="w-full bg-transparent text-sm focus:outline-none border-none"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-neutral-400 hover:text-[#111111] cursor-pointer border-none bg-transparent">
                <X size={15} />
              </button>
            )}
          </div>
          {query && results.length > 0 && (
            <div className="mt-3 rounded-2xl border border-neutral-100 overflow-hidden">
              {results.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 last:border-0 hover:bg-orange-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#111111] truncate">{p.name}</p>
                    <p className="text-xs text-neutral-500">{p.sku} · {p.current_stock} in stock{(p.track_imei || p.track_serial) ? " · unit tracked" : ""}</p>
                  </div>
                  <button onClick={() => handleAdd(p)} className="h-9 px-4 rounded-full bg-[#FF9000] text-xs font-medium text-[#111111] cursor-pointer border-none shrink-0">
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
          {query && results.length === 0 && (
            <p className="text-sm text-neutral-400 mt-4 px-2">No matching products in stock.</p>
          )}
        </div>

        <ProductGrid products={displayedProducts} onAdd={handleAdd} totalProducts={activeProducts.length} isSearching={Boolean(query)} />

        {/* Cart lines */}
        {cart.length > 0 && (
          <div className="bg-white rounded-3xl overflow-hidden">
            {cart.map((l) => (
              <div key={l.key} className="flex items-center gap-3 px-4 py-3 border-b border-neutral-100 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#111111] truncate">{l.product_name}</p>
                  {l.identifier && <p className="text-xs text-neutral-500">{l.identifier}</p>}
                  <p className="text-xs text-neutral-500">{formatGhs(l.unit_price)} each</p>
                </div>
                {!l.unit_id && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => changeQty(l.key, -1)} className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center cursor-pointer border-none"><Minus size={13} /></button>
                    <span className="text-sm font-medium w-6 text-center">{l.quantity}</span>
                    <button onClick={() => changeQty(l.key, 1)} className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center cursor-pointer border-none"><Plus size={13} /></button>
                  </div>
                )}
                <p className="text-sm font-medium w-28 text-right shrink-0">{formatGhs(l.quantity * l.unit_price)}</p>
                <button onClick={() => removeLine(l.key)} className="text-neutral-300 hover:text-[#D9624A] cursor-pointer border-none bg-transparent shrink-0"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: checkout panel */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-16 self-start">
        <div className="bg-[#111111] rounded-3xl p-5 text-white">
          <p className="text-xs opacity-70">Current Sale</p>
          <p className="text-4xl font-light font-heading mt-3">{formatGhs(total)}</p>

          <div className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between opacity-80"><span>Subtotal</span><span>{formatGhs(subtotal)}</span></div>
            <div className="flex items-center justify-between opacity-80">
              <span>Discount</span>
              <input
                type="number" min="0" step="0.01" value={saleDiscount}
                onChange={(e) => setSaleDiscount(e.target.value)}
                placeholder="0.00"
                className="w-24 h-8 rounded-lg bg-white/10 px-2 text-right focus:outline-none focus:ring-1 focus:ring-[#FF9000] border-none" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5">
          <p className="text-xs text-neutral-500">Customer (for credit &amp; history)</p>
          <select
            value={customer?.id || ""}
            onChange={(e) => setCustomer(customers.find((c) => c.id === e.target.value) || null)}
            className="w-full mt-2 h-11 rounded-xl border border-neutral-200 px-3 text-sm bg-white focus:outline-none focus:border-[#FF9000]">
            <option value="">Walk-in Customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.current_balance ? ` · owes ${formatGhs(c.current_balance)}` : ""}</option>
            ))}
          </select>
          <button
            onClick={() => setNewCust({ ...newCust, open: true })}
            className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500 hover:text-[#111111] cursor-pointer border-none bg-transparent px-0">
            <UserPlus size={13} /> New customer
          </button>

          <button
            disabled={cart.length === 0}
            onClick={() => setPayOpen(true)}
            className="w-full mt-4 h-13 py-3.5 rounded-full bg-[#FF9000] text-[#111111] font-medium text-sm cursor-pointer border-none disabled:opacity-30 disabled:cursor-not-allowed">
            Checkout · {formatGhs(total)}
          </button>
        </div>
      </div>

      {/* Modals */}
      <UnitPicker
        open={!!pickerUnits}
        units={pickerUnits || []}
        onClose={() => { setPickerUnits(null); setPickerProduct(null); }}
        onPick={(unit) => { addLine(pickerProduct, unit); setPickerUnits(null); setPickerProduct(null); searchRef.current?.focus(); }}
      />
      <PaymentModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        total={total}
        customer={customer}
        submitting={submitting}
        onConfirm={completeSale}
      />
      <ReceiptModal open={!!receiptSale} sale={receiptSale} onClose={() => setReceiptSale(null)} />

      {/* Quick new-customer popover */}
      {newCust.open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setNewCust({ ...newCust, open: false })}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium text-[#111111] mb-3">New Customer</p>
            <input value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} placeholder="Full name"
              className="w-full h-11 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:border-[#FF9000] mb-2" />
            <input value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} placeholder="Phone (optional)"
              className="w-full h-11 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:border-[#FF9000]" />
            <button onClick={createCustomer} className="w-full mt-4 h-11 rounded-full bg-[#111111] text-white text-sm cursor-pointer border-none">Save Customer</button>
          </div>
        </div>
      )}
    </div>
  );
}
