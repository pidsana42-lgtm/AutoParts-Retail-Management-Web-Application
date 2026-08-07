import React, { useState } from "react";
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

// Mock Data
const MOCK_DATA = [
  {
    id: "1",
    orderNumber: "INV-2024-001",
    date: "20 เม.ย. 2569 - 14:20",
    customer: "เอเปกซ์ ออโต้ อู่ซ่อมรถ",
    uid: "G-092-23",
    amount: "12,450.00",
    canceller: "เนตรนภัทร",
  },
  {
    id: "2",
    orderNumber: "INV-2024-002",
    date: "20 เม.ย. 2569 - 11:50",
    customer: "โลจิสติกส์หุ้นเกราะ",
    uid: "G-092-23",
    amount: "45,000.00",
    canceller: "เนตรนภัทร",
  },
  {
    id: "3",
    orderNumber: "INV-2024-003",
    date: "18 เม.ย. 2569 - 15:50",
    customer: "สมชาย ใจดี",
    uid: "-",
    amount: "400.00",
    canceller: "เนตรนภัทร",
  },
];

const SalesCancellationHistory: React.FC = () => {
  // State สำหรับเก็บ ID รายการที่ถูกเลือก
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // State สำหรับ Pagination Dynamic
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [isLoading] = useState(false);
  const [error] = useState<string | null>(null);

  const totalRows = 20; // จำนวนรายการสมมติ
  const totalPages = Math.ceil(totalRows / limit);

  // เช็กว่าเลือกครบทุกรายการในหน้านี้หรือยัง
  const isSelectAll =
    MOCK_DATA.length > 0 && selectedIds.length === MOCK_DATA.length;

  // ฟังก์ชั่นเมื่อกด Checkbox ที่ Header (เลือกทั้งหมด / ยกเลิกทั้งหมด)
  const handleSelectAll = () => {
    if (isSelectAll) {
      setSelectedIds([]); // เคลียร์ทั้งหมด
    } else {
      setSelectedIds(MOCK_DATA.map((item) => item.id)); // เลือกทุก ID
    }
  };

  // ฟังก์ชั่นเมื่อกด Checkbox แต่ละแถว
  const handleSelectRow = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id)); // เอาออก
    } else {
      setSelectedIds([...selectedIds, id]); // เพิ่มเข้าไป
    }
  };

  // ฟังก์ชั่นกู้คืนรายการที่เลือก
  const handleRestoreSelected = () => {
    if (selectedIds.length === 0) {
      alert("กรุณาเลือกรายการที่ต้องการกู้คืนอย่างน้อย 1 รายการ");
      return;
    }
    alert(`กำลังกู้คืนรายการ ID: ${selectedIds.join(", ")}`);
  };

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

  return (
    <div className="relative flex min-h-screen bg-[#F8F9FA] text-slate-800 font-sans overflow-x-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        <main className="p-6 space-y-6 flex-1">
          {/* Title Section */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <Text
                variant="xs"
                className="text-[#E51C23] uppercase tracking-wider mb-0"
              >
                บันทึกบิลขาย เคลม/คืน สินค้า
              </Text>
              <Heading
                level="h1"
                weight="normal"
                className="mb-0 text-[#1C1B1B]"
              >
                ประวัติการยกเลิกขายสินค้า
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
                    <ScanBarcode
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10"
                      size={18}
                    />
                    <Input
                      placeholder="สแกนบาร์โค้ด / INV-2024-XXX หรือ ชื่อลูกค้า"
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
                    placeholder="ทั้งหมด"
                    className="bg-white border-none rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 shadow-none focus-visible:ring-0"
                    options={[
                      { label: "ทั้งหมด", value: "" },
                      { label: "ลูกค้าทั่วไป (ขาจร)", value: "GENERAL" },
                      { label: "ลูกค้าอู่ซ่อมรถ", value: "GARAGE" },
                      { label: "ลูกค้าบริษัท", value: "WHOLESALE" },
                    ]}
                  />
                </div>

                {/* ช่องที่ 4: การชำระเงิน */}
                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-[#5F5E5E]">
                    การชำระเงิน
                  </label>
                  <Select
                    placeholder="วิธีการทั้งหมด"
                    className="bg-white border-none rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 shadow-none focus-visible:ring-0"
                    options={[
                      { label: "ทั้งหมด", value: "" },
                      { label: "เงินสด", value: "CASH" },
                      { label: "เงินโอน", value: "QR" },
                      { label: "เงินเชื่อ", value: "CREDIT" },
                    ]}
                  />
                </div>

                {/* ช่องที่ 5: ปุ่มใช้ตัวกรอง */}
                <div className="md:col-span-1">
                  <Button className="w-full h-11 rounded-none bg-[#E51C23] hover:bg-[#c9151b] text-white text-sm font-normal transition-colors border-none shadow-none cursor-pointer">
                    ค้นหา
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table Section */}
          <Card className="bg-white rounded-none shadow-sm overflow-hidden border border-gray-200">
            <Table className="!w-full !min-w-0 table-fixed text-left border-collapse">
              <TableHeader className="bg-[#F6F3F2] rounded-none border-b border-gray-200 text-[11px] text-[#6B7280] uppercase tracking-wider">
                <TableRow>
                  {/* Checkbox Header (กดเพื่อเลือกทั้งหมด) */}
                  <TableHead className="py-3 px-3 w-[4%] text-center">
                    <input
                      type="checkbox"
                      checked={isSelectAll}
                      onChange={handleSelectAll}
                      className="w-4 h-4 border border-gray-300 rounded-none bg-white checked:bg-[#E51C23] checked:border-[#E51C23] cursor-pointer appearance-none flex items-center justify-center after:content-['✓'] after:text-white after:text-[10px] after:font-bold after:hidden checked:after:block"
                    />
                  </TableHead>
                  <TableHead className="py-3 px-3 w-[14%]">
                    หมายเลขคำสั่งซื้อ
                  </TableHead>
                  <TableHead className="py-3 px-3 w-[14%]">
                    วันที่ทำรายการยกเเลิก
                  </TableHead>
                  <TableHead className="py-3 px-3 w-[26%]">
                    ชื่อลูกค้า/อู่ซ่อมรถ/บริษัท
                  </TableHead>
                  <TableHead className="py-3 px-3 text-right w-[12%]">
                    จำนวนเงิน
                  </TableHead>
                  <TableHead className="py-3 px-3 text-center w-[12%]">
                    ผู้ยกเลิก
                  </TableHead>
                  <TableHead className="py-3 px-3 text-center w-[10%]">
                    สถานะ
                  </TableHead>
                  <TableHead className="py-3 px-3 text-center w-[8%]">
                    จัดการ
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-200">
                {MOCK_DATA.map((item) => {
                  const isChecked = selectedIds.includes(item.id);
                  return (
                    <TableRow
                      key={item.id}
                      className={
                        isChecked
                          ? "bg-red-50/40"
                          : "hover:bg-slate-50 transition-colors"
                      }
                    >
                      {/* Checkbox รายแถว */}
                      <TableCell className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleSelectRow(item.id)}
                          className="w-4 h-4 border border-gray-300 rounded-none bg-white checked:bg-[#E51C23] checked:border-[#E51C23] cursor-pointer appearance-none flex items-center justify-center after:content-['✓'] after:text-white after:text-[10px] after:font-bold after:hidden checked:after:block"
                        />
                      </TableCell>

                      {/* หมายเลขคำสั่งซื้อ */}
                      <TableCell className="py-3.5 px-4">
                        <Text
                          variant="small"
                          className="font-normal text-[#1C1B1B] mb-0"
                        >
                          {item.orderNumber}
                        </Text>
                      </TableCell>

                      {/* วันที่ทำรายการยกเลิก */}
                      <TableCell className="py-3.5 px-3">
                        <Text
                          variant="xs"
                          className="font-light text-[#5B5B5B] mb-0"
                        >
                          {item.date}
                        </Text>
                      </TableCell>

                      {/* ชื่อลูกค้า/อู่ซ่อมรถ/บริษัท */}
                      <TableCell className="py-3.5 px-3 truncate">
                        <Text
                          variant="small"
                          className="font-normal text-[#1C1B1B] mb-0 truncate"
                        >
                          {item.customer}
                        </Text>
                        <Text
                          variant="xs"
                          className="font-light text-[#A8A29E] mb-0"
                        >
                          UID: {item.uid}
                        </Text>
                      </TableCell>

                      {/* จำนวนเงิน */}
                      <TableCell className="py-3.5 px-3 text-right">
                        <Text
                          variant="small"
                          className="font-normal text-[#1C1B1B] mb-0"
                        >
                          {item.amount}
                        </Text>
                      </TableCell>

                      {/* ผู้ยกเลิก */}
                      <TableCell className="py-3.5 px-3 text-center">
                        <Text variant="xs" className="text-[#5B5B5B] mb-0">
                          {item.canceller}
                        </Text>
                      </TableCell>

                      {/* สถานะ */}
                      <TableCell className="py-3.5 px-3 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-normal text-red-600 bg-red-100 rounded-none">
                          รออนุมัติ
                        </span>
                      </TableCell>

                      {/* จัดการ */}
                      <TableCell className="py-3.5 px-3 text-center">
                        <button
                          type="button"
                          className="p-1.5 text-[#E51C23] hover:bg-red-50 rounded-full cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Restore Button Bar */}
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

            {/* Dynamic Pagination Controls */}
            {!isLoading && !error && totalRows > 0 && (
              <div className="bg-[#FCFBFA] px-6 py-4 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500">
                {/* ฝั่งซ้าย: สรุปจำนวนรายการ และ Selector */}
                <div className="flex items-center gap-4">
                  <Text variant="xs" className="text-[#5F5E5E] mb-0">
                    แสดงรายการที่ {Math.min((page - 1) * limit + 1, totalRows)}-
                    {Math.min(page * limit, totalRows)} จากทั้งหมด {totalRows} รายการ
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
                    className="p-1.5 border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:bg-gray-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    disabled={page === 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    aria-label="หน้าก่อนหน้า"
                    className="p-1.5 border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:bg-gray-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
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
                          "px-3 py-1.5 font-medium text-xs transition-colors cursor-pointer border",
                          page === p
                            ? "bg-[#E51C23] text-white border-[#E51C23]"
                            : "bg-white text-gray-700 hover:bg-gray-50 border-gray-200"
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
                    className="p-1.5 border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:bg-gray-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    disabled={page === totalPages}
                    onClick={() => setPage(totalPages)}
                    aria-label="หน้าสุดท้าย"
                    className="p-1.5 border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:bg-gray-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
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