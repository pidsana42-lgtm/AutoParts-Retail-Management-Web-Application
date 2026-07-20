import React, { useState, useEffect } from "react";
import Input from "../../../../../components/elements/input";
import Select from "../../../../../components/elements/select";
import Modal from "../../../../../components/elements/modal";
import Button from "../../../../../components/elements/button";
import { useToast } from "../../../../../components/elements/toast";
import { stockDataService } from "../../../../../service/http/wms/stock_data_service";
import type { Zone } from "../../../../../interface/wms/stock_data";

interface AddShelfModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  zones: Zone[];
  initialZoneId?: number;
}

export default function AddShelfModal({
  isOpen,
  onClose,
  onSuccess,
  zones,
  initialZoneId
}: AddShelfModalProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    shelf_name: "",
    zone_id: 0,
  });

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      zone_id: initialZoneId || (zones[0]?.id || 0),
    }));
  }, [initialZoneId, zones]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.zone_id) {
      toast({ variant: "error", message: "กรุณาเลือกโซนสินค้า" });
      return;
    }
    try {
      await stockDataService.createShelf(form);
      toast({ variant: "success", message: "เพิ่มชั้นวางสินค้าสำเร็จ" });
      setForm({
        shelf_name: "",
        zone_id: initialZoneId || (zones[0]?.id || 0),
      });
      onSuccess();
      onClose();
    } catch (err) {
      toast({ variant: "error", message: "ไม่สามารถบันทึกข้อมูลชั้นวางได้" });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="เพิ่มชั้นวางสินค้า">
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
