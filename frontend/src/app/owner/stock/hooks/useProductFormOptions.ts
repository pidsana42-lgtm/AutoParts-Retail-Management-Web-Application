import { useEffect, useState } from "react";
import { getGradesList, getUnitsList } from "../../../../service/http/wms/product";
import { stockDataService } from "../../../../service/http/wms/stock_data_service";
import type { CascaderOption } from "../../../../components/elements/cascader";

interface SelectOption {
  label: string;
  value: string;
}

interface ProductFormOptions {
  models: SelectOption[];
  categories: CascaderOption[];
  grades: SelectOption[];
  units: SelectOption[];
  zones: CascaderOption[];
  loading: boolean;
}

// ดึงข้อมูลอ้างอิงที่ฟอร์มเพิ่ม/แก้ไขสินค้าต้องใช้ (รุ่นรถ, หมวดหมู่ 3 ระดับ, เกรด, หน่วยนับ, โซนจัดเก็บ)
// แยกออกมาจาก stock.tsx เดิม เพื่อให้หน้าเพิ่ม/แก้ไขสินค้า (ที่ตอนนี้แยกเป็นหน้าของตัวเอง) ดึงข้อมูลเองได้โดยไม่ต้องรับผ่าน props
export function useProductFormOptions(): ProductFormOptions {
  const [models, setModels] = useState<SelectOption[]>([]);
  const [categories, setCategories] = useState<CascaderOption[]>([]);
  const [grades, setGrades] = useState<SelectOption[]>([]);
  const [units, setUnits] = useState<SelectOption[]>([]);
  const [zones, setZones] = useState<CascaderOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        setLoading(true);

        // หมวดหมู่: ประเภทหลัก -> ประเภทย่อย -> ประเภทย่อยย่อย
        const [allCats, allSubs, allSubSubs] = await Promise.all([
          stockDataService.getCategories(),
          stockDataService.getSubCategories(),
          stockDataService.getSubSubCategories(),
        ]);

        // ต้อง prefix ค่า value ตามประเภท (category-/subcategory-/subsubcategory-) เพราะ Category, SubCategory,
        // SubSubCategory เป็นคนละตารางกัน ต่างก็มี auto-increment id ของตัวเอง — ถ้าใช้ id เปล่าๆ ตรงๆ
        // id ที่ซ้ำกันข้ามตาราง (เช่น category id=2 กับ subcategory id=2) จะถูก TreeSelect ไฮไลต์เป็น "เลือกอยู่" พร้อมกันทั้งคู่
        const catMap = new Map<number, CascaderOption>();
        allCats.forEach((cat) => {
          catMap.set(cat.id, { value: `category-${cat.id}`, label: cat.category_name, children: [] });
        });
        allSubs.forEach((sub) => {
          const parentCat = catMap.get(sub.category_id);
          if (parentCat) {
            if (!parentCat.children) parentCat.children = [];
            parentCat.children.push({ value: `subcategory-${sub.id}`, label: sub.sub_category_name, children: [] });
          }
        });
        allSubSubs.forEach((ssc) => {
          for (const cat of catMap.values()) {
            const parentSub = cat.children?.find((c) => c.value === `subcategory-${ssc.sub_category_id}`);
            if (parentSub) {
              if (!parentSub.children) parentSub.children = [];
              parentSub.children.push({ value: `subsubcategory-${ssc.id}`, label: ssc.sub_sub_category_name });
              break;
            }
          }
        });

        // รุ่นรถ: แบรนด์ -> รุ่น
        const brandList = await stockDataService.getBrands();
        const modelOptions: SelectOption[] = [];
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

        const [gradeList, unitList, shelfList, zoneList] = await Promise.all([
          getGradesList(),
          getUnitsList(),
          stockDataService.getShelves(),
          stockDataService.getZones(),
        ]);

        // โซนจัดเก็บ: โซน -> ตู้/ชั้นวาง -> ระดับชั้น — prefix เหตุผลเดียวกับหมวดหมู่ด้านบน
        // (Zone, Shelf, ShelfLevel เป็นคนละตาราง id ชนกันได้)
        const zMap = new Map<number, CascaderOption>();
        zoneList.forEach((z) => {
          zMap.set(z.id, { value: `zone-${z.id}`, label: z.zone_name, children: [] });
        });
        shelfList.forEach((s) => {
          const pz = zMap.get(s.zone_id);
          if (pz) {
            if (!pz.children) pz.children = [];
            const sNode: CascaderOption = { value: `shelf-${s.id}`, label: s.shelf_name };
            if (s.shelf_levels && s.shelf_levels.length > 0) {
              sNode.children = s.shelf_levels.map((l) => ({ value: `level-${l.id}`, label: l.level_name }));
            }
            pz.children.push(sNode);
          }
        });

        if (!alive) return;
        setCategories(Array.from(catMap.values()));
        setModels(modelOptions);
        setGrades(gradeList.map((g) => ({ label: g.name, value: String(g.id) })));
        setUnits(unitList.map((u) => ({ label: u.name, value: String(u.id) })));
        setZones(Array.from(zMap.values()));
      } catch (err) {
        console.error("Failed to load product form reference data:", err);
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, []);

  return { models, categories, grades, units, zones, loading };
}
