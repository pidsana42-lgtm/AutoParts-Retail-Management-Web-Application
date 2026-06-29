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
import apiClient from "../../../service/http/apiClient";
import Button from "../../../components/elements/button";
import type {
  SaleOrderItemRequest,
  CreateSaleOrderRequest,
} from "../../../interface/pos/pos_interface";
import type { POSProductResponse } from "../../../interface/pos/product_interface";
import type { CustomerDiscountResponse } from "../../../interface/pos/customer_interface";

export default function PosPage(): React.JSX.Element {
  // ─── States ───
  const [cart, setCart] = useState<SaleOrderItemRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchCustomerQuery, setSearchCustomerQuery] = useState<string>("");

  // แก้ไข Type ตรงนี้ให้ดึงจาก CustomerDiscountResponse ตัวจริงของ Go
  const [customer, setCustomer] = useState<CustomerDiscountResponse | null>(
    null,
  );

  const [billDiscountValue, setBillDiscountValue] = useState<number>(0.0);
  const [billDiscountType, setBillDiscountType] = useState<
    "none" | "percentage" | "amount"
  >("none");
  const [paymentMethodId, setPaymentMethodId] = useState<number>(1); // 1=เงินสด, 2=QR, 3=เงินเชื่อ
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // ─── ฟังก์ชันค้นหาและดึงข้อมูลส่วนลดลูกค้า (ยิงไปที่ /api/pos/customer-discount) ───
  const handleSearchCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchCustomerQuery) return;
    try {
      const response = await apiClient.get<CustomerDiscountResponse>(
        `/pos/customer-discount?search=${searchCustomerQuery}`,
      );
      const customerData = response.data;
      setCustomer(customerData);

      // อัปเดตส่วนลดสินค้าที่มีอยู่ในตะกร้าตามสิทธิ์อู่ทันทีถ้าเปิดใช้งานระบบลด
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

  // ─── ฟังก์ชันค้นหาอะไหล่ยนต์ด้วยรหัส/บาร์โค้ด (ยิงไปที่ /api/pos/products) ───
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;

    try {
      const response = await apiClient.get<POSProductResponse[]>(
        `/pos/products?q=${searchQuery}`,
      );
      const products = response.data;

      if (!products || products.length === 0) {
        alert("ไม่พบสินค้าชิ้นนี้ในสต๊อกระบบ");
        return;
      }

      const product = products[0];

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
            // ถ้ามีลูกค้าผูกอยู่และเปิดใช้ระบบลด ให้มอบส่วนลดอู่รายชิ้นทันที
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

  // ─── คำนวณราคาสุทธิสัมพันธ์ตามจริง (ครอบด้วย useMemo เพื่อประสิทธิภาพสูงสุด) ───
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

  // คำนวณมูลค่าส่วนลดรวมท้ายบิลจริงตามเงื่อนไขประเภทส่วนลด
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

  // ─── 🚀 สั่งยิงยอดออเดอร์เข้าเซิร์ฟเวอร์จริง (ตรงตามโครงสร้าง CreateSaleOrderRequest) ───
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
      await apiClient.post("/pos/orders", salePayload);
      alert("บันทึกข้อมูลการขายและทำรายการเช็คเอาท์สำเร็จ!");
      setCart([]);
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
      {" "}
      {/* ─── ฝั่งซ้าย: จัดการบิลและตารางสินค้า ─── */}
      <div className="w-full lg:w-[73%] bg-white p-6 flex flex-col justify-between">
        {" "}
        <div>
          {/* ส่วนหัว */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-xs text-[#E51C23] font-bold uppercase tracking-wider">
                รายการที่กำลังขาย
              </p>
              <h1 className="text-4xl font-extrabold text-zinc-900">POS</h1>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#6B7280] font-medium">
                หมายเลขคำสั่งซื้อ
              </p>
              <h2 className="text-2xl font-bold text-zinc-800">INV2-2026001</h2>
            </div>
          </div>

          {/* แถบการจัดการส่วนลดบิล */}
          <div className="bg-[#1C1B1B] text-gray-300 rounded-none p-4 mb-6 flex justify-between items-start border border-zinc-800 border-l-4 border-l-[#E51C23]">
            {/* ซ้าย */}
            <div className="flex flex-col items-start gap-2 w-2/3">
              {/* ข้อความหัวข้อ (อยู่บรรทัดบน) */}
              <div className="flex items-center gap-2 font-bold text-sm shrink-0 mt-2">
                <Percent size={16} className="text-[#E51C23]" />
                <span className="text-[#FFFFFF]">การจัดการส่วนลด</span>
              </div>

              {/* ช่อง Input + ปุ่มกด */}
              <div className="relative flex items-center gap-2 w-full max-w-xs mt-2.5">
                <div className="relative w-full">
                  <span className="absolute left-3 top-2.5 text-xs text-zinc-500 font-bold select-none">
                    {billDiscountType === "percentage" ? "%" : "฿"}
                  </span>
                  <input
                    type="number"
                    value={billDiscountValue}
                    onChange={(e) =>
                      setBillDiscountValue(parseFloat(e.target.value) || 0)
                    }
                    className="w-full bg-[#2A2929] px-3 py-2 pl-10 text-sm text-white focus:outline-none focus:border-red-500"
                    placeholder="0.00"
                  />
                </div>

                {/* ปุ่มอัปเดตบิลสีแดงสด */}
                <button
                  type="button"
                  className="bg-[#E51C23] hover:bg-[#B70011] text-white text-xs font-bold px-4 py-2.5 rounded-none shrink-0 transition-colors shadow-sm cursor-pointer"
                >
                  อัปเดตบิล
                </button>
              </div>
            </div>

            {/* ขวา */}
            <div className="flex flex-col items-end gap-2 text-xs shrink-0">
              {/* แถบปุ่มกดสลับสามโหมด (อยู่บรรทัดบน) */}
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

              {/* กล่อง Alert สีเทาแสดงเงื่อนไข (เปลี่ยนข้อความตามโหมดที่พนักงานกดเลือก) */}
              <div className="bg-[#2D2C2C] p-2 text-[11px] leading-tight text-[#D1D5DB] max-w-[265px] text-left rounded-none">
                <span className="text-[#E51C23] font-bold mr-1">ⓘ</span>

                {/* สลับข้อความคำเตือนตามจริงด้วยเงื่อนไขนี้ */}
                {billDiscountType === "none" ? (
                  // ข้อความเมื่อเลือกโหมด "ต่อรายการ"
                  <span>
                    เลือกหน่วย (฿ / %)
                    และระบุจำนวนส่วนลดที่ต้องการในแต่ละรายการสินค้า
                  </span>
                ) : (
                  // ข้อความเมื่อเลือกโหมด "บิลทั้งหมด"
                  <span>
                    ส่วนลดกำลังดำเนินการ: (ราคาสินค้า / ยอดรวม) *{" "}
                    <span className="font-bold text-white">
                      {billDiscountValue.toFixed(2)}
                    </span>{" "}
                    {billDiscountType === "percentage" ? "%" : "บาท"}{" "}
                    จะถูกหักตามสัดส่วน ดำเนินการต่อในรายการ
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ตารางแสดงสินค้า */}
          <div className="bg-white rounded-none shadow-sm overflow-hidden ">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F6F3F2] rounded-none border-b border-gray-200 text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">คำอธิบายสินค้า</th>
                  <th className="py-3 px-4 text-right">หน่วยราคา</th>
                  <th className="py-3 px-4 text-center">Disc?</th>
                  <th className="py-3 px-4 text-center">ประเภทส่วนลด</th>
                  <th className="py-3 px-4 text-right pr-6">ลดราคา</th>
                  <th className="py-3 px-4 text-right pr-6">รวมสุทธิ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400">
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
                        {/* คอลัมน์ SKU / รหัสสินค้า */}
                        <td className="py-4 px-4 font-mono text-xs text-zinc-600">
                          {item.product_code || "—"}
                        </td>

                        {/* คอลัมน์คำอธิบายสินค้า */}
                        <td className="py-4 px-4">
                          <p className="font-bold text-zinc-900">
                            {item.product_name}
                          </p>
                          <p className="text-[11px] text-gray-400 font-mono">
                            PN: {item.part_number || "—"}
                          </p>
                        </td>
                        
                        <td className="py-4 px-4 font-medium text-base">
                          {item.unit_price.toFixed(2)}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="inline-flex items-center border border-gray-300 rounded bg-[#F3F4F6]">
                            <button
                              onClick={() => updateQty(index, -1)}
                              className="p-1 px-2"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="px-3 font-bold">
                              {String(item.qty).padStart(2, "0")}
                            </span>
                            <button
                              onClick={() => updateQty(index, 1)}
                              className="p-1 px-2"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          {item.discount_value > 0 ? (
                            <span className="inline-block bg-[#E51C23] text-white text-xs font-bold px-2 py-0.5 rounded">
                              -{itemDiscount.toFixed(2)} ({item.discount_value}
                              %)
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-4 px-4 text-right pr-6 font-bold">
                          <div className="flex justify-end items-center gap-3">
                            <span>{(lineTotal - itemDiscount).toFixed(2)}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="text-zinc-400 hover:text-red-500 transition-colors"
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
        {/* 🔍 ฟอร์มสแกนรหัสสินค้า */}
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
            className="bg-[#1C1B1B] text-white font-bold px-8 py-3 rounded-none text-sm hover:bg-zinc-800 transition-colors"
          >
            เพิ่มรายการ
          </button>
        </form>
      </div>
      {/* ─── ฝั่งขวา: ข้อมูลลูกค้า & ปุ่มชำระเงินจริง ─── */}
      <div className="w-full lg:w-[27%] bg-[#F6F3F2] p-6 flex flex-col justify-between shadow-2xl shrink-0 min-h-full">
        {" "}
        <div>
          {/* ส่วนค้นหาลูกค้าตามดีไซน์เบสใหม่ */}
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
                className="bg-zinc-900 text-white text-xs font-bold px-3 py-1.5 rounded"
              >
                ค้นหา
              </button>
            </div>
          </form>

          {/* การ์ดข้อมูลลูกค้าตัวจริงจาก Go API */}
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

          {/* สรุปยอดเงิน */}
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

          {/* ยอดรวมสุทธิขนาดใหญ่ */}
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

          {/* วิธีชำระเงินที่เปลี่ยนเป็นเก็บเลข ID (1,2,3) ตามการ binding ของ Go */}
          <p className="text-xs font-bold text-gray-400 mb-2 uppercase">
            เลือกวิธีการชำระเงิน
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setPaymentMethodId(1)}
              className={`flex flex-col items-center justify-center py-3 rounded border text-xs font-bold transition-all ${paymentMethodId === 1 ? "border-red-600 bg-white text-red-600 border-b-4" : "border-gray-200 bg-[#F9FAFB] text-gray-400"}`}
            >
              <Coins size={18} className="mb-1" />
              <span>เงินสด</span>
            </button>
            <button
              onClick={() => setPaymentMethodId(2)}
              className={`flex flex-col items-center justify-center py-3 rounded border text-xs font-bold transition-all ${paymentMethodId === 2 ? "border-red-600 bg-white text-red-600 border-b-4" : "border-gray-200 bg-[#F9FAFB] text-gray-400"}`}
            >
              <QrCode size={18} className="mb-1" />
              <span>QR CODE</span>
            </button>
            <button
              onClick={() => setPaymentMethodId(3)}
              className={`flex flex-col items-center justify-center py-3 rounded border text-xs font-bold transition-all ${paymentMethodId === 3 ? "border-red-600 bg-white text-red-600 border-b-4" : "border-gray-200 bg-[#F9FAFB] text-gray-400"}`}
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
