import { useState, useEffect } from "react";
import { localStore } from "@/api/localStore";
import { X, Package, Building2, Send, CheckCircle2, XCircle, Lightbulb, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const statusColors = {
  suggested: "bg-orange-100 text-orange-700",
  pending_approval: "bg-yellow-100 text-yellow-700",
  approved: "bg-blue-100 text-blue-700",
  sent: "bg-purple-100 text-purple-700",
  received: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-600",
};
const statusLabels = {
  suggested: "Suggested", pending_approval: "Pending Approval",
  approved: "Approved", sent: "Sent", received: "Received", cancelled: "Cancelled",
};

function ConfirmDialog({ open, onClose, title, children, onConfirm, confirmLabel = "Confirm", confirmClass = "bg-indigo-600 hover:bg-indigo-700 text-white" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-xl p-6 w-full max-w-md mx-4 z-10">
        <h3 className="font-semibold text-lg mb-4">{title}</h3>
        <div className="mb-5">{children}</div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className={confirmClass} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex gap-3">
      <span className="text-xs text-muted-foreground w-28 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export default function PODrawer({ po, product: propProduct, supplier, isManager, onClose, onUpdate }) {
  const [dialog, setDialog] = useState(null); // "approve" | "send" | "receive" | "cancel"
  const [transitioning, setTransitioning] = useState(false);
  // Fix 3: live product fetched fresh each time the drawer opens
  const [liveProduct, setLiveProduct] = useState(propProduct);

  // Fix 1: ESC key closes drawer
  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Fix 3: re-fetch product on every open so current_stock is fresh
  useEffect(() => {
    if (!po?.product_id) return;
    setLiveProduct(propProduct); // show cached immediately while fetching
    localStore.entities.Product.get(po.product_id).then(setLiveProduct).catch(() => {});
  }, [po?.id]);

  if (!po) return null;

  const product = liveProduct || propProduct;
  const today = new Date().toISOString().split("T")[0];
  const currentStock = product?.current_stock || 0;
  const newStock = currentStock + (po.quantity || 0);

  const doUpdate = async (updates, successMsg) => {
    setTransitioning(true);
    setDialog(null);
    await localStore.entities.PurchaseOrder.update(po.id, updates);
    onUpdate(po.id, updates);
    toast.success(successMsg);
    setTimeout(() => { onClose(); setTransitioning(false); }, 800);
  };

  // Fix 2: approve handler
  const handleApprove = () => doUpdate(
    { status: "approved", approval_date: today },
    `PO approved · ${po.quantity} units of ${product?.name}`
  );

  const handleSend = () => doUpdate(
    { status: "sent" },
    `PO sent to ${supplier?.contact_name || supplier?.name} at ${supplier?.name}`
  );

  const handleReceive = async () => {
    await localStore.entities.PurchaseOrder.update(po.id, { status: "received" });
    if (product) {
      await localStore.entities.Product.update(po.product_id, { current_stock: newStock });
      await localStore.entities.StockMovement.create({
        product_id: po.product_id,
        movement_type: "restock",
        quantity: po.quantity,
        movement_date: today,
        notes: `PO #${po.id?.slice(-6)} received`,
      });
    }
    setDialog(null);
    onUpdate(po.id, { status: "received" });
    toast.success(`Stock updated: +${po.quantity} units added to ${product?.name}`);
    setTimeout(onClose, 800);
  };

  const handleCancel = () => doUpdate({ status: "cancelled" }, "Purchase order cancelled");

  const isTerminal = ["received", "cancelled"].includes(po.status);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg z-50 bg-card border-l border-border shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="font-bold text-lg">Purchase Order</h2>
            <span className="font-mono text-xs text-muted-foreground">#{po.id?.slice(-8)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColors[po.status]}`}>
              {statusLabels[po.status]}
            </span>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Product */}
          <section className="bg-muted/40 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" /> Product
            </h3>
            <div className="flex items-center gap-3">
              {product?.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-14 h-14 rounded-lg object-cover border border-border" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-muted border border-border flex items-center justify-center">
                  <Package className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
              <div>
                <p className="font-semibold">{product?.name || "—"}</p>
                <p className="text-xs text-muted-foreground">{product?.sku} · {product?.category}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Current stock: {product?.current_stock ?? "—"} units</p>
              </div>
            </div>
          </section>

          {/* Supplier */}
          <section className="bg-muted/40 rounded-xl p-4 space-y-2.5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Supplier
            </h3>
            <InfoRow label="Name" value={supplier?.name} />
            <InfoRow label="Contact" value={supplier?.contact_name} />
            <InfoRow label="Email" value={supplier?.email} />
            <InfoRow label="Phone" value={supplier?.phone} />
            <InfoRow label="Payment Terms" value={supplier?.payment_terms} />
          </section>

          {/* Order details */}
          <section className="bg-muted/40 rounded-xl p-4 space-y-2.5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Order Details</h3>
            <InfoRow label="Quantity" value={`${po.quantity} units`} />
            <InfoRow label="Unit Cost" value={`$${po.unit_cost?.toLocaleString()}`} />
            <InfoRow label="Total Cost" value={`$${po.total_cost?.toLocaleString()}`} />
          </section>

          {/* Dates */}
          <section className="bg-muted/40 rounded-xl p-4 space-y-2.5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dates</h3>
            <InfoRow label="Suggested" value={po.suggested_date} />
            <InfoRow label="Approved" value={po.approval_date} />
            <InfoRow label="Expected Delivery" value={po.expected_delivery} />
          </section>

          {/* AI Reasoning */}
          {po.is_ai_suggested && po.ai_reasoning && (
            <section className="bg-accent/5 border border-accent/20 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-accent uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Lightbulb className="w-3.5 h-3.5" /> AI Reasoning
              </h3>
              <p className="text-xs text-foreground/80 leading-relaxed">{po.ai_reasoning}</p>
            </section>
          )}
        </div>

        {/* Actions footer — Manager only, non-terminal */}
        {isManager && !isTerminal && (
          <div className="shrink-0 border-t border-border p-4 space-y-2">
            {/* Fix 2: Approve button for pending_approval */}
            {po.status === "pending_approval" && (
              <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-2" onClick={() => setDialog("approve")} disabled={transitioning}>
                <Check className="w-4 h-4" /> Approve PO
              </Button>
            )}
            {po.status === "approved" && (
              <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-2" onClick={() => setDialog("send")} disabled={transitioning}>
                <Send className="w-4 h-4" /> Send to Supplier
              </Button>
            )}
            {po.status === "sent" && (
              <Button className="w-full bg-green-600 hover:bg-green-700 text-white gap-2" onClick={() => setDialog("receive")} disabled={transitioning}>
                <CheckCircle2 className="w-4 h-4" /> Mark as Received
              </Button>
            )}
            <Button variant="ghost" className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 gap-2" onClick={() => setDialog("cancel")} disabled={transitioning}>
              <XCircle className="w-4 h-4" /> Cancel Order
            </Button>
          </div>
        )}
      </div>

      {/* Fix 2: Approve Dialog */}
      <ConfirmDialog open={dialog === "approve"} onClose={() => setDialog(null)} title="Approve Purchase Order" onConfirm={handleApprove} confirmLabel="Confirm Approve">
        <p className="text-sm text-muted-foreground">
          Approve this purchase order for <strong>{po.quantity} units</strong> of{" "}
          <strong>{product?.name}</strong>? Total:{" "}
          <strong>${po.total_cost?.toLocaleString()}</strong>.
          This will move it to <strong>Approved</strong> status.
        </p>
      </ConfirmDialog>

      {/* Send Dialog */}
      <ConfirmDialog open={dialog === "send"} onClose={() => setDialog(null)} title="Send Purchase Order" onConfirm={handleSend} confirmLabel="Send Now">
        <p className="text-sm text-muted-foreground mb-3">This PO will be sent to:</p>
        <div className="bg-muted rounded-xl p-4 space-y-1.5 mb-4">
          <p className="font-bold text-foreground">{supplier?.name}</p>
          {supplier?.contact_name && <p className="text-sm text-muted-foreground">{supplier.contact_name}</p>}
          {supplier?.email && (
            <p className="text-sm font-medium bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md inline-block">{supplier.email}</p>
          )}
          {supplier?.phone && <p className="text-xs text-muted-foreground">{supplier.phone}</p>}
          {supplier?.payment_terms && <p className="text-xs text-muted-foreground">Terms: {supplier.payment_terms}</p>}
        </div>
        <p className="text-sm text-muted-foreground">
          <strong>{po.quantity} units</strong> of <strong>{product?.name}</strong> · Total{" "}
          <strong>${po.total_cost?.toLocaleString()}</strong>
          {po.expected_delivery && ` · Delivery ${po.expected_delivery}`}
        </p>
      </ConfirmDialog>

      {/* Receive Dialog */}
      <ConfirmDialog
        open={dialog === "receive"}
        onClose={() => setDialog(null)}
        title="Mark as Received"
        onConfirm={handleReceive}
        confirmLabel="Confirm Received"
        confirmClass="bg-green-600 hover:bg-green-700 text-white"
      >
        <p className="text-sm text-muted-foreground mb-3">
          Marking as Received will add <strong>{po.quantity} units</strong> to <strong>{product?.name}</strong>'s stock.
        </p>
        <div className="bg-muted rounded-xl p-4 flex items-center gap-4">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Current</p>
            <p className="text-2xl font-bold">{currentStock}</p>
          </div>
          <div className="text-2xl text-muted-foreground font-light">→</div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">New Stock</p>
            <p className="text-2xl font-bold text-green-600">{newStock}</p>
          </div>
          <div className="ml-auto text-sm font-medium text-green-600">+{po.quantity} units</div>
        </div>
      </ConfirmDialog>

      {/* Cancel Dialog */}
      <ConfirmDialog
        open={dialog === "cancel"}
        onClose={() => setDialog(null)}
        title="Cancel Order"
        onConfirm={handleCancel}
        confirmLabel="Cancel Order"
        confirmClass="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
      >
        <p className="text-sm text-muted-foreground">
          Are you sure you want to cancel this purchase order for <strong>{po.quantity} units</strong> of{" "}
          <strong>{product?.name}</strong>? This action cannot be undone.
        </p>
      </ConfirmDialog>
    </>
  );
}
