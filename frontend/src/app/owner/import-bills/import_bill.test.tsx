import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ImportBill from './import_bill';
import EmployeeImport from '../../employee/import';
import { importProduct, importSupplier, savedImport, scannedImport } from '../../../test/importFixtures';
import type { ScannedBillData } from '../../../interface/import';

const mocks = vi.hoisted(() => ({
  get: vi.fn(), scan: vi.fn(), confirm: vi.fn(), update: vi.fn(), approve: vi.fn(),
  remove: vi.fn(), pos: vi.fn(), po: vi.fn(), cost: vi.fn(), toast: vi.fn(),
}));
vi.mock('../../../service/http/apiClient', () => ({ default: { get: mocks.get } }));
vi.mock('heic2any', () => ({ default: vi.fn() }));
vi.mock('../../../service/http/import/import_service', async importOriginal => ({
  ...await importOriginal<typeof import('../../../service/http/import/import_service')>(),
  scanBill: mocks.scan, confirmBillImport: mocks.confirm, updateBill: mocks.update,
  approveBill: mocks.approve, deleteBill: mocks.remove, getPurchaseOrders: mocks.pos,
  getPurchaseOrderById: mocks.po, updateProductCostPrice: mocks.cost,
}));
vi.mock('../../../components/elements/toast', () => ({
  ToastProvider: ({ children }: { children: ReactNode }) => children,
  useToast: () => ({ toast: mocks.toast }),
}));

