import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingBasket, CircleCheck, PenLine, Eye, Printer, Trash2, Info, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  TrendingUp, TrendingDown, ReceiptText, } from "lucide-react";
// Components
import Heading from "../../../components/elements/heading";
import Input   from "../../../components/elements/input";
import Select , { type SelectOption }  from "../../../components/elements/select";
import Button  from "../../../components/elements/button";
import { Badge } from "../../../components/elements/badge";
import ConfirmDialog from "../../../components/elements/confirm_dialog";
import { useToast } from "../../../components/elements/toast";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/elements/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/elements/table";
import { useRejectedBreakdownModal } from "./hooks/useRejectedBreakdownModal";
import { RejectedBreakdownModal } from "./components/RejectedBreakdownModal";
// Interface
import type { POResponse, POSummaryResponse } from "../../../interface/purchase_orders/po_interface";
// Service
import { poService } from "../../../service/http/purchase_orders/po_service";
// Utils
import { cn } from "../../../utils/component";
import { formatDateThai, getThaiMonthOptions, getYearOptions } from "../../../utils/formatdate";
import { generateLocalId } from "../../../utils/generateId";
import { usePathBasePrefix  } from "../../../utils/usePathBasePrefix";
import { useAuth } from "../../../contexts/AuthContexts";

