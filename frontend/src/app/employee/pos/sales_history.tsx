import React, { useState } from "react";
import {
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Calendar,
} from "lucide-react";

// นำเข้า Components ของคุณ
import Heading from "../../../components/elements/heading";
import Text from "../../../components/elements/text";
import Input from "../../../components/elements/input";
import Select from "../../../components/elements/select";
import Button from "../../../components/elements/button";
import Badge from "../../../components/elements/badge";
import { TableHead, TableHeader, TableRow } from "../../../components/elements/table";
import { Card, CardContent } from "../../../components/elements/card";
import { cn } from "../../../utils/component";

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

// --- Types ---
interface TransactionItem {
  id: string;
  orderNo: string;
  date: string;
  customerName: string;
  customerUid: string;
  amount: number;
  paymentMethod: "CRADIT" | "CASH";
  status: "completed" | "overdue" | "pending";
}

export default function TransactionHistoryPage() {
  // --- States ---
  const [searchOrder, setSearchOrder] = useState("");
  const [customerType, setCustomerType] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const isLoading = false;
  const error = null;
  const totalItems = 2482;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // --- Mock Data ---
  const transactions: TransactionItem[] = [
    {
      id: "1",
      orderNo: "INV-2024-001",
      date: "20 เม.ย. 2569 · 14:20",
      customerName: "เอเป็กซ์ ออโต้ อู่ซ่อมรถ",
      customerUid: "UID: G-092-23",
      amount: 12450.0,
      paymentMethod: "CRADIT",
      status: "completed",
    },
    {
      id: "2",
      orderNo: "INV-2024-002",
      date: "20 เม.ย. 2569 · 11:50",
      customerName: "โลจิสติกส์หุ้มเกราะ",
      customerUid: "UID: G-092-23",
      amount: 45000.0,
      paymentMethod: "CASH",
      status: "overdue",
    },
    {
      id: "3",
      orderNo: "INV-2024-003",
      date: "18 เม.ย. 2569 · 15:50",
      customerName: "เอเป็กซ์ ออโต้ อู่ซ่อมรถ",
      customerUid: "UID: G-092-23",
      amount: 10000.0,
      paymentMethod: "CRADIT",
      status: "pending",
    },
  ];

  // --- Helper Render Status Badge ---
  const renderStatusBadge = (status: TransactionItem["status"]) => {
    switch (status) {
      case "completed":
        return <Badge variant="success" className="rounded-none">ชำระแล้ว</Badge>;
      case "overdue":
        return <Badge variant="error" className="rounded-none">เกินกำหนด</Badge>;
      case "pending":
        return <Badge variant="info" className="rounded-none">รอชำระ</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-slate-800 font-sans">
      <div className="flex-1 flex flex-col min-w-0">
        {/* PAGE CONTENT */}
        <main className="p-6 space-y-6 flex-1">
          {/* Section Title */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <Text variant="xs" className="text-[#E51C23] uppercase tracking-wider mb-0">
                บันทึกบิลขายสินค้า
              </Text>
              <Heading level="h1" weight="normal" className="mb-0 text-[#1C1B1B]">
                ประวัติการขายสินค้า
              </Heading>
            </div>
          </div>

          {/* Filter Bar */}
          <Card className="bg-[#F6F3F2] rounded-none shadow-none border-y border-r border-gray-200 border-l-4 border-l-[#E51C23]">
            <CardContent className="p-6 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                {/* ช่องที่ 1: ค้นหาคำ */}
                <div className="md:col-span-3 flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-[#5F5E5E]">
                    ค้นหาเลขคำสั่งซื้อ/ชื่อลูกค้า
                  </label>
                  <Input
                    placeholder="INV-2024-XXX หรือ ชื่อลูกค้า"
                    value={searchOrder}
                    onChange={(e) => setSearchOrder(e.target.value)}
                    className="bg-white border-none rounded-none h-11 text-sm font-normal text-[#1C1B1B] placeholder:text-[#6B7280] placeholder:font-light px-3 shadow-none focus-visible:ring-0"
                  />
                </div>

                {/* ช่องที่ 2: ช่วงวันที่ */}
                <div className="md:col-span-3 flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-[#5F5E5E]">
                    ช่วงวันที่
                  </label>
                  <div className="relative">
                    <Input
                      type="date"
                      value="30 วันที่ผ่านมา"
                      readOnly
                      className="bg-white border-none rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 pr-10 shadow-none focus-visible:ring-0 cursor-pointer"
                    />
                    <Calendar className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-[#1C1B1B] pointer-events-none stroke-[1.75]" />
                  </div>
                </div>

                {/* ช่องที่ 3: ประเภทลูกค้า */}
                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-[#5F5E5E]">
                    ประเภทลูกค้า
                  </label>
                  <Select
                    value={customerType}
                    onChange={(e) => setCustomerType(e.target.value)}
                    placeholder="ทั้งหมด"
                    className="bg-white border-none rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 shadow-none focus-visible:ring-0"
                    options={[
                      { label: "ทั้งหมด", value: "" },
                      { label: "บุคคลทั่วไป", value: "individual" },
                      { label: "อู่ซ่อมรถ / บริษัท", value: "company" },
                    ]}
                  />
                </div>

                {/* ช่องที่ 4: การชำระเงิน */}
                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-[#5F5E5E]">
                    การชำระเงิน
                  </label>
                  <Select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    placeholder="วิธีการทั้งหมด"
                    className="bg-white border-none rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 shadow-none focus-visible:ring-0"
                    options={[
                      { label: "วิธีการทั้งหมด", value: "" },
                      { label: "เงินสด (CASH)", value: "CASH" },
                      { label: "เครดิต (CRADIT)", value: "CRADIT" },
                    ]}
                  />
                </div>

                {/* ช่องที่ 5: ปุ่มใช้ตัวกรอง */}
                <div className="md:col-span-2">
                  <Button className="w-full h-11 rounded-none bg-[#E51C23] hover:bg-[#c9151b] text-white text-sm font-normal transition-colors border-none shadow-none">
                    ใช้ตัวกรอง
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Data Table */}
          <Card className="bg-white rounded-none shadow-sm overflow-hidden border border-gray-200">
            <table className="w-full text-left border-collapse">
              {/* Header Table */}
              <TableHeader className="bg-[#F6F3F2] rounded-none border-b border-gray-200 text-[11px] text-[#6B7280] uppercase tracking-wider">
                <TableRow>
                  <TableHead className="py-3 px-4 w-[14%]">หมายเลขคำสั่งซื้อ</TableHead>
                  <TableHead className="py-3 px-4 w-[18%]">วันที่ทำรายการ</TableHead>
                  <TableHead className="py-3 px-4 w-[28%]">ชื่อลูกค้า/อู่ซ่อมรถ/บริษัท</TableHead>
                  <TableHead className="py-3 px-4 text-right w-[12%]">จำนวนเงิน</TableHead>
                  <TableHead className="py-3 px-4 text-center w-[10%]">การชำระเงิน</TableHead>
                  <TableHead className="py-3 px-4 text-center w-[10%]">สถานะ</TableHead>
                  <TableHead className="py-3 px-4 text-center w-[8%]">จัดการ</TableHead>
                </TableRow>
              </TableHeader>

              {/* Body Table */}
              <tbody className="divide-y divide-gray-200">
                {transactions.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    {/* 1. หมายเลขคำสั่งซื้อ */}
                    <td className="py-3.5 px-4">
                      <Text variant="small" className="font-medium text-[#1C1B1B] mb-0">
                        {item.orderNo}
                      </Text>
                    </td>

                    {/* 2. วันที่ทำรายการ */}
                    <td className="py-3.5 px-4">
                      <Text variant="xs" className="font-light text-[#5B5B5B] mb-0">
                        {item.date}
                      </Text>
                    </td>

                    {/* 3. ชื่อลูกค้า + UID */}
                    <td className="py-3.5 px-4">
                      <Text variant="small" className="font-normal text-[#1C1B1B] mb-0">
                        {item.customerName}
                      </Text>
                      <Text variant="xs" className="font-light text-[#A8A29E] mb-0">
                        {item.customerUid}
                      </Text>
                    </td>

                    {/* 4. จำนวนเงิน */}
                    <td className="py-3.5 px-4 text-right">
                      <Text variant="small" className="font-medium text-[#1C1B1B] mb-0">
                        ฿{item.amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                      </Text>
                    </td>

                    {/* 5. วิธีการชำระเงิน */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 bg-[#F6F3F2] rounded-none">
                        <Text variant="xs" className="font-medium text-[#5F5E5E] tracking-wide mb-0">
                          {item.paymentMethod}
                        </Text>
                      </span>
                    </td>

                    {/* 6. สถานะ */}
                    <td className="py-3.5 px-4 text-center">
                      {renderStatusBadge(item.status)}
                    </td>

                    {/* 7. ปุ่มจัดการ */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center p-1.5 text-[#E51C23] hover:text-[#c9151b] transition-colors"
                        title="ดูรายละเอียด"
                        onClick={() => alert(`ดูรายละเอียดคำสั่งซื้อ: ${item.orderNo}`)}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination (อยู่ภายในส่วนล่างของ Card ตาราง) */}
            {!isLoading && !error && totalItems > 0 && (
              <div className="bg-[#FCFBFA] px-6 py-4 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500">
                {/* ฝั่งซ้าย: สรุปจำนวนรายการ และ Selector */}
                <div className="flex items-center gap-4">
                  <Text variant="xs" className="text-[#5F5E5E] mb-0">
                    แสดง {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} ถึง{" "}
                    {Math.min(currentPage * itemsPerPage, totalItems)} จาก {totalItems} ใบสั่งซื้อ
                  </Text>

                  <div className="flex items-center gap-2">
                    <Text variant="xs" className="text-[#5F5E5E] mb-0">
                      รายการต่อหน้า:
                    </Text>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
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
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(1)}
                    aria-label="หน้าแรก"
                    className="p-1.5 rounded-none text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    aria-label="หน้าก่อนหน้า"
                    className="p-1.5 rounded-none text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {getPageNumbers(currentPage, totalPages).map((page, idx) =>
                    page === "..." ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-gray-400 select-none">
                        ...
                      </span>
                    ) : (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(Number(page))}
                        aria-current={currentPage === page ? "page" : undefined}
                        className={cn(
                          "px-3 py-1.5 rounded-none font-medium text-xs transition-colors cursor-pointer",
                          currentPage === page
                            ? "bg-[#E51C23] text-white"
                            : "text-gray-600 hover:bg-gray-100 border border-transparent"
                        )}
                      >
                        {page}
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    aria-label="หน้าถัดไป"
                    className="p-1.5 rounded-none text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(totalPages)}
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
    </div>
  );
}