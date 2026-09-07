import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import Heading from "../../../../components/elements/heading";
import Breadcrumb from "../../../../components/elements/breadcrumb";
import { Card, CardHeader, CardTitle, CardContent } from "../../../../components/elements/card";
import Input from "../../../../components/elements/input";
import Select from "../../../../components/elements/select";
import Button from "../../../../components/elements/button";
import TreeSelect from "../../../../components/elements/tree_select";
import { ToastProvider, useToast } from "../../../../components/elements/toast";
import { useAlertDialog } from "../../../../components/elements/alert_dialog";
import SearchableSelect from "./SearchableSelect";
import CheckDateTimeRangeField, {
  type CheckDateTimeRangeValue,
  validateCheckDateTimeRange,
  combineDateTime,
} from "./CheckDateTimeRangeField";
import { useCheckStockOptions } from "./useCheckStockOptions";
import { buildZoneTree, buildCategoryTree, getRelatedProducts } from "./checkStockTargets";
import { stockCheckService, type CheckStockScheduleCreateInput } from "../../../../service/http/wms/stock_check_service";

function AddCheckStockScheduleContent() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { alertDialog } = useAlertDialog();
  const { loading: loadingOptions, employees, zones, categories, products } = useCheckStockOptions();

  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [dateTimeRange, setDateTimeRange] = useState<CheckDateTimeRangeValue>({ date: "", startTime: "", endTime: "" });
  const [note, setNote] = useState("");
  const [checkType, setCheckType] = useState<"LOCATION" | "CATEGORY" | "PRODUCT">("LOCATION");
  const [userId, setUserId] = useState("");

  // Targets
  const [selectedZonePath, setSelectedZonePath] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [productId, setProductId] = useState("");

  const relatedProducts = useMemo(
    () => getRelatedProducts(checkType, selectedZonePath, categoryId, products, zones, categories),
    [checkType, selectedZonePath, categoryId, products, zones, categories]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const rangeError = validateCheckDateTimeRange(dateTimeRange);
    if (rangeError) {
      await alertDialog(rangeError);
      return;
    }

    const payload: CheckStockScheduleCreateInput = {
      scheduled_datetime: combineDateTime(dateTimeRange.date, dateTimeRange.startTime).toISOString(),
      scheduled_end_datetime: combineDateTime(dateTimeRange.date, dateTimeRange.endTime).toISOString(),
      note,
      check_type: checkType,
      user_id: userId ? parseInt(userId) : undefined,
    };

    if (checkType === "LOCATION") {
      if (!selectedZonePath) {
        await alertDialog("กรุณาเลือกพื้นที่ตรวจสอบ");
        return;
      }
      if (selectedZonePath.startsWith("level-")) payload.shelf_level_id = parseInt(selectedZonePath.replace("level-", ""));
      if (selectedZonePath.startsWith("shelf-")) payload.shelf_id = parseInt(selectedZonePath.replace("shelf-", ""));
      if (selectedZonePath.startsWith("zone-")) payload.zone_id = parseInt(selectedZonePath.replace("zone-", ""));
    } else if (checkType === "CATEGORY") {
      if (!categoryId) {
        await alertDialog("กรุณาเลือกหมวดหมู่สินค้า");
        return;
      }
      if (categoryId.startsWith("subsubcategory-")) payload.sub_sub_category_id = parseInt(categoryId.replace("subsubcategory-", ""));
      else if (categoryId.startsWith("subcategory-")) payload.sub_category_id = parseInt(categoryId.replace("subcategory-", ""));
      else if (categoryId.startsWith("category-")) payload.category_id = parseInt(categoryId.replace("category-", ""));
    } else if (checkType === "PRODUCT") {
      if (!productId) {
        await alertDialog("กรุณาเลือกสินค้า");
        return;
      }
      payload.product_id = parseInt(productId);
    }

    try {
      setSubmitting(true);
      const res = await stockCheckService.createSchedule(payload);
      toast({ variant: "success", message: "สร้างตารางเช็คสต็อกสำเร็จ" });
      // พาไปหน้ารายละเอียดตารางที่เพิ่งสร้างทันที เพื่อให้เห็น QR Code สำหรับสแกนเช็คสต็อกได้เลย
      navigate(`/owner/stock/stock-check/${res.id}`);
    } catch (err: any) {
      await alertDialog(err.response?.data?.error || "เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen space-y-6 bg-gray-50 p-8 font-sans">
      <Breadcrumb
        items={[
          { label: "ตรวจสอบสินค้า", path: "/owner/stock/stock-check" },
          { label: "สร้างตารางใหม่" },
        ]}
      />

      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <Heading level="h2" weight="semibold" className="mb-0 text-gray-800">
          สร้างตารางเช็คสต็อกใหม่
        </Heading>
        <Heading level="h6" weight="light" className="m-0 mt-1 text-slate-500">
          กำหนดวันเวลา พื้นที่เป้าหมาย และพนักงานที่รับผิดชอบ
        </Heading>
      </div>

      <Card className="border-l-[5px] border-l-red-800">
        <CardHeader>
          <CardTitle className="text-lg">รายละเอียดการตรวจสอบ</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <CheckDateTimeRangeField
              value={dateTimeRange}
              onChange={setDateTimeRange}
              required
              disabled={submitting}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Select
                label="พนักงานที่รับมอบหมาย"
                options={[
                  { label: "ยังไม่มอบหมาย", value: "" },
                  ...employees.map((e) => ({ label: e.full_name, value: String(e.id) })),
                ]}
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                disabled={submitting || loadingOptions}
              />

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
            </div>

            {checkType === "LOCATION" && (
              <TreeSelect
                label="พื้นที่ตรวจสอบ"
                placeholder="เลือกพื้นที่..."
                options={buildZoneTree(zones)}
                value={selectedZonePath}
                onChange={(val) => setSelectedZonePath(val)}
              />
            )}

            {checkType === "CATEGORY" && (
              <TreeSelect
                label="หมวดหมู่สินค้า"
                placeholder="เลือกหมวดหมู่..."
                options={buildCategoryTree(categories)}
                value={categoryId}
                onChange={(val) => setCategoryId(val)}
              />
            )}

            {checkType === "PRODUCT" && (
              <SearchableSelect
                label="สินค้า"
                options={[
                  { label: "เลือกสินค้า...", value: "" },
                  ...products.map((p) => ({
                    label: `[${p.ProductCode}] ${p.Name}`,
                    value: String(p.ID),
                    imageUrl: p.ThumbnailUrl || "",
                  })),
                ]}
                value={productId}
                onChange={(val) => setProductId(val)}
                disabled={submitting || loadingOptions}
              />
            )}

            <Input
              label="หมายเหตุ (ถ้ามี)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="รายละเอียดเพิ่มเติมสำหรับการตรวจรอบนี้"
              disabled={submitting}
            />

            {(checkType === "LOCATION" || checkType === "CATEGORY") && relatedProducts.length > 0 && (
              <div className="mt-4 rounded-sm border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-sm font-medium text-slate-700">
                  สินค้าที่เกี่ยวข้อง ({relatedProducts.length} รายการ)
                </p>
                <div className="flex max-h-48 flex-col gap-1 overflow-y-auto text-xs text-slate-600">
                  {relatedProducts.slice(0, 10).map((p) => (
                    <div
                      key={p.ID}
                      onClick={() => navigate(`/owner/stock/${p.ID}`, { state: { from: "check_stock" } })}
                      className="flex cursor-pointer items-center gap-2 rounded-sm border border-slate-100 bg-white p-1.5 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                      title="ดูรายละเอียดสินค้า"
                    >
                      {p.ThumbnailUrl ? (
                        <img src={p.ThumbnailUrl} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
                      ) : (
                        <div className="h-8 w-8 shrink-0 rounded bg-slate-100" />
                      )}
                      <span className="flex-1 truncate">
                        [{p.ProductCode}] {p.Name}
                      </span>
                      <span className="shrink-0 font-medium text-[#B70011]">{p.Stock} ชิ้น</span>
                    </div>
                  ))}
                  {relatedProducts.length > 10 && (
                    <div className="pt-1 text-center text-slate-400">
                      ... และอีก {relatedProducts.length - 10} รายการ
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button type="button" variant="outline" onClick={() => navigate("/owner/stock/stock-check")} disabled={submitting}>
                ยกเลิก
              </Button>
              <Button type="submit" variant="primary" isLoading={submitting}>
                บันทึกตารางตรวจสอบ
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AddCheckStockSchedulePage() {
  return (
    <ToastProvider position="bottom-right">
      <AddCheckStockScheduleContent />
    </ToastProvider>
  );
}
