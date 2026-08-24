import {
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ScanBarcode,
  X,
} from "lucide-react";

// Components
import Heading from "../../../components/elements/heading";
import Text from "../../../components/elements/text";
import Input from "../../../components/elements/input";
import Select from "../../../components/elements/select";
import Button from "../../../components/elements/button";
import Badge from "../../../components/elements/badge";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "../../../components/elements/table";
import { Card, CardContent } from "../../../components/elements/card";
import { cn } from "../../../utils/component";

// Hooks & Helpers
import { usePaymentHistory } from "./hooks/usePaymentHistory";
import type { PaymentHistoryItem } from "../../../interface/pos/payment_interface";
import { getDisplayCustomerName, getPageNumbers, getPaymentVariant } from "../../../utils/poshelpers";
import { formatDate } from "../../../utils/date";
import { useUserRole } from "../../../hooks/useUserRole";


export default function PaymentHistoryPage() {
  const { isOwnerOrAdmin } = useUserRole();

  const {
    items,
    totalRows,
    totalPages,
    isLoading,
    error,
    search, 
    typeFilter,
    paymentMethod,
    employeeId,
    employeeList,
    startDate,
    endDate,
    page,
    limit,
    selectedReceipt,
    cancelReason,
    isCancelling,
    setSearch,
    setTypeFilter,
    setPaymentMethod,
    setEmployeeId,
    setStartDate,
    setEndDate,
    setPage,
    setLimit,
    setSelectedReceipt,
    setCancelReason,
    handleApplyFilter,
    handleCancelReceipt,
  } = usePaymentHistory();

  const formatCurrency = (val: number) => {
    return (val || 0).toLocaleString("th-TH", {
      minimumFractionDigits: 2,
    });
  };

  return (
    <div className="relative flex min-h-screen bg-[#F8F9FA] text-slate-800 font-sans overflow-x-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        <main className="p-6 space-y-6 flex-1">
          {/* Section Title */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <Text variant="xs" className="text-[#E51C23] uppercase tracking-wider mb-0">
                บันทึกรายการรับชำระเงินและตัดหนี้ที่คุณทำรายการ
              </Text>
              <Heading level="h1" weight="normal" className="mb-0 text-[#1C1B1B]">
                ประวัติการชำระเงิน
              </Heading>
            </div>
          </div>

          {/* Filter Bar */}
          <Card className="bg-[#F6F3F2] rounded-none shadow-none border-y border-r border-gray-200 border-l-4 border-l-[#E51C23] overflow-hidden">
            <CardContent className="p-5 md:p-6 space-y-4">
              {/* ช่องที่ 1: ค้นหาคำ */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className={cn("flex flex-col gap-1.5", isOwnerOrAdmin ? "md:col-span-8" : "md:col-span-12")}>
                  <Text variant="xs" className="text-[#5F5E5E]">
                    ค้นหาเลขที่ใบเสร็จ / หมายเลขบิล / ชื่อลูกค้า
                  </Text>
                  <div className="relative flex-1">
                    <ScanBarcode
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10"
                      size={18}
                    />
                    <Input
                      placeholder="พิมพ์เลขที่ใบเสร็จ RE-XXX, INV-XXX หรือชื่อลูกค้า..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      autoFocus
                      className="w-full h-10 bg-white border border-gray-200 rounded-none pl-11 pr-4 text-sm text-[#1C1B1B] font-light focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 shadow-sm transition-all placeholder:text-[#6B7280]"
                    />
                  </div>
                </div>

                {/* ช่องที่ 2: พนักงานขาย (เฉพาะเจ้าของร้าน 4/12) */}
                {isOwnerOrAdmin && (
                  <div className="md:col-span-4 flex flex-col gap-1.5">
                    <Text variant="xs" className="text-[#5F5E5E]">
                      พนักงานผู้รับเงิน
                    </Text>
                    <Select
                      value={employeeId}
                      onChange={(e: any) => setEmployeeId(e.target.value)}
                      placeholder="พนักงานทุกคน"
                      className="bg-white border-none rounded-none h-10 text-sm font-normal text-[#1C1B1B] px-3 shadow-none focus-visible:ring-0 cursor-pointer"
                      options={[
                        { label: "พนักงานทุกคน", value: "" },
                        ...employeeList,
                      ]}
                    />
                  </div>
                )}
              </div>

              {/* บรรทัดที่ 2: ตัวกรองประเภท + วันที่ + ช่องทาง + ปุ่มค้นหา */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end pt-1 border-t border-gray-200/60">
                <div className="md:col-span-3 lg:col-span-2 flex flex-col gap-1.5">
                  <Text variant="xs" className="text-[#5F5E5E]">
                    วันที่เริ่มต้น
                  </Text>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-white border-none rounded-none h-10 text-sm font-normal text-[#1C1B1B] px-3 shadow-none focus-visible:ring-0 cursor-pointer [&::-webkit-calendar-picker-indicator]:pr-2"
                  />
                </div>

                <div className="md:col-span-3 lg:col-span-2 flex flex-col gap-1.5">
                  <Text variant="xs" className="text-[#5F5E5E]">
                    วันที่สิ้นสุด
                  </Text>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-white border-none rounded-none h-10 text-sm font-normal text-[#1C1B1B] px-3 shadow-none focus-visible:ring-0 cursor-pointer [&::-webkit-calendar-picker-indicator]:pr-2"
                  />
                </div>

                <div className="md:col-span-3 lg:col-span-3 flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-[#5F5E5E]">
                    ประเภทการรับชำระ
                  </label>
                  <Select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    placeholder="ทั้งหมด"
                    className="bg-white border-none rounded-none h-10 text-sm font-normal text-[#1C1B1B] px-3 shadow-none focus-visible:ring-0 cursor-pointer"
                    options={[
                      { label: "ทั้งหมด", value: "" },
                      { label: "ชำระสดหน้าร้าน (เปิดบิล)", value: "payment" },
                      { label: "ชำระหนี้เงินเชื่อ (เคลียร์บิล)", value: "repayment" },
                    ]}
                  />
                </div>

                <div className="md:col-span-3 lg:col-span-3 flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-[#5F5E5E]">
                    ช่องทางชำระเงิน
                  </label>
                  <Select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    placeholder="ทุกช่องทาง"
                    className="bg-white border-none rounded-none h-10 text-sm font-normal text-[#1C1B1B] px-3 shadow-none focus-visible:ring-0 cursor-pointer"
                    options={[
                      { label: "ทุกช่องทาง", value: "" },
                      { label: "เงินสด", value: "เงินสด" },
                      { label: "เงินโอน / สแกน QR", value: "QR" },
                    ]}
                  />
                </div>

                <div className="md:col-span-12 lg:col-span-2">
                  <Button
                    onClick={handleApplyFilter}
                    className="w-full h-10 rounded-none bg-[#E51C23] hover:bg-[#c9151b] text-white text-sm font-normal transition-colors border-none shadow-none cursor-pointer"
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
              <TableHeader className="bg-[#F6F3F2] rounded-none border-b border-gray-200 text-[11px] text-[#6B7280] uppercase tracking-wider">
                <TableRow>
                  <TableHead className="py-3 px-3 w-[15%]">เลขที่ใบเสร็จ</TableHead>
                  <TableHead className="py-3 px-3 w-[13%]">วันที่ - เวลา</TableHead>
                  <TableHead className="py-3 px-3 w-[18%]">ชื่อลูกค้า / บิลที่ชำระ</TableHead>
                  <TableHead className="py-3 px-3 w-[12%]">ประเภทการชำระ</TableHead>
                  <TableHead className="py-3 px-3 text-left w-[12%]">ผู้บันทึกยอด</TableHead>
                  <TableHead className="py-3 px-3 text-right w-[11%]">ยอดเงินที่รับ</TableHead>
                  <TableHead className="py-3 px-3 text-center w-[11%]">ช่องทาง</TableHead>
                  <TableHead className="py-3 px-3 text-center w-[8%]">จัดการ</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-200">
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center">
                      <Text variant="small" className="text-gray-500 mb-0">
                        กำลังโหลดข้อมูลประวัติการชำระเงิน...
                      </Text>
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center">
                      <Text variant="small" className="text-red-500 mb-0">
                        {error}
                      </Text>
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center">
                      <Text variant="small" className="text-gray-400 mb-0">
                        ไม่พบรายการประวัติการชำระเงิน
                      </Text>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item: PaymentHistoryItem) => (
                    <TableRow
                      key={`${item.payment_type}-${item.receipt_id}-${item.receipt_number}`}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      {/* 1. เลขที่ใบเสร็จ */}
                      <TableCell className="py-3.5 px-4">
                        <Text variant="small" className="font-normal text-[#1C1B1B] mb-0">
                          {item.receipt_number}
                        </Text>
                      </TableCell>

                      {/* 2. วันที่ทำรายการ */}
                      <TableCell className="py-3.5 px-4">
                        <Text variant="xs" className="font-light text-[#5B5B5B] mb-0">
                          {formatDate(item.paid_at)}
                        </Text>
                      </TableCell>

                      {/* 3. ชื่อลูกค้า + เลขที่บิล */}
                      <TableCell className="py-3.5 px-4 truncate">
                        <Text variant="small" className="font-normal text-[#1C1B1B] mb-0 truncate">
                          {getDisplayCustomerName(item)}
                        </Text>
                        <Text variant="xs" className="font-light text-[#A8A29E] mb-0">
                          บิล: {item.order_numbers || "-"}
                        </Text>
                      </TableCell>

                      {/* 4. ประเภทการชำระ */}
                      <TableCell className="py-3.5 px-4">
                        <Badge variant={item.payment_type}>
                          {item.payment_type === "payment" ? "ชำระสดหน้าร้าน" : "เคลียร์หนี้เงินเชื่อ"}
                        </Badge>
                      </TableCell>

                      {/* 5. ผู้บันทึกยอด */}
                      <TableCell className="py-3.5 px-4 truncate">
                        <Text variant="xs" className="font-normal text-[#1C1B1B] mb-0">
                          {item.received_by_name || "-"}
                        </Text>
                      </TableCell>

                      {/* 6. ยอดเงินที่รับ */}
                      <TableCell className="py-3.5 px-4 text-right">
                        <Text variant="small" className="font-normal text-[#1C1B1B] mb-0">
                          {formatCurrency(item.total_received)}
                        </Text>
                      </TableCell> 

                      {/* 7. ช่องทางชำระเงิน */}
                      <TableCell className="py-3.5 px-4 text-center">
                        <Badge variant={getPaymentVariant(item.payment_method)}>
                          {item.payment_method || "เงินสด"}
                        </Badge>
                      </TableCell>

                      {/* 8. ปุ่มดูรายละเอียด / ยกเลิก */}
                      <TableCell className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          className="inline-flex items-center justify-center p-1.5 text-[#E51C23] hover:text-[#c9151b] hover:bg-red-50 transition-colors cursor-pointer rounded-full"
                          title="ดูรายละเอียดใบเสร็จ"
                          onClick={() => setSelectedReceipt(item)}
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
                <div className="flex items-center gap-4">
                  <Text variant="xs" className="text-[#5F5E5E] mb-0">
                    แสดง {Math.min((page - 1) * limit + 1, totalRows)} ถึง{" "}
                    {Math.min(page * limit, totalRows)} จาก {totalRows} รายการ
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

      {/* ==================== SLIDE-OVER DRAWER (RECEIPT DETAIL) ==================== */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-none transition-opacity cursor-pointer"
            onClick={() => setSelectedReceipt(null)}
          />

          <aside className="relative z-10 w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-200">
            <div className="flex-1 overflow-y-auto">
              {/* Header */}
              <div className="p-5 border-b border-[#E7BDB8] flex items-start justify-between bg-white">
                <div>
                  <Heading level="h3" weight="normal" className="text-xl text-[#1C1B1B] mb-0.5">
                    รายละเอียดการรับชำระ
                  </Heading>
                  <Text variant="xs" className="text-[#6B7280]">
                    เลขที่ใบเสร็จ:{" "}
                    <span className="font-semibold text-[#1C1B1B]">
                      {selectedReceipt.receipt_number}
                    </span>
                  </Text>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedReceipt(null)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6">
                {/* ข้อมูลการทำรายการ */}
                <div>
                  <Text variant="xs" className="font-normal text-[#E51C23] mb-2">
                    ข้อมูลผู้ชำระเงิน
                  </Text>
                  <Card className="bg-[#F6F3F2] rounded-none border-gray-100 border-l-3 border-l-[#E51C23] shadow-none">
                    <CardContent className="p-4 space-y-1">
                      <Text variant="small" className="font-medium text-[#1C1B1B] mb-0">
                        {getDisplayCustomerName(selectedReceipt)}
                      </Text>
                      <Text variant="xs" className="text-[#6B7280] mb-0">
                        หมายเลขบิลที่เกี่ยวข้อง: {selectedReceipt.order_numbers || "-"}
                      </Text>
                      <Text variant="xs" className="text-[#6B7280] mb-0">
                        วันที่ชำระ: {formatDate(selectedReceipt.paid_at)}
                      </Text>
                      <Text variant="xs" className="text-[#6B7280] mb-0">
                        ผู้บันทึกยอด: {selectedReceipt.received_by_name || "-"}
                      </Text>
                    </CardContent>
                  </Card>
                </div>

                {/* กล่องสรุปยอดรับเงิน */}
                <Card className="bg-[#1C1B1B] rounded-none border-none shadow-none">
                  <CardContent className="p-4 space-y-2.5">
                    <div className="flex justify-between text-white">
                      <Text variant="xs" className="text-[#9CA3AF] mb-0">
                        ประเภทธุรกรรม
                      </Text>
                      <Text variant="xs" className="font-normal text-white mb-0">
                        {selectedReceipt.payment_type === "payment" ? "ชำระสดหน้าร้าน" : "ชำระหนี้เงินเชื่อ"}
                      </Text>
                    </div>

                    <div className="border-t border-[#9CA3AF] pt-2.5 flex justify-between">
                      <Text variant="small" className="font-normal text-white mb-0">
                        ยอดเงินที่รับชำระ
                      </Text>
                      <Text variant="small" className="font-normal text-white mb-0">
                        {formatCurrency(selectedReceipt.total_received)}
                      </Text>
                    </div>

                    <div className="pt-2 flex justify-end items-center gap-2">
                      <Badge variant={getPaymentVariant(selectedReceipt.payment_method)}>
                        {selectedReceipt.payment_method || "เงินสด"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* สิทธิ์ Owner/Admin ในการขอยกเลิกใบเสร็จ */}
                {isOwnerOrAdmin && (
                  <div className="space-y-3 pt-2">
                    <Text variant="xs" className="font-normal text-[#E51C23] uppercase tracking-wider mb-1">
                      ระบุเหตุผลในการยกเลิกใบเสร็จรับเงิน (ทำให้ยอดหนี้กลับมาค้างชำระ)
                    </Text>

                    <textarea
                      rows={3}
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="ตัวอย่าง: คีย์รับเงินผิดคน / ลูกค้าแจ้งขอแก้ไขช่องทางจ่ายเงิน..."
                      className="w-full p-2.5 text-xs font-light bg-[#F6F3F2] border border-[#E51C23] rounded-none focus:outline-none text-[#1C1B1B] placeholder-[#6B7280] resize-none"
                    />

                    <div className="flex gap-3 pt-1">
                      <Button
                        type="button"
                        variant="solid-red"
                        onClick={handleCancelReceipt}
                        disabled={isCancelling}
                        className="flex-1 text-sm h-11 font-normal"
                      >
                        {isCancelling ? "กำลังยกเลิกรายการ..." : "ยืนยันยกเลิกใบเสร็จนี้"}
                      </Button>

                      <Button
                        type="button"
                        variant="outline-cancel"
                        onClick={() => setSelectedReceipt(null)}
                        className="text-sm px-6 h-11 border border-gray-200 text-[#5F5E5E] hover:bg-[#F6F3F2] font-normal"
                      >
                        ปิด
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}