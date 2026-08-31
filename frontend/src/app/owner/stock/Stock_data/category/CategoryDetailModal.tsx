import { Folder, FolderTree } from "lucide-react";
import Modal from "../../../../../components/elements/modal";
import Badge from "../../../../../components/elements/badge";
import type { Category, SubCategory, SubSubCategory } from "../../../../../interface/wms/stock_data";

interface CategoryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: Category | null;
  subCategories: SubCategory[];
  subSubCategories: SubSubCategory[];
}

const formatDateTime = (iso?: string) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("th-TH", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

// แสดงโครงสร้างทั้งหมดของประเภทสินค้าหนึ่งตัวในทีเดียว (ประเภทย่อยทุกตัว + ประเภทย่อยย่อยทุกตัวที่อยู่ข้างใต้)
// ต่างจากตารางหลักที่แยกแสดงทีละแถวตามคู่ ประเภทย่อย/ประเภทย่อยย่อย ทำให้เห็นภาพรวมไม่ครบในคราวเดียว
export default function CategoryDetailModal({
  isOpen,
  onClose,
  category,
  subCategories,
  subSubCategories,
}: CategoryDetailModalProps) {
  if (!category) return null;

  const relatedSubs = subCategories.filter((sub) => sub.category_id === category.id);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={category.category_name}
      description="รายละเอียดประเภทสินค้า และโครงสร้างประเภทย่อยทั้งหมด"
      size="lg"
    >
      <div className="space-y-5">
        {/* ข้อมูลประเภทหลัก */}
        <div className="grid grid-cols-2 gap-4 rounded-sm border border-slate-100 bg-slate-50/60 p-4 text-sm">
          <div>
            <p className="text-xs text-slate-400">ชื่อประเภทสินค้า</p>
            <p className="font-semibold text-slate-800">{category.category_name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">ชื่อย่อ</p>
            <p className="font-semibold text-slate-800">{category.category_short_name || "-"}</p>
          </div>
          {category.description && (
            <div className="col-span-2">
              <p className="text-xs text-slate-400">รายละเอียด</p>
              <p className="text-slate-700">{category.description}</p>
            </div>
          )}
          <div className="col-span-2">
            <p className="text-xs text-slate-400">สร้างเมื่อ</p>
            <p className="text-slate-700">{formatDateTime(category.created_at)}</p>
          </div>
        </div>

        {/* โครงสร้างประเภทย่อย > ประเภทย่อยย่อย ทั้งหมด */}
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <FolderTree className="h-3.5 w-3.5" />
            โครงสร้างทั้งหมด ({relatedSubs.length} ประเภทย่อย)
          </div>

          {relatedSubs.length === 0 ? (
            <div className="rounded-sm border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
              ยังไม่มีประเภทย่อยภายใต้ประเภทนี้
            </div>
          ) : (
            <div className="space-y-3">
              {relatedSubs.map((sub) => {
                const relatedSubSubs = subSubCategories.filter((ss) => ss.sub_category_id === sub.id);
                return (
                  <div key={sub.id} className="rounded-sm border border-slate-200">
                    <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Folder className="h-4 w-4 text-slate-400" />
                        <span className="font-medium text-slate-800">{sub.sub_category_name}</span>
                        {sub.sub_category_short_name && (
                          <Badge variant="neutral" className="w-auto bg-slate-100 px-2 text-slate-500">
                            {sub.sub_category_short_name}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">สร้างเมื่อ {formatDateTime(sub.created_at)}</span>
                    </div>

                    {relatedSubSubs.length > 0 && (
                      <div className="divide-y divide-slate-50 px-4">
                        {relatedSubSubs.map((ss) => (
                          <div key={ss.id} className="flex items-center justify-between gap-3 py-2 pl-6 text-sm">
                            <span className="text-slate-700">
                              {ss.sub_sub_category_name}
                              {ss.sub_sub_category_short_name && (
                                <span className="ml-1.5 text-xs text-slate-400">({ss.sub_sub_category_short_name})</span>
                              )}
                            </span>
                            <span className="text-xs text-slate-400">สร้างเมื่อ {formatDateTime(ss.created_at)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
