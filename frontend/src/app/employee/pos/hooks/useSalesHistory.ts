import { useState, useEffect, useCallback } from "react";
import { posApiService } from "../../../../service/http/pos/pos_service"; 
import type { SalesHistoryFilterRequest, SalesHistoryItemResponse, GetSaleHistoryByIDResponse } from "../../../../interface/pos/sales_history_interface";

export const useSalesHistory = () => {
  //คำนวณหา วันที่ย้อนหลังไป 30 วัน นับจากวันนี้
  const get30DaysAgoDateString = () => {
    const date = new Date();
    date.setDate(date.getDate() - 30); //เอาวันที่ปัจจุบันลบออกไป 30 วัน
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  //ดึง วันที่ปัจจุบัน (วันนี้)
  const getTodayDateString = () => {
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // --- States สำหรับ Query Filter ---
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState(get30DaysAgoDateString()); // ล็อกไว้ 30 วันก่อน
  const [endDate, setEndDate] = useState(getTodayDateString()); // ล็อกไว้ถึงวันนี้
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

  // States สำหรับจัดการ Drawer Detail
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [orderDetail, setOrderDetail] = useState<GetSaleHistoryByIDResponse | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // --- Fetch Function ---
  const fetchSalesHistory = useCallback(async (overrideSearch?: string) => {
    setIsLoading(true);
    setError(null);

    const activeSearch = overrideSearch !== undefined ? overrideSearch : search;

    const payload: SalesHistoryFilterRequest = {
      search: activeSearch.trim() || undefined,
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

  // เพิ่ม: Effect ดึงข้อมูลรายละเอียดออเดอร์เมื่อ selectedOrderId เปลี่ยนแปลง
  useEffect(() => {
    if (!selectedOrderId) {
      setOrderDetail(null);
      setCancelReason("");
      return;
    }

    const fetchDetail = async () => {
      setIsDetailLoading(true);
      try {
        const data = await posApiService.getSalesHistoryById(selectedOrderId);
        setOrderDetail(data);
        if (data.cancel_reason) {
          setCancelReason(data.cancel_reason);
        }
      } catch (err) {
        console.error("Failed to fetch order detail:", err);
      } finally {
        setIsDetailLoading(false);
      }
    };

    fetchDetail();
  }, [selectedOrderId]);

  // เพิ่ม Live Search / Auto Search เมื่อยิงบาร์โค้ดหรือพิมพ์ในช่องค้นหา
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchSalesHistory(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]); // ดักจับเมื่อ search เปลี่ยนแปลง

  // ดึงข้อมูลใหม่ทุกครั้งที่ page หรือ limit เปลี่ยนแปลง
  useEffect(() => {
    fetchSalesHistory();
  }, [startDate, endDate, customerType, paymentMethod, page, limit]);

  // Handler เมื่อกดปุ่ม "ใช้ตัวกรอง"
  const handleApplyFilter = () => {
    setPage(1); // รีเซ็ตไปหน้าแรกเสมอเมื่อกรองข้อมูลใหม่
    fetchSalesHistory();
  };

  // Handler สำหรับปุ่ม "รีเซ็ตตัวกรอง"
  const handleResetFilter = () => {
    setSearch("");
    setStartDate(get30DaysAgoDateString());
    setEndDate(getTodayDateString());
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
    
    // ส่ง States และ Setters สำหรับ Detail ออกไปใช้งาน
    selectedOrderId,
    setSelectedOrderId,
    orderDetail,
    isDetailLoading,
    cancelReason,
    setCancelReason,
  };
};