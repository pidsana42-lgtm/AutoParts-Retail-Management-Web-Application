import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import JsBarcode from "jsbarcode";
import { Download, Printer, X, Loader2, Building2 } from "lucide-react";

import Heading from "../../../../components/elements/heading";
import Breadcrumb from "../../../../components/elements/breadcrumb";
import Button from "../../../../components/elements/button";
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

// เรนเดอร์รูปบาร์โค้ดสำหรับดาวน์โหลด/พิมพ์ที่ความละเอียดสูงกว่าที่แสดงจริงกี่เท่า — ป้องกันภาพเบลอ/แตกเป็นบล็อก
// ตอนเบราว์เซอร์ขยายรูป raster เล็กๆ ให้เต็มหน้ากระดาษตอนสั่งพิมพ์ (img { max-width: 100% } ในหน้าต่างพิมพ์)
const PRINT_SCALE = 3;

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

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // ที่มาของการเข้าหน้านี้ (ถ้ามี) — ใช้ปรับเกล็ดขนมปังให้ตรงกับหน้าที่กดเข้ามาจริงๆ เช่นจากหน้า "การเคลื่อนไหวของคลังสินค้า"
  // หรือ "ตรวจสอบสินค้า" (ทั้งกดตรงจากตาราง หรือไล่ผ่านหน้ารายละเอียดตารางเช็คสต็อกมาอีกที ก็ต้องรักษาต้นทางเดิมไว้)
  const location = useLocation();
  const navOrigin = location.state as
    | { from?: string; scheduleId?: number; scheduleName?: string }
    | null;
  const cameFromMovement = navOrigin?.from === "movement";
  const cameFromCheckStock = navOrigin?.from === "check_stock";

  const [product, setProduct] = useState<StockItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<"barcode" | "qr" | "image" | null>(null);
  const [barcodeMode, setBarcodeMode] = useState<BarcodeDisplayMode>("full");
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | "global">("global");

  const cardBarcodeSvgRef = useRef<SVGSVGElement>(null);
  const lightboxBarcodeSvgRef = useRef<SVGSVGElement>(null);

  const currentSupplier =
    selectedSupplierId !== "global"
      ? product?.Suppliers?.find((s) => s.SupplierID === selectedSupplierId)
      : null;

  const code = currentSupplier
    ? (currentSupplier.VariantCode || currentSupplier.Barcode || currentSupplier.CompanyProductCode || product?.ProductCode || "")
    : (product?.ProductCode || "");

  const qrPayload = currentSupplier
    ? `${window.location.origin}/product/${product?.ID || id}?variant=${currentSupplier.VariantCode || ""}`
    : `${window.location.origin}/product/${product?.ID || id}`;

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

  // ตัดตัวเลือก "รหัสกลางของร้าน" ออกแล้ว (ต้องผูกกับบริษัทนำเข้าเสมอ) — พอโหลดสินค้าเสร็จ ให้เลือก Supplier
  // รายแรกให้อัตโนมัติทันที เพื่อให้ dropdown มีค่าที่ตรงกับตัวเลือกจริงเสมอ ไม่ค้างอยู่ที่ "global" ที่ไม่มีในลิสต์แล้ว
  useEffect(() => {
    if (selectedSupplierId !== "global") return;
    const firstSupplier = product?.Suppliers?.[0];
    if (firstSupplier) setSelectedSupplierId(firstSupplier.SupplierID);
  }, [product, selectedSupplierId]);

  useEffect(() => {
    if (!cardBarcodeSvgRef.current || !code) return;
    try {
      JsBarcode(cardBarcodeSvgRef.current, code, {
        format: "CODE128",
        displayValue: false,
        margin: 2,
        height: 48,
        width: 1.6,
      });
    } catch (e) {
      console.error("Barcode generation error:", e);
    }
  }, [code, product, selectedSupplierId]);

  useEffect(() => {
    if (!lightboxBarcodeSvgRef.current || !code || lightbox !== "barcode") return;
    try {
      JsBarcode(lightboxBarcodeSvgRef.current, code, {
        format: "CODE128",
        displayValue: true,
        fontSize: 15,
        margin: 8,
        height: barcodeMode === "plain" ? 80 : 60,
        width: 2,
      });
    } catch (e) {
      console.error("Barcode generation error:", e);
    }
  }, [code, lightbox, barcodeMode, selectedSupplierId]);

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

  const isLowStock = product.Stock <= product.MinStock;

  const getPlainBarcodeDataUrl = (): string => {
    const canvas = document.createElement("canvas");
    try {
      // เรนเดอร์ที่ความละเอียดสูงกว่าที่แสดงจริง (PRINT_SCALE เท่า) กันภาพเบลอ/แตกตอนขยายเต็มหน้าพิมพ์
      // (รูปที่ได้เป็น raster ความละเอียดต่ำ พอเบราว์เซอร์ขยายให้เต็มหน้ากระดาษ A4 จะยิ่งเบลอ)
      JsBarcode(canvas, code, {
        format: "CODE128",
        displayValue: true,
        fontSize: 16 * PRINT_SCALE,
        margin: 10 * PRINT_SCALE,
        height: 80 * PRINT_SCALE,
        width: 2 * PRINT_SCALE,
      });
      return canvas.toDataURL("image/png");
    } catch {
      return "";
    }
  };

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

    const padding = 20;
    const canvasWidth = 360;
    const headerHeight = 46;
    const headerGap = 16;
    const barcodeInset = 2; // ขอบรูปบาร์โค้ดแคบกว่า padding ของหัวป้าย เพื่อให้ตัวรูปใหญ่ขึ้นโดยไม่ขยายทั้งป้าย
    const maxBarcodeHeight = 220;

    // รูปบาร์โค้ดย่อยก็ต้องเรนเดอร์ที่ความละเอียดสูงกว่าเท่ากันด้วย ไม่งั้นตอนวาดขยายลงป้ายที่ใหญ่ขึ้นจะเบลออยู่ดี
    const barcodeCanvas = document.createElement("canvas");
    try {
      JsBarcode(barcodeCanvas, code, {
        format: "CODE128",
        displayValue: true,
        fontSize: 14 * PRINT_SCALE,
        margin: 6 * PRINT_SCALE,
        height: 70 * PRINT_SCALE,
        width: 2 * PRINT_SCALE,
      });
    } catch {
      // fallback
    }

    let barcodeWidth = canvasWidth - barcodeInset * 2;
    let barcodeHeight = (barcodeCanvas.height / (barcodeCanvas.width || 1)) * barcodeWidth;
    if (barcodeHeight > maxBarcodeHeight) {
      const shrink = maxBarcodeHeight / barcodeHeight;
      barcodeWidth *= shrink;
      barcodeHeight = maxBarcodeHeight;
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not supported");

    const canvasHeight = padding + headerHeight + headerGap + barcodeHeight + padding;
    // เรนเดอร์ที่ความละเอียดสูงกว่าที่แสดงจริง (PRINT_SCALE เท่า) กันภาพเบลอตอนขยายเต็มหน้าพิมพ์ — โค้ดวาดด้านล่าง
    // ทั้งหมดยังใช้พิกัด/ขนาดแบบ "ตรรกะ" (เช่น padding, canvasWidth) ได้เหมือนเดิม เพราะ ctx.scale ขยายให้เอง
    canvas.width = canvasWidth * PRINT_SCALE;
    canvas.height = canvasHeight * PRINT_SCALE;
    ctx.scale(PRINT_SCALE, PRINT_SCALE);

    // พื้นหลังขาวล้วน — ไม่ใส่กรอบแล้ว เพราะพิมพ์ออกมาเป็นสติกเกอร์ติดสินค้าจริง ไม่ควรมีกรอบตกแต่งติดมาด้วย
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const priceText = product?.Price != null ? `฿${product.Price.toLocaleString()}` : "-";

    if (mode === "full") {
      // ราคา (มุมขวาบน) — วัดขนาดก่อนเพื่อกันชื่อสินค้าชนราคา
      ctx.font = `700 22px ${LABEL_FONT}`;
      const priceWidth = ctx.measureText(priceText).width;

      // ชื่อสินค้า + รหัสสินค้า (มุมซ้ายบน)
      const nameMaxWidth = canvasWidth - padding * 2 - priceWidth - 16;
      const nameText = fitText(ctx, product?.Name || "", nameMaxWidth, 16, 11, 700);
      const subInfo = currentSupplier 
        ? `${code} • ${currentSupplier.SupplierName || "ผู้จำหน่าย"}`
        : (product?.ProductCode || code);
      const skuText = fitText(ctx, subInfo, nameMaxWidth, 12, 9, 500);

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
      ctx.fillText(priceText, canvasWidth - padding, padding + 22);
    } else {
      // ราคาเดี่ยว กึ่งกลางด้านบน (ไม่มีชื่อ/รหัสสินค้า)
      ctx.textAlign = "center";
      ctx.fillStyle = "#0f172a";
      ctx.font = `700 24px ${LABEL_FONT}`;
      ctx.fillText(priceText, canvasWidth / 2, padding + headerHeight / 2 + 8);
    }

    // รูปบาร์โค้ด (กึ่งกลาง)
    const y = padding + headerHeight + headerGap;
    const barcodeX = (canvasWidth - barcodeWidth) / 2;
    ctx.drawImage(barcodeCanvas, barcodeX, y, barcodeWidth, barcodeHeight);

    return canvas.toDataURL("image/png");
  };

  const handleDownloadBarcode = async () => {
    try {
      const dataUrl = barcodeMode === "plain" ? getPlainBarcodeDataUrl() : await buildBarcodeLabelDataUrl(barcodeMode);
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
      const src = barcodeMode === "plain" ? getPlainBarcodeDataUrl() : await buildBarcodeLabelDataUrl(barcodeMode);
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
            : cameFromMovement || cameFromCheckStock
              ? [
                  cameFromMovement
                    ? { label: "การเคลื่อนไหวของคลังสินค้า", path: "/owner/stock/stock-movement" }
                    : { label: "ตรวจสอบสินค้า", path: "/owner/stock/stock-check" },
                  // เป้าหมายการตรวจสอบ: ชื่อตารางเช็คสต็อกที่กดเข้ามา (ถ้ามี ไม่ว่าจะไล่มาจากหน้าไหนก็ตาม)
                  // ให้ย้อนกลับไปหน้ารายละเอียดตารางนั้นได้ — รักษาต้นทางเดิมไว้แม้กดผ่านหน้ารายละเอียดตารางมาอีกที
                  ...(navOrigin?.scheduleId
                    ? [
                        {
                          label: navOrigin.scheduleName || "เป้าหมายการตรวจสอบ",
                          path: `/owner/stock/stock-check/${navOrigin.scheduleId}`,
                        },
                      ]
                    : []),
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
                        <div className="mt-1.5 flex flex-col gap-1.5">
                          {product.Suppliers.map((s) => {
                            const isSelected = selectedSupplierId === s.SupplierID;
                            return (
                              <div
                                key={s.SupplierID}
                                onClick={() => setSelectedSupplierId(s.SupplierID)}
                                className={cn(
                                  "group/sup flex cursor-pointer items-center justify-between gap-3 rounded-md border p-2.5 transition text-sm",
                                  isSelected
                                    ? "border-red-400 bg-red-50/60 shadow-sm"
                                    : "border-slate-200 bg-slate-50 hover:border-red-300 hover:bg-red-50/20"
                                )}
                                title="คลิกเพื่อเลือกบาร์โค้ดของบริษัทนี้"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-semibold text-slate-800 group-hover/sup:text-red-700">
                                    {s.SupplierName || `Supplier #${s.SupplierID}`}
                                  </span>
                                  {s.CompanyProductCode && (
                                    <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                                      รหัส: {s.CompanyProductCode}
                                    </span>
                                  )}
                                </div>
                                <div className="shrink-0 text-slate-600 text-sm font-medium">
                                  คงเหลือ: <span className="font-bold text-slate-800">{s.Quantity}</span> {product.Unit || "ชิ้น"}
                                </div>
                              </div>
                            );
                          })}
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
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">บาร์โค้ดและคิวอาร์โค้ด</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {/* Supplier Selector Dropdown */}
                {product.Suppliers && product.Suppliers.length > 0 && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2.5">
                    <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                      <Building2 className="h-3.5 w-3.5 text-red-700" />
                      เลือกแสดงรหัสตาม:
                    </label>
                    <select
                      value={selectedSupplierId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedSupplierId(val === "global" ? "global" : Number(val));
                      }}
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 shadow-sm focus:border-red-500 focus:outline-none"
                    >
                          {product.Suppliers.map((s) => (
                        <option key={s.SupplierID} value={s.SupplierID}>
                          {s.SupplierName || `Supplier #${s.SupplierID}`} ({s.VariantCode || s.CompanyProductCode || "ไม่มีรหัสล็อต"})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Barcode Section */}
                <div
                  onClick={() => setLightbox("barcode")}
                  className="group flex cursor-zoom-in flex-col items-center rounded-md border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-400 hover:shadow-md"
                >
                  <div className="mb-2 flex w-full items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                      Barcode
                    </span>
                    {currentSupplier ? (
                      <span className="truncate max-w-[120px] rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-800">
                        {currentSupplier.SupplierName}
                      </span>
                    ) : (
                      <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                        รหัสกลาง
                      </span>
                    )}
                  </div>
                  <div className="rounded border border-slate-100 bg-white p-2 shadow-sm transition group-hover:scale-105 flex items-center justify-center">
                    <svg ref={cardBarcodeSvgRef} className="h-14 max-w-full" />
                  </div>
                  <span className="mt-2 text-xs font-bold text-slate-700">{code}</span>
                  <span className="mt-1 text-[10px] text-slate-400 opacity-0 transition group-hover:opacity-100">
                    คลิกเพื่อขยาย / พิมพ์
                  </span>
                </div>

                {/* QR Code Section */}
                <div
                  onClick={() => setLightbox("qr")}
                  className="group flex cursor-zoom-in flex-col items-center rounded-md border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-400 hover:shadow-md"
                >
                  <div className="mb-2 flex w-full items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                      QR Code
                    </span>
                    {currentSupplier ? (
                      <span className="truncate max-w-[120px] rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-800">
                        {currentSupplier.SupplierName}
                      </span>
                    ) : (
                      <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                        รหัสกลาง
                      </span>
                    )}
                  </div>
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
            className="relative flex flex-col items-center gap-4 rounded-2xl bg-white p-8 shadow-2xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setLightbox(null)}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Supplier Selector in Lightbox */}
            {product.Suppliers && product.Suppliers.length > 0 && (
              <div className="w-full">
                <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <Building2 className="h-3.5 w-3.5 text-red-700" />
                  เลือกรหัสตามบริษัท / ซัพพลายเออร์:
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedSupplierId(val === "global" ? "global" : Number(val));
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 shadow-sm focus:border-red-500 focus:outline-none"
                >
                  {product.Suppliers.map((s) => (
                    <option key={s.SupplierID} value={s.SupplierID}>
                      {s.SupplierName || `Supplier #${s.SupplierID}`} ({s.VariantCode || s.CompanyProductCode || "ไม่มีรหัสล็อต"})
                    </option>
                  ))}
                </select>
              </div>
            )}

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
                  <div className="flex flex-col items-center p-4 bg-white rounded-lg border border-slate-200 w-full">
                    <svg ref={lightboxBarcodeSvgRef} className="max-h-72 w-80" />
                    {currentSupplier && (
                      <span className="mt-2 text-xs font-semibold text-slate-600">
                        {currentSupplier.SupplierName}
                      </span>
                    )}
                  </div>
                ) : barcodeMode === "price" ? (
                  <div className="w-80 rounded-xl border border-slate-200 p-5 bg-white">
                    <p className="text-center text-xl font-bold text-slate-900">
                      {product.Price != null ? `฿${product.Price.toLocaleString()}` : "-"}
                    </p>
                    <div className="-mx-5 mt-4 flex flex-col items-center">
                      <svg ref={lightboxBarcodeSvgRef} className="h-44 w-full" />
                    </div>
                  </div>
                ) : (
                  <div className="w-80 rounded-xl border border-slate-200 p-5 bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">{product.Name}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-400">
                          {currentSupplier ? `${code} (${currentSupplier.SupplierName})` : product.ProductCode}
                        </p>
                      </div>
                      <p className="shrink-0 text-xl font-bold text-slate-900">
                        {product.Price != null ? `฿${product.Price.toLocaleString()}` : "-"}
                      </p>
                    </div>
                    <div className="-mx-5 mt-4 flex flex-col items-center">
                      <svg ref={lightboxBarcodeSvgRef} className="h-44 w-full" />
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
