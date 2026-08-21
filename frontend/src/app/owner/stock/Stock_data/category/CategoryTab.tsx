import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, SquarePen, Loader2 } from "lucide-react";
import { useToast } from "../../../../../components/elements/toast";

import { stockDataService } from "../../../../../service/http/wms/stock_data_service";
import type { Category, SubCategory, SubSubCategory } from "../../../../../interface/wms/stock_data";

// Extracted Modals
import EditCategoryRowModal from "./EditCategoryRowModal";
import AddCategorySubCategoryModal from "./AddCategorySubCategoryModal";
import TablePagination from "../components/TablePagination";

interface CategoryTabProps {
  search: string;
  categoryFilter: string;
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  addSignal?: number;
}

export default function CategoryTab({
  search,
  categoryFilter,
  categories,
  setCategories,
  addSignal,
}: CategoryTabProps) {
  const { toast } = useToast();
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [subSubCategories, setSubSubCategories] = useState<SubSubCategory[]>([]);
  const [loading, setLoading] = useState(false);

  // Modals visibility state
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"new_category" | "existing_category">("new_category");
  const [editRowOpen, setEditRowOpen] = useState(false);

  // Selected records for editing
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<SubCategory | null>(null);
  const [selectedSubSubCategory, setSelectedSubSubCategory] = useState<SubSubCategory | null>(null);
  const [initialCategoryId, setInitialCategoryId] = useState<number>();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    if (addSignal && addSignal > 0) {
      openAddCategoryButton();
    }
  }, [addSignal]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter]);

  const loadSubCategories = async () => {
    try {
      setLoading(true);
      const [subs, subSubs] = await Promise.all([
        stockDataService.getSubCategories(),
        stockDataService.getSubSubCategories(),
      ]);
      setSubCategories(subs);
      setSubSubCategories(subSubs);
    } catch (err) {
      toast({ variant: "error", message: "ไม่สามารถโหลดประเภทย่อยสินค้าได้" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubCategories();
  }, []);

  const reloadCategories = async () => {
    try {
      const [cats, subs, subSubs] = await Promise.all([
        stockDataService.getCategories(),
        stockDataService.getSubCategories(),
        stockDataService.getSubSubCategories(),
      ]);
      setCategories(cats);
      setSubCategories(subs);
      setSubSubCategories(subSubs);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm("คุณแน่ใจว่าต้องการลบประเภทหลักนี้?")) return;
    try {
      await stockDataService.deleteCategory(id);
      toast({ variant: "success", message: "ลบประเภทสินค้าสำเร็จ" });
      reloadCategories();
    } catch (err) {
      toast({ variant: "error", message: "เกิดข้อผิดพลาดในการลบประเภทสินค้า" });
    }
  };

  const handleDeleteSubCategory = async (id: number) => {
    if (!confirm("คุณแน่ใจว่าต้องการลบประเภทย่อยนี้?")) return;
    try {
      await stockDataService.deleteSubCategory(id);
      toast({ variant: "success", message: "ลบประเภทย่อยสำเร็จ" });
      reloadCategories();
    } catch (err) {
      toast({ variant: "error", message: "เกิดข้อผิดพลาดในการลบประเภทย่อย" });
    }
  };

  const handleDeleteSubSubCategory = async (id: number) => {
    if (!confirm("คุณแน่ใจว่าต้องการลบประเภทย่อยย่อยนี้?")) return;
    try {
      await stockDataService.deleteSubSubCategory(id);
      toast({ variant: "success", message: "ลบประเภทย่อยย่อยสำเร็จ" });
      reloadCategories();
    } catch (err) {
      toast({ variant: "error", message: "เกิดข้อผิดพลาดในการลบประเภทย่อยย่อย" });
    }
  };

  // Openers
  const openEditRow = (category: Category, subCategory?: SubCategory, subSubCategory?: SubSubCategory) => {
    setSelectedCategory(category);
    setSelectedSubCategory(subCategory || null);
    setSelectedSubSubCategory(subSubCategory || null);
    setEditRowOpen(true);
  };

  const openAddCategoryButton = () => {
    setInitialCategoryId(undefined);
    setAddMode("new_category");
    setAddOpen(true);
  };

  // --- Filtering ---
  const filteredRows = useMemo(() => {
    const list: {
      category: Category;
      subCategory?: SubCategory;
      subSubCategory?: SubSubCategory;
      isFirst: boolean;
      subCount: number;
    }[] = [];

    categories.forEach((cat) => {
      const subs = subCategories.filter((sub) => sub.category_id === cat.id);

      if (categoryFilter && String(cat.id) !== categoryFilter) {
        return;
      }

      const matchesSearch = (text: string) =>
        text.toLowerCase().includes(search.toLowerCase());

      const filteredSubs = subs.filter(
        (sub) =>
          !search ||
          matchesSearch(sub.sub_category_name) ||
          matchesSearch(sub.sub_category_short_name) ||
          matchesSearch(cat.category_name) ||
          matchesSearch(cat.category_short_name)
      );

      if (filteredSubs.length > 0) {
        filteredSubs.forEach((sub, index) => {
          const subSubs = subSubCategories.filter(ss => ss.sub_category_id === sub.id);
          if (subSubs.length > 0) {
            subSubs.forEach((ss, ssIdx) => {
                list.push({
                    category: cat,
                    subCategory: sub,
                    subSubCategory: ss,
                    isFirst: index === 0 && ssIdx === 0,
                    subCount: filteredSubs.length,
                });
            });
          } else {
            list.push({
              category: cat,
              subCategory: sub,
              isFirst: index === 0,
              subCount: filteredSubs.length,
            });
          }
        });
      } else if (
        !categoryFilter &&
        (!search ||
          matchesSearch(cat.category_name) ||
          matchesSearch(cat.category_short_name))
      ) {
        list.push({
          category: cat,
          isFirst: true,
          subCount: 0,
        });
      }
    });

    return list;
  }, [categories, subCategories, subSubCategories, search, categoryFilter]);

  // จัดกลุ่มแถวตามประเภทหลัก เพื่อแบ่งหน้าโดยไม่ตัดกลุ่มขาดจากกัน
  const groupedByCategory = useMemo(() => {
    const map = new Map<number, typeof filteredRows>();
    filteredRows.forEach((row) => {
      const key = row.category.id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    });
    return Array.from(map.values());
  }, [filteredRows]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return groupedByCategory.slice(start, start + itemsPerPage).flat();
  }, [groupedByCategory, currentPage, itemsPerPage]);

  if (loading) {
    return (
      <div className="py-10 text-center text-slate-400 flex items-center justify-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-[#B70011]" /> โหลดข้อมูลประเภท...
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="bg-[#f6f3f2] border-b border-slate-200">
              <th className="px-6 py-3.5 font-semibold text-[#797878]">ประเภทสินค้า</th>
              <th className="px-6 py-3.5 font-semibold text-[#797878]">ชื่อย่อ</th>
              <th className="px-6 py-3.5 font-semibold text-[#797878]">ประเภทย่อยของสินค้า</th>
              <th className="px-6 py-3.5 font-semibold text-[#797878]">ประเภทย่อยย่อย</th>
              <th className="px-6 py-3.5 font-semibold text-[#797878] text-right w-28">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                  ไม่พบข้อมูลประเภทสินค้า
                </td>
              </tr>
            ) : (
              paginatedRows.map((row, index) => (
                <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-3 text-slate-800 font-medium">{row.isFirst ? row.category.category_name : ""}</td>
                  <td className="px-6 py-3 text-slate-500">{row.isFirst ? (row.category.category_short_name || "-") : ""}</td>
                  <td className="px-6 py-3 text-slate-700">{row.subCategory?.sub_category_name || "-"}</td>
                  <td className="px-6 py-3 text-slate-600">{row.subSubCategory?.sub_sub_category_name || "-"}</td>
                  <td className="px-6 py-3 flex items-center justify-end gap-3 text-slate-400">
                      <button
                        onClick={() => openEditRow(row.category, row.subCategory, row.subSubCategory)}
                        className="hover:text-slate-700 transition-colors"
                        title="แก้ไข"
                      >
                        <SquarePen className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                            if (row.subSubCategory) handleDeleteSubSubCategory(row.subSubCategory.id);
                            else if (row.subCategory) handleDeleteSubCategory(row.subCategory.id);
                            else handleDeleteCategory(row.category.id);
                        }}
                        className="hover:text-red-600 transition-colors"
                        title="ลบ"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <TablePagination
        currentPage={currentPage}
        totalItems={groupedByCategory.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={(n) => {
          setItemsPerPage(n);
          setCurrentPage(1);
        }}
        itemLabel="ประเภทสินค้า"
      />

      {/* Modals */}
      <AddCategorySubCategoryModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        defaultMode={addMode}
        initialCategoryId={initialCategoryId}
        categories={categories}
        onSuccess={reloadCategories}
      />

      <EditCategoryRowModal
        isOpen={editRowOpen}
        onClose={() => setEditRowOpen(false)}
        category={selectedCategory}
        subCategory={selectedSubCategory}
        subSubCategory={selectedSubSubCategory}
        categories={categories}
        subCategories={subCategories}
        onSuccess={reloadCategories}
      />
    </>
  );
}
