import React from 'react';
import { PieChart, Pie, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '../../../../components/elements/card';
import Heading from '../../../../components/elements/heading';
import type { DonutChartCardProps } from '../../../../interface/dashboard/dashboard_interface';

const EMPTY_PLACEHOLDER = [{ name: '', value: 1, fill: '#E5E7EB' }];

const DonutChartCard: React.FC<DonutChartCardProps> = ({ title, icon, data, total, isLoading }) => {
  const isEmpty = !isLoading && (data.length === 0 || total === 0);
  const chartData = isEmpty ? EMPTY_PLACEHOLDER : data.filter(d => d.value > 0);

  return (
  <Card className='border-2 border-dashed border-red-200 flex flex-col justify-center p-8'>
    <div className='flex flex-row items-stretch justify-between'>
      <Heading level='h4'>{title}</Heading>
      <Heading className='text-gray-400'>{icon}</Heading>
    </div>

    <div className='w-full h-75 relative'>
      {isLoading && (
        <div className='absolute inset-0 flex items-center justify-center'>
          <div className='w-44 h-44 rounded-full border-8 border-gray-100 border-t-red-300 animate-spin' />
        </div>
      )}
      <ResponsiveContainer width='100%' height='100%'>
        <PieChart>
          <Pie
            data={chartData}
            dataKey='value'
            nameKey='name'
            cx='50%'
            cy='48%'
            innerRadius={65}
            outerRadius={110}
            paddingAngle={0}
            stroke='none'
          />

          {!isLoading && !isEmpty && (
            <Tooltip formatter={(value) => `฿ ${Number(value).toLocaleString('th-TH')}`} />
          )}

          <text x='50%' y='45%' textAnchor='middle' dominantBaseline='middle'>
            {isLoading ? (
              <tspan x='50%' dy='8' fontSize='16' fill='#9CA3AF'>กำลังโหลด...</tspan>
            ) : isEmpty ? (
              <tspan x='50%' dy='8' fontSize='12' fill='#9CA3AF'>ยังไม่มีรายการขายในวันนี้</tspan>
            ) : (
              <>
                <tspan x='50%' dy='-8' fontSize='18' fontWeight='600'>ยอดรวม</tspan>
                <tspan x='50%' dy='32' fontSize='24' fontWeight='700'>
                  ฿{total.toLocaleString('th-TH')}
                </tspan>
              </>
            )}
          </text>
        </PieChart>
      </ResponsiveContainer>
    </div>

    <div className='flex items-center justify-center gap-16 -mt-2.5 min-h-7'>
      {!isLoading && !isEmpty && data.map((item) => (
        <div key={item.name} className='flex items-center gap-4'>
          <span className='w-5 h-5 rounded-full' style={{ backgroundColor: item.fill }} />
          <Heading level='h6'>{item.name}</Heading>
        </div>
      ))}
    </div>
  </Card>
  );
};

export default DonutChartCard;