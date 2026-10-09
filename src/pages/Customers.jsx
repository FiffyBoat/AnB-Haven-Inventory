import { useState, useEffect } from "react";
import { localStore } from "@/api/localStore";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { formatGhs, formatDateTime } from "@/lib/format";
import { printDocument } from "@/lib/print";
import {
  Plus,
  UserRound,
  X,
  CreditCard,
  Phone,
  MapPin,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Search,
  ShieldCheck,
  Edit2,
  Trash2,
  Printer,
  Download,
  MessageCircle,
  Clock,
  UserCheck,
  ReceiptText,
} from "lucide-react";

const EMPTY_FORM = {
  // Basic
  name: "",
  phone: "",
  alt_phone: "",
  credit_limit: "",
  // Installment agreement
  installment_frequency: "MONTHLY", // WEEKLY, BIWEEKLY, MONTHLY
  installment_amount: "",
  next_due_date: "",
  guarantor_name: "",
  guarantor_phone: "",
  // Ghana Card / KYC Details
  ghana_card_name: "",
  ghana_card_number: "",
  date_of_birth: "",
  residential_address: "",
  digital_address: "",
};

function FieldRow({ label, value, icon: Icon }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-neutral-100 last:border-0">
      {Icon && <Icon size={14} className="text-neutral-400 mt-0.5 shrink-0" />}
      <div className="min-w-0">
        <p className="text-[10px] text-neutral-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm text-[#111111] font-medium mt-0.5 break-words">{value}</p>
      </div>
    </div>
  );
}

function sanitizeGhPhone(phone) {
  if (!phone) return "";
  const cleaned = phone.replace(/[^0-9]/g, "");
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    return "233" + cleaned.slice(1);
  }
  if (cleaned.startsWith("233")) return cleaned;
  return cleaned;
}

