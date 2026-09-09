import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReturnsPage from './returns';
import { deferred, returnsResponse, salesReturn } from '../../../test/returnFixtures';
import type { SalesReturn } from '../../../interface/return/return_interface';

const mocks = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), refund: vi.fn(), toast: vi.fn() }));
vi.mock('../../../service/http/return/return_service', () => ({ returnService: { getReturns: mocks.get, updateSalesReturn: mocks.update, processRefund: mocks.refund } }));
vi.mock('../../../components/elements/toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));

function Destination() { return <p data-testid="destination">{useLocation().pathname}</p>; }
async function openList(role = 'OWNER') {
  localStorage.setItem('role', role);
  const area = role === 'EMPLOYEE' ? 'employee' : 'owner';
  render(<MemoryRouter initialEntries={[`/${area}/returns`]}><Routes>
    <Route path="/:area/returns" element={<ReturnsPage />} />
    <Route path="/:area/returns/:id" element={<Destination />} />
  </Routes></MemoryRouter>);
  await screen.findByRole('row', { name: /RTN-TEST-0081/ });
  return userEvent.setup();
}
function row(number = 'RTN-TEST-0081') { return within(screen.getByRole('row', { name: new RegExp(number) })); }

describe('Return list', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.get.mockResolvedValue(structuredClone(returnsResponse));
  });

  it('requests the first page and displays server totals, amounts and statuses', async () => {
    await openList();
    expect(mocks.get).toHaveBeenCalledWith({ status: undefined, search: undefined, page: 1, page_size: 10 });
    expect(screen.getByText('แสดง 1 ถึง 10 จาก 23 รายการ')).toBeInTheDocument();
    expect(row().getByText('฿ 600.00')).toBeInTheDocument();
    expect(row().getByText('รอดำเนินการ')).toBeInTheDocument();
    expect(row('RTN-TEST-0082').getByText('อนุมัติแล้ว')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: /รายการคืนสินค้าทั้งหมด/ })).getByText('23')).toBeInTheDocument();
  });

  it('resets pagination when filtering by status and when switching workflow tabs', async () => {
    const user = await openList();
    await user.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() => expect(mocks.get).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
    await user.click(screen.getByRole('button', { name: 'สถานะรายการคืน' }));
    await user.click(screen.getByRole('option', { name: 'ปฏิเสธ' }));
    await waitFor(() => expect(mocks.get).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'REJECTED', page: 1 })));
    await user.click(screen.getByRole('button', { name: /รายการคืนสินค้าค้างในระบบ/ }));
    await waitFor(() => expect(mocks.get).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'PENDING', page: 1 })));
    await user.click(screen.getByRole('button', { name: /รายการคืนเงินค้างในระบบ/ }));
    await waitFor(() => expect(mocks.get).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'APPROVED', page: 1 })));
    await user.click(screen.getByRole('button', { name: /รายการคืนสินค้าทั้งหมด/ }));
    await waitFor(() => expect(mocks.get).toHaveBeenLastCalledWith(expect.objectContaining({ status: undefined, page: 1 })));
  });

  it('debounces and trims search, resetting to page one', async () => {
    const user = await openList();
    await user.click(screen.getByRole('button', { name: '2' }));
    mocks.get.mockClear();
    await user.type(screen.getByPlaceholderText('ค้นหาด้วยเลขที่รายการ, ชื่อลูกค้า, สินค้า...'), '  RTN-0081  ');
    expect(mocks.get).not.toHaveBeenCalled();
    await waitFor(() => expect(mocks.get).toHaveBeenCalledExactlyOnceWith({ status: undefined, search: 'RTN-0081', page: 1, page_size: 10 }));
  });

  it('approves only the pending row once and refreshes after success', async () => {
    const user = await openList();
    const pending = deferred<SalesReturn>();
    mocks.update.mockReturnValue(pending.promise);
    const control = row().getByRole('button', { name: 'อนุมัติรายการคืนสินค้า' });
    expect(row('RTN-TEST-0082').queryByRole('button', { name: 'อนุมัติรายการคืนสินค้า' })).not.toBeInTheDocument();
    await user.dblClick(control);
    expect(control).toBeDisabled();
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith(81, { status: 'APPROVED' });
    mocks.get.mockResolvedValue({ ...returnsResponse, data: returnsResponse.data.map(item => ({ ...item, status: 'APPROVED' })) });
    await act(async () => { pending.resolve({ ...salesReturn, status: 'APPROVED' }); });
    await waitFor(() => expect(row().getByText('อนุมัติแล้ว')).toBeInTheDocument());
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
  });

  it('reports approval errors without changing the displayed status', async () => {
    mocks.update.mockRejectedValue({ response: { data: { error: 'ไม่สามารถอนุมัติได้' } } });
    const user = await openList();
    await user.click(row().getByRole('button', { name: 'อนุมัติรายการคืนสินค้า' }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error', message: 'ไม่สามารถอนุมัติได้' })));
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
    expect(row().getByText('รอดำเนินการ')).toBeInTheDocument();
  });

  it('lets employees refund approved rows but does not expose approval actions', async () => {
    const user = await openList('EMPLOYEE');
    expect(screen.queryByRole('button', { name: 'อนุมัติรายการคืนสินค้า' })).not.toBeInTheDocument();
    expect(row().queryByRole('button', { name: 'ดำเนินการคืนเงินจริง' })).not.toBeInTheDocument();
    await user.click(row('RTN-TEST-0082').getByRole('button', { name: 'ดำเนินการคืนเงินจริง' }));
    expect(mocks.refund).not.toHaveBeenCalled();
    expect(within(screen.getByRole('alertdialog')).getByText('RTN-TEST-0082')).toBeInTheDocument();
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'ยกเลิก' }));
    expect(mocks.refund).not.toHaveBeenCalled();
    mocks.refund.mockResolvedValue({ ...salesReturn, id: 82, status: 'REFUNDED' });
    await user.click(row('RTN-TEST-0082').getByRole('button', { name: 'ดำเนินการคืนเงินจริง' }));
    mocks.get.mockResolvedValue({ ...returnsResponse, data: returnsResponse.data.map(item => item.id === 82 ? { ...item, status: 'REFUNDED' } : item) });
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'ยืนยันคืนเงินจริง' }));
    expect(mocks.refund).toHaveBeenCalledExactlyOnceWith(82);
    await waitFor(() => expect(row('RTN-TEST-0082').getByText('คืนเงินจริงแล้ว')).toBeInTheDocument());
    expect(row('RTN-TEST-0082').queryByRole('button', { name: 'ดำเนินการคืนเงินจริง' })).not.toBeInTheDocument();
  });

  it('reports failed refunds and keeps the approved row available for retry', async () => {
    mocks.refund.mockRejectedValue({ response: { data: { error: 'คืนเงินไม่สำเร็จ' } } });
    const user = await openList('EMPLOYEE');
    await user.click(row('RTN-TEST-0082').getByRole('button', { name: 'ดำเนินการคืนเงินจริง' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'ยืนยันคืนเงินจริง' }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error', message: 'คืนเงินไม่สำเร็จ' })));
    expect(row('RTN-TEST-0082').getByText('อนุมัติแล้ว')).toBeInTheDocument();
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
  });

  it.each(['details', 'new'])('uses the employee path for $0 navigation', async destination => {
    const user = await openList('EMPLOYEE');
    if (destination === 'details') await user.click(row().getByRole('button', { name: 'ดูรายละเอียด' }));
    else await user.click(screen.getByRole('button', { name: 'สร้างรายการใหม่' }));
    expect(screen.getByTestId('destination')).toHaveTextContent(`/employee/returns/${destination === 'details' ? '81' : 'new-return'}`);
  });

  it('shows the empty state and zero range when no records match', async () => {
    mocks.get.mockResolvedValue({ ...returnsResponse, data: [], status_counts: [], total_count: 0 });
    render(<MemoryRouter><ReturnsPage /></MemoryRouter>);
    expect(await screen.findByText('ยังไม่มีรายการคืนสินค้า')).toBeInTheDocument();
    expect(screen.getByText('แสดง 0 ถึง 0 จาก 0 รายการ')).toBeInTheDocument();
  });
});
