import { useState, useMemo } from "react";
import { Plus, Trash2, SquarePen } from "lucide-react";
import { useToast } from "../../../../../components/elements/toast";
import type { Brand, Model } from "../../../../../interface/wms/stock_data";

// Extracted Modals
import EditBrandModal from "./EditBrandModal";
import EditModelModal from "./EditModelModal";
import AddBrandModelModal from "./AddBrandModelModal";

interface BrandTabProps {
  search: string;
  brandFilter: string;
  brands: Brand[];
  saveLocalBrands: (brands: Brand[]) => void;
}

export default function BrandTab({ search, brandFilter, brands, saveLocalBrands }: BrandTabProps) {
  const { toast } = useToast();

  // Modals visibility state
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"new_brand" | "existing_brand">("new_brand");
  const [editBrandOpen, setEditBrandOpen] = useState(false);
  const [editModelOpen, setEditModelOpen] = useState(false);

  // Selected records
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [initialBrandId, setInitialBrandId] = useState<number | undefined>(undefined);

  const handleDeleteBrand = (id: number) => {
    if (!confirm("คุณแน่ใจว่าต้องการลบแบรนด์รถนี้?")) return;
    const updated = brands.filter((b) => b.id !== id);
    saveLocalBrands(updated);
    toast({ variant: "success", message: "ลบแบรนด์รถสำเร็จ" });
  };

  const handleDeleteModel = (modelId: number) => {
    if (!confirm("คุณแน่ใจว่าต้องการลบรุ่นรถนี้?")) return;
    const updated = brands.map((b) => ({
      ...b,
      models: b.models ? b.models.filter((m) => m.id !== modelId) : [],
    }));
    saveLocalBrands(updated);
    toast({ variant: "success", message: "ลบรุ่นรถสำเร็จ" });
  };

  // Openers
  const openEditBrand = (brand: Brand) => {
    setSelectedBrand(brand);
    setEditBrandOpen(true);
  };

  const openAddModelInline = (brandId?: number) => {
    setInitialBrandId(brandId);
    setAddMode("existing_brand");
    setAddOpen(true);
  };

  const openEditModel = (model: Model) => {
    setSelectedModel(model);
    setEditModelOpen(true);
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

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="bg-[#F2ECE9] border-b border-slate-200">
              <th className="px-6 py-3.5 font-semibold text-slate-700 w-1/3">แบรนด์รถ</th>
              <th className="px-6 py-3.5 font-semibold text-slate-700 w-1/2">รุ่นรถ</th>
              <th className="px-6 py-3.5 font-semibold text-slate-700 text-right w-1/6">จัดการ</th>
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
              filteredRows.map((row, index) => (
                <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-3 text-slate-800 font-medium">
                    {row.isFirst && (
                      <div className="flex items-center gap-2 group">
                        <span>{row.brand.brand_name}</span>
                        <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                          <button
                            onClick={() => openEditBrand(row.brand)}
                            className="text-slate-400 hover:text-slate-700 p-0.5"
                            title="แก้ไขแบรนด์รถ"
                          >
                            <SquarePen className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteBrand(row.brand.id)}
                            className="text-slate-400 hover:text-red-600 p-0.5"
                            title="ลบแบรนด์รถ"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-3 text-slate-700">
                    {row.model ? (
                      row.model.model_name
                    ) : (
                      <span className="text-slate-300 italic text-xs">ไม่มีรุ่นรถ</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {row.model ? (
                      <div className="flex items-center justify-end gap-3 text-slate-400">
                        <button
                          onClick={() => openEditModel(row.model!)}
                          className="hover:text-slate-700 transition-colors"
                          title="แก้ไขรุ่นรถ"
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
                      </div>
                    ) : (
                      row.isFirst && (
                        <button
                          onClick={() => openAddModelInline(row.brand.id)}
                          className="text-xs text-[#B70011] hover:underline"
                        >
                          + เพิ่มรุ่นรถ
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4 flex gap-4">
        <button
          onClick={openAddBrandButton}
          className="flex items-center gap-1.5 text-sm font-semibold text-[#B70011] hover:text-[#9e0010] cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          เพิ่มแบรนด์รถ
        </button>
      </div>

      {/* Modals */}
      <AddBrandModelModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        brands={brands}
        defaultMode={addMode}
        initialBrandId={initialBrandId}
        saveLocalBrands={saveLocalBrands}
      />

      <EditBrandModal
        isOpen={editBrandOpen}
        onClose={() => {
          setEditBrandOpen(false);
          setSelectedBrand(null);
        }}
        brands={brands}
        brand={selectedBrand}
        saveLocalBrands={saveLocalBrands}
      />

      <EditModelModal
        isOpen={editModelOpen}
        onClose={() => {
          setEditModelOpen(false);
          setSelectedModel(null);
        }}
        brands={brands}
        model={selectedModel}
        saveLocalBrands={saveLocalBrands}
      />
    </>
  );
}
