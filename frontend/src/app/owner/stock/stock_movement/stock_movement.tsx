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
  History,
  type LucideIcon,
} from "lucide-react";

import Heading from "../../../../components/elements/heading";
import Text from "../../../../components/elements/text";
import { Card } from "../../../../components/elements/card";
import Badge from "../../../../components/elements/badge";
import Input from "../../../../components/elements/input";
import Button from "../../../../components/elements/button";
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
  const [dateFilter, setDateFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<MovementFeedType | "">("");
  // ค่าเริ่มต้นโชว์แค่ 7 วันล่าสุด (โหลดเร็ว/ดูง่าย) — กด "ตรวจสอบการเคลื่อนไหวที่เกิน 7 วัน" เพื่อดูย้อนหลังทั้งหมด
  // หรือเลือกวันที่จาก dateFilter ตรงๆ ก็ข้ามข้อจำกัด 7 วันนี้ไปเลยทันที ไม่ต้องกดปุ่มก่อน
  const [showAllHistory, setShowAllHistory] = useState(false);

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
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    return items.filter((item) => {
      if (typeFilter && item.type !== typeFilter) return false;

      // แบ่งเป็น 2 มุมมองที่ไม่ทับกัน: ค่าเริ่มต้นโชว์แค่ "ใน 7 วันล่าสุด", กดปุ่มแล้วโชว์แค่ "เกิน 7 วัน" (ไม่เอาของที่เพิ่งเห็นไปแล้วมาซ้ำ)
      // ยกเว้นเลือกวันที่เจาะจงเองจาก dateFilter ตรงๆ ถือว่าตั้งใจค้นหาวันนั้นแบบข้ามเงื่อนไข 7 วันไปเลย
      if (!dateFilter) {
        const occurredAt = new Date(item.occurred_at).getTime();
        const isOlderThan7Days = occurredAt < sevenDaysAgo;
        if (showAllHistory ? !isOlderThan7Days : isOlderThan7Days) return false;
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

      if (dateFilter) {
        // เทียบวันที่ตามเวลาท้องถิ่น ห้ามใช้ toISOString() เพราะแปลงเป็น UTC ก่อน จะเพี้ยนไปวันก่อนหน้าได้
        const d = new Date(item.occurred_at);
        const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (localDate !== dateFilter) return false;
      }

      return true;
    });
  }, [items, typeFilter, search, dateFilter, showAllHistory]);

  // กลับไปหน้า 1 ทุกครั้งที่ตัวกรองเปลี่ยน กันกรณีหน้าปัจจุบันเกินจำนวนหน้าที่กรองได้แล้ว
  useEffect(() => {
    setPage(1);
  }, [search, dateFilter, typeFilter, showAllHistory, itemsPerPage]);

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const pagedItems = useMemo(
    () => filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage),
    [filtered, page, itemsPerPage]
  );

  const goToRef = (item: MovementFeedItem) => {
    if (item.type === "CHECK_FLAGGED") {
      // ส่ง state บอกที่มาไปด้วย เพื่อให้หน้ารายละเอียดตารางเช็คสต็อกปรับเกล็ดขนมปังกลับมาที่หน้านี้แทน "ตรวจสอบสินค้า"
      navigate(`/owner/stock/stock-check/${item.ref_id}`, { state: { from: "movement" } });
    } else if (item.product_id) {
      // ส่ง state บอกที่มาไปด้วย เพื่อให้หน้ารายละเอียดสินค้าปรับเกล็ดขนมปังกลับมาที่หน้านี้แทน "คลังสินค้า"
      navigate(`/owner/stock/${item.product_id}`, { state: { from: "movement" } });
    }
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

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="flex h-24 flex-col justify-center border-l-[5px] border-l-slate-800 p-5">
          <p className="text-sm font-medium text-[#6B7280]">ทั้งหมด</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{counts.ALL}</p>
        </Card>
        {TYPE_ORDER.map((t) => {
          const meta = TYPE_META[t];
          return (
            <Card key={t} className={cn("flex h-24 flex-col justify-center border-l-[5px] p-5", meta.border)}>
              <p className="text-sm font-medium text-[#6B7280]">{meta.label}</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{counts[t] || 0}</p>
            </Card>
          );
        })}
      </div>

      {/* Type filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setTypeFilter("")}
          className={cn(
            "cursor-pointer rounded-sm border px-3 py-2 text-xs font-semibold transition-colors",
            typeFilter === ""
              ? "border-[#B70011]/30 bg-white text-[#B70011] shadow-sm"
              : "border-transparent bg-[#F6F3F2] text-slate-600 hover:text-slate-900"
          )}
        >
          ทั้งหมด ({counts.ALL})
        </button>
        {TYPE_ORDER.map((t) => {
          const meta = TYPE_META[t];
          const Icon = meta.icon;
          const isActive = typeFilter === t;
          return (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-sm border px-3 py-2 text-xs font-semibold transition-colors",
                isActive
                  ? "border-[#B70011]/30 bg-white text-[#B70011] shadow-sm"
                  : "border-transparent bg-[#F6F3F2] text-slate-600 hover:text-slate-900"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {meta.label} ({counts[t] || 0})
            </button>
          );
        })}
      </div>

      {/* Filters bar — รวมปุ่มสลับดู "7 วันล่าสุด" / "เกิน 7 วัน" ไว้ในแถบเดียวกับช่องค้นหา */}
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
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <div className="w-full sm:w-48">
              <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
            </div>
            {/* ค่าเริ่มต้นโชว์แค่ 7 วันล่าสุด กดปุ่มนี้เพื่อสลับไปดูเฉพาะที่เกิน 7 วันแทน (ไม่ทับซ้อนกัน) */}
            <Button
              type="button"
              variant={showAllHistory ? "solid-red" : "outline"}
              size="sm"
              onClick={() => {
                if (showAllHistory) {
                  setShowAllHistory(false);
                  setDateFilter("");
                } else {
                  setShowAllHistory(true);
                }
              }}
              className="w-full whitespace-nowrap sm:w-auto"
            >
              <History className="h-3.5 w-3.5" />
              {showAllHistory ? "กลับไปดู 7 วันล่าสุด" : "ตรวจสอบการเคลื่อนไหวที่เกิน 7 วัน"}
            </Button>
            {(search || dateFilter || typeFilter || showAllHistory) && (
              <button
                onClick={() => {
                  setSearch("");
                  setDateFilter("");
                  setTypeFilter("");
                  setShowAllHistory(false);
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
              const clickable = item.type === "CHECK_FLAGGED" || !!item.product_id;
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
