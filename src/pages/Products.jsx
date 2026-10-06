import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { localStore } from "@/api/localStore";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { formatGhs } from "@/lib/format";
import ProductFormDialog from "@/components/ProductFormDialog";
import { Search, Plus, Package, Tag } from "lucide-react";

export default function Products() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isOwner = user?.role === "admin";
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [newCat, setNewCat] = useState("");

  const refresh = () => {
    Promise.all([localStore.entities.Product.list(), localStore.entities.Category.list()])
      .then(([p, c]) => { setProducts(p); setCategories(c.filter((x) => x.status === "active")); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(refresh, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => (category ? p.category === category : true))
      .filter((p) => !q || [p.name, p.sku, p.barcode, p.brand].some((f) => f && String(f).toLowerCase().includes(q)));
  }, [products, query, category]);

  const addCategory = async () => {
    if (!newCat.trim()) return;
    try {
      await localStore.entities.Category.create({ name: newCat.trim() });
      setNewCat("");
      refresh();
    } catch (err) {
      toast({ title: "Could not add category", description: err.message, variant: "destructive" });
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-40">
      <div className="w-8 h-8 border-4 border-figma-accent border-t-[#111111] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-light text-[#111111]">Products</h1>
          <p className="text-sm text-neutral-500 mt-1">{products.length} products in catalog</p>
        </div>
        {isOwner && (
          <div className="flex gap-2">
            <button onClick={() => setCatOpen(true)} className="h-11 px-4 rounded-full bg-white text-sm flex items-center gap-2 cursor-pointer border border-neutral-200">
              <Tag size={15} /> Categories
            </button>
            <button onClick={() => setFormOpen(true)} className="h-11 px-5 rounded-full bg-[#FF9000] text-sm font-medium text-[#111111] flex items-center gap-2 cursor-pointer border-none">
              <Plus size={15} /> New Product
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 rounded-full bg-white px-4 h-11 flex-1 min-w-52 border border-neutral-100">
          <Search size={16} className="text-neutral-400 shrink-0" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, SKU, barcode…" className="w-full bg-transparent text-sm focus:outline-none border-none" />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-11 rounded-full bg-white px-4 text-sm border border-neutral-100 focus:outline-none">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.map((p) => {
          const stock = p.current_stock || 0;
          return (
            <Link key={p.id} to={`/products/${p.id}`} className="bg-white rounded-3xl p-4 flex flex-col hover:shadow-md transition-shadow">
              <div className="aspect-square rounded-2xl bg-neutral-100 flex items-center justify-center overflow-hidden mb-3">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <Package size={28} className="text-neutral-300" />
                )}
              </div>
              <p className="text-sm font-medium text-[#111111] leading-snug line-clamp-2">{p.name}</p>
              <p className="text-xs text-neutral-500 mt-1">{p.sku}</p>
              <div className="flex items-center justify-between mt-3">
                <p className="text-sm font-semibold text-[#111111]">{formatGhs(p.selling_price)}</p>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
                  background: stock === 0 ? "#FDEAE6" : stock <= (p.reorder_level || 0) ? "#FFF3E6" : "#EFF6EC",
                  color: stock === 0 ? "#F13A15" : stock <= (p.reorder_level || 0) ? "#D9624A" : "#616E5D",
                }}>{stock} in stock</span>
              </div>
              {isOwner && <p className="text-xs text-neutral-400 mt-1">Cost {formatGhs(p.cost_price)}</p>}
            </Link>
          );
        })}
      </div>
      {filtered.length === 0 && (
        <div className="bg-white rounded-3xl p-12 text-center">
          <Package size={32} className="text-neutral-300 mx-auto" />
          <p className="text-sm text-neutral-400 mt-3">No products found.</p>
        </div>
      )}

      <ProductFormDialog open={formOpen} onClose={() => setFormOpen(false)} categories={categories}
        onCreated={() => { setFormOpen(false); refresh(); }} />

      {catOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setCatOpen(false)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium text-[#111111] mb-3">Product Categories</p>
            <div className="flex flex-wrap gap-2 mb-4 max-h-48 overflow-y-auto">
              {categories.map((c) => (
                <span key={c.id} className="px-3 py-1.5 rounded-full bg-neutral-100 text-xs text-[#111111]">{c.name}</span>
              ))}
              {categories.length === 0 && <p className="text-xs text-neutral-400">No categories yet.</p>}
            </div>
            <div className="flex gap-2">
              <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category name"
                className="flex-1 h-11 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:border-[#FF9000]" />
              <button onClick={addCategory} className="h-11 px-4 rounded-xl bg-[#111111] text-white text-sm cursor-pointer border-none">Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
