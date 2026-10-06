import { useEffect, useMemo, useState } from "react";
import { History } from "lucide-react";
import { localStore } from "@/api/localStore";
import { useAuth } from "@/lib/AuthContext";
import { formatDateTime, formatGhs } from "@/lib/format";

const FILTERS = ["All activity", "Sales", "Purchases", "Stock changes", "Returns"];

export default function ActivityLog() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState("All activity");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      localStore.entities.Sale.list("-created_date", 200),
      localStore.entities.Purchase.list("-created_date", 200),
      localStore.entities.StockMovement.list("-created_date", 300),
      localStore.entities.SaleReturn.list("-created_date", 100),
    ]).then(([sales, purchases, movements, returns]) => {
      const timeline = [
        ...sales.map((sale) => ({ id: `sale-${sale.id}`, type: "Sales", date: sale.created_date, person: sale.cashier_name || "Unknown user", title: `Completed ${sale.sale_number}`, detail: `${sale.customer_name || "Walk-in Customer"} · ${formatGhs(sale.total)}` })),
        ...purchases.map((purchase) => ({ id: `purchase-${purchase.id}`, type: "Purchases", date: purchase.created_date, person: purchase.created_by_name || "Unknown user", title: `Received ${purchase.purchase_number}`, detail: `${purchase.supplier_name} · ${formatGhs(purchase.total)}` })),
        ...movements.map((movement) => ({ id: `movement-${movement.id}`, type: "Stock changes", date: movement.created_date, person: movement.created_by_name || "Unknown user", title: `${movement.movement_type.replaceAll("_", " ")} · ${movement.product_name}`, detail: `${movement.quantity > 0 ? "+" : ""}${movement.quantity} units · ${movement.previous_quantity} to ${movement.new_quantity}${movement.notes ? ` · ${movement.notes}` : ""}` })),
        ...returns.map((saleReturn) => ({ id: `return-${saleReturn.id}`, type: "Returns", date: saleReturn.created_date, person: saleReturn.approved_by_name || "Owner", title: `Approved return for ${saleReturn.sale_number}`, detail: `${saleReturn.customer_name} · ${formatGhs(saleReturn.refund_amount)} refunded` })),
      ].sort((a, b) => new Date(b.date) - new Date(a.date));
      setEvents(timeline);
    }).finally(() => setLoading(false));
  }, []);

  const visible = filter === "All activity" ? events : events.filter((event) => event.type === filter);
  if (user?.role !== "admin") return <div className="bg-white rounded-lg p-12 text-center"><p className="text-sm text-neutral-400">Only the owner can view activity history.</p></div>;
  if (loading) return <div className="flex items-center justify-center py-40"><div className="w-8 h-8 border-4 border-neutral-200 border-t-[#111111] rounded-full animate-spin" /></div>;

  return <div className="max-w-5xl flex flex-col gap-4">
    <div><h1 className="text-2xl font-heading font-light text-[#111111]">Activity Log</h1><p className="text-sm text-neutral-500 mt-1">Recent sales, purchasing, stock changes, and returns across the business.</p></div>
    <div className="flex flex-wrap gap-2">{FILTERS.map((item) => <button key={item} onClick={() => setFilter(item)} className="h-9 px-3 rounded-md text-sm border-0" style={{ background: filter === item ? "#111111" : "#ffffff", color: filter === item ? "#ffffff" : "#444" }}>{item}</button>)}</div>
    <div className="bg-white border border-neutral-100 rounded-lg overflow-hidden">
      {visible.length === 0 ? <div className="p-12 text-center"><History size={32} className="mx-auto text-neutral-300" /><p className="mt-3 text-sm text-neutral-400">No matching activity yet.</p></div> : visible.map((event) => <div key={event.id} className="flex gap-4 px-5 py-4 border-b border-neutral-100 last:border-0">
        <div className="w-2 h-2 mt-2 rounded-full shrink-0" style={{ background: event.type === "Sales" ? "#5c8f45" : event.type === "Returns" ? "#b54635" : "#ff9000" }} />
        <div className="min-w-0 flex-1"><p className="text-sm font-medium text-[#111111]">{event.title}</p><p className="mt-1 text-xs text-neutral-500 break-words">{event.detail}</p></div>
        <div className="shrink-0 text-right"><p className="text-xs text-neutral-600">{event.person}</p><p className="mt-1 text-xs text-neutral-400">{formatDateTime(event.date)}</p></div>
      </div>)}
    </div>
  </div>;
}
