// ทดสอบสิทธิ์การเข้าถึง route ของ 3 บทบาท (Owner / Manager / Employee) โดยเรนเดอร์
// AppRouter จริงพร้อม MemoryRouter แล้วยิงไปที่แต่ละ path ตรงๆ — ไม่ mock ตรรกะ routing
// เลยแม้แต่นิดเดียว มีแค่หน้าจอจริง (หนักเกินไปสำหรับเทสต์นี้ ไม่เกี่ยวกับสิทธิ์) ที่ถูกแทนด้วย
// stub เบาๆ ที่บอกแค่ชื่อตัวเอง เพื่อดูว่า "ใครถูกเรนเดอร์จริง" ที่ path นั้นสำหรับแต่ละ role
//
// ครอบคลุมบั๊กที่เพิ่งแก้: 5 โมดูล (import-bills, pre-orders, claims, returns, orders) เคยไม่มี
// isManagerOrOwner gate เหมือน route อื่นในไฟล์เดียวกัน ทำให้พนักงานที่พิมพ์ URL /owner/... หรือ
// /manager/... ตรงๆ เห็นหน้าเวอร์ชันเจ้าของร้าน/ผู้จัดการเรนเดอร์ขึ้นมาเฉยๆ
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import AppRouter from './app_router';

const mocks = vi.hoisted(() => ({ role: 'OWNER' as string | null }));
vi.mock('../contexts/AuthContexts', () => ({
  useAuth: () => ({ role: mocks.role, isLoading: false, isAuthenticated: true }),
}));

// MainLayout ห่อ Sidebar/Navbar จริงซึ่งไม่เกี่ยวกับเทสต์นี้ ให้เรนเดอร์แค่ children ตรงๆ
vi.mock('../components/layer/main_layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="MainLayout">{children}</div>,
}));

