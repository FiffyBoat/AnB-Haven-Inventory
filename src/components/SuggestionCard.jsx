import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function Dialog({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 z-10">
        {children}
      </div>
    </div>
  );
}

export default function SuggestionCard({ po, product, supplier, onApprove, onReject, onModify, disabled, checked, onCheckedChange }) {
  const [dialog, setDialog] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [modifyQty, setModifyQty] = useState(po.quantity);
  const [modifyDelivery, setModifyDelivery] = useState(po.expected_delivery || "");
  const [fading, setFading] = useState(false);

  const fadeAndDo = (fn) => { setFading(true); setTimeout(fn, 300); };
  const handleApproveConfirm = () => { setDialog(null); fadeAndDo(() => onApprove(po.id)); };
  const handleRejectConfirm = () => { setDialog(null); fadeAndDo(() => onReject(po.id, rejectReason)); };
  const handleModifySave = () => { setDialog(null); fadeAndDo(() => onModify(po.id, modifyQty, modifyDelivery)); };
  const totalCost = (po.unit_cost || 0) * po.quantity;
  const modifyTotalCost = (po.unit_cost || 0) * modifyQty;

  return (
    <>
      <div style={{
        background: '#EFEFEF', borderRadius: 22, padding: 16,
        display: 'flex', flexDirection: 'row', alignItems: 'stretch', gap: 16,
        opacity: fading ? 0 : 1, transform: fading ? 'scale(0.97)' : 'scale(1)',
        transition: 'opacity 0.3s, transform 0.3s',
      }}>
        {/* Product Image */}
        <div style={{ flexShrink: 0, width: 180, minHeight: 180, borderRadius: 16, overflow: 'hidden', background: '#DFDFDF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {product?.image_url
            ? <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 48 }}>📦</span>
          }
        </div>

        {/* Middle content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0 }}>
          {/* AI Suggestion badge */}
          <div style={{ display: 'inline-flex' }}>
            <span style={{ background: '#FF9000', borderRadius: 22, padding: '4px 8px', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 400, color: '#111111' }}>AI Suggestion</span>
          </div>

          {/* Product name */}
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, color: '#111111', lineHeight: '18.2px', marginTop: 8 }}>{product?.name || 'Product'}</span>

          {/* SKU + Supplier pills */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
            {product?.sku && (
              <span style={{ height: 32, padding: '8px 12px', background: '#DFDFDF', borderRadius: 22, fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, color: '#111111', display: 'inline-flex', alignItems: 'center' }}>{product.sku}</span>
            )}
            {supplier?.name && (
              <span style={{ height: 32, padding: '8px 12px', background: '#DFDFDF', borderRadius: 22, fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, color: '#111111', display: 'inline-flex', alignItems: 'center' }}>{supplier.name}</span>
            )}
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 16, marginTop: 42 }}>
            <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 400, color: '#111111' }}>Qty</span>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                <span style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontSize: 24, fontWeight: 300, color: '#111111', lineHeight: '24px' }}>{po.quantity}</span>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 400, color: '#111111', marginBottom: 2 }}>Units</span>
              </div>
            </div>
            <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 400, color: '#111111' }}>Total Cost</span>
              <span style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontSize: 24, fontWeight: 300, color: '#111111', lineHeight: '24px' }}>${po.total_cost?.toLocaleString() ?? '—'}</span>
            </div>
            <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 400, color: '#111111' }}>Delivery</span>
              <span style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontSize: 24, fontWeight: 300, color: '#111111', lineHeight: '24px' }}>{po.expected_delivery || 'TBD'}</span>
            </div>
          </div>

          {/* AI Reasoning */}
          {po.ai_reasoning && (
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#898989', lineHeight: '20px', marginTop: 8 }}>{po.ai_reasoning}</p>
          )}
        </div>

        {/* Action buttons */}
        {!disabled && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0, justifyContent: 'flex-start' }}>
            <button onClick={() => setDialog("approve")}
              style={{ width: 120, padding: '8px 16px', background: '#FF9000', borderRadius: 22, border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, color: '#111111', transition: 'background 0.18s, color 0.18s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#111111'; e.currentTarget.style.color = '#FFFFFF'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#FF9000'; e.currentTarget.style.color = '#111111'; }}>
              Approve
            </button>
            <button onClick={() => { setModifyQty(po.quantity); setModifyDelivery(po.expected_delivery || ""); setDialog("modify"); }}
              style={{ width: 120, padding: '8px 16px', background: '#111111', borderRadius: 22, border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, color: '#FFFFFF', transition: 'background 0.18s, color 0.18s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#DFDFDF'; e.currentTarget.style.color = '#111111'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#111111'; e.currentTarget.style.color = '#FFFFFF'; }}>
              Modify
            </button>
            <button onClick={() => { setRejectReason(""); setDialog("reject"); }}
              style={{ width: 120, padding: '8px 16px', background: '#F24E2C', borderRadius: 22, border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, color: '#FFFFFF', transition: 'background 0.18s, color 0.18s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#111111'; e.currentTarget.style.color = '#F24E2C'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#F24E2C'; e.currentTarget.style.color = '#FFFFFF'; }}>
              Reject
            </button>
          </div>
        )}
      </div>

      {/* Approve Dialog */}
      <Dialog open={dialog === "approve"} onClose={() => setDialog(null)}>
        <h3 style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, color: '#111111', marginBottom: 8 }}>Approve Purchase Order</h3>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#898989', marginBottom: 16 }}>
          Approve <strong>{po.quantity} units</strong> of <strong>{product?.name}</strong>? Total: <strong>${totalCost.toLocaleString()}</strong>.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => setDialog(null)} style={{ padding: '8px 16px', background: '#EFEFEF', borderRadius: 22, border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#111111' }}>Cancel</button>
          <button onClick={handleApproveConfirm} style={{ padding: '8px 16px', background: '#FF9000', borderRadius: 22, border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, color: '#111111' }}>Confirm</button>
        </div>
      </Dialog>

      {/* Modify Dialog */}
      {dialog === "modify" && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setDialog(null)} style={{ position: 'absolute', inset: 0, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', background: 'rgba(255,255,255,0)' }} />
          <div style={{
            position: 'relative', zIndex: 10,
            width: '100%', maxWidth: 560,
            background: '#FFFFFF', borderRadius: 32,
            padding: 16,
            display: 'flex', flexDirection: 'column', gap: 0,
            boxSizing: 'border-box', marginLeft: 16, marginRight: 16,
          }}>
            {/* Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#FF9000', flexShrink: 0 }} />
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, color: '#111111' }}>Modify & Approve</span>
            </div>

            {/* Product name */}
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#898989', marginTop: 32 }}>{product?.name}</span>

            {/* Fields row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 4px', marginTop: 32 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 400, color: '#111111' }}>Quantity (units)</span>
                <input
                  type="number" min={1} value={modifyQty}
                  onChange={e => setModifyQty(parseInt(e.target.value) || 0)}
                  style={{ width: '100%', height: 32, paddingLeft: 16, paddingRight: 16, background: '#DFDFDF', borderRadius: 22, border: 'none', outline: 'none', fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#111111', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 400, color: '#111111' }}>Expected Delivery <span style={{ color: '#898989' }}>(optional)</span></span>
                <input
                  type="text" value={modifyDelivery}
                  onChange={e => setModifyDelivery(e.target.value)}
                  placeholder="mm.dd.yyyy"
                  style={{ width: '100%', height: 32, paddingLeft: 16, paddingRight: 16, background: '#DFDFDF', borderRadius: 22, border: 'none', outline: 'none', fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#111111', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* New total */}
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#898989', marginTop: 16, marginBottom: 16 }}>
              New total: <span style={{ color: '#111111', fontWeight: 500 }}>${modifyTotalCost.toLocaleString()}</span>
            </span>

            {/* Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              <button onClick={() => setDialog(null)}
                onMouseEnter={e => { e.currentTarget.style.background = '#DFDFDF'; e.currentTarget.style.color = '#111111'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#111111'; e.currentTarget.style.color = '#FFFFFF'; }}
                style={{ width: '100%', height: 50, background: '#111111', borderRadius: 22, border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, color: '#FFFFFF', transition: 'background 0.18s, color 0.18s' }}>
                Cancel
              </button>
              <button onClick={handleModifySave}
                onMouseEnter={e => { e.currentTarget.style.background = '#111111'; e.currentTarget.style.color = '#FFFFFF'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#FF9000'; e.currentTarget.style.color = '#111111'; }}
                style={{ width: '100%', height: 50, background: '#FF9000', borderRadius: 22, border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, color: '#111111', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.18s, color 0.18s' }}>
                Save & Approve <span style={{ fontSize: 16 }}>+</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={dialog === "reject"} onClose={() => setDialog(null)}>
        <h3 style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, color: '#111111', marginBottom: 8 }}>Reject Suggestion</h3>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#898989', marginBottom: 12 }}>Reject this suggestion for <strong>{product?.name}</strong>?</p>
        <Input placeholder="Reason (optional)..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} style={{ marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => setDialog(null)} style={{ padding: '8px 16px', background: '#EFEFEF', borderRadius: 22, border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#111111' }}>Cancel</button>
          <button onClick={handleRejectConfirm} style={{ padding: '8px 16px', background: '#F24E2C', borderRadius: 22, border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, color: '#FFFFFF' }}>Confirm Reject</button>
        </div>
      </Dialog>
    </>
  );
}