import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReturnDetailPage from './return_detail';
import { deferred, salesReturn } from '../../../test/returnFixtures';
import type { SalesReturn } from '../../../interface/return/return_interface';

const mocks = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), refund: vi.fn(), toast: vi.fn() }));
vi.mock('../../../service/http/return/return_service', () => ({ returnService: { getReturnById: mocks.get, updateSalesReturn: mocks.update, processRefund: mocks.refund } }));
vi.mock('../../../components/elements/toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));

function renderDetail(role = 'OWNER') {
  localStorage.setItem('role', role);
  const area = role === 'EMPLOYEE' ? 'employee' : 'owner';
  render(<MemoryRouter initialEntries={[`/${area}/returns/81`]}><Routes>
    <Route path="/:area/returns/:id" element={<ReturnDetailPage />} />
    <Route path="/:area/returns" element={<p>กลับรายการคืนสินค้าแล้ว</p>} />
  </Routes></MemoryRouter>);
  return userEvent.setup();
}

describe('Return detail', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    mocks.get.mockResolvedValue(structuredClone(salesReturn));
  });

  it('loads the requested return and maps customer, quantities, amounts and per-product reasons', async () => {
    const pending = deferred<SalesReturn>();
    mocks.get.mockReturnValue(pending.promise);
    renderDetail();
    expect(screen.getByText('กำลังโหลดข้อมูลใบคืนสินค้า...')).toBeInTheDocument();
    await act(async () => { pending.resolve(salesReturn); });
    expect(mocks.get).toHaveBeenCalledExactlyOnceWith(81);
    expect(screen.getByText('ลูกค้าทดสอบ')).toBeInTheDocument();
    expect(screen.getByText('0812345678')).toBeInTheDocument();
    expect(screen.getByText('รวม 3 ชิ้น')).toBeInTheDocument();
    const first = within(screen.getByRole('row', { name: /กรองน้ำมัน/ }));
    const second = within(screen.getByRole('row', { name: /ผ้าเบรก/ }));
    expect(first.getByText('ผิดรุ่น')).toBeInTheDocument();
    expect(first.getByText('฿ 300.50')).toBeInTheDocument();
    expect(second.getByText('ชำรุด')).toBeInTheDocument();
    expect(second.getAllByText('฿ 299.50')).toHaveLength(2);
  });

  it.each(['OWNER', 'ADMIN'])('allows %s to approve or reject a pending return', async role => {
    renderDetail(role);
    expect(await screen.findByRole('button', { name: 'อนุมัติคืนเงินสำเร็จ' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'ปฏิเสธคำขอคืนเงิน' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'ดำเนินการคืนเงินจริง' })).not.toBeInTheDocument();
  });

  it.each(['EMPLOYEE', 'CUSTOMER', ''])('does not show pending approval actions to %s', async role => {
    renderDetail(role);
    await screen.findByText('สิทธิ์การอนุมัติเฉพาะผู้จัดการหรือเจ้าของร้าน');
    expect(screen.queryByRole('button', { name: 'อนุมัติคืนเงินสำเร็จ' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ปฏิเสธคำขอคืนเงิน' })).not.toBeInTheDocument();
  });

  it.each([
    { button: 'อนุมัติคืนเงินสำเร็จ', status: 'APPROVED' },
    { button: 'ปฏิเสธคำขอคืนเงิน', status: 'REJECTED' },
  ] as const)('submits $status once and returns to the list after success', async ({ button, status }) => {
    const pending = deferred<SalesReturn>();
    mocks.update.mockReturnValue(pending.promise);
    const user = renderDetail();
    const control = await screen.findByRole('button', { name: button });
    await user.dblClick(control);
    expect(control).toBeDisabled();
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith(81, { status });
    expect(mocks.refund).not.toHaveBeenCalled();
    await act(async () => { pending.resolve({ ...salesReturn, status }); });
    expect(await screen.findByText('กลับรายการคืนสินค้าแล้ว')).toBeInTheDocument();
  });

  it('keeps a pending return actionable and reports a failed approval without navigating', async () => {
    mocks.update.mockRejectedValue({ response: { data: { error: 'รายการถูกดำเนินการแล้ว' } } });
    const user = renderDetail();
    await user.click(await screen.findByRole('button', { name: 'อนุมัติคืนเงินสำเร็จ' }));
    await waitFor(() => expect(window.alert).toHaveBeenCalledExactlyOnceWith('รายการถูกดำเนินการแล้ว'));
    expect(screen.getByRole('button', { name: 'อนุมัติคืนเงินสำเร็จ' })).toBeEnabled();
    expect(screen.queryByText('กลับรายการคืนสินค้าแล้ว')).not.toBeInTheDocument();
  });

  it.each(['OWNER', 'EMPLOYEE', 'ADMIN'])('lets %s refund an approved return only after the existing confirmation', async role => {
    mocks.get.mockResolvedValue({ ...salesReturn, status: 'APPROVED' });
    const pending = deferred<SalesReturn>();
    mocks.refund.mockReturnValue(pending.promise);
    const user = renderDetail(role);
    await user.click(await screen.findByRole('button', { name: 'ดำเนินการคืนเงินจริง' }));
    expect(mocks.refund).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'ยกเลิก' }));
    expect(mocks.refund).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'ดำเนินการคืนเงินจริง' }));
    await user.click(screen.getByRole('button', { name: 'ยืนยันคืนเงินจริง' }));
    expect(mocks.refund).toHaveBeenCalledExactlyOnceWith(81);
    expect(screen.getByRole('button', { name: 'ดำเนินการคืนเงินจริง' })).toBeDisabled();
    await act(async () => { pending.resolve({ ...salesReturn, status: 'REFUNDED' }); });
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' })));
    expect(screen.queryByRole('button', { name: 'ดำเนินการคืนเงินจริง' })).not.toBeInTheDocument();
    expect(screen.getByText('สถานะ: คืนเงินจริงแล้ว')).toBeInTheDocument();
  });

  it.each(['REFUNDED', 'REJECTED'] as const)('does not offer further processing for %s', async status => {
    mocks.get.mockResolvedValue({ ...salesReturn, status });
    renderDetail();
    await screen.findByText('ดำเนินการตรวจสอบเสร็จสิ้น');
    expect(screen.queryByRole('button', { name: 'ดำเนินการคืนเงินจริง' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'อนุมัติคืนเงินสำเร็จ' })).not.toBeInTheDocument();
  });

  it('does not show refund actions to a customer even when approved', async () => {
    mocks.get.mockResolvedValue({ ...salesReturn, status: 'APPROVED' });
    renderDetail('CUSTOMER');
    await screen.findByText('ดำเนินการตรวจสอบเสร็จสิ้น');
    expect(screen.queryByRole('button', { name: 'ดำเนินการคืนเงินจริง' })).not.toBeInTheDocument();
  });

  it('does not mark a failed refund as refunded or show success', async () => {
    mocks.get.mockResolvedValue({ ...salesReturn, status: 'APPROVED' });
    mocks.refund.mockRejectedValue({ response: { data: { error: 'ยอดคืนเกินยอดขาย' } } });
    const user = renderDetail('EMPLOYEE');
    await user.click(await screen.findByRole('button', { name: 'ดำเนินการคืนเงินจริง' }));
    await user.click(screen.getByRole('button', { name: 'ยืนยันคืนเงินจริง' }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error', message: 'ยอดคืนเกินยอดขาย' })));
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
    expect(screen.getByRole('button', { name: 'ดำเนินการคืนเงินจริง' })).toBeEnabled();
    expect(screen.getByText('สถานะ: อนุมัติแล้ว')).toBeInTheDocument();
  });

  it.each(['not_found', 'request_failure'])('handles $0 without displaying stale details', async failure => {
    if (failure === 'not_found') mocks.get.mockResolvedValue(null);
    else mocks.get.mockRejectedValue(new Error('Unavailable'));
    const user = renderDetail('EMPLOYEE');
    await screen.findByText('ไม่พบข้อมูลใบคืนสินค้าที่คุณระบุ');
    await user.click(screen.getByRole('button', { name: 'กลับหน้าหลัก' }));
    expect(await screen.findByText('กลับรายการคืนสินค้าแล้ว')).toBeInTheDocument();
  });
});
