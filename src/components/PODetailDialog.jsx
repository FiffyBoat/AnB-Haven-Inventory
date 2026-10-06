import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { localStore } from "@/api/localStore";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";

const STATUS_LABELS = {
  suggested: "Suggested", pending_approval: "Pending", approved: "Approved",
  sent: "Sent", received: "Received", cancelled: "Cancelled",
};

const STATUS_COLORS = {
  suggested:        { bg: '#FF9000', color: '#111111' },
  pending_approval: { bg: '#FFD700', color: '#111111' },
  approved:         { bg: '#3CB5E1', color: '#111111' },
  sent:             { bg: '#A855F7', color: '#FFFFFF' },
  received:         { bg: '#64E13C', color: '#111111' },
  cancelled:        { bg: '#EFEFEF', color: '#898989' },
};

const DATE_FIELD = {
  suggested: "suggested_date", pending_approval: "suggested_date",
  approved: "approval_date", sent: "approval_date",
  received: "updated_date", cancelled: "updated_date",
};

function getDate(po) {
  const field = DATE_FIELD[po.status];
  const val = po[field];
  if (!val) return "—";
  const d = typeof val === "string" ? val.split("T")[0] : val;
  const [y, m, day] = d.split('-');
  return `${m}.${day}.${y?.slice(2)}`;
}

function DetailRow({ label, value, large }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#898989' }}>{label}</span>
      {large ? (
        <span style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontSize: 32, fontWeight: 300, color: '#111111', lineHeight: 1 }}>{value}</span>
      ) : (
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, color: '#111111' }}>{value}</span>
      )}
    </div>
  );
}

// Status progression map
const NEXT_STATUS = {
  suggested: 'pending_approval',
  pending_approval: 'approved',
  approved: 'sent',
  sent: 'received',
};
const NEXT_LABEL = {
  suggested: 'Mark Pending',
  pending_approval: 'Mark Approved',
  approved: 'Mark Sent',
  sent: 'Mark Received',
};

