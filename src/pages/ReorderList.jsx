import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, ShoppingBag } from "lucide-react";
import { localStore } from "@/api/localStore";
import { useAuth } from "@/lib/AuthContext";

export default function ReorderList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    localStore.entities.Product.list()
      .then((items) => setProducts(items.filter((item) => item.status === "active")))
      .finally(() => setLoading(false));
  }, []);

  const needsRestock = useMemo(() => products
    .filter((product) => (Number(product.current_stock) || 0) <= (Number(product.reorder_level) || 0))
    .sort((a, b) => (Number(a.current_stock) || 0) - (Number(b.current_stock) || 0)), [products]);

  const suggestedQuantity = (product) => Math.max(1, (Number(product.reorder_level) || 0) * 2 - (Number(product.current_stock) || 0));
  const selected = needsRestock.map((product) => ({
    product_id: product.id,
    quantity: Math.floor(Number(quantities[product.id] ?? suggestedQuantity(product))),
    unit_cost: product.cost_price || "",
  })).filter((item) => item.quantity > 0);

  if (user?.role !== "admin") return <div className="bg-white rounded-lg p-12 text-center"><p className="text-sm text-neutral-400">Only the owner can prepare a reorder list.</p></div>;
  if (loading) return <div className="flex items-center justify-center py-40"><div className="w-8 h-8 border-4 border-neutral-200 border-t-[#111111] rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-5xl flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-heading font-light text-[#111111]">Reorder List</h1>
        <p className="text-sm text-neutral-500 mt-1">Items at or below their reorder level. Suggested quantities aim for twice the reorder level.</p>
      </div>

      {needsRestock.length === 0 ? (
        <div className="bg-white border border-neutral-100 rounded-lg p-12 text-center">
          <ClipboardList size={32} className="mx-auto text-[#5c8f45]" />
          <p className="mt-3 text-sm font-medium text-[#111111]">Stock levels look healthy</p>
          <p className="mt-1 text-sm text-neutral-500">No active products need reordering right now.</p>
        </div>
      ) : (
        <>
          <div className="bg-white border border-neutral-100 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-xs text-neutral-500">
                  <tr><th className="px-5 py-3 text-left font-medium">Product</th><th className="px-3 py-3 text-right font-medium">In stock</th><th className="px-3 py-3 text-right font-medium">Reorder level</th><th className="px-5 py-3 text-right font-medium">Order quantity</th></tr>
                </thead>
                <tbody>
                  {needsRestock.map((product) => {
                    const stock = Number(product.current_stock) || 0;
                    const level = Number(product.reorder_level) || 0;
                    return <tr key={product.id} className="border-t border-neutral-100">
                      <td className="px-5 py-3"><p className="font-medium text-[#111111]">{product.name}</p><p className="text-xs text-neutral-400">{product.sku}</p></td>
                      <td className={`px-3 py-3 text-right font-medium ${stock === 0 ? "text-[#b54635]" : "text-[#c46b18]"}`}>{stock}</td>
                      <td className="px-3 py-3 text-right text-neutral-600">{level}</td>
                      <td className="px-5 py-3 text-right"><input type="number" min="0" value={quantities[product.id] ?? suggestedQuantity(product)} onChange={(event) => setQuantities({ ...quantities, [product.id]: event.target.value })} className="h-9 w-20 rounded-md border border-neutral-200 px-2 text-right text-sm focus:outline-none focus:border-[#ff9000]" /></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={() => navigate("/purchases", { state: { suggestedItems: selected } })} disabled={!selected.length} className="h-11 rounded-md bg-[#111111] px-4 text-sm font-medium text-white border-0 flex items-center gap-2 disabled:opacity-40"><ShoppingBag size={16} /> Create purchase draft</button>
          </div>
        </>
      )}
    </div>
  );
}