// แทนทุกหน้าจอจริงด้วย stub ที่บอกแค่ชื่อตัวเอง — ไม่สนใจเนื้อหาข้างในหน้า สนใจแค่ "ถูกเรนเดอร์ไหม"
// ต้องอยู่ใน vi.hoisted เพราะ vi.mock ทุกตัวด้านล่างถูกยกขึ้นไปอยู่บนสุดของไฟล์ก่อนรัน
const { stub } = vi.hoisted(() => ({
  stub: (name: string) => () => <div data-testid={name}>{name}</div>,
}));
vi.mock('./login/Login', () => ({ default: stub('Login') }));
vi.mock('./profile/profile', () => ({ default: stub('ProfilePage') }));
vi.mock('./profile/change_password', () => ({ default: stub('ChangePasswordPage') }));
vi.mock('./owner/dashboard/dashboard', () => ({ default: stub('MainDashboard') }));
vi.mock('./owner/dashboard/saledashboard', () => ({ default: stub('SaleDashboard') }));
vi.mock('./owner/dashboard/debtdashboard', () => ({ default: stub('DebtDashboard') }));
vi.mock('./employee/pos/pos', () => ({ default: stub('Pos') }));
vi.mock('./employee/pos/sales_history', () => ({ default: stub('SalesHistory') }));
vi.mock('./owner/stock/stock', () => ({ default: stub('Stock') }));
vi.mock('./owner/stock/stock_movement/stock_movement', () => ({ default: stub('StockMovement') }));
vi.mock('./owner/stock/stock_movement/order_detail', () => ({ default: stub('StockMovementOrderDetail') }));
vi.mock('./owner/stock/stock_movement/pre_order_detail', () => ({ default: stub('StockMovementPreOrderDetail') }));
vi.mock('./owner/stock/Stock_data/stock_data', () => ({ default: stub('Stockdata') }));
vi.mock('./owner/stock/stock_check/stock_check', () => ({ default: stub('StockCheck') }));
vi.mock('./owner/stock/stock_check/add_check_stock_schedule', () => ({ default: stub('AddCheckStockSchedulePage') }));
vi.mock('./owner/stock/stock_check/schedule_detail', () => ({ default: stub('ScheduleDetailPage') }));
vi.mock('./owner/stock/product_detail/product_detail', () => ({ default: stub('ProductDetailPage') }));
vi.mock('./employee/wms/check_stock/check_stock_list', () => ({ default: stub('EmployeeCheckStockListPage') }));
vi.mock('./employee/wms/check_stock/check_stock_execute', () => ({ default: stub('EmployeeCheckStockExecutePage') }));
vi.mock('./employee/wms/stock_data/stock', () => ({ default: stub('EmployeeStockData') }));
vi.mock('./employee/wms/stock_data/product_detail/product_detail', () => ({ default: stub('EmployeeProductDetail') }));
vi.mock('./owner/stock/add_data_stock/add_data_stock', () => ({ default: stub('AddProductPage') }));
vi.mock('./owner/stock/edit_data_stock/edit_data_stock', () => ({ default: stub('EditProductPage') }));
vi.mock('./owner/stock/trash_stock/trash_stock', () => ({ default: stub('TrashStockPage') }));
vi.mock('./owner/import-bills/import_bill', () => ({ default: stub('ImportBill') }));
vi.mock('./owner/import-bills/edit-stock-bill', () => ({ default: stub('EditStockBillPage') }));
vi.mock('./owner/pre-order/pre-order', () => ({ default: stub('PreOrder') }));
vi.mock('./owner/pre-order/catalog', () => ({ default: stub('CatalogPage') }));
vi.mock('./owner/claim/claims', () => ({ default: stub('ClaimsPage') }));
vi.mock('./owner/claim/claim_detail', () => ({ default: stub('ClaimDetailPage') }));
vi.mock('./owner/claim/claim_edit', () => ({ default: stub('ClaimEditPage') }));
vi.mock('./owner/claim/claim_approve', () => ({ default: stub('ClaimApprovePage') }));
vi.mock('./owner/return/returns', () => ({ default: stub('ReturnsPage') }));
vi.mock('./owner/return/return_detail', () => ({ default: stub('ReturnDetailPage') }));
vi.mock('./owner/purchase_orders/purchase_orders', () => ({ default: stub('PurchaseOrders') }));
vi.mock('./owner/purchase_orders/create_po', () => ({ default: stub('CreatePurchaseOrders') }));
vi.mock('./owner/purchase_orders/po_detail', () => ({ default: stub('OrderDetail') }));
vi.mock('./employee/import', () => ({ default: stub('EmployeeImport') }));
vi.mock('./employee/pre-order', () => ({ default: stub('EmployeePreOrder') }));
vi.mock('./employee/claim/claims', () => ({ default: stub('EmployeeClaimsPage') }));
vi.mock('./mobile-scan/mobile_scan_page', () => ({ default: stub('MobileScanPage') }));
vi.mock('./public-product/public_product_page', () => ({ default: stub('PublicProductPage') }));
vi.mock('./employee/pos/sales_cancellation_history', () => ({ default: stub('SalesCancellationHistory') }));
vi.mock('./employee/transactions/settle_bills', () => ({ default: stub('SettleBills') }));
vi.mock('./employee/transactions/payment_history', () => ({ default: stub('PaymentHistory') }));
vi.mock('./employee/transactions/payment_cancellation_history', () => ({ default: stub('PaymentCancellationHistory') }));
vi.mock('./employee/customer/customer_registration', () => ({ default: stub('CustomerRegistration') }));
vi.mock('./owner/storeconfig/financial_policy', () => ({ default: stub('FinancialPolicy') }));
vi.mock('./owner/storeconfig/customer_credit_control', () => ({ default: stub('CustomerCreditControl') }));
vi.mock('./owner/storeconfig/storeconfig', () => ({ default: stub('StoreConfig') }));
vi.mock('./owner/storeconfig/employee_management', () => ({ default: stub('EmployeeManagementPage') }));
vi.mock('./owner/storeconfig/employee_registration', () => ({ default: stub('RegisterEmployeePage') }));
vi.mock('./owner/purchase_orders/restore_po', () => ({ default: stub('DeletedPoHistory') }));
vi.mock('./owner/return/new_return', () => ({ default: stub('NewReturnPage') }));

