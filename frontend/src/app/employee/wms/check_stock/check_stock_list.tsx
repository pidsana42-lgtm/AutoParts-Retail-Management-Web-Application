import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, ClipboardList, Loader2, MapPin, PackageSearch } from "lucide-react";

import Heading from "../../../../components/elements/heading";
// import Breadcrumb from "../../../../components/elements/breadcrumb";
import Text from "../../../../components/elements/text";
import { Card } from "../../../../components/elements/card";
import Badge from "../../../../components/elements/badge";
import Button from "../../../../components/elements/button";
import { ToastProvider } from "../../../../components/elements/toast";
import { useAlertDialog } from "../../../../components/elements/alert_dialog";
import { useAuth } from "../../../../contexts/AuthContexts";
import DateRangePicker from "../../../../components/elements/date_range_picker";
import { cn } from "../../../../utils/component";

import { CHECK_STATUS_BADGE_VARIANT, isValidScheduleDate } from "../../../owner/stock/stock_check/checkStockTargets";
import { stockCheckService, type CheckStockSchedule } from "../../../../service/http/wms/stock_check_service";

// พรีเซ็ตช่วงเวลาด่วน (แบบเดียวกับหน้าคลังสินค้า) — กรองตามวันที่กำหนดเช็คสต็อก (scheduled_datetime)
const PERIOD_PRESETS: { label: string; value: string }[] = [
  { label: "วันนี้", value: "daily" },
  { label: "สัปดาห์นี้", value: "weekly" },
  { label: "เดือนนี้", value: "monthly" },
  { label: "ไตรมาสนี้", value: "quarterly" },
  { label: "ปีนี้", value: "yearly" },
];

// คำนวณช่วงวันที่ของพรีเซ็ตฝั่งหน้าเว็บเองตรงๆ — สัปดาห์เริ่มวันจันทร์ตามธรรมเนียมไทย
function getPeriodRange(period: string): { start: Date; end: Date } | null {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (period) {
    case "daily":
      return { start: startOfToday, end: now };
    case "weekly": {
      const daysSinceMonday = (now.getDay() + 6) % 7;
      const start = new Date(startOfToday);
      start.setDate(start.getDate() - daysSinceMonday);
      return { start, end: now };
    }
    case "monthly":
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
    case "quarterly": {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      return { start: new Date(now.getFullYear(), quarterStartMonth, 1), end: now };
    }
    case "yearly":
      return { start: new Date(now.getFullYear(), 0, 1), end: now };
    default:
      return null;
  }
}

