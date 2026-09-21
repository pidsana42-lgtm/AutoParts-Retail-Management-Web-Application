import {
  Save,
  TriangleAlert,
  CreditCard,
  Clock,
  History,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Percent,
} from "lucide-react";
import Heading from "../../../components/elements/heading";
import Text from "../../../components/elements/text";
import Button from "../../../components/elements/button";
import { Card } from "../../../components/elements/card";
import Input from "../../../components/elements/input";
import Badge from "../../../components/elements/badge";
import { useFinancialPolicy } from "./hook/UseFinancialPolicy";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContexts";
import ConfirmModal from "../../../components/elements/confirm_modal";

export default function FinancialPolicyPage() {
  const { role } = useAuth();
  const currentRole = (role || localStorage.getItem("role") || "").toUpperCase();
  const isOwner = currentRole === "OWNER";

  if (!isOwner) {
    return <Navigate to="/" replace />;
  }

  const {
    config,
    isLoading,
    isSaving,
    isDirty,
    error,
    successMessage,
    showAuditModal,
    setShowAuditModal,
    auditLogs,
    isLoadingAuditLogs,
    handleChange,
    handleReset,
    handleSave,
  } = useFinancialPolicy();

  return (
    <div className="relative flex min-h-screen bg-white text-slate-800 font-sans overflow-x-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        <main className="p-6 md:p-8 space-y-6 flex-1 max-w-300 mx-auto w-full">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5">
            <div>
              <Heading level='h1' weight='semibold' className='m-0 text-black'>
                การตั้งค่านโยบายการเงินและเครดิต
              </Heading>
              <Heading level='h6' className='m-0 mt-1'>
                กำหนดเกณฑ์ส่วนลด วงเงินเครดิต และระยะเวลาค้างชำระของลูกค้าทั่วทั้งร้าน
              </Heading>
            </div>

            {/* Action Buttons Top Right */}
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline-cancel"
                leftIcon={<History size={16} />}
                onClick={() => setShowAuditModal(true)}
                className="rounded-none h-11 px-4 text-xs font-normal text-[#5F5E5E] bg-white  border border-gray-200 hover:bg-[#F6F3F2] shadow-none cursor-pointer transition-colors"
              >
                ประวัติการแก้ไข
              </Button>

              <Button
                type="button"
                variant="solid-red"
                leftIcon={<Save size={18} />}
                onClick={handleSave}
                disabled={isSaving || isLoading}
                isLoading={isSaving}
                className="bg-[#E51C23] hover:bg-[#C01A1F] text-white rounded-none h-11 px-6 text-sm font-normal"
              >
                บันทึกการตั้งค่า
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
              <Badge variant="success" className="rounded-none">บันทึกสำเร็จ</Badge>
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
            <Card className="bg-white rounded-none border border-gray-200 border-l-4 border-l-[#E51C23]! p-6 md:p-8 space-y-6 shadow-sm">
              <div className="border-b border-gray-100 pb-3">
                <Heading level="h3" weight="medium" className="text-[#1C1B1B] m-0">
                  การตั้งค่านโยบายการเงิน (ส่วนลด)
                </Heading>
                <Text variant="xs" className="text-[#E51C23] font-normal m-0 mt-1">
                  เกณฑ์ทางการเงินและการควบคุมการให้ส่วนลดของพนักงานทั่วทั้งร้านค้า
                </Text>
              </div>

              {/* Field: เพดานส่วนลดต่อบิล (%) */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pt-2">
                <div className="max-w-md">
                  <Text variant="small" className="font-normal text-[#1C1B1B] m-0 text-base">
                    เพดานส่วนลดต่อบิล (%)
                  </Text>
                  <Text variant="xs" className="text-[#5F5E5E] font-light m-0 mt-1 leading-relaxed">
                    อัตราเปอร์เซ็นต์ส่วนลดสูงสุดที่พนักงานหน้าร้านสามารถระบุได้ในแต่ละบิลขาย
                  </Text>
                </div>

                <div className="w-full sm:w-75">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    disabled={isLoading}
                    value={config.max_extra_discount_rate}
                    onChange={(e) => handleChange("max_extra_discount_rate", e.target.value)}
                    rightIcon={<Percent size={16} className="text-[#A1A1AA]" />}
                    className="font-medium text-lg text-[#1C1B1B] bg-[#F6F3F2] border border-gray-200 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  />
                  <Text variant="xs" className="font-light mt-1 text-[#5F5E5E]">
                    ระบบจะใช้ค่านี้ตรวจสอบความถูกต้อง หากกรอกเกินกำหนด ระบบจะปฏิเสธการขายทันที
                  </Text>
                </div>
              </div>

              {/* Warning Alert Box */}
              <div className="bg-[#FFDAD6]/30 border border-[#BA1A1A]/20 p-4 flex items-start gap-3 rounded-none">
                <TriangleAlert className="text-[#E51C23] shrink-0 mt-0.5" size={18} />
                <Text variant="xs" className="text-[#E51C23] font-normal m-0 leading-relaxed">
                  <span className="font-medium">หมายเหตุการควบคุม:</span> พนักงานไม่สามารถให้ส่วนลดเกิน {config.max_extra_discount_rate}% ได้ตามที่เจ้าของร้านกำหนดไว้ หากมีการระบุส่วนลดเกินเพดานนี้ ระบบจะระงับการบันทึกรายการขายเพื่อป้องกันความเสียหายทางการเงิน
                </Text>
              </div>
            </Card>

            {/* Card 2: การตั้งค่านโยบายเครดิต */}
            <Card className="bg-white rounded-none border border-gray-200 border-l-4! border-l-[#E51C23]! p-6 md:p-8 space-y-6 shadow-sm">
              <div className="border-b border-gray-100 pb-3">
                <Heading level="h3" weight="medium" className="text-[#1C1B1B] m-0">
                  การตั้งค่านโยบายเครดิต
                </Heading>
               <Text variant="xs" className="text-[#E51C23] font-normal m-0 mt-1">
                  วงเงินเครดิตของลูกค้าและกฎเกณฑ์การชำระหนี้สำหรับลูกค้าเงินเชื่อ
                </Text>
              </div>

              {/* Field 1: วงเงินเครดิตรวมต่อลูกค้า (บาท) */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pt-2">
                <div className="max-w-md">
                  <Text variant="small" className="font-normal text-[#1C1B1B] m-0 text-base">
                    วงเงินเครดิตรวมต่อลูกค้า (บาท)
                  </Text>
                   <Text variant="xs" className="text-[#5F5E5E] font-light m-0 mt-1 leading-relaxed">
                    ยอดหนี้ค้างชำระสูงสุดที่อนุญาตให้ลูกค้าแต่ละรายติดค้างได้ในระบบ
                  </Text>
                </div>

                <div className="w-full sm:w-75">
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    disabled={isLoading}
                    value={config.max_credit}
                    onChange={(e) => handleChange("max_credit", e.target.value)}
                    rightIcon={<CreditCard size={16} className="text-gray-400" />}
                    className="font-medium text-lg text-[#1C1B1B] bg-[#F6F3F2] border border-gray-200 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  />
                  <Text variant="xs" className="font-light mt-1 text-[#5F5E5E]">
                    ระบบจะระงับการขายเชื่อสินค้าทันทีหากยอดหนี้คงเหลือไม่เพียงพอ
                  </Text>
                </div>
              </div>

              {/* Field 2: ระยะเวลาค้างชำระสูงสุด (วัน) */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pt-2">
                <div className="max-w-md">
                  <Text variant="small" className="font-normal text-[#1C1B1B] m-0 text-base">
                    ระยะเวลาค้างชำระสูงสุด (วัน)
                  </Text>
                  <Text variant="xs" className="text-[#5F5E5E] font-light m-0 mt-1 leading-relaxed">
                    จำนวนวันสูงสุดที่ยอมให้ลูกค้าค้างชำระนับตั้งแต่วันที่เปิดบิลขายเชื่อ
                  </Text>
                </div>

                <div className="w-full sm:w-75">
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    disabled={isLoading}
                    value={config.max_overdue_days}
                    onChange={(e) => handleChange("max_overdue_days", e.target.value)}
                    rightIcon={<Clock size={16} className="text-gray-400" />}
                    className="font-medium text-lg text-[#1C1B1B] bg-[#F6F3F2] border border-gray-200 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  />
                  <Text variant="xs" className="font-light mt-1 text-[#5F5E5E]">
                    หากหนี้สินเกินขีดจำกัดนี้ จะมีคำเตือนแจ้งเตือนการค้างชำระในหน้าข้อมูลลูกค้า
                  </Text>
                </div>
              </div>

              {/* Warning Alert Box */}
              <div className="bg-[#FFDAD6]/30 border border-[#BA1A1A]/20 p-4 flex items-start gap-3 rounded-none">
                <TriangleAlert className="text-[#E51C23] shrink-0 mt-0.5" size={18} />
                <Text variant="xs" className="text-[#E51C23] font-normal m-0 leading-relaxed">
                  <span className="font-semibold">นโยบายความปลอดภัย:</span> ระบบจะระงับการขายเชื่อทันทีหากยอดหนี้เกินเพดานที่ตั้งไว้ และการลดหนี้ตอนชำระคืนต้องเป็นไปตามสิทธิ์ที่กำหนดเท่านั้น เพื่อป้องกันความเสียหายทางการเงิน
                </Text>
              </div>
            </Card>

            {/* Bottom Action Footer Bar */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline-cancel"
                leftIcon={<RotateCcw size={14} />}
                onClick={handleReset}
                disabled={!isDirty || isSaving}
                className="rounded-none h-11 px-5 text-sm font-normal text-[#5F5E5E] bg-white  border border-gray-200 hover:bg-[#F6F3F2] shadow-none cursor-pointer transition-colors"
              >
                คืนค่าเดิม
              </Button>
            </div>
          </div>
        </main>
      </div>

      {/* Audit History Modal */}
      <ConfirmModal
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
        title="ประวัติการแก้ไขการตั้งค่านโยบาย"
        description="บันทึกการเปลี่ยนแปลงและประวัติการตรวจสอบกิจกรรมภายในระบบ"
        size="lg"
      >
        {isLoadingAuditLogs ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs font-light">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E51C23] mb-3"></div>
            <p className="m-0">กำลังโหลดประวัติการแก้ไข...</p>
          </div>
        ) : auditLogs.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs font-light">
            <History size={32} className="text-slate-300 mb-2 stroke-[1.5]" />
            <p className="m-0">ยังไม่มีประวัติการแก้ไขการตั้งค่าในระบบ</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {auditLogs.map((log) => (
              <div key={log.id} className="py-3 flex flex-col gap-1.5 first:pt-0 last:pb-0">
                {/* User & Timestamp */}
                <div className="flex items-center justify-between text-sm">
                  <span className="font-normal text-[#1C1B1B]">
                    {log.changed_by}
                  </span>
                  <span className="text-[#5F5E5E] text-xs font-light">
                    {new Date(log.changed_at).toLocaleString("th-TH", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {/* Action Title */}
                <div className="text-xs text-[#5F5E5E] font-light mt-0.5">
                  {log.action}
                </div>

                {/* Details Box */}
                <div className="text-xs text-[#1C1B1B] font-light bg-[#F6F3F2] p-2.5 eading-relaxed">
                  {log.details}
                </div>
              </div>
            ))}
          </div>
        )}
      </ConfirmModal>
    </div>
  );
}