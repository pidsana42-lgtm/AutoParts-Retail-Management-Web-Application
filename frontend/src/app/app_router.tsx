import React, { useMemo } from 'react';
import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import MainLayout from '../components/layer/main_layout'; 
import Login from './login/Login';
import ProfilePage from './profile/profile';
import ChangePasswordPage from './profile/change_password';
import MainDashboard from './owner/dashboard/dashboard'; 
import SaleDashboard from './owner/dashboard/saledashboard';
import DebtDashboard from './owner/dashboard/debtdashboard';
import Pos from './employee/pos/pos'; 
import SalesHistory from './employee/pos/sales_history';
import { getMenuByRole } from '../config/menu'; 
import { useAuth } from '../contexts/AuthContexts'; 
import Stock from './owner/stock/stock';
import StockMovement from './owner/stock/stock_movement/stock_movement';
import StockMovementOrderDetail from './owner/stock/stock_movement/order_detail';
import StockMovementPreOrderDetail from './owner/stock/stock_movement/pre_order_detail';
import Stockdata from './owner/stock/Stock_data/stock_data';
import StockCheck from './owner/stock/stock_check/stock_check';
import AddCheckStockSchedulePage from './owner/stock/stock_check/add_check_stock_schedule';
import ScheduleDetailPage from './owner/stock/stock_check/schedule_detail';
import ProductDetailPage from './owner/stock/product_detail/product_detail';
import EmployeeCheckStockListPage from './employee/wms/check_stock/check_stock_list';
import EmployeeCheckStockExecutePage from './employee/wms/check_stock/check_stock_execute';
import EmployeeStockData from './employee/wms/stock_data/stock';
import EmployeeProductDetail from './employee/wms/stock_data/product_detail/product_detail';
import AddProductPage from './owner/stock/add_data_stock/add_data_stock';
import EditProductPage from './owner/stock/edit_data_stock/edit_data_stock';
import TrashStockPage from './owner/stock/trash_stock/trash_stock';
import ImportBill from './owner/import-bills/import_bill';
import EditStockBillPage from './owner/import-bills/edit-stock-bill';
import PreOrder from './owner/pre-order/pre-order';
import CatalogPage from './owner/pre-order/catalog';
import ClaimsPage from './owner/claim/claims';
import ClaimDetailPage from './owner/claim/claim_detail';
import ClaimEditPage from './owner/claim/claim_edit';
import ClaimApprovePage from './owner/claim/claim_approve';
import ReturnsPage from './owner/return/returns';
import ReturnDetailPage from './owner/return/return_detail';
import PurchaseOrders from './owner/purchase_orders/purchase_orders';
import CreatePurchaseOrders from './owner/purchase_orders/create_po';
import OrderDetail from './owner/purchase_orders/po_detail';
import EmployeeImport from './employee/import';
import EmployeePreOrder from './employee/pre-order';
import EmployeeClaimsPage from './employee/claim/claims';
import MobileScanPage from './mobile-scan/mobile_scan_page';
import PublicProductPage from './public-product/public_product_page';
import SalesCancellationHistory from './employee/pos/sales_cancellation_history';
import SettleBills from './employee/transactions/settle_bills';
import PaymentHistory from './employee/transactions/payment_history';
import PaymentCancellationHistory from './employee/transactions/payment_cancellation_history';
import CustomerRegistration from './employee/customer/customer_registration';
import FinancialPolicy from './owner/storeconfig/financial_policy';
import CustomerCreditControl from './owner/storeconfig/customer_credit_control';
import StoreConfig from './owner/storeconfig/storeconfig';
import EmployeeManagementPage from './owner/storeconfig/employee_management';
import RegisterEmployeePage from './owner/storeconfig/employee_registration';
import DeletedPoHistory from './owner/purchase_orders/restore_po';
import NewReturnPage from './owner/return/new_return';
import { getDashboardRoleGroup } from '../utils/dashboardAccess';

