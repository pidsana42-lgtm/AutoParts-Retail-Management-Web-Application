import { X } from "lucide-react";
import type { StockItem } from "../../../../interface/wms/product";

interface ProductQuickViewProps {
  product: StockItem;
  onClose: () => void;
}

// ป๊อปอัพแสดงข้อมูลพื้นฐานของสินค้าแบบเร็วๆ (ไม่พาออกจากฟอร์มที่กำลังกรอกอยู่)
export default function ProductQuickView({ product, onClose }: ProductQuickViewProps) {
  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-3xl bg-white p-12 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
        >
          <X className="h-6 w-6" />
        </button>

        <div className="flex items-start gap-8">
          {product.ThumbnailUrl ? (
            <img
              src={product.ThumbnailUrl}
              alt={product.Name}
              className="h-40 w-40 shrink-0 rounded-2xl border border-slate-200 object-cover"
            />
          ) : (
            <div className="flex h-40 w-40 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-base text-slate-400">
              ไม่มีรูป
            </div>
          )}
          <div className="min-w-0 pt-2">
            <p className="truncate text-3xl font-bold text-slate-900">{product.Name}</p>
            <p className="mt-1 text-xl text-slate-400">{product.ProductCode}</p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 border-t border-slate-100 pt-8 text-lg">
          <div>
            <span className="text-slate-400">หมวดหมู่:</span>{" "}
            <span className="font-medium text-slate-700">{product.Category || "-"}</span>
          </div>
          <div>
            <span className="text-slate-400">เกรด:</span>{" "}
            <span className="font-medium text-slate-700">{product.Grade || "-"}</span>
          </div>
          <div>
            <span className="text-slate-400">คงเหลือ:</span>{" "}
            <span className="font-medium text-slate-700">
              {product.Stock} {product.Unit || "ชิ้น"}
            </span>
          </div>
          <div>
            <span className="text-slate-400">ราคาขาย:</span>{" "}
            <span className="font-medium text-slate-700">฿{product.Price?.toLocaleString() ?? "-"}</span>
          </div>
          {product.PartNo && (
            <div className="col-span-2">
              <span className="text-slate-400">PART NO.:</span>{" "}
              <span className="font-medium text-slate-700">{product.PartNo}</span>
            </div>
          )}
          {product.Shelf && (
            <div className="col-span-2">
              <span className="text-slate-400">พื้นที่จัดเก็บ:</span>{" "}
              <span className="font-medium text-slate-700">
                {product.Shelf} {product.ShelfLevel ? `(ชั้น ${product.ShelfLevel})` : ""}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
