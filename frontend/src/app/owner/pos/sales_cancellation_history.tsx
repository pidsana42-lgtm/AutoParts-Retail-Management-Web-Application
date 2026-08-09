import React from "react";
import Text from "../../../components/elements/text";
import Heading from "../../../components/elements/heading";
import { Card, CardContent } from "../../../components/elements/card";
import { ScanBarcode } from "lucide-react";
import Input from "../../../components/elements/input";

const OwnerSalesCancellationHistory: React.FC = () => {
  return (
    // main container with padding and vertical spacing
    <main className="space-y-6 p-6">
      {/* Header ส่วนหัวของหน้า */}
      <header>
        <Text variant="xs" className="text-[#E51C23] uppercase tracking-wider mb-0">
          ยกเลิกบิลขาย
        </Text>
        <Heading level="h1" weight="normal" className="mb-0 text-[#1C1B1B]">
          รายการยกเลิกจากพนักงาน
        </Heading>
      </header>

      {/* Filter Bar */}
      <Card className="bg-[#F6F3F2] rounded-none shadow-none border-y border-r border-gray-200 border-l-4 border-l-[#E51C23] overflow-hidden">
        <CardContent className="p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">

            {/* ค้นหาเลขคำสั่งซื้อ/ชื่อลูกค้า */}
            <div className="md:col-span3 flex flex-col gap-1.5 border border-red-600">
              <Text variant="xs" className="text-[#5F5E5E]">ค้นหาเลขคำสั่งซื้อ/ชื่อลูกค้า</Text>
              <div className="relative flex-1">
                <ScanBarcode className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10" size={18} />
                <Input 
                  //value={searchQuery} 
                  //onChange={(e) => setSearchQuery(e.target.value)} 
                  placeholder="สแกนบาร์โค้ด / INV-2024-XXX หรือ ชื่อลูกค้า"
                  className="w-full h-11 bg-white border border-gray-200 rounded-none pl-12 pr-4 text-sm text-[#1C1B1B] font-light focus:outline-none focus:border-red-500 shadow-sm" />
              </div>
            </div>

            {/* วันที่เริ่มต้น */}
            <div className="md:col-span-2 flex flex-col gap-1.5 border border-red-600">
              <Text variant="xs" className="text-[#5F5E5E]">วันที่เริ่มต้น</Text>
              <Input
                type="date"
                //value={startDate}
                //onChange={(e) => setStartDate(e.target.value)}
                className="bg-white border-none rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 shadow-none cursor-pointer"
              />
            </div>

            {/* วันที่สิ้นสุด */}
            <div className="md:col-span-2 flex flex-col gap-1.5 border border-red-600">
              <Text variant="xs" className="text-[#5F5E5E]">วันที่สิ้นสุด</Text>
              <Input
                type="date"
                //value={endDate}
                //onChange={(e) => setEndDate(e.target.value)}
                className="bg-white border-none rounded-none h-11 text-sm font-normal text-[#1C1B1B] px-3 shadow-none cursor-pointer"
              />
            </div>

            

          </div>
        </CardContent>
      </Card>

      {/* สภาพแวดล้อมสำหรับใส่ ตาราง/Filter/การ์ดข้อมูล ต่อด้านล่างตรงนี้ */}
    </main>
  );
};

export default OwnerSalesCancellationHistory;
