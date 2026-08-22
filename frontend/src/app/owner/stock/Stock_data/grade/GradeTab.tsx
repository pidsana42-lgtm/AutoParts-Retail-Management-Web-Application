import { useState, useMemo, useEffect } from "react";
import { Trash2, SquarePen } from "lucide-react";
import { useToast } from "../../../../../components/elements/toast";

import { stockDataService } from "../../../../../service/http/wms/stock_data_service";
import type { Grade } from "../../../../../interface/wms/stock_data";

// Extracted Modals
import AddGradeModal from "./AddGradeModal";
import EditGradeModal from "./EditGradeModal";
import TablePagination from "../components/TablePagination";

interface GradeTabProps {
  search: string;
  grades: Grade[];
  loadData: () => void;
  addSignal?: number;
}

export default function GradeTab({ search, grades, loadData, addSignal }: GradeTabProps) {
  const { toast } = useToast();

  // Modals visibility state
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);

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

  const handleDeleteGrade = async (id: number) => {
    if (!confirm("คุณแน่ใจว่าต้องการลบเกรดสินค้านี้?")) return;
    try {
      await stockDataService.deleteGrade(id);
      toast({ variant: "success", message: "ลบเกรดสินค้าสำเร็จ" });
      loadData();
    } catch (err: any) {
      toast({ variant: "error", message: err.response?.data?.error || "เกิดข้อผิดพลาดในการลบเกรดสินค้า" });
    }
  };

  const openEditGrade = (grade: Grade) => {
    setSelectedGrade(grade);
    setEditOpen(true);
  };

  const filteredGrades = useMemo(() => {
    return grades.filter((grade) =>
      !search || grade.grade_name.toLowerCase().includes(search.toLowerCase())
    );
  }, [grades, search]);

  const paginatedGrades = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredGrades.slice(start, start + itemsPerPage);
  }, [filteredGrades, currentPage, itemsPerPage]);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="bg-[#f6f3f2] border-b border-slate-200">
              <th className="px-6 py-3.5 font-semibold text-[#797878]">เกรดสินค้า</th>
              <th className="px-6 py-3.5 font-semibold text-[#797878] text-right w-1/6">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredGrades.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-6 py-10 text-center text-slate-400">
                  ไม่พบข้อมูลเกรดสินค้า
                </td>
              </tr>
            ) : (
              paginatedGrades.map((grade) => (
                <tr key={grade.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-3.5 text-slate-800 font-medium">{grade.grade_name}</td>
                  <td className="px-6 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-3 text-slate-400">
                      <button
                        onClick={() => openEditGrade(grade)}
                        className="hover:text-slate-700 transition-colors"
                      >
                        <SquarePen className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteGrade(grade.id)}
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
        totalItems={filteredGrades.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={(n) => {
          setItemsPerPage(n);
          setCurrentPage(1);
        }}
        itemLabel="เกรดสินค้า"
      />

      {/* Modals */}
      <AddGradeModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={loadData}
      />

      <EditGradeModal
        isOpen={editOpen}
        onClose={() => {
          setEditOpen(false);
          setSelectedGrade(null);
        }}
        grade={selectedGrade}
        onSuccess={loadData}
      />
    </>
  );
}
