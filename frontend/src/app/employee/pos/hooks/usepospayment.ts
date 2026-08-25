import { useState, useEffect, useMemo, useRef } from "react";
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
      // ไปเปิดตู้เซฟเบราว์เซอร์ดูว่ามีคีย์ "pos_session" ค้างไว้ไหม
      const saved = localStorage.getItem("pos_session");
      //  ถ้ามี ให้แปลงข้อความ JSON กลับมาเป็น Object แล้วใส่เข้า posSession State ทันที!
      return saved ? JSON.parse(saved) : {
        customer: null, activeTypeId: 1, paymentMethodId: 1, billDiscountValue: 0, billDiscountType: "none", receivedAmount: 0, receiverName: "", searchQuery: "", currentOrderId: null, currentOrderNumber: null, isPaymentModalOpen: false
      };
    }
    return { customer: null, activeTypeId: 1, paymentMethodId: 1, billDiscountValue: 0, billDiscountType: "none", receivedAmount: 0, receiverName: "", searchQuery: "", currentOrderId: null, currentOrderNumber: null, isPaymentModalOpen: false };
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
  const [isConfirming, setIsConfirming] = useState<boolean>(false); 
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(posSession.isPaymentModalOpen || false);
  const [receivedAmount, setReceivedAmount] = useState<number>(posSession.receivedAmount);
  const [receiverName, setReceiverName] = useState<string>(posSession.receiverName);
  const [searchResults, setSearchResults] = useState<CustomerDiscountResponse[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<{ id: number; method_name: string }[]>([]);
  const [displayValue, setDisplayValue] = useState<string>("");
  const [customerAddressTemp, setCustomerAddressTemp] = useState<string>(posSession.customerAddressTemp || "");
  
  // Restore currentOrderId & currentOrderNumber
  const [currentOrderId, setCurrentOrderId] = useState<number | null>(posSession.currentOrderId || null);
  const [qrCodeData, setQrCodeData] = useState<{ qrCode: string; refNo: string; paymentId: number; orderId: number } | null>(null);
  const [isLoadingQR, setIsLoadingQR] = useState<boolean>(false);

  // Ref เก็บ orderNumber & orderId แบบ Persistent (ไม่หลุดตาม Re-render)
  const currentOrderNumberRef = useRef<string | null>(posSession.currentOrderNumber || null);
  const currentOrderIdRef = useRef<number | null>(posSession.currentOrderId || null);

  // Sync Ref และ LocalStorage เมื่อ Session เปลี่ยน
  useEffect(() => {
    if (posSession.currentOrderNumber) currentOrderNumberRef.current = posSession.currentOrderNumber;
    if (posSession.currentOrderId) currentOrderIdRef.current = posSession.currentOrderId;
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
    setCustomerAddressTemp(posSession.customerAddressTemp || "");
    if (posSession.currentOrderNumber) {
      currentOrderNumberRef.current = posSession.currentOrderNumber;
    }
    if (typeof posSession.isPaymentModalOpen === "boolean") setIsPaymentModalOpen(posSession.isPaymentModalOpen);

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

  // Auto-fetch QR Code เมื่อเปิด Modal หรือสลับมา QR Code
  useEffect(() => {
    const activeMethod = paymentMethodId || posSession.paymentMethodId;

    if (isPaymentModalOpen && activeMethod === 2 && !qrCodeData && !isLoadingQR) {
      const fetchQR = async () => {
        let activeOrderId = currentOrderId || posSession.currentOrderId || currentOrderIdRef.current;
        if (!activeOrderId) {
          activeOrderId = await submitOrderToDatabase();
        }
        if (activeOrderId) {
          await handleGeneratePromptPayQR(activeOrderId, 1);
        }
      };
      fetchQR();
    }
  }, [isPaymentModalOpen, paymentMethodId, posSession.paymentMethodId, currentOrderId, posSession.currentOrderId, qrCodeData, isLoadingQR]);

  const isRegisteredCustomer = useMemo(() => {
    return Boolean(customer && customer.id > 0);
  }, [customer]);

  useEffect(() => {
    if (!isPaymentModalOpen) {
      setQrCodeData(null);
    }
  }, [isPaymentModalOpen]);

  // ─── COMPUTED VALUES ───
  const computedBillDiscount = useMemo(() => {
    const remainingAfterLineDiscount = totalItemPrice - totalLineDiscount;
    if (billDiscountType === "amount") return billDiscountValue;
    if (billDiscountType === "percentage") return (remainingAfterLineDiscount * billDiscountValue) / 100;
    return 0;
  }, [billDiscountType, billDiscountValue, totalItemPrice, totalLineDiscount]);

  const finalTotal = useMemo(() => {
    const total = totalItemPrice - totalLineDiscount - computedBillDiscount;
    return total < 0 ? 0 : Math.round(total * 100) / 100;
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
    setPosSession((prev: PosSession) => {
      const updated = { ...prev, [key]: value };
      localStorage.setItem("pos_session", JSON.stringify(updated));
      return updated;
    });
  };

  const selectPaymentMethod = async (methodId: number) => {
    const isCustomerSelected = Boolean(customer && customer.customer_name);
    if (methodId === 3 && isCustomerSelected && !isRegisteredCustomer) {
      alert("สิทธิ์ชำระด้วยเงินเชื่อเฉพาะลูกค้าที่เป็นสมาชิกเท่านั้น กรุณาเลือกลูกค้า หรือลงทะเบียนสมัครสมาชิกก่อนทำรายการ");
      return false;
    }
    
    setPaymentMethodId(methodId);
    updateSession("paymentMethodId", methodId);

    if (methodId === 1) setSelectedPaymentType("CASH");
    else if (methodId === 2) setSelectedPaymentType("QRCODE");
    else if (methodId === 3) setSelectedPaymentType("CREDIT");

    if (isPaymentModalOpen && methodId === 2) {
      let targetOrderId = currentOrderId || posSession.currentOrderId || currentOrderIdRef.current;
      if (!targetOrderId) {
        targetOrderId = await submitOrderToDatabase();
      }
      if (targetOrderId) {
        await handleGeneratePromptPayQR(targetOrderId, 1);
      }
    }

    return true;
  };

  const handleSearchCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedQuery = searchCustomerQuery.trim();
    if (!cleanedQuery) {
      resetPaymentState();
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
          searchQuery: exactMatchedCustomer.customer_name,
          // ดึงที่อยู่จาก DB หรือถ้า DB ไม่มีที่อยู่ ให้ใช้ค่าเดิมที่เคยพิมพ์ไว้ใน Modal
          customerAddressTemp: exactMatchedCustomer.shipping_address || exactMatchedCustomer.registered_address || prev.customerAddressTemp || ""
        }));
      } else {
        // เคสลูกค้าขาจร: นำค่าที่อยู่จาก posSession (ที่พิมพ์ค้างไว้) มาใช้งาน
        const currentAddress = posSession.customerAddressTemp?.trim() || "";

        const guestCustomer = {
          id: 0,
          customer_name: cleanedQuery,
          phone_number: tempPhone.trim() || "ลูกค้าทั่วไป (ไม่ระบุ)",
          shipping_address: currentAddress,    // ใส่ที่อยู่ให้ guestCustomer
          registered_address: currentAddress,  // ใส่ที่อยู่ให้ guestCustomer
          standard_discount_rate: 0, is_discount_enabled: false, current_debt_amount: 0, max_credit_limit: 0, is_credit_enabled: false,
          customer_type: { id: 1, type_name: "GENERAL", type_label: "ลูกค้าทั่วไป" }
        };

        setPosSession((prev) => ({
          ...prev,
          customer: guestCustomer,
          activeTypeId: 1,
          searchQuery: cleanedQuery,
          customerAddressTemp: currentAddress // รักษาค่าที่อยู่เดิมเอาไว้ ไม่ล้างเป็น ""
        }));
      }
      setSearchResults([]);
    } catch (error) {
      console.error(error);
    }
  };

  const refreshCustomerFinancials = async (customerPhone: string) => {
    if (!customerPhone || customerPhone.includes("ลูกค้าทั่วไป")) return;
    try {
      const response = await apiClient.get<CustomerDiscountResponse[]>(`/pos/customer-discount?search=${customerPhone}`);
      const dataList = response.data;
      if (dataList && dataList.length > 0) {
        const matched = dataList.find((c) => c.phone_number === customerPhone || c.customer_name === customerPhone);
        if (matched) {
          // ป้องกันสภาวะแข่งขันแบบอะซิงโครนัส (Race Condition): 
          // หากพนักงานขายบิลสำเร็จและเคลียร์ลูกค้าออกไปแล้ว (customer เป็น null) ห้ามเขียนข้อมูลใหม่ทับกลับมา
          setPosSession((prev) => {
            if (!prev.customer || (prev.customer.phone_number !== customerPhone && prev.customer.customer_name !== customerPhone)) {
              return prev; // ยกเลิกการอัปเดตเซสชัน
            }
            return {
              ...prev,
              customer: matched,
              activeTypeId: matched.customer_type?.id || 1
            };
          });

          setCustomer((prev) => {
            if (!prev || (prev.phone_number !== customerPhone && prev.customer_name !== customerPhone)) {
              return prev; // ยกเลิกการอัปเดตสเตท
            }
            return matched;
          });
        }
      }
    } catch (error) {
      console.error("Failed to refresh customer financials:", error);
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
    if (!orderId || orderId <= 0) return;
    try {
      setIsLoadingQR(true);
      const res = await posApiService.generatePromptPayQR(orderId, receivedById);
      setQrCodeData({
        qrCode: res.qr_code || res.qrCodeBase64 || res.data?.qr_code,
        refNo: res.reference_number || res.referenceNumber || res.data?.reference_number,
        paymentId: res.payment_id || res.data?.payment_id,
        orderId: orderId,
      });
    } catch (error: any) {
      console.error("Error generating QR:", error);
      alert("ไม่สามารถสร้าง QR Code ได้");
    } finally {
      setIsLoadingQR(false);
    }
  };

  // ─── ฟังก์ชันสำคัญ: บันทึก/อัปเดต Order ลง DB ───
  const submitOrderToDatabase = async (currentCart?: CartItem[]): Promise<number | null> => {
    const targetCart = currentCart || cart;
    if (targetCart.length === 0) {
      alert("กรุณาเลือกสินค้าลงตะกร้า");
      return null;
    }

    const finalPaymentMethodId = paymentMethodId || posSession.paymentMethodId;
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

    const finalAddress = customerAddressTemp || posSession.customerAddressTemp || "";
    const rawCustomerId = posSession.customer?.id || 0;
    const salePayload: CreateSaleOrderRequest = {
      customer_id: rawCustomerId && rawCustomerId > 0 ? rawCustomerId : (null as any),
      customer_name_temp: posSession.customer?.customer_name || "ลูกค้าทั่วไป",
      customer_phone_temp: posSession.customer?.phone_number || "",
      customer_address_temp: finalAddress,
      received_amount: finalPaymentMethodId === 1 ? receivedAmount : finalTotal, 
      payment_method_id: finalPaymentMethodId,
      bill_discount_type: posSession.billDiscountType,
      bill_discount_value: posSession.billDiscountValue,
      note: "",
      items: computedItems as any,
    };

    try {
      // 💡 1. ดึงข้อมูล session ล่าสุดจาก localStorage โดยตรง
      let storedOrderNumber: string | null = currentOrderNumberRef.current;
      let storedOrderId: number | null = currentOrderIdRef.current;

      if (typeof window !== "undefined") {
        const rawLocal = localStorage.getItem("pos_session");
        if (rawLocal) {
          try {
            const parsed = JSON.parse(rawLocal);
            if (parsed.currentOrderNumber) storedOrderNumber = parsed.currentOrderNumber;
            if (parsed.currentOrderId) storedOrderId = parsed.currentOrderId;
          } catch (e) {
            console.error("Error parsing local pos_session", e);
          }
        }
      }

      console.log("🔍 CHECKING STORED ORDER:", { storedOrderNumber, storedOrderId });

      // 💡 2. เช็กว่ามี orderNumber หรือ orderId ค้างอยู่ไหม (อย่างใดอย่างหนึ่ง)
      if (storedOrderNumber) {
        // 🔄 มีแล้ว -> ยิง PUT อัปเดตรายการสินค้าบิลเดิม!
        console.log("📌 UPDATING EXISTING ORDER:", storedOrderNumber);
        try {
          const response = await posApiService.updatePOSOrder(storedOrderNumber, salePayload);
          
          const resData = response?.data;
          const updatedData = resData?.data || resData || response;
          
          const orderId = updatedData?.id || storedOrderId || currentOrderId;
          if (posSession.customer?.phone_number) {
            refreshCustomerFinancials(posSession.customer.phone_number);
          }
          return orderId || null;
        } catch (error: any) {
          const isNotFoundError = 
            error.response?.status === 404 || 
            (error.response?.status === 400 && (
              error.response?.data?.message?.includes("ไม่พบรายการสั่งซื้อ") ||
              error.response?.data?.error?.includes("ไม่พบรายการสั่งซื้อ")
            ));
            
          if (isNotFoundError) {
            console.warn("Stored order not found in DB. Fallback to creating a new one...");
            currentOrderNumberRef.current = null;
            currentOrderIdRef.current = null;
            setCurrentOrderId(null);
            
            const currentSessionRaw = localStorage.getItem("pos_session");
            const currentSession = currentSessionRaw ? JSON.parse(currentSessionRaw) : {};
            delete currentSession.currentOrderNumber;
            delete currentSession.currentOrderId;
            localStorage.setItem("pos_session", JSON.stringify(currentSession));
            
            return submitOrderToDatabase(targetCart);
          }
          throw error;
        }
      } else {
        //  ยังไม่มี -> ยิง POST สร้างบิลใหม่
        console.log("✨ CREATING NEW ORDER...");
        const response = await posApiService.createPOSOrder(salePayload);
        
        //  3. ทะลวงแกะ API Response ให้ลึก 3 ชั้น
        const res1 = response?.data;
        const res2 = res1?.data;
        const res3 = res2?.data;

        const orderId = 
          res3?.id || res3?.order_id ||
          res2?.id || res2?.order_id ||
          res1?.id || res1?.order_id ||
          response?.id;

        let orderNumber = 
          res3?.order_number || res3?.orderNumber ||
          res2?.order_number || res2?.orderNumber ||
          res1?.order_number || res1?.orderNumber ||
          response?.order_number;

        // 🚨 SAFETY FALLBACK: ถ้า Backend ไม่ได้ส่ง order_number มา ให้ใช้ orderId มาทำแทนชั่วคราว
        if (!orderNumber && orderId) {
          orderNumber = String(orderId);
        }

        console.log("🎯 EXTRACTED FROM API:", { orderNumber, orderId, rawResponse: response });

        //  4. บันทึกเข้า Ref และ State
        if (orderNumber) currentOrderNumberRef.current = orderNumber;
        if (orderId) {
          currentOrderIdRef.current = orderId;
          setCurrentOrderId(orderId);
        }

        //  5. บันทึกลง localStorage ทันที synchronous
        if (orderNumber || orderId) {
          const currentSessionRaw = localStorage.getItem("pos_session");
          const currentSession = currentSessionRaw ? JSON.parse(currentSessionRaw) : {};
          
          const nextSession = {
            ...currentSession,
            currentOrderNumber: orderNumber,
            currentOrderId: orderId,
          };
          
          localStorage.setItem("pos_session", JSON.stringify(nextSession));
          setPosSession(nextSession);
        } else {
          console.error("CRITICAL: Could not extract orderNumber or orderId from backend response!");
        }

        if (posSession.customer?.phone_number) {
          refreshCustomerFinancials(posSession.customer.phone_number);
        }
        return orderId || null;
      }
    } catch (error: any) {
      console.error("Submit order failed:", error);
      alert(error.response?.data?.error || error.response?.data?.message || "เกิดปัญหาที่ระบบหลังบ้าน");
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── 1. กดปุ่ม "ยืนยันการขาย" หน้าร้าน ───
  const handleConfirmSale = async () => {
    if (cart.length === 0) return alert("กรุณาเลือกสินค้าลงตะกร้า");

    // 1. จัดการ Overwrite paymentMethodId กรณี CASH + CREDIT ให้เสร็จก่อน
    let activePaymentMethod = paymentMethodId || posSession.paymentMethodId;
    if (selectedPaymentType === "CASH" && activePaymentMethod === 3) {
      activePaymentMethod = 1;
      setPaymentMethodId(1);
    }

    if (activePaymentMethod === 3 && !isRegisteredCustomer) {
      alert("สิทธิ์ชำระด้วยเงินเชื่อเฉพาะลูกค้าที่เป็นสมาชิกเท่านั้น");
      return;
    }

    if (activePaymentMethod === 3 && isExceedCreditLimit) {
      alert("วงเงินเครดิตของลูกค้าไม่เพียงพอ ไม่สามารถทำรายการเงินเชื่อได้");
      return;
    }

    // 2. เปิด Modal ทันที (ยังไม่เซฟลง DB)
    setIsPaymentModalOpen(true);
    updateSession("isPaymentModalOpen", true);
  };

  // ─── 2. กดปุ่ม "ยืนยันและพิมพ์ใบเสร็จ" ใน Modal ───
  const handleFinalConfirmAndPrint = async (): Promise<boolean> => {
    const activePaymentMethodId = paymentMethodId || posSession.paymentMethodId;

    if (activePaymentMethodId === 1) {
      if (!receivedAmount || receivedAmount <= 0) {
        alert("กรุณากรอกจำนวนเงินที่รับมา");
        return false;
      }
      if (receivedAmount < finalTotal) {
        alert(`จำนวนเงินที่รับมาไม่ครบ (รับมา ฿${receivedAmount.toLocaleString()} / ยอดชำระ ฿${finalTotal.toLocaleString()})`);
        return false;
      }
    }

    if (activePaymentMethodId === 3) {
      if (!isRegisteredCustomer) {
        alert("สิทธิ์ชำระด้วยเงินเชื่อเฉพาะลูกค้าที่เป็นสมาชิกเท่านั้น");
        return false;
      }
      if (isExceedCreditLimit) {
        alert("วงเงินเครดิตของลูกค้าไม่เพียงพอ ไม่สามารถทำรายการเงินเชื่อได้");
        return false;
      }
    }

    setIsConfirming(true);
    try {
      if (activePaymentMethodId === 1 || activePaymentMethodId === 3) {
        //  CASH & CREDIT: ยิง DB ทีเดียวจบ (ไม่ผ่าน pending)
        const orderId = await submitOrderToDatabase();
        if (!orderId) {
          setIsConfirming(false);
          return false;
        }
        alert("ยืนยันการชำระเงินและจบการขายสำเร็จ!");
        resetPaymentState();
        setCart([]);
        localStorage.removeItem("pos_cart");
        setIsPaymentModalOpen(false);
        return true;
      }

      // QRCODE (TRANSFER): ยืนยันรายการชำระเงินของ Order เดิมที่เคยยิงจองไว้ (pending)
      let orderId = currentOrderId || posSession.currentOrderId || currentOrderIdRef.current;
      if (!orderId) {
        orderId = await submitOrderToDatabase();
        if (!orderId) {
          setIsConfirming(false);
          return false;
        }
      }

      await posApiService.confirmPayment({
        payment_id: qrCodeData?.paymentId || 0,
        order_id: orderId,
        payment_method_id: activePaymentMethodId,
        received_amount: finalTotal,
        received_by_id: 1, 
      });

      alert("ยืนยันการชำระเงินและจบการขายสำเร็จ!");

      // จบการขายสำเร็จ ค่อยสั่ง reset เพื่อล้าง orderNumber ให้บิลถัดไป
      resetPaymentState();
      setCart([]);
      localStorage.removeItem("pos_cart");
      setIsPaymentModalOpen(false);
      return true;
    } catch (error: any) {
      console.error("Confirm payment failed:", error);
      alert(error.response?.data?.error || "เกิดข้อผิดพลาดในการยืนยันชำระเงิน");
      return false;
    } finally {
      setIsConfirming(false);
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

  const resetPaymentState = () => {
    localStorage.removeItem("pos_session");
    currentOrderNumberRef.current = null;
    currentOrderIdRef.current = null;

    setPosSession({
      customer: null, searchQuery: "", activeTypeId: 1, paymentMethodId: 1, billDiscountValue: 0, billDiscountType: "none", receivedAmount: 0, receiverName: "", currentOrderId: null, currentOrderNumber: null, isPaymentModalOpen: false, customerAddressTemp: ""
    });
    setCustomer(null);
    setSearchCustomerQuery("");
    setCustomerAddressTemp("");
    setTempPhone("");
    setSearchResults([]);
    setDisplayValue("");
    setSelectedPaymentType("CASH");
    setQrCodeData(null);
    setCurrentOrderId(null);
  };

  const resetBillDiscount = () => {
    updateSession("billDiscountValue", 0);
    updateSession("billDiscountType", "none");
  };

  //ปิดจริงๆ ทั้งหน้าจอและในความจำของระบบ
  const closePaymentModal = () => {
    setIsPaymentModalOpen(false); // สั่งให้ React ซ่อน Modal หน้าร้านทันที
    updateSession("isPaymentModalOpen", false); // บันทึกลง Storage/Session ว่าปิดแล้วนะ
  };

  const handleAddressChange = (address: string) => {
    setCustomerAddressTemp(address);
    updateSession("customerAddressTemp", address);
  };

  return {
    posSession, setPosSession, updateSession,
    customer, setCustomer, paymentMethods, setPaymentMethods,
    searchCustomerQuery, setSearchCustomerQuery, setTempPhone, tempPhone,
    searchResults, setSearchResults, triggerLiveSearch, customerTypes,
    activeTypeId, setActiveTypeId, selectedPaymentType, setSelectedPaymentType,
    paymentMethodId, setPaymentMethodId, billDiscountValue, setBillDiscountValue,
    billDiscountType, setBillDiscountType, isSubmitting, isConfirming, computedBillDiscount,
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
    isCustomerSelected: Boolean(customer && customer.customer_name),
    isRegisteredCustomer,
    selectPaymentMethod,
    qrCodeData,
    isLoadingQR,
    currentOrderId,
    handleGeneratePromptPayQR,
    handleConfirmSale,              
    handleFinalConfirmAndPrint,   
    closePaymentModal,
    customerAddressTemp,
    handleAddressChange,
  };
}