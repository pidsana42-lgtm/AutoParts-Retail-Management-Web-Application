import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Loader2 } from "lucide-react";

import Heading from "../../../../components/elements/heading";
import { Card, CardHeader, CardTitle, CardContent } from "../../../../components/elements/card";
import Input from "../../../../components/elements/input";
import Select from "../../../../components/elements/select";
import MultiSelect from "../../../../components/elements/multiselect";
import TreeSelect from "../../../../components/elements/tree_select";
import Button from "../../../../components/elements/button";
import ImageUploader from "../../../../components/elements/image_uploader";
import { getProductById, updateProduct, uploadProductImage } from "../../../../service/http/wms/product";
import type { StockItem } from "../../../../interface/wms/product";
import { useProductFormOptions } from "../hooks/useProductFormOptions";

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { models, categories, grades, units, zones, loading: loadingOptions } = useProductFormOptions();

  const [product, setProduct] = useState<StockItem | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;

    const loadProduct = async () => {
      try {
        setLoadingProduct(true);
        setLoadError(null);
        const data = await getProductById(id);
        if (alive) setProduct(data);
      } catch (err) {
        console.error("Failed to load product:", err);
        if (alive) setLoadError("ไม่พบข้อมูลสินค้า หรือไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
      } finally {
        if (alive) setLoadingProduct(false);
      }
    };

    loadProduct();
    return () => {
      alive = false;
    };
  }, [id]);

  const [formData, setFormData] = useState({
    product_code: "",
    part_number: "",
    product_name: "",
    barcode: "",
    quantity: 0,
    limit_quantity: 0,
    sale_price: 0,
    cost_price: 0,
    max_discount_rate: 0,
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

  // เมื่อโหลดสินค้า + ข้อมูลอ้างอิงครบ ให้ map เป็นค่าเริ่มต้นของฟอร์ม (จับคู่ชื่อ -> id ของแต่ละ dropdown)
  useEffect(() => {
    if (!product || loadingOptions) return;

    const matchedModelIds: string[] = [];
    if (product.Models && product.Models.length > 0) {
      const modelNames = product.Models.map((m) => m.model_name.trim().toUpperCase());
      models.forEach((m) => {
        // split "BrandName - ModelName" to get ModelName
        const mName = m.label.split(" - ")[1]?.trim().toUpperCase();
        if (mName && modelNames.includes(mName)) {
          matchedModelIds.push(m.value);
        }
      });
    }

    const categoryPath: string[] = [];
    const matchedCat = categories.find((c) => c.label.toUpperCase() === product.Category?.toUpperCase());
    if (matchedCat) {
      categoryPath.push(matchedCat.value);
      const matchedSub = matchedCat.children?.find((c) => c.label.toUpperCase() === product.SubCategory?.toUpperCase());
      if (matchedSub) {
        categoryPath.push(matchedSub.value);
        const matchedSubSub = matchedSub.children?.find(
          (c) => c.label.toUpperCase() === product.SubSubCategory?.toUpperCase()
        );
        if (matchedSubSub) {
          categoryPath.push(matchedSubSub.value);
        }
      }
    }

    const matchedGrade = grades.find((g) => g.label.toUpperCase() === product.Grade?.toUpperCase());
    const matchedUnit = units.find((u) => u.label.toUpperCase() === product.Unit?.toUpperCase());
    const zonePath: string[] = [];
    for (const z of zones) {
      const matchedShelfNode = z.children?.find((s) => s.label.toUpperCase() === product.Shelf?.toUpperCase());
      if (matchedShelfNode) {
        zonePath.push(z.value);
        zonePath.push(matchedShelfNode.value);
        const matchedLevelNode = matchedShelfNode.children?.find(
          (l) => l.label.toUpperCase() === product.ShelfLevel?.toUpperCase()
        );
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
      max_discount_rate: product.MaxDiscountRate || 0,
      note: product.Note || "",
      model_ids: matchedModelIds,
      category_path: categoryPath,
      grade_id: matchedGrade ? matchedGrade.value : "",
      unit_id: matchedUnit ? matchedUnit.value : "",
      zone_path: zonePath,
    });
    setImageFile(null);
    setImagePreview(product.ThumbnailUrl || "");
  }, [product, loadingOptions, models, categories, grades, units, zones]);

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

      if (formData.max_discount_rate < 0 || formData.max_discount_rate > 2) {
        alert("ส่วนลดสูงสุดต้องอยู่ระหว่าง 0-2% เท่านั้น");
        return;
      }

      // หา shelf/level จาก path ด้วย prefix แทนตำแหน่ง index เพราะ zone_path มาจาก TreeSelect
      // ที่ prefix ค่าตามประเภทไว้แล้ว (zone-/shelf-/level-) กัน id ชนกันข้ามตาราง
      const shelfEntry = formData.zone_path.find((p) => p.startsWith("shelf-"));
      const levelEntry = formData.zone_path.find((p) => p.startsWith("level-"));

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
        shelf_id: shelfEntry ? Number(shelfEntry.split("-").pop()) : 0,
        shelf_level_id: levelEntry ? Number(levelEntry.split("-").pop()) : null,
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
      navigate(`/owner/stock/${product.ID}`);
    } catch (err: any) {
      console.error("Error updating product:", err);
      alert(err.response?.data?.error || "เกิดข้อผิดพลาดในการแก้ไขข้อมูลสินค้า");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingProduct) {
    return (
      <div className="flex h-[calc(100vh-8rem)] w-full flex-col items-center justify-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-[#B70011]" />
        <span className="text-sm font-medium text-slate-400">กำลังโหลดข้อมูลสินค้า...</span>
      </div>
    );
  }

  if (loadError || !product) {
    return (
      <div className="space-y-4 p-8 text-center">
        <p className="font-bold text-slate-500">{loadError || "ไม่พบข้อมูลสินค้าที่คุณระบุ"}</p>
        <Button onClick={() => navigate("/owner/stock")} variant="outline">
          กลับหน้าคลังสินค้า
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-6 bg-gray-50 p-8 font-sans">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-slate-200 pb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="cursor-pointer rounded-full p-2 transition-colors hover:bg-slate-200"
        >
          <ChevronLeft size={24} className="text-slate-600" />
        </button>
        <div>
          <Heading level="h2" weight="semibold" className="mb-0 text-gray-800">
            แก้ไขข้อมูลสินค้า
          </Heading>
          <Heading level="h6" weight="light" className="m-0 mt-1 text-slate-500">
            แก้ไขข้อมูลสินค้า: {product.ProductCode}
          </Heading>
        </div>
      </div>

      <Card className="border-l-[5px] border-l-red-800">
        <CardHeader>
          <CardTitle className="text-lg">รายละเอียดสินค้า</CardTitle>
        </CardHeader>
        <CardContent>
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
                placeholder={loadingOptions ? "กำลังโหลด..." : "เลือกรุ่นรถที่รองรับ..."}
                value={formData.model_ids}
                onChange={(values) => setFormData({ ...formData, model_ids: values })}
              />
              <TreeSelect
                label="หมวดหมู่สินค้า"
                required
                options={categories}
                placeholder={loadingOptions ? "กำลังโหลด..." : "เลือกหมวดหมู่ย่อย"}
                searchPlaceholder="ค้นหาหมวดหมู่..."
                value={formData.category_path[formData.category_path.length - 1] || ""}
                onChange={(_val, path) => setFormData({ ...formData, category_path: path.map((p) => p.value) })}
              />
              <Select
                label="เกรดสินค้า"
                required
                options={grades}
                placeholder={loadingOptions ? "กำลังโหลด..." : "เลือกเกรด"}
                value={formData.grade_id}
                onChange={(e) => setFormData({ ...formData, grade_id: e.target.value })}
              />
              <Select
                label="หน่วยนับ"
                required
                options={units}
                placeholder={loadingOptions ? "กำลังโหลด..." : "เลือกหน่วย"}
                value={formData.unit_id}
                onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
              />
              <TreeSelect
                label="ตำแหน่งจัดเก็บ (โซน > ตู้ > ชั้นระดับ)"
                required
                options={zones}
                placeholder={loadingOptions ? "กำลังโหลด..." : "เลือกโซน/ตู้/ชั้นระดับ"}
                searchPlaceholder="ค้นหาโซน/ตู้/ชั้นระดับ..."
                value={formData.zone_path[formData.zone_path.length - 1] || ""}
                onChange={(_val, path) => setFormData({ ...formData, zone_path: path.map((p) => p.value) })}
              />
              <Input
                label="ส่วนลดสูงสุด (%)"
                type="number"
                step="0.1"
                min={0}
                max={2}
                value={formData.max_discount_rate === 0 ? "" : formData.max_discount_rate}
                onChange={(e) => setFormData({ ...formData, max_discount_rate: Number(e.target.value) })}
                placeholder="เช่น 2 (ลดได้สูงสุดไม่เกิน 2% ของราคาขาย)"
                helperText="พนักงานขายหน้าร้าน (POS) จะลดราคาสินค้าชิ้นนี้ได้ไม่เกินเปอร์เซ็นต์ที่กำหนด"
              />
            </div>

            <Input
              label="หมายเหตุ / รายละเอียดการรองรับ"
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder="เช่น รุ่นรถที่รองรับ หรือรายละเอียดเพิ่มเติม"
            />

            <ImageUploader preview={imagePreview} onChange={handleImageChange} onClear={handleImageClear} />

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
                disabled={submitting}
              >
                ยกเลิก
              </Button>
              <Button type="submit" variant="primary" isLoading={submitting}>
                บันทึกการแก้ไข
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
