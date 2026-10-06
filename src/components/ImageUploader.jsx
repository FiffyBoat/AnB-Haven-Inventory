import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";

export default function ImageUploader({ imageUrl, onUploaded, label = "Product image" }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = () => {
        onUploaded(String(reader.result));
        setUploading(false);
      };
      reader.onerror = () => setUploading(false);
      reader.readAsDataURL(file);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      {label && <label className="text-xs text-neutral-500">{label}</label>}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={pick} />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="mt-1 w-full h-24 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 flex items-center justify-center gap-2 cursor-pointer overflow-hidden border-none relative disabled:opacity-50"
      >
        {imageUrl ? (
          <img src={imageUrl} alt="Product" className="w-full h-full object-cover" />
        ) : uploading ? null : (
          <>
            <ImagePlus size={18} className="text-neutral-400" />
            <span className="text-sm text-neutral-400">Upload a photo</span>
          </>
        )}
        {uploading && <Loader2 size={18} className="text-neutral-400 animate-spin absolute" />}
        {imageUrl && !uploading && (
          <span className="absolute bottom-1 right-1 text-[10px] px-1.5 py-0.5 rounded-full bg-black/60 text-white">Change</span>
        )}
      </button>
    </div>
  );
}
