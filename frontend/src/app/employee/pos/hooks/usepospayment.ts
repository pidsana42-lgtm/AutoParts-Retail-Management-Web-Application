import { useState, useEffect, useMemo } from "react";
import apiClient from "../../../../service/http/apiClient";
import { posApiService } from "../../../../service/http/pos/pos_service";
import { useDiscountCalculation } from "./useDiscountCalculation";
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
  const { calculateProRataWeight } = useDiscountCalculation();

  // 1. โครงสร้างการดึง Session เริ่มต้นจาก LocalStorage
  const [posSession, setPosSession] = useState<PosSession>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pos_session");
      return saved ? JSON.parse(saved) : {
        customer: null, activeTypeId: 1, paymentMethodId: 1, billDiscountValue: 0, billDiscountType: "none", receivedAmount: 0, receiverName: "", searchQuery: ""
      };
    }
    return { customer: null, activeTypeId: 1, paymentMethodId: 1, billDiscountValue: 0, billDiscountType: "none", receivedAmount: 0, receiverName: "", searchQuery: "" };
  });

  // LOCAL STATES (ยึดถือเอาข้อมูลจาก Session มาแมปใช้งาน)
  const [customer, setCustomer] = useState<CustomerDiscountResponse | null>(posSession.customer);
  const [searchCustomerQuery, setSearchCustomerQuery] = useState<string>(posSession.searchQuery || "");
  const [tempPhone, setTempPhone] = useState<string>("");
  const [customerTypes, setCustomerTypes] = useState<CustomerTypeInterface[]>([]);
  const [activeTypeId, setActiveTypeId] = useState<number>(posSession.activeTypeId);
  // ให้ selectedPaymentType เริ่มต้นค่าตาม paymentMethodId ใน session เลย
  const [selectedPaymentType, setSelectedPaymentType] = useState<"CASH" | "QRCODE" | "CREDIT">(() => {
    if (posSession.paymentMethodId === 2) return "QRCODE";
    if (posSession.paymentMethodId === 3) return "CREDIT";
    return "CASH";
  });
  const [paymentMethodId, setPaymentMethodId] = useState<number>(posSession.paymentMethodId);
  const [billDiscountValue, setBillDiscountValue] = useState<number>(posSession.billDiscountValue);
  const [billDiscountType, setBillDiscountType] = useState<"none" | "percentage" | "amount">(posSession.billDiscountType);
  const [storeConfig, setStoreConfig] = useState<StoreConfigInterface | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [receivedAmount, setReceivedAmount] = useState<number>(posSession.receivedAmount);
  const [receiverName, setReceiverName] = useState<string>(posSession.receiverName);
  const [searchResults, setSearchResults] = useState<CustomerDiscountResponse[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<{ id: number; method_name: string }[]>([]);
  const [displayValue, setDisplayValue] = useState<string>("");
  const [qrCodeData, setQrCodeData] = useState<{ qrCode: string; refNo: string } | null>(null);
  const [isLoadingQR, setIsLoadingQR] = useState<boolean>(false);
  const [hasAttemptedQR, setHasAttemptedQR] = useState<boolean>(false);

  // บันทึกการเปลี่ยนแปลง Session ลงแคชเครื่องเสมอ
  useEffect(() => {
    localStorage.setItem("pos_session", JSON.stringify(posSession));
  }, [posSession]);

  // ซิงค์ selectedPaymentType ให้ตรงกับ paymentMethodId ใน session เสมอ
  useEffect(() => {
    setCustomer(posSession.customer);
    setActiveTypeId(posSession.activeTypeId);
    setPaymentMethodId(posSession.paymentMethodId);
    setBillDiscountValue(posSession.billDiscountValue);
    setBillDiscountType(posSession.billDiscountType);
    setReceivedAmount(posSession.receivedAmount);
    setReceiverName(posSession.receiverName);
    setSearchCustomerQuery(posSession.searchQuery || "");

    // ซิงค์ Type ให้สัมพันธ์กับ ID
    if (posSession.paymentMethodId === 2) {
      setSelectedPaymentType("QRCODE");
    } else if (posSession.paymentMethodId === 3) {
      setSelectedPaymentType("CREDIT");
    } else {
      setSelectedPaymentType("CASH");
    }
  }, [posSession]);

  // FETCH MASTER DATA
  useEffect(() => {
    posApiService.getCustomerTypes().then(setCustomerTypes).catch(err => console.error(err));
    posApiService.getPaymentMethods().then(setPaymentMethods).catch(err => console.error(err));
    posApiService.getStoreConfig().then(setStoreConfig).catch(err => console.error(err));
  }, []);

  // ตรวจสอบว่าลูกค้าคนนี้เป็น Guest หรือไม่ (ID = 0 หรือ null)
  const isRegisteredCustomer = useMemo(() => {
    return Boolean(customer && customer.id > 0);
  }, [customer]);

  useEffect(() => {
    if (paymentMethodId === 3 && !isRegisteredCustomer) {
      updateSession("paymentMethodId", 1);
      setSelectedPaymentType("CASH");
    }
  }, [paymentMethodId, isRegisteredCustomer]);

  // ล้างแฟล็กและข้อมูล QR Code เมื่อปิด Modal
  useEffect(() => {
    if (!isPaymentModalOpen) {
      setHasAttemptedQR(false);
      setQrCodeData(null);
    }
  }, [isPaymentModalOpen]);

  // ─── AUTO GENERATE QR CODE EFFECT (เด้งสร้างให้อัตโนมัติเมื่อเปิด Modal QR) ───
  useEffect(() => {
    if (isPaymentModalOpen && paymentMethodId === 2 && !qrCodeData && !isLoadingQR && !hasAttemptedQR) {
      const autoGenerateQR = async () => {
        setHasAttemptedQR(true); // ล็อกไว้ไม่ให้ยิงวนซ้ำ
        setIsLoadingQR(true);
        try {
          // 1. ยิงบันทึก Order ก่อนเพื่อเอา order_id จริงจาก DB
          const orderId = await submitOrderToDatabase();
          if (orderId) {
            // 2. นำ order_id ที่ได้ไปขอ QR Code
            await handleGeneratePromptPayQR(orderId, 1);
          }
        } catch (error) {
          console.error("Auto generate QR failed:", error);
        } finally {
          setIsLoadingQR(false);
        }
      };

      autoGenerateQR();
    }
  }, [isPaymentModalOpen, paymentMethodId, qrCodeData, isLoadingQR, hasAttemptedQR]);

  // ─── COMPUTED VALUES ───
  const computedBillDiscount = useMemo(() => {
    const remainingAfterLineDiscount = totalItemPrice - totalLineDiscount;
    if (billDiscountType === "amount") return billDiscountValue;
    if (billDiscountType === "percentage") return (remainingAfterLineDiscount * billDiscountValue) / 100;
    return 0;
  }, [billDiscountType, billDiscountValue, totalItemPrice, totalLineDiscount]);

  const finalTotal = useMemo(() => {
    const total = totalItemPrice - totalLineDiscount - computedBillDiscount;
    return total < 0 ? 0 : Math.round(total * 100) / 100; // ป้องกันเศษทศนิยมปัดไม่ลงตัว
  }, [totalItemPrice, totalLineDiscount, computedBillDiscount]);

  const creditDueDate = useMemo(() => {
    const maxDays = storeConfig?.max_overdue_days ?? 30;
    const date = new Date();
    date.setDate(date.getDate() + maxDays);
    return date;
  }, [storeConfig]);

  const formattedCreditDueDate = useMemo(() => {
    if (!creditDueDate) return "";
    return creditDueDate.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, [creditDueDate]);

  const isExceedCreditLimit = useMemo(() => {
    if (!customer || !storeConfig) return false;
    const projectDebt = (customer.current_debt_amount || 0) + finalTotal;
    const maxCredit = customer.max_credit_limit > 0 ? customer.max_credit_limit : storeConfig.max_credit;
    return projectDebt > maxCredit;
  }, [customer, storeConfig, finalTotal]);

  const change = useMemo(() => {
    const result = receivedAmount - finalTotal;
    return result > 0 ? Math.round(result * 100) / 100 : 0;
  }, [receivedAmount, finalTotal]);

  // ─── CORE FUNCTIONS ───
  const updateSession = (key: keyof PosSession, value: any) => {
    setPosSession((prev: PosSession) => ({ ...prev, [key]: value }));
  };

  // ฟังก์ชันเลือกวิธีการชำระเงิน
  const selectPaymentMethod = (methodId: number) => {
    if (methodId === 3 && !isRegisteredCustomer) {
      alert("สิทธิ์ชำระด้วยเงินเชื่อเฉพาะลูกค้าที่เป็นสมาชิกเท่านั้น กรุณาเลือกลูกค้า หรือลงทะเบียนสมัครสมาชิกก่อนทำรายการ");
      return false;
    }
    updateSession("paymentMethodId", methodId);
    // กำหนดประเภทการชำระเงินตาม ID ของวิธีการชำระเงิน
    if (methodId === 1 ) {
      setSelectedPaymentType("CASH");
    }else if (methodId === 2) {
      setSelectedPaymentType("QRCODE");
    }
    else if (methodId === 3) {
      setSelectedPaymentType("CREDIT");
    }
    return true;
  }

  const handleSearchCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedQuery = searchCustomerQuery.trim();
    if (!cleanedQuery) {
      setPosSession({
        customer: null, searchQuery: "", activeTypeId: 1, paymentMethodId: 1, billDiscountValue: 0, billDiscountType: "none", receivedAmount: 0, receiverName: ""
      });
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
        setPosSession((prev) => ({
          ...prev,
          customer: exactMatchedCustomer,
          activeTypeId: exactMatchedCustomer.customer_type?.id || 1,
          searchQuery: exactMatchedCustomer.customer_name
        }));
      } else {
        // เคสลูกค้าทั่วไป/ขาจร คีย์มือสร้างชั่วคราว
        const guestCustomer = {
          id: 0,
          customer_name: cleanedQuery,
          phone_number: tempPhone.trim() || "ลูกค้าทั่วไป (ไม่ระบุ)",
          standard_discount_rate: 0, is_discount_enabled: false, current_debt_amount: 0, max_credit_limit: 0, is_credit_enabled: false,
          customer_type: { id: 1, type_name: "GENERAL", type_label: "ลูกค้าทั่วไป" }
        };
        setPosSession((prev) => ({
          ...prev,
          customer: guestCustomer,
          activeTypeId: 1,
          searchQuery: cleanedQuery
        }));
      }
      setSearchResults([]);
    } catch (error) {
      console.error(error);
    }
  };

  const triggerLiveSearch = async (query: string) => {
    const cleaned = query.trim();
    updateSession("searchQuery", query);
    if (cleaned.length === 0) return setSearchResults([]);
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
      updateSession("billDiscountValue", 0);
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

    let targetMethodId = paymentMethodId;
    if (selectedPaymentType === "CASH" && targetMethodId === 3) {
      targetMethodId = 1;
      updateSession("paymentMethodId", 1);
    }

    updateSession("receivedAmount", 0);
    setDisplayValue(""); 
    setIsPaymentModalOpen(true); 
  };

  const handleGeneratePromptPayQR = async (orderId: number, receivedById: number) => {
    try {
      setIsLoadingQR(true);
      const res = await posApiService.generatePromptPayQR(orderId, receivedById);
      setQrCodeData({
        qrCode: res.qr_code || res.qrCodeBase64,
        refNo: res.reference_number || res.referenceNumber
      });
    } catch (error: any) {
      console.error("Error generating QR:", error);
    } finally {
      setIsLoadingQR(false);
    }
  };

  const handleReceivedAmountChange = (value: string) => {
    const rawValue = value.replace(/,/g, "").replace(/[^0-9.]/g, "");
    if ((rawValue.match(/\./g) || []).length > 1) return;
    setDisplayValue(value.replace(/[^0-9.]/g, ""));
    updateSession("receivedAmount", rawValue === "" ? 0 : Number(rawValue));
  };

  const handleReceivedAmountBlur = () => {
    const rounded = Number(receivedAmount.toFixed(2));
    updateSession("receivedAmount", rounded);
    setDisplayValue(rounded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };

  const handleReceivedAmountFocus = () => {
    setDisplayValue(receivedAmount === 0 ? "" : receivedAmount.toString());
  };

  // ย้ายกลไกการกระจายสัดส่วนตัวเลข (Pro-rata) ไปคุยกับเครื่องคิดเลข
  const submitOrderToDatabase = async (currentCart?: CartItem[]) => {
    const targetCart = currentCart || cart;
    if (targetCart.length === 0) return alert("กรุณาเลือกสินค้าลงตะกร้า");

    // ยึดตาม posSession.paymentMethodId เป็นหลัก
    const finalPaymentMethodId = posSession.paymentMethodId;

    // ตรวจสอบเฉพาะ "เงินสด" (ID = 1) เท่านั้น
    if (finalPaymentMethodId === 1) {
      if (!receivedAmount || receivedAmount <= 0) {
        alert("กรุณากรอกจำนวนเงินที่รับมา");
        return null;
      }

      // เปลี่ยนจาก finalTotalAmount เป็น finalTotal
      if (receivedAmount < finalTotal) {
        alert(`จำนวนเงินที่รับมาไม่ครบ (รับมา ฿${receivedAmount.toLocaleString()} / ยอดชำระ ฿${finalTotal.toLocaleString()})`);
        return null;
      }
    }

    setIsSubmitting(true);

    const totalSubtotalAfterLineDiscount = totalItemPrice - totalLineDiscount;
    let distributedBillDiscountAccumulator = 0; 

    const computedItems = targetCart.map((item, index) => {
      const lineTotal = item.unit_price * item.qty;
      const itemDiscount = item.discount_type === "percentage" ? (lineTotal * item.discount_value) / 100 : item.discount_value;
      const subtotalAfterLineDiscount = lineTotal - itemDiscount;
      
      let allocatedBillDiscount = 0;

      if (totalSubtotalAfterLineDiscount > 0 && computedBillDiscount > 0) {
        if (index === targetCart.length - 1) {
          allocatedBillDiscount = computedBillDiscount - distributedBillDiscountAccumulator;
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
        net_subtotal: Math.round((subtotalAfterLineDiscount - allocatedBillDiscount) * 100) / 100,
      };
    });

    const rawCustomerId = posSession.customer?.id || 0;
    const salePayload: CreateSaleOrderRequest = {
      customer_id: rawCustomerId && rawCustomerId > 0 ? rawCustomerId : (null as any),
      customer_name_temp: posSession.customer?.customer_name || "ลูกค้าทั่วไป",
      customer_phone_temp: posSession.customer?.phone_number || "",
      received_amount: finalPaymentMethodId === 1 ? receivedAmount : finalTotal, 
      payment_method_id: finalPaymentMethodId,
      bill_discount_type: posSession.billDiscountType,
      bill_discount_value: posSession.billDiscountValue,
      note: "บันทึกบิลขายส่งผ่านระบบ POS หน้าร้าน",
      items: computedItems as any,
    };

    try {
      const response = await posApiService.createPOSOrder(salePayload);
      const createdOrderId = response?.data?.id || response?.data?.order_id || response?.id || response?.order_id;

      // ถ้าเป็นเงินสด หรือ เงินเชื่อ ให้จบการขายทันที (ถ้าเป็น QR Code จะปิด Modal และเคลียร์ Cart หลังจากสแกนผ่าน)
      if (posSession.paymentMethodId !== 2) {
        alert("บันทึกข้อมูลการขายสำเร็จ!");
        setCart([]);
        localStorage.removeItem("pos_cart");
        resetPaymentState();
        setIsPaymentModalOpen(false);
      }

      return createdOrderId || null;
    } catch (error: any) {
      alert(error.response?.data?.error || "เกิดปัญหาที่ระบบหลังบ้าน");
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetPaymentState = () => {
    localStorage.removeItem("pos_session");
    setPosSession({
      customer: null, searchQuery: "", activeTypeId: 1, paymentMethodId: 1, billDiscountValue: 0, billDiscountType: "none", receivedAmount: 0, receiverName: ""
    });
    setTempPhone("");
    setSearchResults([]);
    setDisplayValue("");
    setSelectedPaymentType("CASH");
    setQrCodeData(null);
    setHasAttemptedQR(false);
  };

  const resetBillDiscount = () => {
    updateSession("billDiscountValue", 0);
    updateSession("billDiscountType", "none");
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
    resetPaymentState,
    storeConfig,
    creditDueDate,
    formattedCreditDueDate,
    isExceedCreditLimit,
    isRegisteredCustomer,
    selectPaymentMethod,
    qrCodeData,
    isLoadingQR,
    handleGeneratePromptPayQR
  };
}