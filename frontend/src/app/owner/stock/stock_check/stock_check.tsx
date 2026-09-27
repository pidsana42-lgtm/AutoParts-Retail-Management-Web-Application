import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  SquarePen,
  Eye,
  Trash2,
  Loader2,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  TriangleAlert,
} from "lucide-react";
import { ToastProvider, useToast } from "../../../../components/elements/toast";
import { useAlertDialog } from "../../../../components/elements/alert_dialog";
import Heading from "../../../../components/elements/heading";
import Text from "../../../../components/elements/text";
import { Card } from "../../../../components/elements/card";
import Badge from "../../../../components/elements/badge";
import Input from "../../../../components/elements/input";
import TreeSelect from "../../../../components/elements/tree_select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../../components/elements/table";
import { cn } from "../../../../utils/component";
import DateRangePicker from "../../../../components/elements/date_range_picker";

import EditCheckStockScheduleModal from "./EditCheckStockScheduleModal";
import { buildZoneTree, buildCategoryTree, getRelatedProducts, getScheduleProducts, CHECK_STATUS_BADGE_VARIANT, isScheduleOverdue } from "./checkStockTargets";
import { useCheckStockOptions } from "./useCheckStockOptions";
import { stockCheckService, type CheckStockSchedule } from "../../../../service/http/wms/stock_check_service";
import Button from "../../../../components/elements/button";

// สร้างเลขหน้าแบบมี "..." คั่นเมื่อมีหลายหน้า (สไตล์เดียวกับหน้าคลังสินค้า/ใบสั่งซื้อ)
function getPageNumbers(current: number, total: number): (number | "...")[] {
  const delta = 1;
  const range: (number | "...")[] = [];
  const left = Math.max(2, current - delta);
  const right = Math.min(total - 1, current + delta);

  range.push(1);
  if (left > 2) range.push("...");
  for (let i = left; i <= right; i++) range.push(i);
  if (right < total - 1) range.push("...");
  if (total > 1) range.push(total);

  return range;
}

// พรีเซ็ตช่วงเวลาด่วน (แบบเดียวกับหน้าคลังสินค้า) — กรองตามวันที่กำหนดตรวจ (scheduled_datetime)
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

// เช็คว่าวันที่กำหนดตรวจอยู่ในช่วงเวลาที่ตัวกรองกำหนดไว้หรือไม่ (ช่วงวันที่กำหนดเอง หรือพรีเซ็ตด่วน)
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

