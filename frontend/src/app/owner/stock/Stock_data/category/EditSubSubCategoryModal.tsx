import { useState, useEffect } from "react";
import Input from "../../../../../components/elements/input";
import Select from "../../../../../components/elements/select";
import Modal from "../../../../../components/elements/modal";
import Button from "../../../../../components/elements/button";
import { useToast } from "../../../../../components/elements/toast";
import { stockDataService } from "../../../../../service/http/wms/stock_data_service";
import type { SubCategory, SubSubCategory } from "../../../../../interface/wms/stock_data";

interface EditSubSubCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  subCategories: SubCategory[];
  subSubCategory: SubSubCategory | null;
}

export default function EditSubSubCategoryModal({
  isOpen,
  onClose,
  onSuccess,
  subCategories,
  subSubCategory
}: EditSubSubCategoryModalProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    sub_sub_category_name: "",
    sub_sub_category_short_name: "",
    description: "",
    sub_category_id: 0,
  });

  useEffect(() => {
    if (subSubCategory) {
      setForm({
        sub_sub_category_name: subSubCategory.sub_sub_category_name || "",
        sub_sub_category_short_name: subSubCategory.sub_sub_category_short_name || "",
        description: subSubCategory.description || "",
        sub_category_id: subSubCategory.sub_category_id || 0,
      });
    }
  }, [subSubCategory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subSubCategory) return;
    try {
      await stockDataService.updateSubSubCategory(subSubCategory.id, {
        sub_sub_category_name: form.sub_sub_category_name,
        sub_sub_category_short_name: form.sub_sub_category_short_name,
        description: form.description,
        sub_category_id: form.sub_category_id,
      });
      toast({ variant: "success", message: "แก้ไขประเภทย่อยย่อยสำเร็จ" });
      onSuccess();
      onClose();
    } catch (err) {
      toast({ variant: "error", message: "ไม่สามารถแก้ไขข้อมูลประเภทย่อยย่อยได้" });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="แก้ไขประเภทย่อยย่อยของสินค้า">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="เลือกประเภทย่อย"
          required
          options={subCategories.map((sc) => ({ label: sc.sub_category_name, value: String(sc.id) }))}
          value={String(form.sub_category_id)}
          onChange={(e) => setForm({ ...form, sub_category_id: Number(e.target.value) })}
        />
        <Input
          label="ชื่อประเภทย่อยย่อย"
          required
          value={form.sub_sub_category_name}
          onChange={(e) => setForm({ ...form, sub_sub_category_name: e.target.value })}
          placeholder="เช่น ตาข่าย, ก้านที่, ก้านใหญ่..."
        />
        <Input
          label="ชื่อย่อ"
          value={form.sub_sub_category_short_name}
          onChange={(e) => setForm({ ...form, sub_sub_category_short_name: e.target.value })}
          placeholder="เช่น ตข., กท...."
        />
        <Input
          label="รายละเอียดเพิ่มเติม"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="รายละเอียด..."
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
