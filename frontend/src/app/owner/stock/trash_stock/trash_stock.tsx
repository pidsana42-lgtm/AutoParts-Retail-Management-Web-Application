import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, RotateCcw, Search } from "lucide-react";

import Heading from "../../../../components/elements/heading";
import Breadcrumb from "../../../../components/elements/breadcrumb";
import Text from "../../../../components/elements/text";
import Card from "../../../../components/elements/card";
import Input from "../../../../components/elements/input";
import Button from "../../../../components/elements/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../../components/elements/table";
import { getDeletedProductsList, restoreProduct } from "../../../../service/http/wms/product";
import type { StockItem } from "../../../../interface/wms/product";
import { buildProductSearchIndex, searchProductIndex } from "../../../../utils/productSearch";

// แสดงเฉพาะสินค้าที่ถูกลบไม่เกิน 14 วัน — เกินกว่านี้ไม่ต้องแสดงในถังขยะแล้ว (ข้อมูลจริงยังอยู่ครบในระบบ แค่ไม่โชว์ในหน้านี้)
const TRASH_RETENTION_DAYS = 14;

// หน้าถังขยะสินค้า — สินค้าที่ลบเป็น soft delete เสมอ (ข้อมูลจริงยังอยู่ครบ) เลยกู้คืนกลับมาได้จากที่นี่
export default function TrashStockPage() {
  const navigate = useNavigate();
  const [deletedProducts, setDeletedProducts] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [restoringId, setRestoringId] = useState<number | null>(null);

  const loadDeleted = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getDeletedProductsList();
      setDeletedProducts(data);
    } catch (err) {
      console.error("Failed to load deleted products:", err);
      setError("ไม่สามารถดึงข้อมูลสินค้าที่ถูกลบได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeleted();
  }, []);

  // ตัดสินค้าที่ลบเกิน 14 วันแล้วออกจากรายการที่แสดง (ข้อมูลจริงยังอยู่ในระบบ แค่ไม่โชว์ในถังขยะอีกต่อไป)
  const recentlyDeleted = useMemo(() => {
    const cutoff = Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    return deletedProducts.filter((p) => {
      if (!p.DeletedAt) return true; // ไม่มีวันที่ลบ (ไม่ควรเกิดขึ้น) ให้แสดงไว้ก่อนเผื่อพลาด
      const deletedAt = new Date(p.DeletedAt).getTime();
      return isNaN(deletedAt) || deletedAt >= cutoff;
    });
  }, [deletedProducts]);

  // สร้าง index ไว้แค่ตอน recentlyDeleted เปลี่ยน แล้วค่อยค้นหาแบบ fuzzy ทุกครั้งที่ query เปลี่ยน
  const searchIndex = useMemo(() => buildProductSearchIndex(recentlyDeleted), [recentlyDeleted]);
  const filtered = useMemo(
    () => searchProductIndex(searchIndex, search, recentlyDeleted),
    [searchIndex, search, recentlyDeleted]
  );

  const handleRestore = async (product: StockItem) => {
    const confirmed = window.confirm(`ต้องการกู้คืนสินค้า "${product.Name}" กลับมาใช้งานหรือไม่?`);
    if (!confirmed) return;

    try {
      setRestoringId(product.ID);
      await restoreProduct(product.ID);
      setDeletedProducts((prev) => prev.filter((p) => p.ID !== product.ID));
    } catch (err: any) {
      console.error("Error restoring product:", err);
      alert(err.response?.data?.error || "เกิดข้อผิดพลาดในการกู้คืนสินค้า");
    } finally {
      setRestoringId(null);
    }
  };

  const formatDeletedAt = (iso?: string) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleString("th-TH", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-6 p-6">
      <Breadcrumb items={[{ label: "คลังสินค้า", path: "/owner/stock" }, { label: "ถังขยะสินค้า" }]} />

      {/* Header */}
      <div>
        <Heading level="h1" className="mb-1">ถังขยะสินค้า</Heading>
        <Text variant="muted" className="mb-0">
          สินค้าที่ถูกลบไว้ กู้คืนกลับมาใช้งานได้ภายใน {TRASH_RETENTION_DAYS} วันหลังจากลบ พ้นกำหนดนี้จะไม่แสดงในรายการนี้อีก
        </Text>
      </div>

      <Card noPadding>
        <div className="px-5 py-4">
          <Input
            leftIcon={<Search className="h-4 w-4" />}
            placeholder="ค้นหาด้วยชื่อสินค้า หรือรหัสสินค้า..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </Card>

      <Card className="overflow-hidden" noPadding>
        {loading ? (
          <div className="p-6 text-center text-slate-500">กำลังโหลดข้อมูล...</div>
        ) : error ? (
          <div className="p-6 text-center font-medium text-red-600">{error}</div>
        ) : (
          <Table>
            <TableHeader className="bg-[#f6f3f2] text-[#797878]">
              <TableRow>
                <TableHead className="pl-6">รหัสสินค้า</TableHead>
                <TableHead>ชื่อสินค้า</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead>คงเหลือตอนลบ</TableHead>
                <TableHead>วันที่ลบ</TableHead>
                <TableHead className="text-right pr-6">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-gray-700">
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-slate-400">
                    {search ? "ไม่พบสินค้าที่ค้นหาในถังขยะ" : "ไม่มีสินค้าที่ถูกลบอยู่ในถังขยะ"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((product) => (
                  <TableRow key={product.ID} className="hover:bg-gray-50/70">
                    <TableCell className="pl-6 font-semibold text-gray-900">{product.ProductCode}</TableCell>
                    <TableCell className="text-gray-600">{product.Name}</TableCell>
                    <TableCell className="text-gray-600">{product.Category || "-"}</TableCell>
                    <TableCell className="text-gray-600">
                      {product.Stock} {product.Unit || "ชิ้น"}
                    </TableCell>
                    <TableCell className="text-gray-500">{formatDeletedAt(product.DeletedAt)}</TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/owner/stock/${product.ID}`)}
                          className="cursor-pointer rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                          aria-label="ดูรายละเอียด"
                          title="ดูรายละเอียด"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <Button
                          onClick={() => handleRestore(product)}
                          disabled={restoringId === product.ID}
                          variant="outline"
                          className="flex items-center gap-1.5"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          กู้คืน
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
