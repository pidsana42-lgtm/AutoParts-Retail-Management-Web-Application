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
} from "lucide-react";
import Text from "../../../components/elements/text";
import Heading from "../../../components/elements/heading";
import Input from "../../../components/elements/input";
import Button from "../../../components/elements/button";
import Badge from "../../../components/elements/badge";
import { Card } from "../../../components/elements/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../../../components/elements/table";
import { getPaymentVariant } from "../../../utils/poshelpers";
import { useSettleBills } from "./hooks/useSettleBills";

export default function SettleBillsPage(): React.JSX.Element {
  const {
    searchQuery,
    setSearchQuery,
    customerId,
    customerName,
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
    fetchUnpaidBills,
    handleToggleSelect,
    handleToggleSelectAll,
    handleOpenModal,
    handleCloseModal,
    handleFinalConfirm,
    searchResults,
    triggerLiveSearch,
    handleSelectSearchResult,
  } = useSettleBills(); // เริ่มต้นด้วย null เพื่อไม่ยิงค้างที่ ID 1

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
                placeholder="พิมพ์ชื่อลูกค้า/อู่ หรือ สแกน/พิมพ์ค้นหาเลขที่บิลขาย (INV-XXX)..."
                className="w-full bg-white border border-gray-200 rounded-none pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-red-500 shadow-sm"
                autoFocus
              />

              {/* Dropdown ค้นหาด่วน */}
              {searchQuery.trim().length > 0 && searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-gray-100">
                  {searchResults.map((item) => (
                    <div
                      key={item.id || item.id}
                      onClick={() => handleSelectSearchResult(item)}
                      className="p-3 hover:bg-gray-50 flex justify-between items-center cursor-pointer transition-colors text-left"
                    >
                      <div className="flex flex-col">
                        <Text variant="small" className="text-[#1C1B1B] mb-0 leading-tight font-medium">
                          {item.customer_name || "—"}
                        </Text>
                        <Text variant="xs" className="text-[10px] text-[#6B7280] mb-0.5 mt-1 leading-tight">
                          เลขที่บิล: {item.order_number}
                        </Text>
                      </div>
                      <div className="text-right flex flex-col shrink-0 pl-4">
                        <Text variant="xs" className="text-[#E51C23] font-medium">
                          ค้างชำระ ฿{(item.balance_due || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                        </Text>
                        <Text variant="xs" className="text-[10px] text-gray-400">
                          {item.order_date ? new Date(item.order_date).toLocaleDateString("th-TH") : "-"}
                        </Text>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => customerId && fetchUnpaidBills(customerId)}
              className="bg-[#1C1B1B] text-white px-8 py-3 rounded-none text-sm hover:bg-zinc-800 transition-colors cursor-pointer shrink-0 font-normal"
            >
              ค้นหา
            </button>
          </div>

          {/* กล่องดำโหมดตัดยอดหนี้ */}
          <div className="bg-[#1C1B1B] text-gray-300 rounded-none p-4 mb-6 flex justify-between items-center border border-zinc-800 border-l-4 border-l-[#E51C23]">
            <div className="flex items-center gap-3">
              <RotateCcw size={18} className="text-[#E51C23]" />
              <div>
                <Text variant="small" className="text-white font-medium block mb-0">
                  โหมดตัดยอดหนี้เงินเชื่อ
                </Text>
                <Text variant="xs" className="font-light text-gray-400 mb-0">
                  ติ๊กเลือกบิลที่ลูกค้าต้องการชำระ ระบบจะรวมยอดสุทธิเพื่อออกใบเสร็จรับเงินใบเดียว
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
                  <TableHead className="py-3 px-3 text-left w-[18%] font-normal text-[#6B7280]">เลขที่คำสั่งซื้อ</TableHead>
                  <TableHead className="py-3 px-3 text-left w-[15%] font-normal text-[#6B7280]">วันที่ทำรายการ</TableHead>
                  <TableHead className="py-3 px-3 text-left w-[26%] font-normal text-[#6B7280]">ชื่อลูกค้า/อู่</TableHead>
                  <TableHead className="py-3 px-3 text-center w-[12%] font-normal text-[#6B7280]">การชำระเงิน</TableHead>
                  <TableHead className="py-3 px-3 text-right w-[12%] font-normal text-[#6B7280]">ยอดรวมทั้งบิล</TableHead>
                  <TableHead className="py-3 px-3 text-right pr-6 w-[12%] font-normal text-[#6B7280]">ค้างชำระ</TableHead>
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
                    return (
                      <TableRow
                        key={bill.order_id}
                        onClick={() => handleToggleSelect(bill.order_id)}
                        className={`cursor-pointer transition-colors ${isSelected ? "bg-red-50/40" : "hover:bg-gray-50/80"}`}
                      >
                        <TableCell className="py-4 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(bill.order_id)}
                            className="w-4 h-4 border border-gray-300 rounded-none bg-white checked:bg-[#E51C23] checked:border-[#E51C23] cursor-pointer appearance-none flex items-center justify-center after:content-['✓'] after:text-white after:text-[10px] after:font-bold after:hidden checked:after:block mx-auto"
                          />
                        </TableCell>
                        <TableCell className="py-4 px-3 text-left">
                          <Text variant="small" className="font-normal text-[#1C1B1B] mb-0">{bill.order_number}</Text>
                        </TableCell>
                        <TableCell className="py-4 px-3 text-left">
                          <Text variant="xs" className="font-light text-[#5B5B5B] mb-0">
                            {bill.order_date ? new Date(bill.order_date).toLocaleDateString("th-TH") : "-"}
                          </Text>
                        </TableCell>
                        <TableCell className="py-4 px-3 text-left">
                          <Text variant="small" className="font-normal text-[#1C1B1B] mb-0 truncate">{customerName}</Text>
                          <Text variant="xs" className="font-light text-[#A8A29E] mb-0">สถานะ: {bill.payment_status}</Text>
                        </TableCell>
                        <TableCell className="py-4 px-3 text-center">
                          <div className="flex justify-center items-center">
                            <Badge variant={getPaymentVariant("เงินเชื่อ")}>เงินเชื่อ</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-3 text-right">
                          <Text variant="small" className="font-normal text-[#1C1B1B] mb-0">
                            {bill.total_amount?.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                          </Text>
                        </TableCell>
                        <TableCell className="py-4 px-3 pr-6 text-right">
                          <Text variant="small" className="font-normal text-[#E51C23] mb-0">
                            {bill.balance_due?.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                          </Text>
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

          <Card className="bg-white p-4 border border-gray-200 mb-4 space-y-2 rounded-none">
            <div className="flex justify-between items-center text-xs">
              <Text variant="xs" className="text-gray-500 mb-0">จำนวนบิลที่เลือก:</Text>
              <Text variant="xs" className="font-semibold text-zinc-900 mb-0">{selectedBillIds.length} รายการ</Text>
            </div>
            <div className="flex justify-between items-center text-xs">
              <Text variant="xs" className="text-gray-500 mb-0">ลูกค้า:</Text>
              <Text variant="xs" className="font-semibold text-zinc-900 truncate max-w-[150px] mb-0">
                {customerName || "—"}
              </Text>
            </div>
          </Card>

          <div className="space-y-3 pt-2">
            <div className="flex justify-between">
              <Text variant="small" className="text-[#6B7280] mb-0">ยอดหนี้รวมที่เลือก</Text>
              <Text variant="muted" className="text-[#1C1B1B] mb-0">฿{totalSelectedDebt.toFixed(2)}</Text>
            </div>
            <div className="flex justify-between">
              <Text variant="small" className="text-[#6B7280] mb-0">ส่วนลดเจรจาตัดหนี้</Text>
              <Text variant="muted" className="text-[#1C1B1B] mb-0">฿0.00</Text>
            </div>
            <div className="flex justify-between items-center text-[#E51C23] border-b border-dashed pb-2">
              <Text variant="small" className="text-[#E51C23] mb-0">ยอดที่ต้องชำระจริง</Text>
              <Text variant="muted" className="text-[#E51C23] mb-0">฿{totalSelectedDebt.toFixed(2)}</Text>
            </div>
          </div>

          <div className="bg-[#1C1B1B] p-5 my-5 flex justify-between items-center border border-zinc-800">
            <Text variant="small" className="text-[#9CA3AF] uppercase mb-0 tracking-wider">
              ยอดรับชำระสุทธิ
            </Text>
            <Text variant="muted" className="text-[#FFFFFF] text-2xl mb-0">
              ฿{totalSelectedDebt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Text>
          </div>

          <Text variant="small" className="text-[#6B7280] uppercase">
            เลือกช่องทางรับเงิน
          </Text>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 1, name: "เงินสด" },
              { id: 2, name: "QR CODE" },
              { id: 3, name: "โอนเงิน" },
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
          disabled={selectedBillIds.length === 0}
          variant="primary"
          size="lg"
          className="w-full mt-6 py-4 text-xl bg-[#E51C23] hover:bg-red-700 text-white rounded-none disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          รับชำระเงิน ({selectedBillIds.length} บิล)
        </Button>

        {/* Modal ชำระเงิน */}
        {isPaymentModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-none">
            <div className="bg-[#FCF9F8] w-full max-w-xl rounded-none shadow-2xl overflow-hidden flex flex-col">
              <div className="bg-[#1C1B1B] px-6 py-4 flex justify-between items-center">
                <Text variant="lead" className="text-white mb-0 font-medium">
                  รับชำระหนี้ ({paymentMethodId === 1 ? "เงินสด" : paymentMethodId === 2 ? "QR CODE" : "โอนเงินเข้าบัญชี"})
                </Text>
                <button type="button" onClick={handleCloseModal} className="text-[#9CA3AF] hover:text-white text-xl cursor-pointer">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex justify-between items-start border-l-3 border-[#5D3F3C] bg-[#F6F3F2] pl-4 py-3 my-4">
                  <div className="text-xs">
                    <Text variant="xs" className="text-[#1C1B1B] mb-0.5">ลูกค้า / อู่:</Text>
                    <Text variant="small" className="text-[#1C1B1B] font-medium mb-0">{customerName}</Text>
                  </div>
                  <div className="text-right text-xs mr-2">
                    <Text variant="xs" className="text-[#1C1B1B] mb-0.5">รายการบิลที่เลือก:</Text>
                    <Text variant="xs" className="text-[#E51C23] font-medium mb-0">{selectedBillIds.length} บิลค้างชำระ</Text>
                  </div>
                </div>

                {paymentMethodId === 1 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="border-l-3 border-[#E51C23] p-4 bg-[#F0EDEC]">
                        <Text variant="xs" className="text-[#5F5E5E] mb-0">ยอดชำระสุทธิ</Text>
                        <div className="flex justify-between items-baseline mt-2">
                          <Text variant="fourxl">{totalSelectedDebt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                          <Text variant="xs" className="text-[#1C1B1B] mb-0">บาท</Text>
                        </div>
                      </div>
                      <div className="border-l-3 border-[#006E0A] p-4 bg-[#86F976]/20">
                        <Text variant="xs" className="text-[#259B24] mb-0">ยอดเงินทอน</Text>
                        <div className="flex justify-between items-baseline mt-2">
                          <Text variant="fourxl" className="text-[#259B24]">
                            {Math.max(0, receivedAmount - totalSelectedDebt).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </Text>
                          <Text variant="xs" className="text-[#259B24] mb-0">บาท</Text>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Text variant="small" className="text-[#1C1B1B] font-medium mb-0">รับเงินมา</Text>
                      <div className="flex items-baseline justify-between w-full px-4 py-4 bg-white border-b-2 border-[#E7BDB8]">
                        <Input
                          type="text"
                          inputMode="decimal"
                          className="w-full text-4xl text-[#1C1B1B] font-semibold bg-transparent border-none focus:outline-none"
                          value={displayValue || ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value.replace(/,/g, "")) || 0;
                            setReceivedAmount(val);
                            setDisplayValue(e.target.value);
                          }}
                          placeholder="0.00"
                        />
                        <Text variant="xs" className="text-[#1C1B1B] ml-2 font-medium mb-0">บาท</Text>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex p-6 gap-4">
                <Button
                  type="button"
                  variant="tertiary"
                  size="md"
                  disabled={isSubmitting}
                  onClick={handleCloseModal}
                  className="px-20 py-3 font-normal text-sm rounded-none"
                >
                  ยกเลิก
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  disabled={isSubmitting}
                  isLoading={isSubmitting}
                  onClick={() => handleFinalConfirm(1)}
                  leftIcon={<Printer className="w-4 h-4" />}
                  className="flex-1 py-3 bg-[#E51C23] hover:bg-red-700 text-white font-normal text-sm rounded-none"
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