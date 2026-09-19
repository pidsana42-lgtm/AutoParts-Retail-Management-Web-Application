import { useState } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LocalPOItem, PreorderItem } from '../../../../interface/purchase_orders/po_interface';
import { validatePurchaseOrder } from '../validation';
import { usePreorders } from './usePreorder';

vi.mock('../../../../service/http/purchase_orders/po_service', () => ({
  poService: { getPendingPreorders: vi.fn().mockResolvedValue([]) },
}));

describe('manual preorders added to a PO', () => {
  it('allows multiple unlinked items, retains zero estimates and rejects only duplicate preorder IDs', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { result } = renderHook(() => {
      const [items, setItems] = useState<LocalPOItem[]>([]);
      const [, setOpen] = useState(false);
      return { items, ...usePreorders(items, setItems, setOpen) };
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const first: PreorderItem = { id: 8, product_id: null, product_name: 'ekdmlkdmskl', product_code: '', supplier_part_code: '', quantity: 2, unit: 'ชิ้น', unit_price: 0 };
    act(() => result.current.handleAddPreorderToPO(first));
    act(() => result.current.handleAddPreorderToPO({ ...first, id: 9, product_name: 'Turbocharger' }));
    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0]).toMatchObject({ product_id: 0, pre_order_item_id: 8, unit_price: 0, sub_total: 0 });
    expect(validatePurchaseOrder(7, result.current.items)).toEqual([]);
    act(() => result.current.handleAddPreorderToPO(first));
    expect(result.current.items).toHaveLength(2);
    expect(alert).toHaveBeenCalledTimes(1);
  });
});
