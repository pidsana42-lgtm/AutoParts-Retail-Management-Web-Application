import React from 'react';
import { X, CircleFadingPlus } from 'lucide-react';
import type { PreorderItem } from '../../../../interface/purchase_orders/po_interface';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../../components/elements/table";

interface PreorderSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  preorders: PreorderItem[];
  onSelectPreorder: (item: PreorderItem) => void;
}

export const PreorderSelectionModal: React.FC<PreorderSelectionModalProps> = ({ 
  isOpen, 
  onClose, 
  preorders,
  onSelectPreorder
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      {/* ปรับขนาดให้กว้างขึ้นเพื่อแสดงตารางได้สวยงาม */}
      <div className="bg-white rounded-none shadow-xl w-full max-w-4xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50 shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">เลือกรายการพรีออเดอร์</h3>
            <p className="text-sm text-gray-500 font-light mt-1">คลิกเพิ่มสินค้าที่ต้องการสั่งซื้อจากรายการที่ลูกค้าสั่งจองไว้</p>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-none hover:bg-gray-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content (Table) */}
        <div className="overflow-y-auto p-6 flex-1">
          <Table>
            <TableHeader className="bg-gray-100 text-gray-600">
              <TableRow>
                <TableHead className="pl-4">ลำดับ</TableHead>
                <TableHead className="pl-4">รหัสสินค้า</TableHead>
                <TableHead>ชื่อสินค้า</TableHead>
                <TableHead className="text-center">จำนวนที่สั่ง</TableHead>
                <TableHead className="text-right pr-6">ราคาคาดการณ์</TableHead>
                <TableHead className="text-center">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preorders.length > 0 ? (
                preorders.map((order, index) => (
                  <TableRow key={order.id || index} className="hover:bg-gray-50/70 transition-colors">
                    <TableCell className="pl-4 text-black">{index + 1}</TableCell>
                    <TableCell className="pl-4 text-black">{order.product_code}</TableCell>
                    <TableCell className="text-black">{order.product_name}</TableCell>
                    <TableCell className="text-center text-black">{order.quantity}</TableCell>
                    <TableCell className="text-right pr-6 text-black">{order.unit_price.toLocaleString()} ฿</TableCell>
                    <TableCell className="text-center">
                      <button
                        onClick={() => onSelectPreorder(order)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-red-700 hover:text-red-800 transition-colors cursor-pointer"
                      >
                        <CircleFadingPlus size={12} /> เพิ่ม
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-gray-500">
                    ไม่มีรายการพรีออเดอร์ค้างอยู่ในระบบ
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
      </div>
    </div>
  );
};