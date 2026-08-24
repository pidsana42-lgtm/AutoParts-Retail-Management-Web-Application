import React from "react";
import Text from "../../../components/elements/text";
import Heading from "../../../components/elements/heading";

const PaymentHistory: React.FC = () => {
  return (
    <div className="relative flex min-h-screen bg-[#F8F9FA] text-slate-800 font-sans overflow-x-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        <main className="p-6 space-y-6 flex-1">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <Text variant="xs" className="text-[#E51C23] uppercase tracking-wider mb-0">
                บันทึกรายการรับชำระเงินและตัดหนี้ที่คุณทำรายการ
              </Text>
              <Heading level="h1" weight="normal" className="mb-0 text-[#1C1B1B]">
                ประวัติการชำระเงิน
              </Heading>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
} 
export default PaymentHistory;

