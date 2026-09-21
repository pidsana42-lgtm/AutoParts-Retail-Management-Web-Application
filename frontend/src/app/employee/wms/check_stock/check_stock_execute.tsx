import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Loader2, MapPin, Send, QrCode, Download, Printer, FileDown } from "lucide-react";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

import Heading from "../../../../components/elements/heading";
import Breadcrumb from "../../../../components/elements/breadcrumb";
import Badge from "../../../../components/elements/badge";
import Button from "../../../../components/elements/button";
import Input from "../../../../components/elements/input";
import { Card, CardHeader, CardTitle, CardContent } from "../../../../components/elements/card";
import { ToastProvider, useToast } from "../../../../components/elements/toast";
import { useAlertDialog } from "../../../../components/elements/alert_dialog";
import { useAuth } from "../../../../contexts/AuthContexts";

import { useCheckStockOptions } from "../../../owner/stock/stock_check/useCheckStockOptions";
import { getScheduleProducts, CHECK_STATUS_BADGE_VARIANT, isValidScheduleDate } from "../../../owner/stock/stock_check/checkStockTargets";
import {
  stockCheckService,
  checkStockRecordService,
  type CheckStockSchedule,
  type CheckStockRecord,
} from "../../../../service/http/wms/stock_check_service";
import type { StockItem } from "../../../../interface/wms/product";
import { cn } from "../../../../utils/component";

const STATUS_BADGE_STYLE: Record<string, string> = {
  neutral: "bg-gray-100 text-gray-500",
  error: "bg-red-50 text-red-600",
  info: "bg-blue-50 text-blue-600",
  success: "bg-green-50 text-green-600",
};

function getStatusBadge(status: string) {
  const variant = CHECK_STATUS_BADGE_VARIANT[status] || "neutral";
  return <Badge variant={variant} className={STATUS_BADGE_STYLE[variant]}>• {status}</Badge>;
}

// แถวนับ 1 แถว = 1 (สินค้า, บริษัท) คู่ — สินค้าที่มีมากกว่า 1 บริษัทต้องนับแยกเป็นคนละแถว เพราะตอนอนุมัติต้องรู้ว่า
// จะปรับ Inventory ของบริษัทไหน ไม่ใช่เดา/กระจายสัดส่วนเอาเอง
interface CountRow {
  key: string;
  productId: number;
  supplierId: number | null;
  label: string;
  code?: string;
  systemQty: number;
}

// สร้างแถวนับของสินค้า 1 ตัว — 1 แถวต่อบริษัทที่สินค้านี้รับมาจาก (ใช้บาร์โค้ด/รหัสล็อตที่แยกไว้ต่อบริษัทอยู่แล้ว
// เป็นตัวอ้างอิงให้พนักงานรู้ว่าหน่วยที่ถืออยู่เป็นของบริษัทไหน) ถ้ายอดรวมในระบบ (Stock) มากกว่าผลบวกของทุกบริษัท
// (เช่นยอดเก่าที่ไม่เคยผูกกับ Inventory ไว้) จะมีแถว "ไม่ทราบบริษัท / อื่นๆ" เพิ่มมาดูดซับส่วนต่างนั้นด้วย เพื่อให้
// ยอดนับรวมของทุกแถวยังเทียบกับยอดในระบบได้ตรง — สินค้าที่มีบริษัทเดียว (หรือไม่มีเลย) จะได้แค่ 1 แถว เหมือนเดิม
function buildCountRows(p: StockItem): CountRow[] {
  const suppliers = p.Suppliers || [];
  const rows: CountRow[] = suppliers.map((s) => ({
    key: `${p.ID}:${s.SupplierID}`,
    productId: p.ID,
    supplierId: s.SupplierID,
    label: s.SupplierName,
    code: s.VariantCode || s.Barcode,
    systemQty: s.Quantity,
  }));

  const suppliersTotal = suppliers.reduce((sum, s) => sum + s.Quantity, 0);
  const residual = p.Stock - suppliersTotal;
  if (residual !== 0 || rows.length === 0) {
    rows.push({
      key: `${p.ID}:none`,
      productId: p.ID,
      supplierId: null,
      label: "ไม่ทราบบริษัท / อื่นๆ",
      systemQty: residual,
    });
  }
  return rows;
}

