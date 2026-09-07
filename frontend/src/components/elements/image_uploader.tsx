import { useRef, useState } from "react";
import { ImagePlus, X, UploadCloud } from "lucide-react";
import { cn } from "../../utils/component";

interface ImageUploaderProps {
  preview: string;
  onChange: (file: File) => void;
  onClear: () => void;
  label?: string;
  className?: string;
  variant?: "default" | "document";
}

export default function ImageUploader({
  preview,
  onChange,
  onClear,
  label = "อัปโหลดรูปสินค้า",
  className,
  variant = "default",
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (file: File | null | undefined) => {
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      alert("รองรับเฉพาะ JPG, PNG, WEBP หรือ GIF เท่านั้น");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("ไฟล์รูปภาพต้องไม่เกิน 5MB");
      return;
    }
    onChange(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
    e.target.value = "";
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <p className="text-sm font-medium text-slate-700">{label}</p>
      )}

      {preview ? (
        /* ─── Preview state ─── */
        <div
          className={cn(
            "group relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm",
            className
          )}
          style={{ aspectRatio: "16/7" }}
        >
          <img
            src={preview}
            alt="ตัวอย่างรูปสินค้า"
            className="h-full w-full object-cover transition-all duration-300 group-hover:brightness-50"
          />
          {/* overlay buttons */}
          <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 transition-all duration-300 group-hover:opacity-100">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-2 text-xs font-semibold text-slate-800 shadow backdrop-blur-sm transition hover:scale-105 hover:bg-white"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              เปลี่ยนรูป
            </button>
            <button
              type="button"
              onClick={onClear}
              className="flex items-center gap-1.5 rounded-lg bg-red-500/90 px-3 py-2 text-xs font-semibold text-white shadow backdrop-blur-sm transition hover:scale-105 hover:bg-red-600"
            >
              <X className="h-3.5 w-3.5" />
              ลบรูป
            </button>
          </div>
        </div>
      ) : (
        /* ─── Drop zone state ─── */
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "flex w-full cursor-pointer flex-col items-center justify-center text-center select-none transition-all duration-200",
            variant === "document"
              ? "gap-2 border border-dashed border-[#E7BDB8] bg-white p-8 hover:bg-red-50/20"
              : "gap-3 rounded-xl border-2 border-dashed py-8",
            dragging
              ? "border-red-400 bg-red-50 text-red-500 scale-[1.01]"
              : variant === "document"
                ? "text-[#5B5B5B]"
                : "border-slate-200 bg-slate-50 text-slate-400 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-500",
            className
          )}
        >
          {variant === "document" ? (
            <UploadCloud className={cn("h-10 w-10 stroke-[1.5]", dragging ? "text-red-500" : "text-[#5B5B5B]")} />
          ) : (
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full transition-colors duration-200",
                dragging ? "bg-red-100" : "bg-white shadow-sm"
              )}
            >
              <UploadCloud className={cn("h-6 w-6 transition-colors", dragging ? "text-red-500" : "text-slate-400")} />
            </div>
          )}
          <div>
            <p className={cn("text-sm", variant === "document" ? "font-normal text-[#1C1B1B]" : "font-semibold")}>
              {dragging ? "วางไฟล์ที่นี่เลย!" : "ลากและวางรูปภาพ หรือคลิกเพื่อเลือก"}
            </p>
            <p className={cn("mt-1 text-xs", variant === "document" ? "font-light text-[#5B5B5B]" : "text-slate-400")}>
              JPG, PNG, WEBP, GIF (ขนาดไม่เกิน 5MB)
            </p>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  );
}
