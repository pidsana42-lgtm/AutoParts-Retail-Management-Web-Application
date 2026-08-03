import { useState, useEffect, useCallback } from "react";
import { posApiService } from "../../../../service/http/pos/pos_service"; 
import type { SalesHistoryFilterRequest, SalesHistoryItemResponse, } from "../../../../interface/pos/sales_history_interface";

export const useSalesHistory = () => {
  // --- States สำหรับ Query Filter ---
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [customerType, setCustomerType] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // --- States สำหรับ Data & Fetch Status ---
  const [items, setItems] = useState<SalesHistoryItemResponse[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Fetch Function ---
  const fetchSalesHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const payload: SalesHistoryFilterRequest = {
      search: search.trim() || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      customer_type: customerType || undefined,
      payment_method: paymentMethod || undefined,
      page,
      limit,
    };

    try {
      const res = await posApiService.getSalesHistory(payload);
      setItems(res.items || []);
      setTotalRows(res.total_rows || 0);
      setTotalPages(res.total_pages || 1);
    } catch (err: any) {
      console.error("Failed to fetch sales history:", err);
      setError(err?.response?.data?.message || "ไม่สามารถดึงข้อมูลประวัติการขายได้");
    } finally {
      setIsLoading(false);
    }
  }, [search, startDate, endDate, customerType, paymentMethod, page, limit]);

  // ดึงข้อมูลใหม่ทุกครั้งที่ page หรือ limit เปลี่ยนแปลง
  useEffect(() => {
    fetchSalesHistory();
  }, [page, limit]);

  // Handler เมื่อกดปุ่ม "ใช้ตัวกรอง"
  const handleApplyFilter = () => {
    setPage(1); // รีเซ็ตไปหน้าแรกเสมอเมื่อกรองข้อมูลใหม่
    fetchSalesHistory();
  };

  // Handler สำหรับปุ่ม "รีเซ็ตตัวกรอง"
  const handleResetFilter = () => {
    setSearch("");
    setStartDate("");
    setEndDate("");
    setCustomerType("");
    setPaymentMethod("");
    setPage(1);
  };

  return {
    // States
    items,
    totalRows,
    totalPages,
    isLoading,
    error,
    // Filter States
    search,
    startDate,
    endDate,
    customerType,
    paymentMethod,
    page,
    limit,
    // Setters
    setSearch,
    setStartDate,
    setEndDate,
    setCustomerType,
    setPaymentMethod,
    setPage,
    setLimit,
    // Actions
    fetchSalesHistory,
    handleApplyFilter,
    handleResetFilter,
  };
};