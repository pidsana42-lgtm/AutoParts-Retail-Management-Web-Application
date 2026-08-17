import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Loader2, MapPin, Package, ClipboardCheck } from "lucide-react";

import Heading from "../../../../components/elements/heading";
import Badge from "../../../../components/elements/badge";
import Button from "../../../../components/elements/button";
import { Card, CardHeader, CardTitle, CardContent } from "../../../../components/elements/card";
import { ToastProvider, useToast } from "../../../../components/elements/toast";
import ProductQuickView from "./ProductQuickView";
import { useCheckStockOptions } from "./useCheckStockOptions";
import { getScheduleProducts, CHECK_STATUS_BADGE_VARIANT } from "./checkStockTargets";
import {
  stockCheckService,
  checkStockRecordService,
  type CheckStockSchedule,
  type CheckStockRecord,
} from "../../../../service/http/wms/stock_check_service";
import type { StockItem } from "../../../../interface/wms/product";

const CHECK_TYPE_LABEL: Record<CheckStockSchedule["check_type"], string> = {
  LOCATION: "พื้นที่จัดเก็บ (โซน/ชั้นวาง)",
  CATEGORY: "หมวดหมู่สินค้า",
  PRODUCT: "สินค้ารายตัว",
};

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

function ScheduleDetailContent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { products, zones, categories } = useCheckStockOptions();

  const [schedule, setSchedule] = useState<CheckStockSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quickViewProduct, setQuickViewProduct] = useState<StockItem | null>(null);
  const [reviewRecords, setReviewRecords] = useState<CheckStockRecord[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

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
        if (alive) setError("ไม่พบข้อมูลตารางเช็คสต็อก หรือไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
        toast({ variant: "error", message: "ไม่สามารถโหลดข้อมูลตารางเช็คสต็อกได้" });
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ตารางที่พนักงานส่งผลนับมาแล้ว (สถานะ "รอตรวจสอบ") ต้องดึงผลนับจริงมาเทียบให้เจ้าของร้านตัดสินใจ
  useEffect(() => {
    if (!id || !schedule || schedule.status !== "รอตรวจสอบ") return;
    let alive = true;
    checkStockRecordService
      .listBySchedule(Number(id))
      .then((records) => {
        if (alive) setReviewRecords(records);
      })
      .catch((err) => console.error("Failed to load check-stock records:", err));
    return () => {
      alive = false;
    };
  }, [id, schedule?.status]);

  // สินค้าที่ต้องตรวจตามประเภทของตาราง — รียูส getScheduleProducts ตัวเดียวกับหน้ารายการเช็คสต็อก
  const checkedProducts = useMemo((): StockItem[] => {
    if (!schedule) return [];
    return getScheduleProducts(schedule, products, zones, categories);
  }, [schedule, products, zones, categories]);

  const productById = useMemo(() => {
    const map = new Map<number, StockItem>();
    products.forEach((p) => map.set(p.ID, p));
    return map;
  }, [products]);

  const handleApprove = async () => {
    if (!id) return;
    const confirmed = window.confirm(
      "ยืนยันอนุมัติผลนับสต็อกนี้? ระบบจะบันทึกจำนวนที่นับได้เป็นสต็อกจริงของสินค้าทันที"
    );
    if (!confirmed) return;

    try {
      setActionLoading(true);
      await stockCheckService.approveSchedule(Number(id));
      toast({ variant: "success", message: "อนุมัติผลนับสต็อกและบันทึกลงคลังสินค้าสำเร็จ" });
      navigate("/owner/stock/stock-check");
    } catch (err: any) {
      toast({ variant: "error", message: err.response?.data?.error || "ไม่สามารถอนุมัติผลนับสต็อกได้" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!id) return;
    const note = window.prompt("ระบุเหตุผลที่ตีกลับให้พนักงานนับใหม่ (ไม่บังคับ):", "") || "";
    const confirmed = window.confirm("ยืนยันตีกลับให้พนักงานนับสต็อกใหม่? ผลนับที่ส่งมาแล้วจะถูกลบทิ้ง");
    if (!confirmed) return;

    try {
      setActionLoading(true);
      await stockCheckService.rejectSchedule(Number(id), note);
      toast({ variant: "success", message: "ตีกลับให้พนักงานนับสต็อกใหม่แล้ว" });
      navigate("/owner/stock/stock-check");
    } catch (err: any) {
      toast({ variant: "error", message: err.response?.data?.error || "ไม่สามารถตีกลับตารางนี้ได้" });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
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
        <p className="font-bold text-slate-500">{error || "ไม่พบข้อมูลตารางเช็คสต็อกที่คุณระบุ"}</p>
        <Button onClick={() => navigate("/owner/stock/stock-check")} variant="outline">
          กลับหน้าตารางเช็คสต็อก
        </Button>
      </div>
    );
  }

  const startObj = new Date(schedule.scheduled_datetime);
  const endObj = schedule.scheduled_end_datetime ? new Date(schedule.scheduled_end_datetime) : null;
  const dateStr = startObj.toLocaleDateString("th-TH", { day: "2-digit", month: "long", year: "numeric" });
  const startTimeStr = startObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  const endTimeStr = endObj?.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  const createdStr = schedule.created_at
    ? new Date(schedule.created_at).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" })
    : "-";

  return (
    <div className="min-h-screen space-y-6 bg-gray-50 p-8 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate("/owner/stock/stock-check")}
            className="cursor-pointer rounded-full p-2 transition-colors hover:bg-slate-200"
          >
            <ChevronLeft size={24} className="text-slate-600" />
          </button>
          <div>
            <Heading level="h2" weight="semibold" className="mb-0 text-gray-800">
              รายละเอียดตารางเช็คสต็อก
            </Heading>
            <Heading level="h6" weight="light" className="m-0 mt-1 text-slate-500">
              {dateStr} · {startTimeStr}
              {endTimeStr ? ` - ${endTimeStr}` : ""}
            </Heading>
          </div>
        </div>
        {getStatusBadge(schedule.status)}
      </div>

      <div className="flex flex-col items-stretch gap-6 lg:flex-row">
        {/* Left: รายชื่อสินค้าที่ต้องตรวจ */}
        <div className="flex w-full flex-col gap-6 lg:w-2/3">
          {schedule.status === "รอตรวจสอบ" ? (
            <Card className="border-l-[5px] border-l-blue-600">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ClipboardCheck className="h-4 w-4 text-blue-500" />
                  ผลนับสต็อกที่พนักงานส่งมา ({reviewRecords.length} รายการ)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reviewRecords.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">กำลังโหลดผลนับสต็อก...</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {reviewRecords.map((rec) => {
                      const p = productById.get(rec.product_id);
                      const diff = rec.diff_quantity;
                      return (
                        <div
                          key={rec.id}
                          className="flex items-center gap-3 rounded-md border border-slate-100 bg-slate-50 p-3"
                        >
                          {p?.ThumbnailUrl ? (
                            <img src={p.ThumbnailUrl} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
                          ) : (
                            <div className="h-12 w-12 shrink-0 rounded-md bg-slate-200" />
                          )}

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-800">{p?.Name || `สินค้า #${rec.product_id}`}</p>
                            <p className="text-xs text-slate-400">{p?.ProductCode}</p>
                            {rec.reason && <p className="mt-0.5 text-xs italic text-slate-500">หมายเหตุ: {rec.reason}</p>}
                          </div>

                          <div className="shrink-0 text-right text-xs text-slate-500">
                            <p>ระบบเดิม: {rec.old_quantity}</p>
                            <p className="font-semibold text-slate-800">นับได้: {rec.new_quantity}</p>
                          </div>

                          <div className="shrink-0">
                            <Badge
                              variant={diff === 0 ? "neutral" : diff > 0 ? "success" : "error"}
                              className={diff === 0 ? "bg-gray-100 text-gray-500" : diff > 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}
                            >
                              {diff > 0 ? `+${diff}` : diff}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-l-[5px] border-l-red-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Package className="h-4 w-4 text-slate-400" />
                  สินค้าที่ต้องตรวจสอบ ({checkedProducts.length} รายการ)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {checkedProducts.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">ไม่พบข้อมูลสินค้าที่เกี่ยวข้องกับตารางนี้</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {checkedProducts.map((p) => (
                      <div
                        key={p.ID}
                        onClick={() => setQuickViewProduct(p)}
                        className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-100 bg-slate-50 p-3 transition hover:border-slate-300 hover:bg-white hover:shadow-sm"
                        title="ดูข้อมูลสินค้า"
                      >
                        {p.ThumbnailUrl ? (
                          <img src={p.ThumbnailUrl} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
                        ) : (
                          <div className="h-12 w-12 shrink-0 rounded-md bg-slate-200" />
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">{p.Name}</p>
                          <p className="text-xs text-slate-400">{p.ProductCode}</p>
                        </div>

                        <div className="hidden shrink-0 flex-col items-start gap-0.5 text-xs text-slate-500 sm:flex">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium">
                            {p.Category || "ทั่วไป"}
                          </span>
                        </div>

                        <div className="hidden shrink-0 items-center gap-1 text-xs text-slate-500 md:flex">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          {p.Shelf ? `${p.Shelf}${p.ShelfLevel ? ` (ชั้น ${p.ShelfLevel})` : ""}` : "-"}
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-sm font-bold text-slate-800">
                            {p.Stock} <span className="font-normal text-slate-400">{p.Unit || "ชิ้น"}</span>
                          </p>
                          <p className="text-xs text-[#B70011]">฿{p.Price?.toLocaleString() ?? "-"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {schedule.status === "รอตรวจสอบ" && (
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={handleApprove} disabled={actionLoading} variant="primary" className="flex-1">
                อนุมัติและบันทึกลงสต็อก
              </Button>
              <Button onClick={handleReject} disabled={actionLoading} variant="outline" className="flex-1">
                ตีกลับให้นับใหม่
              </Button>
            </div>
          )}

          {schedule.note && (
            <Card className="border-l-[5px] border-l-slate-400">
              <CardHeader>
                <CardTitle className="text-lg">หมายเหตุ</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  {schedule.note}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: ข้อมูลตารางเช็ค */}
        <div className="flex w-full flex-col gap-6 lg:w-1/3">
          <Card className="border-t-[5px] border-t-red-800">
            <CardHeader>
              <CardTitle className="text-lg">ข้อมูลตารางเช็ค</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-400">ประเภทการตรวจสอบ</p>
                  <p className="font-medium text-slate-700">{CHECK_TYPE_LABEL[schedule.check_type]}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">เป้าหมายการตรวจ</p>
                  <p className="font-medium text-slate-700">{schedule.target_name || "-"}</p>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                  <div>
                    <p className="text-xs text-slate-400">จำนวนสินค้า</p>
                    <p className="font-medium text-slate-700">{schedule.product_count} ชิ้น</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">พนักงานที่รับมอบหมาย</p>
                    <p className="font-medium text-slate-700">{schedule.user_full_name || "ยังไม่มอบหมาย"}</p>
                  </div>
                </div>
                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs text-slate-400">สร้างตารางเมื่อ</p>
                  <p className="font-medium text-slate-700">{createdStr}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {quickViewProduct && (
        <ProductQuickView product={quickViewProduct} onClose={() => setQuickViewProduct(null)} />
      )}
    </div>
  );
}

export default function ScheduleDetailPage() {
  return (
    <ToastProvider position="bottom-right">
      <ScheduleDetailContent />
    </ToastProvider>
  );
}
