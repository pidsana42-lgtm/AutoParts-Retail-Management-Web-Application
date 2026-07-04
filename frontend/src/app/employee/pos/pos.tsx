import React, { useState, useMemo } from "react";
import {
  Trash2,
  Percent,
  QrCode,
  CreditCard,
  Coins,
  Plus,
  Minus,
} from "lucide-react";
import Button from "../../../components/elements/button";
import {
  posApiService,
  calculateValidatedDiscount,
} from "../../../service/http/pos/pos_service";
import type {
  SaleOrderItemRequest,
  CreateSaleOrderRequest,
} from "../../../interface/pos/pos_interface";
import type { StoreConfigInterface } from "../../../interface/pos/store_config_interface";
import type {
  CustomerDiscountResponse,
  CustomerTypeInterface,
} from "../../../interface/pos/customer_interface";
import apiClient from "../../../service/http/apiClient";

export default function PosPage(): React.JSX.Element {
  // ─── States ───
  const [cart, setCart] = useState<SaleOrderItemRequest[]>(() => {
    if (typeof window !== "undefined") {
      const savedCart = localStorage.getItem("pos_cart");
      return savedCart ? JSON.parse(savedCart) : [];
    }
    return [];
  });
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchCustomerQuery, setSearchCustomerQuery] = useState<string>("");
  const [customer, setCustomer] = useState<CustomerDiscountResponse | null>(
    null,
  );

  const [billDiscountValue, setBillDiscountValue] = useState<number>(0.0);
  const [billDiscountType, setBillDiscountType] = useState<
    "none" | "percentage" | "amount"
  >("none");
  const [paymentMethodId, setPaymentMethodId] = useState<number>(1); // 1=เงินสด, 2=QR, 3=เงินเชื่อ
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [storeConfig, setStoreConfig] = useState<StoreConfigInterface | null>(
    null,
  );

  const [customerTypes, setCustomerTypes] = useState<CustomerTypeInterface[]>(
    [],
  );

  const [activeTypeId, setActiveTypeId] = useState<number>(1);
  const [selectedPaymentType, setSelectedPaymentType] = useState<
    "CASH" | "CREDIT"
  >("CASH");

  // ─── Effects ───
  React.useEffect(() => {
    const fetchCustomerTypes = async () => {
      try {
        const response = await apiClient.get<CustomerTypeInterface[]>(
          "/pos/customer-types",
        );
        setCustomerTypes(response.data);
      } catch (error) {
        console.error("ไม่สามารถดึงข้อมูลประเภทลูกค้าได้:", error);
      }
    };
    fetchCustomerTypes();
  }, []);

  React.useEffect(() => {
    posApiService
      .getStoreConfig()
      .then((data) => setStoreConfig(data))
      .catch((error) =>
        console.error("ไม่สามารถดึงข้อมูลตั้งค่าร้านค้าได้:", error),
      );
  }, []);

  React.useEffect(() => {
    localStorage.setItem("pos_cart", JSON.stringify(cart));
  }, [cart]);

  // ─── การคำนวณราคาและเพดานส่วนลดรวม (Component Scope) ───
  const totalItemPrice = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.unit_price * item.qty, 0);
  }, [cart]);

  const totalLineDiscount = useMemo(() => {
    return cart.reduce((sum, item) => {
      const lineTotal = item.unit_price * item.qty;
      if (item.discount_type === "percentage") {
        return sum + (lineTotal * item.discount_value) / 100;
      } else if (item.discount_type === "amount") {
        return sum + item.discount_value;
      }
      return sum;
    }, 0);
  }, [cart]);

  const maxGlobalRate = storeConfig?.max_item_discount_rate ?? 2.0;
  const maxAllowedDiscountAmount = (totalItemPrice * maxGlobalRate) / 100;
  const isLineDiscountFull = totalLineDiscount >= maxAllowedDiscountAmount;

  const computedBillDiscount = useMemo(() => {
    const remainingAfterLineDiscount = totalItemPrice - totalLineDiscount;
    if (billDiscountType === "amount") return billDiscountValue;
    if (billDiscountType === "percentage")
      return (remainingAfterLineDiscount * billDiscountValue) / 100;
    return 0;
  }, [billDiscountType, billDiscountValue, totalItemPrice, totalLineDiscount]);

  const finalTotal = useMemo(() => {
    const total = totalItemPrice - totalLineDiscount - computedBillDiscount;
    return total < 0 ? 0 : total;
  }, [totalItemPrice, totalLineDiscount, computedBillDiscount]);

  // ─── ฟังก์ชันจัดการกิจกรรมต่างๆ ───
  const handleSearchCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchCustomerQuery) return;
    try {
      const response = await apiClient.get<CustomerDiscountResponse[]>(
        `/pos/customer-discount?search=${searchCustomerQuery}`,
      );
      const dataList = response.data;
      if (!dataList || dataList.length === 0) {
        alert("ไม่พบข้อมูลลูกค้ารายนี้ในระบบ");
        return;
      }

      const customerData = dataList[0];
      setCustomer(customerData);

      if (customerData.customer_type) {
        setActiveTypeId(customerData.customer_type.id);

        if (customerData.customer_type.type_name !== "GENERAL") {
          setSelectedPaymentType("CREDIT");
          setPaymentMethodId(3);
        } else {
          setSelectedPaymentType("CASH");
          setPaymentMethodId(1);
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedQuery = searchQuery.trim();
    if (!cleanedQuery) return;

    try {
      const products = await posApiService.searchProducts(cleanedQuery);
      if (!products || products.length === 0) {
        alert("ไม่พบรหัสบาร์โค้ดสินค้าชิ้นนี้ในสต๊อกระบบ");
        return;
      }

      const product =
        products.find(
          (p) => p.barcode === cleanedQuery || p.product_code === cleanedQuery,
        ) || products[0];

      // เรียกใช้ฟังก์ชันหา Default ส่วนลดตามสิทธิ์กลุ่มลูกค้า
      const { getDefaultProductDiscount } =
        await import("../../../service/http/pos/pos_service");
      const discountConfig = getDefaultProductDiscount(
        product,
        customer,
        activeTypeId,
      );

      const existingIndex = cart.findIndex(
        (item) => item.product_id === product.id,
      );
      if (existingIndex > -1) {
        const newCart = [...cart];
        newCart[existingIndex].qty += 1;
        setCart(newCart);
      } else {
        setCart([
          ...cart,
          {
            product_id: product.id,
            product_code: product.product_code,
            product_name: product.product_name,
            part_number: product.part_number,
            qty: 1,
            unit_price: product.sale_price,
            grade_name: product.grade_name,
            brand_name: product.brand_name,
            model_name: product.model_name,
            note: product.note,
            max_discount_rate: product.max_discount_rate,
            // รองรับอู่ลดทันที / บริษัทห้ามลด
            discount_type: discountConfig.type,
            discount_value: discountConfig.value,
          },
        ]);
      }
      setSearchQuery("");
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการดึงข้อมูลสินค้าหลังบ้าน");
    }
  };

  const updateQty = (index: number, delta: number) => {
    const newCart = [...cart];
    newCart[index].qty = Math.max(1, newCart[index].qty + delta);
    setCart(newCart);
  };

  const handleRemoveItem = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const handleBillDiscountChange = (valueStr: string) => {
    const inputValue = valueStr === "" ? 0 : parseFloat(valueStr) || 0;
    if (inputValue < 0) return;

    const currentCustomerTypeId = customer?.customer_type?.id || activeTypeId;
    const currentCustomerTypeName = customer?.customer_type?.type_name || "";

    // RULE 1: ลูกค้ากลุ่มบริษัท -> ห้ามลดท้ายบิลเด็ดขาด
    if (
      currentCustomerTypeId === 3 ||
      currentCustomerTypeName === "WHOLESALE"
    ) {
      alert("ลูกค้ากลุ่มบริษัทไม่ได้รับสิทธิ์ส่วนลดใดๆ ทั้งสิ้น");
      setBillDiscountValue(0);
      return;
    }

    // ดึงค่านโยบายร้านค้าจาก StoreConfig (เช่น ห้ามลดท้ายบิลเกิน 6%)
    const maxExtraConfigRate = storeConfig?.max_extra_discount_rate ?? 6.0;

    // ฐานยอดรวมหลังหักลดรายชิ้นแล้ว (ราคาสุทธิที่จะเอามาคิดลดท้ายบิลต่อ)
    const remainingAfterLineDiscount = totalItemPrice - totalLineDiscount;

    // แปลงค่าเงินที่พนักงานกรอกท้ายบิลให้เป็นหน่วยเปอร์เซ็นต์ (%) เพื่อเช็คกับนโยบายร้าน
    let inputAmountInPercent = 0;
    if (billDiscountType === "percentage") {
      inputAmountInPercent = inputValue;
    } else if (
      billDiscountType === "amount" &&
      remainingAfterLineDiscount > 0
    ) {
      inputAmountInPercent = (inputValue / remainingAfterLineDiscount) * 100;
    }

    // ตรวจสอบเงื่อนไข: ส่วนลดท้ายบิลต้องไม่เกินที่ Store Config กำหนดไว้ (ไม่สนใจส่วนลดต่อชิ้น)
    if (inputAmountInPercent > maxExtraConfigRate + 0.01) {
      if (billDiscountType === "percentage") {
        alert(
          `ส่วนลดท้ายบิลเกินนโยบายร้านค้า \n(ร้านค้ายอมให้ลดเพิ่มท้ายบิลสูงสุดไม่เกิน ${maxExtraConfigRate.toFixed(1)}%)`,
        );
      } else {
        // ฿ เคสกรอกเป็นบาท: คำนวณหาจำนวนเงินบาทสูงสุดที่เป็นไปได้จากโควตา % ของร้าน
        const maxExtraDiscountBaht =
          (remainingAfterLineDiscount * maxExtraConfigRate) / 100;
        alert(
          `ส่วนลดท้ายบิลเกินนโยบายร้านค้า \n(ร้านค้ายอมให้ลดเพิ่มท้ายบิลสูงสุดไม่เกิน ฿${maxExtraDiscountBaht.toFixed(2)})`,
        );
      }

      setBillDiscountValue(0); // ดีดกลับเป็น 0 เพื่อความปลอดภัย
      return;
    }

    setBillDiscountValue(inputValue);
  };

  const handleDiscountToggle = (index: number, isChecked: boolean) => {
    setCart((prev) =>
      prev.map((item, i) => {
        if (i === index) {
          return {
            ...item,
            discount_type: isChecked ? "percentage" : "none",
            discount_value: isChecked
              ? customer?.standard_discount_rate || 0
              : 0,
          };
        }
        return item;
      }),
    );
  };

  const handleDiscountTypeChange = (
    index: number,
    type: "amount" | "percentage",
  ) => {
    setCart((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              discount_type: type,
              discount_value: 0,
            }
          : item,
      ),
    );
  };

  // ─── ค้นหาฟังก์ชันเดิมแล้วเปลี่ยนเป็นชุดนี้ ───
  const handleDiscountValueChange = (index: number, valueStr: string) => {
    // 1. แปลงค่าอินพุตที่คีย์เข้ามาให้ปลอดภัย
    const rawValue = valueStr === "" ? 0 : parseFloat(valueStr) || 0;
    if (rawValue < 0) return;

    const currentCustomerTypeId = customer?.customer_type?.id || activeTypeId;
    const currentCustomerTypeName = customer?.customer_type?.type_name || "";

    // ลูกค้ากลุ่มบริษัท -> บล็อกสิทธิ์ทันที ห้ามลดทุกกรณี
    if (
      currentCustomerTypeId === 3 ||
      currentCustomerTypeName === "WHOLESALE"
    ) {
      alert("ลูกค้ากลุ่มบริษัทไม่ได้รับสิทธิ์ส่วนลดใดๆ ทั้งสิ้น");
      setCart((prev) =>
        prev.map((cartItem, i) =>
          i === index
            ? { ...cartItem, discount_value: 0, discount_type: "none" }
            : cartItem,
        ),
      );
      return;
    }

    const item = cart[index];
    const lineTotal = item.unit_price * item.qty;

    // 2. คำนวณหาเพดานสูงสุด (Max Allowed Rate) ของรายการชิ้นนี้เพียวๆ
    // ทั่วไปเริ่มต้นจากสินค้า (เช่น 2.0%) / อู่ซ่อมรถได้บวก Ontop เพิ่มพิเศษ (เช่น +3.0%)
    let allowedMaxRate = item.max_discount_rate ?? 2.0;
    const isGarageMode =
      currentCustomerTypeId === 2 ||
      currentCustomerTypeName === "GARAGE" ||
      customer?.customer_name?.includes("อู่");

    if (isGarageMode) {
      const ontopRate = customer
        ? ((customer as any).ontop_discount_rate ?? 3.0)
        : 3.0;
      allowedMaxRate += ontopRate; // สิทธิ์สูงสุดรวมของอู่ชิ้นนี้คือ 5.0%
    }

    // 3. แปลงค่าที่พนักงานกำลังป้อนหน้างานให้กลายเป็นหน่วยเปอร์เซ็นต์ (%) เพื่อตรวจสอบกับเพดาน
    let inputLineDiscountPercent = 0;
    if (item.discount_type === "percentage") {
      inputLineDiscountPercent = rawValue;
    } else if (item.discount_type === "amount" && lineTotal > 0) {
      inputLineDiscountPercent = (rawValue / lineTotal) * 100;
    }

    // 4. [จุดแก้ไขสำคัญ]: ตรวจเช็คเฉพาะ "เปอร์เซ็นต์ที่กรอกใหม่" เทียบกับ "allowedMaxRate" ตรงๆ
    // ไม่เอาข้อมูล ส่วนลดท้ายบิล หรือค่าน้ำหนักถัวเฉลี่ยใดๆ มาร่วมคำนวณในเงื่อนไขนี้อีกต่อไป
    if (inputLineDiscountPercent > allowedMaxRate + 0.01) {
      if (item.discount_type === "percentage") {
        alert(
          `ไม่สามารถให้ส่วนลดเกินข้อกำหนดสิทธิ์ลูกค้าได้ \n(รายการนี้กรอกช่องต่อชิ้นได้สูงสุดไม่เกิน ${allowedMaxRate.toFixed(2)}%)`,
        );
      } else {
        const maxDiscountBaht = (lineTotal * allowedMaxRate) / 100;
        alert(
          `ไม่สามารถให้ส่วนลดเกินข้อกำหนดสิทธิ์ลูกค้าได้ \n(รายการนี้กรอกช่องต่อชิ้นได้สูงสุดไม่เกิน ฿${maxDiscountBaht.toFixed(2)})`,
        );
      }

      // ปรับปรุง: เมื่อป้อนผิด ให้ดีดค่ากลับไปเป็นสิทธิ์สูงสุดของอู่นั้นๆ (เช่น 5%)
      // แทนการดีดเป็น 0 เพื่อให้ระบบคงราคาส่วนลดมาตรฐานของอู่ไว้ ไม่หลุดเป็นราคาเต็ม
      setCart((prev) =>
        prev.map((cartItem, i) =>
          i === index
            ? {
                ...cartItem,
                discount_value:
                  item.discount_type === "percentage"
                    ? allowedMaxRate
                    : (lineTotal * allowedMaxRate) / 100,
              }
            : cartItem,
        ),
      );
      return;
    }

    // 5. หากผ่านเกณฑ์ อัปเดตข้อมูลลงตะกร้ารถตามปกติ
    setCart((prev) =>
      prev.map((cartItem, i) =>
        i === index ? { ...cartItem, discount_value: rawValue } : cartItem,
      ),
    );
  };

  const handleClearAllCart = () => {
    if (cart.length === 0) return;
    if (window.confirm("คุณแน่ใจหรือไม่ว่าต้องการล้างตะกร้าสินค้าทั้งหมด?")) {
      setCart([]);
      localStorage.removeItem("pos_cart");
    }
  };

  const handleConfirmSale = async () => {
    if (cart.length === 0) {
      alert("กรุณาเลือกสินค้าลงตะกร้าอย่างน้อย 1 รายการ");
      return;
    }
    if (!customer) {
      alert("กรุณาเลือกหรือค้นหาบัญชีลูกค้าเพื่อเปิดบิลขายก่อนครับ");
      return;
    }
    setIsSubmitting(true);

    const totalSubtotalAfterLineDiscount = totalItemPrice - totalLineDiscount;
    let distributedBillDiscountAccumulator = 0;

    // คำนวณกระจายน้ำหนัก Pro-rata / Weighted Average ลงรายไอเทม
    const computedItems = cart.map((item, index) => {
      const lineTotal = item.unit_price * item.qty;
      const itemDiscount =
        item.discount_type === "percentage"
          ? (lineTotal * item.discount_value) / 100
          : item.discount_value;

      const subtotalAfterLineDiscount = lineTotal - itemDiscount;
      let allocatedBillDiscount = 0;

      if (totalSubtotalAfterLineDiscount > 0 && computedBillDiscount > 0) {
        if (index === cart.length - 1) {
          // ชิ้นสุดท้ายเก็บเศษทศนิยมขยะทั้งหมดเพื่อไม่ให้ยอดรวมเคลื่อน
          allocatedBillDiscount =
            computedBillDiscount - distributedBillDiscountAccumulator;
        } else {
          const weight =
            subtotalAfterLineDiscount / totalSubtotalAfterLineDiscount;
          allocatedBillDiscount =
            Math.round(computedBillDiscount * weight * 100) / 100;
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
        // แนบข้อมูลการถัวเฉลี่ยรายบรรทัดส่งไปเซฟลง DB สำหรับใช้ดึงตอนรับคืนสินค้า (Refund)
        allocated_bill_discount: allocatedBillDiscount,
        net_subtotal: subtotalAfterLineDiscount - allocatedBillDiscount,
      };
    });

    const salePayload: CreateSaleOrderRequest = {
      customer_id: customer.id,
      payment_method_id: paymentMethodId,
      bill_discount_type: billDiscountType,
      bill_discount_value: billDiscountValue,
      note: "บันทึกคำสั่งซื้อผ่านระบบ POS หน้าร้าน (ถัวเฉลี่ยท้ายบิลรองรับงานรับคืน)",
      items: computedItems as any,
    };

    try {
      await posApiService.createPOSOrder(salePayload);
      alert("บันทึกข้อมูลการขายสำเร็จ!");
      setCart([]);
      localStorage.removeItem("pos_cart");
      setCustomer(null);
      setBillDiscountValue(0);
      setBillDiscountType("none");
      setActiveTypeId(1);
      setSelectedPaymentType("CASH");
    } catch (error: any) {
      alert(
        error.response?.data?.error ||
          error.message ||
          "เกิดปัญหาที่ระบบหลังบ้าน",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row bg-white min-h-[calc(100vh-4rem)] font-sans text-gray-800 antialiased overflow-x-hidden">
      {/* ─── ฝั่งซ้าย: จัดการบิลและตารางสินค้า ─── */}
      <div className="w-full lg:w-[73%] bg-white p-6 flex flex-col justify-between">
        <div>
          {/* ส่วนหัว */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-xs text-[#E51C23] font-bold uppercase tracking-wider">
                รายการที่กำลังขาย
              </p>
              <h1 className="text-4xl font-extrabold text-zinc-900">POS</h1>
            </div>
            <div className="text-right flex flex-col items-end gap-1.5">
              <p className="text-xs text-[#6B7280] font-medium">
                สถานะรายการขาย
              </p>
              <h2 className="text-2xl font-bold text-zinc-800">
                บิลร่าง (DRAFT)
              </h2>
              <button
                type="button"
                onClick={handleClearAllCart}
                disabled={cart.length === 0}
                className={`text-xs font-bold px-2.5 py-1 transition-colors border rounded-none cursor-pointer ${
                  cart.length === 0
                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed select-none"
                    : "bg-[#E51C23] text-white border-[#E51C23] hover:bg-[#C62828]"
                }`}
              >
                ล้างทั้งหมด
              </button>
            </div>
          </div>

          {/* แถบการจัดการส่วนลดบิล */}
          <div className="bg-[#1C1B1B] text-gray-300 rounded-none p-4 mb-6 flex justify-between items-start border border-zinc-800 border-l-4 border-l-[#E51C23]">
            <div className="flex flex-col items-start gap-2 w-2/3">
              <div className="flex items-center gap-2 font-bold text-sm shrink-0 mt-2">
                <Percent size={16} className="text-[#E51C23]" />
                <span className="text-[#FFFFFF]">การจัดการส่วนลด</span>
              </div>

              <div className="relative flex items-center gap-2 w-full max-w-xs mt-2.5">
                <div className="relative w-full">
                  <span className="absolute left-3 top-2.5 text-xs text-zinc-500 font-bold select-none">
                    {billDiscountType === "percentage" ? "%" : "฿"}
                  </span>
                  <input
                    type="number"
                    value={billDiscountValue === 0 ? "" : billDiscountValue}
                    onChange={(e) => handleBillDiscountChange(e.target.value)}
                    disabled={billDiscountType === "none"}
                    className={`w-full px-3 py-2 pl-10 text-sm focus:outline-none focus:border-red-500 transition-colors ${
                      billDiscountType === "none"
                        ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700"
                        : "bg-[#2A2929] text-white"
                    }`}
                    placeholder={
                      billDiscountType === "none" ? "ล็อกไว้" : "0.00"
                    }
                  />
                </div>
                <button
                  type="button"
                  disabled={billDiscountType === "none"}
                  onClick={() =>
                    handleBillDiscountChange(String(billDiscountValue))
                  }
                  className={`text-xs font-bold px-4 py-2.5 rounded-none shrink-0 transition-colors shadow-sm cursor-pointer ${
                    billDiscountType === "none"
                      ? "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                      : "bg-[#E51C23] hover:bg-[#B70011] text-white"
                  }`}
                >
                  อัปเดตบิล
                </button>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 text-xs shrink-0">
              <div className="flex bg-[#2D2C2C] rounded-none p-0.5 ">
                <button
                  type="button"
                  onClick={() => {
                    setBillDiscountType("none");
                    setBillDiscountValue(0);
                  }}
                  className={`px-3 py-1 rounded-none transition-all cursor-pointer ${billDiscountType === "none" ? "bg-[#E51C23] text-white font-bold " : "text-zinc-[#D1D5DB] hover:text-zinc-200"}`}
                >
                  ต่อรายการ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBillDiscountType("amount");
                    setBillDiscountValue(0);
                  }}
                  className={`px-3 py-1 rounded-none transition-all cursor-pointer ${billDiscountType === "amount" ? "bg-[#E51C23] text-white font-bold" : "text-zinc-[#D1D5DB] hover:text-zinc-200"}`}
                >
                  บิลทั้งหมด (฿)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBillDiscountType("percentage");
                    setBillDiscountValue(0);
                  }}
                  className={`px-3 py-1 rounded-none transition-all cursor-pointer ${billDiscountType === "percentage" ? "bg-[#E51C23] text-white font-bold" : "text-zinc-[#D1D5DB] hover:text-zinc-200"}`}
                >
                  บิลทั้งหมด (%)
                </button>
              </div>

              <div className="bg-[#2D2C2C] p-2 text-[11px] leading-tight text-[#D1D5DB] max-w-[265px] text-left rounded-none">
                <span className="text-[#E51C23] font-bold mr-1">ⓘ</span>
                {billDiscountType === "none" ? (
                  <span>
                    เลือกหน่วย (฿ / %)
                    และระบุจำนวนส่วนลดที่ต้องการในแต่ละรายการสินค้า
                  </span>
                ) : (
                  <span>
                    ส่วนลดกำลังดำเนินการ: (ราคาสินค้า / ยอดรวม) *{" "}
                    <span className="font-bold text-white">
                      {billDiscountValue
                        ? billDiscountValue.toFixed(2)
                        : "0.00"}
                    </span>{" "}
                    {billDiscountType === "percentage" ? "%" : "บาท"}{" "}
                    จะถูกหักตามสัดส่วน ดำเนินการต่อในรายการ
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ตารางแสดงสินค้า */}
          <div className="bg-white rounded-none shadow-sm overflow-hidden border border-gray-200">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F6F3F2] rounded-none border-b border-gray-200 text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">
                  <th className="py-3 px-4 w-[15%]">SKU</th>
                  <th className="py-3 px-4 w-[32%]">คำอธิบายสินค้า</th>
                  <th className="py-3 px-4 text-right w-[12%]">หน่วยราคา</th>
                  <th className="py-3 px-4 text-center w-[12%]">QTY</th>
                  <th className="py-3 px-4 text-center w-[8%]">DISC?</th>
                  <th className="py-3 px-4 text-center w-[12%]">
                    ประเภทส่วนลด
                  </th>
                  <th className="py-3 px-4 text-center w-[10%]">ลดราคา</th>
                  <th className="py-3 px-4 text-right pr-6 w-[11%]">
                    LINE TOTAL
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-400">
                      ยังไม่มีสินค้าในตะกร้า
                    </td>
                  </tr>
                ) : (
                  cart.map((item, index) => {
                    const lineTotal = item.unit_price * item.qty;
                    const itemDiscount =
                      item.discount_type === "percentage"
                        ? (lineTotal * item.discount_value) / 100
                        : item.discount_value;

                    // ย้ายการประกาศ subtotalAfterDiscount ขึ้นมาไว้ตรงนี้ก่อนนำไปใช้คำนวณ Weight ด้านล่าง (แก้ปัญหา NaN / บั๊กป้ายแดงไม่ขึ้น)
                    const subtotalAfterDiscount = lineTotal - itemDiscount;

                    let allocatedDiscount = 0;
                    const totalSubtotalAfterLineDiscount =
                      totalItemPrice - totalLineDiscount;

                    if (
                      totalSubtotalAfterLineDiscount > 0 &&
                      computedBillDiscount > 0
                    ) {
                      if (index === cart.length - 1) {
                        let distributedAmount = 0;
                        for (let i = 0; i < index; i++) {
                          const prevItem = cart[i];
                          const prevLineTotal =
                            prevItem.unit_price * prevItem.qty;
                          const prevItemDiscount =
                            prevItem.discount_type === "percentage"
                              ? (prevLineTotal * prevItem.discount_value) / 100
                              : prevItem.discount_value;
                          const prevWeight =
                            (prevLineTotal - prevItemDiscount) /
                            totalSubtotalAfterLineDiscount;
                          distributedAmount +=
                            Math.round(
                              computedBillDiscount * prevWeight * 100,
                            ) / 100;
                        }
                        allocatedDiscount =
                          computedBillDiscount - distributedAmount;
                      } else {
                        const weight =
                          subtotalAfterDiscount /
                          totalSubtotalAfterLineDiscount;
                        allocatedDiscount =
                          Math.round(computedBillDiscount * weight * 100) / 100;
                      }
                    }

                    const finalLineTotal =
                      subtotalAfterDiscount - allocatedDiscount;

                    return (
                      <tr
                        key={index}
                        className="hover:bg-gray-50/80 transition-colors"
                      >
                        <td className="py-4 px-4 font-bold text-xs text-[#1C1B1B]">
                          {item.product_code || "—"}
                        </td>
                        <td className="py-4 px-4">
                          <p className="font-bold text-[#1C1B1B]">
                            {item.product_name}
                          </p>
                          <p className="text-[11px] text-[#6B7280] font-mono mt-0.5">
                            PN: {item.part_number || "—"}
                          </p>
                          {(item.grade_name || item.model_name) && (
                            <p className="text-[11px] text-[#6B7280] font-medium mt-1 inline-block py-0.5 rounded-sm">
                              เกรด: {item.grade_name || "ทั่วไป"} |
                              รุ่นรถที่รองรับ: {item.model_name || "ทุกรุ่น"}
                            </p>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right font-bold text-[#1C1B1B]">
                          {item.unit_price.toFixed(2)}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="inline-flex items-center border border-gray-300 rounded-none bg-[#F6F3F2]">
                            <button
                              type="button"
                              onClick={() => updateQty(index, -1)}
                              className="p-1 px-2 cursor-pointer text-[#1C1B1B] hover:text-black"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="px-2 font-bold min-w-[20px]">
                              {String(item.qty).padStart(2, "0")}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQty(index, 1)}
                              className="p-1 px-2 cursor-pointer text-gray-600 hover:text-black"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={item.discount_type !== "none"}
                            className="accent-[#E51C23] h-4 w-4 cursor-pointer"
                            onChange={(e) =>
                              handleDiscountToggle(index, e.target.checked)
                            }
                          />
                        </td>
                        <td className="py-4 px-4 text-center">
                          {item.discount_type !== "none" ? (
                            <div className="inline-flex bg-[#F6F3F2] p-0.5 rounded-none text-xs font-bold">
                              <button
                                type="button"
                                onClick={() =>
                                  handleDiscountTypeChange(index, "amount")
                                }
                                className={`px-2 py-1 transition-all cursor-pointer ${
                                  item.discount_type === "amount"
                                    ? "bg-[#E51C23] text-white"
                                    : "text-[#6B7280] hover:text-gray-600"
                                }`}
                              >
                                ฿
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleDiscountTypeChange(index, "percentage")
                                }
                                className={`px-2 py-1 transition-all cursor-pointer ${
                                  item.discount_type === "percentage"
                                    ? "bg-[#E51C23] text-white"
                                    : "text-[#6B7280] hover:text-gray-600"
                                }`}
                              >
                                %
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        {/* คอลัมน์ "ลดราคา" (คอลัมน์ที่ 7) */}
                        <td className="py-4 px-4 text-center">
                          {item.discount_type !== "none" ? (
                            <div className="flex flex-col items-center gap-1">
                              <div className="relative inline-flex items-center justify-center px-2 py-1 min-w-[75px] transition-all border bg-gray-100 text-gray-700 border-gray-300 rounded-none font-medium">
                                {item.discount_type === "amount" &&
                                  item.discount_value > 0 && (
                                    <span className="mr-0.5 text-gray-500 font-bold select-none">
                                      -
                                    </span>
                                  )}
                                <input
                                  type="number"
                                  step="any"
                                  value={
                                    item.discount_value === 0
                                      ? ""
                                      : item.discount_value
                                  }
                                  placeholder="0"
                                  onChange={(e) =>
                                    handleDiscountValueChange(
                                      index,
                                      e.target.value,
                                    )
                                  }
                                  className="w-12 bg-transparent text-center text-gray-800 font-bold outline-none border-b border-transparent focus:border-zinc-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                {item.discount_type === "percentage" && (
                                  <span className="ml-0.5 text-gray-400 font-bold select-none">
                                    %
                                  </span>
                                )}
                              </div>
                              {/* แสดงป้ายแดงถัวเฉลี่ยลดรวมเฉพาะเวลาค่ามากกว่า 0 */}
                              {itemDiscount + allocatedDiscount > 0 && (
                                <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-sm block whitespace-nowrap mt-0.5">
                                  ถัวเฉลี่ยลด: -฿
                                  {(itemDiscount + allocatedDiscount).toFixed(
                                    2,
                                  )}
                                </span>
                              )}
                            </div>
                          ) : allocatedDiscount > 0 ? (
                            <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-sm inline-block whitespace-nowrap">
                              ถัวเฉลี่ยลด: -฿{allocatedDiscount.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        {/* คอลัมน์ "LINE TOTAL" (คอลัมน์ที่ 8 ขวาสุด) */}
                        <td className="py-4 px-4 text-right pr-6 font-bold text-zinc-900">
                          <div className="flex justify-end items-center gap-3">
                            <div className="text-right">
                              {itemDiscount + allocatedDiscount > 0 && (
                                <span className="text-[11px] text-zinc-400 line-through block font-normal">
                                  ฿{lineTotal.toFixed(2)}
                                </span>
                              )}
                              <span className="text-sm font-black text-zinc-950 block">
                                ฿{finalLineTotal.toFixed(2)}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <form onSubmit={handleAddProduct} className="mt-6 flex gap-2">
          <div className="relative flex-1">
            <QrCode
              className="absolute left-4 top-3.5 text-gray-400"
              size={18}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="สแกนบาร์โค้ดสินค้า หรือพิมพ์เลขบาร์โค้ดที่นี่เพื่อเพิ่มรายการ..."
              className="w-full bg-white border border-gray-200 rounded pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-red-500 shadow-sm font-sans"
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="bg-[#1C1B1B] text-white font-bold px-8 py-3 rounded-none text-sm hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            เพิ่มรายการ
          </button>
        </form>
      </div>

      {/* ─── ฝั่งขวา: ข้อมูลลูกค้า & ปุ่มชำระเงินจริง ─── */}
      <div className="w-full lg:w-[27%] bg-[#F6F3F2] p-6 flex flex-col justify-between shadow-2xl shrink-0 min-h-full">
        <div>
          <div className="mb-4">
            <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">
              ข้อมูลลูกค้า
            </p>

            <div className="grid grid-cols-3 gap-1 mb-2">
              {customerTypes.map((type) => {
                const isActive =
                  customer && customer.customer_type
                    ? customer.customer_type.id === type.id
                    : activeTypeId === type.id;

                const subLabelMap: Record<string, string> = {
                  GENERAL: "REGULAR",
                  GARAGE: "CREDIT",
                  WHOLESALE: "SPECIAL",
                };

                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => {
                      if (!customer) {
                        setActiveTypeId(type.id);
                        if (type.type_name === "GENERAL") {
                          setSelectedPaymentType("CASH");
                          setPaymentMethodId(1);
                        } else {
                          setSelectedPaymentType("CREDIT");
                          setPaymentMethodId(3);
                        }
                      }
                    }}
                    className={`flex flex-col items-center justify-center text-center transition-all duration-150 cursor-pointer h-10 gap-0 leading-tight ${
                      isActive
                        ? "bg-white border border-zinc-400 text-zinc-900 shadow-sm"
                        : "bg-transparent border border-transparent text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {type.type_label.replace("ลูกค้า", "")}
                    <span
                      className={`text-[9px] block ${isActive ? "text-[#1C1B1B] font-bold" : "text-gray-400"}`}
                    >
                      {subLabelMap[type.type_name] || type.type_name}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-1 mb-4">
              <button
                type="button"
                onClick={() => {
                  if (!customer) {
                    setSelectedPaymentType("CASH");
                    setPaymentMethodId(1);
                  }
                }}
                className={`text-center py-1.5 border text-xs font-bold cursor-pointer transition-all ${
                  selectedPaymentType === "CASH"
                    ? "bg-white border-zinc-400 text-zinc-900 shadow-sm"
                    : "bg-gray-50 border-gray-200 text-gray-400"
                }`}
              >
                เงินสด
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!customer) {
                    const currentActiveType = customerTypes.find(
                      (t) => t.id === activeTypeId,
                    );
                    if (currentActiveType?.type_name === "GENERAL") {
                      alert("ลูกค้าทั่วไปไม่สามารถเลือกโหมดเงินเชื่อได้");
                      return;
                    }
                    setSelectedPaymentType("CREDIT");
                    setPaymentMethodId(3);
                  }
                }}
                className={`text-center py-1.5 border text-xs font-bold cursor-pointer transition-all ${
                  selectedPaymentType === "CREDIT"
                    ? "bg-white border-zinc-400 text-zinc-900 shadow-sm"
                    : "bg-gray-50 border-gray-200 text-gray-400"
                }`}
              >
                เงินเชื่อ
              </button>
            </div>

            <form onSubmit={handleSearchCustomer} className="flex gap-1">
              <input
                type="text"
                value={searchCustomerQuery}
                onChange={(e) => setSearchCustomerQuery(e.target.value)}
                className="flex-1 bg-white border border-gray-300 rounded px-3 py-2 text-xs shadow-sm focus:outline-none focus:border-zinc-500"
                placeholder="ค้นหาชื่ออู่ซ่อมรถ หรือคีย์เบอร์โทร..."
              />
              <button
                type="submit"
                className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold px-4 py-2 rounded shadow transition-colors cursor-pointer"
              >
                ค้นหา
              </button>
            </form>
          </div>

          <div className="bg-[#1C1B1B] text-white rounded-none p-5 mb-6 border border-zinc-800 shadow-lg relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-black tracking-tight text-white">
                  {customer ? customer.customer_name : "ลูกค้ารายย่อยทั่วไป"}
                </h3>
                <p className="text-xs text-zinc-400 font-medium mt-0.5">
                  โทร:{" "}
                  {customer ? customer.phone_number || "ไม่ระบุ" : "0xxxxxxxxx"}
                </p>
              </div>
              <div className="bg-[#2E6B20] text-white text-[10px] font-bold px-2.5 py-1 rounded-none select-none uppercase tracking-wide">
                {customer && customer.is_discount_enabled
                  ? "ระดับราคาพิเศษ"
                  : "ระดับราคามาตรฐาน"}
              </div>
            </div>

            <div className="mt-4">
              <div className="flex justify-between items-center text-[11px] text-zinc-400 mb-1">
                <span>การใช้เครดิตในระดับราคานี้</span>
                <span className="font-bold text-white font-mono">
                  {customer &&
                  customer.max_credit_limit &&
                  customer.max_credit_limit > 0
                    ? `${((customer.current_debt_amount / customer.max_credit_limit) * 100).toFixed(0)}%`
                    : "0%"}
                </span>
              </div>
              <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-zinc-400 h-full transition-all duration-500"
                  style={{
                    width:
                      customer &&
                      customer.max_credit_limit &&
                      customer.max_credit_limit > 0
                        ? `${Math.min(100, (customer.current_debt_amount / customer.max_credit_limit) * 100)}%`
                        : "0%",
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-5 pt-4 border-t border-zinc-800/60">
              <div className="bg-[#262525] p-3 border border-zinc-800/40">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                  ยอดคงเหลือปัจจุบัน
                </p>
                <p className="text-base font-black font-mono mt-1 text-zinc-300">
                  ฿
                  {customer && customer.current_debt_amount
                    ? customer.current_debt_amount.toFixed(2)
                    : "0.00"}
                </p>
              </div>
              <div className="bg-[#262525] p-3 border border-zinc-800/40">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                  เครดิตคงเหลือ
                </p>
                <p className="text-base font-black font-mono mt-1 text-zinc-300">
                  ฿
                  {customer && customer.max_credit_limit
                    ? (
                        customer.max_credit_limit - customer.current_debt_amount
                      ).toFixed(2)
                    : "0.00"}
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-400 font-medium">
              <span className="text-zinc-500">ⓘ วงเงินเครดิต:</span>
              <span className="font-bold font-mono text-zinc-300">
                ฿
                {customer && customer.max_credit_limit
                  ? customer.max_credit_limit.toFixed(2)
                  : "0.00"}
              </span>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t text-sm font-medium">
            <div className="flex justify-between text-gray-500">
              <span>ราคารวมสินค้า</span>
              <span className="font-bold text-zinc-900">
                ฿{totalItemPrice.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>ส่วนลดท้ายบิล</span>
              <span className="font-bold text-zinc-900">
                ฿{computedBillDiscount.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-red-600 font-extrabold text-base border-b border-dashed pb-2">
              <span>ส่วนลดรวมทั้งสิ้น</span>
              <span className="font-mono text-lg">
                {(totalLineDiscount + computedBillDiscount).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="bg-[#1C1B1B] text-white p-5 my-5 flex justify-between items-center border border-zinc-800">
            <div className="text-zinc-400 text-xs font-bold uppercase tracking-wider">
              ยอดชำระสุทธิ
            </div>
            <div className="text-right">
              <span className="text-4xl font-black font-mono">
                {finalTotal.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span className="text-[10px] text-red-500 font-bold block mt-0.5">
                สกุลเงิน: บาท
              </span>
            </div>
          </div>

          <p className="text-xs font-bold text-gray-400 mb-2 uppercase">
            เลือกวิธีการชำระเงิน
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setPaymentMethodId(1)}
              className={`flex flex-col items-center justify-center py-3 rounded-none border text-xs font-bold transition-all cursor-pointer ${paymentMethodId === 1 ? "border-red-600 bg-white text-red-600 border-b-4 shadow-sm" : "border-gray-200 bg-[#F9FAFB] text-gray-400 hover:text-zinc-600"}`}
            >
              <Coins size={18} className="mb-1" />
              <span>เงินสด</span>
            </button>
            <button
              onClick={() => setPaymentMethodId(2)}
              className={`flex flex-col items-center justify-center py-3 rounded-none border text-xs font-bold transition-all cursor-pointer ${paymentMethodId === 2 ? "border-red-600 bg-white text-red-600 border-b-4 shadow-sm" : "border-gray-200 bg-[#F9FAFB] text-gray-400 hover:text-zinc-600"}`}
            >
              <QrCode size={18} className="mb-1" />
              <span>QR CODE</span>
            </button>
            <button
              onClick={() => {
                const currentActiveType = customerTypes.find(
                  (t) => t.id === activeTypeId,
                );
                if (!customer && currentActiveType?.type_name === "GENERAL") {
                  alert(
                    "⚠️ ลูกค้าทั่วไปไม่สามารถชำระด้วยเงินเชื่อ (CREDIT) ได้",
                  );
                  return;
                }
                setPaymentMethodId(3);
              }}
              className={`flex flex-col items-center justify-center py-3 rounded-none border text-xs font-bold transition-all cursor-pointer ${paymentMethodId === 3 ? "border-red-600 bg-white text-red-600 border-b-4 shadow-sm" : "border-gray-200 bg-[#F9FAFB] text-gray-400 hover:text-zinc-600"}`}
            >
              <CreditCard size={18} className="mb-1" />
              <span>CREDIT</span>
            </button>
          </div>
        </div>

        <Button
          onClick={handleConfirmSale}
          variant="primary"
          size="lg"
          isLoading={isSubmitting}
          className="w-full mt-6 py-4 font-black text-xl tracking-wide shadow-xl uppercase rounded-none bg-[#E51C23] hover:bg-red-700"
        >
          ยืนยันการขาย
        </Button>
      </div>
    </div>
  );
}