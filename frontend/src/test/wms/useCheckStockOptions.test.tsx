import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../components/elements/toast';
import { useCheckStockOptions } from '../../app/owner/stock/stock_check/useCheckStockOptions';
import { stockCheckService } from '../../service/http/wms/stock_check_service';
import { getProductsList } from '../../service/http/wms/product';

vi.mock('../../service/http/wms/stock_check_service', () => ({
  stockCheckService: {
    getEmployees: vi.fn(),
    getZoneTree: vi.fn(),
    getCategoryTree: vi.fn(),
  },
}));

vi.mock('../../service/http/wms/product', () => ({
  getProductsList: vi.fn(),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => <ToastProvider>{children}</ToastProvider>;

describe('useCheckStockOptions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('starts in a loading state and populates every option list once all requests resolve', async () => {
    vi.mocked(stockCheckService.getEmployees).mockResolvedValue([{ id: 1, first_name: 'สมชาย', last_name: 'ใจดี', full_name: 'สมชาย ใจดี' }]);
    vi.mocked(stockCheckService.getZoneTree).mockResolvedValue([{ id: 1, zone_name: 'โซน A' }]);
    vi.mocked(stockCheckService.getCategoryTree).mockResolvedValue([{ id: 1, category_name: 'เบรก' }]);
    vi.mocked(getProductsList).mockResolvedValue([{ ID: 1 } as any]);

    const { result } = renderHook(() => useCheckStockOptions(), { wrapper });
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.employees).toEqual([{ id: 1, first_name: 'สมชาย', last_name: 'ใจดี', full_name: 'สมชาย ใจดี' }]);
    expect(result.current.zones).toEqual([{ id: 1, zone_name: 'โซน A' }]);
    expect(result.current.categories).toEqual([{ id: 1, category_name: 'เบรก' }]);
    expect(result.current.products).toEqual([{ ID: 1 }]);
  });

  it('stops loading and keeps empty defaults when any request fails', async () => {
    vi.mocked(stockCheckService.getEmployees).mockRejectedValue(new Error('network error'));
    vi.mocked(stockCheckService.getZoneTree).mockResolvedValue([]);
    vi.mocked(stockCheckService.getCategoryTree).mockResolvedValue([]);
    vi.mocked(getProductsList).mockResolvedValue([]);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useCheckStockOptions(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.employees).toEqual([]);
    expect(result.current.zones).toEqual([]);
    expect(result.current.categories).toEqual([]);
    expect(result.current.products).toEqual([]);
  });
});
