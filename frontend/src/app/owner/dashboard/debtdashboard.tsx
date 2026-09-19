import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FileText, Sheet, Filter as FilterIcon, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, ChevronDown, Loader2, AlertCircle, BookUser } from 'lucide-react';
// Components
import Button from '../../../components/elements/button';
import Badge from '../../../components/elements/badge';
import { Card, CardHeader } from '../../../components/elements/card';
import Heading from '../../../components/elements/heading';
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
import { formatDateThai, getDashboardPeriodDateRange, getTodayDateString } from '../../../utils/formatdate';
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

  // Period filter (คุมทั้ง KPI summary และ ตารางวิเคราะห์อายุหนี้)
  const [selectedFilter, setSelectedFilter] = useState('daily');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Filter dropdown
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterPos, setFilterPos] = useState<{ top?: number; bottom?: number; right?: number }>({ top: 0, right: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [agingBucket, setAgingBucket] = useState('');
  const [customMinAgeDays, setCustomMinAgeDays] = useState<number | null>(null);
  const [customMinAgeInput, setCustomMinAgeInput] = useState('');
  const filterRef = useRef<HTMLDivElement>(null);

  // Overdue Card (Card 4) state
  const [overdueDays, setOverdueDays] = useState<number>(30);
  const [overdueCount, setOverdueCount] = useState<number>(0);
  const [overdueCountLoading, setOverdueCountLoading] = useState(false);
  const [cardOverdueOpen, setCardOverdueOpen] = useState(false);
  const [customOverdueInput, setCustomOverdueInput] = useState('30');
  const cardOverdueRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleCardClickOutside = (e: MouseEvent) => {
      if (cardOverdueRef.current && !cardOverdueRef.current.contains(e.target as Node)) {
        setCardOverdueOpen(false);
      }
    };
    document.addEventListener('mousedown', handleCardClickOutside);
    return () => document.removeEventListener('mousedown', handleCardClickOutside);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchOverdueCount = async () => {
      setOverdueCountLoading(true);
      try {
        const res = await dashboardService.getDebtAging({
          min_age_days: overdueDays,
          page: 1,
          page_size: 1,
        });
        if (isMounted) {
          setOverdueCount(res.data.total ?? 0);
        }
      } catch {
        if (isMounted) {
          setOverdueCount(0);
        }
      } finally {
        if (isMounted) {
          setOverdueCountLoading(false);
        }
      }
    };
    fetchOverdueCount();
    return () => {
      isMounted = false;
    };
  }, [overdueDays]);

  // Export loading
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const summaryQuery = useMemo<SummaryQuery>(() => {
    if (startDate && endDate) {
      if (startDate === endDate) {
        return { summary_date: startDate };
      }
      return { start_date: startDate, end_date: endDate };
    }
    if (startDate) return { summary_date: startDate };
    switch (selectedFilter) {
      case 'daily':  return { summary_date: getTodayDateString() };
      case 'weekly': return { weekly_summary: '1' };
      case 'monthly': return { monthly_summary: '1' };
      case 'quarterly': return { quarterly_summary: '1' };
      case 'yearly': return { yearly_summary: '1' };
      default: return { summary_date: getTodayDateString() };
    }
  }, [selectedFilter, startDate, endDate]);

  const agingBucketParams = useMemo(() => {
    if (customMinAgeDays !== null && customMinAgeDays > 0) {
      return { min_age_days: customMinAgeDays };
    }
    switch (agingBucket) {
      case '0-30':   return { max_age_days: 30 };
      case '31-60':  return { min_age_days: 31, max_age_days: 60 };
      case '61-90':  return { min_age_days: 61, max_age_days: 90 };
      case '90+':    return { min_age_days: 91 };
      default:       return {};
    }
  }, [agingBucket, customMinAgeDays]);

  const debtDateRange = useMemo(() => {
    if (startDate) {
      return {
        start_date: startDate,
        end_date: endDate || startDate,
      };
    }
    const period = getDashboardPeriodDateRange(selectedFilter);
    return {
      start_date: period.startDate,
      end_date: period.endDate,
    };
  }, [selectedFilter, startDate, endDate]);

  const agingQuery = useMemo<DebtAgingQuery>(() => ({
    ...debtDateRange,
    ...(statusFilter && { status: statusFilter }),
    ...agingBucketParams,
    page: currentPage,
    page_size: PAGE_SIZE,
  }), [debtDateRange, statusFilter, agingBucketParams, currentPage]);

  const {
    kpi, currentOutstanding, currentOutstandingLoading, totalDebtors,
    summaryLoading, summaryError,
    agingData, agingTotal, agingLoading, agingError,
  } = useDebtDashboard(summaryQuery, agingQuery);

  const totalPages = Math.max(1, Math.ceil(agingTotal / PAGE_SIZE));

  const handlePeriodClick = (value: string) => {
    setSelectedFilter(value);
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const handleStartDateChange = (d: string) => {
    setStartDate(d);
    setSelectedFilter('');
    setCurrentPage(1);
  };

  const handleEndDateChange = (d: string) => {
    setEndDate(d);
    setSelectedFilter('');
    setCurrentPage(1);
  };

  const exportQuery = useMemo<DebtAgingQuery>(() => ({
    ...debtDateRange,
    ...(statusFilter && { status: statusFilter }),
    ...agingBucketParams,
  }), [debtDateRange, statusFilter, agingBucketParams]);

  const exportDateLabel = useMemo(() => {
    const from = formatDateThai(debtDateRange.start_date, '-');
    const to = formatDateThai(debtDateRange.end_date, '-');
    return debtDateRange.start_date === debtDateRange.end_date ? from : `${from} – ${to}`;
  }, [debtDateRange]);

  const exportDateSlug = useMemo(() => {
    const from = formatDateThai(debtDateRange.start_date, '-');
    const to = formatDateThai(debtDateRange.end_date, '-');
    return debtDateRange.start_date === debtDateRange.end_date ? from : `${from}_to_${to}`;
  }, [debtDateRange]);

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const res = await dashboardService.getAllDebtAging(exportQuery);
      await exportDebtAgingPdf(
        res.data.data ?? [],
        exportDateLabel,
        `debt-aging-${exportDateSlug}.pdf`,
      );
    } catch { /* silently ignore */ }
    finally { setExportingPdf(false); }
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const res = await dashboardService.exportDebtAgingExcel(exportQuery);
      triggerDownload(res.data as Blob, `debt-aging-${exportDateSlug}.csv`);
    } catch { /* silently ignore */ }
    finally { setExportingExcel(false); }
  };

  const kpiVal = (v: React.ReactNode) =>
    summaryLoading ? <span className='text-gray-400 animate-pulse'>...</span> : v;

  return (
    <div className='min-h-screen space-y-6 bg-white p-4 font-sans sm:p-6 lg:space-y-8 lg:p-8'>
      {/* Page tab */}
      <div className='overflow-x-auto pb-1'>
        <div className='inline-flex min-w-max items-center bg-[#F6F3F2] p-1'>
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
      <div className='relative z-20 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between'>
        <div>
          <Heading level='h1' weight='semibold' className='m-0 text-black'>
            กระดานสรุปยอดหนี้
          </Heading>
          <Heading level='h6' className='m-0 mt-1 text-gray-500'>
            ติดตามความเคลื่อนไหวของยอดหนี้ลูกค้าผ่านแดชบอร์ดเดียว
          </Heading>
        </div>
        <div className='flex max-w-full items-center overflow-visible bg-[#F6F3F2] p-1'>
          {PERIOD_FILTER.map((f) => (
            <button key={f.value} onClick={() => handlePeriodClick(f.value)}
              className={`w-20 py-2.5 text-sm transition cursor-pointer ${
                selectedFilter === f.value
                  ? 'bg-white text-red-500 shadow-sm font-medium'
                  : 'text-gray-500 hover:text-red-500'
              }`}>
              {f.label}
            </button>
          ))}
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={handleStartDateChange}
            onEndDateChange={handleEndDateChange}
          />
        </div>
      </div>

      {summaryError && (
        <div className='flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600'>
          <AlertCircle size={16} /> {summaryError}
        </div>
      )}

      {/* KPI Cards */}
      <div className='grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-6'>
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
          <Heading level='h3'>
            {currentOutstandingLoading
              ? <span className='text-gray-400 animate-pulse'>...</span>
              : `฿ ${fmt(currentOutstanding)}`}
          </Heading>
          <Heading level='p' className='mt-1 invisible' aria-hidden>.</Heading>
        </Card>

        {/* รายรับจากการเก็บหนี้ตามช่วงเวลาที่เลือก */}
        <Card className='border-l-[5px] border-l-emerald-500 flex flex-col justify-center p-5'>
          <Heading level='h6' className='text-gray-500'>รายรับจากการเก็บหนี้</Heading>
          <Heading level='h3'>
            {kpiVal(`฿ ${fmt(kpi.collectedAmount)}`)}
          </Heading>
          <Heading level='p' className='text-gray-400'>
            {currentOutstandingLoading ? '...' : `เป้าหมาย: ฿ ${fmt(currentOutstanding)}`}
          </Heading>
        </Card>

        {/* ลูกหนี้ค้างชำระเกินกำหนด */}
        <Card className='border-l-[5px] border-l-red-500 flex flex-col justify-between p-5 relative overflow-visible'>
          <div className='flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center'>
            <Heading level='h6' className='text-gray-500 font-medium'>ลูกหนี้ค้างชำระ</Heading>

            {/* Day Selector Button on Card with exact same secondary button variant */}
            <div className='relative' ref={cardOverdueRef}>
              <Button
                variant='solid-red'
                size='sm'
                className='font-normal'
                onClick={() => setCardOverdueOpen((o) => !o)}
              >
                &gt; {overdueDays} วัน
                <ChevronDown size={13} className={cn('ml-1 transition-transform duration-200', cardOverdueOpen && 'rotate-180')} />
              </Button>

              {cardOverdueOpen && (
                <div className='absolute right-0 top-full mt-1 z-50 w-64 bg-white border border-gray-200 shadow-lg p-4 space-y-4'>
                  <div>
                    <Heading level='p'>เลือกจำนวนวันค้างชำระ</Heading>
                    <div className='flex flex-wrap gap-1.5 mt-1'>
                      {[15, 30, 45, 60, 90, 120].map((d) => (
                        <Button
                          key={d}
                          size='sm'
                          variant={overdueDays === d ? 'solid-red' : 'outline-cancel'}
                          onClick={() => {
                            setOverdueDays(d);
                            setCustomOverdueInput(String(d));
                            setCardOverdueOpen(false);
                          }}
                          className='px-2.5 py-1 h-auto text-xs font-normal'
                        >
                          &gt; {d} วัน
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className='pt-2 border-t border-gray-100'>
                    <Heading level='p'>หรือระบุอายุหนี้เกิน (วัน)</Heading>
                    <div className='flex items-center gap-2 mt-1.5'>
                      <input
                        type='number'
                        min={1}
                        placeholder='เช่น 45'
                        value={customOverdueInput}
                        onChange={(e) => setCustomOverdueInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = parseInt(customOverdueInput, 10);
                            if (!isNaN(val) && val > 0) {
                              setOverdueDays(val);
                              setCardOverdueOpen(false);
                            }
                          }
                        }}
                        className='w-full h-8 px-2.5 text-sm border border-gray-300 rounded-none focus:outline-none focus:border-red-500'
                      />
                      <span className='text-xs text-gray-500 shrink-0'>วัน</span>
                      <Button
                        size='sm'
                        variant='solid-red'
                        onClick={() => {
                          const val = parseInt(customOverdueInput, 10);
                          if (!isNaN(val) && val > 0) {
                            setOverdueDays(val);
                            setCardOverdueOpen(false);
                          }
                        }}
                        className='px-3 py-1 h-8 text-xs font-normal shrink-0'
                      >
                        ใช้
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className='flex items-baseline gap-2 my-1'>
            <Heading level='h3' className='text-red-500'>
              {overdueCountLoading
                ? <span className='text-gray-400 animate-pulse'>...</span>
                : overdueCount.toLocaleString('th-TH')}
            </Heading>
            <Heading level='h6' className='text-red-500 font-medium'>ราย</Heading>
          </div>

          <Heading level='p' className='text-gray-400 text-xs m-0'>
            ลูกหนี้ค้างชำระเกิน {overdueDays} วัน
          </Heading>
        </Card>
      </div>

      {/* Debt Aging Table */}
      <Card noPadding>
        <CardHeader className='flex flex-col items-start gap-3 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6'>
          <Heading level='h4' weight='bold' className='m-0'>รายงานการวิเคราะห์อายุหนี้</Heading>
          <div className='flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end'>
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
            <div className='relative flex items-center' ref={filterRef}>
              <Button
                variant='secondary'
                size='sm'
                className='font-normal'
                leftIcon={<FilterIcon size={15} />}
                onClick={() => {
                  if (!filterOpen && filterRef.current) {
                    const r = filterRef.current.getBoundingClientRect();
                    const spaceBelow = window.innerHeight - r.bottom;
                    const POPOVER_HEIGHT = 280;
                    const openUpwards = spaceBelow < POPOVER_HEIGHT && r.top > POPOVER_HEIGHT;
                    setFilterPos({
                      top: openUpwards ? undefined : r.bottom + 4,
                      bottom: openUpwards ? window.innerHeight - r.top + 4 : undefined,
                      right: Math.max(16, window.innerWidth - r.right),
                    });
                  }
                  setFilterOpen((o) => !o);
                }}
              >
                ตัวกรอง
                {(statusFilter || agingBucket || customMinAgeDays !== null) && (
                  <span className='ml-1.5 inline-flex items-center justify-center px-1.5 h-4 rounded-full bg-red-500 text-white text-[10px] leading-none'>
                    {customMinAgeDays !== null
                      ? `>${customMinAgeDays} วัน`
                      : [statusFilter, agingBucket].filter(Boolean).length}
                  </span>
                )}
              </Button>

              {filterOpen && (
                <div
                  style={{
                    position: 'fixed',
                    ...(filterPos.top !== undefined ? { top: filterPos.top } : {}),
                    ...(filterPos.bottom !== undefined ? { bottom: filterPos.bottom } : {}),
                    right: filterPos.right,
                  }}
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
                          variant={agingBucket === opt.value && customMinAgeDays === null ? 'solid-red' : 'outline-cancel'}
                          onClick={() => {
                            setAgingBucket(opt.value);
                            setCustomMinAgeDays(null);
                            setCustomMinAgeInput('');
                            setCurrentPage(1);
                          }}
                          className='px-2.5 py-1 h-auto text-xs font-normal'
                        >
                          {opt.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* หรือระบุจำนวนวันค้างชำระเกินเอง */}
                  <div className='pt-2 border-t border-gray-100'>
                    <Heading level='p'>หรือระบุอายุหนี้เกิน (วัน)</Heading>
                    <div className='flex items-center gap-2 mt-1.5'>
                      <input
                        type='number'
                        min={1}
                        placeholder='เช่น 45'
                        value={customMinAgeInput}
                        onChange={(e) => setCustomMinAgeInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = parseInt(customMinAgeInput, 10);
                            if (!isNaN(val) && val > 0) {
                              setCustomMinAgeDays(val);
                              setAgingBucket('');
                              setCurrentPage(1);
                              setFilterOpen(false);
                            }
                          }
                        }}
                        className='w-full h-8 px-2.5 text-sm border border-gray-300 rounded-none focus:outline-none focus:border-red-500'
                      />
                      <span className='text-xs text-gray-500 shrink-0'>วัน</span>
                      <Button
                        size='sm'
                        variant='solid-red'
                        onClick={() => {
                          const val = parseInt(customMinAgeInput, 10);
                          if (!isNaN(val) && val > 0) {
                            setCustomMinAgeDays(val);
                            setAgingBucket('');
                            setCurrentPage(1);
                            setFilterOpen(false);
                          }
                        }}
                        className='px-3 py-1 h-8 text-xs font-normal shrink-0'
                      >
                        ใช้
                      </Button>
                    </div>
                  </div>

                  {/* ล้างตัวกรอง */}
                  {(statusFilter || agingBucket || customMinAgeDays !== null) && (
                    <button
                      onClick={() => {
                        setStatusFilter('');
                        setAgingBucket('');
                        setCustomMinAgeDays(null);
                        setCustomMinAgeInput('');
                        setCurrentPage(1);
                      }}
                      className='w-full text-xs text-gray-400 hover:text-red-500 text-left pt-2 border-t border-gray-100 transition cursor-pointer'
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
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => navigate(
                        `${basePath}/transactions/payment-history?search=${encodeURIComponent(row.customer_name)}&type=repayment`
                      )}
                      className='border-none hover:bg-transparent hover:text-red-700 hover:underline p-0 h-auto font-light'>ดูรายละเอียด</Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>

        {/* Pagination */}
        <div className='flex flex-col gap-3 border-t border-gray-100 bg-[#fcfbfa] px-4 py-4 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-6'>
          <span>แสดง {agingTotal === 0 ? 0 : Math.min((currentPage - 1) * PAGE_SIZE + 1, agingTotal)} ถึง {Math.min(currentPage * PAGE_SIZE, agingTotal)} จาก {agingTotal.toLocaleString('th-TH')} รายการ</span>
          <div className='flex max-w-full items-center gap-1 overflow-x-auto pb-1 sm:pb-0'>
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
