import React from "react";
import Text from "../../../components/elements/text";
import Heading from "../../../components/elements/heading";
import { Card, CardContent } from "../../../components/elements/card";
import Input from "../../../components/elements/input";
import Button from "../../../components/elements/button";
import Select from "../../../components/elements/select";
import {
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RotateCcw,
  ScanBarcode,
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
import { useSalesCancellationHistory } from "./hooks/useSalesCancellationHistory"; 

const SalesCancellationHistory: React.FC = () => {
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
    paymentMethod,
    setSearchQuery,
    setStartDate,
    setEndDate,
    setCustomerType,
    setPaymentMethod,
    handleSelectAll,
    handleSelectRow,
    handleSearch,
    handleRestoreSelected,
  } = useSalesCancellationHistory();

  // Helper สำหรับปุ่มเลขหน้า Pagination
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

  return (
    <div className="relative flex min-h-screen bg-[#F8F9FA] text-slate-800 font-sans overflow-x-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        <main className="p-6 space-y-6 flex-1">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <Text variant="xs" className="text-[#E51C23] uppercase tracking-wider mb-0">
                บันทึกบิลขาย เคลม/คืน สินค้า
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

                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-[#5F5E5E]">วันที่เริ่มต้น</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-white border-none rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 shadow-none cursor-pointer"
                  />
                </div>

                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-[#5F5E5E]">วันที่สิ้นสุด</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-white border-none rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 shadow-none cursor-pointer"
                  />
                </div>

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

                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-[#5F5E5E]">การชำระเงิน</label>
                  <Select
                    value={paymentMethod}
                    onChange={(e: any) => setPaymentMethod(e.target.value)}
                    placeholder="วิธีการทั้งหมด"
                    className="bg-white border-none rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 shadow-none"
                    options={[
                      { label: "ทั้งหมด", value: "" },
                      { label: "เงินสด", value: "CASH" },
                      { label: "เงินโอน", value: "QR" },
                      { label: "เงินเชื่อ", value: "CREDIT" },
                    ]}
                  />
                </div>

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
                      className="w-4 h-4 border border-gray-300 rounded-none bg-white checked:bg-[#E51C23] checked:border-[#E51C23] cursor-pointer appearance-none flex items-center justify-center after:content-['✓'] after:text-white after:text-[10px] after:font-bold after:hidden checked:after:block"
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
                    return (
                      <TableRow
                        key={item.id}
                        className={isChecked ? "bg-red-50/40" : "hover:bg-slate-50 transition-colors"}
                      >
                        <TableCell className="py-3.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleSelectRow(item.id)}
                            className="w-4 h-4 border border-gray-300 rounded-none bg-white checked:bg-[#E51C23] checked:border-[#E51C23] cursor-pointer appearance-none flex items-center justify-center after:content-['✓'] after:text-white after:text-[10px] after:font-bold after:hidden checked:after:block"
                          />
                        </TableCell>
                        <TableCell className="py-3.5 px-4">
                          <Text variant="small" className="font-normal text-[#1C1B1B] mb-0">
                            {item.order_number}
                          </Text>
                        </TableCell>
                        <TableCell className="py-3.5 px-3">
                          <Text variant="xs" className="font-light text-[#5B5B5B] mb-0">
                            {item.order_date ? new Date(item.order_date).toLocaleString("th-TH") : "-"}
                          </Text>
                        </TableCell>
                        <TableCell className="py-3.5 px-3 truncate">
                          <Text variant="small" className="font-normal text-[#1C1B1B] mb-0 truncate">
                            {item.customer_name || item.customer_name_temp || "ลูกค้าทั่วไป"}
                          </Text>
                          <Text variant="xs" className="font-light text-[#A8A29E] mb-0">
                            ประเภท: {item.customer_type_name || "-"}
                          </Text>
                        </TableCell>
                        <TableCell className="py-3.5 px-3 text-right">
                          <Text variant="small" className="font-normal text-[#1C1B1B] mb-0">
                            {item.total_amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </Text>
                        </TableCell>
                        <TableCell className="py-3.5 px-3 text-center">
                          <Text variant="xs" className="text-[#5B5B5B] mb-0">
                            {item.canceller || "-"}
                          </Text>
                        </TableCell>
                        <TableCell className="py-3.5 px-3 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-normal rounded-none ${
                            item.status === "PENDING_CANCEL"
                              ? "text-yellow-600 bg-yellow-100"
                              : "text-red-600 bg-red-100"
                          }`}>
                            {item.status === "PENDING_CANCEL" ? "รออนุมัติ" : item.status}
                          </span>
                        </TableCell>
                        <TableCell className="py-3.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => alert(`ดูรายละเอียด ID: ${item.id}`)}
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
    </div>
  );
};

export default SalesCancellationHistory;