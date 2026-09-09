import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TriangleAlert, TrendingUp, TrendingDown, CheckCircle2, Loader2, FileInput, CreditCard, ClipboardList, PackageOpen, ReceiptText, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ShoppingCart, Filter as FilterIcon } from 'lucide-react';
// Hooks
import { useDashboardMetrics } from '../../owner/dashboard/hooks/useDashboardMetrics';
import { useAgingStock, AGING_DAY_PRESETS } from './hooks/useAgingStock';
// Components
import Button from '../../../components/elements/button';
import Heading from '../../../components/elements/heading';
import { Badge } from '../../../components/elements/badge';
import Card, { CardContent, CardHeader } from '../../../components/elements/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/elements/table';
import DateRangePicker from '../../../components/elements/date_range_picker';
// Service & Interface
import { dashboardService } from '../../../service/http/dashboard/dashboard_service';
import type { DashboardSummaryItem, SummaryQuery, StockAlertItem, RecentSaleItem, StockHealthStats } from '../../../interface/dashboard/dashboard_interface';
// Utils
import { cn } from '../../../utils/component';
import { formatDateThai, getTodayDateString } from '../../../utils/formatdate';
import { usePathBasePrefix } from '../../../utils/usePathBasePrefix';
import { getDashboardRoleGroup } from '../../../utils/dashboardAccess';
// Modal
import StockAlertPOModal from './components/StockAlertPOModal';

const Filter = [
  { label: 'วันนี้',     value: 'daily' },
  { label: 'สัปดาห์นี้', value: 'weekly' },
  { label: 'เดือนนี้',   value: 'monthly' },
  { label: 'ไตรมาสนี้', value: 'quarterly' },
  { label: 'ปีนี้',      value: 'yearly' },
];

const PageFilter = [
  { label: 'ภาพรวม', value: 'maindashboard' },
  { label: 'สรุปยอดขาย', value: 'salesdashboard' },
  { label: 'สรุปยอดหนี้', value: 'debtdashboard' },
];

const PAGE_SIZE = 10;
const STOCK_ALERT_PAGE_SIZE = 5;
const DASHBOARD_POLL_INTERVAL_MS = 15_000;

const fmt = (n: number) =>
  n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const pad = (n: number) => String(n).padStart(2, '0');
const dateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function getPageNumbers(current: number, total: number): (number | '...')[] {
  const delta = 1;
  const range: (number | '...')[] = [];
  const left = Math.max(2, current - delta);
  const right = Math.min(total - 1, current + delta);
  range.push(1);
  if (left > 2) range.push('...');
  for (let i = left; i <= right; i++) range.push(i);
  if (right < total - 1) range.push('...');
  if (total > 1) range.push(total);
  return range;
}

