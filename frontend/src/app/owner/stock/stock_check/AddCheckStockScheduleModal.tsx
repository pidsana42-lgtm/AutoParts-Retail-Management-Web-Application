import React, { useState, useEffect, useMemo } from "react";
import Modal from "../../../../components/elements/modal";
import Input from "../../../../components/elements/input";
import Select from "../../../../components/elements/select";
import Button from "../../../../components/elements/button";
import TreeSelect from "../../../../components/elements/tree_select";
import SearchableSelect from "./SearchableSelect";
import type { CascaderOption } from "../../../../components/elements/cascader";
import { useToast } from "../../../../components/elements/toast";

import { stockCheckService, type CheckStockScheduleCreateInput, type Employee } from "../../../../service/http/wms/stock_check_service";
import { getProductsList } from "../../../../service/http/wms/product";

interface AddCheckStockScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddCheckStockScheduleModal({
  isOpen,
  onClose,
  onSuccess,
}: AddCheckStockScheduleModalProps) {
  const { toast } = useToast();

  const [submitting, setSubmitting] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Form states
  const [scheduledDatetime, setScheduledDatetime] = useState("");
  const [note, setNote] = useState("");
  const [checkType, setCheckType] = useState<"LOCATION" | "CATEGORY" | "PRODUCT">("LOCATION");
  const [userId, setUserId] = useState("");

  // Targets
  const [selectedZonePath, setSelectedZonePath] = useState<string>("");
  const [categoryId, setCategoryId] = useState("");
  const [productId, setProductId] = useState("");

  // Options
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadOptions();
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setScheduledDatetime("");
    setNote("");
    setCheckType("LOCATION");
    setUserId("");
    setSelectedZonePath("");
    setCategoryId("");
    setProductId("");
  };

  const loadOptions = async () => {
    try {
      setLoadingOptions(true);
      const [emps, zns, cats, prods] = await Promise.all([
        stockCheckService.getEmployees(),
        stockCheckService.getZoneTree(),
        stockCheckService.getCategoryTree(),
        getProductsList(),
      ]);
      setEmployees(emps);
      setZones(zns);
      setCategories(cats);
      setProducts(prods);
    } catch (err) {
      console.error(err);
      toast({ variant: "error", message: "ไม่สามารถโหลดข้อมูลตัวเลือกได้" });
    } finally {
      setLoadingOptions(false);
    }
  };

  const buildZoneTree = (): CascaderOption[] => {
    return zones.map((z: any) => ({
      value: `zone-${z.ID || z.id}`,
      label: z.zone_name,
      children: z.shelves?.map((s: any) => ({
        value: `shelf-${s.ID || s.id}`,
        label: s.shelf_name,
        children: s.shelf_levels?.map((l: any) => ({
          value: `level-${l.ID || l.id}`,
          label: l.level_name,
        })),
      })),
    }));
  };

  const buildCategoryTree = (): CascaderOption[] => {
    return categories.map((c: any) => ({
      value: `category-${c.ID || c.id}`,
      label: c.category_name,
      children: c.sub_categories?.map((sc: any) => ({
        value: `subcategory-${sc.ID || sc.id}`,
        label: sc.sub_category_name,
        children: sc.sub_sub_categories?.map((ssc: any) => ({
          value: `subsubcategory-${ssc.ID || ssc.id}`,
          label: ssc.sub_sub_category_name,
        })),
      })),
    }));
  };

  const relatedProducts = useMemo(() => {
    if (checkType === "LOCATION" && selectedZonePath) {
      if (selectedZonePath.startsWith("level-")) {
        const id = parseInt(selectedZonePath.replace("level-", ""));
        let levelName = "";
        zones.forEach((z: any) => z.shelves?.forEach((s: any) => s.shelf_levels?.forEach((l: any) => {
          if ((l.ID || l.id) === id) levelName = l.level_name;
        })));
        return products.filter(p => p.ShelfLevel === levelName);
      } else if (selectedZonePath.startsWith("shelf-")) {
        const id = parseInt(selectedZonePath.replace("shelf-", ""));
        let shelfName = "";
        zones.forEach((z: any) => z.shelves?.forEach((s: any) => {
          if ((s.ID || s.id) === id) shelfName = s.shelf_name;
        }));
        return products.filter(p => p.Shelf === shelfName);
      } else if (selectedZonePath.startsWith("zone-")) {
        const id = parseInt(selectedZonePath.replace("zone-", ""));
        let shelfNames: string[] = [];
        zones.forEach((z: any) => {
          if ((z.ID || z.id) === id) z.shelves?.forEach((s: any) => shelfNames.push(s.shelf_name));
        });
        return products.filter(p => shelfNames.includes(p.Shelf || ""));
      }
    } else if (checkType === "CATEGORY" && categoryId) {
      if (categoryId.startsWith("subsubcategory-")) {
        const id = parseInt(categoryId.replace("subsubcategory-", ""));
        let sscName = "";
        categories.forEach((c: any) => c.sub_categories?.forEach((sc: any) => sc.sub_sub_categories?.forEach((ssc: any) => {
          if ((ssc.ID || ssc.id) === id) sscName = ssc.sub_sub_category_name;
        })));
        return products.filter(p => p.SubSubCategory === sscName);
      } else if (categoryId.startsWith("subcategory-")) {
        const id = parseInt(categoryId.replace("subcategory-", ""));
        let scName = "";
        categories.forEach((c: any) => c.sub_categories?.forEach((sc: any) => {
          if ((sc.ID || sc.id) === id) scName = sc.sub_category_name;
        }));
        return products.filter(p => p.SubCategory === scName);
      } else if (categoryId.startsWith("category-")) {
        const id = parseInt(categoryId.replace("category-", ""));
        let cName = "";
        categories.forEach((c: any) => {
          if ((c.ID || c.id) === id) cName = c.category_name;
        });
        return products.filter(p => p.Category === cName);
      }
    }
    return [];
  }, [checkType, selectedZonePath, categoryId, products, zones, categories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledDatetime || !userId) {
      toast({ variant: "error", message: "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน" });
      return;
    }

    const payload: CheckStockScheduleCreateInput = {
      scheduled_datetime: new Date(scheduledDatetime).toISOString(),
      note,
      check_type: checkType,
      user_id: parseInt(userId),
    };

    if (checkType === "LOCATION") {
      if (!selectedZonePath) {
        toast({ variant: "error", message: "กรุณาเลือกพื้นที่ตรวจสอบ" });
        return;
      }
      if (selectedZonePath.startsWith("level-")) {
        payload.shelf_level_id = parseInt(selectedZonePath.replace("level-", ""));
      }
      if (selectedZonePath.startsWith("shelf-")) {
        payload.shelf_id = parseInt(selectedZonePath.replace("shelf-", ""));
      }
      if (selectedZonePath.startsWith("zone-")) {
        payload.zone_id = parseInt(selectedZonePath.replace("zone-", ""));
      }
    } else if (checkType === "CATEGORY") {
      if (!categoryId) {
        toast({ variant: "error", message: "กรุณาเลือกหมวดหมู่สินค้า" });
        return;
      }
      if (categoryId.startsWith("subsubcategory-")) {
        payload.sub_sub_category_id = parseInt(categoryId.replace("subsubcategory-", ""));
      } else if (categoryId.startsWith("subcategory-")) {
        payload.sub_category_id = parseInt(categoryId.replace("subcategory-", ""));
      } else if (categoryId.startsWith("category-")) {
        payload.category_id = parseInt(categoryId.replace("category-", ""));
      }
    } else if (checkType === "PRODUCT") {
      if (!productId) {
        toast({ variant: "error", message: "กรุณาเลือกสินค้า" });
        return;
      }
      payload.product_id = parseInt(productId);
    }

    try {
      setSubmitting(true);
      await stockCheckService.createSchedule(payload);
      toast({ variant: "success", message: "สร้างตารางเช็คสต็อกสำเร็จ" });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ variant: "error", message: err.response?.data?.error || "เกิดข้อผิดพลาดในการบันทึก" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="สร้างตารางเช็คสต็อกใหม่"
      description="กำหนดวันเวลา พื้นที่เป้าหมาย และพนักงานที่รับผิดชอบ"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            type="datetime-local"
            label="วันที่และเวลาที่กำหนด"
            value={scheduledDatetime}
            onChange={(e) => setScheduledDatetime(e.target.value)}
            required
            disabled={submitting}
          />
          <Select
            label="พนักงานที่รับมอบหมาย"
            options={[
              { label: "เลือกพนักงาน...", value: "" },
              ...employees.map(e => ({ label: e.full_name, value: String(e.id) }))
            ]}
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            required
            disabled={submitting || loadingOptions}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="ประเภทการตรวจสอบ"
            options={[
              { label: "พื้นที่จัดเก็บ (โซน/ชั้นวาง)", value: "LOCATION" },
              { label: "หมวดหมู่สินค้า", value: "CATEGORY" },
              { label: "สินค้ารายตัว", value: "PRODUCT" },
            ]}
            value={checkType}
            onChange={(e) => {
              setCheckType(e.target.value as "LOCATION" | "CATEGORY" | "PRODUCT");
              setSelectedZonePath("");
              setCategoryId("");
              setProductId("");
            }}
            disabled={submitting}
          />

          {checkType === "LOCATION" && (
            <TreeSelect
              label="พื้นที่ตรวจสอบ"
              placeholder="เลือกพื้นที่..."
              options={buildZoneTree()}
              value={selectedZonePath}
              onChange={(val) => setSelectedZonePath(val)}
            />
          )}

          {checkType === "CATEGORY" && (
            <TreeSelect
              label="หมวดหมู่สินค้า"
              placeholder="เลือกหมวดหมู่..."
              options={buildCategoryTree()}
              value={categoryId}
              onChange={(val) => setCategoryId(val)}
            />
          )}

          {checkType === "PRODUCT" && (
            <SearchableSelect
              label="สินค้า"
              options={[
                { label: "เลือกสินค้า...", value: "" },
                ...products.map(p => ({ label: `[${p.ProductCode}] ${p.Name}`, value: String(p.ID) }))
              ]}
              value={productId}
              onChange={(val) => setProductId(val)}
              disabled={submitting || loadingOptions}
            />
          )}
        </div>

        <Input
          label="หมายเหตุ (ถ้ามี)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="รายละเอียดเพิ่มเติมสำหรับการตรวจรอบนี้"
          disabled={submitting}
        />

        {(checkType === "LOCATION" || checkType === "CATEGORY") && relatedProducts.length > 0 && (
          <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-sm">
            <p className="text-sm font-medium text-slate-700 mb-2">
              สินค้าที่เกี่ยวข้อง ({relatedProducts.length} รายการ)
            </p>
            <div className="max-h-32 overflow-y-auto text-xs text-slate-600 flex flex-col gap-1">
              {relatedProducts.slice(0, 10).map(p => (
                <div key={p.ID} className="flex justify-between items-center bg-white p-1.5 border border-slate-100 rounded-sm shadow-sm">
                  <span>[{p.ProductCode}] {p.Name}</span>
                  <span className="text-[#B70011] font-medium">{p.Stock} ชิ้น</span>
                </div>
              ))}
              {relatedProducts.length > 10 && (
                <div className="text-center text-slate-400 pt-1">
                  ... และอีก {relatedProducts.length - 10} รายการ
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-6">
          <Button type="button" variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button type="submit" variant="primary" isLoading={submitting}>
            บันทึกตารางตรวจสอบ
          </Button>
        </div>
      </form>
    </Modal>
  );
}
