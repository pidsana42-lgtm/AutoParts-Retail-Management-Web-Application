import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TriangleAlert, TrendingUp, TrendingDown, CheckCircle2, Loader2, FileInput, CreditCard, ClipboardList, PackageOpen, ReceiptText, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ShoppingCart } from 'lucide-react';
// Hooks
import { useDashboardMetrics } from '../../owner/dashboard/hooks/useDashboardMetrics';
// Components
import Button from '../../../components/elements/button';
import Input   from '../../../components/elements/input';
import Heading from '../../../components/elements/heading';
import { Badge } from '../../../components/elements/badge';
import Card, { CardContent, CardHeader } from '../../../components/elements/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/elements/table';
// Service & Interface
import { dashboardService } from '../../../service/http/dashboard/dashboard_service';
import type { DashboardSummaryItem, SummaryQuery, StockAlertItem, RecentSaleItem, AgingStockItem, StockHealthStats } from '../../../interface/dashboard/dashboard_interface';
// Utils
import { cn } from '../../../utils/component';
import { formatDateThai, getTodayDateString } from '../../../utils/formatdate';
import { usePathBasePrefix } from '../../../utils/usePathBasePrefix';
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
const PO_BADGE_LS_KEY = 'dashboard_po_created_alerts';
const PO_BADGE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

