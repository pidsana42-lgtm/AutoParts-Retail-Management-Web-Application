import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TrendingUp, TrendingDown, Banknote, Users, Loader2, Eye, Trophy, FileText } from 'lucide-react';
// Components
import Button from '../../../components/elements/button';
import { Card, CardHeader } from '../../../components/elements/card';
import Heading from '../../../components/elements/heading';
import { Table, TableHeader, TableHead, TableBody, TableCell, TableRow } from '../../../components/elements/table';
import DonutChartCard from './hooks/DonutchartCard';
// Hooks
import { useDashboardMetrics } from '../../owner/dashboard/hooks/useDashboardMetrics';
import { useRevenueBreakdown } from './hooks/useRevenueBreakdown';
// Service & Interface
import { dashboardService } from '../../../service/http/dashboard/dashboard_service';
import type { DashboardSummaryItem, SummaryQuery, StockHealthStats, TopSellerItem } from '../../../interface/dashboard/dashboard_interface';
// Utils
import { usePathBasePrefix } from '../../../utils/usePathBasePrefix';
import Input from '../../../components/elements/input';
import { formatDateThai, getTodayDateString } from '../../../utils/formatdate';
import { exportTopSellerPdf } from '../../../utils/print';

const Filter = [
  { label: 'วันนี้',     value: 'daily' },
  { label: 'สัปดาห์นี้', value: 'weekly' },
  { label: 'เดือนนี้',   value: 'monthly' },
  { label: 'ไตรมาสนี้', value: 'quarterly' },
  { label: 'ปีนี้',      value: 'yearly' },
];

const PageFilter = [
    { label:'ภาพรวม', value:'maindashboard' },
    { label:'สรุปยอดขาย', value:'salesdashboard' },
    { label:'สรุปยอดหนี้', value:'debtdashboard' },
]

const fmt = (n: number) =>
  n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });


