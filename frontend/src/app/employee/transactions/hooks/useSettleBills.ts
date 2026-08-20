import { useState, useEffect, useCallback, useMemo } from "react";
import { posApiService } from "../../../../service/http/pos/pos_service";
import type { UnpaidBillItem } from "../../../../interface/pos/settle_bills_interface";
import type { SalesHistoryItemResponse } from "../../../../interface/pos/sales_history_interface";

export const useSettleBills = (initialCustomerId: number | null = null) => {
  // --- Search & Filter States ---
  const [searchQuery, setSearchQuery] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(initialCustomerId);

  // --- Live Search Dropdown States ---
  const [searchResults, setSearchResults] = useState<SalesHistoryItemResponse[]>([]);
  const [isSearchingBills, setIsSearchingBills] = useState(false);

  // --- Data States ---
  const [bills, setBills] = useState<UnpaidBillItem[]>([]);
  const [customerName, setCustomerName] = useState<string>("");
  const [selectedBillIds, setSelectedBillIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // --- Payment States ---
  const [paymentMethodId, setPaymentMethodId] = useState<number>(1);
  const [receivedAmount, setReceivedAmount] = useState<number>(0);
  const [displayValue, setDisplayValue] = useState<string>("");
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ดึงรายการบิลค้างชำระจาก Backend
  const fetchUnpaidBills = useCallback(async (targetCustomerId: number) => {
    setIsLoading(true);
    try {
      const res = await posApiService.getUnpaidBillsByCustomer(targetCustomerId);
      setBills(res.bills || []);
      setCustomerName(res.customer_name || "");
      setSelectedBillIds([]);
    } catch (err) {
      console.error("Failed to load unpaid bills:", err);
      setBills([]);
      setCustomerName("");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // โหลดข้อมูลเมื่อ customerId เปลี่ยนแปลง
  useEffect(() => {
    if (customerId) {
      fetchUnpaidBills(customerId);
    } else {
      setBills([]);
      setCustomerName("");
    }
  }, [customerId, fetchUnpaidBills]);

  // ค้นหาแบบ Live Dropdown แนะนำ
  const triggerLiveSearch = useCallback(async (query: string) => {
    const cleaned = query.trim();
    if (cleaned.length === 0) {
      setSearchResults([]);
      return;
    }
    setIsSearchingBills(true);
    try {
      const res = await posApiService.getSalesHistory({ search: cleaned, limit: 8, page: 1 });
      const unpaidOnly = (res.items || []).filter(
        (item: any) => item.customer_id && item.balance_due > 0 && item.payment_status !== "paid"
      );
      setSearchResults(unpaidOnly);
    } catch (err) {
      console.error("Failed to search bills:", err);
      setSearchResults([]);
    } finally {
      setIsSearchingBills(false);
    }
  }, []);

  // Handler: เมื่อเลือกลูกค้าจาก Dropdown
  const handleSelectSearchResult = (item: SalesHistoryItemResponse) => {
    if (!item.customer_id) return;
    setCustomerId(item.customer_id);
    setSearchQuery("");
    setSearchResults([]);
  };

  // กรองข้อมูลเฉพาะในตาราง
  const filteredBills = useMemo(() => {
    if (!searchQuery) return bills;
    return bills.filter(
      (b) =>
        b.order_number &&
        b.order_number.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [bills, searchQuery]);

  // คำนวณยอดหนี้รวมของบิลที่เลือก
  const totalSelectedDebt = useMemo(() => {
    return bills
      .filter((b) => selectedBillIds.includes(b.order_id))
      .reduce((sum, b) => sum + (b.balance_due || 0), 0);
  }, [bills, selectedBillIds]);

  const handleToggleSelect = (id: number) => {
    setSelectedBillIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedBillIds.length === filteredBills.length && filteredBills.length > 0) {
      setSelectedBillIds([]);
    } else {
      setSelectedBillIds(filteredBills.map((b) => b.order_id));
    }
  };

  const handleOpenModal = () => {
    setReceivedAmount(totalSelectedDebt);
    setDisplayValue(
      totalSelectedDebt.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
    setIsPaymentModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsPaymentModalOpen(false);
  };

  const handleFinalConfirm = async (receivedById: number = 1) => {
    if (!customerId || selectedBillIds.length === 0) return;
    setIsSubmitting(true);

    const selectedBills = bills.filter((b) => selectedBillIds.includes(b.order_id));
    const payload = {
      customer_id: customerId,
      received_by_id: receivedById,
      payment_method_id: paymentMethodId,
      total_received: receivedAmount || totalSelectedDebt,
      allocations: selectedBills.map((b) => ({
        order_id: b.order_id,
        pay_amount: b.balance_due,
      })),
    };

    try {
      const res = await posApiService.settleCustomerBills(payload);
      alert(`บันทึกชำระเงินสำเร็จ! เลขที่ใบเสร็จ: ${res.receipt_number}`);
      setIsPaymentModalOpen(false);
      fetchUnpaidBills(customerId);
    } catch (err: any) {
      console.error("Failed to settle customer bills:", err);
      alert(err?.response?.data?.error || "ไม่สามารถทำรายการชำระเงินได้");
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    searchQuery,
    setSearchQuery,
    customerId,
    setCustomerId,
    customerName,
    bills,
    filteredBills,
    selectedBillIds,
    setSelectedBillIds,
    isLoading,
    paymentMethodId,
    setPaymentMethodId,
    receivedAmount,
    setReceivedAmount,
    displayValue,
    setDisplayValue,
    isPaymentModalOpen,
    isSubmitting,
    totalSelectedDebt,
    searchResults,
    isSearchingBills,
    triggerLiveSearch,
    handleSelectSearchResult,
    fetchUnpaidBills,
    handleToggleSelect,
    handleToggleSelectAll,
    handleOpenModal,
    handleCloseModal,
    handleFinalConfirm,
  };
};