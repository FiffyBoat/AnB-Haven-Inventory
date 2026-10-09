import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { localStore } from "@/api/localStore";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { formatGhs } from "@/lib/format";
import ProductFormDialog from "@/components/ProductFormDialog";
import { Search, Plus, Package, Tag, Pencil, Trash2, Check, X } from "lucide-react";

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
  const [editingCatId, setEditingCatId] = useState(null);
  const [editingCatName, setEditingCatName] = useState("");

  const refresh = () => {
    Promise.all([localStore.entities.Product.list(), localStore.entities.Category.list()])
      .then(([p, c]) => { setProducts(p); setCategories(c.filter((x) => x.status === "active")); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(() => {
    refresh();
    window.addEventListener("anb_data_synced", refresh);
    return () => window.removeEventListener("anb_data_synced", refresh);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => (category ? p.category === category : true))
      .filter((p) => !q || [p.name, p.sku, p.barcode, p.brand].some((f) => f && String(f).toLowerCase().includes(q)));
  }, [products, query, category]);

  const addCategory = async () => {
    const trimmed = newCat.trim();
    if (!trimmed) return;
    // Prevent duplicates
    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      toast({ title: "Category already exists", description: `"${trimmed}" is already in your list.`, variant: "destructive" });
      return;
    }
    try {
      await localStore.entities.Category.create({ name: trimmed, status: "active" });
      setNewCat("");
      toast({ title: "Category added!", description: `"${trimmed}" is now available when creating products.` });
      refresh();
    } catch (err) {
      toast({ title: "Could not add category", description: err.message, variant: "destructive" });
    }
  };

  const startEditCategory = (cat) => {
    setEditingCatId(cat.id);
    setEditingCatName(cat.name);
  };

  const cancelEditCategory = () => {
    setEditingCatId(null);
    setEditingCatName("");
  };

  const saveEditCategory = async (cat) => {
    const trimmed = editingCatName.trim();
    if (!trimmed) {
      toast({ title: "Name required", description: "Category name cannot be empty.", variant: "destructive" });
      return;
    }
    // Check duplicates (excluding this category itself)
    if (categories.some((c) => c.id !== cat.id && c.name.toLowerCase() === trimmed.toLowerCase())) {
      toast({ title: "Category already exists", description: `"${trimmed}" is already in your list.`, variant: "destructive" });
      return;
    }

    try {
      const oldName = cat.name;
      await localStore.entities.Category.update(cat.id, { name: trimmed });

      // Automatically update any products that were assigned to the old category name
      const affectedProducts = products.filter((p) => p.category === oldName);
      if (affectedProducts.length > 0) {
        for (const p of affectedProducts) {
          await localStore.entities.Product.update(p.id, { category: trimmed });
        }
      }

      setEditingCatId(null);
      setEditingCatName("");
      toast({
        title: "Category updated!",
        description: `Renamed to "${trimmed}"${affectedProducts.length > 0 ? ` (${affectedProducts.length} product(s) updated)` : ""}.`,
      });
      refresh();
    } catch (err) {
      toast({ title: "Could not update category", description: err.message, variant: "destructive" });
    }
  };

  const deleteCategory = async (cat) => {
    const affectedProducts = products.filter((p) => p.category === cat.name);
    const confirmMessage = affectedProducts.length > 0
      ? `"${cat.name}" is used by ${affectedProducts.length} product(s). Deleting it will mark those products as Uncategorised.\n\nAre you sure you want to delete "${cat.name}"?`
      : `Are you sure you want to delete category "${cat.name}"?`;

    if (!window.confirm(confirmMessage)) return;

    try {
      // Detach category from affected products
      if (affectedProducts.length > 0) {
        for (const p of affectedProducts) {
          await localStore.entities.Product.update(p.id, { category: "" });
        }
      }

      await localStore.entities.Category.delete(cat.id);
      toast({
        title: "Category deleted",
        description: `"${cat.name}" has been removed.`,
      });
      refresh();
    } catch (err) {
      toast({ title: "Could not delete category", description: err.message, variant: "destructive" });
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
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => { setCatOpen(false); cancelEditCategory(); }}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-base font-semibold text-[#111111]">Product Categories</p>
                <p className="text-xs text-neutral-400 mt-0.5">{categories.length} active categories</p>
              </div>
              <button
                type="button"
                onClick={() => { setCatOpen(false); cancelEditCategory(); }}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center cursor-pointer border-none transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-1.5 mb-4 max-h-60 overflow-y-auto pr-1">
              {categories.map((c) => {
                const isEditing = editingCatId === c.id;
                const prodCount = products.filter((p) => p.category === c.name).length;

                if (isEditing) {
                  return (
                    <div key={c.id} className="flex items-center gap-2 p-1.5 bg-amber-50/60 rounded-xl border border-amber-200">
                      <input
                        autoFocus
                        value={editingCatName}
                        onChange={(e) => setEditingCatName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEditCategory(c);
                          if (e.key === "Escape") cancelEditCategory();
                        }}
                        className="flex-1 h-9 rounded-lg bg-white border border-amber-300 px-3 text-xs text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#FF9000]"
                        placeholder="Category name"
                      />
                      <button
                        type="button"
                        onClick={() => saveEditCategory(c)}
                        title="Save changes"
                        className="w-8 h-8 rounded-lg bg-[#111111] hover:bg-black text-white flex items-center justify-center cursor-pointer border-none transition-colors shrink-0"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditCategory}
                        title="Cancel"
                        className="w-8 h-8 rounded-lg bg-neutral-200 hover:bg-neutral-300 text-neutral-700 flex items-center justify-center cursor-pointer border-none transition-colors shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-neutral-50 hover:bg-neutral-100 transition-colors border border-neutral-100 group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-medium text-[#111111] truncate">{c.name}</span>
                      <span className="text-[10px] text-neutral-400 bg-white px-2 py-0.5 rounded-full border border-neutral-200/60 shrink-0">
                        {prodCount} {prodCount === 1 ? "product" : "products"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEditCategory(c)}
                        title={`Rename "${c.name}"`}
                        className="w-7 h-7 rounded-lg text-neutral-500 hover:text-[#111111] hover:bg-white flex items-center justify-center cursor-pointer border-none transition-all"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCategory(c)}
                        title={`Delete "${c.name}"`}
                        className="w-7 h-7 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center cursor-pointer border-none transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {categories.length === 0 && (
                <div className="text-center py-6 text-neutral-400 text-xs bg-neutral-50 rounded-2xl">
                  No categories yet. Add one below!
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-neutral-100 flex gap-2">
              <input
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCategory()}
                placeholder="New category name (e.g. Chargers)"
                className="flex-1 h-11 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:border-[#FF9000]"
              />
              <button
                type="button"
                onClick={addCategory}
                className="h-11 px-5 rounded-xl bg-[#111111] hover:bg-black text-white text-sm font-medium cursor-pointer border-none transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
