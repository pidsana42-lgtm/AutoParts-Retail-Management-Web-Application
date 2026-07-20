import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, SquarePen, Loader2 } from "lucide-react";
import { useToast } from "../../../../../components/elements/toast";

import { stockDataService } from "../../../../../service/http/wms/stock_data_service";
import type { Category, SubCategory, SubSubCategory } from "../../../../../interface/wms/stock_data";

// Extracted Modals
import EditCategoryModal from "./EditCategoryModal";
import EditSubCategoryModal from "./EditSubCategoryModal";
import AddCategorySubCategoryModal from "./AddCategorySubCategoryModal";
import EditSubSubCategoryModal from "./EditSubSubCategoryModal";

interface CategoryTabProps {
  search: string;
  categoryFilter: string;
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
}

export default function CategoryTab({
  search,
  categoryFilter,
  categories,
  setCategories
}: CategoryTabProps) {
  const { toast } = useToast();
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [subSubCategories, setSubSubCategories] = useState<SubSubCategory[]>([]);
  const [loading, setLoading] = useState(false);

  // Modals visibility state
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"new_category" | "existing_category">("new_category");
  const [editCatOpen, setEditCatOpen] = useState(false);
  const [editSubOpen, setEditSubOpen] = useState(false);
  const [editSubSubOpen, setEditSubSubOpen] = useState(false);

  // Selected records for editing
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<SubCategory | null>(null);
  const [selectedSubSubCategory, setSelectedSubSubCategory] = useState<SubSubCategory | null>(null);
  const [initialSubCatId, setInitialSubCatId] = useState<number | undefined>(undefined);

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

  const loadAll = async () => {
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
      loadAll();
    } catch (err) {
      toast({ variant: "error", message: "เกิดข้อผิดพลาดในการลบประเภทสินค้า" });
    }
  };

  const handleDeleteSubCategory = async (id: number) => {
    if (!confirm("คุณแน่ใจว่าต้องการลบประเภทย่อยนี้?")) return;
    try {
      await stockDataService.deleteSubCategory(id);
      toast({ variant: "success", message: "ลบประเภทย่อยสำเร็จ" });
      loadAll();
    } catch (err) {
      toast({ variant: "error", message: "เกิดข้อผิดพลาดในการลบประเภทย่อย" });
    }
  };

  const handleDeleteSubSubCategory = async (id: number) => {
    if (!confirm("คุณแน่ใจว่าต้องการลบประเภทย่อยย่อยนี้?")) return;
    try {
      await stockDataService.deleteSubSubCategory(id);
      toast({ variant: "success", message: "ลบประเภทย่อยย่อยสำเร็จ" });
      loadAll();
    } catch (err) {
      toast({ variant: "error", message: "เกิดข้อผิดพลาดในการลบประเภทย่อยย่อย" });
    }
  };

  // Openers
  const openEditCategory = (cat: Category) => {
    setSelectedCategory(cat);
    setEditCatOpen(true);
  };

  const openAddSubCategoryInline = (catId?: number) => {
    setInitialSubCatId(catId);
    setAddMode("existing_category");
    setAddOpen(true);
  };

  const openEditSubCategory = (sub: SubCategory) => {
    setSelectedSubCategory(sub);
    setEditSubOpen(true);
  };

  const openEditSubSubCategory = (subSub: SubSubCategory) => {
    setSelectedSubSubCategory(subSub);
    setEditSubSubOpen(true);
  };

  const openAddCategoryButton = () => {
    setInitialSubCatId(undefined);
    setAddMode("new_category");
    setAddOpen(true);
  };

  // --- Filtering ---
  const filteredRows = useMemo(() => {
    const list: {
      category: Category;
      subCategory?: SubCategory;
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
          list.push({
            category: cat,
            subCategory: sub,
            isFirst: index === 0,
            subCount: filteredSubs.length,
          });
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
            <tr className="bg-[#F2ECE9] border-b border-slate-200">
              <th className="px-6 py-3.5 font-semibold text-slate-700">ประเภทสินค้า</th>
              <th className="px-6 py-3.5 font-semibold text-slate-700">ชื่อย่อ</th>
              <th className="px-6 py-3.5 font-semibold text-slate-700">ประเภทย่อยของสินค้า</th>
              <th className="px-6 py-3.5 font-semibold text-slate-700">ประเภทย่อยย่อย</th>
              <th className="px-6 py-3.5 font-semibold text-slate-700 text-right w-28">จัดการ</th>
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
              filteredRows.map((row, index) => (
                <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-3 text-slate-800 font-medium align-top">
                    {row.isFirst && (
                      <div className="flex items-center gap-2 group">
                        <span>{row.category.category_name}</span>
                        <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                          <button
                            onClick={() => openEditCategory(row.category)}
                            className="text-slate-400 hover:text-slate-700 p-0.5"
                            title="แก้ไขประเภทหลัก"
                          >
                            <SquarePen className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(row.category.id)}
                            className="text-slate-400 hover:text-red-600 p-0.5"
                            title="ลบประเภทหลัก"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-3 text-slate-500 align-top">
                    {row.isFirst && (row.category.category_short_name || "-")}
                  </td>
                  <td className="px-6 py-3 text-slate-700 align-top">
                    {row.subCategory ? (
                      <div className="flex items-center gap-2 group">
                        <span>{row.subCategory.sub_category_name}</span>
                        <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                          <button
                            onClick={() => openEditSubCategory(row.subCategory!)}
                            className="text-slate-400 hover:text-slate-700 p-0.5"
                            title="แก้ไขประเภทย่อย"
                          >
                            <SquarePen className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSubCategory(row.subCategory!.id)}
                            className="text-slate-400 hover:text-red-600 p-0.5"
                            title="ลบประเภทย่อย"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-300 italic text-xs">ไม่มีประเภทย่อย</span>
                    )}
                  </td>
                  
                  {/* ประเภทย่อยย่อย (Rendered as sub-rows) */}
                  <td className="p-0 align-top border-none">
                    {row.subCategory && subSubCategories.filter(ss => ss.sub_category_id === row.subCategory?.id).length > 0 ? (
                      <div className="flex flex-col">
                        {subSubCategories.filter(ss => ss.sub_category_id === row.subCategory?.id).map((ss, idx, arr) => (
                          <div key={ss.id} className={`px-6 py-3 text-slate-600 ${idx !== arr.length - 1 ? 'border-b border-slate-100' : ''}`}>
                            {ss.sub_sub_category_name}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="px-6 py-3 text-slate-300 italic text-xs">-</div>
                    )}
                  </td>
                  
                  {/* จัดการ (Actions for sub-sub-categories) */}
                  <td className="p-0 align-top border-none">
                    {row.subCategory && subSubCategories.filter(ss => ss.sub_category_id === row.subCategory?.id).length > 0 ? (
                      <div className="flex flex-col">
                        {subSubCategories.filter(ss => ss.sub_category_id === row.subCategory?.id).map((ss, idx, arr) => (
                          <div key={ss.id} className={`px-6 py-3 flex items-center justify-end gap-3 text-slate-400 ${idx !== arr.length - 1 ? 'border-b border-slate-100' : ''}`}>
                            <button
                              onClick={() => openEditSubSubCategory(ss)}
                              className="hover:text-slate-700 transition-colors"
                              title="แก้ไขประเภทย่อยย่อย"
                            >
                              <SquarePen className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSubSubCategory(ss.id)}
                              className="hover:text-red-600 transition-colors"
                              title="ลบประเภทย่อยย่อย"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="px-6 py-3 flex items-center justify-end">
                        {row.subCategory ? (
                          <div className="flex items-center gap-3 text-slate-400">
                            <button
                              onClick={() => openEditSubCategory(row.subCategory!)}
                              className="hover:text-slate-700 transition-colors"
                              title="แก้ไขประเภทย่อย"
                            >
                              <SquarePen className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSubCategory(row.subCategory!.id)}
                              className="hover:text-red-600 transition-colors"
                              title="ลบประเภทย่อย"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          row.isFirst && (
                            <div className="flex items-center gap-4 text-slate-400">
                              <button
                                onClick={() => openEditCategory(row.category)}
                                className="hover:text-slate-700 transition-colors"
                                title="แก้ไขประเภทหลัก"
                              >
                                <SquarePen className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(row.category.id)}
                                className="hover:text-red-600 transition-colors"
                                title="ลบประเภทหลัก"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                              <div className="w-px h-4 bg-slate-200"></div>
                              <button
                                onClick={() => openAddSubCategoryInline(row.category.id)}
                                className="text-xs font-semibold text-[#B70011] hover:underline"
                              >
                                + เพิ่มประเภทย่อย
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Add Buttons */}
      <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4 flex gap-4">
        <button
          onClick={openAddCategoryButton}
          className="flex items-center gap-1.5 text-sm font-semibold text-[#B70011] hover:text-[#9e0010] cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          เพิ่มประเภทสินค้า
        </button>
      </div>

      {/* Modals */}
      <AddCategorySubCategoryModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        categories={categories}
        defaultMode={addMode}
        initialCategoryId={initialSubCatId}
        onSuccess={loadAll}
      />

      <EditCategoryModal
        isOpen={editCatOpen}
        onClose={() => {
          setEditCatOpen(false);
          setSelectedCategory(null);
        }}
        category={selectedCategory}
        onSuccess={loadAll}
      />

      <EditSubCategoryModal
        isOpen={editSubOpen}
        onClose={() => {
          setEditSubOpen(false);
          setSelectedSubCategory(null);
        }}
        categories={categories}
        subCategory={selectedSubCategory}
        onSuccess={loadAll}
      />

      <EditSubSubCategoryModal
        isOpen={editSubSubOpen}
        onClose={() => {
          setEditSubSubOpen(false);
          setSelectedSubSubCategory(null);
        }}
        subCategories={subCategories}
        subSubCategory={selectedSubSubCategory}
        onSuccess={loadAll}
      />
    </>
  );
}
