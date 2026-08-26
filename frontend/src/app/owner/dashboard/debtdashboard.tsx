import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FileText, Sheet, Filter as FilterIcon, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, Loader2, AlertCircle, BookUser } from 'lucide-react';
// Components
import Button from '../../../components/elements/button';
import Badge from '../../../components/elements/badge';
import { Card, CardHeader } from '../../../components/elements/card';
import Heading from '../../../components/elements/heading';
import Input from '../../../components/elements/input';
import DateRangePicker from '../../../components/elements/date_range_picker';
import { Table, TableHeader, TableHead, TableBody, TableCell, TableRow } from '../../../components/elements/table';
// Hooks
import { useDebtDashboard } from './hooks/useDebtDashboard';
// Service
import { dashboardService } from '../../../service/http/dashboard/dashboard_service';
// Interface
import type { SummaryQuery, DebtAgingQuery } from '../../../interface/dashboard/dashboard_interface';
// Utils
import { usePathBasePrefix } from '../../../utils/usePathBasePrefix';
import { formatDateThai, getTodayDateString } from '../../../utils/formatdate';
import { exportDebtAgingPdf } from '../../../utils/print';
import { cn } from '../../../utils/component';

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '...', current - 1, current, current + 1, '...', total];
}

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'เกินกำหนด':
      return 'destructive';
    case 'ชำระหมดแล้ว':
      return 'success';
    default:
      return 'cash';
  }
};

const PERIOD_FILTER = [
  { label: 'วันนี้',     value: 'daily' },
  { label: 'สัปดาห์นี้', value: 'weekly' },
  { label: 'เดือนนี้',   value: 'monthly' },
  { label: 'ไตรมาสนี้', value: 'quarterly' },
  { label: 'ปีนี้',      value: 'yearly' },
];

const PAGE_FILTER = [
  { label: 'ภาพรวม',      value: 'maindashboard' },
  { label: 'สรุปยอดขาย', value: 'salesdashboard' },
  { label: 'สรุปยอดหนี้', value: 'debtdashboard' },
];

const STATUS_FILTER = [
  { label: 'ทั้งหมด', value: '' },
  { label: 'เกินกำหนด', value: 'เกินกำหนด' },
  { label: 'ทยอยชำระ',  value: 'ทยอยชำระ' },
  { label: 'ชำระหมดแล้ว', value: 'ชำระหมดแล้ว' }
];

const AGING_BUCKET_FILTER = [
  { label: 'ทั้งหมด',   value: '' },
  { label: '0-30 วัน',  value: '0-30' },
  { label: '31-60 วัน', value: '31-60' },
  { label: '61-90 วัน', value: '61-90' },
  { label: '>90 วัน',   value: '90+' },
];

const PAGE_SIZE = 25;

const fmt = (n: number) =>
  n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });


