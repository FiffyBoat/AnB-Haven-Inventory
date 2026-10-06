import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { localStore } from "@/api/localStore";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { formatGhs, formatDateTime } from "@/lib/format";
import { ArrowLeft, Package } from "lucide-react";
import ImageUploader from "@/components/ImageUploader";

const REASONS = [
  { value: "OPENING_STOCK", label: "Opening stock (+)" },
  { value: "ADJUSTMENT_IN", label: "Stock count correction (+)" },
  { value: "ADJUSTMENT_OUT", label: "Stock count correction (−)" },
  { value: "DAMAGE", label: "Damaged (−)" },
  { value: "LOST", label: "Lost / stolen (−)" },
];

export default function ProductDetail() {
  const { productId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const isOwner = user?.role === "admin";
  const [product, setProduct] = useState(null);
  const [units, setUnits] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [prices, setPrices] = useState({ cost: "", sell: "" });
  const [adj, setAdj] = useState({ delta: "", reason: "ADJUSTMENT_IN", notes: "" });
  const [unitId, setUnitId] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const p = await localStore.entities.Product.get(productId);
      setProduct(p);
      setPrices({ cost: p.cost_price ?? "", sell: p.selling_price ?? "" });
      const promises = [localStore.entities.StockMovement.filter({ product_id: productId }).catch(() => [])];
      if (p.track_imei || p.track_serial) promises.push(localStore.entities.ProductUnit.filter({ product_id: productId }).catch(() => []));
      const [movs, un] = await Promise.all(promises);
      setMovements(movs.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
      setUnits(un || []);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); }, [productId]);

  const saveImage = async (url) => {
    try {
      await localStore.entities.Product.update(productId, { image_url: url });
      setProduct((p) => ({ ...p, image_url: url }));
      toast({ title: "Product image updated" });
    } catch (err) {
      toast({ title: "Could not update image", description: err.message, variant: "destructive" });
    }
  };

  const savePrices = async () => {
    setBusy(true);
    try {
      await localStore.entities.Product.update(productId, { cost_price: Number(prices.cost) || 0, selling_price: Number(prices.sell) || 0 });
      toast({ title: "Prices updated" });
      refresh();
    } catch (err) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const doAdjust = async () => {
    setBusy(true);
    try {
      const res = await localStore.functions.invoke("adjustStock", { product_id: productId, delta: Number(adj.delta), reason: adj.reason, notes: adj.notes });
      if (res.data?.error) throw new Error(res.data.error);
      toast({ title: "Stock adjusted" });
      setAdj({ delta: "", reason: "ADJUSTMENT_IN", notes: "" });
      refresh();
    } catch (err) {
      toast({ title: "Adjustment failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const addUnit = async () => {
    const ident = unitId.trim();
    if (!ident) return;
    setBusy(true);
    try {
      const dupImei = await localStore.entities.ProductUnit.filter({ imei_1: ident });
      const dupSerial = await localStore.entities.ProductUnit.filter({ serial_number: ident });
      if (dupImei.length > 0 || dupSerial.length > 0) throw new Error(`${ident} is already registered`);
      await localStore.entities.ProductUnit.create({
        product_id: productId, product_name: product.name,
        imei_1: product.track_imei ? ident : "",
        serial_number: product.track_serial ? ident : "",
        status: "IN_STOCK",
      });
      await localStore.functions.invoke("adjustStock", { product_id: productId, delta: 1, reason: "OPENING_STOCK", notes: `Registered unit ${ident}` });
      setUnitId("");
      refresh();
    } catch (err) {
      toast({ title: "Could not add unit", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const markUnit = async (unit, status, reason) => {
    setBusy(true);
    try {
      await localStore.entities.ProductUnit.update(unit.id, { status });
      if (reason) await localStore.functions.invoke("adjustStock", { product_id: productId, delta: -1, reason, notes: `Unit ${unit.imei_1 || unit.serial_number}` });
      refresh();
    } catch (err) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-40">
      <div className="w-8 h-8 border-4 border-figma-accent border-t-[#111111] rounded-full animate-spin" />
    </div>
  );
  if (!product) return (
    <div className="bg-white rounded-3xl p-12 text-center">
      <p className="text-sm text-neutral-400">Product not found. <Link to="/products" className="text-[#FF9000]">Back to products</Link></p>
    </div>
  );

  const stock = product.current_stock || 0;
  const inputCls = "w-full h-11 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:border-[#FF9000]";

  return (
    <div className="flex flex-col gap-4">
      <Link to="/products" className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-[#111111] w-fit">
        <ArrowLeft size={15} /> All products
      </Link>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Info card */}
        <div className="bg-white rounded-3xl p-5">
          <div className="flex gap-4">
            {isOwner ? (
              <div className="w-24 shrink-0">
                <ImageUploader imageUrl={product.image_url} onUploaded={saveImage} label="" />
              </div>
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-neutral-100 flex items-center justify-center shrink-0 overflow-hidden">
                {product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" /> : <Package size={28} className="text-neutral-300" />}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-heading font-light text-[#111111]">{product.name}</h1>
              <p className="text-xs text-neutral-500 mt-1">{product.sku}{product.barcode ? ` · ${product.barcode}` : ""}</p>
              <p className="text-xs text-neutral-500">{[product.category, product.brand, product.model].filter(Boolean).join(" · ")}</p>
              <span className="inline-block mt-2 text-xs px-2.5 py-1 rounded-full font-medium" style={{
                background: stock === 0 ? "#FDEAE6" : stock <= (product.reorder_level || 0) ? "#FFF3E6" : "#EFF6EC",
                color: stock === 0 ? "#F13A15" : stock <= (product.reorder_level || 0) ? "#D9624A" : "#616E5D",
              }}>{stock} in stock{product.track_imei || product.track_serial ? " · unit tracked" : ""}</span>
            </div>
          </div>

          {isOwner && (
            <div className="mt-5 pt-5 border-t border-neutral-100">
              <p className="text-xs text-neutral-500 mb-2">Pricing (owner only)</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-neutral-400">Cost price</label>
                  <input type="number" min="0" step="0.01" value={prices.cost} onChange={(e) => setPrices({ ...prices, cost: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-neutral-400">Selling price</label>
                  <input type="number" min="0" step="0.01" value={prices.sell} onChange={(e) => setPrices({ ...prices, sell: e.target.value })} className={inputCls} />
                </div>
              </div>
              <button disabled={busy} onClick={savePrices} className="mt-3 h-10 px-5 rounded-full bg-[#111111] text-white text-sm cursor-pointer border-none">Save Prices</button>
            </div>
          )}

          {isOwner && (
            <div className="mt-5 pt-5 border-t border-neutral-100">
              <p className="text-xs text-neutral-500 mb-2">Stock adjustment (recorded in the ledger)</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-neutral-400">Quantity (+/−)</label>
                  <input type="number" step="1" value={adj.delta} onChange={(e) => setAdj({ ...adj, delta: e.target.value })} placeholder="e.g. -2" className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-neutral-400">Reason</label>
                  <select value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} className={inputCls + " bg-white"}>
                    {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-neutral-400">Notes</label>
                  <input value={adj.notes} onChange={(e) => setAdj({ ...adj, notes: e.target.value })} placeholder="Why is stock changing?" className={inputCls} />
                </div>
              </div>
              <button disabled={busy || !adj.delta} onClick={doAdjust} className="mt-3 h-10 px-5 rounded-full bg-[#FF9000] text-[#111111] text-sm font-medium cursor-pointer border-none disabled:opacity-40">Apply Adjustment</button>
            </div>
          )}
        </div>

        {/* Units + movements */}
        <div className="flex flex-col gap-4">
          {(product.track_imei || product.track_serial) && (
            <div className="bg-white rounded-3xl p-5">
              <p className="text-sm font-medium text-[#111111]">{product.track_imei ? "IMEI" : "Serial"} Units</p>
              {isOwner && (
                <div className="flex gap-2 mt-3">
                  <input value={unitId} onChange={(e) => setUnitId(e.target.value)}
                    placeholder={product.track_imei ? "Enter IMEI…" : "Enter serial number…"}
                    className="flex-1 h-11 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:border-[#FF9000]" />
                  <button disabled={busy} onClick={addUnit} className="h-11 px-4 rounded-xl bg-[#111111] text-white text-sm cursor-pointer border-none disabled:opacity-40">Add</button>
                </div>
              )}
              <div className="mt-3 max-h-64 overflow-y-auto space-y-1.5">
                {units.length === 0 && <p className="text-xs text-neutral-400 py-3 text-center">No units registered yet.</p>}
                {units.map((u) => (
                  <div key={u.id} className="flex items-center justify-between rounded-xl bg-neutral-50 px-3 py-2">
                    <div>
                      <p className="text-sm text-[#111111]">{u.imei_1 || u.serial_number}</p>
                      <p className="text-xs text-neutral-400">{u.status}</p>
                    </div>
                    {isOwner && u.status === "IN_STOCK" && (
                      <div className="flex gap-1.5">
                        <button onClick={() => markUnit(u, "DAMAGED", "DAMAGE")} className="text-xs px-2.5 py-1 rounded-full bg-[#FDEAE6] text-[#F13A15] cursor-pointer border-none">Damaged</button>
                        <button onClick={() => markUnit(u, "LOST", "LOST")} className="text-xs px-2.5 py-1 rounded-full bg-neutral-200 text-[#111111] cursor-pointer border-none">Lost</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-3xl p-5">
            <p className="text-sm font-medium text-[#111111] mb-2">Stock Ledger</p>
            <div className="max-h-72 overflow-y-auto">
              {movements.length === 0 && <p className="text-xs text-neutral-400 py-3 text-center">No stock movements yet.</p>}
              {movements.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2.5 border-b border-neutral-100 last:border-0">
                  <div>
                    <p className="text-sm text-[#111111]">{m.movement_type.replace(/_/g, " ")}</p>
                    <p className="text-xs text-neutral-400">{formatDateTime(m.created_date)}{m.notes ? ` · ${m.notes}` : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium" style={{ color: m.quantity >= 0 ? "#616E5D" : "#D9624A" }}>{m.quantity >= 0 ? "+" : ""}{m.quantity}</p>
                    <p className="text-xs text-neutral-400">{m.previous_quantity} → {m.new_quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
