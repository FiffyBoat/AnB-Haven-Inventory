import { useState, useEffect, useMemo } from "react";
import { localStore } from "@/api/localStore";
import { formatGhs, formatDateTime } from "@/lib/format";
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Smartphone,
  Calendar,
  UserCheck,
  ReceiptText,
  Clock,
  ArrowRight,
  Package,
  MessageCircle,
  Printer,
  Barcode,
  Camera,
} from "lucide-react";
import ReceiptModal from "@/components/ReceiptModal";
import CameraScannerModal from "@/components/pos/CameraScannerModal";

const WARRANTY_OPTIONS = [
  { label: "30 Days (Accessories/Refurb)", days: 30 },
  { label: "90 Days (3 Months)", days: 90 },
  { label: "180 Days (6 Months)", days: 180 },
  { label: "365 Days (1 Year)", days: 365 },
];

function sanitizeGhPhone(phone) {
  if (!phone) return "";
  const cleaned = String(phone).replace(/[^0-9]/g, "");
  if (cleaned.startsWith("0") && cleaned.length === 10) return "233" + cleaned.slice(1);
  if (cleaned.startsWith("233")) return cleaned;
  return cleaned;
}

export default function WarrantyLookup() {
  const [query, setQuery] = useState("");
  const [units, setUnits] = useState([]);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [warrantyDays, setWarrantyDays] = useState(90);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [receiptModalSale, setReceiptModalSale] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'IN_STOCK' | 'SOLD' | 'DAMAGED' | 'LOST'

  useEffect(() => {
    Promise.all([
      localStore.entities.ProductUnit.list(),
      localStore.entities.Product.list(),
      localStore.entities.Sale.list("-created_date", 500),
    ])
      .then(([u, p, s]) => {
        setUnits(u || []);
        setProducts(p || []);
        setSales(s || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const productMap = useMemo(() => {
    const map = new Map();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  const salesMap = useMemo(() => {
    const map = new Map();
    sales.forEach((s) => {
      map.set(s.id, s);
      // Also map by sale_number
      if (s.sale_number) map.set(s.sale_number, s);
    });
    return map;
  }, [sales]);

  // Find linked sale for a unit
  const getUnitSale = (unit) => {
    if (!unit) return null;
    if (unit.sale_id && salesMap.has(unit.sale_id)) {
      return salesMap.get(unit.sale_id);
    }
    // Fallback: search sales where items have this identifier
    const ident = unit.imei_1 || unit.serial_number;
    if (!ident) return null;
    return sales.find((s) =>
      (s.items || []).some(
        (it) =>
          it.unit_id === unit.id ||
          (it.identifier && it.identifier.includes(ident))
      )
    );
  };

  // Warranty calculations
  const calculateWarranty = (saleDate, durationDays) => {
    if (!saleDate) return null;
    const soldTime = new Date(saleDate).getTime();
    const expiryTime = soldTime + durationDays * 86400000;
    const now = Date.now();
    const isExpired = now > expiryTime;
    const daysLeft = Math.ceil((expiryTime - now) / 86400000);
    const daysAgo = Math.floor((now - expiryTime) / 86400000);

    return {
      expiryDate: new Date(expiryTime),
      isExpired,
      daysLeft: isExpired ? 0 : daysLeft,
      daysAgo: isExpired ? daysAgo : 0,
    };
  };

  // Filtered unit results
  const filteredUnits = useMemo(() => {
    const q = query.trim().toLowerCase();
    return units
      .filter((u) => {
        if (statusFilter !== "all" && u.status !== statusFilter) return false;
        if (!q) return true;
        const imei = (u.imei_1 || "").toLowerCase();
        const sn = (u.serial_number || "").toLowerCase();
        const pName = (u.product_name || "").toLowerCase();
        return imei.includes(q) || sn.includes(q) || pName.includes(q);
      })
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  }, [units, query, statusFilter]);

  const activeUnit = selectedUnit || (filteredUnits.length === 1 ? filteredUnits[0] : null);
  const activeProduct = activeUnit ? productMap.get(activeUnit.product_id) : null;
  const activeSale = activeUnit ? getUnitSale(activeUnit) : null;
  const warrantyInfo = activeSale
    ? calculateWarranty(activeSale.created_date, warrantyDays)
    : null;

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-light text-[#111111] flex items-center gap-2.5">
            <ShieldCheck size={26} className="text-[#FF9000]" />
            Warranty &amp; Device Lifecycle Lookup
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            Verify device authenticity, sales invoice, customer history, and warranty validity by IMEI or Serial Number.
          </p>
        </div>

        {/* Warranty duration selector */}
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-2xl border border-neutral-200">
          <Clock size={15} className="text-neutral-400" />
          <span className="text-xs text-neutral-500 font-medium">Warranty term:</span>
          <select
            value={warrantyDays}
            onChange={(e) => setWarrantyDays(Number(e.target.value))}
            className="text-xs font-semibold text-[#111111] bg-transparent border-0 focus:outline-none cursor-pointer"
          >
            {WARRANTY_OPTIONS.map((opt) => (
              <option key={opt.days} value={opt.days}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Search & Scan Box */}
      <div className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedUnit(null);
              }}
              placeholder="Type or scan IMEI, Serial Number, or device model…"
              className="w-full h-12 pl-11 pr-4 rounded-2xl bg-neutral-50 border border-neutral-200 text-sm font-medium text-[#111111] placeholder:text-neutral-400 focus:outline-none focus:border-[#FF9000] focus:bg-white transition-all"
              autoFocus
            />
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  setSelectedUnit(null);
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-[#111111] cursor-pointer bg-neutral-200 px-2 py-0.5 rounded-full border-none"
              >
                Clear
              </button>
            )}
          </div>

          <button
            onClick={() => setCameraOpen(true)}
            className="h-12 px-5 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-[#111111] text-xs sm:text-sm font-medium flex items-center justify-center gap-2 cursor-pointer border-none transition-colors"
          >
            <Camera size={17} /> Scan Barcode / IMEI
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 mt-4 overflow-x-auto pb-1 text-xs">
          <span className="text-neutral-400 mr-1 shrink-0">Filter:</span>
          {[
            { id: "all", label: `All Units (${units.length})` },
            { id: "SOLD", label: `Sold (${units.filter((u) => u.status === "SOLD").length})` },
            { id: "IN_STOCK", label: `In Stock (${units.filter((u) => u.status === "IN_STOCK").length})` },
            { id: "DAMAGED", label: `Damaged (${units.filter((u) => u.status === "DAMAGED").length})` },
            { id: "LOST", label: `Lost (${units.filter((u) => u.status === "LOST").length})` },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => {
                setStatusFilter(pill.id);
                setSelectedUnit(null);
              }}
              className={`px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer border-none shrink-0 ${
                statusFilter === pill.id
                  ? "bg-[#111111] text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Details + Unit List */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Unit Detail & Warranty Card (Left: 7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {activeUnit ? (
            <div className="bg-white rounded-3xl p-6 border border-neutral-100 shadow-sm flex flex-col gap-5">
              {/* Unit Header */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-neutral-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-[#FF9000] shrink-0">
                    <Smartphone size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-heading font-medium text-[#111111]">
                      {activeUnit.product_name || activeProduct?.name || "Tracked Device"}
                    </h2>
                    <p className="text-xs text-neutral-400 font-mono mt-0.5">
                      {activeUnit.imei_1 ? `IMEI: ${activeUnit.imei_1}` : ""}
                      {activeUnit.imei_1 && activeUnit.serial_number ? " · " : ""}
                      {activeUnit.serial_number ? `SN: ${activeUnit.serial_number}` : ""}
                    </p>
                  </div>
                </div>

                <span
                  className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide shrink-0"
                  style={{
                    background:
                      activeUnit.status === "SOLD"
                        ? "#EFF6EC"
                        : activeUnit.status === "IN_STOCK"
                        ? "#FFF3E6"
                        : "#FDEAE6",
                    color:
                      activeUnit.status === "SOLD"
                        ? "#2D6A4F"
                        : activeUnit.status === "IN_STOCK"
                        ? "#D9624A"
                        : "#F13A15",
                  }}
                >
                  {activeUnit.status === "SOLD"
                    ? "✓ Sold"
                    : activeUnit.status === "IN_STOCK"
                    ? "In Stock"
                    : activeUnit.status}
                </span>
              </div>

              {/* Warranty Banner (if sold) */}
              {activeUnit.status === "SOLD" && warrantyInfo && (
                <div
                  className={`p-4 rounded-2xl border flex items-center gap-3.5 ${
                    warrantyInfo.isExpired
                      ? "bg-red-50/70 border-red-200 text-red-900"
                      : "bg-emerald-50/80 border-emerald-200 text-emerald-950"
                  }`}
                >
                  {warrantyInfo.isExpired ? (
                    <ShieldAlert size={28} className="text-red-500 shrink-0" />
                  ) : (
                    <ShieldCheck size={28} className="text-emerald-600 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">
                      {warrantyInfo.isExpired
                        ? "Warranty Expired"
                        : `Warranty Active (${warrantyInfo.daysLeft} days remaining)`}
                    </p>
                    <p className="text-xs opacity-80 mt-0.5">
                      {warrantyInfo.isExpired
                        ? `Expired ${warrantyInfo.daysAgo} day(s) ago on ${warrantyInfo.expiryDate.toLocaleDateString("en-GH")}.`
                        : `Valid until ${warrantyInfo.expiryDate.toLocaleDateString("en-GH")}.`}
                    </p>
                  </div>
                </div>
              )}

              {/* In-Stock Banner */}
              {activeUnit.status === "IN_STOCK" && (
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-950 flex items-center gap-3.5">
                  <Package size={26} className="text-amber-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">Available in Store Stock</p>
                    <p className="text-xs opacity-80 mt-0.5">
                      This unit is registered in inventory and ready to be sold via POS.
                    </p>
                  </div>
                </div>
              )}

              {/* Sale & Customer Details */}
              {activeSale ? (
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs uppercase tracking-wider text-neutral-400 font-semibold">
                    Sales &amp; Customer Information
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs bg-neutral-50 p-4 rounded-2xl">
                    <div>
                      <p className="text-neutral-400">Invoice Number</p>
                      <p className="text-[#111111] font-semibold mt-0.5">{activeSale.sale_number}</p>
                    </div>
                    <div>
                      <p className="text-neutral-400">Date Sold</p>
                      <p className="text-[#111111] font-medium mt-0.5">
                        {formatDateTime(activeSale.created_date)}
                      </p>
                    </div>
                    <div>
                      <p className="text-neutral-400">Customer Name</p>
                      <p className="text-[#111111] font-medium mt-0.5">
                        {activeSale.customer_name || "Walk-in Customer"}
                      </p>
                    </div>
                    <div>
                      <p className="text-neutral-400">Cashier Served</p>
                      <p className="text-[#111111] font-medium mt-0.5">{activeSale.cashier_name || "Cashier"}</p>
                    </div>
                    <div>
                      <p className="text-neutral-400">Sale Total</p>
                      <p className="text-[#111111] font-semibold mt-0.5">{formatGhs(activeSale.total)}</p>
                    </div>
                    <div>
                      <p className="text-neutral-400">Payment Status</p>
                      <p className="text-[#111111] font-medium mt-0.5">
                        {activeSale.credit_amount > 0 ? (
                          <span className="text-[#D9624A]">Credit Due: {formatGhs(activeSale.credit_amount)}</span>
                        ) : (
                          <span className="text-emerald-700">Fully Paid</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      onClick={() => setReceiptModalSale(activeSale)}
                      className="px-4 h-10 rounded-xl bg-[#111111] hover:bg-neutral-800 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer border-none transition-colors"
                    >
                      <ReceiptText size={14} /> View Original Receipt
                    </button>
                    {activeSale.customer_phone && (
                      <button
                        onClick={() => {
                          const p = sanitizeGhPhone(activeSale.customer_phone);
                          const msg = `Hello ${activeSale.customer_name}, regarding your device (${activeUnit.product_name}) purchased from DANNY'S HEAVEN VENTURES (Invoice: ${activeSale.sale_number}). How can we assist you today?`;
                          window.open(`https://wa.me/${p}?text=${encodeURIComponent(msg)}`, "_blank");
                        }}
                        className="px-4 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer border-none transition-colors"
                      >
                        <MessageCircle size={14} /> WhatsApp Customer
                      </button>
                    )}
                  </div>
                </div>
              ) : activeUnit.status === "SOLD" ? (
                <div className="p-4 rounded-2xl bg-neutral-50 text-xs text-neutral-500">
                  <p className="font-medium text-[#111111]">Marked as Sold</p>
                  <p className="mt-0.5">
                    Unit is recorded as sold, but specific historical invoice was archived or sold prior to sync.
                  </p>
                </div>
              ) : null}

              {/* Product Specifications */}
              {activeProduct && (
                <div className="space-y-2 pt-2 border-t border-neutral-100 text-xs">
                  <h3 className="text-xs uppercase tracking-wider text-neutral-400 font-semibold">
                    Product Catalog Info
                  </h3>
                  <div className="flex justify-between py-1.5 border-b border-neutral-50">
                    <span className="text-neutral-500">Category / Brand</span>
                    <span className="font-medium text-[#111111]">
                      {[activeProduct.category, activeProduct.brand].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-neutral-50">
                    <span className="text-neutral-500">SKU / Barcode</span>
                    <span className="font-mono text-[#111111]">
                      {activeProduct.sku || "—"} {activeProduct.barcode ? `· ${activeProduct.barcode}` : ""}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-neutral-500">Selling Price</span>
                    <span className="font-semibold text-[#111111]">{formatGhs(activeProduct.selling_price)}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-neutral-200">
              <ShieldCheck size={36} className="mx-auto text-neutral-300" />
              <p className="text-sm font-medium text-[#111111] mt-3">Select or search for a unit</p>
              <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                Type an IMEI or Serial number above to verify warranty status, purchase receipt, and customer details.
              </p>
            </div>
          )}
        </div>

        {/* Units List (Right: 5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Tracked Units ({filteredUnits.length})
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-neutral-100 overflow-hidden shadow-sm max-h-[640px] overflow-y-auto">
            {loading ? (
              <div className="py-20 text-center">
                <div className="w-6 h-6 border-2 border-neutral-200 border-t-[#111111] rounded-full animate-spin mx-auto" />
              </div>
            ) : filteredUnits.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-400">
                No units match your search query.
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {filteredUnits.map((u) => {
                  const isSelected = activeUnit?.id === u.id;
                  return (
                    <button
                      key={u.id}
                      onClick={() => setSelectedUnit(u)}
                      className={`w-full text-left p-3.5 transition-colors cursor-pointer border-none flex items-center justify-between gap-3 ${
                        isSelected
                          ? "bg-amber-50/70"
                          : "hover:bg-neutral-50 bg-white"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#111111] truncate">
                          {u.product_name || "Unit"}
                        </p>
                        <p className="text-[11px] font-mono text-neutral-500 truncate mt-0.5">
                          {u.imei_1 || u.serial_number || "No identifier"}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{
                            background:
                              u.status === "SOLD"
                                ? "#EFF6EC"
                                : u.status === "IN_STOCK"
                                ? "#FFF3E6"
                                : "#FDEAE6",
                            color:
                              u.status === "SOLD"
                                ? "#2D6A4F"
                                : u.status === "IN_STOCK"
                                ? "#D9624A"
                                : "#F13A15",
                          }}
                        >
                          {u.status}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Camera scanner modal */}
      <CameraScannerModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onScan={(code) => {
          setQuery(code);
          setCameraOpen(false);
        }}
      />

      {/* Receipt Modal for viewing original sale receipt */}
      <ReceiptModal
        open={!!receiptModalSale}
        sale={receiptModalSale}
        onClose={() => setReceiptModalSale(null)}
      />
    </div>
  );
}
