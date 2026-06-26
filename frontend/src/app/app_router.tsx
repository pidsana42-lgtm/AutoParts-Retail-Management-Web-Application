import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './login/Login';
import Dashboard from './owner/dashboard/dashboard'; 

function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/owner/dashboard" element={<Dashboard />} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default AppRouter;