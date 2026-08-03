import React, { useState } from "react";
import Modal from "../../../../../components/elements/modal";
import Input from "../../../../../components/elements/input";
import Button from "../../../../../components/elements/button";
import { useToast } from "../../../../../components/elements/toast";
import { stockDataService } from "../../../../../service/http/wms/stock_data_service";

interface AddShelfLevelModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialShelfId?: number;
  onSuccess: () => void;
}

export default function AddShelfLevelModal({
  isOpen,
  onClose,
  initialShelfId,
  onSuccess,
}: AddShelfLevelModalProps) {
  const { toast } = useToast();
  const [levelName, setLevelName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initialShelfId) {
      toast({ variant: "error", message: "ไม่พบตู้วางสินค้าอ้างอิง" });
      return;
    }
    if (!levelName.trim()) {
      toast({ variant: "error", message: "กรุณากรอกชื่อชั้นระดับ" });
      return;
    }

    try {
      setSubmitting(true);
      await stockDataService.createShelfLevel({
        level_name: levelName.trim(),
        shelf_id: initialShelfId,
      });
      toast({ variant: "success", message: "เพิ่มชั้นระดับสำเร็จ" });
      setLevelName("");
      onSuccess();
      onClose();
    } catch (err) {
      toast({ variant: "error", message: "เกิดข้อผิดพลาดในการเพิ่มชั้นระดับ" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="เพิ่มชั้นระดับใหม่"
      description="กรอกชื่อชั้นระดับเพื่อใช้งานในตู้วางสินค้า"
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
            บันทึกข้อมูล
          </Button>
        </div>
      </form>
    </Modal>
  );
}
