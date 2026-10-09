import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, X, AlertCircle, Scan } from "lucide-react";

export default function CameraScannerModal({ open, onClose, onScan }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);
  const [supported, setSupported] = useState(true);
  const [manualCode, setManualCode] = useState("");
  const scanningRef = useRef(false);

  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [open]);

  const startCamera = async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setSupported(false);
        setError("Camera access is not supported in this browser.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        startDetection();
      }
    } catch (err) {
      console.warn("Camera access denied or failed:", err);
      setError(
        err.name === "NotAllowedError"
          ? "Camera permission was denied. Please allow camera access in your browser settings."
          : "Could not start camera. You can type or paste the barcode below."
      );
    }
  };

  const stopCamera = () => {
    scanningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startDetection = () => {
    if (!("BarcodeDetector" in window)) {
      // BarcodeDetector not natively available; fallback to manual input or canvas loop
      return;
    }

    scanningRef.current = true;
    const barcodeDetector = new window.BarcodeDetector({
      formats: ["qr_code", "ean_13", "code_128", "code_39", "upc_a", "upc_e", "itf"],
    });

    const detect = async () => {
      if (!scanningRef.current || !videoRef.current) return;
      try {
        if (videoRef.current.readyState >= 2) {
          const barcodes = await barcodeDetector.detect(videoRef.current);
          if (barcodes.length > 0) {
            const rawValue = barcodes[0].rawValue;
            if (rawValue) {
              if (navigator.vibrate) navigator.vibrate(100);
              onScan(rawValue);
              onClose();
              return;
            }
          }
        }
      } catch (e) {
        // Continue detection loop
      }
      if (scanningRef.current) {
        requestAnimationFrame(detect);
      }
    };

    requestAnimationFrame(detect);
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const code = manualCode.trim();
    if (code) {
      onScan(code);
      setManualCode("");
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-white rounded-3xl p-6">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold text-[#111111] flex items-center gap-2">
              <Camera size={18} className="text-[#FF9000]" /> Scan Barcode / IMEI / QR
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          {/* Live Camera Viewport */}
          <div className="relative w-full h-64 bg-neutral-900 rounded-2xl overflow-hidden flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Target Reticle Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-56 h-36 border-2 border-[#FF9000] rounded-xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                <div className="absolute inset-x-0 top-1/2 h-0.5 bg-[#FF9000] animate-pulse" />
              </div>
            </div>

            {error && (
              <div className="absolute inset-0 bg-neutral-900/90 flex flex-col items-center justify-center p-6 text-center text-white">
                <AlertCircle size={28} className="text-amber-400 mb-2" />
                <p className="text-xs text-neutral-300 max-w-xs">{error}</p>
              </div>
            )}
          </div>

          <p className="text-xs text-center text-neutral-500">
            Position the barcode or phone IMEI inside the frame to scan automatically.
          </p>

          {/* Fallback / Manual Barcode Input */}
          <form onSubmit={handleManualSubmit} className="pt-2 border-t border-neutral-100 flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Or type/paste barcode or IMEI…"
              className="flex-1 h-11 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:border-[#FF9000]"
            />
            <button
              type="submit"
              className="h-11 px-4 rounded-xl bg-[#111111] text-white text-xs font-semibold hover:bg-neutral-800 cursor-pointer border-none"
            >
              Enter
            </button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
