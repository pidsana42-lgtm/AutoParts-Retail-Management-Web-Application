import { useState, useEffect } from "react";
import { Plus, Search, Loader2 } from "lucide-react";
import Button from "../../../../components/elements/button";

import Card from "../../../../components/elements/card";
import Heading from "../../../../components/elements/heading";
import Text from "../../../../components/elements/text";
import Input from "../../../../components/elements/input";
import Select from "../../../../components/elements/select";
import { ToastProvider, useToast } from "../../../../components/elements/toast";

import { stockDataService } from "../../../../service/http/wms/stock_data_service";
import type {
  Category,
  Unit,
  Zone,
  Shelf,
  Brand,
  Supplier,
  Grade,
} from "../../../../interface/wms/stock_data";

// Sub-tab Components
import CategoryTab from "./category/CategoryTab";
import UnitTab from "./unit/UnitTab";
import ZoneTab from "./zone/ZoneTab";
import BrandTab from "./brand/BrandTab";
import SupplierTab from "./supplier/SupplierTab";
import GradeTab from "./grade/GradeTab";

type TabType = "category" | "unit" | "zone" | "brand" | "supplier" | "grade";

const TAB_CONFIGS = [
  { value: "category", label: "ประเภทสินค้า" },
  { value: "unit", label: "หน่วยสินค้า" },
  { value: "zone", label: "โซน/ชั้นวางสินค้า" },
  { value: "brand", label: "แบรนด์รถ/โมเดล" },
  { value: "supplier", label: "บริษัทสั่งซื้อ" },
  { value: "grade", label: "เกรดสินค้า" },
];

