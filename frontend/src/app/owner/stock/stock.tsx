import { useMemo, useState, useEffect } from "react";
import {
  ClipboardList,
  TriangleAlert,
  Landmark,
  Filter,
  Barcode,
  Cog,
  Disc,
  Droplet,
  Zap,
  SquarePen,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";

import Card from "../../../components/elements/card";
import Heading from "../../../components/elements/heading";
import Text from "../../../components/elements/text";
import Input from "../../../components/elements/input";
import Select from "../../../components/elements/select";
import Table, { type TableColumn } from "../../../components/elements/table";
import Button from "../../../components/elements/button";
import TreeSelect from "../../../components/elements/tree_select";
import AddDataStock from "./add_data_stock/add_data_stock";
import EditDataStock from "./edit_data_stock/edit_data_stock";
import type { CascaderOption } from "../../../components/elements/cascader";

// นำเข้า API service สำหรับดึงข้อมูลสินค้า
import {
  getProductsList,
  getSuppliersList,
  getGradesList,
  getUnitsList,
} from "../../../service/http/wms/product";
import { stockDataService } from "../../../service/http/wms/stock_data_service";

import type { StockItem } from "../../../interface/wms/product";

// คอนฟิกไอคอนตามประเภทสินค้า (รองรับตัวพิมพ์ใหญ่จากหลังบ้าน)
const CATEGORY_ICON: Record<string, { icon: typeof Cog; className: string }> = {
  ENGINE: { icon: Cog, className: "bg-slate-800" },
  BRAKING: { icon: Disc, className: "bg-red-900" },
  MAINT: { icon: Droplet, className: "bg-amber-600" },
  "MAINT.": { icon: Droplet, className: "bg-amber-600" },
  ELECTRICAL: { icon: Zap, className: "bg-slate-600" },
};

// คอนฟิก Badge ตามเกรดสินค้า
const GRADE_BADGE: Record<string, string> = {
  A: "bg-slate-900 text-white",
  S: "bg-slate-400 text-white",
  B: "bg-slate-300 text-slate-700",
};



// -----------------------------------------------------------------------------
// Presentational Helpers
// -----------------------------------------------------------------------------
function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof ClipboardList;
  label: string;
  value: string;
  tone: "green" | "red" | "dark";
}) {
  const toneClasses: Record<typeof tone, string> = {
    green: "bg-green-600 text-white",
    red: "bg-red-600 text-white",
    dark: "bg-slate-900 text-white",
  };

  return (
    <div className={["rounded-none border border-slate-200 px-5 py-4 shadow-sm", toneClasses[tone]].join(" ")}>
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</span>
        <Icon className="h-5 w-5 opacity-90" />
      </div>
      <p className="mt-3 text-2xl font-bold">{value}</p>
    </div>
  );
}

