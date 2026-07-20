import React, { useState, useMemo } from "react";
import { Plus, Trash2, SquarePen } from "lucide-react";
import { useToast } from "../../../../../components/elements/toast";

import { stockDataService } from "../../../../../service/http/wms/stock_data_service";
import type { Supplier } from "../../../../../interface/wms/stock_data";

// Extracted Modals
import AddSupplierModal from "./AddSupplierModal";
import EditSupplierModal from "./EditSupplierModal";

interface SupplierTabProps {
  search: string;
  suppliers: Supplier[];
  loadData: () => void;
}

export default function SupplierTab({ search, suppliers, loadData }: SupplierTabProps) {
  const { toast } = useToast();

  // Modals visibility state
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const handleDeleteSupplier = async (id: number) => {
    if (!confirm("คุณแน่ใจว่าต้องการลบบริษัทสั่งซื้อนี้?")) return;
    try {
      await stockDataService.deleteSupplier(id);
      toast({ variant: "success", message: "ลบบริษัทสั่งซื้อสำเร็จ" });
      loadData();
    } catch (err) {
      toast({ variant: "error", message: "เกิดข้อผิดพลาดในการลบบริษัทสั่งซื้อ" });
    }
  };

  const openEditSupplier = (sup: Supplier) => {
    setSelectedSupplier(sup);
    setEditOpen(true);
  };

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(
      (sup) =>
        !search ||
        sup.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
        sup.short_supplier_name.toLowerCase().includes(search.toLowerCase()) ||
        sup.phone_number_sale.toLowerCase().includes(search.toLowerCase())
    );
  }, [suppliers, search]);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="bg-[#F2ECE9] border-b border-slate-200">
              <th className="px-6 py-3.5 font-semibold text-slate-700">ชื่อบริษัท</th>
              <th className="px-6 py-3.5 font-semibold text-slate-700">ชื่อย่อ</th>
              <th className="px-6 py-3.5 font-semibold text-slate-700">เบอร์โทรศัพท์</th>
              <th className="px-6 py-3.5 font-semibold text-slate-700">Line ID</th>
              <th className="px-6 py-3.5 font-semibold text-slate-700">อีเมล</th>
              <th className="px-6 py-3.5 font-semibold text-slate-700">เลขที่บัญชี</th>
              <th className="px-6 py-3.5 font-semibold text-slate-700 text-right w-24">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredSuppliers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-slate-400">
                  ไม่พบข้อมูลบริษัทสั่งซื้อ
                </td>
              </tr>
            ) : (
              filteredSuppliers.map((sup) => (
                <tr key={sup.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-3 text-slate-800 font-medium">{sup.supplier_name}</td>
                  <td className="px-6 py-3 text-slate-600">{sup.short_supplier_name}</td>
                  <td className="px-6 py-3 text-slate-600">{sup.phone_number_sale}</td>
                  <td className="px-6 py-3 text-slate-600">{sup.contact_line_sale}</td>
                  <td className="px-6 py-3 text-slate-600">{sup.email_sale}</td>
                  <td className="px-6 py-3 text-slate-600">{sup.bank_account_number}</td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-3 text-slate-400">
                      <button
                        onClick={() => openEditSupplier(sup)}
                        className="hover:text-slate-700 transition-colors"
                      >
                        <SquarePen className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteSupplier(sup.id)}
                        className="hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4">
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 text-sm font-semibold text-[#B70011] hover:text-[#9e0010] cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          เพิ่มบริษัทสั่งซื้อ
        </button>
      </div>

      {/* Modals */}
      <AddSupplierModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={loadData}
      />

      <EditSupplierModal
        isOpen={editOpen}
        onClose={() => {
          setEditOpen(false);
          setSelectedSupplier(null);
        }}
        supplier={selectedSupplier}
        onSuccess={loadData}
      />
    </>
  );
}
