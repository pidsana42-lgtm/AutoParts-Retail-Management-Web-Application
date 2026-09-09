import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  PackagePlus,
  Truck,
  ClipboardCheck,
  Scale,
  AlertTriangle,
  ShoppingCart,
  Undo2,
  Hourglass,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  PackageSearch,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";

import Heading from "../../../../components/elements/heading";
import Text from "../../../../components/elements/text";
import { Card } from "../../../../components/elements/card";
import Badge from "../../../../components/elements/badge";
import Input from "../../../../components/elements/input";
import DateRangePicker from "../../../../components/elements/date_range_picker";
import { ToastProvider, useToast } from "../../../../components/elements/toast";
import { cn } from "../../../../utils/component";
import {
  movementFeedService,
  type MovementFeedItem,
  type MovementFeedType,
} from "../../../../service/http/wms/movement_feed_service";

// สร้างเลขหน้าแบบมี "..." คั่นเมื่อมีหลายหน้า (สไตล์เดียวกับหน้าจัดการตารางเช็คสต็อก/คลังสินค้า)
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

// ลำดับประเภทเหตุการณ์ที่จะแสดงในการ์ดสรุป/ตัวกรอง — ครอบคลุมทั้งฝั่ง WMS และฝั่งขาย/คืน-เคลม/พรีออเดอร์แล้ว
const TYPE_ORDER: MovementFeedType[] = [
  "PRODUCT_ADDED",
  "STOCK_IN",
  "SALE_OUT",
  "SALES_RETURN",
  "CUSTOMER_CLAIM",
  "PRE_ORDER",
  "CHECK_FLAGGED",
  "STOCK_ADJUSTED",
  "LOW_STOCK",
];

// พรีเซ็ตช่วงเวลาด่วน (แบบเดียวกับแถบตัวกรองในหน้าแดชบอร์ด) — ใช้ควบคู่กับ DateRangePicker สำหรับเลือกช่วงเอง
const PERIOD_PRESETS: { label: string; value: string }[] = [
  { label: "สัปดาห์นี้", value: "weekly" },
  { label: "เดือนนี้", value: "monthly" },
  { label: "ไตรมาสนี้", value: "quarterly" },
  { label: "ปีนี้", value: "yearly" },
];

