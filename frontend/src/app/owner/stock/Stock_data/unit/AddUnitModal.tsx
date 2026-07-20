import React, { useState } from "react";
import Input from "../../../../../components/elements/input";
import Modal from "../../../../../components/elements/modal";
import Button from "../../../../../components/elements/button";
import { useToast } from "../../../../../components/elements/toast";
import { stockDataService } from "../../../../../service/http/wms/stock_data_service";

interface AddUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddUnitModal({ isOpen, onClose, onSuccess }: AddUnitModalProps) {
  const { toast } = useToast();
  const [unitName, setUnitName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await stockDataService.createUnit({ unit_name: unitName });
      toast({ variant: "success", message: "เพิ่มหน่วยสินค้าสำเร็จ" });
      setUnitName("");
      onSuccess();
      onClose();
    } catch (err) {
      toast({ variant: "error", message: "ไม่สามารถบันทึกข้อมูลหน่วยสินค้าได้" });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="เพิ่มหน่วยสินค้า">
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
