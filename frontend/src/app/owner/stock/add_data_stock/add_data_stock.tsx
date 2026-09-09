import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PackagePlus, PackageSearch } from "lucide-react";

import Heading from "../../../../components/elements/heading";
import Breadcrumb from "../../../../components/elements/breadcrumb";
import { Card, CardHeader, CardTitle, CardContent } from "../../../../components/elements/card";
import Input from "../../../../components/elements/input";
import Select from "../../../../components/elements/select";
import MultiSelect from "../../../../components/elements/multiselect";
import TreeSelect from "../../../../components/elements/tree_select";
import Button from "../../../../components/elements/button";
import ImageUploader from "../../../../components/elements/image_uploader";
import { useAlertDialog } from "../../../../components/elements/alert_dialog";
import { createProduct, uploadProductImage, getProductsList, receiveStock } from "../../../../service/http/wms/product";
import { useProductFormOptions } from "../hooks/useProductFormOptions";
import SupplierRowsField, { rowsToPayload, type SupplierRow } from "../SupplierRowsField";
import SearchableSelect from "../stock_check/SearchableSelect";
import type { StockItem } from "../../../../interface/wms/product";
import { cn } from "../../../../utils/component";

export default function AddProductPage() {
  const navigate = useNavigate();
  const { alertDialog, confirmDialog } = useAlertDialog();
  const { models, categories, grades, units, zones, suppliers, loading, addSupplierOption } = useProductFormOptions();
  const [supplierRows, setSupplierRows] = useState<SupplierRow[]>([]);

  // โหมด: "new" = เพิ่มสินค้าใหม่ทั้งหมด (ของเดิม), "existing" = รับสินค้าเข้าเพิ่มให้สินค้าที่มีอยู่แล้ว (บวกยอด ไม่สร้างซ้ำ)
  const [mode, setMode] = useState<"new" | "existing">("new");

  const [formData, setFormData] = useState({
    product_code: "",
    part_number: "",
    product_name: "",
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
    setImagePreview("");
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const missingFields: string[] = [];
      if (!formData.product_name) missingFields.push("ชื่อสินค้า (Name)");
      if (formData.model_ids.length === 0) missingFields.push("รุ่นรถ (Models)");
      if (formData.category_path.length < 1) missingFields.push("หมวดหมู่สินค้า (ระบุให้ครบ 3 ระดับ)");
      if (!formData.grade_id) missingFields.push("เกรดสินค้า");
      if (!formData.unit_id) missingFields.push("หน่วยนับ");
      if (formData.zone_path.length < 2) missingFields.push("ตำแหน่งจัดเก็บ (เลือกอย่างน้อยถึงระดับตู้)");

      if (missingFields.length > 0) {
        await alertDialog("กรุณากรอกข้อมูลหรือเลือกรายการต่อไปนี้ให้ครบถ้วน:\n- " + missingFields.join("\n- "));
        return;
      }

      if (formData.max_discount_rate < 0 || formData.max_discount_rate > 2) {
        await alertDialog("ส่วนลดสูงสุดต้องอยู่ระหว่าง 0-2% เท่านั้น");
        return;
      }

      const supplierPayload = rowsToPayload(supplierRows);
      const supplierQtySum = supplierPayload.reduce((sum, s) => sum + s.quantity, 0);
      if (supplierQtySum > Number(formData.quantity)) {
        await alertDialog(
          `จำนวนสินค้าที่รับมาจาก Supplier รวมกัน (${supplierQtySum}) เกินจำนวนสินค้าทั้งหมด (${Number(formData.quantity)}) กรุณาแก้ไขจำนวนให้ถูกต้อง`
        );
        return;
      }

      // หา shelf/level จาก path ด้วย prefix แทนตำแหน่ง index เพราะ zone_path มาจาก TreeSelect
      // ที่ prefix ค่าตามประเภทไว้แล้ว (zone-/shelf-/level-) กัน id ชนกันข้ามตาราง
      const shelfEntry = formData.zone_path.find((p) => p.startsWith("shelf-"));
      const levelEntry = formData.zone_path.find((p) => p.startsWith("level-"));

      setSubmitting(true);
      const payload = {
        ...formData,
        product_code: "",
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
        suppliers: supplierPayload,
      };

      const created = await createProduct(payload);
      const createdProductId = Number(created?.data?.id || created?.id || 0);
      let imageUploadFailed = false;
      if (imageFile && createdProductId) {
        try {
          await uploadProductImage(createdProductId, imageFile);
        } catch (uploadErr) {
          imageUploadFailed = true;
          console.error("Error uploading product image:", uploadErr);
        }
      }
      await alertDialog(imageUploadFailed ? "เพิ่มข้อมูลสินค้าสำเร็จ แต่อัปโหลดรูปสินค้าไม่สำเร็จ" : "เพิ่มข้อมูลสินค้าสำเร็จ");
      navigate("/owner/stock");
    } catch (err: any) {
      console.error("Error creating product:", err);
      await alertDialog(err.response?.data?.error || "เกิดข้อผิดพลาดในการเพิ่มข้อมูลสินค้า");
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- โหมด "สินค้าที่มีอยู่แล้ว": รับสินค้าเข้าเพิ่ม (บวกยอดเดิม ไม่สร้างสินค้าซ้ำ) ----------
  const [existingProducts, setExistingProducts] = useState<StockItem[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [receiveQuantity, setReceiveQuantity] = useState("");
  const [receiveSupplierRows, setReceiveSupplierRows] = useState<SupplierRow[]>([]);
  const [receiveSubmitting, setReceiveSubmitting] = useState(false);

  useEffect(() => {
    if (mode !== "existing" || existingProducts.length > 0) return;
    let alive = true;
    setLoadingExisting(true);
    getProductsList()
      .then((list) => {
        if (alive) setExistingProducts(list);
      })
      .catch((err) => console.error("Failed to load existing products:", err))
      .finally(() => {
        if (alive) setLoadingExisting(false);
      });
    return () => {
      alive = false;
    };
  }, [mode, existingProducts.length]);

  const selectedProduct = useMemo(
    () => existingProducts.find((p) => String(p.ID) === selectedProductId) || null,
    [existingProducts, selectedProductId]
  );

  const handleReceiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      await alertDialog("กรุณาเลือกสินค้าที่ต้องการรับเข้าเพิ่ม");
      return;
    }
    const qty = Number(receiveQuantity);
    if (!qty || qty <= 0) {
      await alertDialog("กรุณากรอกจำนวนที่รับเข้าเพิ่มให้ถูกต้อง");
      return;
    }

    const supplierPayload = rowsToPayload(receiveSupplierRows);
    const supplierQtySum = supplierPayload.reduce((sum, s) => sum + s.quantity, 0);
    if (supplierQtySum > qty) {
      await alertDialog(
        `จำนวนที่รับมาจาก Supplier รวมกัน (${supplierQtySum}) เกินจำนวนที่รับเข้าเพิ่ม (${qty}) กรุณาแก้ไขจำนวนให้ถูกต้อง`
      );
      return;
    }

    // รับเข้าเพิ่ม = ไปบวกยอดสต็อกของสินค้าที่มีอยู่จริง ควรให้ทบทวนยอดก่อนกดจริง
    const unitLabel = selectedProduct.Unit || "ชิ้น";
    const confirmedReceive = await confirmDialog(
      `ยืนยันรับสินค้า "${selectedProduct.Name}" เข้าเพิ่ม ${qty} ${unitLabel} หรือไม่? ` +
        `ยอดคงเหลือจะเปลี่ยนจาก ${selectedProduct.Stock} เป็น ${selectedProduct.Stock + qty} ${unitLabel}`,
      { title: "ยืนยันรับสินค้าเข้าเพิ่ม", confirmText: "รับสินค้าเข้า", variant: "info", icon: PackagePlus }
    );
    if (!confirmedReceive) return;

    try {
      setReceiveSubmitting(true);
      await receiveStock(selectedProduct.ID, { quantity: qty, suppliers: supplierPayload });
      await alertDialog(`รับสินค้าเข้าเพิ่มสำเร็จ: ${selectedProduct.Name} +${qty} ${selectedProduct.Unit || "ชิ้น"}`);
      navigate(`/owner/stock/${selectedProduct.ID}`);
    } catch (err: any) {
      console.error("Error receiving stock:", err);
      await alertDialog(err.response?.data?.error || "เกิดข้อผิดพลาดในการรับสินค้าเข้าเพิ่ม");
    } finally {
      setReceiveSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen space-y-6 bg-gray-50 p-8 font-sans">
      <Breadcrumb
        items={[
          { label: "คลังสินค้า", path: "/owner/stock" },
          { label: mode === "new" ? "เพิ่มสินค้าใหม่" : "รับสินค้าเข้าเพิ่ม" },
        ]}
      />

      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <Heading level="h2" weight="semibold" className="mb-0 text-gray-800">
          เพิ่มข้อมูลสินค้า
        </Heading>
        <Heading level="h6" weight="light" className="m-0 mt-1 text-slate-500">
          {mode === "new"
            ? "กรอกรายละเอียดสินค้าด้านล่างเพื่อเพิ่มข้อมูลสินค้าใหม่เข้าสู่ระบบคลัง"
            : "เลือกสินค้าที่มีอยู่แล้ว แล้วรับเข้าเพิ่มยอดคงเหลือ (บวกเข้ากับของเดิม ไม่สร้างสินค้าซ้ำ)"}
        </Heading>
      </div>

      {/* Mode toggle: สินค้าใหม่ / สินค้าที่มีอยู่แล้ว */}
      <div className="flex w-fit gap-1 rounded-md border border-slate-200 bg-white p-1">
        <button
          type="button"
          onClick={() => setMode("new")}
          className={cn(
            "flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
            mode === "new" ? "bg-[#B70011] text-white" : "text-slate-500 hover:bg-slate-50"
          )}
        >
          <PackagePlus className="h-4 w-4" />
          สินค้าใหม่
        </button>
        <button
          type="button"
          onClick={() => setMode("existing")}
          className={cn(
            "flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
            mode === "existing" ? "bg-[#B70011] text-white" : "text-slate-500 hover:bg-slate-50"
          )}
        >
          <PackageSearch className="h-4 w-4" />
          สินค้าที่มีอยู่แล้ว
        </button>
      </div>

      {mode === "new" ? (
        <Card className="border-l-[5px] border-l-red-800">
          <CardHeader>
            <CardTitle className="text-lg">รายละเอียดสินค้า</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  placeholder={loading ? "กำลังโหลด..." : "เลือกรุ่นรถที่รองรับ..."}
                />
                <TreeSelect
                  label="หมวดหมู่สินค้า"
                  required
                  options={categories}
                  placeholder={loading ? "กำลังโหลด..." : "เลือกหมวดหมู่ย่อย"}
                  searchPlaceholder="ค้นหาหมวดหมู่..."
                  value={formData.category_path[formData.category_path.length - 1] || ""}
                  onChange={(_val, path) => setFormData({ ...formData, category_path: path.map((p) => p.value) })}
                />
                <Select
                  label="เกรดสินค้า"
                  required
                  options={grades}
                  placeholder={loading ? "กำลังโหลด..." : "เลือกเกรด"}
                  value={formData.grade_id}
                  onChange={(e) => setFormData({ ...formData, grade_id: e.target.value })}
                />
                <Select
                  label="หน่วยนับ"
                  required
                  options={units}
                  placeholder={loading ? "กำลังโหลด..." : "เลือกหน่วย"}
                  value={formData.unit_id}
                  onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
                />
                <TreeSelect
                  label="ตำแหน่งจัดเก็บ (โซน > ตู้ > ชั้นระดับ)"
                  required
                  options={zones}
                  placeholder={loading ? "กำลังโหลด..." : "เลือกโซน/ตู้/ชั้นระดับ"}
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

              <SupplierRowsField
                rows={supplierRows}
                onChange={setSupplierRows}
                options={suppliers}
                disabled={submitting}
                onSupplierCreated={addSupplierOption}
              />

              <ImageUploader preview={imagePreview} onChange={handleImageChange} onClear={handleImageClear} />

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <Button type="button" variant="outline" onClick={() => navigate("/owner/stock")} disabled={submitting}>
                  ยกเลิก
                </Button>
                <Button type="submit" variant="primary" isLoading={submitting}>
                  บันทึกข้อมูล
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-l-[5px] border-l-red-800">
          <CardHeader>
            <CardTitle className="text-lg">รับสินค้าเข้าเพิ่ม</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleReceiveSubmit} className="space-y-4">
              <SearchableSelect
                label="เลือกสินค้าที่ต้องการรับเข้าเพิ่ม"
                options={existingProducts.map((p) => ({
                  label: `[${p.ProductCode}] ${p.Name}`,
                  value: String(p.ID),
                  imageUrl: p.ThumbnailUrl || "",
                }))}
                placeholder={loadingExisting ? "กำลังโหลด..." : "ค้นหาสินค้าที่มีอยู่แล้ว..."}
                value={selectedProductId}
                onChange={setSelectedProductId}
                disabled={loadingExisting}
              />

              {selectedProduct && (
                <div className="flex items-center gap-3 rounded-sm border border-slate-200 bg-slate-50 p-3">
                  {selectedProduct.ThumbnailUrl ? (
                    <img src={selectedProduct.ThumbnailUrl} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
                  ) : (
                    <div className="h-12 w-12 shrink-0 rounded-md bg-slate-200" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{selectedProduct.Name}</p>
                    <p className="text-xs text-slate-400">{selectedProduct.ProductCode}</p>
                  </div>
                  <div className="shrink-0 text-right text-sm">
                    <p className="text-xs text-slate-400">คงเหลือปัจจุบัน</p>
                    <p className="font-bold text-slate-800">
                      {selectedProduct.Stock} <span className="font-normal text-slate-500">{selectedProduct.Unit || "ชิ้น"}</span>
                    </p>
                  </div>
                </div>
              )}

              <Input
                label="จำนวนที่รับเข้าเพิ่ม"
                type="number"
                min={0}
                required
                value={receiveQuantity}
                onChange={(e) => setReceiveQuantity(e.target.value)}
                placeholder="เช่น 20"
                helperText={
                  selectedProduct
                    ? `บันทึกแล้วยอดคงเหลือของ "${selectedProduct.Name}" จะกลายเป็น ${
                        selectedProduct.Stock + (Number(receiveQuantity) || 0)
                      } ${selectedProduct.Unit || "ชิ้น"}`
                    : undefined
                }
              />

              <SupplierRowsField
                rows={receiveSupplierRows}
                onChange={setReceiveSupplierRows}
                options={suppliers}
                disabled={receiveSubmitting}
                onSupplierCreated={addSupplierOption}
              />

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <Button type="button" variant="outline" onClick={() => navigate("/owner/stock")} disabled={receiveSubmitting}>
                  ยกเลิก
                </Button>
                <Button type="submit" variant="primary" isLoading={receiveSubmitting}>
                  รับสินค้าเข้าเพิ่ม
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
