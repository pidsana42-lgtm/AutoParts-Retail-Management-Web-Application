import React, { useState, useEffect } from "react";
import Input from "../../../../../components/elements/input";
import Select from "../../../../../components/elements/select";
import Modal from "../../../../../components/elements/modal";
import Button from "../../../../../components/elements/button";
import { useToast } from "../../../../../components/elements/toast";
import { stockDataService } from "../../../../../service/http/wms/stock_data_service";
import type { Zone, Shelf } from "../../../../../interface/wms/stock_data";

interface EditShelfModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  zones: Zone[];
  shelf: Shelf | null;
}

export default function EditShelfModal({
  isOpen,
  onClose,
  onSuccess,
  zones,
  shelf
}: EditShelfModalProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    shelf_name: "",
    zone_id: 0,
  });

  useEffect(() => {
    if (shelf) {
      setForm({
        shelf_name: shelf.shelf_name || "",
        zone_id: shelf.zone_id || 0,
      });
    }
  }, [shelf]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shelf) return;
    try {
      await stockDataService.updateShelf(shelf.id, form);
      toast({ variant: "success", message: "แก้ไขชั้นวางสินค้าสำเร็จ" });
      onSuccess();
      onClose();
    } catch (err) {
      toast({ variant: "error", message: "ไม่สามารถแก้ไขข้อมูลชั้นวางได้" });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="แก้ไขชั้นวางสินค้า">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="เลือกโซนสินค้า"
          required
          options={zones.map((z) => ({ label: z.zone_name, value: String(z.id) }))}
          value={String(form.zone_id)}
          onChange={(e) => setForm({ ...form, zone_id: Number(e.target.value) })}
        />
        <Input
          label="ชื่อชั้นวาง/ตำแหน่ง"
          required
          value={form.shelf_name}
          onChange={(e) => setForm({ ...form, shelf_name: e.target.value })}
          placeholder="เช่น A-01, A-02..."
        />
        <div className="flex justify-end gap-2 pt-2">
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
