import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Save, X } from "lucide-react";
import Modal from "../../../../components/elements/modal";
import Input from "../../../../components/elements/input";
import Select from "../../../../components/elements/select";
import Button from "../../../../components/elements/button";
import TreeSelect from "../../../../components/elements/tree_select";
import SearchableSelect from "./SearchableSelect";
import CheckDateTimeRangeField, {
  type CheckDateTimeRangeValue,
  validateCheckDateTimeRange,
  combineDateTime,
} from "./CheckDateTimeRangeField";
import { useToast } from "../../../../components/elements/toast";
import { useAlertDialog } from "../../../../components/elements/alert_dialog";
import { useCheckStockOptions } from "./useCheckStockOptions";
import { buildZoneTree, buildCategoryTree, getRelatedProducts, isScheduleOverdue } from "./checkStockTargets";
import { cn } from "../../../../utils/component";

import { stockCheckService, type CheckStockScheduleCreateInput, type CheckStockSchedule } from "../../../../service/http/wms/stock_check_service";

interface EditCheckStockScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  schedule: CheckStockSchedule | null;
}

function idsFromPaths(paths: string[], prefix: string): number[] {
  return paths.filter((p) => p.startsWith(prefix)).map((p) => parseInt(p.replace(prefix, "")));
}

export default function EditCheckStockScheduleModal({
  isOpen,
  onClose,
  onSuccess,
  schedule,
}: EditCheckStockScheduleModalProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { alertDialog, confirmDialog } = useAlertDialog();
  const { loading: loadingOptions, employees, zones, categories, products } = useCheckStockOptions();

  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [dateTimeRange, setDateTimeRange] = useState<CheckDateTimeRangeValue>({ date: "", startTime: "", endTime: "" });
  const [note, setNote] = useState("");
  const [checkType, setCheckType] = useState<"LOCATION" | "CATEGORY" | "PRODUCT">("LOCATION");
  const [userId, setUserId] = useState("");

  // Targets — เลือกได้หลายจุดพร้อมกันในการมอบหมายครั้งเดียว
  const [selectedZonePaths, setSelectedZonePaths] = useState<string[]>([]);
  const [categoryPaths, setCategoryPaths] = useState<string[]>([]);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [productPickerValue, setProductPickerValue] = useState("");
  const [excludedProductIds, setExcludedProductIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (isOpen && schedule) {
      setDateTimeRange({
        date: schedule.scheduled_datetime ? schedule.scheduled_datetime.substring(0, 10) : "",
        startTime: schedule.scheduled_datetime ? schedule.scheduled_datetime.substring(11, 16) : "",
        endTime: schedule.scheduled_end_datetime ? schedule.scheduled_end_datetime.substring(11, 16) : "",
      });
      setNote(schedule.note || "");
      setCheckType(schedule.check_type || "LOCATION");
      setUserId(schedule.user_id ? String(schedule.user_id) : "");

      setSelectedZonePaths([
        ...(schedule.shelf_level_ids || []).map((id) => `level-${id}`),
        ...(schedule.shelf_ids || []).map((id) => `shelf-${id}`),
        ...(schedule.zone_ids || []).map((id) => `zone-${id}`),
      ]);
      setCategoryPaths([
        ...(schedule.sub_sub_category_ids || []).map((id) => `subsubcategory-${id}`),
        ...(schedule.sub_category_ids || []).map((id) => `subcategory-${id}`),
        ...(schedule.category_ids || []).map((id) => `category-${id}`),
      ]);
      setProductIds((schedule.product_ids || []).map((id) => String(id)));
      setExcludedProductIds(new Set(schedule.excluded_product_ids || []));
    }
  }, [isOpen, schedule]);

  const relatedProducts = useMemo(
    () => getRelatedProducts(checkType, selectedZonePaths, categoryPaths, products, zones, categories),
    [checkType, selectedZonePaths, categoryPaths, products, zones, categories]
  );

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
    if (!schedule) return;

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

    const confirmed = await confirmDialog(
      "ยืนยันบันทึกการแก้ไขตารางเช็คสต็อกนี้หรือไม่? วัน-เวลา เป้าหมายการตรวจ และพนักงานที่รับผิดชอบจะถูกอัปเดตตามที่กรอกใหม่",
      { title: "ยืนยันการแก้ไขตาราง", confirmText: "บันทึกการแก้ไข", variant: "info", icon: Save }
    );
    if (!confirmed) return;

    try {
      setSubmitting(true);
      await stockCheckService.updateSchedule(schedule.id, payload);
      toast({ variant: "success", message: "แก้ไขตารางเช็คสต็อกสำเร็จ" });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ variant: "error", message: err.response?.data?.error || "เกิดข้อผิดพลาดในการบันทึก" });
    } finally {
      setSubmitting(false);
    }
  };

  // เลยเวลากำหนดแล้ว (ค้างอยู่ที่ "กำลังเช็ค" แต่ไม่ทันภายในเวลาสิ้นสุด) ให้เจ้าของร้านพิจารณาแก้ไข/สั่งงานซ้ำได้
  // เหมือนกับตอนยัง "รอดำเนินการ" — บันทึกแล้วระบบจะเปิดสถานะกลับไป "รอดำเนินการ" ให้เริ่มนับใหม่ (ดู backend Update())
  const overdue = !!schedule && isScheduleOverdue(schedule);
  const isEditable = !schedule || schedule.status === "รอดำเนินการ" || overdue;

  return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={overdue ? "สั่งงานซ้ำ / แก้ไขตารางที่เลยเวลากำหนด" : "แก้ไขตารางเช็คสต็อก"}
        description="กำหนดวันเวลา พื้นที่เป้าหมาย และพนักงานที่รับผิดชอบ"
        size="lg"
      >
      <form onSubmit={handleSubmit} className="space-y-4">
        {overdue ? (
          <div className="p-3 bg-amber-50 text-amber-700 rounded-md text-sm mb-4">
            ตารางนี้เลยเวลาที่กำหนดไว้แล้ว กำหนดวันเวลาใหม่แล้วบันทึก ระบบจะเปิดสถานะกลับไป "รอดำเนินการ" ให้เริ่มนับใหม่อีกครั้ง
          </div>
        ) : !isEditable && (
          <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm mb-4">
            ไม่สามารถแก้ไขตารางที่ถึงกำหนดหรือเสร็จสิ้นไปแล้วได้
          </div>
        )}

        <CheckDateTimeRangeField
          value={dateTimeRange}
          onChange={setDateTimeRange}
          required
          disabled={!isEditable || submitting}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="พนักงานที่รับมอบหมาย"
            options={[
              { label: "ยังไม่มอบหมาย", value: "" },
              ...employees.map(e => ({ label: e.full_name, value: String(e.id) }))
            ]}
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={!isEditable || submitting || loadingOptions}
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
            disabled={!isEditable || submitting}
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
                  .map(p => ({
                    label: `[${p.ProductCode}] ${p.Name}`,
                    value: String(p.ID),
                    imageUrl: p.ThumbnailUrl || "",
                  }))
              ]}
              value={productPickerValue}
              onChange={(val) => {
                if (val) setProductIds((prev) => [...prev, val]);
                setProductPickerValue("");
              }}
              disabled={!isEditable || submitting || loadingOptions}
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
                      onClick={() =>
                        navigate(`/owner/stock/${p.ID}`, {
                          state: { from: "check_stock", scheduleId: schedule?.id, scheduleName: schedule?.target_name, authorizedId: Number(p.ID) },
                        })
                      }
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
                    {isEditable && (
                      <button
                        type="button"
                        onClick={() => setProductIds((prev) => prev.filter((id) => id !== String(p.ID)))}
                        className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-[#B70011]"
                        title="เอาออก"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
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
          disabled={!isEditable || submitting}
        />

        {(checkType === "LOCATION" || checkType === "CATEGORY") && relatedProducts.length > 0 && (
          <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-sm">
            <p className="text-sm font-medium text-slate-700 mb-2">
              สินค้าที่เกี่ยวข้อง ({relatedProducts.length} รายการ)
              {excludedProductIds.size > 0 && (
                <span className="ml-1 font-normal text-slate-500">— เอาออก {excludedProductIds.size} รายการ</span>
              )}
            </p>
            {isEditable && <p className="mb-2 text-xs text-slate-500">ติ๊กออกได้ถ้าไม่ต้องการให้ตรวจสินค้ารายการไหน</p>}
            <div className="max-h-64 overflow-y-auto text-xs text-slate-600 flex flex-col gap-1">
              {relatedProducts.map(p => {
                const excluded = excludedProductIds.has(p.ID);
                return (
                  <label
                    key={p.ID}
                    className={cn(
                      "flex items-center gap-2 bg-white p-1.5 border border-slate-100 rounded-sm shadow-sm transition hover:border-slate-300",
                      isEditable ? "cursor-pointer" : "cursor-default",
                      excluded && "opacity-50"
                    )}
                  >
                    {isEditable && (
                      <input
                        type="checkbox"
                        checked={!excluded}
                        onChange={() => toggleExcluded(p.ID)}
                        className="h-3.5 w-3.5 shrink-0 accent-[#B70011]"
                      />
                    )}
                    <span
                      onClick={(ev) => {
                        ev.preventDefault();
                        navigate(`/owner/stock/${p.ID}`, {
                          state: { from: "check_stock", scheduleId: schedule?.id, scheduleName: schedule?.target_name, authorizedId: Number(p.ID) },
                        });
                      }}
                      className="flex items-center gap-2 flex-1 cursor-pointer"
                      title="ดูรายละเอียดสินค้า"
                    >
                      {p.ThumbnailUrl ? (
                        <img src={p.ThumbnailUrl} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
                      ) : (
                        <div className="h-8 w-8 shrink-0 rounded bg-slate-100" />
                      )}
                      <span className={cn("flex-1 truncate", excluded && "line-through")}>[{p.ProductCode}] {p.Name}</span>
                    </span>
                    <span className="shrink-0 text-[#B70011] font-medium">{p.Stock} ชิ้น</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-6">
          <Button type="button" variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          {isEditable && (
            <Button type="submit" variant="primary" isLoading={submitting}>
              บันทึกตารางตรวจสอบ
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
