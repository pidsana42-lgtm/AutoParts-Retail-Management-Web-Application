import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as service from './import_service';
import { importItem, importProduct, importSupplier, savedImport, scannedImport } from '../../../test/importFixtures';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), fallback: vi.fn() }));
vi.mock('../apiClient', () => ({ default: http }));
vi.mock('axios', () => ({ default: { post: http.fallback } }));

describe('Import frontend HTTP service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  const lists = [
    { name: 'bills', call: service.getBills, path: '/import-data/bills', item: savedImport() },
    { name: 'suppliers', call: service.getSuppliers, path: '/wms/suppliers', item: importSupplier },
    { name: 'products', call: service.getProducts, path: '/wms/products', item: importProduct },
  ];
  it.each(lists)('loads $name from both direct and wrapped API responses', async ({ call, path, item }) => {
    for (const data of [[item], { data: [item] }]) {
      http.get.mockResolvedValueOnce({ data });
      expect(await call()).toEqual([item]);
      expect(http.get).toHaveBeenLastCalledWith(path);
    }
  });
  it.each(lists)('returns an empty list for absent $name and reports server failures', async ({ call }) => {
    http.get.mockResolvedValueOnce({ data: null });
    expect(await call()).toEqual([]);
    http.get.mockRejectedValueOnce({ response: { data: { error: 'ไม่มีสิทธิ์' } } });
    await expect(call()).rejects.toThrow('ไม่มีสิทธิ์');
  });

  it('uploads the actual File as multipart data with the OCR timeout, without calling fallback on success', async () => {
    const file = new File(['bill'], 'invoice.pdf', { type: 'application/pdf' });
    http.post.mockResolvedValue({ data: scannedImport() });
    expect(await service.scanBill(file)).toEqual(scannedImport());
    expect(http.post).toHaveBeenCalledExactlyOnceWith('/ocr/extract-invoice/upload', expect.any(FormData), {
      headers: { 'Content-Type': 'multipart/form-data' }, timeout: 300000,
    });
    expect(http.post.mock.calls[0][1].get('file')).toBe(file);
    expect(http.fallback).not.toHaveBeenCalled();
  });
  it.each(['network failure', 'error response'])('uses the OCR fallback after a primary %s', async kind => {
    if (kind === 'network failure') http.post.mockRejectedValue(new Error('offline'));
    else http.post.mockResolvedValue({ data: { error: 'OCR unavailable' } });
    http.fallback.mockResolvedValue({ data: scannedImport() });
    expect(await service.scanBill(new File(['bill'], 'bill.jpg'))).toEqual(scannedImport());
    expect(http.fallback).toHaveBeenCalledExactlyOnceWith('/ocr/api/extract-invoice/upload', http.post.mock.calls[0][1], expect.objectContaining({ timeout: 300000 }));
  });
  it.each([
    { response: { data: { detail: 'ไฟล์เสีย' } } },
    { response: { data: { error: 'ไฟล์เสีย' } } },
    new Error('ไฟล์เสีย'),
  ])('reports OCR fallback failures instead of successful scan data (%#)', async failure => {
    http.post.mockRejectedValue(new Error('offline'));
    http.fallback.mockRejectedValue(failure);
    await expect(service.scanBill(new File(['bill'], 'bill.jpg'))).rejects.toThrow('ไฟล์เสีย');
  });
  it('rejects an error returned inside a successful fallback HTTP response', async () => {
    http.post.mockRejectedValue(new Error('offline'));
    http.fallback.mockResolvedValue({ data: { error: 'อ่านบิลไม่ได้' } });
    await expect(service.scanBill(new File(['bill'], 'bill.jpg'))).rejects.toThrow('อ่านบิลไม่ได้');
  });

  const payload = { bill: scannedImport(), items: [{ ...importItem }] };
  const writes = [
    { name: 'confirm', method: 'post', args: ['/import-data/bill-import-jobs/91/confirm', payload], call: () => service.confirmBillImport(91, payload) },
    { name: 'update', method: 'put', args: ['/import-data/bills/51', payload], call: () => service.updateBill(51, payload) },
    { name: 'delete', method: 'delete', args: ['/import-data/bills/51'], call: () => service.deleteBill(51) },
    { name: 'cost price', method: 'put', args: ['/import-data/products/21/cost-price', { cost_price: 120 }], call: () => service.updateProductCostPrice(21, 120) },
    { name: 'product', method: 'put', args: ['/import-data/products/21', { product_name: 'แก้ไข' }], call: () => service.updateImportProduct(21, { product_name: 'แก้ไข' }) },
  ] as const;
  it.each(writes)('$name sends the expected endpoint and payload', async ({ method, args, call }) => {
    http[method].mockResolvedValue({ data: { success: true } });
    expect(await call()).toEqual({ success: true });
    expect(http[method]).toHaveBeenCalledExactlyOnceWith(...args);
  });
  it.each(writes)('$name preserves the API error message', async ({ method, call }) => {
    http[method].mockRejectedValue({ response: { data: { error: 'ข้อมูลไม่ถูกต้อง' } } });
    await expect(call()).rejects.toThrow('ข้อมูลไม่ถูกต้อง');
  });
  it('approves a bill while preserving its amounts, image and item data', async () => {
    http.put.mockResolvedValue({ data: { success: true } });
    await service.approveBill(51, savedImport());
    expect(http.put).toHaveBeenCalledExactlyOnceWith('/import-data/bills/51', {
      bill: expect.objectContaining({ bill_no: 'INV-TEST-001', payment_status: 'approved', is_verified: true, grand_total: 214, supplier_id: 7, bill_image_id: 81 }),
      items: [importItem],
    });
  });
  it('falls back across PO endpoints and unwraps the first successful response', async () => {
    http.get.mockRejectedValueOnce(new Error('404')).mockResolvedValueOnce({ data: { data: [{ id: 11 }] } });
    expect(await service.getPurchaseOrders()).toEqual([{ id: 11 }]);
    expect(http.get.mock.calls).toEqual([['/po/get-all-po'], ['/import-data/purchase-orders']]);
    http.get.mockReset().mockRejectedValueOnce(new Error('404')).mockResolvedValueOnce({ data: { data: { id: 11 } } });
    expect(await service.getPurchaseOrderById(11)).toEqual({ id: 11 });
    expect(http.get.mock.calls).toEqual([['/po/11'], ['/import-data/purchase-orders/11']]);
  });
  it('returns empty PO results when every endpoint fails', async () => {
    http.get.mockRejectedValue(new Error('offline'));
    expect(await service.getPurchaseOrders()).toEqual([]);
    expect(await service.getPurchaseOrderById(11)).toBeNull();
    expect(http.get).toHaveBeenCalledTimes(6);
  });
  it.each([
    [undefined, null], [null, null], ['  ', null], ['uploads/bill.jpg', '/uploads/bill.jpg'],
    ['/uploads/bill.jpg', '/uploads/bill.jpg'], [' https://example.test/bill.jpg ', 'https://example.test/bill.jpg'],
    ['blob:invoice', 'blob:invoice'], ['data:image/png;base64,abc', 'data:image/png;base64,abc'],
  ])('resolves image path %s safely for display', (input, expected) => {
    expect(service.resolveImageUrl(input)).toBe(expected);
  });
});
