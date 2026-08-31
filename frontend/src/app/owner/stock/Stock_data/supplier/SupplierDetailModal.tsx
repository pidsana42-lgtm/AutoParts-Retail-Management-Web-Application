import Modal from "../../../../../components/elements/modal";
import type { Supplier } from "../../../../../interface/wms/stock_data";

interface SupplierDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: Supplier | null;
}

const formatDateTime = (iso?: string) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("th-TH", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

// โชว์ข้อมูลบริษัทสั่งซื้อครบทุกฟิลด์ รวมช่องที่ตารางหลักไม่ได้แสดง (ที่อยู่, ผู้ติดต่อสำรอง)
export default function SupplierDetailModal({ isOpen, onClose, supplier }: SupplierDetailModalProps) {
  if (!supplier) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={supplier.supplier_name}
      description="รายละเอียดบริษัทสั่งซื้อทั้งหมด"
      size="lg"
    >
      <div className="space-y-5 text-sm">
        <div className="grid grid-cols-2 gap-4 rounded-sm border border-slate-100 bg-slate-50/60 p-4">
          <div>
            <p className="text-xs text-slate-400">ชื่อบริษัท</p>
            <p className="font-semibold text-slate-800">{supplier.supplier_name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">ชื่อย่อ</p>
            <p className="font-semibold text-slate-800">{supplier.short_supplier_name || "-"}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-slate-400">ที่อยู่</p>
            <p className="text-slate-700">{supplier.supplier_address || "-"}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-slate-400">เลขที่บัญชี</p>
            <p className="text-slate-700">{supplier.bank_account_number || "-"}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-slate-400">สร้างเมื่อ</p>
            <p className="text-slate-700">{formatDateTime(supplier.created_at)}</p>
          </div>
        </div>

        {/* ผู้ติดต่อหลัก */}
        <div>
          <div className="mb-2 text-xs font-semibold text-slate-500">ผู้ติดต่อหลัก</div>
          <div className="grid grid-cols-3 gap-4 rounded-sm border border-slate-200 p-4">
            <div>
              <p className="text-xs text-slate-400">เบอร์โทรศัพท์</p>
              <p className="text-slate-700">{supplier.phone_number_sale || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Line ID</p>
              <p className="text-slate-700">{supplier.contact_line_sale || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">อีเมล</p>
              <p className="text-slate-700">{supplier.email_sale || "-"}</p>
            </div>
          </div>
        </div>

        {/* ผู้ติดต่อสำรอง — ช่องนี้ตารางหลักไม่ได้แสดง ต้องเข้ามาดูรายละเอียดถึงจะเห็น */}
        {(supplier.phone_number_sale_2 || supplier.contact_line_sale_2 || supplier.email_sale_2) && (
          <div>
            <div className="mb-2 text-xs font-semibold text-slate-500">ผู้ติดต่อสำรอง</div>
            <div className="grid grid-cols-3 gap-4 rounded-sm border border-slate-200 p-4">
              <div>
                <p className="text-xs text-slate-400">เบอร์โทรศัพท์</p>
                <p className="text-slate-700">{supplier.phone_number_sale_2 || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Line ID</p>
                <p className="text-slate-700">{supplier.contact_line_sale_2 || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">อีเมล</p>
                <p className="text-slate-700">{supplier.email_sale_2 || "-"}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
