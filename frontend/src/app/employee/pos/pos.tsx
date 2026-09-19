"use client";

import React from "react";
import { useLocation, useSearchParams, useNavigate } from "react-router-dom";
import {Trash2, Percent, QrCode, CreditCard, Coins, Plus, Minus, Printer, ScanBarcode, Building2} from "lucide-react";
import Button from "../../../components/elements/button";
import { usePosPayment } from "./hooks/usepospayment";
import { usePosCart, findMatchedSupplier } from "./hooks/useposcart";
import type { POSProductSupplierInfo } from "../../../interface/pos/product_interface";
import { useDiscountCalculation } from "./hooks/useDiscountCalculation";
import { CustomerCard } from "./components/customercard";
import Text from "../../../components/elements/text";
import Badge from "../../../components/elements/badge";
import { TableHead, TableHeader, TableRow } from "../../../components/elements/table";
import Input from "../../../components/elements/input";
import { usePosSessionMeta } from "./hooks/usePosSessionMeta";
import {useCustomerFinancials} from "./hooks/useCustomerFinancials";
import Heading from "../../../components/elements/heading";
import ConfirmModal from "../../../components/elements/confirm_modal";
import { CashPaymentPad, PromptPayQRPanel } from "../../../components/pos";

export default function PosPage(): React.JSX.Element {
  // ─── STATE & HOOK SETUP ───
  const [customerForCart, setCustomerForCart] = React.useState<any>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pos_session");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return parsed.customer || null;
        } catch {
          return null;
        }
      }
    }
    return null;
  });
  const [activeTypeForCart, setActiveTypeForCart] = React.useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pos_session");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return parsed.activeTypeId || 1;
        } catch {
          return 1;
        }
      }
    }
    return 1;
  });
  const [isRecoverMode, setIsRecoverMode] = React.useState<boolean>(() => {
    return typeof window !== "undefined" && Boolean(localStorage.getItem("pos_recovered_order"));
  });
  const { formatDate, formatTime, currentStaff } = usePosSessionMeta();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const recoverHandlerRef = React.useRef<(id: number) => Promise<boolean>>(async () => false);

  // ระบบจัดการสินค้าในตะกร้า 
  const cartHook = usePosCart({
    customer: customerForCart,
    activeTypeId: activeTypeForCart,
    isRecoverMode,
    onRecoverCancelledOrder: (id) => recoverHandlerRef.current(id),
  });

  // ระบบจัดการข้อมูลลูกค้าและการชำระเงิน 
  const paymentData = usePosPayment({
    cart: cartHook.cart,
    setCart: cartHook.setCart,
    totalItemPrice: cartHook.totalItemPrice,
    totalLineDiscount: cartHook.totalLineDiscount,
  });

  React.useEffect(() => {
    recoverHandlerRef.current = paymentData.handleRecoverCancelledOrder;
  }, [paymentData.handleRecoverCancelledOrder]);

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

  // ซิงค์สถานะโหมดกู้คืนเมื่อมี recoveredOrderInfo
  React.useEffect(() => {
    if (paymentData.recoveredOrderInfo) {
      setIsRecoverMode(true);
    }
  }, [paymentData.recoveredOrderInfo]);

  const handleToggleRecoverMode = (checked: boolean) => {
    setIsRecoverMode(checked);
    if (!checked) {
      if (paymentData.recoveredOrderInfo) {
        paymentData.handleCancelRecovery();
      }
    }
  };

  // ตรวจจับ Order ID ที่ส่งต่อมาทาง URL Param หรือ Navigation State เพื่อกู้คืนบิลยกเลิกอัตโนมัติ
  React.useEffect(() => {
    const stateOrderId = (location.state as any)?.recoverOrderId;
    const queryOrderId = searchParams.get("recover_order_id");
    const targetOrderId = stateOrderId || (queryOrderId ? Number(queryOrderId) : null);

    if (targetOrderId) {
      setIsRecoverMode(true);
      paymentData.handleRecoverCancelledOrder(Number(targetOrderId));
      searchParams.delete("recover_order_id");
      setSearchParams(searchParams, { replace: true });
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, searchParams]);

  const isCompanyCustomer =
    paymentData.activeTypeId === 3 ||
    paymentData.customer?.customer_type?.id === 3 ||
    paymentData.customer?.customer_type?.type_name === "WHOLESALE";

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
          
          {/* 1. ส่วนหัวบิล (Header - ชื่อหน้าย่อ POS, สวิตช์โหมด & ปุ่มล้างตะกร้าทั้งหมด) */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <Heading level='h1' weight='semibold' className='m-0 text-black'>
                POS
              </Heading>
              <Heading level='h6' className='m-0 mt-1'>
                {isRecoverMode ? "เปิดบิลใหม่จากรายการเดิมที่ยกเลิก" : "รายการที่กำลังขาย"}
              </Heading>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Switch Toggle โหมดทำรายการจากบิลเก่าที่ยกเลิก */}
              

              {/* สถานะรายการขาย (ด้านบน) & ปุ่มล้างทั้งหมด (ด้านล่าง) */}
              <div className="flex flex-col items-end gap-1.5 text-right">
                <div className="hidden sm:block">
                   <Text variant="xs" className="text-[#6B7280] mb-0">
                    สถานะรายการขาย
                  </Text>
                  <h2 className="text-2xl text-zinc-800 ">
                    {paymentData.recoveredOrderInfo ? "เปิดบิลใหม่ (อ้างอิงบิลเดิม)" : "บิลร่าง (DRAFT)"}
                  </h2>
                </div>
                <Button
                  type="button"
                  onClick={() =>
                    cartHook.handleClearAllCart(() => {
                      paymentData.resetBillDiscount();
                      paymentData.resetPaymentState();
                    })
                  }
                  disabled={cartHook.cart.length === 0 && !paymentData.customer && !paymentData.recoveredOrderInfo}
                  className={`text-xs font-normal px-3 py-1.5 border cursor-pointer transition-all duration-200 ${
                    cartHook.cart.length === 0 && !paymentData.customer && !paymentData.recoveredOrderInfo
                      ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed select-none"
                      : "bg-[#E51C23] text-white border-[#E51C23] hover:bg-[#C62828] active:bg-[#B71C1C] shadow-sm"
                  }`}
                >
                  ล้างทั้งหมด
                </Button>
              </div>
            </div>
          </div>

          

          {/* --- ส่วนบนสุดของฝั่ง Cart --- */}
          <div className="space-y-4">

            {/* แถบแจ้งเตือนเมื่อกำลังอ้างอิงบิลยกเลิก */}
            {paymentData.recoveredOrderInfo && (
              <div className="flex items-center justify-between gap-2 text-xs text-[#6B7280] bg-[#F6F3F2] px-3.5 py-2 mb-3">
                <div className="flex items-center gap-2">
                  <span>
                    กำลังเปิดบิลใหม่โดยดึงข้อมูลจากบิลเดิม: <strong className="font-medium text-[#1C1B1A]">{paymentData.recoveredOrderInfo.orderNumber}</strong>
                    {customerName && ` (ลูกค้า: ${customerName})`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    paymentData.handleCancelRecovery();
                    cartHook.handleClearAllCart();
                  }}
                  className="text-[#E51C23] hover:underline font-normal cursor-pointer"
                >
                  ยกเลิกการอ้างอิง
                </button>
              </div>
            )}

            {/* ช่องแสกนบาร์โค้ด / ค้นหา (ช่องเดิมช่องเดียว สลับ Placeholder และผลลัพธ์ตาม Switch) */}
            <form onSubmit={cartHook.handleAddProduct} className="mt-2 flex gap-2 items-center">
              <div className="relative flex-1">
                <ScanBarcode className="absolute left-4 top-3.5 text-gray-400" size={18} />
                <input
                  type="text"
                  value={cartHook.searchQuery}
                  onChange={(e) => cartHook.setSearchQuery(e.target.value)}
                  onBlur={() => {
                    setTimeout(() => {
                      cartHook.setShowSuggestions(false);
                    }, 200);
                  }}
                  onFocus={() => {
                    if (cartHook.searchQuery.trim().length > 0) {
                      cartHook.setShowSuggestions(true);
                    }
                  }}
                  placeholder={
                    isRecoverMode
                      ? "สแกนบาร์โค้ด / INV-202X-XXX หรือ ชื่อลูกค้า..."
                      : "สแกนบาร์โค้ดสินค้า, พิมพ์เลขบาร์โค้ด, พิมพ์รหัสสินค้า, Part Number หรือชื่อสินค้าเพื่อเพิ่มรายการ..."
                  }
                  className="w-full bg-white border border-gray-200 rounded-none pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-red-500 shadow-sm"
                  autoFocus
                />

                {/* Dropdown ค้นหาด่วน (Autocomplete Suggestions) */}
                {cartHook.showSuggestions && (cartHook.suggestions.length > 0 || (isRecoverMode && cartHook.cancelledOrderSuggestions && cartHook.cancelledOrderSuggestions.length > 0)) && (
                  <div className="absolute left-0 right-0 top-full mt-0 bg-white border border-gray-200 shadow-xl z-50 max-h-80 overflow-y-auto divide-y divide-gray-100">
                    
                    {/* 1. ส่วนบิลยกเลิก (แสดงเฉพาะเมื่อเปิดโหมดกู้คืนบิล) */}
                    {isRecoverMode && cartHook.cancelledOrderSuggestions && cartHook.cancelledOrderSuggestions.length > 0 && (
                      <div>
                        <div className="bg-[#F6F3F2] px-3.5 py-1.5 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Text variant="xs" className="text-[#1C1B1B] font-light">พบบิลยกเลิก (คลิกเพื่อโหลดรายการเข้า POS)</Text>
                          </div>
                          <Text variant="xs" className="font-light text-[#1C1B1B]">
                            {cartHook.cancelledOrderSuggestions.length} รายการ
                          </Text>
                        </div>
                        {cartHook.cancelledOrderSuggestions.map((order) => (
                          <div
                            key={`cancelled-${order.id}`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              cartHook.handleSelectCancelledOrder(order);
                            }}
                            onClick={() => cartHook.handleSelectCancelledOrder(order)}
                            className="p-3 flex justify-between items-center bg-white hover:bg-gray-50 cursor-pointer transition-colors text-left "
                          >
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <Text variant="small" className="text-[#1C1B1B] mb-0 leading-tight">
                                  {order.order_number}
                                </Text>
                                <Badge variant="error" size="auto">
                                  บิลยกเลิก
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 font-light">
                                <Text variant="xs" className=" font-light text-[#6B7280] mb-0.5 mt-1 leading-tight">
                                  ลูกค้า: {order.customer_name || order.customer_name_temp || "ลูกค้าทั่วไป"} | ({order.cancel_reason})
                                </Text>
                                {/* {order.cancel_reason && (
                                  <Text variant="xs" className="text-[#854D0E] truncate max-w-xs">
                                    ({order.cancel_reason})
                                  </Text>
                                )} */}
                              </div>
                            </div>
                            <div className="text-right flex flex-col shrink-0 pl-4">
                              <Text variant="xs" className="text-[#E51C23] mb-0">
                                ฿{(order.total_amount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                              </Text>
                              <Text variant="xs" className="text-[10px] text-gray-600 font-light">
                                คลิกเพื่อดึงรายการ
                              </Text>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 2. ส่วนสินค้า */}
                    {cartHook.suggestions.length > 0 && (
                      <div>
                        {isRecoverMode && cartHook.cancelledOrderSuggestions && cartHook.cancelledOrderSuggestions.length > 0 && (
                          <div className="bg-[#F6F3F2] px-3.5 py-1.5 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Text variant="xs" className="text-[#1C1B1B] font-light">รายการสินค้า</Text>
                            </div>
                            <Text variant="xs" className="font-light text-[#1C1B1B]">
                              {cartHook.suggestions.length} รายการ
                            </Text>
                          </div>
                        )}
                        {cartHook.suggestions.flatMap((product) => {
                          // ค้นด้วยรหัสที่ตรงกับบริษัทไหนเจาะจง (เช่นแสกนบาร์โค้ด) -> โชว์แถวเดียวของเจ้านั้น
                          // ค้นแบบทั่วไปไม่เจาะจงบริษัท (เช่นชื่อ/รหัสสินค้ากลาง) -> แยกโชว์เป็นคนละแถวต่อบริษัทที่เกี่ยวข้อง
                          // ทั้งหมด เพราะเป็นสินค้าตัวเดียวกันแต่คนละล็อต กดเลือกแถวไหนก็ผูกการขายกับบริษัทนั้นไปเลย
                          // (product.suppliers ว่างเปล่า เช่นสินค้าที่ยังไม่เคยผูก Supliper ไหนเลย ให้เหลือแถวเดียวเฉยๆ)
                          const matchedSupplier = findMatchedSupplier(product, cartHook.searchQuery);
                          const supplierRows: (POSProductSupplierInfo | undefined)[] = matchedSupplier
                            ? [matchedSupplier]
                            : product.suppliers && product.suppliers.length > 0
                              ? product.suppliers
                              : [undefined];

                          return supplierRows.map((supplier, sIdx) => {
                            // แต่ละแถวคือคนละบริษัท (ถ้ารู้) จึงต้องอิงคงเหลือของบริษัทนั้นเอง ไม่ใช่ยอดรวมทั้งร้าน
                            const rowStock = supplier ? supplier.quantity : product.quantity ?? 0;
                            const isOutOfStock = rowStock <= 0;
                            const code = supplier ? supplier.barcode || supplier.variant_code || supplier.company_product_code : undefined;
                            return (
                              <div
                                key={`prod-${product.id}-${supplier?.supplier_id ?? "na"}-${sIdx}`}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  if (!isOutOfStock) {
                                    cartHook.handleSelectProduct(product, supplier);
                                  }
                                }}
                                onClick={() => {
                                  if (!isOutOfStock) {
                                    cartHook.handleSelectProduct(product, supplier);
                                  }
                                }}
                                className={`p-3 flex justify-between items-center transition-colors text-left ${
                                  isOutOfStock
                                    ? "opacity-50 bg-[#F9FAFB] cursor-not-allowed select-none"
                                    : "hover:bg-gray-50 cursor-pointer"
                                }`}
                              >
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                    <Text variant="small" className={`mb-0 leading-tight ${isOutOfStock ? "text-[#9CA3AF] font-light" : "text-[#1C1B1B]"}`}>
                                      {product.product_name}
                                    </Text>
                                    {isOutOfStock && (
                                      <Badge variant="neutral" size="auto" className="bg-[#FEE2E2] text-[#E51C23] border-none text-[10px] py-0.5 px-1.5 rounded-none font-normal">
                                        สินค้าหมด
                                      </Badge>
                                    )}
                                  </div>
                                  {!isOutOfStock && code && (
                                    <div className="mt-1">
                                      <Text
                                        variant="xs"
                                        title={supplier?.supplier_name}
                                        className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-none inline-block"
                                      >
                                        {code}
                                      </Text>
                                    </div>
                                  )}
                                  <Text variant="xs" className=" font-light text-[#6B7280] mb-0.5 mt-1 leading-tight">
                                    SKU: {product.product_code} | PN: {product.part_number || "-"}
                                  </Text>
                                </div>
                                <div className="text-right flex flex-col shrink-0 pl-4">
                                  <Text variant="xs" className={isOutOfStock ? "text-gray-400 font-light" : "text-[#E51C23]"}>
                                    ฿{(product.sale_price || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                                  </Text>
                                  <Text variant="xs" className={`text-[10px] ${isOutOfStock ? "text-[#E51C23] font-light" : "text-gray-600 font-light"}`}>
                                    {isOutOfStock ? "คงเหลือ 0 (หมด)" : `คงเหลือ: ${rowStock}`}
                                  </Text>
                                </div>
                              </div>
                            );
                          });
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button
                type="submit"
                className="bg-[#1C1B1B] text-white px-8 py-3 rounded-none text-sm hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
              >
                เพิ่มรายการ
              </button>

              {/* สวิตช์โหมดทำรายการจากบิลเก่าที่ยกเลิก ข้างปุ่มเพิ่มรายการ */}
              <div 
                onClick={() => handleToggleRecoverMode(!isRecoverMode)}
                className="flex items-center gap-2 px-3 py-2.5 bg-[#F6F3F2] border border-gray-200 rounded-none shrink-0 cursor-pointer select-none hover:bg-gray-100 transition-colors"
              >
                <Text variant="xs" className="text-[#1C1B1A] font-light whitespace-nowrap mb-0">
                  ทำรายการจากบิลเก่าที่ยกเลิก
                </Text>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isRecoverMode}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleRecoverMode(!isRecoverMode);
                  }}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                    isRecoverMode ? "bg-[#E51C23]" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      isRecoverMode ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
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
                    disabled={isCompanyCustomer || paymentData.billDiscountType === "none"}
                    className={`h-9 pl-9 text-sm rounded-none border transition-colors focus:outline-none ${
                      isCompanyCustomer || paymentData.billDiscountType === "none"
                        ? "bg-zinc-800! text-zinc-500 cursor-not-allowed border border-zinc-700"
                        : "bg-[#2A2929]! text-white "
                    }`}
                    placeholder={isCompanyCustomer ? "ไม่มีสิทธิ์ส่วนลด" : paymentData.billDiscountType === "none" ? "ล็อกไว้" : "0.00"}
                  />
                </div>
                <button
                  type="button"
                  disabled={isCompanyCustomer || paymentData.billDiscountType === "none"}
                  onClick={() => paymentData.handleBillDiscountChange(String(paymentData.billDiscountValue))}
                  className={`text-xs px-4 py-2.5 rounded-none shrink-0 transition-colors shadow-sm cursor-pointer ${
                    isCompanyCustomer || paymentData.billDiscountType === "none"
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
                  disabled={isCompanyCustomer}
                  onClick={() => { paymentData.updateSession("billDiscountType", "none"); paymentData.updateSession("billDiscountValue", 0);}}
                  className={`px-3 py-1 rounded-none transition-all cursor-pointer ${
                    isCompanyCustomer
                      ? "text-zinc-600 cursor-not-allowed"
                      : paymentData.billDiscountType === "none"
                      ? "bg-[#E51C23] text-white"
                      : "text-[#D1D5DB] hover:text-zinc-200"
                  }`}
                >
                  ต่อรายการ
                </button>
                <button
                  type="button"
                  disabled={isCompanyCustomer}
                  onClick={() => { paymentData.updateSession("billDiscountType", "amount"); paymentData.updateSession("billDiscountValue", 0);}}
                  className={`px-3 py-1 rounded-none transition-all cursor-pointer ${
                    isCompanyCustomer
                      ? "text-zinc-600 cursor-not-allowed"
                      : paymentData.billDiscountType === "amount"
                      ? "bg-[#E51C23] text-white"
                      : "text-[#D1D5DB] hover:text-zinc-200"
                  }`}
                >
                  บิลทั้งหมด (฿)
                </button>
                <button
                  type="button"
                  disabled={isCompanyCustomer}
                  onClick={() => { paymentData.updateSession("billDiscountType", "percentage"); paymentData.updateSession("billDiscountValue", 0);}}
                  className={`px-3 py-1 rounded-none transition-all cursor-pointer ${
                    isCompanyCustomer
                      ? "text-zinc-600 cursor-not-allowed"
                      : paymentData.billDiscountType === "percentage"
                      ? "bg-[#E51C23] text-white"
                      : "text-[#D1D5DB] hover:text-zinc-200"
                  }`}
                >
                  บิลทั้งหมด (%)
                </button>
              </div>
              <div className="bg-[#2D2C2C] p-2 text-[11px] leading-tight text-[#D1D5DB] max-w-66.25 text-left rounded-none">
                <span className="text-[#E51C23] mr-1 ">ⓘ</span>
                {isCompanyCustomer ? (
                  <span className="text-zinc-400">ลูกค้ากลุ่มบริษัทไม่ได้รับสิทธิ์ส่วนลดใดๆ ทั้งสิ้น</span>
                ) : paymentData.billDiscountType === "none" ? (
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
                          <div className="flex items-center gap-1.5">
                            <Text variant="body" className="text-[#1C1B1B] mb-0 ">{item.product_name}</Text>
                            {/* สินค้า 1 ชิ้นมาจากได้หลายบริษัท — ต้องรู้ว่าแถวนี้ตัดสต็อกจากบริษัทไหน (เจาะจงจากบาร์โค้ด/รหัสล็อตที่แสกน-เลือก) */}
                            {item.supplier_name && (
                              <span
                                title={`ตัดสต็อกจากบริษัท: ${item.supplier_name}`}
                                className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700"
                              >
                                <Building2 size={10} />
                                {item.supplier_name}
                              </span>
                            )}
                          </div>
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
                          <input
                            type="checkbox"
                            disabled={isCompanyCustomer}
                            checked={!isCompanyCustomer && item.discount_type !== "none"}
                            className={`accent-[#E51C23] h-4 w-4 ${isCompanyCustomer ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
                            title={isCompanyCustomer ? "ลูกค้ากลุ่มบริษัทไม่ได้รับสิทธิ์ส่วนลด" : "เปิด/ปิดส่วนลด"}
                            onChange={(e) => cartHook.handleDiscountToggle(index, e.target.checked)}
                          />
                        </td>
                        {/* column6 Discount Type */}
                        <td className="py-4 px-4 text-center">
                          {!isCompanyCustomer && item.discount_type !== "none" ? (
                            <div className="inline-flex bg-[#F6F3F2] p-0.5 rounded-none text-xs">
                              <button type="button" onClick={() => cartHook.handleDiscountTypeChange(index, "amount")} className={`px-2 py-1 transition-all cursor-pointer ${item.discount_type === "amount" ? "bg-[#E51C23] text-white" : "text-[#6B7280] hover:text-gray-600"}`}>฿</button>
                              <button type="button" onClick={() => cartHook.handleDiscountTypeChange(index, "percentage")} className={`px-2 py-1 transition-all cursor-pointer ${item.discount_type === "percentage" ? "bg-[#E51C23] text-white" : "text-[#6B7280] hover:text-gray-600"}`}>%</button>
                            </div>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        {/* column7 Discount Value */}
                        <td className="py-4 px-4 text-center">
                          {!isCompanyCustomer && item.discount_type !== "none" ? (
                            <div className="flex flex-col items-center gap-1">
                              <div className="relative inline-flex items-center justify-center px-2 py-1 min-w-18.75 transition-all border bg-gray-100 text-gray-700 border-gray-300 rounded-none">
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
          <Text variant="small" className="text-[#6B7280] mb-4 uppercase tracking-wide">
            ข้อมูลลูกค้า
          </Text>
          
          {/* เลือกประเภทลูกค้า */}
          <div className="grid grid-cols-3 gap-1 mb-2">
            {paymentData.customerTypes.map((type) => {
              const isActive =
                paymentData.posSession.customer && paymentData.posSession.customer.customer_type
                  ? paymentData.posSession.customer.customer_type.id === type.id
                  : paymentData.posSession.activeTypeId === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => {
                    paymentData.updateSession("activeTypeId", type.id);
                  }}
                  className={`flex flex-col items-center justify-center text-center transition-all h-10 leading-tight border text-xs ${
                    isActive
                      ? "bg-white border-zinc-400 text-zinc-900 shadow-sm"
                      : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {type.type_label?.replace("ลูกค้า", "") || type.type_name}
                  <span className="text-[9px] block">
                    {subLabelMap[type.type_name] || type.type_name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ฟอร์มค้นหาและคีย์ข้อมูลลูกค้า */}
          <div className="relative w-full">
            <form onSubmit={paymentData.handleSearchCustomer} className="flex flex-col gap-1.5">
              {/* ช่องค้นหาชื่อ/เบอร์ */}
              <input
                type="text"
                value={paymentData.posSession.searchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  paymentData.updateSession("searchQuery", val);
                  if (val.trim().length > 0) {
                    paymentData.triggerLiveSearch(val);
                  } else {
                    if (typeof paymentData.setSearchResults === "function") paymentData.setSearchResults([]);
                  }
                }}
                className="bg-white border border-gray-300 rounded-none px-3 py-2 text-xs shadow-sm focus:outline-none focus:border-[#E51C23] transition-colors text-black"
                placeholder="พิมพ์ชื่ออู่, เบอร์โทรสมาชิก หรือพิมพ์ชื่อลูกค้าขาจร..."
              />

              {/* ช่องกรอกเบอร์โทร (ปรับเป็นช่องเต็ม) */}
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
                className="bg-white border border-gray-300 rounded-none px-3 py-2 text-xs shadow-sm focus:outline-none focus:border-[#E51C23] transition-colors text-black"
                placeholder="ระบุเบอร์โทรติดต่อส่งของ..."
              />

              {/* ช่องกรอก/แสดงที่อยู่จัดส่ง + ปุ่มเลือกลูกค้า */}
              <div className="flex gap-1">
                <input
                  type="text"
                  value={paymentData.customerAddressTemp}
                  onChange={(e) => paymentData.handleAddressChange(e.target.value)}
                  className="flex-1 bg-white border border-gray-300 rounded-none px-3 py-2 text-xs shadow-sm mb-2 focus:outline-none focus:border-[#E51C23] transition-colors text-black"
                  placeholder="ระบุที่อยู่จัดส่ง/ออกใบเสร็จ (ไม่ระบุได้)..."
                />
                <button
                  type="submit"
                  className="bg-zinc-900 text-white text-xs px-4 py-2 rounded-none shadow mb-2 hover:bg-zinc-800 transition-colors whitespace-nowrap"
                >
                  เลือกลูกค้า
                </button>
              </div>
            </form>

            {/* Dropdown Live Search */}
            {paymentData.searchCustomerQuery.trim().length > 0 &&
              paymentData.searchResults &&
              paymentData.searchResults.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 shadow-xl max-h-60 overflow-y-auto z-50 rounded-none flex flex-col">
                  {paymentData.searchResults.map((cust) => {
                    const custAddr =
                      cust.shipping_address ||
                      cust.registered_address ||
                      (cust as any).display_address ||
                      (cust as any).address ||
                      "";

                    const handleSelectThisCustomer = () => {
                      paymentData.updateSession("customer", cust);
                      paymentData.updateSession("searchQuery", cust.customer_name);
                      paymentData.updateSession("customerAddressTemp", custAddr);
                      if (cust.customer_type) {
                        paymentData.updateSession("activeTypeId", cust.customer_type.id);
                        paymentData.setSelectedPaymentType(
                          cust.customer_type.type_name === "GENERAL" ? "CASH" : "CREDIT"
                        );
                        paymentData.updateSession("paymentMethodId", 1);
                      }
                      if (typeof paymentData.setSearchResults === "function")
                        paymentData.setSearchResults([]);
                    };

                    return (
                      <div
                        key={cust.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectThisCustomer();
                        }}
                        onClick={handleSelectThisCustomer}
                        className="px-3 py-2 text-xs text-zinc-800 hover:bg-zinc-100 cursor-pointer flex flex-col gap-0.5 border-b border-gray-100 bg-white"
                      >
                        <div className="flex justify-between font-medium">
                          <span className="text-zinc-900">{cust.customer_name}</span>
                          <span className="text-zinc-500">{cust.phone_number || "ไม่มีเบอร์โทร"}</span>
                        </div>
                        {custAddr ? (
                          <span className="text-[10px] text-gray-400 truncate">
                            {custAddr}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                  <div
                    onClick={(e) => {
                      paymentData.handleSearchCustomer(e);
                      if (typeof paymentData.setSearchResults === "function")
                        paymentData.setSearchResults([]);
                    }}
                    className="px-3 py-2.5 text-xs text-[#E51C23] bg-red-50 hover:bg-red-100 cursor-pointer text-center sticky bottom-0 border-t border-red-100 transition-colors"
                  >
                    ใช้ชื่อชั่วคราว: "{paymentData.searchCustomerQuery}" (ลูกค้าขาจร)
                  </div>
                </div>
              )}
          </div>

          {/* การ์ดสรุปข้อมูลลูกค้าที่เลือก */}
          <CustomerCard customer={paymentData.customer} address={paymentData.customerAddressTemp} />

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
              <Text variant="muted" className="text-[#E51C23] mb-0">
                ฿{(cartHook.totalLineDiscount + paymentData.computedBillDiscount).toFixed(2)}
              </Text>
            </div>
          </div>

          {/* สรุปยอดชำระสุทธิ */}
          <div className="bg-[#1C1B1B] p-5 my-5 flex justify-between items-center border border-zinc-800">
            <Text variant="small" className="text-[#9CA3AF] uppercase mb-0 tracking-wider">ยอดชำระสุทธิ</Text>
            <Text variant="muted" className="text-white text-2xl mb-0">
              ฿{paymentData.finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Text>
          </div>

          {/* เลือกวิธีการชำระเงิน */}
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
        <ConfirmModal
          isOpen={paymentData.isPaymentModalOpen}
          onClose={() => paymentData.closePaymentModal()}
          title={
            <Text variant="lead" className="text-white mb-0 font-medium">
              ชำระเงิน ({paymentData.paymentMethodId === 1 ? "เงินสด" : paymentData.paymentMethodId === 2 ? "QR CODE" : "เงินเชื่อ"})
            </Text>
          }
          className="max-w-xl bg-[#FCF9F8]"
          footer={
            <div className="flex w-full gap-4">
              <button 
                type="button" 
                disabled={paymentData.isConfirming || paymentData.isSubmitting}
                onClick={() => paymentData.setIsPaymentModalOpen(false)} 
                className="px-20 py-3 bg-[#E5E2E1] font-normal text-sm rounded-none hover:bg-[#E7E5E4] transition-colors disabled:opacity-50 cursor-pointer"
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
                className="flex-1 py-3 bg-[#E51C23] text-white font-normal text-sm hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:bg-gray-400 cursor-pointer"
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
          }
        >
          {/* 2. Body */}
          <div className="space-y-4">
                <div className="flex justify-between items-start border-l-3 border-[#5D3F3C] bg-[#F6F3F2] pl-4 py-3 my-4">
                  <div className="text-xs">
                    <p className="text-[#1C1B1B] mb-0.5">ลูกค้า:</p>
                    <Text variant="xs" className="text-[#1C1B1B] font-medium">
                      {paymentData.customer?.customer_name || "ลูกค้าขาจร"}
                    </Text>
                  </div>
                  <div className="text-right text-xs mr-2">
                    <p className="text-[#1C1B1B] mb-0.5">ประเภท:</p>
                    <Text variant="xs" className="text-[#E51C23]">
                      {paymentData.customer?.customer_type?.type_label || "ทั่วไป"}
                    </Text>
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
                  <CashPaymentPad
                    finalTotal={paymentData.finalTotal}
                    receivedAmount={paymentData.receivedAmount}
                    displayValue={paymentData.displayValue}
                    onReceivedAmountChange={paymentData.handleReceivedAmountChange}
                    onAddAmount={(amount) => {
                      const newTotal = paymentData.receivedAmount + amount;
                      paymentData.setReceivedAmount(newTotal);
                      paymentData.setDisplayValue(newTotal.toFixed(2));
                      paymentData.updateSession("receivedAmount", newTotal);
                    }}
                    onExactPayment={() => {
                      paymentData.setReceivedAmount(paymentData.finalTotal);
                      paymentData.setDisplayValue(paymentData.finalTotal.toFixed(2));
                      paymentData.updateSession("receivedAmount", paymentData.finalTotal);
                    }}
                    onBlur={() => {
                      paymentData.handleReceivedAmountBlur();
                      const formatted = paymentData.receivedAmount.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      });
                      paymentData.setDisplayValue(formatted);
                    }}
                    onFocus={paymentData.handleReceivedAmountFocus}
                    meta={{
                      date: formatDate,
                      time: formatTime,
                      staff: currentStaff,
                    }}
                  />
                )}

                {/* QR CODE พร้อมเพย์ */}
                {paymentData.paymentMethodId === 2 && (
                  <PromptPayQRPanel
                    finalTotal={paymentData.finalTotal}
                    qrCodeData={paymentData.qrCodeData}
                    isLoading={paymentData.isLoadingQR}
                    onRetry={async () => {
                      let targetOrderId = paymentData.currentOrderId || paymentData.posSession.currentOrderId;
                      if (!targetOrderId) {
                        targetOrderId = await paymentData.submitOrderToDatabase();
                      }
                      if (targetOrderId) {
                        paymentData.handleGeneratePromptPayQR(targetOrderId, 1);
                      }
                    }}
                    subtitle="พร้อมเพย์รับชำระเงิน"
                    meta={{
                      date: formatDate,
                      time: formatTime,
                      staff: currentStaff,
                    }}
                  />
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
                      {/* <Text variant="small" className="text-[#1C1B1B] font-medium">ชื่อผู้รับของ / ผู้สั่งซื้อ </Text> */}
                       {/* <div className="grid grid-cols-2 gap-4">
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
                        <div className="flex items-center justify-between w-full px-4 py-6 border-b border-[#E7BDB8]"></div>
                      </div>   */}
                      <div className="grid grid-cols-2 gap-4 border-t border-[#E7BDB8] pt-4 mt-4">
                        <div className="border-l-3 border-[#E7BDB8] p-4 mt-1 bg-[#F0EDEC] ">
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
        </ConfirmModal>
      </div>
    </div>
  );
}