import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ScanBarcode,
  RotateCcw,
  X,
  Printer,
  Download,
} from "lucide-react";

// นำเข้า Components
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

// นำเข้า Hook & Helpers
import { useSalesHistory } from "./hooks/useSalesHistory";
import { getDisplayCustomerName, getPageNumbers, getPaymentVariant } from "../../../utils/poshelpers";
import { SalesStatusBadge } from "../../../components/elements/status_badge";
import { formatDate } from "../../../utils/date";
import type { SalesHistoryItemResponse } from "../../../interface/pos/sales_history_interface";
import { useUserRole } from "../../../hooks/useUserRole";
import { posApiService } from "../../../service/http/pos/pos_service";
import { openPdfBlobInNewTab, downloadPdfBlob } from "../../../utils/print";


export default function TransactionHistoryPage() {
  const [printingOrderId, setPrintingOrderId] = useState<number | string | null>(null);
  const navigate = useNavigate();

  const handlePrintReceipt = async (orderId: number | string, orderNumber?: string) => {
    setPrintingOrderId(orderId);
    try {
      const blob = await posApiService.printOrderReceipt(orderId);
      const rawNum = orderNumber || orderId;
      const fileName = String(rawNum).startsWith("INV") ? `${rawNum}.pdf` : `INV-${rawNum}.pdf`;
      downloadPdfBlob(blob, fileName);
    } catch (err) {
      console.error("Failed to print receipt:", err);
      alert("ไม่สามารถสร้างไฟล์ PDF ใบเสร็จได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setPrintingOrderId(null);
    }
  };

  // --- ดึงข้อมูลและ Handlers จริงจาก Custom Hook ---
  const { isOwnerOrAdmin } = useUserRole();

  // --- ดึงข้อมูลและ Handlers จริงจาก Custom Hook ---
  const {
    items,
    totalRows,
    totalPages,
    isLoading,
    error,
    stats,
    isStatsLoading,
    search,
    customerType,
    paymentMethod,
    employeeId,
    employeeList,
    startDate,
    endDate,
    page,
    limit,
    setSearch,
    setCustomerType,
    setPaymentMethod,
    setEmployeeId,
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
    cancelRemark,
    setCancelRemark,
    isCancelling,
    handleRequestCancel, //  ดึง handler มาใช้งาน
    handleDirectCancelByOwner, 
    handleRejectCancelByOwner,
    handleRevertCancel,
    getStatusText,
  } = useSalesHistory();

  const kpiValue = (value: React.ReactNode) =>
    isStatsLoading ? <span className="text-gray-400 animate-pulse">...</span> : value;

  return (
    <div className="relative flex min-h-screen bg-[#F8F9FA] text-slate-800 font-sans overflow-x-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        {/* PAGE CONTENT */}
        <main className="p-6 space-y-6 flex-1">
          {/* Section Title */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <Heading level='h1' weight='semibold' className='m-0 text-black'>
                ประวัติการขายสินค้า
              </Heading>
              <Heading level='h6' className='m-0 mt-1'>
                บันทึกบิลขายสินค้า
              </Heading>
            </div>
          </div>

          {/* Filter Bar */}
          <Card className="bg-[#F6F3F2] rounded-none shadow-none border-y border-r border-gray-200 border-l-4 border-l-[#E51C23] overflow-hidden">
            <CardContent className="p-5 md:p-6 space-y-4">
              {/* ค้นหาหลัก + ตัวกรองบุคคล */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                {/* ช่องที่ 1: ค้นหาคำ */}
                <div className={cn("flex flex-col gap-1.5", isOwnerOrAdmin ? "md:col-span-8" : "md:col-span-12")}>
                  <Text variant="xs" className="text-[#5F5E5E]">
                    ค้นหาเลขคำสั่งซื้อ / ชื่อลูกค้า
                  </Text>
                  <div className="relative flex-1">
                    <ScanBarcode
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10"
                      size={18}
                    />
                    <Input
                      placeholder="สแกนบาร์โค้ด / INV-202X-XXX หรือ ชื่อลูกค้า..."
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
                      พนักงานขาย
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

              {/* บรรทัดที่ 2: ตัวกรองเงื่อนไข + วันที่ + ปุ่มค้นหา */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end pt-1 border-t border-gray-200/60">
                {/* วันที่เริ่มต้น (2.5/12 -> 3) */}
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

                {/* วันที่สิ้นสุด (2.5/12 -> 3) */}
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

                {/* ประเภทลูกค้า */}
                <div className="md:col-span-3 lg:col-span-3 flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-[#5F5E5E]">
                    ประเภทลูกค้า
                  </label>
                  <Select
                    value={customerType}
                    onChange={(e) => setCustomerType(e.target.value)}
                    placeholder="ทั้งหมด"
                    className="bg-white border-none rounded-none h-10 text-sm font-normal text-[#1C1B1B] px-3 shadow-none focus-visible:ring-0 cursor-pointer"
                    options={[
                      { label: "ทั้งหมด", value: "" },
                      { label: "ลูกค้าทั่วไป (ขาจร)", value: "GENERAL" },
                      { label: "ลูกค้าอู่ซ่อมรถ", value: "GARAGE" },
                      { label: "ลูกค้าบริษัท", value: "WHOLESALE" },
                    ]}
                  />
                </div>

                {/* การชำระเงิน */}
                <div className="md:col-span-3 lg:col-span-3 flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-[#5F5E5E]">
                    การชำระเงิน
                  </label>
                  <Select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    placeholder="วิธีการทั้งหมด"
                    className="bg-white border-none rounded-none h-10 text-sm font-normal text-[#1C1B1B] px-3 shadow-none focus-visible:ring-0 cursor-pointer"
                    options={[
                      { label: "ทั้งหมด", value: "" },
                      { label: "เงินสด", value: "CASH" },
                      { label: "เงินโอน", value: "QR" },
                      { label: "เงินเชื่อ", value: "CREDIT" },
                    ]}
                  />
                </div>

                {/* ปุ่มใช้ตัวกรอง */}
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

          {/* Small Stat Cards เหนือตาราง */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
            {/* 1. ยอดขายรวม (Total Sales) */}
            <Card className="!border-l-[5px] !border-l-[#E51C23] flex flex-col justify-between p-4 md:p-5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Heading level="h6" className="uppercase tracking-wider">
                    ยอดขายรวม
                  </Heading>
                </div>
                <Heading level="h3">
                  ฿{kpiValue(stats.totalSales.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
                </Heading>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-[#6B7280] font-light">
                <span>ภาพรวมยอดขายทั้งหมด</span>
                <span className="text-emerald-500 font-normal">สำเร็จ {stats.completedCount} บิล</span>
              </div>
            </Card>

            {/* 2. จำนวนบิลทั้งหมด (Total Orders) */}
            <Card className="border-l-5 !border-l-slate-300 flex flex-col justify-between p-4 md:p-5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Heading level="h6" className="uppercase tracking-wider">
                    จำนวนบิลทั้งหมด
                  </Heading>
                </div>
                <Heading level="h3">
                  {kpiValue(stats.totalOrders.toLocaleString("th-TH"))} <span className="text-sm font-normal text-[#1C1B1B]">บิล</span>
                </Heading>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-[#6B7280] font-light">
                <span>บิลทั้งหมดในระบบ</span>
                {stats.cancelledCount > 0 ? (
                  <span className="text-[#E51C23] font-normal">ยกเลิก {stats.cancelledCount} บิล</span>
                ) : (
                  <span className="text-gray-400">ไม่มีบิลยกเลิก</span>
                )}
              </div>
            </Card>

            {/* 3. ยอดเงินสด vs เงินเชื่อ (Cash vs Credit) */}
            <Card className="bg-white rounded-none border border-gray-200 p-5 shadow-xs border-l-4 border-l-[#E51C23]">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Heading level="h6" className="uppercase tracking-wider">
                    ยอดเงินสด vs เงินเชื่อ
                  </Heading>
                </div>
                <Heading level="h3" className="flex items-baseline gap-1.5 flex-wrap">
                  <span title="เงินสด/เงินโอน">
                    ฿{kpiValue(stats.cashAndQrSales.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 }))}
                  </span>
                  <span className="text-xs text-gray-400 font-light">/</span>
                  <span title="เงินเชื่อ">
                    ฿{kpiValue(stats.creditSales.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 }))}
                  </span>
                </Heading>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-[#6B7280] font-light">
                <span>สด/โอน: <span className="text-emerald-500 font-normal">฿{stats.cashAndQrSales.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span></span>
                <span>เชื่อ: <span className="text-sky-700 font-normal">฿{stats.creditSales.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span></span>
              </div>
            </Card>

            {/* 4. ยอดที่ชำระแล้ว vs ค้างชำระ (Paid vs Balance Due) */}
            <Card className="!border-l-[5px] !border-l-emerald-500 flex flex-col justify-between p-4 md:p-5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Heading level="h6" className="uppercase tracking-wider">
                    ยอดชำระแล้ว vs ค้างชำระ
                  </Heading>
                </div>
                <Heading level="h3" className="flex items-baseline gap-1.5 flex-wrap">
                  <span title="ชำระแล้ว">
                    ฿{kpiValue(stats.paidAmount.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 }))}
                  </span>
                  <span className="text-xs text-gray-400 font-light">/</span>
                  <span className={stats.balanceDue > 0 ? "text-[#E51C23]" : "text-gray-600"} title="ค้างชำระ">
                    ฿{kpiValue(stats.balanceDue.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 }))}
                  </span>
                </Heading>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-[#6B7280] font-light">
                <span>
                  ชำระ: <span className="text-emerald-500 font-normal">฿{stats.paidAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                </span>
                <span>
                  {stats.balanceDue > 0 ? (
                    <>
                      <span className="text-[#6B7280]">ค้าง: </span>
                      <span className="text-[#E51C23] font-normal">
                        ฿{stats.balanceDue.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ({stats.unpaidCount} บิล)
                      </span>
                    </>
                  ) : (
                    <span className="text-gray-400">ไม่มีค้างชำระ</span>
                  )}
                </span>
              </div>
            </Card>
          </div>

          {/* Data Table */}
          <Card className="bg-white rounded-none shadow-sm overflow-hidden border border-gray-200">
            <Table className="!w-full !min-w-0 table-fixed text-left border-collapse">
              {/* Header Table */}
              <TableHeader className="bg-[#F6F3F2] rounded-none border-b border-gray-200 text-[11px] text-[#6B7280] uppercase tracking-wider">
                <TableRow>
                  <TableHead className="py-3 px-3 w-[14%]">หมายเลขคำสั่งซื้อ</TableHead>
                  <TableHead className="py-3 px-3 w-[12%]">วันที่ทำรายการ</TableHead>
                  <TableHead className="py-3 px-3 w-[20%]">ชื่อลูกค้า/อู่ซ่อมรถ/บริษัท</TableHead>
                  <TableHead className="py-3  text-left px-3 w-[12%]">พนักงานขาย</TableHead>
                  <TableHead className="py-3 px-3 text-right w-[10%]">จำนวนเงิน</TableHead>
                  <TableHead className="py-3 px-3 text-center w-[12%]">การชำระเงิน</TableHead>
                  <TableHead className="py-3 px-3 text-center w-[12%]">สถานะ</TableHead>
                  <TableHead className="py-3 px-3 text-center w-[8%]">จัดการ</TableHead>
                </TableRow>
              </TableHeader>

              {/* Body Table */}
              <TableBody className="divide-y divide-gray-200">
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center">
                      <Text variant="small" className="text-gray-500 mb-0">
                        กำลังโหลดข้อมูลประวัติการขาย...
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
                        ไม่พบรายการประวัติการขาย
                      </Text>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item: SalesHistoryItemResponse) => (
                    <TableRow
                      key={item.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      {/* 1. หมายเลขคำสั่งซื้อ */}
                      <TableCell className="py-3.5 px-4">
                        <Text
                          variant="small"
                          className="font-normal text-[#1C1B1B] mb-0"
                        >
                          {item.order_number}
                        </Text>
                      </TableCell>

                      {/* 2. วันที่ทำรายการ */}
                      <TableCell className="py-3.5 px-4">
                        <Text
                          variant="xs"
                          className="font-light text-[#5B5B5B] mb-0"
                        >
                          {formatDate(item.order_date || item.created_at)}
                        </Text>
                      </TableCell>

                      {/* 3. ชื่อลูกค้า + เบอร์โทรศัพท์ + ประเภท */}
                      <TableCell className="py-3.5 px-4 truncate">
                        <Text
                          variant="small"
                          className="font-normal text-[#1C1B1B] mb-0 truncate"
                        >
                          {getDisplayCustomerName(item)}
                        </Text>
                        <Text
                          variant="xs"
                          className="font-light text-[#A8A29E] mb-0"
                        >
                          {item.phone_number || item.customer_phone_temp || "-"}
                        </Text>
                        <Text 
                          variant="xs" 
                          className="font-light text-[#A8A29E] mb-0">
                          ประเภท: {item.customer_type_name || "-"}
                        </Text>
                      </TableCell>

                      {/* 3.5 พนักงานขาย */}
                      <TableCell className="py-3.5 px-4 truncate">
                        <Text
                          variant="xs"
                          className="font-normal text-[#1C1B1B] mb-0"
                        >
                          {item.created_by_name || "-"}
                        </Text>
                      </TableCell>

                      {/* 4. จำนวนเงิน */}
                      <TableCell className="py-3.5 px-4 text-right">
                        <Text
                          variant="small"
                          className="font-normal text-[#1C1B1B] mb-0"
                        >
                          {(item.total_amount || 0).toLocaleString("th-TH", {
                            minimumFractionDigits: 2,
                          })}
                        </Text>
                      </TableCell>

                      {/* 5. วิธีการชำระเงิน */}
                      <TableCell className="py-3.5 px-4 text-center">
                        <Badge
                          variant={getPaymentVariant(item.payment_method_name)}
                        >
                          {item.payment_method_name || "-"}
                        </Badge>
                      </TableCell>

                      {/* 6. สถานะ */}
                      <TableCell className="py-3.5 px-4 text-center">
                        <SalesStatusBadge status={item.status} paymentStatus={item.payment_status} />
                      </TableCell>

                      {/* 7. ปุ่มจัดการ */}
                      <TableCell className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            className="inline-flex items-center justify-center p-1.5 cursor-pointer rounded-full"
                            title="ดูรายละเอียด"
                            onClick={() => setSelectedOrderId(item.id)}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={printingOrderId === item.id}
                            className="inline-flex items-center justify-center p-1.5 cursor-pointer rounded-full disabled:opacity-40"
                            title="พิมพ์/ดาวน์โหลดใบเสร็จ"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrintReceipt(item.id, item.order_number);
                            }}
                          >
                            <Printer className={cn("w-4 h-4", printingOrderId === item.id && "animate-pulse")} />
                          </button>
                        </div>
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
                    {Math.min(page * limit, totalRows)} จาก {totalRows}{" "}
                    ใบสั่งซื้อ
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
                      <span
                        key={`ellipsis-${idx}`}
                        className="px-2 text-gray-400 select-none"
                      >
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
                            : "text-gray-600 hover:bg-gray-100 border border-transparent",
                        )}
                      >
                        {p}
                      </button>
                    ),
                  )}

                  <button
                    type="button"
                    disabled={page === totalPages}
                    onClick={() =>
                      setPage((prev) => Math.min(totalPages, prev + 1))
                    }
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
                  <div className="flex items-center gap-2">
                    {/* <Button
                      type="button"
                      variant="solid-red"
                      onClick={() => handlePrintReceipt(orderDetail.id || orderDetail.order_number, orderDetail.order_number)}
                      disabled={printingOrderId !== null}
                      className="text-xs h-8 px-3 font-normal rounded-none flex items-center gap-1.5"
                    >
                      <Printer size={14} />
                      {printingOrderId !== null ? "กำลังดาวน์โหลด..." : "พิมพ์ใบเสร็จ/ใบส่งของ"}
                    </Button> */}
                    <button
                      type="button"
                      onClick={() => setSelectedOrderId(null)}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Scrollable Body Content */}
                <div className="p-6 space-y-6">
                  {/* ข้อมูลลูกค้า */}
                  <div>
                    <Text variant="xs" className="font-normal text-[#E51C23] mb-2">
                      ข้อมูลลูกค้า
                    </Text>
                    <Card className="bg-[#F6F3F2] rounded-none border-gray-100 border-l-3 border-l-[#E51C23] shadow-none">
                      <CardContent className="p-4 space-y-1">
                        <Text variant="small" className="font-medium text-[#1C1B1B] mb-0">
                          {getDisplayCustomerName(orderDetail)}
                        </Text>
                        <Text variant="xs" className="text-[#6B7280] mb-0">
                          เบอร์โทร: {orderDetail.phone_number || orderDetail.customer_phone_temp || "-"}
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
                        <Text variant="xs" className="text-[#6B7280] mb-0">
                          พนักงานขาย: {orderDetail.created_by_name || "-"}
                        </Text>
                      </CardContent>
                    </Card>
                  </div>

                  {/* ประวัติการกู้คืนคำขอ (แสดงเฉพาะเมื่อมีการกู้คืน) */}
                  {(() => {
                    const revertNotes = (orderDetail.note || "")
                      .split("|")
                      .map((s) => s.trim())
                      .filter((s) => s.includes("กู้คืน"));

                    if (revertNotes.length === 0) return null;

                    return (
                      <div>
                        <Text variant="xs" className="font-normal text-[#E51C23] mb-2">
                          ประวัติการกู้คืนคำขอยกเลิก
                        </Text>
                        <Card className="bg-[#F6F3F2] rounded-none border-gray-200  shadow-none">
                          <CardContent className="p-3 space-y-1">
                            {revertNotes.map((noteText, idx) => (
                              <Text key={idx} variant="xs" className="text-[#1C1B1B] font-light mb-0">
                                {noteText}
                              </Text>
                            ))}
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })()}

                  {/* รายการสินค้าจริง */}
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
                                  {prod.part_number &&
                                    `รหัสสินค้า: ${prod.part_number}`}
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
                      {/* แถวราคารวมสินค้า */}
                      <div className="flex justify-between text-white">
                        <Text variant="xs" className="text-[#9CA3AF] mb-0">
                          ราคารวมสินค้า
                        </Text>
                        <Text
                          variant="xs"
                          className="font-normal text-white mb-0"
                        >
                          {(orderDetail.subtotal || 0).toLocaleString("th-TH", {
                            minimumFractionDigits: 2,
                          })}
                        </Text>
                      </div>

                      {/* แถวส่วนลดท้ายบิล */}
                      <div className="flex justify-between text-white">
                        <Text variant="xs" className="text-[#9CA3AF] mb-0">
                          ส่วนลดท้ายบิล
                        </Text>
                        <Text
                          variant="xs"
                          className="font-normal text-white mb-0"
                        >
                          {(orderDetail.discount_amount || 0).toLocaleString(
                            "th-TH",
                            { minimumFractionDigits: 2 },
                          )}
                        </Text>
                      </div>

                      {/* แถวส่วนลดรวมทั้งสิ้น*/}
                      <div className="flex justify-between text-white">
                        <Text variant="xs" className="text-[#9CA3AF] mb-0">
                          ส่วนลดรวมทั้งสิ้น
                        </Text>
                        <Text
                          variant="xs"
                          className="font-normal text-white mb-0"
                        >
                          {(
                            orderDetail.total_discount_items || 0
                          ).toLocaleString("th-TH", {
                            minimumFractionDigits: 2,
                          })}
                        </Text>
                      </div>

                      {/* แถวยอดชำระสุทธิ */}
                      <div className="border-t border-[#9CA3AF] pt-2.5 flex justify-between">
                        <Text
                          variant="small"
                          className="font-normal text-white mb-0"
                        >
                          ยอดชำระสุทธิ
                        </Text>
                        <Text
                          variant="small"
                          className="font-normal text-white mb-0"
                        >
                          {(orderDetail.total_amount || 0).toLocaleString(
                            "th-TH",
                            { minimumFractionDigits: 2 },
                          )}
                        </Text>
                      </div>

                      {/* แถววิธีชำระเงิน */}
                      <div className="pt-2 flex justify-end items-center gap-2">
                        <Badge
                          variant={getPaymentVariant(
                            orderDetail.payment_method_name,
                          )}
                        >
                          {orderDetail.payment_method_name || "เงินสด"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {/* ==================== ส่วนจัดการการขอยกเลิก (DYNAMIC UI) ==================== */}
                  {(() => {
                    const status = (orderDetail.status || "")
                      .trim()
                      .toUpperCase();
                    const hasBeenRejected = Boolean(orderDetail.cancel_remark);

                    // 1. เคสรายการอยู่ระหว่างรออนุมัติการยกเลิก (PENDING_CANCEL)
                    if (status === "PENDING_CANCEL") {
                      // 1.1 ถ้าผู้ใช้เป็น OWNER / ADMIN: แยกเป็น 2 ส่วน (กล่องสรุปข้อมูล + ฟอร์มการดำเนินการ)
                      if (isOwnerOrAdmin) {
                        return (
                          <div className="space-y-4">
                            {/* ส่วนที่ 1: กล่องสรุปคำขอจากพนักงาน */}
                            <Card className="p-4 bg-[#FEFCE8] border border-[#FEF08A] rounded-none shadow-none space-y-2">
                              <div className="flex items-center justify-between">
                                <Text variant="small" className="font-normal text-[#854D0E] mb-0">
                                  สถานะคำขอ: คำขอยกเลิกจากพนักงาน
                                </Text>
                                <Badge
                                  variant="warning"
                                  size="auto"
                                  className="bg-[#FEF08A] text-[#854D0E] border-none text-[10px] font-normal rounded-none py-0.5 px-2"
                                >
                                  {getStatusText(orderDetail.status)}
                                </Badge>
                              </div>

                              <div className="text-xs text-[#1C1B1B] ">
                                <div>
                                  <span className="font-normal text-[#1C1B1B]">ผู้ส่งคำขอ:</span>{" "}
                                  <span className="text-[#1C1B1B]">{orderDetail.canceller || "-"}</span>
                                </div>
                                <div>
                                  <span className="font-normal text-[#1C1B1B]">เหตุผลที่พนักงานระบุ:</span>{" "}
                                  <span className="text-[#1C1B1B]">{orderDetail.cancel_reason || "-"}</span>
                                </div>
                                {orderDetail.cancel_requested_at && (
                                  <Text variant="xs" className="text-[#1C1B1B] pt-0.5">
                                    ส่งคำขอเมื่อ: {formatDate(orderDetail.cancel_requested_at)}
                                  </Text>
                                )}
                              </div>
                            </Card>

                            {/* ส่วนที่ 2: ฟอร์มอนุมัติ/ปฏิเสธ ของ Owner (อยู่นอก Card) */}
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
                                  className="flex-1 text-xs h-10  font-normal rounded-none"
                                >
                                  {isCancelling ? "กำลังดำเนินการ..." : "ปฏิเสธคำขอ"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // 1.2 ถ้าเป็น EMPLOYEE / STAFF: ดูได้อย่างเดียวว่า รออนุมัติ
                      return (
                        <div className="space-y-3">
                          {/* 1. ส่วน Card แสดงรายละเอียดสถานะ */}
                          <Card className="p-4 bg-[#FEFCE8] border border-[#FEF08A] rounded-none shadow-none space-y-2">
                            <div className="flex items-center justify-between">
                              <Text variant="small" className="font-normal text-[#854D0E] mb-0">
                                สถานะ: รอเจ้าของร้านอนุมัติการยกเลิก
                              </Text>
                              <Badge
                                variant="warning"
                                size="auto"
                                className="bg-[#FEF08A] text-[#854D0E] border-none text-[10px] font-normal rounded-none py-0.5 px-2"
                              >
                                {getStatusText(orderDetail.status)}
                              </Badge>
                            </div>

                            <div className="text-xs text-[#1C1B1B]">
                              <div>
                                <span className="font-normal text-[#1C1B1B]">ผู้ส่งคำขอ:</span>{" "}
                                <span className="text-[#1C1B1B]">{orderDetail.canceller || "-"}</span>
                              </div>
                              <div>
                                <span className="font-normal text-[#1C1B1B]">เหตุผลที่ระบุ:</span>{" "}
                                <span className="text-[#1C1B1B]">{orderDetail.cancel_reason || "-"}</span>
                              </div>
                              {orderDetail.cancel_requested_at && (
                                <Text variant="xs" className="text-[#1C1B1B] pt-0.5 mb-0">
                                  ส่งคำขอเมื่อ: {formatDate(orderDetail.cancel_requested_at)}
                                </Text>
                              )}
                            </div>
                          </Card>

                          {/* 2. ปุ่ม Action ด้านล่าง (อยู่นอก Card) */}
                          <div className="flex gap-2 pt-1">
                            <Button
                              type="button"
                              variant="solid-red"
                              onClick={handleRevertCancel}
                              disabled={isCancelling}
                              className="flex-1 text-xs h-10 font-normal rounded-none"
                            >
                              {isCancelling ? "กำลังดำเนินการ..." : "ดึงคำขอยกเลิกกลับ (กู้คืนคำขอ)"}
                            </Button>

                            <Button
                              type="button"
                              variant="outline-cancel"
                              onClick={() => setSelectedOrderId(null)}
                              className="text-xs px-4 h-10 border border-gray-200 text-[#5F5E5E] hover:bg-[#F6F3F2] font-normal rounded-none"
                            >
                              ปิด
                            </Button>
                          </div>
                        </div>
                      );
                    }

                    // 2. ถ้ารายการถูกยกเลิกเรียบร้อยแล้ว (CANCELLED)
                    if (status === "CANCELLED" || status === "ยกเลิก") {
                      return (
                        <div className="space-y-3">
                          <Card className="p-4 bg-[#FCF7F7] border border-[#F5DFDF] rounded-none shadow-none space-y-2">
                            <div className="flex items-center justify-between">
                              <Text variant="small" className="font-normal text-[#E51C23] mb-0">
                                สถานะคำขอ: รายการนี้ถูกยกเลิกแล้ว
                              </Text>
                              <Badge
                                variant="neutral"
                                size="auto"
                                className="bg-[#E51C23] text-white border-none text-[10px] font-normal rounded-none py-0.5 px-2"
                              >
                                {getStatusText(orderDetail.status)}
                              </Badge>
                            </div>
                            
                            <div className="text-xs text-[#1C1B1B] ">
                              <div>
                                <span className="font-normal text-[#1C1B1B]">ผู้ส่งคำขอ:</span>{" "}
                                <span className="text-[#1C1B1B]">{orderDetail.canceller || "-"}</span>
                              </div>
                              <div>
                                <span className="font-normal text-[#1C1B1B]">เหตุผลที่ระบุ:</span>{" "}
                                <span className="text-[#1C1B1B]">{orderDetail.cancel_reason || "-"}</span>
                              </div>
                              {(orderDetail.cancel_processed_at || orderDetail.cancelled_at || orderDetail.cancel_requested_at) && (
                                <Text variant="xs" className="text-[#1C1B1B] pt-0.5">
                                  อนุมัติเมื่อ: {formatDate(orderDetail.cancel_processed_at || orderDetail.cancelled_at || orderDetail.cancel_requested_at || "")}
                                </Text>
                              )}
                              <div>
                                <span className="font-normal text-[#1C1B1B]">หมายเหตุ:</span>{" "}
                                <span className="text-[#1C1B1B]">{orderDetail.cancel_remark || "-"}</span>
                              </div>
                            </div>
                          </Card>

                          <Button
                            type="button"
                            variant="solid-red"
                            onClick={() => {
                              navigate(
                                (isOwnerOrAdmin ? "/owner/pos/pos" : "/employee/pos/pos") +
                                  `?recover_order_id=${orderDetail.id}`,
                                { state: { recoverOrderId: orderDetail.id } }
                              );
                            }}
                            className="w-full text-xs h-10 font-normal rounded-none flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                          >
                            <RotateCcw className="w-4 h-4" />
                            <span>กู้คืน/แก้ไขรายการที่หน้า POS</span>
                          </Button>
                        </div>
                      );
                    }

                    // 3. เคสบิลปกติ หรือ บิลที่เคยโดนปฏิเสธคำขอ
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
                                size="auto"
                                className="bg-[#E51C23] text-white border-none text-[10px] font-normal rounded-none py-0.5 px-2"
                              >
                                {getStatusText(orderDetail.status, orderDetail.cancel_remark)}
                              </Badge>
                            </div>

                            <div className="text-xs text-[#1C1B1B]">
                              {orderDetail.canceller && (
                                <div>
                                  <span className="font-normal text-[#1C1B1B]">ผู้ส่งคำขอเดิม:</span>{" "}
                                  <span className="text-[#1C1B1B]">{orderDetail.canceller}</span>
                                </div>
                              )}
                              <div>
                                <span className="font-normal text-[#1C1B1B]">เหตุผลจากเจ้าของร้าน:</span>{" "}
                                <span className="text-[#1C1B1B]">{orderDetail.cancel_remark || "-"}</span>
                              </div>
                              {orderDetail.cancel_processed_at && (
                                <Text variant="xs" className="text-[#1C1B1B] pt-0.5 mb-0">
                                  ปฏิเสธคำขอเมื่อ: {formatDate(orderDetail.cancel_processed_at)}
                                </Text>
                              )}
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
                            {/*  ปุ่มไดนามิก: ถ้าเป็น Owner จะอนุมัติทันที / ถ้าเป็น Employee จะส่งคำขอ */}
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
}
