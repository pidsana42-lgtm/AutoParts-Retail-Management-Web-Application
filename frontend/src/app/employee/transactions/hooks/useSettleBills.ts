import { useState, useEffect, useCallback, useMemo } from "react";
import apiClient from "../../../../service/http/apiClient";
import { posApiService } from "../../../../service/http/pos/pos_service";
import type { UnpaidBillItem } from "../../../../interface/pos/settle_bills_interface";
import type { CustomerDiscountResponse } from "../../../../interface/pos/customer_interface";

export interface SettleCustomerSuggestion {
  id: number;
  customer_name: string;
  phone_number?: string;
  customer_type?: string;
  current_debt_amount?: number;
}

export interface SettleBillSuggestion {
  order_id: number;
  order_number: string;
  order_date: string;
  customer_id?: number;
  customer_name: string;
  balance_due: number;
  total_amount: number;
  payment_status: string;
}

export interface SettleSearchSuggestions {
  customers: SettleCustomerSuggestion[];
  bills: SettleBillSuggestion[];
}

export const useSettleBills = (initialCustomerId: number | null = null) => {
  // --- Search & Filter States ---
  const [searchQuery, setSearchQuery] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(initialCustomerId);
  const [singleBillMode, setSingleBillMode] = useState<boolean>(false);

  // --- Live Search Dropdown States ---
  const [searchSuggestions, setSearchSuggestions] = useState<SettleSearchSuggestions>({
    customers: [],
    bills: [],
  });
  const [, setIsSearchingBills] = useState(false);

  // --- Data States ---
  const [bills, setBills] = useState<UnpaidBillItem[]>([]);
  const [customerName, setCustomerName] = useState<string>("");
  const [selectedBillIds, setSelectedBillIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // --- Partial Payment / Custom Amounts Per Bill ---
  // maps order_id -> numeric pay_amount
  const [customPayAmounts, setCustomPayAmounts] = useState<Record<number, number>>({});
  // maps order_id -> string value in input while typing
  const [customPayDisplay, setCustomPayDisplay] = useState<Record<number, string>>({});

  // --- Payment States ---
  const [paymentMethodId, setPaymentMethodId] = useState<number>(1);
  const [receivedAmount, setReceivedAmount] = useState<number>(0);
  const [displayValue, setDisplayValue] = useState<string>("");
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- QR Code States ---
  const [qrCodeData, setQrCodeData] = useState<{ qrCode: string; refNo: string; amount: number } | null>(null);
  const [isLoadingQR, setIsLoadingQR] = useState(false);

  // 1. ดึงรายการบิลค้างชำระทั้งหมดของลูกค้า (All unpaid bills of customer)
  const fetchUnpaidBills = useCallback(async (targetCustomerId: number) => {
    setIsLoading(true);
    try {
      const res = await posApiService.getUnpaidBillsByCustomer(targetCustomerId);
      const fetchedBills = res.bills || [];
      setBills(fetchedBills);
      setCustomerName(res.customer_name || "");
      setCustomerId(res.customer_id);
      setSingleBillMode(false);
      setSelectedBillIds([]);

      // ตั้งค่ายอดจ่ายเริ่มต้นตามยอดค้างชำระของแต่ละบิล
      const initialAmounts: Record<number, number> = {};
      const initialDisplay: Record<number, string> = {};
      fetchedBills.forEach((b) => {
        initialAmounts[b.order_id] = b.balance_due;
        initialDisplay[b.order_id] = b.balance_due.toFixed(2);
      });
      setCustomPayAmounts(initialAmounts);
      setCustomPayDisplay(initialDisplay);
    } catch (err) {
      console.error("Failed to load unpaid bills:", err);
      setBills([]);
      setCustomerName("");
      setCustomPayAmounts({});
      setCustomPayDisplay({});
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 2. ดึงรายการบิลค้างชำระเจาะจงเฉพาะบิลเดียว (Single bill by orderNumber / barcode scan)
  const fetchSingleUnpaidBill = useCallback(async (orderNumber: string) => {
    const cleaned = orderNumber.trim();
    if (!cleaned) return;

    setIsLoading(true);
    try {
      const res = await posApiService.getUnpaidBillByOrderNumber(cleaned);
      const fetchedBills = res.bills || [];
      if (fetchedBills.length === 0) {
        alert(`ไม่พบบิลเลขที่ ${cleaned} หรือบิลนี้ไม่มียอดค้างชำระ`);
        return;
      }

      setBills(fetchedBills);
      setCustomerName(res.customer_name || "");
      setCustomerId(res.customer_id);
      setSingleBillMode(true);

      // เลือกบิลนั้นทันที
      const singleId = fetchedBills[0].order_id;
      const singleDue = fetchedBills[0].balance_due;
      setSelectedBillIds([singleId]);
      setCustomPayAmounts({ [singleId]: singleDue });
      setCustomPayDisplay({ [singleId]: singleDue.toFixed(2) });
      setSearchSuggestions({ customers: [], bills: [] });
    } catch (err: any) {
      console.error("Failed to load single unpaid bill:", err);
      alert(err?.response?.data?.error || `ไม่พบบิลเลขที่ ${cleaned} หรือบิลนี้ถูกยกเลิก/ชำระแล้ว`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // โหลดข้อมูลเมื่อ customerId เปลี่ยนแปลงตอนเปิดหน้าครั้งแรก (ถ้ามี)
  useEffect(() => {
    if (customerId && !singleBillMode && bills.length === 0) {
      fetchUnpaidBills(customerId);
    }
  }, [customerId, singleBillMode, bills.length, fetchUnpaidBills]);

  // ค้นหาแบบ Live Dropdown แนะนำ (ทั้งลูกค้า และ บิล)
  const triggerLiveSearch = useCallback(async (query: string) => {
    const cleaned = query.trim();
    if (cleaned.length === 0) {
      setSearchSuggestions({ customers: [], bills: [] });
      return;
    }
    setIsSearchingBills(true);
    try {
      // 1. ค้นหาประวัติการขายที่มียอดค้างชำระ (บิลเงินเชื่อ ไม่รวมบิลที่ยกเลิก)
      const salesPromise = posApiService.getSalesHistory({ search: cleaned, limit: 10, page: 1 });
      // 2. ค้นหาลูกค้า
      const customerPromise = apiClient
        .get<CustomerDiscountResponse[]>(`/pos/customer-discount?search=${encodeURIComponent(cleaned)}`)
        .then((r) => r.data || [])
        .catch(() => []);

      const [salesRes, customerRes] = await Promise.all([salesPromise, customerPromise]);

      // กรองเฉพาะบิลค้างชำระ และไม่รวมบิลที่ยกเลิก (status != cancelled & pending_cancel)
      const unpaidBills: SettleBillSuggestion[] = (salesRes.items || [])
        .filter(
          (item: any) =>
            item.balance_due > 0 &&
            item.payment_status !== "paid" &&
            item.status !== "cancelled" &&
            item.status !== "pending_cancel"
        )
        .map((item: any) => ({
          order_id: item.id,
          order_number: item.order_number,
          order_date: item.order_date || item.created_at,
          customer_id: item.customer_id,
          customer_name: item.customer_name || item.customer_name_temp || "—",
          balance_due: item.balance_due,
          total_amount: item.total_amount,
          payment_status: item.payment_status,
        }));

      // กรองรายชื่อลูกค้าที่ค้นหาเจอ (และรวมลูกค้าที่ได้จากบิลค้างชำระด้วย)
      const customerMap = new Map<number, SettleCustomerSuggestion>();

      (customerRes || []).forEach((c: any) => {
        if (c.id && c.id > 0) {
          customerMap.set(c.id, {
            id: c.id,
            customer_name: c.customer_name,
            phone_number: c.phone_number,
            customer_type: c.customer_type?.type_label,
            current_debt_amount: c.current_debt_amount,
          });
        }
      });

      unpaidBills.forEach((b) => {
        if (b.customer_id && b.customer_id > 0 && !customerMap.has(b.customer_id)) {
          customerMap.set(b.customer_id, {
            id: b.customer_id,
            customer_name: b.customer_name,
            current_debt_amount: b.balance_due,
          });
        }
      });

      setSearchSuggestions({
        customers: Array.from(customerMap.values()).slice(0, 5),
        bills: unpaidBills.slice(0, 8),
      });
    } catch (err) {
      console.error("Failed to live search:", err);
      setSearchSuggestions({ customers: [], bills: [] });
    } finally {
      setIsSearchingBills(false);
    }
  }, []);

  // Handler: เมื่อเลือก "ลูกค้า" จาก Dropdown -> แสดงรายการทั้งหมดของลูกค้านั้น
  const handleSelectCustomer = (cust: SettleCustomerSuggestion) => {
    setCustomerId(cust.id);
    setCustomerName(cust.customer_name);
    setSearchQuery("");
    setSearchSuggestions({ customers: [], bills: [] });
    setSingleBillMode(false);
    fetchUnpaidBills(cust.id);
  };

  // Handler: เมื่อเลือก "บิล" จาก Dropdown หรือจากการสแกน -> ขึ้นแค่บิลนั้นบิลเดียว
  const handleSelectBill = (bill: SettleBillSuggestion) => {
    setSearchQuery(bill.order_number);
    setSearchSuggestions({ customers: [], bills: [] });
    fetchSingleUnpaidBill(bill.order_number);
  };

  // Handler: เมื่อกดค้นหาหรือกด Enter ในช่องค้นหา
  const handleSearchSubmit = async () => {
    const q = searchQuery.trim();
    if (!q) return;

    setSearchSuggestions({ customers: [], bills: [] });

    // ถ้าข้อความค้นหาดูเป็นเลขที่คำสั่งซื้อ/บาร์โค้ด (เช่น ขึ้นต้นด้วย INV หรือมีขีด หรือเป็นตัวเลข)
    const isOrderLike = q.toUpperCase().startsWith("INV") || q.includes("-");

    if (isOrderLike) {
      // ลองค้นหาเป็นบิลเดียวก่อน
      try {
        const res = await posApiService.getUnpaidBillByOrderNumber(q);
        if (res.bills && res.bills.length > 0) {
          setBills(res.bills);
          setCustomerName(res.customer_name || "");
          setCustomerId(res.customer_id);
          setSingleBillMode(true);
          const singleId = res.bills[0].order_id;
          const singleDue = res.bills[0].balance_due;
          setSelectedBillIds([singleId]);
          setCustomPayAmounts({ [singleId]: singleDue });
          setCustomPayDisplay({ [singleId]: singleDue.toFixed(2) });
          return;
        }
      } catch {
        // หากไม่เจอบิล ให้ลองค้นหาด้วยชื่อลูกค้าต่อไป
      }
    }

    // ค้นหาตามชื่อลูกค้า
    try {
      const custRes = await apiClient
        .get<CustomerDiscountResponse[]>(`/pos/customer-discount?search=${encodeURIComponent(q)}`)
        .then((r) => r.data || []);

      const exactOrFirst = custRes.find(
        (c) => c.customer_name?.toLowerCase() === q.toLowerCase() || c.phone_number === q
      ) || custRes[0];

      if (exactOrFirst && exactOrFirst.id) {
        setCustomerId(exactOrFirst.id);
        setCustomerName(exactOrFirst.customer_name);
        setSearchQuery("");
        setSingleBillMode(false);
        fetchUnpaidBills(exactOrFirst.id);
        return;
      }
    } catch {
      // ignore
    }

    if (customerId) {
      setSearchQuery("");
      fetchUnpaidBills(customerId);
    } else {
      // ลองเรียกค้นหาบิลเดี่ยวเป็น fallback สุดท้าย
      fetchSingleUnpaidBill(q);
    }
  };

  // ปุ่มกดเพื่อดูบิลทั้งหมดของลูกค้ารายนี้ (กรณีอยู่ใน Single Bill Mode)
  const handleViewAllBillsOfCustomer = () => {
    if (customerId) {
      setSearchQuery("");
      fetchUnpaidBills(customerId);
    }
  };

  // กรองข้อมูลเฉพาะในตาราง
  const filteredBills = useMemo(() => {
    if (singleBillMode) return bills;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return bills;
    // ถ้าข้อความที่พิมพ์เป็นชื่อลูกค้าที่เลือกอยู่ ให้แสดงทุกบิลของลูกค้ารายนั้น
    if (customerName && customerName.toLowerCase().includes(q)) return bills;
    return bills.filter(
      (b) =>
        b.order_number &&
        b.order_number.toLowerCase().includes(q)
    );
  }, [bills, searchQuery, customerName, singleBillMode]);

  // Helper สำหรับดึงยอดที่ต้องการจ่ายของแต่ละบิล
  const getBillPayAmount = useCallback(
    (bill: UnpaidBillItem): number => {
      if (customPayAmounts[bill.order_id] !== undefined) {
        return customPayAmounts[bill.order_id];
      }
      return bill.balance_due || 0;
    },
    [customPayAmounts]
  );

  // คำนวณยอดหนี้รวมทั้งหมดของบิลที่เลือก
  const totalSelectedDebt = useMemo(() => {
    return bills
      .filter((b) => selectedBillIds.includes(b.order_id))
      .reduce((sum, b) => sum + (b.balance_due || 0), 0);
  }, [bills, selectedBillIds]);

  // คำนวณยอดที่จะชำระจริงในงวดนี้ (ยอดรวมของ pay_amount แต่ละบิลที่เลือก)
  const totalPayAmount = useMemo(() => {
    return bills
      .filter((b) => selectedBillIds.includes(b.order_id))
      .reduce((sum, b) => sum + getBillPayAmount(b), 0);
  }, [bills, selectedBillIds, getBillPayAmount]);

  // หนี้คงเหลือหลังชำระงวดนี้
  const remainingDebtAfterPay = useMemo(() => {
    const rem = totalSelectedDebt - totalPayAmount;
    return rem > 0 ? rem : 0;
  }, [totalSelectedDebt, totalPayAmount]);

  // จัดการการเปลี่ยนยอดชำระของบิลแต่ละใบ
  const handleBillPayAmountChange = (orderId: number, valueStr: string) => {
    const sanitized = valueStr.replace(/[^0-9.]/g, "");
    // ป้องกันจุดทศนิยมซ้ำ
    if ((sanitized.match(/\./g) || []).length > 1) return;

    setCustomPayDisplay((prev) => ({ ...prev, [orderId]: sanitized }));

    if (sanitized === "" || isNaN(Number(sanitized))) {
      setCustomPayAmounts((prev) => ({ ...prev, [orderId]: 0 }));
      return;
    }

    const val = parseFloat(sanitized);
    setCustomPayAmounts((prev) => ({ ...prev, [orderId]: Math.max(0, val) }));
  };

  // เมื่อหลุดโฟกัสจากช่องกรอกยอดชำระของบิล
  const handleBillPayAmountBlur = (orderId: number, maxBalance: number) => {
    const currentVal = customPayAmounts[orderId];
    if (currentVal === undefined || currentVal <= 0) {
      // ถ้าไม่ได้กรอกหรือเป็น 0 ให้กลับเป็นค่าเต็มจำนวน
      setCustomPayAmounts((prev) => ({ ...prev, [orderId]: maxBalance }));
      setCustomPayDisplay((prev) => ({ ...prev, [orderId]: maxBalance.toFixed(2) }));
    } else if (currentVal > maxBalance) {
      // ถ้ากรอกเกิน ให้ปัดกลับมาไม่เกินยอดค้างชำระ
      setCustomPayAmounts((prev) => ({ ...prev, [orderId]: maxBalance }));
      setCustomPayDisplay((prev) => ({ ...prev, [orderId]: maxBalance.toFixed(2) }));
    } else {
      // จัดฟอร์แมต 2 ตำแหน่ง
      setCustomPayDisplay((prev) => ({ ...prev, [orderId]: currentVal.toFixed(2) }));
    }
  };

  // ปุ่มกดเพื่อใส่ยอดเต็มจำนวนทันที
  const handleSetFullAmount = (orderId: number, balanceDue: number) => {
    setCustomPayAmounts((prev) => ({ ...prev, [orderId]: balanceDue }));
    setCustomPayDisplay((prev) => ({ ...prev, [orderId]: balanceDue.toFixed(2) }));
  };

  const handleToggleSelect = (id: number) => {
    setSelectedBillIds((prev) => {
      const isAlreadySelected = prev.includes(id);
      if (isAlreadySelected) {
        return prev.filter((item) => item !== id);
      } else {
        // หากเลือกบิลใหม่ ถ้ายังไม่มียอด pay_amount ให้ตั้งค่าเริ่มต้นเท่ากับ balance_due
        const targetBill = bills.find((b) => b.order_id === id);
        if (targetBill && customPayAmounts[id] === undefined) {
          setCustomPayAmounts((curr) => ({ ...curr, [id]: targetBill.balance_due }));
          setCustomPayDisplay((curr) => ({ ...curr, [id]: targetBill.balance_due.toFixed(2) }));
        }
        return [...prev, id];
      }
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedBillIds.length === filteredBills.length && filteredBills.length > 0) {
      setSelectedBillIds([]);
    } else {
      const allIds = filteredBills.map((b) => b.order_id);
      setSelectedBillIds(allIds);
      const newAmounts = { ...customPayAmounts };
      const newDisplay = { ...customPayDisplay };
      filteredBills.forEach((b) => {
        if (newAmounts[b.order_id] === undefined || newAmounts[b.order_id] <= 0) {
          newAmounts[b.order_id] = b.balance_due;
          newDisplay[b.order_id] = b.balance_due.toFixed(2);
        }
      });
      setCustomPayAmounts(newAmounts);
      setCustomPayDisplay(newDisplay);
    }
  };

  // ฟังก์ชันยิง API สร้าง PromptPay QR Code จริงสำหรับยอดชำระงวดนี้
  const generateSettleQR = useCallback(async (amount: number) => {
    if (amount <= 0) return;
    setIsLoadingQR(true);
    try {
      const res = await posApiService.generateSettleQR({
        amount: amount,
        customer_id: customerId ?? undefined,
        received_by_id: 1,
      });
      setQrCodeData({
        qrCode: res.qr_code,
        refNo: res.reference_number,
        amount: res.amount,
      });
    } catch (err) {
      console.error("Failed to generate settle PromptPay QR:", err);
      alert("ไม่สามารถสร้าง QR Code สำหรับชำระเงินได้");
      setQrCodeData(null);
    } finally {
      setIsLoadingQR(false);
    }
  }, [customerId]);

  // เปิด Modal รับชำระ
  const handleOpenModal = () => {
    if (totalPayAmount <= 0) {
      alert("กรุณาระบุยอดชำระที่มากกว่า 0 บาท");
      return;
    }
    setReceivedAmount(totalPayAmount);
    setDisplayValue(
      totalPayAmount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
    setIsPaymentModalOpen(true);

    // หากเลือกวิธีชำระเป็น QR Code ให้เรียกสร้าง QR Code จริงทันที
    if (paymentMethodId === 2) {
      generateSettleQR(totalPayAmount);
    }
  };

  // เปลี่ยนวิธีชำระเงิน
  const handleSelectPaymentMethod = (methodId: number) => {
    setPaymentMethodId(methodId);
    if (methodId === 2 && isPaymentModalOpen) {
      generateSettleQR(totalPayAmount);
    }
  };

  const handleCloseModal = () => {
    setIsPaymentModalOpen(false);
    setQrCodeData(null);
  };

  // ยืนยันการชำระเงินและตัดยอดหนี้
  const handleFinalConfirm = async (receivedById: number = 1) => {
    if (!customerId || selectedBillIds.length === 0) return;
    if (totalPayAmount <= 0) {
      alert("ยอดชำระรวมต้องมากกว่า 0 บาท");
      return;
    }

    if (paymentMethodId === 1 && receivedAmount < totalPayAmount) {
      alert(`จำนวนเงินที่รับมาไม่ครบ (รับมา ฿${receivedAmount.toLocaleString()} / ยอดชำระ ฿${totalPayAmount.toLocaleString()})`);
      return;
    }

    const selectedBills = bills.filter((b) => selectedBillIds.includes(b.order_id));
    
    // ตรวจสอบยอดชำระของแต่ละบิล
    const allocations = [];
    for (const b of selectedBills) {
      const payAmt = getBillPayAmount(b);
      if (payAmt <= 0) {
        alert(`ยอดชำระของบิล ${b.order_number} ต้องมากกว่า 0 บาท`);
        return;
      }
      if (payAmt > b.balance_due) {
        alert(`ยอดชำระของบิล ${b.order_number} (฿${payAmt.toFixed(2)}) เกินยอดหนี้คงค้าง (฿${b.balance_due.toFixed(2)})`);
        return;
      }
      allocations.push({
        order_id: b.order_id,
        pay_amount: payAmt,
      });
    }

    setIsSubmitting(true);
    const payload = {
      customer_id: customerId,
      received_by_id: receivedById,
      payment_method_id: paymentMethodId,
      total_received: paymentMethodId === 1 ? (receivedAmount || totalPayAmount) : totalPayAmount,
      transaction_ref: paymentMethodId === 2 ? qrCodeData?.refNo : undefined,
      allocations: allocations,
    };

    try {
      const res = await posApiService.settleCustomerBills(payload);
      alert(`บันทึกชำระเงินสำเร็จ!\nเลขที่ใบเสร็จ: ${res.receipt_number}\nยอดชำระ: ฿${res.total_received.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท`);
      setIsPaymentModalOpen(false);
      setQrCodeData(null);
      if (customerId) {
        fetchUnpaidBills(customerId);
      }
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
    setPaymentMethodId: handleSelectPaymentMethod,
    receivedAmount,
    setReceivedAmount,
    displayValue,
    setDisplayValue,
    isPaymentModalOpen,
    isSubmitting,
    totalSelectedDebt,
    totalPayAmount,
    remainingDebtAfterPay,
    customPayAmounts,
    customPayDisplay,
    getBillPayAmount,
    handleBillPayAmountChange,
    handleBillPayAmountBlur,
    handleSetFullAmount,
    searchSuggestions,
    triggerLiveSearch,
    handleSelectCustomer,
    handleSelectBill,
    handleSearchSubmit,
    singleBillMode,
    handleViewAllBillsOfCustomer,
    fetchUnpaidBills,
    fetchSingleUnpaidBill,
    handleToggleSelect,
    handleToggleSelectAll,
    handleOpenModal,
    handleCloseModal,
    handleFinalConfirm,
    qrCodeData,
    isLoadingQR,
    generateSettleQR,
  };
};