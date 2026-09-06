import { useState, useEffect, useMemo, useCallback } from "react";
import { posApiService } from "../../../../service/http/pos/pos_service";
import type { PaymentHistoryItem } from "../../../../interface/pos/payment_interface";
import { useEmployeeOptions } from "../../../../hooks/useEmployeeOptions";
import { getTodayDateString, getDaysAgoDateString } from "../../../../utils/date";
import { useUserRole } from "../../../../hooks/useUserRole";
import { getCurrentUserId } from "../../../../utils/auth";

export function usePaymentHistory(initialSearch = "", initialTypeFilter = "") {
  const { isOwnerOrAdmin } = useUserRole();
  const [items, setItems] = useState<PaymentHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ดึงรายชื่อพนักงานจาก Hook กลาง
  const { employeeList } = useEmployeeOptions();

  // Filter States
  const [search, setSearch] = useState<string>(() => initialSearch);
  const [typeFilter, setTypeFilter] = useState<string>(() => initialTypeFilter);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [employeeId, setEmployeeId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(getDaysAgoDateString(30));
  const [endDate, setEndDate] = useState<string>(getTodayDateString());

  // Pagination States
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);

  // Drawer / Action States
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentHistoryItem | null>(null);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [cancelRemark, setCancelRemark] = useState<string>("");
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  // โหลดประวัติการชำระเงิน
  const fetchHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params: any = {};
      if (employeeId) {
        params.employee_id = Number(employeeId);
      }
      const data = await posApiService.getPaymentHistory(params);
      setItems(data);
    } catch (err: any) {
      console.error("Failed to fetch payment history:", err);
      setError("ไม่สามารถโหลดข้อมูลประวัติการชำระเงินได้");
    } finally {
      setIsLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // ตัวกรอง (Client-side Filter พร้อมตรวจ Employee)
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        (item.receipt_number && item.receipt_number.toLowerCase().includes(q)) ||
        (item.order_numbers && item.order_numbers.toLowerCase().includes(q)) ||
        (item.customer_name && item.customer_name.toLowerCase().includes(q));

      const matchType = !typeFilter || item.payment_type === typeFilter;
      const matchStatus = !statusFilter || item.status === statusFilter;
      const matchMethod = !paymentMethod || item.payment_method.includes(paymentMethod);

      let matchEmployee = true;
      if (employeeId) {
        if (item.received_by_id !== undefined && item.received_by_id !== null) {
          matchEmployee = String(item.received_by_id) === String(employeeId);
        } else {
          const targetEmp = employeeList.find((e) => e.value === String(employeeId));
          matchEmployee = targetEmp
            ? Boolean(item.received_by_name?.toLowerCase().includes(targetEmp.label.toLowerCase()))
            : true;
        }
      }

      let matchDate = true;
      if (startDate) {
        matchDate = matchDate && new Date(item.paid_at) >= new Date(`${startDate}T00:00:00`);
      }
      if (endDate) {
        matchDate = matchDate && new Date(item.paid_at) <= new Date(`${endDate}T23:59:59`);
      }

      return matchSearch && matchType && matchStatus && matchMethod && matchEmployee && matchDate;
    });
  }, [items, search, typeFilter, statusFilter, paymentMethod, employeeId, employeeList, startDate, endDate]);

  const totalRows = filteredItems.length;
  const totalPages = Math.ceil(totalRows / limit) || 1;

  // Pagination Slicing
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredItems.slice(start, start + limit);
  }, [filteredItems, page, limit]);

  // Helper ฟังก์ชันเช็คประเภทช่องทางชำระเงิน
  const isCashMethod = (method: string) => {
    const m = (method || "").toUpperCase();
    return m.includes("CASH") || m.includes("เงินสด");
  };

  const isTransferOrQrMethod = (method: string) => {
    const m = (method || "").toUpperCase();
    return m.includes("QR") || m.includes("TRANSFER") || m.includes("โอน") || m.includes("พร้อมเพย์") || m.includes("PROMPTPAY");
  };

  // 1. สถิติภาพรวมสำหรับฝั่งเจ้าของร้าน (Owner System)
  const ownerStats = useMemo(() => {
    const completedItems = items.filter(
      (item) => item.status?.toLowerCase() === "completed" || item.status === "สำเร็จ"
    );
    const cancelledItems = items.filter(
      (item) => item.status?.toLowerCase() === "cancelled" || item.status === "ยกเลิก"
    );

    // Card 1: ยอดรับชำระสุทธิ (Net Total Collected)
    const netTotalCollected = completedItems.reduce(
      (sum, item) => sum + (Number(item.total_received) || 0),
      0
    );
    const completedCount = completedItems.length;

    // Card 2: ช่องทางการเงิน (Payment Methods)
    const cashItems = completedItems.filter((item) => isCashMethod(item.payment_method));
    const cashTotal = cashItems.reduce((sum, item) => sum + (Number(item.total_received) || 0), 0);
    const cashCount = cashItems.length;

    const transferQrItems = completedItems.filter((item) => isTransferOrQrMethod(item.payment_method));
    const transferQrTotal = transferQrItems.reduce((sum, item) => sum + (Number(item.total_received) || 0), 0);
    const transferQrCount = transferQrItems.length;

    // Card 3: ประเภทการรับชำระ (Payment Types)
    const posItems = completedItems.filter((item) => item.payment_type === "payment");
    const posPaymentTotal = posItems.reduce((sum, item) => sum + (Number(item.total_received) || 0), 0);
    const posPaymentCount = posItems.length;

    const repaymentItems = completedItems.filter((item) => item.payment_type === "repayment");
    const repaymentTotal = repaymentItems.reduce((sum, item) => sum + (Number(item.total_received) || 0), 0);
    const repaymentCount = repaymentItems.length;

    // Card 4: รายการที่ยกเลิก (Cancelled Payments)
    const cancelledTotal = cancelledItems.reduce(
      (sum, item) => sum + (Number(item.total_received) || 0),
      0
    );
    const cancelledCount = cancelledItems.length;

    return {
      netTotalCollected,
      completedCount,
      cashTotal,
      cashCount,
      transferQrTotal,
      transferQrCount,
      posPaymentTotal,
      posPaymentCount,
      repaymentTotal,
      repaymentCount,
      cancelledTotal,
      cancelledCount,
      totalCount: items.length,
    };
  }, [items]);

  // 2. สถิติสำหรับฝั่งพนักงาน (Employee) — กรองเฉพาะรายการของตนเองเพื่อสรุปส่งมอบเงิน
  const employeeStats = useMemo(() => {
    const currentUserId = getCurrentUserId();
    const myItems = items.filter((item) => {
      if (item.received_by_id !== undefined && item.received_by_id !== null && item.received_by_id !== 0) {
        return Number(item.received_by_id) === Number(currentUserId);
      }
      return true;
    });

    const completedItems = myItems.filter(
      (item) => item.status?.toLowerCase() === "completed" || item.status === "สำเร็จ"
    );
    const cancelledItems = myItems.filter(
      (item) => item.status?.toLowerCase() === "cancelled" || item.status === "ยกเลิก"
    );

    // Card 1: ยอดรับชำระของฉัน (My Collected Total)
    const netTotalCollected = completedItems.reduce(
      (sum, item) => sum + (Number(item.total_received) || 0),
      0
    );
    const completedCount = completedItems.length;

    // Card 2: เงินสดที่ต้องส่งมอบ (Cash in Hand) — สำคัญที่สุด
    const cashItems = completedItems.filter((item) => isCashMethod(item.payment_method));
    const cashTotal = cashItems.reduce((sum, item) => sum + (Number(item.total_received) || 0), 0);
    const cashCount = cashItems.length;

    // Card 3: เงินโอน/สแกน QR (Transfer / QR Code)
    const transferQrItems = completedItems.filter((item) => isTransferOrQrMethod(item.payment_method));
    const transferQrTotal = transferQrItems.reduce((sum, item) => sum + (Number(item.total_received) || 0), 0);
    const transferQrCount = transferQrItems.length;

    // Card 4: บิลที่ถูกยกเลิก (My Cancelled Transactions)
    const cancelledTotal = cancelledItems.reduce(
      (sum, item) => sum + (Number(item.total_received) || 0),
      0
    );
    const cancelledCount = cancelledItems.length;

    return {
      netTotalCollected,
      completedCount,
      cashTotal,
      cashCount,
      transferQrTotal,
      transferQrCount,
      cancelledTotal,
      cancelledCount,
      totalCount: myItems.length,
    };
  }, [items]);

  const handleApplyFilter = () => {
    setPage(1);
  };

  // พนักงานส่งคำขอยกเลิกใบเสร็จ (Repayment)
  const handleRequestCancelReceipt = async () => {
    if (!selectedReceipt) return;
    const reason = cancelReason.trim() || cancelRemark.trim();
    if (!reason) {
      alert("กรุณาระบุเหตุผลในการขอยกเลิกรายการ");
      return;
    }

    try {
      setIsCancelling(true);
      await posApiService.requestCancelPaymentReceipt(selectedReceipt.receipt_id, {
        reason: reason,
      });

      alert("ส่งคำขอยกเลิกใบเสร็จรับเงินไปยังเจ้าของร้านเรียบร้อยแล้ว");
      setSelectedReceipt(null);
      setCancelReason("");
      setCancelRemark("");
      fetchHistory();
    } catch (err: any) {
      alert(err.response?.data?.error || err.response?.data?.message || "เกิดข้อผิดพลาดในการส่งคำขอยกเลิก");
    } finally {
      setIsCancelling(false);
    }
  };

  // พนักงานดึงคำขอยกเลิกกลับ
  const handleRevertCancelRequest = async () => {
    if (!selectedReceipt) return;
    if (!confirm("คุณต้องการดึงคำขอยกเลิกใบเสร็จนี้กลับใช่หรือไม่?")) return;

    try {
      setIsCancelling(true);
      await posApiService.revertCancelPaymentReceiptRequest(selectedReceipt.receipt_id);
      alert("ดึงคำขอยกเลิกใบเสร็จรับเงินกลับเรียบร้อยแล้ว");
      setSelectedReceipt(null);
      setCancelReason("");
      setCancelRemark("");
      fetchHistory();
    } catch (err: any) {
      alert(err.response?.data?.error || err.response?.data?.message || "เกิดข้อผิดพลาดในการดึงคำขอยกเลิกกลับ");
    } finally {
      setIsCancelling(false);
    }
  };

  // เจ้าของร้านอนุมัติการยกเลิก (คืนยอดหนี้)
  const handleApproveCancelReceipt = async () => {
    if (!selectedReceipt) return;
    if (!confirm("ยืนยันการอนุมัติยกเลิกใบเสร็จนี้? ระบบจะทำการคืนยอดหนี้กลับไปยังบัญชีลูกค้า")) return;

    const remark = cancelRemark.trim() || cancelReason.trim();

    try {
      setIsCancelling(true);
      await posApiService.approveCancelPaymentReceipt(selectedReceipt.receipt_id, {
        remark: remark || undefined,
      });

      alert("อนุมัติยกเลิกใบเสร็จรับเงินและคืนยอดหนี้เรียบร้อยแล้ว");
      setSelectedReceipt(null);
      setCancelRemark("");
      setCancelReason("");
      fetchHistory();
    } catch (err: any) {
      alert(err.response?.data?.error || err.response?.data?.message || "เกิดข้อผิดพลาดในการอนุมัติยกเลิก");
    } finally {
      setIsCancelling(false);
    }
  };

  // เจ้าของร้านปฏิเสธคำขอยกเลิก
  const handleRejectCancelReceipt = async () => {
    if (!selectedReceipt) return;
    const remark = cancelRemark.trim() || cancelReason.trim();

    try {
      setIsCancelling(true);
      await posApiService.rejectCancelPaymentReceipt(selectedReceipt.receipt_id, {
        remark: remark || undefined,
      });

      alert("ปฏิเสธคำขอยกเลิกใบเสร็จรับเงินเรียบร้อยแล้ว");
      setSelectedReceipt(null);
      setCancelRemark("");
      setCancelReason("");
      fetchHistory();
    } catch (err: any) {
      alert(err.response?.data?.error || err.response?.data?.message || "เกิดข้อผิดพลาดในการปฏิเสธคำขอ");
    } finally {
      setIsCancelling(false);
    }
  };

  // เจ้าของร้านยกเลิกโดยตรง (Direct Cancel)
  const handleCancelReceipt = async () => {
    if (!selectedReceipt) return;
    const reason = cancelReason.trim() || cancelRemark.trim();
    if (!reason) {
      alert("กรุณาระบุเหตุผลในการยกเลิกรายการ");
      return;
    }

    try {
      setIsCancelling(true);
      const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
      await posApiService.cancelPaymentReceipt(selectedReceipt.receipt_id, {
        cancelled_by_id: getCurrentUserId() || currentUser.id || 1,
        reason: reason,
        payment_type: selectedReceipt.payment_type,
      });

      alert("ยกเลิกรายการรับชำระเงินและคืนยอดหนี้เรียบร้อยแล้ว");
      setSelectedReceipt(null);
      setCancelReason("");
      setCancelRemark("");
      fetchHistory();
    } catch (err: any) {
      alert(err.response?.data?.error || err.response?.data?.message || "เกิดข้อผิดพลาดในการยกเลิกรายการ");
    } finally {
      setIsCancelling(false);
    }
  };

  return {
    items: paginatedItems,
    totalRows,
    totalPages,
    isLoading,
    error,
    ownerStats,
    employeeStats,
    search,
    typeFilter,
    statusFilter,
    paymentMethod,
    employeeId,
    employeeList,
    startDate,
    endDate,
    page,
    limit,
    selectedReceipt,
    cancelReason,
    cancelRemark,
    isCancelling,
    isOwnerOrAdmin,
    setSearch,
    setTypeFilter,
    setStatusFilter,
    setPaymentMethod,
    setEmployeeId,
    setStartDate,
    setEndDate,
    setPage,
    setLimit,
    setSelectedReceipt,
    setCancelReason,
    setCancelRemark,
    handleApplyFilter,
    handleRequestCancelReceipt,
    handleRevertCancelRequest,
    handleApproveCancelReceipt,
    handleRejectCancelReceipt,
    handleCancelReceipt,
    fetchHistory,
  };
}
