import { useEffect, useRef, useState } from "react";
import Modal from "../../../components/elements/modal";
import Button from "../../../components/elements/button";
import type { StockItem } from "../../../interface/wms/product";
import { QRCodeSVG } from "qrcode.react";
import JsBarcode from "jsbarcode";
import { Building2 } from "lucide-react";

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: StockItem | null;
}

// ตัดอักขระที่ CODE128 เข้ารหัสไม่ได้ (นอกช่วง ASCII พิมพ์ได้ 0x20-0x7E เช่นภาษาไทย) ออกจากค่าที่จะเข้ารหัสเป็น
// แท่งบาร์โค้ดจริง ถ้าตัดแล้วค่าเปลี่ยนไป ต่อท้ายด้วย uniqueSuffix (รหัสสินค้า/บริษัทจากฐานข้อมูล) เพื่อกันสองรหัส
// ที่ต่างกันแค่ส่วนภาษาไทยเหลือค่าเดียวกันหลังตัด — ถ้าตัดแล้วไม่เหลืออะไรเลยก็ใช้ uniqueSuffix ไปตรงๆ
function toBarcodeSafeValue(raw: string, uniqueSuffix: string): string {
  if (!raw) return "";
  const asciiOnly = raw
    .replace(/[^\x20-\x7E]/g, "")
    .trim()
    .replace(/^[-\s]+|[-\s]+$/g, "");
  if (asciiOnly === raw) return raw;
  return asciiOnly ? `${asciiOnly}-${uniqueSuffix}` : uniqueSuffix;
}

export default function ProductDetailModal({ isOpen, onClose, product }: ProductDetailModalProps) {
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | "global">("global");
  const barcodeSvgRef = useRef<SVGSVGElement>(null);

  const currentSupplier =
    selectedSupplierId !== "global"
      ? product?.Suppliers?.find((s) => s.SupplierID === selectedSupplierId)
      : null;

  const code = currentSupplier
    ? (currentSupplier.VariantCode || currentSupplier.Barcode || currentSupplier.CompanyProductCode || product?.ProductCode || "")
    : (product?.ProductCode || "");

  // CODE128 เข้ารหัสได้แค่ตัวอักษร ASCII ที่พิมพ์ได้เท่านั้น — รหัสที่มีภาษาไทยปนอยู่ (เช่นชื่อย่อหมวดหมู่/บริษัท
  // ที่ตั้งเป็นภาษาไทย) จะทำให้ JsBarcode โยน error แล้วกล่องบาร์โค้ดว่างเปล่า จึงต้องเข้ารหัสค่าที่ผ่านการตัด
  // อักขระที่รองรับไม่ได้ออกแล้วเสมอ ส่วนข้อความที่แสดงใต้บาร์โค้ดยังใช้รหัสเดิม (ภาษาไทยได้ปกติ) ผ่าน option `text`
  const barcodeUniqueSuffix = currentSupplier
    ? `P${product?.ID}S${currentSupplier.SupplierID}`
    : `P${product?.ID}`;
  const barcodeValue = toBarcodeSafeValue(code, barcodeUniqueSuffix);

  useEffect(() => {
    if (!barcodeSvgRef.current || !code) return;
    try {
      JsBarcode(barcodeSvgRef.current, barcodeValue, {
        format: "CODE128",
        displayValue: true,
        text: code,
        fontSize: 13,
        margin: 4,
        height: 48,
        width: 1.5,
      });
    } catch (e) {
      console.error("Barcode generation error:", e);
    }
  }, [code, barcodeValue, isOpen, selectedSupplierId]);

  if (!product) return null;

  // Content for QR code
  const qrPayload = currentSupplier
    ? `${window.location.origin}/product/${product.ID}?variant=${currentSupplier.VariantCode || ""}`
    : `${window.location.origin}/product/${product.ID}`;

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
          <h4 className="text-sm font-semibold text-slate-800 mb-3 text-center">รหัสและสแกนเนอร์</h4>
          
          {product.Suppliers && product.Suppliers.length > 0 && (
            <div className="mb-4 max-w-xs mx-auto">
              <label className="mb-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600">
                <Building2 className="h-3.5 w-3.5 text-red-700" />
                เลือกรหัสตามบริษัท / ซัพพลายเออร์:
              </label>
              <select
                value={selectedSupplierId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedSupplierId(val === "global" ? "global" : Number(val));
                }}
                className="w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-800 shadow-sm focus:border-red-500 focus:outline-none"
              >
                <option value="global">รหัสกลางของร้าน ({product.ProductCode})</option>
                {product.Suppliers.map((s) => (
                  <option key={s.SupplierID} value={s.SupplierID}>
                    {s.SupplierName || `Supplier #${s.SupplierID}`} ({s.VariantCode || s.CompanyProductCode || "ไม่มีรหัสล็อต"})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
            {/* Barcode Section */}
            <div className="flex flex-col items-center bg-slate-50 p-4 rounded-md border border-slate-200 min-w-[200px]">
              <span className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">Barcode</span>
              <div className="bg-white p-2 rounded border border-slate-100 shadow-sm flex items-center justify-center">
                <svg ref={barcodeSvgRef} className="max-w-full" />
              </div>
            </div>

            {/* QR Code Section */}
            <div className="flex flex-col items-center bg-slate-50 p-4 rounded-md border border-slate-200 min-w-[200px]">
              <span className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">QR Code</span>
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