const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const DebtDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = usePathBasePrefix();

  // Period filter (กระทบ KPI summary)
  const [selectedFilter, setSelectedFilter] = useState('daily');
  const [customDate, setCustomDate] = useState('');

  // Aging table filter
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Filter dropdown
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterPos, setFilterPos] = useState({ top: 0, right: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [agingBucket, setAgingBucket] = useState('');
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Export loading
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const summaryQuery = useMemo<SummaryQuery>(() => {
    if (customDate) return { summary_date: customDate };
    switch (selectedFilter) {
      case 'weekly': return { weekly_summary: '1' };
      case 'monthly': return { monthly_summary: '1' };
      case 'quarterly': return { quarterly_summary: '1' };
      case 'yearly': return { yearly_summary: '1' };
      default: return { summary_date: getTodayDateString() };
    }
  }, [selectedFilter, customDate]);

  const agingBucketParams = useMemo(() => {
    switch (agingBucket) {
      case '0-30':   return { max_age_days: 30 };
      case '31-60':  return { min_age_days: 31, max_age_days: 60 };
      case '61-90':  return { min_age_days: 61, max_age_days: 90 };
      case '90+':    return { min_age_days: 91 };
      default:       return {};
    }
  }, [agingBucket]);

  const agingQuery = useMemo<DebtAgingQuery>(() => ({
    ...(startDate && { start_date: startDate }),
    ...(endDate && { end_date: endDate }),
    ...(statusFilter && { status: statusFilter }),
    ...agingBucketParams,
    page: currentPage,
    page_size: PAGE_SIZE,
  }), [startDate, endDate, statusFilter, agingBucketParams, currentPage]);

  const {
    kpi, yearlyCollected, yearlyOutstanding, yearlyCollectedLoading, totalDebtors,
    summaryLoading, summaryError,
    agingData, agingTotal, agingLoading, agingError,
  } = useDebtDashboard(summaryQuery, agingQuery);

  const totalPages = Math.max(1, Math.ceil(agingTotal / PAGE_SIZE));

  const handlePeriodClick = (value: string) => {
    setSelectedFilter(value);
    setCustomDate('');
  };

  const handleCustomDate = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomDate(e.target.value);
    setSelectedFilter(e.target.value ? '' : 'daily');
  };

  const exportQuery: DebtAgingQuery = {
    ...(startDate && { start_date: startDate }),
    ...(endDate && { end_date: endDate }),
    ...(statusFilter && { status: statusFilter }),
    ...agingBucketParams,
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const res = await dashboardService.getDebtAging({ ...exportQuery, page: 1, page_size: 9999 });
      const dateLabel = startDate && endDate
        ? `${formatDateThai(startDate)} – ${formatDateThai(endDate)}`
        : 'ทั้งหมด';
      exportDebtAgingPdf(res.data.data ?? [], dateLabel);
    } catch { /* silently ignore */ }
    finally { setExportingPdf(false); }
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const res = await dashboardService.exportDebtAgingExcel(exportQuery);
      triggerDownload(res.data as Blob, `debt-aging-${startDate || 'all'}-${endDate || 'all'}.csv`);
    } catch { /* silently ignore */ }
    finally { setExportingExcel(false); }
  };

  const kpiVal = (v: React.ReactNode) =>
    summaryLoading ? <span className='text-gray-400 animate-pulse'>...</span> : v;

  return (
    <div className='p-8 space-y-8 bg-white min-h-screen font-sans'>
      {/* Page tab */}
      <div>
        <div className='bg-[#F6F3F2] inline-flex items-center p-1'>
          {PAGE_FILTER.map((tab) => {
            const isActive = location.pathname.includes(tab.value);
            return (
              <button key={tab.value}
                onClick={() => navigate(`${basePath}/dashboard/${tab.value}`)}
                className={`w-32 py-1 flex items-center justify-center text-sm transition ${
                  isActive ? 'bg-white text-red-500 shadow-sm' : 'text-gray-600 hover:text-red-500'
                }`}>
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Header + Period filter */}
      <div className='flex items-end justify-between'>
        <div>
          <Heading level='h1' weight='semibold' className='m-0 text-black'>
            กระดานสรุปยอดหนี้
          </Heading>
          <Heading level='h6' className='m-0 mt-1 text-gray-500'>
            ติดตามความเคลื่อนไหวของยอดหนี้ลูกค้าผ่านแดชบอร์ดเดียว
          </Heading>
        </div>
        <div className='bg-[#F6F3F2] flex items-center p-1'>
          {PERIOD_FILTER.map((f) => (
            <button key={f.value} onClick={() => handlePeriodClick(f.value)}
              className={`w-20 py-2.5 text-sm transition ${
                selectedFilter === f.value
                  ? 'bg-white text-red-500 shadow-sm'
                  : 'text-gray-500 hover:text-red-500'
              }`}>
              {f.label}
            </button>
          ))}
          <div className='min-w-32'>
            <Input type='date' value={customDate} onChange={handleCustomDate}
              className={`transition-all ${customDate
                ? 'bg-white text-red-500 border border-red-500 shadow-sm'
                : 'bg-transparent text-gray-600 border-transparent'}`}
            />
          </div>
        </div>
      </div>

      {summaryError && (
        <div className='flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600'>
          <AlertCircle size={16} /> {summaryError}
        </div>
      )}

      {/* KPI Cards */}
      <div className='grid grid-cols-4 gap-6 items-stretch'>
        {/* ลูกหนี้ทั้งหมด */}
        <Card className='border-l-[5px] border-l-gray-300 flex flex-col justify-center p-5'>
          <Heading level='h6' className='text-gray-500'>ลูกหนี้ทั้งหมด</Heading>
          <Heading level='h3'>
            {agingLoading
              ? <span className='text-gray-400 animate-pulse'>...</span>
              : totalDebtors.toLocaleString('th-TH')}
          </Heading>
          <Heading level='p' className='mt-1 invisible' aria-hidden>.</Heading>
        </Card>

        {/* ยอดหนี้ค้างชำระทั้งหมด */}
        <Card className='border-l-[5px] border-l-sky-700 flex flex-col justify-center p-5'>
          <Heading level='h6' className='text-gray-500'>ยอดหนี้ค้างชำระทั้งหมด</Heading>
          <Heading level='h3'>฿ {kpiVal(fmt(kpi.totalOutstanding))}</Heading>
          <Heading level='p' className='mt-1 invisible' aria-hidden>.</Heading>
        </Card>

        {/* รายรับจากการเก็บหนี้ (ปีนี้) */}
        <Card className='border-l-[5px] border-l-emerald-500 flex flex-col justify-center p-5'>
          <Heading level='h6' className='text-gray-500'>รายรับจากการเก็บหนี้ (ปีนี้)</Heading>
          <Heading level='h3'>
            {yearlyCollectedLoading
              ? <span className='text-gray-400 animate-pulse'>...</span>
              : `฿ ${fmt(yearlyCollected)}`}
          </Heading>
          <Heading level='p' className='text-gray-400'>
            {yearlyCollectedLoading ? '...' : `เป้าหมาย: ฿ ${fmt(yearlyOutstanding)}`}
          </Heading>
        </Card>

        {/* ลูกหนี้ค้างชำระเกินกำหนด */}
        <Card className='border-l-[5px] border-l-red-500 flex flex-col justify-center p-5'>
          <Heading level='h6' className='text-gray-500'>ลูกหนี้ค้างชำระเกินกำหนด</Heading>
          <div className='flex items-baseline gap-2'>
            <Heading level='h3' className='text-red-500'>
              {kpiVal(kpi.overdueCount.toLocaleString('th-TH'))}
            </Heading>
            <Heading level='h6' className='text-red-500'>ราย</Heading>
          </div>
          <Heading level='p' className='text-gray-400'>ลูกหนี้ค้างชำระเกิน 30 วัน</Heading>
        </Card>
      </div>

      {/* Debt Aging Table */}
      <Card noPadding>
        <CardHeader className='flex items-center justify-between bg-white px-6 py-4'>
          <div className='flex items-baseline gap-4'>
            <Heading level='h4' weight='bold'>รายงานการวิเคราะห์อายุหนี้</Heading>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={(d) => { setStartDate(d); setCurrentPage(1); }}
              onEndDateChange={(d) => { setEndDate(d); setCurrentPage(1); }}
            />
          </div>
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              className='border border-gray-300 text-black font-normal'
              onClick={handleExportPdf}
              isLoading={exportingPdf}
              leftIcon={<FileText size={15} />}
            >
              ส่งออกเป็น PDF
            </Button>

            <Button
              variant='outline'
              size='sm'
              className='border border-gray-300 text-black font-normal'
              onClick={handleExportExcel}
              isLoading={exportingExcel}
              leftIcon={<Sheet size={15} />}
            >
              ส่งออกเป็น EXCEL
            </Button>

            {/* Filter dropdown */}
            <div className='relative' ref={filterRef}>
              <Button
                variant='secondary'
                size='sm'
                className='font-normal'
                leftIcon={<FilterIcon size={15} />}
                onClick={() => {
                  if (!filterOpen && filterRef.current) {
                    const r = filterRef.current.getBoundingClientRect();
                    setFilterPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
                  }
                  setFilterOpen((o) => !o);
                }}
              >
                ตัวกรอง
                {(statusFilter || agingBucket) && (
                  <span className='ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] leading-none'>
                    {[statusFilter, agingBucket].filter(Boolean).length}
                  </span>
                )}
              </Button>

              {filterOpen && (
                <div
                  style={{ position: 'fixed', top: filterPos.top, right: filterPos.right }}
                  className='z-9999 w-64 bg-white border border-gray-200 shadow-lg p-4 space-y-4'
                >
                  {/* สถานะ */}
                  <div>
                    <Heading level='p'>สถานะ</Heading>
                    <div className='flex flex-wrap gap-1.5 mt-1'>
                      {STATUS_FILTER.map((opt) => (
                        <Button
                          key={opt.value}
                          size='sm'
                          variant={statusFilter === opt.value ? 'solid-red' : 'outline-cancel'}
                          onClick={() => { setStatusFilter(opt.value); setCurrentPage(1); }}
                          className='px-2.5 py-1 h-auto text-xs font-normal'
                        >
                          {opt.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* ช่วงอายุหนี้ */}
                  <div>
                    <Heading level='p'>ช่วงอายุหนี้</Heading>
                    <div className='flex flex-wrap gap-1.5 mt-1'>
                      {AGING_BUCKET_FILTER.map((opt) => (
                        <Button
                          key={opt.value}
                          size='sm'
                          variant={agingBucket === opt.value ? 'solid-red' : 'outline-cancel'}
                          onClick={() => { setAgingBucket(opt.value); setCurrentPage(1); }}
                          className='px-2.5 py-1 h-auto text-xs font-normal'
                        >
                          {opt.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* ล้างตัวกรอง */}
                  {(statusFilter || agingBucket) && (
                    <button
                      onClick={() => { setStatusFilter(''); setAgingBucket(''); setCurrentPage(1); }}
                      className='w-full text-xs text-gray-400 hover:text-red-500 text-left pt-2 border-t border-gray-100 transition'
                    >
                      ล้างตัวกรองทั้งหมด
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        {agingError && (
          <div className='flex items-center gap-2 mx-6 mt-4 mb-2 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600'>
            <AlertCircle size={16} /> {agingError}
          </div>
        )}

        <div className='overflow-hidden'>
        <Table>
          <TableHeader className='bg-[#F6F3F2] text-[#797878]'>
            <TableRow>
              <TableHead className='pl-6'>รหัสลูกค้า</TableHead>
              <TableHead>ชื่อลูกค้า</TableHead>
              <TableHead className='text-right'>ยอดหนี้ทั้งหมด</TableHead>
              <TableHead className='text-right'>ยอดหนี้คงเหลือ</TableHead>
              <TableHead className='text-center'>วันที่ซื้อล่าสุด</TableHead>
              <TableHead className='text-center'>อายุหนี้ (วัน)</TableHead>
              <TableHead className='text-center'>สถานะ</TableHead>
              <TableHead className='text-center'>จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className='text-black'>
            {agingLoading ? (
              <TableRow>
                <TableCell colSpan={8} className='text-center py-16 text-gray-400'>
                  <Loader2 size={32} className='animate-spin mx-auto' />
                </TableCell>
              </TableRow>
            ) : agingData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className='text-center py-16 text-gray-400'>
                  <BookUser size={40} strokeWidth={0.7} className='mx-auto'/> <br />ไม่พบข้อมูลในช่วงวันที่ที่เลือก
                </TableCell>
              </TableRow>
            ) : (
              agingData.map((row) => (
                <TableRow key={row.customer_code}>
                  <TableCell className='pl-6 text-black'>{row.customer_code}</TableCell>
                  <TableCell>{row.customer_name}</TableCell>
                  <TableCell className='text-right'>฿ {fmt(row.total_debt)}</TableCell>
                  <TableCell className='text-right text-red-600'>฿ {fmt(row.remaining_balance)}</TableCell>
                  <TableCell className='text-center'>{formatDateThai(row.last_purchase_date)}</TableCell>
                  <TableCell className='text-center'>{row.age_days}</TableCell>
                  <TableCell className='text-center'>
                    <Badge variant={getStatusVariant(row.status)} size='md' className='rounded-none font-normal'>
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className='text-center'>
                    <Button variant='outline' size='sm' onClick={() => navigate(`${basePath}/pos/sales_history/${row.customer_code}`)}
                      className='border-none hover:bg-transparent hover:text-red-700 hover:underline p-0 h-auto font-light'>ดูรายละเอียด</Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>

        {/* Pagination */}
        <div className='bg-[#fcfbfa] px-6 py-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500'>
          <span>แสดง {agingTotal === 0 ? 0 : Math.min((currentPage - 1) * PAGE_SIZE + 1, agingTotal)} ถึง {Math.min(currentPage * PAGE_SIZE, agingTotal)} จาก {agingTotal.toLocaleString('th-TH')} รายการ</span>
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
      </Card>
    </div>
  );
};

export default DebtDashboard;