function StatusBadge({ status }: { status: string }) {
  if (status === "DRAFT")
    return <Badge variant="outline" className="text-gray-600 border-none bg-gray-200/50">ฉบับร่าง</Badge>;
  if (status === "PENDING")
    return <Badge variant="outline" className="bg-yellow-100 border-none text-yellow-700">รออนุมัติ</Badge>;
  if (status === "APPROVED")
    return <Badge variant="success">อนุมัติแล้ว</Badge>;
  if (status === "RESUBMITTED")
    return <Badge variant="destructive">รอส่งอนุมัติใหม่</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function ActionButtons({ id, status }: { id: number; status: string }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role } = useAuth();
  const userRole = (role || '').toUpperCase();
  const basePath = usePathBasePrefix();
  const [isPrinting, setIsPrinting] = useState(false);
  const [confirmationAction, setConfirmationAction] = useState<"approve" | "delete" | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const printOptions: SelectOption[] = [
    { label: "พิมพ์รหัส Supplier และ Part Number", value: "with_code" },
    { label: "พิมพ์เฉพาะ Part Number", value: "without_code" },
  ];
  const handlePrint = async (includeCode: boolean) => {
    setIsPrinting(true);
    try {
      const blob = await poService.printPurchaseOrder(id, includeCode);
      const url = window.URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      const fileNameId = generateLocalId();
      const a = document.createElement("a");
      a.href = url;
      a.download = `PO_${fileNameId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleSelectPrintOption = (e: { target: { value: string } }) => {
    handlePrint(e.target.value === "with_code");
  };

  const handleApprove = async () => {
    if (!id || isActionLoading) return;
    setIsActionLoading(true);
    try {
      await poService.updatePOStatus(id, 'APPROVED');
      toast({
        title: 'ดำเนินการสำเร็จ',
        message: 'อนุมัติใบสั่งซื้อแล้ว',
        variant: 'success',
        duration: 4000,
      });
      setConfirmationAction(null);
      setTimeout(() => window.location.reload(), 4000)
    } catch {
      toast({
        title: 'เกิดข้อผิดพลาด',
        message: 'ไม่สามารถอนุมัติใบสั่งซื้อได้ กรุณาลองใหม่อีกครั้ง',
        variant: 'error',
      });
    } finally {
      setIsActionLoading(false);
    }
  }

  const handleDelete = async () => {
    if (!id || isActionLoading) return;
    setIsActionLoading(true);
    try {
      await poService.deletePurchaseOrder(id);
      toast({
        title: 'ดำเนินการสำเร็จ',
        message: 'ลบใบสั่งซื้อสำเร็จ',
        variant: 'success',
        duration: 4000,
      });
      setConfirmationAction(null);
      setTimeout(() => window.location.reload(), 4000)
    } catch {
      toast({
        title: 'เกิดข้อผิดพลาด',
        message: 'ไม่สามารถลบใบสั่งซื้อได้ กรุณาลองใหม่อีกครั้ง',
        variant: 'error',
      });
    } finally {
      setIsActionLoading(false);
    }
  }

  const confirmationModal = (
    <ConfirmDialog
      isOpen={confirmationAction !== null}
      onClose={() => !isActionLoading && setConfirmationAction(null)}
      title={confirmationAction === "delete" ? "ยืนยันการลบใบสั่งซื้อ" : "ยืนยันการอนุมัติใบสั่งซื้อ"}
      description={confirmationAction === "delete"
        ? "คุณต้องการลบใบสั่งซื้อนี้ใช่หรือไม่? สามารถกู้คืนได้จากถังขยะภายใน 30 วัน ก่อนระบบลบถาวร"
        : "คุณต้องการอนุมัติใบสั่งซื้อนี้ใช่หรือไม่?"}
      onConfirm={() => {
        if (confirmationAction === "approve") void handleApprove();
        if (confirmationAction === "delete") void handleDelete();
      }}
      confirmText={confirmationAction === "delete" ? "ยืนยันการลบ" : "ยืนยันการอนุมัติ"}
      cancelText="ยกเลิก"
      variant={confirmationAction === "delete" ? "danger" : "success"}
      isSubmitting={isActionLoading}
    />
  );

  // สถานะ: ฉบับร่าง หรือไม่ผ่านอนุมัติ รอส่งพิจารณาใหม่
  if (status === "DRAFT" || status === "RESUBMITTED") {
    return (
      <>
        <div className="flex items-start justify-center gap-3">
          <button onClick={() => navigate(`${basePath}/orders/${id}`)} className="text-gray-600 hover:text-gray-800 transition cursor-pointer">
            <PenLine size={16}/>
          </button>
          <button onClick={() => setConfirmationAction("delete")} className="text-red-600 hover:text-red-700 transition cursor-pointer">
            <Trash2 size={16} />
          </button>
        </div>
        {confirmationModal}
      </>
    );
  }

  // สถานะ: รออนุมัติ
  if (status === "PENDING" && userRole === 'OWNER') {
    return (
      <>
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => navigate(`${basePath}/orders/${id}`)} className="text-gray-600 hover:text-gray-800 transition cursor-pointer">
            <Eye size={16} />
          </button>
          <button onClick={() => setConfirmationAction("approve")} className="text-emerald-600 hover:text-emerald-700 rounded transition cursor-pointer">
            <CircleCheck size={16} />
          </button>
        </div>
        {confirmationModal}
      </>
    );
  }

  if (status === "PENDING") {
    return (
      <div className="flex items-center justify-center gap-3">
        <button onClick={() => navigate(`${basePath}/orders/${id}`)} className="text-gray-600 hover:text-gray-800 transition cursor-pointer">
          <Eye size={16} />
        </button>
      </div>
    );
  }

  // สถานะอื่นๆ: อนุมัติแล้ว (APPROVED)
  return (
    <div className="flex items-center justify-center gap-3">
      {/* ปุ่มรูปตา: นำทางไปหน้าดูรายละเอียด */}
      <button onClick={() => navigate(`${basePath}/orders/${id}`)} className="text-gray-600 hover:text-gray-700 transition cursor-pointer">
        <Eye size={16} />
      </button>
      
      {/* ปุ่มเครื่องพิมพ์: เรียกฟังก์ชัน Generate PDF */}
      <Select
        options={printOptions}
        onChange={handleSelectPrintOption}
        disabled={isPrinting}
        menuAlign="right"
        renderTrigger={({ toggle, disabled }) => (
          <button
            type="button"
            onClick={toggle}
            disabled={disabled}
            className={cn(
              "flex items-center gap-1 text-gray-600 hover:text-gray-700 transition cursor-pointer",
              "disabled:opacity-60 disabled:cursor-not-allowed"
            )}
          >
            <Printer size={16} />
          </button>
        )}
      />
    </div>
  );
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  const delta = 1; // จำนวนหน้าที่แสดงข้างๆ หน้าปัจจุบัน
  const range: (number | "...")[] = [];
  const left = Math.max(2, current - delta);
  const right = Math.min(total - 1, current + delta);

  range.push(1);
  if (left > 2) range.push("...");
  for (let i = left; i <= right; i++) range.push(i);
  if (right < total - 1) range.push("...");
  if (total > 1) range.push(total);

  return range;
}

const PO_STATUS_OPTIONS = [
  { label: "ทั้งหมด", value: "all" },
  { label: "ฉบับร่าง", value: "DRAFT" },
  { label: "รออนุมัติ", value: "PENDING" },
  { label: "อนุมัติแล้ว", value: "APPROVED" },
  { label: "รอส่งอนุมัติใหม่", value: "RESUBMITTED" },
];

// ─── Page ──────────
const PurchaseOrders: React.FC = () => {
  const { role } = useAuth();
  const navigate = useNavigate();
  const basePath = usePathBasePrefix();
  // 0. Hook
  const { isOpen, modalData, openModal, closeModal } = useRejectedBreakdownModal();
  
  // 1. States สำหรับเก็บข้อมูลจาก API
  const [orders, setOrders] = useState<POResponse[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthlyTotalCount, setMonthlyTotalCount] = useState(0);
  const [monthlyChangePercent, setMonthlyChangePercent] = useState(0);
  const [summary, setSummary] = useState<POSummaryResponse>({
    pending_amount: 0,
    approved_mtd_amount: 0,
    monthly_approved_count: 0,
    monthly_approved_last_count: 0,
    approved_change_percent: 0,
    rejected_mtd_amount: 0,
    rejected_by_supplier: [],
  });

  // 2. States สำหรับ Filter
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchId, setSearchId] = useState("");
  const now = new Date();
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));

  // 3. States สำหรับ Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // 4. States สำหรับเช็คสิทธิ์ดู Summary Card
  const userRole = (role || '').toUpperCase();
  const isOwner = userRole === 'OWNER';

  // ดึงข้อมูล PO ทั้งหมดของทุก User
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
          month: selectedMonth,
          year: selectedYear,
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
  }, [currentPage, itemsPerPage, statusFilter, searchId, selectedMonth, selectedYear]);

  // ดึงสถิติ PO ที่อนุมัติสำหรับการ์ดของทุก role
  useEffect(() => {
    const fetchMonthlyCount = async () => {
      try {
        const response = await poService.getMonthlyCount();
        setMonthlyTotalCount(response.total_count);
        setMonthlyChangePercent(response.change_percent);
      } catch (err) {
        console.error("Failed to fetch monthly PO count:", err);
      }
    };
    fetchMonthlyCount();
  }, []);

  // ดึงยอดสรุปเงิน (pending/approved/rejected MTD) — เฉพาะ Owner เท่านั้น
  useEffect(() => {
    if (!isOwner) return; // ไม่ใช่ Owner ไม่ต้องยิง request นี้เลย ลดการยิงพัง 403 เปล่าๆ
    const fetchSummary = async () => {
      try {
        const response = await poService.getPurchaseOrderSummary();
        setSummary(response);
      } catch (err) {
        console.error("Failed to fetch PO summary:", err);
      }
    };
    fetchSummary();
  }, [isOwner]);

  // ดึงข้อมูลปี พ.ศ. ที่มีทั้งหมดของ po จาก DB
  useEffect(() => {
    const fetchAvailableYears = async () => {
      try {
        const years = await poService.getAvailableYears();
        setAvailableYears(years);
      } catch (err) {
        console.error("Failed to fetch available years:", err);
      }
    };
    fetchAvailableYears();
  }, []);

  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const displayOrders = statusFilter === "all"
    ? orders.filter(po => po.status !== "CANCELLED" && po.status !== "DELETED")
    : orders;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="p-8 space-y-6 bg-white min-h-screen font-sans">

      {/* 1. Header */}
      <div className="flex items-center justify-between">
        <Heading level="h1" weight="semibold" className="m-0 text-black">
          จัดการใบสั่งซื้อ
        </Heading>
        <Button leftIcon={<ShoppingBasket size={20} />} size="md" onClick={() => navigate(`${basePath}/new-orders`)}>
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
            <div className="grid grid-cols-5 gap-4 items-end">
              <div className="col-span-2">
                <Input
                  label="หมายเลขใบสั่งซื้อ"
                  placeholder="PO-XXXX-XXXX"
                  value={searchId}
                  onChange={(e) => {
                    setSearchId(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
              <Select
                label="สถานะใบสั่งซื้อ"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                options={PO_STATUS_OPTIONS}
              />
              <Select
                label="เดือนที่สั่งซื้อ"
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setCurrentPage(1);
                }}
                options={getThaiMonthOptions()}
              />
              <Select
                label="ปีที่สั่งซื้อ"
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setCurrentPage(1);
                }}
                options={getYearOptions(availableYears)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Monthly Stats Card — ทุก role เห็นข้อมูลจาก monthly-count endpoint */}
        <Card className="relative overflow-hidden border-t-4 border-t-red-600 bg-[#22252a] shadow-sm hover:shadow-md transition-shadow w-1/4">
          <CardContent className="p-4 flex items-center justify-between h-full">
            <div>
              <Heading level="p" className="font-normal uppercase tracking-wider text-slate-400">ใบสั่งซื้อที่อนุมัติในเดือนนี้</Heading>
              <div className="flex items-end gap-4 mt-3">
                <span className="text-5xl font-bold text-white leading-none">{monthlyTotalCount}</span>
                <span className="text-base text-slate-400 mb-1">ใบสั่งซื้อ</span>
              </div>
                <div className={`mt-4 flex items-center gap-1 text-sm ${monthlyChangePercent >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {monthlyChangePercent >= 0 ? ( <TrendingUp className="w-4 h-4 text-emerald-500" /> ) : (
                      <TrendingDown className="w-4 h-4 text-red-500" /> )}
                  <span>{Math.abs(monthlyChangePercent).toFixed(1)}%</span>
                  <span className="text-slate-400">เทียบกับเดือนที่แล้ว</span>
                </div>
              </div>
            <div className="opacity-5 text-white">
              <ShoppingBasket size={120} strokeWidth={1.5} />
            </div>
          </CardContent>
        </Card>
      </div>

      { /* TODO: แก้ไขเรียกจากฟังก์ชันจริง */ }
      { isOwner && (
        <div className="grid grid-cols-3 gap-6">
          <Card className="border-l-[5px] border-l-black flex flex-col justify-between h-24 p-5">
            <Heading level="p" className="text-[#6B7280] font-medium">รออนุมัติ</Heading>
            <Heading level="h3" className="font-bold mt-1 text-black">
              ฿ {(summary?.pending_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Heading>
          </Card>
          <Card className="border-l-[5px] border-l-emerald-500 flex flex-col justify-between h-24 p-5">
            <Heading level="p" className="text-[#6B7280] font-medium">อนุมัติแล้ว (MTD)</Heading>
            <Heading level="h3" className="font-bold mt-1 text-black">
              ฿ {(summary?.approved_mtd_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Heading>
          </Card>
          <Card
            onClick={() => openModal(summary?.rejected_by_supplier)}
            className="border-l-[5px] border-l-red-500 flex flex-col justify-between h-24 p-5 relative group cursor-pointer hover:bg-gray-50/80 transition-all duration-200 select-none"
          >
            <div className="flex justify-between items-center w-full">
              <Heading level="p" className="text-[#6B7280] font-medium">รอส่งอนุมัติใหม่</Heading>
              <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-none flex items-center gap-1">
                <Info size={12} /> ดูรายละเอียดแยกบริษัท
              </span>
            </div>
            <Heading level="h3" className="font-bold mt-1 text-black group-hover:text-red-600 transition-colors">
              ฿ {(summary?.rejected_mtd_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Heading>
          </Card>
        </div>
      )}

      {/* 3. Table */}
      <Card className="overflow-hidden" noPadding>
        <Table>
          <TableHeader className="bg-[#f6f3f2] text-[#797878]">
            <TableRow>
              <TableHead className="pl-6">เลขที่ใบสั่งซื้อ</TableHead>
              <TableHead>วันที่สร้าง</TableHead>
              <TableHead>ผู้จัดจำหน่าย</TableHead>
              <TableHead>พนักงานผู้สร้าง</TableHead>
              <TableHead>แก้ไขล่าสุดโดย</TableHead>
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
            ) : displayOrders.length > 0 ? (
              displayOrders.map((po) => {
                // คำนวณจำนวนรายการและจำนวนชิ้นจาก array po_items
                const totalItemTypes = po.po_items?.length || 0;
                const totalQuantity = po.po_items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0;

                return (
                  <TableRow key={po.id} className="hover:bg-gray-50/70">
                    <TableCell className="pl-6 text-gray-900">{po.po_number}</TableCell>
                    <TableCell className="text-black">{formatDateThai(po.created_at)}</TableCell>
                    <TableCell><div className="text-black">{po.supplier_name || "ไม่ระบุ"}</div></TableCell>
                    <TableCell className="text-black">{po.creator_name || "ไม่ระบุ"}</TableCell>
                    <TableCell className="text-black">{po.updated_by_name || "ไม่ระบุ"}</TableCell>
                    <TableCell className="text-center text-black">{totalItemTypes}</TableCell>
                    <TableCell className="text-center text-black">{totalQuantity}</TableCell>
                    <TableCell className="text-right pr-6 text-black">
                      ฿{Number(po.total_amount).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-center text-black">
                      <div className="flex justify-center"><StatusBadge status={po.status} /></div>
                    </TableCell>
                    <TableCell className="text-center"><ActionButtons id={po.id} status={po.status} /></TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-gray-400">
                  <ReceiptText size={40} strokeWidth={0.7} className='mx-auto'/> <br />ไม่พบข้อมูลใบสั่งซื้อ
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
                  className="border border-gray-200 rounded-none px-2 py-1 text-gray-600 bg-white hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-200 cursor-pointer"
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
                className="p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronsLeft size={16} />
              </button>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => prev - 1)}
                aria-label="หน้าก่อนหน้า"
                className="p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>

              {getPageNumbers(currentPage, totalPages).map((page, idx) =>
                page === "..." ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
                ) : (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    aria-current={currentPage === page ? "page" : undefined}
                    className={cn(
                      "px-3 py-1.5 rounded-none font-medium transition-colors cursor-pointer",
                      currentPage === page ? "bg-[#d61c24] text-white" : "text-gray-600 hover:bg-gray-100"
                    )}
                  >
                    {page}
                  </button>
                )
              )}

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => prev + 1)}
                aria-label="หน้าถัดไป"
                className="p-1.5 rounded-none text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
                aria-label="หน้าสุดท้าย"
                className="p-1.5 rounded-none text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronsRight size={16} />
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
