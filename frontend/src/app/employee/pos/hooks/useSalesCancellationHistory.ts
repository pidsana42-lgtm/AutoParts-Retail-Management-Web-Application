import { useState, useEffect, useCallback } from "react";
import { posApiService } from "../../../../service/http/pos/pos_service";
import type {
  SalesHistoryItemResponse,
  SalesHistoryFilterRequest,
} from "../../../../interface/pos/sales_history_interface";
import { useUserRole } from "../../../../hooks/useUserRole";
import { useEmployeeOptions } from "../../../../hooks/useEmployeeOptions";

export const useSalesCancellationHistory = () => {
  const { isOwnerOrManager } = useUserRole();
  const { employeeList } = useEmployeeOptions();

  // --- Data & Loading States ---
  const [dataList, setDataList] = useState<SalesHistoryItemResponse[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // --- Overall Stats State ---
  const [stats, setStats] = useState({
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

  // --- Pagination States ---
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  const get30DaysAgoDateString = () => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const getTodayDateString = () => {
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // --- Filter States ---
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(get30DaysAgoDateString());
  const [endDate, setEndDate] = useState<string>(getTodayDateString());
  const [customerType, setCustomerType] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [employeeId, setEmployeeId] = useState<string>("");

  // --- Fetch Data Function ---
  const fetchCancellationHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params: SalesHistoryFilterRequest = {
        search: searchQuery,
        start_date: startDate,
        end_date: endDate,
        customer_type: customerType,
        status: status,
        payment_method: paymentMethod,
        employee_id: isOwnerOrManager ? employeeId : undefined,
        page: page,
        limit: limit,
      };

      const response = isOwnerOrManager
        ? await posApiService.getCancellationRequests(params)
        : await posApiService.getMyCancellationRequests(params);

      setDataList(response.items || []);
      setTotalRows(response.total_rows || 0);
      setTotalPages(response.total_pages || 1);
    } catch (err: any) {
      console.error("Failed to fetch cancellation history:", err);
      setError(err?.response?.data?.message || "ไม่สามารถโหลดข้อมูลประวัติการยกเลิกได้");
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, startDate, endDate, customerType, status, paymentMethod, employeeId, isOwnerOrManager, page, limit]);

  // --- Fetch Overall Stats ---
  const fetchOverallStats = useCallback(async () => {
    try {
      setIsStatsLoading(true);
      const response = isOwnerOrManager
        ? await posApiService.getCancellationRequests({ limit: 0 })
        : await posApiService.getMyCancellationRequests({ limit: 0 });

      const allItems = response.items || [];

      let pendingCount = 0, pendingAmount = 0;
      let approvedCount = 0, approvedAmount = 0;
      let rejectedCount = 0, rejectedAmount = 0;
      let totalCount = 0, totalAmount = 0;

      for (const item of allItems) {
        const amount = Number(item.total_amount) || 0;
        const s = (item.status || "").trim().toUpperCase();
        const hasCancelRemark = Boolean(item.cancel_remark && item.cancel_remark.trim() !== "");

        totalCount++;
        totalAmount += amount;

        if (s === "PENDING_CANCEL") {
          pendingCount++;
          pendingAmount += amount;
        } else if (s === "CANCELLED" || s === "ยกเลิก") {
          approvedCount++;
          approvedAmount += amount;
        } else if (hasCancelRemark || s === "REJECTED") {
          rejectedCount++;
          rejectedAmount += amount;
        }
      }

      setStats({
        totalCount,
        totalAmount,
        pendingCount,
        pendingAmount,
        approvedCount,
        approvedAmount,
        rejectedCount,
        rejectedAmount,
      });
    } catch (err) {
      console.error("Failed to fetch cancellation stats:", err);
    } finally {
      setIsStatsLoading(false);
    }
  }, [isOwnerOrManager]);

  useEffect(() => {
    fetchCancellationHistory();
  }, [fetchCancellationHistory]);

  useEffect(() => {
    fetchOverallStats();
  }, [fetchOverallStats]);

  // --- Selection Handlers ---
  const selectableItems = dataList.filter(
    (item) => (item.status || "").toUpperCase() === "PENDING_CANCEL"
  );

  const isSelectAll =
    selectableItems.length > 0 && selectedIds.length === selectableItems.length;

  const handleSelectAll = () => {
    if (isSelectAll) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectableItems.map((item) => item.id));
    }
  };

  const handleSelectRow = (id: number) => {
    const item = dataList.find((x) => x.id === id);
    if (!item) return;
    const itemStatus = (item.status || "").toUpperCase();
    if (itemStatus !== "PENDING_CANCEL") return;

    if (selectedIds.includes(id)) {
      setSelectedIds((prev) => prev.filter((itemId) => itemId !== id));
    } else {
      setSelectedIds((prev) => [...prev, id]);
    }
  };

  // --- Action Handlers ---
  const handleSearch = () => {
    setPage(1);
    fetchCancellationHistory();
  };

  // 1. เจ้าของร้าน: อนุมัติแบบกลุ่ม (Batch Approve)
  const handleApproveSelected = async () => {
    if (selectedIds.length === 0) {
      alert("กรุณาเลือกรายการที่ต้องการอนุมัติอย่างน้อย 1 รายการ");
      return;
    }

    if (
      confirm(
        `คุณต้องการอนุมัติยกเลิกบิลและคืนสต็อกจำนวน ${selectedIds.length} รายการใช่หรือไม่?`
      )
    ) {
      try {
        setIsLoading(true);
        await Promise.all(
          selectedIds.map((id) =>
            posApiService.approveCancelSaleOrder(id, { remark: "อนุมัติแบบกลุ่มโดยเจ้าของร้าน" })
          )
        );

        alert("อนุมัติยกเลิกบิลสำเร็จ");
        setSelectedIds([]);
        fetchCancellationHistory();
        fetchOverallStats();
      } catch (err: any) {
        alert(err?.response?.data?.message || "เกิดข้อผิดพลาดในการอนุมัติยกเลิกบิล");
      } finally {
        setIsLoading(false);
      }
    }
  };

  // 2. เจ้าของร้าน: ปฏิเสธแบบกลุ่ม (Batch Reject)
  const handleRejectSelected = async () => {
    if (selectedIds.length === 0) {
      alert("กรุณาเลือกรายการที่ต้องการปฏิเสธอย่างน้อย 1 รายการ");
      return;
    }

    const remark = prompt("ระบุเหตุผลในการปฏิเสธคำขอ (ถ้ามี):", "ไม่อนุมัติโดยเจ้าของร้าน");
    if (remark === null) return;

    if (confirm(`คุณต้องการปฏิเสธคำขอยกเลิกจำนวน ${selectedIds.length} รายการใช่หรือไม่?`)) {
      try {
        setIsLoading(true);
        await Promise.all(
          selectedIds.map((id) =>
            posApiService.rejectCancelSaleOrder(id, { remark })
          )
        );

        alert("ปฏิเสธคำขอยกเลิกบิลสำเร็จ");
        setSelectedIds([]);
        fetchCancellationHistory();
        fetchOverallStats();
      } catch (err: any) {
        alert(err?.response?.data?.message || "เกิดข้อผิดพลาดในการปฏิเสธคำขอยกเลิกบิล");
      } finally {
        setIsLoading(false);
      }
    }
  };

  // 3. พนักงาน: กู้คืนคำขอยกเลิกบิลที่เลือก (Revert Request)
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);

  const handleRestoreSelected = () => {
    if (selectedIds.length === 0) {
      alert("กรุณาเลือกรายการที่ต้องการกู้คืนอย่างน้อย 1 รายการ");
      return;
    }
    setIsRestoreModalOpen(true);
  };

  const handleConfirmRestore = async () => {
    try {
      setIsRestoring(true);
      setIsLoading(true);
      await Promise.all(
        selectedIds.map((id) => posApiService.revertCancellationRequest(id))
      );

      alert("ดึงคำขอยกเลิกบิลกลับสำเร็จ");
      setSelectedIds([]);
      fetchCancellationHistory();
      fetchOverallStats();
      setIsRestoreModalOpen(false);
    } catch (err: any) {
      alert(err?.response?.data?.message || "เกิดข้อผิดพลาดในการดึงคำขอกลับ");
    } finally {
      setIsRestoring(false);
      setIsLoading(false);
    }
  };

  const refetch = useCallback(() => {
    fetchCancellationHistory();
    fetchOverallStats();
  }, [fetchCancellationHistory, fetchOverallStats]);

  return {
    // Data & Selection
    dataList,
    selectedIds,
    isSelectAll,
    selectableCount: selectableItems.length,
    selectableItems,
    isLoading,
    isRestoring,
    error,

    // Employee Restore Modal
    isRestoreModalOpen,
    setIsRestoreModalOpen,
    isRestoreConfirmOpen: isRestoreModalOpen,
    setIsRestoreConfirmOpen: setIsRestoreModalOpen,
    handleRestoreSelected,
    handleConfirmRestore,

    // Owner Batch Actions
    handleApproveSelected,
    handleRejectSelected,

    // Overall Stats
    stats,
    isStatsLoading,
    fetchOverallStats,

    // Pagination
    page,
    limit,
    totalRows,
    totalPages,
    setPage,
    setLimit,

    // Filters
    searchQuery,
    startDate,
    endDate,
    customerType,
    status,
    paymentMethod,
    employeeId,
    employeeList,
    setEmployeeId,
    setSearchQuery,
    setStartDate,
    setEndDate,
    setCustomerType,
    setStatus,
    setPaymentMethod,

    // Common Handlers
    handleSelectAll,
    handleSelectRow,
    handleSearch,
    refetch,
  };
};
