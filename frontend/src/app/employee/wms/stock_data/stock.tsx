import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList,
  TriangleAlert,
  Landmark,
  Filter,
  SquarePen,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Eye,
} from "lucide-react";

import Card from "../../../../components/elements/card";
import Heading from "../../../../components/elements/heading";
import Text from "../../../../components/elements/text";
import Input from "../../../../components/elements/input";
import Select from "../../../../components/elements/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../../components/elements/table";
import Button from "../../../../components/elements/button";
import TreeSelect from "../../../../components/elements/tree_select";
import type { CascaderOption } from "../../../../components/elements/cascader";

// นำเข้า API service สำหรับดึงข้อมูลสินค้า
import { getProductsList, getSuppliersList } from "../../../../service/http/wms/product";
import { stockDataService } from "../../../../service/http/wms/stock_data_service";

import type { StockItem } from "../../../../interface/wms/product";
import { cn } from "../../../../utils/component";

// คอนฟิก Badge ตามเกรดสินค้า
const GRADE_BADGE: Record<string, string> = {
  A: "bg-slate-900 text-white",
  S: "bg-slate-400 text-white",
  B: "bg-slate-300 text-slate-700",
};

// สร้างเลขหน้าแบบมี "..." คั่นเมื่อมีหลายหน้า (สไตล์เดียวกับหน้าใบสั่งซื้อ)
function getPageNumbers(current: number, total: number): (number | "...")[] {
  const delta = 1;
  const range: (number | "...")[] = [];
  const left = Math.max(2, current - delta);
  const right = Math.min(total - 1, current + delta);

  range.push(1);
  if (left > 2) range.push("...");
  for (let i = left; i <= right; i++) range.push(i);
  if (right < total - 1) range.push("...");
  if (total > 1) range.push(total);

  return range;
}

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
  const navigate = useNavigate();
  const [stockData, setStockData] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categoryNames, setCategoryNames] = useState<string[]>([]);
  const [supplier, setSupplier] = useState("");
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [suppliers, setSuppliers] = useState<{ label: string; value: string }[]>([]);
  const [formCascaderOptions, setFormCascaderOptions] = useState<CascaderOption[]>([]);

  const handleEditClick = (product: StockItem) => {
    navigate(`/owner/stock/${product.ID}/edit`);
  };

  const handleViewClick = (product: StockItem) => {
    navigate(`/employee/wms/stock-data/${product.ID}`);
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

  // กลับไปหน้า 1 ทุกครั้งที่ตัวกรองเปลี่ยน กันกรณีหน้าปัจจุบันเกินจำนวนหน้าที่กรองได้แล้ว
  useEffect(() => {
    setPage(1);
  }, [search, categoryNames, supplier, itemsPerPage]);

  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const pagedData = useMemo(
    () => filteredData.slice((page - 1) * itemsPerPage, page * itemsPerPage),
    [filteredData, page, itemsPerPage]
  );

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
        {/* <Button
          onClick={() => navigate("/owner/stock/new")}
          variant="primary"
          className="flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          เพิ่มข้อมูลสินค้า
        </Button> */}
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
            <div className="w-full sm:w-56">
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
      <Card className="overflow-hidden" noPadding>
        <Table>
          <TableHeader className="bg-[#f6f3f2] text-[#797878]">
            <TableRow>
              <TableHead className="pl-6">รหัสสินค้า</TableHead>
              <TableHead>ชื่อสินค้า</TableHead>
              <TableHead>PART NO.</TableHead>
              <TableHead>แบรนด์ - รุ่นรถ</TableHead>
              <TableHead>ประเภท</TableHead>
              <TableHead className="text-center">เกรด</TableHead>
              <TableHead>คลังคงเหลือ / ขั้นต่ำ</TableHead>
              <TableHead className="text-right pr-6">จัดการ</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody className="text-gray-700">
            {pagedData.length > 0 ? (
              pagedData.map((row) => {
                const gradeKey = row.Grade?.toUpperCase() || "A";
                return (
                  <TableRow key={row.ID} className="hover:bg-gray-50/70">
                    <TableCell className="pl-6 font-semibold text-gray-900">{row.ProductCode}</TableCell>
                    <TableCell className="text-gray-600">{row.Name}</TableCell>
                    <TableCell className="text-gray-600">{row.PartNo || "-"}</TableCell>
                    <TableCell>
                      <span className="font-semibold text-slate-700">
                        {row.Models && row.Models.length > 0
                          ? row.Models.map((m) => `${m.brand_name} ${m.model_name}`).join(", ")
                          : "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                        {row.Category || "ทั่วไป"}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={cn(
                          "inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold",
                          GRADE_BADGE[gradeKey] || "bg-slate-200"
                        )}
                      >
                        {gradeKey}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StockLevelBar stock={row.Stock} minStock={row.MinStock} />
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-3 text-slate-400">
                        <button
                          onClick={() => handleViewClick(row)}
                          className="hover:text-blue-600"
                          aria-label="ดูรายละเอียด"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {/* <button
                          onClick={() => handleEditClick(row)}
                          className="hover:text-slate-700"
                          aria-label="แก้ไข"
                        >
                          <SquarePen className="h-4 w-4" />
                        </button>
                        <button className="hover:text-red-600" aria-label="ลบ">
                          <Trash2 className="h-4 w-4" />
                        </button> */}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-gray-500">
                  ไม่พบรายการอะไหล่ในระบบสต็อก
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination footer */}
        {totalItems > 0 && (
          <div className="bg-[#fcfbfa] px-6 py-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span>
                แสดง {Math.min((page - 1) * itemsPerPage + 1, totalItems)} ถึง{" "}
                {Math.min(page * itemsPerPage, totalItems)} จาก {totalItems} รายการ
              </span>
              <div className="flex items-center gap-2">
                <span>รายการต่อหน้า:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="border border-gray-200 rounded-none px-2 py-1 text-gray-600 bg-white hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-200 cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage(1)}
                aria-label="หน้าแรก"
                className="p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                aria-label="หน้าก่อนหน้า"
                className="p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {getPageNumbers(page, totalPages).map((p, idx) =>
                p === "..." ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">
                    ...
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    aria-current={page === p ? "page" : undefined}
                    className={cn(
                      "px-3 py-1.5 rounded-none font-medium transition-colors cursor-pointer",
                      page === p ? "bg-[#d61c24] text-white" : "text-gray-600 hover:bg-gray-100"
                    )}
                  >
                    {p}
                  </button>
                )
              )}

              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                aria-label="หน้าถัดไป"
                className="p-1.5 rounded-none text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(totalPages)}
                aria-label="หน้าสุดท้าย"
                className="p-1.5 rounded-none text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
