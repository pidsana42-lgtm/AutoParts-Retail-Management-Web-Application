import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardSummaryItem } from '../../../../interface/dashboard/dashboard_interface';
import { dashboardService } from '../../../../service/http/dashboard/dashboard_service';
import { useDebtDashboard } from './useDebtDashboard';

vi.mock('../../../../service/http/dashboard/dashboard_service', () => ({
  dashboardService: {
    getSummaryData: vi.fn(),
    getDebtAging: vi.fn(),
  },
}));

const getSummaryMock = vi.mocked(dashboardService.getSummaryData);
const getDebtMock = vi.mocked(dashboardService.getDebtAging);

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

describe('useDebtDashboard', () => {
  beforeEach(() => {
    getSummaryMock.mockReset();
    getDebtMock.mockReset();
  });

  it('aggregates current and yearly debt metrics', async () => {
    getSummaryMock.mockImplementation(async (query) => ({
      data: query.yearly_summary
        ? {
            summary_data: [
              summary({ collected_debt_amount: 10, total_outstanding_amount: 90 }),
              summary({ collected_debt_amount: 20, total_outstanding_amount: 80 }),
            ],
            total: 2,
          }
        : {
            summary_data: [
              summary({ total_outstanding_amount: 100, collected_debt_amount: 25, overdue_debt_count: 2 }),
              summary({ total_outstanding_amount: 50, collected_debt_amount: 10, overdue_debt_count: 1 }),
            ],
            total: 2,
          },
    } as any));
    getDebtMock.mockResolvedValue({
      data: { data: [], total: 7, total_debtors: 5, yearly_target: 1000 },
    } as any);

    const { result } = renderHook(() => useDebtDashboard(
      { monthly_summary: '1' },
      { page: 1, page_size: 25 },
    ));

    await waitFor(() => {
      expect(result.current.summaryLoading).toBe(false);
      expect(result.current.agingLoading).toBe(false);
      expect(result.current.yearlyCollectedLoading).toBe(false);
    });
    expect(result.current.kpi).toEqual({
      totalOutstanding: 150,
      collectedAmount: 35,
      overdueCount: 3,
    });
    expect(result.current.yearlyCollected).toBe(30);
    expect(result.current.yearlyOutstanding).toBe(80);
    expect(result.current.agingTotal).toBe(7);
    expect(result.current.totalDebtors).toBe(5);
    expect(result.current.yearlyTarget).toBe(1000);
  });

  it('exposes summary and aging errors without stale data', async () => {
    getSummaryMock.mockRejectedValue(new Error('summary failed'));
    getDebtMock.mockRejectedValue(new Error('aging failed'));

    const { result } = renderHook(() => useDebtDashboard({}, {}));

    await waitFor(() => {
      expect(result.current.summaryLoading).toBe(false);
      expect(result.current.agingLoading).toBe(false);
    });
    expect(result.current.summaryError).toBe('โหลดข้อมูล KPI ไม่สำเร็จ');
    expect(result.current.agingError).toBe('โหลดตารางอายุหนี้ไม่สำเร็จ');
    expect(result.current.agingData).toEqual([]);
  });
});