export default function PODetailDialog({ po: initialPo, product, supplier, onClose, onStatusChange }) {
  const [po, setPo] = useState(initialPo);
  const [updating, setUpdating] = useState(false);
  const { user } = useAuth();
  const isManager = ["admin", "manager"].includes(user?.role);

  useEffect(() => { setPo(initialPo); }, [initialPo]);

  useEffect(() => {
    if (!po) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [po, onClose]);

  if (!po) return null;

  const handleAdvanceStatus = async () => {
    const next = NEXT_STATUS[po.status];
    if (!next) return;
    setUpdating(true);
    const extraFields = next === 'approved' ? { approval_date: new Date().toISOString().split('T')[0] } : {};
    const updated = await localStore.entities.PurchaseOrder.update(po.id, { status: next, ...extraFields });
    setPo({ ...po, status: next, ...extraFields });
    toast.success(`Order updated to ${STATUS_LABELS[next]}`);
    if (onStatusChange) onStatusChange({ ...po, status: next, ...extraFields });
    setUpdating(false);
  };

  const colors = STATUS_COLORS[po.status] || { bg: '#EFEFEF', color: '#898989' };
  const nextStatus = NEXT_STATUS[po.status];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', background: 'rgba(255,255,255,0)' }}
      />

      {/* Dialog panel */}
      <div style={{
        position: 'relative', zIndex: 10,
        width: '100%', maxWidth: 560, maxHeight: '90vh',
        background: '#FFFFFF', borderRadius: 32,
        padding: 16,
        display: 'flex', flexDirection: 'column', gap: 16,
        overflowY: 'auto', boxSizing: 'border-box',
        marginLeft: 16, marginRight: 16,
      }}>

        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#FF9000', flexShrink: 0 }} />
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, color: '#111111' }}>Order Details</span>
          </div>
          <span style={{ background: colors.bg, color: colors.color, borderRadius: 40, padding: '0 14px', height: 28, display: 'inline-flex', alignItems: 'center', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' }}>
            {STATUS_LABELS[po.status]}
          </span>
        </div>

        {/* Product card */}
        <div style={{ background: '#EFEFEF', borderRadius: 22, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 64, height: 64, borderRadius: 12, background: '#DFDFDF', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {product?.image_url
              ? <img src={product.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
              : <span style={{ fontSize: 28 }}>📦</span>}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, color: '#111111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product?.name || '—'}</span>
            {product?.sku && <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#898989' }}>{product.sku}</span>}
            {product?.category && <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#343434' }}>{product.category}</span>}
          </div>
          {product?.id && (
            <Link to={`/products/${product.id}`} onClick={onClose}
              style={{ flexShrink: 0, height: 28, padding: '0 12px', background: '#111111', borderRadius: 22, display: 'inline-flex', alignItems: 'center', fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#FFFFFF', textDecoration: 'none' }}
              onMouseEnter={e => e.currentTarget.style.background = '#333'}
              onMouseLeave={e => e.currentTarget.style.background = '#111111'}>
              View
            </Link>
          )}
        </div>

        {/* Stats grid */}
        <div className="mt-4 sm:mt-0" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          <div style={{ background: '#111111', borderRadius: 22, padding: 16, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#FFFFFF' }}>Quantity</span>
            <span className="text-[24px] sm:text-[40px]" style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontWeight: 300, color: '#FFFFFF', lineHeight: 1 }}>{po.quantity}</span>
          </div>
          <div style={{ background: '#FF9000', borderRadius: 22, padding: 16, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#111111' }}>Total Cost</span>
            <span className="text-[24px] sm:text-[40px]" style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontWeight: 300, color: '#111111', lineHeight: 1 }}>${po.total_cost?.toLocaleString() ?? '—'}</span>
          </div>
        </div>

        {/* Details grid */}
        <div style={{ background: '#EFEFEF', borderRadius: 22, padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
          <DetailRow label="Order #" value={`#${po.id.slice(-6).toUpperCase()}`} />
          <DetailRow label="Unit Cost" value={po.unit_cost != null ? `$${po.unit_cost.toLocaleString()}` : '—'} />
          <DetailRow label="Supplier" value={supplier?.name || '—'} />
          <DetailRow label="Date" value={getDate(po)} />
          {po.expected_delivery && (
            <DetailRow label="Expected Delivery" value={(() => { const [y,m,d] = po.expected_delivery.split('-'); return `${m}.${d}.${y?.slice(2)}`; })()} />
          )}
          {po.approval_date && (
            <DetailRow label="Approval Date" value={(() => { const [y,m,d] = po.approval_date.split('-'); return `${m}.${d}.${y?.slice(2)}`; })()} />
          )}
        </div>

        {/* AI Reasoning */}
        {po.ai_reasoning && (
          <div style={{ background: '#EFEFEF', borderRadius: 22, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#898989' }}>AI Reasoning</span>
            </div>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#111111', lineHeight: '20px' }}>{po.ai_reasoning}</span>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onClose}
            onMouseEnter={e => { e.currentTarget.style.background = '#DFDFDF'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#EFEFEF'; }}
            style={{ flex: 1, height: 50, background: '#EFEFEF', borderRadius: 22, border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, color: '#111111', transition: 'background 0.18s' }}>
            Close
          </button>
          {isManager && nextStatus && (
            <button
              onClick={handleAdvanceStatus}
              disabled={updating}
              onMouseEnter={e => { if (!updating) e.currentTarget.style.opacity = '0.85'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
              style={{ flex: 2, height: 50, background: updating ? '#DFDFDF' : '#FF9000', borderRadius: 22, border: 'none', cursor: updating ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, color: '#111111', transition: 'opacity 0.18s' }}>
              {updating ? 'Updating…' : NEXT_LABEL[po.status]}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
