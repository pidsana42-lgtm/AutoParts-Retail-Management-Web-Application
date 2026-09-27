import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerClaim } from '../../../interface/claim/claim';
import ClaimsPage from './claims';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  search: vi.fn(),
  credit: vi.fn(),
  del: vi.fn(),
  pdf: vi.fn(),
  checklistPdf: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  toast: vi.fn(),
  addNotification: vi.fn(),
}));

vi.mock('../../../service/http/claim/claim', () => ({
  getCustomerClaims: mocks.list,
  searchSaleOrders: mocks.search,
  searchCustomerCreditByPhone: mocks.credit,
  deleteCustomerClaim: mocks.del,
  generateCustomerClaimPDF: mocks.pdf,
  exportCustomerClaimChecklistPDF: mocks.checklistPdf,
}));
vi.mock('../../../service/http/apiClient', () => ({ default: { post: mocks.post, put: mocks.put } }));
vi.mock('../../../components/elements/toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('../../../contexts/NotificationContext', () => ({ useNotification: () => ({ addNotification: mocks.addNotification }) }));

const claimWithItem: CustomerClaim = {
  id: 9,
  claim_no: 'CLM-TEST-009',
  claim_date: '2026-09-07T09:00:00Z',
  original_order_id: 19,
  return_id: 1,
  created_by: 5,
  status: 'PENDING',
  items: [
    { id: 12, customer_claim_id: 9, product_id: 102, product_name: 'สายพานไดชาร์จ', qty: 1, reason: 'สายขาด', resolution: '', status: 'Pending' },
  ],
};

function basePathFor(canApprove?: boolean) {
  return canApprove === false ? '/employee/claims' : '/owner/claims';
}

async function mount(canApprove?: boolean) {
  const basePath = basePathFor(canApprove);
  render(
    <MemoryRouter initialEntries={[basePath]}>
      <Routes>
        <Route path={basePath} element={<ClaimsPage canApprove={canApprove} />} />
        <Route path={`${basePath}/detail/:id`} element={<p>ไปหน้ารายละเอียด (แก้ไขในตัว)</p>} />
        <Route path={`${basePath}/edit/:id`} element={<p>ไปหน้าแก้ไขของพนักงาน</p>} />
      </Routes>
    </MemoryRouter>
  );
  return userEvent.setup();
}

describe('ClaimsPage role boundaries (canApprove)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.list.mockResolvedValue([structuredClone(claimWithItem)]);
    mocks.credit.mockResolvedValue(null);
    mocks.post.mockResolvedValue({ data: {} });
  });

  it.each([
    ['owner (canApprove=true)', true, 'ไปหน้ารายละเอียด (แก้ไขในตัว)'],
    ['employee (canApprove=false)', false, 'ไปหน้าแก้ไขของพนักงาน'],
  ])('routes the edit action for %s to the correct destination', async (_label, canApprove, expectedText) => {
    await mount(canApprove);
    const editButton = await screen.findByTitle('แก้ไขใบเคลม');
    await userEvent.setup().click(editButton);
    expect(await screen.findByText(expectedText)).toBeInTheDocument();
  });

  it.each([
    ['owner (canApprove=true)', true, 'APPROVED'],
    ['employee (canApprove=false)', false, 'PENDING'],
  ])('submits a new claim with the correct status for %s', async (_label, canApprove, expectedStatus) => {
    mocks.search.mockResolvedValue([
      {
        id: 501,
        order_number: 'INV5551',
        customer_name: 'สมชาย ใจดี',
        customer_phone: '0812345678',
        items: [{ product_id: 10, product_name: 'ผ้าเบรค', unit_price: 500, qty: 2 }],
      },
    ]);
    const user = await mount(canApprove);

    await user.click(screen.getByRole('button', { name: 'สร้างใบเคลม' }));
    const searchInput = await screen.findByPlaceholderText('INVXXXXXXXX หรือ ชื่อลูกค้า...');
    await user.type(searchInput, 'INV5551');
    const orderOption = await screen.findByText('INV5551');
    await user.click(orderOption);

    // canApprove gates the per-item claim-type control during creation.
    if (canApprove) {
      expect(screen.getByRole('button', { name: 'เปลี่ยนทันที' })).toBeInTheDocument();
      expect(screen.queryByText('รอเจ้าของร้านพิจารณา')).not.toBeInTheDocument();
    } else {
      expect(screen.queryByRole('button', { name: 'เปลี่ยนทันที' })).not.toBeInTheDocument();
      expect(screen.getByText('รอเจ้าของร้านพิจารณา')).toBeInTheDocument();
    }

    await user.click(screen.getByTitle('เพิ่มจำนวน'));
    await user.type(screen.getByPlaceholderText('ระบุอาการเสีย / สาเหตุการเคลม...'), 'ชำรุด');

    await user.click(screen.getByRole('button', { name: /บันทึกใบเคลม/ }));

    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith(
      '/claims/customer-claims',
      expect.objectContaining({ status: expectedStatus }),
    ));
  });

  it('defaults canApprove to true when the prop is omitted', async () => {
    render(
      <MemoryRouter initialEntries={['/owner/claims']}>
        <Routes>
          <Route path="/owner/claims" element={<ClaimsPage />} />
          <Route path="/owner/claims/detail/:id" element={<p>ไปหน้ารายละเอียด (แก้ไขในตัว)</p>} />
        </Routes>
      </MemoryRouter>
    );
    const editButton = await screen.findByTitle('แก้ไขใบเคลม');
    await userEvent.setup().click(editButton);
    expect(await screen.findByText('ไปหน้ารายละเอียด (แก้ไขในตัว)')).toBeInTheDocument();
  });

  it('stays under the manager route when manager accesses claims and clicks edit', async () => {
    render(
      <MemoryRouter initialEntries={['/manager/claims']}>
        <Routes>
          <Route path="/manager/claims" element={<ClaimsPage />} />
          <Route path="/manager/claims/detail/:id" element={<p>หน้ารายละเอียดของ Manager</p>} />
        </Routes>
      </MemoryRouter>
    );
    const editButton = await screen.findByTitle('แก้ไขใบเคลม');
    await userEvent.setup().click(editButton);
    expect(await screen.findByText('หน้ารายละเอียดของ Manager')).toBeInTheDocument();
  });
});
