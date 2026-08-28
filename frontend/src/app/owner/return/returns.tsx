import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ClockAlert, CirclePlus, Search, ReceiptText, Loader2, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Eye, CircleCheck, Banknote } from 'lucide-react';
// Components
import Heading from '../../../components/elements/heading';
import { Card } from '../../../components/elements/card';
import Input from '../../../components/elements/input';
import Select, { type SelectOption } from '../../../components/elements/select';
import Button from '../../../components/elements/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/elements/table';
// Interface
import type { ReturnListItem, ReturnStatusCount } from '../../../interface/return/return_interface';
// Service & Utils
import { returnService } from '../../../service/http/return/return_service';
import { usePathBasePrefix } from '../../../utils/usePathBasePrefix';
import { cn } from '../../../utils/component';
import { formatDateThai } from '../../../utils/formatdate';
import Badge from '../../../components/elements/badge';
import { useToast } from '../../../components/elements/toast';
import Modal from '../../../components/elements/modal';

/** สถานะของรายการคืนสินค้า ใช้ทั้งเป็นค่ากรองในตารางและ badge สถานะ */
type ReturnStatus = 'PENDING' | 'APPROVED' | 'REFUNDED' | 'REJECTED';

const STATUS_FILTER: SelectOption[] = [
  { label: 'ทั้งหมด', value: 'ALL' },
  { label: 'รอดำเนินการ', value: 'PENDING' },
  { label: 'อนุมัติแล้ว', value: 'APPROVED' },
  { label: 'คืนเงินจริงแล้ว', value: 'REFUNDED' },
  { label: 'ปฏิเสธ', value: 'REJECTED' },
];

function StatusBadge({ status }: { status: string }) {
  if (status === "PENDING")
    return <Badge variant="outline" className="bg-yellow-100 border-none text-yellow-700">รอดำเนินการ</Badge>;
  if (status === "APPROVED")
    return <Badge variant="success">อนุมัติแล้ว</Badge>;
  if (status === "REFUNDED")
    return <Badge variant="success" className="bg-blue-100 text-blue-700">คืนเงินจริงแล้ว</Badge>;
  if (status === "REJECTED")
    return <Badge variant="destructive">ปฏิเสธ</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

const PAGE_SIZE = 10;

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '...', current - 1, current, current + 1, '...', total];
}

