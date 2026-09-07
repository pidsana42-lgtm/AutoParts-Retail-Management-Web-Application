import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowRightFromLine, Check, ChevronRight, Loader2, Minus, Plus, ReceiptText, Search, Send, Banknote, QrCode, CreditCard } from "lucide-react";
// Components
import Badge from "../../../components/elements/badge";
import Button from "../../../components/elements/button";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/elements/card";
import Heading from "../../../components/elements/heading";
import Input from "../../../components/elements/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/elements/table";
import { useToast } from "../../../components/elements/toast";
import { ReasonSelector } from "./components/ReasonSelector";
import { ConditionSelector } from "./components/ConditionSelector";
// Hooks
import { useReturnSearch } from "./hooks/useReturnSearch";
// Interface
import type { SalesReturn, ReturnLineItem } from "../../../interface/return/return_interface";
// Service
import { returnService } from "../../../service/http/return/return_service";
// Utils
import { formatDateThai } from "../../../utils/formatdate";
import { usePathBasePrefix } from "../../../utils/usePathBasePrefix";

type RefundMethod = "CASH" | "TRANSFER" | "STORE_CREDIT";

const NewReturnPage: React.FC = () => {
  const navigate = useNavigate();
  const basePath = usePathBasePrefix();
  const { toast } = useToast();
  const isOwner = localStorage.getItem("role")?.toUpperCase() === "OWNER";
  const { keyword, searchResults, selectedOrder, isSearching, searchError, highlightedIndex, handleSearchInput, handleSelectOrder, handleSearchKeyDown, handleForceSearch } = useReturnSearch();
  const [step, setStep] = useState<1 | 2>(1);
  const [items, setItems] = useState<ReturnLineItem[]>([]);
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("CASH");
  const [note, setNote] = useState("");
  const [qtyDrafts, setQtyDrafts] = useState<{ [key: number]: string }>({});
  const [isSending, setIsSending] = useState(false);
  const selectedCustomerName = selectedOrder?.customer_name?.trim() || "ลูกค้าขาจร (ไม่ระบุชื่อ)";
  const hasRegisteredCustomer = selectedOrder?.customer_id != null;

  useEffect(() => {
    if (selectedOrder && !hasRegisteredCustomer && refundMethod === "STORE_CREDIT") {
      setRefundMethod("CASH");
    }
  }, [selectedOrder, hasRegisteredCustomer, refundMethod]);

  useEffect(() => {
    if (!selectedOrder) {
      setItems([]);
      setStep(1); 
      return;
    }
    setItems(
      selectedOrder.items.map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        product_code: item.product_code,
        purchasedQty: item.quantity, 
        unit_price: item.unit_price,
        checked: false, 
        returnQty: 0,   
        reason: "",
        condition: "", // ค่าว่างไว้กัน Error จาก Interface 
        reasons: Array(item.quantity).fill(""),
        conditions: Array(item.quantity).fill(""),
      }))
    );
  }, [selectedOrder]);

  useEffect(() => {
    if (!searchError) return;

    toast({
      title: "ค้นหาไม่สำเร็จ",
      message: searchError,
      variant: "error",
      duration: 4000,
    });
  }, [searchError, toast]);

  const handleToggleItem = (productId: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.product_id === productId
          ? {
              ...item,
              checked: !item.checked,
              returnQty: !item.checked ? Math.min(1, item.purchasedQty) : 0,
            }
          : item
      )
    );
  };

  const handleChangeQty = (productId: number, delta: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.product_id !== productId) return item;
        const minQty = item.checked ? 1 : 0; 
        const nextQty = Math.min(item.purchasedQty, Math.max(minQty, item.returnQty + delta));
        return { ...item, returnQty: nextQty };
      })
    );
  };

  const handleDetailChange = (productId: number, index: number, field: "reason" | "condition", value: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.product_id !== productId) return item;
        const newArray = field === "reason" ? [...item.reasons] : [...item.conditions];
        newArray[index] = value;
        return {
          ...item,
          [field === "reason" ? "reasons" : "conditions"]: newArray,
        };
      })
    );
  };

  const selectedItems = items.filter((item) => item.checked && item.returnQty > 0);
  const totalRefundAmount = selectedItems.reduce((sum, item) => sum + item.returnQty * item.unit_price, 0);
  const canProceedToStep2 = !!selectedOrder && selectedItems.length > 0;
  const allSelectedHaveDetails = selectedItems.every(item => 
    item.reasons.slice(0, item.returnQty).every(r => r && r.trim().length > 0) &&
    item.conditions.slice(0, item.returnQty).every(c => c && c.trim().length > 0)
  );
  const canSubmit = canProceedToStep2 && allSelectedHaveDetails && !!refundMethod && !isSending;

  const handleCancel = () => {
    const hasUnsavedChanges = !!selectedOrder || selectedItems.length > 0 || items.some(item => item.reasons.some(r => r.trim().length > 0));
    if (hasUnsavedChanges) {
      toast({
        title: "ละทิ้งการเปลี่ยนแปลง?",
        message: "ข้อมูลที่กรอกไว้จะไม่ถูกบันทึก",
        variant: "warning",
        duration: 6000,
        action: {
          label: "ยืนยันละทิ้งข้อมูล",
          onClick: () => navigate(`${basePath}/returns`),
        },
      });
      return;
    }
    navigate(`${basePath}/returns`);
  };

  const handleSendReturn = async () => {
    if (!selectedOrder || selectedItems.length === 0) return;
    setIsSending(true);
    
    try {
      const combinedReason = selectedItems.map(item => {
        if (item.returnQty === 1) {
          return `${item.product_name}: ${item.reasons[0].trim()} (${item.conditions[0]})`;
        }
        const details = Array.from({ length: item.returnQty }).map((_, i) => 
          `ชิ้นที่ ${i+1}: ${item.reasons[i].trim()} (${item.conditions[i]})`
        ).join(", ");
        return `${item.product_name}: ${details}`;
      }).join(" | ");

      const payload: SalesReturn = {
        original_order_id: selectedOrder.id,
        return_date: new Date().toISOString(),
        reason: combinedReason,
        note: note.trim() || undefined,
        refund_amount: totalRefundAmount,
        refund_method: refundMethod,
        requested_at: new Date().toISOString(),
        sales_return_items: selectedItems.map((item) => {
          let itemReason = "";
          if (item.returnQty === 1) {
            itemReason = `${item.reasons[0].trim()} [${item.conditions[0]}]`;
          } else {
            itemReason = Array.from({ length: item.returnQty }).map((_, i) => 
              `ชิ้นที่ ${i+1}: ${item.reasons[i].trim()} [${item.conditions[i]}]`
            ).join(", ");
          }

          return {
            product_id: item.product_id,
            product_name: item.product_name,
            product_code: item.product_code,
            quantity: item.returnQty,
            unit_price: item.unit_price,
            reason: itemReason, 
          };
        }),
      };
      
      const result = await returnService.createSalesReturn(payload);
      toast({
        title: "สำเร็จ",
        message: `${isOwner ? "อนุมัติการคืนสินค้าสำเร็จ" : "ส่งคำขออนุมัติการคืนสินค้าสำเร็จ"}${result?.return_number ? ` (อ้างอิงเลขที่ ${result.return_number})` : ""}`,
        variant: "success",
      });
      navigate(`${basePath}/returns`);
    } catch (err: any) {
      console.error("Submit Error:", err.response?.data || err);
      toast({
        title: "เกิดข้อผิดพลาด",
        message: isOwner ? 'อนุมัติไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' : 'ส่งคำขออนุมัติไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
        variant: "error",
        duration: 4000,
      });
      setTimeout(() => {
        navigate(`${basePath}/returns`);
      }, 4000);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="p-8 space-y-6 bg-white min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex-col space-y-2">
          <nav className="flex items-center text-sm text-gray-500 gap-2 font-light">
            <Link to={`${basePath}/returns`} className="hover:text-gray-900 transition-colors cursor-pointer">
              จัดการคืนสินค้า
            </Link>
            <ChevronRight size={16} className="text-gray-400" />
            <span className={step === 1 ? "text-black font-normal" : "text-gray-500 cursor-pointer hover:text-gray-900"} onClick={() => setStep(1)}>
              สร้างรายการคืนสินค้า
            </span>
            {step === 2 && (
              <>
                <ChevronRight size={16} className="text-gray-400" />
                <span className="text-black font-normal">สรุปและขออนุมัติ</span>
              </>
            )}
          </nav>
          <Heading level="h1" weight="semibold" className="m-0 text-black">
            {step === 1 ? "สร้างรายการคืนสินค้าใหม่" : "สรุปการคืนสินค้าและการคืนเงิน"}
          </Heading>
        </div>
        
        {/* ควบคุมปุ่มมุมขวาบนตาม Step */}
        <div className="flex items-end gap-4 justify-end">
          {step === 1 ? (
            <>
              <Button size="md" variant="tertiary" onClick={handleCancel}>
                ยกเลิก
              </Button>
              <Button size="md" variant="primary" disabled={!canProceedToStep2} onClick={() => setStep(2)}>
                <ArrowRightFromLine size={16} /> ขั้นตอนถัดไป
              </Button>
            </>
          ) : (
            <>
              <Button size="md" variant="tertiary" disabled={isSending} onClick={() => setStep(1)}>
                ย้อนกลับ
              </Button>
              <Button size="md" variant="primary" className="bg-[#d61c24] hover:bg-red-700" disabled={!canSubmit} onClick={handleSendReturn}>
                {isSending ? (
                  <><Loader2 size={16} className="animate-spin" /> {isOwner ? "กำลังอนุมัติการคืนสินค้า..." : "กำลังส่งอนุมัติ..."}</>
                ) : isOwner ? (
                  <><Check size={16} /> อนุมัติการคืนสินค้า</>
                ) : (
                  <><Send size={16} /> ส่งคำขออนุมัติ</>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* STEP 1: ค้นหาและเลือกสินค้า */}
      {step === 1 && (
        <>
          <Card className="flex-1">
            <CardContent>
              <div className="flex items-end gap-4">
                <div className="flex-1 relative">
                  <Input
                    label="ค้นหาใบเสร็จด้วยหมายเลขใบเสร็จหรือชื่อลูกค้า..."
                    leftIcon={<Search size={16} />}
                    placeholder="INV-XXXX-XXXX"
                    value={keyword}
                    onChange={(e) => handleSearchInput(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                  />
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-none shadow-lg overflow-hidden">
                      <ul className="max-h-60 overflow-y-auto divide-y divide-gray-100">
                        {searchResults.slice(0, 5).map((order, index) => (
                          <li key={order.id}>
                            <button
                              type="button"
                              onClick={() => handleSelectOrder(order)}
                              className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors cursor-pointer ${
                                index === highlightedIndex ? 'bg-gray-100' : 'hover:bg-gray-50'
                              }`}
                            >
                              <div>
                                <Heading level="h6" className="font-medium text-red-600 mb-0">{order.order_number}</Heading>
                                <Heading level="p" className="text-gray-700">ชื่อลูกค้า: {order.customer_name?.trim() || "ลูกค้าขาจร (ไม่ระบุชื่อ)"}</Heading>
                              </div>
                              <Heading level="p" className="text-gray-700">{formatDateThai(order.sold_at)}</Heading>
                            </button>
                          </li>
                        ))}
                      </ul>
                      {searchResults.length > 5 && (
                        <div className="bg-[#f4f4f4] p-2 text-center border-t border-gray-200">
                          <button type="button" className="text-[#d61c24] text-sm font-semibold hover:underline">
                            View all results
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <Button size="md" variant="tertiary" onClick={handleForceSearch} disabled={isSearching || !keyword.trim()} className="w-32">
                  {isSearching ? <Loader2 size={16} className="animate-spin" /> : "ค้นหา"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {!selectedOrder && !searchError && searchResults.length === 0 && (
            <Card className="flex-1">
              <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-gray-400">
                <ReceiptText size={40} strokeWidth={0.7} />
                <p className="text-sm">ค้นหาใบเสร็จด้วยหมายเลขใบเสร็จหรือชื่อลูกค้า เพื่อเริ่มสร้างรายการคืนสินค้า</p>
              </CardContent>
            </Card>
          )}

          {selectedOrder && (
            <>
              {/* ข้อมูลใบเสร็จ */}
              <div className="flex gap-6 items-stretch">
                <Card className="flex-1">
                  <CardHeader className="relative pb-4">
                    <div className="pr-40">
                      <CardTitle className="text-xl text-black">ข้อมูลใบเสร็จ</CardTitle>
                      <p className="mt-1 text-base text-gray-600">รายละเอียดสำหรับการคืนสินค้า</p>
                    </div>
                    <Badge variant="outline" size="lg" className="absolute right-6 top-6 border-gray-200 bg-gray-100 text-sm text-gray-700">
                      <span className="mr-2 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      ดำเนินการได้
                    </Badge>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="border-t border-t-gray-200 pt-4">
                      <div className="grid grid-cols-4 gap-8">
                        <div>
                          <Heading level="p" className="mb-0">เลขที่ใบเสร็จ</Heading>
                          <Heading level="h6" className="font-normal">{selectedOrder.order_number}</Heading>
                        </div>
                        <div>
                          <Heading level="p" className="mb-0">วันที่ซื้อ</Heading>
                          <Heading level="h6" className="font-normal">{formatDateThai(selectedOrder.sold_at)}</Heading>
                        </div>
                        <div>
                          <Heading level="p" className="mb-0">ลูกค้า</Heading>
                          <Heading level="h6" className="font-normal">{selectedCustomerName}</Heading>
                        </div>
                        <div>
                          <Heading level="p" className="mb-0">พนักงานขาย</Heading>
                          <Heading level="h6" className="font-normal">{selectedOrder.employee_name || "-"}</Heading>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* ตารางเลือกสินค้าที่จะคืน */}
              <Card className="overflow-visible" noPadding>
                <CardHeader className="flex flex-row items-center justify-between bg-[#f6f3f2]">
                  <CardTitle className="text-base font-normal text-gray-800">เลือกสินค้าที่ต้องการคืนเงิน</CardTitle>
                  <span className="text-base font-normal text-gray-800">พบ {items.length} รายการในใบเสร็จนี้</span>
                </CardHeader>
                <Table>
                  <TableHeader className="text-[#797878] bg-white">
                    <TableRow>
                      <TableHead className="text-center"></TableHead>
                      <TableHead className="text-left">ชื่อสินค้า</TableHead>
                      <TableHead className="text-center">จำนวนที่ซื้อ</TableHead>
                      <TableHead className="text-right">ราคาต่อหน่วย</TableHead>
                      <TableHead className="text-center">จำนวนที่คืน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-gray-400">
                          ไม่พบสินค้าที่สามารถคืนได้ในใบเสร็จนี้
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((row) => (
                        <TableRow key={row.product_id}>
                          <TableCell className="text-center">
                            <input
                              type="checkbox"
                              checked={row.checked}
                              onChange={() => handleToggleItem(row.product_id)}
                              className="w-4 h-4 accent-[#d61c24] cursor-pointer"
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <Heading level="h6" className="mb-0 font-medium">{row.product_name}</Heading>
                              <Heading level="p" className="text-gray-500">SKU: {row.product_code}</Heading>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{row.purchasedQty}</TableCell>
                          <TableCell className="text-right">
                            ฿ {row.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="inline-flex items-center border border-gray-300 rounded-none bg-[#F6F3F2] justify-center mx-auto">
                              <button
                                type="button"
                                disabled={!row.checked || row.returnQty <= 1}
                                onClick={() => {
                                  setQtyDrafts((prev) => {
                                    const next = { ...prev };
                                    delete next[row.product_id];
                                    return next;
                                  });
                                  handleChangeQty(row.product_id, -1);
                                }}
                                className={`p-1.5 px-2 transition-colors ${!row.checked || row.returnQty <= 1 ? "cursor-not-allowed opacity-50 text-gray-400" : "cursor-pointer text-gray-600 hover:text-black"}`}
                              >
                                <Minus size={14} />
                              </button>
                              <input
                                type="text"
                                inputMode="numeric"
                                disabled={!row.checked}
                                value={qtyDrafts[row.product_id] !== undefined ? qtyDrafts[row.product_id] : String(row.returnQty)}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  if (raw !== "" && !/^\d*$/.test(raw)) return; 
                                  setQtyDrafts((prev) => ({ ...prev, [row.product_id]: raw }));
                                }}
                                onBlur={() => {
                                  const raw = qtyDrafts[row.product_id];
                                  if (raw !== undefined) {
                                    const val = raw === "" ? 0 : parseInt(raw, 10);
                                    setItems((prev) =>
                                      prev.map((item) => {
                                        if (item.product_id !== row.product_id) return item;
                                        const minQty = item.checked ? 1 : 0;
                                        const finalQty = Math.min(item.purchasedQty, Math.max(minQty, val));
                                        return { ...item, returnQty: finalQty };
                                      })
                                    );
                                    setQtyDrafts((prev) => {
                                      const next = { ...prev };
                                      delete next[row.product_id];
                                      return next;
                                    });
                                  }
                                }}
                                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                                className={`w-10 text-center bg-transparent border-none focus:outline-none focus:ring-0 text-sm p-0 m-0 font-medium text-black [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${!row.checked ? "cursor-not-allowed text-gray-400" : ""}`}
                              />
                              <button
                                type="button"
                                disabled={!row.checked || row.returnQty >= row.purchasedQty}
                                onClick={() => {
                                  setQtyDrafts((prev) => {
                                    const next = { ...prev };
                                    delete next[row.product_id];
                                    return next;
                                  });
                                  handleChangeQty(row.product_id, 1);
                                }}
                                className={`p-1.5 px-2 transition-colors ${!row.checked || row.returnQty >= row.purchasedQty ? "cursor-not-allowed opacity-50 text-gray-400" : "cursor-pointer text-gray-600 hover:text-black"}`}
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </>
          )}
        </>
      )}

      {/* STEP 2: สรุปข้อมูลขออนุมัติ */}
      {step === 2 && (
        <div className="grid grid-cols-3 gap-6 items-start">
          <div className="col-span-2">
            <Card className="overflow-visible">
              <CardHeader className="border-b border-gray-100 pb-4">
                <CardTitle className="text-lg">รายการสินค้าที่เลือกคืน</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 divide-y divide-gray-100 overflow-visible">
                {selectedItems.map((item, index) => (
                  <div 
                    key={item.product_id} 
                    className="py-5 first:pt-2 last:pb-2 flex justify-between gap-6 relative"
                    style={{ zIndex: selectedItems.length - index }}
                  >
                    <div className="flex-1">
                      <Heading level="h6" className="font-semibold text-black">{item.product_name}</Heading>
                      <Heading level="p" className="text-gray-700 mt-1">SKU: {item.product_code}</Heading>
                      <div className="mt-3 flex items-center gap-4">
                        <Badge variant="outline" className="bg-[#f6f3f2] text-black px-3 py-1 text-sm border-none">
                          จำนวน: {item.returnQty}
                        </Badge>
                        <Badge variant="outline" className="bg-[#f6f3f2] text-black px-3 py-1 text-sm border-none min-w-40">
                          ราคา/หน่วย: ฿ {item.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-col space-y-4">
                      {Array.from({ length: item.returnQty }).map((_, i) => (
                        <div key={i} className="flex items-start gap-4">
                          {item.returnQty > 1 && (
                            <div className="pt-2">
                              <span className="text-sm font-medium text-black">
                                ชิ้นที่ {i + 1}
                              </span>
                            </div>
                          )}
                          <div className={`w-64 space-y-3 ${item.returnQty > 1 ? "p-3 bg-[#fafafa] border border-gray-100 rounded-none" : ""}`}>
                            <div>
                              <label className="block text-sm font-medium text-black mb-1">
                                เหตุผลการคืน <span className="text-red-500">*</span>
                              </label>
                              <ReasonSelector
                                value={item.reasons[i]}
                                onChange={(val) => handleDetailChange(item.product_id, i, "reason", val)}
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-black mb-1">
                                สภาพสินค้า <span className="text-red-500">*</span>
                              </label>
                              <ConditionSelector
                                value={item.conditions[i]}
                                onChange={(val) => handleDetailChange(item.product_id, i, "condition", val)}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
          <div className="col-span-1 space-y-6">
            <Card>
              <CardHeader className="border-b border-gray-100 pb-4">
                <CardTitle className="text-lg">ช่องทางการคืนเงิน</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <label className={`flex items-center justify-between p-3 border rounded-none cursor-pointer transition-colors ${refundMethod === 'CASH' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <div className="flex items-center gap-3">
                    <input 
                      type="radio" 
                      name="refundMethod" 
                      checked={refundMethod === 'CASH'} 
                      onChange={() => setRefundMethod('CASH')}
                      className="w-4 h-4 accent-[#d61c24]" 
                    />
                    <span className="text-sm font-medium text-gray-800">เงินสด (Cash)</span>
                  </div>
                  <Banknote size={18} className="text-gray-400" />
                </label>

                <label className={`flex items-center justify-between p-3 border rounded-none cursor-pointer transition-colors ${refundMethod === 'TRANSFER' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <div className="flex items-center gap-3">
                    <input 
                      type="radio" 
                      name="refundMethod" 
                      checked={refundMethod === 'TRANSFER'} 
                      onChange={() => setRefundMethod('TRANSFER')}
                      className="w-4 h-4 accent-[#d61c24]" 
                    />
                    <span className="text-sm font-medium text-gray-800">โอนเงิน (Transfer)</span>
                  </div>
                  <QrCode size={18} className="text-gray-400" />
                </label>

                <label className={`flex items-center justify-between p-3 border rounded-none transition-colors ${!hasRegisteredCustomer ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-60' : refundMethod === 'STORE_CREDIT' ? 'cursor-pointer border-red-500 bg-red-50' : 'cursor-pointer border-gray-200 hover:bg-gray-50'}`}>
                  <div className="flex items-center gap-3">
                    <input 
                      type="radio" 
                      name="refundMethod" 
                      checked={refundMethod === 'STORE_CREDIT'} 
                      onChange={() => setRefundMethod('STORE_CREDIT')}
                      disabled={!hasRegisteredCustomer}
                      className="w-4 h-4 accent-[#d61c24]" 
                    />
                    <span className="text-sm font-medium text-gray-800">เครดิต (Store Credit)</span>
                  </div>
                  <CreditCard size={18} className="text-gray-400" />
                </label>
                {!hasRegisteredCustomer && (
                  <p className="text-xs text-gray-500">ลูกค้าขาจรไม่มีบัญชีสำหรับเก็บเครดิต กรุณาคืนเป็นเงินสดหรือโอนเงิน</p>
                )}
              </CardContent>
            </Card>

            {/* สรุปยอด */}
            <Card>
              <CardHeader className="border-b border-gray-100 pb-4">
                <CardTitle className="text-lg">สรุปยอดเงินคืน</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">ยอดรวมสินค้า (Subtotal)</span>
                    <span className="font-medium text-gray-800">฿ {totalRefundAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-red-500">หักค่าธรรมเนียม (ถ้ามี)</span>
                    <span className="text-red-500">- ฿ 0.00</span>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4 mb-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="font-medium text-black">ยอดคืนเงินสุทธิ</p>
                      <p className="text-xs text-gray-700">(Total Refund)</p>
                    </div>
                    <p className="text-2xl font-bold text-[#d61c24]">
                      ฿ {totalRefundAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b border-gray-100 pb-4">
                <CardTitle className="text-lg">หมายเหตุเพิ่มเติม</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  maxLength={500}
                  placeholder="ระบุหมายเหตุเพิ่มเติมของใบคืนสินค้า (ถ้ามี)"
                  className="w-full resize-y rounded-none border border-gray-200 bg-[#f6f3f2] px-3 py-2 text-sm text-black placeholder:text-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
                <p className="mt-1 text-right text-xs text-gray-400">{note.length}/500</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewReturnPage;
