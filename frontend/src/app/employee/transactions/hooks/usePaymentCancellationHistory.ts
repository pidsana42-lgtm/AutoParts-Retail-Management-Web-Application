import { useState, useEffect, useCallback } from "react";
import { RotateCcw, CheckCircle2, XCircle } from "lucide-react";
import { posApiService } from "../../../../service/http/pos/pos_service";
import type { PaymentHistoryItem } from "../../../../interface/pos/payment_interface";
import type {
  UsePaymentCancellationHistoryReturn,
  PaymentCancellationConfirmDialogState,
} from "../../../../interface/pos/payment_cancellation_interface";
import { useEmployeeOptions } from "../../../../hooks/useEmployeeOptions";
import { useUserRole } from "../../../../hooks/useUserRole";
import { getCurrentUserId } from "../../../../utils/auth";
import { useToast } from "../../../../components/elements/toast";

export const usePaymentCancellationHistory = (): UsePaymentCancellationHistoryReturn => {
  const { toast } = useToast();
  const { isOwnerOrManager } = useUserRole();
  const { employeeList } = useEmployeeOptions();
  const [dataList, setDataList] = useState<PaymentHistoryItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // --- Overall Stats State ---
  const [ownerStats, setOwnerStats] = useState({
    pendingCount: 0,
    pendingAmount: 0,
    approvedCount: 0,
    approvedAmount: 0,
    rejectedCount: 0,
    rejectedAmount: 0,
    totalCount: 0,
    totalAmount: 0,
  });

  const [employeeStats, setEmployeeStats] = useState({
    totalCount: 0,
    totalAmount: 0,
    pendingCount: 0,
    pendingAmount: 0,
    approvedCount: 0,
    approvedAmount: 0,
    rejectedCount: 0,
    rejectedAmount: 0,
  });

  const [isStatsLoading, setIsStatsLoading] = useState<boolean>(false);

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

  // Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<PaymentCancellationConfirmDialogState>({
    isOpen: false,
    title: "",
    description: "",
    confirmText: "ยืนยัน",
    variant: "danger",
    onConfirm: () => {},
  });

  const closeConfirmDialog = useCallback(() => {
    if (!isProcessing) {
      setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
    }
  }, [isProcessing]);

  // --- ดึงสถิติภาพรวมทั้งหมด (Overall Summary ไม่ขึ้นกับตัวกรอง) ---
  const fetchOverallStats = useCallback(async () => {
    try {
      setIsStatsLoading(true);
      const res = await posApiService.getPaymentHistory({});
      const currentUserId = getCurrentUserId();

      // กรองเฉพาะรายการที่เกี่ยวข้องกับการขอยกเลิก (pending_cancel, cancelled หรือมี cancel_remark)
      const allCancellationItems = res.filter((item) => {
        const itemStatus = (item.status || "").toLowerCase();
        const hasRemark = Boolean(item.cancel_remark && item.cancel_remark.trim() !== "");
        return itemStatus === "pending_cancel" || itemStatus === "cancelled" || hasRemark;
      });

      // 1. Owner Stats (ทุกรายการของร้าน)
      let oPendingCount = 0, oPendingAmount = 0;
      let oApprovedCount = 0, oApprovedAmount = 0;
      let oRejectedCount = 0, oRejectedAmount = 0;
      let oTotalCount = 0, oTotalAmount = 0;

      // 2. Employee Stats (เฉพาะรายการของพนักงานตนเอง)
      let ePendingCount = 0, ePendingAmount = 0;
      let eApprovedCount = 0, eApprovedAmount = 0;
      let eRejectedCount = 0, eRejectedAmount = 0;
      let eTotalCount = 0, eTotalAmount = 0;

      for (const item of allCancellationItems) {
        const amount = Number(item.total_received) || 0;
        const itemStatus = (item.status || "").toLowerCase();
        const hasRemark = Boolean(item.cancel_remark && item.cancel_remark.trim() !== "");

        oTotalCount++;
        oTotalAmount += amount;

        const isPending = itemStatus === "pending_cancel";
        const isApproved = itemStatus === "cancelled";
        const isRejected = itemStatus === "completed" && hasRemark;

        if (isPending) {
          oPendingCount++;
          oPendingAmount += amount;
        } else if (isApproved) {
          oApprovedCount++;
          oApprovedAmount += amount;
        } else if (isRejected) {
          oRejectedCount++;
          oRejectedAmount += amount;
        }

        // เช็คว่าเป็นรายการของพนักงานคนนี้หรือไม่
        const activeRequesterId = item.cancel_requested_by_id ?? item.cancelled_by_id ?? item.received_by_id;
        const isMy = activeRequesterId !== undefined && activeRequesterId !== null && activeRequesterId !== 0
          ? Number(activeRequesterId) === Number(currentUserId)
          : true;

        if (isMy) {
          eTotalCount++;
          eTotalAmount += amount;

          if (isPending) {
            ePendingCount++;
            ePendingAmount += amount;
          } else if (isApproved) {
            eApprovedCount++;
            eApprovedAmount += amount;
          } else if (isRejected) {
            eRejectedCount++;
            eRejectedAmount += amount;
          }
        }
      }

      setOwnerStats({
        pendingCount: oPendingCount,
        pendingAmount: oPendingAmount,
        approvedCount: oApprovedCount,
        approvedAmount: oApprovedAmount,
        rejectedCount: oRejectedCount,
        rejectedAmount: oRejectedAmount,
        totalCount: oTotalCount,
        totalAmount: oTotalAmount,
      });

      setEmployeeStats({
        totalCount: eTotalCount,
        totalAmount: eTotalAmount,
        pendingCount: ePendingCount,
        pendingAmount: ePendingAmount,
        approvedCount: eApprovedCount,
        approvedAmount: eApprovedAmount,
        rejectedCount: eRejectedCount,
        rejectedAmount: eRejectedAmount,
      });
    } catch (err) {
      console.error("Failed to fetch overall payment cancellation stats:", err);
    } finally {
      setIsStatsLoading(false);
    }
  }, []);

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

  useEffect(() => {
    fetchOverallStats();
  }, [fetchOverallStats]);

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
      toast({ variant: "success", message: "อนุมัติการยกเลิกใบเสร็จและคืนยอดหนี้เรียบร้อยแล้ว" });
      setSelectedReceipt(null);
      setCancelRemark("");
      fetchCancellationHistory();
      fetchOverallStats();
    } catch (err: any) {
      toast({ variant: "error", message: err?.response?.data?.error || "เกิดข้อผิดพลาดในการอนุมัติ" });
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
      toast({ variant: "success", message: "ปฏิเสธคำขอยกเลิกเรียบร้อยแล้ว" });
      setSelectedReceipt(null);
      setCancelRemark("");
      fetchCancellationHistory();
      fetchOverallStats();
    } catch (err: any) {
      toast({ variant: "error", message: err?.response?.data?.error || "เกิดข้อผิดพลาดในการปฏิเสธ" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRevertCancel = () => {
    if (!selectedReceipt) return;
    setConfirmDialog({
      isOpen: true,
      title: "ยืนยันการดึงคำขอยกเลิกกลับ",
      description: "คุณต้องการดึงคำขอยกเลิกใบเสร็จนี้กลับใช่หรือไม่?",
      confirmText: "ดึงคำขอยกเลิก",
      variant: "danger",
      icon: RotateCcw,
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          await posApiService.revertCancelPaymentReceiptRequest(selectedReceipt.receipt_id);
          toast({ variant: "success", message: "ดึงคำขอยกเลิกกลับเรียบร้อยแล้ว" });
          setSelectedReceipt(null);
          fetchCancellationHistory();
          fetchOverallStats();
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        } catch (err: any) {
          toast({ variant: "error", message: err?.response?.data?.error || "เกิดข้อผิดพลาดในการดึงคำขอกลับ" });
        } finally {
          setIsProcessing(false);
        }
      },
    });
  };

  // Actions สำหรับ Batch Operations
  const handleBatchApprove = () => {
    if (selectedIds.length === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: "ยืนยันการอนุมัติยกเลิกใบเสร็จ",
      description: `ยืนยันอนุมัติการยกเลิกใบเสร็จที่เลือกจำนวน ${selectedIds.length} รายการใช่หรือไม่?`,
      confirmText: "อนุมัติ",
      variant: "success",
      icon: CheckCircle2,
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          for (const id of selectedIds) {
            await posApiService.approveCancelPaymentReceipt(id, { remark: "อนุมัติยกเลิกแบบกลุ่ม" });
          }
          toast({ variant: "success", message: `อนุมัติการยกเลิกเรียบร้อยแล้ว ${selectedIds.length} รายการ` });
          setSelectedIds([]);
          fetchCancellationHistory();
          fetchOverallStats();
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        } catch (err: any) {
          toast({ variant: "error", message: err?.response?.data?.error || "เกิดข้อผิดพลาดในการอนุมัติแบบกลุ่ม" });
        } finally {
          setIsProcessing(false);
        }
      },
    });
  };

  const handleBatchReject = () => {
    if (selectedIds.length === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: "ยืนยันการปฏิเสธคำขอยกเลิก",
      description: `ยืนยันปฏิเสธคำขอยกเลิกใบเสร็จที่เลือกจำนวน ${selectedIds.length} รายการใช่หรือไม่?`,
      confirmText: "ปฏิเสธ",
      variant: "danger",
      icon: XCircle,
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          for (const id of selectedIds) {
            await posApiService.rejectCancelPaymentReceipt(id, { remark: "ข้อความอัตโนมัติ ปฏิเสธคำขอยกเลิก" });
          }
          toast({ variant: "success", message: `ปฏิเสธคำขอยกเลิกเรียบร้อยแล้ว ${selectedIds.length} รายการ` });
          setSelectedIds([]);
          fetchCancellationHistory();
          fetchOverallStats();
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        } catch (err: any) {
          toast({ variant: "error", message: err?.response?.data?.error || "เกิดข้อผิดพลาดในการปฏิเสธแบบกลุ่ม" });
        } finally {
          setIsProcessing(false);
        }
      },
    });
  };

  const handleBatchRevert = () => {
    if (selectedIds.length === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: "ยืนยันการดึงคำขอยกเลิกกลับ",
      description: `ยืนยันดึงคำขอยกเลิกกลับ จำนวน ${selectedIds.length} รายการใช่หรือไม่?`,
      confirmText: "ดึงคำขอยกเลิก",
      variant: "danger",
      icon: RotateCcw,
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          for (const id of selectedIds) {
            await posApiService.revertCancelPaymentReceiptRequest(id);
          }
          toast({ variant: "success", message: `ดึงคำขอยกเลิกกลับเรียบร้อยแล้ว ${selectedIds.length} รายการ` });
          setSelectedIds([]);
          fetchCancellationHistory();
          fetchOverallStats();
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        } catch (err: any) {
          toast({ variant: "error", message: err?.response?.data?.error || "เกิดข้อผิดพลาดในการดึงคำขอกลับ" });
        } finally {
          setIsProcessing(false);
        }
      },
    });
  };

  const handleResubmitCancel = async () => {
    if (!selectedReceipt) return;
    const reason = cancelReason.trim();
    if (!reason) {
      toast({ variant: "warning", message: "กรุณาระบุเหตุผลในการขอยกเลิกรายการ" });
      return;
    }

    setIsProcessing(true);
    try {
      if (isOwnerOrManager) {
        await posApiService.cancelPaymentReceipt(selectedReceipt.receipt_id, {
          cancelled_by_id: getCurrentUserId() || 1,
          reason: reason,
          payment_type: selectedReceipt.payment_type,
        });
        toast({ variant: "success", message: "ยกเลิกรายการรับชำระเงินและคืนยอดหนี้เรียบร้อยแล้ว" });
      } else {
        await posApiService.requestCancelPaymentReceipt(selectedReceipt.receipt_id, {
          reason: reason,
        });
        toast({ variant: "success", message: "ยื่นคำขอยกเลิกใบเสร็จรับเงินใหม่อีกครั้งเรียบร้อยแล้ว" });
      }

      setSelectedReceipt(null);
      setCancelReason("");
      fetchCancellationHistory();
      fetchOverallStats();
    } catch (err: any) {
      toast({ variant: "error", message: err?.response?.data?.error || err?.response?.data?.message || "เกิดข้อผิดพลาดในการดำเนินการ" });
    } finally {
      setIsProcessing(false);
    }
  };

  const refetch = useCallback(async () => {
    await Promise.all([fetchCancellationHistory(), fetchOverallStats()]);
  }, [fetchCancellationHistory, fetchOverallStats]);

  return {
    dataList,
    selectedIds,
    isSelectAll,
    isLoading,
    error,
    ownerStats,
    employeeStats,
    isStatsLoading,
    fetchOverallStats,
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
    refetch,
    confirmDialog,
    closeConfirmDialog,
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