// ช่องกรอกจำนวนนับได้ของ 1 แถว — ใช้ทั้งกรณีสินค้าบริษัทเดียว (showLabel=false, โชว์แบบเดิม) และกรณีแตกแถวตามบริษัท
// (showLabel=true, โชว์ชื่อบริษัท + รหัสล็อต/บาร์โค้ดไว้อ้างอิงกับของจริง)
function CountInput({
  row,
  value,
  note,
  onChange,
  onNoteChange,
  showLabel,
  className,
}: {
  row: CountRow;
  value: string;
  note: string;
  onChange: (v: string) => void;
  onNoteChange: (v: string) => void;
  showLabel?: boolean;
  className?: string;
}) {
  const diff = value.trim() !== "" ? Number(value) - row.systemQty : null;

  return (
    <div className={cn("flex shrink-0 flex-col gap-2", className)}>
      {showLabel && (
        <p className="text-xs font-medium text-slate-600">
          {row.label}
          {row.code && <span className="ml-1.5 font-mono text-slate-400">{row.code}</span>}
        </p>
      )}
      <div className="flex items-center gap-2">
        <div className="text-center text-xs text-slate-400">
          <p>ในระบบ</p>
          <p className="text-sm font-semibold text-slate-600">{row.systemQty}</p>
        </div>
        <Input
          type="number"
          min={0}
          placeholder="นับได้..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          containerClassName="flex-1"
        />
        {diff !== null && diff !== 0 && (
          <span className={`shrink-0 text-xs font-bold ${diff > 0 ? "text-green-600" : "text-red-600"}`}>
            {diff > 0 ? `+${diff}` : diff}
          </span>
        )}
      </div>
      {diff !== null && diff !== 0 && (
        <Input
          placeholder="หมายเหตุ (ถ้ามี) เช่น สินค้าเสียหาย, นับตก..."
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
        />
      )}
    </div>
  );
}

