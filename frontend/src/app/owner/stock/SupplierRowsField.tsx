import { useState } from "react";
import { Plus, X } from "lucide-react";
import Select from "../../../components/elements/select";
import Input from "../../../components/elements/input";
import AddSupplierModal from "./Stock_data/supplier/AddSupplierModal";
import type { Supplier } from "../../../service/http/wms/stock_data_service";

// ค่าพิเศษในดรอปดาวน์ Supplier ที่ไม่ใช่ id จริง — เลือกแล้วจะเปิดฟอร์ม "เพิ่มบริษัทใหม่" แทนการตั้งค่าแถว
const ADD_NEW_SUPPLIER_VALUE = "__add_new_supplier__";

export interface SupplierRow {
  supplier_id: string;
  quantity: string;
  // company_code: รหัสสินค้าตามที่ Supplier เจ้านี้ใช้เรียกสินค้าชิ้นนี้ (ไม่บังคับ) — ผูกกับ Supplier แต่ละแถว
  // เพราะสินค้า 1 ชื่อในร้านมาได้จากหลายบริษัท แต่ละเจ้าใช้รหัสของตัวเองไม่เหมือนกัน
  company_code: string;
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
  // แจ้งกลับไปให้หน้าที่เรียกใช้ผสาน Supplier ที่เพิ่งสร้างใหม่เข้ากับรายการตัวเลือกที่ตัวเองถืออยู่
  // (options เป็น prop จากข้างนอก คอมโพเนนต์นี้เองแก้ไขไม่ได้ตรงๆ)
  onSupplierCreated?: (created: Supplier) => void;
}

// สินค้า 1 ชิ้น รับมาจาก Supplier ได้หลายเจ้า แยกจำนวน + รหัสสินค้าของแต่ละเจ้า (บันทึกลงตาราง Inventory)
// ใช้ร่วมกันทั้งหน้าเพิ่ม/แก้ไขสินค้า และหน้ารับสินค้าเข้าเพิ่ม
export default function SupplierRowsField({ rows, onChange, options, disabled, onSupplierCreated }: SupplierRowsFieldProps) {
  // แถวที่กำลังกดปุ่ม "+ เพิ่มบริษัทใหม่" จากในดรอปดาวน์ (ไว้เลือก Supplier ที่เพิ่งสร้างเสร็จให้อัตโนมัติ)
  const [addSupplierRowIndex, setAddSupplierRowIndex] = useState<number | null>(null);

  const handleAddRow = () => {
    onChange([...rows, { supplier_id: "", quantity: "", company_code: "" }]);
  };

  const handleRemoveRow = (index: number) => {
    onChange(rows.filter((_, i) => i !== index));
  };

  const handleRowChange = (index: number, patch: Partial<SupplierRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  // เลือกค่าในดรอปดาวน์ของแถวใดแถวหนึ่ง — ถ้าเลือก "เพิ่มบริษัทใหม่" ให้เปิดฟอร์มแทนที่จะตั้งค่าแถวตรงๆ
  const handleSelectSupplier = (index: number, value: string) => {
    if (value === ADD_NEW_SUPPLIER_VALUE) {
      setAddSupplierRowIndex(index);
      return;
    }
    handleRowChange(index, { supplier_id: value });
  };

  // สร้าง Supplier ใหม่สำเร็จ -> เลือกให้แถวที่กดเข้ามาทันที + ส่งข้อมูลกลับไปให้หน้าแม่ผสานเข้ารายการตัวเลือก
  const handleSupplierCreated = (created?: Supplier) => {
    if (created && addSupplierRowIndex !== null) {
      handleRowChange(addSupplierRowIndex, { supplier_id: String(created.id) });
    }
    if (created) onSupplierCreated?.(created);
    setAddSupplierRowIndex(null);
  };

  // กันเลือก Supplier ซ้ำกันคนละแถว — ตัดตัวที่แถวอื่นเลือกไปแล้วออกจาก dropdown ของแถวนี้
  const optionsForRow = (index: number) => {
    const usedElsewhere = new Set(
      rows.filter((_, i) => i !== index).map((r) => r.supplier_id).filter(Boolean)
    );
    return [
      { label: "+ เพิ่มบริษัทใหม่...", value: ADD_NEW_SUPPLIER_VALUE },
      ...options.map((opt) => ({ ...opt, disabled: usedElsewhere.has(opt.value) })),
    ];
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
            <div key={index} className="flex flex-col gap-2 rounded-sm border border-slate-100 bg-slate-50 p-2 sm:flex-row sm:items-start">
              <div className="flex-1">
                <Select
                  options={[{ label: "เลือก Supplier...", value: "" }, ...optionsForRow(index)]}
                  value={row.supplier_id}
                  onChange={(e) => handleSelectSupplier(index, e.target.value)}
                  disabled={disabled}
                />
              </div>
              <div className="w-full sm:w-28">
                <Input
                  type="number"
                  min={0}
                  placeholder="จำนวน"
                  value={row.quantity}
                  onChange={(e) => handleRowChange(index, { quantity: e.target.value })}
                  disabled={disabled}
                />
              </div>
              <div className="w-full sm:w-44">
                <Input
                  placeholder="รหัสสินค้าของบริษัท (ถ้ามี)"
                  value={row.company_code}
                  onChange={(e) => handleRowChange(index, { company_code: e.target.value })}
                  disabled={disabled}
                />
              </div>
              <button
                type="button"
                onClick={() => handleRemoveRow(index)}
                disabled={disabled}
                className="shrink-0 cursor-pointer self-center rounded-md p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                title="ลบแถวนี้"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {addSupplierRowIndex !== null && (
        <AddSupplierModal
          isOpen
          onClose={() => setAddSupplierRowIndex(null)}
          onSuccess={handleSupplierCreated}
        />
      )}
    </div>
  );
}

// สร้าง state เริ่มต้นจาก suppliers ที่โหลดมาจากสินค้าเดิม (ใช้ตอนเปิดหน้าแก้ไข)
export function suppliersToRows(
  suppliers?: { SupplierID: number; Quantity: number; CompanyProductCode?: string }[]
): SupplierRow[] {
  if (!suppliers || suppliers.length === 0) return [];
  return suppliers.map((s) => ({
    supplier_id: String(s.SupplierID),
    quantity: String(s.Quantity),
    company_code: s.CompanyProductCode || "",
  }));
}

// แปลง state ของฟอร์มกลับเป็น payload ที่ backend ต้องการ ก่อนส่ง (ตัดแถวที่ยังไม่ได้เลือก Supplier ทิ้ง)
export function rowsToPayload(
  rows: SupplierRow[]
): { supplier_id: number; quantity: number; company_product_code: string }[] {
  return rows
    .filter((r) => r.supplier_id)
    .map((r) => ({
      supplier_id: Number(r.supplier_id),
      quantity: Number(r.quantity) || 0,
      company_product_code: r.company_code.trim(),
    }));
}
