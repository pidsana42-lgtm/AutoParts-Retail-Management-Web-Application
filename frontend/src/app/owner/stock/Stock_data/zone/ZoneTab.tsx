import { useState, useMemo, useEffect } from "react";
import { Trash2, SquarePen, Eye } from "lucide-react";
import { useToast } from "../../../../../components/elements/toast";

import { stockDataService } from "../../../../../service/http/wms/stock_data_service";
import type { Zone, Shelf, ShelfLevel } from "../../../../../interface/wms/stock_data";
import { buildFuzzyIndex, fuzzyMatchIds } from "../../../../../utils/fuzzySearch";

// Extracted Modals
import AddZoneShelfModal from "./AddZoneShelfModal";
import EditRowModal from "./EditRowModal";
import ZoneDetailModal from "./ZoneDetailModal";
import TablePagination from "../components/TablePagination";

interface ZoneTabProps {
  search: string;
  zoneFilter: string;
  zones: Zone[];
  shelves: Shelf[];
  loadData: () => void;
  addSignal?: number;
}

export default function ZoneTab({
  search,
  zoneFilter,
  zones,
  shelves,
  loadData,
  addSignal,
}: ZoneTabProps) {
  const { toast } = useToast();

  // Modals visibility state
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"new_zone" | "existing_zone">("new_zone");
  const [editRowOpen, setEditRowOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailZone, setDetailZone] = useState<Zone | null>(null);

  // Selected records
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [selectedShelf, setSelectedShelf] = useState<Shelf | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<ShelfLevel | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    if (addSignal && addSignal > 0) {
      openAddModal();
    }
  }, [addSignal]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, zoneFilter]);

  const handleDeleteZone = async (id: number) => {
    if (!confirm("คุณแน่ใจว่าต้องการลบโซนนี้? (ชั้นวางทั้งหมดในโซนนี้จะถูกลบด้วย)")) return;
    try {
      await stockDataService.deleteZone(id);
      toast({ variant: "success", message: "ลบโซนสำเร็จ" });
      loadData();
    } catch (err) {
      toast({ variant: "error", message: "เกิดข้อผิดพลาดในการลบโซน" });
    }
  };

  const handleDeleteShelf = async (id: number) => {
    if (!confirm("คุณแน่ใจว่าต้องการลบตู้วางสินค้านี้?")) return;
    try {
      await stockDataService.deleteShelf(id);
      toast({ variant: "success", message: "ลบตู้วางสินค้าสำเร็จ" });
      loadData();
    } catch (err) {
      toast({ variant: "error", message: "เกิดข้อผิดพลาดในการลบตู้วางสินค้า" });
    }
  };

  const handleDeleteLevel = async (id: number) => {
    if (!confirm("คุณแน่ใจว่าต้องการลบชั้นระดับนี้?")) return;
    try {
      await stockDataService.deleteShelfLevel(id);
      toast({ variant: "success", message: "ลบชั้นระดับสำเร็จ" });
      loadData();
    } catch (err) {
      toast({ variant: "error", message: "เกิดข้อผิดพลาดในการลบชั้นระดับ" });
    }
  };

  // Openers
  const openEditRow = (zone: Zone, shelf?: Shelf, level?: ShelfLevel) => {
    setSelectedZone(zone);
    setSelectedShelf(shelf || null);
    setSelectedLevel(level || null);
    setEditRowOpen(true);
  };

  const openAddModal = () => {
    setAddMode("new_zone");
    setAddOpen(true);
  };

  const openDetail = (zone: Zone) => {
    setDetailZone(zone);
    setDetailOpen(true);
  };

  // สร้าง index ไว้แค่ตอน zones/shelves เปลี่ยน แล้วค่อยค้นหาแบบ fuzzy ทุกครั้งที่ search เปลี่ยน
  const zoneSearchIndex = useMemo(() => buildFuzzyIndex(zones, ["zone_name"]), [zones]);
  const shelfSearchIndex = useMemo(() => buildFuzzyIndex(shelves, ["shelf_name"]), [shelves]);
  const matchedZoneIds = useMemo(() => fuzzyMatchIds(zoneSearchIndex, search), [zoneSearchIndex, search]);
  const matchedShelfIds = useMemo(() => fuzzyMatchIds(shelfSearchIndex, search), [shelfSearchIndex, search]);

  const filteredRows = useMemo(() => {
    const list: {
      zone: Zone;
      shelf?: Shelf;
      isFirst: boolean;
      shelfCount: number;
    }[] = [];

    const sortedZones = [...zones].sort((a, b) => a.id - b.id);

    sortedZones.forEach((zone) => {
      const shlvs = shelves
        .filter((sh) => sh.zone_id === zone.id)
        .sort((a, b) => a.id - b.id);

      if (zoneFilter && String(zone.id) !== zoneFilter) {
        return;
      }

      const filteredShlvs = shlvs
        .filter(
          (sh) =>
            !search || matchedShelfIds?.has(sh.id) || matchedZoneIds?.has(zone.id)
        )
        .map((sh) => {
          if (sh.shelf_levels) {
            return {
              ...sh,
              shelf_levels: [...sh.shelf_levels].sort((a, b) => a.id - b.id),
            };
          }
          return sh;
        });

      if (filteredShlvs.length > 0) {
        filteredShlvs.forEach((sh, index) => {
          list.push({
            zone: zone,
            shelf: sh,
            isFirst: index === 0,
            shelfCount: filteredShlvs.length,
          });
        });
      } else if (
        !zoneFilter &&
        (!matchedZoneIds || matchedZoneIds.has(zone.id))
      ) {
        list.push({
          zone: zone,
          isFirst: true,
          shelfCount: 0,
        });
      }
    });

    return list;
  }, [zones, shelves, matchedZoneIds, matchedShelfIds, zoneFilter]);

  // จัดกลุ่มแถวตามโซนหลัก เพื่อแบ่งหน้าโดยไม่ตัดกลุ่มขาดจากกัน
  const groupedByZone = useMemo(() => {
    const map = new Map<number, typeof filteredRows>();
    filteredRows.forEach((row) => {
      const key = row.zone.id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    });
    return Array.from(map.values());
  }, [filteredRows]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return groupedByZone.slice(start, start + itemsPerPage).flat();
  }, [groupedByZone, currentPage, itemsPerPage]);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="bg-[#f6f3f2] border-b border-slate-200">
              <th className="px-6 py-3.5 font-semibold text-[#797878] w-1/4">โซนสินค้า</th>
              <th className="px-6 py-3.5 font-semibold text-[#797878] w-1/4">ตู้วางสินค้า</th>
              <th className="px-6 py-3.5 font-semibold text-[#797878] w-1/3">ชั้นระดับ</th>
              <th className="px-6 py-3.5 font-semibold text-[#797878] text-right w-28">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-slate-400">
                  ไม่พบข้อมูลโซน/ชั้นวางสินค้า
                </td>
              </tr>
            ) : (
              paginatedRows.map((row, index) => (
                <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-3 text-slate-800 font-medium align-top">
                    {row.isFirst && (
                      <span>{row.zone.zone_name}</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-slate-700 align-top">
                    {row.shelf ? (
                      <span className="font-medium text-slate-800">{row.shelf.shelf_name}</span>
                    ) : (
                      <span className="text-slate-300 italic text-xs">-</span>
                    )}
                  </td>

                  {/* ชั้นระดับ (Rendered as sub-rows) */}
                  <td className="p-0 align-top border-none w-1/3">
                    {row.shelf && row.shelf.shelf_levels && row.shelf.shelf_levels.length > 0 ? (
                      <div className="flex flex-col">
                        {row.shelf.shelf_levels.map((lvl, idx, arr) => (
                          <div key={lvl.id} className={`px-6 py-3 text-slate-600 ${idx !== arr.length - 1 ? 'border-b border-slate-100' : ''}`}>
                            {lvl.level_name}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="px-6 py-3 text-slate-300 italic text-xs">-</div>
                    )}
                  </td>

                  {/* จัดการ (Actions for levels) */}
                  <td className="p-0 align-top border-none w-28">
                    {row.shelf && row.shelf.shelf_levels && row.shelf.shelf_levels.length > 0 ? (
                      <div className="flex flex-col">
                        {row.shelf.shelf_levels.map((lvl, idx, arr) => (
                          <div key={lvl.id} className={`px-6 py-3 flex items-center justify-end gap-3 text-slate-400 ${idx !== arr.length - 1 ? 'border-b border-slate-100' : ''}`}>
                            <button
                              onClick={() => openDetail(row.zone)}
                              className="hover:text-slate-700 transition-colors"
                              title="ดูรายละเอียดโซน"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openEditRow(row.zone, row.shelf, lvl)}
                              className="hover:text-slate-700 transition-colors"
                              title="แก้ไขข้อมูลแถวนี้"
                            >
                              <SquarePen className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteLevel(lvl.id)}
                              className="hover:text-red-600 transition-colors"
                              title="ลบชั้นระดับ"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="px-6 py-3 flex items-center justify-end">
                        {row.shelf ? (
                          <div className="flex items-center gap-3 text-slate-400">
                            <button
                              onClick={() => openDetail(row.zone)}
                              className="hover:text-slate-700 transition-colors"
                              title="ดูรายละเอียดโซน"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openEditRow(row.zone, row.shelf)}
                              className="hover:text-slate-700 transition-colors"
                              title="แก้ไขข้อมูลแถวนี้"
                            >
                              <SquarePen className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteShelf(row.shelf!.id)}
                              className="hover:text-red-600 transition-colors"
                              title="ลบตู้วางสินค้า"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          row.isFirst && (
                            <div className="flex items-center gap-4 text-slate-400">
                              <button
                                onClick={() => openDetail(row.zone)}
                                className="hover:text-slate-700 transition-colors"
                                title="ดูรายละเอียดโซน"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => openEditRow(row.zone)}
                                className="hover:text-slate-700 transition-colors"
                                title="แก้ไขข้อมูลแถวนี้"
                              >
                                <SquarePen className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteZone(row.zone.id)}
                                className="hover:text-red-600 transition-colors"
                                title="ลบโซนหลัก"
                              >
                                <Trash2 className="h-4 w-4" />
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

      <TablePagination
        currentPage={currentPage}
        totalItems={groupedByZone.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={(n) => {
          setItemsPerPage(n);
          setCurrentPage(1);
        }}
        itemLabel="โซนสินค้า"
      />

      {/* Modals */}
      <AddZoneShelfModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        zones={zones}
        defaultMode={addMode}
        onSuccess={loadData}
      />

      <EditRowModal
        isOpen={editRowOpen}
        onClose={() => setEditRowOpen(false)}
        zone={selectedZone}
        shelf={selectedShelf}
        level={selectedLevel}
        zones={zones}
        shelves={shelves}
        onSuccess={loadData}
      />

      <ZoneDetailModal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        zone={detailZone}
        shelves={shelves}
      />
    </>
  );
}
