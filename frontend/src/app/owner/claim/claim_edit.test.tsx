import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerClaim } from '../../../interface/claim/claim';
import ClaimEditPage from './claim_edit';

const mocks = vi.hoisted(() => ({
  getClaim: vi.fn(),
  updateClaim: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('../../../components/elements/toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('../../../service/http/apiClient', () => ({ default: { put: mocks.put, post: mocks.post } }));
vi.mock('../../../service/http/claim/claim', () => ({
  getCustomerClaimById: mocks.getClaim,
  updateCustomerClaim: mocks.updateClaim,
}));

function baseClaim(status: string): CustomerClaim {
  return {
    id: 9, claim_no: 'CLM-TEST-009', claim_date: '2026-09-07T09:00:00Z',
    original_order_id: 19, return_id: 1, created_by: 5, status,
    items: [
      { id: 11, customer_claim_id: 9, product_id: 101, product_name: 'ไฟสปอร์ตไลท์', qty: 1, reason: 'ไฟไม่ติด', resolution: '', status: 'Pending', claim_type: 'INSTANT' },
      { id: 12, customer_claim_id: 9, product_id: 102, product_name: 'สายพานไดชาร์จ', qty: 1, reason: 'สายขาด', resolution: '', status: 'Approved', claim_type: 'INSTANT' },
    ],
  };
}

async function openPage(path: string, canApprove?: boolean) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/:role/claims/edit/:id" element={<ClaimEditPage canApprove={canApprove} />} />
      </Routes>
    </MemoryRouter>
  );
  await screen.findByRole('heading', { name: 'แก้ไขใบเคลมสินค้า' });
  return userEvent.setup();
}

describe('ClaimEditPage role boundaries (canApprove)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.put.mockResolvedValue({ data: {} });
    mocks.updateClaim.mockResolvedValue({});
  });

  it('hides the approval status column and controls when canApprove is false', async () => {
    mocks.getClaim.mockResolvedValue(baseClaim('PENDING'));
    await openPage('/employee/claims/edit/9', false);
    expect(screen.queryByRole('columnheader', { name: 'สถานะพิจารณา' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(5);
    // Other item fields remain editable because the claim itself is still pending,
    // but no status-decision control of any kind is rendered.
    const row = within(screen.getByRole('row', { name: /สายพานไดชาร์จ/ }));
    expect(row.queryByRole('button', { name: 'อนุมัติ' })).not.toBeInTheDocument();
    expect(row.queryByRole('button', { name: 'รอดำเนินการ' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'บันทึกการแก้ไข' })).toBeInTheDocument();
  });

  it('shows the approval status column and controls when canApprove is true (default)', async () => {
    mocks.getClaim.mockResolvedValue(baseClaim('PENDING'));
    await openPage('/owner/claims/edit/9');
    expect(screen.getByRole('columnheader', { name: 'สถานะพิจารณา' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(6);
    const row = within(screen.getByRole('row', { name: /สายพานไดชาร์จ/ }));
    expect(row.getByRole('button', { name: 'อนุมัติ' })).toBeInTheDocument();
  });

  it.each([
    ['all rejected', ['Rejected', 'Rejected'], 'Rejected'],
    ['any approved', ['Approved', 'Pending'], 'Approved'],
    ['none decided yet', ['Pending', 'Pending'], 'Pending'],
  ])('recomputes the overall claim status on save when canApprove is true (%s)', async (_label, itemStatuses, expectedOverall) => {
    const claim = baseClaim('PENDING');
    claim.items![0].status = itemStatuses[0];
    claim.items![1].status = itemStatuses[1];
    mocks.getClaim.mockResolvedValue(claim);
    await openPage('/owner/claims/edit/9');

    await userEvent.setup().click(screen.getByRole('button', { name: 'บันทึกการแก้ไข' }));

    await waitFor(() => expect(mocks.updateClaim).toHaveBeenCalledTimes(2));
    const lastCall = mocks.updateClaim.mock.calls[1];
    expect(lastCall[0]).toBe(9);
    expect(lastCall[1]).toEqual(expect.objectContaining({ status: expectedOverall }));
  });

  it('does not recompute or override the overall claim status on save when canApprove is false', async () => {
    const claim = baseClaim('PENDING');
    claim.items![0].status = 'Approved';
    claim.items![1].status = 'Approved';
    mocks.getClaim.mockResolvedValue(claim);
    await openPage('/employee/claims/edit/9', false);

    await userEvent.setup().click(screen.getByRole('button', { name: 'บันทึกการแก้ไข' }));

    await waitFor(() => expect(mocks.updateClaim).toHaveBeenCalledTimes(2));
    const lastCall = mocks.updateClaim.mock.calls[1];
    expect(lastCall[1]).not.toHaveProperty('status', 'Approved');
    expect(lastCall[1]).toEqual(expect.objectContaining({ status: claim.status }));
  });

  it('renders a finished claim as read-only for a non-approver, with no save/cancel controls', async () => {
    mocks.getClaim.mockResolvedValue(baseClaim('APPROVED'));
    await openPage('/employee/claims/edit/9', false);
    expect(screen.queryByRole('button', { name: 'บันทึกการแก้ไข' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ยกเลิก' })).not.toBeInTheDocument();
    expect(screen.getByText('ใบเคลมนี้ดำเนินการเสร็จสิ้นแล้ว ไม่สามารถแก้ไขได้')).toBeInTheDocument();
    // Item fields render as read-only text/badges, not editable controls, once the
    // claim is finalized and the viewer cannot approve (canEdit = canApprove || PENDING).
    const row = within(screen.getByRole('row', { name: /ไฟสปอร์ตไลท์/ }));
    expect(row.queryByRole('textbox')).not.toBeInTheDocument();
    expect(row.queryByRole('button', { name: 'เปลี่ยนทันที' })).not.toBeInTheDocument();
  });
});
