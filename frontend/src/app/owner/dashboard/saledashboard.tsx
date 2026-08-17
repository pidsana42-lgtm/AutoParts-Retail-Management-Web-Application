import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TrendingUp, TrendingDown, Banknote, Users } from 'lucide-react';
import { PieChart, Pie, Tooltip, ResponsiveContainer, Cell } from 'recharts';
// Components
import Card from '../../../components/elements/card';
import Heading from '../../../components/elements/heading';
import Input from '../../../components/elements/input';
// Hooks
import { useDashboardMetrics } from '../../owner/dashboard/hooks/useDashboardMetrics';
// Service & Interface
import { dashboardService } from '../../../service/http/dashboard/dashboard_service';
import type { DashboardSummaryItem, SummaryQuery, StockAlertItem, RecentSaleItem, StockHealthStats } from '../../../interface/dashboard/dashboard_interface';
// Utils
import { usePathBasePrefix } from '../../../utils/usePathBasePrefix';

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

interface CustomerData {
  name: string;
  value: number;
  fill: string;
}

const customerData: CustomerData[] = [
  {
    name: 'ลูกค้าทั่วไป',
    value: 10000,
    fill: '#C20D12',
  },
  {
    name: 'ลูกค้าคู่',
    value: 7500,
    fill: '#FF9295',
  },
  {
    name: 'ลูกค้าบริษัท',
    value: 8000,
    fill: '#F9C6C7',
  },
];

interface PaymentData {
  name: string;
  value: number;
  fill: string;
}

const paymentData: PaymentData[] = [
  {
    name: 'เงินโอน',
    value: 8000,
    fill: '#DFEAF7',
  },
  {
    name: 'เงินสด',
    value: 7500,
    fill: '#C7E0FA',
  },
  {
    name: 'เงินเชื่อ',
    value: 10000,
    fill: '#176493',
  },
];

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
  const { aggr, marginPct } = useDashboardMetrics(summaryData, stockHealth);

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
  
  const handleFilterClick = (value: string) => {
    setSelectedFilter(value);
    setSelectedDate('');
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    setSelectedFilter(newDate ? '' : 'daily');
  };

  const kpiValue = (value: string) => isLoading ? <span className='text-gray-400 animate-pulse'>...</span> : value;
  const totalCustomerRevenue = customerData.reduce((sum, item) => sum + item.value, 0);
  const totalPaymentRevenue = paymentData.reduce((sum, item) => sum + item.value, 0);

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
        </div>
      )}

      <div className='grid grid-cols-2 gap-6 items-stretch'>
        <Card className='border-2 border-dashed border-red-200 flex flex-col justify-center p-8'>
          <div className='flex flex-row items-stretch justify-between'>
            <Heading level='h4'>รายได้แยกประเภทลูกค้า</Heading>
            <Heading className='text-gray-400'><Banknote size={24} /></Heading>
          </div>
          <div className='w-full h-75'>
            <ResponsiveContainer width='100%' height='100%'>
              <PieChart>
                <Pie
                  data={customerData}
                  dataKey='value'
                  nameKey='name'
                  cx='50%'
                  cy='48%'
                  innerRadius={65}
                  outerRadius={110}
                  paddingAngle={0}
                  stroke='none'
                />

                <Tooltip
                  formatter={(value) =>
                    `฿ ${Number(value).toLocaleString('th-TH')}`
                  }
                />

                <text
                  x='50%'
                  y='45%'
                  textAnchor='middle'
                  dominantBaseline='middle'
                >
                  <tspan
                    x='50%'
                    dy='-8'
                    fontSize='18'
                    fontWeight='600'
                  >
                    ยอดรวม
                  </tspan>

                  <tspan
                    x='50%'
                    dy='32'
                    fontSize='24'
                    fontWeight='700'
                  >
                    ฿{totalCustomerRevenue.toLocaleString('th-TH')}
                  </tspan>
                </text>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className='flex items-center justify-center gap-16 -mt-2.5'>
            {customerData.map((item) => (
              <div key={item.name} className='flex items-center gap-4'>
                <span
                  className='w-5 h-5 rounded-full'
                  style={{
                    backgroundColor: item.fill,
                  }}
                />
                <Heading level='h6'>{item.name}</Heading>
              </div>
            ))}
          </div>
        </Card>
        <Card className='border-2 border-dashed border-red-200 flex flex-col p-8'>
          <div className='flex flex-row items-center justify-between'>
            <Heading level='h4'>รายได้แยกประเภทการจ่ายเงิน</Heading>
            <Heading className='text-gray-400'>
              <Users size={24} />
            </Heading>
          </div>
          <div className='w-full h-75'>
            <ResponsiveContainer width='100%' height='100%'>
              <PieChart>
                <Pie
                  data={paymentData}
                  dataKey='value'
                  nameKey='name'
                  cx='50%'
                  cy='48%'
                  innerRadius={65}
                  outerRadius={110}
                  paddingAngle={0}
                  stroke='none'
                />

                <Tooltip
                  formatter={(value) =>
                    `฿ ${Number(value).toLocaleString('th-TH')}`
                  }
                />

                <text
                  x='50%'
                  y='45%'
                  textAnchor='middle'
                  dominantBaseline='middle'
                >
                  <tspan
                    x='50%'
                    dy='-8'
                    fontSize='18'
                    fontWeight='600'
                  >
                    ยอดรวม
                  </tspan>

                  <tspan
                    x='50%'
                    dy='32'
                    fontSize='24'
                    fontWeight='700'
                  >
                    ฿{totalPaymentRevenue.toLocaleString('th-TH')}
                  </tspan>
                </text>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className='flex items-center justify-center gap-16 -mt-2.5'>
            {paymentData.map((item) => (
              <div
                key={item.name}
                className='flex items-center gap-4'
              >
                <span
                  className='w-5 h-5 rounded-full'
                  style={{
                    backgroundColor: item.fill,
                  }}
                />
                <Heading level='h6'>{item.name}</Heading>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div>
        
      </div>
    </div>
  )
}

export default SaleDashboard;