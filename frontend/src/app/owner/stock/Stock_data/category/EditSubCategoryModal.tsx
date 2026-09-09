import React, { useState, useEffect } from "react";
import { Save, Trash2, Plus } from "lucide-react";
import Input from "../../../../../components/elements/input";
import Select from "../../../../../components/elements/select";
import Modal from "../../../../../components/elements/modal";
import Button from "../../../../../components/elements/button";
import { useToast } from "../../../../../components/elements/toast";
import { useAlertDialog } from "../../../../../components/elements/alert_dialog";
import { stockDataService } from "../../../../../service/http/wms/stock_data_service";
import type { Category, SubCategory, SubSubCategory } from "../../../../../interface/wms/stock_data";

interface EditSubCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: Category[];
  subCategory: SubCategory | null;
}

export default function EditSubCategoryModal({
  isOpen,
  onClose,
  onSuccess,
  categories,
  subCategory
}: EditSubCategoryModalProps) {
  const { toast } = useToast();
  const { confirmDialog } = useAlertDialog();
  const [form, setForm] = useState({
    sub_category_name: "",
    sub_category_short_name: "",
    description: "",
    category_id: 0,
  });

  // Sub-sub-categories state
  const [subSubCategories, setSubSubCategories] = useState<SubSubCategory[]>([]);
  const [editedSubSubs, setEditedSubSubs] = useState<Record<number, { sub_sub_category_name: string; sub_sub_category_short_name: string; description: string }>>({});
  const [newSubSub, setNewSubSub] = useState({ sub_sub_category_name: "", sub_sub_category_short_name: "", description: "" });
  const [showAddSubSub, setShowAddSubSub] = useState(false);

  useEffect(() => {
    if (subCategory) {
      setForm({
        sub_category_name: subCategory.sub_category_name || "",
        sub_category_short_name: subCategory.sub_category_short_name || "",
        description: subCategory.description || "",
        category_id: subCategory.category_id || 0,
      });
      loadSubSubCategories(subCategory.id);
    }
  }, [subCategory]);

  const loadSubSubCategories = async (subCatId: number) => {
    try {
      const all = await stockDataService.getSubSubCategories();
      const filtered = all.filter((ss) => ss.sub_category_id === subCatId);
      setSubSubCategories(filtered);
      // Init edited state
      const editMap: Record<number, { sub_sub_category_name: string; sub_sub_category_short_name: string; description: string }> = {};
      filtered.forEach((ss) => {
        editMap[ss.id] = {
          sub_sub_category_name: ss.sub_sub_category_name,
          sub_sub_category_short_name: ss.sub_sub_category_short_name || "",
          description: ss.description || "",
        };
      });
      setEditedSubSubs(editMap);
      setShowAddSubSub(false);
      setNewSubSub({ sub_sub_category_name: "", sub_sub_category_short_name: "", description: "" });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSubSub = async (id: number, name: string) => {
    const confirmed = await confirmDialog(
      `ต้องการลบประเภทย่อยย่อย "${name}" ใช่หรือไม่?`,
      { title: "ลบประเภทย่อยย่อย", confirmText: "ลบ", variant: "danger", icon: Trash2 }
    );
    if (!confirmed) return;
    try {
      await stockDataService.deleteSubSubCategory(id);
      toast({ variant: "success", message: "ลบประเภทย่อยย่อยสำเร็จ" });
      if (subCategory) loadSubSubCategories(subCategory.id);
    } catch (err) {
      toast({ variant: "error", message: "ไม่สามารถลบประเภทย่อยย่อยได้" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subCategory) return;
    const confirmed = await confirmDialog(
      `ยืนยันบันทึกการแก้ไขประเภทย่อย "${form.sub_category_name}" หรือไม่?`,
      { title: "ยืนยันการแก้ไขประเภทย่อย", confirmText: "บันทึกการแก้ไข", variant: "info", icon: Save }
    );
    if (!confirmed) return;

    try {
      // Update sub_category
      await stockDataService.updateSubCategory(subCategory.id, form);

      // Update existing sub_sub_categories
      for (const ss of subSubCategories) {
        const edited = editedSubSubs[ss.id];
        if (
          edited &&
          (edited.sub_sub_category_name !== ss.sub_sub_category_name ||
            edited.sub_sub_category_short_name !== (ss.sub_sub_category_short_name || "") ||
            edited.description !== (ss.description || ""))
        ) {
          await stockDataService.updateSubSubCategory(ss.id, edited);
        }
      }

      // Create new sub_sub_category if filled
      if (newSubSub.sub_sub_category_name.trim()) {
        await stockDataService.createSubSubCategory({
          sub_sub_category_name: newSubSub.sub_sub_category_name,
          sub_sub_category_short_name: newSubSub.sub_sub_category_short_name,
          description: newSubSub.description,
          sub_category_id: subCategory.id,
        });
      }

      toast({ variant: "success", message: "แก้ไขประเภทย่อยสินค้าสำเร็จ" });
      onSuccess();
      onClose();
    } catch (err) {
      toast({ variant: "error", message: "ไม่สามารถแก้ไขข้อมูลประเภทย่อยสินค้าได้" });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="แก้ไขประเภทย่อยของสินค้า">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="เลือกประเภทหลัก"
          required
          options={categories.map((c) => ({ label: c.category_name, value: String(c.id) }))}
          value={String(form.category_id)}
          onChange={(e) => setForm({ ...form, category_id: Number(e.target.value) })}
        />
        <Input
          label="ชื่อประเภทย่อย"
          required
          value={form.sub_category_name}
          onChange={(e) => setForm({ ...form, sub_category_name: e.target.value })}
          placeholder="เช่น ดรัมเบรก, ดิสก์เบรก..."
        />
        <Input
          label="ชื่อย่อประเภทย่อย"
          value={form.sub_category_short_name}
          onChange={(e) => setForm({ ...form, sub_category_short_name: e.target.value })}
          placeholder="เช่น ดบ, ดส..."
        />
        <Input
          label="รายละเอียดเพิ่มเติม"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="รายละเอียดประเภทย่อย..."
        />

        {/* Sub-sub-categories section */}
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            ประเภทย่อยย่อย
          </h4>

          {subSubCategories.length === 0 && !showAddSubSub && (
            <p className="text-xs text-slate-400 italic">ยังไม่มีประเภทย่อยย่อย</p>
          )}

          {/* Existing sub-sub-categories list */}
          {subSubCategories.map((ss) => (
            <div key={ss.id} className="flex items-center gap-2 bg-slate-50 rounded-md p-2.5 border border-slate-100">
              <div className="flex-1 space-y-2">
                <Input
                  label="ชื่อประเภทย่อยย่อย"
                  value={editedSubSubs[ss.id]?.sub_sub_category_name || ""}
                  onChange={(e) =>
                    setEditedSubSubs((prev) => ({
                      ...prev,
                      [ss.id]: { ...prev[ss.id], sub_sub_category_name: e.target.value },
                    }))
                  }
                  placeholder="ชื่อ..."
                />
                <Input
                  label="ชื่อย่อ"
                  value={editedSubSubs[ss.id]?.sub_sub_category_short_name || ""}
                  onChange={(e) =>
                    setEditedSubSubs((prev) => ({
                      ...prev,
                      [ss.id]: { ...prev[ss.id], sub_sub_category_short_name: e.target.value },
                    }))
                  }
                  placeholder="ชื่อย่อ..."
                />
              </div>
              <button
                type="button"
                onClick={() => handleDeleteSubSub(ss.id, ss.sub_sub_category_name)}
                className="text-slate-400 hover:text-red-600 transition-colors p-1 self-start mt-5"
                title="ลบประเภทย่อยย่อย"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          {/* Add new sub-sub-category inline */}
          {showAddSubSub ? (
            <div className="bg-slate-50 rounded-md p-2.5 border border-dashed border-slate-200 space-y-2">
              <Input
                label="ชื่อประเภทย่อยย่อยใหม่"
                value={newSubSub.sub_sub_category_name}
                onChange={(e) => setNewSubSub({ ...newSubSub, sub_sub_category_name: e.target.value })}
                placeholder="เช่น ตาข่าย, ก้านที่..."
              />
              <Input
                label="ชื่อย่อ"
                value={newSubSub.sub_sub_category_short_name}
                onChange={(e) => setNewSubSub({ ...newSubSub, sub_sub_category_short_name: e.target.value })}
                placeholder="เช่น ตข...."
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddSubSub(true)}
              className="flex items-center gap-1 text-xs font-semibold text-[#B70011] hover:text-[#9e0010] cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              เพิ่มประเภทย่อยย่อยใหม่
            </button>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="tertiary" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button type="submit" variant="primary">
            บันทึกข้อมูล
          </Button>
        </div>
      </form>
    </Modal>
  );
}
