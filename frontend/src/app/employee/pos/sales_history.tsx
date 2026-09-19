import React, { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Eye,
  Printer,
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
import OrderDetailPanel from "./components/order_detail_panel";

// นำเข้า Hook & Helpers
import { TablePagination } from "../../../components/pos";
import { useSalesHistory } from "./hooks/useSalesHistory";
import { getDisplayCustomerName, getPaymentVariant } from "../../../utils/poshelpers";
import { SalesStatusBadge } from "../../../components/elements/status_badge";
import { formatDate } from "../../../utils/date";
import { useUserRole } from "../../../hooks/useUserRole";
import { usePrintReceipt } from "./hooks/usePrintReceipt";
import type { SalesHistoryItemResponse } from "../../../interface/pos/sales_history_interface";
import OrderCustomerSearchInput from "./components/order_customer_search_input";
import { posApiService } from "../../../service/http/pos/pos_service";

export default function TransactionHistoryPage() {
  const { printingOrderId, handlePrintReceipt } = usePrintReceipt();

  // --- ดึงข้อมูลและ Handlers จริงจาก Custom Hook ---
  const { isOwnerOrManager } = useUserRole();

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
    paymentStatus,
    employeeId,
    employeeList,
    startDate,
    endDate,
    page,
    limit,
    setSearch,
    setCustomerType,
    setPaymentMethod,
    setPaymentStatus,
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

  // เข้าหน้านี้ด้วยลิงก์ ?order=<id> (เช่นกดจากฟีด "การเคลื่อนไหวของคลังสินค้า") ให้เปิดแผงรายละเอียด
  // ออเดอร์นั้นให้ทันที — hook ดึงรายละเอียดจาก id ตรงๆ อยู่แล้ว ไม่ต้องรอให้ออเดอร์อยู่ในหน้ารายการที่กรองไว้
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const orderParam = Number(searchParams.get("order"));
    if (!orderParam) return;
    setSelectedOrderId(orderParam);
    // ล้าง query ทิ้งหลังเปิดแล้ว เพื่อให้ปิดแผงแล้วไม่ถูกเปิดซ้ำตอน re-render
    const next = new URLSearchParams(searchParams);
    next.delete("order");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, setSelectedOrderId]);

  const kpiValue = (value: React.ReactNode) =>
    isStatsLoading ? <span className="text-gray-400 animate-pulse">...</span> : value;

  const fetchOrderSuggestions = React.useCallback(async (q: string) => {
    try {
      const res = await posApiService.getSalesHistory({ search: q, limit: 6, page: 1 });
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
  }, []);

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
          <Card className="bg-[#F6F3F2] rounded-none shadow-none border-y border-r border-gray-200 border-l-4 border-l-[#E51C23]">
            <CardContent className="p-5 md:p-6 space-y-4">
              {/* ค้นหาหลัก + ตัวกรองบุคคล */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                {/* ช่องที่ 1: ค้นหาคำ */}
                <div className={cn("flex flex-col gap-1.5", isOwnerOrManager ? "md:col-span-8" : "md:col-span-12")}>
                  <Text variant="xs" className="text-[#5F5E5E]">
                    ค้นหาเลขคำสั่งซื้อ / ชื่อลูกค้า
                  </Text>
                  <OrderCustomerSearchInput
                    value={search}
                    onChange={setSearch}
                    onSelectCustomer={(customerName) => {
                      setSearch(customerName);
                      handleApplyFilter();
                    }}
                    onSelectOrder={(orderNumber) => {
                      setSearch(orderNumber);
                      handleApplyFilter();
                    }}
                    onSubmit={handleApplyFilter}
                    fetchOrders={fetchOrderSuggestions}
                    placeholder="ค้นหา INV-202X-XXX หรือ ชื่อลูกค้า..."
                    inputClassName="h-10"
                    autoFocus
                  />
                </div>

                {/* ช่องที่ 2: พนักงานขาย (เฉพาะเจ้าของร้าน 4/12) */}
                {isOwnerOrManager && (
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
                <div className="md:col-span-3 lg:col-span-2 flex flex-col gap-1.5">
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
                <div className="md:col-span-3 lg:col-span-2 flex flex-col gap-1.5">
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

                {/* สถานะการชำระ */}
                <div className="md:col-span-3 lg:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-[#5F5E5E]">
                    สถานะการชำระ
                  </label>
                  <Select
                    value={paymentStatus}
                    onChange={(e: any) => {
                      setPage(1);
                      setPaymentStatus(e.target.value);
                    }}
                    placeholder="สถานะทั้งหมด"
                    className="bg-white border-none rounded-none h-10 text-sm font-normal text-[#1C1B1B] px-3 shadow-none focus-visible:ring-0 cursor-pointer"
                    options={[
                      { label: "ทั้งหมด", value: "" },
                      { label: "ชำระแล้ว", value: "PAID" },
                      { label: "ค้างชำระ", value: "UNPAID" },
                    ]}
                  />
                </div>

                {/* ปุ่มใช้ตัวกรอง */}
                <div className="md:col-span-3 lg:col-span-2">
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
            <Card className="border-l-[5px]! border-l-[#E51C23]! flex flex-col justify-between p-4 md:p-5">
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
            <Card className="border-l-[5px]! border-l-slate-300! flex flex-col justify-between p-4 md:p-5">
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
            <Card className="border-l-[5px]! border-l-emerald-500! flex flex-col justify-between p-4 md:p-5">
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
            <Table className="w-full! min-w-0! table-fixed text-left border-collapse">
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
                  items.map((item: SalesHistoryItemResponse) => {
                    const isSelected = selectedOrderId === item.id;
                    return (
                      <TableRow
                        key={item.id}
                        onClick={() => setSelectedOrderId(item.id)}
                        className={cn(
                          "cursor-pointer transition-colors",
                          isSelected
                            ? "bg-red-50/70 border-l-2 border-l-[#E51C23]"
                            : "hover:bg-slate-50"
                        )}
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
                        <TableCell
                          className="py-3.5 px-4 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              className="inline-flex items-center justify-center p-1.5 transition-colors cursor-pointer rounded-full hover:bg-gray-100"
                              title="ดูรายละเอียด"
                              onClick={() => setSelectedOrderId(item.id)}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              disabled={printingOrderId === item.id}
                              className="inline-flex items-center justify-center p-1.5 transition-colors cursor-pointer rounded-full hover:bg-gray-100"
                              title="พิมพ์ใบเสร็จ/ใบส่งของ"
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
                    );
                  })
                )}
              </TableBody>
            </Table>

            {/* Pagination Controls */}
            {!isLoading && !error && (
              <TablePagination
                page={page}
                totalPages={totalPages}
                totalRows={totalRows}
                limit={limit}
                onPageChange={setPage}
                onLimitChange={setLimit}
                unitLabel="ใบสั่งซื้อ"
              />
            )}
          </Card>
        </main>
      </div>

      {/* ==================== SLIDE-OVER DRAWER (REAL DATA) ==================== */}
      {selectedOrderId && (
        <OrderDetailPanel
          selectedOrderId={selectedOrderId}
          orderDetail={orderDetail}
          isDetailLoading={isDetailLoading}
          cancelReason={cancelReason}
          setCancelReason={setCancelReason}
          cancelRemark={cancelRemark}
          setCancelRemark={setCancelRemark}
          isCancelling={isCancelling}
          handleRequestCancel={handleRequestCancel}
          handleDirectCancelByOwner={handleDirectCancelByOwner}
          handleRejectCancelByOwner={handleRejectCancelByOwner}
          handleRevertCancel={handleRevertCancel}
          getStatusText={getStatusText}
          handlePrintReceipt={handlePrintReceipt}
          printingOrderId={printingOrderId}
          isOwnerOrManager={isOwnerOrManager}
          onClose={() => setSelectedOrderId(null)}
          variant="drawer"
        />
      )}
    </div>
  );
}