const SaleDashboard: React.FC = () => {
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
  // State ส่วน KPI Card
  const [revenueTrend, setRevenueTrend] = useState<number | null>(null);
  const [orderTrend, setOrderTrend] = useState<number | null>(null);
  const [stockHealth, setStockHealth] = useState<StockHealthStats | null>(null);

  const [topSellerProduct, setTopSellerProduct] = useState<TopSellerItem[]>([]);
  const [topSellerProductLoading, setTopSellerProductLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const query = useMemo<SummaryQuery>(() => {
    if (selectedDate) return { summary_date: selectedDate };
    switch (selectedFilter) {
      case 'weekly':    return { weekly_summary: '1' };
      case 'monthly':   return { monthly_summary: '1' };
      case 'quarterly': return { quarterly_summary: '1' };
      case 'yearly':    return { yearly_summary: '1' };
      default:          return { summary_date: getTodayDateString() };
    }
  }, [selectedFilter, selectedDate]);

  const { aggr, marginPct } = useDashboardMetrics(summaryData, stockHealth);
  const { customerData, paymentData, totalCustomerRevenue, totalPaymentRevenue, isLoading: isChartLoading } = useRevenueBreakdown(query);

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
        const prevRevenue = prevData.reduce((s, d) => s + d.net_revenue, 0);
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
  }, [aggr, query]);

  useEffect(() => {
    const fetchSummary = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await dashboardService.getSummaryData(query);
        setSummaryData(res.data.summary_data ?? []);
      } catch {
        setError('ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
      } finally {
        setIsLoading(false);
      }
    };
    fetchSummary();
  }, [query]);

  useEffect(() => {
    dashboardService.getStockHealth()
      .then((res) => setStockHealth(res.data))
      .catch(() => setStockHealth(null));
  }, []);

  useEffect(() => {
    const fetchTopSellers = async () => {
      setTopSellerProductLoading(true);
      try {
        const res = await dashboardService.getTopSellers(query, 10);
        setTopSellerProduct(res.data.data ?? []);
      } catch {
        setTopSellerProduct([]);
      } finally {
        setTopSellerProductLoading(false);
      }
    };
    fetchTopSellers();
  }, [query]);
  
  const handleFilterClick = (value: string) => {
    setSelectedFilter(value);
    setSelectedDate('');
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    setSelectedFilter(newDate ? '' : 'daily');
  };

  const handleExportPdf = () => {
    const periodLabel = selectedDate
      ? formatDateThai(selectedDate)
      : Filter.find((f) => f.value === selectedFilter)?.label ?? 'ทั้งหมด';
    setExportingPdf(true);
    exportTopSellerPdf(topSellerProduct, periodLabel);
    setExportingPdf(false);
  };

  const kpiValue = (value: string) => isLoading ? <span className='text-gray-400 animate-pulse'>...</span> : value;

  return (
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
            กระดานสรุปยอดขาย
          </Heading>
          <Heading level='h6' className='m-0 mt-1'>ติดตามความเคลื่อนไหวของยอดขายผ่านแดชบอร์ดเดียว</Heading>
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
        <div className='grid grid-cols-4 gap-6 items-stretch'>
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
        </div>
      ) : (
        <div className='grid grid-cols-2 gap-6 items-stretch'>
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
        </div>
      )}

      <div className='grid grid-cols-2 gap-6 items-stretch'>
        <DonutChartCard
          title='รายได้แยกประเภทลูกค้า'
          icon={<Banknote size={24} />}
          data={customerData}
          total={totalCustomerRevenue}
          isLoading={isChartLoading}
        />
        <DonutChartCard
          title='รายได้แยกประเภทการจ่ายเงิน'
          icon={<Users size={24} />}
          data={paymentData}
          total={totalPaymentRevenue}
          isLoading={isChartLoading}
        />
      </div>
      <div className='col-span-1 flex flex-col gap-6'>
        <Card className='col-span-1 overflow-hidden' noPadding>
            <CardHeader className='flex items-center bg-[#F6F3F2]/50'>
              <Heading level='h4'>สินค้าขายดี 10 อันดับของร้าน</Heading>
              <Button variant='outline' size='sm' onClick={handleExportPdf} disabled={exportingPdf || topSellerProduct.length === 0}
                className='border-none hover:bg-transparent hover:text-red-700 hover:underline p-0 h-auto font-light'>
                ส่งออกรายการทั้งหมด
              </Button>
            </CardHeader>
            <Table>
              <TableHeader className='bg-[#F6F3F2] text-[#797878]'>
                <TableRow>
                  <TableHead className='pl-6 text-center'>อันดับ</TableHead>
                  <TableHead className='text-left'>ชื่อสินค้า</TableHead>
                  <TableHead className='text-center'>หมวดหมู่</TableHead>
                  <TableHead className='text-right'>ขายแล้ว</TableHead>
                  <TableHead className='text-right'>ยอดขายรวม</TableHead>
                  <TableHead className='text-center'>รายละเอียด</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className='text-black'>
                {topSellerProductLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className='text-center py-12 text-gray-400'><Loader2 size={32} className='animate-spin mx-auto' /></TableCell>
                  </TableRow>
                ) : topSellerProduct.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className='text-center py-12 text-gray-400'>
                      <Trophy size={40} strokeWidth={0.7} className='mx-auto' /> <br />ยังไม่มีข้อมูลสินค้าขายดี 10 อับดับ
                    </TableCell>
                  </TableRow>
                ) : (
                  topSellerProduct.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell className='text-center'>{`#${index + 1}`}</TableCell>
                      <TableCell className='text-left'>{item.product_name}</TableCell>
                      <TableCell className='text-center'>{item.category}</TableCell>
                      <TableCell className='text-right'>{item.total_sold}</TableCell>
                      <TableCell className='text-right'>฿{item.total_revenue.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className='text-center'>
                        <button onClick={() => navigate(`${basePath}/stock/${item.id}`)} className="text-gray-600 hover:text-gray-700 transition cursor-pointer">
                          <Eye size={20} strokeWidth={1.5} />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
        </Card>
      </div>
    </div>
  )
}

export default SaleDashboard;
