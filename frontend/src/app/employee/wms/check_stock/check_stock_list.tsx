import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, ClipboardList, Loader2, MapPin, PackageSearch } from "lucide-react";

import Heading from "../../../../components/elements/heading";
import Text from "../../../../components/elements/text";
import { Card } from "../../../../components/elements/card";
import Badge from "../../../../components/elements/badge";
import Button from "../../../../components/elements/button";
import { ToastProvider, useToast } from "../../../../components/elements/toast";
import { useAuth } from "../../../../contexts/AuthContexts";

import { CHECK_STATUS_BADGE_VARIANT, isValidScheduleDate } from "../../../owner/stock/stock_check/checkStockTargets";
import { stockCheckService, type CheckStockSchedule } from "../../../../service/http/wms/stock_check_service";

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

const STATUS_TABS = ["ทั้งหมด", "รอดำเนินการ", "กำลังเช็ค", "รอตรวจสอบ", "เสร็จสิ้น"] as const;

function EmployeeCheckStockListContent() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<CheckStockSchedule[]>([]);
  const [statusTab, setStatusTab] = useState<(typeof STATUS_TABS)[number]>("ทั้งหมด");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        setLoading(true);
        const all = await stockCheckService.getSchedules();
        // แสดงเฉพาะตารางที่มอบหมายให้พนักงานคนที่ล็อกอินอยู่เท่านั้น
        const myId = Number(user?.id);
        const mine = all.filter((sc) => sc.user_id === myId);
        if (alive) setSchedules(mine);
      } catch (err) {
        console.error(err);
        toast({ variant: "error", message: "ไม่สามารถโหลดตารางเช็คสต็อกได้" });
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const filteredSchedules = useMemo(() => {
    const list = statusTab === "ทั้งหมด" ? schedules : schedules.filter((sc) => sc.status === statusTab);
    return [...list].sort((a, b) => new Date(a.scheduled_datetime).getTime() - new Date(b.scheduled_datetime).getTime());
  }, [schedules, statusTab]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ทั้งหมด: schedules.length };
    STATUS_TABS.forEach((t) => {
      if (t !== "ทั้งหมด") c[t] = schedules.filter((sc) => sc.status === t).length;
    });
    return c;
  }, [schedules]);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] w-full flex-col items-center justify-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-[#B70011]" />
        <span className="text-sm font-medium text-slate-400">กำลังโหลดข้อมูล...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-6 bg-gray-50 p-6 font-sans">
      <div>
        <Heading level="h1" className="text-3xl font-bold tracking-tight text-slate-800">
          งานเช็คสต็อกของฉัน
        </Heading>
        <Text variant="muted" className="mt-1 text-sm">
          รายการตารางเช็คสต็อกที่เจ้าของร้านมอบหมายให้คุณ นับสินค้าตามจริงแล้วส่งให้ตรวจสอบก่อนบันทึกลงระบบ
        </Text>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setStatusTab(t)}
            className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              statusTab === t
                ? "border-[#B70011] bg-[#B70011] text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            {t} {counts[t] ? `(${counts[t]})` : ""}
          </button>
        ))}
      </div>

      {/* List */}
      {filteredSchedules.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <PackageSearch className="h-10 w-10 text-slate-300" />
          <p className="font-medium text-slate-500">ไม่มีตารางเช็คสต็อกในหมวดนี้</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredSchedules.map((sc) => {
            const startObj = new Date(sc.scheduled_datetime);
            const hasValidEnd = isValidScheduleDate(sc.scheduled_end_datetime);
            const endObj = hasValidEnd ? new Date(sc.scheduled_end_datetime) : null;
            const dateStr = startObj.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" });
            const startTimeStr = startObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
            const endTimeStr = endObj?.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
            const hasEnded = !!endObj && new Date() > endObj;
            const notStartedYet = sc.status === "รอดำเนินการ";
            const canWork = sc.status === "กำลังเช็ค" && !hasEnded;

            return (
              <Card key={sc.id} className="flex flex-col gap-3 border-l-[5px] border-l-[#B70011] p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {dateStr} · {startTimeStr}
                    {endTimeStr ? ` - ${endTimeStr}` : ""}
                  </div>
                  {getStatusBadge(sc.status)}
                </div>

                <div>
                  <p className="line-clamp-2 font-semibold text-slate-800">{sc.target_name || "-"}</p>
                  <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                    <MapPin className="h-3.5 w-3.5" />
                    {sc.check_type === "LOCATION" ? "ตรวจตามพื้นที่จัดเก็บ" : sc.check_type === "CATEGORY" ? "ตรวจตามหมวดหมู่" : "ตรวจสินค้ารายตัว"}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-sm text-slate-600">
                  <ClipboardList className="h-4 w-4 text-slate-400" />
                  {sc.product_count} รายการที่ต้องนับ
                </div>

                {sc.note && <p className="line-clamp-2 rounded bg-slate-50 p-2 text-xs text-slate-500">{sc.note}</p>}

                <Button
                  onClick={() => navigate(`/employee/wms/check-stock/${sc.id}`)}
                  variant={canWork ? "primary" : "outline"}
                  className="mt-1 w-full"
                >
                  {canWork
                    ? "เริ่มนับสต็อก"
                    : notStartedYet
                      ? "ยังไม่ถึงเวลาเริ่ม"
                      : sc.status === "รอตรวจสอบ"
                        ? "ดูผลที่ส่งไปแล้ว"
                        : sc.status === "เสร็จสิ้น"
                          ? "ดูผลการตรวจ"
                          : "เลยเวลาที่กำหนดแล้ว"}
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function EmployeeCheckStockListPage() {
  return (
    <ToastProvider position="bottom-right">
      <EmployeeCheckStockListContent />
    </ToastProvider>
  );
}
