import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatGhs } from "@/lib/format";
import { Undo2 } from "lucide-react";

const METHODS = [
  { value: "CASH", label: "Cash refund" },
  { value: "MOBILE_MONEY", label: "Mobile money refund" },
  { value: "CREDIT_BALANCE", label: "Reduce customer credit" },
];

export default function SaleReturnDialog({ open, sale, onClose, onConfirm, submitting }) {
  const [quantities, setQuantities] = useState({});
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState("CASH");
  const [restock, setRestock] = useState(true);

  useEffect(() => {
    if (open) {
      setQuantities({});
      setReason("");
      setRefundMethod("CASH");
      setRestock(true);
    }
  }, [open]);

  const selected = useMemo(() => (sale?.items || []).map((item, index) => {
    const available = (Number(item.quantity) || 0) - (Number(item.returned_quantity) || 0);
    const quantity = Math.min(Math.max(0, Number(quantities[index]) || 0), available);
    return { index, item, available, quantity };
  }).filter((line) => line.quantity > 0), [sale, quantities]);
  const lineTotal = (sale?.items || []).reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const estimatedRefund = selected.reduce((sum, line) => sum + ((Number(line.item.total) || 0) * line.quantity / (Number(line.item.quantity) || 1)), 0) * ((Number(sale?.total) || 0) / (lineTotal || 1));
  const canConfirm = selected.length > 0 && reason.trim().length > 0 && !(refundMethod === "CREDIT_BALANCE" && !sale?.customer_id);

  if (!sale) return null;
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-lg bg-white rounded-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2 text-[#111111]"><Undo2 size={18} /> Return sale {sale.sale_number}</DialogTitle></DialogHeader>
        <p className="text-sm text-neutral-500">Owner approval is required. This records the return and never deletes the original sale.</p>
        <div className="mt-3 space-y-2">
          {(sale.items || []).map((item, index) => {
            const available = (Number(item.quantity) || 0) - (Number(item.returned_quantity) || 0);
            return <div key={`${item.product_id}-${index}`} className="border border-neutral-200 rounded-md p-3 flex items-center gap-3"><div className="flex-1 min-w-0"><p className="text-sm font-medium text-[#111111] truncate">{item.product_name}</p><p className="text-xs text-neutral-500">Sold {item.quantity} · Available to return {available} · {formatGhs(item.total)}</p>{item.identifier && <p className="text-xs text-neutral-400">{item.identifier}</p>}</div><input type="number" min="0" max={available} disabled={available === 0} value={quantities[index] ?? ""} onChange={(event) => setQuantities({ ...quantities, [index]: event.target.value })} placeholder="Qty" className="w-16 h-10 rounded-md border border-neutral-200 text-center text-sm focus:outline-none focus:border-[#ff9000] disabled:bg-neutral-100" /></div>;
          })}
        </div>
        <div className="mt-4 grid sm:grid-cols-2 gap-3">
          <label><span className="text-xs text-neutral-500">Refund method</span><select value={refundMethod} onChange={(event) => setRefundMethod(event.target.value)} className="w-full mt-1 h-11 rounded-md border border-neutral-200 px-3 text-sm bg-white focus:outline-none focus:border-[#ff9000]">{METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</select></label>
          <label><span className="text-xs text-neutral-500">Reason for return</span><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Faulty item" className="w-full mt-1 h-11 rounded-md border border-neutral-200 px-3 text-sm focus:outline-none focus:border-[#ff9000]" /></label>
        </div>
        {refundMethod === "CREDIT_BALANCE" && !sale.customer_id && <p className="text-xs text-[#b54635]">Only sales linked to a customer can reduce a credit balance.</p>}
        <label className="mt-4 flex items-start gap-2 text-sm text-[#111111]"><input type="checkbox" checked={restock} onChange={(event) => setRestock(event.target.checked)} className="mt-0.5 accent-[#ff9000]" /><span>Return selected items to sellable stock. Leave unchecked for damaged or unsellable items.</span></label>
        <div className="mt-4 rounded-md bg-neutral-50 px-4 py-3 flex justify-between text-sm"><span className="text-neutral-500">Estimated refund</span><span className="font-semibold text-[#111111]">{formatGhs(estimatedRefund)}</span></div>
        <div className="flex gap-2 mt-4"><button onClick={onClose} className="flex-1 h-11 rounded-md bg-neutral-100 text-sm text-[#111111] border-0">Cancel</button><button disabled={!canConfirm || submitting} onClick={() => onConfirm({ sale_id: sale.id, items: selected.map((line) => ({ item_index: line.index, quantity: line.quantity })), reason, refund_method: refundMethod, restock })} className="flex-1 h-11 rounded-md bg-[#111111] text-white text-sm disabled:opacity-40 border-0">{submitting ? "Processing..." : "Approve return"}</button></div>
      </DialogContent>
    </Dialog>
  );
}
