import React, { useState, useMemo } from "react";
import {
  Trash2,
  Percent,
  QrCode,
  CreditCard,
  Coins,
  Plus,
  Minus,
  Search,
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
import type { CustomerDiscountResponse } from "../../../interface/pos/customer_interface";

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

  // ดึงค่าคอนฟิกร้านค้ามาจากหลังบ้านผ่าน Service ตอนเปิดหน้าจอ
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

  // ─── ฟังก์ชันค้นหาและดึงข้อมูลส่วนลดลูกค้า ───
  const handleSearchCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchCustomerQuery) return;
    try {
      const customerData =
        await posApiService.searchCustomerDiscount(searchCustomerQuery);
      setCustomer(customerData);

      if (customerData.is_discount_enabled) {
        setCart((prev) =>
          prev.map((item) => ({
            ...item,
            discount_type: "percentage",
            discount_value: customerData.standard_discount_rate,
          })),
        );
      }
    } catch (error) {
      alert("ไม่พบข้อมูลสิทธิ์ส่วนลดของลูกค้ารายนี้");
      setCustomer(null);
    }
  };

  // ─── ฟังก์ชันค้นหาอะไหล่ยนต์และเพิ่มเข้าตะกร้า ───
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;

    try {
      const products = await posApiService.searchProducts(searchQuery);

      if (!products || products.length === 0) {
        alert("ไม่พบสินค้าชิ้นนี้ในสต๊อกระบบ");
        return;
      }

      const product =
        products.find(
          (p) => p.product_code === searchQuery || p.barcode === searchQuery,
        ) || products[0];

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

            discount_type:
              customer && customer.is_discount_enabled ? "percentage" : "none",
            discount_value:
              customer && customer.is_discount_enabled
                ? customer.standard_discount_rate
                : 0,
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

  // ─── ฟังก์ชันตรวจสอบและบันทึกส่วนลดท้ายบิล (ล็อกโควตารวมไม่ให้เกินเกณฑ์ร้าน) ───
  const handleBillDiscountChange = (valueStr: string) => {
    const inputValue = parseFloat(valueStr) || 0;
    if (inputValue < 0) return;

    // 1. ดึงเปอร์เซ็นต์เพดานรวมของร้านค้าจาก Store Config (Default 2.00%)
    const maxGlobalRate = storeConfig?.max_item_discount_rate ?? 2.0;

    // 2. คำนวณจำนวนเงินบาทสูงสุดรวมทั้งหมดที่บิลใบนี้ยอมให้ลดได้ (ราคาเต็มรวม × เปอร์เซ็นต์เพดาน)
    const allowedTotalDiscountAmount = (totalItemPrice * maxGlobalRate) / 100;

    // 3. หักโควตา: หาจำนวนเงินส่วนลดท้ายบิลที่ "เหลือยอมให้ลดเพิ่มได้อีก"
    const remainingQuotaAmount = allowedTotalDiscountAmount - totalLineDiscount;

    // 4. ถ้าพนักงานใช้โควตาลดต่อชิ้นจนเต็ม Max (หรือเกิน) ไปเรียบร้อยแล้ว -> บล็อกทันที ห้ามลดท้ายบิลเพิ่ม
    if (remainingQuotaAmount <= 0 && inputValue > 0) {
      alert(
        `ไม่สามารถให้ส่วนลดท้ายบิลเพิ่มได้ เนื่องจากคุณได้ให้ส่วนลดต่อรายการสินค้าไปเต็มสิทธิ์เพดานรวม ${maxGlobalRate}% ของร้านค้าแล้วครับ`,
      );
      return;
    }

    // 5. จำลองมูลค่าเงินบาทของส่วนลดท้ายบิลตามจำนวนที่กำลังพิมพ์
    let simulationBillDiscountAmount = 0;
    if (billDiscountType === "amount") {
      simulationBillDiscountAmount = inputValue;
    } else if (billDiscountType === "percentage") {
      const remainingAfterLineDiscount = totalItemPrice - totalLineDiscount;
      simulationBillDiscountAmount =
        (remainingAfterLineDiscount * inputValue) / 100;
    }

    // 6. ดักตรวจ: หากส่วนลดท้ายบิลที่พิมพ์อยู่ ดันทะลุโควตาเงินที่เหลืออยู่
    if (simulationBillDiscountAmount > remainingQuotaAmount) {
      alert(
        `ส่วนลดท้ายบิลเกินสิทธิ์ที่เหลืออยู่! บิลนี้เหลือโควตาให้ลดเพิ่มได้อีกสูงสุดไม่เกิน ${remainingQuotaAmount.toFixed(2)} ฿ (เพื่อให้ยอดรวมทั้งบิลอยู่ในเกณฑ์ ${maxGlobalRate}%)`,
      );
      return;
    }

    // ถ้าผ่านกฎโควตาทุกข้อ บันทึกค่าลง State ได้ตามปกติ
    setBillDiscountValue(inputValue);
  };

  // ─── ฟังก์ชันเปิด-ปิดส่วนลดของแต่ละรายการเมื่อกด Checkbox ───
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

  // ─── ฟังก์ชันสลับประเภทส่วนลดต่อรายการ (฿ / %) ───
  const handleDiscountTypeChange = (
    index: number,
    type: "amount" | "percentage",
  ) => {
    setCart((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, discount_type: type } : item,
      ),
    );
  };

  // ─── ฟังก์ชันแก้ไขจำนวนส่วนลดพร้อมระบบตรวจจับเงื่อนไขร้านค้า ───
  const handleDiscountValueChange = (index: number, valueStr: string) => {
    const rawValue = valueStr === "" ? 0 : parseFloat(valueStr) || 0;
    const item = cart[index];

    // เรียกใช้ลอจิกความปลอดภัยสแกนเพดานจากไฟล์บริการส่วนกลาง
    const validatedValue = calculateValidatedDiscount(
      item,
      rawValue,
      storeConfig,
    );

    setCart((prev) =>
      prev.map((cartItem, i) =>
        i === index
          ? {
              ...cartItem,
              discount_value: validatedValue,
            }
          : cartItem,
      ),
    );
  };

  // ─── ฟังก์ชันล้างรายการสินค้าทั้งหมดในตะกร้า ───
  const handleClearAllCart = () => {
    if (cart.length === 0) return;
    if (window.confirm("คุณแน่ใจหรือไม่ว่าต้องการล้างตะกร้าสินค้าทั้งหมด?")) {
      setCart([]);
      localStorage.removeItem("pos_cart");
    }
  };

  // ─── คำนวณราคาสุทธิสัมพันธ์ตามจริง ───
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

  // ─── สั่งยิงยอดออเดอร์เข้าเซิร์ฟเวอร์จริง ───
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

    const salePayload: CreateSaleOrderRequest = {
      customer_id: customer.customer_id,
      payment_method_id: paymentMethodId,
      bill_discount_type: billDiscountType,
      bill_discount_value: billDiscountValue,
      note: "บันทึกคำสั่งซื้อจากหน้าร้านระบบขาย POS",
      items: cart.map((item) => ({
        product_id: item.product_id,
        product_code: item.product_code,
        product_name: item.product_name,
        qty: item.qty,
        unit_price: item.unit_price,
        discount_type: item.discount_type,
        discount_value: item.discount_value,
      })),
    };

    try {
      await posApiService.createPOSOrder(salePayload);
      alert("บันทึกข้อมูลการขายและทำรายการเช็คเอาท์สำเร็จ!");
      setCart([]);
      localStorage.removeItem("pos_cart");
      setCustomer(null);
      setBillDiscountValue(0);
      setBillDiscountType("none");
    } catch (error: any) {
      alert(
        error.response?.data?.error ||
          error.message ||
          "เกิดปัญหาในการส่งคำสั่งซื้อไปบันทึกที่หลังบ้าน",
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
                <h2 className="text-2xl font-bold text-zinc-800">บิลร่าง (DRAFT)</h2>
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
                    value={billDiscountValue}
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
                  className="bg-[#E51C23] hover:bg-[#B70011] text-white text-xs font-bold px-4 py-2.5 rounded-none shrink-0 transition-colors shadow-sm cursor-pointer"
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
                  onClick={() => setBillDiscountType("amount")}
                  className={`px-3 py-1 rounded-none transition-all cursor-pointer ${billDiscountType === "amount" ? "bg-[#E51C23] text-white font-bold" : "text-zinc-[#D1D5DB] hover:text-zinc-200"}`}
                >
                  บิลทั้งหมด (฿)
                </button>
                <button
                  type="button"
                  onClick={() => setBillDiscountType("percentage")}
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
                      {billDiscountValue.toFixed(2)}
                    </span>{" "}
                    {billDiscountType === "percentage" ? "%" : "บาท"}{" "}
                    จะถูกหักตามสัดส่วน ดำเนินการต่อ in รายการ
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
                    return (
                      <tr
                        key={index}
                        className="hover:bg-gray-50/80 transition-colors"
                      >
                        {/* SKU */}
                        <td className="py-4 px-4 font-bold text-xs text-[#1C1B1B]">
                          {item.product_code || "—"}
                        </td>

                        {/* คำอธิบายสินค้า */}
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

                        {/* หน่วยราคา */}
                        <td className="py-4 px-4 text-right font-bold text-[#1C1B1B]">
                          {item.unit_price.toFixed(2)}
                        </td>

                        {/* QTY */}
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

                        {/* DISC? */}
                        <td className="py-4 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={item.discount_type !== "none"}
                            className="accent-[#E51C23] h-4 w-4 cursor-pointer "
                            onChange={(e) =>
                              handleDiscountToggle(index, e.target.checked)
                            }
                          />
                        </td>

                        {/* ประเภทส่วนลด */}
                        <td className="py-4 px-4 text-center">
                          {item.discount_type !== "none" ? (
                            <div className="inline-flex bg-[#EBE7E7] p-0.5 rounded-none text-xs font-bold">
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

                        {/* ลดราคา */}
                        <td className="py-4 px-4 text-center">
                          {item.discount_type !== "none" ? (
                            <div className="relative inline-flex items-center justify-center px-1.5 py-0.5 min-w-[60px] transition-all border bg-[#F6F3F2] text-gray-700 border-gray-300 rounded-none font-medium">
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
                                className="w-9 bg-transparent text-center text-gray-800 text-xs font-bold outline-none border-b border-transparent focus:border-zinc-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              {item.discount_type === "percentage" && (
                                <span className="ml-0.5 text-gray-400 text-xs font-bold select-none">
                                  %
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        {/* LINE TOTAL + ปุ่มลบ */}
                        <td className="py-4 px-4 text-right pr-6 font-bold text-zinc-900">
                          <div className="flex justify-end items-center gap-3">
                            <span>{(lineTotal - itemDiscount).toFixed(2)}</span>
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

        {/* ฟอร์มสแกนรหัสสินค้า */}
        <form onSubmit={handleAddProduct} className="mt-6 flex gap-2">
          <div className="relative flex-1">
            <Search
              className="absolute left-4 top-3.5 text-gray-400"
              size={18}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ป้อนรหัสสินค้าอะไหล่ยนต์ หรือใช้เครื่องสแกนบาร์โค้ดที่นี่..."
              className="w-full bg-white border border-gray-300 rounded pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-red-500 shadow-sm"
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
          <form onSubmit={handleSearchCustomer} className="mb-4">
            <p className="text-xs font-bold text-gray-400 mb-2 uppercase">
              ค้นหาข้อมูลลูกค้าอู่ / สมาชิก
            </p>
            <div className="flex gap-1">
              <input
                type="text"
                value={searchCustomerQuery}
                onChange={(e) => setSearchCustomerQuery(e.target.value)}
                className="flex-1 bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-sm"
                placeholder="กรอกชื่อลูกค้า หรือ คีย์เบอร์โทร..."
              />
              <button
                type="submit"
                className="bg-zinc-900 text-white text-xs font-bold px-3 py-1.5 rounded cursor-pointer"
              >
                ค้นหา
              </button>
            </div>
          </form>

          <div className="bg-[#1C1B1B] text-white rounded p-4 mb-6 border border-zinc-800">
            <h3 className="text-xl font-extrabold tracking-tight">
              {customer ? customer.customer_name : "ลูกค้ารายย่อยทั่วไป"}
            </h3>
            <p className="text-xs text-zinc-400 mt-2">
              หนี้ค้างชำระในระบบ: ฿
              {customer ? customer.current_debt_amount.toFixed(2) : "0.00"}
            </p>
            <p className="text-xs text-zinc-400">
              สิทธิ์ลดราคาประจำตัว:{" "}
              {customer && customer.is_discount_enabled
                ? `${customer.standard_discount_rate}%`
                : "ไม่มีส่วนลด"}
            </p>
          </div>

          <div className="space-y-3 pt-4 border-t text-sm font-medium">
            <div className="flex justify-between text-gray-500">
              <span>ราคารวมสินค้า</span>
              <span className="font-bold text-zinc-900">
                ฿{totalItemPrice.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-red-600 font-bold">
              <span>ส่วนลดรวมทั้งสิ้น</span>
              <span>
                ฿{(totalLineDiscount + computedBillDiscount).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="bg-[#1C1B1B] text-white rounded p-5 my-6 flex justify-between items-center border border-zinc-800">
            <div className="text-zinc-400 text-xs font-medium">
              ยอดชำระสุทธิ
            </div>
            <div className="text-right">
              <span className="text-3xl font-black">
                {finalTotal.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>

          <p className="text-xs font-bold text-gray-400 mb-2 uppercase">
            เลือกวิธีการชำระเงิน
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setPaymentMethodId(1)}
              className={`flex flex-col items-center justify-center py-3 rounded border text-xs font-bold transition-all cursor-pointer ${paymentMethodId === 1 ? "border-red-600 bg-white text-red-600 border-b-4" : "border-gray-200 bg-[#F9FAFB] text-gray-400"}`}
            >
              <Coins size={18} className="mb-1" />
              <span>เงินสด</span>
            </button>
            <button
              onClick={() => setPaymentMethodId(2)}
              className={`flex flex-col items-center justify-center py-3 rounded border text-xs font-bold transition-all cursor-pointer ${paymentMethodId === 2 ? "border-red-600 bg-white text-red-600 border-b-4" : "border-gray-200 bg-[#F9FAFB] text-gray-400"}`}
            >
              <QrCode size={18} className="mb-1" />
              <span>QR CODE</span>
            </button>
            <button
              onClick={() => setPaymentMethodId(3)}
              className={`flex flex-col items-center justify-center py-3 rounded border text-xs font-bold transition-all cursor-pointer ${paymentMethodId === 3 ? "border-red-600 bg-white text-red-600 border-b-4" : "border-gray-200 bg-[#F9FAFB] text-gray-400"}`}
            >
              <CreditCard size={18} className="mb-1" />
              <span>เงินเชื่อ</span>
            </button>
          </div>
        </div>
        <Button
          onClick={handleConfirmSale}
          variant="primary"
          size="lg"
          isLoading={isSubmitting}
          className="w-full mt-6 py-4 font-black text-lg tracking-wide shadow-lg"
        >
          ยืนยันการขาย
        </Button>
      </div>
    </div>
  );
}