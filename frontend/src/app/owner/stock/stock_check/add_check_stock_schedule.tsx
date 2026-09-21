import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";

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
import { cn } from "../../../../utils/component";

function idsFromPaths(paths: string[], prefix: string): number[] {
  return paths.filter((p) => p.startsWith(prefix)).map((p) => parseInt(p.replace(prefix, "")));
}

// ร่างข้อมูลที่กรอกไว้ค้างใน sessionStorage — กันข้อมูลหายตอนกด "ดูรายละเอียดสินค้า" แล้วย้อนกลับมาผ่านเกล็ดขนมปัง
// (เปลี่ยนหน้าไปหน้ารายละเอียดสินค้าจริงๆ ทำให้ component หน้านี้ unmount ค่าใน useState หายหมด ต้องพักไว้ที่นี่ก่อน)
// เคลียร์ทิ้งตอนบันทึกสำเร็จ หรือกดยกเลิกเอง — ไม่งั้นจะมีร่างเก่าค้างมาโผล่ตอนเข้าหน้าสร้างใหม่ครั้งต่อไปแบบไม่ได้ตั้งใจ
const DRAFT_STORAGE_KEY = "check_stock_schedule_draft";

interface ScheduleDraft {
  dateTimeRange: CheckDateTimeRangeValue;
  note: string;
  checkType: "LOCATION" | "CATEGORY" | "PRODUCT";
  userId: string;
  selectedZonePaths: string[];
  categoryPaths: string[];
  productIds: string[];
  excludedProductIds: number[];
}

function loadDraft(): ScheduleDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ScheduleDraft) : null;
  } catch {
    return null;
  }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // ignore — เก็บร่างไม่ได้ก็แค่ไม่มีร่างให้กู้ ไม่ใช่ error ที่ต้องบล็อกผู้ใช้
  }
}

