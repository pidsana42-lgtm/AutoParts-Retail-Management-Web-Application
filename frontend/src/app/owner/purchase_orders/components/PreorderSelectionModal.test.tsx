import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PreorderSelectionModal } from './PreorderSelectionModal';
import { usePreorders } from '../hooks/usePreorder';
import { poService } from '../../../../service/http/purchase_orders/po_service';
import type { LocalPOItem, PreorderItem } from '../../../../interface/purchase_orders/po_interface';

vi.mock('../../../../service/http/purchase_orders/po_service', () => ({ poService: { getPendingPreorders: vi.fn() } }));
const preorder: PreorderItem = { id: 20, product_id: 3, product_code: 'P3', product_name: 'Oil filter', quantity: 2, unit_price: 12.5, unit: 'piece' };

// Exercise the real modal and hook together with React state; only the API is mocked.
function PurchasePreorderHarness() {
  const [items, setItems] = useState<LocalPOItem[]>([]);
  const [open, setOpen] = useState(false);
  const { preorders, isLoading, error, handleAddPreorderToPO } = usePreorders(items, setItems, setOpen);
  return <>
    <button onClick={() => setOpen(true)}>เลือกพรีออเดอร์</button>
    {isLoading && <p role="status">กำลังโหลด</p>}
    {error && <p role="alert">{error}</p>}
    <div data-testid="items">{JSON.stringify(items)}</div>
    <PreorderSelectionModal isOpen={open} onClose={() => setOpen(false)} preorders={preorders} onSelectPreorder={handleAddPreorderToPO} />
  </>;
}

describe('Purchase preorder selection', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.mocked(poService.getPendingPreorders).mockResolvedValue([preorder]); });

  it('hides the modal until opened', async () => {
    render(<PurchasePreorderHarness />);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(screen.queryByText('เลือกรายการพรีออเดอร์')).not.toBeInTheDocument();
  });

  it('shows preorder data and adds the selected item with its link and subtotal', async () => {
    const user = userEvent.setup();
    render(<PurchasePreorderHarness />);
    await user.click(screen.getByRole('button', { name: 'เลือกพรีออเดอร์' }));
    expect(await screen.findByText('Oil filter')).toBeInTheDocument();
    expect(screen.getByText('P3')).toBeInTheDocument();
    expect(screen.getByText('12.5 ฿')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'เพิ่ม' }));
    expect(JSON.parse(screen.getByTestId('items').textContent!)).toEqual([expect.objectContaining({ product_id: 3, pre_order_item_id: 20, quantity: 2, unit_price: 12.5, sub_total: 25, order_type: 'พรีออเดอร์' })]);
    expect(screen.queryByText('เลือกรายการพรีออเดอร์')).not.toBeInTheDocument();
  });

  it('prevents adding the same product twice', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<PurchasePreorderHarness />);
    await user.click(screen.getByRole('button', { name: 'เลือกพรีออเดอร์' }));
    await user.click(await screen.findByRole('button', { name: 'เพิ่ม' }));
    await user.click(screen.getByRole('button', { name: 'เลือกพรีออเดอร์' }));
    await user.click(screen.getByRole('button', { name: 'เพิ่ม' }));
    expect(alert).toHaveBeenCalledWith('มีรายการ "Oil filter" อยู่ในใบสั่งซื้อแล้ว');
    expect(JSON.parse(screen.getByTestId('items').textContent!)).toHaveLength(1);
    expect(screen.getByText('เลือกรายการพรีออเดอร์')).toBeInTheDocument();
  });

  it('shows an empty state when there are no pending preorders', async () => {
    vi.mocked(poService.getPendingPreorders).mockResolvedValue([]);
    const user = userEvent.setup();
    render(<PurchasePreorderHarness />);
    await user.click(screen.getByRole('button', { name: 'เลือกพรีออเดอร์' }));
    expect(await screen.findByText('ไม่มีรายการพรีออเดอร์ค้างอยู่ในระบบ')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'เพิ่ม' })).not.toBeInTheDocument();
  });

  it.each([new Error('Network unavailable'), 'unknown failure'])('exposes loading failures and clears loading state: %s', async error => {
    vi.mocked(poService.getPendingPreorders).mockRejectedValue(error);
    render(<PurchasePreorderHarness />);
    expect(await screen.findByRole('alert')).toHaveTextContent(error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการดึงข้อมูลพรีออเดอร์');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(JSON.parse(screen.getByTestId('items').textContent!)).toEqual([]);
  });
});
