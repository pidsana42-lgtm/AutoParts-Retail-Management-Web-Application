import { useState, useEffect, useMemo } from "react";
import apiClient from "../../../../service/http/apiClient";
import { posApiService } from "../../../../service/http/pos/pos_service";
import type { CustomerDiscountResponse, CustomerTypeInterface } from "../../../../interface/pos/customer_interface";
import type { StoreConfigInterface } from "../../../../interface/pos/store_config_interface";
import type { SaleOrderItemRequest, CreateSaleOrderRequest } from "../../../../interface/pos/pos_interface";
import type { CartItem } from "./useposcart";

interface UsePosPaymentProps {
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  totalItemPrice: number;
  totalLineDiscount: number;
}

// Custom Hook สำหรับจัดการระบบข้อมูลลูกค้า การคำนวณเงินท้ายบิล และการชำระเงินของหน้า POS
export function usePosPayment({ cart, setCart, totalItemPrice, totalLineDiscount }: UsePosPaymentProps) {
  // local state ของข้อมูลลูกค้าและการชำระเงิน
  const [customer, setCustomer] = useState<CustomerDiscountResponse | null>(null); // ข้อมูลลูกค้าที่เลือก/ค้นหาเจอ
  const [searchCustomerQuery, setSearchCustomerQuery] = useState<string>(""); // ข้อความที่ใช้ค้นหาลูกค้า (ชื่อ/เบอร์โทร)
  const [tempPhone, setTempPhone] = useState<string>(""); // เบอร์โทรชั่วคราวสำหรับลูกค้าขาจร (กรณีพิมพ์สด)
  const [customerTypes, setCustomerTypes] = useState<CustomerTypeInterface[]>([]); // รายการประเภทลูกค้าทั้งหมด (ดึงจากฐานข้อมูล)
  const [activeTypeId, setActiveTypeId] = useState<number>(1); // ID ประเภทลูกค้าที่กำลังเลือกอยู่ (เช่น 1: ทั่วไป, 2: อู่)
  const [selectedPaymentType, setSelectedPaymentType] = useState<"CASH" | "CREDIT">("CASH"); // โหมดการจ่ายหลัก (เงินสด/เงินเชื่อ)
  const [paymentMethodId, setPaymentMethodId] = useState<number>(1); // ID วิธีชำระเงินจริง (1=เงินสด, 2=QR, 3=เงินเชื่อ)
  const [billDiscountValue, setBillDiscountValue] = useState<number>(0.0); // มูลค่าส่วนลดท้ายบิลที่พนักงานกรอก
  const [billDiscountType, setBillDiscountType] = useState<"none" | "percentage" | "amount">("none"); // ประเภทส่วนลดท้ายบิล (ลดเป็นบาท/%)
  const [storeConfig, setStoreConfig] = useState<StoreConfigInterface | null>(null); // ค่าตั้งค่านโยบายของร้าน (เช่น เพดานส่วนลด)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false); // สถานะกำลังส่งบันทึกบิลไปยังหลังบ้าน (ป้องกันกดเบิ้ล)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [receivedAmount, setReceivedAmount] = useState<number>(0); // ยอดเงินที่รับมาจากลูกค้า
  const [receiverName, setReceiverName] = useState<string>(""); // ชื่อผู้รับของ (กรณีเงินเชื่อ)
  const [searchResults, setSearchResults] = useState<CustomerDiscountResponse[]>([]); // ผลลัพธ์การค้นหาลูกค้าสมาชิกจาก API
  const [paymentMethods, setPaymentMethods] = useState<{ id: number; method_name: string }[]>([]); // รายการวิธีชำระเงินที่ดึงจากหลังบ้าน
  const [displayValue, setDisplayValue] = useState<string>(""); // ค่าที่ใช้แสดงผลในช่องรับเงินสด (รับเงินมา) เพื่อให้รองรับการพิมพ์ตัวอักษรและเครื่องหมายพิเศษได้

  // INITIAL FETCH EFFECTS
  // ดึงข้อมูลประเภทลูกค้าและนโยบายร้านค้าจากหลังบ้านมาเตรียมไว้ตั้งแต่เปิดหน้าเว็บ
  useEffect(() => {
    posApiService.getCustomerTypes()
      .then((data) => setCustomerTypes(data))
      .catch((err) => console.error("ดึงประเภทลูกค้าล้มเหลว:", err));

    posApiService.getPaymentMethods()
      .then((data) => setPaymentMethods(data))
      .catch((err) => console.error("ดึงข้อมูลวิธีชำระเงินล้มเหลว:", err));

    posApiService.getStoreConfig()
      .then((data) => setStoreConfig(data))
      .catch((err) => console.error("ดึงตั้งค่าร้านค้าล้มเหลว:", err));
  }, []);

  // ─── COMPUTED VALUES (useMemo) ───
  
  //[useMemo]: คำนวณมูลค่าส่วนลดท้ายบิลสุทธิ (แปลงผลลัพธ์ออกมาเป็น "บาท" เสมอ)
  // โดยคิดจากยอดรวมสินค้าหลังจากหักส่วนลดรายชิ้น (Line Discount) ออกไปแล้ว
  const computedBillDiscount = useMemo(() => {
    const remainingAfterLineDiscount = totalItemPrice - totalLineDiscount;
    if (billDiscountType === "amount") return billDiscountValue; // เคสลดเป็นบาท ส่งค่ากลับได้เลย
    if (billDiscountType === "percentage")
      return (remainingAfterLineDiscount * billDiscountValue) / 100; // เคสลดเป็น % นำมาคำนวณแปลงเป็นบาท
    return 0;
  }, [billDiscountType, billDiscountValue, totalItemPrice, totalLineDiscount]);

  //[useMemo]: คำนวณยอดชำระสุทธิสุทธิจริงๆ ที่ลูกค้าต้องจ่ายเงิน (Net Total)
  // สูตร: (ราคารวมสินค้าทั้งหมด) - (ส่วนลดรายชิ้นรวม) - (ส่วนลดท้ายบิลสุทธิ)
  const finalTotal = useMemo(() => {
    const total = totalItemPrice - totalLineDiscount - computedBillDiscount;
    return total < 0 ? 0 : total; // ถ้ายอดติดลบ ให้ปัดเป็น 0 บาทเพื่อความปลอดภัย
  }, [totalItemPrice, totalLineDiscount, computedBillDiscount]);

  //[useMemo]: คำนวณเงินทอน (Change) ที่ต้องคืนลูกค้า (ถ้าเป็นเงินสด)
  // สูตร: (เงินที่รับมา) - (ยอดชำระสุทธิ)
  const change = useMemo(() => {
  const result = receivedAmount - finalTotal;
  return result > 0 ? result : 0;
  }, [receivedAmount, finalTotal]);


  // ─── CORE FUNCTIONS (Event Handlers) ───

  // ฟังก์ชันค้นหาข้อมูลลูกค้าสมาชิกร้านจากชื่ออู่หรือเบอร์โทร เมื่อค้นหาเจอ จะอัปเดตสิทธิ์กลุ่มลูกค้า และสลับช่องทางชำระเงินเริ่มต้น (Default) ให้เหมาะสมอัตโนมัติ
  // ฟังก์ชันค้นหาข้อมูลลูกค้าสมาชิกร้านจากชื่อหรือเบอร์โทร
  const handleSearchCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedQuery = searchCustomerQuery.trim();
    
    // ถ้าช่องพิมพ์ว่างเปล่า ให้ล้างค่ากลับเป็นลูกค้าทั่วไปหน้าร้าน
    if (!cleanedQuery) {
      setCustomer(null);
      setActiveTypeId(1);
      setSearchResults([]);
      setTempPhone(""); // ล้างค่าเบอร์โทรชั่วคราวด้วย
      return;
    }

    try {
      const response = await apiClient.get<CustomerDiscountResponse[]>(
        `/pos/customer-discount?search=${cleanedQuery}`
      );
      const dataList = response.data;

      //  จุดสำคัญ: เปลี่ยนมาตรวจสอบแบบ Exact Match (เช็คตัวอักษรตรงกันเป๊ะๆ 100%)
      const exactMatchedCustomer = dataList && dataList.length > 0 
        ? dataList.find(
            (c) => c.customer_name?.toLowerCase() === cleanedQuery.toLowerCase() || 
                   c.phone_number === cleanedQuery
          )
        : null;

      if (exactMatchedCustomer) {
        // เคสที่ 1: เจอสมาชิกตัวจริงในระบบที่ชื่อหรือเบอร์ตรงกันเป๊ะ
        setCustomer(exactMatchedCustomer);
        if (exactMatchedCustomer.customer_type) {
          setActiveTypeId(exactMatchedCustomer.customer_type.id);
        }
      } else {
        // เคสที่ 2: ไม่เจอสมาชิกในระบบ (เป็นลูกค้าขาจรคีย์สดหน้างาน)
        // บังคับจำลองสเตทขาจรพร้อมดึงค่าเบอร์โทรจาก tempPhone มาแสดงผลทันที
        setCustomer({
          id: 0, // ID 0 บอกหลังบ้านว่าเป็นลูกค้าขาจร
          customer_name: cleanedQuery, // สลักชื่อที่พิมพ์สดลงไปตรงๆ
          phone_number: tempPhone.trim() || "ลูกค้าทั่วไป (ไม่ระบุ)", //  ดึงค่าเบอร์โทรศัพท์ล่าสุดที่พิมพ์จากสเตทมาแนบที่นี่
          standard_discount_rate: 0,
          is_discount_enabled: false,
          current_debt_amount: 0,
          max_credit_limit: 0,
          is_credit_enabled: false,
          customer_type: {
            id: 1,
            type_name: "GENERAL",
            type_label: "ลูกค้าทั่วไป"
          }
        });
        setActiveTypeId(1); // สลับแท็บสิทธิ์กลุ่มลูกค้ามาที่ "ทั่วไป" อัตโนมัติ
      }

      //  ล้างรายการดรอปดาวน์ค้นหาออกไปจากหน้าจอทันทีเพื่อปิดกล่องข้อความแจ้งเตือนเมื่อขั้นตอนเสร็จสมบูรณ์
      setSearchResults([]);

    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการค้นหาลูกค้า:", error);
    }
  };

  // ฟังก์ชันค้นหาสด (Live Search) สำหรับช่องค้นหาลูกค้า
  const triggerLiveSearch = async (query: string) => {
    const cleaned = query.trim();
    if (cleaned.length === 0) {
      setSearchResults([]);
      return;
    }
    try {
      const response = await apiClient.get<CustomerDiscountResponse[]>(
        `/pos/customer-discount?search=${cleaned}`
      );
      setSearchResults(response.data || []);
    } catch (error) {
      console.error("Live Search ล้มเหลว:", error);
    }
  };

  //ฟังก์ชันจัดการความปลอดภัยและการเปลี่ยนแปลงของ "ส่วนลดท้ายบิล"
  //คอยตรวจสอบเงื่อนไขนโยบายร้านค้า (ห้ามลูกค้าบริษัทลด, ห้ามลดท้ายบิลเกิน X%) ก่อนกดยอมรับค่า
  const handleBillDiscountChange = (valueStr: string) => {
    const inputValue = valueStr === "" ? 0 : parseFloat(valueStr) || 0;
    if (inputValue < 0) return;

    const currentCustomerTypeId = customer?.customer_type?.id || activeTypeId;
    const currentCustomerTypeName = customer?.customer_type?.type_name || "";

    // กฎเหล็กระบบ: ลูกค้ากลุ่มบริษัท (WHOLESALE) ห้ามได้ส่วนลดท้ายบิลทุกกรณี
    if (currentCustomerTypeId === 3 || currentCustomerTypeName === "WHOLESALE") {
      alert("ลูกค้ากลุ่มบริษัทไม่ได้รับสิทธิ์ส่วนลดใดๆ ทั้งสิ้น");
      setBillDiscountValue(0);
      return;
    }

    // ดึงเพดานส่วนลดสูงสุดท้ายบิลจากนโยบายร้าน (นับเป็น %) เช่น ห้ามเกิน 6%
    const maxExtraConfigRate = storeConfig?.max_extra_discount_rate ?? 6.0;
    const remainingAfterLineDiscount = totalItemPrice - totalLineDiscount;
    
    // คำนวณเพดานสูงสุดเป็น "บาท" ไว้รอก่อนเลย
    const maxDiscountBaht = (remainingAfterLineDiscount * maxExtraConfigRate) / 100;

    // ตัวแปรเช็กว่าเกินเพดานไหม
    let isExceed = false;

    if (billDiscountType === "percentage") {
      if (inputValue > maxExtraConfigRate) isExceed = true;
    } else if (billDiscountType === "amount" && remainingAfterLineDiscount > 0) {
      if (inputValue > maxDiscountBaht) isExceed = true;
    }

    if (isExceed) {
      alert(
        `ส่วนลดท้ายบิลเกินนโยบายร้านค้า\n\nระบบอนุญาตให้ลดสูงสุดไม่เกิน:\n• ${maxExtraConfigRate}% ของยอดรวม\n• หรือไม่เกิน ฿${maxDiscountBaht.toFixed(2)}`
      );
      setBillDiscountValue(0);
      return;
    }
    
    setBillDiscountValue(inputValue);
  };

  // ฟังก์ชันปิดยอดขาย บันทึกออเดอร์ลงฐานข้อมูล
  // ทำหน้าที่คำนวณกระจายน้ำหนักส่วนลดท้ายบิลเฉลี่ยลงรายไอเทม (Pro-rata Weight) เพื่อรองรับงานรับคืนสินค้า (Refund) 
  // และยิงเซฟ Payload ไปที่ Backend พร้อมล้างค่าหน้าร้านทั้งหมดเมื่อทำรายการสำเร็จ
  const handleOpenPaymentModal = () => {
    if (cart.length === 0) return alert("กรุณาเลือกสินค้าลงตะกร้า");
    if (!customer) return alert("กรุณาเลือกบัญชีลูกค้าก่อนครับ");
    
    // ตั้งค่าเริ่มต้นของช่อง "รับเงินมา" ให้เท่ากับยอดชำระสุทธิพอดี (พนักงานจะได้ไม่ต้องพิมพ์เองถ้ารับพอดี)
    setReceivedAmount(0);
    setIsPaymentModalOpen(true); 
  };

  // ฟังก์ชันจัดการการเปลี่ยนแปลงของช่อง "รับเงินมา" (Received Amount) ให้รองรับการพิมพ์ตัวอักษรและเครื่องหมายพิเศษได้
  // 1. ตอนพิมพ์ (onChange): เก็บค่าเป็นเลขดิบๆ ให้พนักงานพิมพ์สะดวก
  const handleReceivedAmountChange = (value: string) => {
    // ตัดคอมม่าออกก่อนเพื่อเอาค่าดิบไปคำนวณ
    const rawValue = value.replace(/,/g, "").replace(/[^0-9.]/g, "");
    if ((rawValue.match(/\./g) || []).length > 1) return;
    
    setDisplayValue(value.replace(/[^0-9.]/g, "")); // โชว์ในช่อง Input แบบไม่มีคอมม่าตอนพิมพ์
    setReceivedAmount(rawValue === "" ? 0 : Number(rawValue));
  };

  // 2. ตอนกดออก (onBlur): ค่อยจัด Format ให้มีคอมม่าและทศนิยม
  const handleReceivedAmountBlur = () => {
    const rounded = Number(receivedAmount.toFixed(2));
    setReceivedAmount(rounded);
    
    // จัด Format ใส่คอมม่าที่นี่
    const formatted = rounded.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    setDisplayValue(formatted);
  };

  const handleReceivedAmountFocus = () => {
  // เวลาคลิกช่อง ให้เอาค่าดิบมาโชว์ (ลบคอมม่าออก)
  setDisplayValue(receivedAmount === 0 ? "" : receivedAmount.toString());
  };

  const submitOrderToDatabase = async (currentCart?: CartItem[]) => {
    // ป้องกันบั๊ก Data-linkage โดยเลือกดึงตะกร้าล่าสุดที่ส่งตรงมาจากหน้า UI
    const targetCart = currentCart || cart;
    
    if (targetCart.length === 0) return alert("กรุณาเลือกสินค้าลงตะกร้า");
    if (!customer) return alert("กรุณาเลือกบัญชีลูกค้าก่อนครับ");
    setIsSubmitting(true);

    const totalSubtotalAfterLineDiscount = totalItemPrice - totalLineDiscount;
    let distributedBillDiscountAccumulator = 0; // ตัวเก็บสะสมยอดทศนิยมเฉลี่ยส่วนลดท้ายบิล

    // เริ่มกลไกการกระจายน้ำหนักส่วนลดท้ายบิลเฉลี่ยลงสินค้าทีละรายการ (Pro-rata Weighted Average)
    const computedItems = targetCart.map((item, index) => {
      const lineTotal = item.unit_price * item.qty;
      const itemDiscount = item.discount_type === "percentage" ? (lineTotal * item.discount_value) / 100 : item.discount_value;
      const subtotalAfterLineDiscount = lineTotal - itemDiscount;
      let allocatedBillDiscount = 0;

      if (totalSubtotalAfterLineDiscount > 0 && computedBillDiscount > 0) {
        // หากเป็นสินค้ารายการสุดท้ายในบิล ให้ใช้วิธีลบเศษทศนิยมขยะทั้งหมดเพื่อไม่ให้ยอดรวมเคลี่อน
        if (index === targetCart.length - 1) {
          allocatedBillDiscount = computedBillDiscount - distributedBillDiscountAccumulator;
        } else {
          // คำนวณสัดส่วนน้ำหนักค่าน้ำหนักตามราคาสินค้าชิ้นนั้นๆ
          const weight = subtotalAfterLineDiscount / totalSubtotalAfterLineDiscount;
          allocatedBillDiscount = Math.round(computedBillDiscount * weight * 100) / 100;
          distributedBillDiscountAccumulator += allocatedBillDiscount; // บันทึกสะสมยอด
        }
      }

      // คืนค่าโครงสร้างข้อมูลรายบรรทัดสำหรับใช้ส่งบันทึกเข้าเซิร์ฟเวอร์
      return {
        product_id: item.product_id,
        product_code: item.product_code,
        product_name: item.product_name,
        qty: item.qty,
        unit_price: item.unit_price,
        discount_type: item.discount_type,
        discount_value: item.discount_value,
        allocated_bill_discount: allocatedBillDiscount, // ส่วนแบ่งลดท้ายบิลประจำแถวนี้
        net_subtotal: subtotalAfterLineDiscount - allocatedBillDiscount, // ราคาสุทธิสิ้นสุดของรายการนี้
      };
    });

    // ประกอบร่างข้อมูลทั้งหมด (Payload) ส่งไปเซฟตารางออเดอร์ขาย
    const salePayload: CreateSaleOrderRequest = {
      customer_id: customer.id,
      customer_name_temp: customer.customer_name,
      customer_phone_temp: customer.phone_number,
      payment_method_id: paymentMethodId,
      bill_discount_type: billDiscountType,
      bill_discount_value: billDiscountValue,
      note: "บันทึกบิลขายส่งผ่านระบบ POS หน้าร้าน",
      items: computedItems as any,
    };

    try {
      await posApiService.createPOSOrder(salePayload);
      alert("บันทึกข้อมูลการขายสำเร็จ!");
      
      // ล้างข้อมูลตะกร้าสินค้าผ่าน Setter เพื่อเคลียร์ตารางหน้า UI ให้โล่ง
      setCart([]);
      localStorage.removeItem("pos_cart");
      
      // ล้างสถานะฝั่งคำนวณเงินทั้งหมดคืนค่าเริ่มต้นเพื่อเริ่มเปิดบิลใบถัดไป
      setCustomer(null);
      setBillDiscountValue(0);
      setBillDiscountType("none");
      setActiveTypeId(1);
      setSelectedPaymentType("CASH");
      setPaymentMethodId(1);
      setSearchCustomerQuery("");
      setTempPhone(""); // ล้างเบอร์โทรชั่วคราวของลูกค้าขาจร
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

  // ฟังก์ชันรีเซ็ตค่า "ส่วนลดท้ายบิล" ให้กลับไปเป็นค่าเริ่มต้น (0 บาท, ไม่มีส่วนลด)
  const resetBillDiscount = () => {
    setBillDiscountValue(0);
    setBillDiscountType("none");
  };

  // ส่งข้อมูลตัวแปรและฟังก์ชันจัดการบิลชำระเงินทั้งหมดออกไปให้หน้า UI คอมโพเนนต์เรียกใช้งาน
  return {
    customer, setCustomer,
    paymentMethods, setPaymentMethods,
    searchCustomerQuery, setSearchCustomerQuery,
    setTempPhone, tempPhone, //ส่งออกไปให้หน้า UI คอมโพเนนต์เรียกใช้งาน
    searchResults, setSearchResults,
    triggerLiveSearch,
    customerTypes, activeTypeId, setActiveTypeId,
    selectedPaymentType, setSelectedPaymentType,
    paymentMethodId, setPaymentMethodId,
    billDiscountValue, setBillDiscountValue,
    billDiscountType, setBillDiscountType,
    isSubmitting, computedBillDiscount, finalTotal,
    totalItemPrice, totalLineDiscount, 
    submitOrderToDatabase,
    handleOpenPaymentModal, 
    resetBillDiscount,
    isPaymentModalOpen, setIsPaymentModalOpen,
    receivedAmount, setReceivedAmount,
    receiverName, setReceiverName,
    handleSearchCustomer,      
    handleBillDiscountChange,
    change, handleReceivedAmountBlur,
    displayValue, setDisplayValue, handleReceivedAmountChange,
    handleReceivedAmountFocus,
  };
}