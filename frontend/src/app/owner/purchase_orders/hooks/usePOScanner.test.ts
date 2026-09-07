import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePoScanner } from './usePOScanner';
import { poService } from '../../../../service/http/purchase_orders/po_service';
import type { LocalPOItem, ProductSearchResponse } from '../../../../interface/purchase_orders/po_interface';

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('../../../../components/elements/toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('../../../../service/http/purchase_orders/po_service', () => ({ poService: { searchProduct: vi.fn() } }));
const product: ProductSearchResponse = { id: 3, code: 'P3', barcode: '123', name: 'Filter', price: 12.5, unit: 'piece', stock_qty: 0 };
const existing: LocalPOItem = { id: 10, product_id: 3, product_name_snapshot: 'Filter', product_name_code_snapshot: 'P3', quantity: 2, unit: 'piece', unit_price: 10, sub_total: 20, order_type: 'สั่งซื้อ' };

function setup(supplier = '7', initial: LocalPOItem[] = []) {
  return renderHook(() => {
    const [items, setItems] = useState(initial);
    return { ...usePoScanner(supplier, items, setItems), items };
  });
}

describe('Purchase product scanner', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.useFakeTimers(); vi.mocked(poService.searchProduct).mockResolvedValue([product]); });
  afterEach(() => vi.useRealTimers());

  it('debounces typing and searches only the latest keyword', async () => {
    const { result } = setup();
    act(() => result.current.handleSearchInput('F'));
    await act(() => vi.advanceTimersByTimeAsync(200));
    act(() => result.current.handleSearchInput('Filter'));
    await act(() => vi.advanceTimersByTimeAsync(299));
    expect(poService.searchProduct).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(poService.searchProduct).toHaveBeenCalledExactlyOnceWith('Filter', '7');
    expect(result.current.searchResults).toEqual([product]);
    expect(result.current.isSearching).toBe(false);
  });

  it('ignores an older search response arriving after a newer response', async () => {
    let resolveOld!: (items: ProductSearchResponse[]) => void;
    vi.mocked(poService.searchProduct).mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }));
    const { result } = setup();
    act(() => result.current.handleSearchInput('old'));
    await act(() => vi.advanceTimersByTimeAsync(300));
    act(() => result.current.handleSearchInput('new'));
    await act(() => vi.advanceTimersByTimeAsync(300));
    await act(async () => resolveOld([{ ...product, id: 99, name: 'Old' }]));
    expect(result.current.searchResults).toEqual([product]);
  });

  it('requires a supplier before scanning', async () => {
    const { result } = setup('');
    await act(() => result.current.handleCameraScan('123'));
    expect(poService.searchProduct).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error', message: expect.stringContaining('ผู้จัดจำหน่าย') }));
  });

  it('prefers the exact barcode match over the first search result', async () => {
    vi.mocked(poService.searchProduct).mockResolvedValue([{ ...product, id: 4, code: 'P4', barcode: '456' }, product]);
    const { result } = setup();
    await act(() => result.current.handleCameraScan(' 123 '));
    expect(poService.searchProduct).toHaveBeenCalledWith('123', '7');
    expect(result.current.selectedProduct).toEqual(product);
    expect(result.current.items).toEqual([]);
  });

  it('reports missing barcode products', async () => {
    vi.mocked(poService.searchProduct).mockResolvedValue([]);
    const { result } = setup();
    await act(() => result.current.handleCameraScan('missing'));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ message: 'ไม่พบสินค้ารหัส: missing', variant: 'error' }));
    expect(result.current.isSearching).toBe(false);
  });

  it('ends the loading state when searching fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(poService.searchProduct).mockRejectedValue(new Error('offline'));
    const { result } = setup();
    act(() => result.current.handleSearchInput('Filter'));
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(result.current.isSearching).toBe(false);
    expect(result.current.items).toEqual([]);
  });

  it('requires a selected product before adding', () => {
    const { result } = setup();
    act(() => result.current.handleAddItem());
    expect(result.current.items).toEqual([]);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('เลือกสินค้า'), variant: 'error' }));
  });

  it.each([0, -1, ''] as const)('rejects invalid quantity %s', quantity => {
    const { result } = setup();
    act(() => { result.current.handleSelectProduct(product); result.current.setAddQuantity(quantity); });
    act(() => result.current.handleAddItem());
    expect(result.current.items).toEqual([]);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ message: 'กรุณาระบุจำนวนสินค้าให้ถูกต้อง', variant: 'error' }));
  });

  it('adds an item, calculates its subtotal, and clears the selection', () => {
    const { result } = setup();
    act(() => { result.current.handleSelectProduct(product); result.current.setAddQuantity(3); });
    act(() => result.current.handleAddItem());
    expect(result.current.items).toEqual([expect.objectContaining({ product_id: 3, quantity: 3, unit_price: 12.5, sub_total: 37.5, order_type: 'สั่งซื้อ' })]);
    expect(result.current.selectedProduct).toBeNull();
    expect(result.current.searchInput).toBe('');
  });

  it.each([true, false])('requires confirmation before merging duplicate quantities (confirm=%s)', confirm => {
    const { result } = setup('7', [existing]);
    act(() => { result.current.handleSelectProduct(product); result.current.setAddQuantity(3); });
    act(() => result.current.handleAddItem());
    expect(result.current.items).toEqual([existing]);
    expect(result.current.duplicatePrompt).toEqual(expect.objectContaining({ existingQty: 2, addQty: 3 }));
    act(() => confirm ? result.current.confirmDuplicateAdd() : result.current.cancelDuplicateAdd());
    expect(result.current.duplicatePrompt).toBeNull();
    expect(result.current.items).toEqual([{ ...existing, quantity: confirm ? 5 : 2, sub_total: confirm ? 50 : 20 }]);
  });

  it('keeps a purchase separate from an existing preorder of the same product', () => {
    const preorder: LocalPOItem = { ...existing, order_type: 'พรีออเดอร์', pre_order_item_id: 20 };
    const { result } = setup('7', [preorder]);
    act(() => { result.current.handleSelectProduct(product); result.current.setAddQuantity(1); });
    act(() => result.current.handleAddItem());
    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0]).toEqual(preorder);
    expect(result.current.items[1]).toEqual(expect.objectContaining({ order_type: 'สั่งซื้อ', sub_total: 12.5 }));
    expect(result.current.duplicatePrompt).toBeNull();
  });
});
