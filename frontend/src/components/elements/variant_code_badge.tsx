import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { QRCodeSVG } from "qrcode.react";

interface VariantCodeBadgeProps {
  code: string;
  label?: string;
}

// VariantCodeBadge: แสดงบาร์โค้ด (CODE128) + QR ของ "รหัสล็อตต่อบริษัท" (variant code)
// เช่น BP-123-SU3 — ใช้พิมพ์ป้ายแปะแยกล็อต เพื่อให้สแกนแล้วรู้ว่าชิ้นนี้มาจากบริษัทไหน
export default function VariantCodeBadge({ code, label }: VariantCodeBadgeProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !code) return;
    try {
      JsBarcode(svgRef.current, code, {
        format: "CODE128",
        displayValue: false,
        margin: 2,
        height: 34,
        width: 1.4,
      });
    } catch {
      // โค้ดมีตัวอักษรที่ CODE128 ไม่รองรับ — ไม่วาดบาร์โค้ด แต่ยังโชว์ QR/ข้อความ
    }
  }, [code]);

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
