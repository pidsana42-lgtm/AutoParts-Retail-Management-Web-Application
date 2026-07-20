import React, { useState, useEffect } from "react";
import Input from "../../../../../components/elements/input";
import Modal from "../../../../../components/elements/modal";
import Button from "../../../../../components/elements/button";
import { useToast } from "../../../../../components/elements/toast";
import { stockDataService } from "../../../../../service/http/wms/stock_data_service";
import type { Supplier } from "../../../../../interface/wms/stock_data";

interface EditSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  supplier: Supplier | null;
}

export default function EditSupplierModal({
  isOpen,
  onClose,
  onSuccess,
  supplier
}: EditSupplierModalProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    supplier_name: "",
    short_supplier_name: "",
    supplier_address: "",
    contact_line_sale: "",
    phone_number_sale: "",
    email_sale: "",
    bank_account_number: "",
  });

  useEffect(() => {
    if (supplier) {
      setForm({
        supplier_name: supplier.supplier_name || "",
        short_supplier_name: supplier.short_supplier_name || "",
        supplier_address: supplier.supplier_address || "",
        contact_line_sale: supplier.contact_line_sale || "",
        phone_number_sale: supplier.phone_number_sale || "",
        email_sale: supplier.email_sale || "",
        bank_account_number: supplier.bank_account_number || "",
      });
    }
  }, [supplier]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier) return;
    try {
      await stockDataService.updateSupplier(supplier.id, form);
      toast({ variant: "success", message: "แก้ไขข้อมูลบริษัทสั่งซื้อสำเร็จ" });
      onSuccess();
      onClose();
    } catch (err) {
      toast({ variant: "error", message: "ไม่สามารถแก้ไขข้อมูลบริษัทสั่งซื้อได้" });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="แก้ไขบริษัทสั่งซื้อ/ซัพพลายเออร์"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
        <Input
          label="ชื่อบริษัทสั่งซื้อ (เต็ม)"
          required
          value={form.supplier_name}
          onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
          placeholder="เช่น บริษัท ยิ่งเจริญอะไหล่ยนต์ จำกัด..."
          containerClassName="col-span-2 sm:col-span-1"
        />
        <Input
          label="ชื่อย่อบริษัท"
          required
          value={form.short_supplier_name}
          onChange={(e) => setForm({ ...form, short_supplier_name: e.target.value })}
          placeholder="เช่น ยิ่งเจริญ..."
          containerClassName="col-span-2 sm:col-span-1"
        />
        <Input
          label="เบอร์โทรติดต่อ (ฝ่ายขาย)"
          required
          value={form.phone_number_sale}
          onChange={(e) => setForm({ ...form, phone_number_sale: e.target.value })}
          placeholder="เช่น 02-1234567..."
          containerClassName="col-span-2 sm:col-span-1"
        />
        <Input
          label="Line ID ฝ่ายขาย"
          required
          value={form.contact_line_sale}
          onChange={(e) => setForm({ ...form, contact_line_sale: e.target.value })}
          placeholder="เช่น @yingcharoen..."
          containerClassName="col-span-2 sm:col-span-1"
        />
        <Input
          label="อีเมลฝ่ายขาย"
          required
          type="email"
          value={form.email_sale}
          onChange={(e) => setForm({ ...form, email_sale: e.target.value })}
          placeholder="เช่น sale@yingcharoen.com..."
          containerClassName="col-span-2 sm:col-span-1"
        />
        <Input
          label="เลขที่บัญชีธนาคาร"
          required
          value={form.bank_account_number}
          onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })}
          placeholder="เช่น 123-4-56789-0 (กสิกรไทย)..."
          containerClassName="col-span-2 sm:col-span-1"
        />
        <Input
          label="ที่อยู่บริษัท"
          required
          value={form.supplier_address}
          onChange={(e) => setForm({ ...form, supplier_address: e.target.value })}
          placeholder="ที่อยู่สำหรับออกใบเสนอราคา/ส่งของ..."
          containerClassName="col-span-2"
        />
        <div className="col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button type="button" variant="tertiary" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button type="submit" variant="primary">
            บันทึกข้อมูล
          </Button>
        </div>
      </form>
    </Modal>
  );
}
