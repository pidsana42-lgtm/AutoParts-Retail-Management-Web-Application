import React, { useState, useEffect } from "react";
import {
  ShoppingBasket, CircleCheck, Pencil,
  Eye, Printer, Trash2, Info,
  ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight,
} from "lucide-react";

import Heading from "../../../components/elements/heading";
import Input   from "../../../components/elements/input";
import Select  from "../../../components/elements/select";
import Button  from "../../../components/elements/button";
import { Badge } from "../../../components/elements/badge";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/elements/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/elements/table";

import { cn } from "../../../utils/component";
import { useNavigate } from "react-router-dom";

import type { POResponse, POSummaryResponse } from "../../../interface/purchase_orders/po_interface";
import { formatDate } from "../../../utils/formatdate";
import { useRejectedBreakdownModal } from "./hooks/useRejectedBreakdownModal";
import { RejectedBreakdownModal } from "./components/RejectedBreakdownModal";
import { poService } from "../../../service/http/purchase_orders/po_service";

function StatusBadge({ status }: { status: string }) {
  // ทำให้เป็นตัวพิมพ์เล็กทั้งหมดเพื่อลดปัญหา Case Sensitive
  const currentStatus = status?.toLowerCase(); 
  if (currentStatus === "pending" || currentStatus === "draft")
    return <Badge variant="outline" className="text-gray-800 border-gray-400">รออนุมัติ</Badge>;
  if (currentStatus === "approved")
    return <Badge variant="success" dot>อนุมัติแล้ว</Badge>;
  if (currentStatus === "rejected")
    return <Badge variant="destructive">ไม่อนุมัติ</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function ActionButtons({ id, status }: { id: number; status: string }) {
  const navigate = useNavigate();
  const currentStatus = status?.toLowerCase();

  const handlePrint = async () => {
    try {
      const blob = await poService.printPurchaseOrder(id);
      // สร้าง URL จำลองสำหรับไฟล์ PDF แล้วสั่งเปิดในแท็บใหม่
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      window.open(url, '_blank'); 
    } catch (err) {
      console.error("พิมพ์ไม่สำเร็จ:", err);
    }
  };

  if (currentStatus === "pending" || currentStatus === "draft") {
    return (
      <div className="flex items-center justify-center gap-3">
        <button className="text-emerald-600 hover:text-emerald-700 p-1.5 rounded transition cursor-pointer">
          <CircleCheck className="w-4 h-4" />
        </button>
        <button className="text-gray-600 hover:text-gray-800 transition cursor-pointer">
          <Pencil className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-3">
      {/* ปุ่มรูปตา: นำทางไปหน้าดูรายละเอียด */}
      <button 
        onClick={() => navigate(`/owner/purchase-orders/${id}`)}
        className="text-gray-500 hover:text-gray-700 transition cursor-pointer"
      >
        <Eye className="w-4 h-4" />
      </button>
      
      {/* ปุ่มเครื่องพิมพ์: เรียกฟังก์ชัน Generate PDF */}
      {currentStatus === "approved" ? (
        <button 
          onClick={handlePrint}
          className="text-gray-500 hover:text-gray-700 transition cursor-pointer"
        >
          <Printer className="w-4 h-4" />
        </button>
      ) : (
        <button className="text-gray-400 hover:text-red-600 transition cursor-pointer">
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ─── Page ──────────
const PurchaseOrders: React.FC = () => {
  const navigate = useNavigate();
  // 0. Hook
  const { isOpen, modalData, openModal, closeModal } = useRejectedBreakdownModal();
  
  // 1. States สำหรับเก็บข้อมูลจาก API
  const [orders, setOrders] = useState<POResponse[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthlyTotalCount, setMonthlyTotalCount] = useState(0);
  const [summary, setSummary] = useState<POSummaryResponse>({
    pending_amount: 0,
    approved_mtd_amount: 0,
    rejected_mtd_amount: 0,
    rejected_by_supplier: [],
    total_count: 0,
  });

  // 2. States สำหรับ Filter
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchId, setSearchId] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  // 3. States สำหรับ Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // ดึงข้อมูล PO ทั้งหมดของ User
  useEffect(() => {
    const fetchPurchaseOrders = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await poService.getPurchaseOrders({
          page: currentPage,
          limit: itemsPerPage,
          status: statusFilter,
          search: searchId,
          date: dateFilter,
        });

        setOrders(response.data || []);
        setTotalItems(response.total || 0);
        
      } catch (err: any) {
        const errorMessage = err.response?.data?.message || err.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ";
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      fetchPurchaseOrders();
    }, searchId ? 400 : 0);

    return () => clearTimeout(delayDebounceFn);
  }, [currentPage, itemsPerPage, statusFilter, searchId, dateFilter]);

  // รีเซ็ตหน้ากลับเป็นหน้า 1 เมื่อมีการค้นหาใหม่
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchId, dateFilter]);

  // ดึงข้อมูลสรุปยอดสั่งซื้อ
  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await poService.getPurchaseOrderSummary();
        setSummary(response); 
        setMonthlyTotalCount(response.total_count);
      } catch (err: any) {
        console.error("Failed to fetch PO summary:", err);
      }
    };

    fetchSummary();
  }, []); // [] หมายถึงให้รันแค่ครั้งเดียวตอนโหลดหน้าจอ

  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="p-8 space-y-6 bg-gray-50 min-h-screen font-sans">

      {/* 1. Header */}
      <div className="flex items-center justify-between">
        <Heading level="h1" weight="semibold" className="m-0 text-black">
          จัดการใบสั่งซื้อ
        </Heading>
        <Button leftIcon={<ShoppingBasket className="h-5 w-5" />} size="md" onClick={() => navigate("/owner/new-orders")}>
          สร้างใบสั่งซื้อใหม่
        </Button>
      </div>

      {/* 2. Search + Stats */}
      <div className="flex gap-6 items-stretch">

        {/* Search Card */}
        <Card className="flex-1 w-3/4">
          <CardHeader>
            <CardTitle className="text-base text-black">ค้นหาใบสั่งซื้อด้วย</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 items-end">
              <Input
                label="หมายเลขใบสั่งซื้อ"
                placeholder="PO-XXXX-XXXX"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
              />
              <Select
                label="สถานะใบสั่งซื้อ"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { label: "ทั้งหมด",     value: "all" },
                  { label: "ฉบับร่าง", value: "DRAFT" },
                  { label: "รออนุมัติ", value: "PENDING"  },
                  { label: "อนุมัติแล้ว", value: "APPROVED" },
                  { label: "ไม่อนุมัติ",  value: "REJECTED" },
                ]}
              />
              <Input
                type="date"
                label="วันที่สั่งซื้อ"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Monthly Stats Card */}
        <div className="bg-[#22252a] text-white rounded-md p-6 w-1/4 flex flex-col justify-between shadow-sm relative overflow-hidden">
          <div>
            <p className="text-sm text-gray-400 font-light">ใบสั่งซื้อทั้งหมดของเดือนนี้</p>
            <p className="text-4xl font-bold mt-2 flex items-baseline gap-2">
              {monthlyTotalCount} <span className="text-lg font-normal text-gray-300">ใบสั่งซื้อ</span>
            </p>
          </div>
          <div className="absolute right-4 bottom-4 opacity-5 pointer-events-none">
            <ShoppingBasket className="w-24 h-24" />
          </div>
        </div>
      </div>

      { /* TODO: แก้ไขเรียกจากฟังก์ชันจริง */ }
      <div className="grid grid-cols-3 gap-6">
        <Card className="border-l-[5px] border-l-black flex flex-col justify-center h-24 p-5">
          <p className="text-sm text-[#6B7280] font-medium">รออนุมัติ</p>
          <p className="text-2xl font-bold mt-1 text-gray-900">
            ฿{(summary?.pending_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </Card>
        <Card className="border-l-[5px] border-l-emerald-500 flex flex-col justify-center h-24 p-5">
          <p className="text-sm text-[#6B7280] font-medium">อนุมัติแล้ว (MTD)</p>
          <p className="text-2xl font-bold mt-1 text-gray-900">
            ฿{(summary?.approved_mtd_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </Card>
        <Card 
          onClick={() => openModal(summary?.rejected_by_supplier)}
          className="border-l-[5px] border-l-red-500 flex flex-col justify-center h-24 p-5 relative group cursor-pointer hover:bg-gray-50/80 transition-all duration-200 select-none"
        >
          <div className="flex justify-between items-center w-full">
            <p className="text-sm text-[#6B7280] font-medium">ไม่อนุมัติ (MTD)</p>
            <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-sm flex items-center gap-1">
              <Info className="w-3 h-3" /> ดูรายละเอียดแยกบริษัท
            </span>
          </div>
          <p className="text-2xl font-bold mt-1 text-gray-900 group-hover:text-red-600 transition-colors">
            ฿{(summary?.rejected_mtd_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </Card>
      </div>

      {/* 3. Table */}
      <Card className="overflow-hidden" noPadding>
        <Table>
          <TableHeader className="bg-[#f6f3f2] text-[#797878]">
            <TableRow>
              <TableHead className="pl-6">เลขที่ใบสั่งซื้อ</TableHead>
              <TableHead>วันที่สร้าง</TableHead>
              <TableHead>ผู้จัดจำหน่าย</TableHead>
              <TableHead>พนักงานผู้สร้าง</TableHead>
              <TableHead className="text-center">รวมรายการ</TableHead>
              <TableHead className="text-center">จำนวนชิ้น</TableHead>
              <TableHead className="text-right pr-6">ราคารวม</TableHead>
              <TableHead className="text-center">สถานะ</TableHead>
              <TableHead className="text-center">จัดการ</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody className="text-gray-700">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-gray-500">
                  กำลังโหลดข้อมูล...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-red-500 font-medium">
                  {error}
                </TableCell>
              </TableRow>
            ) : orders.length > 0 ? (
              orders.map((po) => {
                // คำนวณจำนวนรายการและจำนวนชิ้นจาก array po_items
                const totalItemTypes = po.po_items?.length || 0;
                const totalQuantity = po.po_items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0;

                return (
                  <TableRow key={po.id} className="hover:bg-gray-50/70">
                    <TableCell className="pl-6 font-semibold text-gray-900">
                      {po.order_number}
                    </TableCell>
                    <TableCell className="text-gray-500">{formatDate(po.created_at)}</TableCell>
                    <TableCell>
                      <div className="font-medium text-gray-900">{po.supplier_name || "ไม่ระบุ"}</div>
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {po.creator_name || "ไม่ระบุ"}
                    </TableCell>
                    <TableCell className="text-center font-medium">{totalItemTypes}</TableCell>
                    <TableCell className="text-center font-medium">{totalQuantity}</TableCell>
                    <TableCell className="text-right pr-6 font-medium text-gray-900">
                      ฿{Number(po.total_amount).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={po.status} />
                    </TableCell>
                    <TableCell className="text-center">
                      <ActionButtons id={po.id} status={po.status} />
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-gray-500">
                  ไม่พบข้อมูลใบสั่งซื้อ
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* 4. Pagination */}
        {!isLoading && !error && totalItems > 0 && (
          <div className="bg-[#fcfbfa] px-6 py-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span>
                แสดง {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} ถึง {Math.min(currentPage * itemsPerPage, totalItems)} จาก {totalItems} ใบสั่งซื้อ
              </span>
              <div className="flex items-center gap-2">
                <span>รายการต่อหน้า:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="border border-gray-200 rounded px-2 py-1 text-gray-600 bg-white hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-200 cursor-pointer"
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
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
                aria-label="หน้าแรก"
                className="p-1.5 rounded text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => prev - 1)}
                aria-label="หน้าก่อนหน้า"
                className="p-1.5 rounded text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {pageNumbers.map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  aria-label={`หน้า ${page}`}
                  aria-current={currentPage === page ? "page" : undefined}
                  className={cn(
                    "px-3 py-1.5 rounded font-medium transition-colors cursor-pointer",
                    currentPage === page
                      ? "bg-[#d61c24] text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  {page}
                </button>
              ))}

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => prev + 1)}
                aria-label="หน้าถัดไป"
                className="p-1.5 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
                aria-label="หน้าสุดท้าย"
                className="p-1.5 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>

      <RejectedBreakdownModal 
        isOpen={isOpen}
        onClose={closeModal}
        data={modalData}
      />

    </div>
  );
};

export default PurchaseOrders;