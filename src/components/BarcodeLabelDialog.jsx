import { useState, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatGhs } from "@/lib/format";
import { Printer, X, Tag, Barcode as BarcodeIcon, Sliders, Check } from "lucide-react";

/**
 * Standard Code 128B pattern encoder
 * Generates exact bar/space widths for scannable barcodes in SVG format
 */
const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", // 20-29
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", // 30-39
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", // 40-49
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", // 50-59
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", // 60-69
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", // 70-79
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", // 80-89
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", // 90-99
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112" // 100-106 (106 is STOP)
];

const START_CODE_B = 104;
const STOP_CODE = 106;

function encodeCode128B(text) {
  if (!text) return "";
  const clean = text.replace(/[^\x20-\x7E]/g, "");
  if (!clean) return "";

  const codes = [START_CODE_B];
  let checksum = START_CODE_B;

  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i) - 32;
    codes.push(code);
    checksum += code * (i + 1);
  }

  codes.push(checksum % 103);
  codes.push(STOP_CODE);

  let patternStr = "";
  for (const c of codes) {
    patternStr += CODE128_PATTERNS[c] || "";
  }
  return patternStr;
}

export function BarcodeSVG({ value, height = 44, width = 180, showText = true }) {
  const pattern = encodeCode128B(value);
  if (!pattern) return null;

  let totalModules = 0;
  for (const ch of pattern) {
    totalModules += Number(ch) || 0;
  }

  const moduleWidth = width / (totalModules + 10);
  let currentX = 5 * moduleWidth;
  const rects = [];

  for (let i = 0; i < pattern.length; i++) {
    const barWidth = Number(pattern[i]) * moduleWidth;
    if (i % 2 === 0) {
      // Bar
      rects.push(
        <rect
          key={i}
          x={currentX}
          y={0}
          width={barWidth}
          height={height}
          fill="#111111"
        />
      );
    }
    currentX += barWidth;
  }

  return (
    <div className="flex flex-col items-center">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="max-w-full"
      >
        <rect width={width} height={height} fill="#ffffff" />
        {rects}
      </svg>
      {showText && (
        <span className="text-[10px] font-mono tracking-wider text-neutral-600 mt-0.5">
          {value}
        </span>
      )}
    </div>
  );
}

