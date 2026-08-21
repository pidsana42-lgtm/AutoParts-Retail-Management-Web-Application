"use client";

import React, { useRef, useEffect } from "react";
import {
  ScanBarcode,
  Coins,
  QrCode,
  CreditCard,
  Printer,
  RotateCcw,
  X,
  Loader2,
  RefreshCw,
} from "lucide-react";
import Text from "../../../components/elements/text";
import Heading from "../../../components/elements/heading";
import Input from "../../../components/elements/input";
import Button from "../../../components/elements/button";
import Badge from "../../../components/elements/badge";
import { formatDate } from "../../../utils/date";
import { Card } from "../../../components/elements/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../../../components/elements/table";
import { useSettleBills } from "./hooks/useSettleBills";
import { usePosSessionMeta } from "../pos/hooks/usePosSessionMeta";

export default function SettleBillsPage(): React.JSX.Element {
  const { formatDate: currentDateStr, formatTime, currentStaff } = usePosSessionMeta()
  const {
    searchQuery,
    setSearchQuery,
    customerId,
    setCustomerId,
    customerName,
    bills,
    filteredBills,
    selectedBillIds,
    setSelectedBillIds,
    isLoading,
    paymentMethodId,
    setPaymentMethodId,
    receivedAmount,
    setReceivedAmount,
    displayValue,
    setDisplayValue,
    isPaymentModalOpen,
    isSubmitting,
    totalSelectedDebt,
    totalPayAmount,
    remainingDebtAfterPay,
    customPayDisplay,
    getBillPayAmount,
    handleBillPayAmountChange,
    handleBillPayAmountBlur,
    handleSetFullAmount,
    handleToggleSelect,
    handleToggleSelectAll,
    handleOpenModal,
    handleCloseModal,
    handleFinalConfirm,
    searchSuggestions,
    triggerLiveSearch,
    handleSelectCustomer,
    handleSelectBill,
    handleSearchSubmit,
    singleBillMode,
    handleViewAllBillsOfCustomer,
    handleClearCustomer,
    qrCodeData,
    isLoadingQR,
    generateSettleQR,
  } = useSettleBills();

  const searchBoxRef = useRef<HTMLDivElement>(null);

  // ปิด Dropdown เมื่อกดคลิกนอกพื้นที่ช่องค้นหา
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        triggerLiveSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [triggerLiveSearch]);

  const getPaymentIcon = (id: number) => {
    switch (id) {
      case 1:
        return <Coins size={18} className="mb-1" />;
      case 2:
        return <QrCode size={18} className="mb-1" />;
      case 3:
        return <CreditCard size={18} className="mb-1" />;
      default:
        return <Coins size={18} className="mb-1" />;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row bg-white min-h-[calc(100vh-4rem)] text-gray-800 antialiased overflow-x-hidden">
      {/* ─── [โซนฝั่งซ้าย] : ตารางบิลหนี้คงค้าง ─── */}
      <div className="w-full lg:w-[73%] bg-white p-6 flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <Text variant="xs" className="text-[#E51C23] uppercase tracking-wider mb-0">
                จัดการบิลค้างชำระและตัดยอดหนี้ลูกค้า
              </Text>
              <Heading level="h1" weight="normal" className="mb-0 text-[#1C1B1B]">
                ชำระหนี้คงค้าง
              </Heading>
            </div>

            <div className="text-right flex flex-col items-end gap-1.5">
              <Text variant="xs" className="text-[#6B7280] mb-0">สถานะการเลือก</Text>
              <Heading level="h3" weight="normal" className="text-2xl text-zinc-800 mb-0">
                เลือกแล้ว {selectedBillIds.length} บิล
              </Heading>
              <Button
                type="button"
                size="sm"
                onClick={() => setSelectedBillIds([])}
                disabled={selectedBillIds.length === 0}
                className={`text-xs font-normal px-3 py-1.5 border cursor-pointer transition-all duration-200 ${
                  selectedBillIds.length === 0
                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed select-none"
                    : "bg-[#E51C23] text-white border-[#E51C23] hover:bg-[#C62828] active:bg-[#B71C1C] shadow-sm"
                }`}
              >
                ล้างการเลือก
              </Button>
            </div>
          </div>

          {/* ช่องค้นหาพร้อม Live Dropdown */}
          <div ref={searchBoxRef} className="relative mt-6 mb-6 flex gap-2">
            <div className="relative flex-1">
              <ScanBarcode className="absolute left-4 top-3.5 text-gray-400" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  triggerLiveSearch(val);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSearchSubmit();
                  }
                }}
                placeholder="พิมพ์ชื่อลูกค้า/อู่ (ขึ้นทุกบิล) หรือ สแกนบาร์โค้ด/พิมพ์เลขที่บิล (ขึ้นเฉพาะบิลนั้น)..."
                className="w-full bg-white border border-gray-200 rounded-none pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-red-500 shadow-sm"
                autoFocus
              />

              {/* Dropdown ค้นหาด่วน: แยกหมวดลูกค้า vs หมวดบิล */}
              {searchQuery.trim().length > 0 &&
                (searchSuggestions.customers.length > 0 || searchSuggestions.bills.length > 0) && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 shadow-2xl z-50 max-h-80 overflow-y-auto divide-y divide-gray-100">
                    {/* หมวดที่ 1: รายชื่อลูกค้า / อู่ */}
                    {searchSuggestions.customers.length > 0 && (
                      <div>
                        <div className="bg-gray-50 px-3 py-1.5 text-[11px] font-semibold text-gray-500 flex items-center gap-1.5 uppercase tracking-wider">
                          <span>👥 ลูกค้า / อู่ (คลิกเพื่อแสดงบิลเงินเชื่อทั้งหมดของลูกค้ารายนี้)</span>
                        </div>
                        {searchSuggestions.customers.map((cust) => (
                          <div
                            key={`cust-${cust.id}`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectCustomer(cust);
                            }}
                            onClick={() => handleSelectCustomer(cust)}
                            className="p-3 hover:bg-red-50/50 flex justify-between items-center cursor-pointer transition-colors text-left"
                          >
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <Text variant="small" className="text-[#1C1B1B] font-medium mb-0 leading-tight">
                                  {cust.customer_name}
                                </Text>
                                {cust.customer_type && (
                                  <Badge variant="neutral" className="text-[10px] py-0 px-1.5">
                                    {cust.customer_type}
                                  </Badge>
                                )}
                              </div>
                              {cust.phone_number && (
                                <Text variant="xs" className="text-[11px] text-[#6B7280] mb-0 mt-0.5">
                                  โทร: {cust.phone_number}
                                </Text>
                              )}
                            </div>
                            <div className="text-right flex flex-col shrink-0 pl-4">
                              <span className="text-xs text-[#E51C23] font-medium">
                                กดดูบิลค้างทั้งหมด →
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* หมวดที่ 2: บิลค้างชำระ / ใบเสร็จ */}
                    {searchSuggestions.bills.length > 0 && (
                      <div>
                        <div className="bg-gray-50 px-3 py-1.5 text-[11px] font-semibold text-gray-500 flex items-center gap-1.5 uppercase tracking-wider">
                          <span>📄 บิลค้างชำระ (คลิกเพื่อเปิดชำระเฉพาะบิลนี้)</span>
                        </div>
                        {searchSuggestions.bills.map((bill) => (
                          <div
                            key={`bill-${bill.order_id}`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectBill(bill);
                            }}
                            onClick={() => handleSelectBill(bill)}
                            className="p-3 hover:bg-red-50/50 flex justify-between items-center cursor-pointer transition-colors text-left"
                          >
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-semibold text-[#1C1B1B]">
                                  {bill.order_number}
                                </span>
                                <Badge variant="warning" className="text-[10px] py-0 px-1.5">
                                  {bill.payment_status === "partial" ? "แบ่งจ่าย" : "ยังไม่จ่าย"}
                                </Badge>
                              </div>
                              <Text variant="xs" className="text-[11px] text-[#6B7280] mb-0 mt-0.5 leading-tight">
                                ลูกค้า: {bill.customer_name}
                              </Text>
                            </div>
                            <div className="text-right flex flex-col shrink-0 pl-4">
                              <Text variant="xs" className="text-[#E51C23] font-medium">
                                ค้างชำระ ฿{bill.balance_due.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                              </Text>
                              <Text variant="xs" className="text-[10px] text-gray-400">
                                {bill.order_date ? new Date(bill.order_date).toLocaleDateString("th-TH") : "-"}
                              </Text>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
            </div>
            <button
              type="button"
              onClick={handleSearchSubmit}
              className="bg-[#1C1B1B] text-white px-8 py-3 rounded-none text-sm hover:bg-zinc-800 transition-colors cursor-pointer shrink-0 font-normal"
            >
              ค้นหา
            </button>
          </div>

          {/* แถบแจ้งเตือนเมื่ออยู่ในโหมดแสดงบิลเดียว */}
          {singleBillMode && bills.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3 mb-6 flex justify-between items-center">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-amber-800">โหมดชำระเฉพาะบิล:</span>
                <span>กำลังแสดงเฉพาะบิล <strong className="font-mono">{bills[0]?.order_number}</strong> ของลูกค้า <strong>{customerName || "—"}</strong></span>
              </div>
              {customerId && (
                <button
                  type="button"
                  onClick={handleViewAllBillsOfCustomer}
                  className="text-xs bg-white text-amber-900 border border-amber-300 hover:bg-amber-100 px-3 py-1.5 font-medium transition-colors cursor-pointer shadow-sm"
                >
                  🔄 แสดงบิลค้างชำระทั้งหมดของลูกค้ารายนี้
                </button>
              )}
            </div>
          )}

          {/* แถบแสดงลูกค้าที่เลือก (กรณีดูบิลทั้งหมด) */}
          {!singleBillMode && customerId && customerName && (
            <div className="bg-zinc-50 border border-zinc-200 text-[#1C1B1B] px-4 py-3 mb-6 flex justify-between items-center">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#6B7280]">ลูกค้าที่เลือก:</span>
                <strong className="text-sm text-[#1C1B1B] font-medium">{customerName}</strong>
                <span className="text-[#6B7280]">(พบ {bills.length} บิลค้างชำระ)</span>
              </div>
              <button
                type="button"
                onClick={handleClearCustomer}
                className="text-xs text-[#6B7280] hover:text-[#E51C23] transition-colors cursor-pointer"
              >
                ✕ เปลี่ยนลูกค้า
              </button>
            </div>
          )}

          {/* กล่องดำโหมดตัดยอดหนี้ */}
          <div className="bg-[#1C1B1B] text-gray-300 rounded-none p-4 mb-6 flex justify-between items-center border border-zinc-800 border-l-4 border-l-[#E51C23]">
            <div className="flex items-center gap-3">
              <RotateCcw size={18} className="text-[#E51C23]" />
              <div>
                <Text variant="small" className="text-white font-medium block mb-0">
                  โหมดตัดยอดหนี้เงินเชื่อ (รองรับการแบ่งจ่าย/จ่ายบางส่วน)
                </Text>
                <Text variant="xs" className="font-light text-gray-400 mb-0">
                  ติ๊กเลือกบิลที่ต้องการชำระ และสามารถกรอกยอดเงินที่ต้องการจ่ายในงวดนี้ของแต่ละบิลได้
                </Text>
              </div>
            </div>
          </div>

          {/* ตารางแสดงบิล */}
          <div className="bg-white rounded-none shadow-sm overflow-hidden border border-gray-200">
            <Table className="w-full min-w-0 table-fixed text-left border-collapse">
              <TableHeader className="bg-[#F6F3F2] rounded-none border-b border-gray-200 text-[11px] text-[#6B7280] uppercase tracking-wider">
                <TableRow>
                  <TableHead className="py-3 px-3 text-center w-[5%]">
                    <input
                      type="checkbox"
                      checked={selectedBillIds.length === filteredBills.length && filteredBills.length > 0}
                      onChange={handleToggleSelectAll}
                      disabled={filteredBills.length === 0}
                      className="w-4 h-4 border border-gray-300 rounded-none bg-white checked:bg-[#E51C23] checked:border-[#E51C23] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 appearance-none flex items-center justify-center after:content-['✓'] after:text-white after:text-[10px] after:font-bold after:hidden checked:after:block mx-auto"
                    />
                  </TableHead>
                  <TableHead className="py-3 px-3 text-left w-[15%] font-normal text-[#6B7280]">เลขที่คำสั่งซื้อ</TableHead>
                  <TableHead className="py-3 px-3 text-left w-[12%] font-normal text-[#6B7280]">วันที่ทำรายการ</TableHead>
                  <TableHead className="py-3 px-3 text-left w-[18%] font-normal text-[#6B7280]">ชื่อลูกค้า/อู่</TableHead>
                  <TableHead className="py-3 px-3 text-right w-[12%] font-normal text-[#6B7280]">ยอดรวมทั้งบิล</TableHead>
                  <TableHead className="py-3 px-3 text-right w-[14%] font-normal text-[#6B7280]">ค้างชำระ</TableHead>
                  <TableHead className="py-3 px-3 text-right w-[25%] font-normal text-[#E51C23]">ยอดชำระงวดนี้ (฿)</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-100 text-sm">
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-gray-400">
                      กำลังโหลดข้อมูลบิลค้างชำระ...
                    </TableCell>
                  </TableRow>
                ) : filteredBills.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-gray-400">
                      {customerName
                        ? `ไม่พบรายการบิลค้างชำระของลูกค้า "${customerName}"`
                        : "กรุณาค้นหาและเลือกลูกค้าหรือบิลเพื่อทำรายการ"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBills.map((bill) => {
                    const isSelected = selectedBillIds.includes(bill.order_id);
                    const currentPayAmt = getBillPayAmount(bill);
                    const remainingBalance = bill.balance_due - currentPayAmt;
                    const isOverBalance = currentPayAmt > bill.balance_due;

                    return (
                      <TableRow
                        key={bill.order_id}
                        onClick={() => handleToggleSelect(bill.order_id)}
                        className={`cursor-pointer transition-colors ${isSelected ? "bg-red-50/40" : "hover:bg-gray-50/80"}`}
                      >

                        {/* checkbox */}
                        <TableCell className="py-4 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(bill.order_id)}
                            className="w-4 h-4 border border-gray-300 rounded-none bg-white checked:bg-[#E51C23] checked:border-[#E51C23] cursor-pointer appearance-none flex items-center justify-center after:content-['✓'] after:text-white after:text-[10px] after:font-bold after:hidden checked:after:block mx-auto"
                          />
                        </TableCell>

                        {/* หมายเลขคำสั่งซื้อ */}
                        <TableCell className="py-4 px-3 text-left">
                          <Text variant="small" className="font-normal text-[#1C1B1B] mb-0">{bill.order_number}</Text>
                        </TableCell>

                        {/* วันที่สั่งซื้อ */}
                        <TableCell className="py-4 px-3 text-left">
                          <Text variant="xs" className="font-light text-[#5B5B5B] mb-0">
                            {formatDate(bill.order_date || bill.created_at || "")}
                          </Text>
                        </TableCell>

                        {/* ชื่อลูกค้า + หมายเลขโทรศัพท์ + ประเภทลูกค้า */}
                        <TableCell className="py-4 px-3 text-left">
                          <Text variant="small" className="font-normal text-[#1C1B1B] mb-0 truncate">{customerName}</Text>
                          <Text variant="xs" className="font-light text-[#A8A29E] mb-0">{bill.phone_number || "-"}</Text>
                          {bill.customer_type && (
                            <Text variant="xs" className="font-light text-[#A8A29E] mb-0">ประเภท: {bill.customer_type}</Text>
                          )}
                        </TableCell>

                        {/* จำนวนเงินทั้งหมด */}
                        <TableCell className="py-4 px-3 text-right">
                          <Text variant="small" className="font-normal text-[#1C1B1B] mb-0">
                            {bill.total_amount?.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                          </Text>
                        </TableCell>

                        {/* ยอดค้างชำระ */}
                        <TableCell className="py-4 px-3 text-right">
                          <Text variant="small" className="font-normal text-[#E51C23] mb-0">
                            {bill.balance_due?.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                          </Text>
                        </TableCell>

                        {/* ช่องกรอกยอดชำระ */}
                        <TableCell className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                          {isSelected ? (
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex items-center gap-1.5 justify-end w-full">
                                <div className="relative flex-1 max-w-[140px]">
                                  <span className="absolute left-2.5 top-1.5 text-xs text-gray-400 font-medium">฿</span>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={
                                      customPayDisplay[bill.order_id] !== undefined
                                        ? customPayDisplay[bill.order_id]
                                        : bill.balance_due.toFixed(2)
                                    }
                                    onChange={(e) => handleBillPayAmountChange(bill.order_id, e.target.value)}
                                    onBlur={() => handleBillPayAmountBlur(bill.order_id, bill.balance_due)}
                                    className={`w-full text-right bg-white border ${
                                      isOverBalance ? "border-red-500 text-red-600" : "border-red-300 focus:border-red-500"
                                    } focus:ring-1 focus:ring-red-500 rounded-none pl-6 pr-2 py-1 text-sm font-semibold text-[#1C1B1B] shadow-inner focus:outline-none`}
                                    placeholder={bill.balance_due.toFixed(2)}
                                  />
                                </div>
                                <button
                                  type="button"
                                  title="จ่ายเต็มจำนวนยอดค้างชำระ"
                                  onClick={() => handleSetFullAmount(bill.order_id, bill.balance_due)}
                                  className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-[#1C1B1B] text-[11px] font-normal border border-gray-300 rounded-none transition-colors whitespace-nowrap cursor-pointer"
                                >
                                  เต็ม
                                </button>
                              </div>

                              {/* ป้ายเตือนสถานะคงเหลือ / เกินยอด */}
                              {isOverBalance ? (
                                <span className="text-[10px] text-red-600 font-medium leading-none">
                                  ⚠️ เกินยอดหนี้ค้างชำระ
                                </span>
                              ) : remainingBalance > 0 ? (
                                <span className="text-[10px] text-amber-700 font-normal leading-none">
                                  คงเหลือ ฿{remainingBalance.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                                </span>
                              ) : (
                                <span className="text-[10px] text-emerald-600 font-normal leading-none">
                                  ✓ จ่ายเต็มยอด
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-end">
                              <Text variant="small" className="font-normal text-gray-400 mb-0">
                                ฿{bill.balance_due?.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                              </Text>
                              <span className="text-[10px] text-gray-400">(ยังไม่เลือก)</span>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* ─── [โซนฝั่งขวา] : สรุปยอด และช่องทางการรับชำระ ─── */}
      <div className="w-full lg:w-[27%] bg-[#F6F3F2] p-6 flex flex-col justify-between shadow-2xl shrink-0 min-h-full">
        <div>
          <Text variant="small" className="text-gray-500 mb-4 uppercase tracking-wide">
            สรุปการตัดยอดหนี้
          </Text>

          <Card className="bg-white p-4 border border-gray-200 shadow-none mb-4 space-y-2 rounded-none">
            <div className="flex justify-between items-center text-xs">
              <Text variant="xs" className="text-[#6B7280] mb-0">จำนวนบิลที่เลือก:</Text>
              <Text variant="xs" className="font-normal text-[#1C1B1B] mb-0">{selectedBillIds.length} รายการ</Text>
            </div>
            <div className="flex justify-between items-center text-xs">
              <Text variant="xs" className="text-[#6B7280] mb-0">ลูกค้า:</Text>
              <Text variant="xs" className="font-normal text-[#1C1B1B] truncate max-w-[150px] mb-0">
                {customerName || "—"}
              </Text>
            </div>
          </Card>

          <div className="space-y-3 pt-2">
            <div className="flex justify-between">
              <Text variant="small" className="text-[#6B7280] mb-0">ยอดหนี้รวมที่เลือก</Text>
              <Text variant="muted" className="text-[#1C1B1B] mb-0">
                ฿{totalSelectedDebt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
            </div>
            <div className="flex justify-between items-center text-[#E51C23]">
              <Text variant="small" className="text-[#E51C23] font-medium mb-0">ยอดตัดชำระงวดนี้</Text>
              <Text variant="muted" className="text-[#E51C23] font-semibold mb-0">
                ฿{totalPayAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
            </div>
            {remainingDebtAfterPay > 0 && (
              <div className="flex justify-between items-center text-xs text-amber-700 bg-amber-50 px-2 py-1.5 border border-amber-200">
                <span>หนี้คงเหลือหลังตัดยอด:</span>
                <span className="font-medium">
                  ฿{remainingDebtAfterPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>

          <div className="bg-[#1C1B1B] p-5 my-5 flex justify-between items-center border border-zinc-800">
            <Text variant="small" className="text-[#9CA3AF] uppercase mb-0 tracking-wider">ยอดรับชำระสุทธิ</Text>
            <Text variant="muted" className="text-[#FFFFFF] text-2xl mb-0 font-semibold">
              ฿{totalPayAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Text>
          </div>

          <Text variant="small" className="text-[#6B7280] uppercase">
            เลือกช่องทางรับเงิน
          </Text>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 1, name: "เงินสด" },
              { id: 2, name: "QR CODE" },
            ].map((method) => {
              const isSelected = paymentMethodId === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setPaymentMethodId(method.id)}
                  className={`flex flex-col items-center justify-center py-3 border text-xs transition-all cursor-pointer ${
                    isSelected
                      ? "border-red-600 bg-white text-red-600 border-b-4 shadow-sm"
                      : "border-gray-200 bg-[#F9FAFB] text-gray-400 hover:text-zinc-600"
                  }`}
                >
                  {getPaymentIcon(method.id)}
                  <span>{method.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <Button
          onClick={handleOpenModal}
          disabled={selectedBillIds.length === 0 || totalPayAmount <= 0}
          variant="primary"
          size="lg"
          className="w-full mt-6 py-4 text-xl bg-[#E51C23] hover:bg-red-700 text-white rounded-none disabled:bg-gray-300 disabled:cursor-not-allowed cursor-pointer"
        >
          รับชำระเงิน ({selectedBillIds.length} บิล | ฿{totalPayAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })})
        </Button>

        {/* ================= PAYMENT MODAL ================= */}
        {isPaymentModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-none">
            <div className="bg-[#FCF9F8] w-full max-w-xl rounded-none shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
              
              {/* Header */}
              <div className="bg-[#1C1B1B] px-6 py-4 flex justify-between items-center">
                <Text variant="lead" className="text-white mb-0 font-medium">
                  รับชำระหนี้ ({paymentMethodId === 1 ? "เงินสด" : "QR CODE"})
                </Text>
                <button type="button" onClick={handleCloseModal} className="text-[#9CA3AF] hover:text-white text-xl cursor-pointer">
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-start border-l-3 border-[#5D3F3C] bg-[#F6F3F2] pl-4 py-3 my-2">
                  <div className="text-xs">
                    <Text variant="xs" className="text-[#1C1B1B] mb-0.5">ลูกค้า / อู่:</Text>
                    <Text variant="small" className="text-[#1C1B1B] font-medium mb-0">{customerName || "ลูกค้าทั่วไป"}</Text>
                  </div>
                  <div className="text-right text-xs mr-2">
                    <Text variant="xs" className="text-[#1C1B1B] mb-0.5">รายการบิลที่เลือก:</Text>
                    <Text variant="xs" className="text-[#E51C23] font-medium mb-0">{selectedBillIds.length} บิลค้างชำระ</Text>
                    {remainingDebtAfterPay > 0 && (
                      <Text variant="xs" className="text-amber-700 text-[11px] mb-0">
                        (แบ่งจ่าย / เหลือค้าง ฿{remainingDebtAfterPay.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                      </Text>
                    )}
                  </div>
                </div>

                {/* ---------------- 1. เงินสด ---------------- */}
                {paymentMethodId === 1 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="border-l-3 border-[#E51C23] p-4 bg-[#F0EDEC]">
                        <Text variant="xs" className="text-[#5F5E5E] mb-0">ยอดชำระสุทธิงวดนี้</Text>
                        <div className="flex justify-between items-baseline mt-2">
                          <Text variant="fourxl">{totalPayAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                          <Text variant="xs" className="text-[#1C1B1B] mb-0">บาท</Text>
                        </div>
                      </div>
                      <div className="border-l-3 border-[#006E0A] p-4 bg-[#86F976]/20">
                        <Text variant="xs" className="text-[#259B24] mb-0">ยอดเงินทอน</Text>
                        <div className="flex justify-between items-baseline mt-2">
                          <Text variant="fourxl" className={`text-[#259B24] truncate ${Math.max(0, receivedAmount - totalPayAmount) > 999999 ? "text-2xl" : "text-4xl"}`}>
                            {Math.max(0, receivedAmount - totalPayAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Text>
                          <Text variant="xs" className="text-[#259B24] mb-0">บาท</Text>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Text variant="small" className="text-[#1C1B1B] font-medium mb-0">รับเงินมา</Text>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-baseline justify-between w-full px-4 py-4 bg-white border-b-2 border-[#E7BDB8]">
                          <Input
                            type="text"
                            inputMode="decimal"
                            className="w-full text-4xl text-[#1C1B1B] font-semibold bg-transparent border-none focus:outline-none [appearance:textfield]"
                            value={displayValue || ""}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value.replace(/,/g, "")) || 0;
                              setReceivedAmount(val);
                              setDisplayValue(e.target.value);
                            }}
                            onBlur={() => {
                              const formatted = receivedAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                              setDisplayValue(formatted);
                            }}
                            placeholder="0.00"
                          />
                          <Text variant="xs" className="text-[#1C1B1B] ml-2 font-medium mb-0">บาท</Text>
                        </div>
                        <div className="flex items-center justify-between w-full px-4 py-6 border-b-1 border-[#E7BDB8]"></div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {/* ปุ่มเพิ่มเงินด่วน */}
                        <div className="grid grid-cols-3 gap-2 mt-4">
                          {[10, 20, 50, 100, 500, 1000].map((amount) => (
                            <button
                              key={amount}
                              type="button"
                              onClick={() => {
                                const newTotal = receivedAmount + amount;
                                setReceivedAmount(newTotal);
                                setDisplayValue(newTotal.toFixed(2));
                              }}
                              className="flex items-center justify-center px-2 py-3 bg-[#E5E2E1] rounded-none text-xs font-medium text-[#1C1B1B] hover:bg-[#D9D9D9] transition-all truncate cursor-pointer"
                            >
                              +{amount}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              setReceivedAmount(totalPayAmount);
                              setDisplayValue(totalPayAmount.toFixed(2));
                            }}
                            className="col-span-3 py-2 bg-zinc-800 text-white hover:bg-zinc-900 text-xs font-medium rounded-none transition-colors cursor-pointer"
                          >
                            จ่ายพอดี (฿{totalPayAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                          </button>
                        </div>

                        {/* รายละเอียดวันที่ / เวลา / ผู้ดำเนินการ */}
                        <div className="mt-4 space-y-1">
                          <div className="flex justify-between items-center">
                            <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2 mb-0">วันที่</Text>
                            <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2">{currentDateStr}</Text>
                          </div>
                          <div className="flex justify-between items-center">
                            <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2 mb-0">เวลา</Text>
                            <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2 mb-0">{formatTime}</Text>
                          </div>
                          <div className="flex justify-between items-center">
                            <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2 mb-0">ผู้ดำเนินการ</Text>
                            <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2 mb-0">{currentStaff}</Text>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ---------------- 2. QR CODE (PromptPay Real Gen) ---------------- */}
                {paymentMethodId === 2 && (
                  <div className="bg-white p-6 border border-[#E7BDB8]/50">
                    <div className="grid grid-cols-2 gap-4">
                      {/* กรอบรูป QR Code จริง */}
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="relative w-52 h-52 p-2 border border-gray-200 flex items-center justify-center bg-white shadow-inner">
                          {isLoadingQR ? (
                            <div className="flex flex-col items-center justify-center space-y-2">
                              <Loader2 size={36} className="animate-spin text-[#E51C23]" />
                              <span className="text-xs text-gray-500">กำลังสร้าง QR Code...</span>
                            </div>
                          ) : qrCodeData?.qrCode ? (
                            <img
                              src={qrCodeData.qrCode}
                              alt="PromptPay QR Code"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-center p-2">
                              <QrCode size={48} className="text-gray-400 mb-2" />
                              <button
                                type="button"
                                onClick={() => generateSettleQR(totalPayAmount)}
                                className="flex items-center gap-1 text-xs text-[#E51C23] hover:underline cursor-pointer"
                              >
                                <RefreshCw size={12} />
                                <span>สร้าง QR Code ใหม่อีกครั้ง</span>
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="text-center space-y-0.5 max-w-[220px]">
                          <Text variant="small" className="font-medium text-[#1C1B1B] leading-tight block mb-0">
                            เจเจ อะไหล่ยนต์
                          </Text>
                          <Text variant="xs" className="font-normal text-[#6B7280] leading-tight block mb-0">
                            พร้อมเพย์ชำระยอดหนี้
                          </Text>
                          {qrCodeData?.refNo && (
                            <span className="text-[10px] text-gray-400 font-mono block truncate">
                              Ref: {qrCodeData.refNo}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* รายละเอียดฝั่งขวา */}
                      <div className="flex flex-col justify-between">
                        <div className="h-full flex flex-col justify-between">
                          <div className="border-l-3 border-[#E51C23] p-4 bg-[#F0EDEC]">
                            <Text variant="xs" className="text-[#5F5E5E] mb-0">ยอดชำระสุทธิงวดนี้</Text>
                            <div className="flex justify-between items-baseline mt-2">
                              <Text variant="fourxl">
                                {totalPayAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </Text>
                              <Text variant="xs" className="text-[#1C1B1B] mb-0">บาท</Text>
                            </div>
                          </div>

                          <div className="pt-3 space-y-2">
                            <div className="border-b border-[#E7BDB8]"></div>
                            <div>
                              <div className="flex justify-between items-center">
                                <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2 mb-0">วันที่</Text>
                                <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2 mb-0">{currentDateStr}</Text>
                              </div>
                              <div className="flex justify-between items-center">
                                <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2 mb-0">เวลา</Text>
                                <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2 mb-0">{formatTime}</Text>
                              </div>
                              <div className="flex justify-between items-center">
                                <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2 mb-0">ผู้ดำเนินการ</Text>
                                <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2 mb-0">{currentStaff}</Text>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex p-6 gap-4">
                <Button
                  type="button"
                  variant="tertiary"
                  size="md"
                  disabled={isSubmitting}
                  onClick={handleCloseModal}
                  className="px-20 py-3 font-normal text-sm rounded-none bg-[#E5E2E1] hover:bg-[#E7E5E4] cursor-pointer"
                >
                  ยกเลิก
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  disabled={isSubmitting || totalPayAmount <= 0 || (paymentMethodId === 1 && receivedAmount < totalPayAmount)}
                  isLoading={isSubmitting}
                  onClick={() => handleFinalConfirm(1)}
                  leftIcon={<Printer className="w-4 h-4" />}
                  className="flex-1 py-3 bg-[#E51C23] hover:bg-red-700 text-white font-normal text-sm rounded-none cursor-pointer disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  ยืนยันและออกใบเสร็จ (RE)
                </Button>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}