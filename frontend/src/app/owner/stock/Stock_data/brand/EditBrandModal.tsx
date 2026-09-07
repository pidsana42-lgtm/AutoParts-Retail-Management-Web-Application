import React, { useState, useEffect } from "react";
import { Save } from "lucide-react";
import Input from "../../../../../components/elements/input";
import Modal from "../../../../../components/elements/modal";
import Button from "../../../../../components/elements/button";
import { useToast } from "../../../../../components/elements/toast";
import { useAlertDialog } from "../../../../../components/elements/alert_dialog";
import type { Brand } from "../../../../../interface/wms/stock_data";

import { stockDataService } from "../../../../../service/http/wms/stock_data_service";

interface EditBrandModalProps {
  isOpen: boolean;
  onClose: () => void;
  brand: Brand | null;
  onSuccess: () => void;
}

export default function EditBrandModal({
  isOpen,
  onClose,
  brand,
  onSuccess
}: EditBrandModalProps) {
  const { toast } = useToast();
  const { confirmDialog } = useAlertDialog();
  const [brandName, setBrandName] = useState("");

  useEffect(() => {
    if (brand) {
      setBrandName(brand.brand_name || "");
    }
  }, [brand]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand) return;
    
    const confirmed = await confirmDialog(
      `ยืนยันบันทึกการแก้ไขแบรนด์รถยนต์ "${brandName}" หรือไม่?`,
      { title: "ยืนยันการแก้ไขแบรนด์รถยนต์", confirmText: "บันทึกการแก้ไข", variant: "info", icon: Save }
    );
    if (!confirmed) return;

    try {
      await stockDataService.updateBrand(brand.id, { brand_name: brandName });
      onSuccess();
      toast({ variant: "success", message: "แก้ไขแบรนด์รถสำเร็จ" });
      onClose();
    } catch (err) {
      toast({ variant: "error", message: "ไม่สามารถแก้ไขแบรนด์รถได้" });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="แก้ไขแบรนด์รถยนต์">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="ชื่อแบรนด์"
          required
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
          placeholder="เช่น Toyota, Honda, Isuzu..."
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
