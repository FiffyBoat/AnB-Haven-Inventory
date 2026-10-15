/**
 * ProductImport.jsx
 *
 * Bulk-import products from a CSV or Excel (.xlsx/.xls) file.
 *
 * Expected columns (case-insensitive, order doesn't matter):
 *   name*, selling_price*, sku, barcode, category, brand, model,
 *   cost_price, reorder_level, opening_stock, track_imei (yes/no/1/0),
 *   track_serial (yes/no/1/0), description
 *
 * Rows with no name OR no selling_price are flagged as errors and skipped.
 */

import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { localStore } from "@/api/localStore";
import {
  Upload, FileSpreadsheet, Download, X, CheckCircle2,
  AlertTriangle, AlertCircle, ChevronDown, ChevronUp, Loader2,
} from "lucide-react";

// ── Column aliases ─────────────────────────────────────────────────────────────
const ALIASES = {
  name:          ["name", "product_name", "product name", "item", "item name"],
  sku:           ["sku", "stock keeping unit", "code"],
  barcode:       ["barcode", "ean", "upc", "gtin"],
  category:      ["category", "cat", "type"],
  brand:         ["brand", "make", "manufacturer"],
  model:         ["model", "model number", "model_no"],
  cost_price:    ["cost_price", "cost price", "cost", "buy price", "buying price", "purchase price"],
  selling_price: ["selling_price", "selling price", "sell price", "price", "retail price", "sale price"],
  reorder_level: ["reorder_level", "reorder level", "reorder", "min stock", "min_stock"],
  opening_stock: ["opening_stock", "opening stock", "initial stock", "initial qty", "qty", "quantity", "stock"],
  track_imei:    ["track_imei", "track imei", "imei", "imei tracking"],
  track_serial:  ["track_serial", "track serial", "serial", "serial tracking"],
  description:   ["description", "desc", "notes"],
};

function resolveHeader(raw) {
  const lower = String(raw || "").trim().toLowerCase();
  for (const [field, aliases] of Object.entries(ALIASES)) {
    if (aliases.includes(lower)) return field;
  }
  return null;
}

const toBool = (v) => {
  if (v === true || v === 1) return true;
  const s = String(v || "").trim().toLowerCase();
  return s === "yes" || s === "true" || s === "1";
};

const toNum = (v, fallback = 0) => {
  const n = parseFloat(String(v || "").replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? fallback : n;
};

const autoSku = (name, category) => {
  const initials = (name || "").split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).join("").slice(0, 4) || "SKU";
  const cat = (category || "GEN").slice(0, 3).toUpperCase();
  return `${cat}-${initials}-${Math.floor(1000 + Math.random() * 9000)}`;
};

// ── Parse workbook rows into structured objects ───────────────────────────────
function parseRows(worksheet) {
  const raw = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
  if (raw.length < 2) return [];

  // Build header map: colIndex → fieldName
  const headers = raw[0].map((h) => resolveHeader(h));

  return raw.slice(1).map((row, rowIdx) => {
    const obj = {};
    headers.forEach((field, i) => {
      if (field) obj[field] = row[i];
    });

    const name = String(obj.name || "").trim();
    const selling_price = toNum(obj.selling_price);
    const errors = [];

    if (!name) errors.push("Name is required");
    if (!selling_price && selling_price !== 0) errors.push("Selling price is required");
    else if (selling_price < 0) errors.push("Selling price cannot be negative");

    return {
      _row: rowIdx + 2, // 1-indexed, skipping header row
      _errors: errors,
      name,
      sku:           String(obj.sku || "").trim(),
      barcode:       String(obj.barcode || "").trim(),
      category:      String(obj.category || "").trim(),
      brand:         String(obj.brand || "").trim(),
      model:         String(obj.model || "").trim(),
      description:   String(obj.description || "").trim(),
      cost_price:    toNum(obj.cost_price, 0),
      selling_price,
      reorder_level: Math.max(0, Math.floor(toNum(obj.reorder_level, 5))),
      opening_stock: Math.max(0, Math.floor(toNum(obj.opening_stock, 0))),
      track_imei:    toBool(obj.track_imei),
      track_serial:  toBool(obj.track_serial),
    };
  }).filter((r) => Object.values(r).some((v, i) => i > 1 && v !== "" && v !== 0 && v !== false));
}

