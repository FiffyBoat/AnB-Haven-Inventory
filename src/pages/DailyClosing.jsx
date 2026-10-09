import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Printer,
  ReceiptText,
  Boxes,
  AlertTriangle,
  CheckCircle2,
  Search,
  Save,
  Check,
  ShieldAlert,
  ArrowDownCircle,
  FileSpreadsheet,
  Layers,
} from "lucide-react";
import { localStore } from "@/api/localStore";
import { useAuth } from "@/lib/AuthContext";
import { formatGhs, formatDateTime } from "@/lib/format";
import { printDocument } from "@/lib/print";
import { useToast } from "@/components/ui/use-toast";

const dateKey = (value) => new Date(value).toISOString().slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);
const amountByMethod = (sale, method) =>
  (sale.payments || [])
    .filter((payment) => payment.method === method)
    .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

export default function DailyClosing() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [savedClosing, setSavedClosing] = useState(null);
  const [date, setDate] = useState(today());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all"); // "all" | "financial" | "stock"

  // Stock audit input counts state: { [productId]: number | string }
  const [physicalCounts, setPhysicalCounts] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [stockFilter, setStockFilter] = useState("all"); // "all" | "shortages" | "sold" | "matched"
  // Cash drawer balancing state
  const [openingFloat, setOpeningFloat] = useState("");
  const [actualCashInDrawer, setActualCashInDrawer] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [allSales, allProducts, closingLogs] = await Promise.all([
        localStore.entities.Sale.list("-created_date", 1000),
        localStore.entities.Product.list(),
        localStore.entities.DailyClosingLog.filter({ closing_date: date }),
      ]);

      setSales(allSales);
      setProducts(allProducts.filter((p) => p.status === "active"));

      const existing = closingLogs?.[0] || null;
      setSavedClosing(existing);

      if (existing) {
        setNotes(existing.notes || "");
        setOpeningFloat(existing.opening_float !== undefined ? String(existing.opening_float) : "");
        setActualCashInDrawer(existing.actual_cash_in_drawer !== undefined ? String(existing.actual_cash_in_drawer) : "");
        // Pre-fill saved physical counts
        const initialCounts = {};
        (existing.items || []).forEach((item) => {
          if (item.product_id) {
            initialCounts[item.product_id] = item.actual_remaining;
          }
        });
        setPhysicalCounts(initialCounts);
      } else {
        setNotes("");
        // Default physical count to current system stock
        const defaultCounts = {};
        allProducts.forEach((p) => {
          defaultCounts[p.id] = Number(p.current_stock) || 0;
        });
        setPhysicalCounts(defaultCounts);
      }
    } catch (err) {
      console.error("Failed to load daily closing data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [date]);

  // Listen for background cloud sync updates
  useEffect(() => {
    const handleSync = () => fetchData();
    window.addEventListener("anb_data_synced", handleSync);
    return () => window.removeEventListener("anb_data_synced", handleSync);
  }, [date]);

  // Financial reconciliation calculation
  const report = useMemo(() => {
    const completed = sales.filter(
      (sale) => sale.status === "COMPLETED" && dateKey(sale.created_date) === date
    );

    const totals = completed.reduce(
      (result, sale) => {
        const costs = (sale.items || []).reduce(
          (sum, item) =>
            sum + (Number(item.unit_cost) || 0) * (Number(item.quantity) || 0),
          0
        );
        result.sales += Number(sale.total) || 0;
        result.cash += amountByMethod(sale, "CASH");
        result.momo += amountByMethod(sale, "MOBILE_MONEY");
        result.credit += Number(sale.credit_amount) || 0;
        result.profit += (Number(sale.total) || 0) - costs;
        result.items += (sale.items || []).reduce(
          (sum, item) => sum + (Number(item.quantity) || 0),
          0
        );
        return result;
      },
      { sales: 0, cash: 0, momo: 0, credit: 0, profit: 0, items: 0 }
    );

    const cashiers = Object.values(
      completed.reduce((result, sale) => {
        const name = sale.cashier_name || "Unknown";
        const entry = result[name] || {
          name,
          transactions: 0,
          sales: 0,
          cash: 0,
          momo: 0,
          credit: 0,
        };
        entry.transactions += 1;
        entry.sales += Number(sale.total) || 0;
        entry.cash += amountByMethod(sale, "CASH");
        entry.momo += amountByMethod(sale, "MOBILE_MONEY");
        entry.credit += Number(sale.credit_amount) || 0;
        result[name] = entry;
        return result;
      }, {})
    ).sort((left, right) => right.sales - left.sales);

    // Map quantities sold today per product
    const soldCountByProduct = {};
    completed.forEach((sale) => {
      (sale.items || []).forEach((item) => {
        if (item.product_id) {
          soldCountByProduct[item.product_id] =
            (soldCountByProduct[item.product_id] || 0) +
            (Number(item.quantity) || 0);
        }
      });
    });

    return { completed, totals, cashiers, soldCountByProduct };
  }, [sales, date]);

  // Inventory & remaining items audit calculations
  const stockAudit = useMemo(() => {
    const list = products.map((product) => {
      const soldToday = report.soldCountByProduct[product.id] || 0;
      const expectedRemaining = Number(product.current_stock) || 0;
      const rawCount = physicalCounts[product.id];
      const actualRemaining =
        rawCount === undefined || rawCount === ""
          ? expectedRemaining
          : Number(rawCount);

      const variance = actualRemaining - expectedRemaining;
      const sellingPrice = Number(product.selling_price) || 0;
      const costPrice = Number(product.cost_price) || 0;
      const isShortage = variance < 0;
      const isSurplus = variance > 0;
      const isMatch = variance === 0;
      const shortageValue = isShortage ? Math.abs(variance) * sellingPrice : 0;

      return {
        product_id: product.id,
        product_name: product.name,
        sku: product.sku || "-",
        category: product.category || "General",
        selling_price: sellingPrice,
        cost_price: costPrice,
        sold_today: soldToday,
        expected_remaining: expectedRemaining,
        actual_remaining: actualRemaining,
        variance,
        isShortage,
        isSurplus,
        isMatch,
        shortageValue,
      };
    });

    const totalSoldToday = list.reduce((sum, item) => sum + item.sold_today, 0);
    const totalRemaining = list.reduce(
      (sum, item) => sum + item.actual_remaining,
      0
    );
    const shortages = list.filter((item) => item.isShortage);
    const totalShortageItems = shortages.reduce(
      (sum, item) => sum + Math.abs(item.variance),
      0
    );
    const totalShortageValue = shortages.reduce(
      (sum, item) => sum + item.shortageValue,
      0
    );

    return {
      items: list,
      totalSoldToday,
      totalRemaining,
      shortagesCount: shortages.length,
      totalShortageItems,
      totalShortageValue,
    };
  }, [products, report.soldCountByProduct, physicalCounts]);

  // Filtered list for display
  const filteredStockItems = useMemo(() => {
    let result = stockAudit.items;
    const needle = searchQuery.trim().toLowerCase();

    if (needle) {
      result = result.filter(
        (i) =>
          i.product_name.toLowerCase().includes(needle) ||
          i.sku.toLowerCase().includes(needle) ||
          i.category.toLowerCase().includes(needle)
      );
    }

    if (stockFilter === "shortages") {
      result = result.filter((i) => i.isShortage);
    } else if (stockFilter === "sold") {
      result = result.filter((i) => i.sold_today > 0);
    } else if (stockFilter === "matched") {
      result = result.filter((i) => i.isMatch);
    }

    return result;
  }, [stockAudit.items, searchQuery, stockFilter]);

  const handleSetAllToExpected = () => {
    const updated = {};
    products.forEach((p) => {
      updated[p.id] = Number(p.current_stock) || 0;
    });
    setPhysicalCounts(updated);
    toast({
      title: "Shelf counts set to system stock",
      description: "You can now edit any specific items that have physical shortages or excess.",
    });
  };

  const handleSaveClosing = async () => {
    setSaving(true);
    try {
      const payload = {
        date,
        opening_float: Number(openingFloat) || 0,
        actual_cash_in_drawer: actualCashInDrawer === "" ? null : Number(actualCashInDrawer),
        financials: report.totals,
        cashier_breakdown: report.cashiers,
        items: stockAudit.items.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          sku: i.sku,
          category: i.category,
          selling_price: i.selling_price,
          cost_price: i.cost_price,
          sold_today: i.sold_today,
          expected_remaining: i.expected_remaining,
          actual_remaining: i.actual_remaining,
          variance: i.variance,
          shortage_value: i.shortageValue,
        })),
        total_items_sold: stockAudit.totalSoldToday,
        total_remaining_stock: stockAudit.totalRemaining,
        total_variance_count: stockAudit.totalShortageItems,
        total_shortage_value: stockAudit.totalShortageValue,
        notes: notes.trim(),
      };

      const result = await localStore.functions.invoke(
        "saveDailyClosingLog",
        payload
      );
      if (result.data?.error) throw new Error(result.data.error);

      setSavedClosing(result.data.closing_record);
      toast({
        title: "Daily Closing Audit Saved! 🔒",
        description: `Remaining quantities recorded for ${date}. Synced to cloud for owner verification.`,
      });
    } catch (err) {
      toast({
        title: "Could not save closing audit",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== "admin") {
    return (
      <div className="bg-white rounded-lg p-12 text-center">
        <p className="text-sm text-neutral-400">
          Only the owner can view and perform daily closing audits.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <div className="w-8 h-8 border-4 border-neutral-200 border-t-[#111111] rounded-full animate-spin" />
      </div>
    );
  }

  const { totals, cashiers, completed } = report;
  const metric = (label, value, sub, tone = "bg-white", dark = false) => (
    <div className={`${tone} border border-neutral-100 rounded-2xl p-4 shadow-sm`}>
      <p className={`text-xs ${dark ? "text-white/70" : "text-neutral-500"}`}>{label}</p>
      <p className={`text-xl font-semibold mt-1 ${dark ? "text-white" : "text-[#111111]"}`}>{value}</p>
      <p className={`text-xs mt-1 ${dark ? "text-white/70" : "text-neutral-500"}`}>{sub}</p>
    </div>
  );

  return (
    <div className="daily-closing max-w-5xl flex flex-col gap-5">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-heading font-light text-[#111111]">Daily Closing &amp; Stock Audit</h1>
            {savedClosing ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800">
                <Check size={12} /> Audit Closed &amp; Saved
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800">
                Pending Closing
              </span>
            )}
          </div>
          <p className="text-sm text-neutral-500 mt-1">
            Reconcile completed cash/MoMo sales and verify remaining physical stock to detect unrecorded sales or theft.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="h-11 px-3 rounded-xl bg-white border border-neutral-200 flex items-center gap-2 shadow-sm">
            <CalendarDays size={16} className="text-neutral-500" />
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="text-sm bg-transparent focus:outline-none cursor-pointer"
            />
          </label>
          <button
            onClick={() => printDocument("closing")}
            className="print-action h-11 w-11 rounded-xl bg-[#111111] hover:bg-neutral-800 text-white flex items-center justify-center border-0 shadow-sm transition-colors cursor-pointer"
            title="Print daily closing & stock sheet"
          >
            <Printer size={17} />
          </button>
        </div>
      </div>

      {/* Audit Saved Banner (if previously closed) */}
      {savedClosing && (
        <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-emerald-900">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <div>
              <p className="font-semibold text-emerald-950">
                Closing Audit Completed for {savedClosing.closing_date}
              </p>
              <p className="text-emerald-700 mt-0.5">
                Closed by <span className="font-medium">{savedClosing.closed_by_name}</span> at {formatDateTime(savedClosing.updated_date || savedClosing.created_date)}
                {savedClosing.notes ? ` · Note: "${savedClosing.notes}"` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-emerald-800 bg-white px-2.5 py-1 rounded-lg border border-emerald-200">
              {savedClosing.total_remaining_stock} units recorded
            </span>
          </div>
        </div>
      )}

      {/* Theft Prevention Alert Banner (if shortages detected) */}
      {stockAudit.shortagesCount > 0 ? (
        <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-900 flex items-start gap-3 text-xs shadow-sm">
          <div className="p-2 rounded-xl bg-rose-200/60 text-rose-700 shrink-0 mt-0.5">
            <ShieldAlert size={20} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-rose-950 flex items-center gap-2">
              <span>⚠️ Discrepancy Alert: {stockAudit.totalShortageItems} Missing Unit(s) Detected!</span>
              <span className="text-[11px] font-normal px-2 py-0.5 rounded bg-rose-200 text-rose-900">
                Est. Shortage Value: {formatGhs(stockAudit.totalShortageValue)}
              </span>
            </p>
            <p className="mt-1 text-rose-800 leading-relaxed">
              Physical shelf count is lower than expected system stock for {stockAudit.shortagesCount} item(s).
              This indicates items were physically removed from the shop without being recorded as completed sales in the POS.
            </p>
            <button
              onClick={() => setStockFilter("shortages")}
              className="mt-2 font-semibold underline text-rose-950 hover:text-black cursor-pointer"
            >
              Filter table to review {stockAudit.shortagesCount} missing product(s) →
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 text-emerald-900 flex items-center gap-2.5 text-xs">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <p>
            <span className="font-semibold">Stock Reconciled:</span> All entered physical shelf quantities perfectly match the expected remaining inventory. No missing stock detected.
          </p>
        </div>
      )}

      {/* View Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-200 pb-2">
        <button
          onClick={() => setActiveTab("all")}
          className={`h-9 px-4 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "all"
              ? "bg-[#111111] text-white shadow-sm"
              : "bg-white text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          <Layers size={14} /> Full Closing Sheet
        </button>
        <button
          onClick={() => setActiveTab("stock")}
          className={`h-9 px-4 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "stock"
              ? "bg-[#111111] text-white shadow-sm"
              : "bg-white text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          <Boxes size={14} /> Daily Stock &amp; Theft Audit
          {stockAudit.shortagesCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("financial")}
          className={`h-9 px-4 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "financial"
              ? "bg-[#111111] text-white shadow-sm"
              : "bg-white text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          <ReceiptText size={14} /> Financial &amp; Cashier Reconciliation
        </button>
      </div>

      {/* SECTION 1: Financial Reconciliation */}
      {(activeTab === "all" || activeTab === "financial") && (
        <div className="flex flex-col gap-4">
          <section className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {metric(
              "Sales total",
              formatGhs(totals.sales),
              `${completed.length} completed transaction${completed.length === 1 ? "" : "s"}`,
              "bg-[#111111]",
              true
            )}
            {metric("Expected cash in drawer", formatGhs(totals.cash), "Cash payments recorded")}
            {metric("Mobile money", formatGhs(totals.momo), "MoMo payments recorded")}
            {metric("Credit issued", formatGhs(totals.credit), "Added to customer balances", "bg-[#fff3e6]")}
            {metric("Gross profit", formatGhs(totals.profit), `${totals.items} item${totals.items === 1 ? "" : "s"} sold`, "bg-[#eff6ec]")}
            {metric("Total money collected", formatGhs(totals.cash + totals.momo), "Cash in drawer + MoMo total")}
          </section>

          {/* Cash Drawer Reconciliation & Float Handover Card */}
          <section className="bg-white rounded-2xl border border-neutral-100 p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-neutral-100 gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[#111111]">Cash Register &amp; Drawer Handover</h2>
                <p className="text-xs text-neutral-400 mt-0.5">Compare opening float + cash sales against the physical cash in drawer</p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-600 font-medium self-start sm:self-auto">
                Shift Balancing
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-4 text-xs">
              <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                <label className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block mb-1">
                  Opening Float (GHS)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={openingFloat}
                  onChange={(e) => setOpeningFloat(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg border border-neutral-200 bg-white font-mono font-semibold text-sm text-[#111111] focus:outline-none focus:border-[#FF9000]"
                />
                <p className="text-[10px] text-neutral-400 mt-1">Cash in drawer at shift start</p>
              </div>

              <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block mb-1">
                  Cash Sales Today
                </span>
                <p className="text-sm font-mono font-bold text-emerald-700 h-9 flex items-center">
                  +{formatGhs(totals.cash)}
                </p>
                <p className="text-[10px] text-neutral-400 mt-1">Recorded cash receipts</p>
              </div>

              <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block mb-1">
                  Expected Drawer Total
                </span>
                <p className="text-sm font-mono font-bold text-[#111111] h-9 flex items-center">
                  ={formatGhs((Number(openingFloat) || 0) + totals.cash)}
                </p>
                <p className="text-[10px] text-neutral-400 mt-1">Float + cash sales</p>
              </div>

              <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                <label className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block mb-1">
                  Actual Physical Cash (GHS)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={actualCashInDrawer}
                  onChange={(e) => setActualCashInDrawer(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg border border-neutral-200 bg-white font-mono font-semibold text-sm text-[#111111] focus:outline-none focus:border-[#FF9000]"
                />
                <p className="text-[10px] text-neutral-400 mt-1">Physical count at shift close</p>
              </div>
            </div>

            {/* Cash Discrepancy Alert */}
            {actualCashInDrawer !== "" && (() => {
              const expectedTotal = (Number(openingFloat) || 0) + totals.cash;
              const actualTotal = Number(actualCashInDrawer) || 0;
              const diff = actualTotal - expectedTotal;
              if (Math.abs(diff) < 0.01) {
                return (
                  <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span><strong>Cash Balanced:</strong> Actual physical cash matches expected drawer total (Float + Sales).</span>
                  </div>
                );
              }
              if (diff < 0) {
                return (
                  <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                      <span><strong>Cash Shortage:</strong> Physical drawer is missing <strong>{formatGhs(Math.abs(diff))}</strong>.</span>
                    </div>
                    <span className="font-mono font-bold text-rose-700">-{formatGhs(Math.abs(diff))}</span>
                  </div>
                );
              }
              return (
                <div className="mt-3 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-blue-600 shrink-0" />
                    <span><strong>Cash Surplus:</strong> Physical drawer has <strong>+{formatGhs(diff)}</strong> extra.</span>
                  </div>
                  <span className="font-mono font-bold text-blue-700">+{formatGhs(diff)}</span>
                </div>
              );
            })()}
          </section>

          {/* Cashier Breakdown Table */}
          <section className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#111111]">Cashier Reconciliation</h2>
              <span className="text-xs text-neutral-400">End-of-day register balancing</span>
            </div>
            {cashiers.length === 0 ? (
              <div className="p-8 text-center">
                <ReceiptText size={26} className="text-neutral-300 mx-auto" />
                <p className="text-xs text-neutral-400 mt-2">No completed sales recorded for this date.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
                    <tr>
                      <th className="font-medium px-5 py-3">Cashier</th>
                      <th className="font-medium px-3 py-3 text-right">Transactions</th>
                      <th className="font-medium px-3 py-3 text-right">Sales</th>
                      <th className="font-medium px-3 py-3 text-right">Cash in Drawer</th>
                      <th className="font-medium px-3 py-3 text-right">MoMo</th>
                      <th className="font-medium px-5 py-3 text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashiers.map((cashier) => (
                      <tr key={cashier.name} className="border-t border-neutral-100 hover:bg-neutral-50/50">
                        <td className="px-5 py-3.5">
                          <p className="text-[#111111] font-medium">{cashier.name}</p>
                        </td>
                        <td className="px-3 py-3.5 text-right text-xs text-neutral-500">
                          {cashier.transactions}
                        </td>
                        <td className="px-3 py-3.5 text-right font-semibold text-[#111111]">
                          {formatGhs(cashier.sales)}
                        </td>
                        <td className="px-3 py-3.5 text-right font-medium text-emerald-700">
                          {formatGhs(cashier.cash)}
                        </td>
                        <td className="px-3 py-3.5 text-right font-medium text-blue-700">
                          {formatGhs(cashier.momo)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-medium text-[#b56800]">
                          {formatGhs(cashier.credit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* SECTION 2: Item-by-Item Remaining Stock & Theft Audit */}
      {(activeTab === "all" || activeTab === "stock") && (
        <section className="bg-white rounded-3xl border border-neutral-100 shadow-sm overflow-hidden flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-100">
            <div>
              <h2 className="text-base font-semibold text-[#111111] flex items-center gap-2">
                <Boxes size={18} className="text-[#FF9000]" />
                Daily Stock Remaining &amp; Theft Audit
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Verify remaining shelf stock against recorded sales. Any shortage flags items sold without being entered into POS.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSetAllToExpected}
                className="h-9 px-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-[#111111] text-xs font-medium transition-colors cursor-pointer"
                title="Fill all physical counts with current system numbers"
              >
                Reset All to Expected
              </button>
            </div>
          </div>

          {/* Quick Stock Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-100">
              <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Total Products</p>
              <p className="text-xl font-bold text-[#111111] mt-1">{products.length}</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">Active shop catalog</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-100">
              <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Sold Today</p>
              <p className="text-xl font-bold text-emerald-700 mt-1">{stockAudit.totalSoldToday}</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">Recorded in sales today</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-100">
              <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Remaining Shelf Stock</p>
              <p className="text-xl font-bold text-[#111111] mt-1">{stockAudit.totalRemaining}</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">Total units on shelves</p>
            </div>
            <div
              className={`p-3.5 rounded-2xl border ${
                stockAudit.shortagesCount > 0
                  ? "bg-rose-50 border-rose-200 text-rose-900"
                  : "bg-emerald-50 border-emerald-200 text-emerald-900"
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">Stock Discrepancy</p>
              <p className="text-xl font-bold mt-1">
                {stockAudit.shortagesCount > 0
                  ? `-${stockAudit.totalShortageItems} Missing`
                  : "0 Discrepancy"}
              </p>
              <p className="text-[11px] mt-0.5 font-medium">
                {stockAudit.shortagesCount > 0
                  ? `${formatGhs(stockAudit.totalShortageValue)} unrecorded loss`
                  : "100% Reconciled"}
              </p>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 h-10 px-3.5 rounded-xl border border-neutral-200 bg-white max-w-sm flex-1">
              <Search size={15} className="text-neutral-400" />
              <input
                type="text"
                placeholder="Search item, SKU or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-transparent focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setStockFilter("all")}
                className={`h-8 px-3 rounded-lg font-medium transition-colors cursor-pointer ${
                  stockFilter === "all"
                    ? "bg-[#111111] text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                All Items ({stockAudit.items.length})
              </button>
              <button
                type="button"
                onClick={() => setStockFilter("shortages")}
                className={`h-8 px-3 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  stockFilter === "shortages"
                    ? "bg-rose-600 text-white"
                    : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                }`}
              >
                <AlertTriangle size={12} /> Shortages Only ({stockAudit.shortagesCount})
              </button>
              <button
                type="button"
                onClick={() => setStockFilter("sold")}
                className={`h-8 px-3 rounded-lg font-medium transition-colors cursor-pointer ${
                  stockFilter === "sold"
                    ? "bg-emerald-700 text-white"
                    : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                }`}
              >
                Sold Today ({stockAudit.items.filter((i) => i.sold_today > 0).length})
              </button>
              <button
                type="button"
                onClick={() => setStockFilter("matched")}
                className={`h-8 px-3 rounded-lg font-medium transition-colors cursor-pointer ${
                  stockFilter === "matched"
                    ? "bg-neutral-800 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                Matched ({stockAudit.items.filter((i) => i.isMatch).length})
              </button>
            </div>
          </div>

          {/* Product Items Table */}
          <div className="border border-neutral-100 rounded-2xl overflow-hidden mt-1">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-xs text-neutral-500 text-left border-b border-neutral-100">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Item &amp; Details</th>
                    <th className="px-3 py-3 font-semibold text-right">Price</th>
                    <th className="px-3 py-3 font-semibold text-center">Sold Today</th>
                    <th className="px-3 py-3 font-semibold text-right">Expected Stock</th>
                    <th className="px-4 py-3 font-semibold text-right">Physical Closing Count</th>
                    <th className="px-4 py-3 font-semibold text-right">Audit Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredStockItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-xs text-neutral-400">
                        No products match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredStockItems.map((item) => {
                      const rawValue = physicalCounts[item.product_id];
                      return (
                        <tr
                          key={item.product_id}
                          className={`hover:bg-neutral-50/60 transition-colors ${
                            item.isShortage ? "bg-rose-50/30" : ""
                          }`}
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium text-[#111111] text-xs sm:text-sm">
                              {item.product_name}
                            </p>
                            <p className="text-[11px] text-neutral-400">
                              SKU: {item.sku} · {item.category}
                            </p>
                          </td>
                          <td className="px-3 py-3 text-right text-xs font-medium text-neutral-600">
                            {formatGhs(item.selling_price)}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {item.sold_today > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                                {item.sold_today} sold
                              </span>
                            ) : (
                              <span className="text-xs text-neutral-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right text-xs font-semibold text-neutral-700">
                            {item.expected_remaining}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              min="0"
                              value={rawValue ?? item.expected_remaining}
                              onChange={(e) =>
                                setPhysicalCounts({
                                  ...physicalCounts,
                                  [item.product_id]: e.target.value,
                                })
                              }
                              className={`h-9 w-20 px-2 text-right rounded-lg border text-xs font-semibold focus:outline-none transition-colors ${
                                item.isShortage
                                  ? "border-rose-400 bg-rose-50 text-rose-900 focus:border-rose-600"
                                  : item.isSurplus
                                  ? "border-blue-400 bg-blue-50 text-blue-900 focus:border-blue-600"
                                  : "border-neutral-200 bg-white text-[#111111] focus:border-[#111111]"
                              }`}
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            {item.isMatch && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                                <Check size={13} /> Matched
                              </span>
                            )}
                            {item.isShortage && (
                              <div className="flex flex-col items-end">
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">
                                  <AlertTriangle size={12} /> {item.variance} missing
                                </span>
                                <span className="text-[10px] text-rose-600 font-medium mt-0.5">
                                  Loss: {formatGhs(item.shortageValue)}
                                </span>
                              </div>
                            )}
                            {item.isSurplus && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
                                +{item.variance} surplus
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Closing Notes & Save Action Section */}
          <div className="pt-3 border-t border-neutral-100 flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-4">
            <div className="flex-1 max-w-xl">
              <label className="text-xs font-semibold text-neutral-700 block mb-1">
                Closing Remarks &amp; Shelf Count Notes
              </label>
              <input
                type="text"
                placeholder="e.g. End of day count verified with Cashier. Drawer and shelf reconciled."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full h-11 px-4 rounded-xl border border-neutral-200 text-xs focus:outline-none focus:border-[#111111] bg-white shadow-sm"
              />
            </div>

            <button
              type="button"
              onClick={handleSaveClosing}
              disabled={saving}
              className="h-11 px-6 rounded-full bg-[#111111] hover:bg-neutral-800 text-white font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50 shrink-0"
            >
              <Save size={15} />
              {saving ? "Saving Closing..." : savedClosing ? "Update Closing Audit" : "Save Daily Closing Audit"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
