import { useState, useMemo, useEffect } from "react";
import { Trash2, SquarePen, Eye } from "lucide-react";
import { useToast } from "../../../../../components/elements/toast";

import { stockDataService } from "../../../../../service/http/wms/stock_data_service";
import type { Supplier } from "../../../../../interface/wms/stock_data";
import { buildFuzzyIndex, fuzzyMatchIds } from "../../../../../utils/fuzzySearch";

// Extracted Modals
import AddSupplierModal from "./AddSupplierModal";
import EditSupplierModal from "./EditSupplierModal";
import SupplierDetailModal from "./SupplierDetailModal";
import TablePagination from "../components/TablePagination";

interface SupplierTabProps {
  search: string;
  suppliers: Supplier[];
  loadData: () => void;
  addSignal?: number;
}

export default function SupplierTab({ search, suppliers, loadData, addSignal }: SupplierTabProps) {
  const { toast } = useToast();

  // Modals visibility state
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    if (addSignal && addSignal > 0) {
      setAddOpen(true);
    }
  }, [addSignal]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

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

  const openDetail = (sup: Supplier) => {
    setDetailSupplier(sup);
    setDetailOpen(true);
  };

  // สร้าง index ไว้แค่ตอน suppliers เปลี่ยน แล้วค่อยค้นหาแบบ fuzzy ทุกครั้งที่ search เปลี่ยน
  const searchIndex = useMemo(
    () => buildFuzzyIndex(suppliers, ["supplier_name", "short_supplier_name", "phone_number_sale"]),
    [suppliers]
  );
  const matchedIds = useMemo(() => fuzzyMatchIds(searchIndex, search), [searchIndex, search]);

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((sup) => !matchedIds || matchedIds.has(sup.id));
  }, [suppliers, matchedIds]);

  const paginatedSuppliers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSuppliers.slice(start, start + itemsPerPage);
  }, [filteredSuppliers, currentPage, itemsPerPage]);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="bg-[#f6f3f2] border-b border-slate-200">
              <th className="px-6 py-3.5 font-semibold text-[#797878]">ชื่อบริษัท</th>
              <th className="px-6 py-3.5 font-semibold text-[#797878]">ชื่อย่อ</th>
              <th className="px-6 py-3.5 font-semibold text-[#797878]">เบอร์โทรศัพท์</th>
              <th className="px-6 py-3.5 font-semibold text-[#797878]">Line ID</th>
              <th className="px-6 py-3.5 font-semibold text-[#797878]">อีเมล</th>
              <th className="px-6 py-3.5 font-semibold text-[#797878]">เลขที่บัญชี</th>
              <th className="px-6 py-3.5 font-semibold text-[#797878] text-right w-24">จัดการ</th>
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
              paginatedSuppliers.map((sup) => (
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
                        onClick={() => openDetail(sup)}
                        className="hover:text-slate-700 transition-colors"
                        title="ดูรายละเอียด"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
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

      <TablePagination
        currentPage={currentPage}
        totalItems={filteredSuppliers.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={(n) => {
          setItemsPerPage(n);
          setCurrentPage(1);
        }}
        itemLabel="บริษัท"
      />

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

      <SupplierDetailModal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        supplier={detailSupplier}
      />
    </>
  );
}
