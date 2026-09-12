import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../../../../src/service/http/apiClient';
import { dashboardService } from '../../../../src/service/http/dashboard/dashboard_service';

vi.mock('../../../../src/service/http/apiClient', () => ({
  default: {
    get: vi.fn(),
  },
}));

const getMock = vi.mocked(apiClient.get);

describe('dashboardService', () => {
  beforeEach(() => {
    getMock.mockReset();
    getMock.mockResolvedValue({ data: {} });
  });

  it('sends validated summary and pagination parameters', async () => {
    await dashboardService.getRecentSales({ monthly_summary: '1' }, 2, 25);

    expect(getMock).toHaveBeenCalledWith('/dashboard/recent-sales', {
      params: { monthly_summary: '1', page: 2, page_size: 25 },
    });
  });

  it('does not call the API when a scalar parameter is invalid', () => {
    expect(() => dashboardService.getAgingStock(0)).toThrow('days');
    expect(() => dashboardService.getTopSellers({}, 101)).toThrow('100');
    expect(getMock).not.toHaveBeenCalled();
  });

  it('does not call the API when a date range is invalid', () => {
    expect(() => dashboardService.getSummaryData({
      start_date: '2026-09-08',
      end_date: '2026-09-07',
    })).toThrow('start_date');
    expect(getMock).not.toHaveBeenCalled();
  });

  it('loads all debt-aging rows in validated pages of 100', async () => {
    getMock
      .mockResolvedValueOnce({
        data: { data: [{ customer_code: '1' }], total: 101, total_debtors: 101, yearly_target: 0 },
      })
      .mockResolvedValueOnce({
        data: { data: [{ customer_code: '2' }], total: 101, total_debtors: 101, yearly_target: 0 },
      });

    const response = await dashboardService.getAllDebtAging({ status: 'ทยอยชำระ' });

    expect(getMock).toHaveBeenNthCalledWith(1, '/dashboard/debt-aging', {
      params: { status: 'ทยอยชำระ', page: 1, page_size: 100 },
    });
    expect(getMock).toHaveBeenNthCalledWith(2, '/dashboard/debt-aging', {
      params: { status: 'ทยอยชำระ', page: 2, page_size: 100 },
    });
    expect(response.data.data).toHaveLength(2);
  });
});


