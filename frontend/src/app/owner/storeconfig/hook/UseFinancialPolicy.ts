import { useState, useEffect, useCallback, useMemo } from "react";
import { posApiService } from "../../../../service/http/pos/pos_service";
import type {
  FinancialPolicyConfig,
  UseFinancialPolicyReturn,
} from "../../../../interface/storeconfig/financial_policy_interface";

export const useFinancialPolicy = (): UseFinancialPolicyReturn => {
  const [config, setConfig] = useState<FinancialPolicyConfig>({
    max_credit: 0,
    max_overdue_days: 0,
    max_extra_discount_rate: 0,
    supervised_pin: "1234",
  });

  const [initialConfig, setInitialConfig] = useState<FinancialPolicyConfig>({
    max_credit: 0,
    max_overdue_days: 0,
    max_extra_discount_rate: 0,
    supervised_pin: "1234",
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showAuditModal, setShowAuditModal] = useState<boolean>(false);

  // ดึงข้อมูลตั้งค่าร้านค้าจริงจาก Backend API
  const fetchConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await posApiService.getStoreConfig();
      if (data) {
        const loaded: FinancialPolicyConfig = {
          max_credit: Number(data.max_credit) || 0,
          max_overdue_days: Number(data.max_overdue_days) || 0,
          max_extra_discount_rate: Number(data.max_extra_discount_rate) || 0,
          supervised_pin: data.supervised_pin || "1234",
        };
        setConfig(loaded);
        setInitialConfig(loaded);
      }
    } catch (err: any) {
      console.error("Failed to load store config:", err);
      setError(err?.response?.data?.message || "ไม่สามารถโหลดข้อมูลการตั้งค่านโยบายได้");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // ตรวจสอบว่ามีการแก้ไขข้อมูลที่ยังไม่ได้บันทึกหรือไม่
  const isDirty = useMemo(() => {
    return (
      config.max_credit !== initialConfig.max_credit ||
      config.max_overdue_days !== initialConfig.max_overdue_days ||
      config.max_extra_discount_rate !== initialConfig.max_extra_discount_rate
    );
  }, [config, initialConfig]);

  // จัดการการเปลี่ยนค่าในฟอร์ม
  const handleChange = (field: keyof FinancialPolicyConfig, value: any) => {
    setConfig((prev) => ({
      ...prev,
      [field]: field === "supervised_pin" ? String(value) : Number(value) || 0,
    }));
    if (successMessage) setSuccessMessage(null);
    if (error) setError(null);
  };

  // คืนค่าเดิมก่อนแก้ไข
  const handleReset = () => {
    setConfig(initialConfig);
    setError(null);
    setSuccessMessage(null);
  };

  // บันทึกการเปลี่ยนแปลง
  const handleSave = async (): Promise<boolean> => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      // Validation
      if (config.max_extra_discount_rate < 0 || config.max_extra_discount_rate > 100) {
        setError("เพดานส่วนลดต้องอยู่ระหว่าง 0 - 100%");
        return false;
      }

      if (config.max_credit < 0) {
        setError("วงเงินเครดิตต้องไม่ติดลบ");
        return false;
      }

      if (config.max_overdue_days < 0) {
        setError("ระยะเวลาค้างชำระต้องไม่ติดลบ");
        return false;
      }

      const payload = {
        max_credit: config.max_credit,
        max_overdue_days: config.max_overdue_days,
        max_extra_discount_rate: config.max_extra_discount_rate,
        max_item_discount_rate: config.max_extra_discount_rate,
        supervised_pin: config.supervised_pin || "1234",
      };

      try {
        await posApiService.updateStoreConfig(payload);
      } catch (updateErr) {
        // Fallback ไปใช้ POST หากยังไม่เคยมี row ในฐานข้อมูล
        await posApiService.createStoreConfig(payload);
      }

      setInitialConfig(config);

      // บันทึกลง Audit Log ใน localStorage
      try {
        const historyKey = "financial_policy_audit_logs";
        const existingLogs = JSON.parse(localStorage.getItem(historyKey) || "[]");
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        const userName = user.first_name || user.username || "เจ้าของร้าน";

        const newLog = {
          id: Date.now(),
          action: "แก้ไขการตั้งค่านโยบายการเงินและเครดิต",
          details: `ส่วนลดสูงสุด: ${config.max_extra_discount_rate}%, วงเงินเครดิต: ฿${config.max_credit.toLocaleString("th-TH")}, ระยะเวลาค้างชำระ: ${config.max_overdue_days} วัน`,
          changed_by: userName,
          changed_at: new Date().toISOString(),
        };

        localStorage.setItem(historyKey, JSON.stringify([newLog, ...existingLogs.slice(0, 49)]));
      } catch (e) {
        console.error("Failed to save audit log", e);
      }

      setSuccessMessage("บันทึกการตั้งค่านโยบายเรียบร้อยแล้ว");
      return true;
    } catch (err: any) {
      console.error("Failed to update store config:", err);
      setError(err?.response?.data?.message || err?.response?.data?.error || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    config,
    isLoading,
    isSaving,
    isDirty,
    error,
    successMessage,
    showAuditModal,
    setShowAuditModal,
    handleChange,
    handleReset,
    handleSave,
    refetch: fetchConfig,
  };
};
