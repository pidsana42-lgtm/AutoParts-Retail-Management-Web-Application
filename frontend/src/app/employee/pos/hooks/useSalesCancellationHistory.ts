import { useState, useEffect, useCallback } from "react";
import { posApiService } from "../../../../service/http/pos/pos_service";
import type {
  SalesHistoryItemResponse,
  SalesHistoryFilterRequest,
} from "../../../../interface/pos/sales_history_interface";

export const useSalesCancellationHistory = () => {
  // --- Data & Loading States ---
  const [dataList, setDataList] = useState<SalesHistoryItemResponse[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // --- Overall Stats State (เฉพาะคำขอของพนักงานคนนี้) ---
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

  // --- Fetch Data Function ---
  const fetchCancellationHistory = useCallback(async () => {
    try {
        setIsLoading(true);
        setError(null);

      // ส่งค่าพารามิเตอร์ไปยัง API Service
      const params: SalesHistoryFilterRequest = {
        search: searchQuery,
        start_date: startDate,
        end_date: endDate,
        customer_type: customerType,
        status: status,
        payment_method: paymentMethod,
        page: page,
        limit: limit,
      };

      // เรียก API สำหรับดึงรายการขอยกเลิกของพนักงานคนนี้โดยตรง
      const response = await posApiService.getMyCancellationRequests(params);

      setDataList(response.items || []);
      setTotalRows(response.total_rows || 0);
      setTotalPages(response.total_pages || 1);
    } catch (err: any) {
        console.error("Failed to fetch cancellation history:", err);
        setError(err?.response?.data?.message || "ไม่สามารถโหลดข้อมูลประวัติการยกเลิกได้");
    } finally {
        setIsLoading(false);
    }
  }, [searchQuery, startDate, endDate, customerType, status, paymentMethod, page, limit]);

  // --- Fetch Overall Stats (สถิติภาพรวมเฉพาะคำขอของพนักงานคนนี้ ไม่ขึ้นกับตัวกรอง) ---
  const fetchOverallStats = useCallback(async () => {
    try {
      setIsStatsLoading(true);
      const response = await posApiService.getMyCancellationRequests({ limit: 0 });
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
      console.error("Failed to fetch employee cancellation stats:", err);
    } finally {
      setIsStatsLoading(false);
    }
  }, []);

  // Effect สำหรับเรียกข้อมูลใหม่เมื่อ Filter/Pagination เปลี่ยน
  useEffect(() => {
    fetchCancellationHistory();
  }, [fetchCancellationHistory]);

  useEffect(() => {
    fetchOverallStats();
  }, [fetchOverallStats]);

  // --- Selection Handlers ---

  // ดึงเฉพาะรายการที่มีสถานะ "PENDING_CANCEL" เพื่อให้สามารถเลือกได้
  const selectableItems = dataList.filter(
    (item) => (item.status || "").toUpperCase() === "PENDING_CANCEL"
  );

  // ตรวจสอบว่าเลือกครบทุกรายการที่สามารถเลือกได้แล้วหรือยัง
  const isSelectAll =
    selectableItems.length > 0 && selectedIds.length === selectableItems.length;

  // เลือก/ยกเลิกเลือกเฉพาะรายการที่มีสถานะ "PENDING_CANCEL" ทั้งหมด
  const handleSelectAll = () => {
    if (isSelectAll) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectableItems.map((item) => item.id));
    }
  };

  // เลือกทีละรายการ เช็คสถานะก่อนว่าถูกต้องหรือไม่ (เฉพาะ PENDING_CANCEL)
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

  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);

  // function สำหรับเปิด Modal กู้คืนคำขอยกเลิกบิลที่เลือก
  const handleRestoreSelected = () => {
    if (selectedIds.length === 0) {
      alert("กรุณาเลือกรายการที่ต้องการกู้คืนอย่างน้อย 1 รายการ");
      return;
    }
    setIsRestoreModalOpen(true);
  };

  // function สำหรับกู้คืนคำขอยกเลิกบิลที่เลือก ยิง API ไป revertCancellationRequest
  const handleConfirmRestore = async () => {
    try {
      setIsRestoring(true);
      setIsLoading(true);
      // ยิง API กู้คืนคำขอทีละรายการ
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

    // Restore Modal / Confirm Dialog
    isRestoreModalOpen,
    setIsRestoreModalOpen,
    isRestoreConfirmOpen: isRestoreModalOpen,
    setIsRestoreConfirmOpen: setIsRestoreModalOpen,
    handleConfirmRestore,

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
    setSearchQuery,
    setStartDate,
    setEndDate,
    setCustomerType,
    setStatus,
    setPaymentMethod,

    // Handlers
    handleSelectAll,
    handleSelectRow,
    handleSearch,
    handleRestoreSelected,
    refetch,
  };
};
