import { Routes, Route } from 'react-router-dom';
import Login from './login/Login';
import Dashboard from './owner/dashboard/dashboard';

const AppRouter = () => {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
    </Routes>
  );
};

export default AppRouter;