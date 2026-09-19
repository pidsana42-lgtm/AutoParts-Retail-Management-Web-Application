import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PreOrderManager from './pre-order';
import EmployeePreOrder from '../../employee/pre-order';
import { preorder, preorderCatalog, preorderCustomer, preorderProduct } from '../../../test/preorderFixtures';

const mocks = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), get: vi.fn(), catalogs: vi.fn(), toast: vi.fn() }));
vi.mock('../../../service/http/pre-order/pre-order', () => ({
  getPreOrders: mocks.list, getPreOrderById: mocks.detail, createPreOrder: mocks.create,
  updatePreOrder: mocks.update, deletePreOrder: mocks.remove,
}));
vi.mock('../../../service/http/apiClient', () => ({ default: { get: mocks.get } }));
vi.mock('../../../service/http/catalog/catalog_service', () => ({ getCatalogs: mocks.catalogs }));
vi.mock('../../../components/elements/toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));

const firstName = () => screen.getByPlaceholderText('พิมพ์ชื่อ...');
const save = () => screen.getByRole('button', { name: 'บันทึกใบสั่งจอง' });
const searchProduct = () => screen.getByPlaceholderText('พิมพ์ชื่อสินค้า, รหัสสินค้า, หรือ Part Number...');
const searchList = () => screen.getByPlaceholderText('ค้นหาชื่อลูกค้า, เบอร์โทร, เลขใบจอง หรือเลข PO...');
function RouteProbe() {
  const location = useLocation();
  return <output data-testid="route">{location.pathname}{location.search}</output>;
}
function mount(path = '/owner/pre-orders', state?: object) {
  const Page = path.startsWith('/employee') ? EmployeePreOrder : PreOrderManager;
  return render(<MemoryRouter initialEntries={[{ pathname: path.split('?')[0], search: path.includes('?') ? `?${path.split('?')[1]}` : '', state }]}>
    <Page /><RouteProbe />
  </MemoryRouter>);
}
async function newForm(role = 'owner') {
  mount(`/${role}/pre-orders?view=new`);
  await waitFor(() => expect(mocks.catalogs).toHaveBeenCalled());
  return userEvent.setup();
}
async function addStock(user: ReturnType<typeof userEvent.setup>) {
  await user.type(searchProduct(), 'PART-21');
  await user.click(await screen.findByText('กรองน้ำมัน'));
}
async function readyForm(role = 'owner') {
  const user = await newForm(role);
  await user.type(firstName(), 'ลูกค้าใหม่');
  await addStock(user);
  return user;
}

describe('Preorder list and navigation', () => {
  beforeEach(resetMocks);

  it('keeps receipt statuses separate from the approved PO waiting state', async () => {
    mocks.list.mockResolvedValue([
      preorder({ id: 51, status: 'READY', po_status: 'APPROVED', po_id: 1 }),
      preorder({ id: 52, status: 'PARTIALLY_RECEIVED', po_status: 'APPROVED', po_id: 1 }),
      preorder({ id: 53, status: 'ORDERED', po_status: 'APPROVED', po_id: 1 }),
    ]);
    const user = userEvent.setup();
    mount();
    await screen.findByText('PRE-00051');
    expect(screen.getAllByText('พร้อมส่งมอบ')).toHaveLength(2);
    expect(screen.getAllByText('รับเข้าบางส่วน')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'รอสินค้า' }));
    expect(screen.getByText('PRE-00053')).toBeInTheDocument();
    expect(screen.queryByText('PRE-00051')).not.toBeInTheDocument();
    expect(screen.queryByText('PRE-00052')).not.toBeInTheDocument();
  });
  it('shows loaded customer, preorder number and channel', async () => {
    mount();
    expect(await screen.findByText('PRE-00051')).toBeInTheDocument();
    expect(screen.getByText('สมชาย ใจดี')).toBeInTheDocument();
    expect(screen.getByText('0812345678')).toBeInTheDocument();
    expect(screen.getByText('หน้าร้าน')).toBeInTheDocument();
  });
  it('shows loading while awaiting the list', async () => {
    let finish!: (value: ReturnType<typeof preorder>[]) => void;
    const pending = new Promise<ReturnType<typeof preorder>[]>(resolve => { finish = resolve; });
    mocks.list.mockReturnValue(pending);
    mount();
    expect(screen.getByText('กำลังโหลดข้อมูลรายการจอง...')).toBeInTheDocument();
    await act(async () => finish([preorder()]));
    expect(await screen.findByText('PRE-00051')).toBeInTheDocument();
  });
  it('shows an empty list without creating data', async () => {
    mocks.list.mockResolvedValue([]);
    mount();
    expect(await screen.findByText('ไม่พบข้อมูลรายการจองล่วงหน้า')).toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('reports list loading failures', async () => {
    mocks.list.mockRejectedValue(new Error('offline'));
    mount();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({ variant: 'error', message: 'ล้มเหลวในการโหลดรายการจองล่วงหน้า' }));
  });
  it.each(['สมชาย', '0812345678', 'pre-00051', 'po-test-51'])('finds a preorder using %s', async query => {
    mocks.list.mockResolvedValue([preorder({ po_number: 'PO-TEST-51' }), preorder({ id: 52, customer_name: 'ลูกค้าคนอื่น', customer_phone: '0899999999' })]);
    const user = userEvent.setup();
    mount();
    await screen.findByText('PRE-00052');
    await user.type(searchList(), query);
    expect(screen.getByText('PRE-00051')).toBeInTheDocument();
    expect(screen.queryByText('PRE-00052')).not.toBeInTheDocument();
  });
  it('passes the chosen status filter to the API and renders matching orders', async () => {
    mocks.list.mockImplementation(async (status?: string) => status === 'ORDERED'
      ? [preorder({ id: 52, status: 'ORDERED', po_status: 'APPROVED' })] : [preorder()]);
    const user = userEvent.setup();
    mount();
    await screen.findByText('PRE-00051');
    await user.click(screen.getByRole('button', { name: 'รอสินค้า' }));
    expect(await screen.findByText('PRE-00052')).toBeInTheDocument();
    expect(mocks.list).toHaveBeenLastCalledWith('ORDERED');
    expect(screen.queryByText('PRE-00051')).not.toBeInTheDocument();
  });
  it('paginates and resets to the first page when searching', async () => {
    mocks.list.mockResolvedValue(Array.from({ length: 12 }, (_, index) => preorder({ id: index + 1 })));
    const user = userEvent.setup();
    mount();
    await screen.findByText('PRE-00001');
    expect(screen.queryByText('PRE-00011')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'หน้าถัดไป' }));
    expect(screen.getByText('PRE-00011')).toBeInTheDocument();
    await user.type(searchList(), 'PRE-00001');
    expect(screen.getByText('PRE-00001')).toBeInTheDocument();
    expect(screen.queryByText('PRE-00011')).not.toBeInTheDocument();
  });
  it('opens a row in read-only mode until edit is explicitly selected', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByText('PRE-00051'));
    expect(await screen.findByDisplayValue('สมชาย')).toBeDisabled();
    expect(screen.getByDisplayValue('กรองน้ำมัน')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'บันทึกใบสั่งจอง' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'แก้ไขใบสั่งจอง' }));
    expect(firstName()).toBeEnabled();
    expect(save()).toBeEnabled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each([
    { status: 'PENDING', po_status: 'APPROVED' },
    { status: 'ORDERED' },
    { status: 'PARTIALLY_RECEIVED' },
    { status: 'READY' },
    { status: 'COMPLETED' },
    { status: 'CANCELLED' },
    { status: 'PO_PENDING', can_edit: false },
  ])('blocks direct edit URLs for locked bookings: %j', async overrides => {
    mocks.detail.mockResolvedValue(preorder(overrides));
    mount('/owner/pre-orders?edit=51');
    expect(await screen.findByDisplayValue('สมชาย')).toBeDisabled();
    expect(screen.getByDisplayValue('กรองน้ำมัน')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'แก้ไขใบสั่งจอง' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'บันทึกใบสั่งจอง' })).not.toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('keeps an approved employee booking read-only when opened from a row', async () => {
    mocks.detail.mockResolvedValue(preorder({ po_status: 'APPROVED', po_id: 1 }));
    const user = userEvent.setup();
    mount('/employee/pre-orders');
    await user.click(await screen.findByText('PRE-00051'));
    expect(await screen.findByDisplayValue('สมชาย')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'แก้ไขใบสั่งจอง' })).not.toBeInTheDocument();
  });
  it.each(['PENDING', 'PO_PENDING', 'PO_DRAFT'])('allows editing unapproved bookings in %s', async status => {
    mocks.detail.mockResolvedValue(preorder({ status, po_status: 'PENDING', can_edit: true }));
    mount('/owner/pre-orders?edit=51');
    expect(await screen.findByDisplayValue('สมชาย')).toBeEnabled();
    expect(save()).toBeEnabled();
  });
  it('reports detail failures without opening an editable order', async () => {
    mocks.detail.mockRejectedValue(new Error('404'));
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByText('PRE-00051'));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({ variant: 'error', message: 'ไม่สามารถดึงข้อมูลรายละเอียดรายการจองนี้ได้' }));
    expect(screen.queryByRole('button', { name: 'บันทึกใบสั่งจอง' })).not.toBeInTheDocument();
  });
  it.each(['owner', 'employee'])('keeps automatic statuses without management controls on the %s list', async role => {
    mocks.list.mockResolvedValue([
      preorder({ id: 51, status: 'PENDING' }),
      preorder({ id: 52, status: 'ORDERED', po_status: 'APPROVED', po_id: 1 }),
      preorder({ id: 53, status: 'READY', po_status: 'APPROVED', po_id: 1 }),
      preorder({ id: 54, status: 'PARTIALLY_RECEIVED', po_status: 'APPROVED', po_id: 1 }),
      preorder({ id: 55, status: 'COMPLETED' }),
      preorder({ id: 56, status: 'CANCELLED' }),
    ]);
    mount(`/${role}/pre-orders`);
    await screen.findByText('PRE-00056');
    expect(screen.getByRole('columnheader', { name: 'สถานะ' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'จัดการ' })).not.toBeInTheDocument();
    for (const label of ['แก้ไข', 'ลบ', 'ส่งมอบสินค้า', 'ยกเลิกจอง']) {
      expect(screen.queryByRole('button', { name: label, exact: true })).not.toBeInTheDocument();
    }
    expect(screen.getAllByText('รออนุมัติสั่งซื้อ')).toHaveLength(2);
    expect(screen.getAllByText('รอสินค้า')).toHaveLength(2);
    expect(screen.getAllByText('พร้อมส่งมอบ')).toHaveLength(2);
    expect(screen.getAllByText('รับเข้าบางส่วน')).toHaveLength(2);
    expect(screen.getByText('ส่งมอบแล้ว')).toBeInTheDocument();
    expect(screen.getByText('ยกเลิก')).toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});

