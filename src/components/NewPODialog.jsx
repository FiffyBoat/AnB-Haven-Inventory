import { useState, useEffect, useRef } from "react";
import { localStore } from "@/api/localStore";
import { toast } from "sonner";

function PillSelect({ label, options, value, onChange, getLabel }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const panelRef = useRef(null);
  const [panelStyle, setPanelStyle] = useState({});

  const computePos = () => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPanelStyle({ position: 'fixed', left: rect.left, top: rect.bottom + 4, minWidth: rect.width, maxWidth: rect.width });
  };

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target) && panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedLabel = value ? getLabel(value) : label;

  return (
    <>
      <div ref={ref} onClick={() => { computePos(); setOpen(o => !o); }}
        style={{ height: 40, background: '#EFEFEF', borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 14, paddingRight: 14, cursor: 'pointer', userSelect: 'none', gap: 8 }}>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: value ? '#111111' : '#898989', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedLabel}</span>
        <span style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: open ? undefined : '5px solid #898989', borderBottom: open ? '5px solid #898989' : undefined, flexShrink: 0 }} />
      </div>
      {open && (
        <div ref={panelRef} style={{ ...panelStyle, background: '#FFFFFF', borderRadius: 16, paddingTop: 8, paddingBottom: 8, zIndex: 2000, boxShadow: '0 4px 24px rgba(0,0,0,0.12)', maxHeight: 200, overflowY: 'auto' }}>
          {options.map(opt => (
            <div key={opt.id || opt} onClick={() => { onChange(opt.id || opt); setOpen(false); }}
              style={{ padding: '8px 14px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#111111', background: (opt.id || opt) === value ? '#EFEFEF' : 'transparent' }}
              onMouseEnter={e => e.currentTarget.style.background = '#F5F5F5'}
              onMouseLeave={e => e.currentTarget.style.background = (opt.id || opt) === value ? '#EFEFEF' : 'transparent'}>
              {getLabel(opt.id || opt, opt)}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

const INITIAL_STATUS_OPTIONS = ["pending_approval", "approved"];
const STATUS_LABELS = { pending_approval: "Pending Approval", approved: "Approved" };

export default function NewPODialog({ open, onClose, onCreated, products, suppliers }) {
  const [form, setForm] = useState({
    product_id: '', supplier_id: '', quantity: '', unit_cost: '', expected_delivery: '', status: 'pending_approval'
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setForm({ product_id: '', supplier_id: '', quantity: '', unit_cost: '', expected_delivery: '', status: 'pending_approval' });
      setErrors({});
    }
  }, [open]);

  const totalCost = form.quantity && form.unit_cost
    ? (parseFloat(form.quantity) * parseFloat(form.unit_cost)).toFixed(2)
    : null;

  const validate = () => {
    const e = {};
    if (!form.product_id) e.product_id = true;
    if (!form.supplier_id) e.supplier_id = true;
    if (!form.quantity || isNaN(form.quantity) || Number(form.quantity) <= 0) e.quantity = true;
    if (!form.unit_cost || isNaN(form.unit_cost) || Number(form.unit_cost) <= 0) e.unit_cost = true;
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    const payload = {
      product_id: form.product_id,
      supplier_id: form.supplier_id,
      quantity: parseInt(form.quantity),
      unit_cost: parseFloat(form.unit_cost),
      total_cost: parseFloat(totalCost),
      status: form.status,
      suggested_date: new Date().toISOString().split('T')[0],
      ...(form.status === 'approved' ? { approval_date: new Date().toISOString().split('T')[0] } : {}),
      ...(form.expected_delivery ? { expected_delivery: form.expected_delivery } : {}),
    };
    const created = await localStore.entities.PurchaseOrder.create(payload);
    toast.success("Purchase order created");
    onCreated(created);
    setSaving(false);
  };

  if (!open) return null;

  const productMap = Object.fromEntries(products.map(p => [p.id, p]));
  const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s]));

  const inputStyle = (err) => ({
    height: 40, background: err ? '#FFF0EE' : '#EFEFEF', borderRadius: 22, border: err ? '1.5px solid #F24E2C' : '1.5px solid transparent',
    paddingLeft: 14, paddingRight: 14, fontFamily: 'Inter, sans-serif',             fontSize: 14, color: '#111111', outline: 'none', width: '100%', boxSizing: 'border-box'
  });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.32)' }} onClick={onClose}>
      <div style={{ background: '#FFFFFF', borderRadius: 32, padding: 24, width: '100%', maxWidth: 480, margin: 16, display: 'flex', flexDirection: 'column', gap: 20, boxSizing: 'border-box' }} onClick={e => e.stopPropagation()}>

        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 16, fontWeight: 600, color: '#111111' }}>New Purchase Order</span>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', background: '#EFEFEF', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#898989' }}>✕</button>
        </div>

        {/* Product */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#898989' }}>Product *</label>
          <div style={{ border: errors.product_id ? '1.5px solid #F24E2C' : '1.5px solid transparent', borderRadius: 22 }}>
            <PillSelect
              label="Select product"
              options={products}
              value={form.product_id}
              onChange={v => { setForm(f => ({ ...f, product_id: v })); setErrors(e => ({ ...e, product_id: false })); }}
              getLabel={(id, obj) => obj ? `${obj.name} (${obj.sku})` : productMap[id] ? `${productMap[id].name} (${productMap[id].sku})` : id}
            />
          </div>
        </div>

        {/* Supplier */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#898989' }}>Supplier *</label>
          <div style={{ border: errors.supplier_id ? '1.5px solid #F24E2C' : '1.5px solid transparent', borderRadius: 22 }}>
            <PillSelect
              label="Select supplier"
              options={suppliers}
              value={form.supplier_id}
              onChange={v => { setForm(f => ({ ...f, supplier_id: v })); setErrors(e => ({ ...e, supplier_id: false })); }}
              getLabel={(id, obj) => obj ? obj.name : supplierMap[id]?.name || id}
            />
          </div>
        </div>

        {/* Quantity + Unit Cost */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#898989' }}>Quantity *</label>
            <input type="number" min="1" placeholder="0" value={form.quantity}
              onChange={e => { setForm(f => ({ ...f, quantity: e.target.value })); setErrors(er => ({ ...er, quantity: false })); }}
              style={inputStyle(errors.quantity)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#898989' }}>Unit Cost ($) *</label>
            <input type="number" min="0" step="0.01" placeholder="0.00" value={form.unit_cost}
              onChange={e => { setForm(f => ({ ...f, unit_cost: e.target.value })); setErrors(er => ({ ...er, unit_cost: false })); }}
              style={inputStyle(errors.unit_cost)} />
          </div>
        </div>

        {/* Total cost display */}
        {totalCost && (
          <div style={{ background: '#EFEFEF', borderRadius: 16, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#898989' }}>Total Cost</span>
            <span style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontSize: 18, fontWeight: 300, color: '#111111' }}>${parseFloat(totalCost).toLocaleString()}</span>
          </div>
        )}

        {/* Expected Delivery + Status */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#898989' }}>Expected Delivery</label>
            <input type="date" value={form.expected_delivery}
              onChange={e => setForm(f => ({ ...f, expected_delivery: e.target.value }))}
              style={inputStyle(false)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#898989' }}>Save as</label>
            <PillSelect
              label="Status"
              options={INITIAL_STATUS_OPTIONS.map(s => ({ id: s }))}
              value={form.status}
              onChange={v => setForm(f => ({ ...f, status: v }))}
              getLabel={(id) => STATUS_LABELS[id] || id}
            />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ height: 40, paddingLeft: 20, paddingRight: 20, borderRadius: 32, border: 'none', background: '#EFEFEF', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#111111' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ height: 40, paddingLeft: 20, paddingRight: 20, borderRadius: 32, border: 'none', background: saving ? '#DFDFDF' : '#FF9000', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#111111', fontWeight: 500 }}>
            {saving ? 'Saving…' : 'Create Order'}
          </button>
        </div>
      </div>
    </div>
  );
}
