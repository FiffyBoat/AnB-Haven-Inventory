import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { localStore } from "@/api/localStore";
import { useAuth } from "@/lib/AuthContext";
import ImageUploader from "@/components/ImageUploader";

const empty = {
  image_url: "",
  name: "", sku: "", barcode: "", category: "", brand: "", model: "",
  cost_price: "", selling_price: "", reorder_level: "5",
  track_imei: false, track_serial: false, opening_stock: "0", description: "",
};

const autoSku = (name, category) => {
  const initials = (name || "").split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).join("").slice(0, 4) || "SKU";
  const cat = (category || "GEN").slice(0, 3).toUpperCase();
  return `${cat}-${initials}-${Math.floor(1000 + Math.random() * 9000)}`;
};

export default function ProductFormDialog({ open, onClose, categories, onCreated }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState(empty);
  const [submitting, setSubmitting] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) { toast({ title: "Product name is required", variant: "destructive" }); return; }
    if (!form.selling_price) { toast({ title: "Selling price is required", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const opening = Math.max(0, Math.floor(Number(form.opening_stock) || 0));
      const sku = form.sku.trim() || autoSku(form.name, form.category);
      const product = await localStore.entities.Product.create({
        name: form.name.trim(), sku, barcode: form.barcode.trim(),
        category: form.category, brand: form.brand.trim(), model: form.model.trim(),
        description: form.description.trim(),
        image_url: form.image_url,
        cost_price: Number(form.cost_price) || 0,
        selling_price: Number(form.selling_price) || 0,
        reorder_level: Math.floor(Number(form.reorder_level) || 0),
        track_imei: form.track_imei, track_serial: form.track_serial,
        current_stock: opening, status: "active",
      });
      if (opening > 0) {
        await localStore.entities.StockMovement.create({
          product_id: product.id, product_name: product.name,
          movement_type: "OPENING_STOCK", quantity: opening,
          previous_quantity: 0, new_quantity: opening,
          notes: "Opening stock", created_by_name: user?.full_name || "",
        });
      }
      setForm(empty);
      onCreated(product);
    } catch (err) {
      toast({ title: "Could not create product", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = "w-full h-11 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:border-[#FF9000]";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl bg-white rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#111111]">New Product</DialogTitle>
        </DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3 mt-2">
          <div className="sm:col-span-2">
            <label className="text-xs text-neutral-500">Product name *</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Samsung Galaxy A15 128GB" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-neutral-500">SKU</label>
            <div className="flex gap-2">
              <input value={form.sku} onChange={(e) => set("sku", e.target.value)} placeholder="Auto-generated" className={inputCls} />
              <button onClick={() => set("sku", autoSku(form.name, form.category))} className="h-11 px-3 rounded-xl bg-neutral-100 text-xs cursor-pointer border-none whitespace-nowrap">Generate</button>
            </div>
          </div>
          <div>
            <label className="text-xs text-neutral-500">Barcode</label>
            <input value={form.barcode} onChange={(e) => set("barcode", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-neutral-500">Category</label>
            <select value={form.category} onChange={(e) => set("category", e.target.value)} className={inputCls + " bg-white"}>
              <option value="">Select…</option>
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-500">Brand</label>
            <input value={form.brand} onChange={(e) => set("brand", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-neutral-500">Cost price (GHS)</label>
            <input type="number" min="0" step="0.01" value={form.cost_price} onChange={(e) => set("cost_price", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-neutral-500">Selling price (GHS) *</label>
            <input type="number" min="0" step="0.01" value={form.selling_price} onChange={(e) => set("selling_price", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-neutral-500">Reorder level</label>
            <input type="number" min="0" value={form.reorder_level} onChange={(e) => set("reorder_level", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-neutral-500">Opening stock (qty)</label>
            <input type="number" min="0" value={form.opening_stock} onChange={(e) => set("opening_stock", e.target.value)} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <ImageUploader imageUrl={form.image_url} onUploaded={(url) => set("image_url", url)} />
          </div>
          <div className="sm:col-span-2 flex gap-6 pt-1">
            <label className="flex items-center gap-2 text-sm text-[#111111]">
              <input type="checkbox" checked={form.track_imei} onChange={(e) => set("track_imei", e.target.checked)} className="accent-[#FF9000] w-4 h-4" />
              Track by IMEI (phones)
            </label>
            <label className="flex items-center gap-2 text-sm text-[#111111]">
              <input type="checkbox" checked={form.track_serial} onChange={(e) => set("track_serial", e.target.checked)} className="accent-[#FF9000] w-4 h-4" />
              Track by serial number
            </label>
          </div>
        </div>
        <button
          disabled={submitting}
          onClick={submit}
          className="w-full h-12 mt-5 rounded-full bg-[#111111] text-white text-sm font-medium cursor-pointer border-none disabled:opacity-40">
          {submitting ? "Saving…" : "Save Product"}
        </button>
      </DialogContent>
    </Dialog>
  );
}