describe.each(['owner', 'employee'] as const)('Import bill workflows for %s (real views, mocked network)', role => {
  const basePath = role === 'employee' ? '/employee/import' : '/owner/import-bills';
  const sessionKey = `import-bill-session:${role}:current-user`;
  const Page = role === 'employee' ? EmployeeImport : ImportBill;
  function Location() { return <output data-testid="location">{useLocation().pathname}</output>; }
  function mount(path = `${basePath}/scan`, form?: ScannedBillData, editingBillId?: number) {
    if (form) sessionStorage.setItem(sessionKey, JSON.stringify({ formData: form, editingBillId, batchResults: [], originalPOItems: [] }));
    return render(<MemoryRouter initialEntries={[path]}><Page /><Location /></MemoryRouter>);
  }
  async function uploadAndScan(files = [new File(['bill'], 'invoice.jpg', { type: 'image/jpeg' })]) {
    const user = userEvent.setup();
    const { container } = mount();
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith('/wms/products'));
    // The upload input is intentionally hidden inside the visible upload label.
    await user.upload(container.querySelector<HTMLInputElement>('input[type="file"]')!, files);
    await user.click(await screen.findByRole('button', { name: files.length > 1 ? 'สแกนข้อมูลแบบกลุ่ม' : 'สแกนข้อมูลบิล' }));
    return user;
  }

  beforeEach(() => {
    vi.resetAllMocks();
    sessionStorage.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = vi.fn(() => 'blob:test-invoice');
      static revokeObjectURL = vi.fn();
    });
    // jsdom has no IndexedDB: explicitly exercise the graceful persistence fallback.
    vi.stubGlobal('indexedDB', undefined);
    mocks.get.mockImplementation(async (url: string) => ({ data: {
      data: url === '/wms/suppliers' ? [importSupplier] : url === '/wms/products' ? [importProduct] : [],
    } }));
    mocks.pos.mockResolvedValue([]);
    mocks.scan.mockResolvedValue(scannedImport());
    mocks.confirm.mockResolvedValue({ id: 51 });
    mocks.update.mockResolvedValue({ id: 51 });
  });
  afterEach(() => { sessionStorage.clear(); vi.unstubAllGlobals(); });

  it('imports only the outstanding quantities by PO line, even for the same product', async () => {
    const po = { id: 71, po_number: 'PO-71', supplier_id: 7, supplier_name: importSupplier.supplier_name, status: 'APPROVED', total_amount: 900,
      po_items: [
        { id: 81, product_id: 21, pre_order_item_id: 91, quantity: 4, unit_price: 100, product_name_snapshot: 'กรองน้ำมัน', supply_product_code_snapshot: 'SUP-21' },
        { id: 82, product_id: 21, quantity: 5, unit_price: 100, product_name_snapshot: 'กรองน้ำมัน', supply_product_code_snapshot: 'SUP-21' },
      ],
    };
    mocks.pos.mockResolvedValue([po]);
    mocks.po.mockResolvedValue(po);
    mocks.get.mockImplementation(async (url: string) => ({ data: { data:
      url === '/wms/suppliers' ? [importSupplier] : url === '/wms/products' ? [importProduct] : url === '/import-data/bills'
        ? [savedImport({ po_id: 71, payment_status: 'unpaid', bill_items: [{ ...savedImport().bill_items![0], po_item_id: 81, pre_order_item_id: 91, order_quantity: 2 }] })] : [],
    } }));
    const user = userEvent.setup();
    mount(`${basePath}/po`);
    await user.click(await screen.findByRole('button', { name: 'ดึงข้อมูลเข้าบิล' }));
    await screen.findAllByPlaceholderText('ชื่อสินค้าในบิล');
    const form = JSON.parse(sessionStorage.getItem(sessionKey)!).formData;
    expect(form.items).toEqual([
      expect.objectContaining({ po_item_id: 81, pre_order_item_id: 91, order_quantity: 2 }),
      expect.objectContaining({ po_item_id: 82, pre_order_item_id: null, order_quantity: 5 }),
    ]);
    expect(form.grand_total).toBe(700);
    expect(mocks.confirm).not.toHaveBeenCalled();
  });
  it('preserves explicit PO and preorder line references when saving a receipt', async () => {
    const form = scannedImport();
    form.items[0].po_item_id = 81;
    form.items[0].pre_order_item_id = 91;
    sessionStorage.setItem(sessionKey, JSON.stringify({ formData: form, poReference: '71', batchResults: [], originalPOItems: [] }));
    const user = userEvent.setup();
    mount(`${basePath}/manual`);
    await screen.findByDisplayValue('INV-TEST-001');
    await user.click(screen.getByRole('button', { name: 'บันทึกข้อมูล' }));
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledWith(91, expect.objectContaining({
      bill: expect.objectContaining({ po_id: 71 }),
      items: [expect.objectContaining({ po_item_id: 81, pre_order_item_id: 91 })],
    })));
  });
  it('does not carry over a leftover PO reference when starting a brand-new manual entry from home', async () => {
    // Session leftover from an earlier PO-based flow the user never finished/left.
    sessionStorage.setItem(sessionKey, JSON.stringify({ formData: null, poReference: '71', batchResults: [], originalPOItems: [] }));
    const user = userEvent.setup();
    mount(basePath);
    await user.click(await screen.findByText('กรอกข้อมูลด้วยตนเอง'));
    expect(await screen.findByRole('combobox')).toHaveValue('');
  });
  it('uploads an image, displays the AI result and matches its supplier', async () => {
    await uploadAndScan();
    expect(await screen.findByDisplayValue('INV-TEST-001')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ชื่อสินค้าในบิล')).toHaveValue('กรองน้ำมัน');
    expect(mocks.scan).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ name: 'invoice.jpg' }));
    expect(screen.getByPlaceholderText('พิมพ์ชื่อซัพพลายเออร์')).toHaveValue(importSupplier.supplier_name);
    expect(JSON.parse(sessionStorage.getItem(sessionKey)!).formData.supplier_id).toBe(7);
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it('disables scanning while AI is pending and enables retry after failure', async () => {
    let rejectScan!: (error: Error) => void;
    mocks.scan.mockReturnValue(new Promise((_, reject) => { rejectScan = reject; }));
    const user = await uploadAndScan();
    expect(screen.getByRole('button', { name: 'กำลังสแกนบิล' })).toBeDisabled();
    await act(async () => rejectScan(new Error('AI ไม่พร้อมใช้งาน')));
    expect(await screen.findByText('AI ไม่พร้อมใช้งาน')).toBeInTheDocument();
    expect(mocks.confirm).not.toHaveBeenCalled();
    mocks.scan.mockResolvedValue(scannedImport());
    await user.click(screen.getByRole('button', { name: 'สแกนข้อมูลบิล' }));
    expect(await screen.findByDisplayValue('INV-TEST-001')).toBeInTheDocument();
  });

  it('accepts PDF uploads and filters placeholder rows returned by AI', async () => {
    const form = scannedImport();
    mocks.scan.mockResolvedValue({ ...form, items: [...form.items, { company_product_code: 'product code', company_product_name: 'ชื่อสินค้า' }] });
    await uploadAndScan([new File(['%PDF-1.4'], 'invoice.pdf', { type: 'application/pdf' })]);
    expect(await screen.findByDisplayValue('INV-TEST-001')).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('ชื่อสินค้าในบิล')).toHaveLength(1);
    expect(mocks.scan).toHaveBeenCalledWith(expect.objectContaining({ name: 'invoice.pdf' }));
  });

  it('prevents saving an AI result that has no item rows', async () => {
    mocks.scan.mockResolvedValue(scannedImport({ items: [] }));
    await uploadAndScan();
    expect(await screen.findByRole('button', { name: 'บันทึกข้อมูล' })).toBeDisabled();
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it('continues a batch after one scan fails and preserves the successful result', async () => {
    mocks.scan.mockRejectedValueOnce(new Error('unreadable')).mockResolvedValueOnce(scannedImport());
    await uploadAndScan(['bad.jpg', 'good.jpg'].map(name => new File(['bill'], name, { type: 'image/jpeg' })));
    expect(await screen.findByDisplayValue('INV-TEST-001')).toBeInTheDocument();
    expect(mocks.scan).toHaveBeenCalledTimes(2);
    expect(within(screen.getByRole('button', { name: /bad.jpg/ })).getByText('ล้มเหลว')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: /good.jpg/ })).getByText('สำเร็จ')).toBeInTheDocument();
  });

  it('saves edited AI data with recalculated totals and returns to the bill list', async () => {
    const user = await uploadAndScan();
    const name = await screen.findByPlaceholderText('ชื่อสินค้าในบิล');
    await user.clear(name);
    await user.type(name, 'กรองน้ำมันแก้ไขแล้ว');
    const row = name.closest('tr')!;
    fireEvent.change(within(row).getAllByRole('spinbutton')[0], { target: { value: '3' } });
    await user.click(screen.getByRole('button', { name: 'บันทึกข้อมูล' }));
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledExactlyOnceWith(91, expect.objectContaining({
      bill: expect.objectContaining({ bill_no: 'INV-TEST-001', supplier_id: 7, subtotal: 300, grand_total: 314, bill_image_id: 81, due_date: '2026-10-09T00:00:00.000Z' }),
      items: [expect.objectContaining({ company_product_name: 'กรองน้ำมันแก้ไขแล้ว', order_quantity: 3, net_amount: 300, product_id: 21 })],
    })));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe(basePath));
    expect(sessionStorage.getItem(sessionKey)).toBeNull();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
  });

  it('keeps entered data on save failure and permits retry', async () => {
    mocks.confirm.mockRejectedValueOnce(new Error('บันทึกไม่สำเร็จ')).mockResolvedValueOnce({ id: 51 });
    const user = await uploadAndScan();
    await screen.findByDisplayValue('INV-TEST-001');
    await user.click(screen.getByRole('button', { name: 'บันทึกข้อมูล' }));
    expect(await screen.findByText('บันทึกไม่สำเร็จ')).toBeInTheDocument();
    expect(screen.getByDisplayValue('INV-TEST-001')).toBeInTheDocument();
    expect(mocks.toast).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'บันทึกข้อมูล' }));
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(2));
  });

  it('restores a saved manual-entry session and updates the existing bill instead of creating one', async () => {
    const user = userEvent.setup();
    mount(`${basePath}/manual`, scannedImport(), 51);
    await screen.findByDisplayValue('INV-TEST-001');
    await user.click(screen.getByRole('button', { name: 'บันทึกข้อมูล' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(51, expect.objectContaining({ items: [expect.objectContaining({ product_id: 21 })] })));
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it('requires explicit confirmation before saving a draft', async () => {
    const user = userEvent.setup();
    mount(`${basePath}/manual`, scannedImport());
    await user.click(await screen.findByRole('button', { name: 'บันทึกเป็นแบบร่าง' }));
    expect(mocks.confirm).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'ยืนยันบันทึกเป็นแบบร่าง' }));
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledWith(91, expect.objectContaining({ bill: expect.objectContaining({ payment_status: 'Draft' }) })));
  });

  it('warns about duplicate bill numbers before sending an import', async () => {
    mocks.get.mockImplementation(async (url: string) => ({ data: { data: url === '/import-data/bills' ? [savedImport()] : url === '/wms/products' ? [importProduct] : [] } }));
    const user = userEvent.setup();
    mount(`${basePath}/manual`, scannedImport());
    await user.click(await screen.findByRole('button', { name: 'บันทึกข้อมูล' }));
    expect(await screen.findByText(/เลขที่บิล.*มีอยู่ในระบบแล้ว/)).toBeInTheDocument();
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  function mountMapping(overrides = {}) {
    sessionStorage.setItem(sessionKey, JSON.stringify({
      batchResults: [], originalPOItems: [],
      excelPreview: {
        fileName: 'invoice.xlsx', sheetNames: ['สินค้า'], activeSheet: 'สินค้า',
        headers: ['code', 'name', 'qty', 'price'],
        rows: [['PART-21', 'กรองน้ำมัน', '2', '1,200.50'], ['', 'Subtotal', '', '2,401.00'], ['', '', '', '']],
      },
      excelMapping: { code: 'code', name: 'name', quantity: 'qty', price: 'price', unit: '' },
      excelBillMeta: { bill_no: 'EXCEL-001', supplier_name: importSupplier.supplier_name, due_date: '2026-10-09', receive_date: '2026-09-09' },
      ...overrides,
    }));
    return mount(`${basePath}/mapping`);
  }

  it('converts Excel column mappings into editable items, excluding summary and blank rows', async () => {
    const user = userEvent.setup();
    mountMapping();
    expect(screen.getByText('invoice.xlsx')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ยืนยันการจับคู่คอลัมน์' }));
    expect(await screen.findByDisplayValue('EXCEL-001')).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('ชื่อสินค้าในบิล')).toHaveLength(1);
    expect(screen.getByTestId('location')).toHaveTextContent(`${basePath}/manual`);
    const form = JSON.parse(sessionStorage.getItem(sessionKey)!).formData;
    expect(form).toEqual(expect.objectContaining({ subtotal: 2401, grand_total: 2401, supplier_id: 7 }));
    expect(form.items).toEqual([expect.objectContaining({ item_sequence: 1, order_quantity: 2, price_per_unit: 1200.5, net_amount: 2401, unit: 'ชิ้น' })]);
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(mocks.scan).not.toHaveBeenCalled();
  });

  it('requires missing Excel columns to be selected before proceeding', async () => {
    const user = userEvent.setup();
    mountMapping({ excelMapping: { code: 'code', name: 'name', quantity: 'qty', price: '', unit: '' } });
    expect(screen.getByRole('button', { name: 'ยืนยันการจับคู่คอลัมน์' })).toBeDisabled();
    expect(screen.getByText('กรุณาเลือกคอลัมน์: ราคาต่อหน่วย')).toBeInTheDocument();
    // The fourth mapping select corresponds to price; current labels are not linked to inputs.
    await user.selectOptions(screen.getAllByRole('combobox')[3], 'price');
    expect(screen.getByRole('button', { name: 'ยืนยันการจับคู่คอลัมน์' })).toBeEnabled();
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it('does not proceed with an empty Excel sheet', () => {
    mountMapping({ excelPreview: { fileName: 'empty.xlsx', sheetNames: ['Sheet1'], activeSheet: 'Sheet1', headers: ['code', 'name', 'qty', 'price'], rows: [] } });
    expect(screen.getByRole('button', { name: 'ยืนยันการจับคู่คอลัมน์' })).toBeDisabled();
    expect(screen.getByText(/ไม่พบข้อมูลแถวรายการในไฟล์/)).toBeInTheDocument();
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  const batchFiles = () => ['first.jpg', 'second.jpg'].map(name => new File(['bill'], name, { type: 'image/jpeg' }));
  const mergeButton = () => screen.getByRole('button', { name: 'รวมทุกแผ่นเป็น 1 บิล (Merge Multi-Page Bill)' });
  async function scanTwoBills() {
    mocks.scan.mockResolvedValueOnce(scannedImport({ bill_no: 'BATCH-1', db_job_id: 101 }))
      .mockResolvedValueOnce(scannedImport({ bill_no: 'BATCH-2', db_job_id: 102 }));
    const user = await uploadAndScan(batchFiles());
    await waitFor(() => expect(screen.getByRole('button', { name: 'บันทึกข้อมูลทั้งหมด (2 บิล)' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: /first.jpg/ }));
    return user;
  }

  it('saves only scanned bills and keeps failed scan files for retry', async () => {
    mocks.scan.mockRejectedValueOnce(new Error('bad image'))
      .mockResolvedValueOnce(scannedImport({ bill_no: 'BATCH-2', db_job_id: 102 }));
    const user = await uploadAndScan(batchFiles());
    await user.click(await screen.findByRole('button', { name: 'บันทึกข้อมูลทั้งหมด (1 บิล)' }));
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledExactlyOnceWith(102, expect.objectContaining({ bill: expect.objectContaining({ bill_no: 'BATCH-2' }) })));
    expect(await screen.findByText(/ยังมีรายการที่ไม่สำเร็จ/)).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(`${basePath}/scan`);
    expect(screen.getByRole('button', { name: /first.jpg/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /second.jpg/ })).not.toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem(sessionKey)!).batchResults).toEqual([null]);
    mocks.scan.mockResolvedValueOnce(scannedImport({ bill_no: 'BATCH-1', db_job_id: 101 }));
    await user.click(screen.getByRole('button', { name: 'สแกนข้อมูลแบบกลุ่ม' }));
    await user.click(await screen.findByRole('button', { name: 'บันทึกข้อมูลทั้งหมด (1 บิล)' }));
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(2));
    expect(mocks.confirm.mock.calls.map(call => call[0])).toEqual([102, 101]);
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe(basePath));
  });

  it('keeps all failed saves and their edited data, then retries without rescanning', async () => {
    mocks.confirm.mockRejectedValue(new Error('offline'));
    const user = await scanTwoBills();
    fireEvent.change(screen.getByPlaceholderText('ชื่อสินค้าในบิล'), { target: { value: 'แก้ไขก่อนบันทึก' } });
    await user.click(screen.getByRole('button', { name: 'บันทึกข้อมูลทั้งหมด (2 บิล)' }));
    expect(await screen.findByText(/ยังมีรายการที่ไม่สำเร็จ/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('แก้ไขก่อนบันทึก')).toBeInTheDocument();
    const stored = JSON.parse(sessionStorage.getItem(sessionKey)!);
    expect(stored.batchResults).toHaveLength(2);
    expect(stored.batchResults[0].items[0].company_product_name).toBe('แก้ไขก่อนบันทึก');
    expect(mocks.confirm).toHaveBeenCalledTimes(2);
    mocks.confirm.mockResolvedValue({ id: 51 });
    await user.click(screen.getByRole('button', { name: 'บันทึกข้อมูลทั้งหมด (2 บิล)' }));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe(basePath));
    expect(mocks.confirm.mock.calls.map(call => call[0])).toEqual([101, 102, 101, 102]);
    expect(mocks.scan).toHaveBeenCalledTimes(2);
  });

  it('retries only the failed save, never a bill already saved successfully', async () => {
    mocks.confirm.mockResolvedValueOnce({ id: 51 }).mockRejectedValueOnce(new Error('offline'));
    const user = await scanTwoBills();
    await user.click(screen.getByRole('button', { name: 'บันทึกข้อมูลทั้งหมด (2 บิล)' }));
    expect(await screen.findByText(/ยังมีรายการที่ไม่สำเร็จ/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('BATCH-2')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /first.jpg/ })).not.toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem(sessionKey)!).batchResults.map((bill: ScannedBillData) => bill.db_job_id)).toEqual([102]);
    // A refresh must not reintroduce the bill already confirmed by the server.
    cleanup();
    mount();
    await screen.findByDisplayValue('BATCH-2');
    await user.click(screen.getByRole('button', { name: 'บันทึกข้อมูลทั้งหมด (1 บิล)' }));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe(basePath));
    expect(mocks.confirm.mock.calls.map(call => call[0])).toEqual([101, 102, 102]);
  });

  it('merges pages into one saved bill even after changing preview pages and editing an item', async () => {
    const user = await scanTwoBills();
    await user.click(mergeButton());
    expect(JSON.parse(sessionStorage.getItem(sessionKey)!)).toMatchObject({ isMergedBatch: true, batchResults: [] });
    expect(screen.getAllByPlaceholderText('ชื่อสินค้าในบิล')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /รวมทุกแผ่นเป็น 1 บิล/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /second.jpg/ }));
    expect(screen.getAllByPlaceholderText('ชื่อสินค้าในบิล')).toHaveLength(2);
    fireEvent.change(screen.getAllByPlaceholderText('ชื่อสินค้าในบิล')[1], { target: { value: 'สินค้าหน้าสองแก้ไข' } });
    await user.click(screen.getByRole('button', { name: 'บันทึกข้อมูล' }));
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledExactlyOnceWith(101, expect.objectContaining({
      bill: expect.objectContaining({ subtotal: 400, grand_total: 428 }),
      items: [expect.objectContaining({ item_sequence: 1 }), expect.objectContaining({ item_sequence: 2, company_product_name: 'สินค้าหน้าสองแก้ไข' })],
    })));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe(basePath));
  });

  it('restores a merged session as a single bill after refresh', async () => {
    const form = scannedImport({ items: [...scannedImport().items, ...scannedImport().items], subtotal: 400, total_amount: 428, grand_total: 428, vat_amount: 28 });
    sessionStorage.setItem(sessionKey, JSON.stringify({ formData: form, batchResults: [], isMergedBatch: true, originalPOItems: [] }));
    const user = userEvent.setup();
    mount();
    expect(await screen.findAllByPlaceholderText('ชื่อสินค้าในบิล')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'บันทึกข้อมูล' }));
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(1));
    expect(mocks.confirm.mock.calls[0][1].items).toHaveLength(2);
  });

  it('refuses to merge when any page failed to scan and preserves the successful page', async () => {
    mocks.scan.mockRejectedValueOnce(new Error('bad image')).mockResolvedValueOnce(scannedImport());
    const user = await uploadAndScan(batchFiles());
    await user.click(await screen.findByRole('button', { name: /รวมทุกแผ่นเป็น 1 บิล/ }));
    expect(screen.getByText('กรุณาสแกนทุกไฟล์ให้สำเร็จก่อนรวมเป็นบิลเดียว')).toBeInTheDocument();
    expect(screen.getByDisplayValue('INV-TEST-001')).toBeInTheDocument();
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it('blocks merge, saving and edits until the entire batch finishes scanning', async () => {
    let finish!: (bill: ScannedBillData) => void;
    mocks.scan.mockResolvedValueOnce(scannedImport()).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const user = await uploadAndScan(batchFiles());
    expect(await screen.findByDisplayValue('INV-TEST-001')).toBeDisabled();
    expect(mergeButton()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'บันทึกข้อมูลทั้งหมด (1 บิล)' })).toBeDisabled();
    await user.click(mergeButton());
    expect(mocks.confirm).not.toHaveBeenCalled();
    await act(async () => finish(scannedImport({ bill_no: 'BATCH-2' })));
    expect(screen.getByRole('button', { name: 'บันทึกข้อมูลทั้งหมด (2 บิล)' })).toBeEnabled();
  });

  it('confirms a draft for the whole batch instead of saving only the active bill', async () => {
    const user = await scanTwoBills();
    await user.click(screen.getByRole('button', { name: 'บันทึกเป็นแบบร่าง' }));
    expect(mocks.confirm).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'ยืนยันบันทึกเป็นแบบร่าง' }));
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(2));
    expect(mocks.confirm.mock.calls.map(call => call[1].bill.payment_status)).toEqual(['Draft', 'Draft']);
  });

  it('rescans only failed pages without replacing edits on a successful page', async () => {
    mocks.scan.mockResolvedValueOnce(scannedImport({ bill_no: 'BATCH-1', db_job_id: 101 }))
      .mockRejectedValueOnce(new Error('bad image'));
    const user = await uploadAndScan(batchFiles());
    await waitFor(() => expect(screen.getByPlaceholderText('ชื่อสินค้าในบิล')).toBeEnabled());
    fireEvent.change(screen.getByPlaceholderText('ชื่อสินค้าในบิล'), { target: { value: 'แก้ไขแล้วห้ามทับ' } });
    mocks.scan.mockResolvedValueOnce(scannedImport({ bill_no: 'BATCH-2', db_job_id: 102 }));
    await user.click(screen.getByRole('button', { name: /second.jpg/ }));
    await user.click(screen.getByRole('button', { name: 'สแกนข้อมูลแบบกลุ่ม' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'บันทึกข้อมูลทั้งหมด (2 บิล)' })).toBeEnabled());
    expect(mocks.scan.mock.calls.map(call => call[0].name)).toEqual(['first.jpg', 'second.jpg', 'second.jpg']);
    await user.click(screen.getByRole('button', { name: /first.jpg/ }));
    expect(screen.getByDisplayValue('แก้ไขแล้วห้ามทับ')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'บันทึกข้อมูลทั้งหมด (2 บิล)' }));
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(2));
    expect(mocks.confirm.mock.calls[0][1].items[0].company_product_name).toBe('แก้ไขแล้วห้ามทับ');
  });
});
