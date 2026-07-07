import React from "react";
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
import { usePosPayment } from "./hooks/usepospayment";
import { usePosCart } from "./hooks/useposcart";
import { CustomerCard } from "./components/customercard";

export default function PosPage(): React.JSX.Element {
  // ─── STATE & HOOK SETUP ───
  const [customerForCart, setCustomerForCart] = React.useState<any>(null);
  const [activeTypeForCart, setActiveTypeForCart] = React.useState<number>(1);

  // ระบบจัดการสินค้าในตะกร้า (Cart Hook)
  const cartHook = usePosCart({
    customer: customerForCart,
    activeTypeId: activeTypeForCart,
  });

  // ระบบจัดการข้อมูลลูกค้าและการชำระเงิน (Payment Hook)
  const paymentData = usePosPayment({
    cart: cartHook.cart,
    setCart: cartHook.setCart,
    totalItemPrice: cartHook.totalItemPrice,
    totalLineDiscount: cartHook.totalLineDiscount,
  });

  // ซิงค์ข้อมูลสิทธิ์ลูกค้าระหว่าง 2 Hooks แบบ Real-time
  React.useEffect(() => {
    setCustomerForCart(paymentData.customer);
    setActiveTypeForCart(paymentData.activeTypeId);
  }, [paymentData.customer, paymentData.activeTypeId]);

  const subLabelMap: Record<string, string> = {
    GENERAL: "REGULAR",
    GARAGE: "CREDIT",
    WHOLESALE: "SPECIAL",
  };

  return (
    <div className="flex flex-col lg:flex-row bg-white min-h-[calc(100vh-4rem)] font-sans text-gray-800 antialiased overflow-x-hidden">
      
      {/* ========================================================================= */}
      {/* ─── [โซนฝั่งซ้าย] : ตะกร้าสินค้า ตารางรายการขาย และส่วนลดท้ายบิล ─── */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-[73%] bg-white p-6 flex flex-col justify-between">
        <div>
          
          {/* 1. ส่วนหัวบิล (Header - ชื่อหน้าย่อ POS & ปุ่มล้างตะกร้าทั้งหมด) */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-xs text-[#E51C23] font-bold uppercase tracking-wider">รายการที่กำลังขาย</p>
              <h1 className="text-4xl font-extrabold text-zinc-900">POS</h1>
            </div>
            <div className="text-right flex flex-col items-end gap-1.5">
              <p className="text-xs text-[#6B7280] font-medium">สถานะรายการขาย</p>
              <h2 className="text-2xl font-bold text-zinc-800">บิลร่าง (DRAFT)</h2>
              <button
                type="button"
                onClick={() => cartHook.handleClearAllCart(() => {
                  paymentData.resetBillDiscount(); 
                })}
                disabled={cartHook.cart.length === 0}
                className={`text-xs font-bold px-3 py-1.5 border cursor-pointer transition-all duration-200 ${
                  cartHook.cart.length === 0
                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed select-none"
                    : "bg-[#E51C23] text-white border-[#E51C23] hover:bg-[#C62828] active:bg-[#B71C1C] shadow-sm"
                }`}
              >
                ล้างทั้งหมด
              </button>
            </div>
          </div>

          {/* 2. กล่องดำจัดการส่วนลดบิล (Discount Bar - แลกหน่วย %/บาท และคำนวณ Pro-rata) */}
          <div className="bg-[#1C1B1B] text-gray-300 rounded-none p-4 mb-6 flex justify-between items-start border border-zinc-800 border-l-4 border-l-[#E51C23]">
            <div className="flex flex-col items-start gap-2 w-2/3">
              <div className="flex items-center gap-2 font-bold text-sm shrink-0 mt-2">
                <Percent size={16} className="text-[#E51C23]" />
                <span className="text-[#FFFFFF]">การจัดการส่วนลด</span>
              </div>
              <div className="relative flex items-center gap-2 w-full max-w-xs mt-2.5">
                <div className="relative w-full">
                  <span className="absolute left-3 top-2.5 text-xs text-zinc-500 font-bold select-none">
                    {paymentData.billDiscountType === "percentage" ? "%" : "฿"}
                  </span>
                  <input
                    type="number"
                    value={paymentData.billDiscountValue === 0 ? "" : paymentData.billDiscountValue}
                    onChange={(e) => paymentData.handleBillDiscountChange(e.target.value)}
                    disabled={paymentData.billDiscountType === "none"}
                    className={`w-full px-3 py-2 pl-10 text-sm focus:outline-none focus:border-red-500 transition-colors ${
                      paymentData.billDiscountType === "none"
                        ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700"
                        : "bg-[#2A2929] text-white"
                    }`}
                    placeholder={paymentData.billDiscountType === "none" ? "ล็อกไว้" : "0.00"}
                  />
                </div>
                <button
                  type="button"
                  disabled={paymentData.billDiscountType === "none"}
                  onClick={() => paymentData.handleBillDiscountChange(String(paymentData.billDiscountValue))}
                  className={`text-xs font-bold px-4 py-2.5 rounded-none shrink-0 transition-colors shadow-sm cursor-pointer ${
                    paymentData.billDiscountType === "none"
                      ? "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                      : "bg-[#E51C23] hover:bg-[#B70011] text-white"
                  }`}
                >
                  อัปเดตบิล
                </button>
              </div>
            </div>

            {/* ส่วนเลือกรูปแบบส่วนลด (ขวาของกล่องดำ) */}
            <div className="flex flex-col items-end gap-2 text-xs shrink-0">
              <div className="flex bg-[#2D2C2C] rounded-none p-0.5 ">
                <button
                  type="button"
                  onClick={() => {
                    paymentData.setBillDiscountType("none");
                    paymentData.setBillDiscountValue(0);
                  }}
                  className={`px-3 py-1 rounded-none transition-all cursor-pointer ${paymentData.billDiscountType === "none" ? "bg-[#E51C23] text-white font-bold " : "text-[#D1D5DB] hover:text-zinc-200"}`}
                >
                  ต่อรายการ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    paymentData.setBillDiscountType("amount");
                    paymentData.setBillDiscountValue(0);
                  }}
                  className={`px-3 py-1 rounded-none transition-all cursor-pointer ${paymentData.billDiscountType === "amount" ? "bg-[#E51C23] text-white font-bold" : "text-[#D1D5DB] hover:text-zinc-200"}`}
                >
                  บิลทั้งหมด (฿)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    paymentData.setBillDiscountType("percentage");
                    paymentData.setBillDiscountValue(0);
                  }}
                  className={`px-3 py-1 rounded-none transition-all cursor-pointer ${paymentData.billDiscountType === "percentage" ? "bg-[#E51C23] text-white font-bold" : "text-[#D1D5DB] hover:text-zinc-200"}`}
                >
                  บิลทั้งหมด (%)
                </button>
              </div>

              {/* คำอธิบายสัดส่วนใต้ปุ่มสลับ */}
              <div className="bg-[#2D2C2C] p-2 text-[11px] leading-tight text-[#D1D5DB] max-w-[265px] text-left rounded-none">
                <span className="text-[#E51C23] font-bold mr-1">ⓘ</span>
                {paymentData.billDiscountType === "none" ? (
                  <span>เลือกหน่วย (฿ / %) และระบุจำนวนส่วนลดที่ต้องการในแต่ละรายการสินค้า</span>
                ) : (
                  <span>
                    ส่วนลดกำลังดำเนินการ: (ราคาสินค้า / ยอดรวม) *{" "}
                    <span className="font-bold text-white">{paymentData.billDiscountValue ? paymentData.billDiscountValue.toFixed(2) : "0.00"}</span>{" "}
                    {paymentData.billDiscountType === "percentage" ? "%" : "บาท"} จะถูกหักตามสัดส่วน ดำเนินการต่อในรายการ
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 3. ตารางตระกร้าแสดงผลสินค้า (Products Cart Table) */}
          <div className="bg-white rounded-none shadow-sm overflow-hidden border border-gray-200">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F6F3F2] rounded-none border-b border-gray-200 text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">
                  <th className="py-3 px-4 w-[15%]">SKU</th>
                  <th className="py-3 px-4 w-[32%]">คำอธิบายสินค้า</th>
                  <th className="py-3 px-4 text-right w-[12%]">หน่วยราคา</th>
                  <th className="py-3 px-4 text-center w-[12%]">QTY</th>
                  <th className="py-3 px-4 text-center w-[8%]">DISC?</th>
                  <th className="py-3 px-4 text-center w-[12%]">ประเภทส่วนลด</th>
                  <th className="py-3 px-4 text-center w-[10%]">ลดราคา</th>
                  <th className="py-3 px-4 text-right pr-6 w-[11%]">LINE TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {cartHook.cart.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-400">ยังไม่มีสินค้าในตะกร้า</td>
                  </tr>
                ) : (
                  cartHook.cart.map((item, index) => {
                    // คำนวณราคาและส่วนลด Pro-rata ท้ายบิลแบบ Real-time รายแถว
                    const lineTotal = item.unit_price * item.qty;
                    const itemDiscount = item.discount_type === "percentage" ? (lineTotal * item.discount_value) / 100 : item.discount_value;
                    const subtotalAfterDiscount = lineTotal - itemDiscount;

                    let allocatedDiscount = 0;
                    if (cartHook.totalItemPrice - cartHook.totalLineDiscount > 0 && paymentData.computedBillDiscount > 0) {
                      const weight = subtotalAfterDiscount / (cartHook.totalItemPrice - cartHook.totalLineDiscount);
                      allocatedDiscount = Math.round(paymentData.computedBillDiscount * weight * 100) / 100;
                    }
                    const finalLineTotal = subtotalAfterDiscount - allocatedDiscount;

                    return (
                      <tr key={index} className="hover:bg-gray-50/80 transition-colors">
                        
                        {/* 🔗 [COLUMN 1]: รหัสสินค้า / รหัสบาร์โค้ด (SKU) */}
                        <td className="py-4 px-4 font-bold text-xs text-[#1C1B1B]">
                          {item.product_code || "—"}
                        </td>
                        
                        {/* 🔗 [COLUMN 2]: ชื่ออะไหล่ หมายเลขพาร์ท เกรดสินค้า และข้อมูลรุ่นรถ */}
                        <td className="py-4 px-4">
                          <p className="font-bold text-[#1C1B1B]">{item.product_name}</p>
                          <p className="text-[11px] text-[#6B7280] font-mono mt-0.5">PN: {item.part_number || "—"}</p>
                          {(item.grade_name || item.model_name) && (
                            <p className="text-[11px] text-[#6B7280] font-medium mt-1 inline-block py-0.5 rounded-sm">
                              เกรด: {item.grade_name || "ทั่วไป"} | รุ่นรถที่รองรับ: {item.model_name || "ทุกรุ่น"}
                            </p>
                          )}
                        </td>
                        
                        {/* 🔗 [COLUMN 3]: หน่วยราคาต่อชิ้น (ราคาขายปลีกดิบก่อนหักส่วนลด) */}
                        <td className="py-4 px-4 text-right font-bold text-[#1C1B1B]">
                          {item.unit_price.toFixed(2)}
                        </td>
                        
                        {/* 🔗 [COLUMN 4]: ปุ่มเพิ่ม/ลด และแสดงจำนวนชิ้นที่สั่งซื้อ (Quantity) */}
                        <td className="py-4 px-4 text-center">
                          <div className="inline-flex items-center border border-gray-300 rounded-none bg-[#F6F3F2]">
                            <button type="button" onClick={() => cartHook.updateQty(index, -1)} className="p-1 px-2"><Minus size={12} /></button>
                            <span className="px-2 font-bold min-w-[20px]">{String(item.qty).padStart(2, "0")}</span>
                            <button type="button" onClick={() => cartHook.updateQty(index, 1)} className="p-1 px-2 cursor-pointer text-gray-600 hover:text-black"><Plus size={12} /></button>
                          </div>
                        </td>
                        
                        {/* 🔗 [COLUMN 5]: ติ๊กบล็อกเปิด/ปิดการเปิดใช้สิทธิ์ส่วนลดแถวสินค้า (Discount Toggle) */}
                        <td className="py-4 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={item.discount_type !== "none"}
                            className="accent-[#E51C23] h-4 w-4 cursor-pointer"
                            onChange={(e) => cartHook.handleDiscountToggle(index, e.target.checked)}
                          />
                        </td>
                        
                        {/* 🔗 [COLUMN 6]: ตัวสลับหน่วยส่วนลดของแถวนั้นๆ (สลับได้ระหว่าง บาท ฿ / เปอร์เซ็นต์ %) */}
                        <td className="py-4 px-4 text-center">
                          {item.discount_type !== "none" ? (
                            <div className="inline-flex bg-[#F6F3F2] p-0.5 rounded-none text-xs font-bold">
                              <button
                                type="button"
                                onClick={() => cartHook.handleDiscountTypeChange(index, "amount")}
                                className={`px-2 py-1 transition-all cursor-pointer ${item.discount_type === "amount" ? "bg-[#E51C23] text-white" : "text-[#6B7280] hover:text-gray-600"}`}
                              >
                                ฿
                              </button>
                              <button
                                type="button"
                                onClick={() => cartHook.handleDiscountTypeChange(index, "percentage")}
                                className={`px-2 py-1 transition-all cursor-pointer ${item.discount_type === "percentage" ? "bg-[#E51C23] text-white" : "text-[#6B7280] hover:text-gray-600"}`}
                              >
                                %
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        
                        {/* 🔗 [COLUMN 7]: ช่อง Input คีย์จำนวนตัวเลขลดราคา และ ป้ายแดงแสดงยอดหักเฉลี่ยบิลรวม */}
                        <td className="py-4 px-4 text-center">
                          {item.discount_type !== "none" ? (
                            <div className="flex flex-col items-center gap-1">
                              <div className="relative inline-flex items-center justify-center px-2 py-1 min-w-[75px] transition-all border bg-gray-100 text-gray-700 border-gray-300 rounded-none font-medium">
                                {item.discount_type === "amount" && item.discount_value > 0 && (
                                  <span className="mr-0.5 text-gray-500 font-bold select-none">-</span>
                                )}
                                <input
                                  type="number"
                                  step="any"
                                  value={item.discount_value === 0 ? "" : item.discount_value}
                                  placeholder="0"
                                  onChange={(e) => cartHook.handleDiscountValueChange(index, e.target.value)}
                                  className="w-12 bg-transparent text-center font-bold border-b window-fix outline-none focus:border-zinc-400"
                                />
                                {item.discount_type === "percentage" && (
                                  <span className="ml-0.5 text-gray-400 font-bold select-none">%</span>
                                )}
                              </div>
                              {/* ป้ายแดงแจ้งยอดเฉลี่ยส่วนลดสะสมท้ายบิลที่กระจายลงมารายบรรทัด */}
                              {itemDiscount + allocatedDiscount > 0 && (
                                <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-sm block whitespace-nowrap mt-0.5">
                                  ถัวเฉลี่ยลด: -฿{(itemDiscount + allocatedDiscount).toFixed(2)}
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
                        
                        {/* 🔗 [COLUMN 8]: ยอดรวมราคาสุทธิท้ายแถวชิ้นนี้ และ ปุ่มถังขยะสำหรับลบรายการออกบิล */}
                        <td className="py-4 px-4 text-right pr-6 font-bold text-zinc-900">
                          <div className="flex justify-end items-center gap-3">
                            <div className="text-right">
                              {itemDiscount + allocatedDiscount > 0 && (
                                <span className="text-[11px] text-zinc-400 line-through block font-normal">฿{lineTotal.toFixed(2)}</span>
                              )}
                              <span className="text-sm font-black text-zinc-950 block">฿{finalLineTotal.toFixed(2)}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => cartHook.handleRemoveItem(index)}
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

        {/* 4. ช่องแสกนบาร์โค้ดสินค้าเข้าตะกร้า (Barcode Scanner Input) */}
        <form onSubmit={cartHook.handleAddProduct} className="mt-6 flex gap-2">
          <div className="relative flex-1">
            <QrCode className="absolute left-4 top-3.5 text-gray-400" size={18} />
            <input
              type="text"
              value={cartHook.searchQuery}
              onChange={(e) => cartHook.setSearchQuery(e.target.value)}
              placeholder="สแกนบาร์โค้ดสินค้า หรือพิมพ์เลขบาร์โค้ดที่นี่เพื่อเพิ่มรายการ..."
              className="w-full bg-white border border-gray-200 rounded pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-red-500 shadow-sm font-sans"
              autoFocus
            />
          </div>
          <button type="submit" className="bg-[#1C1B1B] text-white font-bold px-8 py-3 rounded-none text-sm hover:bg-zinc-800 transition-colors cursor-pointer">
            เพิ่มรายการ
          </button>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* ─── [โซนฝั่งขวา] : ข้อมูลลูกค้า เครดิตอู่ สรุปยอดเงิน วิธีชำระ และปุ่มขาย ─── */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-[27%] bg-[#F6F3F2] p-6 flex flex-col justify-between shadow-2xl shrink-0 min-h-full">
        <div>
          <div className="mb-4">
            <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">ข้อมูลลูกค้า</p>
            
            {/* แผงปุ่มด่วนสำหรับสลับประเภทสิทธิ์ลูกค้า (ทั่วไป / อู่ / บริษัท) */}
            <div className="grid grid-cols-3 gap-1 mb-2">
              {paymentData.customerTypes.map((type) => {
                const isActive = paymentData.customer && paymentData.customer.customer_type
                    ? paymentData.customer.customer_type.id === type.id : paymentData.activeTypeId === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => {
                      paymentData.setActiveTypeId(type.id);
                      if (type.type_name === "GENERAL") {
                        paymentData.setSelectedPaymentType("CASH");
                        paymentData.setPaymentMethodId(1);
                      } else {
                        paymentData.setSelectedPaymentType("CREDIT");
                        paymentData.setPaymentMethodId(3);
                      }
                    }}
                    className={`flex flex-col items-center justify-center text-center transition-all h-10 leading-tight border ${isActive ? "bg-white border-zinc-400 text-zinc-900 shadow-sm" : "border-transparent text-gray-400 hover:text-gray-600"}`}
                  >
                    {type.type_label.replace("ลูกค้า", "")}
                    <span className="text-[9px] block font-bold">{subLabelMap[type.type_name] || type.type_name}</span>
                  </button>
                );
              })}
            </div>

            {/* ปุ่มสลับโหมดบัญชีประเภทหนี้/เงินสดด่วน (CASH / CREDIT โหมด) */}
            <div className="grid grid-cols-2 gap-1 mb-4">
              {["CASH", "CREDIT"].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    if (mode === "CREDIT") {
                      const currentActiveType = paymentData.customerTypes.find((t) => t.id === paymentData.activeTypeId);
                      if (currentActiveType?.type_name === "GENERAL") return alert("ลูกค้าทั่วไปไม่สามารถเลือกโหมดเงินเชื่อได้");
                    }
                    paymentData.setSelectedPaymentType(mode as any);
                    paymentData.setPaymentMethodId(mode === "CASH" ? 1 : 3);
                  }}
                  className={`text-center py-1.5 border text-xs font-bold transition-all ${paymentData.selectedPaymentType === mode ? "bg-white border-zinc-400 text-zinc-900 shadow-sm" : "bg-gray-50 border-gray-200 text-gray-400"}`}
                >
                  {mode === "CASH" ? "เงินสด" : "เงินเชื่อ"}
                </button>
              ))}
            </div>

            {/* ช่องเสิร์ชหาชื่อลูกค้าสมาชิกร้านค้าอะไหล่ */}
            {/* 📍 ทริค: คลุมด้วยกล่อง relative เพื่อให้เมนู Dropdown ผลลัพธ์ลอยอยู่บนตำแหน่งนี้พอดี */}
<div className="relative w-full">
  <form onSubmit={(e) => e.preventDefault()} className="flex gap-1">
    <input
      type="text"
      value={paymentData.searchCustomerQuery}
      onChange={(e) => {
        const val = e.target.value;
        paymentData.setSearchCustomerQuery(val);
        
        // 📍 ทริค: ส่งคำค้นหาไปหา API หลังบ้านทันทีที่พิมพ์ขยับ
        // (ตรวจสอบให้แน่ใจว่าใน hook มีการผูกฟังก์ชันค้นหาสด หรือเรียกฟังก์ชันเสิร์ชที่มีอยู่แล้ว)
        if (val.trim().length > 0) {
          // เรียกฟังก์ชันค้นหาของฮุกคุณ (เช่น paymentData.triggerLiveSearch(val))
        }
      }}
      // 📍 ทริค: เมื่อคลิกหรือโฟกัสที่ช่อง ให้เปิดกล่องแสดงรายการแนะนำ
      onFocus={() => {
        // paymentData.setDropdownOpen(true) -> เปิดกล่อง
      }}
      className="flex-1 bg-white border border-gray-300 rounded px-3 py-2 text-xs shadow-sm focus:outline-none focus:border-[#E51C23] transition-colors text-black"
      placeholder="พิมพ์ชื่ออู่, เบอร์โทร หรือพิมพ์ชื่อลูกค้าขาจร..."
    />
    
    {/* ปุ่มค้นหายังคงคาไว้ได้ สำหรับเคสที่เขาพิมพ์ชื่อขาจรเสร็จแล้วอยากกด Enter ล็อกชื่อ */}
    <button 
      type="button"
      onClick={paymentData.handleSearchCustomer}
      className="bg-zinc-900 text-white text-xs font-bold px-4 py-2 rounded shadow hover:bg-zinc-800 transition-colors"
    >
      ล็อกชื่อ
    </button>
  </form>

  {/* ─── 📍 กล่อง Dropdown แสดงรายชื่อแนะนำ (จะโผล่เมื่อพิมพ์ค้นหาและมีข้อมูล) ─── */}
  {/* ตัวอย่างเงื่อนไข: paymentData.isDropdownOpen && paymentData.searchResults.length > 0 */}
  {paymentData.searchCustomerQuery.trim().length > 0 && (
    <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 shadow-xl max-h-60 overflow-y-auto z-50 rounded">
      {/* วนลูปรายชื่อลูกค้าที่ดึงมาได้จากหลังบ้าน */}
      {/* ตัวอย่าง: paymentData.searchResults.map((cust) => (...)) */}
      <div 
        onClick={() => {
          // 📍 ทริค: พอกดเลือก ให้เซ็ตลูกค้าคนนี้เข้าบิล และล้างสตริง/ปิดกล่อง Dropdown
          // paymentData.setCustomer(cust);
          // paymentData.setSearchCustomerQuery(cust.customer_name);
        }}
        className="px-3 py-2 text-xs text-zinc-800 hover:bg-zinc-100 cursor-pointer flex justify-between border-b border-gray-100"
      >
        <span className="font-bold">อู่มิตรรภาพออโต้เซอร์วิส</span>
        <span className="text-zinc-400">089-8765432</span>
      </div>
      
      {/* ปุ่มทางเลือก: ถ้าพิมพ์ชื่อคนไม่มีในระบบ พนักงานกดบรรทัดนี้เพื่อตั้งเป็นลูกค้าขาจรคีย์สดได้เลย */}
      <div
        onClick={paymentData.handleSearchCustomer}
        className="px-3 py-2 text-xs text-[#E51C23] bg-red-50 hover:bg-red-100 cursor-pointer font-bold text-center"
      >
        ใช้ชื่อชั่วคราว: "{paymentData.searchCustomerQuery}" (ลูกค้าขาจร)
      </div>
    </div>
  )}
</div>
          </div>

          {/* ส่วนประกอบการ์ดแสดงผลวงเงินเครดิตและหนี้สินคงค้างของอู่ */}
          <CustomerCard customer={paymentData.customer} />

          {/* ตารางแจกแจงบิลสรุปราคาและผลรวมส่วนลดทั้งหมด */}
          <div className="space-y-3 pt-4 border-t text-sm font-medium">
            <div className="flex justify-between text-gray-500"><span>ราคารวมสินค้า</span><span className="font-bold text-zinc-900">฿{cartHook.totalItemPrice.toFixed(2)}</span></div>
            <div className="flex justify-between text-gray-500"><span>ส่วนลดท้ายบิล</span><span className="font-bold text-zinc-900">฿{paymentData.computedBillDiscount.toFixed(2)}</span></div>
            <div className="flex justify-between text-red-600 font-extrabold text-base border-b border-dashed pb-2"><span>ส่วนลดรวมทั้งสิ้น</span><span>฿{(cartHook.totalLineDiscount + paymentData.computedBillDiscount).toFixed(2)}</span></div>
          </div>

          {/* ฉป้ายแสดงยอดชำระสุทธิป้ายใหญ่ (ตัวเลขสรุปสุดท้ายบิล) */}
          <div className="bg-[#1C1B1B] text-white p-5 my-5 flex justify-between items-center border border-zinc-800">
            <div className="text-zinc-400 text-xs font-bold uppercase">ยอดชำระสุทธิ</div>
            <span className="text-4xl font-black font-mono">฿{paymentData.finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>

          {/* ปุ่มกดเลือกวิธีการชำระเงินสุดท้ายก่อนเซฟ (เงินสด / QR Code / Credit เชื่อ) */}
          <p className="text-xs font-bold text-gray-400 mb-2 uppercase">เลือกวิธีการชำระเงิน</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 1, label: "เงินสด", icon: <Coins size={18} className="mb-1" /> },
              { id: 2, label: "QR CODE", icon: <QrCode size={18} className="mb-1" /> },
              { id: 3, label: "CREDIT", icon: <CreditCard size={18} className="mb-1" /> },
            ].map((method) => (
              <button
                key={method.id}
                onClick={() => {
                  if (method.id === 3) {
                    const currentActiveType = paymentData.customerTypes.find((t) => t.id === paymentData.activeTypeId);
                    if (!paymentData.customer && currentActiveType?.type_name === "GENERAL") return alert("⚠️ ลูกค้าทั่วไปไม่สามารถชำระด้วยเงินเชื่อได้");
                  }
                  paymentData.setPaymentMethodId(method.id);
                }}
                className={`flex flex-col items-center justify-center py-3 border text-xs font-bold transition-all ${paymentData.paymentMethodId === method.id ? "border-red-600 bg-white text-red-600 border-b-4 shadow-sm" : "border-gray-200 bg-[#F9FAFB] text-gray-400 hover:text-zinc-600"}`}
              >
                {method.icon}
                <span>{method.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ปุ่มยืนยันการขายขนาดใหญ่พิเศษ (ส่ง Payload บันทึกข้อมูลตัดสต๊อกลงฐานข้อมูล) */}
        <Button
          onClick={(e) => {
            e.preventDefault();
            paymentData.handleConfirmSale(cartHook.cart);
          }}
          variant="primary"
          size="lg"
          isLoading={paymentData.isSubmitting}
          className="w-full mt-6 py-4 font-black text-xl bg-[#E51C23] hover:bg-red-700 text-white rounded-none"
        >
          ยืนยันการขาย
        </Button>
      </div>

    </div>
  );
}