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

  // --- Filter States ---
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [customerType, setCustomerType] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");

  // --- Fetch Data Function ---
    const fetchCancellationHistory = useCallback(async () => {
    try {
        setIsLoading(true);
        setError(null);

        // 🔹 เรียก API สำหรับดึงรายการขอยกเลิกของพนักงานคนนี้โดยตรง
        const data = await posApiService.getMyCancellationRequests();

        setDataList(data || []);
        setTotalRows(data?.length || 0);
        setTotalPages(1);
    } catch (err: any) {
        console.error("Failed to fetch cancellation history:", err);
        setError(err?.response?.data?.message || "ไม่สามารถโหลดข้อมูลประวัติการยกเลิกได้");
    } finally {
        setIsLoading(false);
    }
    }, []);

  // Effect สำหรับเรียกข้อมูลใหม่เมื่อ Filter/Pagination เปลี่ยน
  useEffect(() => {
    fetchCancellationHistory();
  }, [fetchCancellationHistory]);

  // --- Selection Handlers ---
  const isSelectAll =
    dataList.length > 0 && selectedIds.length === dataList.length;

  const handleSelectAll = () => {
    if (isSelectAll) {
      setSelectedIds([]);
    } else {
      setSelectedIds(dataList.map((item) => item.id));
    }
  };

  const handleSelectRow = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((itemId) => itemId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // --- Action Handlers ---
  const handleSearch = () => {
    setPage(1);
    fetchCancellationHistory();
  };

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
        alert("กู้คืนรายการสำเร็จ");
        setSelectedIds([]);
        fetchCancellationHistory();
      } catch (err: any) {
        alert(err?.response?.data?.message || "เกิดข้อผิดพลาดในการกู้คืน");
      }
    }
  };

  return {
    // Data & Selection
    dataList,
    selectedIds,
    isSelectAll,
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
    paymentMethod,
    setSearchQuery,
    setStartDate,
    setEndDate,
    setCustomerType,
    setPaymentMethod,

    // Handlers
    handleSelectAll,
    handleSelectRow,
    handleSearch,
    handleRestoreSelected,
    refetch: fetchCancellationHistory,
  };
};
