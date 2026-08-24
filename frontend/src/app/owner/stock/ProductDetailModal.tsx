import Modal from "../../../components/elements/modal";
import Button from "../../../components/elements/button";
import type { StockItem } from "../../../interface/wms/product";
import { QRCodeSVG } from "qrcode.react";

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: StockItem | null;
}

export default function ProductDetailModal({ isOpen, onClose, product }: ProductDetailModalProps) {
  if (!product) return null;

  // Logic for barcode image URL
  const code = product.Barcode || product.ProductCode || "";
  const sanitizedCode = code.replace(/[^a-zA-Z0-9_\-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const baseName = `prod_${String(product.ID).padStart(6, "0")}_${sanitizedCode}`;
  const barcodeImgUrl = `/barcode/${baseName}.png`;

  // Content for QR code
  // Creating a URL pointing to the public product page
  const qrPayload = `${window.location.origin}/product/${product.ID}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="รายละเอียดสินค้า"
      description="ข้อมูลสินค้า บาร์โค้ด และ คิวอาร์โค้ด"
      size="md"
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          <div className="flex gap-4 items-start">
            {product.ThumbnailUrl ? (
              <img
                src={product.ThumbnailUrl}
                alt={product.Name}
                className="w-24 h-24 object-cover rounded-md border border-slate-200"
              />
            ) : (
              <div className="w-24 h-24 bg-slate-100 rounded-md flex items-center justify-center text-slate-400 border border-slate-200">
                ไม่มีรูป
              </div>
            )}
            
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-800">{product.Name}</h3>
              <p className="text-sm text-slate-500 mb-2">รหัสสินค้า: {product.ProductCode}</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
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
                  <span className="font-medium text-slate-700">{product.Stock} {product.Unit || "ชิ้น"}</span>
                </div>
                <div>
                  <span className="text-slate-400">ราคาขาย:</span>{" "}
                  <span className="font-medium text-slate-700">฿{product.Price?.toLocaleString()}</span>
                </div>
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
        </div>

        <div className="border-t border-slate-100 pt-6 mt-6">
          <h4 className="text-sm font-semibold text-slate-800 mb-4 text-center">รหัสและสแกนเนอร์</h4>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
            {/* Barcode Section */}
            <div className="flex flex-col items-center bg-slate-50 p-4 rounded-md border border-slate-200 min-w-[200px]">
              <span className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wider">Barcode</span>
              <img 
                src={barcodeImgUrl} 
                alt="Barcode" 
                className="h-16 object-contain mix-blend-multiply"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  const nextSibling = (e.target as HTMLImageElement).nextElementSibling;
                  if (nextSibling) {
                    (nextSibling as HTMLElement).style.display = 'block';
                  }
                }}
              />
              <div className="text-xs text-red-500 text-center hidden mt-2">
                ไม่พบรูปภาพบาร์โค้ด<br/>(กรุณาสร้างใหม่)
              </div>
              <span className="text-xs font-bold text-slate-700 mt-2">{code}</span>
            </div>

            {/* QR Code Section */}
            <div className="flex flex-col items-center bg-slate-50 p-4 rounded-md border border-slate-200 min-w-[200px]">
              <span className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wider">QR Code</span>
              <div className="bg-white p-2 rounded shadow-sm border border-slate-100">
                <QRCodeSVG value={qrPayload} size={100} level="L" />
              </div>
              <span className="text-xs font-bold text-slate-700 mt-2">สแกนเพื่อดูข้อมูล</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100 mt-6">
          <Button type="button" variant="primary" onClick={onClose}>
            ปิด
          </Button>
        </div>
      </div>
    </Modal>
  );
}
