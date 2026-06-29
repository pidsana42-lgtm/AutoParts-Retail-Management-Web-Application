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
        <Route path="/employee/pos" element={<Pos />} />
        
        {/* แดชบอร์ดของฝั่งพนักงาน */}
        <Route path="/employee/dashboard" element={
          !isAdminOrOwner ? <EmployeeDashboard /> : <Navigate to={firstMenuPath} replace />
        } />

      </Route>

      {/* ถ้าพิมพ์ URL มั่ว ให้ดีดกลับหน้าล็อกอิน */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}