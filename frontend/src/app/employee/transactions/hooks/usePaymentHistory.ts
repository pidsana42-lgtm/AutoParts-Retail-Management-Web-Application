import { useState, useEffect, useMemo, useCallback } from "react";
import { posApiService } from "../../../../service/http/pos/pos_service";
import type { PaymentHistoryItem } from "../../../../interface/pos/payment_interface";
import { useEmployeeOptions } from "../../../../hooks/useEmployeeOptions";
import { getTodayDateString, getDaysAgoDateString } from "../../../../utils/date";

export function usePaymentHistory() {
  const [items, setItems] = useState<PaymentHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ดึงรายชื่อพนักงานจาก Hook กลาง
  const { employeeList } = useEmployeeOptions();

  // Filter States
  const [search, setSearch] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
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

      return matchSearch && matchType && matchMethod && matchEmployee && matchDate;
    });
  }, [items, search, typeFilter, paymentMethod, employeeId, employeeList, startDate, endDate]);

  // Pagination Slicing
  const totalRows = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / limit));
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredItems.slice(start, start + limit);
  }, [filteredItems, page, limit]);

  const handleApplyFilter = () => {
    setPage(1);
  };

  // ยกเลิกใบเสร็จรับเงิน
  const handleCancelReceipt = async () => {
    if (!selectedReceipt) return;
    if (!cancelReason.trim()) {
      alert("กรุณาระบุเหตุผลในการยกเลิกรายการ");
      return;
    }

    try {
      setIsCancelling(true);
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      await posApiService.cancelPaymentReceipt(selectedReceipt.receipt_id, {
        cancelled_by_id: user.id || 1,
        reason: cancelReason,
        payment_type: selectedReceipt.payment_type,
      });

      alert("ยกเลิกรายการรับชำระเงินเรียบร้อยแล้ว");
      setSelectedReceipt(null);
      setCancelReason("");
      fetchHistory();
    } catch (err: any) {
      alert(err.response?.data?.message || "เกิดข้อผิดพลาดในการยกเลิกรายการ");
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
    search,
    typeFilter,
    paymentMethod,
    employeeId,
    employeeList,
    startDate,
    endDate,
    page,
    limit,
    selectedReceipt,
    cancelReason,
    isCancelling,
    setSearch,
    setTypeFilter,
    setPaymentMethod,
    setEmployeeId,
    setStartDate,
    setEndDate,
    setPage,
    setLimit,
    setSelectedReceipt,
    setCancelReason,
    handleApplyFilter,
    handleCancelReceipt,
    fetchHistory,
  };
}