function resetMocks() {
  vi.resetAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.list.mockResolvedValue([preorder()]);
  mocks.detail.mockImplementation(async () => preorder());
  mocks.create.mockResolvedValue(preorder());
  mocks.update.mockResolvedValue(preorder());
  mocks.remove.mockResolvedValue({ message: 'deleted' });
  mocks.catalogs.mockResolvedValue([preorderCatalog]);
  mocks.get.mockImplementation(async (url: string) => ({ data: { data: url === '/customers' ? [preorderCustomer] : url === '/wms/products' ? [preorderProduct] : [] } }));
}

describe('Preorder form (real owner and employee pages, mocked API)', () => {
  beforeEach(resetMocks);

  it.each(['owner', 'employee'])('creates a preorder and stays under the %s route', async role => {
    const user = await readyForm(role);
    await user.type(screen.getByPlaceholderText('พิมพ์นามสกุล...'), 'ทดสอบ');
    await user.type(screen.getByPlaceholderText('08X-XXXXXXX'), '0812345678');
    await user.click(screen.getByRole('button', { name: 'ช่องทางการจอง' }));
    await user.click(screen.getByRole('option', { name: 'โทรศัพท์' }));
    await user.click(save());
    await waitFor(() => expect(mocks.create).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      pre_order_type: 'TEL', customer_id: 0, customer_name: 'ลูกค้าใหม่ ทดสอบ', customer_phone: '081-2345678',
      status: 'PENDING', deposit_amount: 0, order_date: expect.any(String),
      pre_order_items: [expect.objectContaining({ product_id: 21, quantity: 1, unit_price: 150, supplier_part_code: 'SUP-21', supplier_name: 'ร้านอะไหล่ทดสอบ' })],
    })));
    expect(Number.isNaN(Date.parse(mocks.create.mock.calls[0][0].order_date))).toBe(false);
    await waitFor(() => expect(screen.getByTestId('route').textContent).toBe(`/${role}/pre-orders`));
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith({ variant: 'success', message: 'สร้างรายการสั่งจองเรียบร้อยแล้ว' });
  });
  it('requires a customer name before saving', async () => {
    const user = await newForm();
    await addStock(user);
    await user.click(save());
    expect(firstName()).toBeInvalid();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('rejects whitespace-only customer names', async () => {
    const user = await newForm();
    await user.type(firstName(), '   ');
    await addStock(user);
    await user.click(save());
    expect(mocks.toast).toHaveBeenCalledWith({ variant: 'warning', message: 'กรุณาระบุชื่อลูกค้า' });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('requires at least one item', async () => {
    const user = await newForm();
    await user.type(firstName(), 'ลูกค้า');
    await user.click(save());
    expect(mocks.toast).toHaveBeenCalledWith({ variant: 'warning', message: 'กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ' });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('rejects incomplete phone numbers and preserves the form', async () => {
    const user = await readyForm();
    await user.type(screen.getByPlaceholderText('08X-XXXXXXX'), '08123');
    await user.click(save());
    expect(await screen.findByText('กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก (08X-XXXXXXX)')).toBeInTheDocument();
    expect(firstName()).toHaveValue('ลูกค้าใหม่');
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('fills an existing customer from autocomplete and keeps the customer ID', async () => {
    const user = await newForm();
    await user.type(firstName(), 'สม');
    await user.click(await screen.findByText('สมชาย ใจดี'));
    expect(firstName()).toHaveValue('สมชาย');
    expect(screen.getByPlaceholderText('พิมพ์นามสกุล...')).toHaveValue('ใจดี');
    expect(screen.getByPlaceholderText('08X-XXXXXXX')).toHaveValue('081-2345678');
    await addStock(user);
    await user.click(save());
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ customer_id: 7, customer_name: 'สมชาย ใจดี' }));
  });
  it('clears the existing customer ID when the selected customer name is replaced', async () => {
    const user = await newForm();
    await user.type(firstName(), 'สม');
    await user.click(await screen.findByText('สมชาย ใจดี'));
    await user.clear(firstName());
    await user.type(firstName(), 'คนใหม่');
    await addStock(user);
    await user.click(save());
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ customer_id: 0, customer_name: 'คนใหม่ ใจดี' }));
  });
  it('allows out-of-stock products to be preordered and updates the piece count', async () => {
    const user = await newForm();
    await user.type(searchProduct(), 'PART-21');
    expect(await screen.findByText('สต็อก: 0 ชิ้น (หมด)')).toBeInTheDocument();
    await user.click(screen.getByText('กรองน้ำมัน'));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '3' } });
    expect(screen.getByText('3 ชิ้น')).toBeInTheDocument();
    expect(searchProduct()).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'ลบรายการนี้' }));
    await user.click(screen.getByRole('button', { name: 'ยืนยันการลบ' }));
    expect(screen.queryByDisplayValue('กรองน้ำมัน')).not.toBeInTheDocument();
    expect(screen.getByText('0 ชิ้น')).toBeInTheDocument();
  });
  it('adds a catalog item with its supplier codes and standard price', async () => {
    const user = await newForm();
    await user.type(firstName(), 'ลูกค้า');
    await user.type(searchProduct(), 'CAT-PART-41');
    await user.click(await screen.findByText('สายพานทดสอบ'));
    expect(screen.getByDisplayValue('CAT-PART-41')).toBeInTheDocument();
    await user.click(save());
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ pre_order_items: [expect.objectContaining({ product_id: 0, product_name: 'สายพานทดสอบ', unit_price: 250, supplier_part_code: 'ST-41' })] }));
  });
  it('adds and saves a manually entered product', async () => {
    const user = await newForm();
    await user.type(firstName(), 'ลูกค้า');
    await user.type(searchProduct(), 'อะไหล่สั่งพิเศษ');
    await user.click(await screen.findByRole('button', { name: 'เพิ่ม "อะไหล่สั่งพิเศษ" เป็นสินค้าสั่งจองแบบกำหนดเอง' }));
    await user.type(screen.getByPlaceholderText('-'), 'CUSTOM-1');
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '4' } });
    await user.click(save());
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ pre_order_items: [expect.objectContaining({ product_id: 0, product_name: 'อะไหล่สั่งพิเศษ', product_code: 'CUSTOM-1', quantity: 4, unit_price: 0 })] }));
  });
  it.each(['0', '-1'])('does not submit an item with quantity %s', async quantity => {
    const user = await readyForm();
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: quantity } });
    await user.click(save());
    expect(screen.getByRole('spinbutton')).toBeInvalid();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('does not submit a custom item without a name', async () => {
    const user = await newForm();
    await user.type(firstName(), 'ลูกค้า');
    await user.type(searchProduct(), 'ทดสอบ');
    await user.click(await screen.findByRole('button', { name: 'เพิ่ม "ทดสอบ" เป็นสินค้าสั่งจองแบบกำหนดเอง' }));
    await user.clear(screen.getByPlaceholderText('ระบุชื่อสินค้า...'));
    await user.click(save());
    expect(screen.getByPlaceholderText('ระบุชื่อสินค้า...')).toBeInvalid();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('disables save while pending and sends only one request', async () => {
    let finish!: (value: ReturnType<typeof preorder>) => void;
    mocks.create.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const user = await readyForm();
    await user.click(save());
    const pending = screen.getByRole('button', { name: 'กำลังบันทึก...' });
    expect(pending).toBeDisabled();
    await user.click(pending);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    await act(async () => finish(preorder()));
    expect(await screen.findByText('PRE-00051')).toBeInTheDocument();
  });
  it('shows server errors, preserves input and allows retry', async () => {
    mocks.create.mockRejectedValueOnce({ response: { data: { error: 'บันทึกไม่ได้ กรุณาลองอีกครั้ง' } } });
    const user = await readyForm();
    await user.click(save());
    expect(await screen.findByText('บันทึกไม่ได้ กรุณาลองอีกครั้ง')).toBeInTheDocument();
    expect(firstName()).toHaveValue('ลูกค้าใหม่');
    expect(save()).toBeEnabled();
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
    await user.click(save());
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('PRE-00051')).toBeInTheDocument();
  });
  it('loads an edit URL and updates the original preorder', async () => {
    const original = preorder({ supplier_id: 8, deposit_amount: 500, order_date: '2025-12-01T08:00:00Z' });
    mocks.detail.mockResolvedValue(original);
    const user = userEvent.setup();
    mount('/owner/pre-orders?edit=51');
    await screen.findByDisplayValue('สมชาย');
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '5' } });
    await user.click(save());
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith(51, expect.objectContaining({ pre_order_items: [expect.objectContaining({ product_id: 21, quantity: 5, unit_price: 150 })] }));
    expect(mocks.create).not.toHaveBeenCalled();
    const patch = mocks.update.mock.calls[0][1];
    expect(patch).not.toHaveProperty('deposit_amount');
    expect(patch).not.toHaveProperty('supplier_id');
    expect(patch).not.toHaveProperty('order_date');
    expect({ ...original, ...patch }).toMatchObject({ deposit_amount: 500, supplier_id: 8, order_date: '2025-12-01T08:00:00Z' });
  });
  it.each(['owner', 'employee'])('cancels the %s form without saving', async role => {
    const user = await readyForm(role);
    await user.click(screen.getByRole('button', { name: 'ยกเลิก' }));
    expect(screen.getByTestId('route').textContent).toBe(`/${role}/pre-orders`);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('prefills an item from catalog navigation but leaves customer fields blank', async () => {
    mount('/owner/pre-orders', { prefillItem: preorderCatalog.catalog_items![0], catalog: preorderCatalog });
    expect(await screen.findByDisplayValue('สายพานทดสอบ')).toBeInTheDocument();
    expect(firstName()).toHaveValue('');
    expect(screen.getByPlaceholderText('08X-XXXXXXX')).toHaveValue('');
    expect(screen.getAllByPlaceholderText('ระบุชื่อสินค้า...')).toHaveLength(1);
    expect(screen.getByTestId('route').textContent).toBe('/owner/pre-orders?view=new');
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
