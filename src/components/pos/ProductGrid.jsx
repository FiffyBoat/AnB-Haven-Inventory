import { Package } from "lucide-react";
import { formatGhs } from "@/lib/format";

export default function ProductGrid({ products, onAdd, totalProducts, isSearching }) {
  if (products.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-12 flex flex-col items-center text-center">
        <Package size={36} className="text-neutral-300" />
        <p className="mt-4 text-sm text-neutral-400">{isSearching ? "No matching products in stock." : "No products in stock right now."}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[#111111]">{isSearching ? "Matching Products" : "Available Products"}</p>
        {totalProducts > products.length && <span className="text-xs text-neutral-500">Showing {products.length} of {totalProducts}</span>}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 mt-3">
        {products.map((p) => {
          const stock = p.current_stock || 0;
          return (
            <button key={p.id} onClick={() => onAdd(p)}
              className="bg-neutral-50 rounded-2xl p-3 flex flex-col items-start text-left hover:shadow-md transition-shadow cursor-pointer border-none">
              <div className="w-full aspect-square rounded-xl bg-neutral-100 flex items-center justify-center overflow-hidden mb-2">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <Package size={26} className="text-neutral-300" />
                )}
              </div>
              <p className="text-sm font-medium text-[#111111] leading-snug line-clamp-2">{p.name}</p>
              <p className="text-xs text-neutral-500 mt-0.5 truncate w-full">{[p.brand, p.model, p.category].filter(Boolean).join(" · ") || p.sku}</p>
              <div className="flex items-center justify-between w-full mt-2">
                <p className="text-sm font-semibold text-[#111111]">{formatGhs(p.selling_price)}</p>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
                  background: stock <= 1 ? "#FFF3E6" : "#EFF6EC",
                  color: stock <= 1 ? "#D9624A" : "#616E5D",
                }}>{stock} left{(p.track_imei || p.track_serial) ? " · IMEI" : ""}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
