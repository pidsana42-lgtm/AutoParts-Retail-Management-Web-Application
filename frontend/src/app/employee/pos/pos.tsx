import React from "react";
import {Trash2, Percent, QrCode, CreditCard, Coins, Plus, Minus,} from "lucide-react";
import Button from "../../../components/elements/button";
import { usePosPayment } from "./hooks/usepospayment";
import { usePosCart } from "./hooks/useposcart";
import { CustomerCard } from "./components/customercard";
import Text from "../../../components/elements/text";
import { TableHead, TableHeader, TableRow } from "../../../components/elements/table";


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

  const getPaymentIcon = (id: number) => {
  switch (id) {
    case 1: return <Coins size={18} className="mb-1" />;
    case 2: return <QrCode size={18} className="mb-1" />;
    case 3: return <CreditCard size={18} className="mb-1" />;
    default: return <Coins size={18} className="mb-1" />; 
  }
}

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
    <div className="flex flex-col lg:flex-row bg-white min-h-[calc(100vh-4rem)] text-gray-800 antialiased overflow-x-hidden">
      
      {/* ========================================================================= */}
      {/* ─── [โซนฝั่งซ้าย] : ตะกร้าสินค้า ตารางรายการขาย และส่วนลดท้ายบิล ─── */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-[73%] bg-white p-6 flex flex-col justify-between">
        <div>
          
          {/* 1. ส่วนหัวบิล (Header - ชื่อหน้าย่อ POS & ปุ่มล้างตะกร้าทั้งหมด) */}
          <div className="flex justify-between items-start mb-6">
            <div>
              {/*  เปลี่ยนเป็น <Text variant="small"> */}
              <Text variant="xs" className="text-[#E51C23] uppercase tracking-wider mb-0 ">
                รายการที่กำลังขาย
              </Text>
              <h1 className="text-4xl text-zinc-900 ">POS</h1>
            </div>
            <div className="text-right flex flex-col items-end gap-1.5">
              {/*  เปลี่ยนเป็น <Text variant="small"> */}
              <Text variant="xs" className="text-[#6B7280] mb-0">
                สถานะรายการขาย
              </Text>
              <h2 className="text-2xl text-zinc-800 ">
                บิลร่าง (DRAFT)
              </h2>
              <button
                type="button"
                onClick={() =>
                  cartHook.handleClearAllCart(() => {
                    paymentData.resetBillDiscount();
                  })
                }
                disabled={cartHook.cart.length === 0}
                className={`text-xs px-3 py-1.5 border cursor-pointer transition-all duration-200  ${
                  cartHook.cart.length === 0
                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed select-none"
                    : "bg-[#E51C23] text-white border-[#E51C23] hover:bg-[#C62828] active:bg-[#B71C1C] shadow-sm"
                }`}
              >
                ล้างทั้งหมด
              </button>
            </div>
          </div>

          {/* 2. กล่องดำจัดการส่วนลดบิล */}
          <div className="bg-[#1C1B1B] text-gray-300 rounded-none p-4 mb-6 flex justify-between items-start border border-zinc-800 border-l-4 border-l-[#E51C23]">
            <div className="flex flex-col items-start gap-2 w-2/3">
              <div className="flex items-center gap-2 text-sm shrink-0 mt-2">
                <Percent size={16} className="text-[#E51C23]" />
                <span className="text-[#FFFFFF] ">การจัดการส่วนลด</span>
              </div>
              <div className="relative flex items-center gap-2 w-full max-w-xs mt-2.5">
                <div className="relative w-full">
                  <span className="absolute left-3 top-2.5 text-xs text-zinc-500 select-none ">
                    {paymentData.billDiscountType === "percentage" ? "%" : "฿"}
                  </span>
                  <input
                    type="number"
                    value={
                      paymentData.billDiscountValue === 0
                        ? ""
                        : paymentData.billDiscountValue
                    }
                    onChange={(e) =>
                      paymentData.handleBillDiscountChange(e.target.value)
                    }
                    disabled={paymentData.billDiscountType === "none"}
                    className={`w-full px-3 py-2 pl-10 text-sm focus:outline-none focus:border-red-500 transition-colors ${
                      paymentData.billDiscountType === "none"
                        ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700"
                        : "bg-[#2A2929] text-white "
                    }`}
                    placeholder={
                      paymentData.billDiscountType === "none"
                        ? "ล็อกไว้"
                        : "0.00"
                    }
                  />
                </div>
                <button
                  type="button"
                  disabled={paymentData.billDiscountType === "none"}
                  onClick={() =>
                    paymentData.handleBillDiscountChange(
                      String(paymentData.billDiscountValue),
                    )
                  }
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
                <button
                  type="button"
                  onClick={() => {
                    paymentData.setBillDiscountType("none");
                    paymentData.setBillDiscountValue(0);
                  }}
                  className={`px-3 py-1 rounded-none transition-all cursor-pointer  ${paymentData.billDiscountType === "none" ? "bg-[#E51C23] text-white" : "text-[#D1D5DB] hover:text-zinc-200"}`}
                >
                  ต่อรายการ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    paymentData.setBillDiscountType("amount");
                    paymentData.setBillDiscountValue(0);
                  }}
                  className={`px-3 py-1 rounded-none transition-all cursor-pointer  ${paymentData.billDiscountType === "amount" ? "bg-[#E51C23] text-white" : "text-[#D1D5DB] hover:text-zinc-200"}`}
                >
                  บิลทั้งหมด (฿)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    paymentData.setBillDiscountType("percentage");
                    paymentData.setBillDiscountValue(0);
                  }}
                  className={`px-3 py-1 rounded-none transition-all cursor-pointer  ${paymentData.billDiscountType === "percentage" ? "bg-[#E51C23] text-white" : "text-[#D1D5DB] hover:text-zinc-200"}`}
                >
                  บิลทั้งหมด (%)
                </button>
              </div>

              <div className="bg-[#2D2C2C] p-2 text-[11px] leading-tight text-[#D1D5DB] max-w-[265px] text-left rounded-none">
                <span className="text-[#E51C23] mr-1 ">ⓘ</span>
                {paymentData.billDiscountType === "none" ? (
                  <span>
                    เลือกหน่วย (฿ / %) และระบุจำนวนส่วนลดที่ต้องการในแต่ละรายการสินค้า
                  </span>
                ) : (
                  <span>
                    ส่วนลดกำลังดำเนินการ: (ราคาสินค้า / ยอดรวม) *{" "}
                    <span className="text-white">
                      {paymentData.billDiscountValue
                        ? paymentData.billDiscountValue.toFixed(2)
                        : "0.00"}
                    </span>{" "}
                    {paymentData.billDiscountType === "percentage" ? "%" : "บาท"}{" "}
                    จะถูกหักตามสัดส่วน ดำเนินการต่อในรายการ
                  </span>
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
                    <td colSpan={8} className="py-8 text-center text-gray-400">
                      ยังไม่มีสินค้าในตะกร้า
                    </td>
                  </tr>
                ) : (
                  cartHook.cart.map((item, index) => {
                    const lineTotal = item.unit_price * item.qty;
                    const itemDiscount =
                      item.discount_type === "percentage"
                        ? (lineTotal * item.discount_value) / 100
                        : item.discount_value;
                    const subtotalAfterDiscount = lineTotal - itemDiscount;

                    let allocatedDiscount = 0;
                    if (
                      cartHook.totalItemPrice - cartHook.totalLineDiscount > 0 &&
                      paymentData.computedBillDiscount > 0
                    ) {
                      const weight =
                        subtotalAfterDiscount /
                        (cartHook.totalItemPrice - cartHook.totalLineDiscount);
                      allocatedDiscount =
                        Math.round(
                          paymentData.computedBillDiscount * weight * 100,
                        ) / 100;
                    }
                    const finalLineTotal =
                      subtotalAfterDiscount - allocatedDiscount;

                    return (
                      <tr key={index} className="hover:bg-gray-50/80 transition-colors">
                        {/* 🔗 [COLUMN 1]: SKU */}
                        <td className="py-4 px-4 text-xs text-[#1C1B1B]">
                          {item.product_code || "—"}
                        </td>

                        {/* 🔗 [COLUMN 2]: ชื่ออะไหล่ เปลี่ยนมาใช้ Component <Text> ทั้งหมด */}
                        <td className="py-4 px-4">
                          {/*  คลุมชื่อสินค้าหลักเป็นตัวหนังสือธรรมดา */}
                          <Text variant="body" className="text-[#1C1B1B] mb-0 ">
                            {item.product_name}
                          </Text>
                          {/*  ดีเทลย่อยปรับเป็น variant="small" */}
                          <Text variant="small" className="text-[11px] text-[#6B7280]  mt-0.5 mb-0">
                            PN: {item.part_number || "—"}
                          </Text>
                          {(item.grade_name || item.model_name) && (
                            <Text variant="small" className="text-[11px] text-[#6B7280] mt-1 inline-block py-0.5 rounded-sm mb-0">
                              เกรด: {item.grade_name || "ทั่วไป"} | รุ่นรถที่รองรับ: {item.model_name || "ทุกรุ่น"}
                            </Text>
                          )}
                        </td>

                        {/* [COLUMN 3]: หน่วยราคา */}
                        <td className="py-4 px-4 text-right text-[#1C1B1B]  ">
                          {item.unit_price.toFixed(2)}
                        </td>

                        {/* [COLUMN 4]: QTY */}
                        <td className="py-4 px-4 text-center">
                          <div className="inline-flex items-center border border-gray-300 rounded-none bg-[#F6F3F2]">
                            <button
                              type="button"
                              onClick={() => cartHook.updateQty(index, -1)}
                              className="p-1 px-2 cursor-pointer text-gray-600 hover:text-black"
                            >
                              <Minus size={12} />
                            </button>
                            
                            {/* ช่องกรอกตัวเลข */}
                            <input
                              type="number"
                              value={item.qty === 0 ? "" : item.qty}
                              onChange={(e) => {
                                cartHook.handleSetQuantity(index, e.target.value);
                              }}
                              onBlur={(e) => {
                                // เมื่อคลิกเมาส์ออกนอกช่อง ถ้าช่องว่างเปล่า หรือน้อยกว่า 1 ให้บังคับเป็น 1 ชิ้น
                                if (e.target.value === "" || parseInt(e.target.value, 10) < 1) {
                                  cartHook.handleSetQuantity(index, 1);
                                }
                              }}
                              className="w-10 text-center bg-transparent border-none focus:outline-none focus:ring-0 text-sm p-0 m-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              type="button"
                              onClick={() => cartHook.updateQty(index, 1)}
                              className="p-1 px-2 cursor-pointer text-gray-600 hover:text-black"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </td>

                        {/* [COLUMN 5]: Toggle */}
                        <td className="py-4 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={item.discount_type !== "none"}
                            className="accent-[#E51C23] h-4 w-4 cursor-pointer"
                            onChange={(e) =>
                              cartHook.handleDiscountToggle(index, e.target.checked)
                            }
                          />
                        </td>

                        {/* [COLUMN 6]: ตัวสลับหน่วยส่วนลด */}
                        <td className="py-4 px-4 text-center">
                          {item.discount_type !== "none" ? (
                            <div className="inline-flex bg-[#F6F3F2] p-0.5 rounded-none text-xs">
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

                        {/* [COLUMN 7]: ส่วนลดราคา */}
                        <td className="py-4 px-4 text-center">
                          {item.discount_type !== "none" ? (
                            <div className="flex flex-col items-center gap-1">
                              <div className="relative inline-flex items-center justify-center px-2 py-1 min-w-[75px] transition-all border bg-gray-100 text-gray-700 border-gray-300 rounded-none">
                                {item.discount_type === "amount" && item.discount_value > 0 && (
                                  <span className="mr-0.5 text-gray-500 select-none">-</span>
                                )}
                                <input
                                  type="number"
                                  step="any"
                                  value={item.discount_value === 0 ? "" : item.discount_value}
                                  placeholder="0"
                                  onChange={(e) => cartHook.handleDiscountValueChange(index, e.target.value)}
                                  className="w-12 bg-transparent text-center border-b window-fix outline-none focus:border-zinc-400"
                                />
                                {item.discount_type === "percentage" && (
                                  <span className="ml-0.5 text-gray-400 select-none">%</span>
                                )}
                              </div>
                              {itemDiscount + allocatedDiscount > 0 && (
                                <span className="text-[10px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded-sm block whitespace-nowrap mt-0.5">
                                  ถัวเฉลี่ยลด: -฿{(itemDiscount + allocatedDiscount).toFixed(2)}
                                </span>
                              )}
                            </div>
                          ) : allocatedDiscount > 0 ? (
                            <span className="text-[10px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded-sm inline-block whitespace-nowrap">
                              ถัวเฉลี่ยลด: -฿{allocatedDiscount.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        {/* [COLUMN 8]: LINE TOTAL */}
                        <td className="py-4 px-4 text-right pr-6 text-zinc-900 ">
                          <div className="flex justify-end items-center gap-3">
                            <div className="text-right">
                              {itemDiscount + allocatedDiscount > 0 && (
                                <span className="text-[11px] text-zinc-400 line-through block ">
                                  ฿{lineTotal.toFixed(2)}
                                </span>
                              )}
                              <span className="text-sm  text-zinc-950 block">
                                ฿{finalLineTotal.toFixed(2)}
                              </span>
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

        {/* 4. ช่องแสกนบาร์โค้ด */}
        <form onSubmit={cartHook.handleAddProduct} className="mt-6 flex gap-2">
          <div className="relative flex-1">
            <QrCode className="absolute left-4 top-3.5 text-gray-400" size={18} />
            <input
              type="text"
              value={cartHook.searchQuery}
              onChange={(e) => cartHook.setSearchQuery(e.target.value)}
              placeholder="สแกนบาร์โค้ดสินค้า หรือพิมพ์เลขบาร์โค้ดที่นี่เพื่อเพิ่มรายการ..."
              className="w-full bg-white border border-gray-200 rounded pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-red-500 shadow-sm"
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

      {/* ========================================================================= */}
      {/* ─── [โซนฝั่งขวา] : ข้อมูลลูกค้า และสรุปยอดเงิน ─── */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-[27%] bg-[#F6F3F2] p-6 flex flex-col justify-between shadow-2xl shrink-0 min-h-full">
        <div>
          <div className="mb-4">
            {/*  เปลี่ยนเป็น <Text variant="small"> */}
            <Text variant="small" className="text-gray-500 mb-2 uppercase tracking-wide">
              ข้อมูลลูกค้า
            </Text>

            {/* แผงปุ่มด่วนสำหรับสลับประเภทสิทธิ์ลูกค้า */}
            <div className="grid grid-cols-3 gap-1 mb-2">
              {paymentData.customerTypes.map((type) => {
                const isActive =
                  paymentData.customer && paymentData.customer.customer_type
                    ? paymentData.customer.customer_type.id === type.id
                    : paymentData.activeTypeId === type.id;
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
                    className={`flex flex-col items-center justify-center text-center transition-all h-10 leading-tight border text-xs ${isActive ? "bg-white border-zinc-400 text-zinc-900 shadow-sm" : "border-transparent text-gray-400 hover:text-gray-600"}`}
                  >
                    {type.type_label?.replace("ลูกค้า", "") || type.type_name}
                    <span className="text-[9px] block">
                      {subLabelMap[type.type_name] || type.type_name}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-1 mb-4">
              {["CASH", "CREDIT"].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    if (mode === "CREDIT") {
                      const currentActiveType = paymentData.customerTypes.find(
                        (t) => t.id === paymentData.activeTypeId,
                      );
                      if (currentActiveType?.type_name === "GENERAL")
                        return alert("ลูกค้าทั่วไปไม่สามารถเลือกโหมดเงินเชื่อได้");
                    }
                    paymentData.setSelectedPaymentType(mode as any);
                    paymentData.setPaymentMethodId(mode === "CASH" ? 1 : 3);
                  }}
                  className={`text-center py-1.5 border text-xs transition-all ${paymentData.selectedPaymentType === mode ? "bg-white border-zinc-400 text-zinc-900 shadow-sm" : "bg-gray-50 border-gray-200 text-gray-400"}`}
                >
                  {mode === "CASH" ? "เงินสด" : "เงินเชื่อ"}
                </button>
              ))}
            </div>

            <div className="relative w-full">
              <form onSubmit={paymentData.handleSearchCustomer} className="flex flex-col gap-1.5">            
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={paymentData.searchCustomerQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      paymentData.setSearchCustomerQuery(val);
                      if (val.trim().length > 0) {
                        paymentData.triggerLiveSearch(val);
                      } else {
                        if (typeof paymentData.setSearchResults === "function") {
                          paymentData.setSearchResults([]);
                        }
                      }
                    }}
                    className="flex-1 bg-white border border-gray-300 rounded-none px-3 py-2 text-xs shadow-sm focus:outline-none focus:border-[#E51C23] transition-colors text-black"
                    placeholder="พิมพ์ชื่ออู่, เบอร์โทรสมาชิก หรือพิมพ์ชื่อลูกค้าขาจร..."
                  />
                </div>

                <div className="flex gap-1">
                  <input
                    type="text"
                    value={paymentData.tempPhone} 
                    onChange={(e) => {
                      const newPhone = e.target.value;
                      paymentData.setTempPhone(newPhone);
                      if (paymentData.customer && paymentData.customer.id === 0) {
                        paymentData.setCustomer({
                          ...paymentData.customer,
                          phone_number: newPhone.trim() || "ลูกค้าทั่วไป (ไม่ระบุ)",
                        });
                      }
                    }}
                    className="flex-1 bg-white border border-gray-300 rounded-none px-3 py-2 text-xs shadow-sm focus:outline-none focus:border-[#E51C23] transition-colors text-black"
                    placeholder="ระบุเบอร์โทรติดต่อสำหรับส่งของ (เฉพาะลูกค้าขาจร)..."
                  />
                  <button
                    type="submit"
                    className="bg-zinc-900 text-white text-xs px-4 py-2 rounded-none shadow hover:bg-zinc-800 transition-colors whitespace-nowrap"
                  >
                    ล็อกชื่อ
                  </button>
                </div>
              </form>

              {paymentData.searchCustomerQuery.trim().length > 0 && paymentData.searchResults && paymentData.searchResults.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 shadow-xl max-h-60 overflow-y-auto z-50 rounded flex flex-col">
                  {paymentData.searchResults.map((cust) => (
                    <div
                      key={cust.id}
                      onClick={() => {
                        paymentData.setCustomer(cust);
                        paymentData.setSearchCustomerQuery(cust.customer_name);
                        if (cust.customer_type) {
                          paymentData.setActiveTypeId(cust.customer_type.id);
                          if (cust.customer_type.type_name === "GENERAL") {
                            paymentData.setSelectedPaymentType("CASH");
                            paymentData.setPaymentMethodId(1);
                          } else {
                            paymentData.setSelectedPaymentType("CREDIT");
                            paymentData.setPaymentMethodId(3);
                          }
                        }
                        if (typeof paymentData.setSearchResults === "function") {
                          paymentData.setSearchResults([]);
                        }
                      }}
                      className="px-3 py-2 text-xs text-zinc-800 hover:bg-zinc-100 cursor-pointer flex justify-between border-b border-gray-100 bg-white"
                    >
                      <span className="text-zinc-900">{cust.customer_name}</span>
                      <span className="text-zinc-500">{cust.phone_number || "ไม่มีเบอร์โทร"}</span>
                    </div>
                  ))}
                  <div
                    onClick={(e) => {
                      paymentData.handleSearchCustomer(e);
                      if (typeof paymentData.setSearchResults === "function") {
                        paymentData.setSearchResults([]);
                      }
                    }}
                    className="px-3 py-2.5 text-xs text-[#E51C23] bg-red-50 hover:bg-red-100 cursor-pointer text-center sticky bottom-0 border-t border-red-100 transition-colors"
                  >
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
              <Text variant="small" className="text-[#6B7280] mb-0">
                ราคารวมสินค้า
              </Text>
              <Text variant="muted" className="text-[#1C1B1B] mb-0">
                 ฿{cartHook.totalItemPrice.toFixed(2)}
              </Text>
            </div>
            
            <div className="flex justify-between">
              <Text variant="small" className="text-[#6B7280] mb-0">
                ส่วนลดท้ายบิล
              </Text>
              <Text variant="muted" className="text-[#1C1B1B] mb-0">
                ฿{paymentData.computedBillDiscount.toFixed(2)}
              </Text>
            </div>

            <div className="flex justify-between items-center text-[#E51C23] border-b border-dashed pb-2">
              <Text variant="small" className="text-[#E51C23] mb-0">
                ส่วนลดรวมทั้งสิ้น
              </Text>
              <Text variant="muted" className="text-[#E51C23] mb-0">
                ฿{(cartHook.totalLineDiscount + paymentData.computedBillDiscount).toFixed(2)}
              </Text>
            </div>
          </div>

          {/* ป้ายแสดงยอดชำระสุทธิป้ายใหญ่ */}
          <div className="bg-[#1C1B1B] p-5 my-5 flex justify-between items-center border border-zinc-800">
            <Text variant="small" className="text-[#9CA3AF] uppercase mb-0 tracking-wider">
              ยอดชำระสุทธิ
            </Text>
            <Text variant="muted" className="text-[#FFFFFF] text-2xl mb-0">
              ฿{paymentData.finalTotal.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </Text>
          </div>

          {/* ปุ่มกดเลือกวิธีการชำระเงิน */}
          {/*  เปลี่ยนเป็น <Text variant="small"> */}
          <Text variant="small" className="text-[#6B7280] uppercase">
            เลือกวิธีการชำระเงิน
          </Text>
          <div className="grid grid-cols-3 gap-2">
            {paymentData.paymentMethods.map((method) => (
              <button
                key={method.id}
                onClick={() => {
                  // เงื่อนไขล็อกเงินเชื่อของเดิม
                  if (method.id === 3) {
                    const currentActiveType = paymentData.customerTypes.find(
                      (t) => t.id === paymentData.activeTypeId,
                    );
                    if (!paymentData.customer && currentActiveType?.type_name === "GENERAL")
                      return alert("ลูกค้าทั่วไปไม่สามารถชำระด้วยเงินเชื่อได้");
                  }
                  paymentData.setPaymentMethodId(method.id);
                }}
                className={`flex flex-col items-center justify-center py-3 border text-xs transition-all ${
                  paymentData.paymentMethodId === method.id
                    ? "border-red-600 bg-white text-red-600 border-b-4 shadow-sm"
                    : "border-gray-200 bg-[#F9FAFB] text-gray-400 hover:text-zinc-600"
                }`}
              >
                {/*เรียกใช้ไอคอนตาม ID และดึงชื่อจาก Database */}
                {getPaymentIcon(method.id)} 
                <span>{method.method_name}</span>
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={(e) => {
            e.preventDefault();
            paymentData.handleOpenPaymentModal();
          }}
          variant="primary"
          size="lg"
          isLoading={paymentData.isSubmitting}
          className="w-full mt-6 py-4  text-xl bg-[#E51C23] hover:bg-red-700 text-white rounded-none"
        >
          ยืนยันการขาย
        </Button>

        {/* ================= PAYMENT MODAL ( ================= */}
        {paymentData.isPaymentModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-none">
            <div className="bg-white w-full max-w-xl rounded-none shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
              
              {/* Header */}
              <div className="bg-[#1C1B1B] px-6 py-4 flex justify-between items-center">
                <Text variant="lead" className="text-white mb-0 font-medium">
                  ชำระเงิน ({paymentData.paymentMethodId === 1 ? "เงินสด" : paymentData.paymentMethodId === 2 ? "QR CODE" : "เงินเชื่อ"})
                </Text>
                <button 
                  onClick={() => paymentData.setIsPaymentModalOpen(false)} 
                  className="text-[#9CA3AF] hover:text-white text-xl"
                >
                  ✕
                </button>
              </div>

              {/* 2. Body */}
              <div className="p-6 space-y-4">
                
                {/* ข้อมูลลูกค้า (ปรับให้เป็นกรอบขีดซ้าย) */}
                <div className="flex justify-between items-start border-l-3 border-[#5D3F3C] bg-[#F6F3F2]/50 pl-4 py-3 my-4">
                  <div className="text-xs">
                    <p className="text-[#1C1B1B] mb-0.5">ลูกค้า:</p>
                    <p className="text-[#1C1B1B] font-medium text-sm">{paymentData.customer?.customer_name || "ลูกค้าขาจร"}</p>
                  </div>
                  <div className="text-right text-xs mr-2">
                    <p className="text-[#1C1B1B] mb-0.5">ประเภท:</p>
                    <p className="text-[#E51C23] ">{paymentData.customer?.customer_type?.type_label || "ทั่วไป"}</p>
                  </div>
                </div>

                {/* ยอดสรุป (จัดวางเหมือนเดิม) */}
                <div className="bg-[#F6F3F2]/50 p-4 space-y-2  border border-[#E7BDB8]/50">
                  <div className="flex justify-between">
                    <Text variant="xs" className="text-[#1C1B1B]">ราคารวมสินค้า</Text>
                    <Text variant="xs" className="text-[#1C1B1B]">{paymentData.totalItemPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท </Text>
                  </div>

                  <div className="flex justify-between">
                    <Text variant="xs" className="text-[#1C1B1B]"> ส่วนลดท้ายบิล {paymentData.billDiscountType === 'percentage' ? `(${paymentData.billDiscountValue}%)` : ''} </Text>
                    <Text variant="xs" className="text-[#1C1B1B]">{paymentData.computedBillDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท </Text>
                  </div>

                  <div className="flex justify-between text-[#259B24]">
                    <span>ส่วนลดรวมทั้งสิ้น</span>
                    <span>-{(paymentData.totalItemPrice - paymentData.finalTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท</span>
                  </div>
                  <div className="flex justify-between font-bold text-base border-t pt-2 border-[#E7BDB8]/50">
                    <span>ยอดชำระสุทธิ</span>
                    <span>{paymentData.finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท</span>
                  </div>
                </div>

                {/* 3. ส่วนเนื้อหาเฉพาะ */}
                {paymentData.paymentMethodId === 1 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="border border-gray-200 p-4 bg-white"><p className="text-xs text-gray-500 uppercase">ยอดชำระสุทธิ</p><p className="text-2xl font-bold">{paymentData.finalTotal.toFixed(2)}</p></div>
                      <div className="border border-gray-200 p-4 bg-green-50"><p className="text-xs text-green-700 uppercase">ยอดเงินทอน</p><p className="text-2xl font-bold text-green-600">{Math.max(0, paymentData.receivedAmount - paymentData.finalTotal).toFixed(2)}</p></div>
                    </div>
                    <div>
                      <p className="text-sm mb-2">รับเงินมา</p>
                      <input type="number" className="w-full text-2xl font-bold border-b-2 outline-none p-1 border-gray-300 focus:border-red-600" value={paymentData.receivedAmount || ""} onChange={(e) => paymentData.setReceivedAmount(Number(e.target.value))} />
                    </div>
                  </div>
                )}

                {paymentData.paymentMethodId === 2 && (
                  <div className="flex flex-col items-center py-4">
                    <div className="w-48 h-48 border p-2 bg-gray-100 flex items-center justify-center">
                      <QrCode size={120} className="text-gray-400" /> 
                    </div>
                    <p className="mt-4 font-medium text-gray-700">บจก. พี.เค. อะไหล่ยนต์</p>
                    <p className="text-sm text-gray-500">สแกนเพื่อชำระเงินด้วย QR CODE</p>
                  </div>
                )}

                {paymentData.paymentMethodId === 3 && (
                  <div className="space-y-4">
                    <div className="bg-blue-50 p-4 border border-blue-200 rounded">
                      <p className="text-sm text-blue-800 font-medium">เครดิตคงเหลือ: <span className="font-bold text-lg">{paymentData.customer?.max_credit_limit?.toLocaleString() || "0"} บาท</span></p>
                    </div>
                    <div>
                      <p className="text-sm mb-2 font-medium">ระบุชื่อผู้รับของ / ผู้สั่งซื้อ</p>
                      <input type="text" className="w-full border-b border-gray-300 outline-none p-2 focus:border-red-600" placeholder="ระบุชื่อ..." value={paymentData.receiverName} onChange={(e) => paymentData.setReceiverName(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Footer */}
              <div className="flex p-6 gap-4 border-t bg-gray-50">
                <button onClick={() => paymentData.setIsPaymentModalOpen(false)} className="flex-1 py-3 bg-gray-200 font-medium rounded hover:bg-gray-300 transition-colors">ยกเลิก</button>
                <button onClick={() => paymentData.submitOrderToDatabase()} className="flex-1 py-3 bg-[#E51C23] text-white font-medium rounded hover:bg-red-700 transition-colors flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  ยืนยันและพิมพ์ใบเสร็จ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}