import { useState, useEffect } from "react";
import { localStore } from "@/api/localStore";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { formatGhs, formatDateTime } from "@/lib/format";
import { Plus, UserRound, X } from "lucide-react";

export default function Customers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isOwner = user?.role === "admin";
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", credit_limit: "" });
  const [detail, setDetail] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [payAmount, setPayAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    localStore.entities.Customer.list()
      .then((c) => { setCustomers(c); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(() => {
    refresh();
    window.addEventListener("anb_data_synced", refresh);
    return () => window.removeEventListener("anb_data_synced", refresh);
  }, []);

  const filtered = customers.filter((c) => {
    const q = query.trim().toLowerCase();
    return !q || [c.name, c.phone].some((f) => f && String(f).toLowerCase().includes(q));
  });

  const openDetail = async (c) => {
    setDetail(c);
    setPayAmount("");
    localStore.entities.CreditTransaction.filter({ customer_id: c.id })
      .then((t) => setTransactions(t.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))))
      .catch(() => setTransactions([]));
  };

  const addCustomer = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      await localStore.entities.Customer.create({
        name: form.name.trim(), phone: form.phone.trim(),
        credit_limit: Number(form.credit_limit) || 0, current_balance: 0, status: "active",
      });
      setAddOpen(false);
      setForm({ name: "", phone: "", credit_limit: "" });
      refresh();
    } catch (err) {
      toast({ title: "Could not save customer", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const recordPayment = async () => {
    const amount = Number(payAmount);
    if (!amount || amount <= 0) return;
    setBusy(true);
    try {
      const res = await localStore.functions.invoke("recordCreditPayment", { customer_id: detail.id, amount, description: "Credit repayment" });
      if (res.data?.error) throw new Error(res.data.error);
      toast({ title: "Payment recorded", description: `New balance: ${formatGhs(res.data.balance)}` });
      refresh();
      openDetail({ ...detail, current_balance: res.data.balance });
    } catch (err) {
      toast({ title: "Payment failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const setLimit = async (v) => {
    try {
      await localStore.entities.Customer.update(detail.id, { credit_limit: Number(v) || 0 });
      refresh();
      setDetail({ ...detail, credit_limit: Number(v) || 0 });
    } catch (err) {
      toast({ title: "Could not update limit", description: err.message, variant: "destructive" });
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-40">
      <div className="w-8 h-8 border-4 border-figma-accent border-t-[#111111] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-light text-[#111111]">Customers</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {customers.length} customers · {formatGhs(customers.reduce((s, c) => s + (c.current_balance || 0), 0))} outstanding credit
          </p>
        </div>
        <button onClick={() => setAddOpen(true)} className="h-11 px-5 rounded-full bg-[#FF9000] text-sm font-medium text-[#111111] flex items-center gap-2 cursor-pointer border-none">
          <Plus size={15} /> New Customer
        </button>
      </div>

      <div className="bg-white rounded-3xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <UserRound size={32} className="text-neutral-300 mx-auto" />
            <p className="text-sm text-neutral-400 mt-3">No customers yet.</p>
          </div>
        ) : filtered.map((c) => (
          <button key={c.id} onClick={() => openDetail(c)} className="w-full flex items-center justify-between px-5 py-4 border-b border-neutral-100 last:border-0 hover:bg-neutral-50 cursor-pointer border-x-0 border-t-0 bg-transparent text-left">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#111111]">{c.name}</p>
              <p className="text-xs text-neutral-500">{c.phone || "No phone"}</p>
            </div>
            <div className="text-right shrink-0">
              <p className={"text-sm font-medium " + ((c.current_balance || 0) > 0 ? "text-[#D9624A]" : "text-[#616E5D]")}>
                {(c.current_balance || 0) > 0 ? `owes ${formatGhs(c.current_balance)}` : "no debt"}
              </p>
              {(c.credit_limit || 0) > 0 && <p className="text-xs text-neutral-400">limit {formatGhs(c.credit_limit)}</p>}
            </div>
          </button>
        ))}
      </div>

      {/* Add customer */}
      {addOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setAddOpen(false)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium text-[#111111] mb-4">New Customer</p>
            <div className="space-y-2">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name *"
                className="w-full h-11 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:border-[#FF9000]" />
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone"
                className="w-full h-11 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:border-[#FF9000]" />
              <input type="number" min="0" step="0.01" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} placeholder="Credit limit (GHS) — 0 = no limit set"
                className="w-full h-11 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:border-[#FF9000]" />
            </div>
            <button disabled={busy} onClick={addCustomer} className="w-full h-12 mt-4 rounded-full bg-[#111111] text-white text-sm cursor-pointer border-none disabled:opacity-40">Save Customer</button>
          </div>
        </div>
      )}

      {/* Customer detail / statement */}
      {detail && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-base font-medium text-[#111111]">{detail.name}</p>
                <p className="text-xs text-neutral-500">{detail.phone || "No phone"}</p>
              </div>
              <button onClick={() => setDetail(null)} className="text-neutral-400 hover:text-[#111111] cursor-pointer border-none bg-transparent"><X size={18} /></button>
            </div>

            <div className="mt-4 rounded-2xl bg-[#111111] text-white px-4 py-3 flex justify-between items-center">
              <span className="text-xs opacity-75">Outstanding balance</span>
              <span className="text-lg font-semibold">{formatGhs(detail.current_balance)}</span>
            </div>

            <div className="mt-4">
              <p className="text-xs text-neutral-500">Record a repayment</p>
              <div className="flex gap-2 mt-1">
                <input type="number" min="0" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="Amount (GHS)"
                  className="flex-1 h-11 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:border-[#FF9000]" />
                <button disabled={busy || !payAmount} onClick={recordPayment} className="h-11 px-4 rounded-xl bg-[#FF9000] text-[#111111] text-sm font-medium cursor-pointer border-none disabled:opacity-40">Record</button>
              </div>
            </div>

            {isOwner && (
              <div className="mt-3">
                <label className="text-xs text-neutral-500">Credit limit (owner only)</label>
                <input type="number" min="0" step="0.01" defaultValue={detail.credit_limit || 0} onBlur={(e) => setLimit(e.target.value)}
                  className="w-full mt-1 h-11 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:border-[#FF9000]" />
              </div>
            )}

            <p className="text-xs text-neutral-500 mt-5 mb-1">Credit statement</p>
            <div className="max-h-56 overflow-y-auto">
              {transactions.length === 0 && <p className="text-xs text-neutral-400 py-3 text-center">No credit activity.</p>}
              {transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0">
                  <div>
                    <p className="text-sm text-[#111111]">{t.transaction_type === "CREDIT_SALE" ? "Credit sale" : t.transaction_type === "CREDIT_PAYMENT" ? "Repayment" : "Adjustment"}</p>
                    <p className="text-xs text-neutral-400">{formatDateTime(t.created_date)}{t.description ? ` · ${t.description}` : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium" style={{ color: t.transaction_type === "CREDIT_PAYMENT" ? "#616E5D" : "#D9624A" }}>
                      {t.transaction_type === "CREDIT_PAYMENT" ? "-" : "+"}{formatGhs(t.amount)}
                    </p>
                    <p className="text-xs text-neutral-400">bal {formatGhs(t.balance_after)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
