import { useState, useEffect, useMemo } from "react";
import { localStore } from "@/api/localStore";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { formatGhs, formatDateTime, isToday } from "@/lib/format";
import {
  Banknote,
  Receipt,
  Plus,
  Trash2,
  Calendar,
  Search,
  Download,
  Filter,
  DollarSign,
  TrendingDown,
  CreditCard,
  Building,
  Zap,
  Truck,
  ShoppingBag,
  Wrench,
  Megaphone,
  HelpCircle,
  X,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export const EXPENSE_CATEGORIES = [
  { id: "UTILITIES", label: "Utilities (Electricity, Water, Internet)", icon: Zap, color: "#F59E0B" },
  { id: "RENT", label: "Shop Rent", icon: Building, color: "#6366F1" },
  { id: "SALARIES", label: "Staff Wages & Allowances", icon: Banknote, color: "#10B981" },
  { id: "TRANSPORT", label: "Transport & Deliveries", icon: Truck, color: "#3B82F6" },
  { id: "SUPPLIES", label: "Shop Supplies (Bags, Rolls, Cleaning)", icon: ShoppingBag, color: "#EC4899" },
  { id: "MAINTENANCE", label: "Repairs & Generator Fuel", icon: Wrench, color: "#8B5CF6" },
  { id: "MARKETING", label: "Marketing & Promo", icon: Megaphone, color: "#14B8A6" },
  { id: "MISCELLANEOUS", label: "Miscellaneous / Other", icon: HelpCircle, color: "#6B7280" },
];

const EMPTY_EXPENSE = {
  title: "",
  category: "UTILITIES",
  amount: "",
  expense_date: new Date().toISOString().slice(0, 10),
  payment_method: "CASH", // CASH, MOBILE_MONEY, BANK
  paid_from_drawer: true,
  notes: "",
};

export default function Expenses() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isOwner = user?.role === "admin";

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("month"); // 'today' | 'week' | 'month' | 'all'
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_EXPENSE);
  const [saving, setSaving] = useState(false);

  const fetchExpenses = () => {
    localStore.entities.Expense.list("-expense_date", 500)
      .then((items) => {
        setExpenses(items || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchExpenses();
    window.addEventListener("anb_data_synced", fetchExpenses);
    return () => window.removeEventListener("anb_data_synced", fetchExpenses);
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const now = Date.now();
    return expenses
      .filter((e) => {
        const d = new Date(e.expense_date || e.created_date).getTime();
        if (period === "today") return isToday(e.expense_date || e.created_date);
        if (period === "week") return now - d <= 7 * 86400000;
        if (period === "month") return now - d <= 30 * 86400000;
        return true;
      })
      .filter((e) => {
        if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
        if (!q) return true;
        return (
          e.title?.toLowerCase().includes(q) ||
          e.notes?.toLowerCase().includes(q) ||
          e.category?.toLowerCase().includes(q)
        );
      });
  }, [expenses, period, categoryFilter, searchQuery]);

  const totalExpenseAmount = useMemo(
    () => filtered.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [filtered]
  );

  const drawerPaidAmount = useMemo(
    () =>
      filtered
        .filter((e) => e.paid_from_drawer || e.payment_method === "CASH")
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [filtered]
  );

  const momoPaidAmount = useMemo(
    () =>
      filtered
        .filter((e) => e.payment_method === "MOBILE_MONEY" && !e.paid_from_drawer)
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [filtered]
  );

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    const amt = Number(form.amount);
    if (!form.title.trim() || !amt || amt <= 0) {
      toast({
        title: "Validation error",
        description: "Please enter a valid expense title and amount.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await localStore.entities.Expense.create({
        title: form.title.trim(),
        category: form.category,
        amount: amt,
        expense_date: form.expense_date || new Date().toISOString().slice(0, 10),
        payment_method: form.payment_method,
        paid_from_drawer: Boolean(form.paid_from_drawer),
        notes: form.notes.trim(),
        recorded_by_name: user?.full_name || user?.username || "Admin",
      });

      toast({
        title: "Expense recorded",
        description: `${formatGhs(amt)} recorded under ${form.category.toLowerCase()}.`,
      });

      setForm(EMPTY_EXPENSE);
      setFormOpen(false);
      fetchExpenses();
    } catch (err) {
      toast({
        title: "Could not save expense",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = async (id, title) => {
    if (!window.confirm(`Delete expense "${title}"?`)) return;
    try {
      await localStore.entities.Expense.delete(id);
      toast({ title: "Expense deleted" });
      fetchExpenses();
    } catch (err) {
      toast({ title: "Error deleting", description: err.message, variant: "destructive" });
    }
  };

  const exportCsv = () => {
    if (filtered.length === 0) {
      toast({ title: "No expenses to export" });
      return;
    }
    const headers = [
      "Date",
      "Title",
      "Category",
      "Amount (GHS)",
      "Payment Method",
      "Paid From Drawer",
      "Recorded By",
      "Notes",
    ];
    const rows = filtered.map((e) => [
      e.expense_date || e.created_date?.slice(0, 10),
      `"${(e.title || "").replace(/"/g, '""')}"`,
      e.category,
      Number(e.amount || 0).toFixed(2),
      e.payment_method,
      e.paid_from_drawer ? "Yes" : "No",
      `"${(e.recorded_by_name || "").replace(/"/g, '""')}"`,
      `"${(e.notes || "").replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `anb-expenses-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exported successfully" });
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-light text-[#111111] flex items-center gap-2.5">
            <Receipt size={26} className="text-[#FF9000]" />
            Store Expenses &amp; P&amp;L
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            Track daily operating overheads (rent, bills, staff lunch, bags) to determine true net profits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="h-11 px-4 rounded-full bg-white hover:bg-neutral-50 text-[#111111] text-xs font-medium border border-neutral-200 flex items-center gap-2 cursor-pointer transition-colors shadow-sm"
          >
            <Download size={14} /> Export CSV
          </button>
          {isOwner && (
            <button
              onClick={() => setFormOpen(true)}
              className="h-11 px-5 rounded-full bg-[#FF9000] hover:bg-[#ff9e1a] text-[#111111] text-xs sm:text-sm font-semibold flex items-center gap-2 cursor-pointer border-none shadow-sm transition-colors"
            >
              <Plus size={16} /> Record Expense
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 uppercase font-semibold tracking-wider">
              Total Expenses ({period})
            </span>
            <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <TrendingDown size={18} />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-[#111111]">{formatGhs(totalExpenseAmount)}</p>
            <p className="text-xs text-neutral-400 mt-1">{filtered.length} recorded expense(s)</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 uppercase font-semibold tracking-wider">
              Paid From Cash Drawer
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Banknote size={18} />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-amber-600">{formatGhs(drawerPaidAmount)}</p>
            <p className="text-xs text-neutral-400 mt-1">Deducted from daily cash drawer closing</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 uppercase font-semibold tracking-wider">
              Mobile Money / Bank
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-indigo-600">{formatGhs(momoPaidAmount)}</p>
            <p className="text-xs text-neutral-400 mt-1">Paid electronically outside drawer</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search expense description, notes, or category…"
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-neutral-50 border border-neutral-200 text-xs text-[#111111] focus:outline-none focus:border-[#FF9000] focus:bg-white transition-all"
          />
        </div>

        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-10 px-3 rounded-xl bg-neutral-50 border border-neutral-200 text-xs text-[#111111] focus:outline-none focus:border-[#FF9000] cursor-pointer"
        >
          <option value="all">All Categories</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>

        {/* Period tabs */}
        <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-2xl shrink-0">
          {[
            { id: "today", label: "Today" },
            { id: "week", label: "7 Days" },
            { id: "month", label: "30 Days" },
            { id: "all", label: "All Time" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setPeriod(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer border-none transition-all ${
                period === tab.id
                  ? "bg-white text-[#111111] shadow-sm"
                  : "text-neutral-500 hover:text-[#111111]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-7 h-7 border-3 border-neutral-200 border-t-[#111111] rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-neutral-400">
            <Receipt size={32} className="mx-auto text-neutral-300" />
            <p className="text-sm font-medium text-[#111111] mt-3">No expenses found</p>
            <p className="text-xs text-neutral-400 mt-1">
              {expenses.length === 0
                ? "Click \"Record Expense\" above to record your first shop expenditure."
                : "No expenses match the current filter."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50/70 border-b border-neutral-100 text-neutral-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Expense / Title</th>
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5">Payment</th>
                  <th className="px-5 py-3.5 text-right">Amount</th>
                  {isOwner && <th className="px-5 py-3.5 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((e) => {
                  const cat =
                    EXPENSE_CATEGORIES.find((c) => c.id === e.category) ||
                    EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
                  const Icon = cat.icon;
                  return (
                    <tr key={e.id} className="hover:bg-neutral-50/60 transition-colors">
                      <td className="px-5 py-3.5 text-neutral-500 whitespace-nowrap">
                        {e.expense_date
                          ? new Date(e.expense_date).toLocaleDateString("en-GH")
                          : formatDateTime(e.created_date)}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-[#111111] text-xs">{e.title}</p>
                        {e.notes && <p className="text-[11px] text-neutral-400 mt-0.5">{e.notes}</p>}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-neutral-100 text-neutral-700">
                          <Icon size={12} style={{ color: cat.color }} />
                          {cat.label.split(" (")[0]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-neutral-600">
                        <span>{e.payment_method === "MOBILE_MONEY" ? "MoMo" : e.payment_method}</span>
                        {e.paid_from_drawer && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 font-medium">
                            Cash Drawer
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-[#111111] whitespace-nowrap">
                        {formatGhs(e.amount)}
                      </td>
                      {isOwner && (
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleDeleteExpense(e.id, e.title)}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 cursor-pointer border-none transition-colors"
                            title="Delete expense"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Expense Modal */}
      <Dialog open={formOpen} onOpenChange={(v) => !v && setFormOpen(false)}>
        <DialogContent className="max-w-md p-0 bg-white rounded-3xl overflow-hidden border-0 shadow-2xl">
          <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-[#FF9000] flex items-center justify-center font-bold">
                <Plus size={18} />
              </div>
              <h2 className="text-sm font-semibold text-[#111111]">Record Store Expense</h2>
            </div>
            <button
              onClick={() => setFormOpen(false)}
              className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 cursor-pointer border-none"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleCreateExpense} className="p-6 space-y-4">
            <div>
              <label className="text-xs font-medium text-neutral-600 block mb-1">
                Expense Title / Description *
              </label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. ECG electricity prepaid unit, Shop bags"
                className="w-full h-11 px-3.5 rounded-xl border border-neutral-200 text-xs text-[#111111] focus:outline-none focus:border-[#FF9000]"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-neutral-600 block mb-1">
                  Amount (GHS) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  required
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full h-11 px-3.5 rounded-xl border border-neutral-200 text-xs font-semibold text-[#111111] focus:outline-none focus:border-[#FF9000]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-600 block mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={form.expense_date}
                  onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                  className="w-full h-11 px-3 rounded-xl border border-neutral-200 text-xs text-[#111111] focus:outline-none focus:border-[#FF9000]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-600 block mb-1">
                Category
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full h-11 px-3 rounded-xl border border-neutral-200 text-xs text-[#111111] bg-white focus:outline-none focus:border-[#FF9000]"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-neutral-600 block mb-1">
                  Payment Method
                </label>
                <select
                  value={form.payment_method}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      payment_method: e.target.value,
                      paid_from_drawer: e.target.value === "CASH",
                    })
                  }
                  className="w-full h-11 px-3 rounded-xl border border-neutral-200 text-xs text-[#111111] bg-white focus:outline-none focus:border-[#FF9000]"
                >
                  <option value="CASH">Cash</option>
                  <option value="MOBILE_MONEY">Mobile Money</option>
                  <option value="BANK">Bank Transfer / Card</option>
                </select>
              </div>

              <div className="flex flex-col justify-center pt-5">
                <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-neutral-700 select-none">
                  <input
                    type="checkbox"
                    checked={form.paid_from_drawer}
                    onChange={(e) => setForm({ ...form, paid_from_drawer: e.target.checked })}
                    className="w-4 h-4 rounded text-[#FF9000] focus:ring-[#FF9000]"
                  />
                  <span>Paid from Cash Drawer</span>
                </label>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-600 block mb-1">
                Notes / Vendor (Optional)
              </label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Receipt / vendor name / extra details"
                className="w-full h-11 px-3.5 rounded-xl border border-neutral-200 text-xs text-[#111111] focus:outline-none focus:border-[#FF9000]"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="h-10 px-4 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-medium cursor-pointer border-none"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-10 px-5 rounded-xl bg-[#111111] hover:bg-neutral-800 text-white text-xs font-semibold cursor-pointer border-none transition-colors disabled:opacity-40"
              >
                {saving ? "Saving…" : "Save Expense"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
