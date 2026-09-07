import React, { useState, useEffect } from "react";
import { Save } from "lucide-react";
import Input from "../../../../../components/elements/input";
import Select from "../../../../../components/elements/select";
import Modal from "../../../../../components/elements/modal";
import Button from "../../../../../components/elements/button";
import { useToast } from "../../../../../components/elements/toast";
import { useAlertDialog } from "../../../../../components/elements/alert_dialog";
import type { Category, SubCategory, SubSubCategory } from "../../../../../interface/wms/stock_data";

import { stockDataService } from "../../../../../service/http/wms/stock_data_service";

interface EditCategoryRowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  category: Category | null;
  subCategory: SubCategory | null;
  subSubCategory: SubSubCategory | null;
  categories: Category[];
  subCategories: SubCategory[];
}

export default function EditCategoryRowModal({
  isOpen,
  onClose,
  onSuccess,
  category,
  subCategory,
  subSubCategory,
  categories,
  subCategories,
}: EditCategoryRowModalProps) {
  const { toast } = useToast();
  const { confirmDialog } = useAlertDialog();

  const [categoryName, setCategoryName] = useState("");
  const [shortName, setShortName] = useState("");
  const [subCategoryName, setSubCategoryName] = useState("");
  const [subSubCategoryName, setSubSubCategoryName] = useState("");
  
  const [selectedCategoryId, setSelectedCategoryId] = useState<number>(0);
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<number>(0);

  useEffect(() => {
    if (isOpen && category) {
      setCategoryName(category.category_name);
      setShortName(category.category_short_name || "");
      setSelectedCategoryId(category.id);
      
      setSubCategoryName(subCategory?.sub_category_name || "");
      setSelectedSubCategoryId(subCategory?.id || 0);
      
      setSubSubCategoryName(subSubCategory?.sub_sub_category_name || "");
    }
  }, [isOpen, category, subCategory, subSubCategory]);

  const availableSubCategories = subCategories.filter(s => s.category_id === selectedCategoryId);

  useEffect(() => {
    if (isOpen && selectedCategoryId) {
      const avail = subCategories.filter(s => s.category_id === selectedCategoryId);
      if (!avail.find(s => s.id === selectedSubCategoryId)) {
        setSelectedSubCategoryId(avail.length > 0 ? avail[0].id : 0);
      }
    }
  }, [selectedCategoryId, subCategories, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) return;

    // ตรวจข้อมูลที่กรอกให้ครบก่อนถามยืนยัน — ไม่ให้ผู้ใช้กดยืนยันแล้วเพิ่งเจอ error
    if (
      !subCategory &&
      !subSubCategory &&
      (categoryName.trim() !== category.category_name || shortName.trim() !== category.category_short_name) &&
      (!categoryName.trim() || !shortName.trim())
    ) {
      toast({ variant: "error", message: "กรุณากรอกชื่อและตัวย่อประเภทหลัก" });
      return;
    }
    if (
      subCategory &&
      !subSubCategory &&
      (subCategoryName.trim() !== subCategory.sub_category_name || selectedCategoryId !== subCategory.category_id) &&
      !subCategoryName.trim()
    ) {
      toast({ variant: "error", message: "กรุณากรอกชื่อประเภทย่อย" });
      return;
    }
    if (
      subSubCategory &&
      (subSubCategoryName.trim() !== subSubCategory.sub_sub_category_name ||
        selectedSubCategoryId !== subSubCategory.sub_category_id) &&
      !subSubCategoryName.trim()
    ) {
      toast({ variant: "error", message: "กรุณากรอกชื่อประเภทย่อยย่อย" });
      return;
    }

    // ยืนยันก่อนบันทึก (เคสนี้ทั้งแก้ไขและเพิ่มใหม่ได้ในครั้งเดียว)
    const confirmed = await confirmDialog(
      "ยืนยันบันทึกข้อมูลนี้หรือไม่?",
      { title: "ยืนยันการบันทึก", confirmText: "บันทึกข้อมูล", variant: "info", icon: Save }
    );
    if (!confirmed) return;

    try {
      let isUpdated = false;

      // 1. Update Category
      if (!subCategory && !subSubCategory) {
        if (categoryName.trim() !== category.category_name || shortName.trim() !== category.category_short_name) {
          await stockDataService.updateCategory(category.id, { 
            category_name: categoryName.trim(),
            category_short_name: shortName.trim()
          });
          isUpdated = true;
        }
      }

      let currentSubCategoryId = subCategory?.id;

      // 2. Update or Create Sub Category
      if (subCategory && !subSubCategory) {
        if (subCategoryName.trim() !== subCategory.sub_category_name || selectedCategoryId !== subCategory.category_id) {
          await stockDataService.updateSubCategory(subCategory.id, { 
            sub_category_name: subCategoryName.trim(), 
            category_id: selectedCategoryId 
          });
          isUpdated = true;
          currentSubCategoryId = subCategory.id;
        }
      } else if (!subCategory && subCategoryName.trim()) {
        await stockDataService.createSubCategory({ 
          sub_category_name: subCategoryName.trim(), 
          category_id: category.id,
          description: "",
          sub_category_short_name: ""
        });
        isUpdated = true;
        const allSubs = await stockDataService.getSubCategories();
        const newSub = allSubs.find(s => s.sub_category_name === subCategoryName.trim() && s.category_id === category.id);
        if (newSub) {
          currentSubCategoryId = newSub.id;
        }
      }

      // 3. Update or Create Sub Sub Category
      if (subSubCategory) {
        if (subSubCategoryName.trim() !== subSubCategory.sub_sub_category_name || selectedSubCategoryId !== subSubCategory.sub_category_id) {
          if (selectedSubCategoryId) {
            await stockDataService.updateSubSubCategory(subSubCategory.id, { 
              sub_sub_category_name: subSubCategoryName.trim(), 
              sub_category_id: selectedSubCategoryId 
            });
            isUpdated = true;
          }
        }
      } else if (subSubCategoryName.trim()) {
        const targetSubId = (subCategory && !subSubCategory) ? subCategory.id : currentSubCategoryId;
        if (!targetSubId) {
          toast({ variant: "error", message: "ไม่สามารถสร้างประเภทย่อยย่อยได้ เนื่องจากไม่มีประเภทย่อย" });
          return;
        }
        await stockDataService.createSubSubCategory({ 
          sub_sub_category_name: subSubCategoryName.trim(), 
          sub_category_id: targetSubId,
          description: "",
          sub_sub_category_short_name: ""
        });
        isUpdated = true;
      }

      if (isUpdated) {
        toast({ variant: "success", message: "บันทึกข้อมูลสำเร็จ" });
        onSuccess();
      }
      onClose();
    } catch (err) {
      toast({ variant: "error", message: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" });
    }
  };

  if (!category) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="แก้ไขข้อมูล ประเภทสินค้า">
      <form onSubmit={handleSubmit} className="space-y-4">
        
        <div className="space-y-4 pb-2 border-b border-slate-100">
          {subCategory ? (
            <Select
              label="เลือกประเภทหลัก (ย้าย)"
              required
              options={categories.map((c) => ({ label: c.category_name, value: String(c.id) }))}
              value={String(selectedCategoryId)}
              onChange={(e) => setSelectedCategoryId(Number(e.target.value))}
            />
          ) : (
            <>
              <Input
                label="ชื่อประเภทหลัก"
                required
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
              />
              <Input
                label="อักษรย่อ"
                required
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
              />
            </>
          )}
        </div>

        <div className="space-y-4 py-2 border-b border-slate-100">
          {subSubCategory ? (
            <Select
              label="เลือกประเภทย่อย (ย้าย)"
              required
              options={availableSubCategories.map((s) => ({ label: s.sub_category_name, value: String(s.id) }))}
              value={String(selectedSubCategoryId)}
              onChange={(e) => setSelectedSubCategoryId(Number(e.target.value))}
              disabled={availableSubCategories.length === 0}
            />
          ) : (
            <Input
              label={subCategory ? "ชื่อประเภทย่อย" : "เพิ่มประเภทย่อยใหม่ (เว้นว่างได้ถ้าไม่ต้องการ)"}
              value={subCategoryName}
              onChange={(e) => setSubCategoryName(e.target.value)}
            />
          )}
        </div>

        <div className="space-y-4 pt-2">
          <Input
            label={subSubCategory ? "ชื่อประเภทย่อยย่อย" : "เพิ่มประเภทย่อยย่อยใหม่ (เว้นว่างได้ถ้าไม่ต้องการ)"}
            value={subSubCategoryName}
            onChange={(e) => setSubSubCategoryName(e.target.value)}
            disabled={!subCategory && !subCategoryName.trim()}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
          <Button type="button" variant="tertiary" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button type="submit" variant="primary">
            บันทึกการแก้ไข
          </Button>
        </div>
      </form>
    </Modal>
  );
}
