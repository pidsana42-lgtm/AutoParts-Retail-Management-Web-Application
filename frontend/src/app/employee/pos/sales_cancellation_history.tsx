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
  RotateCcw,
  ScanBarcode,
  X,
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
import { getDisplayCustomerName, getPageNumbers, getPaymentVariant, renderStatusBadge } from "../../../utils/poshelpers";
import { useSalesCancellationHistory } from "./hooks/useSalesCancellationHistory";
import { useSalesHistory } from "./hooks/useSalesHistory";
import type { SalesHistoryItemResponse } from "../../../interface/pos/sales_history_interface";
import { useUserRole } from "../../../hooks/useUserRole";

const SalesCancellationHistory: React.FC = () => {
    const { isOwnerOrAdmin } = useUserRole();
  // 1. ดึงข้อมูลตารางคำขอยกเลิกจาก useSalesCancellationHistory
    const {
        dataList,
        selectedIds,
        isSelectAll,
        isLoading,
        error,
        page,
        limit,
        totalRows,
        totalPages,
        setPage,
        setLimit,
        searchQuery,
        startDate,
        endDate,
        customerType,
        status,
        // paymentMethod,
        setSearchQuery,
        setStartDate,
        setEndDate,
        setCustomerType,
        // setPaymentMethod,
        setStatus,
        handleSelectAll,
        handleSelectRow,
        handleSearch,
        handleRestoreSelected,
    } = useSalesCancellationHistory();

  // 2. ดึงเฉพาะ Drawer State และ Action Handlers จาก useSalesHistory
    const {
        selectedOrderId,
        setSelectedOrderId,
        orderDetail,
        isDetailLoading,
        cancelReason,
        setCancelReason,
        isCancelling,
        handleRequestCancel,
        handleDirectCancelByOwner,
        handleRejectCancelByOwner,
        getStatusText,
    } = useSalesHistory();

  return (
    <div className="relative flex min-h-screen bg-[#F8F9FA] text-slate-800 font-sans overflow-x-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        <main className="p-6 space-y-6 flex-1">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <Text variant="xs" className="text-[#E51C23] uppercase tracking-wider mb-0">
                ยกเลิกบิลขาย
              </Text>
              <Heading level="h1" weight="normal" className="mb-0 text-[#1C1B1B]">
                ประวัติการยกเลิกขายสินค้า
              </Heading>
            </div>
          </div>

          {/* Filter Bar */}
          <Card className="bg-[#F6F3F2] rounded-none shadow-none border-y border-r border-gray-200 border-l-4 border-l-[#E51C23] overflow-hidden">
            <CardContent className="p-6 md:p-8">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                {/* 1. ค้นหาเลขบิล/ชื่อลูกค้า (col-span-3) */}
                <div className="md:col-span-3 flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-[#5F5E5E]">
                    ค้นหาเลขคำสั่งซื้อ/ชื่อลูกค้า
                  </label>
                  <div className="relative flex-1">
                    <ScanBarcode className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10" size={18} />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="สแกนบาร์โค้ด / INV-2024-XXX หรือ ชื่อลูกค้า"
                      className="w-full h-11 bg-white border border-gray-200 rounded-none pl-12 pr-4 text-sm text-[#1C1B1B] font-light focus:outline-none focus:border-red-500 shadow-sm"
                    />
                  </div>
                </div>

                {/* 2. วันที่เริ่มต้น (col-span-2) */}
                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-[#5F5E5E]">วันที่เริ่มต้น</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-white border-none rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 shadow-none cursor-pointer"
                  />
                </div>

                {/* 3. วันที่สิ้นสุด (col-span-2) */}
                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-[#5F5E5E]">วันที่สิ้นสุด</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-white border-none rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 shadow-none cursor-pointer"
                  />
                </div>

                {/* 4. ประเภทลูกค้า (col-span-2) */}
                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-[#5F5E5E]">ประเภทลูกค้า</label>
                  <Select
                    value={customerType}
                    onChange={(e: any) => setCustomerType(e.target.value)}
                    placeholder="ทั้งหมด"
                    className="bg-white border-none rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 shadow-none"
                    options={[
                      { label: "ทั้งหมด", value: "" },
                      { label: "ลูกค้าทั่วไป (ขาจร)", value: "GENERAL" },
                      { label: "ลูกค้าอู่ซ่อมรถ", value: "GARAGE" },
                      { label: "ลูกค้าบริษัท", value: "WHOLESALE" },
                    ]}
                  />
                </div>

                {/* 5. สถานะการยกเลิก (col-span-2) เปลี่ยนจากช่องชำระเงินมาเป็นอันนี้แทน */}
                <div className="md:col-span-2 flex flex-col gap-1.5">
                    <label className="text-xs font-normal text-[#5F5E5E]">สถานะคำขอ</label>
                    <Select
                    value={status}
                    onChange={(e: any) => setStatus(e.target.value)}
                    placeholder="สถานะทั้งหมด"
                    className="bg-white border-none rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 shadow-none"
                    options={[
                        { label: "ทั้งหมด", value: "" },
                        { label: "รออนุมัติ", value: "PENDING_CANCEL" },
                        { label: "ยกเลิกแล้ว", value: "CANCELLED" },
                    ]}
                    />
                </div>

                {/* 6. ปุ่มค้นหา (col-span-1) */}
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
            <Table className="!w-full !min-w-0 table-fixed text-left border-collapse">
              <TableHeader className="bg-[#F6F3F2] rounded-none border-b border-gray-200 text-[11px] text-[#6B7280] uppercase tracking-wider">
                <TableRow>
                  <TableHead className="py-3 px-3 w-[4%] text-center">
                    <input
                        type="checkbox"
                        checked={isSelectAll}
                        onChange={handleSelectAll}
                        disabled={dataList.filter((item) => (item.status || "").toUpperCase() === "PENDING_CANCEL").length === 0}
                        className="w-4 h-4 border border-gray-300 rounded-none bg-white checked:bg-[#E51C23] checked:border-[#E51C23] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 appearance-none flex items-center justify-center after:content-['✓'] after:text-white after:text-[10px] after:font-bold after:hidden checked:after:block"
                    />
                  </TableHead>
                  <TableHead className="py-3 px-3 w-[14%]">หมายเลขคำสั่งซื้อ</TableHead>
                  <TableHead className="py-3 px-3 w-[14%]">วันที่ทำรายการยกเลิก</TableHead>
                  <TableHead className="py-3 px-3 w-[26%]">ชื่อลูกค้า/อู่ซ่อมรถ/บริษัท</TableHead>
                  <TableHead className="py-3 px-3 text-right w-[12%]">จำนวนเงิน</TableHead>
                  <TableHead className="py-3 px-3 text-center w-[12%]">ผู้ยกเลิก</TableHead>
                  <TableHead className="py-3 px-3 text-center w-[10%]">สถานะ</TableHead>
                  <TableHead className="py-3 px-3 text-center w-[8%]">จัดการ</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-200">
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      กำลังโหลดข้อมูล...
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
                      ไม่พบข้อมูลประวัติการยกเลิก
                    </TableCell>
                  </TableRow>
                ) : (
                  dataList.map((item) => {
                    const isChecked = selectedIds.includes(item.id);
                    const isPendingCancel = (item.status || "").toUpperCase() === "PENDING_CANCEL";
                    return (
                      <TableRow
                        key={item.id}
                        className={isChecked ? "bg-red-50/40" : "hover:bg-slate-50 transition-colors"}
                      >
                        {/* Checkbox */}
                        <TableCell className="py-3.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleSelectRow(item.id)}
                            disabled={!isPendingCancel}
                            className="w-4 h-4 border border-gray-300 rounded-none bg-white checked:bg-[#E51C23] checked:border-[#E51C23] disabled:bg-gray-100 disabled:border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer appearance-none flex items-center justify-center after:content-['✓'] after:text-white after:text-[10px] after:font-bold after:hidden checked:after:block"
                          />
                        </TableCell>

                        {/* หมายเลขคำสั่งซื้อ */}
                        <TableCell className="py-3.5 px-4">
                          <Text variant="small" className="font-normal text-[#1C1B1B] mb-0">
                            {item.order_number}
                          </Text>
                        </TableCell>

                        {/* วันที่ทำรายการยกเลิก */}
                        <TableCell className="py-3.5 px-3">
                          <Text variant="xs" className="font-light text-[#5B5B5B] mb-0">
                            {item.order_date ? new Date(item.order_date).toLocaleString("th-TH") : "-"}
                          </Text>
                        </TableCell>

                        {/* ชื่อลูกค้า/อู่ซ่อมรถ/บริษัท */}
                        <TableCell className="py-3.5 px-3 truncate">
                          <Text variant="small" className="font-normal text-[#1C1B1B] mb-0 truncate">
                            {item.customer_name || item.customer_name_temp || "ลูกค้าทั่วไป"}
                          </Text>
                          <Text variant="xs" className="font-light text-[#A8A29E] mb-0">
                            {item.phone_number || item.customer_phone_temp || "-"}
                          </Text>
                          <Text variant="xs" className="font-light text-[#A8A29E] mb-0">
                            ประเภท: {item.customer_type_name || "-"}
                          </Text>
                        </TableCell>

                        {/* จำนวนเงิน */}
                        <TableCell className="py-3.5 px-3 text-right">
                          <Text variant="small" className="font-normal text-[#1C1B1B] mb-0">
                            {item.total_amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </Text>
                        </TableCell>

                        {/* ผู้ยกเลิก */}
                        <TableCell className="py-3.5 px-3 text-center">
                          <Text variant="xs" className="text-[#5B5B5B] mb-0">
                            {item.canceller || "-"}
                          </Text>
                        </TableCell>

                        {/* สถานะ */}
                        <TableCell className="py-3.5 px-3 text-center">
                        {renderStatusBadge(item.status, item.payment_status)}
                        </TableCell>

                        {/* จัดการ */}
                        <TableCell className="py-3.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedOrderId(item.id)}
                            className="p-1.5 text-[#E51C23] hover:bg-red-50 rounded-full cursor-pointer"
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

            {/* Restore Footer */}
            <div className="p-4 flex justify-between items-center bg-white border-t border-gray-100">
              <Text variant="xs" className="text-gray-500 mb-0">
                เลือกอยู่ {selectedIds.length} รายการ
              </Text>
              <Button
                onClick={handleRestoreSelected}
                disabled={selectedIds.length === 0}
                variant="solid-red"
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 text-sm px-4 py-2.5 rounded-none cursor-pointer disabled:cursor-not-allowed transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                <span>กู้คืนใบสั่งซื้อที่เลือก ({selectedIds.length})</span>
              </Button>
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
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
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
                          page === p ? "bg-[#E51C23] text-white border-[#E51C23]" : "bg-white text-gray-700 border-gray-200"
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

      {/* ==================== SLIDE-OVER DRAWER (REAL DATA) ==================== */}
      {selectedOrderId && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-none transition-opacity cursor-pointer"
            onClick={() => setSelectedOrderId(null)}
          />

          <aside className="relative z-10 w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-200">
            {isDetailLoading ? (
              <div className="flex-1 flex items-center justify-center p-6">
                <Text variant="small" className="text-gray-500">
                  กำลังโหลดข้อมูลออเดอร์...
                </Text>
              </div>
            ) : orderDetail ? (
              <div className="flex-1 overflow-y-auto">
                {/* Header */}
                <div className="p-5 border-b border-[#E7BDB8] flex items-start justify-between bg-white">
                  <div>
                    <Heading
                      level="h3"
                      weight="normal"
                      className="text-xl text-[#1C1B1B] mb-0.5"
                    >
                      รายละเอียดออเดอร์
                    </Heading>
                    <Text variant="xs" className="text-[#6B7280]">
                      หมายเลขบิล:{" "}
                      <span className="font-semibold text-[#1C1B1B]">
                        {orderDetail.order_number}
                      </span>
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
                    <Text
                      variant="xs"
                      className="font-normal text-[#E51C23] mb-2"
                    >
                      ข้อมูลลูกค้า
                    </Text>
                    <Card className="bg-[#F6F3F2] rounded-none border-gray-100 border-l-3 border-l-[#E51C23] shadow-none">
                      <CardContent className="p-4 space-y-1">
                        <Text
                          variant="small"
                          className="font-medium text-[#1C1B1B] mb-0"
                        >
                          {getDisplayCustomerName
                            ? getDisplayCustomerName(orderDetail as unknown as SalesHistoryItemResponse)
                            : orderDetail.customer_name || orderDetail.customer_name_temp || "ลูกค้าทั่วไป"}
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
                          <Text
                            variant="xs"
                            className="text-[#6B7280] mb-0 truncate"
                          >
                            ที่อยู่: {orderDetail.address}
                          </Text>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* รายการสินค้า */}
                  <div>
                    <Text
                      variant="xs"
                      className="font-normal text-[#E51C23] mb-3"
                    >
                      รายการสินค้า ({orderDetail.items?.length || 0})
                    </Text>
                    <div className="divide-y divide-gray-100">
                      {orderDetail.items &&
                        orderDetail.items.map((prod) => (
                          <div
                            key={prod.id}
                            className="flex items-center justify-between py-3 first:pt-0"
                          >
                            <div className="flex items-center gap-3">
                              <div>
                                <Text
                                  variant="small"
                                  className="font-medium text-[#1C1B1B] mb-0"
                                >
                                  {prod.product_name}
                                </Text>
                                <Text
                                  variant="xs"
                                  className="font-normal text-[#1C1B1B] mb-0"
                                >
                                  {prod.part_number && `รหัสสินค้า: ${prod.part_number}`}
                                </Text>
                                <Text
                                  variant="xs"
                                  className="font-normal text-[#6B7280] mb-0"
                                >
                                  QTY: {prod.qty} {prod.unit} |{" "}
                                  {prod.unit_price.toLocaleString("th-TH", {
                                    minimumFractionDigits: 2,
                                  })}
                                </Text>
                              </div>
                            </div>
                            <Text
                              variant="small"
                              className="font-normal text-[#1C1B1B] mb-0"
                            >
                              {(prod.subtotal || 0).toLocaleString("th-TH", {
                                minimumFractionDigits: 2,
                              })}
                            </Text>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* สรุปยอดเงิน */}
                  <Card className="bg-[#1C1B1B] rounded-none border-none shadow-none">
                    <CardContent className="p-4 space-y-2.5">
                      <div className="flex justify-between text-white">
                        <Text variant="xs" className="text-[#9CA3AF] mb-0">
                          ราคารวมสินค้า
                        </Text>
                        <Text variant="xs" className="font-normal text-white mb-0">
                          {(orderDetail.subtotal || 0).toLocaleString("th-TH", {
                            minimumFractionDigits: 2,
                          })}
                        </Text>
                      </div>

                      <div className="flex justify-between text-white">
                        <Text variant="xs" className="text-[#9CA3AF] mb-0">
                          ส่วนลดท้ายบิล
                        </Text>
                        <Text variant="xs" className="font-normal text-white mb-0">
                          {(orderDetail.discount_amount || 0).toLocaleString("th-TH", {
                            minimumFractionDigits: 2,
                          })}
                        </Text>
                      </div>

                      <div className="flex justify-between text-white">
                        <Text variant="xs" className="text-[#9CA3AF] mb-0">
                          ส่วนลดรวมทั้งสิ้น
                        </Text>
                        <Text variant="xs" className="font-normal text-white mb-0">
                          {(orderDetail.total_discount_items || 0).toLocaleString("th-TH", {
                            minimumFractionDigits: 2,
                          })}
                        </Text>
                      </div>

                      <div className="border-t border-[#9CA3AF] pt-2.5 flex justify-between">
                        <Text variant="small" className="font-normal text-white mb-0">
                          ยอดชำระสุทธิ
                        </Text>
                        <Text variant="small" className="font-normal text-white mb-0">
                          {(orderDetail.total_amount || 0).toLocaleString("th-TH", {
                            minimumFractionDigits: 2,
                          })}
                        </Text>
                      </div>

                      <div className="pt-2 flex justify-end items-center gap-2">
                        <Badge variant={getPaymentVariant(orderDetail.payment_method_name)}>
                          {orderDetail.payment_method_name || "เงินสด"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Dynamic Cancel Form / Status Section */}
                  {(() => {
                    const status = (orderDetail.status || "").trim().toUpperCase();
                    const hasBeenRejected = Boolean(orderDetail.cancel_remark);

                    if (status === "PENDING_CANCEL") {
                      if (isOwnerOrAdmin) {
                        return (
                          <div className="space-y-4">
                            <Card className="p-4 bg-[#FEFCE8] border border-[#FEF08A] rounded-none shadow-none space-y-3">
                                <div className="flex items-center justify-between">
                                    <Text variant="small" className="font-normal text-[#854D0E] mb-0">
                                    สถานะคำขอ: คำขอยกเลิกจากพนักงาน
                                    </Text>
                                    <Badge
                                    variant="warning"
                                    className="bg-[#FEF08A] text-[#854D0E] border-none text-[10px] font-light rounded-none py-0.5 px-2"
                                    >
                                    {getStatusText ? getStatusText(orderDetail.status) : orderDetail.status}
                                    </Badge>
                                </div>

                                <div className="text-xs text-[#5F5E5E] bg-[#FFFBEB] p-2.5 border-l-2 border-[#EAB308]">
                                    <span className="font-normal text-[#1C1B1B]">
                                    เหตุผลที่พนักงานขอ:
                                    </span>{" "}
                                    {cancelReason || orderDetail.cancel_reason || "-"}
                                </div>
                            </Card>

                            <div className="space-y-3 pt-1">
                              <div className="space-y-1.5">
                                <Text
                                  variant="xs"
                                  className="font-normal text-[#E51C23] uppercase tracking-wider mb-1"
                                >
                                  หมายเหตุการดำเนินการ (ถ้ามี):
                                </Text>
                                <textarea
                                  rows={3}
                                  value={cancelReason}
                                  onChange={(e) => setCancelReason(e.target.value)}
                                  placeholder="ระบุเหตุผลในการอนุมัติหรือปฏิเสธ..."
                                  className="w-full p-2.5 text-xs font-light bg-[#F6F3F2] border border-[#E51C23] rounded-none focus:outline-none text-[#1C1B1B] placeholder-[#6B7280] resize-none"
                                />
                              </div>

                              <div className="flex gap-2 pt-1">
                                <Button
                                  type="button"
                                  variant="approved"
                                  onClick={handleDirectCancelByOwner}
                                  disabled={isCancelling}
                                  className="flex-1 text-xs h-10 font-normal rounded-none"
                                >
                                  {isCancelling ? "กำลังดำเนินการ..." : "อนุมัติยกเลิก (คืนสต็อก)"}
                                </Button>

                                <Button
                                  type="button"
                                  variant="solid-red"
                                  onClick={handleRejectCancelByOwner}
                                  disabled={isCancelling}
                                  className="flex-1 text-xs h-10 font-normal rounded-none"
                                >
                                  {isCancelling ? "กำลังดำเนินการ..." : "ปฏิเสธคำขอ"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <Card className="p-4 bg-[#FEFCE8] border border-[#FEF08A] rounded-none shadow-none space-y-2">
                            <div className="flex items-center justify-between">
                                <Text variant="small" className="font-normal text-[#854D0E] mb-0">
                                สถานะคำขอ: อยู่ระหว่างรออนุมัติ
                                </Text>
                                <Badge
                                variant="warning"
                                className="bg-[#FEF08A] text-[#854D0E] border-none text-[10px] font-light rounded-none py-0.5 px-2"
                                >
                                {getStatusText ? getStatusText(orderDetail.status) : orderDetail.status}
                                </Badge>
                            </div>
                            <div className="text-xs text-[#5F5E5E] bg-[#FFFBEB] p-2.5 border-l-2 border-[#EAB308]">
                                <span className="font-normal text-[#1C1B1B]">
                                เหตุผลที่ระบุ:
                                </span>{" "}
                                {cancelReason || orderDetail.cancel_reason || "-"}
                            </div>
                        </Card>
                      );
                    }

                    if (status === "CANCELLED" || status === "ยกเลิก") {
                      return (
                        <Card className="p-4 bg-[#FCF7F7] border border-[#F5DFDF] rounded-none shadow-none space-y-2">
                          <div className="flex items-center justify-between">
                            <Text variant="small" className="font-normal text-[#E51C23] mb-0">
                              สถานะคำขอ: รายการนี้ถูกยกเลิกแล้ว
                            </Text>
                            <Badge
                              variant="neutral"
                              className="bg-[#E51C23] text-white border-none text-[10px] font-light rounded-none py-0.5 px-2"
                            >
                              {getStatusText ? getStatusText(orderDetail.status) : orderDetail.status}
                            </Badge>
                          </div>
                          <div className="text-xs text-[#5F5E5E] bg-[#FAF2F2] p-2.5 border-l-2 border-[#E51C23]">
                            <span className="font-normal text-[#1C1B1B]">
                              เหตุผลการยกเลิก:
                            </span>{" "}
                            {orderDetail.cancel_reason || "-"}
                          </div>
                        </Card>
                      );
                    }

                    return (
                      <div className="space-y-4 pt-2">
                        {hasBeenRejected && (
                          <Card className="p-4 bg-[#FCF7F7] border border-[#F5DFDF] rounded-none shadow-none space-y-2">
                            <div className="flex items-center justify-between">
                              <Text variant="small" className="font-normal text-[#E51C23] mb-0">
                                สถานะ: คำขอยกเลิกก่อนหน้านี้ถูกปฏิเสธ
                              </Text>
                              <Badge
                                variant="neutral"
                                className="bg-[#E51C23] text-white border-none text-[10px] font-light rounded-none py-0.5 px-2"
                              >
                                {getStatusText
                                  ? getStatusText(orderDetail.status, orderDetail.cancel_remark)
                                  : orderDetail.status}
                              </Badge>
                            </div>
                            <div className="text-xs text-[#5F5E5E] bg-[#FAF2F2] p-2.5 border-l-2 border-[#E51C23]">
                              <span className="font-normal text-[#1C1B1B]">
                                เหตุผลจากเจ้าของร้าน:
                              </span>{" "}
                              {orderDetail.cancel_remark}
                            </div>
                          </Card>
                        )}

                        <div className="space-y-3">
                          <Text
                            variant="xs"
                            className="font-normal text-[#E51C23] uppercase tracking-wider mb-1"
                          >
                            {hasBeenRejected
                              ? "ระบุเหตุผลเพื่อยื่นขอยกเลิกใหม่อีกครั้ง"
                              : "ระบุเหตุผลในการขอยกเลิกรายการ"}
                          </Text>

                          <textarea
                            rows={3}
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            placeholder="ตัวอย่าง: ลูกค้าขอยกเลิกออเดอร์เนื่องจากเปลี่ยนใจ / ยิงรายการผิด..."
                            className="w-full p-2.5 text-xs font-light bg-[#F6F3F2] border border-[#E51C23] rounded-none focus:outline-none text-[#1C1B1B] placeholder-[#6B7280] resize-none"
                          />

                          <div className="flex gap-3 pt-1">
                            <Button
                              type="button"
                              variant="solid-red"
                              onClick={
                                isOwnerOrAdmin
                                  ? handleDirectCancelByOwner
                                  : handleRequestCancel
                              }
                              disabled={isCancelling}
                              className="flex-1 text-sm h-11 font-normal"
                            >
                              {isCancelling
                                ? "กำลังดำเนินการ..."
                                : isOwnerOrAdmin
                                ? "อนุมัติยกเลิกรายการ (คืนสต็อก)"
                                : "ยืนยันการขออนุมัติยกเลิก"}
                            </Button>

                            <Button
                              type="button"
                              variant="outline-cancel"
                              onClick={() => setSelectedOrderId(null)}
                              className="text-sm px-6 h-11 border border-gray-200 text-[#5F5E5E] hover:bg-[#F6F3F2] font-normal"
                            >
                              ยกเลิก
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-6">
                <Text variant="small" className="text-red-500">
                  ไม่พบข้อมูลออเดอร์
                </Text>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
};

export default SalesCancellationHistory;