// ── Template download ─────────────────────────────────────────────────────────
function downloadTemplate() {
  const headers = [
    "name", "sku", "barcode", "category", "brand", "model",
    "cost_price", "selling_price", "reorder_level", "opening_stock",
    "track_imei", "track_serial", "description",
  ];
  const example = [
    "Samsung Galaxy A15 128GB", "SAM-A15-128", "6901443562122", "Phones", "Samsung", "A15",
    900, 1250, 3, 0, "no", "no", "Budget Android smartphone",
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Products");
  XLSX.writeFile(wb, "products_import_template.xlsx");
}

// ── Row preview table ─────────────────────────────────────────────────────────
function PreviewTable({ rows, formatGhs }) {
  const [showAll, setShowAll] = useState(false);
  const valid   = rows.filter((r) => r._errors.length === 0);
  const invalid = rows.filter((r) => r._errors.length > 0);
  const displayed = showAll ? rows : rows.slice(0, 20);

  return (
    <div className="mt-4">
      {/* Summary bar */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
          <CheckCircle2 size={12} /> {valid.length} valid
        </span>
        {invalid.length > 0 && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-3 py-1">
            <AlertCircle size={12} /> {invalid.length} invalid (will be skipped)
          </span>
        )}
        <span className="text-xs text-neutral-400 ml-auto">{rows.length} row{rows.length !== 1 ? "s" : ""} total</span>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-neutral-50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 text-neutral-500 font-medium whitespace-nowrap">#</th>
                <th className="text-left px-3 py-2 text-neutral-500 font-medium whitespace-nowrap">Name</th>
                <th className="text-left px-3 py-2 text-neutral-500 font-medium whitespace-nowrap">Category</th>
                <th className="text-left px-3 py-2 text-neutral-500 font-medium whitespace-nowrap">SKU</th>
                <th className="text-right px-3 py-2 text-neutral-500 font-medium whitespace-nowrap">Cost</th>
                <th className="text-right px-3 py-2 text-neutral-500 font-medium whitespace-nowrap">Price</th>
                <th className="text-right px-3 py-2 text-neutral-500 font-medium whitespace-nowrap">Opening</th>
                <th className="text-left px-3 py-2 text-neutral-500 font-medium whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((row) => {
                const hasError = row._errors.length > 0;
                return (
                  <tr key={row._row} className={`border-t border-neutral-100 ${hasError ? "bg-red-50" : "hover:bg-neutral-50"}`}>
                    <td className="px-3 py-2 text-neutral-400">{row._row}</td>
                    <td className="px-3 py-2 font-medium text-[#111111] max-w-[180px] truncate">{row.name || "—"}</td>
                    <td className="px-3 py-2 text-neutral-600">{row.category || "—"}</td>
                    <td className="px-3 py-2 text-neutral-400 font-mono">{row.sku || "auto"}</td>
                    <td className="px-3 py-2 text-right text-neutral-600">{row.cost_price > 0 ? `GHS ${row.cost_price.toFixed(2)}` : "—"}</td>
                    <td className="px-3 py-2 text-right font-medium text-[#111111]">GHS {row.selling_price.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-neutral-600">{row.opening_stock}</td>
                    <td className="px-3 py-2">
                      {hasError ? (
                        <span title={row._errors.join("; ")} className="inline-flex items-center gap-1 text-red-600 font-semibold cursor-help">
                          <AlertCircle size={11} /> Error
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                          <CheckCircle2 size={11} /> OK
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length > 20 && (
          <button onClick={() => setShowAll((v) => !v)}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs text-neutral-500 hover:text-[#111111] border-t border-neutral-200 bg-neutral-50 cursor-pointer border-l-0 border-r-0 border-b-0">
            {showAll ? <><ChevronUp size={13} /> Show less</> : <><ChevronDown size={13} /> Show all {rows.length} rows</>}
          </button>
        )}
      </div>

      {/* Error details */}
      {invalid.length > 0 && (
        <div className="mt-3 space-y-1">
          {invalid.slice(0, 5).map((row) => (
            <p key={row._row} className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
              <span className="font-semibold">Row {row._row}</span> — {row._errors.join("; ")}
            </p>
          ))}
          {invalid.length > 5 && <p className="text-xs text-neutral-400">…and {invalid.length - 5} more error{invalid.length - 5 !== 1 ? "s" : ""}</p>}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ProductImport({ categories, onImported, onClose }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null); // { created, skipped }

  const processFile = useCallback((file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(ext)) {
      toast({ title: "Unsupported file type", description: "Please upload a .csv, .xlsx, or .xls file.", variant: "destructive" });
      return;
    }
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const parsed = parseRows(ws);
        setRows(parsed);
      } catch (err) {
        toast({ title: "Could not parse file", description: err.message, variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
  }, [toast]);

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    processFile(e.dataTransfer.files[0]);
  };

  const validRows = rows?.filter((r) => r._errors.length === 0) || [];

  const runImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    let created = 0;
    let skipped = 0;
    for (const row of validRows) {
      try {
        const sku = row.sku || autoSku(row.name, row.category);
        const product = await localStore.entities.Product.create({
          name:          row.name,
          sku,
          barcode:       row.barcode,
          category:      row.category,
          brand:         row.brand,
          model:         row.model,
          description:   row.description,
          cost_price:    row.cost_price,
          selling_price: row.selling_price,
          reorder_level: row.reorder_level,
          track_imei:    row.track_imei,
          track_serial:  row.track_serial,
          current_stock: row.opening_stock,
          status:        "active",
          image_url:     "",
        });
        if (row.opening_stock > 0) {
          await localStore.entities.StockMovement.create({
            product_id:        product.id,
            product_name:      product.name,
            movement_type:     "OPENING_STOCK",
            quantity:          row.opening_stock,
            previous_quantity: 0,
            new_quantity:      row.opening_stock,
            notes:             "Bulk import — opening stock",
            created_by_name:   user?.full_name || "",
          });
        }
        created++;
      } catch {
        skipped++;
      }
    }
    setImporting(false);
    setResult({ created, skipped });
    if (created > 0) onImported?.();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 w-full max-w-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-base font-semibold text-[#111111]">Import Products</p>
            <p className="text-xs text-neutral-500 mt-0.5">Upload a CSV or Excel file to create products in bulk</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center border-none cursor-pointer">
            <X size={16} className="text-neutral-600" />
          </button>
        </div>

        {/* Template download */}
        <button onClick={downloadTemplate}
          className="flex items-center gap-2 text-xs text-[#111111] bg-neutral-50 border border-neutral-200 hover:border-neutral-400 rounded-xl px-4 py-2.5 cursor-pointer transition-colors mb-4">
          <Download size={13} className="text-neutral-500" />
          Download template (.xlsx)
          <span className="text-neutral-400 ml-1">— use this to format your data correctly</span>
        </button>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
            dragging ? "border-[#FF9000] bg-amber-50" : "border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50"
          }`}
        >
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
            onChange={(e) => processFile(e.target.files[0])} />
          <FileSpreadsheet size={28} className={`mx-auto mb-2 ${dragging ? "text-[#FF9000]" : "text-neutral-300"}`} />
          {fileName ? (
            <p className="text-sm font-medium text-[#111111]">{fileName}</p>
          ) : (
            <>
              <p className="text-sm font-medium text-neutral-600">Drag & drop your file here</p>
              <p className="text-xs text-neutral-400 mt-1">or click to browse — CSV, XLSX, XLS supported</p>
            </>
          )}
          {rows !== null && (
            <p className="text-xs text-neutral-400 mt-2">{rows.length} data row{rows.length !== 1 ? "s" : ""} detected</p>
          )}
        </div>

        {/* Preview */}
        {rows !== null && <PreviewTable rows={rows} />}

        {/* Result */}
        {result && (
          <div className={`mt-4 rounded-2xl p-4 flex items-start gap-3 ${
            result.created > 0 ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"
          }`}>
            {result.created > 0 ? <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" /> : <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />}
            <div>
              <p className={`text-sm font-semibold ${result.created > 0 ? "text-emerald-800" : "text-red-700"}`}>
                {result.created > 0 ? `${result.created} product${result.created !== 1 ? "s" : ""} imported successfully` : "Import failed"}
              </p>
              {result.skipped > 0 && <p className="text-xs text-neutral-500 mt-0.5">{result.skipped} row{result.skipped !== 1 ? "s" : ""} skipped due to errors</p>}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 h-12 rounded-full bg-neutral-100 text-sm text-[#111111] cursor-pointer border-none hover:bg-neutral-200">
            {result?.created > 0 ? "Done" : "Cancel"}
          </button>
          {rows !== null && validRows.length > 0 && !result && (
            <button disabled={importing} onClick={runImport}
              className="flex-1 h-12 rounded-full bg-[#111111] text-white text-sm cursor-pointer border-none disabled:opacity-40 flex items-center justify-center gap-2">
              {importing ? (
                <><Loader2 size={15} className="animate-spin" /> Importing…</>
              ) : (
                <><Upload size={15} /> Import {validRows.length} product{validRows.length !== 1 ? "s" : ""}</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
