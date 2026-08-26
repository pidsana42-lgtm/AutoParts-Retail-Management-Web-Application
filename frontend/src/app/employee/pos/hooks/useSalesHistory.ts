import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { posApiService } from "../../../../service/http/pos/pos_service"; 
import type { SalesHistoryFilterRequest, SalesHistoryItemResponse, GetSaleHistoryByIDResponse } from "../../../../interface/pos/sales_history_interface";

export const useSalesHistory = () => {
  const [searchParams] = useSearchParams();

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
  const [employeeId, setEmployeeId] = useState("");
  const [employeeList, setEmployeeList] = useState<{ label: string; value: string }[]>([]);
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
  const [cancelRemark, setCancelRemark] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  // ดึงรายชื่อพนักงานเมื่อหน้าเว็บโหลด
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await posApiService.getEmployees();
        const options = res.map((emp: any) => ({
          label: (emp.first_name || emp.last_name)
            ? `${emp.first_name || ""} ${emp.last_name || ""}`.trim()
            : (emp.username || `User #${emp.id}`),
          value: String(emp.id),
        }));
        setEmployeeList(options);
      } catch (err) {
        console.error("Failed to load employees for pos history filter", err);
      }
    };
    fetchEmployees();
  }, []);

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
      employee_id: employeeId ? Number(employeeId) : undefined,
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
  }, [search, startDate, endDate, customerType, paymentMethod, employeeId, page, limit]);

  // เพิ่ม: Effect ดึงข้อมูลรายละเอียดออเดอร์เมื่อ selectedOrderId เปลี่ยนแปลง
  useEffect(() => {
    setCancelReason("");
    setCancelRemark("");

    if (!selectedOrderId) {
      setOrderDetail(null);
      return;
    }

    const fetchDetail = async () => {
      setIsDetailLoading(true);
      try {
        const data = await posApiService.getSalesHistoryById(selectedOrderId);
        setOrderDetail(data);
      } catch (err) {
        console.error("Failed to fetch order detail:", err);
      } finally {
        setIsDetailLoading(false);
      }
    };

    fetchDetail();
  }, [selectedOrderId]);

  // ดักจับ URL Search Params เพื่อเลือกบิลและเปิด Drawer อัตโนมัติ (เช่น กระโดดมาจากหน้าประวัติการชำระเงิน)
  useEffect(() => {
    const orderParam = searchParams.get("order_number") || searchParams.get("order_id");
    if (orderParam) {
      setSearch(orderParam);
      const autoLoadOrder = async () => {
        setIsDetailLoading(true);
        try {
          const data = await posApiService.getSalesHistoryById(orderParam as any);
          if (data && data.id) {
            setSelectedOrderId(data.id);
            setOrderDetail(data);
            setCancelReason("");
            setCancelRemark("");
          }
        } catch (err) {
          console.error("Failed to auto load order from url param:", err);
        } finally {
          setIsDetailLoading(false);
        }
      };
      autoLoadOrder();
    }
  }, [searchParams]);

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
  }, [startDate, endDate, customerType, paymentMethod, employeeId, page, limit]);

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
    setEmployeeId("");
    setPage(1);
  };

  // 1. Handler สำหรับ พนักงาน (Employee/Staff): ส่งคำขอยกเลิกรายการ (เข้าสถานะ PENDING_CANCEL)
  const handleRequestCancel = async () => {
    if (!selectedOrderId) return;
    const reasonToSend = cancelReason.trim() || cancelRemark.trim();
    if (!reasonToSend) {
      alert("กรุณาระบุเหตุผลในการขอยกเลิกรายการ");
      return;
    }

    setIsCancelling(true);
    try {
      await posApiService.requestCancelSaleOrder(selectedOrderId, {
        reason: reasonToSend,
      });

      alert("ส่งคำขอยกเลิกรายการเรียบร้อยแล้ว รอการอนุมัติจากเจ้าของร้าน");
      
      setSelectedOrderId(null);
      setCancelReason("");
      setCancelRemark("");
      fetchSalesHistory();
    } catch (err: any) {
      console.error("Failed to request cancel order:", err);
      alert(err?.response?.data?.message || err?.response?.data?.error || "ไม่สามารถส่งคำขอยกเลิกรายการได้");
    } finally {
      setIsCancelling(false);
    }
  };

  // 2. Handler สำหรับ เจ้าของร้าน (Owner/Admin): อนุมัติยกเลิกรายการ (หรือยกเลิกบิลโดยตรง)
  const handleDirectCancelByOwner = async () => {
    if (!selectedOrderId) return;

    const currentStatus = (orderDetail?.status || "").trim().toUpperCase();
    const isPending = currentStatus === "PENDING_CANCEL";

    // ถ้าเป็นบิลปกติที่ยังไม่ได้ส่งคำขอ (Owner ขอยกเลิกเองโดยตรง) จำเป็นต้องมีเหตุผล
    const reasonOrRemark = cancelRemark.trim() || cancelReason.trim();
    if (!isPending && !reasonOrRemark) {
      alert("กรุณาระบุเหตุผลในการยกเลิกรายการ");
      return;
    }

    setIsCancelling(true);
    try {
      await posApiService.approveCancelSaleOrder(selectedOrderId, {
        remark: reasonOrRemark || undefined,
      });

      alert("ยกเลิกรายการขายและคืนสินค้าเข้าสต็อกเรียบร้อยแล้ว");
      
      setSelectedOrderId(null);
      setCancelReason("");
      setCancelRemark("");
      fetchSalesHistory();
    } catch (err: any) {
      console.error("Failed to cancel order directly:", err);
      alert(err?.response?.data?.message || err?.response?.data?.error || "ไม่สามารถยกเลิกรายการได้");
    } finally {
      setIsCancelling(false);
    }
  };

  // 3. Handler สำหรับ เจ้าของร้าน (Owner/Admin): ปฏิเสธคำขอยกเลิกรายการขาย
  const handleRejectCancelByOwner = async () => {
    if (!selectedOrderId) return;
    const remarkToSend = cancelRemark.trim() || cancelReason.trim();
    if (!remarkToSend) {
      alert("กรุณาระบุหมายเหตุหรือเหตุผลในการปฏิเสธคำขอ");
      return;
    }

    setIsCancelling(true);
    try {
      // ยิง API ปฏิเสธคำขอยกเลิก ( Reject )
      await posApiService.rejectCancelSaleOrder(selectedOrderId, {
        remark: remarkToSend,
      });

      alert("ปฏิเสธคำขอยกเลิกรายการเรียบร้อยแล้ว");
      
      setSelectedOrderId(null);
      setCancelReason("");
      setCancelRemark("");
      fetchSalesHistory(); // รีโหลดตารางใหม่
    } catch (err: any) {
      console.error("Failed to reject cancel order:", err);
      alert(err?.response?.data?.message || err?.response?.data?.error || "ไม่สามารถปฏิเสธคำขอยกเลิกรายการได้");
    } finally {
      setIsCancelling(false);
    }
  };

  // 4. Handler สำหรับ พนักงาน (Employee): ดึงคำขอยกเลิกกลับ (กู้คืนคำขอ)
  const handleRevertCancel = async () => {
    if (!selectedOrderId) return;
    if (!confirm("คุณต้องการดึงคำขอยกเลิกรายการนี้กลับใช่หรือไม่?")) return;

    setIsCancelling(true);
    try {
      await posApiService.revertCancellationRequest(selectedOrderId);
      alert("ดึงคำขอยกเลิกบิลกลับสำเร็จ");
      setSelectedOrderId(null);
      setCancelReason("");
      setCancelRemark("");
      fetchSalesHistory();
    } catch (err: any) {
      console.error("Failed to revert cancel request:", err);
      alert(err?.response?.data?.message || err?.response?.data?.error || "เกิดข้อผิดพลาดในการดึงคำขอกลับ");
    } finally {
      setIsCancelling(false);
    }
  };

  // Helper แปลงสถานะเป็นข้อความภาษาไทย
  const getStatusText = (statusStr?: string | null, cancelRemark?: string | null) => {
    if (!statusStr) return "-";
    const status = statusStr.trim().toUpperCase();

    if (cancelRemark && status !== "PENDING_CANCEL" && status !== "CANCELLED" && status !== "ยกเลิก") {
      return "ปฏิเสธคำขอ";
    }

    switch (status) {
      case "PENDING_CANCEL":
        return "รออนุมัติยกเลิก";
      case "CANCELLED":
      case "ยกเลิก":
        return "ยกเลิกแล้ว";
      case "COMPLETED":
        return "ทำรายการสำเร็จ";
      case "PENDING":
        return "รอดำเนินการ";
      default:
        return statusStr;
    }
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
    employeeId,
    employeeList,
    page,
    limit,
    // Setters
    setSearch,
    setStartDate,
    setEndDate,
    setCustomerType,
    setPaymentMethod,
    setEmployeeId,
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
    cancelRemark,
    setCancelRemark,
    isCancelling,
    handleRequestCancel,        // สำหรับ Employee (ส่งเรื่องรออนุมัติ)
    handleDirectCancelByOwner,  // สำหรับ Owner (อนุมัติทันที)
    handleRejectCancelByOwner,  // สำหรับ Owner (ปฏิเสธคำขอ)
    handleRevertCancel,         // สำหรับ Employee (กู้คืนคำขอ / ดึงคำขอยกเลิกกลับ)
    getStatusText,
  };
};