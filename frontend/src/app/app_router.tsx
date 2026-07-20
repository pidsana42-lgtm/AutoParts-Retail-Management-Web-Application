import React, { useMemo } from 'react';
import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import MainLayout from '../components/layer/main_layout'; 
import Login from './login/Login';
import Dashboard from './owner/dashboard/dashboard'; 
import Pos from './employee/pos/pos'; 
import { getMenuByRole } from '../config/menu'; 
import { useAuth } from '../contexts/AuthContexts'; 
import StoreConfig from './owner/storeconfig/storeconfig'; 
import EmployeeDashboard from './employee/dashboard/dashboard';
import Stock from './owner/stock/stock';
import StockMovement from './owner/stock/stock_movement/stock_movement';
import Stockdata from './owner/stock/Stock_data/stock_data';
import ImportBill from './owner/import-bills/import_bill';
import PreOrder from './owner/pre-order/pre-order';
import ClaimsPage from './owner/claim/claims';
import ClaimDetailPage from './owner/claim/claim_detail';
import ReturnsPage from './owner/return/returns';
import ReturnDetailPage from './owner/return/return_detail';
import PurchaseOrders from './owner/purchase_orders/purchase_orders';
import CreatePurchaseOrders from './owner/purchase_orders/create_po';

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
        <Route path="/owner/dashboard" element={
          isAdminOrOwner ? <Dashboard /> : <Navigate to={firstMenuPath} replace />
        } />

        <Route path="/owner/storeconfig" element={<StoreConfig />} />

        <Route path="/owner/stock" element={
          isAdminOrOwner ? <Stock /> : <Navigate to={firstMenuPath} replace />
        } />

        <Route path="/owner/stock/stock-movement" element={
          isAdminOrOwner ? <StockMovement /> : <Navigate to={firstMenuPath} replace />
        } />

        <Route path="/owner/stock/stock-data" element={
          isAdminOrOwner ? <Stockdata /> : <Navigate to={firstMenuPath} replace />
        } />
        {/* -------- เพิ่ม Route สำหรับหน้านำเข้าบิลตรงนี้ครับ -------- */}
        <Route path="/owner/import-bills" element={<ImportBill />} />
        {/* -------------------------------------------------- */}
        
        {/* -------- เพิ่ม Route สำหรับหน้าพรีออเดอร์ตรงนี้ครับ -------- */}
        <Route path="/owner/pre-orders" element={<PreOrder />} />
        {/* --------------------------------------------------- */}

        {/* -------- เพิ่ม Route สำหรับหน้าคืนเเละเคลมสินค้าตรงนี้ครับ -------- */}
        <Route path="/owner/claims" element={<ClaimsPage />} />
        <Route path="/owner/claims/detail/:id" element={<ClaimDetailPage />} />
        <Route path="/owner/returns" element={<ReturnsPage />} />
        <Route path="/owner/returns/detail/:id" element={<ReturnDetailPage />} />
        {/* ----------------------------------------------------------- */}

        <Route path="/employee/pos" element={<Pos />} />
        <Route path="/owner/orders" element={<PurchaseOrders />} />
        <Route path="/owner/new-orders" element={<CreatePurchaseOrders />} />
        
        {/* แดชบอร์ดของฝั่งพนักงาน */}
        <Route path="/employee/dashboard" element={
          !isAdminOrOwner ? <EmployeeDashboard /> : <Navigate to={firstMenuPath} replace />
        } />

        <Route path="/employee/orders" element={<PurchaseOrders />} />

      </Route>

      {/* ถ้าพิมพ์ URL มั่ว ให้ดีดกลับหน้าล็อกอิน */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}