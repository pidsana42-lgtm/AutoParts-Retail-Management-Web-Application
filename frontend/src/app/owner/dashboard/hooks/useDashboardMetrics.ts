import { useMemo } from 'react';
import type { DashboardSummaryItem, AggrResult, StockHealthStats } from '../../../../interface/dashboard/dashboard_interface';

export function useDashboardMetrics(
  summaryData: DashboardSummaryItem[],
  stockHealth: StockHealthStats | null
) {
  const aggr = useMemo<AggrResult>(() =>
    summaryData.reduce(
      (acc, d) => ({
        totalRevenue: acc.totalRevenue + d.total_revenue,
        totalCost:    acc.totalCost    + d.total_cost,
        grossProfit:  acc.grossProfit  + d.gross_profit,
        totalOrders:  acc.totalOrders  + d.total_orders,
      }),
      { totalRevenue: 0, totalCost: 0, grossProfit: 0, totalOrders: 0 }
    ),
  [summaryData]);

  const marginPct = useMemo(() =>
    aggr.totalRevenue > 0
      ? Math.round((aggr.grossProfit / aggr.totalRevenue) * 100)
      : 0,
  [aggr.totalRevenue, aggr.grossProfit]);

  const stockHealthLabel = useMemo(() => {
    if (!stockHealth || stockHealth.total_products === 0) return null;
    if (stockHealth.health_percent >= 90) return 'เหมาะสม';
    if (stockHealth.health_percent >= 70) return 'ควรตรวจสอบ';
    return 'วิกฤต';
  }, [stockHealth]);

  return { aggr, marginPct, stockHealthLabel };
}