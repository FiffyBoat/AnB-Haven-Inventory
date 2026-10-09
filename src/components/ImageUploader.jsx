import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";

// Downscale and compress image on client-side to prevent localStorage/IndexedDB quota overflow
function compressImage(file, maxWidth = 600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        // Export as JPEG with 0.8 quality (~30-50KB size)
        const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(compressedDataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

export default function ImageUploader({ imageUrl, onUploaded, label = "Product image" }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      onUploaded(compressed);
    } catch (err) {
      console.error("Image compression error:", err);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeImage = (e) => {
    e.stopPropagation();
    onUploaded("");
  };

  return (
    <div>
      {label && <label className="text-xs text-neutral-500">{label}</label>}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={pick} />
      <div className="relative mt-1">
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="w-full h-24 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 flex items-center justify-center gap-2 cursor-pointer overflow-hidden border-none relative disabled:opacity-50 hover:bg-neutral-100 transition-colors"
        >
          {imageUrl ? (
            <img src={imageUrl} alt="Product" className="w-full h-full object-cover" />
          ) : uploading ? null : (
            <>
              <ImagePlus size={18} className="text-neutral-400" />
              <span className="text-sm text-neutral-400">Upload / take photo</span>
            </>
          )}
          {uploading && <Loader2 size={18} className="text-neutral-400 animate-spin absolute" />}
          {imageUrl && !uploading && (
            <span className="absolute bottom-1 right-1 text-[10px] px-2 py-0.5 rounded-full bg-black/60 text-white font-medium">
              Change
            </span>
          )}
        </button>
        {imageUrl && !uploading && (
          <button
            type="button"
            onClick={removeImage}
            title="Remove photo"
            className="absolute top-1 right-1 p-1 rounded-full bg-red-600/80 hover:bg-red-600 text-white border-none cursor-pointer transition-colors shadow-sm"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