function EmployeeCheckStockExecuteContent() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const urlToken = searchParams.get("token");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { alertDialog, confirmDialog } = useAlertDialog();
  const { user, role } = useAuth() as any;
  const { products, zones, categories, loading: loadingOptions } = useCheckStockOptions();

  const [schedule, setSchedule] = useState<CheckStockSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // ค่านับได้จริงต่อแถว (key ของ CountRow — 1 สินค้าอาจมีหลายแถวถ้ามีหลายบริษัท) เก็บเป็น string ไว้เพื่อให้ลบ/พิมพ์ช่องว่างได้ระหว่างพิมพ์
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  // ผลนับที่ส่งไปแล้ว (โหลดมาแสดงตอนตารางถูกล็อกแล้ว: รอตรวจสอบ / เสร็จสิ้น)
  const [submittedRecords, setSubmittedRecords] = useState<CheckStockRecord[]>([]);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await stockCheckService.getScheduleById(Number(id));
        if (alive) setSchedule(data);
      } catch (err) {
        console.error("Failed to load schedule:", err);
        if (alive) setError("ไม่พบตารางเช็คสต็อก หรือไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [id]);

  // สแกน QR ที่มี token ประจำตารางนี้มาถูกต้อง -> ถือว่าเป็นพนักงานที่ได้รับมอบหมายเลย ไม่ต้องล็อกอินในมือถือก่อน
  const isValidQrToken = !!schedule && !!urlToken && schedule.access_token === urlToken;
  // เจ้าของร้าน/ผู้จัดการเข้าดูได้ทุกตาราง ไม่ว่าจะมอบหมายให้ใครก็ตาม (ไม่ต้องพึ่ง token ก็เข้าได้)
  const currentRole = (role || localStorage.getItem("role") || "").toUpperCase();
  const isOwnerOrManager = currentRole === "OWNER" || currentRole === "MANAGER" || currentRole === "ADMIN";
  const isOwnSchedule = !schedule || isValidQrToken || isOwnerOrManager || schedule.user_id === Number(user?.id);
  // ใช้ user_id ของตารางเป็นคนส่งเมื่อเข้าผ่าน QR token, ไม่งั้นใช้คนที่ล็อกอินอยู่ตามปกติ
  const submitterUserId = isValidQrToken ? schedule?.user_id : Number(user?.id);

  // ให้พนักงานเองเรียกดู QR ของงานนี้ได้ด้วย (ไม่ต้องรอเจ้าของร้านโชว์ให้) เผื่ออยากพิมพ์/ส่งต่อเอง
  // ลิงก์ชี้ไปหน้าแบบไม่มี Sidebar/Navbar ของระบบรวม (/wms/check-stock-scan) เพราะคนสแกนอาจยังไม่ได้ล็อกอิน
  // เอาไว้เข้าหน้าเช็คสินค้าของงานนี้ตรงๆ อย่างเดียว
  const qrPayload =
    id && schedule?.access_token
      ? `${window.location.origin}/wms/check-stock-scan/${id}?token=${schedule.access_token}`
      : "";

  const handleDownloadQR = () => {
    const canvas = document.getElementById("employee-schedule-qr-canvas") as HTMLCanvasElement;
    if (canvas) {
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `check-stock-qr-${id}.png`;
      a.click();
    }
  };

  // สร้างมาร์กอัป (style + เนื้อหา) ของเอกสารรายการตรวจนับสต็อก ใช้ร่วมกันทั้งตอนดาวน์โหลดเป็น PDF (แปะลง DOM
  // ที่ซ่อนไว้แล้วถ่ายภาพด้วย html2canvas) และตอนพิมพ์ (แปะลงหน้าต่างพิมพ์ใหม่แล้วเรียก window.print())
  const buildChecklistMarkup = (footerLabel: string): string => {
    if (!schedule) return "";

    // สินค้าที่มีมากกว่า 1 บริษัท แตกเป็นคนละแถวในเอกสารด้วย (ต่อท้ายชื่อสินค้าด้วยชื่อบริษัทให้รู้ว่าแถวไหนของใคร)
    // เพื่อให้เดินนับแยกตามบาร์โค้ด/รหัสล็อตของแต่ละบริษัทแล้วเขียนกำกับได้ตรงแถว
    const rowsHtml = scheduleProducts
      .flatMap((p) => {
        const productRows = rowsByProduct.get(p.ID) || [];
        const location = p.Shelf ? `${p.Shelf}${p.ShelfLevel ? ` (ชั้น ${p.ShelfLevel})` : ""}` : "-";
        return productRows.map((row) => {
          const submitted = submittedByRow.get(row.key);
          const systemQty = submitted?.old_quantity ?? row.systemQty;
          // มีค่าที่นับ/ส่งไปแล้วก็โชว์เลย ไม่งั้นเว้นช่องว่างไว้ให้เขียนด้วยมือระหว่างเดินนับของจริง
          const countedVal = submitted?.new_quantity ?? counts[row.key] ?? "";
          const noteVal = submitted?.reason ?? notes[row.key] ?? "";
          const nameLabel = productRows.length > 1 ? `${p.Name} — ${row.label}` : p.Name;
          return { productCode: p.ProductCode, nameLabel, location, systemQty, countedVal, noteVal };
        });
      })
      .map(
        (r, idx) => `
          <tr>
            <td class="center muted">${idx + 1}</td>
            <td class="mono">${r.productCode}</td>
            <td class="strong">${r.nameLabel}</td>
            <td class="center"><span class="tag">${r.location}</span></td>
            <td class="center muted">${r.systemQty}</td>
            <td class="center blank">${r.countedVal}</td>
            <td class="blank">${r.noteVal}</td>
          </tr>`
      )
      .join("");

    const dateStr = new Date(schedule.scheduled_datetime).toLocaleDateString("th-TH", { day: "2-digit", month: "long", year: "numeric" });
    const generatedAt = new Date().toLocaleString("th-TH", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

    return `
      <style>
        .checklist-pdf-doc * { box-sizing: border-box; }
        .checklist-pdf-doc {
          font-family: "Sarabun", "Kanit", "Inter", sans-serif;
          padding: 28px 32px;
          color: #111827;
          background: #ffffff;
        }

        /* หัวเอกสาร — เรียบ ทางการ ขาวดำ */
        .checklist-pdf-doc .doc-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          border-bottom: 2px solid #111827;
          padding-bottom: 12px;
          margin-bottom: 18px;
        }
        .checklist-pdf-doc .doc-title { font-family: "Kanit", sans-serif; font-size: 19px; font-weight: 600; margin: 0; }
        .checklist-pdf-doc .doc-subtitle { font-size: 12px; color: #4b5563; margin: 4px 0 0; }

        /* กล่องข้อมูลงาน */
        .checklist-pdf-doc .meta-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          border: 1px solid #d1d5db;
          padding: 12px 16px;
          margin-bottom: 20px;
        }
        .checklist-pdf-doc .meta-grid .full { grid-column: 1 / -1; }
        .checklist-pdf-doc .meta-label { font-size: 10px; color: #6b7280; margin: 0 0 2px; text-transform: uppercase; letter-spacing: 0.03em; }
        .checklist-pdf-doc .meta-value { font-size: 13px; color: #111827; font-weight: 500; margin: 0; }

        .checklist-pdf-doc table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .checklist-pdf-doc thead th {
          background: #f3f4f6;
          color: #111827;
          font-weight: 600;
          text-align: left;
          padding: 9px 10px;
          font-size: 11px;
          letter-spacing: 0.02em;
          border: 1px solid #9ca3af;
        }
        .checklist-pdf-doc tbody td { padding: 9px 10px; border: 1px solid #d1d5db; vertical-align: middle; }

        .checklist-pdf-doc .center { text-align: center; }
        .checklist-pdf-doc .strong { font-weight: 600; }
        .checklist-pdf-doc .muted { color: #6b7280; }
        .checklist-pdf-doc .mono { font-family: "Sarabun", monospace; color: #374151; }
        .checklist-pdf-doc .tag { font-size: 11px; color: #374151; }
        .checklist-pdf-doc .blank { min-width: 70px; border-bottom: 1px dashed #9ca3af !important; }

        .checklist-pdf-doc .footer { margin-top: 20px; font-size: 10px; color: #9ca3af; text-align: right; }

        @page { size: A4; margin: 14mm 16mm; }
        @media print {
          .checklist-pdf-doc { padding: 0; }
          thead { display: table-header-group; } /* ให้หัวตารางซ้ำทุกหน้าเมื่อรายการยาวเกิน 1 หน้า */
        }
      </style>
      <div class="checklist-pdf-doc">
        <div class="doc-header">
          <div>
            <p class="doc-title">รายการตรวจนับสต็อกสินค้า</p>
            <p class="doc-subtitle">${schedule.target_name || "-"}</p>
          </div>
        </div>

        <div class="meta-grid">
          <div>
            <p class="meta-label">วันที่นัดตรวจ</p>
            <p class="meta-value">${dateStr}</p>
          </div>
          <div>
            <p class="meta-label">ผู้รับผิดชอบ</p>
            <p class="meta-value">${schedule.user_full_name || "-"}</p>
          </div>
          <div>
            <p class="meta-label">จำนวนรายการ</p>
            <p class="meta-value">${scheduleProducts.length} รายการ</p>
          </div>
          ${schedule.note ? `<div class="full"><p class="meta-label">หมายเหตุ</p><p class="meta-value">${schedule.note}</p></div>` : ""}
        </div>

        <table>
          <thead>
            <tr>
              <th class="center">#</th>
              <th>รหัสสินค้า</th>
              <th>ชื่อสินค้า</th>
              <th class="center">ตำแหน่งจัดเก็บ</th>
              <th class="center">จำนวนในระบบ</th>
              <th class="center">นับได้จริง</th>
              <th>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || `<tr><td colspan="7" class="center muted">ไม่พบรายการสินค้า</td></tr>`}
          </tbody>
        </table>

        <div class="footer">${footerLabel} ${generatedAt}</div>
      </div>
    `;
  };

  // ดาวน์โหลดเป็นไฟล์ PDF จริงทันทีในคลิกเดียว (ไม่ต้องเปิดหน้าต่างพิมพ์แล้วเลือก "Save as PDF" เอง) — render
  // มาร์กอัปเดียวกันลง DOM ที่ซ่อนไว้นอกจอ แล้วถ่ายภาพด้วย html2canvas (เพราะ jsPDF เปล่าๆ ไม่รองรับฟอนต์ไทยในตัว)
  // ก่อนตัดแปะเป็นหน้า A4 ทีละหน้าใน jsPDF
  const downloadChecklistPdf = async () => {
    if (!schedule) return;
    setGeneratingPdf(true);

    // A4 กว้าง 210mm ที่ 96dpi ~ 794px — ใช้ความกว้างนี้ตอน render กันเลย์เอาต์ผิดสัดส่วนตอนแปะลง PDF จริง
    const pageWidthPx = 794;

    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-10000px";
    container.style.top = "0";
    container.style.width = `${pageWidthPx}px`;
    container.style.background = "#ffffff";
    container.innerHTML = buildChecklistMarkup("ดาวน์โหลดเมื่อ");
    document.body.appendChild(container);

    try {
      // รอให้ฟอนต์ที่ใช้จริงในเอกสารพร้อมก่อนถ่ายภาพ กันตัวอักษรเพี้ยน/ใช้ฟอนต์ default ของเบราว์เซอร์
      await Promise.all([
        document.fonts.load('600 19px "Kanit"'),
        document.fonts.load('500 13px "Sarabun"'),
        document.fonts.load('400 12px "Sarabun"'),
      ]).catch(() => {});
      await document.fonts.ready;

      const canvas = await html2canvas(container, {
        scale: 2, // ความละเอียดสูงกว่าที่แสดงจริง 2 เท่า กันภาพเบลอตอนขยายเต็มหน้า PDF
        backgroundColor: "#ffffff",
        useCORS: true,
        windowWidth: pageWidthPx,
      });

      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      const pageWidthMm = pdf.internal.pageSize.getWidth();
      const pageHeightMm = pdf.internal.pageSize.getHeight();
      const imgHeightMm = (canvas.height / canvas.width) * pageWidthMm;
      const imgData = canvas.toDataURL("image/png");

      // ตัดภาพยาวๆ ทั้งใบเป็นหน้า A4 ทีละหน้า (เผื่อรายการสินค้ายาวเกิน 1 หน้า)
      let heightLeftMm = imgHeightMm;
      let positionMm = 0;
      pdf.addImage(imgData, "PNG", 0, positionMm, pageWidthMm, imgHeightMm);
      heightLeftMm -= pageHeightMm;

      while (heightLeftMm > 0) {
        positionMm = heightLeftMm - imgHeightMm;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, positionMm, pageWidthMm, imgHeightMm);
        heightLeftMm -= pageHeightMm;
      }

      pdf.save(`check-stock-${schedule.id}.pdf`);
    } catch (err) {
      console.error("Failed to generate checklist PDF:", err);
      await alertDialog("ไม่สามารถสร้างไฟล์ PDF ได้ กรุณาลองใหม่");
    } finally {
      document.body.removeChild(container);
      setGeneratingPdf(false);
    }
  };

  // เปิดหน้าต่างพิมพ์ใหม่ด้วยมาร์กอัปเดียวกับที่ใช้สร้าง PDF แล้วเรียก print ของเบราว์เซอร์ — ต่างจากตอนดาวน์โหลด
  // ตรงที่เป็นเอกสารสด (ไม่ใช่รูปที่ถ่ายไว้) และเป็นคนละ document เลยต้องแปะลิงก์ Google Fonts ใหม่เอง
  const printChecklist = () => {
    if (!schedule) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>รายการตรวจนับสต็อก - ${schedule.target_name || "งานเช็คสต็อก"}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&family=Kanit:wght@500;600;700&display=swap" rel="stylesheet">
        </head>
        <body>
          ${buildChecklistMarkup("พิมพ์เมื่อ")}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    // ปิดแท็บที่เปิดไว้เองอัตโนมัติ ทันทีที่ผู้ใช้กด "พิมพ์" หรือ "ยกเลิก" ใน dialog เสร็จ (ไม่ปล่อยแท็บ about:blank
    // ค้างไว้เฉยๆ ให้ผู้ใช้งงว่าใช้ทำอะไรต่อไม่ได้) — ใช้ afterprint แทนการปิดทันทีหลังเรียก print() เพราะ dialog
    // อาจยังไม่ทันเปิดจริงตอนนั้น
    printWindow.onafterprint = () => printWindow.close();
    // รอให้ฟอนต์ Google Fonts โหลดเสร็จก่อนเรียก print กันข้อความกระโดดขนาดหลังสั่งพิมพ์ไปแล้ว
    setTimeout(() => printWindow.print(), 400);
  };

  const handlePrintQR = () => {
    const canvas = document.getElementById("employee-schedule-qr-canvas") as HTMLCanvasElement;
    if (canvas) {
      const url = canvas.toDataURL("image/png");
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title></title>
              <style>
                @page { margin: 0; }
                html, body { margin: 0; padding: 0; height: 100%; }
                body { display: flex; justify-content: center; align-items: center; }
                img { max-width: 100%; max-height: 100%; }
              </style>
            </head>
            <body>
              <img src="${url}" onload="window.print();window.close();" />
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    }
  };

  // "รอดำเนินการ" หมายถึงยังไม่ถึงเวลาเริ่ม (backend คำนวณสถานะนี้แบบไดนามิกจากเวลาเริ่มอยู่แล้ว)
  // ส่วนเวลาสิ้นสุดต้องเช็คเองที่นี่ เพราะ backend ไม่มีการเปลี่ยนสถานะอัตโนมัติตอนหมดเขต
  const now = new Date();
  const hasEnded =
    !!schedule && isValidScheduleDate(schedule.scheduled_end_datetime) && now > new Date(schedule.scheduled_end_datetime);
  const notStartedYet = !!schedule && schedule.status === "รอดำเนินการ";
  const isEditable = !!schedule && schedule.status === "กำลังเช็ค" && !hasEnded;

  useEffect(() => {
    if (!id || !schedule || isEditable) return;
    let alive = true;
    checkStockRecordService
      .listBySchedule(Number(id))
      .then((records) => {
        if (alive) setSubmittedRecords(records);
      })
      .catch((err) => console.error("Failed to load submitted records:", err));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, schedule?.status]);

  const scheduleProducts = useMemo((): StockItem[] => {
    if (!schedule) return [];
    return getScheduleProducts(schedule, products, zones, categories);
  }, [schedule, products, zones, categories]);

  // แถวนับต่อสินค้า — สินค้าที่มีหลายบริษัทจะได้หลายแถว (ดู buildCountRows) เก็บไว้เป็น map กันคำนวณซ้ำหลายที่
  const rowsByProduct = useMemo(() => {
    const map = new Map<number, CountRow[]>();
    scheduleProducts.forEach((p) => map.set(p.ID, buildCountRows(p)));
    return map;
  }, [scheduleProducts]);

  // แถวนับของทุกสินค้ารวมกันเป็นลิสต์เดียว ใช้ตอนส่งข้อมูล (1 แถว = 1 record ที่ยิงไป backend)
  const allRows = useMemo(
    () => scheduleProducts.flatMap((p) => rowsByProduct.get(p.ID) || []),
    [scheduleProducts, rowsByProduct]
  );

  // ผลนับที่ส่งไปแล้ว (โหลดมาแสดงตอนตารางถูกล็อกแล้ว) — key ตาม row.key เดียวกัน (product+supplier) ให้จับคู่ตรงแถว
  const submittedByRow = useMemo(() => {
    const map = new Map<string, CheckStockRecord>();
    submittedRecords.forEach((r) => map.set(`${r.product_id}:${r.supplier_id ?? "none"}`, r));
    return map;
  }, [submittedRecords]);

  // นับแล้ว = สินค้าที่กรอกครบทุกแถว (สินค้าที่มีหลายบริษัทต้องกรอกครบทุกบริษัทถึงจะถือว่านับสินค้านั้นเสร็จ)
  const countedItems = scheduleProducts.filter((p) => {
    const rows = rowsByProduct.get(p.ID) || [];
    return rows.length > 0 && rows.every((r) => (counts[r.key] ?? "").trim() !== "");
  }).length;
  const allCounted = scheduleProducts.length > 0 && countedItems === scheduleProducts.length;

  const handleSubmit = async () => {
    if (!id || !schedule || !submitterUserId) return;
    if (!allCounted) {
      await alertDialog("กรุณากรอกจำนวนที่นับได้ให้ครบทุกรายการก่อนส่งตรวจสอบ");
      return;
    }
    const confirmed = await confirmDialog(
      `ยืนยันส่งผลนับสต็อกทั้ง ${scheduleProducts.length} รายการให้เจ้าของร้านตรวจสอบ? หลังส่งแล้วจะแก้ไขจำนวนไม่ได้จนกว่าเจ้าของร้านจะตีกลับ`,
      { title: "ยืนยันส่งผลนับสต็อก", confirmText: "ส่งตรวจสอบ" }
    );
    if (!confirmed) return;

    try {
      setSubmitting(true);
      const now = new Date().toISOString();

      // 1 แถว (product+supplier) = 1 record — สินค้าที่มีหลายบริษัทจะส่งหลาย record แยกกัน ให้ backend รู้ว่า
      // ต้องปรับ Inventory ของบริษัทไหนตรงๆ ตอนอนุมัติ (ดู buildCountRows/allRows)
      await Promise.all(
        allRows.map((row) =>
          checkStockRecordService.create({
            old_quantity: row.systemQty,
            new_quantity: Number(counts[row.key] || 0),
            reason: notes[row.key] || "",
            adjustment_datetime: now,
            product_id: row.productId,
            supplier_id: row.supplierId ?? undefined,
            user_id: submitterUserId,
            check_stock_schedule_id: Number(id),
          })
        )
      );

      await stockCheckService.updateStatus(Number(id), "รอตรวจสอบ");
      toast({ variant: "success", message: "ส่งผลนับสต็อกให้เจ้าของร้านตรวจสอบแล้ว" });

      if (isValidQrToken) {
        // เข้ามาจากการสแกน QR (อาจยังไม่ได้ล็อกอิน) — โหลดตารางนี้ใหม่แล้วอยู่หน้าเดิม ไม่พาออกไปหน้ารายการที่ต้องล็อกอิน
        const refreshed = await stockCheckService.getScheduleById(Number(id));
        setSchedule(refreshed);
      } else {
        navigate("/employee/wms/check-stock");
      }
    } catch (err: any) {
      await alertDialog(err.response?.data?.error || "ไม่สามารถส่งผลนับสต็อกได้ กรุณาลองใหม่");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || loadingOptions) {
    return (
      <div className="flex h-[calc(100vh-8rem)] w-full flex-col items-center justify-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-[#B70011]" />
        <span className="text-sm font-medium text-slate-400">กำลังโหลดข้อมูล...</span>
      </div>
    );
  }

  if (error || !schedule) {
    return (
      <div className="space-y-4 p-8 text-center">
        <p className="font-bold text-slate-500">{error || "ไม่พบตารางเช็คสต็อกที่คุณระบุ"}</p>
        <Button onClick={() => navigate("/employee/wms/check-stock")} variant="outline">
          กลับหน้ารายการ
        </Button>
      </div>
    );
  }

  if (!isOwnSchedule) {
    return (
      <div className="space-y-4 p-8 text-center">
        <p className="font-bold text-slate-500">ตารางนี้ไม่ได้มอบหมายให้คุณ</p>
        <Button onClick={() => navigate("/employee/wms/check-stock")} variant="outline">
          กลับหน้ารายการ
        </Button>
      </div>
    );
  }

  const startObj = new Date(schedule.scheduled_datetime);
  const endObj = schedule.scheduled_end_datetime ? new Date(schedule.scheduled_end_datetime) : null;
  const dateStr = startObj.toLocaleDateString("th-TH", { day: "2-digit", month: "long", year: "numeric" });
  const startTimeStr = startObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  const endTimeStr = endObj?.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

  return (
    <div className="min-h-screen space-y-6 bg-gray-50 p-6 pb-28 font-sans">
      {/* Breadcrumb: ซ่อนไว้ตอนเข้าผ่านการสแกน QR (หน้าเปล่าไม่มี Sidebar/Navbar) เพราะไม่มีที่ให้ย้อนกลับไปจริงๆ */}
      {!isValidQrToken && (
        <Breadcrumb
          items={[
            { label: "คลังสินค้า", path: "/employee/wms/stock-data" },
            { label: "เช็คสต็อกสินค้า", path: "/employee/wms/check-stock" },
            { label: schedule.target_name || "รายละเอียดงาน" },
          ]}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <Heading level="h2" weight="semibold" className="mb-0 text-gray-800">
            {schedule.target_name || "ตรวจนับสต็อก"}
          </Heading>
          <Heading level="h6" weight="light" className="m-0 mt-1 text-slate-500">
            {dateStr} · {startTimeStr}
            {endTimeStr ? ` - ${endTimeStr}` : ""}
          </Heading>
        </div>
        {getStatusBadge(schedule.status)}
      </div>

      {/* ซ่อน QR เมื่อ: เข้ามาจากการสแกนอยู่แล้ว (ไม่ต้องโชว์ซ้ำในมือถือ), งานเสร็จสิ้นแล้ว, หรือหมดเวลาตรวจแล้ว (QR ใช้ต่อไม่ได้อีก) */}
      {qrPayload && !isValidQrToken && schedule.status !== "เสร็จสิ้น" && !hasEnded && (
        <Card className="border-t-[5px] border-t-blue-600">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <QrCode className="h-4 w-4 text-blue-500" />
              QR Code สำหรับเช็คสต็อกงานนี้
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <QRCodeSVG value={qrPayload} size={140} level="M" />
            </div>
            {/* ตัวจริงไว้ export/print (ซ่อนไว้ ไม่ต้องโชว์ซ้ำ) */}
            <div className="hidden">
              <QRCodeCanvas id="employee-schedule-qr-canvas" value={qrPayload} size={320} level="H" includeMargin />
            </div>
            <p className="text-center text-xs text-slate-400">
              ให้คนอื่นสแกนด้วยมือถือเพื่อเข้าหน้าเช็คสต็อกของงานนี้ได้เลย โดยไม่ต้องล็อกอิน
            </p>
            <div className="flex w-full gap-2 sm:max-w-xs">
              <Button onClick={handleDownloadQR} variant="outline" className="flex flex-1 items-center justify-center gap-1.5">
                <Download className="h-3.5 w-3.5" />
                ดาวน์โหลด
              </Button>
              <Button onClick={handlePrintQR} variant="outline" className="flex flex-1 items-center justify-center gap-1.5">
                <Printer className="h-3.5 w-3.5" />
                พิมพ์
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!isEditable && (
        <Card className="border-l-[5px] border-l-blue-500 bg-blue-50/40">
          <CardContent className="py-4 text-sm text-slate-600">
            {notStartedYet
              ? `ยังไม่ถึงเวลาที่กำหนดให้เริ่มเช็คสต็อก จะเริ่มนับได้ตั้งแต่ ${startTimeStr} น. เป็นต้นไป`
              : schedule.status === "รอตรวจสอบ"
                ? "คุณส่งผลนับสต็อกนี้ไปแล้ว กำลังรอเจ้าของร้านตรวจสอบและอนุมัติ"
                : schedule.status === "เสร็จสิ้น"
                  ? "ตารางนี้ตรวจสอบและบันทึกลงสต็อกเรียบร้อยแล้ว"
                  : hasEnded
                    ? "หมดเวลาที่กำหนดให้ตรวจสอบตารางนี้แล้ว ไม่สามารถส่งผลนับได้อีก กรุณาติดต่อเจ้าของร้านให้ปรับเวลาตารางนี้ใหม่"
                    : "ตารางนี้ยังไม่สามารถนับสต็อกได้ในขณะนี้"}
          </CardContent>
        </Card>
      )}

      {isEditable && (
        <Card className="border-l-[5px] border-l-[#B70011]">
          <CardContent className="flex items-center justify-between py-4 text-sm">
            <span className="text-slate-600">
              นับแล้ว <span className="font-bold text-slate-800">{countedItems}</span> / {scheduleProducts.length} รายการ
            </span>
            {schedule.note && <span className="italic text-slate-400">หมายเหตุ: {schedule.note}</span>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-lg">รายการสินค้าที่ต้องนับ</CardTitle>
          {/* เจ้าของร้านอนุมัติและบันทึกลงสต็อกแล้ว (เสร็จสิ้น) ไม่ต้องโชว์ปุ่มนี้อีก เพราะรายการนับไม่มีความหมายให้พิมพ์ต่อแล้ว */}
          {scheduleProducts.length > 0 && schedule.status !== "เสร็จสิ้น" && (
            <div className="flex shrink-0 items-center gap-2">
              <Button
                onClick={downloadChecklistPdf}
                disabled={generatingPdf}
                variant="outline"
                className="flex items-center gap-1.5"
              >
                {generatingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                ดาวน์โหลด PDF
              </Button>
              <Button onClick={printChecklist} variant="outline" className="flex items-center gap-1.5">
                <Printer className="h-3.5 w-3.5" />
                พิมพ์
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {scheduleProducts.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">ไม่พบข้อมูลสินค้าที่เกี่ยวข้องกับตารางนี้</p>
          ) : (
            <div className="flex flex-col gap-3">
              {scheduleProducts.map((p) => {
                const rows = rowsByProduct.get(p.ID) || [];
                const isMultiRow = rows.length > 1;

                // สรุปยอดรวมทุกแถวของสินค้านี้ ไว้โชว์เทียบกับยอดในระบบตอนมีหลายบริษัท (แต่ละแถวกรอกแยกกัน)
                const totalCounted = rows.reduce((sum, r) => {
                  const v = counts[r.key] ?? "";
                  return v.trim() !== "" ? sum + Number(v) : sum;
                }, 0);
                const allRowsFilled = rows.every((r) => (counts[r.key] ?? "").trim() !== "");
                const totalDiff = allRowsFilled ? totalCounted - p.Stock : null;

                return (
                  <div
                    key={p.ID}
                    className="flex flex-col gap-3 rounded-md border border-slate-100 bg-slate-50 p-3"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="flex flex-1 items-center gap-3">
                        {p.ThumbnailUrl ? (
                          <img src={p.ThumbnailUrl} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
                        ) : (
                          <div className="h-12 w-12 shrink-0 rounded-md bg-slate-200" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">{p.Name}</p>
                          <p className="text-xs text-slate-400">{p.ProductCode}</p>
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                            <MapPin className="h-3 w-3" />
                            {p.Shelf ? `${p.Shelf}${p.ShelfLevel ? ` (ชั้น ${p.ShelfLevel})` : ""}` : "-"}
                          </div>
                        </div>
                      </div>

                      {/* สินค้าที่มีบริษัทเดียว (หรือไม่มีเลย) ยังกรอกช่องเดียวแบบเดิม ไม่ต้องแยกแถวให้ดูรกเปล่าๆ */}
                      {!isMultiRow &&
                        (isEditable ? (
                          <CountInput
                            row={rows[0]}
                            value={counts[rows[0]?.key] ?? ""}
                            note={notes[rows[0]?.key] ?? ""}
                            onChange={(v) => setCounts((prev) => ({ ...prev, [rows[0].key]: v }))}
                            onNoteChange={(v) => setNotes((prev) => ({ ...prev, [rows[0].key]: v }))}
                            className="sm:w-64"
                          />
                        ) : (
                          <div className="shrink-0 text-right text-xs text-slate-500">
                            <p>ระบบเดิม: {submittedByRow.get(rows[0]?.key)?.old_quantity ?? p.Stock}</p>
                            <p className="font-semibold text-slate-800">นับได้: {submittedByRow.get(rows[0]?.key)?.new_quantity ?? "-"}</p>
                          </div>
                        ))}

                      {/* สินค้าที่มีหลายบริษัท โชว์ยอดรวมของทุกแถวเทียบกับยอดในระบบไว้ที่หัวการ์ด ส่วนช่องกรอกแยกไปอยู่ด้านล่าง */}
                      {isMultiRow && (
                        <div className="shrink-0 text-right text-xs text-slate-400">
                          <p>ในระบบ (รวม): <span className="font-semibold text-slate-600">{p.Stock}</span></p>
                          {isEditable ? (
                            <p>
                              นับได้รวม: <span className="font-semibold text-slate-700">{totalCounted}</span>
                              {totalDiff !== null && totalDiff !== 0 && (
                                <span className={`ml-1 font-bold ${totalDiff > 0 ? "text-green-600" : "text-red-600"}`}>
                                  ({totalDiff > 0 ? `+${totalDiff}` : totalDiff})
                                </span>
                              )}
                            </p>
                          ) : (
                            <p className="font-semibold text-slate-800">
                              นับได้:{" "}
                              {rows.reduce((sum, r) => sum + (submittedByRow.get(r.key)?.new_quantity ?? 0), 0)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* แตกช่องกรอกแยกตามบริษัท — ดูบาร์โค้ด/รหัสล็อตที่ติดอยู่บนของจริงว่าเป็นของบริษัทไหนแล้วนับลงช่องนั้น */}
                    {isMultiRow && (
                      <div className="flex flex-col gap-2 border-t border-slate-200 pt-3 sm:pl-15">
                        {rows.map((row) =>
                          isEditable ? (
                            <CountInput
                              key={row.key}
                              row={row}
                              value={counts[row.key] ?? ""}
                              note={notes[row.key] ?? ""}
                              onChange={(v) => setCounts((prev) => ({ ...prev, [row.key]: v }))}
                              onNoteChange={(v) => setNotes((prev) => ({ ...prev, [row.key]: v }))}
                              showLabel
                            />
                          ) : (
                            <div key={row.key} className="flex items-center justify-between gap-3 text-xs text-slate-500">
                              <span className="font-medium text-slate-600">
                                {row.label}
                                {row.code && <span className="ml-1.5 font-mono text-slate-400">{row.code}</span>}
                              </span>
                              <span>
                                ระบบเดิม: {submittedByRow.get(row.key)?.old_quantity ?? row.systemQty} · นับได้:{" "}
                                <span className="font-semibold text-slate-800">
                                  {submittedByRow.get(row.key)?.new_quantity ?? "-"}
                                </span>
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {isEditable && scheduleProducts.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 p-4 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
            <span className="text-sm text-slate-500">
              นับแล้ว {countedItems} / {scheduleProducts.length} รายการ
            </span>
            <Button onClick={handleSubmit} disabled={submitting || !allCounted} variant="primary" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              {submitting ? "กำลังส่งข้อมูล..." : "ส่งข้อมูลเพื่อตรวจสอบ"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EmployeeCheckStockExecutePage() {
  return (
    <ToastProvider position="bottom-right">
      <EmployeeCheckStockExecuteContent />
    </ToastProvider>
  );
}
