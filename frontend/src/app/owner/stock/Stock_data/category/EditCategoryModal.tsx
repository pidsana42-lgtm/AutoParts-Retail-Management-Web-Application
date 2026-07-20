import React, { useState, useEffect } from "react";
import Input from "../../../../../components/elements/input";
import Modal from "../../../../../components/elements/modal";
import Button from "../../../../../components/elements/button";
import { useToast } from "../../../../../components/elements/toast";
import { stockDataService } from "../../../../../service/http/wms/stock_data_service";
import type { Category } from "../../../../../interface/wms/stock_data";

interface EditCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  category: Category | null;
}

export default function EditCategoryModal({ isOpen, onClose, onSuccess, category }: EditCategoryModalProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    category_name: "",
    category_short_name: "",
    description: "",
  });

  useEffect(() => {
    if (category) {
      setForm({
        category_name: category.category_name || "",
        category_short_name: category.category_short_name || "",
        description: category.description || "",
      });
    }
  }, [category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) return;
    try {
      await stockDataService.updateCategory(category.id, form);
      toast({ variant: "success", message: "แก้ไขประเภทสินค้าสำเร็จ" });
      onSuccess();
      onClose();
    } catch (err) {
      toast({ variant: "error", message: "ไม่สามารถแก้ไขข้อมูลประเภทสินค้าได้" });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="แก้ไขประเภทสินค้าหลัก">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="ชื่อประเภทสินค้า"
          required
          value={form.category_name}
          onChange={(e) => setForm({ ...form, category_name: e.target.value })}
          placeholder="เช่น เบรก, ล้อแม็ก..."
        />
        <Input
          label="ชื่อย่อ"
          value={form.category_short_name}
          onChange={(e) => setForm({ ...form, category_short_name: e.target.value })}
          placeholder="เช่น บ., ลม..."
        />
        <Input
          label="รายละเอียดเพิ่มเติม"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="รายละเอียดประเภทสินค้า..."
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
