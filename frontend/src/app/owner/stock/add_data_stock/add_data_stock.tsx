import React, { useState } from "react";
import Modal from "../../../../components/elements/modal";
import Input from "../../../../components/elements/input";
import Select from "../../../../components/elements/select";
import Button from "../../../../components/elements/button";
import { createProduct } from "../../../../service/http/wms/product";

interface SelectOption {
  label: string;
  value: string;
}

interface AddDataStckProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  brands: SelectOption[];
  formCategories: SelectOption[];
  grades: SelectOption[];
  units: SelectOption[];
  shelves: SelectOption[];
}

export default function AddDataStck({
  isOpen,
  onClose,
  onSuccess,
  brands,
  formCategories,
  grades,
  units,
  shelves,
}: AddDataStckProps) {
  const [formData, setFormData] = useState({
    product_code: "",
    part_number: "",
    product_name: "",
    barcode: "",
    quantity: 0,
    limit_quantity: 0,
    sale_price: 0,
    cost_price: 0,
    note: "",
    brand_id: "",
    category_id: "",
    grade_id: "",
    unit_id: "",
    shelf_id: "",
  });

  const [submitting, setSubmitting] = useState(false);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (
        !formData.product_code ||
        !formData.product_name ||
        !formData.brand_id ||
        !formData.category_id ||
        !formData.grade_id ||
        !formData.unit_id ||
        !formData.shelf_id
      ) {
        alert("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน");
        return;
      }

      setSubmitting(true);
      const payload = {
        ...formData,
        quantity: Number(formData.quantity),
        limit_quantity: Number(formData.limit_quantity),
        sale_price: Number(formData.sale_price),
        cost_price: Number(formData.cost_price),
        brand_id: Number(formData.brand_id),
        category_id: Number(formData.category_id),
        grade_id: Number(formData.grade_id),
        unit_id: Number(formData.unit_id),
        shelf_id: Number(formData.shelf_id),
      };

      await createProduct(payload);
      alert("เพิ่มข้อมูลสินค้าสำเร็จ");
      setFormData({
        product_code: "",
        part_number: "",
        product_name: "",
        barcode: "",
        quantity: 0,
        limit_quantity: 0,
        sale_price: 0,
        cost_price: 0,
        note: "",
        brand_id: "",
        category_id: "",
        grade_id: "",
        unit_id: "",
        shelf_id: "",
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Error creating product:", err);
      alert(err.response?.data?.error || "เกิดข้อผิดพลาดในการเพิ่มข้อมูลสินค้า");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="เพิ่มข้อมูลสินค้าใหม่"
      description="กรอกรายละเอียดสินค้าด้านล่างเพื่อเพิ่มข้อมูลสินค้าเข้าสู่ระบบคลัง"
      size="lg"
    >
      <form onSubmit={handleAddSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="รหัสสินค้า"
            required
            value={formData.product_code}
            onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
            placeholder="เช่น BR-900X"
          />
          <Input
            label="ชื่อสินค้า"
            required
            value={formData.product_name}
            onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
            placeholder="เช่น Turbocharger"
          />
          <Input
            label="PART NO."
            value={formData.part_number}
            onChange={(e) => setFormData({ ...formData, part_number: e.target.value })}
            placeholder="เช่น PT-TURBO-01"
          />
          <Input
            label="บาร์โค้ด"
            value={formData.barcode}
            onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
            placeholder="เช่น 8850000000001"
          />
          <Input
            label="ราคาทุน (Cost Price)"
            type="number"
            step="any"
            required
            value={formData.cost_price || ""}
            onChange={(e) => setFormData({ ...formData, cost_price: Number(e.target.value) })}
            placeholder="เช่น 600"
          />
          <Input
            label="ราคาขาย (Sale Price)"
            type="number"
            step="any"
            required
            value={formData.sale_price || ""}
            onChange={(e) => setFormData({ ...formData, sale_price: Number(e.target.value) })}
            placeholder="เช่น 870"
          />
          <Input
            label="จำนวนเริ่มต้น (Quantity)"
            type="number"
            value={formData.quantity || ""}
            onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
            placeholder="เช่น 50"
          />
          <Input
            label="จำนวนขั้นต่ำแจ้งเตือน (Min Stock)"
            type="number"
            value={formData.limit_quantity || ""}
            onChange={(e) => setFormData({ ...formData, limit_quantity: Number(e.target.value) })}
            placeholder="เช่น 5"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Select
            label="แบรนด์สินค้า"
            required
            options={brands}
            placeholder="เลือกแบรนด์"
            value={formData.brand_id}
            onChange={(e) => setFormData({ ...formData, brand_id: e.target.value })}
          />
          <Select
            label="ประเภทสินค้า"
            required
            options={formCategories}
            placeholder="เลือกประเภท"
            value={formData.category_id}
            onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
          />
          <Select
            label="เกรดสินค้า"
            required
            options={grades}
            placeholder="เลือกเกรด"
            value={formData.grade_id}
            onChange={(e) => setFormData({ ...formData, grade_id: e.target.value })}
          />
          <Select
            label="หน่วยนับ"
            required
            options={units}
            placeholder="เลือกหน่วย"
            value={formData.unit_id}
            onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
          />
          <Select
            label="ชั้นวาง (Shelf)"
            required
            options={shelves}
            placeholder="เลือกชั้นวาง"
            value={formData.shelf_id}
            onChange={(e) => setFormData({ ...formData, shelf_id: e.target.value })}
          />
        </div>

        <Input
          label="หมายเหตุ / รายละเอียดการรองรับ"
          value={formData.note}
          onChange={(e) => setFormData({ ...formData, note: e.target.value })}
          placeholder="เช่น รุ่นรถที่รองรับ หรือรายละเอียดเพิ่มเติม"
        />

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            ยกเลิก
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={submitting}
          >
            บันทึกข้อมูล
          </Button>
        </div>
      </form>
    </Modal>
  );
}
