import React, { useState } from "react";
import {
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ScanBarcode,
  X,
} from "lucide-react";

// นำเข้า Components
import Heading from "../../../components/elements/heading";
import Text from "../../../components/elements/text";
import Input from "../../../components/elements/input";
import Select from "../../../components/elements/select";
import Button from "../../../components/elements/button";
import Badge from "../../../components/elements/badge";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "../../../components/elements/table";
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
  // --- State สำหรับ Slide Drawer รายละเอียดออเดอร์ ---
  const [selectedOrder, setSelectedOrder] = useState<SalesHistoryItemResponse | null>(null);

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
    // States สำหรับ Drawer
    selectedOrderId,
    setSelectedOrderId,
    orderDetail,
    isDetailLoading,
    cancelReason,
    setCancelReason,
  } = useSalesHistory();

  // --- Helper Render Status Badge ---
  const renderStatusBadge = (status: string, paymentStatus: string) => {
    const billStatus = (status || "").trim().toUpperCase();
    const payStatus = (paymentStatus || "").trim().toUpperCase();

    // 1. เช็กการยกเลิกก่อน
    if (billStatus === "PENDING_CANCEL") {
      return <Badge variant="error" className="rounded-none whitespace-nowrap">ส่งคำขอยกเลิกแล้ว</Badge>;
    }

    if (billStatus === "CANCELLED" || billStatus === "ยกเลิก") {
      return <Badge variant="error" className="rounded-none whitespace-nowrap">ยกเลิกแล้ว</Badge>;
    }

    // 2. ถ้าชำระเงินครบถ้วนแล้ว (paid) -> แสดง "ชำระแล้ว"
    if (payStatus === "PAID" || payStatus === "ชำระแล้ว") {
      return <Badge variant="success" className="rounded-none whitespace-nowrap">ชำระแล้ว</Badge>;
    }

    // 3. ถ้าเป็นบิลเงินเชื่อที่ทำรายการเสร็จแล้ว แต่ยังไม่ชำระ (completed + unpaid/partial)
    if (billStatus === "COMPLETED") {
      return <Badge variant="info" className="rounded-none whitespace-nowrap">ทำรายการแล้ว</Badge>;
    }

    // 4. สถานะรอดำเนินการ / รอตอบรับ
    if (billStatus === "PENDING") {
      return <Badge variant="neutral" className="rounded-none whitespace-nowrap">รอดำเนินการ</Badge>;
    }

    if (billStatus === "OVERDUE" || payStatus === "OVERDUE") {
      return <Badge variant="error" className="rounded-none whitespace-nowrap">เกินกำหนด</Badge>;
    }

    // default สำรองกรณีค่าอื่น
    return <Badge variant="info" className="rounded-none whitespace-nowrap">{status || "ไม่ทราบสถานะ"}</Badge>;
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

  const getPaymentBadgeColor = (methodName?: string) => {
    switch (methodName) {
      case "เงินเชื่อ":
        return "bg-blue-500"; 
      case "เงินโอน/สแกน QR":
        return "bg-gray-500"; 
      case "เงินสด":
      default:
        return "bg-[#259B24]"; 
    }
  };

  const getPaymentVariant = (methodName?: string) => {
    switch (methodName) {
      case "เงินเชื่อ":
        return "credit";
      case "เงินโอน/สแกน QR":
        return "transfer";
      case "เงินสด":
        return "cash";
      default:
        return "neutral"; // คืนค่าสีเทาไว้กรณีเป็นค่า null หรือ "-"
    }
  };

  return (
    <div className="relative flex min-h-screen bg-[#F8F9FA] text-slate-800 font-sans overflow-x-hidden">
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
          <Card className="bg-[#F6F3F2] rounded-none shadow-none border-y border-r border-gray-200 border-l-4 border-l-[#E51C23] overflow-hidden">
            <CardContent className="p-6 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                
                {/* ช่องที่ 1: ค้นหาคำ */}
                <div className="md:col-span-3 flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-[#5F5E5E]">
                    ค้นหาเลขคำสั่งซื้อ/ชื่อลูกค้า
                  </label>
                  <div className="relative flex-1">
                    <ScanBarcode className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10" size={18} />
                    <Input
                      placeholder="สแกนบาร์โค้ด / INV-2024-XXX หรือ ชื่อลูกค้า"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      autoFocus
                      className="w-full h-11 bg-white border border-gray-200 rounded-none pl-12 pr-4 text-sm text-[#1C1B1B] font-light focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 shadow-sm transition-all placeholder:text-[#6B7280] placeholder:font-light"
                    />
                  </div>
                </div>

                {/* ช่องที่ 2: วันที่เริ่มต้น (Start Date) */}
                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-[#5F5E5E]">
                    วันที่เริ่มต้น
                  </label>
                  <div className="relative">
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-white border-none rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 shadow-none focus-visible:ring-0 cursor-pointer [&::-webkit-calendar-picker-indicator]:pr-4"
                    />
                  </div>
                </div>

                {/* ช่องที่ 2.5: วันที่สิ้นสุด (End Date) */}
                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-[#5F5E5E]">
                    วันที่สิ้นสุด
                  </label>
                  <div className="relative">
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-white border-none rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 shadow-none focus-visible:ring-0 cursor-pointer [&::-webkit-calendar-picker-indicator]:pr-4"
                    />
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
                      { label: "ลูกค้าทั่วไป (ขาจร)", value: "GENERAL" },  
                      { label: "ลูกค้าอู่ซ่อมรถ", value: "GARAGE" },      
                      { label: "ลูกค้าบริษัท", value: "WHOLESALE" }     
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
                      { label: "ทั้งหมด", value: "" },
                      { label: "เงินสด", value: "CASH" },
                      { label: "เงินโอน", value: "QR" },
                      { label: "เงินเชื่อ", value: "CREDIT"}
                    ]}
                  />
                </div>

                {/* ช่องที่ 5: ปุ่มใช้ตัวกรอง */}
                <div className="md:col-span-1">
                  <Button
                    onClick={handleApplyFilter}
                    className="w-full h-11 rounded-none bg-[#E51C23] hover:bg-[#c9151b] text-white text-sm font-normal transition-colors border-none shadow-none cursor-pointer"
                  >
                    ค้นหา
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Data Table */}
          <Card className="bg-white rounded-none shadow-sm overflow-hidden border border-gray-200">
            <Table className="!w-full !min-w-0 table-fixed text-left border-collapse">
              {/* Header Table */}
              <TableHeader className="bg-[#F6F3F2] rounded-none border-b border-gray-200 text-[11px] text-[#6B7280] uppercase tracking-wider">
                <TableRow>
                  <TableHead className="py-3 px-3 w-[16%]">หมายเลขคำสั่งซื้อ</TableHead>
                  <TableHead className="py-3 px-3 w-[14%]">วันที่ทำรายการ</TableHead>
                  <TableHead className="py-3 px-3 w-[26%]">ชื่อลูกค้า/อู่ซ่อมรถ/บริษัท</TableHead>
                  <TableHead className="py-3 px-3 text-right w-[12%]">จำนวนเงิน</TableHead>
                  <TableHead className="py-3 px-3 text-center w-[12%]">การชำระเงิน</TableHead>
                  <TableHead className="py-3 px-3 text-center w-[12%]">สถานะ</TableHead>
                  <TableHead className="py-3 px-3 text-center w-[8%]">จัดการ</TableHead>
                </TableRow>
              </TableHeader>

              {/* Body Table */}
              <TableBody className="divide-y divide-gray-200">
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center">
                      <Text variant="small" className="text-gray-500 mb-0">กำลังโหลดข้อมูล...</Text>
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center">
                      <Text variant="small" className="text-red-500 mb-0">{error}</Text>
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center">
                      <Text variant="small" className="text-gray-400 mb-0">ไม่พบรายการประวัติการขาย</Text>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item: SalesHistoryItemResponse) => (
                    <TableRow key={item.id} className="hover:bg-slate-50 transition-colors">
                      {/* 1. หมายเลขคำสั่งซื้อ */}
                      <TableCell className="py-3.5 px-4">
                        <Text variant="small" className="font-normal text-[#1C1B1B] mb-0">
                          {item.order_number}
                        </Text>
                      </TableCell>

                      {/* 2. วันที่ทำรายการ */}
                      <TableCell className="py-3.5 px-4">
                        <Text variant="xs" className="font-light text-[#5B5B5B] mb-0">
                          {formatDate(item.order_date || item.created_at)}
                        </Text>
                      </TableCell>

                      {/* 3. ชื่อลูกค้า + เบอร์โทรศัพท์ */}
                      <TableCell className="py-3.5 px-4 truncate">
                        <Text variant="small" className="font-normal text-[#1C1B1B] mb-0 truncate">
                          {getDisplayCustomerName(item)}
                        </Text>
                        <Text variant="xs" className="font-light text-[#A8A29E] mb-0">
                          {item.phone_number || item.customer_phone_temp || "-"}
                        </Text>
                      </TableCell>

                      {/* 4. จำนวนเงิน */}
                      <TableCell className="py-3.5 px-4 text-right">
                        <Text variant="small" className="font-normal text-[#1C1B1B] mb-0">
                          {(item.total_amount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                        </Text>
                      </TableCell>

                      {/* 5. วิธีการชำระเงิน */}
                      <TableCell className="py-3.5 px-4 text-center">
                        <Badge variant={getPaymentVariant(item.payment_method_name)}>
                          {item.payment_method_name || "-"}
                        </Badge>
                      </TableCell>

                      {/* 6. สถานะ */}
                      <TableCell className="py-3.5 px-4 text-center">
                        {renderStatusBadge(item.status, item.payment_status)}
                      </TableCell>

                      {/* 7. ปุ่มจัดการ */}
                      <TableCell className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          className="inline-flex items-center justify-center p-1.5 text-[#E51C23] hover:text-[#c9151b] hover:bg-red-50 transition-colors cursor-pointer rounded-full"
                          title="ดูรายละเอียด"
                          onClick={() => setSelectedOrderId(item.id)}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody> 
            </Table>

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

      {/* ==================== SLIDE-OVER DRAWER (REAL DATA) ==================== */}
      {selectedOrderId && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop ฉากหลังมืด */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-none transition-opacity cursor-pointer"
            onClick={() => setSelectedOrderId(null)}
          />

          {/* Drawer Panel */}
          <aside className="relative z-10 w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-200">
            
            {/* Header Drawer */}
            {isDetailLoading ? (
              <div className="flex-1 flex items-center justify-center p-6">
                <Text variant="small" className="text-gray-500">กำลังโหลดข้อมูลออเดอร์...</Text>
              </div>
            ) : orderDetail ? (
              <div className="flex-1 overflow-y-auto">
                {/* Header */}
                <div className="p-5 border-b border-[#E7BDB8] flex items-start justify-between bg-white">
                  <div>
                    <Heading level="h3" weight="normal" className="text-xl text-[#1C1B1B] mb-0.5">
                      รายละเอียดออเดอร์
                    </Heading>
                    <Text variant="xs" className="text-[#6B7280]">
                      หมายเลขบิล: <span className="font-semibold text-[#1C1B1B]">{orderDetail.order_number}</span>
                    </Text>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedOrderId(null)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Scrollable Body Content */}
                <div className="p-6 space-y-6">
                  {/* ข้อมูลลูกค้า */}
                  <div>
                    <Text variant="xs" className="font-normal text-[#E51C23] mb-2">
                      ข้อมูลลูกค้า
                    </Text>
                    <Card className="bg-[#F6F3F2] rounded-none  border-gray-100 border-l-3 border-l-[#E51C23] shadow-none">
                      <CardContent className="p-4 space-y-1">
                        <Text variant="small" className="font-medium text-[#1C1B1B] mb-0">
                          {getDisplayCustomerName(orderDetail as unknown as SalesHistoryItemResponse)}
                        </Text>
                        <Text variant="small" className="text-[#6B7280] mb-0">
                          {orderDetail.phone_number || orderDetail.customer_phone_temp || "-"}
                        </Text>
                        {orderDetail.customer_type_name && (
                          <Text variant="xs" className="text-[#6B7280] mb-0">
                            ประเภท: {orderDetail.customer_type_name}
                          </Text>
                        )}

                        {orderDetail.address && (
                          <Text variant="xs" className="text-[#6B7280] mb-0 truncate">
                            ที่อยู่: {orderDetail.address}
                          </Text>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* รายการสินค้าจริง */}
                  <div>
                    <Text variant="xs" className="font-normal text-[#E51C23] mb-3">
                      รายการสินค้า ({orderDetail.items?.length || 0})
                    </Text>
                    <div className="divide-y divide-gray-100">
                      {orderDetail.items && orderDetail.items.map((prod) => (
                        <div key={prod.id} className="flex items-center justify-between py-3 first:pt-0">
                          <div className="flex items-center gap-3">
                            <div>
                              <Text variant="small" className="font-medium text-[#1C1B1B] mb-0">
                                {prod.product_name}
                              </Text>
                              <Text variant="xs" className="font-normal text-[#1C1B1B] mb-0">
                                {prod.part_number && `รหัสสินค้า: ${prod.part_number}`}
                              </Text>
                              <Text variant="xs" className="font-normal text-[#6B7280] mb-0">
                                QTY: {prod.qty} {prod.unit} | {prod.unit_price.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                              </Text>
                            </div>
                          </div>
                          <Text variant="small" className="font-normal text-[#1C1B1B] mb-0">
                            {(prod.subtotal || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                          </Text>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* สรุปยอดเงิน */}
                  <Card className="bg-[#1C1B1B] rounded-none border-none shadow-none">
                    <CardContent className="p-4 space-y-2.5">
                      {/* แถวราคารวมสินค้า */}
                      <div className="flex justify-between text-white">
                        <Text variant="xs" className="text-[#9CA3AF] mb-0">
                          ราคารวมสินค้า
                        </Text>
                        <Text variant="xs" className="font-normal text-white mb-0">
                          {(orderDetail.subtotal || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                        </Text>
                      </div>

                      {/* แถวส่วนลดท้ายบิล */}
                      <div className="flex justify-between text-white">
                        <Text variant="xs" className="text-[#9CA3AF] mb-0">
                          ส่วนลดท้ายบิล
                        </Text>
                        <Text variant="xs" className="font-normal text-white mb-0">
                          {(orderDetail.discount_amount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                        </Text>
                      </div>

                      {/* แถวส่วนลดรวมทั้งสิ้น*/}
                      <div className="flex justify-between text-white">
                        <Text variant="xs" className="text-[#9CA3AF] mb-0">
                          ส่วนลดรวมทั้งสิ้น
                        </Text>
                        <Text variant="xs" className="font-normal text-white mb-0">
                          {(orderDetail.total_discount_items || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                        </Text>
                      </div>

                      {/* แถวยอดชำระสุทธิ */}
                      <div className="border-t border-[#9CA3AF] pt-2.5 flex justify-between">
                        <Text variant="small" className="font-normal text-white mb-0">
                          ยอดชำระสุทธิ
                        </Text>
                        <Text variant="small" className="font-normal text-white mb-0">
                          {(orderDetail.total_amount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                        </Text>
                      </div>

                      {/* แถววิธีชำระเงิน */}
                      <div className="pt-2 flex justify-end items-center gap-2">
                        <Badge variant={getPaymentVariant(orderDetail.payment_method_name)}>
                          {orderDetail.payment_method_name || "เงินสด"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {/* ฟอร์มระบุเหตุผลในการยกเลิก */}
                  <div className="space-y-3">
                    <Text variant="xs" className="font-normal text-[#E51C23] mb-3">
                      ระบุเหตุผลในการยกเลิก
                    </Text>
                    
                    <textarea
                      rows={3}
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="ตัวอย่าง: ลูกค้าขอยกเลิกออเดอร์เนื่องจากเปลี่ยนใจ..."
                      className="w-full p-2.5 text-sm font-light bg-[#F6F3F2] border border-[#E51C23] rounded-none focus:outline-none text-[#1C1B1B] placeholder-[#6B7280] resize-none"
                    />

                    <div className="flex gap-3 pt-1">
                       {/* ปุ่มยืนยันการขออนุมัติยกเลิก */}
                      <Button
                        type="button"
                        variant="solid-red"
                        className="flex-1 text-sm"
                      >
                        ยืนยันการขออนุมัติยกเลิก
                      </Button>
                      
                      {/* ปุ่มยกเลิก */}
                      <Button
                        type="button"
                        variant="outline-cancel"
                        onClick={() => setSelectedOrderId(null)}
                        className="text-sm px-6"
                      >
                        ยกเลิก
                      </Button>
                    </div>
                  </div>

                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-6">
                <Text variant="small" className="text-red-500">ไม่พบข้อมูลออเดอร์</Text>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}