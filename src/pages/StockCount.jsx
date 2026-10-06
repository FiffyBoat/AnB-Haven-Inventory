import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Search } from "lucide-react";
import { localStore } from "@/api/localStore";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";

export default function StockCount() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState([]);
  const [counts, setCounts] = useState({});
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = () => localStore.entities.Product.list().then((items) => { setProducts(items.filter((item) => item.status === "active")); setLoading(false); });
  useEffect(() => { refresh().catch(() => setLoading(false)); }, []);

  const countable = useMemo(() => products.filter((product) => !product.track_imei && !product.track_serial), [products]);
  const tracked = useMemo(() => products.filter((product) => product.track_imei || product.track_serial), [products]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return countable.filter((product) => !needle || [product.name, product.sku, product.category, product.brand].some((value) => value && String(value).toLowerCase().includes(needle)));
  }, [countable, query]);
  const changed = countable.map((product) => ({ product, counted: counts[product.id] === undefined || counts[product.id] === "" ? null : Number(counts[product.id]) })).filter((entry) => entry.counted !== null && entry.counted !== (Number(entry.product.current_stock) || 0));

  const applyCount = async () => {
    if (!changed.length) return;
    setSaving(true);
    try {
      const result = await localStore.functions.invoke("reconcileStockCount", { entries: changed.map(({ product, counted }) => ({ product_id: product.id, expected_quantity: product.current_stock || 0, counted_quantity: counted })), notes: notes.trim() || "Physical stock count" });
      if (result.data?.error) throw new Error(result.data.error);
      toast({ title: "Stock count applied", description: `${result.data.adjusted} product${result.data.adjusted === 1 ? " was" : "s were"} adjusted in the ledger.` });
      setCounts({});
      setNotes("");
      await refresh();
    } catch (error) {
      toast({ title: "Could not apply stock count", description: error.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (user?.role !== "admin") return <div className="bg-white rounded-lg p-12 text-center"><p className="text-sm text-neutral-400">Only the owner can reconcile stock counts.</p></div>;
  if (loading) return <div className="flex items-center justify-center py-40"><div className="w-8 h-8 border-4 border-neutral-200 border-t-[#111111] rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-5xl flex flex-col gap-4">
      <div><h1 className="text-2xl font-heading font-light text-[#111111]">Stock Count</h1><p className="text-sm text-neutral-500 mt-1">Compare physical quantities with the system, then apply the approved differences to the stock ledger.</p></div>
      <div className="bg-[#fff3e6] border border-[#ffd49b] rounded-lg px-4 py-3 text-sm text-[#6e4a12]">IMEI and serial-tracked products are not changed here. Reconcile those products from their individual unit register to keep device records accurate.</div>
      <div className="bg-white rounded-lg border border-neutral-100 overflow-hidden">
        <div className="p-4 border-b border-neutral-100 flex flex-wrap gap-3 items-center justify-between"><div className="flex h-11 flex-1 min-w-56 max-w-md items-center gap-2 rounded-md border border-neutral-200 px-3"><Search size={16} className="text-neutral-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products to count" className="w-full bg-transparent text-sm focus:outline-none" /></div><span className="text-xs text-neutral-500">{changed.length} variance{changed.length === 1 ? "" : "s"} ready</span></div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-neutral-50 text-xs text-neutral-500"><tr><th className="px-5 py-3 text-left font-medium">Product</th><th className="px-3 py-3 text-right font-medium">System</th><th className="px-3 py-3 text-right font-medium">Physical count</th><th className="px-5 py-3 text-right font-medium">Variance</th></tr></thead><tbody>{visible.map((product) => { const system = Number(product.current_stock) || 0; const raw = counts[product.id]; const counted = raw === undefined || raw === "" ? null : Number(raw); const variance = counted === null ? null : counted - system; return <tr key={product.id} className="border-t border-neutral-100"><td className="px-5 py-3"><p className="font-medium text-[#111111]">{product.name}</p><p className="text-xs text-neutral-400">{product.sku} · {product.category || "Uncategorised"}</p></td><td className="px-3 py-3 text-right text-[#111111]">{system}</td><td className="px-3 py-3 text-right"><input type="number" min="0" value={raw ?? ""} onChange={(event) => setCounts({ ...counts, [product.id]: event.target.value })} placeholder={String(system)} className="h-9 w-20 rounded-md border border-neutral-200 px-2 text-right text-sm focus:outline-none focus:border-[#ff9000]" /></td><td className={`px-5 py-3 text-right font-medium ${variance === null ? "text-neutral-400" : variance === 0 ? "text-[#5c8f45]" : variance > 0 ? "text-[#5c8f45]" : "text-[#b54635]"}`}>{variance === null ? "-" : `${variance > 0 ? "+" : ""}${variance}`}</td></tr>; })}</tbody></table></div>
        {visible.length === 0 && <div className="p-10 text-center text-sm text-neutral-400">No countable products match this search.</div>}
      </div>
      {tracked.length > 0 && <p className="text-xs text-neutral-500">{tracked.length} IMEI/serial-tracked product{tracked.length === 1 ? " is" : "s are"} excluded from quantity reconciliation.</p>}
      <div className="bg-white rounded-lg border border-neutral-100 p-4 flex flex-wrap gap-3 items-end"><label className="flex-1 min-w-60"><span className="text-xs text-neutral-500">Count notes</span><input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="e.g. September shelf count" className="mt-1 h-11 w-full rounded-md border border-neutral-200 px-3 text-sm focus:outline-none focus:border-[#ff9000]" /></label><button disabled={!changed.length || saving} onClick={applyCount} className="h-11 px-4 rounded-md bg-[#111111] text-white text-sm font-medium flex items-center gap-2 border-0 disabled:opacity-40"><ClipboardCheck size={16} /> {saving ? "Applying..." : `Apply ${changed.length} adjustment${changed.length === 1 ? "" : "s"}`}</button></div>
    </div>
  );
}
