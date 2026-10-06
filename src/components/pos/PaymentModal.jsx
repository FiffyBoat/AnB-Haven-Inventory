import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatGhs } from "@/lib/format";
import { Banknote, Smartphone, AlertCircle } from "lucide-react";

const PROVIDERS = ["MTN MoMo", "Vodafone Cash", "AirtelTigo Money"];

export default function PaymentModal({ open, onClose, total, customer, onConfirm, submitting }) {
  const [cash, setCash] = useState("");
  const [momo, setMomo] = useState("");
  const [provider, setProvider] = useState(PROVIDERS[0]);
  const [reference, setReference] = useState("");

  const totalNum = Number(total) || 0;
  const cashNum = Math.max(0, Number(cash) || 0);
  const momoNum = Math.max(0, Number(momo) || 0);
  const paid = Math.min(totalNum, cashNum + momoNum);
  const credit = Math.max(0, totalNum - (cashNum + momoNum));
  const change = Math.max(0, cashNum + momoNum - totalNum);

  const canSubmit = cashNum + momoNum > 0 && (credit === 0 || !!customer);

  const quickCash = () => { setCash(String(totalNum)); setMomo(""); };
  const quickMomo = () => { setMomo(String(totalNum)); setCash(""); };

  const submit = () => {
    if (!canSubmit) return;
    const payments = [];
    if (cashNum > 0) payments.push({ method: "CASH", amount: Math.min(cashNum, totalNum), provider: "", reference: "" });
    if (momoNum > 0) payments.push({ method: "MOBILE_MONEY", amount: Math.min(momoNum, totalNum - cashNum > 0 ? Math.min(momoNum, totalNum - Math.min(cashNum, totalNum)) : momoNum), provider, reference });
    onConfirm(payments);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-white rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-[#111111]">Take Payment</DialogTitle>
        </DialogHeader>
        <div className="rounded-2xl bg-[#111111] text-white px-5 py-4 flex justify-between items-center">
          <span className="text-sm opacity-80">Amount Due</span>
          <span className="text-2xl font-semibold">{formatGhs(totalNum)}</span>
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={quickCash} className="flex-1 h-11 rounded-full border border-neutral-200 text-sm flex items-center justify-center gap-2 hover:border-[#FF9000] transition-colors cursor-pointer">
            <Banknote size={15} /> Full Cash
          </button>
          <button onClick={quickMomo} className="flex-1 h-11 rounded-full border border-neutral-200 text-sm flex items-center justify-center gap-2 hover:border-[#FF9000] transition-colors cursor-pointer">
            <Smartphone size={15} /> Full MoMo
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs text-neutral-500">Cash amount (GHS)</label>
            <input type="number" min="0" step="0.01" value={cash}
              onChange={(e) => setCash(e.target.value)}
              className="w-full mt-1 h-11 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:border-[#FF9000]" />
          </div>
          <div>
            <label className="text-xs text-neutral-500">Mobile money amount (GHS)</label>
            <input type="number" min="0" step="0.01" value={momo}
              onChange={(e) => setMomo(e.target.value)}
              className="w-full mt-1 h-11 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:border-[#FF9000]" />
          </div>
          {momoNum > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-neutral-500">Provider</label>
                <select value={provider} onChange={(e) => setProvider(e.target.value)}
                  className="w-full mt-1 h-11 rounded-xl border border-neutral-200 px-3 text-sm bg-white focus:outline-none focus:border-[#FF9000]">
                  {PROVIDERS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-neutral-500">Transaction ref</label>
                <input value={reference} onChange={(e) => setReference(e.target.value)}
                  placeholder="Optional"
                  className="w-full mt-1 h-11 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:border-[#FF9000]" />
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-2xl bg-neutral-50 px-4 py-3 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-neutral-500">Paid</span><span className="font-medium text-[#111111]">{formatGhs(paid)}</span></div>
          {change > 0 && <div className="flex justify-between"><span className="text-neutral-500">Change due</span><span className="font-medium text-[#5CB540]">{formatGhs(change)}</span></div>}
          {credit > 0 && (
            <div className="flex justify-between">
              <span className="text-neutral-500">Credit to customer</span>
              <span className="font-medium text-[#D9624A]">{formatGhs(credit)}</span>
            </div>
          )}
          {credit > 0 && !customer && (
            <p className="flex items-center gap-1.5 text-xs text-[#D9624A] pt-1"><AlertCircle size={13} /> Select a customer first — credit is recorded to their account.</p>
          )}
        </div>

        <button
          disabled={!canSubmit || submitting}
          onClick={submit}
          className="w-full h-13 mt-4 py-3.5 rounded-full bg-[#FF9000] text-[#111111] font-medium text-sm cursor-pointer border-none disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#ff9d2e] transition-colors">
          {submitting ? "Processing…" : credit > 0 ? "Complete Sale (Credit)" : "Complete Sale"}
        </button>
      </DialogContent>
    </Dialog>
  );
}