"use client";

import React from "react";
import {Trash2, Percent, QrCode, CreditCard, Coins, Plus, Minus, Printer, User,ScanBarcode,} from "lucide-react";
import Button from "../../../components/elements/button";
import { usePosPayment } from "./hooks/usepospayment";
import { usePosCart } from "./hooks/useposcart";
import { useDiscountCalculation } from "./hooks/useDiscountCalculation";
import { CustomerCard } from "./components/customercard";
import Text from "../../../components/elements/text";
import { TableHead, TableHeader, TableRow } from "../../../components/elements/table";
import Input from "../../../components/elements/input";
import { usePosSessionMeta } from "./hooks/usePosSessionMeta";
import {useCustomerFinancials} from "./hooks/useCustomerFinancials";
import Heading from "../../../components/elements/heading"

export default function PosPage(): React.JSX.Element {
  // ─── STATE & HOOK SETUP ───
  const [customerForCart, setCustomerForCart] = React.useState<any>(null);
  const [activeTypeForCart, setActiveTypeForCart] = React.useState<number>(1);
  const { formatDate, formatTime, currentStaff } = usePosSessionMeta();

  // ระบบจัดการสินค้าในตะกร้า 
  const cartHook = usePosCart({
    customer: customerForCart,
    activeTypeId: activeTypeForCart,
  });

  // ระบบจัดการข้อมูลลูกค้าและการชำระเงิน 
  const paymentData = usePosPayment({
    cart: cartHook.cart,
    setCart: cartHook.setCart,
    totalItemPrice: cartHook.totalItemPrice,
    totalLineDiscount: cartHook.totalLineDiscount,
  });

  // เรียกใช้ฟังก์ชันคำนวณเพื่อเอามาช่วย Render หน้าตาราง
  const { calculateLineDiscountAmount, calculateProRataWeight } = useDiscountCalculation();

  const getPaymentIcon = (id: number) => {
  switch (id) {
    case 1: return <Coins size={18} className="mb-1" />;
    case 2: return <QrCode size={18} className="mb-1" />;
    case 3: return <CreditCard size={18} className="mb-1" />;
    default: return <Coins size={18} className="mb-1" />; 
  }
}

  const { customerName, remainingCreditStr } = useCustomerFinancials(paymentData.customer);

  // ซิงค์ข้อมูลสิทธิ์ลูกค้าระหว่าง 2 Hooks เวลาเปลี่ยนลูกค้าใหม่หรือเปลี่ยนประเภทลูกค้า (Active Type) 
  React.useEffect(() => {
  if (!paymentData.customer) {
    setCustomerForCart(null);
  } else {
    setCustomerForCart(paymentData.customer);
  }
  setActiveTypeForCart(paymentData.activeTypeId);
}, [paymentData.customer, paymentData.activeTypeId]);

  const subLabelMap: Record<string, string> = {
    GENERAL: "REGULAR",
    GARAGE: "CREDIT",
    WHOLESALE: "SPECIAL",
  };


  return (
    <div className="flex flex-col lg:flex-row bg-white min-h-[calc(100vh-4rem)] text-gray-800 antialiased overflow-x-hidden">
      
      {/* ─── [โซนฝั่งซ้าย] : ตะกร้าสินค้า ตารางรายการขาย และส่วนลดท้ายบิล ─── */}
      <div className="w-full lg:w-[73%] bg-white p-6 flex flex-col justify-between">
        <div>
          
          {/* 1. ส่วนหัวบิล (Header - ชื่อหน้าย่อ POS & ปุ่มล้างตะกร้าทั้งหมด) */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <Text variant="xs" className="text-[#E51C23] uppercase tracking-wider mb-0 ">
                รายการที่กำลังขาย
              </Text>
              <Heading level="h1" weight="normal" className="mb-0 text-[#1C1B1B]">
                POS
              </Heading>
            </div>
            <div className="text-right flex flex-col items-end gap-1.5">
              <Text variant="xs" className="text-[#6B7280] mb-0">
                สถานะรายการขาย
              </Text>
              <h2 className="text-2xl text-zinc-800 ">บิลร่าง (DRAFT)</h2>
              <button
                type="button"
                onClick={() =>
                  cartHook.handleClearAllCart(() => {
                    paymentData.resetBillDiscount();
                    paymentData.resetPaymentState();
                  })
                }
                // ถ้าในตะกร้ามีสินค้า หรือ มีการเลือกลูกค้าไว้ ให้ปุ่มนี้ยังคลิกได้
                disabled={cartHook.cart.length === 0 && !paymentData.customer}
                
                // ให้เช็กเงื่อนไขเดียวกันเพื่อให้สีปุ่มแสดงผลถูกต้อง
                className={`text-xs px-3 py-1.5 border cursor-pointer transition-all duration-200 ${
                  cartHook.cart.length === 0 && !paymentData.customer
                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed select-none"
                    : "bg-[#E51C23] text-white border-[#E51C23] hover:bg-[#C62828] active:bg-[#B71C1C] shadow-sm"
                }`}
              >
                ล้างทั้งหมด
              </button>
            </div>
          </div>

          {/* --- ส่วนบนสุดของฝั่ง Cart --- */}
          <div className="space-y-4">
  
            {/* ช่องแสกนบาร์โค้ด (ย้ายมาไว้ตรงนี้) */}
            <form onSubmit={cartHook.handleAddProduct} className="mt-6 flex gap-2">
              <div className="relative flex-1">
                <ScanBarcode className="absolute left-4 top-3.5 text-gray-400" size={18} />
                <input
                  type="text"
                  value={cartHook.searchQuery}
                  onChange={(e) => cartHook.setSearchQuery(e.target.value)}
                  placeholder="สแกนบาร์โค้ดสินค้า หรือพิมพ์เลขบาร์โค้ดที่นี่เพื่อเพิ่มรายการ..."
                  className="w-full bg-white border border-gray-200 rounded-none pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-red-500 shadow-sm"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="bg-[#1C1B1B] text-white px-8 py-3 rounded-none text-sm hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                เพิ่มรายการ
              </button>
            </form>

          </div>

          {/* 2. กล่องดำจัดการส่วนลดบิล */}
          <div className="bg-[#1C1B1B] text-gray-300 rounded-none p-4 mb-6 mt-6 flex justify-between items-start border border-zinc-800 border-l-4 border-l-[#E51C23]">
            <div className="flex flex-col items-start gap-2 w-2/3">
              <div className="flex items-center gap-2 text-sm shrink-0 mt-2">
                <Percent size={16} className="text-[#E51C23]" />
                <span className="text-[#FFFFFF] ">การจัดการส่วนลด</span>
              </div>
              <div className="relative flex items-center gap-2 w-full max-w-xs mt-2.5">
                <div className="relative w-full">
                  <span className="absolute left-3 top-2.5 text-xs text-[#6B7280] select-none z-15">
                    {paymentData.billDiscountType === "percentage" ? "%" : "฿"}
                  </span>
                  <Input 
                    type="number"
                    value={paymentData.billDiscountValue === 0 ? "" : paymentData.billDiscountValue}
                    onChange={(e) => paymentData.handleBillDiscountChange(e.target.value)}
                    disabled={paymentData.billDiscountType === "none"}
                    className={`h-9 pl-9 text-sm rounded-none border transition-colors focus:outline-none ${
                      paymentData.billDiscountType === "none"
                        ? "!bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700"
                        : "!bg-[#2A2929] text-white "
                    }`}
                    placeholder={paymentData.billDiscountType === "none" ? "ล็อกไว้" : "0.00"}
                  />
                </div>
                <button
                  type="button"
                  disabled={paymentData.billDiscountType === "none"}
                  onClick={() => paymentData.handleBillDiscountChange(String(paymentData.billDiscountValue))}
                  className={`text-xs px-4 py-2.5 rounded-none shrink-0 transition-colors shadow-sm cursor-pointer ${
                    paymentData.billDiscountType === "none"
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
                <button type="button" onClick={() => { paymentData.updateSession("billDiscountType", "none"); paymentData.updateSession("billDiscountValue", 0);}} className={`px-3 py-1 rounded-none transition-all cursor-pointer ${paymentData.billDiscountType === "none" ? "bg-[#E51C23] text-white" : "text-[#D1D5DB] hover:text-zinc-200"}`}>ต่อรายการ</button>
                <button type="button" onClick={() => { paymentData.updateSession("billDiscountType", "amount"); paymentData.updateSession("billDiscountValue", 0);}} className={`px-3 py-1 rounded-none transition-all cursor-pointer ${paymentData.billDiscountType === "amount" ? "bg-[#E51C23] text-white" : "text-[#D1D5DB] hover:text-zinc-200"}`}>บิลทั้งหมด (฿)</button>
                <button type="button" onClick={() => { paymentData.updateSession("billDiscountType", "percentage"); paymentData.updateSession("billDiscountValue", 0);}} className={`px-3 py-1 rounded-none transition-all cursor-pointer ${paymentData.billDiscountType === "percentage" ? "bg-[#E51C23] text-white" : "text-[#D1D5DB] hover:text-zinc-200"}`}>บิลทั้งหมด (%)</button>
              </div>
              <div className="bg-[#2D2C2C] p-2 text-[11px] leading-tight text-[#D1D5DB] max-w-[265px] text-left rounded-none">
                <span className="text-[#E51C23] mr-1 ">ⓘ</span>
                {paymentData.billDiscountType === "none" ? (
                  <span>เลือกหน่วย (฿ / %) และระบุจำนวนส่วนลดที่ต้องการในแต่ละรายการสินค้า</span>
                ) : (
                  <span>ส่วนลดกำลังดำเนินการ: (ราคาสินค้า / ยอดรวม) * <span className="text-white">{paymentData.billDiscountValue ? paymentData.billDiscountValue.toFixed(2) : "0.00"}</span> {paymentData.billDiscountType === "percentage" ? "%" : "บาท"} จะถูกหักตามสัดส่วน ดำเนินการต่อในรายการ</span>
                )}
              </div>
            </div>
          </div>

          {/* 3. ตารางตระกร้าแสดงผลสินค้า */}
          <div className="bg-white rounded-none shadow-sm overflow-hidden border border-gray-200">
            <table className="w-full text-left border-collapse">
              <TableHeader className="bg-[#F6F3F2] rounded-none border-b border-gray-200 text-[11px] text-[#6B7280] uppercase tracking-wider">
                <TableRow>
                  <TableHead className="py-3 px-4 w-[15%]">SKU</TableHead>
                  <TableHead className="py-3 px-4 w-[32%]">คำอธิบายสินค้า</TableHead>
                  <TableHead className="py-3 px-4 text-right w-[12%]">หน่วยราคา</TableHead>
                  <TableHead className="py-3 px-4 text-center w-[12%]">QTY</TableHead>
                  <TableHead className="py-3 px-4 text-center w-[8%]">DISC?</TableHead>
                  <TableHead className="py-3 px-4 text-center w-[12%]">ประเภทส่วนลด</TableHead>
                  <TableHead className="py-3 px-4 text-center w-[10%]">ลดราคา</TableHead>
                  <TableHead className="py-3 px-4 text-right pr-6 w-[11%]">LINE TOTAL</TableHead>
                </TableRow>
              </TableHeader>
              <tbody className="divide-y divide-gray-100 text-sm">
                {cartHook.cart.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-400">ยังไม่มีสินค้าในตะกร้า</td>
                  </tr>
                ) : (
                  cartHook.cart.map((item, index) => {
                    const lineTotal = item.unit_price * item.qty;
                    
                    // เรียกใช้ฟังก์ชันจากเครื่องคิดเลขส่วนลดตรงๆ 
                    const itemDiscount = calculateLineDiscountAmount(item.unit_price, item.qty, item.discount_type, item.discount_value);
                    const subtotalAfterDiscount = lineTotal - itemDiscount;

                    const totalSubtotalAfterLineDiscount = cartHook.totalItemPrice - cartHook.totalLineDiscount;
                    const allocatedDiscount = calculateProRataWeight(subtotalAfterDiscount, totalSubtotalAfterLineDiscount, paymentData.computedBillDiscount);
                    
                    const finalLineTotal = subtotalAfterDiscount - allocatedDiscount;

                    return (
                      <tr key={index} className="hover:bg-gray-50/80 transition-colors">
                        {/* column1 Product Code */}
                        <td className="py-4 px-4 text-xs text-[#1C1B1B]">{item.product_code || "—"}</td>
                        {/* column2 Product Name */}
                        <td className="py-4 px-4">
                          <Text variant="body" className="text-[#1C1B1B] mb-0 ">{item.product_name}</Text>
                          <Text variant="small" className="text-[11px] text-[#6B7280] mt-0.5 mb-0">PN: {item.part_number || "—"}</Text>
                          {(item.brand_name || item.grade_name || item.model_name) && (
                            <Text variant="small" className="text-[11px] text-[#6B7280] mt-1 inline-block py-0.5 rounded-sm mb-0">
                              แบรนด์: {item.brand_name || "ไม่ระบุ"} | เกรด: {item.grade_name || "ทั่วไป"} | รุ่นรถที่รองรับ: {item.model_name || "ทุกรุ่น"}
                            </Text>
                          )}
                        </td>
                        {/* column3 Unit Price */}
                        <td className="py-4 px-4 text-right text-[#1C1B1B]">{item.unit_price.toFixed(2)}</td>
                        
                        {/* column4 Quantity */}
                        <td className="py-4 px-4 text-center">
                          <div className="inline-flex items-center border border-gray-300 rounded-none bg-[#F6F3F2]">
                            <button type="button" onClick={() => cartHook.updateQty(index, -1)} className="p-1 px-2 cursor-pointer text-gray-600 hover:text-black"><Minus size={12} /></button>
                            <input
                              type="number"
                              value={item.qty === 0 ? "" : item.qty}
                              onChange={(e) => cartHook.handleSetQuantity(index, e.target.value)}
                              onBlur={(e) => {
                                if (e.target.value === "" || parseInt(e.target.value, 10) < 1) cartHook.handleSetQuantity(index, 1);
                              }}
                              className="w-10 text-center bg-transparent border-none focus:outline-none focus:ring-0 text-sm p-0 m-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button type="button" onClick={() => cartHook.updateQty(index, 1)} className="p-1 px-2 cursor-pointer text-gray-600 hover:text-black"><Plus size={12} /></button>
                          </div>
                        </td>
                        {/* column5 Discount Toggle */}
                        <td className="py-4 px-4 text-center">
                          <input type="checkbox" checked={item.discount_type !== "none"} className="accent-[#E51C23] h-4 w-4 cursor-pointer" onChange={(e) => cartHook.handleDiscountToggle(index, e.target.checked)} />
                        </td>
                        {/* column6 Discount Type */}
                        <td className="py-4 px-4 text-center">
                          {item.discount_type !== "none" ? (
                            <div className="inline-flex bg-[#F6F3F2] p-0.5 rounded-none text-xs">
                              <button type="button" onClick={() => cartHook.handleDiscountTypeChange(index, "amount")} className={`px-2 py-1 transition-all cursor-pointer ${item.discount_type === "amount" ? "bg-[#E51C23] text-white" : "text-[#6B7280] hover:text-gray-600"}`}>฿</button>
                              <button type="button" onClick={() => cartHook.handleDiscountTypeChange(index, "percentage")} className={`px-2 py-1 transition-all cursor-pointer ${item.discount_type === "percentage" ? "bg-[#E51C23] text-white" : "text-[#6B7280] hover:text-gray-600"}`}>%</button>
                            </div>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        {/* column7 Discount Value */}
                        <td className="py-4 px-4 text-center">
                          {item.discount_type !== "none" ? (
                            <div className="flex flex-col items-center gap-1">
                              <div className="relative inline-flex items-center justify-center px-2 py-1 min-w-[75px] transition-all border bg-gray-100 text-gray-700 border-gray-300 rounded-none">
                                {item.discount_type === "amount" && item.discount_value > 0 && <span className="mr-0.5 text-gray-500 select-none">-</span>}
                                <input type="number" step="any" value={item.discount_value === 0 ? "" : item.discount_value} placeholder="0" onChange={(e) => cartHook.handleDiscountValueChange(index, e.target.value)} className="w-12 bg-transparent text-center border-b window-fix outline-none focus:border-zinc-400" />
                                {item.discount_type === "percentage" && <span className="ml-0.5 text-gray-400 select-none">%</span>}
                              </div>
                              {itemDiscount + allocatedDiscount > 0 && (
                                <span className="text-[10px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded-sm block whitespace-nowrap mt-0.5">
                                  ถัวเฉลี่ยลด: -฿{(itemDiscount + allocatedDiscount).toFixed(2)}
                                </span>
                              )}
                            </div>
                          ) : allocatedDiscount > 0 ? (
                            <span className="text-[10px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded-sm inline-block whitespace-nowrap">ถัวเฉลี่ยลด: -฿{allocatedDiscount.toFixed(2)}</span>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        {/* column8 Total */}
                        <td className="py-4 px-4 text-right pr-6 text-zinc-900 ">
                          <div className="flex justify-end items-center gap-3">
                            <div className="text-right">
                              {itemDiscount + allocatedDiscount > 0 && <span className="text-[11px] text-zinc-400 line-through block ">฿{lineTotal.toFixed(2)}</span>}
                              <span className="text-sm text-zinc-950 block">฿{finalLineTotal.toFixed(2)}</span>
                            </div>
                            <button type="button" onClick={() => cartHook.handleRemoveItem(index)} className="text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"><Trash2 size={16} /></button>
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

      </div>

      {/* ─── [โซนฝั่งขวา] : ข้อมูลลูกค้า และสรุปยอดเงิน ─── */}
      <div className="w-full lg:w-[27%] bg-[#F6F3F2] p-6 flex flex-col justify-between shadow-2xl shrink-0 min-h-full">
        <div>
          <div className="mb-4">
            <Text variant="small" className="text-gray-500 mb-2 uppercase tracking-wide">ข้อมูลลูกค้า</Text>
            <div className="grid grid-cols-3 gap-1 mb-2">
              {paymentData.customerTypes.map((type) => {
                const isActive = paymentData.posSession.customer && paymentData.posSession.customer.customer_type
                  ? paymentData.posSession.customer.customer_type.id === type.id
                  : paymentData.posSession.activeTypeId === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => {
                      paymentData.updateSession("activeTypeId", type.id);
                    }}
                    className={`flex flex-col items-center justify-center text-center transition-all h-10 leading-tight border text-xs ${isActive ? "bg-white border-zinc-400 text-zinc-900 shadow-sm" : "border-transparent text-gray-400 hover:text-gray-600"}`}
                  >
                    {type.type_label?.replace("ลูกค้า", "") || type.type_name}
                    <span className="text-[9px] block">{subLabelMap[type.type_name] || type.type_name}</span>
                  </button>
                );
              })}
            </div>

            {/* <div className="grid grid-cols-2 gap-1 mb-4">
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
                    paymentData.updateSession("paymentMethodId", mode === "CASH" ? 1 : 3);
                  }}
                  className={`text-center py-1.5 border text-xs transition-all ${paymentData.selectedPaymentType === mode ? "bg-white border-zinc-400 text-zinc-900 shadow-sm" : "bg-gray-50 border-gray-200 text-gray-400"}`}
                >
                  {mode === "CASH" ? "เงินสด" : "เงินเชื่อ"}
                </button>
              ))}
            </div> */}

            <div className="relative w-full">
              <form onSubmit={paymentData.handleSearchCustomer} className="flex flex-col gap-1.5">            
                <input
                  type="text"
                  value={paymentData.posSession.searchQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    paymentData.updateSession("searchQuery", val);
                    if (val.trim().length > 0) { paymentData.triggerLiveSearch(val); } 
                    else { if (typeof paymentData.setSearchResults === "function") paymentData.setSearchResults([]); }
                  }}
                  className="bg-white border border-gray-300 rounded-none px-3 py-2 text-xs shadow-sm focus:outline-none focus:border-[#E51C23] transition-colors text-black"
                  placeholder="พิมพ์ชื่ออู่, เบอร์โทรสมาชิก หรือพิมพ์ชื่อลูกค้าขาจร..."
                />
                <div className="flex gap-1">
                  <input type="text" value={paymentData.tempPhone} onChange={(e) => { const newPhone = e.target.value; paymentData.setTempPhone(newPhone); if (paymentData.customer && paymentData.customer.id === 0) { paymentData.setCustomer({ ...paymentData.customer, phone_number: newPhone.trim() || "ลูกค้าทั่วไป (ไม่ระบุ)" }); } }} className="flex-1 bg-white border border-gray-300 rounded-none px-3 py-2 text-xs shadow-sm focus:outline-none focus:border-[#E51C23] transition-colors text-black" placeholder="ระบุเบอร์โทรติดต่อสำหรับส่งของ (เฉพาะลูกค้าขาจร)..." />
                  <button type="submit" className="bg-zinc-900 text-white text-xs px-4 py-2 rounded-none shadow hover:bg-zinc-800 transition-colors whitespace-nowrap">ล็อกชื่อ</button>
                </div>
              </form>

              {paymentData.searchCustomerQuery.trim().length > 0 && paymentData.searchResults && paymentData.searchResults.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 shadow-xl max-h-60 overflow-y-auto z-50 rounded flex flex-col">
                  {paymentData.searchResults.map((cust) => (
                    <div
                      key={cust.id}
                      onClick={() => {
                        paymentData.updateSession("customer", cust);
                        paymentData.updateSession("searchQuery", cust.customer_name);
                        if (cust.customer_type) {
                          paymentData.updateSession("activeTypeId", cust.customer_type.id);
                          paymentData.setSelectedPaymentType(cust.customer_type.type_name === "GENERAL" ? "CASH" : "CREDIT");
                          paymentData.updateSession("paymentMethodId", cust.customer_type.type_name === "GENERAL" ? 1 : 1);
                        }
                        if (typeof paymentData.setSearchResults === "function") paymentData.setSearchResults([]);
                      }}
                      className="px-3 py-2 text-xs text-zinc-800 hover:bg-zinc-100 cursor-pointer flex justify-between border-b border-gray-100 bg-white"
                    >
                      <span className="text-zinc-900">{cust.customer_name}</span>
                      <span className="text-zinc-500">{cust.phone_number || "ไม่มีเบอร์โทร"}</span>
                    </div>
                  ))}
                  <div onClick={(e) => { paymentData.handleSearchCustomer(e); if (typeof paymentData.setSearchResults === "function") paymentData.setSearchResults([]); }} className="px-3 py-2.5 text-xs text-[#E51C23] bg-red-50 hover:bg-red-100 cursor-pointer text-center sticky bottom-0 border-t border-red-100 transition-colors">
                    ใช้ชื่อชั่วคราว: "{paymentData.searchCustomerQuery}" (ลูกค้าขาจร)
                  </div>
                </div>
              )}
            </div>
          </div>

          <CustomerCard customer={paymentData.customer} />

          {/* ตารางแจกแจงบิลสรุปราคา */}
          <div className="space-y-3 pt-4">
            <div className="flex justify-between">
              <Text variant="small" className="text-[#6B7280] mb-0">ราคารวมสินค้า</Text>
              <Text variant="muted" className="text-[#1C1B1B] mb-0">฿{cartHook.totalItemPrice.toFixed(2)}</Text>
            </div>
            <div className="flex justify-between">
              <Text variant="small" className="text-[#6B7280] mb-0">ส่วนลดท้ายบิล</Text>
              <Text variant="muted" className="text-[#1C1B1B] mb-0">฿{paymentData.computedBillDiscount.toFixed(2)}</Text>
            </div>
            <div className="flex justify-between items-center text-[#E51C23] border-b border-dashed pb-2">
              <Text variant="small" className="text-[#E51C23] mb-0">ส่วนลดรวมทั้งสิ้น</Text>
              <Text variant="muted" className="text-[#E51C23] mb-0">฿{(cartHook.totalLineDiscount + paymentData.computedBillDiscount).toFixed(2)}</Text>
            </div>
          </div>

          <div className="bg-[#1C1B1B] p-5 my-5 flex justify-between items-center border border-zinc-800">
            <Text variant="small" className="text-[#9CA3AF] uppercase mb-0 tracking-wider">ยอดชำระสุทธิ</Text>
            <Text variant="muted" className="text-[#FFFFFF] text-2xl mb-0">฿{paymentData.finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
          </div>

          <Text variant="small" className="text-[#6B7280] uppercase">เลือกวิธีการชำระเงิน</Text>
          <div className="grid grid-cols-3 gap-2">
            {paymentData.paymentMethods.map((method) => {
              const isProcessing = paymentData.isSubmitting || paymentData.isConfirming;
              // ล็อกเฉพาะปุ่มเงินเชื่อ (ID: 3) ถ้าลูกค้าไม่ได้เป็นสมาชิกที่ลงทะเบียนไว้
              const isCreditDisabled = method.id === 3 && !paymentData.isRegisteredCustomer;

              const isDisabled = isProcessing || isCreditDisabled;
              const isSelected = paymentData.paymentMethodId === method.id;

              return (
                <button
                  key={method.id}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => paymentData.selectPaymentMethod(method.id)}
                  className={`flex flex-col items-center justify-center py-3 border text-xs transition-all ${
                    isDisabled
                      ? "opacity-50 bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed"
                      : isSelected
                        ? "border-red-600 bg-white text-red-600 border-b-4 shadow-sm"
                        : "border-gray-200 bg-[#F9FAFB] text-gray-400 hover:text-zinc-600"
                  }`}
                >
                  {getPaymentIcon(method.id)}
                  <span>{method.method_name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <Button 
          onClick={(e) => { 
            e.preventDefault(); 
            if (paymentData.selectedPaymentType === "CASH" && paymentData.paymentMethodId === 3) {
              paymentData.updateSession("paymentMethodId", 1);
            }
            // เรียกฟังก์ชันนี้เพื่อยิงสร้าง Order สภาพ pending/unpaid ลง DB + เปิด Modal
            paymentData.handleConfirmSale(); 
          }} 
          variant="primary" 
          size="lg" 
          isLoading={paymentData.isSubmitting} 
          className="w-full mt-6 py-4 text-xl bg-[#E51C23] hover:bg-red-700 text-white rounded-none"
        >
          ยืนยันการขาย
        </Button>

        {/* ================= PAYMENT MODAL ================= */}
        {paymentData.isPaymentModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-none">
            <div className="bg-[#FCF9F8] w-full max-w-xl rounded-none shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
              
              {/* Header */}
              <div className="bg-[#1C1B1B] px-6 py-4 flex justify-between items-center">
                <Text variant="lead" className="text-white mb-0 font-medium">ชำระเงิน ({paymentData.paymentMethodId === 1 ? "เงินสด" : paymentData.paymentMethodId === 2 ? "QR CODE" : "เงินเชื่อ"})</Text>
                <button onClick={() => paymentData.closePaymentModal()} className="text-[#9CA3AF] hover:text-white text-xl">✕</button>
              </div>

              {/* 2. Body */}
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-start border-l-3 border-[#5D3F3C] bg-[#F6F3F2] pl-4 py-3 my-4">
                  <div className="text-xs">
                    <p className="text-[#1C1B1B] mb-0.5">ลูกค้า:</p>
                    <p className="text-[#1C1B1B] font-medium text-sm">{paymentData.customer?.customer_name || "ลูกค้าขาจร"}</p>
                  </div>
                  <div className="text-right text-xs mr-2">
                    <p className="text-[#1C1B1B] mb-0.5">ประเภท:</p>
                    <p className="text-[#E51C23] ">{paymentData.customer?.customer_type?.type_label || "ทั่วไป"}</p>
                  </div>
                </div>

                <div className="bg-[#F6F3F2]/50 p-4 space-y-2 border border-[#E7BDB8]/50">
                  <div className="flex justify-between">
                    <Text variant="xs" className="text-[#1C1B1B]">ราคารวมสินค้า</Text>
                    <Text variant="xs" className="text-[#1C1B1B]">{paymentData.totalItemPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท</Text>
                  </div>
                  <div className="flex justify-between">
                    <Text variant="xs" className="text-[#1C1B1B]">ส่วนลดท้ายบิล {paymentData.billDiscountType === 'percentage' ? `(${paymentData.billDiscountValue}%)` : ''}</Text>
                    <Text variant="xs" className="text-[#1C1B1B]">{paymentData.computedBillDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท</Text>
                  </div>
                  <div className="flex justify-between">
                    <Text variant="xs" className="text-[#259B24]">ส่วนลดรวมทั้งสิ้น</Text>
                    <Text variant="xs" className="text-[#259B24]">-{(paymentData.totalItemPrice - paymentData.finalTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท</Text>
                  </div>
                  {paymentData.selectedPaymentType === "CREDIT" && (
                    <>
                    <div className="flex justify-between">
                      <Text variant="xs" className="text-[#1C1B1B]">ระยะเวลาเครดิต</Text>
                      <Text variant="xs" className="text-[#1C1B1B]">{paymentData.storeConfig?.max_overdue_days ?? 30} วัน</Text>
                    </div>
                    <div className="flex justify-between">
                      <Text variant="xs" className="text-[#1C1B1B]">กำหนดชำระ</Text>
                      <Text variant="xs" className="text-[#1C1B1B]">{paymentData.formattedCreditDueDate}</Text>
                    </div>
                    </>
                  )}
                  <div className="flex justify-between border-t pt-2 border-[#E7BDB8]/50">
                    <Text variant="small" className="text-[#1C1B1B] font-medium mb-0">ยอดชำระสุทธิ</Text>
                    <Text variant="small" className="text-[#1C1B1B] font-medium mb-0">{paymentData.finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท</Text>
                  </div>
                </div>

                {/* 3. ส่วนเนื้อหาเฉพาะ */}
                {/* เงินสด ยอดชำระสุทธิ และ ยอดเงินทอน */}
                {paymentData.paymentMethodId === 1 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="border-l-3 border-[#E51C23] p-4 bg-[#F0EDEC]">
                        <Text variant="xs" className="text-[#5F5E5E]">ยอดชำระสุทธิ</Text>
                        <div className="flex justify-between items-baseline mt-2">
                          <Text variant="fourxl">{paymentData.finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                          <Text variant="xs" className="text-[#1C1B1B]">บาท</Text>
                        </div>
                      </div>
                      <div className="border-l-3 border-[#006E0A] p-4 bg-[#86F976]/20">
                        <Text variant="xs" className="text-[#259B24]">ยอดเงินทอน</Text>
                        <div className="flex justify-between items-baseline mt-2">
                          <Text variant="fourxl" className={`text-[#259B24] truncate ${Math.max(0, paymentData.receivedAmount - paymentData.finalTotal) > 999999 ? "text-2xl" : "text-4xl"}`}>
                            {Math.max(0, paymentData.receivedAmount - paymentData.finalTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Text>
                          <Text variant="xs" className="text-[#259B24]">บาท</Text>
                        </div>
                      </div>
                    </div>

                    {/* ส่วนรับเงินมา */}
                    <div className="flex flex-col gap-1.5">
                      <Text variant="small" className="text-[#1C1B1B] font-medium">รับเงินมา</Text>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-baseline justify-between w-full px-4 py-4 bg-white border-b-2 border-[#E7BDB8]">
                          <Input 
                            type="text" 
                            inputMode="decimal" 
                            className="w-full text-4xl text-[#1C1B1B] font-semibold bg-transparent border-none focus:outline-none [appearance:textfield]" 
                            value={paymentData.displayValue || ""} 
                            onChange={(e) => paymentData.handleReceivedAmountChange(e.target.value)} 
                            onBlur={() => { paymentData.handleReceivedAmountBlur(); 
                              const formatted = paymentData.receivedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); paymentData.setDisplayValue(formatted); }} 
                              onFocus={paymentData.handleReceivedAmountFocus} placeholder="0.00" />
                          <Text variant="xs" className="text-[#1C1B1B] ml-2 font-medium">บาท</Text>
                        </div>
                        <div className="flex items-center justify-between w-full px-4 py-6 border-b-1 border-[#E7BDB8]"></div>
                      </div>   
                      <div className="grid grid-cols-2 gap-4">
                        {/* ฝั่งขวา ปุ่มเพิ่มจำนวนเงินที่รับมา */}
                        <div className="grid grid-cols-3 gap-3 mt-4">
                          {[10, 20, 50, 100, 500, 1000].map((amount) => (
                            <button
                              key={amount}
                              type="button"
                              onClick={() => {
                                const newTotal = paymentData.receivedAmount + amount;
                                paymentData.setReceivedAmount(newTotal);
                                paymentData.setDisplayValue(newTotal.toFixed(2));
                              }}
                              className="flex items-center justify-center px-2 py-4 bg-[#E5E2E1] rounded-none text-xs font-medium text-[#1C1B1B] hover:bg-[#D9D9D9] transition-all truncate"
                            >
                              {amount} บาท
                            </button>
                          ))}
                        </div>
                        {/*ฝั่งขวา วันที่, เวลา, ผู้ดำเนินการ */}
                        <div className="mt-4">
                          <div className="flex justify-between items-center">
                            <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2">วันที่</Text>
                            <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2">{formatDate}</Text>
                          </div>
                          <div className="flex justify-between items-center">
                            <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2">เวลา</Text>
                            <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2">{formatTime}</Text>
                          </div>
                          <div className="flex justify-between items-center">
                            <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2">ผู้ดำเนินการ</Text>
                            <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2">{currentStaff}</Text>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {paymentData.paymentMethodId === 2 && (
                <div className="bg-white p-6 border border-[#E7BDB8]/50">
                  {/* Grid หลัก */}
                  <div className="grid grid-cols-2 gap-4">

                    {/* ฝั่งซ้าย */}
                    <div className="flex flex-col items-center justify-center space-y-3">
                      {/* กรอบรูป QR Code */}
                      <div className="relative w-52 h-52 p-2 flex items-center justify-center">
                        {paymentData.isLoadingQR ? (
                          <div className="flex flex-col items-center text-gray-400">
                            <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E51C23] mb-2"></span>
                            <Text variant="xs" className="text-xs">กำลังสร้าง QR Code...</Text>
                          </div>
                        ) : paymentData.qrCodeData?.qrCode ? (
                          <img 
                            src={paymentData.qrCodeData.qrCode} 
                            alt="PromptPay QR Code" 
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="flex flex-col items-center text-gray-400 text-center p-2">
                            <p className="text-xs text-red-500 mb-2">ไม่สามารถโหลด QR Code ได้</p>
                            <button
                              type="button"
                              onClick={async () => {
                                let targetOrderId = paymentData.currentOrderId || paymentData.posSession.currentOrderId;
                                if (!targetOrderId) {
                                  targetOrderId = await paymentData.submitOrderToDatabase();
                                }
                                if (targetOrderId) {
                                  paymentData.handleGeneratePromptPayQR(targetOrderId, 1);
                                }
                              }}
                              className="px-3 py-1 bg-white text-gray-700 text-xs rounded border border-gray-200 hover:bg-gray-50 transition"
                            >
                              ลองใหม่อีกครั้ง
                            </button>
                          </div>
                        )}
                      </div>

                      {/* ข้อความใต้ QR Code */}
                      <div className="text-center space-y-0.5">
                        <Text variant="small" className="font-medium text-[#1C1B1B] leading-tight block">เจเจ อะไหล่ยนต์</Text>
                        <Text variant="xs" className="font-normal text-[#6B7280] leading-tight block">ชื่อบัญชี เจเจ อะไหล่ยนต์</Text>
                      </div>
                    </div>

                    {/* ---------------- ฝั่งขวา ---------------- */}
                    <div className="flex flex-col justify-between">
                    
                      <div className="h-48 flex flex-col justify-end">
                        
                        {/* 1. กล่องยอดชำระสุทธิ */}
                        <div className="border-l-3 border-[#E51C23] p-4 bg-[#F0EDEC]">
                          <Text variant="xs" className="text-[#5F5E5E]">ยอดชำระสุทธิ</Text>
                          <div className="flex justify-between items-baseline mt-2">
                            <Text variant="fourxl">{paymentData.finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                            <Text variant="xs" className="text-[#1C1B1B]">บาท</Text>
                          </div>
                        </div>

                        {/* 2. เส้นคั่น + รายละเอียด  */}
                        <div className="pt-3 space-y-2">
                          <div className="border-b border-[#E7BDB8]"></div>
                          <div>
                          <div className="flex justify-between items-center">
                            <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2">วันที่</Text>
                            <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2">{formatDate}</Text>
                          </div>
                          <div className="flex justify-between items-center">
                            <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2">เวลา</Text>
                            <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2">{formatTime}</Text>
                          </div>
                          <div className="flex justify-between items-center">
                            <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2">ผู้ดำเนินการ</Text>
                            <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2">{currentStaff}</Text>
                          </div>
                        </div>
                        </div>

                      </div>
                    </div>
                  </div>

                  {/* Ref No. ด้านล่างสุด */}
                  {paymentData.qrCodeData?.refNo && (
                    <div className="mt-5 pt-3 border-t border-gray-100 flex justify-between items-center">
                      <Text variant="xs">PromptPay Reference</Text>
                      <Text variant="xs">Ref No: <span className="text-[#1C1B1B] font-semibold">{paymentData.qrCodeData.refNo}</span></Text>
                    </div>
                  )}
                </div>
                )}

                {paymentData.paymentMethodId === 3 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="border-l-3 border-[#E51C23] p-4 bg-[#F0EDEC]">
                        <Text variant="xs" className="text-[#5F5E5E]">ยอดชำระสุทธิ</Text>
                        <div className="flex justify-between items-baseline mt-2">
                          <Text variant="fourxl">{paymentData.finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                          <Text variant="xs" className="text-[#1C1B1B]">บาท</Text>
                        </div>
                      </div>
                      <div className="border-l-3 border-[#2563EB] p-4 bg-[#EFF6FF]">
                        <Text variant="xs" className="text-[#2563EB]">เครดิตคงเหลือ</Text>
                        <div className="flex justify-between items-baseline mt-2">
                          <Text variant="fourxl" className={`text-[#2563EB] truncate ${Math.max(0, paymentData.receivedAmount - paymentData.finalTotal) > 999999 ? "text-2xl" : "text-4xl"}`}>
                            {remainingCreditStr || "0.00"}
                          </Text>
                          <Text variant="xs" className="text-[#2563EB]">บาท</Text>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Text variant="small" className="text-[#1C1B1B] font-medium">ชื่อผู้รับของ / ผู้สั่งซื้อ </Text>
                       <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-baseline justify-between w-full px-4 py-2 bg-white border-b-2 border-[#E7BDB8]">
                          <Input 
                              type="text" 
                              className="w-full text-lg text-[#1C1B1B] font-normal bg-transparent border-none focus:outline-none [appearance:textfield] p-0 placeholder-[#6B7280]"                              
                              value={paymentData.receiverName} 
                              onChange={(e) => paymentData.setReceiverName(e.target.value)} 
                              placeholder="ระบุชื่อผู้รับของ..." 
                            />
                            <User className="w-5 h-5 text-[#1C1B1B] shrink-0" />
                        </div>
                        <div className="flex items-center justify-between w-full px-4 py-6 border-b-1 border-[#E7BDB8]"></div>
                      </div>  
                      <div className="grid grid-cols-2 gap-4">
                        <div className="border-l-3 border-[#E7BDB8] p-4 mt-4 bg-[#F0EDEC]">
                          <Text variant="xs" className="text-[#1C1B1B] font-light">* ระบบจะดำเนินการเพิ่มยอดหนี้ในบัญชีของ<br /><span className="font-medium">{customerName}</span>{" "}ทันทีหลังจากยืนยันรายการ</Text>
                        </div>
                        {/*ฝั่งซ้าย วันที่, เวลา, ผู้ดำเนินการ */}
                        <div className="mt-4">
                          <div className="flex justify-between items-center">
                            <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2">วันที่</Text>
                            <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2">{formatDate}</Text>
                          </div>
                          <div className="flex justify-between items-center">
                            <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2">เวลา</Text>
                            <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2">{formatTime}</Text>
                          </div>
                          <div className="flex justify-between items-center">
                            <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2">ผู้ดำเนินการ</Text>
                            <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2">{currentStaff}</Text>
                          </div>
                        </div>
                      </div> 
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Footer */}
              <div className="flex p-6 gap-4">
                <button 
                  type="button" 
                  disabled={paymentData.isConfirming || paymentData.isSubmitting}
                  onClick={() => paymentData.setIsPaymentModalOpen(false)} 
                  className="px-20 py-3 bg-[#E5E2E1] font-normal text-sm rounded-none hover:bg-[#E7E5E4] transition-colors disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                
                <button 
                  type="button" 
                  disabled={paymentData.isConfirming} 
                  onClick={async () => {
                    // ทุกช่องทางชำระเงินจะมาจบการขายที่ฟังก์ชันนี้เท่านั้น
                    await paymentData.handleFinalConfirmAndPrint();
                  }} 
                  className="flex-1 py-3 bg-[#E51C23] text-white font-normal text-sm hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:bg-gray-400"
                >
                  {paymentData.isConfirming ? (
                    <span>กำลังทำรายการ...</span>
                  ) : (
                    <>
                      <Printer className="w-4 h-4" />
                      ยืนยันและพิมพ์ใบเสร็จ
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}