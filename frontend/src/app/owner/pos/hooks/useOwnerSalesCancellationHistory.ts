import { useState, useEffect, useCallback } from "react";
import { posApiService } from "../../../../service/http/pos/pos_service";
import type {
  SalesHistoryItemResponse,
  SalesHistoryFilterRequest,
} from "../../../../interface/pos/sales_history_interface";

export const useOwnerSalesCancellationHistory = () => {
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

  // Helper สำหรับวันที่
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
  const [employeeList, setEmployeeList] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
  const fetchEmployees = async () => {
    try {
      // เรียก API ดึงรายชื่อพนักงานในร้าน (ปรับตาม endpoint ของระบบคุณ เช่น posApiService.getEmployees())
      const res = await posApiService.getEmployees(); 
      const options = res.map((emp: any) => ({
        label: (emp.first_name || emp.last_name)
          ? `${emp.first_name || ""} ${emp.last_name || ""}`.trim()
          : (emp.username || `User #${emp.id}`),
        value: String(emp.id),
      }));
      setEmployeeList(options);
    } catch (err) {
      console.error("Failed to load employees", err);
    }
  };
  fetchEmployees();
}, []);

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
        employee_id: employeeId,
        payment_method: paymentMethod,
        page: page,
        limit: limit,
      };

      const response = await posApiService.getCancellationRequests(params);

      setDataList(response.items || []);
      setTotalRows(response.total_rows || 0);
      setTotalPages(response.total_pages || 1);
    } catch (err: any) {
      console.error("Failed to fetch cancellation history for owner:", err);
      setError(err?.response?.data?.message || "ไม่สามารถโหลดรายการขอยกเลิกบิลได้");
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, startDate, endDate, customerType, status, employeeId, paymentMethod, page, limit]);

  useEffect(() => {
    fetchCancellationHistory();
  }, [fetchCancellationHistory]);

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

  // 1. อนุมัติแบบกลุ่ม (Batch Approve)
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
      } catch (err: any) {
        alert(err?.response?.data?.message || "เกิดข้อผิดพลาดในการอนุมัติยกเลิกบิล");
      } finally {
        setIsLoading(false);
      }
    }
  };

  // 2. ปฏิเสธแบบกลุ่ม (Batch Reject)  [เพิ่มใหม่โดยใช้ rejectCancelSaleOrder]
  const handleRejectSelected = async () => {
    if (selectedIds.length === 0) {
      alert("กรุณาเลือกรายการที่ต้องการปฏิเสธอย่างน้อย 1 รายการ");
      return;
    }

    const remark = prompt("ระบุเหตุผลในการปฏิเสธคำขอ (ถ้ามี):", "ไม่อนุมัติโดยเจ้าของร้าน");
    if (remark === null) return; // กดยกเลิกใน Prompt

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
      } catch (err: any) {
        alert(err?.response?.data?.message || "เกิดข้อผิดพลาดในการปฏิเสธคำขอยกเลิกบิล");
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
    employeeId,
    employeeList,
    setEmployeeId,
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
    handleApproveSelected,
    handleRejectSelected, 
    refetch: fetchCancellationHistory,
  };
};