import { useState, useEffect } from "react";
import { Navigate, Link } from "react-router-dom";
import { localStore } from "@/api/localStore";
import { useAuth } from "@/lib/AuthContext";
import { motion } from "framer-motion";
import StatCard from "@/components/StatCard";
import { formatGhs, formatDateTime, isToday } from "@/lib/format";
import { ReceiptText } from "lucide-react";

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } };

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    Promise.all([
    localStore.entities.Product.list(),
    localStore.entities.Sale.list("-created_date", 200),
    localStore.entities.Customer.list()]
    ).then(([p, s, c]) => {
      setProducts(p);setSales(s);setCustomers(c);setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (!user) return null;
  if (user.role !== "admin") return <Navigate to="/pos" replace />;

  if (loading) return (
    <div className="flex items-center justify-center py-40">
      <div className="w-8 h-8 border-4 border-figma-accent border-t-[#111111] rounded-full animate-spin" />
    </div>);


  const active = products.filter((p) => p.status === "active");
  const todaySales = sales.filter((s) => s.status === "COMPLETED" && isToday(s.created_date));
  const revenue = todaySales.reduce((sum, s) => sum + (s.total || 0), 0);
  const itemsSold = todaySales.reduce((sum, s) => sum + (s.items || []).reduce((a, i) => a + (i.quantity || 0), 0), 0);
  const grossProfit = todaySales.reduce((sum, s) =>
  sum + (s.items || []).reduce((a, i) => a + ((i.total || 0) - (i.unit_cost || 0) * (i.quantity || 0)), 0), 0);
  const cashTotal = todaySales.reduce((sum, s) => sum + (s.payments || []).filter((p) => p.method === "CASH").reduce((a, p) => a + (p.amount || 0), 0), 0);
  const momoTotal = todaySales.reduce((sum, s) => sum + (s.payments || []).filter((p) => p.method === "MOBILE_MONEY").reduce((a, p) => a + (p.amount || 0), 0), 0);
  const creditTotal = todaySales.reduce((sum, s) => sum + (s.credit_amount || 0), 0);

  const lowStock = active.filter((p) => (p.current_stock || 0) > 0 && (p.current_stock || 0) <= (p.reorder_level || 0));
  const outOfStock = active.filter((p) => (p.current_stock || 0) === 0);
  const totalUnits = active.reduce((sum, p) => sum + (p.current_stock || 0), 0);
  const inventoryValue = active.reduce((sum, p) => sum + (p.current_stock || 0) * (p.cost_price || 0), 0);
  const outstanding = customers.reduce((sum, c) => sum + (c.current_balance || 0), 0);
  const debtors = customers.filter((c) => (c.current_balance || 0) > 0);

  const byCashier = Object.values(
    todaySales.reduce((acc, s) => {
      const k = s.cashier_name || "Unknown";
      acc[k] = acc[k] || { name: k, total: 0, count: 0 };
      acc[k].total += s.total || 0;
      acc[k].count += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.total - a.total);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading font-light text-[#111111] text-2xl">Today at Haven Ventures</h1>
        <p className="text-sm text-neutral-500 mt-1">Live snapshot of sales, stock and credit.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Today's Sales" value={formatGhs(revenue)} sub={`${todaySales.length} transactions`} tone="dark" />
        <StatCard label="Gross Profit Today" value={formatGhs(grossProfit)} sub={`${itemsSold} items sold`} tone="accent" />
        <StatCard label="Cash" value={formatGhs(cashTotal)} sub="Today" />
        <StatCard label="Mobile Money" value={formatGhs(momoTotal)} sub="Today" />
        <StatCard label="Credit Sales" value={formatGhs(creditTotal)} sub="Today" />
        <StatCard label="Inventory Value" value={formatGhs(inventoryValue)} sub={`${totalUnits} units · ${active.length} SKUs`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Low stock */}
        <motion.div variants={itemVariants} className="bg-white rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-[#111111]">Stock Alerts</h2>
            <Link to="/products" className="text-xs text-neutral-500 hover:text-[#111111]">View all products</Link>
          </div>
          <div className="flex gap-3 mt-3">
            <div className="flex-1 rounded-2xl bg-[#FFF3E6] px-4 py-3">
              <p className="text-2xl font-light font-heading text-[#D9624A]">{lowStock.length}</p>
              <p className="text-xs text-neutral-600 mt-1">Low stock</p>
            </div>
            <div className="flex-1 rounded-2xl bg-[#FDEAE6] px-4 py-3">
              <p className="text-2xl font-light font-heading text-[#F13A15]">{outOfStock.length}</p>
              <p className="text-xs text-neutral-600 mt-1">Out of stock</p>
            </div>
            <div className="flex-1 rounded-2xl bg-[#EFF6EC] px-4 py-3">
              <p className="text-2xl font-light font-heading text-[#616E5D]">{debtors.length}</p>
              <p className="text-xs text-neutral-600 mt-1">Customers owing</p>
            </div>
          </div>
          {(lowStock.length > 0 || outOfStock.length > 0) &&
          <div className="mt-4 space-y-2 max-h-56 overflow-y-auto">
              {[...lowStock, ...outOfStock].slice(0, 8).map((p) =>
            <Link key={p.id} to={`/products/${p.id}`} className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-neutral-50">
                  <span className="text-sm text-[#111111] truncate pr-2">{p.name}</span>
                  <span className={"text-xs font-medium " + ((p.current_stock || 0) === 0 ? "text-[#F13A15]" : "text-[#D9624A]")}>
                    {p.current_stock || 0} left
                  </span>
                </Link>
            )}
            </div>
          }
        </motion.div>

        {/* Credit + cashiers */}
        <motion.div variants={itemVariants} className="bg-white rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-[#111111]">Customer Credit</h2>
            <Link to="/customers" className="text-xs text-neutral-500 hover:text-[#111111]">Manage customers</Link>
          </div>
          <p className="text-3xl font-light font-heading text-[#111111] mt-3">{formatGhs(outstanding)}</p>
          <p className="text-xs text-neutral-500 mt-1">Outstanding across {debtors.length} customer(s)</p>
          <h2 className="text-sm font-medium text-[#111111] mt-6 mb-2">Cashier Performance — Today</h2>
          {byCashier.length === 0 ?
          <p className="text-xs text-neutral-400">No sales recorded today yet.</p> :

          byCashier.map((c) =>
          <div key={c.name} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0">
                <span className="text-sm text-[#111111]">{c.name}</span>
                <span className="text-sm text-neutral-500">{c.count} sales · <span className="font-medium text-[#111111]">{formatGhs(c.total)}</span></span>
              </div>
          )
          }
        </motion.div>
      </div>

      {/* Recent sales */}
      <motion.div variants={itemVariants} className="bg-white rounded-3xl p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-[#111111]">Recent Sales</h2>
          <Link to="/sales" className="text-xs text-neutral-500 hover:text-[#111111]">All sales</Link>
        </div>
        {sales.length === 0 ?
        <p className="text-xs text-neutral-400 py-6 text-center">No sales yet — open the POS to make the first sale.</p> :

        sales.slice(0, 6).map((s) =>
        <Link key={s.id} to="/sales" className="flex items-center gap-3 py-2.5 border-b border-neutral-100 last:border-0 hover:bg-neutral-50 rounded-lg px-2">
              <div className="w-9 h-9 rounded-full bg-neutral-100 flex items-center justify-center shrink-0"><ReceiptText size={15} className="text-neutral-500" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#111111] truncate">{s.sale_number} · {s.customer_name || "Walk-in"}</p>
                <p className="text-xs text-neutral-500">{formatDateTime(s.created_date)} · {s.cashier_name}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-medium text-[#111111]">{formatGhs(s.total)}</p>
                {(s.credit_amount || 0) > 0 && <p className="text-xs text-[#D9624A]">credit {formatGhs(s.credit_amount)}</p>}
              </div>
            </Link>
        )
        }
      </motion.div>
    </motion.div>);

}