function mount(role: string, path: string) {
  mocks.role = role;
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRouter />
    </MemoryRouter>,
  );
}

// path -> ชื่อ stub ที่ควรเรนเดอร์เมื่อ Owner/Manager เข้าถึง (path เดียวกันใช้กับทั้งสอง role)
const OWNER_MANAGER_ONLY_ROUTES: [string, string][] = [
  ['/import-bills', 'ImportBill'],
  ['/import-bills/po', 'ImportBill'],
  ['/pre-orders', 'PreOrder'],
  ['/pre-orders/catalog', 'CatalogPage'],
  ['/claims', 'ClaimsPage'],
  ['/claims/detail/9', 'ClaimDetailPage'],
  ['/claims/edit/9', 'ClaimEditPage'],
  ['/returns', 'ReturnsPage'],
  ['/returns/new-return', 'NewReturnPage'],
  ['/orders', 'PurchaseOrders'],
  ['/new-orders', 'CreatePurchaseOrders'],
  ['/orders/restore', 'DeletedPoHistory'],
];

describe('สิทธิ์เข้าถึง route ของ 5 โมดูลที่เพิ่งแก้ (import-bills, pre-orders, claims, returns, orders)', () => {
  for (const prefix of ['/owner', '/manager']) {
    for (const [suffix, expectedStub] of OWNER_MANAGER_ONLY_ROUTES) {
      it(`${prefix}${suffix} เรนเดอร์ ${expectedStub} ให้ ${prefix === '/owner' ? 'Owner' : 'Manager'}`, () => {
        mount(prefix === '/owner' ? 'OWNER' : 'MANAGER', `${prefix}${suffix}`);
        expect(screen.getByTestId(expectedStub)).toBeInTheDocument();
      });
    }
  }

  for (const [suffix, blockedStub] of OWNER_MANAGER_ONLY_ROUTES) {
    it(`Employee พิมพ์ /owner${suffix} ตรงๆ ต้องไม่เห็น ${blockedStub} (ถูกเด้งออกไปหน้าอื่น)`, () => {
      mount('EMPLOYEE', `/owner${suffix}`);
      expect(screen.queryByTestId(blockedStub)).not.toBeInTheDocument();
    });

    it(`Employee พิมพ์ /manager${suffix} ตรงๆ ต้องไม่เห็น ${blockedStub} (ถูกเด้งออกไปหน้าอื่น)`, () => {
      mount('EMPLOYEE', `/manager${suffix}`);
      expect(screen.queryByTestId(blockedStub)).not.toBeInTheDocument();
    });
  }

  it('Employee ยังใช้เส้นทางของตัวเอง /employee/claims ได้ตามปกติ (ไม่ได้ถูกบล็อกไปด้วย)', () => {
    mount('EMPLOYEE', '/employee/claims');
    expect(screen.getByTestId('EmployeeClaimsPage')).toBeInTheDocument();
  });

  it('Employee ยังใช้เส้นทางของตัวเอง /employee/import ได้ตามปกติ', () => {
    mount('EMPLOYEE', '/employee/import');
    expect(screen.getByTestId('EmployeeImport')).toBeInTheDocument();
  });

  it('Employee ยังใช้เส้นทางของตัวเอง /employee/orders ได้ตามปกติ (สั่งซื้อไม่ได้ถูกกันสำหรับพนักงาน)', () => {
    mount('EMPLOYEE', '/employee/orders');
    expect(screen.getByTestId('PurchaseOrders')).toBeInTheDocument();
  });
});
