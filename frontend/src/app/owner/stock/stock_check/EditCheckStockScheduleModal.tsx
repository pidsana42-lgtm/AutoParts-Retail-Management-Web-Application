import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Save } from "lucide-react";
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
import { buildZoneTree, buildCategoryTree, getRelatedProducts } from "./checkStockTargets";

import { stockCheckService, type CheckStockScheduleCreateInput, type CheckStockSchedule } from "../../../../service/http/wms/stock_check_service";

interface EditCheckStockScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  schedule: CheckStockSchedule | null;
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

  // Targets
  const [selectedZonePath, setSelectedZonePath] = useState<string>("");
  const [categoryId, setCategoryId] = useState("");
  const [productId, setProductId] = useState("");

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

      if (schedule.check_type === "LOCATION") {
        if (schedule.shelf_level_id) {
          setSelectedZonePath(`level-${schedule.shelf_level_id}`);
        } else if (schedule.shelf_id) {
          setSelectedZonePath(`shelf-${schedule.shelf_id}`);
        } else if (schedule.zone_id) {
          setSelectedZonePath(`zone-${schedule.zone_id}`);
        }
      } else if (schedule.check_type === "CATEGORY") {
        if (schedule.sub_sub_category_id) {
          setCategoryId(`subsubcategory-${schedule.sub_sub_category_id}`);
        } else if (schedule.sub_category_id) {
          setCategoryId(`subcategory-${schedule.sub_category_id}`);
        } else if (schedule.category_id) {
          setCategoryId(`category-${schedule.category_id}`);
        }
      } else if (schedule.check_type === "PRODUCT") {
        setProductId(schedule.product_id ? String(schedule.product_id) : "");
      }
    }
  }, [isOpen, schedule]);

  const relatedProducts = useMemo(
    () => getRelatedProducts(checkType, selectedZonePath, categoryId, products, zones, categories),
    [checkType, selectedZonePath, categoryId, products, zones, categories]
  );

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
      if (!selectedZonePath) {
        await alertDialog("กรุณาเลือกพื้นที่ตรวจสอบ");
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
        await alertDialog("กรุณาเลือกหมวดหมู่สินค้า");
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
        await alertDialog("กรุณาเลือกสินค้า");
        return;
      }
      payload.product_id = parseInt(productId);
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

  const isEditable = !schedule || schedule.status === "รอดำเนินการ";

  return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="แก้ไขตารางเช็คสต็อก"
        description="กำหนดวันเวลา พื้นที่เป้าหมาย และพนักงานที่รับผิดชอบ"
        size="lg"
      >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isEditable && (
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
              setSelectedZonePath("");
              setCategoryId("");
              setProductId("");
            }}
            disabled={!isEditable || submitting}
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
              ...products.map(p => ({
                label: `[${p.ProductCode}] ${p.Name}`,
                value: String(p.ID),
                imageUrl: p.ThumbnailUrl || "",
              }))
            ]}
            value={productId}
            onChange={(val) => setProductId(val)}
            disabled={!isEditable || submitting || loadingOptions}
          />
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
            </p>
            <div className="max-h-48 overflow-y-auto text-xs text-slate-600 flex flex-col gap-1">
              {relatedProducts.slice(0, 10).map(p => (
                <div
                  key={p.ID}
                  onClick={() =>
                    navigate(`/owner/stock/${p.ID}`, {
                      state: {
                        from: "check_stock",
                        scheduleId: schedule?.id,
                        scheduleName: schedule?.target_name,
                      },
                    })
                  }
                  className="flex cursor-pointer items-center gap-2 bg-white p-1.5 border border-slate-100 rounded-sm shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                  title="ดูรายละเอียดสินค้า"
                >
                  {p.ThumbnailUrl ? (
                    <img src={p.ThumbnailUrl} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
                  ) : (
                    <div className="h-8 w-8 shrink-0 rounded bg-slate-100" />
                  )}
                  <span className="flex-1 truncate">[{p.ProductCode}] {p.Name}</span>
                  <span className="shrink-0 text-[#B70011] font-medium">{p.Stock} ชิ้น</span>
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
