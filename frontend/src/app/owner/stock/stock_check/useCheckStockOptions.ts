import { useEffect, useState } from "react";
import { useToast } from "../../../../components/elements/toast";
import { stockCheckService, type Employee } from "../../../../service/http/wms/stock_check_service";
import { getProductsList } from "../../../../service/http/wms/product";
import type { StockItem } from "../../../../interface/wms/product";

// ดึงข้อมูลตัวเลือกที่หน้าเพิ่ม/แก้ไขตารางเช็คสต็อกต้องใช้ร่วมกัน: พนักงาน, โซนจัดเก็บ, หมวดหมู่, รายการสินค้า (พร้อมรูปสินค้า)
export function useCheckStockOptions() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<StockItem[]>([]);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        setLoading(true);
        const [emps, zns, cats, prods] = await Promise.all([
          stockCheckService.getEmployees(),
          stockCheckService.getZoneTree(),
          stockCheckService.getCategoryTree(),
          getProductsList(), // ได้ ThumbnailUrl ของแต่ละสินค้ามาด้วยอยู่แล้ว
        ]);
        if (!alive) return;
        setEmployees(emps);
        setZones(zns);
        setCategories(cats);
        setProducts(prods);
      } catch (err) {
        console.error(err);
        toast({ variant: "error", message: "ไม่สามารถโหลดข้อมูลตัวเลือกได้" });
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, []);

  return { loading, employees, zones, categories, products };
}
