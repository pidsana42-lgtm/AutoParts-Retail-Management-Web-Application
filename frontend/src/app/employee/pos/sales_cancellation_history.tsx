import React from "react";
import { useNavigate } from "react-router-dom";
import Text from "../../../components/elements/text";
import Heading from "../../../components/elements/heading";
import { Card, CardContent } from "../../../components/elements/card";
import Input from "../../../components/elements/input";
import Button from "../../../components/elements/button";
import Select from "../../../components/elements/select";
import Badge from "../../../components/elements/badge";
import ConfirmDialog from "../../../components/elements/confirm_dialog";
import { useToast } from "../../../components/elements/toast";
import {
  Eye,
  RotateCcw,
  CopyPlus,
  Printer,
  X,
  CheckCircle2,
  XCircle,
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
import { TablePagination } from "../../../components/pos";
import { formatDate, getDisplayCustomerName, getPaymentVariant } from "../../../utils/poshelpers";
import { SalesCancellationStatusBadge } from "../../../components/elements/status_badge";
import { useSalesCancellationHistory } from "./hooks/useSalesCancellationHistory";
import { useSalesHistory } from "./hooks/useSalesHistory";
import type { SalesHistoryItemResponse } from "../../../interface/pos/sales_history_interface";
import { useUserRole } from "../../../hooks/useUserRole";
import { posApiService } from "../../../service/http/pos/pos_service";
import { autoPrintPdfBlob } from "../../../utils/payment_history_print";
import OrderCustomerSearchInput from "./components/order_customer_search_input";

const SalesCancellationHistory: React.FC = () => {
    const { toast } = useToast();
    const navigate = useNavigate();
    const { isOwnerOrManager } = useUserRole();

    // 1. ดึงข้อมูลตารางคำขอยกเลิกจาก useSalesCancellationHistory
    const {
        dataList,
        selectedIds,
        isSelectAll,
        isLoading,
        isRestoring,
        isRestoreModalOpen,
        setIsRestoreModalOpen,
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
        handleApproveSelected,
        handleRejectSelected,
        handleRestoreSelected,
        handleConfirmRestore,
        refetch,
    } = useSalesCancellationHistory();

    const kpiValue = (value: React.ReactNode) =>
        isStatsLoading ? <span className="text-gray-400 animate-pulse">...</span> : value;

    // 2. ดึงข้อมูลคำสั่งจัดการบิลจาก useSalesHistory (ใช้สำหรับ Drawer ด้านข้าง)
    const {
        selectedOrderId,
        setSelectedOrderId,
        orderDetail,
        isDetailLoading,
        cancelReason,
        setCancelReason,
        cancelRemark,
        setCancelRemark,
        isCancelling,
        handleRequestCancel,
        handleDirectCancelByOwner,
        handleRejectCancelByOwner,
        handleRevertCancel,
        getStatusText,
    } = useSalesHistory();

    const [printingOrderId, setPrintingOrderId] = React.useState<number | string | null>(null);

    const handlePrintReceipt = async (orderId: number | string, orderNumber?: string) => {
        setPrintingOrderId(orderId);
        try {
            const blob = await posApiService.printOrderReceipt(orderId);
            const rawNum = orderNumber || `INV-${orderId}`;
            const fileName = String(rawNum).endsWith(".pdf") ? `${rawNum}` : `${rawNum}.pdf`;
            autoPrintPdfBlob(blob, fileName);
        } catch (err) {
            console.error("Failed to print receipt:", err);
            toast({ variant: "error", message: "ไม่สามารถสร้างไฟล์ PDF ใบเสร็จได้ กรุณาลองใหม่อีกครั้ง" });
        } finally {
            setPrintingOrderId(null);
        }
    };

    const handleApproveDrawer = async () => {
        await handleDirectCancelByOwner();
        refetch();
    };

    const handleRejectDrawer = async () => {
        await handleRejectCancelByOwner();
        refetch();
    };

    const handleRevertCancelDrawer = async () => {
        await handleRevertCancel();
        refetch();
    };

    const fetchCancellationOrderSuggestions = React.useCallback(async (q: string) => {
        try {
            const params = { search: q, limit: 6, page: 1 };
            const res = isOwnerOrManager
                ? await posApiService.getCancellationRequests(params)
                : await posApiService.getMyCancellationRequests(params);
            return (res.items || []).map((item) => ({
                id: item.id,
                order_number: item.order_number,
                customer_name: getDisplayCustomerName(item),
                total_amount: item.total_amount,
                status: item.status,
                order_date: item.order_date || item.created_at,
            }));
        } catch {
            return [];
        }
    }, [isOwnerOrManager]);

  return (
    <div className="relative flex min-h-screen bg-[#F8F9FA] text-slate-800 font-sans overflow-x-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        <main className="p-6 space-y-6 flex-1">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <Heading level='h1' weight='semibold' className='m-0 text-black'>
                {isOwnerOrManager ? "รายการยกเลิกจากพนักงาน" : "ประวัติการยกเลิกขายสินค้า"}
              </Heading>
              <Heading level='h6' className='m-0 mt-1'>
                ยกเลิกบิลขาย
              </Heading>
            </div>
          </div>

          {/* Filter Bar */}
          <Card className="bg-[#F6F3F2] rounded-none shadow-none border-y border-r border-gray-200 border-l-4 border-l-[#E51C23]">
            <CardContent className="p-6 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                {/* 1. ค้นหาเลขบิล/ชื่อลูกค้า */}
                <div className={cn(isOwnerOrManager ? "md:col-span-3" : "md:col-span-5", "flex flex-col gap-1.5")}>
                  <label className="text-xs font-normal text-[#5F5E5E]">
                    ค้นหาเลขคำสั่งซื้อ/ชื่อลูกค้า 
                  </label>
                  <OrderCustomerSearchInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    onSelectCustomer={(customerName) => {
                      setSearchQuery(customerName);
                      handleSearch();
                    }}
                    onSelectOrder={(orderNumber) => {
                      setSearchQuery(orderNumber);
                      handleSearch();
                    }}
                    onSubmit={handleSearch}
                    fetchOrders={fetchCancellationOrderSuggestions}
                    placeholder="สแกนบาร์โค้ด / INV-2024-XXX หรือ ชื่อลูกค้า"
                    inputClassName="h-11"
                    autoFocus
                  />
                </div>

                {/* พนักงานผู้ทำรายการ (เฉพาะ Owner/Manager) */}
                {isOwnerOrManager && (
                  <div className="md:col-span-2 flex flex-col gap-1.5">
                    <label className="text-xs font-normal text-[#5F5E5E]">พนักงานผู้ทำรายการ</label> 
                    <Select
                      value={employeeId}
                      onChange={(e: any) => setEmployeeId(e.target.value)}
                      placeholder="พนักงานทุกคน"
                      className="bg-white border-none rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 shadow-none"
                      options={[
                        { label: "พนักงานทุกคน", value: "" },
                        ...employeeList,
                      ]}
                    />
                  </div>
                )}

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

                {/* 4. สถานะการยกเลิก (col-span-2) */}
                <div className="md:col-span-2 flex flex-col gap-1.5">
                    <label className="text-xs font-normal text-[#5F5E5E]">สถานะคำขอ</label>
                    <Select
                      value={status}
                      onChange={(e: any) => setStatus(e.target.value)}
                      placeholder="สถานะทั้งหมด"
                      className="bg-white border-none rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 shadow-none"
                      options={[
                        { label: "ทั้งหมด", value: "" },
                        { label: isOwnerOrManager ? "รอดำเนินการ" : "รออนุมัติ", value: "PENDING_CANCEL" },
                        { label: isOwnerOrManager ? "อนุมัติแล้ว" : "ยกเลิกแล้ว", value: "CANCELLED" },
                        { label: isOwnerOrManager ? "ไม่อนุมัติ" : "ถูกปฏิเสธ", value: "REJECTED" },
                      ]}
                    />
                </div>

                {/* 5. ปุ่มค้นหา (col-span-1) */}
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

          {/* Small Stat Cards เหนือตาราง */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
            {isOwnerOrManager ? (
              <>
                {/* 1. รออนุมัติยกเลิก */}
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

                {/* 2. อนุมัติแล้ว */}
                <Card className="border-l-[5px]! border-l-emerald-500! flex flex-col justify-between p-4 md:p-5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Heading level="h6" className="uppercase tracking-wider">
                        อนุมัติแล้ว
                      </Heading>
                    </div>
                    <Heading level="h3">
                      ฿{kpiValue(stats.approvedAmount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
                    </Heading>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-[#6B7280] font-light">
                    <span>ยกเลิกสำเร็จแล้ว</span>
                    <span className="text-emerald-500 font-normal">{stats.approvedCount} รายการ</span>
                  </div>
                </Card>

                {/* 3. ปฏิเสธคำขอ */}
                <Card className="border-l-[5px]! border-l-[#E51C23]! flex flex-col justify-between p-4 md:p-5">
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
                    <span>คำขอที่ไม่อนุมัติ</span>
                    <span className="text-[#E51C23] font-normal">{stats.rejectedCount} รายการ</span>
                  </div>
                </Card>

                {/* 4. คำขอทั้งหมด */}
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
                    <span>รวมทุกสถานะ</span>
                    <span className="text-sky-700 font-normal">{stats.totalCount} รายการ</span>
                  </div>
                </Card>
              </>
            ) : (
              <>
                {/* 1. คำขอของฉันทั้งหมด */}
                <Card className="border-l-[5px]! border-l-sky-700! flex flex-col justify-between p-4 md:p-5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Heading level="h6" className="uppercase tracking-wider">
                        คำขอของฉันทั้งหมด
                      </Heading>
                    </div>
                    <Heading level="h3">
                      {kpiValue(stats.totalCount.toLocaleString("th-TH"))} <span className="text-sm font-normal text-[#1C1B1B]">รายการ</span>
                    </Heading>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-[#6B7280] font-light">
                    <span>มูลค่ารวมคำขอ</span>
                    <span className="text-sky-700 font-normal">฿{stats.totalAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                  </div>
                </Card>

                {/* 2. รอเจ้าของร้านอนุมัติ */}
                <Card className="border-l-[5px]! border-l-amber-300 flex flex-col justify-between p-4 md:p-5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Heading level="h6" className="uppercase tracking-wider">
                        รอเจ้าของร้านอนุมัติ
                      </Heading>
                    </div>
                    <Heading level="h3">
                      {kpiValue(stats.pendingCount.toLocaleString("th-TH"))} <span className="text-sm font-normal text-[#1C1B1B]">รายการ</span>
                    </Heading>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-[#6B7280] font-light">
                    <span>ยอดเงินรอดำเนินการ</span>
                    <span className="text-amber-400 font-normal">฿{stats.pendingAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                  </div>
                </Card>

                {/* 3. อนุมัติแล้ว */}
                <Card className="border-l-[5px]! border-l-emerald-500 flex flex-col justify-between p-4 md:p-5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Heading level="h6" className="uppercase tracking-wider">
                        อนุมัติแล้ว
                      </Heading>
                    </div>
                    <Heading level="h3">
                      {kpiValue(stats.approvedCount.toLocaleString("th-TH"))} <span className="text-sm font-normal text-[#1C1B1B]">รายการ</span>
                    </Heading>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-[#6B7280] font-light">
                    <span>ยกเลิกสำเร็จแล้ว</span>
                    <span className="text-emerald-500 font-normal">฿{stats.approvedAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                  </div>
                </Card>

                {/* 4. ไม่อนุมัติ */}
                <Card className="border-l-[5px]! border-l-[#E51C23]! flex flex-col justify-between p-4 md:p-5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Heading level="h6" className="uppercase tracking-wider">
                        ไม่อนุมัติ (ปฏิเสธ)
                      </Heading>
                    </div>
                    <Heading level="h3">
                      {kpiValue(stats.rejectedCount.toLocaleString("th-TH"))} <span className="text-sm font-normal text-[#1C1B1B]">รายการ</span>
                    </Heading>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-[#6B7280] font-light">
                    <span>ไม่ผ่านการอนุมัติ</span>
                    <span className="text-[#E51C23] font-normal">฿{stats.rejectedAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                  </div>
                </Card>
              </>
            )}
          </div>

          {/* Table */}
          <Card className="bg-white rounded-none shadow-sm overflow-hidden border border-gray-200">
            <Table className="w-full! min-w-0! table-fixed text-left border-collapse">
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
                  <TableHead className="py-3 px-2.5 w-[14%] ">หมายเลขคำสั่งซื้อ</TableHead>
                  <TableHead className="py-3 px-2.5 w-[13%]">วันที่ทำรายการยกเลิก</TableHead>
                  <TableHead className="py-3 px-2.5 w-[28%] ">ชื่อลูกค้า/อู่ซ่อมรถ/บริษัท</TableHead>
                  <TableHead className="py-3 px-2.5 text-right w-[10%]">จำนวนเงิน</TableHead>
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
                      ไม่พบข้อมูลประวัติการยกเลิก
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
                        className={cn(
                          "hover:bg-[#F6F3F2] cursor-pointer transition-colors text-xs",
                          isChecked && "bg-red-50/40",
                          isSelected && "bg-[#F0EDEC] border-l-4 border-l-[#E51C23]"
                        )}
                        onClick={() => setSelectedOrderId(item.id)}
                      >
                        {/* Checkbox เลือก */}
                        <TableCell className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleSelectRow(item.id)}
                            disabled={!isPendingCancel}
                            className="w-4 h-4 border border-gray-300 rounded-none bg-white checked:bg-[#E51C23] checked:border-[#E51C23] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 appearance-none flex items-center justify-center after:content-['✓'] after:text-white after:text-[10px] after:font-bold after:hidden checked:after:block"
                          />
                        </TableCell>

                        {/* เลขที่คำสั่งซื้อ */} 
                        <TableCell className="py-3.5 px-4">
                          <Text
                            variant="small"
                            className="font-normal text-[#1C1B1B] mb-0"
                          >
                            {item.order_number}
                          </Text>
                        </TableCell>

                        {/* วันที่ขอยกเลิก */}
                        <TableCell className="py-3.5 px-4">
                          <Text
                            variant="xs"
                            className="font-light text-[#5B5B5B] mb-0"
                          >
                            {formatDate(item.cancel_requested_at || item.created_at)}
                          </Text>
                        </TableCell>

                        {/* ชื่อลูกค้า */}
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

                        {/* ยอดเงินรวม */}
                        <TableCell className="py-3.5 px-4 text-right">
                          <Text
                            variant="small"
                            className="font-normal text-[#1C1B1B] mb-0"
                          >
                          ฿{Number(item.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Text>
                        </TableCell>

                        {/* ผู้ขอยกเลิก */}
                        <TableCell className="py-3.5 px-4 truncate">
                          <Text
                            variant="xs"
                            className="font-normal text-[#1C1B1B] mb-0"
                          >
                            {item.canceller || "-"}
                          </Text>
                        </TableCell>

                        {/* สถานะ */}
                        <TableCell className="py-3 px-2.5 text-center">
                          <SalesCancellationStatusBadge status={item.status} cancelRemark={item.cancel_remark} />
                        </TableCell>

                        {/* ปุ่มดูรายละเอียด & ปุ่มเปิดบิลใหม่ */}
                        <TableCell className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedOrderId(item.id)}
                              className="inline-flex items-center justify-center p-1.5 text-gray-500 hover:text-black hover:bg-gray-100 rounded-none cursor-pointer transition-colors"
                              title="ดูรายละเอียดบิล"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {(item.status || "").toUpperCase() === "CANCELLED" && (
                              <button
                                type="button"
                                title="ดึงรายการไปเปิดบิลใหม่ที่หน้า POS (ไม่กระทบบิลเดิม)"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(
                                    `${isOwnerOrManager ? "/owner/pos/pos" : "/employee/pos/pos"}?recover_order_id=${item.id}`,
                                    { state: { recoverOrderId: item.id } }
                                  );
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

            {/* Action Footer */}
            <div className="p-4 flex justify-between items-center bg-white border-t border-gray-100">
              <Text variant="xs" className="text-gray-500 mb-0">
                เลือกอยู่ {selectedIds.length} รายการ
              </Text>
              {isOwnerOrManager ? (
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleApproveSelected}
                    disabled={selectedIds.length === 0}
                    variant="approved"
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 text-sm px-4 py-2.5 rounded-none cursor-pointer disabled:cursor-not-allowed transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>อนุมัติคำขอที่เลือก ({selectedIds.length})</span>
                  </Button>
                  <Button
                    onClick={handleRejectSelected}
                    disabled={selectedIds.length === 0}
                    variant="solid-red"
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 text-sm px-4 py-2.5 rounded-none cursor-pointer disabled:cursor-not-allowed transition-all"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>ปฏิเสธคำขอที่เลือก ({selectedIds.length})</span>
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleRestoreSelected}
                  disabled={selectedIds.length === 0}
                  variant="solid-red"
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 text-sm px-4 py-2.5 rounded-none cursor-pointer disabled:cursor-not-allowed transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>กู้คืนรายการขายที่เลือก ({selectedIds.length})</span>
                </Button>
              )}
            </div>

            {/* Pagination Controls */}
            {!isLoading && !error && (
              <TablePagination
                page={page}
                totalPages={totalPages}
                totalRows={totalRows}
                limit={limit}
                onPageChange={setPage}
                onLimitChange={setLimit}
                unitLabel="รายการ"
              />
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

                  {/* ปุ่มพิมพ์ใบเสร็จที่ยกเลิก (Void Receipt) */}
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() =>
                      handlePrintReceipt(
                        orderDetail.id || orderDetail.order_number,
                        orderDetail.order_number
                      )
                    }
                    disabled={printingOrderId !== null}
                    className="w-full text-xs h-10 font-normal flex items-center justify-center gap-1.5 shadow-sm bg-[#1C1B1B] hover:bg-zinc-800 text-white cursor-pointer rounded-none"
                  >
                    <Printer className="w-4 h-4" />
                    <span>
                      {printingOrderId !== null
                        ? "กำลังเตรียมพิมพ์..."
                        : "พิมพ์ใบเสร็จที่ยกเลิก (Void Receipt)"}
                    </span>
                  </Button>

                  {/* Dynamic Cancel Form / Status Section */}
                  {(() => {
                    if (!orderDetail) return null;
                    const status = (orderDetail.status || "").trim().toUpperCase();
                    const hasBeenRejected = Boolean(orderDetail.cancel_remark);

                    if (status === "PENDING_CANCEL") {
                      if (isOwnerOrManager) {
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

                              <div className="text-xs text-[#1C1B1B] bg-[#FFFBEB] p-2.5 border-l-2 border-[#EAB308]">
                                <span className="font-normal text-[#1C1B1B]">
                                  เหตุผลที่พนักงานขอ:
                                </span>{" "}
                                {orderDetail.cancel_reason || "-"}
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

                      return (
                        <div className="space-y-3">
                          {/* 1. ส่วน Card แสดงรายละเอียดสถานะ */}
                          <Card className="p-4 bg-[#FEFCE8] border border-[#FEF08A] rounded-none shadow-none space-y-2">
                            <div className="flex items-center justify-between">
                              <Text variant="small" className="font-normal text-[#854D0E] mb-0">
                                สถานะคำขอ: อยู่ระหว่างรออนุมัติ
                              </Text>
                              <Badge
                                variant="warning"
                                size="auto"
                                className="bg-[#FEF08A] text-[#854D0E] border-none text-[10px] font-normal rounded-none py-0.5 px-2"
                              >
                                {getStatusText ? getStatusText(orderDetail.status) : orderDetail.status}
                              </Badge>
                            </div>

                            <div className="text-xs text-[#1C1B1B] bg-[#FFFBEB] space-y-1.5">
                              {orderDetail.canceller && (
                                <div>
                                  <span className="font-normal text-[#1C1B1B]">ผู้ส่งคำขอ:</span>{" "}
                                  <span className="text-[#1C1B1B]">{orderDetail.canceller}</span>
                                </div>
                              )}
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
                              onClick={handleRevertCancelDrawer}
                              disabled={isCancelling}
                              className="flex-1 text-xs h-10 font-normal rounded-none cursor-pointer"
                            >
                              {isCancelling ? "กำลังดำเนินการ..." : "ดึงคำขอยกเลิกกลับ (กู้คืนคำขอ)"}
                            </Button>

                            <Button
                              type="button"
                              variant="outline-cancel"
                              onClick={() => setSelectedOrderId(null)}
                              className="text-xs px-4 h-10 border border-gray-200 text-[#5F5E5E] hover:bg-[#F6F3F2] font-normal rounded-none cursor-pointer"
                            >
                              ปิด
                            </Button>
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
                                สถานะคำขอ: รายการนี้ถูกยกเลิกแล้ว
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
                              {(orderDetail.cancel_processed_at || orderDetail.cancel_requested_at) && (
                                <Text variant="xs" className="text-[#1C1B1B] pt-0.5 mb-0">
                                  อนุมัติเมื่อ: {formatDate(orderDetail.cancel_processed_at || orderDetail.cancel_requested_at || "")}
                                </Text>
                              )}
                              {orderDetail.cancel_remark && (
                                <div>
                                  <span className="font-normal text-[#1C1B1B]">หมายเหตุ:</span>{" "}
                                  <span className="text-[#1C1B1B]">{orderDetail.cancel_remark}</span>
                                </div>
                              )}
                            </div>
                          </Card>

                          <Button
                            type="button"
                            variant="solid-red"
                            onClick={() => {
                              navigate(
                                `${isOwnerOrManager ? "/owner/pos/pos" : "/employee/pos/pos"}?recover_order_id=${orderDetail.id}`,
                                { state: { recoverOrderId: orderDetail.id } }
                              );
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

                    if (hasBeenRejected && isOwnerOrManager) {
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
                                {getStatusText
                                  ? getStatusText(orderDetail.status, orderDetail.cancel_remark)
                                  : orderDetail.status}
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
                            <Button
                              type="button"
                              variant="solid-red"
                              onClick={
                                isOwnerOrManager
                                  ? handleDirectCancelByOwner
                                  : handleRequestCancel
                              }
                              disabled={isCancelling}
                              className="flex-1 text-sm h-11 font-normal cursor-pointer"
                            >
                              {isCancelling
                                ? "กำลังดำเนินการ..."
                                : isOwnerOrManager
                                ? "อนุมัติยกเลิกรายการ (คืนสต็อก)"
                                : "ยืนยันการขออนุมัติยกเลิก"}
                            </Button>

                            <Button
                              type="button"
                              variant="outline-cancel"
                              onClick={() => setSelectedOrderId(null)}
                              className="text-sm px-6 h-11 border border-gray-200 text-[#5F5E5E] hover:bg-[#F6F3F2] font-normal cursor-pointer"
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

      {/* ConfirmDialog ยืนยันการกู้คืนรายการขาย สำหรับพนักงาน */}
      <ConfirmDialog
        isOpen={isRestoreModalOpen}
        onClose={() => setIsRestoreModalOpen(false)}
        onConfirm={handleConfirmRestore}
        title="ยืนยันการกู้คืนรายการขาย"
        description={`คุณต้องการกู้คืนรายการขาย ${selectedIds.length} รายการใช่หรือไม่?`}
        confirmText="ยืนยันกู้คืน"
        cancelText="ยกเลิก"
        variant="danger"
        icon={RotateCcw}
        isSubmitting={isRestoring}
      />
    </div>
  );
};

export default SalesCancellationHistory;