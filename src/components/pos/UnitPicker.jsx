import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScanBarcode } from "lucide-react";

export default function UnitPicker({ open, onClose, units, onPick }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-white rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#111111]">
            <ScanBarcode size={18} /> Select IMEI / Serial
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto flex flex-col gap-2 mt-2">
          {units.length === 0 && (
            <p className="text-sm text-neutral-500 py-6 text-center">No units in stock for this product.</p>
          )}
          {units.map((u) => (
            <button
              key={u.id}
              onClick={() => onPick(u)}
              className="flex items-center justify-between rounded-2xl border border-neutral-200 px-4 py-3 text-sm text-left hover:border-[#FF9000] hover:bg-orange-50 transition-colors cursor-pointer">
              <span className="font-medium text-[#111111]">{u.imei_1 || u.serial_number}</span>
              <span className="text-xs text-neutral-500">{u.imei_1 ? "IMEI" : "Serial"}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}