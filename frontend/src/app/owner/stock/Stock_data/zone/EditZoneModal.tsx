import React, { useState, useEffect } from "react";
import Input from "../../../../../components/elements/input";
import Modal from "../../../../../components/elements/modal";
import Button from "../../../../../components/elements/button";
import { useToast } from "../../../../../components/elements/toast";
import { stockDataService } from "../../../../../service/http/wms/stock_data_service";
import type { Zone } from "../../../../../interface/wms/stock_data";

interface EditZoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  zone: Zone | null;
}

export default function EditZoneModal({ isOpen, onClose, onSuccess, zone }: EditZoneModalProps) {
  const { toast } = useToast();
  const [zoneName, setZoneName] = useState("");

  useEffect(() => {
    if (zone) {
      setZoneName(zone.zone_name || "");
    }
  }, [zone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zone) return;
    try {
      await stockDataService.updateZone(zone.id, { zone_name: zoneName });
      toast({ variant: "success", message: "แก้ไขโซนสำเร็จ" });
      onSuccess();
      onClose();
    } catch (err) {
      toast({ variant: "error", message: "ไม่สามารถแก้ไขข้อมูลโซนได้" });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="แก้ไขโซนคลังสินค้า">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="ชื่อโซน"
          required
          value={zoneName}
          onChange={(e) => setZoneName(e.target.value)}
          placeholder="เช่น A, B, โซนหน้าห้อง..."
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
