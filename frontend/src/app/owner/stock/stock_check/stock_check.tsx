import React, { useState, useEffect, useMemo } from "react";
import { Plus, SquarePen, Download, Printer, Loader2 } from "lucide-react";
import { ToastProvider, useToast } from "../../../../components/elements/toast";
import Heading from "../../../../components/elements/heading";
import Text from "../../../../components/elements/text";
import Card from "../../../../components/elements/card";
import Badge from "../../../../components/elements/badge";
import Input from "../../../../components/elements/input";
import Select from "../../../../components/elements/select";

import AddCheckStockScheduleModal from "./AddCheckStockScheduleModal";
import EditCheckStockScheduleModal from "./EditCheckStockScheduleModal";
import { stockCheckService, type CheckStockSchedule } from "../../../../service/http/wms/stock_check_service";
import { stockDataService } from "../../../../service/http/wms/stock_data_service";
import type { Zone } from "../../../../interface/wms/stock_data";

function StockCheckContent() {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<CheckStockSchedule[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  
  // Filters
  const [dateFilter, setDateFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<CheckStockSchedule | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sc, zns] = await Promise.all([
        stockCheckService.getSchedules(),
        stockDataService.getZones(),
      ]);
      setSchedules(sc);
      setZones(zns);
    } catch (err) {
      console.error(err);
      toast({ variant: "error", message: "ไม่สามารถโหลดข้อมูลตารางเช็คสต็อกได้" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleEdit = (sc: CheckStockSchedule) => {
    setSelectedSchedule(sc);
    setIsEditModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedSchedule(null);
    setIsAddModalOpen(true);
  };

  // Derived Stats
  const stats = useMemo(() => {
    const pending = schedules.filter(s => s.status === "รอดำเนินการ").length;
    const checking = schedules.filter(s => s.status === "กำลังเช็ค").length;
    // For today, simply filtering "completed"
    const completed = schedules.filter(s => s.status === "เสร็จสิ้น").length;
    return { pending, checking, completed };
  }, [schedules]);

  // Filtered schedules
  const filteredSchedules = useMemo(() => {
    return schedules.filter(sc => {
      let match = true;
      if (dateFilter) {
        // match date part only
        const scDate = new Date(sc.scheduled_datetime);
        const isoDate = scDate.toISOString().split('T')[0];
        if (isoDate !== dateFilter) match = false;
      }
      if (zoneFilter) {
        // Simplistic filter: check if target_name contains zoneName
        const z = zones.find(z => String(z.id) === zoneFilter);
        if (z && sc.target_name && !sc.target_name.includes(z.zone_name)) match = false;
      }
      return match;
    });
  }, [schedules, dateFilter, zoneFilter, zones]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "รอดำเนินการ":
        return <Badge variant="neutral" className="bg-gray-100 text-gray-500">• {status}</Badge>;
      case "กำลังเช็ค":
        return <Badge variant="error" className="bg-red-50 text-red-600">• {status}</Badge>;
      case "เสร็จสิ้น":
        return <Badge variant="success" className="bg-green-50 text-green-600">• {status}</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] w-full flex-col items-center justify-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-[#B70011]" />
        <span className="text-slate-400 text-sm font-medium">กำลังโหลดข้อมูล...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 select-none font-sans bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Heading level="h1" className="text-3xl font-bold text-slate-800 tracking-tight">
            จัดการตารางเช็คสต็อก
          </Heading>
          <Text variant="muted" className="text-sm mt-1">
            วางแผนและควบคุมการตรวจสอบสินค้าคงคลังเพื่อความแม่นยำสูงสุด
          </Text>
        </div>
        <button
          onClick={handleCreate}
          className="bg-[#B70011] hover:bg-[#9e0010] text-white px-5 py-2.5 rounded-md font-medium text-sm flex items-center gap-2 shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          สร้างตารางเช็คสต็อกใหม่
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-5 flex flex-col justify-center">
          <Text variant="muted" className="text-xs font-semibold mb-1">รอดำเนินการ</Text>
          <Heading level="h2" className="text-3xl font-bold text-slate-800">{stats.pending}</Heading>
          <div className="w-full h-1 bg-gray-100 mt-3 rounded-full overflow-hidden">
            <div className="h-full bg-gray-400 w-1/4 rounded-full"></div>
          </div>
        </Card>
        <Card className="p-5 flex flex-col justify-center">
          <Text variant="muted" className="text-xs font-semibold text-red-500 mb-1">กำลังเช็ค</Text>
          <Heading level="h2" className="text-3xl font-bold text-slate-800">{stats.checking}</Heading>
          <div className="w-full h-1 bg-red-100 mt-3 rounded-full overflow-hidden">
            <div className="h-full bg-red-500 w-1/2 rounded-full"></div>
          </div>
        </Card>
        <Card className="p-5 flex flex-col justify-center">
          <Text variant="muted" className="text-xs font-semibold text-green-500 mb-1">เสร็จสิ้น (วันนี้)</Text>
          <Heading level="h2" className="text-3xl font-bold text-slate-800">{stats.completed}</Heading>
          <div className="w-full h-1 bg-green-100 mt-3 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 w-3/4 rounded-full"></div>
          </div>
        </Card>
        <Card className="p-5 flex flex-col justify-center bg-[#B70011] text-white border-0">
          <div className="text-xs font-semibold opacity-90 mb-1">ความแม่นยำเฉลี่ย</div>
          <div className="text-3xl font-bold">99.4%</div>
          <div className="text-[10px] opacity-80 mt-1">+0.2% จากเดือนที่แล้ว</div>
        </Card>
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-8">
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="w-full sm:w-48">
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-white"
            />
          </div>
          <div className="w-full sm:w-56">
            <Select
              options={[
                { label: "โซนทั้งหมด", value: "" },
                ...zones.map(z => ({ label: z.zone_name, value: String(z.id) }))
              ]}
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="bg-white"
            />
          </div>
          {(dateFilter || zoneFilter) && (
            <button
              onClick={() => { setDateFilter(""); setZoneFilter(""); }}
              className="text-xs text-[#B70011] font-semibold px-2 hover:underline whitespace-nowrap self-center"
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 text-slate-400">
          <button className="hover:text-slate-700 transition-colors">
            <Download className="w-5 h-5" />
          </button>
          <button className="hover:text-slate-700 transition-colors">
            <Printer className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Table */}
      <Card noPadding className="overflow-hidden border-0 shadow-sm mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-[#F8F9FA] border-b border-gray-100 text-gray-500 font-medium text-xs tracking-wider">
                <th className="px-6 py-4">วันที่กำหนด</th>
                <th className="px-6 py-4">เป้าหมายการตรวจ</th>
                <th className="px-6 py-4">จำนวนสินค้า</th>
                <th className="px-6 py-4">พนักงานที่รับมอบหมาย</th>
                <th className="px-6 py-4">สถานะ</th>
                <th className="px-6 py-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {filteredSchedules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                    ไม่พบข้อมูลตารางเช็คสต็อก
                  </td>
                </tr>
              ) : (
                filteredSchedules.map((sc) => {
                  const scDateObj = new Date(sc.scheduled_datetime);
                  const dateStr = scDateObj.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
                  const timeStr = scDateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                  const isEditable = sc.status === "รอดำเนินการ";
                  
                  return (
                    <tr key={sc.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-800">{dateStr}</div>
                        <div className="text-xs text-gray-400">{timeStr}</div>
                      </td>
                      <td className="px-6 py-4">
                        {sc.check_type === "LOCATION" && (
                           <div className="flex items-center gap-2">
                             <div className="bg-gray-100 px-2 py-1 rounded text-xs font-bold text-gray-600">
                               {sc.target_name.split(' ')[1] || "Loc"}
                             </div>
                             <div>
                               <div className="font-semibold text-gray-800">{sc.target_name.split(' - ')[0]}</div>
                               <div className="text-[10px] text-gray-400 tracking-wider">
                                 {sc.target_name.split(' - ').slice(1).join(' - ')}
                               </div>
                             </div>
                           </div>
                        )}
                        {sc.check_type === "CATEGORY" && (
                           <div>
                               <div className="font-semibold text-gray-800">{sc.target_name}</div>
                               <div className="text-[10px] text-gray-400 tracking-wider">ตรวจสอบทั้งหมวดหมู่</div>
                           </div>
                        )}
                        {sc.check_type === "PRODUCT" && (
                           <div>
                               <div className="font-semibold text-gray-800 line-clamp-1">{sc.target_name}</div>
                               <div className="text-[10px] text-gray-400 tracking-wider">ตรวจสอบเฉพาะชิ้น</div>
                           </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-800">{sc.product_count} <span className="text-gray-500 font-normal">ชิ้น</span></div>
                        <div className="w-12 h-0.5 bg-gray-200 mt-1">
                          <div className={`h-full ${sc.status === "เสร็จสิ้น" ? "bg-green-500" : sc.status === "กำลังเช็ค" ? "bg-red-500" : "bg-gray-400"}`} style={{width: sc.status === "เสร็จสิ้น" ? "100%" : sc.status === "กำลังเช็ค" ? "50%" : "20%"}}></div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                            {sc.user_full_name.charAt(0)}
                          </div>
                          <span className="font-medium text-gray-700 text-sm">{sc.user_full_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(sc.status)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleEdit(sc)}
                          disabled={!isEditable}
                          className={`p-1.5 rounded-md transition-colors ${
                            isEditable 
                              ? "text-[#B70011] hover:bg-red-50 cursor-pointer" 
                              : "text-gray-300 cursor-not-allowed"
                          }`}
                          title={isEditable ? "แก้ไข" : "ไม่สามารถแก้ไขได้"}
                        >
                          <SquarePen className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-6 py-4 bg-white border-t border-gray-50">
          <div className="text-xs font-semibold text-gray-400 tracking-wider">
            SHOWING {filteredSchedules.length} OF {schedules.length} ENTRIES
          </div>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-50 text-gray-400 text-xs font-bold">&lt;</button>
            <button className="w-8 h-8 flex items-center justify-center rounded bg-[#B70011] text-white text-xs font-bold">1</button>
            <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-50 text-gray-600 text-xs font-bold">2</button>
            <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-50 text-gray-600 text-xs font-bold">3</button>
            <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-50 text-gray-400 text-xs font-bold">&gt;</button>
          </div>
        </div>
      </Card>

      {isAddModalOpen && (
        <AddCheckStockScheduleModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={loadData}
        />
      )}

      {isEditModalOpen && (
        <EditCheckStockScheduleModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={loadData}
          schedule={selectedSchedule}
        />
      )}
    </div>
  );
}

export default function StockCheck() {
  return (
    <ToastProvider position="bottom-right">
      <StockCheckContent />
    </ToastProvider>
  );
}