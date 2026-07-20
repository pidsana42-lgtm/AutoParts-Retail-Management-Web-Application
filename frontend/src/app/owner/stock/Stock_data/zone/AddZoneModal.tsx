import React, { useState } from "react";
import Input from "../../../../../components/elements/input";
import Modal from "../../../../../components/elements/modal";
import Button from "../../../../../components/elements/button";
import { useToast } from "../../../../../components/elements/toast";
import { stockDataService } from "../../../../../service/http/wms/stock_data_service";

interface AddZoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddZoneModal({ isOpen, onClose, onSuccess }: AddZoneModalProps) {
  const { toast } = useToast();
  const [zoneName, setZoneName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await stockDataService.createZone({ zone_name: zoneName });
      toast({ variant: "success", message: "เพิ่มโซนสินค้าสำเร็จ" });
      setZoneName("");
      onSuccess();
      onClose();
    } catch (err) {
      toast({ variant: "error", message: "ไม่สามารถบันทึกข้อมูลโซนสินค้าได้" });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="เพิ่มโซนคลังสินค้า">
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