function AddCheckStockScheduleContent() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { alertDialog } = useAlertDialog();
  const { loading: loadingOptions, employees, zones, categories, products } = useCheckStockOptions();

  const [submitting, setSubmitting] = useState(false);

  const draft = useMemo(() => loadDraft(), []);

  // Form states
  const [dateTimeRange, setDateTimeRange] = useState<CheckDateTimeRangeValue>(
    draft?.dateTimeRange || { date: "", startTime: "", endTime: "" }
  );
  const [note, setNote] = useState(draft?.note || "");
  const [checkType, setCheckType] = useState<"LOCATION" | "CATEGORY" | "PRODUCT">(draft?.checkType || "LOCATION");
  const [userId, setUserId] = useState(draft?.userId || "");

  // Targets — เลือกได้หลายจุดพร้อมกันในการมอบหมายครั้งเดียว (เช่น หลายโซน/หลายหมวดหมู่/หลายสินค้ารายตัว)
  const [selectedZonePaths, setSelectedZonePaths] = useState<string[]>(draft?.selectedZonePaths || []);
  const [categoryPaths, setCategoryPaths] = useState<string[]>(draft?.categoryPaths || []);
  const [productIds, setProductIds] = useState<string[]>(draft?.productIds || []);
  const [productPickerValue, setProductPickerValue] = useState("");
  // สินค้าที่เอาออกจากรายการที่ระบบหามาให้อัตโนมัติ (เฉพาะ LOCATION/CATEGORY)
  const [excludedProductIds, setExcludedProductIds] = useState<Set<number>>(new Set(draft?.excludedProductIds || []));

  // บันทึกร่างทุกครั้งที่กรอก/เลือกอะไรเปลี่ยนไป
  useEffect(() => {
    const nextDraft: ScheduleDraft = {
      dateTimeRange,
      note,
      checkType,
      userId,
      selectedZonePaths,
      categoryPaths,
      productIds,
      excludedProductIds: Array.from(excludedProductIds),
    };
    try {
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(nextDraft));
    } catch {
      // ignore
    }
  }, [dateTimeRange, note, checkType, userId, selectedZonePaths, categoryPaths, productIds, excludedProductIds]);

  const relatedProducts = useMemo(
    () => getRelatedProducts(checkType, selectedZonePaths, categoryPaths, products, zones, categories),
    [checkType, selectedZonePaths, categoryPaths, products, zones, categories]
  );

  // ตัดสินค้าที่เอาออกไว้ทิ้ง ถ้าไม่อยู่ในรายการที่เกี่ยวข้องแล้ว (เปลี่ยนเป้าหมายใหม่ ไม่ให้ค่าเก่าค้าง)
  useEffect(() => {
    setExcludedProductIds((prev) => {
      if (prev.size === 0) return prev;
      const relatedIds = new Set(relatedProducts.map((p) => p.ID));
      const next = new Set([...prev].filter((id) => relatedIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [relatedProducts]);

  const selectedProducts = useMemo(
    () => productIds.map((id) => products.find((p) => String(p.ID) === id)).filter((p): p is (typeof products)[number] => !!p),
    [productIds, products]
  );

  const toggleExcluded = (productId: number) => {
    setExcludedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const rangeError = validateCheckDateTimeRange(dateTimeRange);
    if (rangeError) {
      await alertDialog(rangeError);
      return;
    }

    if (!userId) {
      await alertDialog("กรุณาเลือกพนักงานที่รับมอบหมายก่อนบันทึก");
      return;
    }

    const payload: CheckStockScheduleCreateInput = {
      scheduled_datetime: combineDateTime(dateTimeRange.date, dateTimeRange.startTime).toISOString(),
      scheduled_end_datetime: combineDateTime(dateTimeRange.date, dateTimeRange.endTime).toISOString(),
      note,
      check_type: checkType,
      user_id: parseInt(userId),
    };

    if (checkType === "LOCATION") {
      if (selectedZonePaths.length === 0) {
        await alertDialog("กรุณาเลือกพื้นที่ตรวจสอบอย่างน้อย 1 จุด");
        return;
      }
      payload.shelf_level_ids = idsFromPaths(selectedZonePaths, "level-");
      payload.shelf_ids = idsFromPaths(selectedZonePaths, "shelf-");
      payload.zone_ids = idsFromPaths(selectedZonePaths, "zone-");
      payload.excluded_product_ids = Array.from(excludedProductIds);
    } else if (checkType === "CATEGORY") {
      if (categoryPaths.length === 0) {
        await alertDialog("กรุณาเลือกหมวดหมู่สินค้าอย่างน้อย 1 หมวด");
        return;
      }
      payload.sub_sub_category_ids = idsFromPaths(categoryPaths, "subsubcategory-");
      payload.sub_category_ids = idsFromPaths(categoryPaths, "subcategory-");
      payload.category_ids = idsFromPaths(categoryPaths, "category-");
      payload.excluded_product_ids = Array.from(excludedProductIds);
    } else if (checkType === "PRODUCT") {
      if (productIds.length === 0) {
        await alertDialog("กรุณาเลือกสินค้าอย่างน้อย 1 รายการ");
        return;
      }
      payload.product_ids = productIds.map((id) => parseInt(id));
    }

    try {
      setSubmitting(true);
      const res = await stockCheckService.createSchedule(payload);
      toast({ variant: "success", message: "สร้างตารางเช็คสต็อกสำเร็จ" });
      clearDraft();
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
                required
                options={[
                  { label: "เลือกพนักงาน...", value: "" },
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
                  setSelectedZonePaths([]);
                  setCategoryPaths([]);
                  setProductIds([]);
                  setExcludedProductIds(new Set());
                }}
                disabled={submitting}
              />
            </div>

            {checkType === "LOCATION" && (
              <TreeSelect
                label="พื้นที่ตรวจสอบ (เลือกได้หลายจุด)"
                placeholder="เลือกพื้นที่..."
                options={buildZoneTree(zones)}
                multiple
                values={selectedZonePaths}
                onChangeValues={setSelectedZonePaths}
              />
            )}

            {checkType === "CATEGORY" && (
              <TreeSelect
                label="หมวดหมู่สินค้า (เลือกได้หลายหมวด)"
                placeholder="เลือกหมวดหมู่..."
                options={buildCategoryTree(categories)}
                multiple
                values={categoryPaths}
                onChangeValues={setCategoryPaths}
              />
            )}

            {checkType === "PRODUCT" && (
              <div className="space-y-2">
                <SearchableSelect
                  label="สินค้า (เลือกได้หลายรายการ)"
                  options={[
                    { label: "เลือกสินค้าเพื่อเพิ่ม...", value: "" },
                    ...products
                      .filter((p) => !productIds.includes(String(p.ID)))
                      .map((p) => ({
                        label: `[${p.ProductCode}] ${p.Name}`,
                        value: String(p.ID),
                        imageUrl: p.ThumbnailUrl || "",
                      })),
                  ]}
                  value={productPickerValue}
                  onChange={(val) => {
                    if (val) setProductIds((prev) => [...prev, val]);
                    setProductPickerValue("");
                  }}
                  disabled={submitting || loadingOptions}
                />

                {selectedProducts.length > 0 && (
                  <div className="flex flex-col gap-1 rounded-sm border border-slate-200 bg-slate-50 p-2">
                    {selectedProducts.map((p) => (
                      <div
                        key={p.ID}
                        className="flex items-center gap-2 rounded-sm border border-slate-100 bg-white p-1.5 text-xs shadow-sm"
                      >
                        <button
                          type="button"
                          onClick={() => navigate(`/owner/stock/${p.ID}`, { state: { from: "check_stock_new" } })}
                          className="flex flex-1 items-center gap-2 overflow-hidden text-left cursor-pointer"
                          title="ดูรายละเอียดสินค้า"
                        >
                          {p.ThumbnailUrl ? (
                            <img src={p.ThumbnailUrl} alt="" className="h-7 w-7 shrink-0 rounded object-cover" />
                          ) : (
                            <div className="h-7 w-7 shrink-0 rounded bg-slate-100" />
                          )}
                          <span className="flex-1 truncate">
                            [{p.ProductCode}] {p.Name}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setProductIds((prev) => prev.filter((id) => id !== String(p.ID)))}
                          className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-[#B70011]"
                          title="เอาออก"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
                  {excludedProductIds.size > 0 && (
                    <span className="ml-1 font-normal text-slate-500">— เอาออก {excludedProductIds.size} รายการ</span>
                  )}
                </p>
                <p className="mb-2 text-xs text-slate-500">ติ๊กออกได้ถ้าไม่ต้องการให้ตรวจสินค้ารายการไหน</p>
                <div className="flex max-h-64 flex-col gap-1 overflow-y-auto text-xs text-slate-600">
                  {relatedProducts.map((p) => {
                    const excluded = excludedProductIds.has(p.ID);
                    return (
                      <label
                        key={p.ID}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-sm border border-slate-100 bg-white p-1.5 shadow-sm transition hover:border-slate-300",
                          excluded && "opacity-50"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={!excluded}
                          onChange={() => toggleExcluded(p.ID)}
                          className="h-3.5 w-3.5 shrink-0 accent-[#B70011]"
                        />
                        <span
                          onClick={(ev) => {
                            ev.preventDefault();
                            navigate(`/owner/stock/${p.ID}`, { state: { from: "check_stock_new" } });
                          }}
                          className="flex flex-1 items-center gap-2 overflow-hidden cursor-pointer"
                          title="ดูรายละเอียดสินค้า"
                        >
                          {p.ThumbnailUrl ? (
                            <img src={p.ThumbnailUrl} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
                          ) : (
                            <div className="h-8 w-8 shrink-0 rounded bg-slate-100" />
                          )}
                          <span className={cn("flex-1 truncate", excluded && "line-through")}>
                            [{p.ProductCode}] {p.Name}
                          </span>
                        </span>
                        <span className="shrink-0 font-medium text-[#B70011]">{p.Stock} ชิ้น</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  clearDraft();
                  navigate("/owner/stock/stock-check");
                }}
                disabled={submitting}
              >
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
