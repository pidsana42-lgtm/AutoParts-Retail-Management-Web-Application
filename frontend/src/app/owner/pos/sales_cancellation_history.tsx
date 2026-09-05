import React from "react";
import { useNavigate } from "react-router-dom";
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
  CopyPlus,
  Printer,
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
import { formatDate, getDisplayCustomerName, getPageNumbers, getPaymentVariant } from "../../../utils/poshelpers";
import { SalesCancellationStatusBadge } from "../../../components/elements/status_badge";

// นำเข้า Custom Hook ของเจ้าของร้าน
import { useOwnerSalesCancellationHistory } from "./hooks/useOwnerSalesCancellationHistory";
import { useSalesHistory } from "../../employee/pos/hooks/useSalesHistory";
import { posApiService } from "../../../service/http/pos/pos_service";
import { downloadPdfBlob } from "../../../utils/payment_history_print";
import type { SalesHistoryItemResponse } from "../../../interface/pos/sales_history_interface";

const OwnerSalesCancellationHistory: React.FC = () => {
  const navigate = useNavigate();
  // เรียกใช้ useOwnerSalesCancellationHistory
  const {
    dataList,
    selectedIds,
    isSelectAll,
    selectableCount,
    isLoading,
    error,
    stats,
    isStatsLoading,
    page,
    limit,
    totalRows,
    totalPages,
    setPage,
    setLimit,
    searchQuery,
    startDate,
    endDate,
    status,
    employeeId,
    employeeList,
    setEmployeeId,
    setSearchQuery,
    setStartDate,
    setEndDate,
    setStatus,
    handleSelectAll,
    handleSelectRow,
    handleSearch,
    handleApproveSelected, // ใช้ปุ่มอนุมัติสำหรับเจ้าของร้าน
    handleRejectSelected, // ใช้ปุ่มปฏิเสธสำหรับเจ้าของร้าน
    refetch,
  } = useOwnerSalesCancellationHistory();

  const kpiValue = (value: React.ReactNode) =>
    isStatsLoading ? <span className="text-gray-400 animate-pulse">...</span> : value;

  // ดึง Drawer State และ Action Handlers
  const {
    selectedOrderId,
    setSelectedOrderId,
    orderDetail,
    isDetailLoading,
    // cancelReason,
    // setCancelReason,
    cancelRemark,
    setCancelRemark,
    isCancelling,
    handleDirectCancelByOwner,
    handleRejectCancelByOwner,
    getStatusText,
  } = useSalesHistory();

  const [printingOrderId, setPrintingOrderId] = React.useState<number | string | null>(null);

  const handlePrintReceipt = async (orderId: number | string, orderNumber?: string) => {
    setPrintingOrderId(orderId);
    try {
      const blob = await posApiService.printOrderReceipt(orderId);
      const rawNum = orderNumber || `INV-${orderId}`;
      const fileName = String(rawNum).endsWith(".pdf") ? `${rawNum}` : `${rawNum}.pdf`;
      downloadPdfBlob(blob, fileName);
    } catch (err) {
      console.error("Failed to print receipt:", err);
      alert("ไม่สามารถสร้างไฟล์ PDF ใบเสร็จได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setPrintingOrderId(null);
    }
  };

  // Wrap drawer action handlers to also refetch table data
  const handleApproveDrawer = async () => {
    await handleDirectCancelByOwner();
    refetch();
  };

  const handleRejectDrawer = async () => {
    await handleRejectCancelByOwner();
    refetch();
  };

  return (
    // main container with padding and vertical spacing
    <main className="space-y-6 p-6">
      {/* Header ส่วนหัวของหน้า */}
      <header>
        <Heading level='h1' weight='semibold' className='m-0 text-black'>
          รายการยกเลิกจากพนักงาน
        </Heading>
        <Heading level='h6' className='m-0 mt-1'>
          ยกเลิกบิลขาย
        </Heading>
      </header>

      {/* Filter Bar */}
      <Card className="bg-[#F6F3F2] rounded-none shadow-none border-y border-r border-gray-200 border-l-4 border-l-[#E51C23] overflow-hidden">
        <CardContent className="p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            
            {/* ค้นหาเลขคำสั่งซื้อ/ชื่อลูกค้า (col-span-3) */}
            {/* ว่างก็เปลี่ยนมาเขียน handleSearchChange */}
            <div className="md:col-span-3 flex flex-col gap-1.5">
              <Text variant="xs" className="text-[#5F5E5E]">ค้นหาเลขคำสั่งซื้อ/ชื่อลูกค้า</Text>
              <div className="relative flex-1">
                <ScanBarcode className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10" size={18} />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="สแกนบาร์โค้ด / INV-2024-XXX หรือ ชื่อลูกค้า"
                  autoFocus
                  className="w-full h-11 bg-white border border-gray-200 rounded-none pl-12 pr-4 text-sm text-[#1C1B1B] font-light focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 shadow-sm transition-all placeholder:text-[#6B7280]"
                />
              </div>
            </div>

            {/* พนักงานผู้ส่งคำขอ */}
            <div className="md:col-span-2 flex flex-col gap-1.5">
              <Text variant="xs" className="text-[#5F5E5E]">พนักงานผู้ทำรายการ</Text> 
              <Select
                value={employeeId}
                onChange={(e: any) => setEmployeeId(e.target.value)}
                placeholder="พนักงานทุกคน"
                className="bg-white border-none rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 shadow-none"
                options={[
                  { label: "พนักงานทุกคน", value: "" },
                  ...employeeList, // แสดงรายชื่อพนักงานที่ดึงมาจาก API
                ]}
              />
            </div>

            {/* วันที่เริ่มต้น */}
            <div className="md:col-span-2 flex flex-col gap-1.5">
              <Text variant="xs" className="text-[#5F5E5E]">วันที่เริ่มต้น</Text>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white border-none rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 shadow-none cursor-pointer"
              />
            </div>

            {/* วันที่สิ้นสุด  */}
            <div className="md:col-span-2 flex flex-col gap-1.5">
              <Text variant="xs" className="text-[#5F5E5E]">วันที่สิ้นสุด</Text>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-white border-none rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 shadow-none cursor-pointer"
              />
            </div>

            {/* สถานะคำขอ */}
            <div className="md:col-span-2 flex flex-col gap-1.5">
              <Text variant="xs" className="text-[#5F5E5E]">สถานะคำขอ</Text>
              <Select
                value={status}
                onChange={(e: any) => setStatus(e.target.value)}
                placeholder="สถานะทั้งหมด"
                className="bg-white border-none rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 shadow-none"
                options={[
                  { label: "ทั้งหมด", value: "" },
                  { label: "รอดำเนินการ", value: "PENDING_CANCEL" },
                  { label: "อนุมัติแล้ว", value: "CANCELLED" },
                  { label: "ไม่อนุมัติ", value: "REJECTED" },
                ]}
              />
            </div>

            {/* ปุ่มค้นหา */}
            <div className="md:col-span-1">
              <Button
                onClick={handleSearch}
                className="w-full h-11 rounded-none bg-[#E51C23] hover:bg-[#c9151b] text-white text-sm font-normal transition-colors border-none shadow-sm cursor-pointer"
              >
                ค้นหา
              </Button>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Small Stat Cards เหนือตาราง */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        {/* 1. รออนุมัติ */}
        <Card className="border-l-[5px]! border-l-amber-300! flex flex-col justify-between p-4 md:p-5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <Heading level="h6" className="uppercase tracking-wider">
                รออนุมัติยกเลิก
              </Heading> 
            </div>
            <Heading level="h3">
              ฿{kpiValue(stats.pendingAmount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
            </Heading>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-[#6B7280] font-light">
            <span>รอการตัดสินใจ</span>
            <span className="text-amber-400 font-normal">{stats.pendingCount} รายการ</span>
          </div>
        </Card>

        {/* 2. อนุมัติแล้ว*/}
        <Card className="border-l-[5px]! border-l-emerald-500! flex flex-col justify-between p-4 md:p-5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <Heading level="h6" className="uppercase tracking-wider">
                อนุมัติยกเลิกแล้ว
              </Heading>
            </div>
            <Heading level="h3">
              ฿{kpiValue(stats.approvedAmount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
            </Heading>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-[#6B7280] font-light">
            <span>ยอดขายที่ลดลง</span>
            <span className="text-emerald-500 font-normal">{stats.approvedCount} รายการ</span>
          </div>
        </Card>

        {/* 3. ปฏิเสธแล้ว (Rejected) */}
        <Card className="border-l-[5px]!  border-l-[#E51C23]! flex flex-col justify-between p-4 md:p-5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <Heading level="h6" className="uppercase tracking-wider">
                ปฏิเสธคำขอ
              </Heading>
            </div>
            <Heading level="h3">
              ฿{kpiValue(stats.rejectedAmount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
            </Heading>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-[#6B7280] font-light">
            <span>ไม่ผ่านการอนุมัติ</span>
            <span className="text-[#E51C23] font-normal">{stats.rejectedCount} รายการ</span>
          </div>
        </Card>

        {/* 4. คำขอทั้งหมด (Total Requests) */}
        <Card className="border-l-[5px]! border-l-sky-700! flex flex-col justify-between p-4 md:p-5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <Heading level="h6" className="uppercase tracking-wider">
                คำขอทั้งหมด
              </Heading>
            </div>
            <Heading level="h3">
              ฿{kpiValue(stats.totalAmount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
            </Heading>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-[#6B7280] font-light">
            <span>ประวัติคำขอทั้งหมด</span>
            <span className="text-sky-700 font-normal">{stats.totalCount} รายการ</span>
          </div>
        </Card>
      </div>

      {/* Table Section */}
      <Card className="bg-white rounded-none shadow-sm overflow-hidden border border-gray-200">
        <Table className="w-full! min-w-0! table-fixed text-left border-collapse">
          <TableHeader className="bg-[#F6F3F2] rounded-none border-b border-gray-200 text-[11px] text-[#6B7280] uppercase tracking-wider">
            <TableRow>
              <TableHead className="py-3 px-3 w-[4%] text-center">
                <input
                  type="checkbox"
                  checked={isSelectAll}
                  onChange={handleSelectAll}
                  disabled={selectableCount === 0}
                  className="w-4 h-4 border border-gray-300 rounded-none bg-white checked:bg-[#E51C23] checked:border-[#E51C23] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 appearance-none flex items-center justify-center after:content-['✓'] after:text-white after:text-[10px] after:font-bold after:hidden checked:after:block"
                />
              </TableHead>
              <TableHead className="py-3 px-2.5 w-[14%] ">หมายเลขคำสั่งซื้อ</TableHead>
              <TableHead className="py-3 px-2.5 w-[13%]">วันที่ทำรายการยกเลิก</TableHead>
              <TableHead className="py-3 px-2.5 w-[28%] ">ชื่อลูกค้า/อู่ซ่อมรถ/บริษัท</TableHead>
              <TableHead className="py-3 px-2.5 text-right w-[10%] ">จำนวนเงิน</TableHead>
              <TableHead className="py-3 px-2.5 text-left w-[11%]">ผู้ขอยกเลิก</TableHead>
              <TableHead className="py-3 px-2.5 text-center w-[12%] ">สถานะ</TableHead>
              <TableHead className="py-3 px-2 text-center w-[9.5%]">จัดการ</TableHead>
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
                  ไม่พบข้อมูลคำขอยกเลิกบิล
                </TableCell>
              </TableRow>
            ) : (
              dataList.map((item) => {
                const isChecked = selectedIds.includes(item.id);
                const isPendingCancel = (item.status || "").toUpperCase() === "PENDING_CANCEL";
                const isSelected = selectedOrderId === item.id;
                return (
                  <TableRow
                    key={item.id}
                    onClick={() => setSelectedOrderId(item.id)}
                    className={cn(
                      "cursor-pointer transition-colors",
                      isSelected
                        ? "bg-red-50/70 border-l-2 border-l-[#E51C23]"
                        : isChecked
                        ? "bg-red-50/40"
                        : "hover:bg-slate-50"
                    )}
                  >
                    {/* Checkbox */}
                    <TableCell
                      className="py-3 px-2 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleSelectRow(item.id)}
                        disabled={!isPendingCancel}
                        className="w-4 h-4 border border-gray-300 rounded-none bg-white checked:bg-[#E51C23] checked:border-[#E51C23] disabled:bg-gray-100 disabled:border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer appearance-none flex items-center justify-center after:content-['✓'] after:text-white after:text-[10px] after:font-bold after:hidden checked:after:block"
                      />
                    </TableCell>

                    {/* หมายเลขคำสั่งซื้อ */}
                    <TableCell className="py-3 px-2.5">
                      <Text variant="small" className="font-normal text-[#1C1B1B] mb-0 truncate">
                        {item.order_number}
                      </Text>
                    </TableCell>

                    {/* วันที่ทำรายการยกเลิก */}
                    <TableCell className="py-3 px-2.5">
                      <Text variant="xs" className="font-light text-[#5B5B5B] mb-0">
                        {formatDate(
                          item.cancel_processed_at ||
                          item.cancel_requested_at ||
                          item.order_date ||
                          item.created_at ||
                          ""
                        )}
                      </Text>
                    </TableCell>

                    {/* ชื่อลูกค้า */}
                    <TableCell className="py-3 px-2.5 truncate">
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
                    <TableCell className="py-3 px-2.5 text-right">
                      <Text variant="small" className="font-normal text-[#1C1B1B] mb-0">
                        {item.total_amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </Text>
                    </TableCell>

                    {/* ผู้ยกเลิก */}
                    <TableCell className="py-3 px-2.5 text-left">
                      <Text variant="xs" className="font-normal text-[#1C1B1B] mb-0 truncate">
                        {item.canceller || "-"}
                      </Text>
                    </TableCell>

                    {/* สถานะ */}
                    <TableCell className="py-3 px-2.5 text-center">
                      <SalesCancellationStatusBadge
                        status={item.status}
                        paymentStatus={item.payment_status}
                        cancelRemark={item.cancel_remark}
                        cancelProcessedAt={item.cancel_processed_at}
                      />
                    </TableCell>

                    {/* จัดการ */}
                    <TableCell
                      className="py-3 px-2 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            title="ดูรายละเอียด"
                            onClick={() => setSelectedOrderId(item.id)}
                            className="inline-flex items-center justify-center p-1.5 transition-colors cursor-pointer rounded-full hover:bg-gray-100"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={printingOrderId === item.id}
                            title="พิมพ์/ดาวน์โหลดใบเสร็จที่ยกเลิก (Void Receipt)"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrintReceipt(item.id, item.order_number);
                            }}
                            className="inline-flex items-center justify-center p-1.5 transition-colors cursor-pointer rounded-full hover:bg-gray-100"
                          >
                            <Printer className={cn("w-4 h-4", printingOrderId === item.id && "animate-pulse")} />
                          </button>
                          {(item.status || "").toUpperCase() === "CANCELLED" && (
                            <button
                              type="button"
                              title="ดึงรายการไปเปิดบิลใหม่ที่หน้า POS (ไม่กระทบบิลเดิม)"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/owner/pos/pos?recover_order_id=${item.id}`, {
                                  state: { recoverOrderId: item.id },
                                });
                              }}
                              className="inline-flex items-center justify-center p-1.5 transition-colors cursor-pointer rounded-full hover:bg-gray-100"
                            >
                              <CopyPlus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

      {/* Batch Action Footer */}
      <div className="p-4 flex justify-between items-center bg-white border-t border-gray-100">
        <Text variant="xs" className="text-gray-500 mb-0">
          เลือกอยู่ {selectedIds.length} รายการ
        </Text>
        
        <div className="flex gap-2">
          {/* ปุ่มอนุมัติ (สีเขียวหรือแดงหลัก) */}
          <Button
            onClick={handleApproveSelected}
            disabled={selectedIds.length === 0}
            className="inline-flex items-center justify-center gap-2 text-sm px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 transition-all"
          >
            <span>อนุมัติรายการที่เลือก ({selectedIds.length})</span>
          </Button>

          {/* ปุ่มปฏิเสธคำขอ (สีแดง) */}
          <Button
            onClick={handleRejectSelected}
            disabled={selectedIds.length === 0}
            variant="solid-red"
            className="inline-flex items-center justify-center gap-2 text-sm px-4 py-2.5 rounded-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 transition-all"
          >
            <span>ปฏิเสธคำขอที่เลือก ({selectedIds.length})</span>
          </Button>
        </div>
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

      {/* Slide-over Drawer */}
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
                {/* Drawer Header */}
                <div className="p-5 border-b border-[#E7BDB8] flex items-start justify-between bg-white">
                  <div>
                    <Heading
                      level="h3"
                      weight="normal"
                      className="text-xl text-[#1C1B1B] mb-0.5"
                    >
                      รายละเอียดการขอยกเลิก
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

                {/* Drawer Body */}
                <div className="p-6 space-y-6">
                  {/* ข้อมูลลูกค้า */}
                  <div>
                    <Text variant="xs" className="font-normal text-[#E51C23] mb-2">
                      ข้อมูลลูกค้า
                    </Text>
                    <Card className="bg-[#F6F3F2] rounded-none border-gray-100 border-l-3 border-l-[#E51C23] shadow-none">
                      <CardContent className="p-4 space-y-1">
                        <Text variant="small" className="font-medium text-[#1C1B1B] mb-0">
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
                          <Text variant="xs" className="text-[#6B7280] mb-0 truncate">
                            ที่อยู่: {orderDetail.address}
                          </Text>
                        )}
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
                        <Card className="bg-[#F6F3F2] rounded-none border-gray-200 shadow-none">
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

                  {/* รายการสินค้า */}
                  <div>
                    <Text variant="xs" className="font-normal text-[#E51C23] mb-3">
                      รายการสินค้า ({orderDetail.items?.length || 0})
                    </Text>
                    <div className="divide-y divide-gray-100">
                      {orderDetail.items &&
                        orderDetail.items.map((prod) => (
                          <div key={prod.id} className="flex items-center justify-between py-3 first:pt-0">
                            <div>
                              <Text variant="small" className="font-medium text-[#1C1B1B] mb-0">
                                {prod.product_name}
                              </Text>
                              {prod.part_number && (
                                <Text variant="xs" className="font-normal text-[#1C1B1B] mb-0">
                                  รหัสสินค้า: {prod.part_number}
                                </Text>
                              )}
                              <Text variant="xs" className="font-normal text-[#6B7280] mb-0">
                                QTY: {prod.qty} {prod.unit} |{" "}
                                {prod.unit_price.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                              </Text>
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
                      <div className="flex justify-between text-white">
                        <Text variant="xs" className="text-[#9CA3AF] mb-0">ราคารวมสินค้า</Text>
                        <Text variant="xs" className="font-normal text-white mb-0">
                          {(orderDetail.subtotal || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                        </Text>
                      </div>

                      <div className="flex justify-between text-white">
                        <Text variant="xs" className="text-[#9CA3AF] mb-0">ส่วนลดท้ายบิล</Text>
                        <Text variant="xs" className="font-normal text-white mb-0">
                          {(orderDetail.discount_amount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                        </Text>
                      </div>

                      <div className="border-t border-[#9CA3AF] pt-2.5 flex justify-between">
                        <Text variant="small" className="font-normal text-white mb-0">ยอดชำระสุทธิ</Text>
                        <Text variant="small" className="font-normal text-white mb-0">
                          {(orderDetail.total_amount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                        </Text>
                      </div>

                      <div className="pt-2 flex justify-end items-center gap-2">
                        <Badge variant={getPaymentVariant(orderDetail.payment_method_name)}>
                          {orderDetail.payment_method_name || "เงินสด"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {/* ส่วนการอนุมัติ/ปฏิเสธ */}
                  {(() => {
                    const status = (orderDetail.status || "").trim().toUpperCase();

                    if (status === "PENDING_CANCEL") {
                      return (
                        <div className="space-y-4">
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
                                {getStatusText ? getStatusText(orderDetail.status) : orderDetail.status}
                              </Badge>
                            </div>

                            <div className="text-xs text-[#1C1B1B]">
                              <div>
                                <span className="font-normal text-[#1C1B1B]">ผู้ส่งคำขอ:</span>{" "}
                                <span className="text-[#1C1B1B]">{orderDetail.canceller || "-"}</span>
                              </div>
                              <div>
                                <span className="font-normal text-[#1C1B1B]">เหตุผลที่พนักงานระบุ:</span>{" "}
                                <span className="text-[#1C1B1B]">{orderDetail.cancel_reason || "-"}</span>
                              </div>
                              {orderDetail.cancel_requested_at && (
                                <Text variant="xs" className="text-[#1C1B1B] pt-0.5 mb-0">
                                  ส่งคำขอเมื่อ: {formatDate(orderDetail.cancel_requested_at)}
                                </Text>
                              )}
                            </div>
                          </Card>

                          <div className="space-y-3 pt-1">
                            <div className="space-y-1.5">
                              <Text variant="xs" className="font-normal text-[#E51C23] uppercase tracking-wider mb-1">
                                หมายเหตุการดำเนินการ (ถ้ามี):
                              </Text>
                              <textarea
                                rows={3}
                                value={cancelRemark}
                                onChange={(e) => setCancelRemark(e.target.value)}
                                placeholder="ระบุเหตุผลในการอนุมัติหรือปฏิเสธ..."
                                className="w-full p-2.5 text-xs font-light bg-[#F6F3F2] border border-[#E51C23] rounded-none focus:outline-none text-[#1C1B1B] placeholder-[#6B7280] resize-none"
                              />
                            </div>

                            <div className="flex gap-2 pt-1">
                              <Button
                                type="button"
                                variant="approved"
                                onClick={handleApproveDrawer}
                                disabled={isCancelling}
                                className="flex-1 text-xs h-10 font-normal rounded-none cursor-pointer"
                              >
                                {isCancelling ? "กำลังดำเนินการ..." : "อนุมัติยกเลิก (คืนสต็อก)"}
                              </Button>

                              <Button
                                type="button"
                                variant="solid-red"
                                onClick={handleRejectDrawer}
                                disabled={isCancelling}
                                className="flex-1 text-xs h-10 font-normal rounded-none cursor-pointer"
                              >
                                {isCancelling ? "กำลังดำเนินการ..." : "ปฏิเสธคำขอ"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (status === "CANCELLED" || status === "ยกเลิก") {
                      return (
                        <div className="space-y-3">
                          <Card className="p-4 bg-[#FCF7F7] border border-[#F5DFDF] rounded-none shadow-none space-y-2">
                            <div className="flex items-center justify-between">
                              <Text variant="small" className="font-normal text-[#E51C23] mb-0">
                                สถานะ: รายการนี้ได้รับการยกเลิกแล้ว
                              </Text>
                              <Badge
                                variant="neutral"
                                size="auto"
                                className="bg-[#E51C23] text-white border-none text-[10px] font-normal rounded-none py-0.5 px-2"
                              >
                                {getStatusText ? getStatusText(orderDetail.status) : orderDetail.status}
                              </Badge>
                            </div>
                            
                            <div className="text-xs text-[#1C1B1B]">
                              <div>
                                <span className="font-normal text-[#1C1B1B]">ผู้ส่งคำขอ:</span>{" "}
                                <span className="text-[#1C1B1B]">{orderDetail.canceller || "-"}</span>
                              </div>
                              <div>
                                <span className="font-normal text-[#1C1B1B]">เหตุผลการยกเลิก:</span>{" "}
                                <span className="text-[#1C1B1B]">{orderDetail.cancel_reason || "-"}</span>
                              </div>
                              <div>
                                <span className="font-normal text-[#1C1B1B]">หมายเหตุ:</span>{" "}
                                <span className="text-[#1C1B1B]">{orderDetail.cancel_remark || "-"}</span>
                              </div>
                              {(orderDetail.cancel_processed_at || orderDetail.cancelled_at || orderDetail.cancel_requested_at) && (
                                <Text variant="xs" className="text-[#1C1B1B] pt-0.5">
                                  อนุมัติเมื่อ: {formatDate(orderDetail.cancel_processed_at || orderDetail.cancelled_at || orderDetail.cancel_requested_at || "")}
                                </Text>
                              )}
                            </div>
                          </Card>

                          <Button
                            type="button"
                            variant="outline-cancel"
                            onClick={() => handlePrintReceipt(orderDetail.id, orderDetail.order_number)}
                            disabled={printingOrderId === orderDetail.id}
                            className="w-full text-xs h-10 font-normal rounded-none flex items-center justify-center gap-2 cursor-pointer shadow-sm border border-gray-300 hover:bg-gray-50"
                          >
                            <Printer className={cn("w-4 h-4 text-[#E51C23]", printingOrderId === orderDetail.id && "animate-pulse")} />
                            <span>พิมพ์ใบเสร็จที่ยกเลิก (เอกสารหลักฐาน)</span>
                          </Button>

                          <Button
                            type="button"
                            variant="solid-red"
                            onClick={() => {
                              navigate(`/owner/pos/pos?recover_order_id=${orderDetail.id}`, {
                                state: { recoverOrderId: orderDetail.id }
                              });
                            }}
                            className="w-full text-xs h-10 font-normal rounded-none flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                          >
                            <CopyPlus className="w-4 h-4" />
                            <span>ดึงรายการไปเปิดบิลใหม่ที่หน้า POS</span>
                          </Button>
                          <p className="text-[11px] text-[#6B7280] text-center mt-1.5 mb-0">
                            *เป็นการคัดลอกรายการสินค้าและลูกค้าไปเปิดบิลขายใหม่ โดยไม่มีผลต่อบิลเดิมที่ยกเลิก
                          </p>
                        </div>
                      );
                    }

                    if (status === "COMPLETED" || status === "สำเร็จ" || Boolean(orderDetail.cancel_remark) || Boolean(orderDetail.cancel_processed_at)) {
                      return (
                      <Card className="p-4 bg-[#FCF7F7] border border-[#F5DFDF] rounded-none shadow-none space-y-2">
                        <div className="flex items-center justify-between">
                          <Text variant="small" className="font-normal text-[#E51C23] mb-0">
                            สถานะคำขอ: ไม่อนุมัติการยกเลิก (ปฏิเสธคำขอ)
                          </Text>
                          <Badge
                            variant="neutral"
                            size="auto"
                            className="bg-[#E51C23] text-white border-none text-[10px] font-normal rounded-none py-0.5 px-2"
                          >
                            ไม่อนุมัติ
                          </Badge>
                        </div>

                        <div className="text-xs text-[#1C1B1B]">
                          {orderDetail.canceller && (
                            <div>
                              <span className="font-normal text-[#1C1B1B]">ผู้ส่งคำขอ:</span>{" "}
                              <span className="text-[#1C1B1B]">{orderDetail.canceller}</span>
                            </div>
                          )}
                          {orderDetail.cancel_reason && (
                            <div>
                              <span className="font-normal text-[#1C1B1B]">เหตุผลที่พนักงานระบุ:</span>{" "}
                              <span className="text-[#1C1B1B]">{orderDetail.cancel_reason}</span>
                            </div>
                          )}
                          <div>
                            <span className="font-normal text-[#1C1B1B]">เหตุผลที่ปฏิเสธ:</span>{" "}
                            <span className="text-[#1C1B1B]">{orderDetail.cancel_remark || "-"}</span>
                          </div>
                          {(orderDetail.cancel_processed_at || orderDetail.cancelled_at) && (
                            <Text variant="xs" className="text-[#1C1B1B] pt-0.5 mb-0">
                              ปฏิเสธคำขอเมื่อ: {formatDate(orderDetail.cancel_processed_at || orderDetail.cancelled_at || "")}
                            </Text>
                          )}
                        </div>
                      </Card>
                      );
                    }

                    return null;
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
    </main>
  );
};

export default OwnerSalesCancellationHistory;
