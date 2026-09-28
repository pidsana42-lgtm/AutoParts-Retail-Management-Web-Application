import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { QRCodeSVG } from "qrcode.react";

interface VariantCodeBadgeProps {
  code: string;
  label?: string;
}

// แฮชสั้นๆ (djb2) จากรหัสเต็ม — ใช้เป็นส่วนต่อท้ายกันชนกันตอนตัดอักขระที่ CODE128 ไม่รองรับออกแล้วเหลือค่า
// ซ้ำกันระหว่างสองรหัสที่ต่างกันแค่ส่วนภาษาไทย (คอมโพเนนต์นี้รับแค่ code/label ไม่มี id จากฐานข้อมูลให้ใช้ต่อท้าย)
function shortHash(raw: string): string {
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 33) ^ raw.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

// ตัดอักขระที่ CODE128 เข้ารหัสไม่ได้ (นอกช่วง ASCII พิมพ์ได้ 0x20-0x7E เช่นภาษาไทย) ออกจากค่าที่จะเข้ารหัสเป็น
// แท่งบาร์โค้ดจริง ถ้าตัดแล้วค่าเปลี่ยนไปจากเดิม ต่อท้ายด้วยแฮชของรหัสเต็มกันชนกัน — ถ้าตัดแล้วไม่เหลืออะไรเลย
// ก็ใช้แฮชไปตรงๆ
function toBarcodeSafeValue(raw: string): string {
  if (!raw) return "";
  const asciiOnly = raw
    .replace(/[^\x20-\x7E]/g, "")
    .trim()
    .replace(/^[-\s]+|[-\s]+$/g, "");
  if (asciiOnly === raw) return raw;
  return asciiOnly ? `${asciiOnly}-${shortHash(raw)}` : shortHash(raw);
}

// VariantCodeBadge: แสดงบาร์โค้ด (CODE128) + QR ของ "รหัสล็อตต่อบริษัท" (variant code)
// เช่น BP-123-SU3 — ใช้พิมพ์ป้ายแปะแยกล็อต เพื่อให้สแกนแล้วรู้ว่าชิ้นนี้มาจากบริษัทไหน
export default function VariantCodeBadge({ code, label }: VariantCodeBadgeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const barcodeValue = toBarcodeSafeValue(code);

  useEffect(() => {
    if (!svgRef.current || !code) return;
    try {
      JsBarcode(svgRef.current, barcodeValue, {
        format: "CODE128",
        displayValue: false,
        margin: 2,
        height: 34,
        width: 1.4,
      });
    } catch {
      // ถึงแม้ถูกตัดอักขระที่ไม่รองรับออกแล้วก็ยังเข้ารหัสไม่ได้ (กรณีสุดวิสัย) — ไม่วาดบาร์โค้ด แต่ยังโชว์ QR/ข้อความ
    }
  }, [code, barcodeValue]);

  return (
    <div className="flex items-center gap-2 rounded-sm border border-slate-200 bg-white px-2 py-1">
      <svg ref={svgRef} className="h-[38px]" />
      <QRCodeSVG value={code} size={38} marginSize={0} level="M" />
      <div className="flex flex-col leading-tight">
        <span className="font-mono text-[11px] font-semibold text-slate-700">{code}</span>
        {label && <span className="text-[10px] text-slate-400">{label}</span>}
      </div>
    </div>
  );
}
