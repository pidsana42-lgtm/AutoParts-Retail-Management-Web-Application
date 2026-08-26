import { useState, useEffect, useCallback } from "react";
import { posApiService } from "../../../../service/http/pos/pos_service";
import type { PaymentHistoryItem } from "../../../../interface/pos/payment_interface";
import type { UsePaymentCancellationHistoryReturn } from "../../../../interface/pos/payment_cancellation_interface";
import { useEmployeeOptions } from "../../../../hooks/useEmployeeOptions";
import { useUserRole } from "../../../../hooks/useUserRole";
import { getCurrentUserId } from "../../../../utils/auth";

export const usePaymentCancellationHistory = (): UsePaymentCancellationHistoryReturn => {
  const { isOwnerOrAdmin } = useUserRole();
  const { employeeList } = useEmployeeOptions();
  const [dataList, setDataList] = useState<PaymentHistoryItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Filter States
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [paymentType, setPaymentType] = useState<string>("");
  const [employeeId, setEmployeeId] = useState<string>("");

  // Drawer & Action States
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentHistoryItem | null>(null);
  const [cancelRemark, setCancelRemark] = useState<string>("");
  const [cancelReason, setCancelReason] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const fetchCancellationHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // ดึงข้อมูลประวัติการชำระเงินทั้งหมด
      const res = await posApiService.getPaymentHistory({
        search: searchQuery || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });

      // กรองเฉพาะรายการที่เกี่ยวข้องกับการขอยกเลิก (pending_cancel, cancelled หรือมี cancel_remark)
      let filtered = res.filter((item) => {
        const itemStatus = (item.status || "").toLowerCase();
        const hasRemark = Boolean(item.cancel_remark && item.cancel_remark.trim() !== "");
        return itemStatus === "pending_cancel" || itemStatus === "cancelled" || hasRemark;
      });

      if (status) {
        filtered = filtered.filter((item) => {
          const itemStatus = (item.status || "").toLowerCase();
          if (status.toLowerCase() === "rejected") {
            return itemStatus === "completed" && Boolean(item.cancel_remark && item.cancel_remark.trim() !== "");
          }
          return itemStatus === status.toLowerCase();
        });
      }

      if (paymentType) {
        filtered = filtered.filter((item) => (item.payment_type || "").toLowerCase() === paymentType.toLowerCase());
      }

      if (employeeId) {
        const targetEmp = employeeList.find((e) => e.value === String(employeeId));
        const targetLabel = (targetEmp?.label || "").toLowerCase().trim();

        filtered = filtered.filter((item) => {
          // ใช้ ID ของคนที่แสดงในคอลัมน์ผู้ขอยกเลิก (ถ้ามี cancel_requested_by_id ให้ใช้อันนั้น ถ้าไม่มีให้ใช้ cancelled_by_id)
          const activeRequesterId = item.cancel_requested_by_id ?? item.cancelled_by_id;
          if (activeRequesterId !== undefined && activeRequesterId !== null) {
            if (String(activeRequesterId) === String(employeeId)) return true;
          }

          // Fallback: ตรวจสอบจากชื่อผู้ที่แสดงในคอลัมน์
          const displayName = (item.cancel_requested_by_name || item.cancelled_by_name || "").toLowerCase().trim();
          if (targetLabel && displayName) {
            if (displayName.includes(targetLabel) || targetLabel.includes(displayName)) return true;
          }

          return false;
        });
      }

      setTotalRows(filtered.length);

      // Client-side Pagination
      const startIndex = (page - 1) * limit;
      const paginatedData = filtered.slice(startIndex, startIndex + limit);
      setDataList(paginatedData);
    } catch (err: any) {
      setError(err?.message || "ไม่สามารถโหลดข้อมูลประวัติการยกเลิกได้");
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, searchQuery, startDate, endDate, status, paymentType, employeeId]);

  useEffect(() => {
    fetchCancellationHistory();
  }, [fetchCancellationHistory]);

  const totalPages = Math.ceil(totalRows / limit) || 1;
  const pendingCancelItems = dataList.filter((item) => (item.status || "").toLowerCase() === "pending_cancel");
  const isSelectAll = pendingCancelItems.length > 0 && selectedIds.length === pendingCancelItems.length;

  const handleSelectAll = () => {
    if (isSelectAll) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingCancelItems.map((item) => item.receipt_id));
    }
  };

  const handleSelectRow = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSearch = () => {
    setPage(1);
    fetchCancellationHistory();
  };

  // Actions สำหรับ Drawer
  const handleApproveCancel = async () => {
    if (!selectedReceipt) return;
    setIsProcessing(true);
    try {
      await posApiService.approveCancelPaymentReceipt(selectedReceipt.receipt_id, {
        remark: cancelRemark,
      });
      alert("อนุมัติการยกเลิกใบเสร็จและคืนยอดหนี้เรียบร้อยแล้ว");
      setSelectedReceipt(null);
      setCancelRemark("");
      fetchCancellationHistory();
    } catch (err: any) {
      alert(err?.response?.data?.error || "เกิดข้อผิดพลาดในการอนุมัติ");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectCancel = async () => {
    if (!selectedReceipt) return;
    setIsProcessing(true);
    try {
      await posApiService.rejectCancelPaymentReceipt(selectedReceipt.receipt_id, {
        remark: cancelRemark,
      });
      alert("ปฏิเสธคำขอยกเลิกเรียบร้อยแล้ว");
      setSelectedReceipt(null);
      setCancelRemark("");
      fetchCancellationHistory();
    } catch (err: any) {
      alert(err?.response?.data?.error || "เกิดข้อผิดพลาดในการปฏิเสธ");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRevertCancel = async () => {
    if (!selectedReceipt) return;
    setIsProcessing(true);
    try {
      await posApiService.revertCancelPaymentReceiptRequest(selectedReceipt.receipt_id);
      alert("ดึงคำขอยกเลิกกลับเรียบร้อยแล้ว");
      setSelectedReceipt(null);
      fetchCancellationHistory();
    } catch (err: any) {
      alert(err?.response?.data?.error || "เกิดข้อผิดพลาดในการดึงคำขอกลับ");
    } finally {
      setIsProcessing(false);
    }
  };

  // Actions สำหรับ Batch Operations
  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`ยืนยันอนุมัติการยกเลิกใบเสร็จที่เลือกจำนวน ${selectedIds.length} รายการ?`)) return;
    setIsProcessing(true);
    try {
      for (const id of selectedIds) {
        await posApiService.approveCancelPaymentReceipt(id, { remark: "อนุมัติยกเลิกแบบกลุ่ม" });
      }
      alert(`อนุมัติการยกเลิกเรียบร้อยแล้ว ${selectedIds.length} รายการ`);
      setSelectedIds([]);
      fetchCancellationHistory();
    } catch (err: any) {
      alert(err?.response?.data?.error || "เกิดข้อผิดพลาดในการอนุมัติแบบกลุ่ม");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBatchReject = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`ยืนยันปฏิเสธคำขอยกเลิกใบเสร็จที่เลือกจำนวน ${selectedIds.length} รายการ?`)) return;
    setIsProcessing(true);
    try {
      for (const id of selectedIds) {
        await posApiService.rejectCancelPaymentReceipt(id, { remark: "ข้อความอัตโนมัติ ปฏิเสธคำขอยกเลิก" });
      }
      alert(`ปฏิเสธคำขอยกเลิกเรียบร้อยแล้ว ${selectedIds.length} รายการ`);
      setSelectedIds([]);
      fetchCancellationHistory();
    } catch (err: any) {
      alert(err?.response?.data?.error || "เกิดข้อผิดพลาดในการปฏิเสธแบบกลุ่ม");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBatchRevert = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`ยืนยันดึงคำขอยกเลิกกลับ (กู้คืนคำขอ) จำนวน ${selectedIds.length} รายการ?`)) return;
    setIsProcessing(true);
    try {
      for (const id of selectedIds) {
        await posApiService.revertCancelPaymentReceiptRequest(id);
      }
      alert(`ดึงคำขอยกเลิกกลับเรียบร้อยแล้ว ${selectedIds.length} รายการ`);
      setSelectedIds([]);
      fetchCancellationHistory();
    } catch (err: any) {
      alert(err?.response?.data?.error || "เกิดข้อผิดพลาดในการดึงคำขอกลับ");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResubmitCancel = async () => {
    if (!selectedReceipt) return;
    const reason = cancelReason.trim();
    if (!reason) {
      alert("กรุณาระบุเหตุผลในการขอยกเลิกรายการ");
      return;
    }

    setIsProcessing(true);
    try {
      if (isOwnerOrAdmin) {
        await posApiService.cancelPaymentReceipt(selectedReceipt.receipt_id, {
          cancelled_by_id: getCurrentUserId() || 1,
          reason: reason,
          payment_type: selectedReceipt.payment_type,
        });
        alert("ยกเลิกรายการรับชำระเงินและคืนยอดหนี้เรียบร้อยแล้ว");
      } else {
        await posApiService.requestCancelPaymentReceipt(selectedReceipt.receipt_id, {
          reason: reason,
        });
        alert("ยื่นคำขอยกเลิกใบเสร็จรับเงินใหม่อีกครั้งเรียบร้อยแล้ว");
      }

      setSelectedReceipt(null);
      setCancelReason("");
      fetchCancellationHistory();
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.response?.data?.message || "เกิดข้อผิดพลาดในการดำเนินการ");
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    dataList,
    selectedIds,
    isSelectAll,
    isLoading,
    error,
    page,
    limit,
    totalRows,
    totalPages,
    setPage,
    setLimit,
    searchQuery,
    setSearchQuery,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    status,
    setStatus,
    paymentType,
    setPaymentType,
    employeeId,
    setEmployeeId,
    handleSelectAll,
    handleSelectRow,
    handleSearch,
    refetch: fetchCancellationHistory,
    selectedReceipt,
    setSelectedReceipt,
    cancelRemark,
    setCancelRemark,
    cancelReason,
    setCancelReason,
    isProcessing,
    handleApproveCancel,
    handleRejectCancel,
    handleRevertCancel,
    handleResubmitCancel,
    handleBatchApprove,
    handleBatchReject,
    handleBatchRevert,
  };
};