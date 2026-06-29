import React, { useState } from 'react';
// Import Layout ที่มี Sidebar และ Navbar
import MainLayout from '../../../components/layer/main_layout'; 
// Import Elements ตามที่คุณมี
import Heading from '../../../components/elements/heading';
import Text from '../../../components/elements/text';
import Input from '../../../components/elements/input';
import Button from '../../../components/elements/button';

export default function ImportBill() {
  const [billImage, setBillImage] = useState<File | null>(null);

  // ฟังก์ชันจำลองการอัปโหลดไฟล์
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setBillImage(e.target.files[0]);
    }
  };

  return (
    <MainLayout>
      <div className="p-6 bg-gray-50 min-h-screen">
        
        {/* ส่วนหัวหน้าเว็บ */}
        <div className="flex justify-between items-center mb-6">
          <Heading level="h2" className="text-2xl font-bold text-gray-800">
            นำเข้าสินค้าจากบิล
          </Heading>
          <div className="flex gap-2">
            <Button variant="outline" className="bg-white border-gray-300 text-gray-700">ยกเลิก</Button>
            <Button variant="primary" className="bg-blue-600 text-white">บันทึกข้อมูล</Button>
          </div>
        </div>

        {/* โครงสร้าง Grid แบ่งซ้าย-ขวา */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* คอลัมน์ซ้าย: อัปโหลดและแสดงภาพบิล */}
          <div className="lg:col-span-1 bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col gap-4">
            <Text className="font-semibold text-lg text-gray-700">รูปภาพบิล / ใบเสร็จ</Text>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center text-center h-64 bg-gray-50">
              {billImage ? (
                <Text className="text-green-600 font-medium">อัปโหลดรูปแล้ว: {billImage.name}</Text>
              ) : (
                <>
                  <Text className="text-gray-500 mb-2">ลากไฟล์มาวางที่นี่ หรือ</Text>
                  {/* ซ่อน input ตัวจริง และใช้ label เป็นปุ่มกด */}
                  <label className="cursor-pointer text-blue-600 font-medium hover:underline">
                    คลิกเพื่ออัปโหลด
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                  </label>
                </>
              )}
            </div>
            
            <Button className="w-full bg-indigo-600 text-white mt-2">
              สแกนข้อมูลจากบิล (OCR)
            </Button>
          </div>

          {/* คอลัมน์ขวา: ข้อมูลบิลและรายการสินค้า */}
          <div className="lg:col-span-2 bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col gap-6">
            
            {/* ข้อมูลทั่วไปของบิล */}
            <div>
              <Text className="font-semibold text-lg text-gray-700 mb-4">ข้อมูลบิล</Text>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Text className="text-sm text-gray-600 mb-1">เลขที่บิล (Invoice No.)</Text>
                  <Input type="text" placeholder="ระบุเลขที่บิล" className="w-full" />
                </div>
                <div>
                  <Text className="text-sm text-gray-600 mb-1">วันที่ (Date)</Text>
                  <Input type="date" className="w-full" />
                </div>
                <div className="md:col-span-2">
                  <Text className="text-sm text-gray-600 mb-1">ชื่อซัพพลายเออร์ (Supplier)</Text>
                  <Input type="text" placeholder="ระบุชื่อร้านค้าส่ง" className="w-full" />
                </div>
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* ตารางรายการสินค้า */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <Text className="font-semibold text-lg text-gray-700">รายการสินค้า</Text>
                <Button variant="secondary" className="bg-gray-100 text-gray-700 text-sm py-1 px-3">
                  + เพิ่มแถว
                </Button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-sm">
                      <th className="p-2 font-medium text-gray-600">รหัส/ชื่อสินค้า</th>
                      <th className="p-2 font-medium text-gray-600 text-right">จำนวน</th>
                      <th className="p-2 font-medium text-gray-600 text-right">ราคาต่อหน่วย</th>
                      <th className="p-2 font-medium text-gray-600 text-right">รวม</th>
                      <th className="p-2 font-medium text-gray-600 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* ตัวอย่าง Mock Data 1 แถว */}
                    <tr className="border-b border-gray-100 text-sm hover:bg-gray-50">
                      <td className="p-2">
                        <Input type="text" placeholder="ชื่อสินค้า..." className="w-full text-sm" />
                      </td>
                      <td className="p-2">
                        <Input type="number" defaultValue="1" className="w-full text-sm text-right" />
                      </td>
                      <td className="p-2">
                        <Input type="number" defaultValue="0" className="w-full text-sm text-right" />
                      </td>
                      <td className="p-2 text-right align-middle text-gray-700 font-medium">
                        ฿0.00
                      </td>
                      <td className="p-2 text-center align-middle">
                        <button className="text-red-500 hover:text-red-700 font-bold">✕</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </div>
    </MainLayout>
  );
}