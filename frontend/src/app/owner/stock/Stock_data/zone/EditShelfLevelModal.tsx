import React, { useState, useEffect } from "react";
import Modal from "../../../../../components/elements/modal";
import Input from "../../../../../components/elements/input";
import Button from "../../../../../components/elements/button";
import { useToast } from "../../../../../components/elements/toast";
import { stockDataService } from "../../../../../service/http/wms/stock_data_service";
import type { ShelfLevel } from "../../../../../interface/wms/stock_data";

interface EditShelfLevelModalProps {
  isOpen: boolean;
  onClose: () => void;
  level: ShelfLevel | null;
  onSuccess: () => void;
}

export default function EditShelfLevelModal({
  isOpen,
  onClose,
  level,
  onSuccess,
}: EditShelfLevelModalProps) {
  const { toast } = useToast();
  const [levelName, setLevelName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (level && isOpen) {
      setLevelName(level.level_name);
    }
  }, [level, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!level) return;
    if (!levelName.trim()) {
      toast({ variant: "error", message: "กรุณากรอกชื่อชั้นระดับ" });
      return;
    }

    try {
      setSubmitting(true);
      await stockDataService.updateShelfLevel(level.id, {
        level_name: levelName.trim(),
        shelf_id: level.shelf_id,
      });
      toast({ variant: "success", message: "แก้ไขชั้นระดับสำเร็จ" });
      onSuccess();
      onClose();
    } catch (err) {
      toast({ variant: "error", message: "เกิดข้อผิดพลาดในการแก้ไขชั้นระดับ" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="แก้ไขชั้นระดับ"
      description="อัปเดตชื่อชั้นระดับสำหรับใช้งานในตู้วางสินค้า"
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="ชื่อชั้นระดับ"
          placeholder="เช่น ชั้นที่ 1, ชั้นที่ 2, A-1"
          value={levelName}
          onChange={(e) => setLevelName(e.target.value)}
          required
        />
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" type="button" onClick={onClose} disabled={submitting}>
            ยกเลิก
          </Button>
          <Button variant="primary" type="submit" isLoading={submitting}>
            บันทึกการเปลี่ยนแปลง
          </Button>
        </div>
      </form>
    </Modal>
  );
}
