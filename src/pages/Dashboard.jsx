import { useState, useEffect } from "react";
import { Navigate, Link } from "react-router-dom";
import { localStore } from "@/api/localStore";
import { useAuth } from "@/lib/AuthContext";
import { motion } from "framer-motion";
import { formatGhs, formatDateTime, isToday } from "@/lib/format";
import {
  TrendingUp,
  ShoppingCart,
  Banknote,
  Smartphone,
  CreditCard,
  Plus,
  ArrowRight,
  Boxes,
  AlertTriangle,
  XCircle,
  ReceiptText,
  Calendar,
  UserCheck,
  Package,
  Users,
} from "lucide-react";

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } };

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [period, setPeriod] = useState("today"); // 'today' | 'week' | 'month' | 'all'

  useEffect(() => {
    const fetchData = () => {
      Promise.all([
        localStore.entities.Product.list(),
        localStore.entities.Sale.list("-created_date", 200),
        localStore.entities.Customer.list(),
      ])
        .then(([p, s, c]) => {
          setProducts(p);
          setSales(s);
          setCustomers(c);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    };

    fetchData();

    const handleSync = () => {
      fetchData();
    };

    window.addEventListener("anb_data_synced", handleSync);
    return () => window.removeEventListener("anb_data_synced", handleSync);
  }, []);

  if (!user) return null;
  if (user.role !== "admin") return <Navigate to="/pos" replace />;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <div className="w-8 h-8 border-4 border-[#FF9000] border-t-[#111111] rounded-full animate-spin" />
      </div>
    );
  }

  const active = products.filter((p) => p.status === "active");
  const periodSales = sales.filter((s) => {
    if (s.status !== "COMPLETED") return false;
    if (period === "all") return true;
    const time = new Date(s.created_date).getTime();
    const now = Date.now();
    if (period === "today") return isToday(s.created_date);
    if (period === "week") return now - time <= 7 * 86400000;
    if (period === "month") return now - time <= 30 * 86400000;
    return true;
  });

  const periodLabel =
    period === "today"
      ? "Today's"
      : period === "week"
      ? "7-Day"
      : period === "month"
      ? "30-Day"
      : "All-Time";

  const revenue = periodSales.reduce((sum, s) => sum + (s.total || 0), 0);
  const itemsSold = periodSales.reduce(
    (sum, s) => sum + (s.items || []).reduce((a, i) => a + (i.quantity || 0), 0),
    0
  );
  const grossProfit = periodSales.reduce(
    (sum, s) =>
      sum + (s.items || []).reduce((a, i) => a + ((i.total || 0) - (i.unit_cost || 0) * (i.quantity || 0)), 0),
    0
  );
  const marginPct = revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : "0.0";
  const cashTotal = periodSales.reduce(
    (sum, s) => sum + (s.payments || []).filter((p) => p.method === "CASH").reduce((a, p) => a + (p.amount || 0), 0),
    0
  );
  const momoTotal = periodSales.reduce(
    (sum, s) => sum + (s.payments || []).filter((p) => p.method === "MOBILE_MONEY").reduce((a, p) => a + (p.amount || 0), 0),
    0
  );
  const creditTotal = periodSales.reduce((sum, s) => sum + (s.credit_amount || 0), 0);

  const lowStock = active.filter((p) => (p.current_stock || 0) > 0 && (p.current_stock || 0) <= (p.reorder_level || 0));
  const outOfStock = active.filter((p) => (p.current_stock || 0) === 0);
  const healthyStock = active.length - lowStock.length - outOfStock.length;
  const totalUnits = active.reduce((sum, p) => sum + (p.current_stock || 0), 0);
  const inventoryValue = active.reduce((sum, p) => sum + (p.current_stock || 0) * (p.cost_price || 0), 0);
  const outstanding = customers.reduce((sum, c) => sum + (c.current_balance || 0), 0);
  const debtors = customers
    .filter((c) => (c.current_balance || 0) > 0)
    .sort((a, b) => (b.current_balance || 0) - (a.current_balance || 0));

  const byCashier = Object.values(
    periodSales.reduce((acc, s) => {
      const k = s.cashier_name || "Staff";
      acc[k] = acc[k] || { name: k, total: 0, count: 0 };
      acc[k].total += s.total || 0;
      acc[k].count += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.total - a.total);

  const maxCashierRevenue = byCashier.length > 0 ? Math.max(...byCashier.map((c) => c.total), 1) : 1;

  const todayFormatted = new Date().toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="flex flex-col gap-6">
      {/* Header & Quick Action Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading font-light text-[#111111] text-2xl sm:text-3xl tracking-tight">
            Danny&apos;s Heaven Ventures Overview
          </h1>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-neutral-500 mt-1">
            <Calendar size={14} className="text-neutral-400" />
            <span>{todayFormatted}</span>
            <span>·</span>
            <span className="text-emerald-600 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Live Store Data
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            to="/pos"
            className="h-11 px-5 rounded-full bg-[#FF9000] hover:bg-[#ff9d2e] text-[#111111] font-semibold text-sm flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
          >
            <ShoppingCart size={16} /> Open POS Checkout
          </Link>
          <Link
            to="/products"
            className="h-11 px-4 rounded-full bg-white hover:bg-neutral-50 text-[#111111] font-medium text-sm flex items-center gap-2 border border-neutral-200 shadow-sm transition-colors cursor-pointer"
          >
            <Plus size={16} /> Add Product
          </Link>
        </div>
      </div>

      {/* Time Range Pills & Stock Alerts */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-white rounded-full border border-neutral-200 shadow-sm">
          {[
            { key: "today", label: "Today" },
            { key: "week", label: "Last 7 Days" },
            { key: "month", label: "Last 30 Days" },
            { key: "all", label: "All Time" },
          ].map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer border-none transition-all ${
                period === p.key
                  ? "bg-[#111111] text-white shadow-sm"
                  : "bg-transparent text-neutral-500 hover:text-[#111111]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory Stock Alert Banner */}
      {(lowStock.length > 0 || outOfStock.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 text-amber-700">
              <AlertTriangle size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-900">Inventory Stock Alert</p>
              <p className="text-xs text-amber-800 mt-0.5">
                {outOfStock.length > 0 && (
                  <span className="mr-2">
                    <strong>{outOfStock.length}</strong> product(s) completely out of stock.
                  </span>
                )}
                {lowStock.length > 0 && (
                  <span>
                    <strong>{lowStock.length}</strong> product(s) at or below reorder level.
                  </span>
                )}
              </p>
            </div>
          </div>
          <Link
            to="/products"
            className="text-xs font-semibold px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white transition-colors shrink-0"
          >
            Review &amp; Restock →
          </Link>
        </div>
      )}

      {/* Primary KPI Grid (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Sales */}
        <motion.div
          variants={itemVariants}
          className="bg-[#111111] text-white rounded-3xl p-5 shadow-sm flex flex-col justify-between min-h-[145px]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              {periodLabel} Sales
            </span>
            <span className="p-2 rounded-xl bg-white/10 text-[#FF9000]">
              <TrendingUp size={18} />
            </span>
          </div>
          <div className="mt-4">
            <p className="text-3xl font-light font-heading tracking-tight text-white">{formatGhs(revenue)}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-neutral-300 font-medium">
                {periodSales.length} orders
              </span>
              <span className="text-xs text-neutral-400">· {itemsSold} units sold</span>
            </div>
          </div>
        </motion.div>

        {/* Card 2: Gross Profit */}
        <motion.div
          variants={itemVariants}
          className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-sm flex flex-col justify-between min-h-[145px]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Gross Profit</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Banknote size={18} />
            </span>
          </div>
          <div className="mt-4">
            <p className="text-3xl font-light font-heading tracking-tight text-emerald-700">{formatGhs(grossProfit)}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-100">
                {marginPct}% margin
              </span>
              <span className="text-xs text-neutral-400">vs purchase cost</span>
            </div>
          </div>
        </motion.div>

        {/* Card 3: Payments Collected */}
        <motion.div
          variants={itemVariants}
          className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-sm flex flex-col justify-between min-h-[145px]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Collections</span>
            <span className="p-2 rounded-xl bg-orange-50 text-[#FF9000]">
              <Smartphone size={18} />
            </span>
          </div>
          <div className="mt-4">
            <p className="text-3xl font-light font-heading tracking-tight text-[#111111]">
              {formatGhs(cashTotal + momoTotal)}
            </p>
            <div className="flex items-center gap-2 mt-2 text-xs text-neutral-500 flex-wrap">
              <span className="inline-flex items-center gap-1 font-medium text-neutral-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Cash {formatGhs(cashTotal)}
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1 font-medium text-neutral-700">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> MoMo {formatGhs(momoTotal)}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Card 4: Inventory Value */}
        <motion.div
          variants={itemVariants}
          className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-sm flex flex-col justify-between min-h-[145px]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Inventory Value</span>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Boxes size={18} />
            </span>
          </div>
          <div className="mt-4">
            <p className="text-3xl font-light font-heading tracking-tight text-[#111111]">{formatGhs(inventoryValue)}</p>
            <div className="flex items-center gap-2 mt-2 text-xs text-neutral-500">
              <span className="font-medium text-neutral-700">{totalUnits} units</span>
              <span>across</span>
              <span className="font-medium text-neutral-700">{active.length} SKUs</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Middle Grid: Stock Alerts & Debtors/Cashiers */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Stock Alerts Card */}
        <motion.div variants={itemVariants} className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div>
              <h2 className="text-sm font-semibold text-[#111111] flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" /> Stock Health &amp; Alerts
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">Automated reorder status</p>
            </div>
            <Link to="/products" className="text-xs font-medium text-neutral-600 hover:text-[#111111] flex items-center gap-1">
              View all products <ArrowRight size={12} />
            </Link>
          </div>

          {/* Quick status pills */}
          <div className="grid grid-cols-3 gap-2.5 my-4">
            <div className="rounded-2xl bg-rose-50 border border-rose-100 p-3">
              <p className="text-2xl font-semibold text-rose-700">{outOfStock.length}</p>
              <p className="text-xs text-rose-600 font-medium mt-0.5 flex items-center gap-1">
                <XCircle size={12} /> Out of stock
              </p>
            </div>
            <div className="rounded-2xl bg-amber-50 border border-amber-100 p-3">
              <p className="text-2xl font-semibold text-amber-700">{lowStock.length}</p>
              <p className="text-xs text-amber-600 font-medium mt-0.5 flex items-center gap-1">
                <AlertTriangle size={12} /> Low stock
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-3">
              <p className="text-2xl font-semibold text-emerald-700">{healthyStock}</p>
              <p className="text-xs text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
                <Package size={12} /> Adequate
              </p>
            </div>
          </div>

          {/* Low/out of stock items list */}
          {[...outOfStock, ...lowStock].length === 0 ? (
            <div className="py-6 text-center text-neutral-500 text-xs bg-neutral-50 rounded-2xl">
              <p className="font-medium text-neutral-700">All products have sufficient stock levels.</p>
              <p className="mt-0.5 text-neutral-400">No immediate restock required.</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {[...outOfStock, ...lowStock].slice(0, 7).map((p) => {
                const isOut = (p.current_stock || 0) === 0;
                return (
                  <Link
                    key={p.id}
                    to={`/products/${p.id}`}
                    className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-neutral-50 transition-colors border border-transparent hover:border-neutral-100"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="text-sm font-medium text-[#111111] truncate">{p.name}</p>
                      <p className="text-xs text-neutral-400">
                        {p.sku} · Reorder point: {p.reorder_level || 0}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ${
                        isOut ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {isOut ? "Out of Stock" : `${p.current_stock} left`}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Customer Receivables & Cashier Leaderboard */}
        <motion.div variants={itemVariants} className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div>
                <h2 className="text-sm font-semibold text-[#111111] flex items-center gap-2">
                  <CreditCard size={16} className="text-rose-500" /> Customer Receivables &amp; Staff
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">Credit ledger &amp; cashier performance</p>
              </div>
              <Link to="/customers" className="text-xs font-medium text-neutral-600 hover:text-[#111111] flex items-center gap-1">
                Manage Debtors <ArrowRight size={12} />
              </Link>
            </div>

            {/* Total credit banner */}
            <div className="bg-neutral-50 rounded-2xl p-4 my-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Total Outstanding Debt</p>
                <p className="text-2xl font-bold text-rose-600 mt-1">{formatGhs(outstanding)}</p>
                <p className="text-xs text-neutral-500 mt-0.5">Across {debtors.length} customer account(s)</p>
              </div>
              {creditTotal > 0 && (
                <div className="text-right">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                    +{formatGhs(creditTotal)} today
                  </span>
                </div>
              )}
            </div>

            {/* Top Debtors */}
            {debtors.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Top Debtors</p>
                <div className="space-y-1.5">
                  {debtors.slice(0, 3).map((d) => (
                    <div key={d.id || d.name} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-neutral-50">
                      <div className="flex items-center gap-2 truncate">
                        <Users size={13} className="text-neutral-400 shrink-0" />
                        <span className="font-medium text-[#111111] truncate">{d.name}</span>
                        {d.phone && <span className="text-neutral-400 text-[11px] truncate">({d.phone})</span>}
                      </div>
                      <span className="font-semibold text-rose-600 shrink-0">{formatGhs(d.current_balance)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Cashier performance leaderboard */}
          <div className="pt-3 border-t border-neutral-100">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2.5">
              Cashier Performance — Today
            </p>
            {byCashier.length === 0 ? (
              <p className="text-xs text-neutral-400 py-2">No cashier sales recorded yet today.</p>
            ) : (
              <div className="space-y-2.5">
                {byCashier.map((c) => {
                  const pct = Math.round((c.total / maxCashierRevenue) * 100);
                  return (
                    <div key={c.name} className="text-xs">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-[#111111] flex items-center gap-1.5">
                          <UserCheck size={13} className="text-[#FF9000]" /> {c.name}
                        </span>
                        <span className="text-neutral-500">
                          {c.count} sale{c.count > 1 ? "s" : ""} · <strong className="text-[#111111] font-semibold">{formatGhs(c.total)}</strong>
                        </span>
                      </div>
                      <div className="w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-[#111111] h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(5, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Recent Sales Feed Table */}
      <motion.div variants={itemVariants} className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
          <div>
            <h2 className="text-sm font-semibold text-[#111111] flex items-center gap-2">
              <ReceiptText size={16} className="text-[#FF9000]" /> Recent Transactions
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">Completed customer sales</p>
          </div>
          <Link to="/sales" className="text-xs font-medium text-neutral-600 hover:text-[#111111] flex items-center gap-1">
            View all sales <ArrowRight size={12} />
          </Link>
        </div>

        {sales.length === 0 ? (
          <div className="py-12 text-center text-neutral-400 flex flex-col items-center">
            <ReceiptText size={32} className="text-neutral-200 mb-2 stroke-[1.5]" />
            <p className="text-sm font-medium text-neutral-600">No sales recorded yet</p>
            <p className="text-xs text-neutral-400 mt-1">Open POS to register your first sale transaction.</p>
            <Link
              to="/pos"
              className="mt-4 px-4 py-2 rounded-full bg-[#FF9000] text-[#111111] text-xs font-semibold"
            >
              Launch POS
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 mt-1">
            {sales.slice(0, 6).map((s) => {
              const hasCredit = (s.credit_amount || 0) > 0;
              const hasMomo = (s.payments || []).some((p) => p.method === "MOBILE_MONEY");
              const hasCash = (s.payments || []).some((p) => p.method === "CASH");
              return (
                <Link
                  key={s.id}
                  to="/sales"
                  className="flex items-center justify-between py-3 px-2 rounded-xl hover:bg-neutral-50 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <div className="w-10 h-10 rounded-2xl bg-neutral-100 flex items-center justify-center shrink-0 group-hover:bg-[#FF9000]/10 transition-colors">
                      <ReceiptText size={17} className="text-neutral-600 group-hover:text-[#FF9000] transition-colors" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#111111] truncate">
                        {s.sale_number} · {s.customer_name || "Walk-in Customer"}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-neutral-500 mt-0.5 flex-wrap">
                        <span>{formatDateTime(s.created_date)}</span>
                        <span>·</span>
                        <span>{s.cashier_name}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1 font-medium">
                          {hasCash && <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">Cash</span>}
                          {hasMomo && <span className="text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded">MoMo</span>}
                          {hasCredit && <span className="text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded">Credit</span>}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-[#111111]">{formatGhs(s.total)}</p>
                    {hasCredit && (
                      <p className="text-xs font-medium text-rose-600 mt-0.5">
                        Credit {formatGhs(s.credit_amount)}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
