import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, AlertCircle, Scan, Flashlight, UploadCloud, RefreshCw, CheckCircle2 } from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

// Play a quick crisp beep on successful barcode scan
function playBeepSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime); // 880Hz (A5)
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  } catch (e) {
    // Ignore audio restrictions
  }
}

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.ITF,
];

export default function CameraScannerModal({ open, onClose, onScan, title = "Scan Barcode / IMEI / QR" }) {
  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);
  const containerId = "phone-barcode-viewport";

  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const [manualCode, setManualCode] = useState("");
  const [scanningFile, setScanningFile] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [isHttpNotice, setIsHttpNotice] = useState(false);

  useEffect(() => {
    // Check if running on mobile phone over non-secure HTTP (which blocks getUserMedia)
    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (!window.isSecureContext && !isLocalhost) {
      setIsHttpNotice(true);
    } else {
      setIsHttpNotice(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopScanner();
      return;
    }

    // Give DOM time to render the dialog and container element
    const timer = setTimeout(() => {
      startLiveScanner();
    }, 250);

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [open]);

  const handleScanSuccess = (decodedText) => {
    if (!decodedText) return;
    const clean = String(decodedText).trim();
    if (!clean) return;

    playBeepSound();
    if (navigator.vibrate) {
      try {
        navigator.vibrate(120);
      } catch (e) {}
    }

    stopScanner();
    onScan(clean);
    onClose();
  };

  const startLiveScanner = async () => {
    setError(null);
    setTorchOn(false);
    setHasTorch(false);

    try {
      const container = document.getElementById(containerId);
      if (!container) return;

      // Clean up previous instance if any
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          scannerRef.current.clear();
        } catch (e) {}
        scannerRef.current = null;
      }

      const html5QrCode = new Html5Qrcode(containerId, {
        formatsToSupport: SUPPORTED_FORMATS,
        verbose: false,
      });
      scannerRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          return {
            width: Math.min(Math.floor(minEdge * 0.9), 320),
            height: Math.min(Math.floor(minEdge * 0.65), 200),
          };
        },
        aspectRatio: 1.333333,
      };

      await html5QrCode.start(
        { facingMode: { ideal: "environment" } },
        config,
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        () => {
          // Frame without barcode - expected while searching
        }
      );

      setIsScanning(true);

      // Check torch capability
      try {
        const capabilities = html5QrCode.getRunningTrackCameraCapabilities();
        if (capabilities?.torchFeature()?.isSupported()) {
          setHasTorch(true);
        }
      } catch (e) {}
    } catch (err) {
      console.warn("Live camera start failed:", err);
      setIsScanning(false);

      if (err.name === "NotAllowedError" || String(err).includes("NotAllowedError") || String(err).includes("Permission")) {
        setError("Camera permission was denied. Please allow camera access in your browser, or use the 'Snap Barcode Photo' button below.");
      } else if (!window.isSecureContext && window.location.hostname !== "localhost") {
        setError("Mobile browsers require HTTPS or secure connections for live camera streaming. You can snap a photo with your camera instead!");
      } else {
        setError("Could not activate live camera stream. You can snap a photo with your phone camera or enter the code manually.");
      }
    }
  };

  const stopScanner = async () => {
    setIsScanning(false);
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        console.warn("Error stopping scanner:", e);
      }
      scannerRef.current = null;
    }
  };

  const toggleTorch = async () => {
    if (!scannerRef.current || !isScanning) return;
    try {
      const nextState = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch (e) {
      console.warn("Failed to toggle flashlight:", e);
    }
  };

  const handleFileCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanningFile(true);
    setError(null);

    try {
      // Temporarily stop live stream if running to release engine
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }

      let scanner = scannerRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode(containerId, {
          formatsToSupport: SUPPORTED_FORMATS,
          verbose: false,
        });
        scannerRef.current = scanner;
      }

      const decodedText = await scanner.scanFile(file, true);
      if (decodedText) {
        handleScanSuccess(decodedText);
        return;
      }
    } catch (err) {
      console.warn("File scan error:", err);
      setError("Could not detect a clear barcode from that photo. Make sure the barcode or IMEI is sharp and well-lit, or type it below.");
    } finally {
      setScanningFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const code = manualCode.trim();
    if (code) {
      handleScanSuccess(code);
      setManualCode("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-white rounded-3xl p-5 sm:p-6 max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold text-[#111111] flex items-center gap-2">
              <Camera size={19} className="text-[#FF9000]" /> {title}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="mt-2 space-y-3.5">
          {/* Viewport for live HTML5 QR/Barcode video */}
          <div className="relative w-full min-h-[250px] bg-neutral-950 rounded-2xl overflow-hidden flex flex-col items-center justify-center border border-neutral-800">
            <div id={containerId} className="w-full h-full min-h-[250px] flex items-center justify-center [&_video]:w-full [&_video]:h-full [&_video]:object-cover" />

            {/* Target Reticle Overlay shown while live scanning */}
            {isScanning && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-36 border-2 border-[#FF9000] rounded-xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] flex items-center justify-center">
                  <div className="w-full h-0.5 bg-[#FF9000] animate-pulse" />
                  <span className="absolute -bottom-6 text-[10px] text-white/80 font-medium tracking-wide">
                    ALIGN BARCODE OR IMEI
                  </span>
                </div>
              </div>
            )}

            {/* Torch Button if supported by device */}
            {hasTorch && isScanning && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`absolute top-3 right-3 p-2.5 rounded-full z-10 cursor-pointer border-none shadow-md transition-colors ${
                  torchOn ? "bg-amber-400 text-neutral-900" : "bg-neutral-800/80 text-white hover:bg-neutral-700"
                }`}
                title={torchOn ? "Turn off torch" : "Turn on torch"}
              >
                <Flashlight size={17} />
              </button>
            )}

            {/* Scanning File / Photo Spinner */}
            {scanningFile && (
              <div className="absolute inset-0 bg-neutral-950/90 flex flex-col items-center justify-center p-4 z-20 text-white">
                <RefreshCw size={28} className="animate-spin text-[#FF9000] mb-2" />
                <p className="text-xs font-medium text-neutral-200">Decoding photo…</p>
              </div>
            )}

            {/* Error or Fallback Message */}
            {error && (
              <div className="absolute inset-0 bg-neutral-950/95 flex flex-col items-center justify-center p-5 text-center text-white z-20">
                <AlertCircle size={28} className="text-amber-400 mb-2 shrink-0" />
                <p className="text-xs text-neutral-300 max-w-xs leading-relaxed">{error}</p>
                <button
                  type="button"
                  onClick={startLiveScanner}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium cursor-pointer border border-neutral-700"
                >
                  <RefreshCw size={12} /> Retry Camera
                </button>
              </div>
            )}
          </div>

          {/* Quick Action: Take Photo with Phone Camera (Instant Universal Fallback) */}
          <div className="flex flex-col gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              capture="environment"
              onChange={handleFileCapture}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={scanningFile}
              className="w-full h-11 px-4 rounded-xl border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-800 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm disabled:opacity-50"
            >
              <Camera size={16} className="text-[#FF9000]" />
              Snap Photo with Phone Camera / Upload Image
            </button>
          </div>

          {isHttpNotice && (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-tight">
              💡 <strong>Tip for Phones:</strong> If live video is blocked over local Wi-Fi, tap <strong>Snap Photo with Phone Camera</strong> above to scan instantly with your phone's native camera!
            </div>
          )}

          <p className="text-[11px] text-center text-neutral-400">
            Works with Phone IMEIs, Serial Numbers, Code 128, QR Codes & EAN/UPC barcodes.
          </p>

          {/* Manual Input Fallback */}
          <form onSubmit={handleManualSubmit} className="pt-2 border-t border-neutral-100 flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Or type/paste barcode or IMEI…"
              className="flex-1 h-10 rounded-xl border border-neutral-200 px-3 text-xs focus:outline-none focus:border-[#FF9000]"
            />
            <button
              type="submit"
              className="h-10 px-4 rounded-xl bg-[#111111] text-white text-xs font-semibold hover:bg-neutral-800 cursor-pointer border-none shrink-0"
            >
              Enter
            </button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
