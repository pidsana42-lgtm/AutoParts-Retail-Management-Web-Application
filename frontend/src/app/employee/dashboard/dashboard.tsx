import React from 'react';
import { LayoutDashboard, Package, ShoppingCart, BarChart3, Users } from 'lucide-react';

const Dashboard: React.FC = () => {
  return (
    <div className="w-full">
      {/* 1. ส่วนหัวเว็บที่อยู่ในกรอบสีขาวด้านล่าง Navbar */}
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-xl font-bold text-gray-800">ภาพรวมระบบ (Dashboard)</h1>
        <button className="bg-[#B70011] hover:bg-[#90000d] text-white px-4 py-2 rounded text-sm font-medium transition-colors">
          ออกรายงาน
        </button>
      </header>

      

      {/* 3. ตาราง/พื้นที่แสดงผลข้อมูลกราฟ */}
      <div className="bg-white p-6 rounded shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-800 mb-4">รายการขายล่าสุด</h3>
        <div className="h-64 bg-gray-50 flex items-center justify-center border-2 border-dashed border-gray-200 text-gray-400 text-sm rounded">
        
        </div>
      </div>
    </div>
  );
};

// Component ย่อยสำหรับการ์ดสถิติ (ระบุ Type เพิ่มเติมเพื่อความโปร่งใสของ TS)
interface StatCardProps {
  title: string;
  value: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value }) => (
  <div className="bg-white p-6 rounded shadow-sm border-l-4 border-[#B70011] border-t border-r border-b border-gray-100">
    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{title}</p>
    <p className="text-2xl font-bold text-gray-800 mt-2">{value}</p>
  </div>
);

export default Dashboard;