function StockDataContent() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>("category");
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");

  const [addSignal, setAddSignal] = useState(0);

  // Data states
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);

  // ดึงข้อมูลทั้งหมดของหน้าตั้งค่านี้ (ไม่แตะ state `loading` เอง — แยกให้ผู้เรียกตัดสินใจว่าจะโชว์ loading เต็มจอไหม)
  const fetchAllData = async () => {
    const [cats, unts, zns, shlvs, sups, grds] = await Promise.all([
      stockDataService.getCategories(),
      stockDataService.getUnits(),
      stockDataService.getZones(),
      stockDataService.getShelves(),
      stockDataService.getSuppliers(),
      stockDataService.getGrades(),
    ]);

    setCategories(cats);
    setUnits(unts);
    setZones(zns);
    setShelves(shlvs);
    setSuppliers(sups);
    setGrades(grds);

    // Load Brands from Backend
    const backendBrands = await stockDataService.getBrands();
    setBrands(backendBrands);
  };

  // Load all data — ใช้ตอนเปิดหน้านี้ครั้งแรกเท่านั้น (โชว์ loading เต็มจอตอนยังไม่มีข้อมูลอะไรเลย)
  const loadData = async () => {
    try {
      setLoading(true);
      await fetchAllData();
    } catch (err) {
      console.error(err);
      toast({
        variant: "error",
        title: "เกิดข้อผิดพลาด",
        message: "ไม่สามารถโหลดข้อมูลระบบตั้งค่าได้",
      });
    } finally {
      setLoading(false);
    }
  };

  // refreshData: ใช้รีเฟรชข้อมูลหลังเพิ่ม/แก้ไข/ลบสำเร็จจากแท็บย่อยต่างๆ — ตั้งใจไม่แตะ `loading` เต็มจอ
  // (ถ้าใช้ loadData ตรงๆ จะไปเซ็ต loading=true ระหว่างรอ ทำให้ทั้งหน้ารวมถึง modal ที่เพิ่งบันทึกเสร็จโดน unmount
  // ทิ้งกลางคันชั่วครู่ พอโหลดเสร็จ tab ก็ mount ใหม่ แล้ว effect เปิด modal อัตโนมัติจาก addSignal เดิมก็ทำงานซ้ำ
  // เห็นเป็นอาการ "กดบันทึกแล้วเด้งฟอร์มเปล่ากลับมาใหม่ทันที")
  const refreshData = async () => {
    try {
      await fetchAllData();
    } catch (err) {
      console.error(err);
      toast({
        variant: "error",
        title: "เกิดข้อผิดพลาด",
        message: "ไม่สามารถโหลดข้อมูลระบบตั้งค่าได้",
      });
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const reloadBrands = async () => {
    try {
      const backendBrands = await stockDataService.getBrands();
      setBrands(backendBrands);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearch("");
    setCategoryFilter("");
    setZoneFilter("");
    setBrandFilter("");
    setAddSignal(0);
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] w-full flex-col items-center justify-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-[#B70011]" />
        <span className="text-slate-400 text-sm font-medium">กำลังโหลดข้อมูลการตั้งค่า...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 select-none font-sans bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <Heading level="h1" className="text-2xl font-bold text-slate-800 tracking-wide">
          การตั้งค่าข้อมูลสินค้า
        </Heading>
        <Text variant="muted" className="text-sm">
          รวบรวมการสร้างข้อมูลต่างๆ ของสินค้าที่จำเป็น
        </Text>
      </div>

      {/* Tabs Menu */}
      <div className="flex bg-[#F6F3F2] rounded-sm p-1 max-w-4xl shadow-sm border border-slate-200">
        {TAB_CONFIGS.map((tab) => {
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => handleTabChange(tab.value as TabType)}
              className={[
                "flex-1 text-center py-2 text-xs font-semibold rounded-sm transition-all duration-150 cursor-pointer",
                isActive
                  ? "bg-white text-[#B70011] shadow-sm border border-slate-200/50"
                  : "text-slate-600 hover:text-slate-900"
              ].join(" ")}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filters Bar */}
      <Card noPadding>
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <Input
              leftIcon={<Search className="h-4 w-4 text-slate-400" />}
              placeholder={
                activeTab === "category"
                  ? "ค้นหาด้วยรหัส หรือชื่อประเภท/ประเภทย่อย..."
                  : activeTab === "unit"
                    ? "ค้นหาด้วยชื่อหน่วย..."
                    : activeTab === "zone"
                      ? "ค้นหาด้วยชื่อโซน หรือชั้นวาง..."
                      : activeTab === "brand"
                        ? "ค้นหาด้วยแบรนด์ หรือรุ่นรถ..."
                        : activeTab === "grade"
                          ? "ค้นหาด้วยชื่อเกรดสินค้า..."
                          : "ค้นหาชื่อบริษัท ตัวย่อ หรือเบอร์โทร..."
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {activeTab === "category" && (
            <Select
              options={[
                { label: "เลือกประเภททั้งหมด", value: "" },
                ...categories.map((c) => ({ label: c.category_name, value: String(c.id) })),
              ]}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              containerClassName="w-56"
            />
          )}

          {activeTab === "zone" && (
            <Select
              options={[
                { label: "เลือกโซนทั้งหมด", value: "" },
                ...zones.map((z) => ({ label: z.zone_name, value: String(z.id) })),
              ]}
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              containerClassName="w-56"
            />
          )}

          {activeTab === "brand" && (
            <Select
              options={[
                { label: "เลือกแบรนด์ทั้งหมด", value: "" },
                ...brands.map((b) => ({ label: b.brand_name, value: String(b.id) })),
              ]}
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              containerClassName="w-56"
            />
          )}

          <div className="flex-none">
            <Button
              className="w-full sm:w-auto flex items-center gap-2"
              onClick={() => setAddSignal(prev => prev + 1)}
            >
              <Plus className="h-4 w-4" />
              {activeTab === "category" && "เพิ่มประเภทสินค้า"}
              {activeTab === "unit" && "เพิ่มหน่วยสินค้า"}
              {activeTab === "zone" && "เพิ่มโซน/ชั้นวาง"}
              {activeTab === "brand" && "เพิ่มแบรนด์/โมเดล"}
              {activeTab === "supplier" && "เพิ่มบริษัทสั่งซื้อ"}
              {activeTab === "grade" && "เพิ่มเกรดสินค้า"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Render Active Tab Table Content */}
      <Card noPadding className="overflow-hidden">
        {activeTab === "category" && (
          <CategoryTab
            search={search}
            categoryFilter={categoryFilter}
            categories={categories}
            setCategories={setCategories}
            addSignal={addSignal}
          />
        )}
        {activeTab === "unit" && (
          <UnitTab
            search={search}
            units={units}
            loadData={refreshData}
            addSignal={addSignal}
          />
        )}
        {activeTab === "zone" && (
          <ZoneTab
            search={search}
            zoneFilter={zoneFilter}
            zones={zones}
            shelves={shelves}
            loadData={refreshData}
            addSignal={addSignal}
          />
        )}
        {activeTab === "brand" && (
          <BrandTab
            search={search}
            brandFilter={brandFilter}
            brands={brands}
            reloadBrands={reloadBrands}
            addSignal={addSignal}
          />
        )}
        {activeTab === "supplier" && (
          <SupplierTab
            search={search}
            suppliers={suppliers}
            loadData={refreshData}
            addSignal={addSignal}
          />
        )}
        {activeTab === "grade" && (
          <GradeTab
            search={search}
            grades={grades}
            loadData={refreshData}
            addSignal={addSignal}
          />
        )}
      </Card>
    </div>
  );
}

export default function Stockdata() {
  return (
    <ToastProvider position="bottom-right">
      <StockDataContent />
    </ToastProvider>
  );
}