export default function AppRouter(): React.JSX.Element {
  const { role, isLoading, isAuthenticated } = useAuth();

  const { isOwner, isManagerOrOwner, isEmployeeOrStaff, firstMenuPath } = useMemo(() => {
    const currentRole = (role || localStorage.getItem("role") || "").toUpperCase();
    const dashboardRoleGroup = getDashboardRoleGroup(currentRole);
    const isOwner = currentRole === 'OWNER';
    const isOwnerOrManager = dashboardRoleGroup === 'owner';
    const isEmployee = dashboardRoleGroup === 'employee';
    
    const userMenus = getMenuByRole(currentRole);
    const firstPath = userMenus && userMenus.length > 0 ? userMenus[0].path : "/login";

    return {
      isOwner,
      isManagerOrOwner: isOwnerOrManager,
      isEmployeeOrStaff: isEmployee,
      firstMenuPath: firstPath
    };
  }, [role]); 

  if (isLoading) return <></>;

  return (
    <Routes>
      {/* หน้าล็อกอิน (ทุกคนเข้าได้) */}
      <Route path="/login" element={<Login />} />

      {/* หน้าทั้งหมดที่ต้องมี Sidebar (MainLayout) ครอบ */}
      <Route element={
        <MainLayout>
          <Outlet /> 
        </MainLayout>
      }>
        
        {/* หน้าแรกสุด (/) ดีดส่งไปที่เมนูแรกสุดใน Sidebar ของ Role นั้นๆ */}
        <Route path="/" element={<Navigate to={firstMenuPath} replace />} />
        <Route path="/profile" element={
          isAuthenticated ? <ProfilePage /> : <Navigate to="/login" replace />
        } />
        <Route path="/change-password" element={
          isAuthenticated ? <ChangePasswordPage /> : <Navigate to="/login" replace />
        } />

        {/* ตั้งค่าข้อมูลร้านค้าและการตั้งค่าระบบ (StoreConfig): ให้สิทธิ์เฉพาะ OWNER เท่านั้น */}
        <Route path="/owner/storeconfig" element={
          isOwner ? <StoreConfig /> : <Navigate to={firstMenuPath} replace />
        } />
        <Route path="/owner/storeconfig/financial-policy" element={
          isOwner ? <FinancialPolicy /> : <Navigate to={firstMenuPath} replace />
        } />
        <Route path="/owner/storeconfig/customer-credit-control" element={
          isOwner ? <CustomerCreditControl /> : <Navigate to={firstMenuPath} replace />
        } />
        <Route path="/owner/storeconfig/register-employee" element={
          isOwner ? <EmployeeManagementPage /> : <Navigate to={firstMenuPath} replace />
        } />
        <Route path="/owner/storeconfig/register-employee/new" element={
          isOwner ? <RegisterEmployeePage /> : <Navigate to={firstMenuPath} replace />
        } />
        <Route path="/manager/storeconfig" element={
          <Navigate to={firstMenuPath} replace />
        } />
        <Route path="/manager/storeconfig/*" element={
          <Navigate to={firstMenuPath} replace />
        } />

        {/* เฉพาะ OWNER หรือ MANAGER เท่านั้นที่เข้าได้ (รองรับทั้ง path /owner และ /manager) */}
        {['/owner', '/manager'].map((prefix) => (
          <React.Fragment key={prefix}>
            <Route path={`${prefix}/dashboard/maindashboard`} element={
              isManagerOrOwner ? <MainDashboard /> : <Navigate to={firstMenuPath} replace />
            } />
            <Route path={`${prefix}/dashboard/salesdashboard`} element={
              isManagerOrOwner ? <SaleDashboard /> : <Navigate to={firstMenuPath} replace />
            } />
            <Route path={`${prefix}/dashboard/debtdashboard`} element={
              isManagerOrOwner ? <DebtDashboard /> : <Navigate to={firstMenuPath} replace />
            } />

            <Route path={`${prefix}/stock`} element={
              isManagerOrOwner ? <Stock /> : <Navigate to={firstMenuPath} replace />
            } />

            <Route path={`${prefix}/stock/new`} element={
              isManagerOrOwner ? <AddProductPage /> : <Navigate to={firstMenuPath} replace />
            } />

            <Route path={`${prefix}/stock/trash`} element={
              isManagerOrOwner ? <TrashStockPage /> : <Navigate to={firstMenuPath} replace />
            } />

            <Route path={`${prefix}/stock/:id`} element={
              isManagerOrOwner ? <ProductDetailPage /> : <Navigate to={firstMenuPath} replace />
            } />

            <Route path={`${prefix}/stock/:id/edit`} element={
              isManagerOrOwner ? <EditProductPage /> : <Navigate to={firstMenuPath} replace />
            } />

            <Route path={`${prefix}/stock/stock-movement`} element={
              isManagerOrOwner ? <StockMovement /> : <Navigate to={firstMenuPath} replace />
            } />

            <Route path={`${prefix}/stock/stock-movement/orders/:orderId`} element={
              isManagerOrOwner ? <StockMovementOrderDetail /> : <Navigate to={firstMenuPath} replace />
            } />

            <Route path={`${prefix}/stock/stock-movement/pre-orders/:id`} element={
              isManagerOrOwner ? <StockMovementPreOrderDetail /> : <Navigate to={firstMenuPath} replace />
            } />

            <Route path={`${prefix}/stock/stock-check`} element={
              isManagerOrOwner ? <StockCheck /> : <Navigate to={firstMenuPath} replace />
            } />

            <Route path={`${prefix}/stock/stock-check/new`} element={
              isManagerOrOwner ? <AddCheckStockSchedulePage /> : <Navigate to={firstMenuPath} replace />
            } />

            <Route path={`${prefix}/stock/stock-check/:id`} element={
              isManagerOrOwner ? <ScheduleDetailPage /> : <Navigate to={firstMenuPath} replace />
            } />

            <Route path={`${prefix}/stock/stock-data`} element={
              isManagerOrOwner ? <Stockdata /> : <Navigate to={firstMenuPath} replace />
            } />
            {/* -------- เพิ่ม Route สำหรับหน้านำเข้าบิลและจัดการราคาสินค้า --------
                หน้านี้และอีก 4 กลุ่มด้านล่าง (พรีออเดอร์, เคลม, คืนสินค้า, สั่งซื้อ) เดิมไม่มี
                isManagerOrOwner gate เหมือนทุก route อื่นในลูปนี้ พนักงานที่พิมพ์ URL prefix
                /owner หรือ /manager ตรงๆ (แทนที่จะใช้ /employee ตามเมนูของตัวเอง) จะเห็นหน้า
                เวอร์ชันเจ้าของร้าน/ผู้จัดการเรนเดอร์ขึ้นมาเฉยๆ ปุ่มที่สงวนไว้ (อนุมัติ/แก้ราคาทุน ฯลฯ)
                ยังโดน backend ปฏิเสธอยู่ (ตรวจสอบแล้วว่า RequireRoles ฝั่ง Go ครอบไว้ถูกต้อง) แต่
                ผู้ใช้จะเห็นปุ่มที่กดแล้วมีแต่ error ทั้งที่ไม่ควรเห็นตั้งแต่แรก จึงเติม gate ให้ครบ
                ให้ตรงกับแพทเทิร์นเดียวกับ route อื่นทั้งหมดในลูปนี้ */}
            <Route path={`${prefix}/import-bills`} element={
              isManagerOrOwner ? <ImportBill /> : <Navigate to={firstMenuPath} replace />
            } />
            <Route path={`${prefix}/import-bills/scan`} element={
              isManagerOrOwner ? <ImportBill /> : <Navigate to={firstMenuPath} replace />
            } />
            <Route path={`${prefix}/import-bills/excel`} element={
              isManagerOrOwner ? <ImportBill /> : <Navigate to={firstMenuPath} replace />
            } />
            <Route path={`${prefix}/import-bills/mapping`} element={
              isManagerOrOwner ? <ImportBill /> : <Navigate to={firstMenuPath} replace />
            } />
            <Route path={`${prefix}/import-bills/manual`} element={
              isManagerOrOwner ? <ImportBill /> : <Navigate to={firstMenuPath} replace />
            } />
            <Route path={`${prefix}/import-bills/po`} element={
              isManagerOrOwner ? <ImportBill /> : <Navigate to={firstMenuPath} replace />
            } />
            <Route path={`${prefix}/import-bills/approve/:id`} element={
              isManagerOrOwner ? <ImportBill /> : <Navigate to={firstMenuPath} replace />
            } />
            <Route path={`${prefix}/import-bills/edit-stock-bill`} element={
              isManagerOrOwner ? <EditStockBillPage /> : <Navigate to={firstMenuPath} replace />
            } />
            {/* -------------------------------------------------- */}
            
            {/* -------- เพิ่ม Route สำหรับหน้าพรีออเดอร์ตรงนี้ครับ -------- */}
            <Route path={`${prefix}/pre-orders`} element={
              isManagerOrOwner ? <PreOrder /> : <Navigate to={firstMenuPath} replace />
            } />
            <Route path={`${prefix}/pre-orders/catalog`} element={
              isManagerOrOwner ? <CatalogPage /> : <Navigate to={firstMenuPath} replace />
            } />
            <Route path={`${prefix}/pre-order`} element={
              isManagerOrOwner ? <PreOrder /> : <Navigate to={firstMenuPath} replace />
            } />
            <Route path={`${prefix}/pre-order/catalog`} element={
              isManagerOrOwner ? <CatalogPage /> : <Navigate to={firstMenuPath} replace />
            } />
            {/* --------------------------------------------------- */}

            {/* -------- เพิ่ม Route สำหรับหน้าคืนเเละเคลมสินค้าตรงนี้ครับ -------- */}
            <Route path={`${prefix}/claims`} element={
              isManagerOrOwner ? <ClaimsPage /> : <Navigate to={firstMenuPath} replace />
            } />
            <Route path={`${prefix}/claims/detail/:id`} element={
              isManagerOrOwner ? <ClaimDetailPage /> : <Navigate to={firstMenuPath} replace />
            } />
            <Route path={`${prefix}/claims/edit/:id`} element={
              isManagerOrOwner ? <ClaimEditPage canApprove={true} /> : <Navigate to={firstMenuPath} replace />
            } />
            <Route path={`${prefix}/claims/approve/:id`} element={
              isManagerOrOwner ? <ClaimApprovePage /> : <Navigate to={firstMenuPath} replace />
            } />
            <Route path={`${prefix}/claims/status/:id`} element={<Navigate to={`${prefix}/claims/detail/:id`} replace />} />
            <Route path={`${prefix}/returns`} element={
              isManagerOrOwner ? <ReturnsPage /> : <Navigate to={firstMenuPath} replace />
            } />
            <Route path={`${prefix}/returns/new-return`} element={
              isManagerOrOwner ? <NewReturnPage /> : <Navigate to={firstMenuPath} replace />
            } />
            <Route path={`${prefix}/returns/:id`} element={
              isManagerOrOwner ? <ReturnDetailPage /> : <Navigate to={firstMenuPath} replace />
            } />
            <Route path={`${prefix}/returns/detail/:id`} element={
              isManagerOrOwner ? <ReturnDetailPage /> : <Navigate to={firstMenuPath} replace />
            } />
            {/* ----------------------------------------------------------- */}

            {/* -------- เพิ่ม Route สำหรับ POS -------- */}
            <Route path={`${prefix}/pos/pos`} element={isManagerOrOwner ? <Pos /> : <Navigate to={firstMenuPath} replace />} />
            <Route path={`${prefix}/pos/sales_history`} element={isManagerOrOwner ? <SalesHistory /> : <Navigate to={firstMenuPath} replace />} />
            <Route path={`${prefix}/pos/sales_cancellation_history`} element={
              isManagerOrOwner ? <SalesCancellationHistory /> : <Navigate to={firstMenuPath} replace />
            } />

            {/* -------- หน้ารายการธุรกรรม / การเงิน -------- */}
            <Route path={`${prefix}/transactions/settle-bills`} element={
              isManagerOrOwner ? <SettleBills /> : <Navigate to={firstMenuPath} replace />
            } />
            <Route path={`${prefix}/transactions/payment-history`} element={
              isManagerOrOwner ? <PaymentHistory /> : <Navigate to={firstMenuPath} replace />
            } />
            <Route path={`${prefix}/transactions/payment-cancellation-history`} element={
              isManagerOrOwner ? <PaymentCancellationHistory /> : <Navigate to={firstMenuPath} replace />
            } />

            {/* ------------------ ข้อมูลลูกค้า ----------------- */}
            <Route path={`${prefix}/customers/customer-registration`} element={
              isManagerOrOwner ? <CustomerRegistration /> : <Navigate to={firstMenuPath} replace />
            } />

            {/* ------------------ สั่งซื้อ ----------------- */}
            <Route path={`${prefix}/orders`} element={
              isManagerOrOwner ? <PurchaseOrders /> : <Navigate to={firstMenuPath} replace />
            } />
            <Route path={`${prefix}/new-orders`} element={
              isManagerOrOwner ? <CreatePurchaseOrders /> : <Navigate to={firstMenuPath} replace />
            } />
            <Route path={`${prefix}/orders/:id`} element={
              isManagerOrOwner ? <OrderDetail /> : <Navigate to={firstMenuPath} replace />
            } />
            <Route path={`${prefix}/orders/restore`} element={
              isManagerOrOwner ? <DeletedPoHistory /> : <Navigate to={firstMenuPath} replace />
            } />
          </React.Fragment>
        ))}

        {/* -------- Route สำหรับ Employee (POS, รายการธุรกรรม, ลูกค้า) -------- */}
        <Route path="/employee/pos/pos" element={<Pos />} />
        <Route path="/employee/pos/sales_history" element={<SalesHistory />} />
        <Route path="/employee/pos/sales_cancellation_history" element={<SalesCancellationHistory />} />

        <Route path="/employee/transactions/settle-bills" element={<SettleBills />} />
        <Route path="/employee/transactions/payment-history" element={<PaymentHistory />} />
        <Route path="/employee/transactions/payment-cancellation-history" element={<PaymentCancellationHistory />} />

        <Route path="/employee/customers/customer-registration" element={<CustomerRegistration />} />

        {/* แดชบอร์ดของฝั่งพนักงาน */}
        <Route path="/employee/dashboard/maindashboard" element={
          isEmployeeOrStaff ? <MainDashboard /> : <Navigate to={firstMenuPath} replace />
        } />
        <Route path="/employee/dashboard/salesdashboard" element={
          isEmployeeOrStaff ? <SaleDashboard /> : <Navigate to={firstMenuPath} replace />
        } />
        <Route path="/employee/dashboard/debtdashboard" element={
          isEmployeeOrStaff ? <DebtDashboard /> : <Navigate to={firstMenuPath} replace />
        } />

        <Route path="/employee/orders" element={<PurchaseOrders />} />
        <Route path="/employee/new-orders" element={<CreatePurchaseOrders />} />
        <Route path="/employee/orders/:id" element={<OrderDetail />} />
        <Route path="/employee/orders/restore" element={<DeletedPoHistory />} />

        {/* หน้านำเข้าบิลสำหรับพนักงาน */}
        <Route path="/employee/import" element={<EmployeeImport />} />
        <Route path="/employee/import/scan" element={<EmployeeImport />} />
        <Route path="/employee/import/excel" element={<EmployeeImport />} />
        <Route path="/employee/import/mapping" element={<EmployeeImport />} />
        <Route path="/employee/import/manual" element={<EmployeeImport />} />
        <Route path="/employee/import/po" element={<EmployeeImport />} />
        <Route path="/employee/import/approve/:id" element={<EmployeeImport />} />

        {/* หน้าพรีออเดอร์สำหรับพนักงาน */}
        <Route path="/employee/pre-orders" element={<EmployeePreOrder />} />
        <Route path="/employee/pre-orders/catalog" element={<CatalogPage isEmployee={true} />} />
        <Route path="/employee/pre-order" element={<EmployeePreOrder />} />
        <Route path="/employee/claims" element={<EmployeeClaimsPage />} />
        <Route path="/employee/claims/detail/:id" element={<ClaimDetailPage />} />
        <Route path="/employee/claims/edit/:id" element={<ClaimEditPage canApprove={false} />} />
        <Route path="/employee/claims/status/:id" element={<Navigate to="/employee/claims/detail/:id" replace />} />

        <Route path="/employee/returns" element={<ReturnsPage />} />
        <Route path="/employee/returns/new-return" element={<NewReturnPage />} />
        <Route path="/employee/returns/:id" element={<ReturnDetailPage />} />
        <Route path="/employee/returns/detail/:id" element={<ReturnDetailPage />} />

        {/* หน้าตรวจนับสต็อกสำหรับพนักงาน */}
        <Route path="/employee/wms/check-stock" element={<EmployeeCheckStockListPage />} />
        <Route path="/employee/wms/check-stock/:id" element={<EmployeeCheckStockExecutePage />} />
        <Route path="/employee/wms/stock-data" element={<EmployeeStockData />} />
        <Route path="/employee/wms/stock-data/:id" element={<EmployeeProductDetail />} />

      </Route>

      {/* หน้ามือถือสำหรับส่งรูปบิล — ไม่ต้อง login */}
      <Route path="/mobile-scan" element={<MobileScanPage />} />
      <Route path="/product/:id" element={<PublicProductPage />} />

      {/* มือถือสแกน QR ของตารางเช็คสต็อกมาที่นี่ — ไม่ครอบด้วย MainLayout (ไม่มี Sidebar/Navbar ของระบบรวม)
          โชว์ตรงหน้าเช็คสินค้าของงานนั้นเลย ใช้ component เดียวกับหน้าในระบบ (ตัว component เองเช็ค token ให้เข้าได้โดยไม่ต้องล็อกอิน) */}
      <Route path="/wms/check-stock-scan/:id" element={<EmployeeCheckStockExecutePage />} />

      {/* ถ้าพิมพ์ URL มั่ว/ลิงก์เก่าที่ย้ายไปแล้ว: คนที่ล็อกอินอยู่ต้องไม่ถูกดีดออกจากระบบ
          เดิมดีดไป /login เสมอไม่ว่าจะล็อกอินอยู่หรือไม่ ทำให้ session ที่ยังใช้ได้ปกติ
          ดูเหมือนถูกล็อกเอาท์ทันทีที่พิมพ์ URL ผิดหรือกดลิงก์เก่า จึงต้องเช็ค isAuthenticated ก่อน
          แล้วพาไปหน้าแรกของเมนูตาม role แทน เหมือนที่ path "/" ทำ */}
      <Route path="*" element={<Navigate to={isAuthenticated ? firstMenuPath : "/login"} replace />} />
    </Routes>
  );
}
