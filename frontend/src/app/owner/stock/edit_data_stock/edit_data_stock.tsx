import React, { useState, useEffect } from "react";
import Modal from "../../../../components/elements/modal";
import Input from "../../../../components/elements/input";
import Select from "../../../../components/elements/select";
import MultiSelect from "../../../../components/elements/multiselect";
import Cascader, { type CascaderOption } from "../../../../components/elements/cascader";
import Button from "../../../../components/elements/button";
import ImageUploader from "../../../../components/elements/image_uploader";
import { updateProduct, uploadProductImage } from "../../../../service/http/wms/product";
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
  models: SelectOption[];
  categories: CascaderOption[];
  grades: SelectOption[];
  units: SelectOption[];
  zones: CascaderOption[];
}

export default function EditDataStock({
  isOpen,
  onClose,
  onSuccess,
  product,
  models,
  categories,
  grades,
  units,
  zones,
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
    model_ids: [] as string[],
    category_path: [] as string[],
    grade_id: "",
    unit_id: "",
    zone_path: [] as string[],
  });

  const [submitting, setSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  useEffect(() => {
    if (!imageFile) return;
    const previewUrl = URL.createObjectURL(imageFile);
    setImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [imageFile]);

  const handleImageChange = (file: File) => {
    setImageFile(file);
  };

  const handleImageClear = () => {
    setImageFile(null);
    setImagePreview(product?.ThumbnailUrl || "");
  };

  useEffect(() => {
    if (isOpen && product) {
      // สำหรับรุ่นรถ เนื่องจาก product.Model อาจจะมาเป็น string ที่มี , คั่น เราต้อง split
      const matchedModelIds: string[] = [];
      if (product.Models && product.Models.length > 0) {
        const modelNames = product.Models.map(m => m.model_name.trim().toUpperCase());
        models.forEach(m => {
          // split "BrandName - ModelName" to get ModelName
          const mName = m.label.split(" - ")[1]?.trim().toUpperCase();
          if (mName && modelNames.includes(mName)) {
            matchedModelIds.push(m.value);
          }
        });
      }
      
      const categoryPath: string[] = [];
      const matchedCat = categories.find(c => c.label.toUpperCase() === product.Category?.toUpperCase());
      if (matchedCat) {
        categoryPath.push(matchedCat.value);
        const matchedSub = matchedCat.children?.find(c => c.label.toUpperCase() === product.SubCategory?.toUpperCase());
        if (matchedSub) {
          categoryPath.push(matchedSub.value);
          const matchedSubSub = matchedSub.children?.find(c => c.label.toUpperCase() === product.SubSubCategory?.toUpperCase());
          if (matchedSubSub) {
            categoryPath.push(matchedSubSub.value);
          }
        }
      }

      const matchedGrade = grades.find((g) => g.label.toUpperCase() === product.Grade?.toUpperCase());
      const matchedUnit = units.find((u) => u.label.toUpperCase() === product.Unit?.toUpperCase());
      const zonePath: string[] = [];
      for (const z of zones) {
        const matchedShelfNode = z.children?.find(s => s.label.toUpperCase() === product.Shelf?.toUpperCase());
        if (matchedShelfNode) {
          zonePath.push(z.value);
          zonePath.push(matchedShelfNode.value);
          const matchedLevelNode = matchedShelfNode.children?.find(l => l.label.toUpperCase() === product.ShelfLevel?.toUpperCase());
          if (matchedLevelNode) {
            zonePath.push(matchedLevelNode.value);
          }
          break;
        }
      }

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
        model_ids: matchedModelIds,
        category_path: categoryPath,
        grade_id: matchedGrade ? matchedGrade.value : "",
        unit_id: matchedUnit ? matchedUnit.value : "",
        zone_path: zonePath,
      });
      setImageFile(null);
      setImagePreview(product.ThumbnailUrl || "");
    }
  }, [isOpen, product, models, categories, grades, units, zones]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    try {
      const missingFields: string[] = [];
      if (!formData.product_code) missingFields.push("รหัสสินค้า (Code)");
      if (!formData.product_name) missingFields.push("ชื่อสินค้า (Name)");
      if (formData.model_ids.length === 0) missingFields.push("รุ่นรถ (Models)");
      if (formData.category_path.length < 2) missingFields.push("หมวดหมู่สินค้า (ระบุให้ครบ 3 ระดับ)");
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

      await updateProduct(product.ID, payload);
      let imageUploadFailed = false;
      if (imageFile) {
        try {
          await uploadProductImage(product.ID, imageFile);
        } catch (uploadErr) {
          imageUploadFailed = true;
          console.error("Error uploading product image:", uploadErr);
        }
      }
      alert(imageUploadFailed ? "แก้ไขข้อมูลสินค้าสำเร็จ แต่อัปโหลดรูปสินค้าไม่สำเร็จ" : "แก้ไขข้อมูลสินค้าสำเร็จ");
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
            placeholder="เลือกรุ่นรถที่รองรับ..."
            value={formData.model_ids}
            onChange={(values) => setFormData({ ...formData, model_ids: values })}
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

        <ImageUploader
          preview={imagePreview}
          onChange={handleImageChange}
          onClear={handleImageClear}
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
