import React, { useMemo } from 'react';
import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import MainLayout from '../components/layer/main_layout'; 
import Login from './login/Login';
import MainDashboard from './owner/dashboard/dashboard'; 
import SaleDashboard from './owner/dashboard/saledashboard';
import DebtDashboard from './owner/dashboard/debtdashboard';
import Pos from './employee/pos/pos'; 
import SalesHistory from './employee/pos/sales_history';
import { getMenuByRole } from '../config/menu'; 
import { useAuth } from '../contexts/AuthContexts'; 
import StoreConfig from './owner/storeconfig/storeconfig'; 
import Stock from './owner/stock/stock';
import StockMovement from './owner/stock/stock_movement/stock_movement';
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
import OwnerSalesCancellationHistory from './owner/pos/sales_cancellation_history';
import RepaymentHistory from './employee/transactions/repayment_history';
import OwnerRepaymentHistory from './owner/transactions/repayment_history';
import SettleBills from './employee/transactions/settle_bills';

export default function AppRouter(): React.JSX.Element {
  const { role } = useAuth() as any;

  const { isAdminOrOwner, firstMenuPath } = useMemo(() => {
    const currentRole = (role || localStorage.getItem("role") || "").toUpperCase();
    const isOwnerOrAdmin = currentRole === "OWNER" || currentRole === "ADMIN";
    
    const userMenus = getMenuByRole(currentRole);
    const firstPath = userMenus && userMenus.length > 0 ? userMenus[0].path : "/login";

    return {
      isAdminOrOwner: isOwnerOrAdmin,
      firstMenuPath: firstPath
    };
  }, [role]); 

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

        {/* เฉพาะ OWNER หรือ ADMIN เท่านั้นที่เข้าได้ */}
        <Route path="/owner/dashboard/maindashboard" element={
          isAdminOrOwner ? <MainDashboard /> : <Navigate to={firstMenuPath} replace />
        } />
        <Route path="/owner/dashboard/salesdashboard" element={
          isAdminOrOwner ? <SaleDashboard /> : <Navigate to={firstMenuPath} replace />
        } />
        <Route path="/owner/dashboard/debtdashboard" element={
          isAdminOrOwner ? <DebtDashboard /> : <Navigate to={firstMenuPath} replace />
        } />

        <Route path="/owner/storeconfig" element={<StoreConfig />} />

        <Route path="/owner/stock" element={
          isAdminOrOwner ? <Stock /> : <Navigate to={firstMenuPath} replace />
        } />

        <Route path="/owner/stock/new" element={
          isAdminOrOwner ? <AddProductPage /> : <Navigate to={firstMenuPath} replace />
        } />

        <Route path="/owner/stock/:id" element={
          isAdminOrOwner ? <ProductDetailPage /> : <Navigate to={firstMenuPath} replace />
        } />

        <Route path="/owner/stock/:id/edit" element={
          isAdminOrOwner ? <EditProductPage /> : <Navigate to={firstMenuPath} replace />
        } />

        <Route path="/owner/stock/stock-movement" element={
          isAdminOrOwner ? <StockMovement /> : <Navigate to={firstMenuPath} replace />
        } />

        <Route path="/owner/stock/stock-check" element={
          isAdminOrOwner ? <StockCheck /> : <Navigate to={firstMenuPath} replace />
        } />

        <Route path="/owner/stock/stock-check/new" element={
          isAdminOrOwner ? <AddCheckStockSchedulePage /> : <Navigate to={firstMenuPath} replace />
        } />

        <Route path="/owner/stock/stock-check/:id" element={
          isAdminOrOwner ? <ScheduleDetailPage /> : <Navigate to={firstMenuPath} replace />
        } />

        <Route path="/owner/stock/stock-data" element={
          isAdminOrOwner ? <Stockdata /> : <Navigate to={firstMenuPath} replace />
        } />
        {/* -------- เพิ่ม Route สำหรับหน้านำเข้าบิลและจัดการราคาสินค้า -------- */}
        <Route path="/owner/import-bills" element={<ImportBill />} />
        <Route path="/owner/import-bills/scan" element={<ImportBill />} />
        <Route path="/owner/import-bills/excel" element={<ImportBill />} />
        <Route path="/owner/import-bills/mapping" element={<ImportBill />} />
        <Route path="/owner/import-bills/manual" element={<ImportBill />} />
        <Route path="/owner/import-bills/po" element={<ImportBill />} />
        <Route path="/owner/import-bills/approve/:id" element={<ImportBill />} />
        <Route path="/owner/import-bills/edit-stock-bill" element={
          isAdminOrOwner ? <EditStockBillPage /> : <Navigate to={firstMenuPath} replace />
        } />
        {/* -------------------------------------------------- */}
        
        {/* -------- เพิ่ม Route สำหรับหน้าพรีออเดอร์ตรงนี้ครับ -------- */}
        <Route path="/owner/pre-orders" element={<PreOrder />} />
        <Route path="/owner/pre-orders/catalog" element={<CatalogPage />} />
        <Route path="/owner/pre-order" element={<PreOrder />} />
        <Route path="/owner/pre-order/catalog" element={<CatalogPage />} />
        {/* --------------------------------------------------- */}

        {/* -------- เพิ่ม Route สำหรับหน้าคืนเเละเคลมสินค้าตรงนี้ครับ -------- */}
        <Route path="/owner/claims" element={<ClaimsPage />} />
        <Route path="/owner/claims/detail/:id" element={<ClaimDetailPage />} />
        <Route path="/owner/claims/edit/:id" element={<ClaimEditPage canApprove={true} />} />
        <Route path="/owner/claims/approve/:id" element={<ClaimApprovePage />} />
        <Route path="/owner/claims/status/:id" element={<Navigate to="/owner/claims/detail/:id" replace />} />
        <Route path="/owner/returns" element={<ReturnsPage />} />
        <Route path="/owner/returns/detail/:id" element={<ReturnDetailPage />} />
        {/* ----------------------------------------------------------- */}

        {/* -------- เพิ่ม Route สำหรับ POS -------- */}
        {/* ทุกคนใช้งาน */}
        <Route path="/owner/pos/pos" element={isAdminOrOwner ? <Pos /> : <Navigate to={firstMenuPath} replace />} />
        <Route path="/owner/pos/sales_history" element={isAdminOrOwner ? <SalesHistory /> : <Navigate to={firstMenuPath} replace />} />
        <Route path="/employee/pos/pos" element={<Pos />} />
        <Route path="/employee/pos/sales_history" element={<SalesHistory />} />
        
        {/* หน้าฝั่งพนักงาน */}
        <Route path="/employee/pos/sales_cancellation_history" element={<SalesCancellationHistory />} />
        
        {/* หน้าฝั่งเจ้าของร้าน (ล็อกสิทธิ์ด้วย isAdminOrOwner) */}
        <Route path="/owner/pos/sales_cancellation_history" element={
          isAdminOrOwner ? <OwnerSalesCancellationHistory /> : <Navigate to={firstMenuPath} replace />
        } />
        {/* --------------------------------------------------- */}

        {/* -------- หน้ารายการธุรกรรม / การเงิน -------- */}
        <Route path="/employee/transactions/settle-bills" element={<SettleBills />} />
        <Route path="/employee/transactions/repayment-history" element={<RepaymentHistory />} />

        <Route path="/owner/transactions/settle-bills" element={
          isAdminOrOwner ? <SettleBills /> : <Navigate to={firstMenuPath} replace />
        } />
        <Route path="/owner/transactions/repayment-history" element={
          isAdminOrOwner ? <OwnerRepaymentHistory /> : <Navigate to={firstMenuPath} replace />
        } />
        {/* --------------------------------------------------- */}

        <Route path="/owner/orders" element={<PurchaseOrders />} />
        <Route path="/owner/new-orders" element={<CreatePurchaseOrders />} />
        <Route path="/owner/orders/:id" element={<OrderDetail />} />
        {/* แดชบอร์ดของฝั่งพนักงาน */}
        <Route path="/employee/dashboard/maindashboard" element={
          !isAdminOrOwner ? <MainDashboard /> : <Navigate to={firstMenuPath} replace />
        } />
        <Route path="/employee/dashboard/salesdashboard" element={
          !isAdminOrOwner ? <SaleDashboard /> : <Navigate to={firstMenuPath} replace />
        } />
        <Route path="/employee/dashboard/debtdashboard" element={
          !isAdminOrOwner ? <DebtDashboard /> : <Navigate to={firstMenuPath} replace />
        } />

        <Route path="/employee/orders" element={<PurchaseOrders />} />
        <Route path="/employee/new-orders" element={<CreatePurchaseOrders />} />
        <Route path="/employee/orders/:id" element={<OrderDetail />} />

        {/* หน้านำเข้าบิลสำหรับพนักงาน */}
        <Route path="/employee/import" element={<EmployeeImport />} />
        <Route path="/employee/import/scan" element={<EmployeeImport />} />
        <Route path="/employee/import/excel" element={<EmployeeImport />} />
        <Route path="/employee/import/mapping" element={<EmployeeImport />} />
        <Route path="/employee/import/manual" element={<EmployeeImport />} />
        <Route path="/employee/import/po" element={<EmployeeImport />} />

        {/* หน้าพรีออเดอร์สำหรับพนักงาน */}
        <Route path="/employee/pre-orders" element={<EmployeePreOrder />} />
        <Route path="/employee/pre-orders/catalog" element={<CatalogPage isEmployee={true} />} />
        <Route path="/employee/pre-order" element={<EmployeePreOrder />} />
        <Route path="/employee/claims" element={<EmployeeClaimsPage />} />
        <Route path="/employee/claims/detail/:id" element={<ClaimDetailPage />} />
        <Route path="/employee/claims/edit/:id" element={<ClaimEditPage canApprove={false} />} />
        <Route path="/employee/claims/status/:id" element={<Navigate to="/employee/claims/detail/:id" replace />} />

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

      {/* ถ้าพิมพ์ URL มั่ว ให้ดีดกลับหน้าล็อกอิน */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
