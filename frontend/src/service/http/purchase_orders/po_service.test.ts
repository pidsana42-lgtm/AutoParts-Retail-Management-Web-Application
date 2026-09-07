import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../apiClient';
import { poService } from './po_service';
import type { CreatePORequest } from '../../../interface/purchase_orders/po_interface';

vi.mock('../apiClient', () => ({ default: {
  get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(),
} }));

const payload: CreatePORequest = {
  supplier_id: 7, notes: 'Order filters', status: 'DRAFT',
  po_items: [{ product_id: 3, quantity: 2, unit_price: 12.5, pre_order_item_id: 20 }],
};

describe('poService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('sends pagination and selected filters, omitting the all-status option', async () => {
    const data = { data: [], total: 0 };
    vi.mocked(apiClient.get).mockResolvedValue({ data });
    await expect(poService.getPurchaseOrders({ page: 1, limit: 10, status: 'all' })).resolves.toEqual(data);
    expect(apiClient.get).toHaveBeenLastCalledWith('/po/get-all-po', { params: { page: 1, limit: 10 } });
    const filters = { page: 2, limit: 25, status: 'PENDING', search: 'PO-42', year: '2026', month: '09' };
    await poService.getPurchaseOrders(filters);
    expect(apiClient.get).toHaveBeenLastCalledWith('/po/get-all-po', { params: filters });
  });

  it('preserves items and preorder links when creating an order', async () => {
    const data = { id: 42, status: 'DRAFT', total_amount: 25 };
    vi.mocked(apiClient.post).mockResolvedValue({ data });
    await expect(poService.createPurchaseOrder(payload)).resolves.toEqual(data);
    expect(apiClient.post).toHaveBeenCalledWith('/po/new-po', payload);
  });

  it('sends edited items and returns the updated order', async () => {
    const update = { notes: 'Edited', items: [{ id: 1, product_id: 3, quantity: 4, unit_price: 12.5 }] };
    vi.mocked(apiClient.put).mockResolvedValue({ data: { id: 42, total_amount: 50 } });
    await expect(poService.updatePurchaseOrder(42, update)).resolves.toEqual({ id: 42, total_amount: 50 });
    expect(apiClient.put).toHaveBeenCalledWith('/po/42', update);
  });

  it.each(['DRAFT', 'PENDING', 'APPROVED', 'RESUBMITTED', 'CANCELLED'] as const)('submits status %s', async status => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { message: 'updated' } });
    await expect(poService.updatePOStatus(42, status)).resolves.toEqual({ message: 'updated' });
    expect(apiClient.patch).toHaveBeenCalledWith('/po/42/status', { status });
  });

  it('uses separate delete and restore endpoints', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: { message: 'deleted' } });
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { message: 'restored' } });
    await expect(poService.deletePurchaseOrder(42)).resolves.toEqual({ message: 'deleted' });
    await expect(poService.restorePurchaseOrder(42)).resolves.toEqual({ message: 'restored' });
    expect(apiClient.delete).toHaveBeenCalledWith('/po/42');
    expect(apiClient.patch).toHaveBeenCalledWith('/po/42/restore');
  });

  it.each([true, false])('downloads PDF with include_code=%s', async includeCode => {
    const pdf = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    vi.mocked(apiClient.get).mockResolvedValue({ data: pdf });
    await expect(poService.printPurchaseOrder(42, includeCode)).resolves.toBe(pdf);
    expect(apiClient.get).toHaveBeenCalledWith('/po/print/42', { params: { include_code: includeCode }, responseType: 'blob' });
  });

  it('searches products within the selected supplier', async () => {
    const products = [{ id: 3, name: 'Filter' }];
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: products } });
    await expect(poService.searchProduct('Filter', 7)).resolves.toEqual(products);
    expect(apiClient.get).toHaveBeenCalledWith('/po/product-search', { params: { q: 'Filter', supplier_id: 7 } });
  });

  it.each([true, false])('normalizes pending preorders (wrapped=%s)', async wrapped => {
    const orders = [
      { id: 9, status: 'PENDING', pre_order_items: [
        { id: 20, product_id: 3, quantity: 2, unit_price: 12.5, product: { product_code: 'P3', product_name: 'Filter', unit: { unit_name: 'piece' } } },
        { id: 21, product_id: 4, quantity: 1, unit_price: 10, product_code: 'SNAP', product_name: 'Snapshot', unit: 'box' },
        { id: 22, product_id: 5, quantity: 1, unit_price: 0 },
      ] },
      { id: 10, status: 'COMPLETED', pre_order_items: [{ id: 99 }] },
      { id: 11, status: 'PENDING', pre_order_items: null },
    ];
    vi.mocked(apiClient.get).mockResolvedValue({ data: wrapped ? { data: orders } : orders });
    await expect(poService.getPendingPreorders()).resolves.toEqual([
      { id: 20, pre_order_id: 9, product_id: 3, quantity: 2, unit_price: 12.5, product_code: 'P3', product_name: 'Filter', unit: 'piece' },
      { id: 21, pre_order_id: 9, product_id: 4, quantity: 1, unit_price: 10, product_code: 'SNAP', product_name: 'Snapshot', unit: 'box' },
      { id: 22, pre_order_id: 9, product_id: 5, quantity: 1, unit_price: 0, product_code: '-', product_name: 'รหัสสินค้า: 5', unit: 'ไม่ระบุ' },
    ]);
    expect(apiClient.get).toHaveBeenCalledWith('/wms/pre-orders/for-po-selection', { params: { status: 'PENDING' } });
  });

  it('calculates stock-alert subtotals and supplies missing local IDs and quantities', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [
      { id: 10, product_id: 3, quantity: 4, unit_price: 12.5 },
      { product_id: 4, unit_price: 20 },
    ] });
    const items = await poService.getStockAlertsBySupplier(7);
    expect(items).toEqual([
      expect.objectContaining({ id: 10, quantity: 4, sub_total: 50, order_type: 'สั่งซื้อ' }),
      expect.objectContaining({ id: expect.any(Number), quantity: 1, sub_total: 20 }),
    ]);
    expect(apiClient.get).toHaveBeenCalledWith('/wms/stock-alerts', { params: { supplier_id: 7 } });
  });

  it.each([
    ['details', () => poService.getPurchaseOrderById(42), '/po/42'],
    ['summary', () => poService.getPurchaseOrderSummary(), '/po/summary'],
    ['delivery estimate', () => poService.getSupplierDeliveryEstimate(7), '/po/suppliers/7/delivery-estimate'],
    ['monthly count', () => poService.getMonthlyCount(), '/po/monthly-count'],
  ] as const)('unwraps %s responses', async (_name, run, endpoint) => {
    const data = { id: 42 };
    vi.mocked(apiClient.get).mockResolvedValue({ data });
    await expect(run()).resolves.toEqual(data);
    expect(apiClient.get).toHaveBeenCalledWith(endpoint);
  });

  it('extracts available years', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { years: [2026, 2025] } });
    await expect(poService.getAvailableYears()).resolves.toEqual([2026, 2025]);
    expect(apiClient.get).toHaveBeenCalledWith('/po/available-years');
  });

  it.each([
    ['list', () => poService.getPurchaseOrders({ page: 1, limit: 10 })],
    ['create', () => poService.createPurchaseOrder(payload)],
    ['edit', () => poService.updatePurchaseOrder(42, { notes: 'Edited' })],
    ['delete', () => poService.deletePurchaseOrder(42)],
    ['status', () => poService.updatePOStatus(42, 'APPROVED')],
    ['restore', () => poService.restorePurchaseOrder(42)],
    ['search', () => poService.searchProduct('Filter', 7)],
    ['preorders', () => poService.getPendingPreorders()],
    ['PDF', () => poService.printPurchaseOrder(42, true)],
  ] as const)('propagates %s failures to the UI', async (_name, run) => {
    const error = new Error('Network unavailable');
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) vi.mocked(apiClient[method]).mockRejectedValue(error);
    await expect(run()).rejects.toBe(error);
  });
});
