import { useState, useMemo, useEffect } from "react";
import { Trash2, SquarePen } from "lucide-react";
import { useToast } from "../../../../../components/elements/toast";
import type { Brand, Model } from "../../../../../interface/wms/stock_data";

// Extracted Modals
import EditBrandRowModal from "./EditBrandRowModal";
import AddBrandModelModal from "./AddBrandModelModal";
import TablePagination from "../components/TablePagination";

import { stockDataService } from "../../../../../service/http/wms/stock_data_service";

interface BrandTabProps {
  search: string;
  brandFilter: string;
  brands: Brand[];
  reloadBrands: () => void;
  addSignal?: number;
}

export default function BrandTab({
  search,
  brandFilter,
  brands,
  reloadBrands,
  addSignal,
}: BrandTabProps) {
  const { toast } = useToast();

  // Modals visibility state
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"new_brand" | "existing_brand">("new_brand");
  const [editRowOpen, setEditRowOpen] = useState(false);

  // Selected records
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [initialBrandId, setInitialBrandId] = useState<number | undefined>(undefined);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    if (addSignal && addSignal > 0) {
      openAddBrandButton();
    }
  }, [addSignal]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, brandFilter]);

  const handleDeleteBrand = async (id: number) => {
    if (!confirm("คุณแน่ใจว่าต้องการลบแบรนด์รถนี้?")) return;
    try {
      await stockDataService.deleteBrand(id);
      reloadBrands();
      toast({ variant: "success", message: "ลบแบรนด์รถสำเร็จ" });
    } catch (err) {
      toast({ variant: "error", message: "ไม่สามารถลบแบรนด์รถได้" });
    }
  };

  const handleDeleteModel = async (modelId: number) => {
    if (!confirm("คุณแน่ใจว่าต้องการลบรุ่นรถนี้?")) return;
    try {
      await stockDataService.deleteModel(modelId);
      reloadBrands();
      toast({ variant: "success", message: "ลบรุ่นรถสำเร็จ" });
    } catch (err) {
      toast({ variant: "error", message: "ไม่สามารถลบรุ่นรถได้" });
    }
  };

  // Openers
  const openEditRow = (brand: Brand, model?: Model) => {
    setSelectedBrand(brand);
    setSelectedModel(model || null);
    setEditRowOpen(true);
  };

  const openAddBrandButton = () => {
    setInitialBrandId(undefined);
    setAddMode("new_brand");
    setAddOpen(true);
  };

  const filteredRows = useMemo(() => {
    const list: {
      brand: Brand;
      model?: Model;
      isFirst: boolean;
      modelCount: number;
    }[] = [];

    brands.forEach((brand) => {
      const mdls = brand.models || [];

      if (brandFilter && String(brand.id) !== brandFilter) {
        return;
      }

      const matchesSearch = (text: string) =>
        text.toLowerCase().includes(search.toLowerCase());

      const filteredMdls = mdls.filter(
        (md) =>
          !search ||
          matchesSearch(md.model_name) ||
          matchesSearch(brand.brand_name)
      );

      if (filteredMdls.length > 0) {
        filteredMdls.forEach((md, index) => {
          list.push({
            brand: brand,
            model: md,
            isFirst: index === 0,
            modelCount: filteredMdls.length,
          });
        });
      } else if (
        !brandFilter &&
        (!search || matchesSearch(brand.brand_name))
      ) {
        list.push({
          brand: brand,
          isFirst: true,
          modelCount: 0,
        });
      }
    });

    return list;
  }, [brands, search, brandFilter]);

  // จัดกลุ่มแถวตามแบรนด์หลัก เพื่อแบ่งหน้าโดยไม่ตัดกลุ่มขาดจากกัน
  const groupedByBrand = useMemo(() => {
    const map = new Map<number, typeof filteredRows>();
    filteredRows.forEach((row) => {
      const key = row.brand.id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    });
    return Array.from(map.values());
  }, [filteredRows]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return groupedByBrand.slice(start, start + itemsPerPage).flat();
  }, [groupedByBrand, currentPage, itemsPerPage]);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="bg-[#f6f3f2] border-b border-slate-200">
              <th className="px-6 py-3.5 font-semibold text-[#797878] w-1/3">แบรนด์รถ</th>
              <th className="px-6 py-3.5 font-semibold text-[#797878] w-1/2">รุ่นรถ</th>
              <th className="px-6 py-3.5 font-semibold text-[#797878] text-right w-1/6">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-10 text-center text-slate-400">
                  ไม่พบข้อมูลแบรนด์/รุ่นรถ
                </td>
              </tr>
            ) : (
              paginatedRows.map((row, index) => (
                <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-3 text-slate-800 font-medium align-top">
                    {row.isFirst && (
                      <span>{row.brand.brand_name}</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-slate-700 align-top">
                    {row.model ? (
                      row.model.model_name
                    ) : (
                      <span className="text-slate-300 italic text-xs">ไม่มีรุ่นรถ</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right align-top">
                    <div className="flex items-center justify-end gap-3 text-slate-400">
                      {row.model ? (
                        <>
                          <button
                            onClick={() => openEditRow(row.brand, row.model!)}
                            className="hover:text-slate-700 transition-colors"
                            title="แก้ไขข้อมูลแถวนี้"
                          >
                            <SquarePen className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteModel(row.model!.id)}
                            className="hover:text-red-600 transition-colors"
                            title="ลบรุ่นรถ"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        row.isFirst && (
                          <>
                            <button
                              onClick={() => openEditRow(row.brand)}
                              className="hover:text-slate-700 transition-colors"
                              title="แก้ไขข้อมูลแถวนี้"
                            >
                              <SquarePen className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteBrand(row.brand.id)}
                              className="hover:text-red-600 transition-colors"
                              title="ลบแบรนด์รถ"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <TablePagination
        currentPage={currentPage}
        totalItems={groupedByBrand.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={(n) => {
          setItemsPerPage(n);
          setCurrentPage(1);
        }}
        itemLabel="แบรนด์รถ"
      />

      {/* Modals */}
      <AddBrandModelModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        initialMode={addMode}
        initialBrandId={initialBrandId}
        brands={brands}
        onSuccess={reloadBrands}
      />

      <EditBrandRowModal
        isOpen={editRowOpen}
        onClose={() => setEditRowOpen(false)}
        brand={selectedBrand}
        model={selectedModel}
        brands={brands}
        onSuccess={reloadBrands}
      />
    </>
  );
}
