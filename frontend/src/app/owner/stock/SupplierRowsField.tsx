import { Plus, X } from "lucide-react";
import Select from "../../../components/elements/select";
import Input from "../../../components/elements/input";

export interface SupplierRow {
  supplier_id: string;
  quantity: string;
}

interface SupplierOption {
  label: string;
  value: string;
}

interface SupplierRowsFieldProps {
  rows: SupplierRow[];
  onChange: (rows: SupplierRow[]) => void;
  options: SupplierOption[];
  disabled?: boolean;
}

// สินค้า 1 ชิ้น รับมาจาก Supplier ได้หลายเจ้า แยกจำนวนที่รับจากแต่ละเจ้า (บันทึกลงตาราง Inventory)
// ใช้ร่วมกันทั้งหน้าเพิ่ม/แก้ไขสินค้า
export default function SupplierRowsField({ rows, onChange, options, disabled }: SupplierRowsFieldProps) {
  const handleAddRow = () => {
    onChange([...rows, { supplier_id: "", quantity: "" }]);
  };

  const handleRemoveRow = (index: number) => {
    onChange(rows.filter((_, i) => i !== index));
  };

  const handleRowChange = (index: number, patch: Partial<SupplierRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  // กันเลือก Supplier ซ้ำกันคนละแถว — ตัดตัวที่แถวอื่นเลือกไปแล้วออกจาก dropdown ของแถวนี้
  const optionsForRow = (index: number) => {
    const usedElsewhere = new Set(
      rows.filter((_, i) => i !== index).map((r) => r.supplier_id).filter(Boolean)
    );
    return options.map((opt) => ({ ...opt, disabled: usedElsewhere.has(opt.value) }));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">ผู้จำหน่าย (Suppliers)</label>
        <button
          type="button"
          onClick={handleAddRow}
          disabled={disabled}
          className="flex items-center gap-1 text-xs font-medium text-[#B70011] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          เพิ่ม Supplier
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-sm border border-dashed border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-400">
          ยังไม่ได้ระบุว่าสินค้านี้รับมาจาก Supplier ไหน (ไม่บังคับ)
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="flex-1">
                <Select
                  options={[{ label: "เลือก Supplier...", value: "" }, ...optionsForRow(index)]}
                  value={row.supplier_id}
                  onChange={(e) => handleRowChange(index, { supplier_id: e.target.value })}
                  disabled={disabled}
                />
              </div>
              <div className="w-32">
                <Input
                  type="number"
                  min={0}
                  placeholder="จำนวน"
                  value={row.quantity}
                  onChange={(e) => handleRowChange(index, { quantity: e.target.value })}
                  disabled={disabled}
                />
              </div>
              <button
                type="button"
                onClick={() => handleRemoveRow(index)}
                disabled={disabled}
                className="shrink-0 cursor-pointer rounded-md p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                title="ลบแถวนี้"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// สร้าง state เริ่มต้นจาก suppliers ที่โหลดมาจากสินค้าเดิม (ใช้ตอนเปิดหน้าแก้ไข)
export function suppliersToRows(suppliers?: { SupplierID: number; Quantity: number }[]): SupplierRow[] {
  if (!suppliers || suppliers.length === 0) return [];
  return suppliers.map((s) => ({ supplier_id: String(s.SupplierID), quantity: String(s.Quantity) }));
}

// แปลง state ของฟอร์มกลับเป็น payload ที่ backend ต้องการ ก่อนส่ง (ตัดแถวที่ยังไม่ได้เลือก Supplier ทิ้ง)
export function rowsToPayload(rows: SupplierRow[]): { supplier_id: number; quantity: number }[] {
  return rows
    .filter((r) => r.supplier_id)
    .map((r) => ({ supplier_id: Number(r.supplier_id), quantity: Number(r.quantity) || 0 }));
}
