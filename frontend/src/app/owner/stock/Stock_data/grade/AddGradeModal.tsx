import React, { useState } from "react";
import Modal from "../../../../../components/elements/modal";
import Input from "../../../../../components/elements/input";
import Button from "../../../../../components/elements/button";
import { useToast } from "../../../../../components/elements/toast";
import { stockDataService } from "../../../../../service/http/wms/stock_data_service";

interface AddGradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddGradeModal({ isOpen, onClose, onSuccess }: AddGradeModalProps) {
  const { toast } = useToast();
  const [gradeName, setGradeName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradeName.trim()) {
      toast({ variant: "error", message: "กรุณากรอกชื่อเกรดสินค้า" });
      return;
    }

    try {
      setSubmitting(true);
      await stockDataService.createGrade({
        grade_name: gradeName.trim(),
      });
      toast({ variant: "success", message: "เพิ่มเกรดสินค้าสำเร็จ" });
      onSuccess();
      onClose();
      setGradeName("");
    } catch (err: any) {
      toast({
        variant: "error",
        message: err.response?.data?.error || "เกิดข้อผิดพลาดในการเพิ่มเกรดสินค้า",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="เพิ่มเกรดสินค้า"
      description="เพิ่มเกรดสินค้าใหม่สำหรับใช้ในการจัดหมวดหมู่สินค้า"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="ชื่อเกรดสินค้า"
          value={gradeName}
          onChange={(e) => setGradeName(e.target.value)}
          placeholder="เช่น A, B, C, Premium"
          required
        />
        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            ยกเลิก
          </Button>
          <Button type="submit" variant="primary" isLoading={submitting}>
            เพิ่มเกรดสินค้า
          </Button>
        </div>
      </form>
    </Modal>
  );
}
