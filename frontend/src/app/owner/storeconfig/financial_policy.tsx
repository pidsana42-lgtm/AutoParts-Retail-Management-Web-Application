import React, { useState, useEffect } from "react";
import {
  Save,
  TriangleAlert,
  CreditCard,
  Clock,
  History,
  X,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Percent,
} from "lucide-react";
import Heading from "../../../components/elements/heading";
import Text from "../../../components/elements/text";
import Button from "../../../components/elements/button";
import { Card } from "../../../components/elements/card";
import { useFinancialPolicy } from "./hook/UseFinancialPolicy";

export default function FinancialPolicyPage() {
  const {
    config,
    isLoading,
    isSaving,
    isDirty,
    error,
    successMessage,
    showAuditModal,
    setShowAuditModal,
    handleChange,
    handleReset,
    handleSave,
  } = useFinancialPolicy();

  // Audit Logs state for the history modal
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  useEffect(() => {
    if (showAuditModal) {
      try {
        const historyKey = "financial_policy_audit_logs";
        const logs = JSON.parse(localStorage.getItem(historyKey) || "[]");
        setAuditLogs(logs);
      } catch (e) {
        setAuditLogs([]);
      }
    }
  }, [showAuditModal]);

  return (
    <div className="relative flex min-h-screen bg-[#F8F9FA] text-slate-800 font-sans overflow-x-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        <main className="p-6 md:p-8 space-y-6 flex-1 max-w-[1200px] mx-auto w-full">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
            <div>
              <Text variant="xs" className="text-[#E51C23] font-semibold m-0 tracking-wide uppercase">
                การตั้งค่าร้านค้า
              </Text>
              <Heading level="h1" weight="bold" className="m-0 mt-1 text-2xl md:text-3xl text-[#1C1B1B]">
                การตั้งค่านโยบายการเงินและเครดิต
              </Heading>
              <Text variant="small" className="text-[#6B7280] font-light m-0 mt-1">
                กำหนดเกณฑ์ส่วนลด วงเงินเครดิต และระยะเวลาค้างชำระของลูกค้าทั่วทั้งร้าน
              </Text>
            </div>

            {/* Action Buttons Top Right */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                type="button"
                onClick={() => setShowAuditModal(true)}
                className="rounded-none h-11 px-4 text-xs font-normal text-[#5F5E5E] border-gray-300 hover:bg-gray-100 flex items-center gap-1.5 cursor-pointer shadow-none"
              >
                <History size={16} />
                <span>ประวัติการแก้ไข</span>
              </Button>

              <Button
                type="button"
                onClick={handleSave}
                disabled={isSaving || isLoading}
                className="rounded-none h-11 px-6 bg-[#E51C23] hover:bg-[#c9151b] text-white text-sm font-normal transition-colors border-none shadow-none flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save size={18} />
                <span>{isSaving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}</span>
              </Button>
            </div>
          </div>

          {/* Success / Error Alerts */}
          {successMessage && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between rounded-none animate-fade-in shadow-xs">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                <span className="font-medium">{successMessage}</span>
              </div>
              <span className="text-xs text-emerald-600 bg-emerald-100/60 px-2 py-0.5 font-medium">บันทึกสำเร็จ</span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2.5 rounded-none animate-fade-in shadow-xs">
              <AlertCircle size={18} className="text-red-600 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Form Content (Cards) */}
          <div className="space-y-6">
            {/* Card 1: การตั้งค่านโยบายการเงิน(ส่วนลด) */}
            <Card className="bg-white rounded-none border border-gray-200 !border-l-[5px] !border-l-[#E51C23] p-6 md:p-8 space-y-6 shadow-sm">
              <div className="border-b border-gray-100 pb-3">
                <Heading level="h2" weight="bold" className="text-lg md:text-xl text-[#1C1B1B] m-0">
                  การตั้งค่านโยบายการเงิน (ส่วนลด)
                </Heading>
                <Text variant="xs" className="text-[#E51C23] font-normal m-0 mt-1">
                  เกณฑ์ทางการเงินและการควบคุมการให้ส่วนลดของพนักงานทั่วทั้งร้านค้า
                </Text>
              </div>

              {/* Field: เพดานส่วนลดต่อบิล (%) */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pt-2">
                <div className="max-w-md">
                  <Text variant="small" className="font-bold text-[#1C1B1B] m-0 text-base">
                    เพดานส่วนลดต่อบิล (%)
                  </Text>
                  <Text variant="xs" className="text-[#8C8A8A] font-light m-0 mt-1 leading-relaxed">
                    อัตราเปอร์เซ็นต์ส่วนลดสูงสุดที่พนักงานหน้าร้านสามารถระบุได้ในแต่ละบิลขาย
                  </Text>
                </div>

                <div className="flex flex-col items-start sm:items-end w-full sm:w-[300px]">
                  <div className="flex items-center bg-[#F6F3F2] border border-gray-200 focus-within:border-red-500 focus-within:ring-1 focus-within:ring-red-500 w-full px-4 py-2.5 transition-all">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      disabled={isLoading}
                      value={config.max_extra_discount_rate}
                      onChange={(e) => handleChange("max_extra_discount_rate", e.target.value)}
                      className="w-full bg-transparent text-left font-bold text-lg text-[#1C1B1B] focus:outline-none disabled:opacity-50"
                    />
                    <div className="flex items-center gap-1 text-gray-500 font-bold text-base select-none pl-2 border-l border-gray-300">
                      <Percent size={16} />
                    </div>
                  </div>
                  <Text variant="xs" className="text-[11px] text-[#8C8A8A] font-light m-0 mt-1.5 leading-relaxed text-left sm:text-right">
                    ระบบจะใช้ค่านี้ตรวจสอบความถูกต้อง หากพนักงานกรอกเกินกำหนด ระบบจะปฏิเสธการขายทันที
                  </Text>
                </div>
              </div>

              {/* Warning Alert Box */}
              <div className="bg-[#FFF5F5] border border-[#FFD8D8] p-4 flex items-start gap-3 rounded-none">
                <TriangleAlert className="text-[#E51C23] shrink-0 mt-0.5" size={18} />
                <Text variant="xs" className="text-[#E51C23] font-normal m-0 leading-relaxed">
                  <span className="font-bold">หมายเหตุการควบคุม:</span> พนักงานไม่สามารถให้ส่วนลดเกิน {config.max_extra_discount_rate}% ได้ตามที่เจ้าของร้านกำหนดไว้ หากมีการระบุส่วนลดเกินเพดานนี้ ระบบจะระงับการบันทึกรายการขายเพื่อป้องกันความเสียหายทางการเงิน
                </Text>
              </div>
            </Card>

            {/* Card 2: การตั้งค่านโยบายเครดิต */}
            <Card className="bg-white rounded-none border border-gray-200 !border-l-[5px] !border-l-[#E51C23] p-6 md:p-8 space-y-6 shadow-sm">
              <div className="border-b border-gray-100 pb-3">
                <Heading level="h2" weight="bold" className="text-lg md:text-xl text-[#1C1B1B] m-0">
                  การตั้งค่านโยบายเครดิต
                </Heading>
                <Text variant="xs" className="text-[#E51C23] font-normal m-0 mt-1">
                  วงเงินเครดิตของลูกค้าและกฎเกณฑ์การชำระหนี้สำหรับลูกค้าเงินเชื่อ
                </Text>
              </div>

              {/* Field 1: วงเงินเครดิตรวมต่อลูกค้า (บาท) */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pt-2">
                <div className="max-w-md">
                  <Text variant="small" className="font-bold text-[#1C1B1B] m-0 text-base">
                    วงเงินเครดิตรวมต่อลูกค้า (บาท)
                  </Text>
                  <Text variant="xs" className="text-[#8C8A8A] font-light m-0 mt-1 leading-relaxed">
                    ยอดหนี้ค้างชำระสูงสุดที่อนุญาตให้ลูกค้าแต่ละรายติดค้างได้ในระบบ
                  </Text>
                </div>

                <div className="flex flex-col items-start sm:items-end w-full sm:w-[300px]">
                  <div className="flex items-center bg-[#F6F3F2] border border-gray-200 focus-within:border-red-500 focus-within:ring-1 focus-within:ring-red-500 w-full px-4 py-2.5 transition-all">
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      disabled={isLoading}
                      value={config.max_credit}
                      onChange={(e) => handleChange("max_credit", e.target.value)}
                      className="w-full bg-transparent text-left font-bold text-lg text-[#1C1B1B] focus:outline-none disabled:opacity-50"
                    />
                    <div className="flex items-center gap-1 text-gray-500 font-medium text-xs select-none pl-2 border-l border-gray-300">
                      <CreditCard size={16} />
                      <span>บาท</span>
                    </div>
                  </div>
                  <Text variant="xs" className="text-[11px] text-[#8C8A8A] font-light m-0 mt-1.5 leading-relaxed text-left sm:text-right">
                    ระบบจะระงับการขายเชื่อสินค้าทันทีหากยอดหนี้คงเหลือไม่เพียงพอ
                  </Text>
                </div>
              </div>

              {/* Field 2: ระยะเวลาค้างชำระสูงสุด (วัน) */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pt-2 border-t border-gray-100">
                <div className="max-w-md">
                  <Text variant="small" className="font-bold text-[#1C1B1B] m-0 text-base">
                    ระยะเวลาค้างชำระสูงสุด (วัน)
                  </Text>
                  <Text variant="xs" className="text-[#8C8A8A] font-light m-0 mt-1 leading-relaxed">
                    จำนวนวันสูงสุดที่ยอมให้ลูกค้าค้างชำระนับตั้งแต่วันที่เปิดบิลขายเชื่อ
                  </Text>
                </div>

                <div className="flex flex-col items-start sm:items-end w-full sm:w-[300px]">
                  <div className="flex items-center bg-[#F6F3F2] border border-gray-200 focus-within:border-red-500 focus-within:ring-1 focus-within:ring-red-500 w-full px-4 py-2.5 transition-all">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      disabled={isLoading}
                      value={config.max_overdue_days}
                      onChange={(e) => handleChange("max_overdue_days", e.target.value)}
                      className="w-full bg-transparent text-left font-bold text-lg text-[#1C1B1B] focus:outline-none disabled:opacity-50"
                    />
                    <div className="flex items-center gap-1 text-gray-500 font-medium text-xs select-none pl-2 border-l border-gray-300">
                      <Clock size={16} />
                      <span>วัน</span>
                    </div>
                  </div>
                  <Text variant="xs" className="text-[11px] text-[#8C8A8A] font-light m-0 mt-1.5 leading-relaxed text-left sm:text-right">
                    หากหนี้สินเกินขีดจำกัดนี้ จะมีคำเตือนแจ้งเตือนการค้างชำระในหน้าข้อมูลลูกค้า
                  </Text>
                </div>
              </div>

              {/* Warning Alert Box */}
              <div className="bg-[#FFF5F5] border border-[#FFD8D8] p-4 flex items-start gap-3 rounded-none">
                <TriangleAlert className="text-[#E51C23] shrink-0 mt-0.5" size={18} />
                <Text variant="xs" className="text-[#E51C23] font-normal m-0 leading-relaxed">
                  <span className="font-bold">นโยบายความปลอดภัย:</span> ระบบจะระงับการขายเชื่อทันทีหากยอดหนี้เกินเพดานที่ตั้งไว้ และการลดหนี้ตอนชำระคืนต้องเป็นไปตามสิทธิ์ที่กำหนดเท่านั้น เพื่อป้องกันความเสียหายทางการเงิน
                </Text>
              </div>
            </Card>

            {/* Bottom Action Footer Bar */}
            <Card className="bg-white rounded-none border border-gray-200 p-4 md:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                {isDirty ? (
                  <span className="inline-flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2.5 py-1 font-medium border border-amber-200">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    มีการแก้ไขที่ยังไม่ได้บันทึก
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 font-medium border border-emerald-200">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    ข้อมูลเป็นปัจจุบันแล้ว
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  disabled={!isDirty || isSaving}
                  className="rounded-none h-11 px-5 text-xs text-gray-700 border-gray-300 hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  <RotateCcw size={14} />
                  <span>คืนค่าเดิม</span>
                </Button>

                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || isLoading}
                  className="rounded-none h-11 px-8 bg-[#E51C23] hover:bg-[#c9151b] text-white text-sm font-medium transition-colors border-none shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save size={18} />
                  <span>{isSaving ? "กำลังบันทึกการตั้งค่า..." : "บันทึกการเปลี่ยนแปลง"}</span>
                </Button>
              </div>
            </Card>
          </div>
        </main>
      </div>

      {/* Audit History Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-none shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-gray-200 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-[#F6F3F2]">
              <div className="flex items-center gap-2">
                <History className="text-[#E51C23]" size={20} />
                <Heading level="h3" weight="bold" className="text-base text-[#1C1B1B] m-0">
                  ประวัติการแก้ไขการตั้งค่านโยบาย
                </Heading>
              </div>
              <button
                onClick={() => setShowAuditModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {auditLogs.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-sm">
                  ยังไม่มีประวัติการแก้ไขการตั้งค่าในระบบ
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="py-3 flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs text-[#8C8A8A]">
                        <span className="font-medium text-[#1C1B1B]">{log.changed_by}</span>
                        <span>{new Date(log.changed_at).toLocaleString("th-TH")}</span>
                      </div>
                      <div className="text-xs text-gray-700 font-medium">{log.action}</div>
                      <div className="text-xs text-[#5F5E5E] font-light bg-gray-50 p-2.5 border border-gray-100 mt-1">
                        {log.details}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-gray-200 bg-[#F8F9FA] flex justify-end">
              <Button
                variant="outline"
                onClick={() => setShowAuditModal(false)}
                className="rounded-none text-xs px-5 h-9"
              >
                ปิด
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}