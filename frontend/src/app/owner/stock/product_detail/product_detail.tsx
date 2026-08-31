import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { Download, Printer, X, Loader2 } from "lucide-react";

import Heading from "../../../../components/elements/heading";
import Breadcrumb from "../../../../components/elements/breadcrumb";
import Button from "../../../../components/elements/button";
import VariantCodeBadge from "../../../../components/elements/variant_code_badge";
import { Card, CardHeader, CardTitle, CardContent } from "../../../../components/elements/card";
import { getProductById } from "../../../../service/http/wms/product";
import type { StockItem } from "../../../../interface/wms/product";
import { cn } from "../../../../utils/component";

// รูปแบบการแสดงบาร์โค้ด: รูปเปล่าตามที่ backend สร้างไว้ / รูป+ราคา / ชื่อ+ราคา+รูป (ป้ายราคาเต็ม)
type BarcodeDisplayMode = "plain" | "price" | "full";
const BARCODE_MODE_LABEL: Record<BarcodeDisplayMode, string> = {
  plain: "รูปเปล่า",
  price: "รูป + ราคา",
  full: "ชื่อ + ราคา + รูป",
};

// ฟอนต์เดียวกับที่ใช้ทั้งเว็บ (ดู --font-sans ใน src/index.css)
const LABEL_FONT = `"Kanit", "Sarabun", "Inter", sans-serif`;

