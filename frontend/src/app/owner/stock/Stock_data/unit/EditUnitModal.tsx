import React, { useState, useEffect } from "react";
import Input from "../../../../../components/elements/input";
import Modal from "../../../../../components/elements/modal";
import Button from "../../../../../components/elements/button";
import { useToast } from "../../../../../components/elements/toast";
import { stockDataService } from "../../../../../service/http/wms/stock_data_service";
import type { Unit } from "../../../../../interface/wms/stock_data";

interface EditUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  unit: Unit | null;
}

export default function EditUnitModal({ isOpen, onClose, onSuccess, unit }: EditUnitModalProps) {
  const { toast } = useToast();
  const [unitName, setUnitName] = useState("");

  useEffect(() => {
    if (unit) {
      setUnitName(unit.unit_name || "");
    }
  }, [unit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unit) return;
    try {
      await stockDataService.updateUnit(unit.id, { unit_name: unitName });
      toast({ variant: "success", message: "แก้ไขหน่วยสินค้าสำเร็จ" });
      onSuccess();
      onClose();
    } catch (err) {
      toast({ variant: "error", message: "ไม่สามารถแก้ไขข้อมูลหน่วยสินค้าได้" });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="แก้ไขหน่วยสินค้า">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="ชื่อหน่วยสินค้า"
          required
          value={unitName}
          onChange={(e) => setUnitName(e.target.value)}
          placeholder="เช่น ชิ้น, กล่อง, คู่, วง..."
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
