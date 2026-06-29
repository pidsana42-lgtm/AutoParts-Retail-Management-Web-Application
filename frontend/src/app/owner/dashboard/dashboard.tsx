// import React from 'react';
// import { LayoutDashboard, Package, ShoppingCart, BarChart3, Users, Settings } from 'lucide-react';

// const Dashboard: React.FC = () => {
//   return (
//     <div className="flex min-h-screen bg-gray-100">
//       {/* Sidebar */}
//       <aside className="w-64 bg-zinc-900 text-white p-6">
//         <h2 className="text-2xl font-bold mb-10 text-[#B70011]">PARTSPRO</h2>
//         <nav className="space-y-4">
//           <NavItem icon={<LayoutDashboard size={20}/>} label="ภาพรวมระบบ" active />
//           <NavItem icon={<Package size={20}/>} label="จัดการสต็อก" />
//           <NavItem icon={<ShoppingCart size={20}/>} label="รายการขาย" />
//           <NavItem icon={<BarChart3 size={20}/>} label="รายงานวิเคราะห์" />
//           <NavItem icon={<Users size={20}/>} label="พนักงาน" />
//         </nav>
//       </aside>

//       {/* Main Content */}
//       <main className="flex-1 p-8">
//         <header className="flex justify-between items-center mb-8">
//           <h1 className="text-2xl font-bold">ภาพรวมระบบ (Dashboard)</h1>
//           <button className="bg-[#B70011] text-white px-4 py-2 rounded">ออกรายงาน</button>
//         </header>

//         {/* Stats Cards */}
//         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
//           <StatCard title="ยอดขายวันนี้" value="฿ 24,500" />
//           <StatCard title="รายการสินค้าคงเหลือ" value="1,240 รายการ" />
//           <StatCard title="สินค้าที่ต้องสั่งเพิ่ม" value="12 รายการ" />
//         </div>

//         {/* Chart/Table Placeholder */}
//         <div className="bg-white p-6 rounded-lg shadow-sm">
//           <h3 className="font-bold mb-4">รายการขายล่าสุด</h3>
//           <div className="h-64 bg-gray-50 flex items-center justify-center border-2 border-dashed border-gray-200">
//             [ กราฟวิเคราะห์การขาย หรือ ตารางรายการล่าสุดจะอยู่ตรงนี้ ]
//           </div>
//         </div>
//       </main>
//     </div>
//   );
// };

// // Component ย่อย
// const NavItem = ({ icon, label, active = false }: any) => (
//   <div className={`flex items-center gap-3 cursor-pointer p-2 rounded ${active ? 'bg-[#B70011]' : 'hover:bg-zinc-800'}`}>
//     {icon} <span>{label}</span>
//   </div>
// );

// const StatCard = ({ title, value }: any) => (
//   <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-[#B70011]">
//     <p className="text-sm text-gray-500">{title}</p>
//     <p className="text-2xl font-bold mt-1">{value}</p>
//   </div>
// );

// export default Dashboard;

import { useState } from 'react';
import Button from '../../../components/elements/button';
import Card from '../../../components/elements/card';
import Heading from '../../../components/elements/heading';
import Input from '../../../components/elements/input';
import Modal from '../../../components/elements/modal';
import Select from '../../../components/elements/select';
import Table from '../../../components/elements/table';
import Text from '../../../components/elements/text';

export default function DashboardPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ตัวอย่างข้อมูลสำหรับตาราง
  const data = [{ id: 1, name: 'Item A', status: 'Active' }];
  const columns = [
    { key: 'name', header: 'Product Name' },
    { key: 'status', header: 'Status' }
  ];

  return (
    <div className="p-8 space-y-6">
      <Heading level="h1">Dashboard Overview</Heading>
      
      <Card title="Management Panel" subtitle="System controls">
        <div className="flex gap-4 items-end">
          <Input label="Search" placeholder="Enter keyword..." />
          <Select 
            label="Category" 
            options={[{ label: 'Auto Parts', value: 'parts' }]} 
          />
          <Button onClick={() => setIsModalOpen(true)}>Add New</Button>
        </div>
      </Card>

      <Card title="Data List" noPadding>
        <Table 
          data={data} 
          columns={columns} 
          rowKey={(row) => row.id.toString()} 
        />
      </Card>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Add New Item"
      >
        <Text variant="body">Fill in the details below to add a new record to the system.</Text>
        <Input label="Item Name" placeholder="Part name" />
      </Modal>
    </div>
  );
}