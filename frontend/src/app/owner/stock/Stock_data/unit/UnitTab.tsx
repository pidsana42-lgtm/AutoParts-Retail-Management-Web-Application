import { useState, useMemo, useEffect } from "react";
import { Trash2, SquarePen } from "lucide-react";
import { useToast } from "../../../../../components/elements/toast";

import { stockDataService } from "../../../../../service/http/wms/stock_data_service";
import type { Unit } from "../../../../../interface/wms/stock_data";

// Extracted Modals
import AddUnitModal from "./AddUnitModal";
import EditUnitModal from "./EditUnitModal";
import TablePagination from "../components/TablePagination";

interface UnitTabProps {
  search: string;
  units: Unit[];
  loadData: () => void;
  addSignal?: number;
}

export default function UnitTab({ search, units, loadData, addSignal }: UnitTabProps) {
  const { toast } = useToast();

  // Modals visibility state
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);

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

  const handleDeleteUnit = async (id: number) => {
    if (!confirm("คุณแน่ใจว่าต้องการลบหน่วยสินค้านี้?")) return;
    try {
      await stockDataService.deleteUnit(id);
      toast({ variant: "success", message: "ลบหน่วยสินค้าสำเร็จ" });
      loadData();
    } catch (err) {
      toast({ variant: "error", message: "เกิดข้อผิดพลาดในการลบหน่วยสินค้า" });
    }
  };

  const openEditUnit = (unit: Unit) => {
    setSelectedUnit(unit);
    setEditOpen(true);
  };

  const filteredUnits = useMemo(() => {
    return units.filter((unit) =>
      !search || unit.unit_name.toLowerCase().includes(search.toLowerCase())
    );
  }, [units, search]);

  const paginatedUnits = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredUnits.slice(start, start + itemsPerPage);
  }, [filteredUnits, currentPage, itemsPerPage]);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="bg-[#f6f3f2] border-b border-slate-200">
              <th className="px-6 py-3.5 font-semibold text-[#797878]">หน่วยสินค้า</th>
              <th className="px-6 py-3.5 font-semibold text-[#797878] text-right w-1/6">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUnits.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-6 py-10 text-center text-slate-400">
                  ไม่พบข้อมูลหน่วยสินค้า
                </td>
              </tr>
            ) : (
              paginatedUnits.map((unit) => (
                <tr key={unit.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-3.5 text-slate-800 font-medium">{unit.unit_name}</td>
                  <td className="px-6 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-3 text-slate-400">
                      <button
                        onClick={() => openEditUnit(unit)}
                        className="hover:text-slate-700 transition-colors"
                      >
                        <SquarePen className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUnit(unit.id)}
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
        totalItems={filteredUnits.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={(n) => {
          setItemsPerPage(n);
          setCurrentPage(1);
        }}
        itemLabel="หน่วยสินค้า"
      />

      {/* Modals */}
      <AddUnitModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={loadData}
      />

      <EditUnitModal
        isOpen={editOpen}
        onClose={() => {
          setEditOpen(false);
          setSelectedUnit(null);
        }}
        unit={selectedUnit}
        onSuccess={loadData}
      />
    </>
  );
}