// ย่อขนาดฟอนต์ให้พอดีความกว้างที่กำหนด ถ้าย่อถึงขนาดต่ำสุดแล้วยังไม่พอ ให้ตัดจบด้วย "…"
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  baseSize: number,
  minSize: number,
  weight = 700
): string {
  let size = baseSize;
  ctx.font = `${weight} ${size}px ${LABEL_FONT}`;
  while (ctx.measureText(text).width > maxWidth && size > minSize) {
    size -= 1;
    ctx.font = `${weight} ${size}px ${LABEL_FONT}`;
  }
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 1 && ctx.measureText(`${truncated}…`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}…`;
}

// วาดสี่เหลี่ยมมุมโค้ง (ใช้เป็นกรอบป้ายราคา)
function traceRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // ที่มาของการเข้าหน้านี้ (ถ้ามี) — ใช้ปรับเกล็ดขนมปังให้ตรงกับหน้าที่กดเข้ามาจริงๆ เช่นจากหน้า "การเคลื่อนไหวของคลังสินค้า"
  const location = useLocation();
  const cameFromMovement = (location.state as { from?: string } | null)?.from === "movement";

  const [product, setProduct] = useState<StockItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<"barcode" | "qr" | "image" | null>(null);
  const [barcodeMode, setBarcodeMode] = useState<BarcodeDisplayMode>("full");

  useEffect(() => {
    if (!id) return;
    let alive = true;

    const loadProduct = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getProductById(id);
        if (alive) setProduct(data);
      } catch (err) {
        console.error("Failed to load product:", err);
        if (alive) setError("ไม่พบข้อมูลสินค้า หรือไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
      } finally {
        if (alive) setLoading(false);
      }
    };

    loadProduct();
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] w-full flex-col items-center justify-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-[#B70011]" />
        <span className="text-sm font-medium text-slate-400">กำลังโหลดข้อมูลสินค้า...</span>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="space-y-4 p-8 text-center">
        <p className="font-bold text-slate-500">{error || "ไม่พบข้อมูลสินค้าที่คุณระบุ"}</p>
        <Button onClick={() => navigate("/owner/stock")} variant="outline">
          กลับหน้าคลังสินค้า
        </Button>
      </div>
    );
  }

  // Logic for barcode image URL
  const code = product.Barcode || product.ProductCode || "";
  const sanitizedCode = code.replace(/[^a-zA-Z0-9_\-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const baseName = `prod_${String(product.ID).padStart(6, "0")}_${sanitizedCode}`;
  const barcodeImgUrl = `/barcode/${baseName}.png`;

  // Content for QR code
  const qrPayload = `${window.location.origin}/product/${product.ID}`;

  const isLowStock = product.Stock <= product.MinStock;

  // ประกอบเป็น "ป้ายราคา" แบบที่ใช้จริงหน้าร้าน ด้วยฟอนต์เดียวกับที่ใช้ทั้งเว็บ
  // mode "price": มีแค่ราคา (กึ่งกลางด้านบน) + รูปบาร์โค้ด
  // mode "full": ชื่อ+รหัสสินค้ามุมซ้ายบน, ราคามุมขวาบน, รูปบาร์โค้ดกึ่งกลางด้านล่าง
  const buildBarcodeLabelDataUrl = async (mode: "price" | "full"): Promise<string> => {
    // รอให้ฟอนต์ Kanit โหลดเสร็จก่อน ไม่งั้น canvas จะ fallback ไปฟอนต์ default ของเบราว์เซอร์
    try {
      await document.fonts.load(`700 18px ${LABEL_FONT}`);
      await document.fonts.ready;
    } catch {
      // ไม่มี Font Loading API ก็วาดต่อได้ แค่ฟอนต์อาจไม่ตรง
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas is not supported");

          const padding = 20;
          const canvasWidth = 360;
          const headerHeight = 46;
          const headerGap = 16;
          const barcodeInset = 2; // ขอบรูปบาร์โค้ดแคบกว่า padding ของหัวป้าย เพื่อให้ตัวรูปใหญ่ขึ้นโดยไม่ขยายทั้งป้าย
          const maxBarcodeHeight = 220;

          // ขนาดรูปบาร์โค้ด: เต็มความกว้างที่เหลือ (โดยใช้ inset ของตัวเอง) แต่ไม่สูงเกินไป
          let barcodeWidth = canvasWidth - barcodeInset * 2;
          let barcodeHeight = (img.naturalHeight / img.naturalWidth) * barcodeWidth;
          if (barcodeHeight > maxBarcodeHeight) {
            const scale = maxBarcodeHeight / barcodeHeight;
            barcodeWidth *= scale;
            barcodeHeight = maxBarcodeHeight;
          }

          canvas.width = canvasWidth;
          canvas.height = padding + headerHeight + headerGap + barcodeHeight + padding;

          // พื้นหลัง + กรอบมุมโค้ง
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          traceRoundedRect(ctx, 1, 1, canvas.width - 2, canvas.height - 2, 14);
          ctx.strokeStyle = "#e2e8f0";
          ctx.lineWidth = 2;
          ctx.stroke();

          const priceText = product?.Price != null ? `฿${product.Price.toLocaleString()}` : "-";

          if (mode === "full") {
            // ราคา (มุมขวาบน) — วัดขนาดก่อนเพื่อกันชื่อสินค้าชนราคา
            ctx.font = `700 22px ${LABEL_FONT}`;
            const priceWidth = ctx.measureText(priceText).width;

            // ชื่อสินค้า + รหัสสินค้า (มุมซ้ายบน)
            const nameMaxWidth = canvas.width - padding * 2 - priceWidth - 16;
            const nameText = fitText(ctx, product?.Name || "", nameMaxWidth, 16, 11, 700);
            const skuText = fitText(ctx, product?.ProductCode || "", nameMaxWidth, 12, 9, 500);

            ctx.textAlign = "left";
            ctx.fillStyle = "#0f172a";
            ctx.font = `700 16px ${LABEL_FONT}`;
            ctx.fillText(nameText, padding, padding + 16);

            ctx.fillStyle = "#94a3b8";
            ctx.font = `500 12px ${LABEL_FONT}`;
            ctx.fillText(skuText, padding, padding + 34);

            ctx.textAlign = "right";
            ctx.fillStyle = "#0f172a";
            ctx.font = `700 22px ${LABEL_FONT}`;
            ctx.fillText(priceText, canvas.width - padding, padding + 22);
          } else {
            // ราคาเดี่ยว กึ่งกลางด้านบน (ไม่มีชื่อ/รหัสสินค้า)
            ctx.textAlign = "center";
            ctx.fillStyle = "#0f172a";
            ctx.font = `700 24px ${LABEL_FONT}`;
            ctx.fillText(priceText, canvas.width / 2, padding + headerHeight / 2 + 8);
          }

          // รูปบาร์โค้ด (กึ่งกลาง)
          const y = padding + headerHeight + headerGap;
          const barcodeX = (canvas.width - barcodeWidth) / 2;
          ctx.drawImage(img, barcodeX, y, barcodeWidth, barcodeHeight);

          resolve(canvas.toDataURL("image/png"));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error("Failed to load barcode image"));
      img.src = barcodeImgUrl;
    });
  };

  // mode "plain": ใช้ไฟล์รูปบาร์โค้ดจาก backend ตรงๆ ไม่ผ่าน canvas เลย (เหมือนต้นฉบับทุกจุด)
  const handleDownloadBarcode = async () => {
    try {
      if (barcodeMode === "plain") {
        const res = await fetch(barcodeImgUrl);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `barcode_${code}.png`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
      const dataUrl = await buildBarcodeLabelDataUrl(barcodeMode);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `barcode_${code}.png`;
      a.click();
    } catch (err) {
      console.error("Failed to download barcode", err);
    }
  };

  const handlePrintBarcode = async () => {
    try {
      const src = barcodeMode === "plain" ? barcodeImgUrl : await buildBarcodeLabelDataUrl(barcodeMode);
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        // title เป็นค่าว่าง กัน browser เอาไปโชว์เป็นหัวกระดาษตอนพิมพ์ ("Print Barcode")
        // ส่วนวันที่/URL/เลขหน้าที่เห็นตอนพรีวิวพิมพ์เป็น header-footer ของตัว browser เอง แก้จากโค้ดหน้าเว็บไม่ได้
        // ผู้ใช้ต้องปิดเองที่ "ตั้งค่าเพิ่มเติม > ส่วนหัวและส่วนท้าย" ในหน้าต่างพิมพ์
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
              <img src="${src}" onload="window.print();window.close();" />
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    } catch (err) {
      console.error("Failed to print barcode", err);
    }
  };

  const handleDownloadQR = () => {
    const canvas = document.getElementById("qr-canvas") as HTMLCanvasElement;
    if (canvas) {
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `qrcode_${code}.png`;
      a.click();
    }
  };

  const handlePrintQR = () => {
    const canvas = document.getElementById("qr-canvas") as HTMLCanvasElement;
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

  return (
    <div className="min-h-screen space-y-6 bg-gray-50 p-8 font-sans">
      <Breadcrumb
        items={
          // สินค้าที่ถูกลบไว้ (ดูได้ทางเดียวคือกด "ดูรายละเอียด" จากหน้าถังขยะ) ให้ breadcrumb ไล่ผ่านถังขยะด้วย
          product.DeletedAt
            ? [
                { label: "คลังสินค้า", path: "/owner/stock" },
                { label: "ถังขยะสินค้า", path: "/owner/stock/trash" },
                { label: product.Name || "รายละเอียดสินค้า" },
              ]
            : cameFromMovement
              ? [
                  { label: "การเคลื่อนไหวของคลังสินค้า", path: "/owner/stock/stock-movement" },
                  { label: product.Name || "รายละเอียดสินค้า" },
                ]
              : [
                  { label: "คลังสินค้า", path: "/owner/stock" },
                  { label: product.Name || "รายละเอียดสินค้า" },
                ]
        }
      />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <Heading level="h2" weight="semibold" className="mb-0 text-gray-800">
            รายละเอียดสินค้า
          </Heading>
          <Heading level="h6" weight="light" className="m-0 mt-1 text-slate-500">
            รหัสสินค้า: {product.ProductCode}
          </Heading>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${
            isLowStock
              ? "border-red-100 bg-red-50 text-red-600"
              : "border-emerald-100 bg-emerald-50 text-emerald-600"
          }`}
        >
          {isLowStock ? "สต๊อกต่ำกว่ากำหนด" : "สต๊อกปกติ"}
        </span>
      </div>

      {/* Grid Layout */}
      <div className="flex flex-col items-stretch gap-6 lg:flex-row">
        {/* Left Side: Main Info */}
        <div className="flex w-full flex-col gap-6 lg:w-2/3">
          <Card className="border-l-[5px] border-l-red-800">
            <CardHeader>
              <CardTitle className="text-lg">ข้อมูลสินค้า</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-4">
                {product.ThumbnailUrl ? (
                  <img
                    src={product.ThumbnailUrl}
                    alt={product.Name}
                    onClick={() => setLightbox("image")}
                    className="h-24 w-24 shrink-0 cursor-zoom-in rounded-md border border-slate-200 object-cover transition hover:opacity-80"
                  />
                ) : (
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-100 text-slate-400">
                    ไม่มีรูป
                  </div>
                )}

                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-800">{product.Name}</h3>
                  <p className="mb-2 text-sm text-slate-500">รหัสสินค้า: {product.ProductCode}</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <span className="text-slate-400">หมวดหมู่:</span>{" "}
                      <span className="font-medium text-slate-700">{product.Category || "-"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">เกรด:</span>{" "}
                      <span className="font-medium text-slate-700">{product.Grade || "-"}</span>
                    </div>
                    {product.SubCategory && (
                      <div>
                        <span className="text-slate-400">ประเภทย่อย:</span>{" "}
                        <span className="font-medium text-slate-700">{product.SubCategory}</span>
                      </div>
                    )}
                    {product.SubSubCategory && (
                      <div>
                        <span className="text-slate-400">ประเภทย่อยย่อย:</span>{" "}
                        <span className="font-medium text-slate-700">{product.SubSubCategory}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-400">คงเหลือ:</span>{" "}
                      <span className="font-medium text-slate-700">
                        {product.Stock} {product.Unit || "ชิ้น"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">ราคาขาย:</span>{" "}
                      <span className="font-medium text-slate-700">฿{product.Price?.toLocaleString()}</span>
                    </div>
                    {product.Zone && (
                      <div>
                        <span className="text-slate-400">โซน:</span>{" "}
                        <span className="font-medium text-slate-700">{product.Zone}</span>
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
                    {product.Suppliers && product.Suppliers.length > 0 && (
                      <div className="col-span-2">
                        <span className="text-slate-400">ผู้จำหน่าย:</span>
                        <div className="mt-1 flex flex-col gap-1">
                          {product.Suppliers.map((s) => (
                            <div
                              key={s.SupplierID}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-slate-100 bg-slate-50 px-2 py-1"
                            >
                              <div className="min-w-0">
                                <span className="font-medium text-slate-700">{s.SupplierName || `Supplier #${s.SupplierID}`}</span>
                                {s.CompanyProductCode && (
                                  <span className="ml-2 text-xs text-slate-400">รหัส: {s.CompanyProductCode}</span>
                                )}
                              </div>
                              <span className="shrink-0 text-slate-500">
                                {s.Quantity} {product.Unit || "ชิ้น"}
                              </span>
                              {s.VariantCode && (
                                <VariantCodeBadge code={s.VariantCode} label="รหัสล็อตบริษัทนี้" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {product.Note && (
            <Card className="border-l-[5px] border-l-slate-400">
              <CardHeader>
                <CardTitle className="text-lg">หมายเหตุ</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  {product.Note}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Side: Barcode & QR */}
        <div className="flex w-full flex-col gap-6 lg:w-1/3">
          <Card className="border-t-[5px] border-t-red-800">
            <CardHeader>
              <CardTitle className="text-lg">บาร์โค้ดและคิวอาร์โค้ด</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {/* Barcode Section */}
                <div
                  onClick={() => setLightbox("barcode")}
                  className="group flex cursor-zoom-in flex-col items-center rounded-md border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-400 hover:shadow-md"
                >
                  <span className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                    Barcode
                  </span>
                  <img
                    src={barcodeImgUrl}
                    alt="Barcode"
                    className="h-16 object-contain mix-blend-multiply transition group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                      const nextSibling = (e.target as HTMLImageElement).nextElementSibling;
                      if (nextSibling) (nextSibling as HTMLElement).style.display = "block";
                    }}
                  />
                  <div className="mt-2 hidden text-center text-xs text-red-500">
                    ไม่พบรูปภาพบาร์โค้ด
                    <br />
                    (กรุณาสร้างใหม่)
                  </div>
                  <span className="mt-2 text-xs font-bold text-slate-700">{code}</span>
                  <span className="mt-1 text-[10px] text-slate-400 opacity-0 transition group-hover:opacity-100">
                    คลิกเพื่อขยาย
                  </span>
                </div>

                {/* QR Code Section */}
                <div
                  onClick={() => setLightbox("qr")}
                  className="group flex cursor-zoom-in flex-col items-center rounded-md border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-400 hover:shadow-md"
                >
                  <span className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                    QR Code
                  </span>
                  <div className="rounded border border-slate-100 bg-white p-2 shadow-sm transition group-hover:scale-105">
                    <QRCodeSVG value={qrPayload} size={100} level="L" />
                  </div>
                  <span className="mt-2 text-xs font-bold text-slate-700">สแกนเพื่อดูข้อมูล</span>
                  <span className="mt-1 text-[10px] text-slate-400 opacity-0 transition group-hover:opacity-100">
                    คลิกเพื่อขยาย
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─── Lightbox Overlay ─── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative flex flex-col items-center gap-4 rounded-2xl bg-white p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setLightbox(null)}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
            >
              <X className="h-4 w-4" />
            </button>

            {lightbox === "barcode" ? (
              <>
                {/* สลับรูปแบบการแสดงบาร์โค้ด: รูปเปล่า / รูป+ราคา / ชื่อ+ราคา+รูป */}
                <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-xs font-medium">
                  {(Object.keys(BARCODE_MODE_LABEL) as BarcodeDisplayMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setBarcodeMode(m)}
                      className={cn(
                        "rounded-md px-3 py-1.5 transition",
                        barcodeMode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      {BARCODE_MODE_LABEL[m]}
                    </button>
                  ))}
                </div>

                {barcodeMode === "plain" ? (
                  <img
                    src={barcodeImgUrl}
                    alt="Barcode (ขยาย)"
                    className="max-h-72 w-80 object-contain mix-blend-multiply"
                  />
                ) : barcodeMode === "price" ? (
                  <div className="w-80 rounded-xl border border-slate-200 p-5">
                    <p className="text-center text-xl font-bold text-slate-900">
                      {product.Price != null ? `฿${product.Price.toLocaleString()}` : "-"}
                    </p>
                    <div className="-mx-5 mt-4 flex flex-col items-center">
                      <img
                        src={barcodeImgUrl}
                        alt="Barcode (ขยาย)"
                        className="h-56 w-full object-contain mix-blend-multiply"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="w-80 rounded-xl border border-slate-200 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">{product.Name}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-400">{product.ProductCode}</p>
                      </div>
                      <p className="shrink-0 text-xl font-bold text-slate-900">
                        {product.Price != null ? `฿${product.Price.toLocaleString()}` : "-"}
                      </p>
                    </div>
                    <div className="-mx-5 mt-4 flex flex-col items-center">
                      <img
                        src={barcodeImgUrl}
                        alt="Barcode (ขยาย)"
                        className="h-56 w-full object-contain mix-blend-multiply"
                      />
                    </div>
                  </div>
                )}
              </>
            ) : lightbox === "qr" ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">QR Code</p>
                <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-inner">
                  <QRCodeCanvas id="qr-canvas" value={qrPayload} size={320} level="H" includeMargin />
                </div>
                <p className="text-base font-bold text-slate-700">สแกนเพื่อดูข้อมูลสินค้า</p>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">รูปสินค้า</p>
                <img
                  src={product.ThumbnailUrl}
                  alt={product.Name}
                  className="max-h-[70vh] max-w-sm rounded-lg object-contain"
                />
                <p className="text-base font-bold text-slate-700">{product.Name}</p>
              </>
            )}

            {/* Action buttons (Download & Print) — ใช้ได้เฉพาะบาร์โค้ด/คิวอาร์โค้ด */}
            {lightbox !== "image" && (
              <div className="mt-2 flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={lightbox === "barcode" ? handleDownloadBarcode : handleDownloadQR}
                  className="flex items-center gap-2 border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  <Download className="h-4 w-4" />
                  ดาวน์โหลด
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={lightbox === "barcode" ? handlePrintBarcode : handlePrintQR}
                  className="flex items-center gap-2 border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  <Printer className="h-4 w-4" />
                  พิมพ์
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
