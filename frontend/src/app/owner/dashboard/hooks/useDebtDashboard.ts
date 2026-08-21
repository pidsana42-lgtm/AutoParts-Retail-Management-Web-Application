import { useEffect, useMemo, useState } from 'react';
import { dashboardService } from '../../../../service/http/dashboard/dashboard_service';
import type {
  DashboardSummaryItem,
  SummaryQuery,
  DebtAgingItem,
  DebtAgingQuery,
} from '../../../../interface/dashboard/dashboard_interface';

const YEARLY_QUERY: SummaryQuery = { yearly_summary: '1' };

export function useDebtDashboard(summaryQuery: SummaryQuery, agingQuery: DebtAgingQuery) {
  const [summaryData, setSummaryData] = useState<DashboardSummaryItem[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [yearlyCollected, setYearlyCollected] = useState(0);
  const [yearlyOutstanding, setYearlyOutstanding] = useState(0);
  const [yearlyCollectedLoading, setYearlyCollectedLoading] = useState(false);

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

  // รายรับจากการเก็บหนี้ปีนี้ — fixed yearly query ไม่ขึ้นกับ period filter
  useEffect(() => {
    let mounted = true;
    setYearlyCollectedLoading(true);
    dashboardService
      .getSummaryData(YEARLY_QUERY)
      .then((res) => {
        if (!mounted) return;
        const rows = res.data.summary_data ?? [];
        setYearlyCollected(rows.reduce((s, d) => s + (d.collected_debt_amount ?? 0), 0));
        // record ล่าสุด = snapshot ยอดหนี้รวมปัจจุบันในระบบ
        const last = rows[rows.length - 1];
        setYearlyOutstanding(last?.total_outstanding_amount ?? 0);
      })
      .catch(() => { /* ไม่แสดง error แยก ใช้ summaryError แทน */ })
      .finally(() => { if (mounted) setYearlyCollectedLoading(false); });
    return () => { mounted = false; };
  }, []); // [] = โหลดครั้งเดียวตอน mount

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
    totalOutstanding: summaryData.reduce((s, d) => s + (d.total_outstanding_amount ?? 0), 0),
    collectedAmount: summaryData.reduce((s, d) => s + (d.collected_debt_amount ?? 0), 0),
    overdueCount: summaryData.reduce((s, d) => s + (d.overdue_debt_count ?? 0), 0),
  }), [summaryData]);

  return {
    kpi,
    yearlyCollected,
    yearlyOutstanding,
    yearlyCollectedLoading,
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
