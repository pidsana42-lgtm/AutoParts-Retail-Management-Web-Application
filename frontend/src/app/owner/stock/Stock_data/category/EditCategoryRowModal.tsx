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
  const [subCategoryShortName, setSubCategoryShortName] = useState("");
  const [subSubCategoryName, setSubSubCategoryName] = useState("");
  const [subSubCategoryShortName, setSubSubCategoryShortName] = useState("");

  const [selectedCategoryId, setSelectedCategoryId] = useState<number>(0);
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<number>(0);

  useEffect(() => {
    if (isOpen && category) {
      setCategoryName(category.category_name);
      setShortName(category.category_short_name || "");
      setSelectedCategoryId(category.id);

      setSubCategoryName(subCategory?.sub_category_name || "");
      setSubCategoryShortName(subCategory?.sub_category_short_name || "");
      setSelectedSubCategoryId(subCategory?.id || 0);

      setSubSubCategoryName(subSubCategory?.sub_sub_category_name || "");
      setSubSubCategoryShortName(subSubCategory?.sub_sub_category_short_name || "");
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
    // ชื่อประเภทหลักแก้ไขได้เสมอไม่ว่าจะเปิดแก้ไขจากแถวระดับไหน จึงต้องกรอกเสมอ — ส่วนชื่อย่อไม่บังคับ
    // เว้นว่างได้ (เหมือนชื่อย่อของประเภทย่อย/ย่อยย่อย) เพราะข้อมูลเดิมหลายรายการยังไม่มีชื่อย่อตั้งไว้
    if (!categoryName.trim()) {
      toast({ variant: "error", message: "กรุณากรอกชื่อประเภทหลัก" });
      return;
    }
    if (
      subCategory &&
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

      // 1. Update Category — แก้ไขชื่อ/ชื่อย่อของประเภทหลักได้เสมอ ไม่ว่าจะเปิดแก้ไขจากแถวระดับไหนก็ตาม
      // (เดิมทำได้แค่ตอนไม่มี subCategory/subSubCategory ทำให้ประเภทหลักที่มีประเภทย่อยแล้วแก้ไม่ได้อีกเลย)
      if (categoryName.trim() !== category.category_name || shortName.trim() !== (category.category_short_name || "")) {
        await stockDataService.updateCategory(category.id, {
          category_name: categoryName.trim(),
          category_short_name: shortName.trim()
        });
        isUpdated = true;
      }

      let currentSubCategoryId = subCategory?.id;

      // 2. Update or Create Sub Category
      if (subCategory) {
        if (
          subCategoryName.trim() !== subCategory.sub_category_name ||
          selectedCategoryId !== subCategory.category_id ||
          subCategoryShortName.trim() !== (subCategory.sub_category_short_name || "")
        ) {
          await stockDataService.updateSubCategory(subCategory.id, {
            sub_category_name: subCategoryName.trim(),
            category_id: selectedCategoryId,
            sub_category_short_name: subCategoryShortName.trim(),
          });
          isUpdated = true;
          currentSubCategoryId = subCategory.id;
        }
      } else if (!subCategory && subCategoryName.trim()) {
        await stockDataService.createSubCategory({
          sub_category_name: subCategoryName.trim(),
          category_id: category.id,
          description: "",
          sub_category_short_name: subCategoryShortName.trim()
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
        if (
          subSubCategoryName.trim() !== subSubCategory.sub_sub_category_name ||
          selectedSubCategoryId !== subSubCategory.sub_category_id ||
          subSubCategoryShortName.trim() !== (subSubCategory.sub_sub_category_short_name || "")
        ) {
          if (selectedSubCategoryId) {
            await stockDataService.updateSubSubCategory(subSubCategory.id, {
              sub_sub_category_name: subSubCategoryName.trim(),
              sub_category_id: selectedSubCategoryId,
              sub_sub_category_short_name: subSubCategoryShortName.trim(),
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
          sub_sub_category_short_name: subSubCategoryShortName.trim()
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
        
        {/* ชื่อ/ชื่อย่อของประเภทหลักแก้ไขได้เสมอ ไม่ว่าจะเปิดแก้ไขจากแถวระดับไหนก็ตาม (เดิมสลับไปโชว์แค่ตัวเลือก
            "ย้าย" แทนตอนมี subCategory ทำให้ประเภทหลักที่มีประเภทย่อยแล้ว — ซึ่งเป็นเกือบทุกกรณีจริง — ไม่มีทาง
            แก้ชื่อ/ชื่อย่อของตัวเองได้อีกเลยผ่านตารางนี้) */}
        <div className="space-y-4 pb-2 border-b border-slate-100">
          <Input
            label="ชื่อประเภทหลัก"
            required
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
          />
          <Input
            label="ชื่อย่อประเภทหลัก"
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
          />
          {subCategory && (
            <Select
              label="ย้ายประเภทย่อยนี้ไปประเภทหลักอื่น"
              required
              options={categories.map((c) => ({ label: c.category_name, value: String(c.id) }))}
              value={String(selectedCategoryId)}
              onChange={(e) => setSelectedCategoryId(Number(e.target.value))}
            />
          )}
        </div>

        <div className="space-y-4 py-2 border-b border-slate-100">
          <Input
            label={subCategory ? "ชื่อประเภทย่อย" : "เพิ่มประเภทย่อยใหม่ (เว้นว่างได้ถ้าไม่ต้องการ)"}
            value={subCategoryName}
            onChange={(e) => setSubCategoryName(e.target.value)}
          />
          <Input
            label="ชื่อย่อประเภทย่อย"
            value={subCategoryShortName}
            onChange={(e) => setSubCategoryShortName(e.target.value)}
            placeholder="เช่น ดบ, ดส..."
            disabled={!subCategory && !subCategoryName.trim()}
          />
          {subSubCategory && (
            <Select
              label="ย้ายประเภทย่อยย่อยนี้ไปประเภทย่อยอื่น"
              required
              options={availableSubCategories.map((s) => ({ label: s.sub_category_name, value: String(s.id) }))}
              value={String(selectedSubCategoryId)}
              onChange={(e) => setSelectedSubCategoryId(Number(e.target.value))}
              disabled={availableSubCategories.length === 0}
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
          <Input
            label="ชื่อย่อประเภทย่อยย่อย"
            value={subSubCategoryShortName}
            onChange={(e) => setSubSubCategoryShortName(e.target.value)}
            placeholder="เช่น ตข., กท...."
            disabled={!subCategory && !subCategoryName.trim() && !subSubCategoryName.trim()}
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
