import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Eye, ReceiptText, AlertTriangle } from 'lucide-react';
// Components
import { Card, CardHeader, CardContent, CardTitle } from '../../../components/elements/card';
import Heading from '../../../components/elements/heading';
import Input from '../../../components/elements/input';
import Select from '../../../components/elements/select';
import Button from '../../../components/elements/button';
import ConfirmDialog from '../../../components/elements/confirm_dialog';
import { useToast } from '../../../components/elements/toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/elements/table';
// Interface
import type { POResponse } from '../../../interface/purchase_orders/po_interface';
// Service
import { poService } from '../../../service/http/purchase_orders/po_service';
// Utils
import { cn } from '../../../utils/component';
import { formatDateThai, getThaiMonthOptions, getYearOptions } from '../../../utils/formatdate';
import { usePathBasePrefix } from '../../../utils/usePathBasePrefix';

function getPageNumbers(current: number, total: number): (number | "...")[] {
  const delta = 1;
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
  { label: 'อยู่ในถังขยะ', value: 'DELETED' },
  { label: 'ยกเลิกแล้ว', value: 'CANCELLED' },
];

const DeletedPoHistory: React.FC = () => {
  const navigate = useNavigate();
  const basePath = usePathBasePrefix();
  const { toast } = useToast();
  const [orders, setOrders] = useState<POResponse[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  // เปิด/ปิด modal ยืนยันการกู้คืนใบสั่งซื้อที่เลือก
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);

  const [statusFilter, setStatusFilter] = useState("DELETED");
  const [searchId, setSearchId] = useState("");
  const now = new Date();
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const deletableOrders = orders.filter(o => o.status === "DELETED");
  const allDeletedSelected = deletableOrders.length > 0 && deletableOrders.every(o => selectedIds.includes(o.id));
  const someDeletedSelected = deletableOrders.some(o => selectedIds.includes(o.id));

  const toggleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (allDeletedSelected) {
      setSelectedIds(prev => prev.filter(id => !deletableOrders.map(o => o.id).includes(id)));
    } else {
      const newIds = deletableOrders.map(o => o.id).filter(id => !selectedIds.includes(id));
      setSelectedIds(prev => [...prev, ...newIds]);
    }
  };

  const fetchOrders = async () => {
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

  useEffect(() => {
    setSelectedIds([]);
    const delay = setTimeout(() => { fetchOrders(); }, searchId ? 400 : 0);
    return () => clearTimeout(delay);
  }, [currentPage, itemsPerPage, statusFilter, searchId, selectedMonth, selectedYear]);

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

  const handleBulkRestore = async () => {
    if (selectedIds.length === 0) return;
    const restoredCount = selectedIds.length;
    setIsRestoring(true);
    try {
      await Promise.all(selectedIds.map(id => poService.restorePurchaseOrder(id)));
      toast({ title: 'ดำเนินการสำเร็จ', message: `กู้คืนสำเร็จ ${restoredCount} รายการ`, variant: 'success' });
      setSelectedIds([]);
      setIsRestoreConfirmOpen(false);
      fetchOrders();
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', message: 'เกิดข้อผิดพลาดในการกู้คืน กรุณาลองใหม่อีกครั้ง', variant: 'error' });
    } finally {
      setIsRestoring(false);
    }
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  return (
    <div className="min-h-screen space-y-6 bg-white p-4 font-sans sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-start">
        <Heading level="h1" weight="semibold" className="m-0 text-black">
          กู้คืนใบสั่งซื้อ
        </Heading>
      </div>

      {statusFilter === "DELETED" && (
        <div className="flex items-start gap-3 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>ใบสั่งซื้อในถังขยะสามารถกู้คืนได้ภายใน 30 วัน หลังจากนั้นระบบจะลบถาวรโดยอัตโนมัติ</span>
        </div>
      )}

      {/* Search Card */}
      <Card className="flex-1">
        <CardHeader>
          <CardTitle className="text-base text-black">ค้นหาใบสั่งซื้อด้วย</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="sm:col-span-2 lg:col-span-2">
              <Input
                label="หมายเลขใบสั่งซื้อ"
                placeholder="PO-XXXX-XXXX"
                value={searchId}
                onChange={(e) => { setSearchId(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <Select
              label="สถานะใบสั่งซื้อ"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              options={PO_STATUS_OPTIONS}
            />
            <Select
              label="เดือนที่สั่งซื้อ"
              value={selectedMonth}
              onChange={(e) => { setSelectedMonth(e.target.value); setCurrentPage(1); }}
              options={getThaiMonthOptions()}
            />
            <Select
              label="ปีที่สั่งซื้อ"
              value={selectedYear}
              onChange={(e) => { setSelectedYear(e.target.value); setCurrentPage(1); }}
              options={getYearOptions(availableYears)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden" noPadding>
        <Table>
          <TableHeader className="bg-[#f6f3f2] text-[#797878]">
            <TableRow>
              <TableHead className="pl-6 w-14">
                {statusFilter === "DELETED" && (
                  <input
                    type="checkbox"
                    checked={allDeletedSelected}
                    ref={el => { if (el) el.indeterminate = someDeletedSelected && !allDeletedSelected; }}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 accent-[#d61c24] cursor-pointer"
                  />
                )}
              </TableHead>
              <TableHead>เลขที่ใบสั่งซื้อ</TableHead>
              <TableHead>วันที่สร้าง</TableHead>
              <TableHead>วันที่ลบ/ยกเลิก</TableHead>
              <TableHead>ผู้สร้าง</TableHead>
              <TableHead className="text-center">รวมรายการ</TableHead>
              <TableHead className="text-center">จำนวนชิ้น</TableHead>
              <TableHead className="text-right">ราคารวม</TableHead>
              <TableHead className="text-center pr-6 w-24">จัดการ</TableHead>
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
                const totalItemTypes = po.po_items?.length || 0;
                const totalQuantity = po.po_items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0;
                const isSelected = selectedIds.includes(po.id);
                const isDeletedRow = po.status === "DELETED";

                return (
                  <TableRow
                    key={po.id}
                    className={cn("hover:bg-gray-50/70", isSelected && "bg-red-50/40")}
                  >
                    <TableCell className="pl-6">
                      {isDeletedRow && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(po.id)}
                          className="w-4 h-4 accent-[#d61c24] cursor-pointer"
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-gray-900 font-medium">{po.po_number}</TableCell>
                    <TableCell className="text-black">{formatDateThai(po.created_at)}</TableCell>
                    <TableCell className="text-black">{formatDateThai(po.updated_at) || "-"}</TableCell>
                    <TableCell className="text-black">{po.creator_name || "ไม่ระบุ"}</TableCell>
                    <TableCell className="text-center text-black">{totalItemTypes}</TableCell>
                    <TableCell className="text-center text-black">{totalQuantity}</TableCell>
                    <TableCell className="text-right text-black">
                      ฿{Number(po.total_amount).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-center pr-6">
                      <div className="flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => navigate(`${basePath}/orders/${po.id}`)}
                          className="text-gray-600 hover:text-gray-900 transition cursor-pointer p-1.5 rounded-none hover:bg-gray-200/60"
                          title="ดูรายละเอียดใบสั่งซื้อ"
                        >
                          <Eye size={16} />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-gray-400">
                  <ReceiptText size={40} strokeWidth={0.7} className='mx-auto'/>
                  <br />ไม่พบข้อมูลใบสั่งซื้อ
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {!isLoading && !error && totalItems > 0 && (
          <div className="flex flex-col gap-3 border-t border-gray-100 bg-[#fcfbfa] px-4 py-4 text-xs text-gray-500 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
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
            <div className="flex max-w-full items-center gap-1 overflow-x-auto pb-1 lg:pb-0">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(1)} aria-label="หน้าแรก"
                className="p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">
                <ChevronsLeft size={16} />
              </button>
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} aria-label="หน้าก่อนหน้า"
                className="p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">
                <ChevronLeft size={16} />
              </button>
              {getPageNumbers(currentPage, totalPages).map((page, idx) =>
                page === "..." ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
                ) : (
                  <button key={page} onClick={() => setCurrentPage(page)}
                    aria-current={currentPage === page ? "page" : undefined}
                    className={cn(
                      "px-3 py-1.5 rounded-none font-medium transition-colors cursor-pointer",
                      currentPage === page ? "bg-[#d61c24] text-white" : "text-gray-600 hover:bg-gray-100"
                    )}>
                    {page}
                  </button>
                )
              )}
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} aria-label="หน้าถัดไป"
                className="p-1.5 rounded-none text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">
                <ChevronRight size={16} />
              </button>
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)} aria-label="หน้าสุดท้าย"
                className="p-1.5 rounded-none text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Bottom Action */}
      <div className="flex justify-stretch sm:justify-end [&>button]:w-full sm:[&>button]:w-auto">
        <Button
          variant="primary"
          onClick={() => setIsRestoreConfirmOpen(true)}
          disabled={selectedIds.length === 0 || isRestoring}
        >
          <RotateCcw size={16} />
          กู้คืนใบสั่งซื้อที่เลือก {selectedIds.length > 0 && `(${selectedIds.length})`}
        </Button>
      </div>

      <ConfirmDialog
        isOpen={isRestoreConfirmOpen}
        onClose={() => setIsRestoreConfirmOpen(false)}
        onConfirm={handleBulkRestore}
        title="ยืนยันการกู้คืนใบสั่งซื้อ"
        description={`คุณต้องการกู้คืนใบสั่งซื้อที่เลือก ${selectedIds.length} รายการใช่หรือไม่?`}
        confirmText="กู้คืน"
        variant="info"
        isSubmitting={isRestoring}
      />
    </div>
  );
};

export default DeletedPoHistory;