const fmt = (n: number) =>
  n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });


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
  const isOwner = userRole === 'Owner';
  // Basic State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Filter State
  const [selectedFilter, setSelectedFilter] = useState('daily');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [summaryData, setSummaryData] = useState<DashboardSummaryItem[]>([]);
  // State ส่วน KPI Card สภาพสินค้าคงคลัง
  const [stockHealth, setStockHealth] = useState<StockHealthStats | null>(null);
  const [stockHealthLoading, setStockHealthLoading] = useState(false);
  // State ส่วน Stock Alert Card (แผงขวา)
  const [stockAlerts, setStockAlerts] = useState<StockAlertItem[]>([]);
  const [stockAlertLoading, setStockAlertLoading] = useState(false);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [revenueTrend, setRevenueTrend] = useState<number | null>(null);
  const [orderTrend, setOrderTrend] = useState<number | null>(null);
  // State รายการขายล่าสุด
  const [recentSale, setRecentSale] = useState<RecentSaleItem[]>([]);
  const [recentSaleLoading, setRecentSaleLoading] = useState(false);
  const isFilterToday = selectedFilter === 'daily' && !selectedDate;
  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    if (isFilterToday) {
      return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    return d.toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };
  // Stste รายการค้างสต๊อกเกิน 180 วัน
  const [agingStock, setAgingStock] = useState<AgingStockItem[]>([]);
  const [agingStockLoading, setAgingStockLoading] = useState(false);

  // State ติดตาม alert ที่สร้าง PO ไปแล้ว (เก็บใน localStorage 7 วัน)
  const [poCreatedAlertIds, setPoCreatedAlertIds] = useState<Set<number>>(() => {
    try {
      const raw = localStorage.getItem(PO_BADGE_LS_KEY);
      if (!raw) return new Set<number>();
      const map: Record<string, number> = JSON.parse(raw);
      const now = Date.now();
      return new Set(
        Object.entries(map)
          .filter(([, ts]) => now - ts < PO_BADGE_EXPIRY_MS)
          .map(([id]) => Number(id))
      );
    } catch {
      return new Set<number>();
    }
  });

  // Pagination
  const [recentSalePage, setRecentSalePage] = useState(1);
  const [agingStockPage, setAgingStockPage] = useState(1);
  const { aggr, marginPct, stockHealthLabel } = useDashboardMetrics(summaryData, stockHealth);

  const buildQuery = (): SummaryQuery => {
    if (selectedDate) return { summary_date: selectedDate };
    switch (selectedFilter) {
      case 'weekly':    return { weekly_summary: '1' };
      case 'monthly':   return { monthly_summary: '1' };
      case 'quarterly': return { quarterly_summary: '1' };
      case 'yearly':    return { yearly_summary: '1' };
      default:          return { summary_date: getTodayDateString() };
    }
  };

  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const buildPrevQuery = (): SummaryQuery | null => {
    if (selectedDate) {
      const d = new Date(selectedDate);
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
  };

  const getTrendLabel = () => {
    if (selectedDate) return 'เทียบกับเมื่อวาน';
    switch (selectedFilter) {
      case 'weekly':    return 'เทียบกับสัปดาห์ที่แล้ว';
      case 'monthly':   return 'เทียบกับเดือนที่แล้ว';
      case 'quarterly': return 'เทียบกับไตรมาสที่แล้ว';
      case 'yearly':    return 'เทียบกับปีที่แล้ว';
      default:          return 'เทียบกับเมื่อวาน';
    }
  };

  useEffect(() => {
    const fetch = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await dashboardService.getSummaryData(buildQuery());
        setSummaryData(res.data.summary_data ?? []);
      } catch {
        setError('ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
      } finally {
        setIsLoading(false);
      }
    };
    fetch();
  }, [selectedFilter, selectedDate]);

  useEffect(() => {
    const fetchStockHealth = async () => {
      setStockHealthLoading(true);
      try {
        const res = await dashboardService.getStockHealth();
        setStockHealth(res.data);
      } catch {
        setStockHealth(null);
      } finally {
        setStockHealthLoading(false);
      }
    };
    fetchStockHealth();
  }, []);

  useEffect(() => {
    const fetchStockAlerts = async () => {
      setStockAlertLoading(true);
      try {
        const res = await dashboardService.getStockAlerts();
        const unresolved = res.data.filter(a => a.is_resolved === 'false');
        setStockAlerts(unresolved);
      } catch {
        setStockAlerts([]);
      } finally {
        setStockAlertLoading(false);
      }
    };
    fetchStockAlerts();
  }, []);

  useEffect(() => {
    const fetchRecentSalesOrder = async () => {
      setRecentSaleLoading(true);
      try {
        const res = await dashboardService.getRecentSales(buildQuery());
        setRecentSale(res.data.data ?? []);
      } catch {
        setRecentSale([]);
      } finally {
        setRecentSaleLoading(false);
      }
    };
    fetchRecentSalesOrder();
  }, [selectedFilter, selectedDate]);

  useEffect(() => {
    const fetchAgingStock = async () => {
      setAgingStockLoading(true);
      try {
        const res = await dashboardService.getAgingStock();
        setAgingStock(res.data.data ?? []);
      } catch {
        setAgingStock([]);
      } finally {
        setAgingStockLoading(false);
      }
    };
    fetchAgingStock();
  }, []);

  useEffect(() => {
    const fetchTrend = async () => {
      const prevQuery = buildPrevQuery();
      if (!prevQuery) {
        setRevenueTrend(null);
        setOrderTrend(null);
        return;
      }
      try {
        const res = await dashboardService.getSummaryData(prevQuery);
        const prevData = res.data.summary_data ?? [];
        const prevRevenue = prevData.reduce((s, d) => s + d.total_revenue, 0);
        const prevOrders  = prevData.reduce((s, d) => s + d.total_orders,  0);
        const pct = (curr: number, prev: number) =>
          prev === 0 ? (curr === 0 ? 0 : 100) : ((curr - prev) / prev) * 100;
        setRevenueTrend(pct(aggr.totalRevenue, prevRevenue));
        setOrderTrend(pct(aggr.totalOrders,   prevOrders));
      } catch {
        setRevenueTrend(null);
        setOrderTrend(null);
      }
    };
    fetchTrend();
  }, [summaryData, selectedFilter, selectedDate]);

  const handlePOCreated = (alertIds: number[]) => {
    setPoCreatedAlertIds((prev) => {
      const next = new Set(prev);
      alertIds.forEach((id) => next.add(id));
      return next;
    });
    try {
      const raw = localStorage.getItem(PO_BADGE_LS_KEY);
      const map: Record<string, number> = raw ? JSON.parse(raw) : {};
      const now = Date.now();
      alertIds.forEach((id) => { map[String(id)] = now; });
      localStorage.setItem(PO_BADGE_LS_KEY, JSON.stringify(map));
    } catch { /* ignore */ }
  };

  const handleFilterClick = (value: string) => {
    setSelectedFilter(value);
    setSelectedDate('');
    setRecentSalePage(1);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    setSelectedFilter(newDate ? '' : 'daily');
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
              className={`w-20 py-2.5 text-sm transition ${selectedFilter === filter.value
                ? 'bg-white text-red-500 shadow-sm' : 'text-gray-500 hover:text-red-500'}`}
            >
              {filter.label}
            </button>
          ))}
          <div className='min-w-32'>
            <Input type='date' value={selectedDate} onChange={handleDateChange}
              className={`transition-all ${selectedDate
                ? 'bg-white text-red-500 border border-red-500 shadow-sm'
                : 'bg-transparent text-gray-600 border-transparent'}`}
            />
          </div>
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
          {/* รายได้รวม */}
          <Card className='border-l-[5px] border-l-red-500 flex flex-col justify-center p-5'>
            <Heading level='h6'>รายได้รวม</Heading>
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
 
          {/* รายได้รวม */}
          <Card className='border-l-[5px] border-l-red-500 flex flex-col justify-center p-5'>
            <Heading level='h6'>รายได้รวม</Heading>
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
                  recentSale.slice((recentSalePage - 1) * PAGE_SIZE, recentSalePage * PAGE_SIZE).map((item) => (
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
            {(() => {
              const totalPages = Math.ceil(recentSale.length / PAGE_SIZE);
              return (
                <div className='bg-[#fcfbfa] px-6 py-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500'>
                  <span>แสดง {Math.min((recentSalePage - 1) * PAGE_SIZE + 1, recentSale.length)} ถึง {Math.min(recentSalePage * PAGE_SIZE, recentSale.length)} จาก {recentSale.length} รายการ</span>
                  <div className='flex items-center gap-1'>
                    <button disabled={recentSalePage === 1} onClick={() => setRecentSalePage(1)} className='p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed'><ChevronsLeft size={16} /></button>
                    <button disabled={recentSalePage === 1} onClick={() => setRecentSalePage((p) => p - 1)} className='p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed'><ChevronLeft size={16} /></button>
                    {getPageNumbers(recentSalePage, totalPages).map((p, idx) =>
                      p === '...' ? <span key={`e-${idx}`} className='px-2 text-gray-400'>...</span>
                      : <button key={p} onClick={() => setRecentSalePage(p as number)} className={cn('px-3 py-1.5 rounded-none font-medium transition-colors cursor-pointer', recentSalePage === p ? 'bg-[#d61c24] text-white' : 'text-gray-600 hover:bg-gray-100')}>{p}</button>
                    )}
                    <button disabled={recentSalePage === totalPages} onClick={() => setRecentSalePage((p) => p + 1)} className='p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed'><ChevronRight size={16} /></button>
                    <button disabled={recentSalePage === totalPages} onClick={() => setRecentSalePage(totalPages)} className='p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed'><ChevronsRight size={16} /></button>
                  </div>
                </div>
              );
            })()}
          </Card>

          <Card className='col-span-2 overflow-hidden' noPadding>
            <CardHeader className='flex items-center bg-[#F6F3F2]/50'>
              <Heading level='h4'>สินค้าค้างสต๊อกเกิน 180 วัน</Heading>
              <Button variant='outline' size='sm' onClick={() => navigate(`${basePath}/stock`)}
                className='border-none hover:bg-transparent hover:text-red-700 hover:underline p-0 h-auto font-light'>จัดการสินค้า</Button>
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
                      <PackageOpen size={40} strokeWidth={0.7} className='mx-auto'/> <br />ไม่มีสินค้าค้างสต๊อกเกิน 180 วัน
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
              stockAlerts.map((item) => {
                const hasPO = poCreatedAlertIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'rounded-sm px-4 py-3 flex items-center justify-between',
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
                          สร้าง PO แล้ว
                        </span>
                      )}
                    </div>
                    <div className='text-right'>
                      <Heading level='p' className='m-0 text-gray-500 text-xs'>เหลืออีก</Heading>
                      <Heading level='h3' className={cn('m-0', hasPO ? 'text-amber-500' : 'text-red-600')}>{item.quantity_at_alert}</Heading>
                    </div>
                  </div>
                );
              })
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
      onPOCreated={handlePOCreated}
    />
    </>
  );
};

export default MainDashboard;
