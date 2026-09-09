import { beforeEach, describe, expect, it, vi } from 'vitest';
import { returnService } from './return_service';
import { returnableOrder, returnsResponse, salesReturn } from '../../../test/returnFixtures';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../apiClient', () => ({ default: http }));

describe('Return HTTP service', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {}); });

  const operations = [
    { name: 'list', method: 'get', args: ['/returns', { params: { status: 'PENDING', search: 'ลูกค้า & SO-41', page: 2, page_size: 10 } }], response: returnsResponse, expected: returnsResponse,
      call: () => returnService.getReturns({ status: 'PENDING', search: 'ลูกค้า & SO-41', page: 2, page_size: 10 }) },
    { name: 'search', method: 'get', args: ['/returns/sale-orders/search', { params: { search: 'SO & ลูกค้า' } }], response: { data: [returnableOrder] }, expected: [returnableOrder],
      call: () => returnService.searchReturnableSaleOrders('SO & ลูกค้า') },
    { name: 'detail', method: 'get', args: ['/returns/81'], response: { data: salesReturn }, expected: salesReturn,
      call: () => returnService.getReturnById(81) },
    { name: 'create', method: 'post', args: ['/returns', salesReturn], response: { data: salesReturn }, expected: salesReturn,
      call: () => returnService.createSalesReturn(salesReturn) },
    { name: 'approve', method: 'put', args: ['/returns/81', { status: 'APPROVED' }], response: { data: salesReturn }, expected: salesReturn,
      call: () => returnService.updateSalesReturn(81, { status: 'APPROVED' }) },
    { name: 'refund', method: 'post', args: ['/returns/81/refund'], response: { data: salesReturn }, expected: salesReturn,
      call: () => returnService.processRefund(81) },
    { name: 'delete', method: 'delete', args: ['/returns/81'], response: { message: 'Deleted' }, expected: { message: 'Deleted' },
      call: () => returnService.deleteSalesReturn(81) },
  ] as const;

  it.each(operations)('$name sends the correct endpoint, parameters and body and unwraps the response', async operation => {
    http[operation.method].mockResolvedValue({ data: operation.response });
    expect(await operation.call()).toEqual(operation.expected);
    expect(http[operation.method]).toHaveBeenCalledExactlyOnceWith(...operation.args);
  });

  it.each(operations)('$name propagates API failures without converting them to successful data', async operation => {
    const error = { response: { status: 409, data: { error: 'Already processed' } } };
    http[operation.method].mockRejectedValue(error);
    await expect(operation.call()).rejects.toBe(error);
  });

  it('returns an empty search result and null detail for missing data envelopes', async () => {
    http.get.mockResolvedValue({ data: {} });
    expect(await returnService.searchReturnableSaleOrders('missing')).toEqual([]);
    expect(await returnService.getReturnById(999)).toBeNull();
  });
});
