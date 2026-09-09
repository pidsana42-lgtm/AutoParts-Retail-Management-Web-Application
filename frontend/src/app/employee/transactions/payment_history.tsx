import React, { useState } from "react";
import {
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ScanBarcode,
  Printer,
  X,
  FileText,
} from "lucide-react";

import { useNavigate, useSearchParams } from "react-router-dom";

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
import { PaymentTypeBadge, PaymentStatusBadge } from "../../../components/elements/status_badge";
import { formatDate } from "../../../utils/date";
import { useUserRole } from "../../../hooks/useUserRole";
import { posApiService } from "../../../service/http/pos/pos_service";
import { autoPrintPdfBlob, downloadPdfBlob } from "../../../utils/payment_history_print";


export default function PaymentHistoryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isOwnerOrAdmin } = useUserRole();
  const initialSearch = searchParams.get("search")?.trim() ?? "";
  const initialTypeFilter = searchParams.get("type") === "repayment" ? "repayment" : "";
  const [printingReceiptId, setPrintingReceiptId] = useState<number | string | null>(null);

  const handlePrintReceipt = async (item: PaymentHistoryItem) => {
    const targetId = item.receipt_id || item.receipt_number;
    setPrintingReceiptId(targetId);
    try {
      let blob: Blob;
      if (item.payment_type === "repayment") {
        blob = await posApiService.printPaymentReceiptPDF(targetId);
      } else {
        blob = await posApiService.printOrderReceipt(item.order_numbers || targetId);
      }
      const rawNum = item.receipt_number || targetId;
      const fileName = String(rawNum).endsWith(".pdf") ? `${rawNum}` : `${rawNum}.pdf`;
      autoPrintPdfBlob(blob, fileName);
    } catch (err) {
      console.error("Failed to print receipt:", err);
      alert("ไม่สามารถสร้างไฟล์ PDF ใบเสร็จได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setPrintingReceiptId(null);
    }
  };

  const {
    items,
    totalRows,
    totalPages,
    isLoading,
    error,
    ownerStats,
    employeeStats,
    search, 
    typeFilter,
    statusFilter,
    paymentMethod,
    employeeId,
    employeeList,
    startDate,
    endDate,
    page,
    limit,
    selectedReceipt,
    cancelReason,
    cancelRemark,
    isCancelling,
    isPrintingStatement,
    setSearch,
    setTypeFilter,
    setStatusFilter,
    setPaymentMethod,
    setEmployeeId,
    setStartDate,
    setEndDate,
    setPage,
    setLimit,
    setSelectedReceipt,
    setCancelReason,
    setCancelRemark,
    handleApplyFilter,
    handleRequestCancelReceipt,
    handleRevertCancelRequest,
    handleApproveCancelReceipt,
    handleRejectCancelReceipt,
    handleCancelReceipt,
    handlePrintCustomerStatement,
  } = usePaymentHistory(initialSearch, initialTypeFilter);

  const formatCurrency = (val: number) => {
    return (val || 0).toLocaleString("th-TH", {
      minimumFractionDigits: 2,
    });
  };

  const kpiValue = (value: React.ReactNode) =>
    isLoading ? <span className="text-gray-400 animate-pulse">...</span> : value;

  return (
    <div className="relative flex min-h-screen bg-white text-slate-800 font-sans overflow-x-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        <main className="p-6 space-y-6 flex-1">
          {/* Section Title */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <Heading level='h1' weight='semibold' className='m-0 text-black'>
                ประวัติการชำระเงิน
              </Heading>
              <Heading level='h6' className='m-0 mt-1'>
                บันทึกรายการรับชำระเงินและตัดหนี้ที่คุณทำรายการ
              </Heading>
            </div>
          </div>

          {/* Filter Bar */}
          <Card className="bg-[#F6F3F2] rounded-none shadow-none border-y border-r border-gray-200 border-l-4 border-l-[#E51C23] overflow-hidden">
            <CardContent className="p-5 md:p-6 space-y-4">
              {/* ช่องที่ 1: ค้นหาคำ + พนักงาน */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                {/* 1.1 ค้นหาเลขที่ใบเสร็จ / บิล / ชื่อลูกค้า */}
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
                      placeholder="พิมพ์เลขที่ใบเสร็จ RE-XXX, INV-XXX, ชื่อลูกค้า..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full h-10 bg-white border border-gray-200 rounded-none pl-11 pr-4 text-sm text-[#1C1B1B] font-light focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 shadow-sm transition-all placeholder:text-[#6B7280]"
                    />
                  </div>
                </div>

                {/* 1.2 พนักงานขาย (เฉพาะเจ้าของร้าน 4/12) */}
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

              {/* บรรทัดที่ 2: ตัวกรองประเภท + วันที่ + ช่องทาง + ปุ่มค้นหาและพิมพ์สรุปยอด */}
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

                <div className="md:col-span-6 lg:col-span-2 flex flex-col gap-1.5">
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

                <div className="md:col-span-6 lg:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-[#5F5E5E]">
                    สถานะรายการ
                  </label>
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    placeholder="ทุกสถานะ"
                    className="bg-white border-none rounded-none h-10 text-sm font-normal text-[#1C1B1B] px-3 shadow-none focus-visible:ring-0 cursor-pointer"
                    options={[
                      { label: "ทุกสถานะ", value: "" },
                      { label: "สำเร็จ", value: "completed" },
                      { label: "รออนุมัติยกเลิก", value: "pending_cancel" },
                      { label: "ยกเลิกแล้ว", value: "cancelled" },
                    ]}
                  />
                </div>

                <div className="md:col-span-6 lg:col-span-2 flex flex-col gap-1.5">
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

                <div className="md:col-span-6 lg:col-span-2 flex items-center gap-2">
                  <Button
                    onClick={handleApplyFilter}
                    className="flex-1 h-10 rounded-none bg-[#E51C23] hover:bg-[#c9151b] text-white text-sm font-normal transition-colors border-none shadow-none cursor-pointer"
                  >
                    ค้นหา
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Small Stat Cards เหนือตาราง */}
          {isOwnerOrAdmin ? (
            /* 1. ฝั่งเจ้าของร้าน (Owner System) */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
              {/* Card 1: ยอดรับชำระสุทธิ (Net Total Collected) */}
              <Card className="border-l-[5px]! border-l-emerald-500! flex flex-col justify-between p-4 md:p-5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Heading level="h6" className="uppercase tracking-wider">
                      ยอดรับชำระสุทธิ
                    </Heading>
                  </div>
                  <Heading level="h3">
                    ฿{kpiValue(formatCurrency(ownerStats.netTotalCollected))}
                  </Heading>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-[#6B7280] font-light">
                  <span>จำนวนรายการทั้งหมด</span>
                  <span className="text-[#259B24] font-normal">{ownerStats.completedCount} รายการ</span>
                </div>
              </Card>

              {/* Card 2: ช่องทางการเงิน (Payment Methods) */}
              <Card className="border-l-[5px]! border-l-sky-700! flex flex-col justify-between p-4 md:p-5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Heading level="h6" className="uppercase tracking-wider">
                      ช่องทางการเงิน
                    </Heading>
                  </div>
                  <Heading level="h3" className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-[#259B24]" title="เงินสด">
                      ฿{kpiValue(ownerStats.cashTotal.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 }))}
                    </span>
                    <span className="text-xs text-gray-400 font-light">/</span>
                    <span className="text-blue-500" title="เงินโอน/สแกน QR">
                      ฿{kpiValue(ownerStats.transferQrTotal.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 }))}
                    </span>
                  </Heading>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-[#6B7280] font-light">
                  <span>สด: <span className="text-[#259B24] font-normal">฿{formatCurrency(ownerStats.cashTotal)}</span></span>
                  <span>โอน/QR: <span className="text-blue-500 font-normal">฿{formatCurrency(ownerStats.transferQrTotal)}</span></span>
                </div>
              </Card>

              {/* Card 3: ประเภทการรับชำระ (Payment Types) */}
              <Card className="border-l-[5px]! border-l-teal-500! flex flex-col justify-between p-4 md:p-5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Heading level="h6" className="uppercase tracking-wider">
                      ประเภทการรับชำระ
                    </Heading>
                  </div>
                  <Heading level="h3" className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-[#1C1B1B]" title="ชำระสดหน้าร้าน (บิล POS)">
                      ฿{kpiValue(ownerStats.posPaymentTotal.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 }))}
                    </span>
                    <span className="text-xs text-gray-400 font-light">/</span>
                    <span className="text-teal-500" title="เคลียร์หนี้เงินเชื่อ">
                      ฿{kpiValue(ownerStats.repaymentTotal.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 }))}
                    </span>
                  </Heading>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-[#6B7280] font-light">
                  <span>หน้าร้าน: ฿{formatCurrency(ownerStats.posPaymentTotal)} ({ownerStats.posPaymentCount})</span>
                  <span>เคลียร์หนี้: ฿{formatCurrency(ownerStats.repaymentTotal)} ({ownerStats.repaymentCount})</span>
                </div>
              </Card>

              {/* Card 4: รายการที่ยกเลิก (Cancelled Payments) */}
              <Card className="border-l-[5px]! border-l-[#E51C23]! flex flex-col justify-between p-4 md:p-5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Heading level="h6" className="uppercase tracking-wider">
                      รายการที่ยกเลิก
                    </Heading>
                  </div>
                  <Heading level="h3" className="text-[#E51C23]">
                    ฿{kpiValue(formatCurrency(ownerStats.cancelledTotal))}
                  </Heading>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-[#6B7280] font-light">
                  <span>จำนวนรายการที่ยกเลิก</span>
                  <span className="text-[#E51C23] font-normal">{ownerStats.cancelledCount} รายการ</span>
                </div>
              </Card>
            </div>
          ) : (
            /* 2. ฝั่งพนักงาน (Employee / Somchai หน้าร้าน) */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
              {/* Card 1: ยอดรับชำระของฉัน (My Collected Total) */}
              <Card className="border-l-[5px]! border-l-sky-700! flex flex-col justify-between p-4 md:p-5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Heading level="h6" className="uppercase tracking-wider">
                      ยอดรับชำระของฉัน
                    </Heading>
                  </div>
                  <Heading level="h3">
                    ฿{kpiValue(formatCurrency(employeeStats.netTotalCollected))}
                  </Heading>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-[#6B7280] font-light">
                  <span>รับชำระสำเร็จ</span>
                  <span className="text-emerald-500 font-normal">{employeeStats.completedCount} รายการ</span>
                </div>
              </Card>

              {/* Card 2: เงินสดที่ต้องส่งมอบ (Cash in Hand) — สำคัญที่สุด */}
              <Card className="border-l-[5px]! border-l-emerald-500! flex flex-col justify-between p-4 md:p-5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Heading level="h6" className="uppercase tracking-wider">
                      เงินสดที่ต้องส่งมอบ
                    </Heading>
                  </div>
                  <Heading level="h3">
                    ฿{kpiValue(formatCurrency(employeeStats.cashTotal))}
                  </Heading>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-[#6B7280] font-light">
                  <span>นับจากบิลเงินสด</span>
                  <span className="text-emerald-500 font-normal">{employeeStats.cashCount} รายการ</span>
                </div>
              </Card>

              {/* Card 3: เงินโอน/สแกน QR (Transfer / QR Code) */}
              <Card className="border-l-[5px]! border-l-gray-300! flex flex-col justify-between p-4 md:p-5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Heading level="h6" className="uppercase tracking-wider">
                      เงินโอน / สแกน QR
                    </Heading>
                  </div>
                  <Heading level="h3">
                    ฿{kpiValue(formatCurrency(employeeStats.transferQrTotal))}
                  </Heading>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-[#6B7280] font-light">
                  <span>โอนเข้าบัญชีร้าน</span>
                  <span className="text-gray-600 font-normal">มีสลิป {employeeStats.transferQrCount} รายการ</span>
                </div>
              </Card>

              {/* Card 4: บิลที่ถูกยกเลิก (My Cancelled Transactions) */}
              <Card className="border-l-[5px]! border-l-[#E51C23]! flex flex-col justify-between p-4 md:p-5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Heading level="h6" className="uppercase tracking-wider">
                      บิลที่ถูกยกเลิก
                    </Heading>
                  </div>
                  <Heading level="h3">
                    ฿{kpiValue(formatCurrency(employeeStats.cancelledTotal))}
                  </Heading>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-[#6B7280] font-light">
                  <span>หักออกจากยอดส่งเงินแล้ว</span>
                  <span className="text-[#E51C23] font-normal">{employeeStats.cancelledCount} รายการ</span>
                </div>
              </Card>
            </div>
          )}

          <div className="flex w-full items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline-cancel"
              leftIcon={<Printer size={16} />}
              disabled={isPrintingStatement || items.length === 0}
              onClick={() => handlePrintCustomerStatement()}
              className="rounded-none h-11 px-4 text-xs font-normal text-[#5F5E5E] bg-white border border-gray-200 hover:bg-[#F6F3F2] shadow-none cursor-pointer transition-colors"
              title="พิมพ์สรุปยอดชำระและยอดคงเหลือตามตัวกรองปัจจุบัน"
            >
              พิมพ์สรุปยอด
            </Button>
          </div>
                   
          {/* Data Table */}
          <Card className="bg-white rounded-none shadow-sm overflow-hidden border border-gray-200">
            <Table className="text-left border-collapse">
              <TableHeader className="bg-[#F6F3F2] rounded-none border-b border-gray-200 text-[11px] text-[#6B7280] uppercase tracking-wider">
                <TableRow>
                  <TableHead className="py-3 px-3 ">เลขที่ใบเสร็จ</TableHead>
                  <TableHead className="py-3 px-3 ">วันที่ - เวลา</TableHead>
                  <TableHead className="py-3 px-3">ชื่อลูกค้า / บิลที่ชำระ</TableHead>
                  <TableHead className="py-3 px-3 text-center">ประเภทการชำระ</TableHead>
                  <TableHead className="py-3 px-3 text-center">สถานะ</TableHead>
                  <TableHead className="py-3 px-3  text-left">ผู้บันทึกยอด</TableHead>
                  <TableHead className="py-3 px-3 text-right">ยอดเงินที่รับ</TableHead>
                  <TableHead className="py-3 px-3 text-center">การชำระเงิน</TableHead>
                  <TableHead className="py-3 px-3  text-center">จัดการ</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-200">
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12 text-center">
                      <Text variant="small" className="text-gray-500 mb-0">
                        กำลังโหลดข้อมูลประวัติการชำระเงิน...
                      </Text>
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12 text-center">
                      <Text variant="small" className="text-red-500 mb-0">
                        {error}
                      </Text>
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12 text-center">
                      <Text variant="small" className="text-gray-400 mb-0">
                        ไม่พบรายการประวัติการชำระเงิน
                      </Text>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item: PaymentHistoryItem) => {
                    const isSelected =
                      selectedReceipt?.receipt_id === item.receipt_id &&
                      selectedReceipt?.payment_type === item.payment_type;
                    return (
                      <TableRow
                        key={`${item.payment_type}-${item.receipt_id}-${item.receipt_number}`}
                        onClick={() => setSelectedReceipt(item)}
                        className={cn(
                          "cursor-pointer transition-colors",
                          isSelected
                            ? "bg-red-50/70 border-l-2 border-l-[#E51C23]"
                            : "hover:bg-slate-50"
                        )}
                      >
                        {/* 1. เลขที่ใบเสร็จ */}
                        <TableCell className="py-3.5 px-3">
                          <Text variant="small" className="font-normal text-[#1C1B1B] mb-0 whitespace-nowrap">
                            {item.receipt_number}
                          </Text>
                        </TableCell>

                        {/* 2. วันที่ทำรายการ */}
                        <TableCell className="py-3.5 px-3">
                          <Text variant="xs" className="font-light text-[#5B5B5B] mb-0 whitespace-nowrap">
                            {formatDate(item.paid_at)}
                          </Text>
                        </TableCell>

                        {/* 3. ชื่อลูกค้า + เลขที่บิล */}
                        <TableCell className="py-3.5 px-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const filterName = item.customer_name || (item as any).customer_name_temp || "ลูกค้าทั่วไป";
                              setSearch(filterName);
                            }}
                            className="text-left font-normal text-[#1C1B1B] hover:text-[#E51C23] hover:underline mb-0 truncate max-w-50 cursor-pointer bg-transparent border-none p-0 block"
                            title="คลิกเพื่อกรองค้นหาเฉพาะลูกค้าคนนี้"
                          >
                            <Text variant="small" className="font-normal text-inherit mb-0 truncate">
                              {getDisplayCustomerName(item)}
                            </Text>
                          </button>
                          <Text variant="xs" className="font-light text-[#A8A29E] mb-0 truncate max-w-50">
                            บิล: {item.order_numbers || "-"}
                          </Text>
                        </TableCell>

                        {/* 4. ประเภทการชำระ */}
                        <TableCell className="py-3.5 px-3">
                          <PaymentTypeBadge type={item.payment_type} />
                        </TableCell>

                        {/* 5. สถานะ */}
                        <TableCell className="py-3.5 px-3">
                          <PaymentStatusBadge status={item.status} />
                        </TableCell>

                        {/* 6. ผู้บันทึกยอด */}
                        <TableCell className="py-3.5 px-3">
                          <Text variant="xs" className="font-normal text-[#1C1B1B] mb-0 whitespace-nowrap">
                            {item.received_by_name || "-"}
                          </Text>
                        </TableCell>

                        {/* 7. ยอดเงินที่รับ */}
                        <TableCell className="py-3.5 px-3 text-right">
                          <Text variant="small" className="font-normal text-[#1C1B1B] mb-0 whitespace-nowrap">
                            {formatCurrency(item.total_received)}
                          </Text>
                        </TableCell> 

                        {/* 8. ช่องทางชำระเงิน */}
                        <TableCell className="py-3.5 px-3 text-center">
                          <Badge variant={getPaymentVariant(item.payment_method)} className="rounded-none whitespace-nowrap">
                            {item.payment_method || "เงินสด"}
                          </Badge>
                        </TableCell>

                        {/* 9. จัดการ: ปุ่มดูรายละเอียด + ปุ่มพิมพ์ใบเสร็จ + ปุ่มเปิดใบสรุปยอดลูกค้า */}
                        <TableCell
                          className="py-3.5 px-3 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              className="inline-flex items-center justify-center p-1.5 transition-colors cursor-pointer rounded-full hover:bg-gray-100"
                              title="ดูรายละเอียดใบเสร็จ"
                              onClick={() => setSelectedReceipt(item)}
                            >
                              <Eye className="w-4 h-4 text-gray-600" />
                            </button>
                            <button
                              type="button"
                              disabled={printingReceiptId === (item.receipt_id || item.receipt_number)}
                              className="inline-flex items-center justify-center p-1.5 transition-colors cursor-pointer rounded-full hover:bg-gray-100 disabled:opacity-40"
                              title="พิมพ์/ดาวน์โหลดใบเสร็จของบิลนี้"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePrintReceipt(item);
                              }}
                            >
                              <Printer className={cn("w-4 h-4 text-gray-600", printingReceiptId === (item.receipt_id || item.receipt_number) && "animate-pulse")} />
                            </button>
                            <button
                              type="button"
                              disabled={isPrintingStatement}
                              className="inline-flex items-center justify-center p-1.5 transition-colors cursor-pointer rounded-full hover:bg-gray-100 disabled:opacity-40"
                              title={`เปิดใบสรุปยอดชำระและยอดคงเหลือของ ${getDisplayCustomerName(item)}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                const custTarget = item.customer_name || (item as any).customer_name_temp || "ลูกค้าทั่วไป";
                                handlePrintCustomerStatement(custTarget, "preview");
                              }}
                            >
                              <FileText className={cn("w-4 h-4 text-gray-600", isPrintingStatement && "animate-pulse")} />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
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

                {/* ปุ่มพิมพ์ใบเสร็จรับเงิน (PDF) */}
                {/* <Button
                  type="button"
                  variant="primary"
                  onClick={async () => {
                    try {
                      const targetId = selectedReceipt.receipt_id || selectedReceipt.receipt_number;
                      let blob: Blob;
                      if (selectedReceipt.payment_type === "repayment") {
                        blob = await posApiService.printPaymentReceiptPDF(targetId);
                      } else {
                        blob = await posApiService.printOrderReceipt(selectedReceipt.order_numbers || targetId);
                      }
                      const blobUrl = window.URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
                      window.open(blobUrl, "_blank");
                    } catch (err) {
                      alert("ไม่สามารถเปิดพิมพ์ใบเสร็จได้");
                    }
                  }}
                  className="w-full text-xs h-10 font-normal flex items-center justify-center gap-1.5 shadow-sm bg-[#1C1B1B] hover:bg-zinc-800 text-white cursor-pointer rounded-none"
                >
                  <Printer className="w-4 h-4" />
                  <span>
                    {selectedReceipt.status === "cancelled"
                      ? "พิมพ์ใบเสร็จที่ยกเลิก (Void Receipt)"
                      : "พิมพ์ใบเสร็จรับเงิน (PDF)"}
                  </span>
                </Button> */}

                {/* 2. กรณีเป็น Direct Payment (ชำระสดหน้าร้าน) -> มีปุ่มเด้งไปหน้าประวัติการขายสินค้าและเลือกบิลให้อัตโนมัติ */}
                {selectedReceipt.payment_type === "payment" && selectedReceipt.status !== "cancelled" && (
                  <div className="p-4 bg-[#F6F3F2] border-l-3 border-[#E51C23] space-y-3">
                    <div>
                      <Text variant="small" className="font-medium text-sm text-[#1C1B1B]">
                        ชำระเงินสด/QR หน้าร้าน 
                      </Text>
                      <Text variant="xs" className="text-[#6B7280] leading-relaxed mt-1">
                        รายการนี้เป็นการชำระเงินสำหรับบิลขายหน้าร้านโดยตรง เพื่อความถูกต้องของสต็อกสินค้าและระบบบัญชี การยกเลิกต้องดำเนินการผ่านเมนู <span className="font-normal text-[#E51C23]">"ประวัติการขายสินค้า"</span> เพื่อคืนสินค้าเข้าสต็อก
                      </Text>
                    </div>

                    <Button
                      type="button"
                      variant="solid-red"
                      onClick={() => {
                        const targetOrder = selectedReceipt.order_numbers || selectedReceipt.receipt_number;
                        const targetPath = isOwnerOrAdmin
                          ? `/owner/pos/sales_history?order_number=${encodeURIComponent(targetOrder)}`
                          : `/employee/pos/sales_history?order_number=${encodeURIComponent(targetOrder)}`;
                        setSelectedReceipt(null);
                        navigate(targetPath);
                      }}
                      className="w-full text-xs h-10 font-normal flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <span>ไปยังหน้าประวัติการขายเพื่อขอยกเลิกบิลนี้</span>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {/* 3. กรณีเป็น Repayment (เคลียร์บิลเงินเชื่อ) */}
                {selectedReceipt.payment_type === "repayment" && (
                  <>
                    {/* 3.1 อยู่ในสถานะ รออนุมัติการยกเลิก (pending_cancel) */}
                    {selectedReceipt.status === "pending_cancel" && (
                      <div className="space-y-4">
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
                              รออนุมัติยกเลิก
                            </Badge>
                          </div>
                          
                          <div className="text-xs text-[#1C1B1B] bg-[#FFFBEB]">
                            <div>
                              <span className="font-normal text-[#1C1B1B]">ผู้ส่งคำขอ:</span>{" "}
                              <span className="text-[#1C1B1B]">{selectedReceipt.cancel_requested_by_name || "-"}</span>
                            </div>
                            <div>
                              <span className="font-normal text-[#1C1B1B]">เหตุผลที่ระบุ:</span>{" "}
                              <span className="text-[#1C1B1B]">{selectedReceipt.cancel_reason || "-"}</span>
                            </div>
                            {selectedReceipt.cancel_requested_at && (
                              <div className="text-[11px] text-[#1C1B1B] pt-0.5">
                                ส่งคำขอเมื่อ: {formatDate(selectedReceipt.cancel_requested_at)}
                              </div>
                            )}
                          </div>
                        </Card>

                        {/* ฟอร์มดำเนินการของ Owner / ปุ่มดึงกลับของ Employee */}
                        {isOwnerOrAdmin ? (
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
                                onClick={handleApproveCancelReceipt}
                                disabled={isCancelling}
                                className="flex-1 text-xs h-10 font-normal rounded-none"
                              >
                                {isCancelling ? "กำลังดำเนินการ..." : "อนุมัติยกเลิก (คืนหนี้)"}
                              </Button>

                              <Button
                                type="button"
                                variant="solid-red"
                                onClick={handleRejectCancelReceipt}
                                disabled={isCancelling}
                                className="flex-1 text-xs h-10 font-normal rounded-none"
                              >
                                {isCancelling ? "กำลังดำเนินการ..." : "ปฏิเสธคำขอ"}
                              </Button>

                              <Button
                                type="button"
                                variant="outline-cancel"
                                onClick={() => setSelectedReceipt(null)}
                                className="text-xs px-4 h-10 border border-gray-200 text-[#5F5E5E] hover:bg-[#F6F3F2] font-normal"
                              >
                                ปิด
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-3 pt-1">
                            <Button
                              type="button"
                              variant="solid-red"
                              onClick={handleRevertCancelRequest}
                              disabled={isCancelling}
                              className="flex-1 text-xs h-10 font-normal"
                            >
                              {isCancelling ? "กำลังดำเนินการ..." : "ดึงคำขอยกเลิกกลับ"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline-cancel"
                              onClick={() => setSelectedReceipt(null)}
                              className="text-xs px-6 h-10 border border-gray-200 text-[#5F5E5E] hover:bg-[#F6F3F2] font-normal"
                            >
                              ปิด
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 3.2 สถานะ ปกติ (completed) ยังไม่มีคำขอยกเลิก */}
                    {selectedReceipt.status === "completed" && (
                      <div className="space-y-3 pt-2">
                        <Text variant="xs" className="font-normal text-[#E51C23] uppercase tracking-wider mb-1">
                          {isOwnerOrAdmin
                            ? "ระบุเหตุผลในการยกเลิกใบเสร็จรับเงิน (ทำให้ยอดหนี้กลับมาค้างชำระทันที)"
                            : "ระบุเหตุผลในการส่งคำขอยกเลิกใบเสร็จรับเงิน (ส่งไปยังเจ้าของร้าน)"}
                        </Text>

                        <textarea
                          rows={3}
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          placeholder="ตัวอย่าง: คีย์รับเงินผิดคน / ลูกค้าแจ้งขอแก้ไขช่องทางจ่ายเงิน..."
                          className="w-full p-2.5 text-xs font-light bg-[#F6F3F2] border border-[#E51C23] rounded-none focus:outline-none text-[#1C1B1B] placeholder-[#6B7280] resize-none"
                        />

                        <div className="flex gap-3 pt-1">
                          {isOwnerOrAdmin ? (
                            <Button
                              type="button"
                              variant="solid-red"
                              onClick={handleCancelReceipt}
                              disabled={isCancelling}
                              className="flex-1 text-sm h-11 font-normal"
                            >
                              {isCancelling ? "กำลังยกเลิกรายการ..." : "ยืนยันยกเลิกใบเสร็จนี้ (คืนหนี้ทันที)"}
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="solid-red"
                              onClick={handleRequestCancelReceipt}
                              disabled={isCancelling}
                              className="flex-1 text-sm h-11 font-normal"
                            >
                              {isCancelling ? "กำลังส่งคำขอ..." : "ส่งคำขอยกเลิกใบเสร็จ (รออนุมัติ)"}
                            </Button>
                          )}

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
                  </>
                )}

                {/* 4. กรณีรายการถูกยกเลิกแล้ว (cancelled ทั้ง payment และ repayment) */}
                {selectedReceipt.status === "cancelled" && (
                  <div className="space-y-4 pt-2">
                    <Card className="p-4 bg-[#FCF7F7] border border-[#F5DFDF] rounded-none shadow-none space-y-2">
                      <div className="flex items-center justify-between">
                        <Text variant="small" className="font-normal text-[#E51C23] mb-0">
                          สถานะ: รายการรับชำระนี้ถูกยกเลิกแล้ว
                        </Text>
                        <Badge
                          variant="neutral"
                          size="auto"
                          className="bg-[#E51C23] text-white border-none text-[10px] font-normal rounded-none py-0.5 px-2"
                        >
                          ยกเลิกแล้ว
                        </Badge>
                      </div>

                      <div className="text-xs text-[#1C1B1B] ">
                        {selectedReceipt.cancel_requested_by_name && (
                          <div>
                            <span className="font-normal text-[#1C1B1B]">ผู้ส่งคำขอยกเลิก:</span>{" "}
                            <span className="text-[#1C1B1B]">{selectedReceipt.cancel_requested_by_name}</span>
                          </div>
                        )}
                        {selectedReceipt.cancel_reason && (
                          <div>
                            <span className="font-normal text-[#1C1B1B]">เหตุผลการยกเลิก:</span>{" "}
                            <span className="text-[#1C1B1B]">{selectedReceipt.cancel_reason}</span>
                          </div>
                        )}
                        {selectedReceipt.cancelled_by_name && (
                          <div>
                            <span className="font-normal text-[#1C1B1B]">ผู้อนุมัติยกเลิก:</span>{" "}
                            <span className="text-[#1C1B1B]">{selectedReceipt.cancelled_by_name}</span>
                          </div>
                        )}
                        {(selectedReceipt.cancelled_at || selectedReceipt.cancel_requested_at) && (
                          <div className="text-[11px] text-[#1C1B1B] pt-0.5">
                            ยกเลิกเมื่อ: {formatDate(selectedReceipt.cancelled_at || selectedReceipt.cancel_requested_at || "")}
                          </div>
                        )}
                        {selectedReceipt.cancel_remark && (
                          <div>
                            <span className="font-normal text-[#1C1B1B]">หมายเหตุการอนุมัติ:</span>{" "}
                            <span className="text-[#1C1B1B]">{selectedReceipt.cancel_remark}</span>
                          </div>
                        )}
                      </div>
                    </Card>

                    {/* <Button
                      type="button"
                      variant="outline-cancel"
                      onClick={() => handlePrintReceipt(selectedReceipt)}
                      disabled={printingReceiptId === (selectedReceipt.receipt_id || selectedReceipt.receipt_number)}
                      className="w-full text-xs h-10 font-normal rounded-none flex items-center justify-center gap-2 cursor-pointer shadow-sm border border-gray-300 hover:bg-gray-50 mt-2"
                    >
                      <Printer className={cn("w-4 h-4 text-[#E51C23]", printingReceiptId === (selectedReceipt.receipt_id || selectedReceipt.receipt_number) && "animate-pulse")} />
                      <span>พิมพ์ใบเสร็จที่ยกเลิก (เอกสารหลักฐาน)</span>
                    </Button> */}
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
