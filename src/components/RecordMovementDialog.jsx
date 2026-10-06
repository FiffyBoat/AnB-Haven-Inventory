import { useState } from "react";
import { localStore } from "@/api/localStore";
import { toast } from "sonner";

const MOVEMENT_TYPES = ["sale", "restock", "adjustment", "return"];
const inputStyle = {
  width: '100%', height: 36, paddingLeft: 12, paddingRight: 12,
  background: '#EFEFEF', borderRadius: 16, border: 'none', outline: 'none',
  fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#111111', boxSizing: 'border-box',
};

export default function RecordMovementDialog({ productId, open, onClose, onCreated }) {
  const [form, setForm] = useState({
    movement_type: "restock",
    quantity: "",
    movement_date: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSave = async () => {
    const qty = parseInt(form.quantity);
    if (!form.movement_type || isNaN(qty) || qty <= 0 || !form.movement_date) {
      toast.error("Please fill in type, quantity, and date.");
      return;
    }
    setSaving(true);
    const created = await localStore.entities.StockMovement.create({
      product_id: productId,
      movement_type: form.movement_type,
      quantity: qty,
      movement_date: form.movement_date,
      notes: form.notes || undefined,
    });
    toast.success("Movement recorded");
    if (onCreated) onCreated(created);
    setSaving(false);
    onClose();
    setForm({ movement_type: "restock", quantity: "", movement_date: new Date().toISOString().split("T")[0], notes: "" });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.15)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 420, background: '#FFFFFF', borderRadius: 32, padding: 20, display: 'flex', flexDirection: 'column', gap: 12, marginLeft: 16, marginRight: 16, boxSizing: 'border-box' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#FF9000', flexShrink: 0 }} />
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, color: '#111111' }}>Record Stock Movement</span>
        </div>

        {/* Movement Type */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#898989' }}>Type</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {MOVEMENT_TYPES.map(t => (
              <button key={t} onClick={() => setForm(f => ({ ...f, movement_type: t }))}
                style={{
                  height: 32, paddingLeft: 14, paddingRight: 14, borderRadius: 32, border: 'none', cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500,
                  background: form.movement_type === t ? '#111111' : '#EFEFEF',
                  color: form.movement_type === t ? '#FFFFFF' : '#111111',
                  transition: 'background 0.15s, color 0.15s', textTransform: 'capitalize',
                }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Quantity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#898989' }}>Quantity</span>
          <input type="number" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
            placeholder="e.g. 50" style={inputStyle} />
        </div>

        {/* Date */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#898989' }}>Date</span>
          <input type="date" value={form.movement_date} onChange={e => setForm(f => ({ ...f, movement_date: e.target.value }))} style={inputStyle} />
        </div>

        {/* Notes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#898989' }}>Notes (optional)</span>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={2} placeholder="e.g. Monthly restock from supplier"
            style={{ ...inputStyle, height: 56, resize: 'none', paddingTop: 8, paddingBottom: 8 }} />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onClose} style={{ flex: 1, height: 44, background: '#EFEFEF', borderRadius: 22, border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, color: '#111111' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 2, height: 44, background: saving ? '#DFDFDF' : '#FF9000', borderRadius: 22, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, color: '#111111' }}>
            {saving ? 'Saving…' : 'Record Movement'}
          </button>
        </div>
      </div>
    </div>
  );
}
