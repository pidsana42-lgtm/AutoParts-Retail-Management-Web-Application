import { Car, FolderTree } from "lucide-react";
import Modal from "../../../../../components/elements/modal";
import type { Brand } from "../../../../../interface/wms/stock_data";

interface BrandDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  brand: Brand | null;
}

const formatDateTime = (iso?: string) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("th-TH", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

// แสดงโครงสร้างทั้งหมดของแบรนด์รถหนึ่งตัวในทีเดียว (รุ่นรถทุกตัวที่อยู่ใต้แบรนด์นี้)
// ต่างจากตารางหลักที่แยกแสดงทีละแถวตามรุ่น ทำให้เห็นภาพรวมไม่ครบในคราวเดียว
export default function BrandDetailModal({ isOpen, onClose, brand }: BrandDetailModalProps) {
  if (!brand) return null;

  const models = brand.models || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={brand.brand_name}
      description="รายละเอียดแบรนด์รถ และรุ่นรถทั้งหมดที่มี"
      size="md"
    >
      <div className="space-y-5">
        {/* ข้อมูลแบรนด์หลัก */}
        <div className="grid grid-cols-2 gap-4 rounded-sm border border-slate-100 bg-slate-50/60 p-4 text-sm">
          <div>
            <p className="text-xs text-slate-400">ชื่อแบรนด์</p>
            <p className="font-semibold text-slate-800">{brand.brand_name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">สร้างเมื่อ</p>
            <p className="text-slate-700">{formatDateTime(brand.CreatedAt)}</p>
          </div>
        </div>

        {/* รุ่นรถทั้งหมด */}
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <FolderTree className="h-3.5 w-3.5" />
            รุ่นรถทั้งหมด ({models.length} รุ่น)
          </div>

          {models.length === 0 ? (
            <div className="rounded-sm border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
              ยังไม่มีรุ่นรถภายใต้แบรนด์นี้
            </div>
          ) : (
            <div className="divide-y divide-slate-100 rounded-sm border border-slate-200">
              {models.map((md) => (
                <div key={md.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-slate-400" />
                    <span className="font-medium text-slate-800">{md.model_name}</span>
                  </div>
                  <span className="text-xs text-slate-400">สร้างเมื่อ {formatDateTime(md.CreatedAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
