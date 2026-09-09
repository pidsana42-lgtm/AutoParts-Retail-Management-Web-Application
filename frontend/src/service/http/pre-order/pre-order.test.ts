import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPreOrder, deletePreOrder, getPreOrderById, getPreOrders, updatePreOrder } from './pre-order';
import { preorder } from '../../../test/preorderFixtures';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../apiClient', () => ({ default: http }));

describe('Preorder frontend HTTP service', () => {
  beforeEach(() => vi.resetAllMocks());
  const data = preorder();
  const operations = [
    { name: 'list without filter', method: 'get', args: ['/wms/pre-orders', { params: {} }], response: { data: [data] }, expected: [data], call: () => getPreOrders() },
    { name: 'list by status', method: 'get', args: ['/wms/pre-orders', { params: { status: 'ORDERED' } }], response: { data: [data] }, expected: [data], call: () => getPreOrders('ORDERED') },
    { name: 'detail', method: 'get', args: ['/wms/pre-orders/51'], response: { data }, expected: data, call: () => getPreOrderById(51) },
    { name: 'create', method: 'post', args: ['/wms/pre-orders', data], response: { data }, expected: data, call: () => createPreOrder(data) },
    { name: 'update', method: 'put', args: ['/wms/pre-orders/51', { status: 'COMPLETED' }], response: { data }, expected: data, call: () => updatePreOrder(51, { status: 'COMPLETED' }) },
    { name: 'delete', method: 'delete', args: ['/wms/pre-orders/51'], response: { message: 'deleted' }, expected: { message: 'deleted' }, call: () => deletePreOrder(51) },
  ] as const;
  it.each(operations)('$name uses the correct endpoint/body and unwraps the response', async ({ method, args, response, expected, call }) => {
    http[method].mockResolvedValue({ data: response });
    expect(await call()).toEqual(expected);
    expect(http[method]).toHaveBeenCalledExactlyOnceWith(...args);
  });
  it.each(operations)('$name propagates API errors without reporting success', async ({ method, call }) => {
    const failure = { response: { status: 400, data: { error: 'ข้อมูลไม่ถูกต้อง' } } };
    http[method].mockRejectedValue(failure);
    await expect(call()).rejects.toBe(failure);
  });
});
