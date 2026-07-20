import React, { useState, useEffect } from "react";
import Input from "../../../../../components/elements/input";
import Select from "../../../../../components/elements/select";
import Modal from "../../../../../components/elements/modal";
import Button from "../../../../../components/elements/button";
import { useToast } from "../../../../../components/elements/toast";
import { stockDataService } from "../../../../../service/http/wms/stock_data_service";
import type { Category } from "../../../../../interface/wms/stock_data";

interface AddSubCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: Category[];
  initialCategoryId?: number;
}

export default function AddSubCategoryModal({
  isOpen,
  onClose,
  onSuccess,
  categories,
  initialCategoryId
}: AddSubCategoryModalProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    sub_category_name: "",
    sub_category_short_name: "",
    description: "",
    category_id: 0,
  });

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      category_id: initialCategoryId || (categories[0]?.id || 0),
    }));
  }, [initialCategoryId, categories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.category_id) {
      toast({ variant: "error", message: "กรุณาเลือกประเภทสินค้าหลัก" });
      return;
    }
    try {
      await stockDataService.createSubCategory(form);
      toast({ variant: "success", message: "เพิ่มประเภทย่อยสินค้าสำเร็จ" });
      setForm({
        sub_category_name: "",
        sub_category_short_name: "",
        description: "",
        category_id: initialCategoryId || (categories[0]?.id || 0),
      });
      onSuccess();
      onClose();
    } catch (err) {
      toast({ variant: "error", message: "ไม่สามารถบันทึกข้อมูลประเภทย่อยสินค้าได้" });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="เพิ่มประเภทย่อยของสินค้า">
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
