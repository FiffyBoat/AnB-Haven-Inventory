import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, AlertCircle, Flashlight, RefreshCw, SwitchCamera, ShieldAlert } from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

// Play a crisp feedback beep on successful barcode scan
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
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  } catch (e) {
    // Ignore audio restrictions
  }
}

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_39,
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
  const [isHttpInsecure, setIsHttpInsecure] = useState(false);

  const [cameras, setCameras] = useState([]);
  const [activeCamIndex, setActiveCamIndex] = useState(0);

  useEffect(() => {
    // Mobile browsers (Safari/Chrome) strictly block live camera over non-localhost HTTP
    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (!window.isSecureContext && !isLocalhost) {
      setIsHttpInsecure(true);
    } else {
      setIsHttpInsecure(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopScanner();
      return;
    }

    // Enumerate cameras and start live video
    let isMounted = true;
    const init = async () => {
      try {
        const deviceList = await Html5Qrcode.getCameras();
        if (isMounted && deviceList && deviceList.length > 0) {
          setCameras(deviceList);
          // Prefer back/rear camera if named
          const backIdx = deviceList.findIndex((c) => /back|rear|environment/i.test(c.label));
          if (backIdx >= 0) {
            setActiveCamIndex(backIdx);
          }
        }
      } catch (e) {
        // Camera permission not yet granted or list unavailable; startLiveScanner handles fallback
      }

      if (isMounted) {
        startLiveScanner();
      }
    };

    const timer = setTimeout(init, 200);

    return () => {
      isMounted = false;
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

  const startLiveScanner = async (overrideCameraId = null) => {
    setError(null);
    setTorchOn(false);
    setHasTorch(false);

    try {
      const container = document.getElementById(containerId);
      if (!container) return;

      // Clean up previous scanner if running
      await stopScanner();

      const html5QrCode = new Html5Qrcode(containerId, {
        formatsToSupport: SUPPORTED_FORMATS,
        verbose: false,
      });
      scannerRef.current = html5QrCode;

      // Select camera source
      let cameraConfig = { facingMode: "environment" };
      if (overrideCameraId) {
        cameraConfig = overrideCameraId;
      } else if (cameras.length > 0 && cameras[activeCamIndex]?.id) {
        cameraConfig = cameras[activeCamIndex].id;
      }

      // Configuration optimized for wide barcodes (IMEIs) & fast frame rate
      const config = {
        fps: 20, // 20 frames/sec for smooth live recognition
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          // Generous wide rectangle so 15-digit IMEI barcodes are never clipped
          return {
            width: Math.min(Math.floor(viewfinderWidth * 0.94), 480),
            height: Math.min(Math.floor(viewfinderHeight * 0.65), 240),
          };
        },
        aspectRatio: 1.333333,
        disableFlip: true,
      };

      await html5QrCode.start(
        cameraConfig,
        config,
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        () => {
          // Normal frame scan tick
        }
      );

      setIsScanning(true);

      // Check for flashlight/torch capability
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
        setError("Camera permission denied. Allow camera access in your browser settings to scan directly.");
      } else if (!window.isSecureContext && window.location.hostname !== "localhost") {
        setError("Live camera streaming is blocked by your mobile browser because this site is loaded over HTTP. Connect via HTTPS to scan directly.");
      } else {
        setError("Could not start live camera feed. Tap 'Switch Lens' or use the Snap Photo button below.");
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
        // Ignored
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
      console.warn("Torch error:", e);
    }
  };

  const switchCameraLens = async () => {
    if (cameras.length <= 1) return;
    const nextIdx = (activeCamIndex + 1) % cameras.length;
    setActiveCamIndex(nextIdx);
    await startLiveScanner(cameras[nextIdx].id);
  };

  const handleFileCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanningFile(true);
    setError(null);

    try {
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
      setError("Could not detect a clear barcode from that photo. Make sure the code is sharp and well-lit.");
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
      <DialogContent className="max-w-md bg-white rounded-3xl p-5 sm:p-6 max-h-[94vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold text-[#111111] flex items-center gap-2">
              <Camera size={19} className="text-[#FF9000]" /> {title}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="mt-2 space-y-3.5">
          {/* Insecure HTTP Warning Banner for phones accessing via local network */}
          {isHttpInsecure && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed flex items-start gap-2.5">
              <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-0.5">Direct live scanning requires HTTPS</p>
                <p className="text-[11px] text-amber-800">
                  Mobile browsers (iPhone Safari & Android Chrome) block continuous camera streaming over unencrypted <code>http://</code>.
                  Use <strong>https://</strong> in your phone browser, or use the Snap Photo button below!
                </p>
              </div>
            </div>
          )}

          {/* Viewport for live HTML5 QR/Barcode video */}
          <div className="relative w-full min-h-[260px] bg-neutral-950 rounded-2xl overflow-hidden flex flex-col items-center justify-center border border-neutral-800">
            <div
              id={containerId}
              className="w-full h-full min-h-[260px] flex items-center justify-center [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
            />

            {/* Target Reticle Overlay shown while live scanning */}
            {isScanning && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[88%] h-36 border-2 border-[#FF9000] rounded-xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] flex items-center justify-center">
                  <div className="w-full h-0.5 bg-[#FF9000] animate-pulse" />
                  <span className="absolute -bottom-6 text-[10px] text-white/90 font-medium tracking-wider bg-black/60 px-2 py-0.5 rounded-full">
                    POINT AT BARCODE OR IMEI
                  </span>
                </div>
              </div>
            )}

            {/* Controls Bar Overlay (Lens switcher & Flashlight) */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
              {cameras.length > 1 && isScanning && (
                <button
                  type="button"
                  onClick={switchCameraLens}
                  className="px-2.5 py-1.5 rounded-full bg-neutral-900/80 text-white hover:bg-neutral-800 text-[11px] font-medium flex items-center gap-1.5 cursor-pointer border border-neutral-700 shadow-md backdrop-blur-sm"
                  title="Switch camera lens"
                >
                  <SwitchCamera size={14} /> Lens ({activeCamIndex + 1}/{cameras.length})
                </button>
              )}

              {hasTorch && isScanning && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`p-2 rounded-full cursor-pointer border-none shadow-md transition-colors ${
                    torchOn ? "bg-amber-400 text-neutral-900" : "bg-neutral-900/80 text-white hover:bg-neutral-800"
                  }`}
                  title={torchOn ? "Turn off torch" : "Turn on torch"}
                >
                  <Flashlight size={15} />
                </button>
              )}
            </div>

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
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => startLiveScanner()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium cursor-pointer border border-neutral-700"
                  >
                    <RefreshCw size={12} /> Retry Direct Stream
                  </button>
                  {cameras.length > 1 && (
                    <button
                      type="button"
                      onClick={switchCameraLens}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium cursor-pointer border border-neutral-700"
                    >
                      <SwitchCamera size={12} /> Switch Lens
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <p className="text-[11px] text-center text-neutral-400">
            Hold your phone steady 10–15 cm from the barcode. Works with Phone IMEIs, Serial Numbers, and standard barcodes.
          </p>

          {/* Fallback button: Snap photo if needed */}
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
              className="w-full h-10 px-4 rounded-xl border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-700 text-xs font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
            >
              <Camera size={15} className="text-neutral-500" />
              Can't get live stream? Snap a photo instead
            </button>
          </div>

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
