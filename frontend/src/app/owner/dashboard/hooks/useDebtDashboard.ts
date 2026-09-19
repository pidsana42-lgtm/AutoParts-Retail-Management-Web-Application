import { useEffect, useMemo, useState } from 'react';
import { dashboardService } from '../../../../service/http/dashboard/dashboard_service';
import type {
  DashboardSummaryItem,
  SummaryQuery,
  DebtAgingItem,
  DebtAgingQuery,
} from '../../../../interface/dashboard/dashboard_interface';
import { getTodayDateString } from '../../../../utils/formatdate';

export function useDebtDashboard(summaryQuery: SummaryQuery, agingQuery: DebtAgingQuery) {
  const [summaryData, setSummaryData] = useState<DashboardSummaryItem[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [currentOutstanding, setCurrentOutstanding] = useState(0);
  const [currentOutstandingLoading, setCurrentOutstandingLoading] = useState(false);

  const [agingData, setAgingData] = useState<DebtAgingItem[]>([]);
  const [agingTotal, setAgingTotal] = useState(0);
  const [totalDebtors, setTotalDebtors] = useState(0);
  const [yearlyTarget, setYearlyTarget] = useState(0);
  const [agingLoading, setAgingLoading] = useState(false);
  const [agingError, setAgingError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setSummaryLoading(true);
    setSummaryError(null);
    dashboardService
      .getSummaryData(summaryQuery)
      .then((res) => {
        if (mounted) setSummaryData(res.data.summary_data ?? []);
      })
      .catch(() => {
        if (mounted) setSummaryError('โหลดข้อมูล KPI ไม่สำเร็จ');
      })
      .finally(() => {
        if (mounted) setSummaryLoading(false);
      });
    return () => { mounted = false; };
  }, [summaryQuery]);

  // ยอดหนี้ค้างทั้งหมดเป็น snapshot ปัจจุบันเสมอ ไม่เปลี่ยนตาม period filter
  useEffect(() => {
    let mounted = true;
    setCurrentOutstandingLoading(true);
    dashboardService
      .getSummaryData({ summary_date: getTodayDateString() })
      .then((res) => {
        if (!mounted) return;
        const today = res.data.summary_data?.[0];
        setCurrentOutstanding(today?.total_outstanding_amount ?? 0);
      })
      .catch(() => { if (mounted) setCurrentOutstanding(0); })
      .finally(() => { if (mounted) setCurrentOutstandingLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    setAgingLoading(true);
    setAgingError(null);
    dashboardService
      .getDebtAging(agingQuery)
      .then((res) => {
        if (!mounted) return;
        setAgingData(res.data.data ?? []);
        setAgingTotal(res.data.total ?? 0);
        setTotalDebtors(res.data.total_debtors ?? 0);
        setYearlyTarget(res.data.yearly_target ?? 0);
      })
      .catch(() => {
        if (mounted) setAgingError('โหลดตารางอายุหนี้ไม่สำเร็จ');
      })
      .finally(() => {
        if (mounted) setAgingLoading(false);
      });
    return () => { mounted = false; };
  }, [agingQuery]);

  const kpi = useMemo(() => ({
    collectedAmount: summaryData.reduce((s, d) => s + (d.collected_debt_amount ?? 0), 0),
  }), [summaryData]);

  return {
    kpi,
    currentOutstanding,
    currentOutstandingLoading,
    totalDebtors,
    yearlyTarget,
    summaryLoading,
    summaryError,
    agingData,
    agingTotal,
    agingLoading,
    agingError,
  };
}
