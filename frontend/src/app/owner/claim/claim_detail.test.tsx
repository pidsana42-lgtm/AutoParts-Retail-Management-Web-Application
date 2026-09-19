import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerClaim, CustomerClaimItem } from '../../../interface/claim/claim';
import ClaimDetailPage from './claim_detail';

const mocks = vi.hoisted(() => ({
  role: 'OWNER',
  getClaim: vi.fn(),
  updateStatus: vi.fn(),
  updateClaim: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('../../../contexts/AuthContexts', () => ({ useAuth: () => ({ role: mocks.role }) }));
vi.mock('../../../components/elements/toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('../../../service/http/apiClient', () => ({ default: { put: mocks.put, post: mocks.post } }));
vi.mock('../../../service/http/claim/claim', () => ({
  getCustomerClaimById: mocks.getClaim,
  updateClaimItemStatus: mocks.updateStatus,
  updateCustomerClaim: mocks.updateClaim,
  searchCustomerCreditByPhone: vi.fn(),
  generateCustomerClaimPDF: vi.fn(),
}));

const pendingItem: CustomerClaimItem = {
  id: 12, customer_claim_id: 9, product_id: 102, product_name: 'สายพานไดชาร์จ',
  qty: 1, reason: 'สายขาด', resolution: '', status: 'Pending', claim_type: 'SUPPLIER_PENDING',
};
const claim: CustomerClaim = {
  id: 9, claim_no: 'CLM-TEST-009', claim_date: '2026-09-07T09:00:00Z',
  original_order_id: 19, return_id: 1, created_by: 5, status: 'APPROVED',
  items: [
    { ...pendingItem, id: 11, product_id: 101, product_name: 'ไฟสปอร์ตไลท์', status: 'APPROVED' },
    pendingItem,
    { ...pendingItem, id: 13, product_id: 103, product_name: 'ฝาปิดถังน้ำมัน', status: 'REJECTED' },
  ],
};

async function openPage(path = '/owner/claims/detail/9') {
  render(<MemoryRouter initialEntries={[path]}>
    <Routes><Route path="/:role/claims/detail/:id" element={<ClaimDetailPage />} /></Routes>
  </MemoryRouter>);
  await screen.findByRole('heading', { name: 'รายละเอียดใบเคลมสินค้า' });
  return userEvent.setup();
}

function itemRow(name = pendingItem.product_name!) {
  return within(screen.getAllByRole('table')[0]).getByRole('row', { name: new RegExp(name) });
}

function savedClaim(status: string): CustomerClaim {
  return { ...claim, items: claim.items!.map(item => item.id === pendingItem.id ? { ...item, status } : item) };
}

// The status decision control is the shared custom Select (button + portal listbox),
// not a native <select> — open it, then click the option by its Thai label.
async function selectStatus(user: ReturnType<typeof userEvent.setup>, label: 'อนุมัติ' | 'ปฏิเสธ') {
  await user.click(screen.getByRole('button', { name: 'สถานะ สายพานไดชาร์จ' }));
  await user.click(screen.getByRole('option', { name: label }));
}

describe('Claim detail item decisions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.role = 'OWNER';
    mocks.getClaim.mockResolvedValue(structuredClone(claim));
    mocks.put.mockResolvedValue({ data: {} });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it.each(['OWNER', 'MANAGER', ' admin '])('shows inline decisions only for pending items to %s', async role => {
    mocks.role = role;
    const user = await openPage();
    const dropdown = within(itemRow()).getByRole('button', { name: 'สถานะ สายพานไดชาร์จ' });
    expect(dropdown).toBeEnabled();
    expect(dropdown).toHaveTextContent('รอดำเนินการ');
    await user.click(dropdown);
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByRole('option', { name: 'อนุมัติ' })).toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: 'ปฏิเสธ' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(within(itemRow('ไฟสปอร์ตไลท์')).queryByRole('button', { name: /^สถานะ / })).not.toBeInTheDocument();
    expect(within(itemRow('ฝาปิดถังน้ำมัน')).queryByRole('button', { name: /^สถานะ / })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'แก้ไขข้อมูล' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^สถานะ / })).toHaveLength(1);
  });

  it.each(['EMPLOYEE', 'CUSTOMER', ''])('hides decision and edit controls from role %s, including edit links', async role => {
    mocks.role = role;
    await openPage('/employee/claims/detail/9?edit=1');
    expect(screen.queryByRole('button', { name: /^สถานะ / })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'แก้ไขข้อมูล' })).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(mocks.updateStatus).not.toHaveBeenCalled();
  });

  it('does not write when the dropdown is opened without selecting a new status', async () => {
    const user = await openPage();
    await user.click(screen.getByRole('button', { name: 'สถานะ สายพานไดชาร์จ' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(mocks.updateStatus).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'สถานะ สายพานไดชาร์จ' })).toHaveTextContent('รอดำเนินการ');
  });

  it.each([
    { action: 'อนุมัติ' as const, status: 'APPROVED', badge: 'อนุมัติแล้ว' },
    { action: 'ปฏิเสธ' as const, status: 'REJECTED', badge: 'ปฏิเสธ' },
  ])('saves $action immediately on selection without a modal and displays the server result', async ({ action, status, badge }) => {
    const user = await openPage();
    const confirm = vi.spyOn(window, 'confirm');
    mocks.updateStatus.mockResolvedValue({ ...pendingItem, status });
    mocks.getClaim.mockResolvedValue(savedClaim(status));
    await selectStatus(user, action);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' })));
    expect(mocks.updateStatus).toHaveBeenCalledExactlyOnceWith(12, status);
    expect(mocks.getClaim).toHaveBeenLastCalledWith(9);
    expect(within(itemRow()).getByText(badge)).toBeInTheDocument();
    expect(within(itemRow()).queryByRole('button', { name: /^สถานะ / })).not.toBeInTheDocument();
    expect(within(itemRow('ไฟสปอร์ตไลท์')).getByText('อนุมัติแล้ว')).toBeInTheDocument();
    expect(within(itemRow('ฝาปิดถังน้ำมัน')).getByText('ปฏิเสธ')).toBeInTheDocument();
    expect(mocks.updateClaim).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('blocks repeat status changes and editing while the request is pending', async () => {
    const user = await openPage();
    let finish!: (item: CustomerClaimItem) => void;
    mocks.updateStatus.mockReturnValue(new Promise<CustomerClaimItem>(resolve => { finish = resolve; }));
    mocks.getClaim.mockResolvedValue(savedClaim('APPROVED'));
    await selectStatus(user, 'อนุมัติ');
    const dropdown = screen.getByRole('button', { name: 'สถานะ สายพานไดชาร์จ' });
    expect(dropdown).toBeDisabled();
    // Disabled trigger must not open the dropdown again while the write is in flight.
    await user.click(dropdown);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'แก้ไขข้อมูล' })).toBeDisabled();
    expect(mocks.updateStatus).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ ...pendingItem, status: 'APPROVED' }); });
    await waitFor(() => expect(within(itemRow()).getByText('อนุมัติแล้ว')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'แก้ไขข้อมูล' })).toBeEnabled();
  });

  it('reports a failed status write without showing an approval or success toast', async () => {
    const user = await openPage();
    mocks.updateStatus.mockRejectedValue(new Error('Request rejected'));
    await selectStatus(user, 'อนุมัติ');
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' })));
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
    expect(within(itemRow()).getByText('รอดำเนินการ')).toBeInTheDocument();
    expect(mocks.getClaim).toHaveBeenCalledTimes(2);
    expect(mocks.updateClaim).not.toHaveBeenCalled();
  });

  it('refreshes a committed status after a lost write response', async () => {
    const user = await openPage();
    mocks.updateStatus.mockRejectedValue(new Error('Connection lost after commit'));
    mocks.getClaim.mockResolvedValue(savedClaim('APPROVED'));
    await selectStatus(user, 'อนุมัติ');
    await waitFor(() => expect(within(itemRow()).getByText('อนุมัติแล้ว')).toBeInTheDocument());
    expect(within(itemRow()).queryByRole('button', { name: /^สถานะ / })).not.toBeInTheDocument();
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
  });

  it('keeps the confirmed server status but warns if refreshing the claim fails', async () => {
    const user = await openPage();
    mocks.updateStatus.mockResolvedValue({ ...pendingItem, status: 'APPROVED', product_name: '' });
    mocks.getClaim.mockRejectedValue(new Error('Read unavailable'));
    await selectStatus(user, 'อนุมัติ');
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'warning', message: expect.stringContaining('บันทึกสถานะแล้ว') })));
    expect(within(itemRow()).getByText('อนุมัติแล้ว')).toBeInTheDocument();
    expect(within(itemRow()).queryByRole('button', { name: /^สถานะ / })).not.toBeInTheDocument();
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
  });

  it('does not treat an empty status response as confirmed success', async () => {
    const user = await openPage();
    mocks.updateStatus.mockResolvedValue(null);
    await selectStatus(user, 'ปฏิเสธ');
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' })));
    expect(within(itemRow()).getByText('รอดำเนินการ')).toBeInTheDocument();
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
  });

  it('edits only changed item details without sending item or parent status', async () => {
    const user = await openPage();
    await user.click(screen.getByRole('button', { name: 'แก้ไขข้อมูล' }));
    expect(screen.queryByRole('combobox', { name: /^สถานะ / })).not.toBeInTheDocument();
    const row = within(itemRow());
    // The only dropdown is the claim type; status remains a badge.
    expect(row.getAllByRole('combobox')).toHaveLength(1);
    const reason = row.getByRole('textbox');
    await user.clear(reason);
    await user.type(reason, 'สายพานผิดรุ่น');
    mocks.getClaim.mockResolvedValue({ ...claim, items: claim.items!.map(item => item.id === 12 ? { ...item, reason: 'สายพานผิดรุ่น' } : item) });
    await user.click(screen.getByRole('button', { name: 'บันทึกการแก้ไข' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'แก้ไขข้อมูล' })).toBeInTheDocument());
    expect(mocks.put).toHaveBeenCalledExactlyOnceWith('/claims/customer-claims/items/12', {
      qty: 1, reason: 'สายพานผิดรุ่น', evidence_url: '', claim_type: 'SUPPLIER_PENDING',
    });
    expect(mocks.updateStatus).not.toHaveBeenCalled();
    expect(mocks.updateClaim).not.toHaveBeenCalled();
    expect(within(itemRow()).getByText('สายพานผิดรุ่น')).toBeInTheDocument();
    expect(within(itemRow()).getByText('รอดำเนินการ')).toBeInTheDocument();
  });

  it('keeps an unsuccessful edit as a draft and shows saved values after cancel', async () => {
    const user = await openPage('/owner/claims/detail/9?edit=1');
    // The edit-query effect runs after the detail has first rendered.
    const reason = await within(itemRow()).findByRole('textbox');
    await user.clear(reason);
    await user.type(reason, 'ยังบันทึกไม่ได้');
    mocks.put.mockRejectedValue(new Error('Write unavailable'));
    await user.click(screen.getByRole('button', { name: 'บันทึกการแก้ไข' }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' })));
    expect(reason).toHaveValue('ยังบันทึกไม่ได้');
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
    await user.click(screen.getByRole('button', { name: 'ยกเลิก' }));
    expect(within(itemRow()).getByText('สายขาด')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('surfaces the backend\'s specific error message instead of a generic one (e.g. item already delivered)', async () => {
    const user = await openPage('/owner/claims/detail/9?edit=1');
    const reason = await within(itemRow()).findByRole('textbox');
    await user.clear(reason);
    await user.type(reason, 'พยายามแก้ไขอีกครั้ง');
    mocks.put.mockRejectedValue({
      response: { status: 409, data: { error: 'รายการเคลมนี้ถูกส่งมอบลูกค้าแล้ว ไม่สามารถแก้ไขได้อีก' } },
    });
    await user.click(screen.getByRole('button', { name: 'บันทึกการแก้ไข' }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      variant: 'error',
      message: 'รายการเคลมนี้ถูกส่งมอบลูกค้าแล้ว ไม่สามารถแก้ไขได้อีก',
    })));
  });

  it('stops an edit when evidence upload fails, without a success toast or item write', async () => {
    const user = await openPage();
    await user.click(screen.getByRole('button', { name: 'แก้ไขข้อมูล' }));
    vi.stubGlobal('URL', class extends URL { static createObjectURL() { return 'blob:test-evidence'; } });
    try {
      await user.click(within(itemRow()).getByRole('button', { name: 'เพิ่มรูป' }));
      const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!;
      await user.upload(fileInput, new File(['test'], 'evidence.png', { type: 'image/png' }));
      mocks.post.mockRejectedValue(new Error('Upload unavailable'));
      await user.click(screen.getByRole('button', { name: 'บันทึกการแก้ไข' }));
      await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' })));
      expect(mocks.post).toHaveBeenCalledTimes(1);
      expect(mocks.put).not.toHaveBeenCalled();
      expect(mocks.updateStatus).not.toHaveBeenCalled();
      expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('displays the reference order number correctly', async () => {
    mocks.getClaim.mockResolvedValue({
      ...claim,
      order_number: 'INV2609080001',
    });
    await openPage();
    expect(screen.getByText('INV2609080001')).toBeInTheDocument();
  });
});