export default function Customers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isOwner = user?.role === "admin";

  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [query, setQuery] = useState("");

  // Modals & Panels
  const [modalMode, setModalMode] = useState(null); // 'create' | 'edit' | null
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [showGhanaDetails, setShowGhanaDetails] = useState(false);
  const [showInstallmentSection, setShowInstallmentSection] = useState(false);

  // Detail Drawer
  const [detail, setDetail] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [payAmount, setPayAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCardInfo, setShowCardInfo] = useState(false);

  // Statement & Receipt printing states
  const [statementOpen, setStatementOpen] = useState(false);
  const [repaymentReceipt, setRepaymentReceipt] = useState(null);

  const refresh = () => {
    localStore.entities.Customer.list()
      .then((c) => {
        setCustomers(c);
        setLoading(false);
        // Refresh detail if open
        if (detail) {
          const fresh = c.find((item) => item.id === detail.id);
          if (fresh) setDetail(fresh);
        }
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    window.addEventListener("anb_data_synced", refresh);
    return () => window.removeEventListener("anb_data_synced", refresh);
  }, []);

  const filtered = customers.filter((c) => {
    const q = query.trim().toLowerCase();
    return (
      !q ||
      [c.name, c.phone, c.ghana_card_number, c.ghana_card_name, c.alt_phone]
        .some((f) => f && String(f).toLowerCase().includes(q))
    );
  });

  const openDetail = async (c) => {
    setDetail(c);
    setPayAmount("");
    setShowCardInfo(false);
    localStore.entities.CreditTransaction.filter({ customer_id: c.id })
      .then((t) => setTransactions(t.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))))
      .catch(() => setTransactions([]));
  };

  const f = (k) => (e) => setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const openCreateModal = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowGhanaDetails(false);
    setShowInstallmentSection(false);
    setModalMode("create");
  };

  const openEditModal = (c) => {
    setEditingId(c.id);
    setForm({
      name: c.name || "",
      phone: c.phone || "",
      alt_phone: c.alt_phone || "",
      credit_limit: c.credit_limit ? String(c.credit_limit) : "",
      installment_frequency: c.installment_frequency || "MONTHLY",
      installment_amount: c.installment_amount ? String(c.installment_amount) : "",
      next_due_date: c.next_due_date || "",
      guarantor_name: c.guarantor_name || "",
      guarantor_phone: c.guarantor_phone || "",
      ghana_card_name: c.ghana_card_name || "",
      ghana_card_number: c.ghana_card_number || "",
      date_of_birth: c.date_of_birth || "",
      residential_address: c.residential_address || "",
      digital_address: c.digital_address || "",
    });
    setShowGhanaDetails(!!(c.ghana_card_number || c.ghana_card_name));
    setShowInstallmentSection(!!(c.installment_amount || c.guarantor_name));
    setModalMode("edit");
  };

  const saveCustomer = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name is required", description: "Please enter the customer's full name.", variant: "destructive" });
      return;
    }
    const cleanCard = form.ghana_card_number.trim().toUpperCase();
    if (cleanCard && !/^GHA-\d{9}-\d$/.test(cleanCard)) {
      toast({
        title: "Invalid Ghana Card Number",
        description: "Ghana Card format must be GHA-XXXXXXXXX-X (e.g. GHA-723456789-1).",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        alt_phone: form.alt_phone.trim(),
        credit_limit: Number(form.credit_limit) || 0,
        installment_frequency: form.installment_frequency,
        installment_amount: Number(form.installment_amount) || 0,
        next_due_date: form.next_due_date || "",
        guarantor_name: form.guarantor_name.trim(),
        guarantor_phone: form.guarantor_phone.trim(),
        ghana_card_name: form.ghana_card_name.trim(),
        ghana_card_number: form.ghana_card_number.trim().toUpperCase(),
        date_of_birth: form.date_of_birth,
        residential_address: form.residential_address.trim(),
        digital_address: form.digital_address.trim().toUpperCase(),
      };

      if (modalMode === "edit" && editingId) {
        await localStore.entities.Customer.update(editingId, payload);
        toast({ title: "Customer updated", description: `${payload.name} updated successfully.` });
        if (detail && detail.id === editingId) {
          setDetail((prev) => ({ ...prev, ...payload }));
        }
      } else {
        await localStore.entities.Customer.create({
          ...payload,
          current_balance: 0,
          status: "active",
        });
        toast({ title: "Customer added!", description: `${payload.name} has been saved.` });
      }

      setModalMode(null);
      setForm(EMPTY_FORM);
      refresh();
    } catch (err) {
      toast({ title: "Could not save customer", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const deleteCustomer = async (c) => {
    if ((c.current_balance || 0) > 0) {
      toast({
        title: "Cannot delete customer",
        description: `This customer has an outstanding balance of ${formatGhs(c.current_balance)}. Settle debt first.`,
        variant: "destructive",
      });
      return;
    }
    if (!window.confirm(`Are you sure you want to delete customer "${c.name}"? This cannot be undone.`)) {
      return;
    }
    setBusy(true);
    try {
      await localStore.entities.Customer.delete(c.id);
      toast({ title: "Customer deleted", description: `${c.name} was removed.` });
      setDetail(null);
      refresh();
    } catch (err) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const recordPayment = async () => {
    const amount = Number(payAmount);
    if (!amount || amount <= 0) return;
    setBusy(true);
    try {
      const prevBal = detail.current_balance || 0;
      const res = await localStore.functions.invoke("recordCreditPayment", {
        customer_id: detail.id,
        amount,
        description: "Credit / Installment repayment",
      });
      if (res.data?.error) throw new Error(res.data.error);

      toast({ title: "Payment recorded", description: `New balance: ${formatGhs(res.data.balance)}` });
      setPayAmount("");
      refresh();

      // Open repayment receipt slip
      setRepaymentReceipt({
        id: res.data.transaction?.id || `tx-${Date.now()}`,
        created_date: new Date().toISOString(),
        customer_name: detail.name,
        customer_phone: detail.phone,
        ghana_card_number: detail.ghana_card_number,
        amount_paid: amount,
        previous_balance: prevBal,
        balance_after: res.data.balance,
        cashier_name: user?.full_name || "Cashier",
      });

      openDetail({ ...detail, current_balance: res.data.balance });
    } catch (err) {
      toast({ title: "Payment failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const sendWhatsAppReminder = (c) => {
    const phone = sanitizeGhPhone(c.phone);
    if (!phone) {
      toast({ title: "No valid phone", description: "Customer does not have a phone number saved.", variant: "destructive" });
      return;
    }
    const dueInfo = c.next_due_date ? ` Next installment due date is ${new Date(c.next_due_date).toLocaleDateString("en-GH")}.` : "";
    const msg = `Hello ${c.name}, this is a gentle reminder from DANNY'S HEAVEN VENTURES regarding your outstanding balance of ${formatGhs(c.current_balance)}.${dueInfo} Kindly arrange to make a deposit at our store or via MoMo (+233 59 239 0609). Thank you for your continued business!`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const exportCsv = () => {
    if (customers.length === 0) {
      toast({ title: "No data to export" });
      return;
    }
    const headers = [
      "Customer Name",
      "Phone",
      "Alt Phone",
      "Ghana Card Name",
      "Ghana Card Number",
      "Date of Birth",
      "Residential Address",
      "Digital Address (GPS)",
      "Credit Limit (GHS)",
      "Current Balance (GHS)",
      "Installment Frequency",
      "Installment Amount (GHS)",
      "Next Due Date",
      "Guarantor Name",
      "Guarantor Phone",
    ];

    const rows = customers.map((c) => [
      c.name || "",
      c.phone || "",
      c.alt_phone || "",
      c.ghana_card_name || "",
      c.ghana_card_number || "",
      c.date_of_birth || "",
      c.residential_address || "",
      c.digital_address || "",
      c.credit_limit || 0,
      c.current_balance || 0,
      c.installment_frequency || "",
      c.installment_amount || 0,
      c.next_due_date || "",
      c.guarantor_name || "",
      c.guarantor_phone || "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows]
        .map((e) => e.map((val) => `"${String(val).replaceAll('"', '""')}"`).join(","))
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `DANNYS_HEAVEN_Customers_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Exported successfully", description: `${customers.length} customer records saved.` });
  };

  const inputCls =
    "w-full h-11 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:border-[#FF9000] bg-white";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <div className="w-8 h-8 border-4 border-figma-accent border-t-[#111111] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-light text-[#111111]">Customers &amp; Installments</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {customers.length} customers ·{" "}
            <span className="text-[#D9624A] font-medium">
              {formatGhs(customers.reduce((s, c) => s + (c.current_balance || 0), 0))} total debt
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 h-11 px-3.5 rounded-full bg-white border border-neutral-200">
            <Search size={15} className="text-neutral-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, phone, GH Card…"
              className="text-sm bg-transparent focus:outline-none w-44"
            />
          </div>
          <button
            onClick={exportCsv}
            className="h-11 px-4 rounded-full bg-white border border-neutral-200 text-sm font-medium text-[#111111] flex items-center gap-2 hover:bg-neutral-50 transition-colors cursor-pointer"
            title="Download Customer List CSV"
          >
            <Download size={15} /> Export CSV
          </button>
          <button
            onClick={openCreateModal}
            className="h-11 px-5 rounded-full bg-[#FF9000] text-sm font-medium text-[#111111] flex items-center gap-2 cursor-pointer border-none shrink-0 hover:bg-[#ff9d2e] transition-colors"
          >
            <Plus size={15} /> New Customer
          </button>
        </div>
      </div>

      {/* Customer list */}
      <div className="bg-white rounded-3xl overflow-hidden border border-neutral-100 shadow-sm">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <UserRound size={32} className="text-neutral-300 mx-auto" />
            <p className="text-sm text-neutral-400 mt-3">
              {query ? "No customers match your search." : "No customers yet. Add one to start tracking credit and installment plans."}
            </p>
          </div>
        ) : (
          filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => openDetail(c)}
              className="w-full flex items-center justify-between px-5 py-4 border-b border-neutral-100 last:border-0 hover:bg-neutral-50 cursor-pointer border-x-0 border-t-0 bg-transparent text-left transition-colors"
            >
              <div className="min-w-0 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
                  <UserRound size={18} className="text-neutral-500" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[#111111] truncate">{c.name}</p>
                    {c.ghana_card_number && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-mono font-medium">
                        GH Card: {c.ghana_card_number}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {c.phone || "No phone"}
                    {c.next_due_date && (
                      <span className="ml-2 text-neutral-400">
                        · Next due: {new Date(c.next_due_date).toLocaleDateString("en-GH")}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className={"text-sm font-semibold " + ((c.current_balance || 0) > 0 ? "text-[#D9624A]" : "text-[#616E5D]")}>
                  {(c.current_balance || 0) > 0 ? `owes ${formatGhs(c.current_balance)}` : "settled"}
                </p>
                {(c.credit_limit || 0) > 0 && (
                  <p className="text-xs text-neutral-400">limit {formatGhs(c.credit_limit)}</p>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      {/* ── CREATE / EDIT CUSTOMER MODAL ─────────────────────────────── */}
      {modalMode && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setModalMode(null)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-2 flex items-center justify-between">
              <div>
                <p className="text-base font-semibold text-[#111111]">
                  {modalMode === "edit" ? "Edit Customer Details" : "New Customer"}
                </p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Basic contact + Ghana Card KYC &amp; installment terms
                </p>
              </div>
              <button
                onClick={() => setModalMode(null)}
                className="text-neutral-400 hover:text-[#111111] cursor-pointer border-none bg-transparent p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 pb-6 space-y-4 mt-3">
              {/* ── BASIC INFO ── */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  Basic Information
                </p>
                <input
                  value={form.name}
                  onChange={f("name")}
                  placeholder="Display name (e.g. Kwame Asante) *"
                  className={inputCls}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={form.phone}
                    onChange={f("phone")}
                    placeholder="Primary phone *"
                    type="tel"
                    className={inputCls}
                  />
                  <input
                    value={form.alt_phone}
                    onChange={f("alt_phone")}
                    placeholder="Alternative phone"
                    type="tel"
                    className={inputCls}
                  />
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.credit_limit}
                  onChange={f("credit_limit")}
                  placeholder="Credit / installment limit (GHS) — 0 = no cap"
                  className={inputCls}
                />
              </div>

              {/* ── GHANA CARD / KYC SECTION ── */}
              <div className="border border-blue-100 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowGhanaDetails((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer border-none text-left"
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-blue-600" />
                    <div>
                      <p className="text-sm font-semibold text-blue-900">Ghana Card &amp; KYC Verification</p>
                      <p className="text-[11px] text-blue-600">Essential for debt recovery &amp; installments</p>
                    </div>
                  </div>
                  {showGhanaDetails ? (
                    <ChevronUp size={16} className="text-blue-600 shrink-0" />
                  ) : (
                    <ChevronDown size={16} className="text-blue-600 shrink-0" />
                  )}
                </button>

                {showGhanaDetails && (
                  <div className="px-4 pb-4 pt-3 space-y-2 bg-white">
                    <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-800">
                      ⚠️ Enter details <strong>exactly as shown on the Ghana Card</strong> for legal debt recovery.
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-neutral-500 block mb-1">
                        Full name as shown on Ghana Card
                      </label>
                      <input
                        value={form.ghana_card_name}
                        onChange={f("ghana_card_name")}
                        placeholder="e.g. ASANTE KWAME BOATENG"
                        className={inputCls + " uppercase"}
                        style={{ textTransform: "uppercase" }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-neutral-500 block mb-1">
                          Ghana Card Number
                        </label>
                        <input
                          value={form.ghana_card_number}
                          onChange={f("ghana_card_number")}
                          placeholder="GHA-XXXXXXXXX-X"
                          className={inputCls + " font-mono tracking-wider"}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-neutral-500 block mb-1">
                          Date of Birth
                        </label>
                        <input
                          type="date"
                          value={form.date_of_birth}
                          onChange={f("date_of_birth")}
                          className={inputCls}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-neutral-500 block mb-1">
                        Residential Address
                      </label>
                      <input
                        value={form.residential_address}
                        onChange={f("residential_address")}
                        placeholder="e.g. Hse No. 12, Adum, Kumasi"
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-neutral-500 block mb-1">
                        Ghana Post Digital Address (GPS)
                      </label>
                      <input
                        value={form.digital_address}
                        onChange={f("digital_address")}
                        placeholder="e.g. AK-123-4567"
                        className={inputCls + " font-mono tracking-wider uppercase"}
                        style={{ textTransform: "uppercase" }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ── INSTALLMENT PLAN & GUARANTOR ── */}
              <div className="border border-purple-100 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowInstallmentSection((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-purple-50 hover:bg-purple-100 transition-colors cursor-pointer border-none text-left"
                >
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-purple-600" />
                    <div>
                      <p className="text-sm font-semibold text-purple-900">Installment Agreement &amp; Guarantor</p>
                      <p className="text-[11px] text-purple-600">Repayment frequency &amp; next due date</p>
                    </div>
                  </div>
                  {showInstallmentSection ? (
                    <ChevronUp size={16} className="text-purple-600 shrink-0" />
                  ) : (
                    <ChevronDown size={16} className="text-purple-600 shrink-0" />
                  )}
                </button>

                {showInstallmentSection && (
                  <div className="px-4 pb-4 pt-3 space-y-2 bg-white">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-neutral-500 block mb-1">
                          Payment Frequency
                        </label>
                        <select
                          value={form.installment_frequency}
                          onChange={f("installment_frequency")}
                          className={inputCls}
                        >
                          <option value="WEEKLY">Weekly</option>
                          <option value="BIWEEKLY">Bi-Weekly</option>
                          <option value="MONTHLY">Monthly</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-neutral-500 block mb-1">
                          Installment Target (GHS)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.installment_amount}
                          onChange={f("installment_amount")}
                          placeholder="e.g. 200"
                          className={inputCls}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-neutral-500 block mb-1">
                        Next Due Date
                      </label>
                      <input
                        type="date"
                        value={form.next_due_date}
                        onChange={f("next_due_date")}
                        className={inputCls}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-100">
                      <div>
                        <label className="text-[11px] font-semibold text-neutral-500 block mb-1">
                          Guarantor Name
                        </label>
                        <input
                          value={form.guarantor_name}
                          onChange={f("guarantor_name")}
                          placeholder="Name of guarantor"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-neutral-500 block mb-1">
                          Guarantor Phone
                        </label>
                        <input
                          value={form.guarantor_phone}
                          onChange={f("guarantor_phone")}
                          placeholder="Phone number"
                          type="tel"
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                disabled={busy}
                onClick={saveCustomer}
                className="w-full h-12 rounded-full bg-[#111111] text-white text-sm font-medium cursor-pointer border-none disabled:opacity-40 hover:bg-neutral-800 transition-colors"
              >
                {busy ? "Saving…" : modalMode === "edit" ? "Save Changes" : "Save Customer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CUSTOMER DETAIL / STATEMENT PANEL ─────────────── */}
      {detail && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Panel header */}
            <div className="px-6 pt-5 pb-4 border-b border-neutral-100">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
                    <UserRound size={20} className="text-neutral-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-base font-bold text-[#111111]">{detail.name}</p>
                      {detail.ghana_card_number && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 font-mono font-medium rounded">
                          KYC Done
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500">{detail.phone || "No phone"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(detail)}
                    className="p-2 text-neutral-500 hover:text-[#111111] rounded-full hover:bg-neutral-100 transition-colors cursor-pointer border-none bg-transparent"
                    title="Edit Customer"
                  >
                    <Edit2 size={16} />
                  </button>
                  {isOwner && (
                    <button
                      onClick={() => deleteCustomer(detail)}
                      className="p-2 text-neutral-400 hover:text-red-600 rounded-full hover:bg-red-50 transition-colors cursor-pointer border-none bg-transparent"
                      title="Delete Customer"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => setDetail(null)}
                    className="p-2 text-neutral-400 hover:text-[#111111] rounded-full hover:bg-neutral-100 cursor-pointer border-none bg-transparent"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Balance card */}
              <div className="mt-4 rounded-2xl bg-[#111111] text-white px-5 py-3.5 flex justify-between items-center">
                <div>
                  <span className="text-xs opacity-75">Outstanding Balance</span>
                  <p className="text-2xl font-bold mt-0.5">{formatGhs(detail.current_balance)}</p>
                </div>
                {(detail.credit_limit || 0) > 0 && (
                  <div className="text-right">
                    <span className="text-xs opacity-75">Credit Limit</span>
                    <p className="text-sm font-semibold">{formatGhs(detail.credit_limit)}</p>
                  </div>
                )}
              </div>

              {/* Quick Actions (WhatsApp Reminder & Statement) */}
              <div className="flex gap-2 mt-3">
                {(detail.current_balance || 0) > 0 && detail.phone && (
                  <button
                    onClick={() => sendWhatsAppReminder(detail)}
                    className="flex-1 h-10 px-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-emerald-100 transition-colors cursor-pointer"
                  >
                    <MessageCircle size={14} className="text-emerald-600" /> WhatsApp Reminder
                  </button>
                )}
                <button
                  onClick={() => setStatementOpen(true)}
                  className="flex-1 h-10 px-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-[#111111] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-none"
                >
                  <Printer size={14} /> Print Statement
                </button>
              </div>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Record payment */}
              <div className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-100">
                <p className="text-xs font-semibold text-neutral-600 mb-2">Record Repayment / Deposit</p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && recordPayment()}
                    placeholder="Amount (GHS)"
                    className="flex-1 h-11 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:border-[#FF9000] bg-white"
                  />
                  <button
                    disabled={busy || !payAmount}
                    onClick={recordPayment}
                    className="h-11 px-5 rounded-xl bg-[#FF9000] text-[#111111] text-sm font-semibold cursor-pointer border-none disabled:opacity-40 hover:bg-[#ff9d2e] transition-colors"
                  >
                    Record
                  </button>
                </div>
              </div>

              {/* Installment Plan details */}
              {(detail.installment_amount || detail.next_due_date || detail.guarantor_name) && (
                <div className="bg-purple-50/60 border border-purple-100 rounded-2xl p-3.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-purple-900 font-semibold text-xs mb-1">
                    <Clock size={13} className="text-purple-600" /> Installment Agreement
                  </div>
                  {detail.installment_amount && (
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-500">Agreed Payment:</span>
                      <span className="font-semibold text-neutral-800">
                        {formatGhs(detail.installment_amount)} ({detail.installment_frequency || "MONTHLY"})
                      </span>
                    </div>
                  )}
                  {detail.next_due_date && (
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-500">Next Due Date:</span>
                      <span className="font-semibold text-neutral-800">
                        {new Date(detail.next_due_date).toLocaleDateString("en-GH", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  )}
                  {detail.guarantor_name && (
                    <div className="flex justify-between text-xs pt-1 border-t border-purple-100">
                      <span className="text-neutral-500">Guarantor:</span>
                      <span className="font-medium text-neutral-800">
                        {detail.guarantor_name} {detail.guarantor_phone ? `(${detail.guarantor_phone})` : ""}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Ghana Card / KYC info */}
              <div className="border border-blue-100 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowCardInfo((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer border-none text-left"
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-blue-600" />
                    <p className="text-xs font-semibold text-blue-900">Ghana Card &amp; KYC Verification</p>
                  </div>
                  {showCardInfo ? (
                    <ChevronUp size={14} className="text-blue-600" />
                  ) : (
                    <ChevronDown size={14} className="text-blue-600" />
                  )}
                </button>

                {showCardInfo && (
                  <div className="px-4 py-3 bg-white">
                    {!detail.ghana_card_name && !detail.ghana_card_number && (
                      <p className="text-xs text-neutral-400 text-center py-2">
                        No Ghana Card details recorded. Click Edit to add KYC info.
                      </p>
                    )}
                    <FieldRow label="Full name as on Ghana Card" value={detail.ghana_card_name} icon={CreditCard} />
                    <FieldRow label="Ghana Card Number" value={detail.ghana_card_number} icon={CreditCard} />
                    <FieldRow
                      label="Date of Birth"
                      value={
                        detail.date_of_birth
                          ? new Date(detail.date_of_birth).toLocaleDateString("en-GH", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })
                          : ""
                      }
                      icon={CalendarDays}
                    />
                    <FieldRow label="Primary Phone" value={detail.phone} icon={Phone} />
                    <FieldRow label="Alternative Phone" value={detail.alt_phone} icon={Phone} />
                    <FieldRow label="Residential Address" value={detail.residential_address} icon={MapPin} />
                    <FieldRow label="Ghana Post Digital Address (GPS)" value={detail.digital_address} icon={MapPin} />
                  </div>
                )}
              </div>

              {/* Credit statement / Transactions */}
              <div>
                <p className="text-xs font-semibold text-neutral-500 mb-1.5">Credit &amp; Payment History</p>
                <div className="max-h-56 overflow-y-auto border border-neutral-100 rounded-2xl">
                  {transactions.length === 0 ? (
                    <p className="text-xs text-neutral-400 py-6 text-center">No transactions recorded yet.</p>
                  ) : (
                    transactions.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#111111]">
                            {t.transaction_type === "CREDIT_SALE"
                              ? "Credit Sale"
                              : t.transaction_type === "CREDIT_PAYMENT"
                              ? "Repayment"
                              : "Adjustment"}
                          </p>
                          <p className="text-xs text-neutral-400">
                            {formatDateTime(t.created_date)}
                            {t.description ? ` · ${t.description}` : ""}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p
                            className="text-sm font-semibold"
                            style={{
                              color: t.transaction_type === "CREDIT_PAYMENT" ? "#616E5D" : "#D9624A",
                            }}
                          >
                            {t.transaction_type === "CREDIT_PAYMENT" ? "-" : "+"}
                            {formatGhs(t.amount)}
                          </p>
                          <p className="text-xs text-neutral-400">bal {formatGhs(t.balance_after)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PRINTABLE STATEMENT OF ACCOUNT MODAL ───────────────────────── */}
      {statementOpen && detail && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setStatementOpen(false)}
        >
          <div
            className="statement-print bg-white rounded-3xl w-full max-w-2xl p-8 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="border-b-2 border-[#111111] pb-4 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-[#111111]">DANNY&apos;S HEAVEN VENTURES</h2>
                <p className="text-xs text-neutral-600 mt-1">Retail &amp; Wholesale · Phones, Laptops &amp; Accessories</p>
                <p className="text-xs text-neutral-500 mt-0.5">Takoradi - Acalema, Ghana · GPS: GA-183-4921</p>
                <p className="text-xs text-neutral-600 font-medium mt-0.5">Contact: +233 59 239 0609</p>
              </div>
              <div className="text-right">
                <span className="inline-block px-3 py-1 bg-neutral-100 rounded text-xs font-bold uppercase tracking-wider text-neutral-800">
                  Statement of Account
                </span>
                <p className="text-xs text-neutral-400 mt-2">
                  Date: {new Date().toLocaleDateString("en-GH", { year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>
            </div>

            {/* Customer Details section */}
            <div className="grid grid-cols-2 gap-4 py-4 border-b border-neutral-200 text-xs">
              <div>
                <p className="text-neutral-400 font-semibold uppercase text-[10px]">Customer Info</p>
                <p className="font-bold text-sm text-[#111111] mt-0.5">{detail.name}</p>
                <p className="text-neutral-600 mt-0.5">Phone: {detail.phone || "N/A"}</p>
                {detail.alt_phone && <p className="text-neutral-600">Alt Phone: {detail.alt_phone}</p>}
                {detail.residential_address && (
                  <p className="text-neutral-600">Address: {detail.residential_address}</p>
                )}
              </div>
              <div>
                <p className="text-neutral-400 font-semibold uppercase text-[10px]">Ghana Card KYC Verification</p>
                <p className="font-semibold text-neutral-800 mt-0.5">
                  Name on Card: {detail.ghana_card_name || "N/A"}
                </p>
                <p className="font-mono text-neutral-800">
                  Card No: {detail.ghana_card_number || "Not on file"}
                </p>
                {detail.digital_address && (
                  <p className="font-mono text-neutral-600">Digital Address (GPS): {detail.digital_address}</p>
                )}
                {detail.guarantor_name && (
                  <p className="text-neutral-600 mt-1">
                    Guarantor: {detail.guarantor_name} ({detail.guarantor_phone})
                  </p>
                )}
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3 my-4">
              <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-200">
                <p className="text-[10px] text-neutral-500 uppercase font-semibold">Total Credit Sales</p>
                <p className="text-base font-bold text-[#111111] mt-0.5">
                  {formatGhs(
                    transactions
                      .filter((t) => t.transaction_type === "CREDIT_SALE")
                      .reduce((sum, t) => sum + (t.amount || 0), 0)
                  )}
                </p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200">
                <p className="text-[10px] text-emerald-700 uppercase font-semibold">Total Paid</p>
                <p className="text-base font-bold text-emerald-800 mt-0.5">
                  {formatGhs(
                    transactions
                      .filter((t) => t.transaction_type === "CREDIT_PAYMENT")
                      .reduce((sum, t) => sum + (t.amount || 0), 0)
                  )}
                </p>
              </div>
              <div className="bg-rose-50 rounded-xl p-3 border border-rose-200">
                <p className="text-[10px] text-rose-700 uppercase font-semibold">Current Balance Due</p>
                <p className="text-base font-bold text-rose-800 mt-0.5">
                  {formatGhs(detail.current_balance)}
                </p>
              </div>
            </div>

            {/* Ledger Table */}
            <div className="mt-4">
              <p className="text-xs font-semibold text-neutral-700 mb-2">Statement Ledger</p>
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-300 text-neutral-500 font-semibold">
                    <th className="py-2">Date</th>
                    <th className="py-2">Description</th>
                    <th className="py-2 text-right">Debit (+)</th>
                    <th className="py-2 text-right">Credit (-)</th>
                    <th className="py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id} className="border-b border-neutral-100">
                      <td className="py-2 text-neutral-500">{new Date(t.created_date).toLocaleDateString("en-GH")}</td>
                      <td className="py-2 font-medium text-neutral-800">
                        {t.transaction_type === "CREDIT_SALE" ? "Credit Purchase" : "Repayment"}
                        {t.description ? ` (${t.description})` : ""}
                      </td>
                      <td className="py-2 text-right font-medium text-neutral-800">
                        {t.transaction_type === "CREDIT_SALE" ? formatGhs(t.amount) : "—"}
                      </td>
                      <td className="py-2 text-right font-medium text-emerald-700">
                        {t.transaction_type === "CREDIT_PAYMENT" ? formatGhs(t.amount) : "—"}
                      </td>
                      <td className="py-2 text-right font-bold text-[#111111]">{formatGhs(t.balance_after)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Signature Block */}
            <div className="grid grid-cols-2 gap-8 mt-12 pt-6 border-t border-dashed border-neutral-300 text-xs text-neutral-500">
              <div>
                <p className="font-semibold text-neutral-800 mb-6">Customer Signature:</p>
                <div className="border-b border-neutral-400 w-48" />
                <p className="text-[10px] mt-1">{detail.name}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-neutral-800 mb-6">Authorized Signatory / Stamp:</p>
                <div className="border-b border-neutral-400 w-48 ml-auto" />
                <p className="text-[10px] mt-1">DANNY&apos;S HEAVEN VENTURES</p>
              </div>
            </div>

            {/* Print Controls (hidden when printing) */}
            <div className="print-hide flex gap-3 mt-8 pt-4 border-t border-neutral-100">
              <button
                onClick={() => printDocument("statement")}
                className="flex-1 h-12 rounded-full bg-[#111111] text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer border-none hover:bg-neutral-800 transition-colors"
              >
                <Printer size={16} /> Print Official Statement
              </button>
              <button
                onClick={() => setStatementOpen(false)}
                className="px-6 h-12 rounded-full border border-neutral-200 text-neutral-700 text-sm font-medium hover:bg-neutral-50 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REPAYMENT RECEIPT MODAL ───────────────────────── */}
      {repaymentReceipt && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setRepaymentReceipt(null)}
        >
          <div
            className="repayment-print bg-white rounded-3xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center border-b border-dashed border-neutral-300 pb-3">
              <p className="font-bold text-base text-[#111111]">DANNY&apos;S HEAVEN VENTURES</p>
              <p className="text-xs text-neutral-600 mt-1">Retail &amp; Wholesale · Phones, Laptops &amp; Accessories</p>
              <p className="text-xs text-neutral-500 mt-0.5">Takoradi - Acalema, Ghana · GPS: GA-183-4921</p>
              <p className="text-xs text-neutral-600 font-medium mt-0.5">Contact: +233 59 239 0609</p>
            </div>

            <div className="py-3 text-xs space-y-1.5 border-b border-dashed border-neutral-300">
              <div className="flex justify-between">
                <span className="text-neutral-500">Date:</span>
                <span>{formatDateTime(repaymentReceipt.created_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Customer:</span>
                <span className="font-semibold text-[#111111]">{repaymentReceipt.customer_name}</span>
              </div>
              {repaymentReceipt.customer_phone && (
                <div className="flex justify-between">
                  <span className="text-neutral-500">Phone:</span>
                  <span>{repaymentReceipt.customer_phone}</span>
                </div>
              )}
              {repaymentReceipt.ghana_card_number && (
                <div className="flex justify-between font-mono">
                  <span className="text-neutral-500">Ghana Card:</span>
                  <span>{repaymentReceipt.ghana_card_number}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-neutral-500">Cashier:</span>
                <span>{repaymentReceipt.cashier_name}</span>
              </div>
            </div>

            <div className="py-3 text-xs space-y-1.5 border-b border-dashed border-neutral-300">
              <div className="flex justify-between text-neutral-600">
                <span>Previous Balance:</span>
                <span>{formatGhs(repaymentReceipt.previous_balance)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-emerald-700">
                <span>Amount Paid:</span>
                <span>-{formatGhs(repaymentReceipt.amount_paid)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-[#111111] pt-1">
                <span>Remaining Balance:</span>
                <span>{formatGhs(repaymentReceipt.balance_after)}</span>
              </div>
            </div>

            <p className="text-[11px] text-center text-neutral-400 my-3">
              Thank you for your repayment! Keep this receipt safely.
            </p>

            <div className="print-hide flex gap-2">
              <button
                onClick={() => printDocument("repayment")}
                className="flex-1 h-11 rounded-full bg-[#111111] text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer border-none"
              >
                <Printer size={14} /> Print Slip
              </button>
              <button
                onClick={() => setRepaymentReceipt(null)}
                className="px-4 h-11 rounded-full border border-neutral-200 text-xs font-medium cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
