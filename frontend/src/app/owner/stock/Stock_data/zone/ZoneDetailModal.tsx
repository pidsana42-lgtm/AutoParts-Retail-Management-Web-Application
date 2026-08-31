import { Layers, FolderTree } from "lucide-react";
import Modal from "../../../../../components/elements/modal";
import Badge from "../../../../../components/elements/badge";
import type { Zone, Shelf } from "../../../../../interface/wms/stock_data";

interface ZoneDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  zone: Zone | null;
  shelves: Shelf[];
}

const formatDateTime = (iso?: string) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("th-TH", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

// แสดงโครงสร้างทั้งหมดของโซนหนึ่งตัวในทีเดียว (ตู้วางสินค้าทุกตัว + ชั้นระดับทุกตัวที่อยู่ข้างใต้)
// ต่างจากตารางหลักที่แยกแสดงทีละแถวตามคู่ ตู้วาง/ชั้นระดับ ทำให้เห็นภาพรวมไม่ครบในคราวเดียว
export default function ZoneDetailModal({ isOpen, onClose, zone, shelves }: ZoneDetailModalProps) {
  if (!zone) return null;

  const relatedShelves = shelves.filter((sh) => sh.zone_id === zone.id);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={zone.zone_name}
      description="รายละเอียดโซนสินค้า และโครงสร้างตู้วาง/ชั้นระดับทั้งหมด"
      size="lg"
    >
      <div className="space-y-5">
        {/* ข้อมูลโซนหลัก */}
        <div className="grid grid-cols-2 gap-4 rounded-sm border border-slate-100 bg-slate-50/60 p-4 text-sm">
          <div>
            <p className="text-xs text-slate-400">ชื่อโซน</p>
            <p className="font-semibold text-slate-800">{zone.zone_name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">สร้างเมื่อ</p>
            <p className="text-slate-700">{formatDateTime(zone.created_at)}</p>
          </div>
        </div>

        {/* โครงสร้างตู้วาง > ชั้นระดับ ทั้งหมด */}
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <FolderTree className="h-3.5 w-3.5" />
            โครงสร้างทั้งหมด ({relatedShelves.length} ตู้วางสินค้า)
          </div>

          {relatedShelves.length === 0 ? (
            <div className="rounded-sm border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
              ยังไม่มีตู้วางสินค้าภายใต้โซนนี้
            </div>
          ) : (
            <div className="space-y-3">
              {relatedShelves.map((sh) => (
                <div key={sh.id} className="rounded-sm border border-slate-200">
                  <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-slate-400" />
                      <span className="font-medium text-slate-800">{sh.shelf_name}</span>
                      {sh.shelf_levels && sh.shelf_levels.length > 0 && (
                        <Badge variant="neutral" className="w-auto bg-slate-100 px-2 text-slate-500">
                          {sh.shelf_levels.length} ชั้นระดับ
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-slate-400">สร้างเมื่อ {formatDateTime(sh.created_at)}</span>
                  </div>

                  {sh.shelf_levels && sh.shelf_levels.length > 0 && (
                    <div className="divide-y divide-slate-50 px-4">
                      {sh.shelf_levels.map((lvl) => (
                        <div key={lvl.id} className="flex items-center justify-between gap-3 py-2 pl-6 text-sm">
                          <span className="text-slate-700">{lvl.level_name}</span>
                          <span className="text-xs text-slate-400">สร้างเมื่อ {formatDateTime(lvl.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