function StockLevelBar({ stock, minStock }: { stock: number; minStock: number }) {
  const isLow = stock <= minStock;
  const ratio = Math.min(stock / Math.max(minStock * 2, 1), 1);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-1">
        <span className={["text-sm font-semibold", isLow ? "text-red-600" : "text-green-600"].join(" ")}>
          {stock}
        </span>
        <span className="text-xs text-slate-400">/ {minStock}</span>
      </div>
      <div className="h-1 w-16 overflow-hidden rounded-full bg-slate-100">
        <div
          className={["h-full rounded-full", isLow ? "bg-red-500" : "bg-green-500"].join(" ")}
          style={{ width: `${Math.max(ratio * 100, 8)}%` }}
        />
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Page Component
// -----------------------------------------------------------------------------
export default function StockPage() {
  const [stockData, setStockData] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categoryNames, setCategoryNames] = useState<string[]>([]);
  const [supplier, setSupplier] = useState("");
  const [page, setPage] = useState(1);

  const [suppliers, setSuppliers] = useState<{ label: string; value: string }[]>([]);

  // States สำหรับปุ่มและแบบฟอร์มเพิ่มสินค้า (Add Product)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formCascaderOptions, setFormCascaderOptions] = useState<CascaderOption[]>([]);
  const [zoneCascaderOptions, setZoneCascaderOptions] = useState<CascaderOption[]>([]);
  const [models, setModels] = useState<{ label: string; value: string }[]>([]);
  const [grades, setGrades] = useState<{ label: string; value: string }[]>([]);
  const [units, setUnits] = useState<{ label: string; value: string }[]>([]);

  // States สำหรับแก้ไขสินค้า (Edit Product)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StockItem | null>(null);

  const handleEditClick = (product: StockItem) => {
    setSelectedProduct(product);
    setIsEditModalOpen(true);
  };



  const fetchStock = async () => {
    try {
      setLoading(true);
      const data = await getProductsList();
      setStockData(data);

      // Fetch and build the Cascader Tree for Category -> SubCategory -> SubSubCategory

      const allCats = await stockDataService.getCategories();
      const allSubs = await stockDataService.getSubCategories();
      const allSubSubs = await stockDataService.getSubSubCategories();

      const catMap = new Map<number, CascaderOption>();

      // 1. นำประเภทหลักทั้งหมดมาใส่ใน Map
      allCats.forEach(cat => {
        catMap.set(cat.id, {
          value: String(cat.id),
          label: cat.category_name,
          children: []
        });
      });

      // 2. นำประเภทย่อยมาต่อในประเภทหลัก
      allSubs.forEach(sub => {
        const parentCat = catMap.get(sub.category_id);
        if (parentCat) {
          if (!parentCat.children) parentCat.children = [];
          parentCat.children.push({
            value: String(sub.id),
            label: sub.sub_category_name,
            children: []
          });
        }
      });

      // 3. นำประเภทย่อยย่อยมาต่อในประเภทย่อย
      allSubSubs.forEach(ssc => {
        for (const cat of catMap.values()) {
          const parentSub = cat.children?.find(c => c.value === String(ssc.sub_category_id));
          if (parentSub) {
            if (!parentSub.children) parentSub.children = [];
            parentSub.children.push({
              value: String(ssc.id),
              label: ssc.sub_sub_category_name
            });
            break;
          }
        }
      });

      // กรองเอาเฉพาะข้อมูลที่มีอยู่
      setFormCascaderOptions(Array.from(catMap.values()));

      const sups = await getSuppliersList();
      setSuppliers([
        { label: "บริษัททั้งหมด", value: "" },
        ...sups.map((s) => ({ label: s.name, value: s.name })),
      ]);

      const brandList = await stockDataService.getBrands();
      const modelOptions: { label: string; value: string }[] = [];
      brandList.forEach((b) => {
        if (b.models && b.models.length > 0) {
          b.models.forEach((m) => {
            modelOptions.push({
              label: `${b.brand_name} - ${m.model_name}`,
              value: String((m as any).ID || m.id),
            });
          });
        }
      });
      setModels(modelOptions);

      const gradeList = await getGradesList();
      setGrades(gradeList.map((g) => ({ label: g.name, value: String(g.id) })));

      const unitList = await getUnitsList();
      setUnits(unitList.map((u) => ({ label: u.name, value: String(u.id) })));

      const shelfList = await stockDataService.getShelves();

      const zoneList = await stockDataService.getZones();
      const zMap = new Map<number, CascaderOption>();
      zoneList.forEach(z => {
        zMap.set(z.id, {
          value: String(z.id),
          label: z.zone_name,
          children: []
        });
      });
      shelfList.forEach(s => {
        const pz = zMap.get(s.zone_id);
        if (pz) {
          if (!pz.children) pz.children = [];
          const sNode: CascaderOption = { value: String(s.id), label: s.shelf_name };
          if (s.shelf_levels && s.shelf_levels.length > 0) {
            sNode.children = s.shelf_levels.map(l => ({
              value: String(l.id),
              label: l.level_name
            }));
          }
          pz.children.push(sNode);
        }
      });
      setZoneCascaderOptions(Array.from(zMap.values()));
    } catch (err) {
      console.error("Failed to load products from API:", err);
      setError("ไม่สามารถดึงข้อมูลสินค้าจากระบบคลังได้");
    } finally {
      setLoading(false);
    }
  };

  // ดึงข้อมูลจริงจาก Go Backend (เรียกผ่าน ListProducts Controller)
  useEffect(() => {
    fetchStock();
  }, []);

  // สร้าง options สำหรับ TreeSelect โดยทำให้ value ไม่ซ้ำกัน (ป้องกันบัค ID ชนกันระหว่าง Table)
  const treeSelectOptions = useMemo(() => {
    const mapUnique = (options: CascaderOption[], parentValue = ""): CascaderOption[] => {
      return options.map((opt) => {
        const uniqueValue = parentValue ? `${parentValue}-${opt.value}` : opt.value;
        return {
          ...opt,
          value: uniqueValue,
          children: opt.children ? mapUnique(opt.children, uniqueValue) : undefined,
        };
      });
    };
    return [{ label: "ประเภททั้งหมด", value: "" }, ...mapUnique(formCascaderOptions)];
  }, [formCascaderOptions]);

  // ระบบค้นหาและกรองข้อมูล (Filter & Search)
  const filteredData = useMemo(() => {
    return stockData.filter((item) => {
      const matchesSearch =
        !search ||
        (item.Name && item.Name.toLowerCase().includes(search.toLowerCase())) ||
        (item.ProductCode && item.ProductCode.toLowerCase().includes(search.toLowerCase()));

      let matchesCategory = true;
      if (categoryNames.length > 0) {
        if (categoryNames[0]) {
          matchesCategory = matchesCategory && !!(item.Category && item.Category.toUpperCase() === categoryNames[0].toUpperCase());
        }
        if (categoryNames[1]) {
          matchesCategory = matchesCategory && !!(item.SubCategory && item.SubCategory.toUpperCase() === categoryNames[1].toUpperCase());
        }
        if (categoryNames[2]) {
          matchesCategory = matchesCategory && !!(item.SubSubCategory && item.SubSubCategory.toUpperCase() === categoryNames[2].toUpperCase());
        }
      }

      const matchesSupplier = !supplier || (item.Supplier && item.Supplier.toUpperCase() === supplier.toUpperCase());

      return matchesSearch && matchesCategory && matchesSupplier;
    });
  }, [stockData, search, categoryNames, supplier]);

  // คำนวณ Summary การ์ดด้านบนจาก Database จริง
  const totalSkus = stockData.length;
  const lowStockCount = stockData.filter((item) => item.Stock <= item.MinStock).length;

  // คำนวณมูลค่าสินทรัพย์รวมในคลัง (Stock * Price)
  const totalAssetValue = useMemo(() => {
    const total = stockData.reduce((acc, item) => acc + (item.Stock * (item.Price || 0)), 0);
    if (total >= 1000000) {
      return `฿${(total / 1000000).toFixed(1)}M`;
    }
    return `฿${total.toLocaleString()}`;
  }, [stockData]);

  const columns: TableColumn<StockItem>[] = [
    {
      key: "ID",
      header: "ID",
      width: "70px",
      render: (row) => <span className="text-slate-400">{row.ID}</span>,
    },
    {
      key: "image",
      header: "รูปภาพ",
      width: "70px",
      render: (row) => {
        const catConfig = CATEGORY_ICON[row.Category?.toUpperCase()] || { icon: Cog, className: "bg-slate-800" };
        const Icon = catConfig.icon;
        return (
          <div className={["flex h-9 w-9 items-center justify-center rounded-md", catConfig.className].join(" ")}>
            <Icon className="h-4 w-4 text-white" />
          </div>
        );
      },
    },
    {
      key: "product",
      header: "รหัสสินค้า / ชื่อสินค้า",
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-800">{row.ProductCode}</p>
          <p className="text-xs text-slate-400">{row.Name}</p>
        </div>
      ),
    },
    {
      key: "PartNo",
      header: "PART NO.",
      render: (row) => <span className="text-slate-600">{row.PartNo || "-"}</span>,
    },
    {
      key: "Barcode",
      header: "บาร์โค้ด",
      render: (row) => (
        <div className="flex items-center gap-1.5 text-slate-500">
          <Barcode className="h-3.5 w-3.5 shrink-0" />
          <span>{row.Barcode || "-"}</span>
        </div>
      ),
    },
    {
      key: "Models",
      header: "แบรนด์ - รุ่นรถ",
      render: (row) => (
        <span className="font-semibold text-slate-700">
          {row.Models && row.Models.length > 0
            ? row.Models.map(m => `${m.brand_name} ${m.model_name}`).join(", ")
            : "-"}
        </span>
      ),
    },
    {
      key: "Category",
      header: "ประเภท",
      render: (row) => (
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
          {row.Category || "ทั่วไป"}
        </span>
      ),
    },
    {
      key: "Grade",
      header: "เกรด",
      align: "center",
      render: (row) => {
        const gradeKey = row.Grade?.toUpperCase() || "A";
        return (
          <span className={["inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold", GRADE_BADGE[gradeKey] || "bg-slate-200"].join(" ")}>
            {gradeKey}
          </span>
        );
      },
    },
    {
      key: "stockLevel",
      header: "คลังคงเหลือ / ขั้นต่ำ",
      render: (row) => <StockLevelBar stock={row.Stock} minStock={row.MinStock} />,
    },
    {
      key: "actions",
      header: "จัดการ",
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-3 text-slate-400">
          <button
            onClick={() => handleEditClick(row)}
            className="hover:text-slate-700"
            aria-label="แก้ไข"
          >
            <SquarePen className="h-4 w-4" />
          </button>
          <button className="hover:text-red-600" aria-label="ลบ">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  if (loading) return <div className="p-6 text-slate-500 text-center">กำลังเชื่อมต่อฐานข้อมูลคลังสินค้า...</div>;
  if (error) return <div className="p-6 text-red-600 text-center font-medium">{error}</div>;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Heading level="h1" className="mb-1">จัดการคลังสินค้า</Heading>
          <Text variant="muted" className="mb-0">จัดการคลังสินค้าและอะไหล่จริงจากระบบ</Text>
        </div>
        <Button
          onClick={() => setIsAddModalOpen(true)}
          variant="primary"
          className="flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          เพิ่มข้อมูลสินค้า
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard icon={ClipboardList} label="Total SKUs" value={totalSkus.toLocaleString()} tone="green" />
        <StatCard icon={TriangleAlert} label="Low Stock Alert" value={String(lowStockCount)} tone="red" />
        <StatCard icon={Landmark} label="Total Asset Value" value={totalAssetValue} tone="dark" />
      </div>

      {/* Filter bar */}
      <Card noPadding>
        <div className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center">
          <div className="flex-1">
            <Input
              leftIcon={<Filter className="h-4 w-4" />}
              placeholder="ค้นหาด้วยชื่อสินค้า หรือรหัสสินค้า..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <div className="w-full sm:w-56 relative z-50">
              <TreeSelect
                options={treeSelectOptions}
                placeholder="เลือกประเภท"
                value={categoryId}
                onChange={(val, path) => {
                  setCategoryId(val);
                  if (!val) {
                    setCategoryNames([]);
                  } else {
                    setCategoryNames(path.map(p => p.label));
                  }
                }}
              />
            </div>
            <Select
              options={suppliers}
              placeholder="เลือกซัพพลายเออร์"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              containerClassName="w-48"
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card noPadding>
        <Table
          columns={columns}
          data={filteredData}
          rowKey={(row) => row.ID}
          emptyText="ไม่พบรายการอะไหล่ในระบบสต็อก"
        />

        {/* Pagination footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-slate-400">
          <span>Showing 1 to {filteredData.length} of {totalSkus.toLocaleString()} entries</span>
          <div className="flex items-center gap-1">
            <button
              className="flex h-8 w-8 items-center justify-center rounded hover:bg-slate-100 disabled:opacity-40"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {[1, 2, 3].map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={[
                  "flex h-8 w-8 items-center justify-center rounded text-sm font-medium",
                  page === p ? "bg-red-600 text-white" : "hover:bg-slate-100 text-slate-500",
                ].join(" ")}
              >
                {p}
              </button>
            ))}
            <button
              className="flex h-8 w-8 items-center justify-center rounded hover:bg-slate-100"
              onClick={() => setPage((p) => Math.min(3, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Card>
      {/* Modal สำหรับเพิ่มสินค้าใหม่ (ดึงแยกไฟล์) */}
      <AddDataStock
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          setIsAddModalOpen(false);
          fetchStock();
        }}
        models={models}
        categories={treeSelectOptions.filter(o => o.value !== "")}
        grades={grades}
        units={units}
        zones={zoneCascaderOptions}
      />

      {/* Modal สำหรับแก้ไขสินค้า (ดึงแยกไฟล์) */}
      <EditDataStock
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedProduct(null);
        }}
        onSuccess={fetchStock}
        categories={treeSelectOptions.filter(o => o.value !== "")}
        models={models}
        product={selectedProduct}
        grades={grades}
        units={units}
        zones={zoneCascaderOptions}
      />
    </div>
  );
}