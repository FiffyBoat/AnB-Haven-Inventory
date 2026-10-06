import { useState, useRef, useEffect } from "react";
import { localStore } from "@/api/localStore";
import { toast } from "sonner";

const PAYMENT_TERMS_OPTIONS = ["Net 15", "Net 30", "Net 45", "Net 60", "Custom"];

const DEFAULT_FORM = {
  name: "", contact_name: "", email: "", phone: "",
  payment_terms: "Net 30", default_lead_time_days: 7,
  reliability_score: 3, notes: "",
};

const TEXT = { fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 400, color: '#111111' };

const fieldStyle = {
  width: '100%', height: 32,
  paddingLeft: 16, paddingRight: 16, paddingTop: 0, paddingBottom: 0,
  background: '#DFDFDF', borderRadius: 22, border: 'none', outline: 'none',
  ...TEXT, boxSizing: 'border-box',
};

function PillSelect({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState({});
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const computePos = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPanelStyle({ position: 'fixed', left: rect.left, top: rect.bottom + 4, minWidth: rect.width, zIndex: 2000 });
  };

  useEffect(() => {
    if (!open) return;
    window.addEventListener('scroll', computePos, true);
    window.addEventListener('resize', computePos);
    return () => { window.removeEventListener('scroll', computePos, true); window.removeEventListener('resize', computePos); };
  }, [open]);

  useEffect(() => {
    const handler = (e) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target) && panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <>
      <div
        ref={triggerRef}
        onClick={() => { if (!open) computePos(); setOpen(o => !o); }}
        style={{ height: 32, background: '#DFDFDF', borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 16, cursor: 'pointer', userSelect: 'none', gap: 8, boxSizing: 'border-box', width: '100%' }}
      >
        <span style={{ ...TEXT, color: value ? '#111111' : '#898989', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value || 'Select'}</span>
        <span style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: open ? undefined : '5px solid #343434', borderBottom: open ? '5px solid #343434' : undefined, flexShrink: 0 }} />
      </div>
      {open && (
        <div ref={panelRef} style={{ ...panelStyle, background: '#DFDFDF', borderRadius: 16, paddingTop: 8, paddingBottom: 8, display: 'flex', flexDirection: 'column' }}>
          {options.map(opt => (
            <div key={opt} onClick={() => { onChange(opt); setOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', cursor: 'pointer', ...TEXT, fontWeight: value === opt ? 600 : 400, whiteSpace: 'nowrap' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.6'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
              {opt}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Field({ label, error, children, colSpan = 1 }) {
  return (
    <div style={{ gridColumn: `span ${colSpan}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ ...TEXT }}>{label}</span>
      {children}
      {error && <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#F24E2C' }}>{error}</span>}
    </div>
  );
}

function StarRating({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  const starColor = (i) => {
    const active = i <= (hovered || value);
    if (!active) return '#DFDFDF';
    if (value >= 4) return '#64E13C';
    if (value === 3) return '#FF9000';
    return '#F24E2C';
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 32 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} type="button" onClick={() => onChange(i)}
          onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(0)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: starColor(i), lineHeight: 1, transition: 'color 0.15s', fontSize: 14 }}>
          ★
        </button>
      ))}
      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#898989', marginLeft: 4 }}>{value}/5</span>
    </div>
  );
}

export default function NewSupplierDialog({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => ({ ...e, [key]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.contact_name.trim()) e.contact_name = "Contact name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Invalid email";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setSaving(true);
    const payload = { ...form, default_lead_time_days: parseInt(form.default_lead_time_days) || 7 };
    const created = await localStore.entities.Supplier.create(payload);
    toast.success(`Supplier created: ${created.name}`);
    setForm({ ...DEFAULT_FORM });
    setSaving(false);
    onCreated(created);
  };

  const handleClose = () => { setForm({ ...DEFAULT_FORM }); setErrors({}); onClose(); };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={handleClose} style={{ position: 'absolute', inset: 0, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', background: 'rgba(255,255,255,0)' }} />

      <div style={{
        position: 'relative', zIndex: 10,
        width: '100%', maxWidth: 560, maxHeight: '90vh',
        background: '#FFFFFF', borderRadius: 32,
        padding: 16,
        display: 'flex', flexDirection: 'column', gap: 16,
        overflowY: 'auto', boxSizing: 'border-box',
        marginLeft: 16, marginRight: 16,
      }}>

        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#FF9000', flexShrink: 0 }} />
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, color: '#111111' }}>Add a New Supplier</span>
        </div>

        {/* 4-column grid form */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px 4px', marginTop: 16 }}>

          {/* Row 1: Supplier Name (full width) */}
          <Field label="Supplier Name *" error={errors.name} colSpan={4}>
            <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Company name"
              style={{ ...fieldStyle, outline: errors.name ? '1.5px solid #F24E2C' : 'none' }} className="placeholder-[#898989]" />
          </Field>

          {/* Row 2: Contact Name (col 1-2) + Email (col 3-4) */}
          <Field label="Contact Name *" error={errors.contact_name} colSpan={2}>
            <input value={form.contact_name} onChange={e => set("contact_name", e.target.value)} placeholder="Full name"
              style={{ ...fieldStyle, outline: errors.contact_name ? '1.5px solid #F24E2C' : 'none' }} className="placeholder-[#898989]" />
          </Field>
          <Field label="Email *" error={errors.email} colSpan={2}>
            <input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="contact@supplier.com"
              style={{ ...fieldStyle, outline: errors.email ? '1.5px solid #F24E2C' : 'none' }} className="placeholder-[#898989]" />
          </Field>

          {/* Row 3: Phone (col 1-2) + Payment Terms (col 3-4) */}
          <Field label="Phone" colSpan={2}>
            <input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+1 (555) 000-0000"
              style={fieldStyle} className="placeholder-[#898989]" />
          </Field>
          <Field label="Payment Terms" colSpan={2}>
            <PillSelect value={form.payment_terms} onChange={v => set("payment_terms", v)} options={PAYMENT_TERMS_OPTIONS} />
          </Field>

          {/* Row 4: Lead Time (col 1-2) + Reliability Score (col 3-4) */}
          <Field label="Lead Time (Days)" colSpan={2}>
            <input type="number" min={1} value={form.default_lead_time_days} onChange={e => set("default_lead_time_days", e.target.value)}
              style={fieldStyle} className="placeholder-[#898989]" />
          </Field>
          <Field label="Reliability Score" colSpan={2}>
            <StarRating value={form.reliability_score} onChange={v => set("reliability_score", v)} />
          </Field>

          {/* Row 5: Notes (full width) */}
          <Field label="Notes" colSpan={4}>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3}
              placeholder="Optional notes about this supplier..."
              style={{ ...fieldStyle, height: 96, resize: 'none', paddingTop: 10, paddingBottom: 10 }} className="placeholder-[#898989]" />
          </Field>

          {/* Row 6: Buttons */}
          <div style={{ gridColumn: 'span 2' }}>
            <button onClick={handleClose}
              onMouseEnter={e => { e.currentTarget.style.background = '#DFDFDF'; e.currentTarget.style.color = '#111111'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#111111'; e.currentTarget.style.color = '#FFFFFF'; }}
              style={{ width: '100%', height: 50, background: '#111111', borderRadius: 22, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.18s, color 0.18s' }}>
              <span style={{ ...TEXT, color: '#FFFFFF', fontWeight: 500 }}>Cancel</span>
            </button>
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <button onClick={handleSubmit} disabled={saving}
              onMouseEnter={e => { e.currentTarget.style.background = '#111111'; e.currentTarget.querySelector('span').style.color = '#FFFFFF'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#FF9000'; e.currentTarget.querySelector('span').style.color = '#111111'; }}
              style={{ width: '100%', height: 50, background: '#FF9000', borderRadius: 22, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: saving ? 0.7 : 1, transition: 'background 0.18s' }}>
              <span style={{ ...TEXT, fontWeight: 500, transition: 'color 0.18s' }}>{saving ? "Creating..." : "Create Supplier"}</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