// คำนวณช่วงวันที่ของพรีเซ็ตฝั่งหน้าเว็บเองตรงๆ (ต่างจากหน้าแดชบอร์ดที่ส่งเป็น query ให้ backend คำนวณ) เพราะฟีดนี้โหลด
// ข้อมูลมาไว้ในเครื่องทั้งหมดแล้ว กรองในนี้ได้เลยไม่ต้องยิง request ใหม่ — สัปดาห์เริ่มวันจันทร์ตามธรรมเนียมไทย
function getPeriodRange(period: string): { start: Date; end: Date } | null {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (period) {
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

const TYPE_META: Record<
  MovementFeedType,
  { label: string; icon: LucideIcon; border: string; dot: string; badgeClass: string }
> = {
  PRODUCT_ADDED: {
    label: "เพิ่มสินค้าใหม่",
    icon: PackagePlus,
    border: "border-l-blue-500",
    dot: "bg-blue-500",
    badgeClass: "w-auto bg-blue-50 px-2.5 text-blue-600",
  },
  STOCK_IN: {
    label: "รับสินค้าเข้าเพิ่ม",
    icon: Truck,
    border: "border-l-emerald-500",
    dot: "bg-emerald-500",
    badgeClass: "w-auto bg-emerald-50 px-2.5 text-emerald-600",
  },
  CHECK_FLAGGED: {
    label: "แจ้งเช็คสต็อก",
    icon: ClipboardCheck,
    border: "border-l-amber-500",
    dot: "bg-amber-500",
    badgeClass: "w-auto bg-amber-50 px-2.5 text-amber-600",
  },
  STOCK_ADJUSTED: {
    label: "ปรับปรุงสต็อก",
    icon: Scale,
    border: "border-l-violet-500",
    dot: "bg-violet-500",
    badgeClass: "w-auto bg-violet-50 px-2.5 text-violet-600",
  },
  LOW_STOCK: {
    label: "ใกล้หมด",
    icon: AlertTriangle,
    border: "border-l-red-600",
    dot: "bg-red-600",
    badgeClass: "w-auto bg-red-50 px-2.5 text-red-600",
  },
  SALE_OUT: {
    label: "POS",
    icon: ShoppingCart,
    border: "border-l-orange-500",
    dot: "bg-orange-500",
    badgeClass: "w-auto bg-orange-50 px-2.5 text-orange-600",
  },
  SALES_RETURN: {
    label: "คืนสินค้า",
    icon: Undo2,
    border: "border-l-cyan-500",
    dot: "bg-cyan-500",
    badgeClass: "w-auto bg-cyan-50 px-2.5 text-cyan-600",
  },
  CUSTOMER_CLAIM: {
    label: "เคลมสินค้า",
    icon: Undo2,
    border: "border-l-pink-500",
    dot: "bg-pink-500",
    badgeClass: "w-auto bg-pink-50 px-2.5 text-pink-600",
  },
  PRE_ORDER: {
    label: "พรีออเดอร์",
    icon: Hourglass,
    border: "border-l-indigo-500",
    dot: "bg-indigo-500",
    badgeClass: "w-auto bg-indigo-50 px-2.5 text-indigo-600",
  },
};

function StockMovementContent() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MovementFeedItem[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<MovementFeedType | "">("");
  // ตัวกรองช่วงเวลา — พรีเซ็ตด่วน (selectedPeriod) กับช่วงวันที่กำหนดเอง (startDate/endDate) แยกกันคนละอันเสมอ
  // เลือกอย่างใดอย่างหนึ่งแล้วอีกอันจะถูกล้างทันที (ดู handlePeriodClick/handleStartDateChange/handleEndDateChange)
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await movementFeedService.getFeed();
      setItems(data);
    } catch (err) {
      console.error(err);
      toast({ variant: "error", message: "ไม่สามารถโหลดข้อมูลการเคลื่อนไหวของสินค้าได้" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // จำนวนรายการต่อประเภท ใช้ทั้งการ์ดสรุปด้านบนและตัวเลขในตัวกรอง
  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: items.length };
    TYPE_ORDER.forEach((t) => {
      c[t] = items.filter((i) => i.type === t).length;
    });
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (typeFilter && item.type !== typeFilter) return false;

      if (startDate || endDate) {
        // ช่วงวันที่กำหนดเองมาก่อนพรีเซ็ตเสมอ (เลือกสองอย่างพร้อมกันไม่ได้อยู่แล้ว แต่กันไว้ให้ชัดเจน)
        const occurredAt = new Date(item.occurred_at);
        if (startDate) {
          const s = new Date(startDate);
          s.setHours(0, 0, 0, 0);
          if (occurredAt < s) return false;
        }
        if (endDate) {
          const e = new Date(endDate);
          e.setHours(23, 59, 59, 999);
          if (occurredAt > e) return false;
        }
      } else if (selectedPeriod) {
        const range = getPeriodRange(selectedPeriod);
        if (range) {
          const occurredAt = new Date(item.occurred_at);
          if (occurredAt < range.start || occurredAt > range.end) return false;
        }
      }

      if (search) {
        const q = search.toLowerCase();
        const matches =
          item.title.toLowerCase().includes(q) ||
          (item.detail || "").toLowerCase().includes(q) ||
          (item.product_name || "").toLowerCase().includes(q) ||
          (item.product_code || "").toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [items, typeFilter, search, startDate, endDate, selectedPeriod]);

  // กลับไปหน้า 1 ทุกครั้งที่ตัวกรองเปลี่ยน กันกรณีหน้าปัจจุบันเกินจำนวนหน้าที่กรองได้แล้ว
  useEffect(() => {
    setPage(1);
  }, [search, startDate, endDate, selectedPeriod, typeFilter, itemsPerPage]);

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

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const pagedItems = useMemo(
    () => filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage),
    [filtered, page, itemsPerPage]
  );

  // backend คำนวณ link_path ให้เสร็จแล้วสำหรับทุกเหตุการณ์ที่มีหน้ารายละเอียดให้กด (รู้ id เอกสารหลักจริงอยู่แล้ว
  // ไม่ใช่แค่ ref_id ที่บางเหตุการณ์เป็นแค่ id รายการย่อย) ฝั่งนี้แค่ navigate ไปตรงๆ ไม่ต้องรู้จัก route ของแต่ละ
  // โดเมนเองอีกต่อไป — ไม่มี link_path แปลว่าเหตุการณ์นั้นไม่มีหน้ารายละเอียดให้ดู (เช่นยังไม่รองรับ หรือหา id ไม่เจอ)
  const goToRef = (item: MovementFeedItem) => {
    if (!item.link_path) return;
    navigate(item.link_path, item.link_state ? { state: item.link_state } : undefined);
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleString("th-TH", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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
    <div className="space-y-6 p-6 select-none font-sans bg-gray-50 min-h-screen">
      {/* Header */}
      <div>
        <Heading level="h1" className="text-3xl font-bold text-slate-800 tracking-tight">
          การเคลื่อนไหวของคลังสินค้า
        </Heading>
        <Text variant="muted" className="text-sm mt-1">
          ติดตามทุกความเคลื่อนไหวของสินค้าในคลัง ตั้งแต่เพิ่มใหม่ รับเข้าเพิ่ม POS คืน/เคลม พรีออเดอร์ แจ้งเช็คสต็อก
          ไปจนถึงสินค้าใกล้หมด ในที่เดียว
        </Text>
      </div>

      {/* การ์ดสรุป + ตัวกรอง รวมเป็นชุดเดียว — กดการ์ดไหนก็กรองตามหมวดนั้นได้เลย ไม่ต้องมีแถบตัวกรองแยกที่โชว์ตัวเลขซ้ำอีกชุด */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <button
          type="button"
          onClick={() => setTypeFilter("")}
          className={cn(
            "flex h-24 cursor-pointer flex-col justify-center rounded-none border-l-[5px] border-l-slate-800 p-5 text-left shadow-sm transition-colors",
            typeFilter === "" ? "bg-slate-100" : "bg-white hover:bg-gray-50"
          )}
        >
          <p className="text-sm font-medium text-[#6B7280]">ทั้งหมด</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{counts.ALL}</p>
        </button>
        {TYPE_ORDER.map((t) => {
          const meta = TYPE_META[t];
          const isActive = typeFilter === t;
          // สีพื้นตอนเลือกอยู่ ดึงมาจากสีจุด (dot) ของหมวดนั้นตรงๆ (แค่เปลี่ยนความเข้มจาก 500/600 เป็น 50)
          // ไม่ต้องเพิ่มฟิลด์สีใหม่ซ้ำซ้อนกับที่มีอยู่แล้วใน TYPE_META
          const activeBg = meta.dot.replace(/-(500|600)$/, "-50");
          return (
            <button
              type="button"
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                "flex h-24 cursor-pointer flex-col justify-center rounded-none border-l-[5px] p-5 text-left shadow-sm transition-colors",
                meta.border,
                isActive ? activeBg : "bg-white hover:bg-gray-50"
              )}
            >
              <p className="text-sm font-medium text-[#6B7280]">{meta.label}</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{counts[t] || 0}</p>
            </button>
          );
        })}
      </div>

      {/* Filters bar */}
      <Card noPadding>
        <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
          <div className="flex-1 min-w-0">
            <Input
              leftIcon={<Filter className="h-4 w-4" />}
              placeholder="ค้นหาด้วยชื่อ/รหัสสินค้า หรือรายละเอียด..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto">
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
            {(search || startDate || endDate || typeFilter || selectedPeriod) && (
              <button
                onClick={() => {
                  setSearch("");
                  setStartDate("");
                  setEndDate("");
                  setTypeFilter("");
                  setSelectedPeriod("");
                }}
                className="text-xs text-[#B70011] font-semibold px-2 hover:underline whitespace-nowrap self-center"
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Timeline */}
      <Card className="overflow-hidden" noPadding>
        {pagedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <PackageSearch className="h-10 w-10 text-slate-300" />
            <p className="font-medium text-slate-500">ไม่พบรายการเคลื่อนไหวที่ตรงกับเงื่อนไข</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pagedItems.map((item, idx) => {
              const meta = TYPE_META[item.type];
              const Icon = meta.icon;
              const clickable = !!item.link_path;
              return (
                <div
                  key={`${item.type}-${item.ref_id}-${idx}`}
                  onClick={clickable ? () => goToRef(item) : undefined}
                  className={cn(
                    "flex items-start gap-4 px-6 py-4 transition-colors",
                    clickable && "cursor-pointer hover:bg-gray-50/70"
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white",
                      meta.dot
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-800">{item.title}</p>
                      <Badge className={meta.badgeClass}>{meta.label}</Badge>
                    </div>
                    {item.detail && <p className="mt-0.5 text-sm text-slate-500">{item.detail}</p>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {formatDateTime(item.occurred_at)}
                      </span>
                      {item.product_code && <span>รหัส: {item.product_code}</span>}
                      {typeof item.quantity === "number" && <span>จำนวน: {item.quantity}</span>}
                      {item.supplier_name && <span>บริษัท: {item.supplier_name}</span>}
                      {item.actor_name && <span>โดย: {item.actor_name}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

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
    </div>
  );
}

export default function StockMovement() {
  return (
    <ToastProvider position="bottom-right">
      <StockMovementContent />
    </ToastProvider>
  );
}
