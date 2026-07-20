import React, { useState, useEffect } from "react";
import Input from "../../../../../components/elements/input";
import Select from "../../../../../components/elements/select";
import Modal from "../../../../../components/elements/modal";
import Button from "../../../../../components/elements/button";
import { useToast } from "../../../../../components/elements/toast";
import { stockDataService } from "../../../../../service/http/wms/stock_data_service";
import type { Category, SubCategory } from "../../../../../interface/wms/stock_data";

interface AddCategorySubCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: Category[];
  defaultMode?: "new_category" | "existing_category";
  initialCategoryId?: number;
}

export default function AddCategorySubCategoryModal({
  isOpen,
  onClose,
  onSuccess,
  categories,
  defaultMode = "new_category",
  initialCategoryId
}: AddCategorySubCategoryModalProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"new_category" | "existing_category">(defaultMode);
  const [subCategoriesList, setSubCategoriesList] = useState<SubCategory[]>([]);
  
  // Category inputs
  const [catForm, setCatForm] = useState({
    category_name: "",
    category_short_name: "",
    description: "",
  });

  // SubCategory inputs
  const [subForm, setSubForm] = useState({
    sub_category_name: "",
    sub_category_short_name: "",
    description: "",
    category_id: 0,
  });

  // SubSubCategory inputs
  const [subSubForm, setSubSubForm] = useState({
    sub_sub_category_name: "",
    sub_sub_category_short_name: "",
    description: "",
    sub_category_id: 0,
  });

  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode, isOpen]);

  useEffect(() => {
    setSubForm((prev) => ({
      ...prev,
      category_id: initialCategoryId || (categories[0]?.id || 0),
    }));
  }, [initialCategoryId, categories, isOpen]);

  // Load subcategories for the "existing_category" mode to populate sub_sub_category dropdown
  useEffect(() => {
    const loadSubs = async () => {
      try {
        const subs = await stockDataService.getSubCategories();
        setSubCategoriesList(subs);
      } catch (err) {
        console.error(err);
      }
    };
    if (isOpen) loadSubs();
  }, [isOpen]);

  // When category_id changes in existing_category mode, reset sub_category_id for sub_sub
  useEffect(() => {
    if (mode === "existing_category") {
      const availableSubs = subCategoriesList.filter(s => s.category_id === subForm.category_id);
      setSubSubForm(prev => ({
        ...prev,
        sub_category_id: availableSubs[0]?.id || 0,
      }));
    }
  }, [subForm.category_id, subCategoriesList, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === "new_category") {
        if (!catForm.category_name.trim()) {
          toast({ variant: "error", message: "กรุณากรอกชื่อประเภทสินค้าหลัก" });
          return;
        }

        // Create new category
        await stockDataService.createCategory(catForm);

        // If subcategory is also filled, create it
        if (subForm.sub_category_name.trim()) {
          // Fetch updated categories list to find the ID of the new category
          const updatedCats = await stockDataService.getCategories();
          const newCat = updatedCats.find(
            (c) => c.category_name.trim().toLowerCase() === catForm.category_name.trim().toLowerCase()
          );

          if (newCat) {
            await stockDataService.createSubCategory({
              sub_category_name: subForm.sub_category_name,
              sub_category_short_name: subForm.sub_category_short_name,
              description: subForm.description,
              category_id: newCat.id,
            });

            // If sub_sub_category is also filled, create it
            if (subSubForm.sub_sub_category_name.trim()) {
              const updatedSubs = await stockDataService.getSubCategories();
              const newSub = updatedSubs.find(
                (s) => s.sub_category_name.trim().toLowerCase() === subForm.sub_category_name.trim().toLowerCase()
                  && s.category_id === newCat.id
              );
              if (newSub) {
                await stockDataService.createSubSubCategory({
                  sub_sub_category_name: subSubForm.sub_sub_category_name,
                  sub_sub_category_short_name: subSubForm.sub_sub_category_short_name,
                  description: subSubForm.description,
                  sub_category_id: newSub.id,
                });
              }
            }
          }
        }
        
        toast({ variant: "success", message: "บันทึกข้อมูลประเภทสินค้าสำเร็จ" });
      } else {
        // Adding subcategory to existing category
        if (!subForm.category_id) {
          toast({ variant: "error", message: "กรุณาเลือกประเภทสินค้าหลัก" });
          return;
        }

        // If subcategory name is filled, create subcategory
        if (subForm.sub_category_name.trim()) {
          await stockDataService.createSubCategory(subForm);

          // If sub_sub_category is also filled, create it under the new subcategory
          if (subSubForm.sub_sub_category_name.trim()) {
            const updatedSubs = await stockDataService.getSubCategories();
            const newSub = updatedSubs.find(
              (s) => s.sub_category_name.trim().toLowerCase() === subForm.sub_category_name.trim().toLowerCase()
                && s.category_id === subForm.category_id
            );
            if (newSub) {
              await stockDataService.createSubSubCategory({
                sub_sub_category_name: subSubForm.sub_sub_category_name,
                sub_sub_category_short_name: subSubForm.sub_sub_category_short_name,
                description: subSubForm.description,
                sub_category_id: newSub.id,
              });
            }
          }
          toast({ variant: "success", message: "เพิ่มประเภทย่อยสินค้าสำเร็จ" });
        } else if (subSubForm.sub_sub_category_name.trim() && subSubForm.sub_category_id) {
          // Only adding sub_sub_category to existing subcategory
          await stockDataService.createSubSubCategory({
            sub_sub_category_name: subSubForm.sub_sub_category_name,
            sub_sub_category_short_name: subSubForm.sub_sub_category_short_name,
            description: subSubForm.description,
            sub_category_id: subSubForm.sub_category_id,
          });
          toast({ variant: "success", message: "เพิ่มประเภทย่อยย่อยสำเร็จ" });
        } else {
          toast({ variant: "error", message: "กรุณากรอกข้อมูลอย่างน้อย 1 รายการ" });
          return;
        }
      }

      // Reset forms
      setCatForm({ category_name: "", category_short_name: "", description: "" });
      setSubForm({ sub_category_name: "", sub_category_short_name: "", description: "", category_id: categories[0]?.id || 0 });
      setSubSubForm({ sub_sub_category_name: "", sub_sub_category_short_name: "", description: "", sub_category_id: 0 });
      onSuccess();
      onClose();
    } catch (err) {
      toast({ variant: "error", message: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" });
    }
  };

  // Available subcategories for the selected category (for sub_sub_category dropdown)
  const availableSubCategories = subCategoriesList.filter(
    (s) => s.category_id === subForm.category_id
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="จัดการประเภท & ประเภทย่อยสินค้า">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Toggle Mode */}
        <div className="flex bg-slate-100 p-1 rounded-sm border border-slate-200">
          <button
            type="button"
            onClick={() => setMode("new_category")}
            className={[
              "flex-1 text-center py-1.5 text-xs font-semibold rounded-sm transition-all duration-150 cursor-pointer",
              mode === "new_category" ? "bg-white text-[#B70011] shadow-sm" : "text-slate-600"
            ].join(" ")}
          >
            สร้างประเภทสินค้าหลักใหม่
          </button>
          <button
            type="button"
            onClick={() => setMode("existing_category")}
            className={[
              "flex-1 text-center py-1.5 text-xs font-semibold rounded-sm transition-all duration-150 cursor-pointer",
              mode === "existing_category" ? "bg-white text-[#B70011] shadow-sm" : "text-slate-600"
            ].join(" ")}
          >
            เลือกประเภทหลักที่มีอยู่แล้ว
          </button>
        </div>

        {mode === "new_category" ? (
          <div className="space-y-4 border-b border-slate-100 pb-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">ข้อมูลประเภทสินค้าหลัก</h4>
            <Input
              label="ชื่อประเภทสินค้าหลัก"
              required
              value={catForm.category_name}
              onChange={(e) => setCatForm({ ...catForm, category_name: e.target.value })}
              placeholder="เช่น เบรก, ล้อแม็ก..."
            />
            <Input
              label="ชื่อย่อประเภทหลัก"
              value={catForm.category_short_name}
              onChange={(e) => setCatForm({ ...catForm, category_short_name: e.target.value })}
              placeholder="เช่น บ., ลม..."
            />
            <Input
              label="รายละเอียดประเภทหลัก"
              value={catForm.description}
              onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
              placeholder="รายละเอียด..."
            />
          </div>
        ) : (
          <div className="space-y-4">
            <Select
              label="เลือกประเภทหลัก"
              required
              options={categories.map((c) => ({ label: c.category_name, value: String(c.id) }))}
              value={String(subForm.category_id)}
              onChange={(e) => setSubForm({ ...subForm, category_id: Number(e.target.value) })}
            />
          </div>
        )}

        {/* Subcategory Fields (Optional for new category, Required for existing category) */}
        <div className="space-y-4 pt-2 border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              ข้อมูลประเภทย่อยสินค้า {mode === "new_category" && "(ไม่บังคับใส่)"}
            </h4>
          </div>
          <Input
            label="ชื่อประเภทย่อย"
            required={mode === "existing_category" && !subSubForm.sub_sub_category_name.trim()}
            value={subForm.sub_category_name}
            onChange={(e) => setSubForm({ ...subForm, sub_category_name: e.target.value })}
            placeholder="เช่น ดรัมเบรก, ดิสก์เบรก..."
          />
          <Input
            label="ชื่อย่อประเภทย่อย"
            value={subForm.sub_category_short_name}
            onChange={(e) => setSubForm({ ...subForm, sub_category_short_name: e.target.value })}
            placeholder="เช่น ดบ, ดส..."
          />
          <Input
            label="รายละเอียดประเภทย่อย"
            value={subForm.description}
            onChange={(e) => setSubForm({ ...subForm, description: e.target.value })}
            placeholder="รายละเอียดประเภทย่อย..."
          />
        </div>

        {/* SubSubCategory Fields */}
        <div className="space-y-4 pt-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            ข้อมูลประเภทย่อยย่อย (ไม่บังคับใส่)
          </h4>

          {/* Show existing subcategory dropdown when in existing_category mode and no new subcategory name */}
          {mode === "existing_category" && !subForm.sub_category_name.trim() && availableSubCategories.length > 0 && (
            <Select
              label="เลือกประเภทย่อยที่มีอยู่"
              options={availableSubCategories.map((s) => ({
                label: s.sub_category_name,
                value: String(s.id),
              }))}
              value={String(subSubForm.sub_category_id)}
              onChange={(e) => setSubSubForm({ ...subSubForm, sub_category_id: Number(e.target.value) })}
            />
          )}

          <Input
            label="ชื่อประเภทย่อยย่อย"
            value={subSubForm.sub_sub_category_name}
            onChange={(e) => setSubSubForm({ ...subSubForm, sub_sub_category_name: e.target.value })}
            placeholder="เช่น ตาข่าย, ก้านที่..."
          />
          <Input
            label="ชื่อย่อ"
            value={subSubForm.sub_sub_category_short_name}
            onChange={(e) => setSubSubForm({ ...subSubForm, sub_sub_category_short_name: e.target.value })}
            placeholder="เช่น ตข., กท...."
          />
          <Input
            label="รายละเอียดเพิ่มเติม"
            value={subSubForm.description}
            onChange={(e) => setSubSubForm({ ...subSubForm, description: e.target.value })}
            placeholder="รายละเอียด..."
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
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
