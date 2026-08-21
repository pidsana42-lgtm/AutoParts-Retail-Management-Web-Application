import { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { cn } from '../../utils/component';

const TH_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

const formatDateTH = (iso: string): string => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${TH_MONTHS_SHORT[m - 1]} ${y + 543}`;
};

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  className?: string;
}

export default function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ start: startDate, end: endDate });
  const containerRef = useRef<HTMLDivElement>(null);

  // sync draft when props change from outside
  useEffect(() => {
    setDraft({ start: startDate, end: endDate });
  }, [startDate, endDate]);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setDraft({ start: startDate, end: endDate }); // discard unsaved draft
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, startDate, endDate]);

  const handleApply = () => {
    onStartDateChange(draft.start);
    onEndDateChange(draft.end);
    setOpen(false);
  };

  const handleClear = () => {
    setDraft({ start: '', end: '' });
  };

  const label =
    startDate && endDate
      ? `${formatDateTH(startDate)} — ${formatDateTH(endDate)}`
      : startDate
      ? `${formatDateTH(startDate)} — ...`
      : 'เลือกช่วงวันที่';

  return (
    <div ref={containerRef} className={cn('relative inline-block', className)}>
      {/* Trigger */}
      <button
        type='button'
        onClick={() => setOpen((o) => !o)}
        className='flex items-center gap-2 bg-[#F6F3F2] px-3 py-2 border-b-2 border-red-500 rounded-none text-sm text-gray-600 hover:bg-gray-200 transition'
      >
        <Calendar size={15} className='text-gray-400 shrink-0' />
        <span className='whitespace-nowrap'>{label}</span>
        <ChevronDown size={14} className={cn('text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      {/* Popover */}
      {open && (
        <div className='absolute left-0 top-full mt-2 z-50 bg-white border border-gray-200 rounded-none shadow-lg p-4 min-w-70'>
          <p className='text-xs font-medium text-gray-500 mb-3'>เลือกช่วงวันที่</p>
          <div className='space-y-3'>
            <div>
              <label className='block text-xs text-gray-500 mb-1'>วันเริ่มต้น</label>
              <input
                type='date'
                value={draft.start}
                max={draft.end || undefined}
                onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))}
                className='w-full h-9 rounded-none border border-gray-200 px-2 text-sm text-gray-700 focus:outline-none focus:border-red-400 cursor-pointer'
              />
            </div>
            <div>
              <label className='block text-xs text-gray-500 mb-1'>วันสิ้นสุด</label>
              <input
                type='date'
                value={draft.end}
                min={draft.start || undefined}
                onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))}
                className='w-full h-9 rounded-none border border-gray-200 px-2 text-sm text-gray-700 focus:outline-none focus:border-red-400 cursor-pointer'
              />
            </div>
          </div>
          <div className='flex items-center justify-between mt-4 pt-3 border-t border-gray-100'>
            <button type='button' onClick={handleClear}
              className='text-xs text-gray-400 hover:text-gray-600 transition'>
              ล้างค่า
            </button>
            <button type='button' onClick={handleApply}
              disabled={!draft.start || !draft.end}
              className='px-4 py-1.5 rounded-none bg-red-500 text-white text-sm hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition'>
              ตกลง
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
