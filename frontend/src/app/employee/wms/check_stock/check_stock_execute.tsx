import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronLeft, Loader2, MapPin, Send } from "lucide-react";

import Heading from "../../../../components/elements/heading";
import Badge from "../../../../components/elements/badge";
import Button from "../../../../components/elements/button";
import Input from "../../../../components/elements/input";
import { Card, CardHeader, CardTitle, CardContent } from "../../../../components/elements/card";
import { ToastProvider, useToast } from "../../../../components/elements/toast";
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

function EmployeeCheckStockExecuteContent() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const urlToken = searchParams.get("token");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { products, zones, categories, loading: loadingOptions } = useCheckStockOptions();

  const [schedule, setSchedule] = useState<CheckStockSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ค่านับได้จริงต่อสินค้า (เก็บเป็น string ไว้เพื่อให้ลบ/พิมพ์ช่องว่างได้ระหว่างพิมพ์)
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});

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
  const isOwnSchedule = !schedule || isValidQrToken || schedule.user_id === Number(user?.id);
  // ใช้ user_id ของตารางเป็นคนส่งเมื่อเข้าผ่าน QR token, ไม่งั้นใช้คนที่ล็อกอินอยู่ตามปกติ
  const submitterUserId = isValidQrToken ? schedule?.user_id : Number(user?.id);

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

  const submittedByProduct = useMemo(() => {
    const map = new Map<number, CheckStockRecord>();
    submittedRecords.forEach((r) => map.set(r.product_id, r));
    return map;
  }, [submittedRecords]);

  const countedItems = Object.values(counts).filter((v) => v.trim() !== "").length;
  const allCounted = scheduleProducts.length > 0 && countedItems === scheduleProducts.length;

  const handleSubmit = async () => {
    if (!id || !schedule || !submitterUserId) return;
    if (!allCounted) {
      toast({ variant: "error", message: "กรุณากรอกจำนวนที่นับได้ให้ครบทุกรายการก่อนส่งตรวจสอบ" });
      return;
    }
    const confirmed = window.confirm(
      `ยืนยันส่งผลนับสต็อกทั้ง ${scheduleProducts.length} รายการให้เจ้าของร้านตรวจสอบ? หลังส่งแล้วจะแก้ไขจำนวนไม่ได้จนกว่าเจ้าของร้านจะตีกลับ`
    );
    if (!confirmed) return;

    try {
      setSubmitting(true);
      const now = new Date().toISOString();

      await Promise.all(
        scheduleProducts.map((p) =>
          checkStockRecordService.create({
            old_quantity: p.Stock,
            new_quantity: Number(counts[p.ID] || 0),
            reason: notes[p.ID] || "",
            adjustment_datetime: now,
            product_id: p.ID,
            user_id: submitterUserId,
            check_stock_schedule_id: Number(id),
          })
        )
      );

      await stockCheckService.updateStatus(Number(id), "รอตรวจสอบ");
      toast({ variant: "success", message: "ส่งผลนับสต็อกให้เจ้าของร้านตรวจสอบแล้ว" });
      navigate("/employee/wms/check-stock");
    } catch (err: any) {
      toast({ variant: "error", message: err.response?.data?.error || "ไม่สามารถส่งผลนับสต็อกได้ กรุณาลองใหม่" });
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
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/employee/wms/check-stock")}
            className="cursor-pointer rounded-full p-2 transition-colors hover:bg-slate-200"
          >
            <ChevronLeft size={24} className="text-slate-600" />
          </button>
          <div>
            <Heading level="h2" weight="semibold" className="mb-0 text-gray-800">
              {schedule.target_name || "ตรวจนับสต็อก"}
            </Heading>
            <Heading level="h6" weight="light" className="m-0 mt-1 text-slate-500">
              {dateStr} · {startTimeStr}
              {endTimeStr ? ` - ${endTimeStr}` : ""}
            </Heading>
          </div>
        </div>
        {getStatusBadge(schedule.status)}
      </div>

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
        <CardHeader>
          <CardTitle className="text-lg">รายการสินค้าที่ต้องนับ</CardTitle>
        </CardHeader>
        <CardContent>
          {scheduleProducts.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">ไม่พบข้อมูลสินค้าที่เกี่ยวข้องกับตารางนี้</p>
          ) : (
            <div className="flex flex-col gap-3">
              {scheduleProducts.map((p) => {
                const submitted = submittedByProduct.get(p.ID);
                const countedVal = counts[p.ID] ?? "";
                const diff = countedVal.trim() !== "" ? Number(countedVal) - p.Stock : null;

                return (
                  <div
                    key={p.ID}
                    className="flex flex-col gap-3 rounded-md border border-slate-100 bg-slate-50 p-3 sm:flex-row sm:items-center"
                  >
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

                    {isEditable ? (
                      <div className="flex shrink-0 flex-col gap-2 sm:w-64">
                        <div className="flex items-center gap-2">
                          <div className="text-center text-xs text-slate-400">
                            <p>ในระบบ</p>
                            <p className="text-sm font-semibold text-slate-600">{p.Stock}</p>
                          </div>
                          <Input
                            type="number"
                            min={0}
                            placeholder="นับได้..."
                            value={countedVal}
                            onChange={(e) => setCounts((prev) => ({ ...prev, [p.ID]: e.target.value }))}
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
                            value={notes[p.ID] ?? ""}
                            onChange={(e) => setNotes((prev) => ({ ...prev, [p.ID]: e.target.value }))}
                          />
                        )}
                      </div>
                    ) : (
                      <div className="shrink-0 text-right text-xs text-slate-500">
                        <p>ระบบเดิม: {submitted?.old_quantity ?? p.Stock}</p>
                        <p className="font-semibold text-slate-800">นับได้: {submitted?.new_quantity ?? "-"}</p>
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
