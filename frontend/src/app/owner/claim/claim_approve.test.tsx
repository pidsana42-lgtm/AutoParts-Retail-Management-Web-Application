import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ClaimApprovePage from './claim_approve';
import type { CustomerClaim } from '../../../interface/claim/claim';

const mocks = vi.hoisted(() => ({ get: vi.fn(), item: vi.fn(), header: vi.fn(), toast: vi.fn() }));
vi.mock('../../../service/http/claim/claim', () => ({ getCustomerClaimById: mocks.get, updateClaimItemStatus: mocks.item, updateCustomerClaim: mocks.header }));
vi.mock('../../../components/elements/toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
const claim: CustomerClaim = {
  id: 9, claim_no: 'CLM-TEST-9', claim_date: '2026-09-09', original_order_id: 19,
  return_id: 1, created_by: 5, status: 'PENDING',
  items: [1, 2].map(id => ({ id, product_id: id, product_name: `สินค้า ${id}`, qty: 1, reason: 'ผิดรุ่น', resolution: '', status: 'PENDING' })),
};
async function mount() {
  render(<MemoryRouter initialEntries={['/owner/claims/approve/9']}><Routes>
    <Route path="/owner/claims/approve/:id" element={<ClaimApprovePage />} />
    <Route path="/owner/claims/detail/:id" element={<p>กลับรายละเอียดแล้ว</p>} />
  </Routes></MemoryRouter>);
  await screen.findAllByRole('button', { name: 'อนุมัติและพิมพ์ใบเคลม' });
  return userEvent.setup();
}
describe('Claim approval regression checks', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(window, 'print').mockImplementation(() => {});
    mocks.get.mockResolvedValue(structuredClone(claim));
    mocks.item.mockImplementation(async (id: number, status: string) => ({ id, status }));
  });
  it.each([
    ['all rejected', ['PENDING', 'PENDING'], ['REJECTED', 'REJECTED']],
    ['mixed decisions', ['APPROVED', 'PENDING'], ['APPROVED', 'REJECTED']],
    ['all approved', ['APPROVED', 'APPROVED'], ['APPROVED', 'APPROVED']],
  ])('lets the backend derive the parent status for %s without overwriting it', async (_, initial, expected) => {
    mocks.get.mockResolvedValue({ ...claim, items: claim.items!.map((item, index) => ({ ...item, status: initial[index] })) });
    const user = await mount();
    await user.click(screen.getAllByRole('button', { name: 'อนุมัติและพิมพ์ใบเคลม' })[0]);
    expect(mocks.item.mock.calls).toEqual([[1, expected[0]], [2, expected[1]]]);
    expect(mocks.header).not.toHaveBeenCalled();
    expect(window.print).toHaveBeenCalledOnce();
    expect(await screen.findByText('กลับรายละเอียดแล้ว')).toBeInTheDocument();
  });
  it('serializes item writes to avoid racing parent synchronization', async () => {
    let finish!: (result: { id: number; status: string }) => void;
    mocks.item.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const user = await mount();
    await user.click(screen.getAllByRole('button', { name: 'อนุมัติและพิมพ์ใบเคลม' })[0]);
    expect(mocks.item).toHaveBeenCalledExactlyOnceWith(1, 'REJECTED');
    screen.getAllByRole('button', { name: 'กำลังบันทึก...' }).forEach(button => expect(button).toBeDisabled());
    expect(window.print).not.toHaveBeenCalled();
    await act(async () => finish({ id: 1, status: 'REJECTED' }));
    await waitFor(() => expect(mocks.item).toHaveBeenCalledTimes(2));
  });
  it.each([new Error('offline'), null])('does not print or mark the header approved on an unsuccessful item update (%#)', async failure => {
    if (failure) mocks.item.mockRejectedValueOnce(failure);
    else mocks.item.mockResolvedValueOnce(null);
    const user = await mount();
    await user.click(screen.getAllByRole('button', { name: 'อนุมัติและพิมพ์ใบเคลม' })[0]);
    expect(mocks.header).not.toHaveBeenCalled();
    expect(window.print).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }));
    expect(screen.getAllByRole('button', { name: 'อนุมัติและพิมพ์ใบเคลม' })[0]).toBeEnabled();
  });
  it('does not allow an empty claim to be approved', async () => {
    mocks.get.mockResolvedValue({ ...claim, items: [] });
    await mount();
    screen.getAllByRole('button', { name: 'อนุมัติและพิมพ์ใบเคลม' }).forEach(button => expect(button).toBeDisabled());
    expect(mocks.item).not.toHaveBeenCalled();
  });
});
