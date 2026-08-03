import { useState, useMemo } from "react";
import { Plus, Trash2, SquarePen } from "lucide-react";
import { useToast } from "../../../../../components/elements/toast";

import { stockDataService } from "../../../../../service/http/wms/stock_data_service";
import type { Grade } from "../../../../../interface/wms/stock_data";

// Extracted Modals
import AddGradeModal from "./AddGradeModal";
import EditGradeModal from "./EditGradeModal";

interface GradeTabProps {
  search: string;
  grades: Grade[];
  loadData: () => void;
}

export default function GradeTab({ search, grades, loadData }: GradeTabProps) {
  const { toast } = useToast();

  // Modals visibility state
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);

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

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="bg-[#F2ECE9] border-b border-slate-200">
              <th className="px-6 py-3.5 font-semibold text-slate-700">เกรดสินค้า</th>
              <th className="px-6 py-3.5 font-semibold text-slate-700 text-right w-1/6">จัดการ</th>
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
              filteredGrades.map((grade) => (
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

      <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4">
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 text-sm font-semibold text-[#B70011] hover:text-[#9e0010] cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          เพิ่มเกรดสินค้า
        </button>
      </div>

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
