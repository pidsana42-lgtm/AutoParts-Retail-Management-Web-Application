import React, { useState, useEffect } from "react";
import Modal from "../../../../components/elements/modal";
import Input from "../../../../components/elements/input";
import Select from "../../../../components/elements/select";
import Button from "../../../../components/elements/button";
import { updateProduct } from "../../../../service/http/wms/product";
import type { StockItem } from "../../../../interface/wms/product";

interface SelectOption {
  label: string;
  value: string;
}

interface EditDataStockProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product: StockItem | null;
  brands: SelectOption[];
  formCategories: SelectOption[];
  grades: SelectOption[];
  units: SelectOption[];
  shelves: SelectOption[];
}

export default function EditDataStock({
  isOpen,
  onClose,
  onSuccess,
  product,
  brands,
  formCategories,
  grades,
  units,
  shelves,
}: EditDataStockProps) {
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

  useEffect(() => {
    if (isOpen && product) {
      // ค้นหา ID ที่สอดคล้องกับชื่อเพื่อตั้งเป็นค่าเริ่มต้นในฟอร์มแก้ไข
      const matchedBrand = brands.find((b) => b.label.toUpperCase() === product.Brand?.toUpperCase());
      const matchedCategory = formCategories.find((c) => c.label.toUpperCase() === product.Category?.toUpperCase());
      const matchedGrade = grades.find((g) => g.label.toUpperCase() === product.Grade?.toUpperCase());
      const matchedUnit = units.find((u) => u.label.toUpperCase() === product.Unit?.toUpperCase());
      const matchedShelf = shelves.find((s) => s.label.toUpperCase() === product.Shelf?.toUpperCase());

      setFormData({
        product_code: product.ProductCode || "",
        part_number: product.PartNo || "",
        product_name: product.Name || "",
        barcode: product.Barcode || "",
        quantity: product.Stock || 0,
        limit_quantity: product.MinStock || 0,
        sale_price: product.Price || 0,
        cost_price: product.CostPrice || 0,
        note: product.Note || "",
        brand_id: matchedBrand ? matchedBrand.value : "",
        category_id: matchedCategory ? matchedCategory.value : "",
        grade_id: matchedGrade ? matchedGrade.value : "",
        unit_id: matchedUnit ? matchedUnit.value : "",
        shelf_id: matchedShelf ? matchedShelf.value : "",
      });
    }
  }, [isOpen, product, brands, formCategories, grades, units, shelves]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

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

      await updateProduct(product.ID, payload);
      alert("แก้ไขข้อมูลสินค้าสำเร็จ");
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Error updating product:", err);
      alert(err.response?.data?.error || "เกิดข้อผิดพลาดในการแก้ไขข้อมูลสินค้า");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="แก้ไขข้อมูลสินค้า"
      description={`แก้ไขข้อมูลสินค้า: ${product?.ProductCode || ""}`}
      size="lg"
    >
      <form onSubmit={handleEditSubmit} className="space-y-4">
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
            บันทึกการแก้ไข
          </Button>
        </div>
      </form>
    </Modal>
  );
}
