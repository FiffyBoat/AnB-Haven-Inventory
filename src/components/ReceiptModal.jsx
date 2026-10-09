import { useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatGhs, formatDateTime } from "@/lib/format";
import { Printer, Undo2, X } from "lucide-react";
import { printDocument } from "@/lib/print";

export default function ReceiptModal({ open, onClose, sale, onReturn, autoPrint = false }) {
  if (!sale) return null;
  const credit = (sale.credit_amount || 0) > 0;

  // Optional auto-print trigger once modal opens
  useEffect(() => {
    if (open && autoPrint) {
      const timer = setTimeout(() => {
        printDocument("receipt");
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [open, autoPrint]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md p-0 bg-transparent border-0 shadow-none">
        <div className="receipt-print bg-white rounded-3xl overflow-hidden">
          <div className="px-6 pt-6 pb-4 text-center border-b border-dashed border-neutral-300">
            <p className="font-bold text-lg text-[#111111] uppercase tracking-wide">DANNY&apos;S HEAVEN VENTURES</p>
            <p className="text-xs text-neutral-600 mt-1">Retail &amp; Wholesale · Phones, Laptops &amp; Accessories</p>
            <p className="text-xs text-neutral-500 mt-0.5">Takoradi - Acalema, Ghana · GPS: GA-183-4921</p>
            <p className="text-xs text-neutral-600 font-medium mt-0.5">Contact: +233 59 239 0609</p>
          </div>
          <div className="px-6 py-3 text-xs text-neutral-600 space-y-1 border-b border-dashed border-neutral-300">
            <div className="flex justify-between"><span>Receipt</span><span className="font-medium text-[#111111]">{sale.sale_number}</span></div>
            <div className="flex justify-between"><span>Date</span><span>{formatDateTime(sale.created_date)}</span></div>
            <div className="flex justify-between"><span>Served by</span><span className="font-semibold text-[#111111]">{sale.cashier_name || "Cashier"}</span></div>
            <div className="flex justify-between"><span>Customer</span><span>{sale.customer_name || "Walk-in Customer"}</span></div>
          </div>
          <div className="px-6 py-3 border-b border-dashed border-neutral-300">
            {(sale.items || []).map((it, i) => (
              <div key={i} className="mb-2 text-sm">
                <div className="flex justify-between text-[#111111]">
                  <span className="pr-2">{it.product_name}{it.identifier ? ` (${it.identifier})` : ""}</span>
                  <span className="whitespace-nowrap">{formatGhs(it.total)}</span>
                </div>
                <div className="flex justify-between text-xs text-neutral-500">
                  <span>{it.quantity} × {formatGhs(it.unit_price)}{it.discount ? ` · less ${formatGhs(it.discount)}` : ""}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="px-6 py-3 text-sm space-y-1 border-b border-dashed border-neutral-300">
            <div className="flex justify-between text-neutral-600"><span>Subtotal</span><span>{formatGhs(sale.subtotal)}</span></div>
            {(sale.discount || 0) > 0 && (
              <div className="flex justify-between text-neutral-600"><span>Discount</span><span>-{formatGhs(sale.discount)}</span></div>
            )}
            <div className="flex justify-between font-semibold text-base text-[#111111] pt-1"><span>TOTAL</span><span>{formatGhs(sale.total)}</span></div>
          </div>
          <div className="px-6 py-3 text-sm space-y-1 border-b border-dashed border-neutral-300">
            {(sale.payments || []).map((p, i) => (
              <div key={i} className="flex justify-between text-neutral-600">
                <span>{p.method === "CASH" ? "Cash" : p.method === "MOBILE_MONEY" ? `Mobile Money${p.provider ? " (" + p.provider + ")" : ""}` : p.method}</span>
                <span>{formatGhs(p.amount)}</span>
              </div>
            ))}
            {credit && (
              <div className="flex justify-between text-[#D9624A] font-medium">
                <span>Credit (balance due)</span><span>{formatGhs(sale.credit_amount)}</span>
              </div>
            )}
          </div>
          <div className="px-6 py-4 text-center text-xs text-neutral-500">
            <p>No refund without receipt. Warranty per item policy.</p>
            <p className="mt-1">Thank you for your business!</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3 print:hidden">
          <button onClick={() => printDocument("receipt")} className="flex-1 h-12 rounded-full bg-[#111111] text-white text-sm flex items-center justify-center gap-2 cursor-pointer border-none">
            <Printer size={16} /> Print Receipt
          </button>
          {onReturn && <button onClick={onReturn} className="h-12 w-12 rounded-full bg-[#fff3e6] text-[#111111] flex items-center justify-center cursor-pointer border-none" title="Return items"><Undo2 size={17} /></button>}
          <button onClick={onClose} className="h-12 w-12 rounded-full bg-white text-[#111111] flex items-center justify-center cursor-pointer border-none">
            <X size={18} />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