const ReturnsPage: React.FC = () => {
  const navigate = useNavigate();
  const basePath = usePathBasePrefix();
  const { toast } = useToast();
  const userRole = (localStorage.getItem('role') || '').toUpperCase();
  const canApprove = userRole === 'OWNER';

  // Search bar
  const searchRef = useRef<HTMLDivElement>(null);
  const [returnSearch, setReturnSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Filter dropdown & Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ReturnStatus | 'ALL' | ''>('');

  // Tab & Tracking state
  const [activeTab, setActiveTab] = useState<'return' | 'tracking' | 'refunding'>('return');

  // Backend data state
  const [returnsList, setReturnsList] = useState<ReturnListItem[]>([]);
  const [statusCounts, setStatusCounts] = useState<ReturnStatusCount[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [processingRefundId, setProcessingRefundId] = useState<number | null>(null);
  const [refundTarget, setRefundTarget] = useState<ReturnListItem | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(returnSearch.trim());
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [returnSearch]);

  // Fetch real data from backend
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const effectiveStatus =
        activeTab === 'tracking' ? 'PENDING' : statusFilter === 'ALL' ? '' : statusFilter;

      const res = await returnService.getReturns({
        status: effectiveStatus || undefined,
        search: debouncedSearch || undefined,
        page: currentPage,
        page_size: 10,
      });

      setReturnsList(res.data ?? []);
      setStatusCounts(res.status_counts ?? []);
      setTotalCount(res.total_count ?? 0);
    } catch (err) {
      console.error('Failed to fetch returns data:', err);
      setReturnsList([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, statusFilter, debouncedSearch, currentPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async (id: number) => {
    if (!canApprove || approvingId !== null) return;

    setApprovingId(id);
    try {
      await returnService.updateSalesReturn(id, { status: 'APPROVED' });
      toast({
        title: 'อนุมัติสำเร็จ',
        message: 'อนุมัติรายการคืนสินค้าเรียบร้อยแล้ว',
        variant: 'success',
      });
      await fetchData();
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.response?.data?.message || 'ไม่สามารถอนุมัติรายการคืนสินค้าได้';
      toast({
        title: 'เกิดข้อผิดพลาด',
        message,
        variant: 'error',
      });
    } finally {
      setApprovingId(null);
    }
  };

  const handleProcessRefund = async (id: number) => {
    if (processingRefundId !== null) return;

    setProcessingRefundId(id);
    try {
      await returnService.processRefund(id);
      toast({
        title: 'คืนเงินสำเร็จ',
        message: 'สร้างรายการคืนเงินและอัปเดตยอดสุทธิเรียบร้อยแล้ว',
        variant: 'success',
      });
      await fetchData();
    } catch (err: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        message: err?.response?.data?.error || err?.response?.data?.message || 'ไม่สามารถดำเนินการคืนเงินจริงได้',
        variant: 'error',
      });
    } finally {
      setProcessingRefundId(null);
    }
  };

  // Status Counts
  const pendingCount =
    statusCounts.find((s) => s.status === 'PENDING')?.count ?? 0;
  const approvedCount =
    statusCounts.find((s) => s.status === 'APPROVED')?.count ?? 0;
  const refundingCount = approvedCount;
  const refundedCount =
    statusCounts.find((s) => s.status === 'REFUNDED')?.count ?? 0;
  const rejectedCount =
    statusCounts.find((s) => s.status === 'REJECTED')?.count ?? 0;
  const allCount =
    statusCounts.reduce((acc, curr) => acc + curr.count, 0) || totalCount;

  return (
    <div className="p-8 space-y-6 bg-white min-h-screen font-sans">
      {/* 1. Header */}
      <div className="flex items-center justify-between">
        <Heading level="h1" weight="semibold" className="m-0 text-black">
          จัดการคืนสินค้า
        </Heading>
        <Button
          leftIcon={<CirclePlus size={20} />}
          size="md"
          onClick={() => navigate(`${basePath}/returns/new-return`)}
        >
          สร้างรายการใหม่
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
          <Card className="bg-[#1C1B1B] border-none text-white p-5 col-span-1 relative overflow-hidden flex flex-col justify-between">
            <Heading
              level="h6"
              className="text-xs text-gray-400 font-normal uppercase tracking-wider"
            >
              รายการทั้งหมด
            </Heading>
            <Heading level="h2" className="font-bold text-white">
              {allCount}
            </Heading>
            <Heading level="p" className="text-slate-400">
              รายการ
            </Heading>
          </Card>
          <Card className="border-l-[5px] border-l-black flex flex-col justify-between p-5">
            <Heading level="h6">รออนุมัติ</Heading>
            <Heading level="h2" className="font-bold text-black">
              {pendingCount}
            </Heading>
            <Heading level="p">รายการ</Heading>
          </Card>
          <Card className="border-l-[5px] border-l-emerald-500 flex flex-col justify-between p-5">
            <Heading level="h6">อนุมัติแล้ว</Heading>
            <Heading level="h2" className="font-bold text-black">
              {approvedCount}
            </Heading>
            <Heading level="p">รายการ</Heading>
          </Card>
          <Card className="border-l-[5px] border-l-sky-700 flex flex-col justify-between p-5">
            <Heading level="h6">คืนเงินจริงแล้ว</Heading>
            <Heading level="h2" className="font-bold text-black">
              {refundedCount}
            </Heading>
            <Heading level="p">รายการ</Heading>
          </Card>
          <Card className="border-l-[5px] border-l-red-600 flex flex-col justify-between p-5">
            <Heading level="h6">ปฏิเสธ</Heading>
            <Heading level="h2" className="font-bold text-black">
              {rejectedCount}
            </Heading>
            <Heading level="p">รายการ</Heading>
          </Card>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="p-3.5 flex flex-col md:flex-row gap-3 items-center justify-between shadow-sm">
        <div className="flex flex-1 items-center gap-3 w-full">
          {/* ช่องค้นหา */}
          <div ref={searchRef} className="relative flex-1 min-w-60">
            <Input
              type="text"
              placeholder="ค้นหาด้วยเลขที่รายการ, ชื่อลูกค้า, สินค้า..."
              value={returnSearch}
              onChange={(e) => setReturnSearch(e.target.value)}
              leftIcon={<Search size={16} className="text-gray-400" />}
              className="text-sm h-10 w-full"
            />
          </div>
          <div className="w-full md:w-64">
            <Select
              placeholder="สถานะรายการคืน"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as ReturnStatus | 'ALL' | '');
                setCurrentPage(1);
              }}
              options={STATUS_FILTER}
            />
          </div>
        </div>
      </div>

      <div className="gap-0">
        {/* 3. Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-3 pt-2 shadow-xs">
          <button
            type="button"
            onClick={() => {
              setActiveTab('return');
              setStatusFilter('');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-normal border-b-2 transition-all cursor-pointer ${
              activeTab === 'return'
                ? 'border-[#e51c23] text-[#e51c23]'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <FileText size={16} /> รายการคืนสินค้าทั้งหมด
            <span
              className={`px-2 py-0.5 text-sm rounded-full ${
                activeTab === 'return'
                  ? 'bg-red-600 text-white font-normal'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {allCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('tracking');
              setStatusFilter('PENDING');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-normal border-b-2 transition-all cursor-pointer ${
              activeTab === 'tracking'
                ? 'border-[#e51c23] text-[#e51c23]'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <ClockAlert size={16} /> รายการคืนสินค้าค้างในระบบ
            <span
              className={`px-2 py-0.5 text-sm rounded-full ${
                activeTab === 'tracking'
                  ? 'bg-red-600 text-white font-normal'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {pendingCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('refunding');
              setStatusFilter('APPROVED');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-normal border-b-2 transition-all cursor-pointer ${
              activeTab === 'refunding'
                ? 'border-[#e51c23] text-[#e51c23]'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <ClockAlert size={16} /> รายการคืนเงินค้างในระบบ
            <span
              className={`px-2 py-0.5 text-sm rounded-full ${
                activeTab === 'refunding'
                  ? 'bg-red-600 text-white font-normal'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {refundingCount}
            </span>
          </button>
        </div>

        {/* 4. Table */}
        <Table>
          <TableHeader className='bg-[#F6F3F2] text-[#797878]'>
            <TableRow>
              <TableHead className='pl-6'>เลขที่รายการ</TableHead>
              <TableHead className='text-center'>วันคืนสินค้า</TableHead>
              <TableHead className='text-left'>สาเหตุการคืนสินค้า</TableHead>
              <TableHead className='text-center'>ช่องทางการคืนเงิน</TableHead>
              <TableHead className='text-right'>ยอดเงินคืนสุทธิ</TableHead>
              <TableHead className='text-center'>สถานะ</TableHead>
              <TableHead className='text-center'>จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className='text-black'>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className='text-center py-12 text-gray-400'>
                  <Loader2 size={32} className='animate-spin mx-auto' />
                </TableCell>
              </TableRow>
            ) : returnsList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className='text-center py-12 text-gray-400'>
                  <ReceiptText size={40} strokeWidth={0.7} className='mx-auto' /> <br />
                  ยังไม่มีรายการคืนสินค้า
                </TableCell>
              </TableRow>
            ) : (
              returnsList.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className='pl-6 text-left'>{item.return_number}</TableCell>
                  <TableCell className='text-center'>{formatDateThai(item.requested_at)}</TableCell>
                  <TableCell className="text-left max-w-75">
                    <span className="block truncate" title={item.reason}>
                      {item.reason}
                    </span>
                  </TableCell>
                  <TableCell className='text-center'>{item.refund_method}</TableCell>
                  <TableCell className='text-right'>฿ {item.refund_amount.toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2,})}</TableCell>
                  <TableCell className='text-center'><StatusBadge status={item.status} /></TableCell>
                  <TableCell className='text-center'>
                    <div className='flex items-center justify-center gap-2'>
                      {canApprove && item.status === 'PENDING' && (
                        <button
                          type="button"
                          title="อนุมัติรายการคืนสินค้า"
                          aria-label="อนุมัติรายการคืนสินค้า"
                          disabled={approvingId !== null}
                          onClick={() => handleApprove(item.id)}
                          className='text-emerald-600 cursor-pointer hover:text-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed'
                        >
                          {approvingId === item.id ? <Loader2 size={16} className='animate-spin' /> : <CircleCheck size={16} />}
                        </button>
                      )}
                      {(userRole === 'OWNER' || userRole === 'EMPLOYEE' || userRole === 'ADMIN') && item.status === 'APPROVED' && (
                        <button
                          type="button"
                          title="ดำเนินการคืนเงินจริง"
                          aria-label="ดำเนินการคืนเงินจริง"
                          disabled={processingRefundId !== null}
                          onClick={() => setRefundTarget(item)}
                          className='text-sky-600 cursor-pointer hover:text-sky-700 disabled:opacity-40 disabled:cursor-not-allowed'
                        >
                          {processingRefundId === item.id ? <Loader2 size={16} className='animate-spin' /> : <Banknote size={16} />}
                        </button>
                      )}
                      <button
                        type="button"
                        title="ดูรายละเอียด"
                        aria-label="ดูรายละเอียด"
                        onClick={() => navigate(`${basePath}/returns/${item.id}`)}
                        className='text-gray-600 cursor-pointer hover:text-gray-900'
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {(() => {
          const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
          return (
            <div className='bg-[#fcfbfa] px-6 py-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500'>
              <span>
                แสดง {totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} ถึง{' '}
                {Math.min(currentPage * PAGE_SIZE, totalCount)} จาก {totalCount} รายการ
              </span>
              <div className='flex items-center gap-1'>
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(1)} className='p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed'><ChevronsLeft size={16} /></button>
                <button disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)} className='p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed'><ChevronLeft size={16} /></button>
                {getPageNumbers(currentPage, totalPages).map((p, idx) =>
                  p === '...' ? <span key={`e-${idx}`} className='px-2 text-gray-400'>...</span>
                  : <button key={p} onClick={() => setCurrentPage(p as number)} className={cn('px-3 py-1.5 rounded-none font-medium transition-colors cursor-pointer', currentPage === p ? 'bg-[#d61c24] text-white' : 'text-gray-600 hover:bg-gray-100')}>{p}</button>
                )}
                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)} className='p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed'><ChevronRight size={16} /></button>
                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)} className='p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed'><ChevronsRight size={16} /></button>
              </div>
            </div>
          );
        })()}
      </div>
      <Modal
        isOpen={refundTarget !== null}
        onClose={() => processingRefundId === null && setRefundTarget(null)}
        title="ยืนยันการคืนเงินจริง"
        description={(
          <div className="space-y-3 text-sm text-slate-700">
            <p>การดำเนินการนี้จะสร้างรายการ Payment และเพิ่มสินค้าเข้าคลัง</p>
            {refundTarget && (
              <>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">เลขที่ใบคืน</span>
                  <span className="font-semibold text-slate-900">{refundTarget.return_number}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">ยอดเงินคืน</span>
                  <span className="font-semibold text-red-600">
                    ฿ {refundTarget.refund_amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">ช่องทางคืนเงิน</span>
                  <span className="font-medium text-slate-900">{refundTarget.refund_method || '-'}</span>
                </div>
              </>
            )}
          </div>
        )}
        onConfirm={async () => {
          if (!refundTarget) return;
          const id = refundTarget.id;
          setRefundTarget(null);
          await handleProcessRefund(id);
        }}
        confirmText="ยืนยันคืนเงินจริง"
        cancelText="ยกเลิก"
        variant="success"
        isSubmitting={processingRefundId !== null}
      />
    </div>
  );
}

export default ReturnsPage;