function StockCheckContent() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { confirmDialog } = useAlertDialog();

  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<CheckStockSchedule[]>([]);
  const { zones, categories, products, loading: loadingOptions } = useCheckStockOptions();

  // Filters
  const [search, setSearch] = useState("");
  // ตัวกรองช่วงเวลา — พรีเซ็ตด่วน (selectedPeriod) กับช่วงวันที่กำหนดเอง (startDate/endDate) แยกกันคนละอันเสมอ
  // เลือกอย่างใดอย่างหนึ่งแล้วอีกอันจะถูกล้างทันที (ดู handlePeriodClick/handleStartDateChange/handleEndDateChange)
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusQuickFilter, setStatusQuickFilter] = useState<string>("");

  // Pagination
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<CheckStockSchedule | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const sc = await stockCheckService.getSchedules();
      setSchedules(sc);
    } catch (err) {
      console.error(err);
      toast({ variant: "error", message: "ไม่สามารถโหลดข้อมูลตารางเช็คสต็อกได้" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleEdit = (sc: CheckStockSchedule) => {
    setSelectedSchedule(sc);
    setIsEditModalOpen(true);
  };

  const handleView = (sc: CheckStockSchedule) => {
    navigate(`/owner/stock/stock-check/${sc.id}`, { state: { authorizedId: Number(sc.id) } });
  };

  const handleDelete = async (sc: CheckStockSchedule) => {
    const confirmed = await confirmDialog(
      `ต้องการลบตารางเช็คสต็อกวันที่ ${new Date(sc.scheduled_datetime).toLocaleDateString("th-TH")} ใช่หรือไม่? ผลการนับที่บันทึกไว้ในตารางนี้จะถูกลบไปด้วย และกู้คืนไม่ได้`,
      { title: "ลบตารางเช็คสต็อก", confirmText: "ลบตาราง", variant: "danger", icon: Trash2 }
    );
    if (!confirmed) return;

    try {
      setDeletingId(sc.id);
      await stockCheckService.deleteSchedule(sc.id);
      toast({ variant: "success", message: "ลบตารางเช็คสต็อกสำเร็จ" });
      loadData();
    } catch (err: any) {
      toast({ variant: "error", message: err.response?.data?.error || "ไม่สามารถลบตารางเช็คสต็อกได้" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreate = () => {
    navigate("/owner/stock/stock-check/new");
  };

  // ต้นไม้โซน > ตู้ > ชั้นระดับ สำหรับตัวกรอง (แบบเดียวกับ "ตำแหน่งจัดเก็บ" ในหน้าเพิ่ม/แก้ไขสินค้า)
  const zoneTreeOptions = useMemo(() => buildZoneTree(zones), [zones]);

  // ต้นไม้ประเภทหลัก > ประเภทย่อย > ประเภทย่อยย่อย สำหรับตัวกรอง (แบบเดียวกับโซนด้านบน)
  const categoryTreeOptions = useMemo(() => buildCategoryTree(categories), [categories]);

  // ตัดตามช่วงเวลาก่อนเสมอ (พรีเซ็ตด่วน/กำหนดเอง) แล้วค่อยคำนวณสรุปสถานะต่อ ให้กดตัวกรองช่วงเวลาแล้วเห็นจำนวนที่ตรงกับช่วงนั้นทันที
  const periodFilteredSchedules = useMemo(
    () => schedules.filter((sc) => matchesPeriod(sc.scheduled_datetime, startDate, endDate, selectedPeriod)),
    [schedules, startDate, endDate, selectedPeriod]
  );

  // Derived Stats
  const stats = useMemo(() => {
    const pending = periodFilteredSchedules.filter((s) => s.status === "รอดำเนินการ").length;
    const checking = periodFilteredSchedules.filter((s) => s.status === "กำลังเช็ค").length;
    const awaitingReview = periodFilteredSchedules.filter((s) => s.status === "รอตรวจสอบ").length;
    const completed = periodFilteredSchedules.filter((s) => s.status === "เสร็จสิ้น").length;
    return { pending, checking, awaitingReview, completed, total: periodFilteredSchedules.length };
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

  // กดการ์ดสรุปสถานะไหนก็กรองตามสถานะนั้นได้เลย (สถานะว่าง = ล้างตัวกรองสถานะ กลับไปดูทั้งหมด) — เคลียร์ตัวกรองอื่น
  // (ค้นหา/โซน/ประเภท) ไปด้วยเสมอ กันกรณีตัวกรองเหล่านั้นค้างอยู่แล้วบังรายการที่ตัวเลขบนการ์ดสัญญาไว้ (ไม่เคลียร์
  // ช่วงเวลา เพราะการ์ดพวกนี้คำนวณจาก periodFilteredSchedules อยู่แล้ว ยังตรงกับช่วงเวลาที่เลือกไว้เหมือนเดิม)
  const selectStatusFilter = (status: string) => {
    setSearch("");
    setZoneFilter("");
    setCategoryFilter("");
    setStatusQuickFilter(status);
  };

  // สินค้าทั้งหมดที่อยู่ในโซน/ตู้/ชั้นระดับที่เลือกไว้ในตัวกรอง (คำนวณครั้งเดียว ไม่ใช่วนต่อแถวตาราง)
  const zoneFilterProductIds = useMemo(() => {
    if (!zoneFilter) return null;
    const list = getRelatedProducts("LOCATION", [zoneFilter], [], products, zones, categories);
    return new Set(list.map((p) => p.ID));
  }, [zoneFilter, products, zones, categories]);

  // สินค้าทั้งหมดที่อยู่ในประเภท/ประเภทย่อยที่เลือกไว้ในตัวกรอง (คำนวณครั้งเดียวเหมือนกับ zoneFilterProductIds ด้านบน)
  const categoryFilterProductIds = useMemo(() => {
    if (!categoryFilter) return null;
    const list = getRelatedProducts("CATEGORY", [], [categoryFilter], products, zones, categories);
    return new Set(list.map((p) => p.ID));
  }, [categoryFilter, products, zones, categories]);

  // Filtered schedules — ตัดตามช่วงเวลาไปแล้วใน periodFilteredSchedules ก่อนหน้านี้
  const filteredSchedules = useMemo(() => {
    return periodFilteredSchedules.filter((sc) => {
      let match = true;

      if (statusQuickFilter && sc.status !== statusQuickFilter) match = false;

      // ต้องหาสินค้าที่ตารางนี้ครอบคลุมจริง (ไม่ใช่แค่ match ข้อความ target_name) เพื่อให้ค้นหา/กรองโซน/กรองประเภท
      // ใช้ได้แม้ตารางเป็นแบบ CATEGORY หรือ LOCATION ที่ target_name ไม่ได้เก็บชื่อ/รหัสสินค้าไว้ตรงๆ
      if (search || zoneFilterProductIds || categoryFilterProductIds) {
        const scProducts = getScheduleProducts(sc, products, zones, categories);

        if (search) {
          const searchLower = search.toLowerCase();
          const targetMatches = !!sc.target_name && sc.target_name.toLowerCase().includes(searchLower);
          const productMatches = scProducts.some(
            (p) =>
              p.ProductCode?.toLowerCase().includes(searchLower) || p.Name?.toLowerCase().includes(searchLower)
          );
          if (!targetMatches && !productMatches) match = false;
        }

        if (match && zoneFilterProductIds) {
          const matchesZone = scProducts.some((p) => zoneFilterProductIds.has(p.ID));
          if (!matchesZone) match = false;
        }

        if (match && categoryFilterProductIds) {
          const matchesCategory = scProducts.some((p) => categoryFilterProductIds.has(p.ID));
          if (!matchesCategory) match = false;
        }
      }

      return match;
    })
    // รายการที่สร้างล่าสุดอยู่บนสุด (เรียงตาม created_at ใหม่ไปเก่า, ใช้ id เป็นตัวตัดสินสำรองถ้าเวลาสร้างชนกัน)
    .sort((a, b) => {
      const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return diff !== 0 ? diff : b.id - a.id;
    });
  }, [periodFilteredSchedules, search, zoneFilterProductIds, categoryFilterProductIds, statusQuickFilter, products, zones, categories]);

  // กลับไปหน้า 1 ทุกครั้งที่ตัวกรองเปลี่ยน กันกรณีหน้าปัจจุบันเกินจำนวนหน้าที่กรองได้แล้ว
  useEffect(() => {
    setPage(1);
  }, [search, startDate, endDate, selectedPeriod, zoneFilter, categoryFilter, statusQuickFilter, itemsPerPage]);

  const totalItems = filteredSchedules.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const pagedSchedules = useMemo(
    () => filteredSchedules.slice((page - 1) * itemsPerPage, page * itemsPerPage),
    [filteredSchedules, page, itemsPerPage]
  );

  const getStatusBadge = (status: string) => {
    const variant = CHECK_STATUS_BADGE_VARIANT[status] || "neutral";
    const styles: Record<string, string> = {
      neutral: "bg-gray-100 text-gray-500",
      error: "bg-red-50 text-red-600",
      info: "bg-blue-50 text-blue-600",
      success: "bg-green-50 text-green-600",
    };
    return <Badge variant={variant} className={styles[variant]}>• {status}</Badge>;
  };

  if (loading || loadingOptions) {
    return (
      <div className="flex h-[calc(100vh-8rem)] w-full flex-col items-center justify-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-[#B70011]" />
        <span className="text-slate-400 text-sm font-medium">กำลังโหลดข้อมูล...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 select-none font-sans bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Heading level="h1" className="text-3xl font-bold text-slate-800 tracking-tight">
            จัดการตารางตรวจสอบสินค้า
          </Heading>
          <Text variant="muted" className="text-sm mt-1">
            กำหนดวันเวลาตรวจ เลือกรูปแบบการตรวจสอบ แล้วติดตามรายการที่ต้องตรวจสอบสินค้าได้ในที่เดียว
          </Text>
        </div>
        <div className="flex flex-col items-end gap-3 self-start sm:self-auto">
          <Button
            onClick={() => handleCreate()}
            variant="primary"
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            สร้างตารางตรวจสอบสินค้าใหม่
          </Button>

          {/* ตัวกรองช่วงเวลา — กรองตามวันที่กำหนดตรวจ */}
          <div className="flex flex-wrap items-center justify-end gap-3">
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
      </div>

      {/* Stats Cards — กดได้เลย ทำหน้าที่เป็นตัวกรองสถานะด่วนไปในตัว (แบบเดียวกับหน้าการเคลื่อนไหวของคลังสินค้า) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <button
          type="button"
          onClick={() => selectStatusFilter("")}
          className={cn(
            "flex h-24 cursor-pointer flex-col justify-center rounded-none border-l-[5px] border-l-black p-5 text-left shadow-sm transition-colors",
            statusQuickFilter === "" ? "bg-slate-100" : "bg-white hover:bg-gray-50"
          )}
        >
          <p className="text-sm font-medium text-[#6B7280]">ตารางตรวจสอบทั้งหมด</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{stats.total}</p>
        </button>
        <button
          type="button"
          onClick={() => selectStatusFilter("รอดำเนินการ")}
          className={cn(
            "flex h-24 cursor-pointer flex-col justify-center rounded-none border-l-[5px] border-l-slate-400 p-5 text-left shadow-sm transition-colors",
            statusQuickFilter === "รอดำเนินการ" ? "bg-slate-50" : "bg-white hover:bg-gray-50"
          )}
        >
          <p className="text-sm font-medium text-[#6B7280]">รอดำเนินการ</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{stats.pending}</p>
        </button>
        <button
          type="button"
          onClick={() => selectStatusFilter("กำลังเช็ค")}
          className={cn(
            "flex h-24 cursor-pointer flex-col justify-center rounded-none border-l-[5px] border-l-red-600 p-5 text-left shadow-sm transition-colors",
            statusQuickFilter === "กำลังเช็ค" ? "bg-red-50" : "bg-white hover:bg-gray-50"
          )}
        >
          <p className="text-sm font-medium text-[#6B7280]">กำลังเช็ค</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{stats.checking}</p>
        </button>
        <button
          type="button"
          onClick={() => selectStatusFilter("รอตรวจสอบ")}
          className={cn(
            "flex h-24 cursor-pointer flex-col justify-center rounded-none border-l-[5px] border-l-blue-500 p-5 text-left shadow-sm transition-colors",
            statusQuickFilter === "รอตรวจสอบ" ? "bg-blue-50" : "bg-white hover:bg-gray-50"
          )}
        >
          <p className="text-sm font-medium text-[#6B7280]">รอตรวจสอบ (พนักงานส่งแล้ว)</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{stats.awaitingReview}</p>
        </button>
        <button
          type="button"
          onClick={() => selectStatusFilter("เสร็จสิ้น")}
          className={cn(
            "flex h-24 cursor-pointer flex-col justify-center rounded-none border-l-[5px] border-l-emerald-500 p-5 text-left shadow-sm transition-colors",
            statusQuickFilter === "เสร็จสิ้น" ? "bg-emerald-50" : "bg-white hover:bg-gray-50"
          )}
        >
          <p className="text-sm font-medium text-[#6B7280]">เสร็จสิ้น (วันนี้)</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{stats.completed}</p>
        </button>
      </div>

      {stats.awaitingReview > 0 && statusQuickFilter !== "รอตรวจสอบ" && (
        <div
          onClick={() => selectStatusFilter("รอตรวจสอบ")}
          className="flex cursor-pointer items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-5 py-3 text-sm text-blue-700 transition hover:border-blue-300"
        >
          <span>
            มี <span className="font-bold">{stats.awaitingReview}</span> ตารางที่พนักงานส่งผลนับสต็อกมาแล้ว รอการตรวจสอบและอนุมัติจากคุณ
          </span>
          <span className="font-semibold underline">ดูรายการ →</span>
        </div>
      )}

      {/* Filters & Actions */}
      <Card noPadding>
        <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
          <div className="flex-1 min-w-0">
            <Input
              leftIcon={<Filter className="h-4 w-4" />}
              placeholder="ค้นหาด้วยรหัสสินค้า หรือชื่อสินค้า..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <div className="w-full sm:w-56">
              <TreeSelect
                options={[{ label: "โซนทั้งหมด", value: "" }, ...zoneTreeOptions]}
                placeholder="โซนทั้งหมด"
                searchPlaceholder="ค้นหาโซน/ตู้/ชั้นระดับ..."
                value={zoneFilter}
                onChange={(val) => setZoneFilter(val)}
              />
            </div>
            <div className="w-full sm:w-56">
              <TreeSelect
                options={[{ label: "ประเภททั้งหมด", value: "" }, ...categoryTreeOptions]}
                placeholder="เลือกประเภท"
                searchPlaceholder="ค้นหา..."
                value={categoryFilter}
                onChange={(val) => setCategoryFilter(val)}
              />
            </div>
            {(search || startDate || endDate || selectedPeriod || zoneFilter || categoryFilter || statusQuickFilter) && (
              <button
                onClick={() => {
                  setSearch("");
                  setStartDate("");
                  setEndDate("");
                  setSelectedPeriod("");
                  setZoneFilter("");
                  setCategoryFilter("");
                  setStatusQuickFilter("");
                }}
                className="text-xs text-[#B70011] font-semibold px-2 hover:underline whitespace-nowrap self-center"
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>
        </div>
        {statusQuickFilter && (
          <div className="flex items-center gap-2 border-t border-slate-100 px-5 py-2 text-xs text-slate-500">
            กำลังกรองเฉพาะสถานะ:
            <Badge variant={CHECK_STATUS_BADGE_VARIANT[statusQuickFilter] || "neutral"}>{statusQuickFilter}</Badge>
            <button onClick={() => setStatusQuickFilter("")} className="text-[#B70011] hover:underline">
              ยกเลิก
            </button>
          </div>
        )}
      </Card>

      {/* Table */}
      <Card className="overflow-hidden" noPadding>
        <Table>
          <TableHeader className="bg-[#f6f3f2] text-[#797878]">
            <TableRow>
              <TableHead className="pl-6">วันที่กำหนด</TableHead>
              <TableHead>เป้าหมายการตรวจ</TableHead>
              <TableHead>รายการสินค้า</TableHead>
              <TableHead>พนักงานที่รับมอบหมาย</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead className="text-center pr-6">จัดการ</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody className="text-gray-700">
            {pagedSchedules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-gray-500">
                  ไม่พบข้อมูลตารางเช็คสต็อก
                </TableCell>
              </TableRow>
            ) : (
              pagedSchedules.map((sc) => {
                const scDateObj = new Date(sc.scheduled_datetime);
                const scEndObj = sc.scheduled_end_datetime ? new Date(sc.scheduled_end_datetime) : null;
                const dateStr = scDateObj.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" });
                const startTimeStr = scDateObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
                const endTimeStr = scEndObj?.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
                const overdue = isScheduleOverdue(sc);
                // เลยเวลากำหนดแล้วให้เจ้าของร้านพิจารณาแก้ไข/สั่งงานซ้ำได้ ไม่ใช่แค่ตอนยัง "รอดำเนินการ" เหมือนเดิม
                const isEditable = sc.status === "รอดำเนินการ" || overdue;

                return (
                  <TableRow key={sc.id} className="hover:bg-gray-50/70">
                    <TableCell className="pl-6">
                      <div className="font-semibold text-gray-800">{dateStr}</div>
                      <div className="text-xs text-gray-400">
                        {startTimeStr}
                        {endTimeStr ? ` - ${endTimeStr}` : ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      {sc.check_type === "LOCATION" && (
                        sc.target_name.startsWith("หลายพื้นที่") ? (
                          <div>
                            <div className="font-semibold text-gray-800 line-clamp-1">{sc.target_name}</div>
                            <div className="text-[10px] text-gray-400 tracking-wider">ตรวจสอบหลายพื้นที่พร้อมกัน</div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="bg-gray-100 px-2 py-1 rounded text-xs font-bold text-gray-600">
                              {sc.target_name.split(" ")[1] || "Loc"}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-800">{sc.target_name.split(" - ")[0]}</div>
                              <div className="text-[10px] text-gray-400 tracking-wider">
                                {sc.target_name.split(" - ").slice(1).join(" - ")}
                              </div>
                            </div>
                          </div>
                        )
                      )}
                      {sc.check_type === "CATEGORY" && (
                        <div>
                          <div className="font-semibold text-gray-800">{sc.target_name}</div>
                          <div className="text-[10px] text-gray-400 tracking-wider">ตรวจสอบทั้งหมวดหมู่</div>
                        </div>
                      )}
                      {sc.check_type === "PRODUCT" && (
                        <div>
                          <div className="font-semibold text-gray-800 line-clamp-1">{sc.target_name}</div>
                          <div className="text-[10px] text-gray-400 tracking-wider">ตรวจสอบเฉพาะชิ้น</div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-bold text-gray-800">
                        {sc.product_count} <span className="text-gray-500 font-normal">รายการ</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {sc.user_full_name ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                            {sc.user_full_name.charAt(0)}
                          </div>
                          <span className="font-medium text-gray-700 text-sm">{sc.user_full_name}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">ยังไม่มอบหมาย</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {getStatusBadge(sc.status)}
                        {overdue && (
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-[#B70011]">
                            <TriangleAlert className="h-3 w-3" />
                            เลยเวลาที่กำหนดแล้ว
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center pr-6">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleView(sc)}
                          className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
                          title="ดูรายละเอียด"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(sc)}
                          disabled={!isEditable}
                          className={cn(
                            "p-1.5 rounded-md transition-colors",
                            isEditable ? "text-[#B70011] hover:bg-red-50 cursor-pointer" : "text-gray-300 cursor-not-allowed"
                          )}
                          title={overdue ? "เลยเวลาที่กำหนดแล้ว — พิจารณาแก้ไข/สั่งงานซ้ำ" : isEditable ? "แก้ไข" : "ไม่สามารถแก้ไขได้"}
                        >
                          <SquarePen className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(sc)}
                          disabled={deletingId === sc.id}
                          className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          title="ลบ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination footer */}
        {totalItems > 0 && (
          <div className="bg-[#fcfbfa] px-6 py-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span>
                แสดง {Math.min((page - 1) * itemsPerPage + 1, totalItems)} ถึง{" "}
                {Math.min(page * itemsPerPage, totalItems)} จาก {totalItems} รายการ
              </span>
              <div className="flex items-center gap-2">
                <span>รายการต่อหน้า:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="border border-gray-200 rounded-none px-2 py-1 text-gray-600 bg-white hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-200 cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage(1)}
                aria-label="หน้าแรก"
                className="p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                aria-label="หน้าก่อนหน้า"
                className="p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {getPageNumbers(page, totalPages).map((p, idx) =>
                p === "..." ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">
                    ...
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    aria-current={page === p ? "page" : undefined}
                    className={cn(
                      "px-3 py-1.5 rounded-none font-medium transition-colors cursor-pointer",
                      page === p ? "bg-[#d61c24] text-white" : "text-gray-600 hover:bg-gray-100"
                    )}
                  >
                    {p}
                  </button>
                )
              )}

              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                aria-label="หน้าถัดไป"
                className="p-1.5 rounded-none text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(totalPages)}
                aria-label="หน้าสุดท้าย"
                className="p-1.5 rounded-none text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {isEditModalOpen && (
        <EditCheckStockScheduleModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={loadData}
          schedule={selectedSchedule}
        />
      )}
    </div>
  );
}

export default function StockCheck() {
  return (
    <ToastProvider position="bottom-right">
      <StockCheckContent />
    </ToastProvider>
  );
}
