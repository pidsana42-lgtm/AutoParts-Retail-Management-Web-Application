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
  align?: 'left' | 'right';
  className?: string;
}

export default function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  align,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [openLeftward, setOpenLeftward] = useState(false);
  const [draft, setDraft] = useState({ start: startDate, end: endDate });
  const containerRef = useRef<HTMLDivElement>(null);
  const POPOVER_HEIGHT = 220; // approximate popover height in px
  const POPOVER_WIDTH = 290;  // approximate popover width in px

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

  const handleOpen = () => {
    if (!open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceRight = window.innerWidth - rect.left;
      setOpenUpward(spaceBelow < POPOVER_HEIGHT);
      setOpenLeftward(align === 'right' || spaceRight < POPOVER_WIDTH || rect.right > window.innerWidth / 2);
    }
    setOpen((o) => !o);
  };

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

  const isSelected = Boolean(startDate && endDate) || Boolean(startDate);

  return (
    <div ref={containerRef} className={cn('relative inline-block', className)}>
      {/* Trigger */}
      <button
        type='button'
        onClick={handleOpen}
        className={cn(
          'flex items-center gap-2 px-3 py-2 text-sm transition cursor-pointer',
          isSelected || open
            ? 'bg-white text-red-500 shadow-sm font-medium'
            : 'bg-transparent text-gray-600 hover:text-red-500'
        )}
      >
        <Calendar size={15} className={cn('shrink-0', isSelected || open ? 'text-red-500' : 'text-gray-400')} />
        <span className='whitespace-nowrap'>{label}</span>
        <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180', isSelected || open ? 'text-red-500' : 'text-gray-400')} />
      </button>

      {/* Popover */}
      {open && (
        <div className={cn(
          'absolute z-50 bg-white border border-gray-200 rounded-none shadow-lg p-4 w-72 max-w-[90vw]',
          openLeftward ? 'right-0' : 'left-0',
          openUpward ? 'bottom-full mb-2' : 'top-full mt-2'
        )}>
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
