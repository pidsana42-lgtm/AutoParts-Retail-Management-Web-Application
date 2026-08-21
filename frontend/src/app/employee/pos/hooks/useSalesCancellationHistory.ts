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

  // Effect สำหรับเรียกข้อมูลใหม่เมื่อ Filter/Pagination เปลี่ยน
  useEffect(() => {
    fetchCancellationHistory();
  }, [fetchCancellationHistory]);

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

  // function สำหรับกู้คืนคำขอยกเลิกบิลที่เลือก ยิง API ไป revertCancellationRequest
  const handleRestoreSelected = async () => {
    if (selectedIds.length === 0) {
      alert("กรุณาเลือกรายการที่ต้องการกู้คืนอย่างน้อย 1 รายการ");
      return;
    }

    if (
      confirm(
        `คุณต้องการกู้คืนใบสั่งซื้อ ${selectedIds.length} รายการใช่หรือไม่?`,
      )
    ) {
      try {
        setIsLoading(true);
        // ยิง API กู้คืนคำขอทีละรายการ
        await Promise.all(
          selectedIds.map((id) => posApiService.revertCancellationRequest(id))
        );

        alert("ดึงคำขอยกเลิกบิลกลับสำเร็จ");
        setSelectedIds([]);
        fetchCancellationHistory();
      } catch (err: any) {
        alert(err?.response?.data?.message || "เกิดข้อผิดพลาดในการดึงคำขอกลับ");
      } finally {
        setIsLoading(false);
      }
    }
  };

  return {
    // Data & Selection
    dataList,
    selectedIds,
    isSelectAll,
    selectableCount: selectableItems.length,
    selectableItems,
    isLoading,
    error,

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
    refetch: fetchCancellationHistory,
  };
};
