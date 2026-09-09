import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NewReturnPage from './new_return';
import { deferred, returnableOrder, salesReturn } from '../../../test/returnFixtures';
import type { SalesReturn } from '../../../interface/return/return_interface';

const mocks = vi.hoisted(() => ({ search: vi.fn(), create: vi.fn(), toast: vi.fn() }));
vi.mock('../../../service/http/return/return_service', () => ({ returnService: { searchReturnableSaleOrders: mocks.search, createSalesReturn: mocks.create } }));
vi.mock('../../../components/elements/toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));

function renderNew(role = 'EMPLOYEE') {
  localStorage.setItem('role', role);
  const area = role === 'OWNER' ? 'owner' : 'employee';
  render(<MemoryRouter initialEntries={[`/${area}/returns/new-return`]}><Routes>
    <Route path="/:area/returns/new-return" element={<NewReturnPage />} />
    <Route path="/:area/returns" element={<p>กลับรายการคืนสินค้าแล้ว</p>} />
  </Routes></MemoryRouter>);
  return userEvent.setup();
}

async function chooseOrder(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText('INV-XXXX-XXXX'), 'SO-TEST{Enter}');
  await user.click(await screen.findByRole('button', { name: /SO-TEST-0041/ }));
}

function productRow(name = 'กรองน้ำมัน') {
  return within(screen.getByRole('row', { name: new RegExp(name) }));
}

async function chooseFirstAndContinue(user: ReturnType<typeof userEvent.setup>) {
  await chooseOrder(user);
  await user.click(productRow().getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: 'ขั้นตอนถัดไป' }));
}

async function fillDetails(user: ReturnType<typeof userEvent.setup>) {
  for (const placeholder of ['เลือกหรือพิมพ์เหตุผล...', 'เลือกหรือพิมพ์สภาพสินค้า...']) {
    while (screen.queryAllByText(placeholder).length) {
      await user.click(screen.getAllByText(placeholder)[0]);
      await user.click(screen.getByRole('button', { name: placeholder.includes('เหตุผล') ? 'ส่งสินค้าผิดรุ่น/ผิดสเปก' : 'ยังไม่แกะกล่อง' }));
    }
  }
}