export default function BarcodeLabelDialog({
  open,
  onClose,
  product,
  units = [],
  allProducts = [],
}) {
  const [layout, setLayout] = useState("thermal"); // 'thermal' (50x30mm) | 'shelf' (large tag) | 'imei' (device unit tag)
  const [copies, setCopies] = useState(1);
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const printAreaRef = useRef(null);

  if (!open) return null;

  const barcodeValue =
    (layout === "imei" && selectedUnitId
      ? units.find((u) => u.id === selectedUnitId)?.imei_1 ||
        units.find((u) => u.id === selectedUnitId)?.serial_number
      : null) ||
    product?.barcode ||
    product?.sku ||
    `ANB-${product?.id?.slice(0, 8) || "ITEM"}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl p-0 bg-white rounded-3xl overflow-hidden border-0 shadow-2xl">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-neutral-100 flex items-center justify-center text-[#111111]">
              <Tag size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#111111]">
                Print Barcode &amp; Shelf Labels
              </h2>
              <p className="text-xs text-neutral-400">
                {product?.name || "Product Label"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 cursor-pointer border-none"
          >
            <X size={16} />
          </button>
        </div>

        {/* Configuration Controls */}
        <div className="p-6 space-y-4 bg-neutral-50/60 border-b border-neutral-100">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { id: "thermal", label: "50×30mm Thermal Label", desc: "For item box / package" },
              { id: "shelf", label: "Shelf Price Tag", desc: "Bold price for shelf edge" },
              { id: "imei", label: "IMEI / Unit Sticker", desc: "For device tracking & warranty" },
            ].map((fmt) => (
              <button
                key={fmt.id}
                type="button"
                onClick={() => setLayout(fmt.id)}
                className={`p-3 rounded-2xl text-left transition-all border cursor-pointer ${
                  layout === fmt.id
                    ? "bg-white border-[#111111] shadow-sm ring-1 ring-[#111111]"
                    : "bg-white/70 border-neutral-200 hover:bg-white text-neutral-600"
                }`}
              >
                <p className="text-xs font-semibold text-[#111111]">{fmt.label}</p>
                <p className="text-[10px] text-neutral-400 mt-0.5">{fmt.desc}</p>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            {layout === "imei" && units.length > 0 && (
              <div className="flex-1 min-w-[200px]">
                <label className="text-neutral-500 font-medium block mb-1">
                  Select Unit (IMEI/Serial):
                </label>
                <select
                  value={selectedUnitId}
                  onChange={(e) => setSelectedUnitId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white text-xs text-[#111111] focus:outline-none focus:border-[#FF9000]"
                >
                  <option value="">Default Product Barcode</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.imei_1 ? `IMEI: ${u.imei_1}` : `SN: ${u.serial_number}`} ({u.status})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-neutral-500 font-medium block mb-1">
                Number of Copies:
              </label>
              <div className="flex items-center gap-1.5">
                {[1, 2, 4, 8].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCopies(n)}
                    className={`w-9 h-8 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                      copies === n
                        ? "bg-[#111111] text-white border-[#111111]"
                        : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Live Preview Area */}
        <div className="p-6">
          <p className="text-xs text-neutral-400 uppercase tracking-wider font-semibold mb-3">
            Print Preview ({copies} label{copies > 1 ? "s" : ""})
          </p>

          <div
            ref={printAreaRef}
            className="p-6 bg-neutral-100 rounded-2xl flex flex-wrap gap-4 items-center justify-center max-h-72 overflow-y-auto"
          >
            {Array.from({ length: copies }).map((_, idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl shadow-sm border border-neutral-200 text-[#111111] transition-transform"
                style={{
                  width: layout === "shelf" ? "240px" : "190px",
                  padding: "10px 12px",
                }}
              >
                {layout === "shelf" ? (
                  /* Shelf Edge Price Tag Layout */
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-baseline border-b border-neutral-100 pb-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 truncate">
                        {product?.brand || "DANNY'S HEAVEN"}
                      </span>
                      <span className="text-[9px] font-mono text-neutral-400">
                        {product?.sku}
                      </span>
                    </div>

                    <p className="text-xs font-semibold leading-tight line-clamp-2 text-[#111111]">
                      {product?.name || "Product Name"}
                    </p>

                    <div className="my-1 text-center py-1 bg-neutral-50 rounded-lg">
                      <span className="text-lg font-bold text-[#111111]">
                        {formatGhs(product?.selling_price || 0)}
                      </span>
                    </div>

                    <BarcodeSVG value={barcodeValue} height={28} width={160} showText={true} />
                  </div>
                ) : layout === "imei" ? (
                  /* IMEI / Unit Warranty Sticker Layout */
                  <div className="flex flex-col items-center text-center gap-1">
                    <p className="text-[10px] font-bold tracking-wide uppercase text-neutral-700">
                      DANNY&apos;S HEAVEN VENTURES
                    </p>
                    <p className="text-[11px] font-semibold text-[#111111] truncate max-w-[170px]">
                      {product?.name}
                    </p>
                    <div className="w-full my-0.5">
                      <BarcodeSVG value={barcodeValue} height={32} width={160} showText={true} />
                    </div>
                    <p className="text-[9px] text-neutral-500 font-medium">
                      Takoradi · +233 59 239 0609
                    </p>
                  </div>
                ) : (
                  /* Standard Thermal 50x30mm Layout */
                  <div className="flex flex-col items-center text-center gap-1">
                    <p className="text-[9px] uppercase tracking-wider text-neutral-500 truncate max-w-[160px]">
                      {product?.brand || "A N B Haven"}
                    </p>
                    <p className="text-xs font-semibold text-[#111111] truncate max-w-[170px]">
                      {product?.name}
                    </p>
                    <p className="text-sm font-bold text-[#111111]">
                      {formatGhs(product?.selling_price || 0)}
                    </p>
                    <div className="w-full my-0.5">
                      <BarcodeSVG value={barcodeValue} height={30} width={160} showText={true} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 px-6 bg-white border-t border-neutral-100 flex items-center justify-between">
          <p className="text-xs text-neutral-400">
            Works with standard 50×30mm thermal printers or A4 label paper.
          </p>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="h-10 px-4 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-medium cursor-pointer border-none"
            >
              Cancel
            </button>
            <button
              onClick={handlePrint}
              className="h-10 px-5 rounded-xl bg-[#111111] hover:bg-neutral-800 text-white text-xs font-medium flex items-center gap-2 cursor-pointer border-none transition-colors"
            >
              <Printer size={15} /> Print Labels
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
