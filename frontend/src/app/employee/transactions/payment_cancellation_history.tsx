import React from "react";
import Text from "../../../components/elements/text";
import Heading from "../../../components/elements/heading";
import { Card, CardContent } from "../../../components/elements/card";
import Input from "../../../components/elements/input";
import Button from "../../../components/elements/button";
import Select from "../../../components/elements/select";
import Badge from "../../../components/elements/badge";
import {
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ScanBarcode,
  X,
  RotateCcw,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "../../../components/elements/table";
import { cn } from "../../../utils/component";
import {
  formatDate,
  formatCurrency,
  getPageNumbers,
  getPaymentVariant,
  renderPaymentStatusBadge,
} from "../../../utils/poshelpers";
import { usePaymentCancellationHistory } from "./hooks/usePaymentCancellationHistory";
import { useUserRole } from "../../../hooks/useUserRole";
import type { PaymentHistoryItem } from "../../../interface/pos/payment_interface";

const PaymentCancellationHistory: React.FC = () => {
  const { isOwnerOrAdmin } = useUserRole();
  const {
    dataList,
    selectedIds,
    isSelectAll,
    handleSelectAll,
    handleSelectRow,
    handleBatchApprove,
    handleBatchReject,
    handleBatchRevert,
    isLoading,
    error,
    page,
    limit,
    totalRows,
    totalPages,
    setPage,
    setLimit,
    searchQuery,
    setSearchQuery,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    status,
    setStatus,
    paymentType,
    setPaymentType,
    handleSearch,
    selectedReceipt,
    setSelectedReceipt,
    cancelRemark,
    setCancelRemark,
    isProcessing,
    handleApproveCancel,
    handleRejectCancel,
    handleRevertCancel,
  } = usePaymentCancellationHistory();

  return (
    <div className="relative flex min-h-screen bg-[#F8F9FA] text-slate-800 font-sans overflow-x-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        <main className="p-6 space-y-6 flex-1">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <Text variant="xs" className="text-[#E51C23] uppercase tracking-wider mb-0">
                ประวัติและการจัดการคำขอ
              </Text>
              <Heading level="h1" weight="normal" className="mb-0 text-[#1C1B1B]">
                ประวัติการยกเลิกการชำระเงิน
              </Heading>
            </div>
          </div>

          {/* Filter Bar */}
          <Card className="bg-[#F6F3F2] rounded-none shadow-none border-y border-r border-gray-200 border-l-4 border-l-[#E51C23] overflow-hidden">
            <CardContent className="p-6 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                {/* 1. ค้นหาเลขที่ใบเสร็จ/บิล/ชื่อลูกค้า */}
                <div className="md:col-span-3 flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-[#5F5E5E]">
                    ค้นหาเลขที่ใบเสร็จ / บิล / ลูกค้า
                  </label>
                  <div className="relative flex-1">
                    <ScanBarcode className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10" size={18} />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="PAY-XXX / RE-XXX หรือชื่อลูกค้า"
                      autoFocus
                      className="w-full h-11 bg-white border border-gray-200 rounded-none pl-12 pr-4 text-sm text-[#1C1B1B] font-light focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 shadow-sm transition-all placeholder:text-[#6B7280]"
                    />
                  </div>
                </div>

                {/* 2. วันที่เริ่มต้น */}
                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-[#5F5E5E]">วันที่เริ่มต้น</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-white border-none rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 shadow-none cursor-pointer"
                  />
                </div>

                {/* 3. วันที่สิ้นสุด */}
                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-[#5F5E5E]">วันที่สิ้นสุด</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-white border-none rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 shadow-none cursor-pointer"
                  />
                </div>

                {/* 4. ประเภทธุรกรรม */}
                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-[#5F5E5E]">ประเภทการรับชำระ</label>
                  <Select
                    value={paymentType}
                    onChange={(e: any) => setPaymentType(e.target.value)}
                    placeholder="ทั้งหมด"
                    className="bg-white border-none rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 shadow-none"
                    options={[
                      { label: "ทั้งหมด", value: "" },
                      { label: "ชำระสดหน้าร้าน", value: "payment" },
                      { label: "เคลียร์หนี้เงินเชื่อ", value: "repayment" },
                    ]}
                  />
                </div>

                {/* 5. สถานะ */}
                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-[#5F5E5E]">สถานะคำขอ</label>
                  <Select
                    value={status}
                    onChange={(e: any) => setStatus(e.target.value)}
                    placeholder="ทั้งหมด"
                    className="bg-white border-none rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 shadow-none"
                    options={[
                      { label: "ทั้งหมด", value: "" },
                      { label: "รออนุมัติยกเลิก", value: "pending_cancel" },
                      { label: "ยกเลิกแล้ว", value: "cancelled" },
                      { label: "ปฏิเสธคำขอ", value: "rejected" },
                    ]}
                  />
                </div>

                {/* 6. ปุ่มค้นหา */}
                <div className="md:col-span-1">
                  <Button
                    onClick={handleSearch}
                    className="w-full h-11 rounded-none bg-[#E51C23] hover:bg-[#c9151b] text-white text-sm font-normal transition-colors border-none shadow-none cursor-pointer"
                  >
                    ค้นหา
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card className="bg-white rounded-none shadow-sm overflow-hidden border border-gray-200">
            <Table className="text-left border-collapse">
              <TableHeader className="bg-[#F6F3F2] rounded-none border-b border-gray-200 text-[11px] text-[#6B7280] uppercase tracking-wider">
                <TableRow>
                  <TableHead className="py-3 px-3 w-[4%] text-center">
                    <input
                      type="checkbox"
                      checked={isSelectAll}
                      onChange={handleSelectAll}
                      disabled={dataList.filter((item) => (item.status || "").toLowerCase() === "pending_cancel").length === 0}
                      className="w-4 h-4 border border-gray-300 rounded-none bg-white checked:bg-[#E51C23] checked:border-[#E51C23] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 appearance-none flex items-center justify-center after:content-['✓'] after:text-white after:text-[10px] after:font-bold after:hidden checked:after:block"
                    />
                  </TableHead>
                  <TableHead className="py-3 px-3">เลขที่ใบเสร็จ</TableHead>
                  <TableHead className="py-3 px-3">วันที่ชำระเดิม</TableHead>
                  <TableHead className="py-3 px-3">ชื่อลูกค้า / บิลที่ชำระ</TableHead>
                  <TableHead className="py-3 px-3 text-right">ยอดเงิน</TableHead>
                  <TableHead className="py-3 px-3 text-left">ผู้ขอยกเลิก</TableHead>
                  <TableHead className="py-3 px-3">สถานะ</TableHead> 
                  <TableHead className="py-3 px-3 text-center">จัดการ</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-200">
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      กำลังโหลดข้อมูลประวัติการยกเลิก...
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-red-500">
                      {error}
                    </TableCell>
                  </TableRow>
                ) : dataList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      ไม่พบรายการประวัติการยกเลิกการชำระเงิน
                    </TableCell>
                  </TableRow>
                ) : (
                  dataList.map((item: PaymentHistoryItem) => {
                    const isChecked = selectedIds.includes(item.receipt_id);
                    const isPendingCancel = (item.status || "").toLowerCase() === "pending_cancel";
                    return (
                      <TableRow
                        key={`${item.payment_type}-${item.receipt_id}-${item.receipt_number}`}
                        className={isChecked ? "bg-red-50/40" : "hover:bg-slate-50 transition-colors"}
                      >
                        {/* Checkbox */}
                        <TableCell className="py-3.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleSelectRow(item.receipt_id)}
                            disabled={!isPendingCancel}
                            className="w-4 h-4 border border-gray-300 rounded-none bg-white checked:bg-[#E51C23] checked:border-[#E51C23] disabled:bg-gray-100 disabled:border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer appearance-none flex items-center justify-center after:content-['✓'] after:text-white after:text-[10px] after:font-bold after:hidden checked:after:block"
                          />
                        </TableCell>

                        {/* 1. เลขที่ใบเสร็จ */}
                        <TableCell className="py-3.5 px-3">
                          <Text variant="small" className="font-normal text-[#1C1B1B] mb-0 whitespace-nowrap">
                            {item.receipt_number}
                          </Text>
                        </TableCell>

                        {/* 2. วันที่ชำระเดิม */}
                        <TableCell className="py-3.5 px-3">
                          <Text variant="xs" className="font-light text-[#5B5B5B] mb-0 whitespace-nowrap">
                            {formatDate(item.paid_at)}
                          </Text>
                        </TableCell>

                        {/* 3. ชื่อลูกค้า + บิล */}
                        <TableCell className="py-3.5 px-3">
                          <Text variant="small" className="font-normal text-[#1C1B1B] mb-0 truncate max-w-[200px]">
                            {item.customer_name || "ลูกค้าทั่วไป"}
                          </Text>
                          <Text variant="xs" className="font-light text-[#A8A29E] mb-0 truncate max-w-[200px]">
                            บิล: {item.order_numbers || "-"}
                          </Text>
                        </TableCell>

                        {/* 4. ยอดเงิน */}
                        <TableCell className="py-3.5 px-3 text-right">
                          <Text variant="small" className="font-normal text-[#1C1B1B] mb-0 whitespace-nowrap">
                            {formatCurrency(item.total_received)}
                          </Text>
                        </TableCell>

                        {/* 5. ผู้ขอยกเลิก */}
                        <TableCell className="py-3.5 px-3">
                          <Text variant="xs" className="font-normal text-[#1C1B1B] mb-0 whitespace-nowrap">
                            {item.cancel_requested_by_name || item.cancelled_by_name || "-"}
                          </Text>
                        </TableCell>

                        {/* 6. สถานะ */}
                        <TableCell className="py-3.5 px-3">
                          {renderPaymentStatusBadge(item.status)}
                        </TableCell>

                        {/* 7. จัดการ */}
                        <TableCell className="py-3.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedReceipt(item)}
                            className="p-1.5 text-[#E51C23] hover:bg-red-50 rounded-full cursor-pointer transition-colors"
                            title="ดูรายละเอียดคำขอ"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {/* Batch Action Footer (เหมือน sales_cancellation_history.tsx) */}
            <div className="p-4 flex flex-col sm:flex-row justify-between items-center gap-3 bg-white border-t border-gray-100">
              <Text variant="xs" className="text-gray-500 mb-0">
                เลือกอยู่ {selectedIds.length} รายการ
              </Text>
              {isOwnerOrAdmin ? (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    onClick={handleBatchApprove}
                    disabled={selectedIds.length === 0 || isProcessing}
                    variant="approved"
                    className="flex-1 sm:flex-none text-xs px-4 py-2.5 rounded-none cursor-pointer disabled:cursor-not-allowed transition-all"
                  >
                    อนุมัติรายการที่เลือก ({selectedIds.length})
                  </Button>
                  <Button
                    onClick={handleBatchReject}
                    disabled={selectedIds.length === 0 || isProcessing}
                    variant="solid-red"
                    className="flex-1 sm:flex-none text-xs px-4 py-2.5 rounded-none cursor-pointer disabled:cursor-not-allowed transition-all"
                  >
                    ปฏิเสธรายการที่เลือก ({selectedIds.length})
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleBatchRevert}
                  disabled={selectedIds.length === 0 || isProcessing}
                  variant="solid-red"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-xs px-4 py-2.5 rounded-none cursor-pointer disabled:cursor-not-allowed transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>ดึงคำขอยกเลิกกลับที่เลือก ({selectedIds.length})</span>
                </Button>
              )}
            </div>

            {/* Pagination Controls */}
            {!isLoading && !error && totalRows > 0 && (
              <div className="bg-[#FCFBFA] px-6 py-4 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-4">
                  <Text variant="xs" className="text-[#5F5E5E] mb-0">
                    แสดงรายการที่ {Math.min((page - 1) * limit + 1, totalRows)}-
                    {Math.min(page * limit, totalRows)} จากทั้งหมด {totalRows} รายการ
                  </Text>

                  <div className="flex items-center gap-2">
                    <Text variant="xs" className="text-[#5F5E5E] mb-0">รายการต่อหน้า:</Text>
                    <select
                      value={limit}
                      onChange={(e) => {
                        setLimit(Number(e.target.value));
                        setPage(1);
                      }}
                      className="border border-gray-200 rounded-none px-2 py-1 text-gray-700 bg-white cursor-pointer"
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
                    className="p-1.5 border border-gray-200 bg-white text-gray-500 disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    disabled={page === 1}
                    onClick={() => setPage(Math.max(1, page - 1))}
                    className="p-1.5 border border-gray-200 bg-white text-gray-500 disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {getPageNumbers(page, totalPages).map((p, idx) =>
                    p === "..." ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPage(Number(p))}
                        className={cn(
                          "px-3 py-1.5 font-medium text-xs cursor-pointer border",
                          page === p
                            ? "bg-[#E51C23] text-white border-[#E51C23]"
                            : "bg-white text-gray-700 border-gray-200"
                        )}
                      >
                        {p}
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    disabled={page === totalPages}
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    className="p-1.5 border border-gray-200 bg-white text-gray-500 disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    disabled={page === totalPages}
                    onClick={() => setPage(totalPages)}
                    className="p-1.5 border border-gray-200 bg-white text-gray-500 disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </Card>
        </main>
      </div>

      {/* ==================== SLIDE-OVER DRAWER ==================== */}
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
                    รายละเอียดการชำระเงิน
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
                {/* ข้อมูลลูกค้า */}
                <div>
                  <Text variant="xs" className="font-normal text-[#E51C23] mb-2">
                    ข้อมูลลูกค้าและบิลที่ชำระ
                  </Text>
                  <Card className="bg-[#F6F3F2] rounded-none border-gray-100 border-l-3 border-l-[#E51C23] shadow-none">
                    <CardContent className="p-4 space-y-1">
                      <Text variant="small" className="font-medium text-[#1C1B1B] mb-0">
                        {selectedReceipt.customer_name || "ลูกค้าทั่วไป"}
                      </Text>
                      <Text variant="xs" className="text-[#6B7280] mb-0">
                        หมายเลขบิล: {selectedReceipt.order_numbers || "-"}
                      </Text>
                      <Text variant="xs" className="text-[#6B7280] mb-0">
                        วันที่รับชำระ: {formatDate(selectedReceipt.paid_at)}
                      </Text>
                      <Text variant="xs" className="text-[#6B7280] mb-0">
                        ผู้บันทึกยอด: {selectedReceipt.received_by_name || "-"}
                      </Text>
                    </CardContent>
                  </Card>
                </div>

                {/* สรุปยอดเงิน */}
                <Card className="bg-[#1C1B1B] rounded-none border-none shadow-none">
                  <CardContent className="p-4 space-y-2.5">
                    <div className="flex justify-between text-white">
                      <Text variant="xs" className="text-[#9CA3AF] mb-0">
                        ประเภทธุรกรรม
                      </Text>
                      <Text variant="xs" className="font-normal text-white mb-0">
                        {selectedReceipt.payment_type === "payment" ? "ชำระสดหน้าร้าน" : "เคลียร์หนี้เงินเชื่อ"}
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

                {/* Cancellation Status & Actions */}
                {(() => {
                  const itemStatus = (selectedReceipt.status || "").toLowerCase();

                  // 1. สถานะ รออนุมัติยกเลิก (pending_cancel)
                  if (itemStatus === "pending_cancel") {
                    if (isOwnerOrAdmin) {
                      return (
                        <div className="space-y-4">
                          <Card className="p-4 bg-[#FEFCE8] border border-[#FEF08A] rounded-none shadow-none space-y-2">
                            <div className="flex items-center justify-between">
                              <Text variant="small" className="font-normal text-[#854D0E] mb-0">
                                สถานะคำขอ: คำขอยกเลิกจากพนักงาน
                              </Text>
                              <Badge variant="warning">รออนุมัติ</Badge>
                            </div>

                            <div className="text-xs text-[#1C1B1B] bg-[#FFFBEB] space-y-1.5">
                              <div>
                                <span className="font-normal text-[#1C1B1B]">ผู้ส่งคำขอ:</span>{" "}
                                <span className="text-[#1C1B1B]">{selectedReceipt.cancel_requested_by_name || "-"}</span>
                              </div>
                              <div>
                                <span className="font-normal text-[#1C1B1B]">เหตุผลที่ระบุ:</span>{" "}
                                <span className="text-[#1C1B1B]">{selectedReceipt.cancel_reason || "-"}</span>
                              </div>
                              {selectedReceipt.cancel_requested_at && (
                                <Text variant="xs" className="text-[#1C1B1B] pt-0.5 mb-0">
                                  ส่งคำขอเมื่อ: {formatDate(selectedReceipt.cancel_requested_at)}
                                </Text>
                              )}
                            </div>
                          </Card>

                          <div className="space-y-3 pt-1">
                            <div className="space-y-1.5">
                              <Text variant="xs" className="font-normal text-[#E51C23] uppercase tracking-wider mb-1">
                                หมายเหตุการดำเนินการ:
                              </Text>
                              <textarea
                                rows={3}
                                value={cancelRemark}
                                onChange={(e) => setCancelRemark(e.target.value)}
                                placeholder="ระบุหมายเหตุการอนุมัติหรือเหตุผลในการปฏิเสธ..."
                                className="w-full p-2.5 text-xs font-light bg-[#F6F3F2] border border-[#E51C23] rounded-none focus:outline-none text-[#1C1B1B] placeholder-[#6B7280] resize-none"
                              />
                            </div>

                            <div className="flex gap-2 pt-1">
                              <Button
                                type="button"
                                variant="approved"
                                onClick={handleApproveCancel}
                                disabled={isProcessing}
                                className="flex-1 text-xs h-10 font-normal rounded-none"
                              >
                                {isProcessing ? "กำลังดำเนินการ..." : "อนุมัติยกเลิก (คืนหนี้)"}
                              </Button>

                              <Button
                                type="button"
                                variant="solid-red"
                                onClick={handleRejectCancel}
                                disabled={isProcessing}
                                className="flex-1 text-xs h-10 font-normal rounded-none"
                              >
                                {isProcessing ? "กำลังดำเนินการ..." : "ปฏิเสธคำขอ"}
                              </Button>

                              <Button
                                type="button"
                                variant="outline-cancel"
                                onClick={() => setSelectedReceipt(null)}
                                className="text-xs px-4 h-10 border border-gray-200 text-[#5F5E5E] hover:bg-[#F6F3F2] font-normal rounded-none"
                              >
                                ปิด
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // ฝั่งพนักงาน
                    return (
                      <div className="space-y-3">
                        <Card className="p-4 bg-[#FEFCE8] border border-[#FEF08A] rounded-none shadow-none space-y-2">
                          <div className="flex items-center justify-between">
                            <Text variant="small" className="font-normal text-[#854D0E] mb-0">
                              สถานะคำขอ: อยู่ระหว่างรออนุมัติ
                            </Text>
                            <Badge variant="warning">รออนุมัติ</Badge>
                          </div>

                          <div className="text-xs text-[#1C1B1B] bg-[#FFFBEB] space-y-1.5">
                            <div>
                              <span className="font-normal text-[#1C1B1B]">ผู้ส่งคำขอ:</span>{" "}
                              <span className="text-[#1C1B1B]">{selectedReceipt.cancel_requested_by_name || "-"}</span>
                            </div>
                            <div>
                              <span className="font-normal text-[#1C1B1B]">เหตุผลที่ระบุ:</span>{" "}
                              <span className="text-[#1C1B1B]">{selectedReceipt.cancel_reason || "-"}</span>
                            </div>
                            {selectedReceipt.cancel_requested_at && (
                              <Text variant="xs" className="text-[#1C1B1B] pt-0.5 mb-0">
                                ส่งคำขอเมื่อ: {formatDate(selectedReceipt.cancel_requested_at)}
                              </Text>
                            )}
                          </div>
                        </Card>

                        <div className="flex gap-2 pt-1">
                          <Button
                            type="button"
                            variant="solid-red"
                            onClick={handleRevertCancel}
                            disabled={isProcessing}
                            className="flex-1 text-xs h-10 font-normal rounded-none"
                          >
                            {isProcessing ? "กำลังดำเนินการ..." : "ดึงคำขอยกเลิกกลับ (กู้คืนคำขอ)"}
                          </Button>

                          <Button
                            type="button"
                            variant="outline-cancel"
                            onClick={() => setSelectedReceipt(null)}
                            className="text-xs px-4 h-10 border border-gray-200 text-[#5F5E5E] hover:bg-[#F6F3F2] font-normal rounded-none"
                          >
                            ปิด
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  // 2. สถานะ ปฏิเสธคำขอ (Rejected: completed with cancel_remark)
                  if (selectedReceipt.cancel_remark && itemStatus !== "cancelled") {
                    return (
                      <div className="space-y-3">
                        <Card className="p-4 bg-[#F8F9FA] border border-gray-200 rounded-none shadow-none space-y-2">
                          <div className="flex items-center justify-between">
                            <Text variant="small" className="font-normal text-[#5F5E5E] mb-0">
                              สถานะคำขอ: คำขอยกเลิกถูกปฏิเสธ
                            </Text>
                            <Badge variant="neutral">ปฏิเสธคำขอ</Badge>
                          </div>

                          <div className="text-xs text-[#1C1B1B] bg-white p-3 border border-gray-100 space-y-1.5">
                            <div>
                              <span className="font-normal text-[#5F5E5E]">ผู้ส่งคำขอเดิม:</span>{" "}
                              <span className="text-[#1C1B1B]">{selectedReceipt.cancel_requested_by_name || "-"}</span>
                            </div>
                            <div>
                              <span className="font-normal text-[#5F5E5E]">เหตุผลที่ขอยกเลิก:</span>{" "}
                              <span className="text-[#1C1B1B]">{selectedReceipt.cancel_reason || "-"}</span>
                            </div>
                            <div>
                              <span className="font-normal text-[#E51C23]">เหตุผลที่ปฏิเสธ:</span>{" "}
                              <span className="text-[#1C1B1B]">{selectedReceipt.cancel_remark}</span>
                            </div>
                          </div>
                        </Card>

                        <Button
                          type="button"
                          variant="outline-cancel"
                          onClick={() => setSelectedReceipt(null)}
                          className="w-full text-xs h-10 border border-gray-200 text-[#5F5E5E] hover:bg-[#F6F3F2] font-normal rounded-none cursor-pointer"
                        >
                          ปิด
                        </Button>
                      </div>
                    );
                  }

                  // 3. สถานะ ยกเลิกแล้ว (cancelled)
                  return (
                    <div className="space-y-3">
                      <Card className="p-4 bg-[#FCF7F7] border border-[#F5DFDF] rounded-none shadow-none space-y-2">
                        <div className="flex items-center justify-between">
                          <Text variant="small" className="font-normal text-[#E51C23] mb-0">
                            สถานะคำขอ: รายการนี้ถูกยกเลิกแล้ว
                          </Text>
                          <Badge variant="destructive">ยกเลิกแล้ว</Badge>
                        </div>

                        <div className="text-xs text-[#1C1B1B] bg-[#FAF2F2] space-y-1.5">
                          <div>
                            <span className="font-normal text-[#1C1B1B]">ผู้ขอยกเลิก:</span>{" "}
                            <span className="text-[#1C1B1B]">{selectedReceipt.cancel_requested_by_name || "-"}</span>
                          </div>
                          <div>
                            <span className="font-normal text-[#1C1B1B]">เหตุผลการยกเลิก:</span>{" "}
                            <span className="text-[#1C1B1B]">{selectedReceipt.cancel_reason || "-"}</span>
                          </div>
                          <div>
                            <span className="font-normal text-[#1C1B1B]">ผู้อนุมัติยกเลิก:</span>{" "}
                            <span className="text-[#1C1B1B]">{selectedReceipt.cancelled_by_name || "-"}</span>
                          </div>
                          {selectedReceipt.cancelled_at && (
                            <Text variant="xs" className="text-[#1C1B1B] pt-0.5 mb-0">
                              ยกเลิกเมื่อ: {formatDate(selectedReceipt.cancelled_at)}
                            </Text>
                          )}
                          {selectedReceipt.cancel_remark && (
                            <div>
                              <span className="font-normal text-[#1C1B1B]">หมายเหตุ:</span>{" "}
                              <span className="text-[#1C1B1B]">{selectedReceipt.cancel_remark}</span>
                            </div>
                          )}
                        </div>
                      </Card>

                      
                    </div>
                  );
                })()}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

export default PaymentCancellationHistory;