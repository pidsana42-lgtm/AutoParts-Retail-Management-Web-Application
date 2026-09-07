import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type {
  DashboardSummaryItem,
  StockHealthStats,
} from '../../../../interface/dashboard/dashboard_interface';
import { useDashboardMetrics } from './useDashboardMetrics';

function summary(overrides: Partial<DashboardSummaryItem>): DashboardSummaryItem {
  return {
    summary_date: '2026-09-07',
    total_orders: 0,
    total_items_sold: 0,
    overdue_debt_count: 0,
    total_revenue: 0,
    net_revenue: 0,
    total_cost: 0,
    gross_profit: 0,
    margin_profit: 0,
    cash_amount: 0,
    transfer_amount: 0,
    credit_amount: 0,
    walkin_customer_amount: 0,
    garage_customer_amount: 0,
    corporate_customer_amount: 0,
    return_amount: 0,
    collected_debt_amount: 0,
    total_outstanding_amount: 0,
    ...overrides,
  };
}

function stockHealth(healthPercent: number): StockHealthStats {
  return {
    total_products: 10,
    healthy_count: 8,
    low_stock_count: 1,
    out_of_stock_count: 1,
    health_percent: healthPercent,
  };
}

describe('useDashboardMetrics', () => {
  it('aggregates KPI data and calculates rounded margin', () => {
    const { result } = renderHook(() => useDashboardMetrics([
      summary({ net_revenue: 100, total_cost: 60, gross_profit: 40, total_orders: 2 }),
      summary({ net_revenue: 50, total_cost: 30, gross_profit: 20, total_orders: 1 }),
    ], stockHealth(90)));

    expect(result.current.aggr).toEqual({
      totalRevenue: 150,
      totalCost: 90,
      grossProfit: 60,
      totalOrders: 3,
    });
    expect(result.current.marginPct).toBe(40);
    expect(result.current.stockHealthLabel).toBe('เหมาะสม');
  });

  it.each([
    [89, 'ควรตรวจสอบ'],
    [70, 'ควรตรวจสอบ'],
    [69, 'วิกฤต'],
  ])('maps stock health %s to %s', (percent, expected) => {
    const { result } = renderHook(() => useDashboardMetrics([], stockHealth(percent)));
    expect(result.current.stockHealthLabel).toBe(expected);
  });

  it('returns safe empty metrics when no data is available', () => {
    const { result } = renderHook(() => useDashboardMetrics([], null));
    expect(result.current.aggr.totalRevenue).toBe(0);
    expect(result.current.marginPct).toBe(0);
    expect(result.current.stockHealthLabel).toBeNull();
  });
});