describe('New return', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.search.mockResolvedValue(structuredClone([returnableOrder]));
    mocks.create.mockResolvedValue(salesReturn);
  });
  afterEach(() => { vi.useRealTimers(); });

  it('requires a sale order and at least one checked product before continuing', async () => {
    const user = renderNew();
    expect(screen.getByRole('button', { name: 'ขั้นตอนถัดไป' })).toBeDisabled();
    await chooseOrder(user);
    expect(mocks.search).toHaveBeenCalledExactlyOnceWith('SO-TEST');
    expect(screen.getByRole('button', { name: 'ขั้นตอนถัดไป' })).toBeDisabled();
    expect(productRow().getByRole('textbox')).toBeDisabled();
    await user.click(productRow().getByRole('checkbox'));
    expect(productRow().getByRole('textbox')).toHaveValue('1');
    expect(screen.getByRole('button', { name: 'ขั้นตอนถัดไป' })).toBeEnabled();
    await user.click(productRow().getByRole('checkbox'));
    expect(productRow().getByRole('textbox')).toHaveValue('0');
    expect(screen.getByRole('button', { name: 'ขั้นตอนถัดไป' })).toBeDisabled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('clamps typed return quantities to one through the quantity sold', async () => {
    const user = renderNew();
    await chooseOrder(user);
    await user.click(productRow().getByRole('checkbox'));
    const quantity = productRow().getByRole('textbox');
    await user.clear(quantity);
    await user.type(quantity, '999');
    await user.tab();
    expect(quantity).toHaveValue('3');
    expect(productRow().getAllByRole('button')[1]).toBeDisabled();
    await user.clear(quantity);
    await user.tab();
    expect(quantity).toHaveValue('1');
    expect(productRow().getAllByRole('button')[0]).toBeDisabled();
  });

  it('requires a reason and condition for every returned piece', async () => {
    const user = renderNew();
    await chooseOrder(user);
    await user.click(productRow().getByRole('checkbox'));
    await user.click(productRow().getAllByRole('button')[1]);
    await user.click(screen.getByRole('button', { name: 'ขั้นตอนถัดไป' }));
    const submit = screen.getByRole('button', { name: 'ส่งคำขออนุมัติ' });
    expect(submit).toBeDisabled();
    await user.click(screen.getAllByText('เลือกหรือพิมพ์เหตุผล...')[0]);
    await user.click(screen.getByRole('button', { name: 'ส่งสินค้าผิดรุ่น/ผิดสเปก' }));
    await user.click(screen.getAllByText('เลือกหรือพิมพ์สภาพสินค้า...')[0]);
    await user.click(screen.getByRole('button', { name: 'ยังไม่แกะกล่อง' }));
    expect(submit).toBeDisabled();
    await fillDetails(user);
    expect(submit).toBeEnabled();
    await user.click(submit);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      refund_amount: 300.5,
      sales_return_items: [expect.objectContaining({ quantity: 2, reason: 'ชิ้นที่ 1: ส่งสินค้าผิดรุ่น/ผิดสเปก [ยังไม่แกะกล่อง], ชิ้นที่ 2: ส่งสินค้าผิดรุ่น/ผิดสเปก [ยังไม่แกะกล่อง]' })],
    }));
  });

  it.each([
    { role: 'OWNER', button: 'อนุมัติการคืนสินค้า' },
    { role: 'EMPLOYEE', button: 'ส่งคำขออนุมัติ' },
  ])('submits correct items, amount and method for $role without client approval fields', async ({ role, button }) => {
    const user = renderNew(role);
    await chooseFirstAndContinue(user);
    await fillDetails(user);
    await user.click(screen.getByRole('radio', { name: 'โอนเงิน (Transfer)' }));
    await user.type(screen.getByPlaceholderText('ระบุหมายเหตุเพิ่มเติมของใบคืนสินค้า (ถ้ามี)'), '  กล่องครบ  ');
    const pending = deferred<SalesReturn>();
    mocks.create.mockReturnValue(pending.promise);
    const submit = screen.getByRole('button', { name: button });
    await user.dblClick(submit);
    expect(submit).toBeDisabled();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    const payload = mocks.create.mock.calls[0][0];
    expect(payload).toEqual({
      original_order_id: 41, return_date: expect.any(String), requested_at: expect.any(String),
      reason: 'กรองน้ำมัน: ส่งสินค้าผิดรุ่น/ผิดสเปก (ยังไม่แกะกล่อง)', note: 'กล่องครบ',
      refund_amount: 150.25, refund_method: 'TRANSFER',
      sales_return_items: [{ product_id: 101, product_name: 'กรองน้ำมัน', product_code: 'FILTER-101', quantity: 1, unit_price: 150.25, reason: 'ส่งสินค้าผิดรุ่น/ผิดสเปก [ยังไม่แกะกล่อง]' }],
    });
    expect(Number.isNaN(Date.parse(payload.return_date))).toBe(false);
    await act(async () => { pending.resolve(salesReturn); });
    expect(await screen.findByText('กลับรายการคืนสินค้าแล้ว')).toBeInTheDocument();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success', message: expect.stringContaining('RTN-TEST-0081') }));
  });

  it.each([true, false])('permits store credit only for registered customers: %s', async registered => {
    mocks.search.mockResolvedValue([{ ...returnableOrder, customer_id: registered ? 8 : undefined }]);
    const user = renderNew();
    await chooseFirstAndContinue(user);
    const credit = screen.getByRole('radio', { name: 'เครดิต (Store Credit)' });
    if (registered) {
      expect(credit).toBeEnabled();
      await user.click(credit);
      expect(credit).toBeChecked();
      await fillDetails(user);
      await user.click(screen.getByRole('button', { name: 'ส่งคำขออนุมัติ' }));
      expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ refund_method: 'STORE_CREDIT' }));
    } else {
      expect(credit).toBeDisabled();
      expect(screen.getByRole('radio', { name: 'เงินสด (Cash)' })).toBeChecked();
    }
  });

  it('invalidates the old selected products when the receipt search is edited', async () => {
    const user = renderNew();
    await chooseOrder(user);
    await user.click(productRow().getByRole('checkbox'));
    await user.type(screen.getByPlaceholderText('INV-XXXX-XXXX'), 'X');
    expect(screen.queryByRole('row', { name: /กรองน้ำมัน/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ขั้นตอนถัดไป' })).toBeDisabled();
  });

  it('shows search errors without allowing an empty return to be submitted', async () => {
    mocks.search.mockRejectedValue({ response: { data: { message: 'ค้นหาใบขายไม่สำเร็จ' } } });
    const user = renderNew();
    await user.type(screen.getByPlaceholderText('INV-XXXX-XXXX'), 'SO-404{Enter}');
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error', message: 'ค้นหาใบขายไม่สำเร็จ' })));
    expect(screen.getByRole('button', { name: 'ขั้นตอนถัดไป' })).toBeDisabled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('keeps the complete form after a failed submission, even after four seconds, and allows retry', async () => {
    const user = renderNew();
    await chooseFirstAndContinue(user);
    await fillDetails(user);
    await user.type(screen.getByPlaceholderText('ระบุหมายเหตุเพิ่มเติมของใบคืนสินค้า (ถ้ามี)'), 'เก็บข้อมูลไว้ลองใหม่');
    await user.click(screen.getByRole('radio', { name: 'โอนเงิน (Transfer)' }));
    const pending = deferred<SalesReturn>();
    mocks.create.mockReturnValue(pending.promise);
    await user.click(screen.getByRole('button', { name: 'ส่งคำขออนุมัติ' }));
    vi.useFakeTimers();
    await act(async () => { pending.reject(new Error('Write unavailable')); });
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }));
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
    expect(screen.getByRole('button', { name: 'ส่งคำขออนุมัติ' })).toBeEnabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(screen.queryByText('กลับรายการคืนสินค้าแล้ว')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('ระบุหมายเหตุเพิ่มเติมของใบคืนสินค้า (ถ้ามี)')).toHaveValue('เก็บข้อมูลไว้ลองใหม่');
    expect(screen.getByRole('radio', { name: 'โอนเงิน (Transfer)' })).toBeChecked();
    vi.useRealTimers();
    mocks.create.mockResolvedValueOnce(salesReturn);
    await user.click(screen.getByRole('button', { name: 'ส่งคำขออนุมัติ' }));
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.create.mock.calls[1][0]).toMatchObject({
      note: 'เก็บข้อมูลไว้ลองใหม่', refund_method: 'TRANSFER',
      sales_return_items: mocks.create.mock.calls[0][0].sales_return_items,
    });
    expect(await screen.findByText('กลับรายการคืนสินค้าแล้ว')).toBeInTheDocument();
  });
});
