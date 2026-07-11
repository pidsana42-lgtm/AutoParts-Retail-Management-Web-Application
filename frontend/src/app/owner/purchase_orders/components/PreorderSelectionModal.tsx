import React from 'react';
import { X, Plus } from 'lucide-react';
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
      <div className="bg-white rounded-md shadow-xl w-full max-w-4xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50 shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">เลือกรายการพรีออเดอร์</h3>
            <p className="text-sm text-gray-500 font-light mt-1">คลิกเพิ่มสินค้าที่ต้องการสั่งซื้อจากรายการที่ลูกค้าสั่งจองไว้</p>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded hover:bg-gray-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content (Table) */}
        <div className="overflow-y-auto p-6 flex-1">
          <Table>
            <TableHeader className="bg-gray-100 text-gray-600">
              <TableRow>
                <TableHead className="pl-4">รหัสสินค้า</TableHead>
                <TableHead>ชื่อสินค้า</TableHead>
                <TableHead className="text-center">จำนวนที่ลูกค้าสั่ง</TableHead>
                <TableHead className="text-center">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preorders.length > 0 ? (
                preorders.map((order, index) => (
                  <TableRow key={order.id || index} className="hover:bg-gray-50/70 transition-colors">
                    <TableCell className="pl-4 font-medium text-gray-900">{order.product_code}</TableCell>
                    <TableCell className="text-gray-700">{order.product_name}</TableCell>
                    <TableCell className="text-center font-medium text-gray-900">{order.quantity}</TableCell>
                    <TableCell className="text-center">
                      <button
                        onClick={() => onSelectPreorder(order)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> เพิ่ม
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