// ───────── Page ──────────
const MainDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = usePathBasePrefix();
  const userRole = localStorage.getItem('role');
  const isOwner = getDashboardRoleGroup(userRole) === 'owner';
  // Basic State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Filter State
  const [selectedFilter, setSelectedFilter] = useState('daily');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [summaryData, setSummaryData] = useState<DashboardSummaryItem[]>([]);
  // State ส่วน KPI Card สภาพสินค้าคงคลัง
  const [stockHealth, setStockHealth] = useState<StockHealthStats | null>(null);
  const [stockHealthLoading, setStockHealthLoading] = useState(false);
  // State ส่วน Stock Alert Card (แผงขวา)
  const [stockAlerts, setStockAlerts] = useState<StockAlertItem[]>([]);
  const [stockAlertLoading, setStockAlertLoading] = useState(false);
  const [stockAlertPage, setStockAlertPage] = useState(1);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [revenueTrend, setRevenueTrend] = useState<number | null>(null);
  const [orderTrend, setOrderTrend] = useState<number | null>(null);
  // State รายการขายล่าสุด
  const [recentSale, setRecentSale] = useState<RecentSaleItem[]>([]);
  const [recentSaleTotal, setRecentSaleTotal] = useState(0);
  const [recentSaleLoading, setRecentSaleLoading] = useState(false);
  const isFilterToday = selectedFilter === 'daily' || (!selectedFilter && !startDate && !endDate) || (startDate === getTodayDateString() && (endDate === getTodayDateString() || !endDate));
  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    if (isFilterToday) {
      return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    return d.toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };
  // Hook สินค้าค้างสต๊อก
  const {
    agingDays,
    agingStock,
    agingStockLoading,
    agingStockPage,
    setAgingStockPage,
    agingFilterOpen,
    setAgingFilterOpen,
    agingFilterPos,
    customAgingInput,
    setCustomAgingInput,
    agingFilterRef,
    handlePresetClick,
    handleCustomApply,
    handleReset,
    toggleFilterOpen,
  } = useAgingStock(180);

  // ล้าง localStorage เก่าที่เคยบันทึก alert PO ไว้ผิดพลาด
  useEffect(() => {
    try {
      localStorage.removeItem('dashboard_po_created_alerts');
    } catch { /* ignore */ }
  }, []);

  // Pagination
  const [recentSalePage, setRecentSalePage] = useState(1);
  const { aggr, marginPct, stockHealthLabel } = useDashboardMetrics(summaryData, stockHealth);

  const buildQuery = useCallback((): SummaryQuery => {
    if (startDate && endDate) {
      if (startDate === endDate) {
        return { summary_date: startDate };
      }
      return { start_date: startDate, end_date: endDate };
    }
    if (startDate) return { summary_date: startDate };
    switch (selectedFilter) {
      case 'daily':     return { summary_date: getTodayDateString() };
      case 'weekly':    return { weekly_summary: '1' };
      case 'monthly':   return { monthly_summary: '1' };
      case 'quarterly': return { quarterly_summary: '1' };
      case 'yearly':    return { yearly_summary: '1' };
      default:          return { summary_date: getTodayDateString() };
    }
  }, [endDate, selectedFilter, startDate]);

  const buildPrevQuery = useCallback((): SummaryQuery | null => {
    if (startDate && endDate) {
      const s = new Date(startDate);
      const e = new Date(endDate);
      const diffMs = e.getTime() - s.getTime();
      const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);

      const prevEnd = new Date(s);
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - diffDays + 1);

      if (diffDays === 1) {
        return { summary_date: dateStr(prevStart) };
      }
      return { start_date: dateStr(prevStart), end_date: dateStr(prevEnd) };
    }
    if (startDate) {
      const d = new Date(startDate);
      d.setDate(d.getDate() - 1);
      return { summary_date: dateStr(d) };
    }
    const now = new Date();
    switch (selectedFilter) {
      case 'daily': {
        const y = new Date(now); y.setDate(y.getDate() - 1);
        return { summary_date: dateStr(y) };
      }
      case 'weekly': {
        const r = new Date(now); r.setDate(r.getDate() - 7);
        return { weekly_summary: '1', ref_date: dateStr(r) };
      }
      case 'monthly': {
        const r = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return { monthly_summary: '1', ref_date: dateStr(r) };
      }
      case 'quarterly': {
        const r = new Date(now); r.setMonth(r.getMonth() - 3);
        return { quarterly_summary: '1', ref_date: dateStr(r) };
      }
      case 'yearly': {
        return { yearly_summary: '1', ref_date: `${now.getFullYear() - 1}-01-01` };
      }
      default: return null;
    }
  }, [endDate, selectedFilter, startDate]);

  const getTrendLabel = () => {
    if (startDate && endDate) {
      if (startDate === endDate) return 'เทียบกับเมื่อวาน';
      return 'เทียบกับช่วงก่อนหน้า';
    }
    if (startDate) return 'เทียบกับเมื่อวาน';
    switch (selectedFilter) {
      case 'daily':     return 'เทียบกับเมื่อวาน';
      case 'weekly':    return 'เทียบกับสัปดาห์ที่แล้ว';
      case 'monthly':   return 'เทียบกับเดือนที่แล้ว';
      case 'quarterly': return 'เทียบกับไตรมาสที่แล้ว';
      case 'yearly':    return 'เทียบกับปีที่แล้ว';
      default:          return 'เทียบกับเมื่อวาน';
    }
  };

  useEffect(() => {
    let cancelled = false;

    const fetchTrend = async () => {
      const prevQuery = buildPrevQuery();
      if (!prevQuery) {
        if (!cancelled) {
          setRevenueTrend(null);
          setOrderTrend(null);
        }
        return;
      }
      try {
        const res = await dashboardService.getSummaryData(prevQuery);
        const prevData = res.data.summary_data ?? [];
        const prevRevenue = prevData.reduce((s, d) => s + d.net_revenue, 0);
        const prevOrders  = prevData.reduce((s, d) => s + d.total_orders,  0);
        const pct = (curr: number, prev: number) =>
          prev === 0 ? (curr === 0 ? 0 : 100) : ((curr - prev) / prev) * 100;
        if (!cancelled) {
          setRevenueTrend(pct(aggr.totalRevenue, prevRevenue));
          setOrderTrend(pct(aggr.totalOrders,   prevOrders));
        }
      } catch {
        if (!cancelled) {
          setRevenueTrend(null);
          setOrderTrend(null);
        }
      }
    };
    void fetchTrend();
    return () => { cancelled = true; };
  }, [aggr.totalOrders, aggr.totalRevenue, buildPrevQuery]);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const fetchSummary = async (showLoading: boolean) => {
      if (inFlight) return;
      inFlight = true;
      if (showLoading) {
        setIsLoading(true);
        setError(null);
      }
      try {
        const res = await dashboardService.getSummaryData(buildQuery());
        if (!cancelled) {
          setSummaryData(res.data.summary_data ?? []);
          setError(null);
        }
      } catch {
        if (!cancelled && showLoading) {
          setError('ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
        }
      } finally {
        inFlight = false;
        if (!cancelled && showLoading) setIsLoading(false);
      }
    };

    void fetchSummary(true);
    const intervalId = window.setInterval(() => {
      if (!document.hidden) void fetchSummary(false);
    }, DASHBOARD_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [buildQuery]);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const fetchStockHealth = async (showLoading: boolean) => {
      if (inFlight) return;
      inFlight = true;
      if (showLoading) setStockHealthLoading(true);
      try {
        const res = await dashboardService.getStockHealth();
        if (!cancelled) setStockHealth(res.data);
      } catch {
        if (!cancelled && showLoading) setStockHealth(null);
      } finally {
        inFlight = false;
        if (!cancelled && showLoading) setStockHealthLoading(false);
      }
    };

    void fetchStockHealth(true);
    const intervalId = window.setInterval(() => {
      if (!document.hidden) void fetchStockHealth(false);
    }, DASHBOARD_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const fetchStockAlerts = async (showLoading: boolean) => {
      if (inFlight) return;
      inFlight = true;
      if (showLoading) setStockAlertLoading(true);
      try {
        const res = await dashboardService.getStockAlerts();
        const unresolved = (res.data ?? [])
          .filter((alert) => alert.is_resolved === 'false')
          .sort((first, second) => Number(Boolean(first.has_po)) - Number(Boolean(second.has_po)));
        if (!cancelled) {
          setStockAlerts(unresolved);
          const lastPage = Math.max(1, Math.ceil(unresolved.length / STOCK_ALERT_PAGE_SIZE));
          setStockAlertPage((currentPage) => Math.min(currentPage, lastPage));
        }
      } catch {
        if (!cancelled && showLoading) setStockAlerts([]);
      } finally {
        inFlight = false;
        if (!cancelled && showLoading) setStockAlertLoading(false);
      }
    };

    void fetchStockAlerts(true);
    const intervalId = window.setInterval(() => {
      if (!document.hidden) void fetchStockAlerts(false);
    }, DASHBOARD_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const fetchRecentSalesOrder = async (showLoading: boolean) => {
      if (inFlight) return;
      inFlight = true;
      if (showLoading) setRecentSaleLoading(true);
      try {
        const res = await dashboardService.getRecentSales(buildQuery(), recentSalePage, PAGE_SIZE);
        if (!cancelled) {
          const total = res.data.total ?? 0;
          const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
          setRecentSaleTotal(total);
          if (recentSalePage > lastPage) {
            setRecentSalePage(lastPage);
          } else {
            setRecentSale(res.data.data ?? []);
          }
        }
      } catch {
        if (!cancelled && showLoading) {
          setRecentSale([]);
          setRecentSaleTotal(0);
        }
      } finally {
        inFlight = false;
        if (!cancelled && showLoading) setRecentSaleLoading(false);
      }
    };

    void fetchRecentSalesOrder(true);
    const intervalId = window.setInterval(() => {
      if (!document.hidden) void fetchRecentSalesOrder(false);
    }, DASHBOARD_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [buildQuery, recentSalePage]);

  const recentSaleTotalPages = Math.max(1, Math.ceil(recentSaleTotal / PAGE_SIZE));
  const stockAlertTotalPages = Math.max(1, Math.ceil(stockAlerts.length / STOCK_ALERT_PAGE_SIZE));
  const visibleStockAlerts = stockAlerts.slice(
    (stockAlertPage - 1) * STOCK_ALERT_PAGE_SIZE,
    stockAlertPage * STOCK_ALERT_PAGE_SIZE,
  );

  const openStockAlertProduct = (productID: number | null) => {
    if (!productID) return;
    const productPath = basePath === '/employee'
      ? `${basePath}/wms/stock-data/${productID}`
      : `${basePath}/stock/${productID}`;
    navigate(productPath, { state: { from: 'dashboard' } });
  };

  const handleFilterClick = (value: string) => {
    setSelectedFilter(value);
    setStartDate('');
    setEndDate('');
    setRecentSalePage(1);
  };

  const handleStartDateChange = (d: string) => {
    setStartDate(d);
    setSelectedFilter('');
    setRecentSalePage(1);
  };

  const handleEndDateChange = (d: string) => {
    setEndDate(d);
    setSelectedFilter('');
    setRecentSalePage(1);
  };

  const kpiValue = (value: string) =>
    isLoading ? <span className='text-gray-400 animate-pulse'>...</span> : value;

  return (
    <>
    <div className='p-8 space-y-8 bg-white min-h-screen font-sans'>
      { /* Top Page Filter */ }
      <div>
        <div className='bg-[#F6F3F2] inline-flex items-center p-1'>
          {PageFilter.map((tab) => {
            const isActive = location.pathname.includes(tab.value);
            return (
              <button key={tab.value} onClick={() => navigate(`${basePath}/dashboard/${tab.value}`)}
                className={`w-32 py-1 flex items-center justify-center text-sm transition ${
                  isActive ? 'bg-white text-red-500 shadow-sm' : 'text-gray-600 hover:text-red-500'}`}>
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      { /* Page Header */ }
      <div className='flex items-end justify-between'>
        <div className='flex flex-col items-start justify-start'>
          <Heading level='h1' weight='semibold' className='m-0 text-black'>
            กระดานแดชบอร์ด
          </Heading>
          <Heading level='h6' className='m-0 mt-1'>ตัวชี้วัดประสิทธิภาพการดำเนินงานแบบเรียลไทม์</Heading>
        </div>
        <div className='bg-[#F6F3F2] flex items-center p-1'>
          {Filter.map((filter) => (
            <button key={filter.value} onClick={() => handleFilterClick(filter.value)}
              className={`w-20 py-2.5 text-sm transition cursor-pointer ${selectedFilter === filter.value
                ? 'bg-white text-red-500 shadow-sm font-medium' : 'text-gray-500 hover:text-red-500'}`}
            >
              {filter.label}
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

      {error && (
        <div className='rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600'>
          {error}
        </div>
      )}

      { /* KPI Cards */ }
      {isOwner ? (
        <div className='grid grid-cols-5 gap-6 items-stretch'>
          {/* รายได้สุทธิ */}
          <Card className='border-l-[5px] border-l-red-500 flex flex-col justify-center p-5'>
            <Heading level='h6'>รายได้สุทธิ</Heading>
            <Heading level='h3'>฿ {kpiValue(fmt(aggr.totalRevenue))}</Heading>
            {revenueTrend !== null ? (
              <Heading level='p' className='mt-1 flex items-center gap-1 text-emerald-600'>
                {revenueTrend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} className='text-red-500' />}
                <span className={revenueTrend >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                  {revenueTrend >= 0 ? '+' : ''}{revenueTrend.toFixed(1)}% {getTrendLabel()}
                </span>
              </Heading>
            ) : (
              <Heading level='p' className='mt-1 invisible' aria-hidden>.</Heading>
            )}
          </Card>

          {/* ต้นทุนรวม */}
          <Card className='border-l-[5px] border-l-gray-300 flex flex-col justify-center p-5'>
            <Heading level='h6'>ต้นทุนรวม</Heading>
            <Heading level='h3'>฿ {kpiValue(fmt(aggr.totalCost))}</Heading>
            <Heading level='p' className='mt-1 text-gray-400'>คงที่ &amp; แปรผัน</Heading>
          </Card>

          {/* กำไรขั้นต้น */}
          <Card className='border-l-[5px] border-l-emerald-500 flex flex-col justify-center p-5'>
            <Heading level='h6'>กำไรขั้นต้น</Heading>
            <Heading level='h3'>฿ {kpiValue(fmt(aggr.grossProfit))}</Heading>
            <Heading level='p' className='mt-1 text-gray-400'>
              สามารถทำอัตรากำไรได้ {marginPct}%
            </Heading>
          </Card>

          {/* ออเดอร์ทั้งหมด */}
          <Card className='border-l-[5px] border-l-gray-300 flex flex-col justify-center p-5'>
            <Heading level='h6'>ออเดอร์ทั้งหมด</Heading>
            <Heading level='h3'>{kpiValue(aggr.totalOrders.toLocaleString('th-TH'))}</Heading>
            {orderTrend !== null ? (
              <Heading level='p' className='mt-1 flex items-center gap-1'>
                {orderTrend >= 0 ? <TrendingUp size={14} className='text-emerald-600' /> : <TrendingDown size={14} className='text-red-500' />}
                <span className={orderTrend >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                  {orderTrend >= 0 ? '+' : ''}{orderTrend.toFixed(1)}% {getTrendLabel()}
                </span>
              </Heading>
            ) : (
              <Heading level='p' className='mt-1 invisible' aria-hidden>.</Heading>
            )}
          </Card>

          {/* สภาพสินค้าคงคลัง */}
          <Card className='border-l-[5px] border-l-sky-700 flex flex-col justify-center p-5'>
            <Heading level='h6'>สภาพสินค้าคงคลัง</Heading>
            <Heading level='h3'>
              {stockHealthLoading
                ? <span className='text-gray-400 animate-pulse'>...</span>
                : stockHealth === null
                  ? <span className='text-gray-400 text-base'>ไม่สามารถโหลดได้</span>
                  : stockHealth.total_products === 0
                    ? <span className='text-gray-400 text-base'>ไม่มีข้อมูล</span>
                    : `${stockHealth.health_percent}%`}
            </Heading>
            {stockHealthLabel && (
              <Heading level='p' className='mt-1 flex items-center gap-1 text-sky-700'>
                <CheckCircle2 size={14} />
                <span>สถานะสต็อก: {stockHealthLabel}</span>
              </Heading>
            )}
          </Card>
        </div>
      ) : (
        <div className='grid grid-cols-4 gap-6 items-stretch'>
          {/* ออเดอร์ทั้งหมด */}
          <Card className='border-l-[5px] border-l-gray-300 flex flex-col justify-center p-5'>
            <Heading level='h6'>ออเดอร์ทั้งหมด</Heading>
            <Heading level='h3'>{kpiValue(aggr.totalOrders.toLocaleString('th-TH'))}</Heading>
            {orderTrend !== null ? (
              <Heading level='p' className='mt-1 flex items-center gap-1'>
                {orderTrend >= 0 ? <TrendingUp size={14} className='text-emerald-600' /> : <TrendingDown size={14} className='text-red-500' />}
                <span className={orderTrend >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                  {orderTrend >= 0 ? '+' : ''}{orderTrend.toFixed(1)}% {getTrendLabel()}
                </span>
              </Heading>
            ) : (
              <Heading level='p' className='mt-1 invisible' aria-hidden>.</Heading>
            )}
          </Card>
 
          {/* รายได้สุทธิ */}
          <Card className='border-l-[5px] border-l-red-500 flex flex-col justify-center p-5'>
            <Heading level='h6'>รายได้สุทธิ</Heading>
            <Heading level='h3'>฿ {kpiValue(fmt(aggr.totalRevenue))}</Heading>
            {revenueTrend !== null ? (
              <Heading level='p' className='mt-1 flex items-center gap-1 text-emerald-600'>
                {revenueTrend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} className='text-red-500' />}
                <span className={revenueTrend >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                  {revenueTrend >= 0 ? '+' : ''}{revenueTrend.toFixed(1)}% {getTrendLabel()}
                </span>
              </Heading>
            ) : (
              <Heading level='p' className='mt-1 invisible' aria-hidden>.</Heading>
            )}
          </Card>
 
          {/* สภาพสินค้าคงคลัง */}
          <Card className='border-l-[5px] border-l-sky-700 flex flex-col justify-center p-5'>
            <Heading level='h6'>สภาพสินค้าคงคลัง</Heading>
            <Heading level='h3'>
              {stockHealthLoading
                ? <Loader2 size={20} className='animate-spin text-gray-400' />
                : stockHealth === null
                  ? <span className='text-gray-400 text-base'>ไม่สามารถโหลดได้</span>
                  : stockHealth.total_products === 0
                    ? <span className='text-gray-400 text-base'>ไม่มีข้อมูล</span>
                    : `${stockHealth.health_percent}%`}
            </Heading>
            {stockHealthLabel && (
              <Heading level='p' className='mt-1 flex items-center gap-1 text-sky-700'>
                <CheckCircle2 size={14} />
                <span>สถานะสต็อก: {stockHealthLabel}</span>
              </Heading>
            )}
          </Card>
 
          {/* Quick Links (เฉพาะ employee) */}
          <Card className='flex flex-col justify-center p-5 gap-3'>
            <Heading level='h6' className='text-gray-400 tracking-wide'>QUICK LINKS</Heading>
            <button
              onClick={() => navigate(`${basePath}/import`)}
              className='flex items-center gap-2 text-sm font-medium text-black hover:text-red-600'
            >
              <FileInput size={16} />
              <span className='underline'>นำเข้าสินค้าจากบิล</span>
            </button>
            <button
              onClick={() => navigate(`${basePath}/pos/pos`)}
              className='flex items-center gap-2 text-sm font-medium text-black hover:text-red-600'
            >
              <CreditCard size={16} />
              <span className='underline'>ระบบขาย POS</span>
            </button>
            <button
              onClick={() => navigate(`${basePath}/pre-orders`)}
              className='flex items-center gap-2 text-sm font-medium text-black hover:text-red-600'
            >
              <ClipboardList size={16} />
              <span className='underline'>พรีออเดอร์</span>
            </button>
          </Card>
        </div>
      )}

      { /* Content */ }
      <div className='grid grid-cols-3 gap-4 items-start'>
        <div className='col-span-2 flex flex-col gap-6'>
          <Card className='col-span-2 overflow-hidden' noPadding>
            <CardHeader className='flex items-center bg-[#F6F3F2]/50'>
              <Heading level='h4'>รายการขายล่าสุด</Heading>
              <Button variant='outline' size='sm' onClick={() => navigate(`${basePath}/pos/sales_history`)}
                className='border-none hover:bg-transparent hover:text-red-700 hover:underline p-0 h-auto font-light'>ดูรายการทั้งหมด</Button>
            </CardHeader>
            <Table>
              <TableHeader className='bg-[#F6F3F2] text-[#797878]'>
                <TableRow>
                  <TableHead className='pl-6'>{isFilterToday ? 'เวลา' : 'วันที่/เวลา'}</TableHead>
                  <TableHead className='text-left'>เลขที่บิล</TableHead>
                  <TableHead className='text-right'>ยอดสุทธิ (บาท)</TableHead>
                  <TableHead className='text-center'>สถานะ</TableHead>
                  <TableHead className='text-center'>วิธีชำระ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className='text-black'>
                {recentSaleLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className='text-center py-12 text-gray-400'><Loader2 size={32} className='animate-spin mx-auto' /></TableCell>
                  </TableRow>
                ) : recentSale.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className='text-center py-12 text-gray-400'>
                      <ReceiptText size={40} strokeWidth={0.7} className='mx-auto'/> <br />ยังไม่มีรายการขายในวันนี้
                    </TableCell>
                  </TableRow>
                ) : (
                  recentSale.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className='text-left'>{fmtTime(item.time)}</TableCell>
                      <TableCell className='text-left'>{item.order_number}</TableCell>
                      <TableCell className='text-right'>{item.total_amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className='text-center'>{item.order_status}</TableCell>
                      <TableCell className='text-center'>{item.payment_method}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {recentSaleTotal > 0 && (
                <div className='bg-[#fcfbfa] px-6 py-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500'>
                  <span>แสดง {Math.min((recentSalePage - 1) * PAGE_SIZE + 1, recentSaleTotal)} ถึง {Math.min(recentSalePage * PAGE_SIZE, recentSaleTotal)} จาก {recentSaleTotal} รายการ</span>
                  <div className='flex items-center gap-1'>
                    <button disabled={recentSalePage === 1} onClick={() => setRecentSalePage(1)} className='p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed'><ChevronsLeft size={16} /></button>
                    <button disabled={recentSalePage === 1} onClick={() => setRecentSalePage((p) => p - 1)} className='p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed'><ChevronLeft size={16} /></button>
                    {getPageNumbers(recentSalePage, recentSaleTotalPages).map((p, idx) =>
                      p === '...' ? <span key={`e-${idx}`} className='px-2 text-gray-400'>...</span>
                      : <button key={p} onClick={() => setRecentSalePage(p as number)} className={cn('px-3 py-1.5 rounded-none font-medium transition-colors cursor-pointer', recentSalePage === p ? 'bg-[#d61c24] text-white' : 'text-gray-600 hover:bg-gray-100')}>{p}</button>
                    )}
                    <button disabled={recentSalePage === recentSaleTotalPages} onClick={() => setRecentSalePage((p) => p + 1)} className='p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed'><ChevronRight size={16} /></button>
                    <button disabled={recentSalePage === recentSaleTotalPages} onClick={() => setRecentSalePage(recentSaleTotalPages)} className='p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed'><ChevronsRight size={16} /></button>
                  </div>
                </div>
            )}
          </Card>

          <Card className='col-span-2 overflow-hidden' noPadding>
            <CardHeader className='flex items-center justify-between bg-[#F6F3F2]/50 px-6 py-4'>
              <Heading level='h4' className='m-0'>สินค้าค้างสต๊อกเกิน {agingDays} วัน</Heading>
              <div className='flex items-center gap-4'>
                {/* Filter dropdown */}
                <div className='relative flex items-center' ref={agingFilterRef}>
                  <Button
                    variant='outline'
                    size='sm'
                    className='border-none hover:bg-transparent hover:text-red-700 hover:underline p-0 h-auto font-light inline-flex items-center gap-1.5'
                    leftIcon={<FilterIcon size={14} className='shrink-0' />}
                    onClick={toggleFilterOpen}
                  >
                    ตัวกรอง
                    {agingDays !== 180 && (
                      <span className='text-red-600 font-normal'>
                        ({agingDays} วัน)
                      </span>
                    )}
                  </Button>

                  {agingFilterOpen && (
                    <div
                      style={{
                        position: 'fixed',
                        ...(agingFilterPos.top !== undefined ? { top: agingFilterPos.top } : {}),
                        ...(agingFilterPos.bottom !== undefined ? { bottom: agingFilterPos.bottom } : {}),
                        right: agingFilterPos.right,
                      }}
                      className='z-9999 w-64 bg-white border border-gray-200 shadow-lg p-4 space-y-4'
                    >
                      {/* ช่วงจำนวนวัน */}
                      <div>
                        <Heading level='p'>ช่วงจำนวนวันค้างสต๊อก</Heading>
                        <div className='flex flex-wrap gap-1.5 mt-1'>
                          {AGING_DAY_PRESETS.map((opt) => (
                            <Button
                              key={opt.value}
                              size='sm'
                              variant={agingDays === opt.value ? 'solid-red' : 'outline-cancel'}
                              onClick={() => handlePresetClick(opt.value)}
                              className='px-2.5 py-1 h-auto text-xs font-normal cursor-pointer'
                            >
                              {opt.label}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* หรือระบุจำนวนวันเอง */}
                      <div className='pt-2 border-t border-gray-100'>
                        <Heading level='p'>หรือระบุจำนวนวันเอง</Heading>
                        <div className='flex items-center gap-2 mt-1.5'>
                          <input
                            type='number'
                            min={1}
                            placeholder='เช่น 45'
                            value={customAgingInput}
                            onChange={(e) => setCustomAgingInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleCustomApply();
                              }
                            }}
                            className='w-full h-8 px-2.5 text-sm border border-gray-300 rounded-none focus:outline-none focus:border-red-500'
                          />
                          <span className='text-xs text-gray-500 shrink-0'>วัน</span>
                          <Button
                            size='sm'
                            variant='solid-red'
                            onClick={handleCustomApply}
                            className='px-3 py-1 h-8 text-xs font-normal shrink-0'
                          >
                            ใช้
                          </Button>
                        </div>
                      </div>

                      {/* Reset and Close */}
                      <div className='pt-2 border-t border-gray-100 flex justify-between items-center'>
                        <button
                          type='button'
                          onClick={handleReset}
                          className='text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer'
                        >
                          รีเซ็ตเป็น 180 วัน
                        </button>
                        <button
                          type='button'
                          onClick={() => setAgingFilterOpen(false)}
                          className='text-xs text-red-500 hover:text-red-700 font-medium transition cursor-pointer'
                        >
                          ปิด
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => navigate(`${basePath}/stock`)}
                  className='border-none hover:bg-transparent hover:text-red-700 hover:underline p-0 h-auto font-light inline-flex items-center'
                >
                  จัดการสินค้า
                </Button>
              </div>
            </CardHeader>
            <Table>
              <TableHeader className='bg-[#F6F3F2] text-[#797878]'>
                <TableRow>
                  <TableHead className='pl-6'>อันดับ</TableHead>
                  <TableHead className='text-left'>รหัสสินค้า</TableHead>
                  <TableHead className='text-left'>ชื่อสินค้า</TableHead>
                  <TableHead className='text-center'>วันที่ขายสินค้าล่าสุด</TableHead>
                  <TableHead className='text-center'>จำนวนวันที่ค้างสต๊อก</TableHead>
                  <TableHead className='text-center'>จำนวนคงเหลือ</TableHead>
                  <TableHead className='text-center'>หน่วย</TableHead>
                  <TableHead className='text-center'>มูลค่าเงินจม (บาท)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className='text-black'>
                {agingStockLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className='text-center py-12 text-gray-400'><Loader2 size={32} className='animate-spin mx-auto' /></TableCell>
                  </TableRow>
                ) : agingStock.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className='text-center py-12 text-gray-400'>
                      <PackageOpen size={40} strokeWidth={0.7} className='mx-auto'/> <br />ไม่มีสินค้าค้างสต๊อกเกิน {agingDays || 180} วัน
                    </TableCell>
                  </TableRow>
                ) : (
                  agingStock.slice((agingStockPage - 1) * PAGE_SIZE, agingStockPage * PAGE_SIZE).map((item) => (
                    <TableRow key={item.product_code}>
                      <TableCell className='pl-6'>{item.rank}</TableCell>
                      <TableCell className='text-left'>{item.product_code}</TableCell>
                      <TableCell className='text-left'>{item.product_name}</TableCell>
                      <TableCell className='text-center'>
                        {item.last_sold_date ? formatDateThai(item.last_sold_date) : 'ไม่เคยขาย'}
                      </TableCell>
                      <TableCell className='text-center'>{item.days_aging}</TableCell>
                      <TableCell className='text-center'>{item.remaining_qty}</TableCell>
                      <TableCell className='text-center'>{item.unit}</TableCell>
                      <TableCell className='text-center'>{fmt(item.sunk_value)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {(() => {
              const totalPages = Math.ceil(agingStock.length / PAGE_SIZE);
              return (
                <div className='bg-[#fcfbfa] px-6 py-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500'>
                  <span>แสดง {Math.min((agingStockPage - 1) * PAGE_SIZE + 1, agingStock.length)} ถึง {Math.min(agingStockPage * PAGE_SIZE, agingStock.length)} จาก {agingStock.length} รายการ</span>
                  <div className='flex items-center gap-1'>
                    <button disabled={agingStockPage === 1} onClick={() => setAgingStockPage(1)} className='p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed'><ChevronsLeft size={16} /></button>
                    <button disabled={agingStockPage === 1} onClick={() => setAgingStockPage((p) => p - 1)} className='p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed'><ChevronLeft size={16} /></button>
                    {getPageNumbers(agingStockPage, totalPages).map((p, idx) =>
                      p === '...' ? <span key={`e-${idx}`} className='px-2 text-gray-400'>...</span>
                      : <button key={p} onClick={() => setAgingStockPage(p as number)} className={cn('px-3 py-1.5 rounded-none font-medium transition-colors cursor-pointer', agingStockPage === p ? 'bg-[#d61c24] text-white' : 'text-gray-600 hover:bg-gray-100')}>{p}</button>
                    )}
                    <button disabled={agingStockPage === totalPages} onClick={() => setAgingStockPage((p) => p + 1)} className='p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed'><ChevronRight size={16} /></button>
                    <button disabled={agingStockPage === totalPages} onClick={() => setAgingStockPage(totalPages)} className='p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed'><ChevronsRight size={16} /></button>
                  </div>
                </div>
              );
            })()}
          </Card>
        </div>

        <Card className='col-span-1 sticky top-4 z-10 self-start overflow-hidden border-[#DC2626] border-5' noPadding>
          <CardHeader className='bg-[#DC2626] flex items-center'>
            <div className='flex items-center gap-4'>
              <TriangleAlert size={20} className='text-white' />
              <Heading level='h5' className='text-white m-0 leading-none'>เตือนสินค้าใกล้หมดสต็อก</Heading>
            </div>
            <Badge variant='primary' size='lg' className='bg-white rounded-full w-fit'>
              {stockAlerts.length > 0 ? `${stockAlerts.length} รายการ` : '0 รายการ'}
            </Badge>
          </CardHeader>
          <CardContent className='p-2 gap-2 flex flex-col'>
            {stockAlertLoading ? (
              <div className='text-center py-8 text-gray-400 text-sm animate-pulse'><Loader2 size={40} className='animate-spin mx-auto' /></div>
            ) : stockAlerts.length === 0 ? (
                <div className='flex flex-col items-center gap-4 py-12 text-red-300'>
                  <PackageOpen size={60} strokeWidth={0.5} />
                  <div>ไม่มีสินค้าใกล้หมดสต๊อก</div>
                </div>
            ) : (
              visibleStockAlerts.map((item) => {
                const hasPO = Boolean(item.has_po);
                return (
                  <button
                    type='button'
                    key={item.id}
                    onClick={() => openStockAlertProduct(item.product_id)}
                    disabled={!item.product_id}
                    title={item.product_id ? `ดูรายละเอียด ${item.product_name ?? 'สินค้า'}` : 'ไม่พบรหัสสินค้า'}
                    className={cn(
                      'w-full rounded-sm px-4 py-3 flex items-center justify-between text-left transition',
                      item.product_id
                        ? 'cursor-pointer hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500'
                        : 'cursor-not-allowed opacity-70',
                      hasPO
                        ? 'bg-amber-50 border-l-4 border-amber-400'
                        : 'bg-red-50 border-l-4 border-red-500'
                    )}
                  >
                    <div>
                      <Heading level='h6' weight='semibold' className='m-0 text-black'>
                        {item.product_name}
                      </Heading>
                      <Heading level='p' weight='semibold' className='m-0 mt-0.5 text-red-600 text-xs'>
                        SKU: {item.product_code}
                      </Heading>
                      {hasPO && (
                        <span className='inline-flex items-center gap-1 mt-1 text-xs text-amber-700 font-medium'>
                          <ShoppingCart size={11} />
                          สร้าง PO แล้ว {item.po_number ? `(${item.po_number}${(item.po_count ?? 1) > 1 ? ` +${(item.po_count ?? 1) - 1}` : ''})` : ''}
                        </span>
                      )}
                    </div>
                    <div className='text-right'>
                      <Heading level='p' className='m-0 text-gray-500 text-xs'>เหลืออีก</Heading>
                      <Heading level='h3' className={cn('m-0', hasPO ? 'text-amber-500' : 'text-red-600')}>{item.quantity_at_alert}</Heading>
                    </div>
                  </button>
                );
              })
            )}

            {stockAlertTotalPages > 1 && (
              <div className='px-2 py-2 flex items-center justify-between border-t border-gray-100 text-xs text-gray-500'>
                <span>
                  แสดง {(stockAlertPage - 1) * STOCK_ALERT_PAGE_SIZE + 1}–{Math.min(stockAlertPage * STOCK_ALERT_PAGE_SIZE, stockAlerts.length)} จาก {stockAlerts.length}
                </span>
                <div className='flex items-center gap-1'>
                  <button
                    type='button'
                    aria-label='หน้าก่อนหน้า'
                    disabled={stockAlertPage === 1}
                    onClick={() => setStockAlertPage((page) => Math.max(1, page - 1))}
                    className='p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer'
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className='min-w-14 text-center'>หน้า {stockAlertPage}/{stockAlertTotalPages}</span>
                  <button
                    type='button'
                    aria-label='หน้าถัดไป'
                    disabled={stockAlertPage === stockAlertTotalPages}
                    onClick={() => setStockAlertPage((page) => Math.min(stockAlertTotalPages, page + 1))}
                    className='p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer'
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {stockAlerts.length > 0 && (
              <Button variant='primary' onClick={() => setAlertModalOpen(true)}
                className='w-full bg-black text-white rounded-none py-3 text-sm font-medium mt-1'
              >
                สร้างใบสั่งซื้อเลย
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>

    <StockAlertPOModal
      isOpen={alertModalOpen}
      onClose={() => setAlertModalOpen(false)}
      stockAlerts={stockAlerts}
      basePath={basePath}
    />
    </>
  );
};

export default MainDashboard;
