import { useState, useEffect, useMemo, useRef } from "react";
import { localStore } from "@/api/localStore";
import { useToast } from "@/components/ui/use-toast";
import { formatGhs, clientTxId } from "@/lib/format";
import PaymentModal from "@/components/pos/PaymentModal";
import UnitPicker from "@/components/pos/UnitPicker";
import ReceiptModal from "@/components/ReceiptModal";
import SaleReturnDialog from "@/components/SaleReturnDialog";
import CameraScannerModal from "@/components/pos/CameraScannerModal";
import ProductGrid from "@/components/pos/ProductGrid";
import { Search, Trash2, Plus, Minus, UserPlus, X, ShoppingCart, ArrowLeftRight, Camera, Undo2 } from "lucide-react";

export default function POS() {
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
  const [changingLineKey, setChangingLineKey] = useState(null);
  const [payOpen, setPayOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receiptSale, setReceiptSale] = useState(null);
  const [newCust, setNewCust] = useState({ open: false, name: "", phone: "" });
  const [cameraOpen, setCameraOpen] = useState(false);
  const [returnLookupOpen, setReturnLookupOpen] = useState(false);
  const [returnReceiptQuery, setReturnReceiptQuery] = useState("");
  const [returnSale, setReturnSale] = useState(null);
  const [returning, setReturning] = useState(false);
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(() => {
    return localStorage.getItem("dhv_auto_print") === "true";
  });
  const searchRef = useRef(null);

  const lookupSaleForReturn = async (saleNum) => {
    const term = (saleNum || returnReceiptQuery).trim().toLowerCase();
    if (!term) return;
    try {
      const allSales = await localStore.entities.Sale.list("-created_date", 200);
      const found = allSales.find(
        (s) => s.sale_number?.toLowerCase() === term || s.id === term
      );
      if (!found) {
        toast({ title: "Sale not found", description: `No sale found matching "${term}"`, variant: "destructive" });
        return;
      }
      if (found.status !== "COMPLETED") {
        toast({ title: "Sale not eligible", description: `Sale status is ${found.status}`, variant: "destructive" });
        return;
      }
      setReturnSale(found);
      setReturnLookupOpen(false);
      setReturnReceiptQuery("");
    } catch (err) {
      toast({ title: "Lookup failed", description: err.message, variant: "destructive" });
    }
  };

  const approveReturn = async (payload) => {
    setReturning(true);
    try {
      const result = await localStore.functions.invoke("returnSale", payload);
      if (result.data?.error) throw new Error(result.data.error);
      setReturnSale(null);
      refresh();
      toast({ title: "Return recorded", description: "The items have been returned to inventory." });
    } catch (error) {
      toast({ title: "Return failed", description: error.message, variant: "destructive" });
    } finally {
      setReturning(false);
    }
  };

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

  const scanBufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);

  const processScannedCode = async (rawCode) => {
    const code = rawCode.trim();
    if (!code) return;

    // 1. Check if the scanned code matches an in-stock IMEI or Serial unit
    try {
      const allUnits = await localStore.entities.ProductUnit.list();
      const matchingUnit = allUnits.find(
        (u) =>
          u.status === "IN_STOCK" &&
          [u.imei_1, u.imei_2, u.serial_number].some(
            (id) => id && id.toLowerCase() === code.toLowerCase()
          )
      );

      if (matchingUnit) {
        const prod = products.find((p) => p.id === matchingUnit.product_id);
        if (prod) {
          addLine(prod, matchingUnit);
          toast({
            title: "Unit Scanned",
            description: `${prod.name} (${matchingUnit.imei_1 || matchingUnit.serial_number}) added to cart`,
          });
          return;
        }
      }
    } catch {
      // Continue to product lookup
    }

    // 2. Check if code matches barcode or SKU of an active product
    const exactProduct = activeProducts.find(
      (p) =>
        (p.barcode && p.barcode.toLowerCase() === code.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase() === code.toLowerCase())
    );

    if (exactProduct) {
      await handleAdd(exactProduct);
      toast({
        title: "Product Scanned",
        description: `${exactProduct.name} added`,
      });
      return;
    }

    // 3. Fallback: match by title or top filtered result
    const target = results[0] || activeProducts.find((p) => p.name.toLowerCase().includes(code.toLowerCase()));
    if (target) {
      await handleAdd(target);
      toast({ title: "Product Added", description: target.name });
    } else {
      toast({ title: "Code not recognized", description: code, variant: "destructive" });
    }
  };

  useEffect(() => {
    const onKeyDown = async (e) => {
      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (e.key === "Enter") {
        const code = scanBufferRef.current.trim();
        scanBufferRef.current = "";
        if (code.length >= 3) {
          e.preventDefault();
          await processScannedCode(code);
        }
        return;
      }

      if (e.key.length === 1) {
        const activeEl = document.activeElement;
        const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes(activeEl?.tagName);
        // If typing slowly in a text input other than search, don't capture as scanner
        if (isInput && activeEl !== searchRef.current && timeDiff > 80 && scanBufferRef.current.length === 0) {
          return;
        }

        if (timeDiff > 120 && scanBufferRef.current.length > 0) {
          scanBufferRef.current = e.key;
        } else {
          scanBufferRef.current += e.key;
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeProducts, products, results]);

  const onSearchKey = async (e) => {
    if (e.key !== "Enter" || !query.trim()) return;
    await processScannedCode(query);
    setQuery("");
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

  const clearCart = () => {
    if (cart.length === 0) return;
    setCart([]);
    setSaleDiscount("");
    toast({ title: "Cart cleared" });
  };

  const handleReplaceLine = (line) => {
    removeLine(line.key);
    setQuery("");
    searchRef.current?.focus();
    toast({ title: "Item Removed", description: `Search or scan a replacement for ${line.product_name}` });
  };

  const handleChangeUnit = async (line) => {
    const product = products.find((p) => p.id === line.product_id);
    if (!product) return;
    try {
      const inStockUnits = await localStore.entities.ProductUnit.filter({ product_id: product.id, status: "IN_STOCK" });
      const availableUnits = inStockUnits.filter(
        (u) => u.id === line.unit_id || !cart.some((l) => l.unit_id === u.id)
      );
      if (availableUnits.length === 0) {
        toast({ title: "No other units in stock", description: product.name, variant: "destructive" });
        return;
      }
      setPickerProduct(product);
      setPickerUnits(availableUnits);
      setChangingLineKey(line.key);
    } catch {
      toast({ title: "Could not fetch units", variant: "destructive" });
    }
  };

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
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-3 rounded-full bg-neutral-100 px-4 h-13 py-3.5">
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
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className="h-13 px-4 rounded-full bg-white border border-neutral-200 text-neutral-700 hover:text-[#111111] hover:border-[#FF9000] flex items-center gap-2 text-xs font-semibold cursor-pointer shadow-sm transition-colors shrink-0"
              title="Scan Barcode / IMEI with Camera"
            >
              <Camera size={16} className="text-[#FF9000]" />
              <span className="hidden sm:inline">Camera</span>
            </button>
            <button
              type="button"
              onClick={() => setReturnLookupOpen(true)}
              className="h-13 px-4 rounded-full bg-white border border-neutral-200 text-neutral-700 hover:text-[#111111] hover:border-[#FF9000] flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-sm transition-colors shrink-0"
              title="Process a Return / Refund"
            >
              <Undo2 size={15} />
              <span className="hidden sm:inline">Returns</span>
            </button>
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
      </div>

      {/* Right: Order ticket & checkout panel */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-4 self-start">
        {/* Order Items Cart */}
        <div className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <ShoppingCart size={16} className="text-[#FF9000]" />
              <h2 className="text-sm font-semibold text-[#111111]">Current Order</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 font-medium">
                {cart.reduce((s, l) => s + l.quantity, 0)} items
              </span>
            </div>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="text-xs text-neutral-400 hover:text-[#D9624A] flex items-center gap-1 cursor-pointer border-none bg-transparent p-0 transition-colors"
                title="Clear entire cart"
              >
                <Trash2 size={13} /> Clear
              </button>
            )}
          </div>

          {/* Cart items list */}
          {cart.length === 0 ? (
            <div className="py-10 text-center text-neutral-400 flex flex-col items-center justify-center">
              <ShoppingCart size={28} className="text-neutral-200 mb-2 stroke-[1.5]" />
              <p className="text-sm font-medium text-neutral-500">Cart is empty</p>
              <p className="text-xs text-neutral-400 mt-1 max-w-[200px]">
                Scan barcode/IMEI or click an item from the catalog to start.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 max-h-[340px] overflow-y-auto my-2 pr-1">
              {cart.map((l) => (
                <div key={l.key} className="py-3 flex flex-col gap-1.5 group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#111111] leading-snug truncate" title={l.product_name}>
                        {l.product_name}
                      </p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {formatGhs(l.unit_price)} each
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-[#111111] shrink-0">
                      {formatGhs(l.quantity * l.unit_price)}
                    </span>
                  </div>

                  {/* IMEI tag & controls */}
                  <div className="flex items-center justify-between gap-2 mt-1">
                    {l.unit_id ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center text-[11px] font-mono bg-orange-50 text-orange-800 border border-orange-200/60 px-2 py-0.5 rounded-md">
                          IMEI: {l.identifier}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleChangeUnit(l)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-600 hover:text-[#111111] bg-neutral-100 hover:bg-neutral-200 px-2 py-0.5 rounded-md cursor-pointer border-none transition-colors"
                          title="Select a different IMEI/serial unit"
                        >
                          <ArrowLeftRight size={11} /> Change IMEI
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => changeQty(l.key, -1)}
                          className="w-7 h-7 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center cursor-pointer border-none transition-colors"
                          title="Decrease quantity"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-xs font-semibold w-6 text-center text-[#111111]">{l.quantity}</span>
                        <button
                          onClick={() => changeQty(l.key, 1)}
                          className="w-7 h-7 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center cursor-pointer border-none transition-colors"
                          title="Increase quantity"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleReplaceLine(l)}
                        className="text-xs text-neutral-400 hover:text-neutral-700 cursor-pointer border-none bg-transparent p-0 transition-colors"
                        title="Replace this item"
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={() => removeLine(l.key)}
                        className="p-1 rounded-md text-neutral-300 hover:text-[#D9624A] hover:bg-red-50 cursor-pointer border-none bg-transparent transition-colors"
                        title="Remove item from order"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pricing & totals inside order card */}
          <div className="pt-3 border-t border-neutral-100 space-y-2 text-xs">
            <div className="flex justify-between text-neutral-500">
              <span>Subtotal</span>
              <span className="font-medium text-[#111111]">{formatGhs(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-neutral-500">
              <span>Discount</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={saleDiscount}
                onChange={(e) => setSaleDiscount(e.target.value)}
                placeholder="0.00"
                className="w-24 h-7 rounded-md border border-neutral-200 px-2 text-right text-xs focus:outline-none focus:border-[#FF9000]"
              />
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-neutral-100">
              <span className="text-sm font-semibold text-[#111111]">Total Due</span>
              <span className="text-xl font-bold text-[#111111]">{formatGhs(total)}</span>
            </div>
          </div>
        </div>

        {/* Customer & Checkout */}
        <div className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-sm">
          <label className="text-xs text-neutral-500 block mb-1">Customer (for credit &amp; history)</label>
          <select
            value={customer?.id || ""}
            onChange={(e) => setCustomer(customers.find((c) => c.id === e.target.value) || null)}
            className="w-full h-11 rounded-xl border border-neutral-200 px-3 text-sm bg-white focus:outline-none focus:border-[#FF9000]"
          >
            <option value="">Walk-in Customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.current_balance ? ` · owes ${formatGhs(c.current_balance)}` : ""}
              </option>
            ))}
          </select>
          <button
            onClick={() => setNewCust({ ...newCust, open: true })}
            className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500 hover:text-[#111111] cursor-pointer border-none bg-transparent px-0"
          >
            <UserPlus size={13} /> New customer
          </button>

          <button
            disabled={cart.length === 0}
            onClick={() => setPayOpen(true)}
            className="w-full mt-4 h-13 py-3.5 rounded-full bg-[#FF9000] text-[#111111] font-semibold text-sm cursor-pointer border-none disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#ff9d2e] transition-colors shadow-sm"
          >
            Checkout · {formatGhs(total)}
          </button>

          <label className="flex items-center justify-center gap-2 mt-3 cursor-pointer select-none text-xs text-neutral-500 hover:text-neutral-700">
            <input
              type="checkbox"
              checked={autoPrintReceipt}
              onChange={(e) => {
                const next = e.target.checked;
                setAutoPrintReceipt(next);
                localStorage.setItem("dhv_auto_print", String(next));
              }}
              className="accent-[#111111] rounded cursor-pointer"
            />
            <span>Auto-print receipt after sale</span>
          </label>
        </div>
      </div>

      {/* Modals */}
      <UnitPicker
        open={!!pickerUnits}
        units={pickerUnits || []}
        onClose={() => { setPickerUnits(null); setPickerProduct(null); setChangingLineKey(null); }}
        onPick={(unit) => {
          if (changingLineKey) {
            setCart((prev) => prev.map((l) => {
              if (l.key === changingLineKey) {
                return {
                  ...l,
                  key: unit.id,
                  unit_id: unit.id,
                  identifier: unit.imei_1 || unit.serial_number,
                  unit_ids: [unit.id],
                };
              }
              return l;
            }));
            toast({ title: "IMEI Unit Updated", description: `${pickerProduct.name}: ${unit.imei_1 || unit.serial_number}` });
            setChangingLineKey(null);
          } else {
            addLine(pickerProduct, unit);
          }
          setPickerUnits(null);
          setPickerProduct(null);
          searchRef.current?.focus();
        }}
      />
      <PaymentModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        total={total}
        customer={customer}
        submitting={submitting}
        onConfirm={completeSale}
      />
      <ReceiptModal
        open={!!receiptSale}
        sale={receiptSale}
        autoPrint={autoPrintReceipt}
        onClose={() => setReceiptSale(null)}
        onReturn={() => setReturnSale(receiptSale)}
      />

      {/* Camera Barcode / IMEI / QR Scanner */}
      <CameraScannerModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onScan={async (code) => {
          await processScannedCode(code);
        }}
      />

      {/* Lookup Sale for Return Modal */}
      {returnLookupOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setReturnLookupOpen(false)}
        >
          <div
            className="bg-white rounded-3xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <p className="text-base font-semibold text-[#111111] flex items-center gap-2">
                <Undo2 size={16} className="text-[#FF9000]" /> Return Sale
              </p>
              <button
                onClick={() => setReturnLookupOpen(false)}
                className="text-neutral-400 hover:text-[#111111] border-none bg-transparent cursor-pointer p-1"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-neutral-500 mb-3">
              Enter or scan the receipt / sale number from the customer's receipt slip.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                lookupSaleForReturn();
              }}
              className="space-y-3"
            >
              <input
                autoFocus
                value={returnReceiptQuery}
                onChange={(e) => setReturnReceiptQuery(e.target.value)}
                placeholder="e.g. ANB-SALE-1729..."
                className="w-full h-11 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:border-[#FF9000]"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReturnLookupOpen(false)}
                  className="flex-1 h-11 rounded-full border border-neutral-200 text-xs font-medium cursor-pointer bg-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!returnReceiptQuery.trim()}
                  className="flex-1 h-11 rounded-full bg-[#111111] text-white text-xs font-semibold cursor-pointer border-none disabled:opacity-40 hover:bg-neutral-800 transition-colors"
                >
                  Find Sale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sale Return Dialog */}
      <SaleReturnDialog
        open={!!returnSale}
        sale={returnSale}
        onClose={() => setReturnSale(null)}
        onConfirm={approveReturn}
        submitting={returning}
      />

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
