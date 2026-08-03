import React from "react";
import {
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Calendar,
  ScanBarcode,
} from "lucide-react";

// นำเข้า Components
import Heading from "../../../components/elements/heading";
import Text from "../../../components/elements/text";
import Input from "../../../components/elements/input";
import Select from "../../../components/elements/select";
import Button from "../../../components/elements/button";
import Badge from "../../../components/elements/badge";
import { TableHead, TableHeader, TableRow } from "../../../components/elements/table";
import { Card, CardContent } from "../../../components/elements/card";
import { cn } from "../../../utils/component";

// นำเข้า Hook & Helpers
import { useSalesHistory } from "./hooks/useSalesHistory";
import { getDisplayCustomerName } from "../../../utils/poshelpers";
import type { SalesHistoryItemResponse } from "../../../interface/pos/sales_history_interface";

// --- Helper Function สำหรับ Pagination ---
const getPageNumbers = (currentPage: number, totalPages: number): (number | "...")[] => {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 3) {
    return [1, 2, 3, 4, "...", totalPages];
  }
  if (currentPage >= totalPages - 2) {
    return [1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
};

export default function TransactionHistoryPage() {
  // --- ดึงข้อมูลและ Handlers จริงจาก Custom Hook ---
  const {
    items,
    totalRows,
    totalPages,
    isLoading,
    error,
    search,
    customerType,
    paymentMethod,
    startDate,
    endDate,
    page,
    limit,
    setSearch,
    setCustomerType,
    setPaymentMethod,
    setStartDate,
    setEndDate,
    setPage,
    setLimit,
    handleApplyFilter,
  } = useSalesHistory();

  // --- Helper Render Status Badge ---
  const renderStatusBadge = (status: string, paymentStatus: string) => {
    const rawStatus = (paymentStatus || status || "").toUpperCase();

    switch (rawStatus) {
      case "COMPLETED":
      case "PAID":
      case "ชำระแล้ว":
        return <Badge variant="success" className="rounded-none">ชำระแล้ว</Badge>;
      case "OVERDUE":
      case "เกินกำหนด":
        return <Badge variant="error" className="rounded-none">เกินกำหนด</Badge>;
      case "PENDING":
      case "รอชำระ":
        return <Badge variant="info" className="rounded-none">รอชำระ</Badge>;
      default:
        return <Badge variant="info" className="rounded-none">{status || "ไม่ทราบสถานะ"}</Badge>;
    }
  };

  // Helper สำหรับแปลงวันที่
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return isNaN(date.getTime())
      ? dateStr
      : date.toLocaleDateString("th-TH", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
  };

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-slate-800 font-sans">
      <div className="flex-1 flex flex-col min-w-0">
        {/* PAGE CONTENT */}
        <main className="p-6 space-y-6 flex-1">
          {/* Section Title */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <Text variant="xs" className="text-[#E51C23] uppercase tracking-wider mb-0">
                บันทึกบิลขายสินค้า
              </Text>
              <Heading level="h1" weight="normal" className="mb-0 text-[#1C1B1B]">
                ประวัติการขายสินค้า
              </Heading>
            </div>
          </div>

          {/* Filter Bar */}
          <Card className="bg-[#F6F3F2] rounded-none shadow-none border-y border-r border-gray-200 border-l-4 border-l-[#E51C23]">
            <CardContent className="p-6 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                
                {/* ช่องที่ 1: ค้นหาคำ */}
                <div className="md:col-span-3 flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-[#5F5E5E]">
                    ค้นหาเลขคำสั่งซื้อ/ชื่อลูกค้า
                  </label>
                  <div className="relative flex-1">
                    <ScanBarcode className="absolute left-4 top-3.5 text-gray-400 z-10" size={18} />
                    <Input
                      placeholder="สแกนบาร์โค้ด / INV-2024-XXX หรือ ชื่อลูกค้า"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      autoFocus
                      className="bg-white border-none rounded-none h-11 text-sm font-normal text-[#1C1B1B] placeholder:text-[#6B7280] placeholder:font-light pl-11 pr-3 shadow-none focus-visible:ring-0 w-full"
                    />
                  </div>
                </div>

                {/* ช่องที่ 2: ช่วงวันที่ (Start Date) */}
                <div className="md:col-span-3 flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-[#5F5E5E]">
                    วันที่เริ่มต้น
                  </label>
                  <div className="relative">
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-white border-none rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 pr-10 shadow-none focus-visible:ring-0 cursor-pointer"
                    />
                    <Calendar className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-[#1C1B1B] pointer-events-none stroke-[1.75]" />
                  </div>
                </div>

                {/* ช่องที่ 3: ประเภทลูกค้า */}
                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-[#5F5E5E]">
                    ประเภทลูกค้า
                  </label>
                  <Select
                    value={customerType}
                    onChange={(e) => setCustomerType(e.target.value)}
                    placeholder="ทั้งหมด"
                    className="bg-white border-none rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 shadow-none focus-visible:ring-0"
                    options={[
                      { label: "ทั้งหมด", value: "" },
                      { label: "บุคคลทั่วไป / ขาจร", value: "individual" },
                      { label: "อู่ซ่อมรถ / สมาชิก", value: "company" },
                    ]}
                  />
                </div>

                {/* ช่องที่ 4: การชำระเงิน */}
                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-[#5F5E5E]">
                    การชำระเงิน
                  </label>
                  <Select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    placeholder="วิธีการทั้งหมด"
                    className="bg-white border-none rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 shadow-none focus-visible:ring-0"
                    options={[
                      { label: "วิธีการทั้งหมด", value: "" },
                      { label: "เงินสด (CASH)", value: "CASH" },
                      { label: "โอนเงิน / เครดิต", value: "TRANSFER" },
                    ]}
                  />
                </div>

                {/* ช่องที่ 5: ปุ่มใช้ตัวกรอง */}
                <div className="md:col-span-2">
                  <Button
                    onClick={handleApplyFilter}
                    className="w-full h-11 rounded-none bg-[#E51C23] hover:bg-[#c9151b] text-white text-sm font-normal transition-colors border-none shadow-none cursor-pointer"
                  >
                    ใช้ตัวกรอง
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Data Table */}
          <Card className="bg-white rounded-none shadow-sm overflow-hidden border border-gray-200">
            <table className="w-full text-left border-collapse">
              {/* Header Table */}
              <TableHeader className="bg-[#F6F3F2] rounded-none border-b border-gray-200 text-[11px] text-[#6B7280] uppercase tracking-wider">
                <TableRow>
                  <TableHead className="py-3 px-4 w-[14%]">หมายเลขคำสั่งซื้อ</TableHead>
                  <TableHead className="py-3 px-4 w-[18%]">วันที่ทำรายการ</TableHead>
                  <TableHead className="py-3 px-4 w-[28%]">ชื่อลูกค้า/อู่ซ่อมรถ/บริษัท</TableHead>
                  <TableHead className="py-3 px-4 text-right w-[12%]">จำนวนเงิน</TableHead>
                  <TableHead className="py-3 px-4 text-center w-[10%]">การชำระเงิน</TableHead>
                  <TableHead className="py-3 px-4 text-center w-[10%]">สถานะ</TableHead>
                  <TableHead className="py-3 px-4 text-center w-[8%]">จัดการ</TableHead>
                </TableRow>
              </TableHeader>

              {/* Body Table */}
              <tbody className="divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <Text variant="small" className="text-gray-500 mb-0">กำลังโหลดข้อมูล...</Text>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <Text variant="small" className="text-red-500 mb-0">{error}</Text>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <Text variant="small" className="text-gray-400 mb-0">ไม่พบรายการประวัติการขาย</Text>
                    </td>
                  </tr>
                ) : (
                  items.map((item: SalesHistoryItemResponse) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      {/* 1. หมายเลขคำสั่งซื้อ */}
                      <td className="py-3.5 px-4">
                        <Text variant="small" className="font-medium text-[#1C1B1B] mb-0">
                          {item.order_number}
                        </Text>
                      </td>

                      {/* 2. วันที่ทำรายการ */}
                      <td className="py-3.5 px-4">
                        <Text variant="xs" className="font-light text-[#5B5B5B] mb-0">
                          {formatDate(item.order_date || item.created_at)}
                        </Text>
                      </td>

                      {/* 3. ชื่อลูกค้า + เบอร์โทรศัพท์ */}
                      <td className="py-3.5 px-4">
                        <Text variant="small" className="font-normal text-[#1C1B1B] mb-0">
                          {getDisplayCustomerName(item)}
                        </Text>
                        <Text variant="xs" className="font-light text-[#A8A29E] mb-0">
                          {item.phone_number || item.customer_phone_temp || "-"}
                        </Text>
                      </td>

                      {/* 4. จำนวนเงิน */}
                      <td className="py-3.5 px-4 text-right">
                        <Text variant="small" className="font-medium text-[#1C1B1B] mb-0">
                          ฿{(item.total_amount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                        </Text>
                      </td>

                      {/* 5. วิธีการชำระเงิน */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block px-2 py-0.5 bg-[#F6F3F2] rounded-none">
                          <Text variant="xs" className="font-medium text-[#5F5E5E] tracking-wide mb-0">
                            {item.payment_method_name || "-"}
                          </Text>
                        </span>
                      </td>

                      {/* 6. สถานะ */}
                      <td className="py-3.5 px-4 text-center">
                        {renderStatusBadge(item.status, item.payment_status)}
                      </td>

                      {/* 7. ปุ่มจัดการ */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          className="inline-flex items-center justify-center p-1.5 text-[#E51C23] hover:text-[#c9151b] transition-colors cursor-pointer"
                          title="ดูรายละเอียด"
                          onClick={() => alert(`ดูรายละเอียดคำสั่งซื้อ: ${item.order_number}`)}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {!isLoading && !error && totalRows > 0 && (
              <div className="bg-[#FCFBFA] px-6 py-4 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500">
                {/* ฝั่งซ้าย: สรุปจำนวนรายการ และ Selector */}
                <div className="flex items-center gap-4">
                  <Text variant="xs" className="text-[#5F5E5E] mb-0">
                    แสดง {Math.min((page - 1) * limit + 1, totalRows)} ถึง{" "}
                    {Math.min(page * limit, totalRows)} จาก {totalRows} ใบสั่งซื้อ
                  </Text>

                  <div className="flex items-center gap-2">
                    <Text variant="xs" className="text-[#5F5E5E] mb-0">
                      รายการต่อหน้า:
                    </Text>
                    <select
                      value={limit}
                      onChange={(e) => {
                        setLimit(Number(e.target.value));
                        setPage(1);
                      }}
                      className="border border-gray-200 rounded-none px-2 py-1 text-gray-700 bg-white hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-300 cursor-pointer"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>

                {/* ฝั่งขวา: Controls Navigation */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={page === 1}
                    onClick={() => setPage(1)}
                    aria-label="หน้าแรก"
                    className="p-1.5 rounded-none text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    disabled={page === 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    aria-label="หน้าก่อนหน้า"
                    className="p-1.5 rounded-none text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {getPageNumbers(page, totalPages).map((p, idx) =>
                    p === "..." ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-gray-400 select-none">
                        ...
                      </span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPage(Number(p))}
                        aria-current={page === p ? "page" : undefined}
                        className={cn(
                          "px-3 py-1.5 rounded-none font-medium text-xs transition-colors cursor-pointer",
                          page === p
                            ? "bg-[#E51C23] text-white"
                            : "text-gray-600 hover:bg-gray-100 border border-transparent"
                        )}
                      >
                        {p}
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    disabled={page === totalPages}
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    aria-label="หน้าถัดไป"
                    className="p-1.5 rounded-none text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    disabled={page === totalPages}
                    onClick={() => setPage(totalPages)}
                    aria-label="หน้าสุดท้าย"
                    className="p-1.5 rounded-none text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </Card>
        </main>
      </div>
    </div>
  );
}