import { useState, useEffect, useRef } from 'react';
import { dashboardService } from '../../../../service/http/dashboard/dashboard_service';
import type { SummaryQuery, TopSellerItem } from '../../../../interface/dashboard/dashboard_interface';

export const TOP_SELLER_PRESETS = [
  { label: '5 อันดับ',  value: 5 },
  { label: '10 อันดับ', value: 10 },
  { label: '20 อันดับ', value: 20 },
  { label: '50 อันดับ', value: 50 },
];

export function useTopSellers(query: SummaryQuery, initialLimit = 10) {
  const [topLimit, setTopLimit] = useState<number>(initialLimit);
  const [topSellerProduct, setTopSellerProduct] = useState<TopSellerItem[]>([]);
  const [topSellerProductLoading, setTopSellerProductLoading] = useState(false);

  // Filter dropdown state
  const [topFilterOpen, setTopFilterOpen] = useState(false);
  const [topFilterPos, setTopFilterPos] = useState<{ top?: number; bottom?: number; right?: number }>({ top: 0, right: 0 });
  const [customTopInput, setCustomTopInput] = useState(String(initialLimit));
  const topFilterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (topFilterRef.current && !topFilterRef.current.contains(e.target as Node)) {
        setTopFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchTopSellers = async () => {
      setTopSellerProductLoading(true);
      try {
        const limit = topLimit > 0 ? topLimit : 10;
        const res = await dashboardService.getTopSellers(query, limit);
        if (isMounted) {
          const list = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
          setTopSellerProduct(Array.isArray(list) ? list : []);
        }
      } catch {
        if (isMounted) {
          setTopSellerProduct([]);
        }
      } finally {
        if (isMounted) {
          setTopSellerProductLoading(false);
        }
      }
    };
    fetchTopSellers();
    return () => {
      isMounted = false;
    };
  }, [query, topLimit]);

  const handleTopPresetClick = (val: number) => {
    setTopLimit(val);
    setCustomTopInput(String(val));
    setTopFilterOpen(false);
  };

  const handleCustomTopApply = () => {
    const val = parseInt(customTopInput, 10);
    if (!isNaN(val) && val > 0) {
      setTopLimit(val);
      setTopFilterOpen(false);
    }
  };

  const handleTopReset = () => {
    setTopLimit(10);
    setCustomTopInput('10');
    setTopFilterOpen(false);
  };

  const toggleTopFilterOpen = () => {
    if (!topFilterOpen && topFilterRef.current) {
      const r = topFilterRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const POPOVER_HEIGHT = 280;
      const openUpwards = spaceBelow < POPOVER_HEIGHT && r.top > POPOVER_HEIGHT;

      setTopFilterPos({
        top: openUpwards ? undefined : r.bottom + 4,
        bottom: openUpwards ? window.innerHeight - r.top + 4 : undefined,
        right: Math.max(16, window.innerWidth - r.right),
      });
    }
    setTopFilterOpen((o) => !o);
  };

  return {
    topLimit,
    setTopLimit,
    topSellerProduct,
    topSellerProductLoading,
    topFilterOpen,
    setTopFilterOpen,
    topFilterPos,
    customTopInput,
    setCustomTopInput,
    topFilterRef,
    handleTopPresetClick,
    handleCustomTopApply,
    handleTopReset,
    toggleTopFilterOpen,
  };
}
