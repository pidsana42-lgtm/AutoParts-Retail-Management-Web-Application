import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ApproveView from './approve_view';
import { importProduct, importSupplier, savedImport } from '../../../../test/importFixtures';

function mount({ employee = false, verified = false } = {}) {
  const onApprove = vi.fn().mockResolvedValue(undefined);
  const onReject = vi.fn().mockResolvedValue(undefined);
  const onBack = vi.fn();
  render(<MemoryRouter><ApproveView bill={savedImport({ is_verified: verified })}
    suppliers={[importSupplier]} products={[importProduct]} isEmployee={employee}
    onApprove={onApprove} onReject={onReject} onBack={onBack}
    formatDate={date => date} getSupplierName={() => importSupplier.supplier_name} /></MemoryRouter>);
  return { user: userEvent.setup(), onApprove, onReject, onBack };
}

describe('Import bill approval view', () => {
  it('shows the bill, supplier, items and evidence image for review', () => {
    mount();
    expect(screen.getByText('INV-TEST-001')).toBeInTheDocument();
    expect(screen.getByText(importSupplier.supplier_name)).toBeInTheDocument();
    expect(screen.getByText('กรองน้ำมัน')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'bill' })).toHaveAttribute('src', '/uploads/test-bill.jpg');
  });
  it('lets an owner approve and prevents repeated actions while the request is pending', async () => {
    const { user, onApprove, onReject } = mount();
    let finish!: () => void;
    onApprove.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
    await user.click(screen.getByRole('button', { name: 'อนุมัติบิล' }));
    expect(onApprove).toHaveBeenCalledExactlyOnceWith(51);
    expect(screen.getByRole('button', { name: 'กำลังอนุมัติ...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'ปฏิเสธ / ส่งกลับแก้ไข' })).toBeDisabled();
    expect(onReject).not.toHaveBeenCalled();
    await act(async () => finish());
    expect(screen.getByRole('button', { name: 'อนุมัติบิล' })).toBeEnabled();
  });
  it('does not expose owner approval or rejection controls to employees', () => {
    const { onApprove, onReject } = mount({ employee: true });
    expect(screen.getByText('รอเจ้าของร้านอนุมัติ')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'อนุมัติบิล' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ปฏิเสธ / ส่งกลับแก้ไข' })).not.toBeInTheDocument();
    expect(onApprove).not.toHaveBeenCalled();
    expect(onReject).not.toHaveBeenCalled();
  });
  it('shows approved bills as read-only', () => {
    mount({ verified: true });
    expect(screen.getByText('บิลนี้ได้รับการอนุมัติแล้ว')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'อนุมัติบิล' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ปฏิเสธ / ส่งกลับแก้ไข' })).not.toBeInTheDocument();
  });
  it('requires confirmation to reject and does nothing if the user cancels', async () => {
    const { user, onReject } = mount();
    await user.click(screen.getByRole('button', { name: 'ปฏิเสธ / ส่งกลับแก้ไข' }));
    expect(onReject).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'ยกเลิก' }));
    expect(screen.queryByRole('button', { name: 'ยืนยัน' })).not.toBeInTheDocument();
    expect(onReject).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'ปฏิเสธ / ส่งกลับแก้ไข' }));
    await user.click(screen.getByRole('button', { name: 'ยืนยัน' }));
    expect(onReject).toHaveBeenCalledExactlyOnceWith(51);
  });
  it('hides broken evidence images without hiding bill details', () => {
    mount();
    fireEvent.error(screen.getByRole('img', { name: 'bill' }));
    expect(screen.queryByRole('img', { name: 'bill' })).not.toBeInTheDocument();
    expect(screen.getByText('INV-TEST-001')).toBeInTheDocument();
  });
  it('returns to the list without approving or rejecting', async () => {
    const { user, onBack, onApprove, onReject } = mount();
    await user.click(screen.getByRole('button', { name: 'นำเข้าสินค้าจากบิล' }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(onApprove).not.toHaveBeenCalled();
    expect(onReject).not.toHaveBeenCalled();
  });
});