// เช็คว่าวันที่กำหนดเช็คสต็อกอยู่ในช่วงเวลาที่ตัวกรองกำหนดไว้หรือไม่ (ช่วงวันที่กำหนดเอง หรือพรีเซ็ตด่วน)
function matchesPeriod(scheduledDatetime: string, startDate: string, endDate: string, selectedPeriod: string): boolean {
  if (!startDate && !endDate && !selectedPeriod) return true;
  const scheduled = new Date(scheduledDatetime);
  if (isNaN(scheduled.getTime())) return false;

  if (startDate || endDate) {
    if (startDate) {
      const s = new Date(startDate);
      s.setHours(0, 0, 0, 0);
      if (scheduled < s) return false;
    }
    if (endDate) {
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      if (scheduled > e) return false;
    }
    return true;
  }

  const range = getPeriodRange(selectedPeriod);
  if (!range) return true;
  return scheduled >= range.start && scheduled <= range.end;
}

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
  const { alertDialog } = useAlertDialog();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<CheckStockSchedule[]>([]);
  const [statusTab, setStatusTab] = useState<(typeof STATUS_TABS)[number]>("ทั้งหมด");
  // ตัวกรองช่วงเวลา — พรีเซ็ตด่วน (selectedPeriod) กับช่วงวันที่กำหนดเอง (startDate/endDate) แยกกันคนละอันเสมอ
  // เลือกอย่างใดอย่างหนึ่งแล้วอีกอันจะถูกล้างทันที (ดู handlePeriodClick/handleStartDateChange/handleEndDateChange)
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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
        // โหลดข้อมูลไม่สำเร็จ = หน้านี้ว่างเปล่าทั้งหน้า ต้องแจ้งเป็นป๊อปอัพให้รับทราบชัดๆ ไม่ใช่ toast ที่มองพลาดง่าย
        if (alive) await alertDialog("ไม่สามารถโหลดตารางเช็คสต็อกได้");
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

  // ตัดตามช่วงเวลาก่อนเสมอ (พรีเซ็ตด่วน/กำหนดเอง) แล้วค่อยแยกตามสถานะที่แท็บเลือกอยู่ต่อ
  const periodFilteredSchedules = useMemo(
    () => schedules.filter((sc) => matchesPeriod(sc.scheduled_datetime, startDate, endDate, selectedPeriod)),
    [schedules, startDate, endDate, selectedPeriod]
  );

  const filteredSchedules = useMemo(() => {
    const list = statusTab === "ทั้งหมด" ? periodFilteredSchedules : periodFilteredSchedules.filter((sc) => sc.status === statusTab);
    return [...list].sort((a, b) => new Date(a.scheduled_datetime).getTime() - new Date(b.scheduled_datetime).getTime());
  }, [periodFilteredSchedules, statusTab]);

  // จำนวนต่อแท็บสถานะ ยึดตามช่วงเวลาที่เลือกไว้เสมอ ให้กดตัวกรองช่วงเวลาแล้วเห็นจำนวนที่ตรงกับช่วงนั้นทันที
  const counts = useMemo(() => {
    const c: Record<string, number> = { ทั้งหมด: periodFilteredSchedules.length };
    STATUS_TABS.forEach((t) => {
      if (t !== "ทั้งหมด") c[t] = periodFilteredSchedules.filter((sc) => sc.status === t).length;
    });
    return c;
  }, [periodFilteredSchedules]);

  // กดพรีเซ็ตช่วงเวลา -> ล้างช่วงวันที่กำหนดเองทิ้ง (สองอย่างนี้แทนกัน เลือกได้ทีละอย่าง)
  const handlePeriodClick = (value: string) => {
    setSelectedPeriod(value);
    setStartDate("");
    setEndDate("");
  };

  // เลือกช่วงวันที่กำหนดเอง -> ล้างพรีเซ็ตทิ้ง
  const handleStartDateChange = (d: string) => {
    setStartDate(d);
    setSelectedPeriod("");
  };

  const handleEndDateChange = (d: string) => {
    setEndDate(d);
    setSelectedPeriod("");
  };

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
      {/* <Breadcrumb
        items={[
          { label: "คลังสินค้า", path: "/employee/wms/stock-data" },
          { label: "เช็คสต็อกสินค้า" },
        ]}
      /> */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Heading level="h1" className="text-3xl font-bold tracking-tight text-slate-800">
            งานเช็คสต็อกของฉัน
          </Heading>
          <Text variant="muted" className="mt-1 text-sm">
            รายการตารางเช็คสต็อกที่เจ้าของร้านมอบหมายให้คุณ นับสินค้าตามจริงแล้วส่งให้ตรวจสอบก่อนบันทึกลงระบบ
          </Text>
        </div>

        {/* ตัวกรองช่วงเวลา — กรองตามวันที่กำหนดเช็คสต็อก */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-[#F6F3F2] flex items-center p-1">
            {PERIOD_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => handlePeriodClick(preset.value)}
                className={cn(
                  "w-20 py-2.5 text-sm transition-colors cursor-pointer",
                  selectedPeriod === preset.value
                    ? "bg-white text-[#B70011] shadow-sm font-medium"
                    : "text-gray-500 hover:text-[#B70011]"
                )}
              >
                {preset.label}
              </button>
            ))}
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={handleStartDateChange}
              onEndDateChange={handleEndDateChange}
            />
          </div>
          {(startDate || endDate || selectedPeriod) && (
            <button
              onClick={() => {
                setStartDate("");
                setEndDate("");
                setSelectedPeriod("");
              }}
              className="text-xs text-[#B70011] font-semibold px-2 hover:underline whitespace-nowrap"
            >
              ล้างตัวกรองช่วงเวลา
            </button>
          )}
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex max-w-4xl rounded-sm border border-slate-200 bg-[#F6F3F2] p-1 shadow-sm">
        {STATUS_TABS.map((t) => {
          const isActive = statusTab === t;
          return (
            <button
              key={t}
              onClick={() => setStatusTab(t)}
              className={[
                "flex-1 cursor-pointer rounded-sm py-2 text-center text-xs font-semibold transition-all duration-150",
                isActive ? "border border-slate-200/50 bg-white text-[#B70011] shadow-sm" : "text-slate-600 hover:text-slate-900",
              ].join(" ")}
            >
              {t} {counts[t] ? `(${counts[t]})` : ""}
            </button>
          );
        })}
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
