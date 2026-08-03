import React, { useState } from "react";
import Modal from "../../../../components/elements/modal";
import Input from "../../../../components/elements/input";
import Select from "../../../../components/elements/select";
import MultiSelect from "../../../../components/elements/multiselect";
import Cascader, { type CascaderOption } from "../../../../components/elements/cascader";
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
  models: SelectOption[];
  categories: CascaderOption[];
  grades: SelectOption[];
  units: SelectOption[];
  zones: CascaderOption[];
}

export default function AddDataStck({
  isOpen,
  onClose,
  onSuccess,
  models,
  categories,
  grades,
  units,
  zones,
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
    model_ids: [] as string[],
    category_path: [] as string[],
    grade_id: "",
    unit_id: "",
    zone_path: [] as string[],
  });

  const [submitting, setSubmitting] = useState(false);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const missingFields: string[] = [];
      if (!formData.product_code) missingFields.push("รหัสสินค้า (Code)");
      if (!formData.product_name) missingFields.push("ชื่อสินค้า (Name)");
      if (formData.model_ids.length === 0) missingFields.push("รุ่นรถ (Models)");
      if (formData.category_path.length < 1) missingFields.push("หมวดหมู่สินค้า (ระบุให้ครบ 3 ระดับ)");
      if (!formData.grade_id) missingFields.push("เกรดสินค้า");
      if (!formData.unit_id) missingFields.push("หน่วยนับ");
      if (formData.zone_path.length < 2) missingFields.push("ตำแหน่งจัดเก็บ (เลือกอย่างน้อยถึงระดับตู้)");

      if (missingFields.length > 0) {
        alert("กรุณากรอกข้อมูลหรือเลือกรายการต่อไปนี้ให้ครบถ้วน:\n- " + missingFields.join("\n- "));
        return;
      }

      setSubmitting(true);
      const payload = {
        ...formData,
        quantity: Number(formData.quantity),
        limit_quantity: Number(formData.limit_quantity),
        sale_price: Number(formData.sale_price),
        cost_price: Number(formData.cost_price),
        model_ids: formData.model_ids.map(Number),
        category_id: formData.category_path[0] ? Number(formData.category_path[0].split("-").pop()) : 0,
        sub_category_id: formData.category_path[1] ? Number(formData.category_path[1].split("-").pop()) : null,
        sub_sub_category_id: formData.category_path[2] ? Number(formData.category_path[2].split("-").pop()) : null,
        grade_id: Number(formData.grade_id),
        unit_id: Number(formData.unit_id),
        shelf_id: Number(formData.zone_path[1]),
        shelf_level_id: formData.zone_path[2] ? Number(formData.zone_path[2]) : null,
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
        model_ids: [],
        category_path: [],
        grade_id: "",
        unit_id: "",
        zone_path: [],
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
            label="จำนวนสินค้า (Quantity)"
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
          <MultiSelect
            label="รุ่นรถ (Models)"
            required
            options={models}
            value={formData.model_ids}
            onChange={(selected) => setFormData({ ...formData, model_ids: selected })}
            placeholder="เลือกรุ่นรถที่รองรับ..."
          />
          <Cascader
            label="หมวดหมู่สินค้า"
            required
            options={categories}
            placeholder="เลือกหมวดหมู่ย่อย"
            value={formData.category_path}
            onChange={(val) => setFormData({ ...formData, category_path: val })}
            changeOnSelect={true}
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
          <Cascader
            label="ตำแหน่งจัดเก็บ (โซน > ตู้ > ชั้นระดับ)"
            required
            options={zones}
            placeholder="เลือกโซน/ตู้/ชั้นระดับ"
            value={formData.zone_path}
            onChange={(val) => setFormData({ ...formData, zone_path: val })}
            changeOnSelect={true}
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
