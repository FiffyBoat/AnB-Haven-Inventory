import { useState, useEffect, useMemo } from "react";
import { localStore } from "@/api/localStore";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { formatGhs, formatDateTime, isToday } from "@/lib/format";
import ReceiptModal from "@/components/ReceiptModal";
import SaleReturnDialog from "@/components/SaleReturnDialog";
import { Download, ReceiptText } from "lucide-react";

const RANGES = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "all", label: "All" },
];

const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export default function Sales() {
  const { user } = useAuth();
  const isOwner = user?.role === "admin";
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState([]);
  const [range, setRange] = useState("today");
  const [query, setQuery] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [returnSale, setReturnSale] = useState(null);
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    localStore.entities.Sale.list("-created_date", 300)
      .then((s) => { setSales(s); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return sales
      .filter((s) => {
        const d = new Date(s.created_date).getTime();
        if (range === "today") return isToday(s.created_date);
        if (range === "week") return d >= weekAgo;
        return true;
      })
      .filter((s) => !q || [s.sale_number, s.customer_name, s.cashier_name].some((f) => f && String(f).toLowerCase().includes(q)));
  }, [sales, range, query]);

  const revenue = filtered.filter((s) => s.status === "COMPLETED").reduce((sum, s) => sum + (s.total || 0), 0);
  const credit = filtered.reduce((sum, s) => sum + (s.credit_amount || 0), 0);

  const refresh = () => localStore.entities.Sale.list("-created_date", 300).then(setSales);
  const approveReturn = async (payload) => {
    setReturning(true);
    try {
      const result = await localStore.functions.invoke("returnSale", payload);
      if (result.data?.error) throw new Error(result.data.error);
      setReturnSale(null);
      await refresh();
      toast({ title: "Return recorded", description: "The sale, stock ledger, and refund record were updated." });
    } catch (error) {
      toast({ title: "Return failed", description: error.message, variant: "destructive" });
    } finally {
      setReturning(false);
    }
  };

  const exportSales = () => {
    const headings = ["Sale number", "Date", "Status", "Customer", "Cashier", "Subtotal", "Discount", "Total", "Paid", "Credit", "Refunded", "Payment methods", "Items"];
    const rows = filtered.map((sale) => [
      sale.sale_number,
      new Date(sale.created_date).toLocaleString("en-GB"),
      sale.status,
      sale.customer_name || "Walk-in Customer",
      sale.cashier_name,
      Number(sale.subtotal || 0).toFixed(2),
      Number(sale.discount || 0).toFixed(2),
      Number(sale.total || 0).toFixed(2),
      Number(sale.amount_paid || 0).toFixed(2),
      Number(sale.credit_amount || 0).toFixed(2),
      Number(sale.returned_amount || 0).toFixed(2),
      (sale.payments || []).map((payment) => `${payment.method}: ${Number(payment.amount || 0).toFixed(2)}`).join("; "),
      (sale.items || []).map((item) => `${item.product_name} x${item.quantity}`).join("; "),
    ]);
    const csv = [headings, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const file = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `anb-sales-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast({ title: "Sales export downloaded", description: `${filtered.length} sale${filtered.length === 1 ? "" : "s"} exported to CSV.` });
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
          <h1 className="text-2xl font-heading font-light text-[#111111]">Sales</h1>
          <p className="text-sm text-neutral-500 mt-1">{filtered.length} sales · {formatGhs(revenue)} total · {formatGhs(credit)} on credit</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <button key={r.value} onClick={() => setRange(r.value)}
              className="h-11 px-4 rounded-full text-sm cursor-pointer border-none transition-colors"
              style={{ background: range === r.value ? "#111111" : "#FFFFFF", color: range === r.value ? "#FFFFFF" : "#111111" }}>
              {r.label}
            </button>
          ))}
          {isOwner && <button onClick={exportSales} disabled={filtered.length === 0} title="Download sales CSV" className="h-11 px-4 rounded-full bg-[#FF9000] text-sm font-medium text-[#111111] flex items-center gap-2 cursor-pointer border-none disabled:opacity-40"><Download size={15} /> Export</button>}
        </div>
      </div>

      <div className="bg-white rounded-full px-4 h-11 flex items-center gap-2 border border-neutral-100">
        <ReceiptText size={16} className="text-neutral-400 shrink-0" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search sale number, customer or cashier…"
          className="w-full bg-transparent text-sm focus:outline-none border-none" />
      </div>

      <div className="bg-white rounded-3xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <ReceiptText size={32} className="text-neutral-300 mx-auto" />
            <p className="text-sm text-neutral-400 mt-3">No sales in this period.</p>
          </div>
        ) : filtered.map((s) => (
          <button key={s.id} onClick={() => setReceipt(s)}
            className="w-full flex items-center gap-3 px-5 py-4 border-b border-neutral-100 last:border-0 hover:bg-neutral-50 cursor-pointer border-x-0 border-t-0 bg-transparent text-left">
            <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
              <ReceiptText size={16} className="text-neutral-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#111111] truncate">{s.sale_number}</p>
              <p className="text-xs text-neutral-500 truncate">{formatDateTime(s.created_date)} · {s.customer_name || "Walk-in"} · {s.cashier_name}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold text-[#111111]">{formatGhs(s.total)}</p>
              {(s.returned_amount || 0) > 0 && <p className="text-xs text-[#b54635]">returned {formatGhs(s.returned_amount)}</p>}
              {(s.credit_amount || 0) > 0 ? (
                <p className="text-xs text-[#D9624A]">credit {formatGhs(s.credit_amount)}</p>
              ) : (
                <p className="text-xs text-neutral-400">
                  {(s.payments || []).map((p) => p.method === "CASH" ? "Cash" : p.method === "MOBILE_MONEY" ? "MoMo" : p.method).join(" + ") || "—"}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>

      <ReceiptModal open={!!receipt} sale={receipt} onClose={() => setReceipt(null)} onReturn={isOwner ? () => { setReturnSale(receipt); setReceipt(null); } : undefined} />
      <SaleReturnDialog open={!!returnSale} sale={returnSale} onClose={() => setReturnSale(null)} onConfirm={approveReturn} submitting={returning} />
    </div>
  );
}
