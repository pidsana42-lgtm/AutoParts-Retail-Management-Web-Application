import { useState, useMemo } from "react";
import { Plus, Trash2, SquarePen } from "lucide-react";
import { useToast } from "../../../../../components/elements/toast";

import { stockDataService } from "../../../../../service/http/wms/stock_data_service";
import type { Zone, Shelf } from "../../../../../interface/wms/stock_data";

// Extracted Modals
import EditZoneModal from "./EditZoneModal";
import EditShelfModal from "./EditShelfModal";
import AddZoneShelfModal from "./AddZoneShelfModal";

interface ZoneTabProps {
  search: string;
  zoneFilter: string;
  zones: Zone[];
  shelves: Shelf[];
  loadData: () => void;
}

export default function ZoneTab({ search, zoneFilter, zones, shelves, loadData }: ZoneTabProps) {
  const { toast } = useToast();

  // Modals visibility state
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"new_zone" | "existing_zone">("new_zone");
  const [editZoneOpen, setEditZoneOpen] = useState(false);
  const [editShelfOpen, setEditShelfOpen] = useState(false);

  // Selected records
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [selectedShelf, setSelectedShelf] = useState<Shelf | null>(null);
  const [initialZoneId, setInitialZoneId] = useState<number | undefined>(undefined);

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
    if (!confirm("คุณแน่ใจว่าต้องการลบชั้นวางนี้?")) return;
    try {
      await stockDataService.deleteShelf(id);
      toast({ variant: "success", message: "ลบชั้นวางสำเร็จ" });
      loadData();
    } catch (err) {
      toast({ variant: "error", message: "เกิดข้อผิดพลาดในการลบชั้นวาง" });
    }
  };

  // Openers
  const openEditZone = (zone: Zone) => {
    setSelectedZone(zone);
    setEditZoneOpen(true);
  };

  const openAddShelfInline = (zoneId?: number) => {
    setInitialZoneId(zoneId);
    setAddMode("existing_zone");
    setAddOpen(true);
  };

  const openEditShelf = (shelf: Shelf) => {
    setSelectedShelf(shelf);
    setEditShelfOpen(true);
  };

  const openAddZoneButton = () => {
    setInitialZoneId(undefined);
    setAddMode("new_zone");
    setAddOpen(true);
  };

  const filteredRows = useMemo(() => {
    const list: {
      zone: Zone;
      shelf?: Shelf;
      isFirst: boolean;
      shelfCount: number;
    }[] = [];

    zones.forEach((zone) => {
      const shlvs = shelves.filter((sh) => sh.zone_id === zone.id);

      if (zoneFilter && String(zone.id) !== zoneFilter) {
        return;
      }

      const matchesSearch = (text: string) =>
        text.toLowerCase().includes(search.toLowerCase());

      const filteredShlvs = shlvs.filter(
        (sh) =>
          !search ||
          matchesSearch(sh.shelf_name) ||
          matchesSearch(zone.zone_name)
      );

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
        (!search || matchesSearch(zone.zone_name))
      ) {
        list.push({
          zone: zone,
          isFirst: true,
          shelfCount: 0,
        });
      }
    });

    return list;
  }, [zones, shelves, search, zoneFilter]);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="bg-[#F2ECE9] border-b border-slate-200">
              <th className="px-6 py-3.5 font-semibold text-slate-700 w-1/3">โซนสินค้า</th>
              <th className="px-6 py-3.5 font-semibold text-slate-700 w-1/2">ชั้นวางสินค้า</th>
              <th className="px-6 py-3.5 font-semibold text-slate-700 text-right w-1/6">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-10 text-center text-slate-400">
                  ไม่พบข้อมูลโซน/ชั้นวางสินค้า
                </td>
              </tr>
            ) : (
              filteredRows.map((row, index) => (
                <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-3 text-slate-800 font-medium">
                    {row.isFirst && (
                      <div className="flex items-center gap-2 group">
                        <span>{row.zone.zone_name}</span>
                        <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                          <button
                            onClick={() => openEditZone(row.zone)}
                            className="text-slate-400 hover:text-slate-700 p-0.5"
                            title="แก้ไขโซนหลัก"
                          >
                            <SquarePen className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteZone(row.zone.id)}
                            className="text-slate-400 hover:text-red-600 p-0.5"
                            title="ลบโซนหลัก"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-3 text-slate-700">
                    {row.shelf ? (
                      row.shelf.shelf_name
                    ) : (
                      <span className="text-slate-300 italic text-xs">ไม่มีชั้นวาง</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {row.shelf ? (
                      <div className="flex items-center justify-end gap-3 text-slate-400">
                        <button
                          onClick={() => openEditShelf(row.shelf!)}
                          className="hover:text-slate-700 transition-colors"
                          title="แก้ไขชั้นวาง"
                        >
                          <SquarePen className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteShelf(row.shelf!.id)}
                          className="hover:text-red-600 transition-colors"
                          title="ลบชั้นวาง"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      row.isFirst && (
                        <button
                          onClick={() => openAddShelfInline(row.zone.id)}
                          className="text-xs text-[#B70011] hover:underline"
                        >
                          + เพิ่มชั้นวาง
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
          onClick={openAddZoneButton}
          className="flex items-center gap-1.5 text-sm font-semibold text-[#B70011] hover:text-[#9e0010] cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          เพิ่มโซนสินค้า
        </button>
      </div>

      {/* Modals */}
      <AddZoneShelfModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        zones={zones}
        defaultMode={addMode}
        initialZoneId={initialZoneId}
        onSuccess={loadData}
      />

      <EditZoneModal
        isOpen={editZoneOpen}
        onClose={() => {
          setEditZoneOpen(false);
          setSelectedZone(null);
        }}
        zone={selectedZone}
        onSuccess={loadData}
      />

      <EditShelfModal
        isOpen={editShelfOpen}
        onClose={() => {
          setEditShelfOpen(false);
          setSelectedShelf(null);
        }}
        zones={zones}
        shelf={selectedShelf}
        onSuccess={loadData}
      />
    </>
  );
}
