import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Printer, ReceiptText } from "lucide-react";
import { localStore } from "@/api/localStore";
import { useAuth } from "@/lib/AuthContext";
import { formatGhs } from "@/lib/format";
import { printDocument } from "@/lib/print";

const dateKey = (value) => new Date(value).toISOString().slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);
const amountByMethod = (sale, method) => (sale.payments || []).filter((payment) => payment.method === method).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

export default function DailyClosing() {
  const { user } = useAuth();
  const [sales, setSales] = useState([]);
  const [date, setDate] = useState(today());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    localStore.entities.Sale.list("-created_date", 1000).then((items) => { setSales(items); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const report = useMemo(() => {
    const completed = sales.filter((sale) => sale.status === "COMPLETED" && dateKey(sale.created_date) === date);
    const totals = completed.reduce((result, sale) => {
      const costs = (sale.items || []).reduce((sum, item) => sum + (Number(item.unit_cost) || 0) * (Number(item.quantity) || 0), 0);
      result.sales += Number(sale.total) || 0;
      result.cash += amountByMethod(sale, "CASH");
      result.momo += amountByMethod(sale, "MOBILE_MONEY");
      result.credit += Number(sale.credit_amount) || 0;
      result.profit += (Number(sale.total) || 0) - costs;
      result.items += (sale.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      return result;
    }, { sales: 0, cash: 0, momo: 0, credit: 0, profit: 0, items: 0 });
    const cashiers = Object.values(completed.reduce((result, sale) => {
      const name = sale.cashier_name || "Unknown";
      const entry = result[name] || { name, transactions: 0, sales: 0, cash: 0, momo: 0, credit: 0 };
      entry.transactions += 1;
      entry.sales += Number(sale.total) || 0;
      entry.cash += amountByMethod(sale, "CASH");
      entry.momo += amountByMethod(sale, "MOBILE_MONEY");
      entry.credit += Number(sale.credit_amount) || 0;
      result[name] = entry;
      return result;
    }, {})).sort((left, right) => right.sales - left.sales);
    return { completed, totals, cashiers };
  }, [sales, date]);

  if (user?.role !== "admin") return <div className="bg-white rounded-lg p-12 text-center"><p className="text-sm text-neutral-400">Only the owner can view daily closing reports.</p></div>;
  if (loading) return <div className="flex items-center justify-center py-40"><div className="w-8 h-8 border-4 border-neutral-200 border-t-[#111111] rounded-full animate-spin" /></div>;

  const { totals, cashiers, completed } = report;
  const metric = (label, value, sub, tone = "bg-white", dark = false) => <div className={`${tone} border border-neutral-100 rounded-lg p-4`}><p className={`text-xs ${dark ? "text-white/70" : "text-neutral-500"}`}>{label}</p><p className={`text-xl font-semibold mt-1 ${dark ? "text-white" : "text-[#111111]"}`}>{value}</p><p className={`text-xs mt-1 ${dark ? "text-white/70" : "text-neutral-500"}`}>{sub}</p></div>;

  return (
    <div className="daily-closing max-w-5xl flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-heading font-light text-[#111111]">Daily Closing</h1><p className="text-sm text-neutral-500 mt-1">Reconcile completed sales and payment totals for the selected date.</p></div>
        <div className="flex gap-2"><label className="h-11 px-3 rounded-md bg-white border border-neutral-200 flex items-center gap-2"><CalendarDays size={16} className="text-neutral-500" /><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="text-sm bg-transparent focus:outline-none" /></label><button onClick={() => printDocument("closing")} className="print-action h-11 w-11 rounded-md bg-[#111111] text-white flex items-center justify-center border-0" title="Print daily closing"><Printer size={17} /></button></div>
      </div>

      <section className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {metric("Sales total", formatGhs(totals.sales), `${completed.length} completed transaction${completed.length === 1 ? "" : "s"}`, "bg-[#111111]", true)}
        {metric("Expected cash", formatGhs(totals.cash), "Cash payments recorded")}
        {metric("Mobile money", formatGhs(totals.momo), "MoMo payments recorded")}
        {metric("Credit issued", formatGhs(totals.credit), "Added to customer balances", "bg-[#fff3e6]")}
        {metric("Gross profit", formatGhs(totals.profit), `${totals.items} item${totals.items === 1 ? "" : "s"} sold`, "bg-[#eff6ec]")}
        {metric("Money collected", formatGhs(totals.cash + totals.momo), "Cash plus MoMo")}
      </section>

      <section className="bg-white rounded-lg border border-neutral-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100"><h2 className="text-sm font-medium text-[#111111]">Cashier reconciliation</h2></div>
        {cashiers.length === 0 ? <div className="p-12 text-center"><ReceiptText size={30} className="text-neutral-300 mx-auto" /><p className="text-sm text-neutral-400 mt-3">No completed sales for this date.</p></div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-neutral-50 text-left text-xs text-neutral-500"><tr><th className="font-medium px-5 py-3">Cashier</th><th className="font-medium px-3 py-3 text-right">Sales</th><th className="font-medium px-3 py-3 text-right">Cash</th><th className="font-medium px-3 py-3 text-right">MoMo</th><th className="font-medium px-5 py-3 text-right">Credit</th></tr></thead><tbody>{cashiers.map((cashier) => <tr key={cashier.name} className="border-t border-neutral-100"><td className="px-5 py-3"><p className="text-[#111111]">{cashier.name}</p><p className="text-xs text-neutral-400">{cashier.transactions} transaction{cashier.transactions === 1 ? "" : "s"}</p></td><td className="px-3 py-3 text-right text-[#111111]">{formatGhs(cashier.sales)}</td><td className="px-3 py-3 text-right text-[#111111]">{formatGhs(cashier.cash)}</td><td className="px-3 py-3 text-right text-[#111111]">{formatGhs(cashier.momo)}</td><td className="px-5 py-3 text-right text-[#b56800]">{formatGhs(cashier.credit)}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}
