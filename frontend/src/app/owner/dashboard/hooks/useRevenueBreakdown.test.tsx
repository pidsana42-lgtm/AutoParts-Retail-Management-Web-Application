import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SummaryQuery } from '../../../../interface/dashboard/dashboard_interface';
import { dashboardService } from '../../../../service/http/dashboard/dashboard_service';
import { useRevenueBreakdown } from './useRevenueBreakdown';

vi.mock('../../../../service/http/dashboard/dashboard_service', () => ({
  dashboardService: {
    getSummaryIncomeData: vi.fn(),
  },
}));

const query: SummaryQuery = { monthly_summary: '1' };
const getIncomeMock = vi.mocked(dashboardService.getSummaryIncomeData);

describe('useRevenueBreakdown', () => {
  beforeEach(() => {
    getIncomeMock.mockReset();
  });

  it('loads and aggregates customer and payment revenue', async () => {
    getIncomeMock.mockResolvedValue({
      data: {
        customerData: [
          { name: 'ทั่วไป', value: 100, fill: '#1' },
          { name: 'อู่', value: 50, fill: '#2' },
        ],
        paymentData: [
          { name: 'เงินสด', value: 80, fill: '#3' },
          { name: 'โอน', value: 70, fill: '#4' },
        ],
      },
    } as any);

    const { result } = renderHook(() => useRevenueBreakdown(query));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.totalCustomerRevenue).toBe(150);
    expect(result.current.totalPaymentRevenue).toBe(150);
    expect(result.current.error).toBeNull();
  });

  it('exposes an error when loading fails', async () => {
    getIncomeMock.mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useRevenueBreakdown(query));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('โหลดข้อมูลไม่สำเร็จ');
    expect(result.current.customerData).toEqual([]);
    expect(result.current.paymentData).toEqual([]);
  });
});
