import { useState, useEffect, useRef } from 'react';
import { dashboardService } from '../../../../service/http/dashboard/dashboard_service';
import type { AgingStockItem } from '../../../../interface/dashboard/dashboard_interface';

export const AGING_DAY_PRESETS = [
  { label: '30 วัน',  value: 30 },
  { label: '60 วัน',  value: 60 },
  { label: '90 วัน',  value: 90 },
  { label: '180 วัน', value: 180 },
  { label: '365 วัน', value: 365 },
];

const AGING_STOCK_POLL_INTERVAL_MS = 60_000;

export function useAgingStock(initialDays = 180) {
  const [agingDays, setAgingDays] = useState<number>(initialDays);
  const [agingStock, setAgingStock] = useState<AgingStockItem[]>([]);
  const [agingStockLoading, setAgingStockLoading] = useState(false);
  const [agingStockPage, setAgingStockPage] = useState(1);

  // Filter Popover state
  const [agingFilterOpen, setAgingFilterOpen] = useState(false);
  const [agingFilterPos, setAgingFilterPos] = useState<{ top?: number; bottom?: number; right?: number }>({ top: 0, right: 0 });
  const [customAgingInput, setCustomAgingInput] = useState(String(initialDays));
  const agingFilterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (agingFilterRef.current && !agingFilterRef.current.contains(e.target as Node)) {
        setAgingFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let isMounted = true;
    let inFlight = false;

    const fetchAgingStock = async (showLoading: boolean) => {
      if (inFlight) return;
      inFlight = true;
      if (showLoading) setAgingStockLoading(true);
      try {
        const days = agingDays > 0 ? agingDays : 180;
        const res = await dashboardService.getAgingStock(days);
        if (isMounted) {
          setAgingStock(res.data.data ?? []);
        }
      } catch {
        if (isMounted && showLoading) {
          setAgingStock([]);
        }
      } finally {
        inFlight = false;
        if (isMounted && showLoading) {
          setAgingStockLoading(false);
        }
      }
    };

    void fetchAgingStock(true);
    const intervalId = window.setInterval(() => {
      if (!document.hidden) void fetchAgingStock(false);
    }, AGING_STOCK_POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [agingDays]);

  const handlePresetClick = (val: number) => {
    setAgingDays(val);
    setCustomAgingInput(String(val));
    setAgingStockPage(1);
    setAgingFilterOpen(false);
  };

  const handleCustomApply = () => {
    const val = parseInt(customAgingInput, 10);
    if (!isNaN(val) && val > 0) {
      setAgingDays(val);
      setAgingStockPage(1);
      setAgingFilterOpen(false);
    }
  };

  const handleReset = () => {
    setAgingDays(180);
    setCustomAgingInput('180');
    setAgingStockPage(1);
    setAgingFilterOpen(false);
  };

  const toggleFilterOpen = () => {
    if (!agingFilterOpen && agingFilterRef.current) {
      const r = agingFilterRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const POPOVER_HEIGHT = 280;
      const openUpwards = spaceBelow < POPOVER_HEIGHT && r.top > POPOVER_HEIGHT;

      setAgingFilterPos({
        top: openUpwards ? undefined : r.bottom + 4,
        bottom: openUpwards ? window.innerHeight - r.top + 4 : undefined,
        right: Math.max(16, window.innerWidth - r.right),
      });
    }
    setAgingFilterOpen((o) => !o);
  };

  return {
    agingDays,
    setAgingDays,
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
  };
}
