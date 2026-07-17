import { useState, useEffect, useMemo } from "react";
import apiClient from "../../../../service/http/apiClient";
import { posApiService } from "../../../../service/http/pos/pos_service";
import { useDiscountCalculation } from "./useDiscountCalculation"; // 1. นำเข้าเครื่องคิดเลขส่วนลด
import type { CustomerDiscountResponse, CustomerTypeInterface } from "../../../../interface/pos/customer_interface";
import type { StoreConfigInterface } from "../../../../interface/pos/store_config_interface";
import type { CreateSaleOrderRequest } from "../../../../interface/pos/pos_interface";
import type { CartItem } from "../../../../interface/pos/usePosCart.interface";
import type { PosSession } from "../../../../interface/pos/pos_session_interface"; 

interface UsePosPaymentProps {
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  totalItemPrice: number;
  totalLineDiscount: number;
}

export function usePosPayment({ cart, setCart, totalItemPrice, totalLineDiscount }: UsePosPaymentProps) {
  // LOCAL STATES
  const [customer, setCustomer] = useState<CustomerDiscountResponse | null>(null);
  const [searchCustomerQuery, setSearchCustomerQuery] = useState<string>("");
  const [tempPhone, setTempPhone] = useState<string>("");
  const [customerTypes, setCustomerTypes] = useState<CustomerTypeInterface[]>([]);
  const [activeTypeId, setActiveTypeId] = useState<number>(1);
  const [selectedPaymentType, setSelectedPaymentType] = useState<"CASH" | "CREDIT">("CASH");
  const [paymentMethodId, setPaymentMethodId] = useState<number>(1);
  const [billDiscountValue, setBillDiscountValue] = useState<number>(0.0);
  const [billDiscountType, setBillDiscountType] = useState<"none" | "percentage" | "amount">("none");
  const [storeConfig, setStoreConfig] = useState<StoreConfigInterface | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [receivedAmount, setReceivedAmount] = useState<number>(0);
  const [receiverName, setReceiverName] = useState<string>("");
  const [searchResults, setSearchResults] = useState<CustomerDiscountResponse[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<{ id: number; method_name: string }[]>([]);
  const [displayValue, setDisplayValue] = useState<string>("");

  // 2. เรียกใช้งานฟังก์ชันกระจายส่วนลดท้ายบิลจากเครื่องคิดเลข
  const { calculateProRataWeight } = useDiscountCalculation();

  const [posSession, setPosSession] = useState<PosSession>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pos_session");
      return saved ? JSON.parse(saved) : {
        customer: null, activeTypeId: 1, paymentMethodId: 1, billDiscountValue: 0, billDiscountType: "none", receivedAmount: 0, receiverName: ""
      };
    }
    return { customer: null, activeTypeId: 1, paymentMethodId: 1, billDiscountValue: 0, billDiscountType: "none", receivedAmount: 0, receiverName: "" };
  });

  const resetPaymentState = () => {
    setCustomer(null);
    setSearchCustomerQuery("");
    setTempPhone("");
    setActiveTypeId(1);
    setSelectedPaymentType("CASH");
    setPaymentMethodId(1);
    setBillDiscountValue(0);
    setBillDiscountType("none");
    setReceivedAmount(0);
    setReceiverName("");
    setSearchResults([]);
    setDisplayValue("");

    setPosSession({
      customer: null,
      searchQuery: "",
      activeTypeId: 1,
      paymentMethodId: 1,
      billDiscountValue: 0,
      billDiscountType: "none",
      receivedAmount: 0,
      receiverName: ""
    });

    // 3. ล้างแคชใน Browser
    localStorage.removeItem("pos_session");
  };

  // INITIAL FETCH EFFECTS
  useEffect(() => {
    posApiService.getCustomerTypes().then(setCustomerTypes).catch(err => console.error(err));
    posApiService.getPaymentMethods().then(setPaymentMethods).catch(err => console.error(err));
    posApiService.getStoreConfig().then(setStoreConfig).catch(err => console.error(err));
  }, []);

  useEffect(() => {
    localStorage.setItem("pos_session", JSON.stringify(posSession));
  }, [posSession]);

  useEffect(() => {
    setCustomer(posSession.customer);
    setActiveTypeId(posSession.activeTypeId);
    setPaymentMethodId(posSession.paymentMethodId);
    setBillDiscountValue(posSession.billDiscountValue);
    setBillDiscountType(posSession.billDiscountType);
    setReceivedAmount(posSession.receivedAmount);
    setReceiverName(posSession.receiverName);
  }, [posSession]);

  // ─── COMPUTED VALUES ───
  const computedBillDiscount = useMemo(() => {
    const remainingAfterLineDiscount = totalItemPrice - totalLineDiscount;
    if (billDiscountType === "amount") return billDiscountValue;
    if (billDiscountType === "percentage") return (remainingAfterLineDiscount * billDiscountValue) / 100;
    return 0;
  }, [billDiscountType, billDiscountValue, totalItemPrice, totalLineDiscount]);

  const finalTotal = useMemo(() => {
    const total = totalItemPrice - totalLineDiscount - computedBillDiscount;
    return total < 0 ? 0 : total;
  }, [totalItemPrice, totalLineDiscount, computedBillDiscount]);

  const change = useMemo(() => {
    const result = receivedAmount - finalTotal;
    return result > 0 ? result : 0;
  }, [receivedAmount, finalTotal]);

  // ─── CORE FUNCTIONS ───
  const handleSearchCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedQuery = searchCustomerQuery.trim();
    if (!cleanedQuery) {
      updateSession("customer", null);
      updateSession("activeTypeId", 1);
      setSearchResults([]);
      setTempPhone("");
      return;
    }

    try {
      const response = await apiClient.get<CustomerDiscountResponse[]>(`/pos/customer-discount?search=${cleanedQuery}`);
      const dataList = response.data;
      const exactMatchedCustomer = dataList && dataList.length > 0 
        ? dataList.find((c) => c.customer_name?.toLowerCase() === cleanedQuery.toLowerCase() || c.phone_number === cleanedQuery)
        : null;

      if (exactMatchedCustomer) {
        updateSession("customer", exactMatchedCustomer);
        if (exactMatchedCustomer.customer_type) updateSession("activeTypeId", exactMatchedCustomer.customer_type.id);
      } else {
        updateSession("customer", {
          id: 0,
          customer_name: cleanedQuery,
          phone_number: tempPhone.trim() || "ลูกค้าทั่วไป (ไม่ระบุ)",
          standard_discount_rate: 0, is_discount_enabled: false, current_debt_amount: 0, max_credit_limit: 0, is_credit_enabled: false,
          customer_type: { id: 1, type_name: "GENERAL", type_label: "ลูกค้าทั่วไป" }
        });
        setActiveTypeId(1);
      }
      setSearchResults([]);
    } catch (error) {
      console.error(error);
    }
  };

  const triggerLiveSearch = async (query: string) => {
    const cleaned = query.trim();
    if (cleaned.length === 0) { return setSearchResults([]); }
    try {
      const response = await apiClient.get<CustomerDiscountResponse[]>(`/pos/customer-discount?search=${cleaned}`);
      setSearchResults(response.data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const handleBillDiscountChange = (valueStr: string) => {
    const inputValue = valueStr === "" ? 0 : parseFloat(valueStr) || 0;
    if (inputValue < 0) return;

    const currentCustomerTypeId = customer?.customer_type?.id || activeTypeId;
    const currentCustomerTypeName = customer?.customer_type?.type_name || "";

    if (currentCustomerTypeId === 3 || currentCustomerTypeName === "WHOLESALE") {
      alert("ลูกค้ากลุ่มบริษัทไม่ได้รับสิทธิ์ส่วนลดใดๆ ทั้งสิ้น");
      setBillDiscountValue(0);
      return;
    }

    const maxExtraConfigRate = storeConfig?.max_extra_discount_rate ?? 6.0;
    const remainingAfterLineDiscount = totalItemPrice - totalLineDiscount;
    const maxDiscountBaht = (remainingAfterLineDiscount * maxExtraConfigRate) / 100;

    let isExceed = false;
    if (billDiscountType === "percentage" && inputValue > maxExtraConfigRate) isExceed = true;
    if (billDiscountType === "amount" && remainingAfterLineDiscount > 0 && inputValue > maxDiscountBaht) isExceed = true;

    if (isExceed) {
      alert(`ส่วนลดท้ายบิลเกินนโยบายร้านค้า\n\nระบบอนุญาตให้ลดสูงสุดไม่เกิน:\n• ${maxExtraConfigRate}% ของยอดรวม\n• หรือไม่เกิน ฿${maxDiscountBaht.toFixed(2)}`);
      updateSession("billDiscountValue", 0);
      return;
    }
    
    updateSession("billDiscountValue", inputValue);
  };

  const handleOpenPaymentModal = () => {
    if (cart.length === 0) return alert("กรุณาเลือกสินค้าลงตะกร้า");
    if (!customer) return alert("กรุณาเลือกบัญชีลูกค้า");

    // ตรวจสอบเช็คโหมดหน้าบ้านกับ ID วิธีชำระเงินให้ตรงกันก่อนเปิด Modal
    let targetMethodId = paymentMethodId;
    if (selectedPaymentType === "CASH" && targetMethodId === 3) {
      targetMethodId = 1;
      updateSession("paymentMethodId", 1);
    }

    updateSession("receivedAmount", 0);
    setReceivedAmount(0);
    setDisplayValue(""); 
    setIsPaymentModalOpen(true); 
  };

  const handleReceivedAmountChange = (value: string) => {
    const rawValue = value.replace(/,/g, "").replace(/[^0-9.]/g, "");
    if ((rawValue.match(/\./g) || []).length > 1) return;
    setDisplayValue(value.replace(/[^0-9.]/g, ""));
    setReceivedAmount(rawValue === "" ? 0 : Number(rawValue));
  };

  const handleReceivedAmountBlur = () => {
    const rounded = Number(receivedAmount.toFixed(2));
    setReceivedAmount(rounded);
    setDisplayValue(rounded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };

  const handleReceivedAmountFocus = () => {
    setDisplayValue(receivedAmount === 0 ? "" : receivedAmount.toString());
  };

  // ย้ายกลไกการกระจายสัดส่วนตัวเลข (Pro-rata) ไปคุยกับเครื่องคิดเลข
  const submitOrderToDatabase = async (currentCart?: CartItem[]) => {
    const targetCart = currentCart || cart;
    if (targetCart.length === 0) return alert("กรุณาเลือกสินค้าลงตะกร้า");
    if (!customer) return alert("กรุณาเลือกบัญชีลูกค้า");
    setIsSubmitting(true);

    const totalSubtotalAfterLineDiscount = totalItemPrice - totalLineDiscount;
    let distributedBillDiscountAccumulator = 0; 

    const computedItems = targetCart.map((item, index) => {
      const lineTotal = item.unit_price * item.qty;
      const itemDiscount = item.discount_type === "percentage" ? (lineTotal * item.discount_value) / 100 : item.discount_value;
      const subtotalAfterLineDiscount = lineTotal - itemDiscount;
      
      let allocatedBillDiscount = 0;

      // เรียกใช้ฟังก์ชันจากเครื่องคิดเลขส่วนลดตรงนี้
      if (totalSubtotalAfterLineDiscount > 0 && computedBillDiscount > 0) {
        if (index === targetCart.length - 1) {
          allocatedBillDiscount = computedBillDiscount - distributedBillDiscountAccumulator; // ลบเศษตัวสุดท้ายป้องกันทศนิยมเคลื่อน
        } else {
          allocatedBillDiscount = calculateProRataWeight(subtotalAfterLineDiscount, totalSubtotalAfterLineDiscount, computedBillDiscount);
          distributedBillDiscountAccumulator += allocatedBillDiscount;
        }
      }

      return {
        product_id: item.product_id,
        product_code: item.product_code,
        product_name: item.product_name,
        qty: item.qty,
        unit_price: item.unit_price,
        discount_type: item.discount_type,
        discount_value: item.discount_value,
        allocated_bill_discount: allocatedBillDiscount, 
        net_subtotal: subtotalAfterLineDiscount - allocatedBillDiscount,
      };
    });

    if (!posSession.customer) {
      alert("กรุณาเลือกลูกค้าก่อนทำรายการ");
      setIsSubmitting(false);
      return;
    }

    let finalPaymentMethodId = posSession.paymentMethodId;
    if (selectedPaymentType === "CASH" || receivedAmount > 0) {
      finalPaymentMethodId = 1; 
    }

    const salePayload: CreateSaleOrderRequest = {
      customer_id: posSession.customer.id,
      customer_name_temp: posSession.customer.customer_name,
      customer_phone_temp: posSession.customer.phone_number,
      received_amount: receivedAmount, 
      payment_method_id: finalPaymentMethodId,
      bill_discount_type: posSession.billDiscountType,
      bill_discount_value: posSession.billDiscountValue,
      note: "บันทึกบิลขายส่งผ่านระบบ POS หน้าร้าน",
      items: computedItems as any,
    };

    try {
      await posApiService.createPOSOrder(salePayload);
      alert("บันทึกข้อมูลการขายสำเร็จ!");
      
      setCart([]);
      localStorage.removeItem("pos_cart");
      localStorage.removeItem("pos_session");
      setPosSession({
        customer: null, searchQuery: "", activeTypeId: 1, paymentMethodId: 1, billDiscountValue: 0, billDiscountType: "none", receivedAmount: 0, receiverName: ""
      });
      
      setCustomer(null);
      setBillDiscountValue(0);
      setBillDiscountType("none");
      setActiveTypeId(1);
      setSelectedPaymentType("CASH");
      setPaymentMethodId(1);
      setSearchCustomerQuery("");
      setTempPhone("");
      setSearchResults([]);
      setIsPaymentModalOpen(false);
      setReceivedAmount(0);
      setReceiverName("");
    } catch (error: any) {
      alert(error.response?.data?.error || "เกิดปัญหาที่ระบบหลังบ้าน");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetBillDiscount = () => {
    setBillDiscountValue(0);
    setBillDiscountType("none");
  };

  const updateSession = (key: keyof PosSession, value: any) => {
    setPosSession((prev: PosSession) => ({ ...prev, [key]: value }));
    if (key === "customer") setCustomer(value);
    if (key === "activeTypeId") setActiveTypeId(value);
    if (key === "paymentMethodId") setPaymentMethodId(value);
    if (key === "billDiscountValue") setBillDiscountValue(value);
    if (key === "billDiscountType") setBillDiscountType(value);
    if (key === "receivedAmount") setReceivedAmount(value);
    if (key === "receiverName") setReceiverName(value);
    if (key === "searchQuery") setSearchCustomerQuery(value);
  };

  return {
    posSession, setPosSession, updateSession,
    customer, setCustomer, paymentMethods, setPaymentMethods,
    searchCustomerQuery, setSearchCustomerQuery, setTempPhone, tempPhone,
    searchResults, setSearchResults, triggerLiveSearch, customerTypes,
    activeTypeId, setActiveTypeId, selectedPaymentType, setSelectedPaymentType,
    paymentMethodId, setPaymentMethodId, billDiscountValue, setBillDiscountValue,
    billDiscountType, setBillDiscountType, isSubmitting, computedBillDiscount,
    finalTotal, totalItemPrice, totalLineDiscount, submitOrderToDatabase,
    handleOpenPaymentModal, resetBillDiscount, isPaymentModalOpen, setIsPaymentModalOpen,
    receivedAmount, setReceivedAmount, receiverName, setReceiverName,
    handleSearchCustomer, handleBillDiscountChange, change, handleReceivedAmountBlur,
    displayValue, setDisplayValue, handleReceivedAmountChange, handleReceivedAmountFocus,
    resetPaymentState
  };
}