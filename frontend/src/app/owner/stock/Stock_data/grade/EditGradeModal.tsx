import React, { useState, useEffect } from "react";
import Modal from "../../../../../components/elements/modal";
import Input from "../../../../../components/elements/input";
import Button from "../../../../../components/elements/button";
import { useToast } from "../../../../../components/elements/toast";
import { stockDataService } from "../../../../../service/http/wms/stock_data_service";
import type { Grade } from "../../../../../interface/wms/stock_data";

interface EditGradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  grade: Grade | null;
  onSuccess: () => void;
}

export default function EditGradeModal({
  isOpen,
  onClose,
  grade,
  onSuccess,
}: EditGradeModalProps) {
  const { toast } = useToast();
  const [gradeName, setGradeName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (grade && isOpen) {
      setGradeName(grade.grade_name);
    }
  }, [grade, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grade) return;
    if (!gradeName.trim()) {
      toast({ variant: "error", message: "กรุณากรอกชื่อเกรดสินค้า" });
      return;
    }

    try {
      setSubmitting(true);
      await stockDataService.updateGrade(grade.id, {
        grade_name: gradeName.trim(),
      });
      toast({ variant: "success", message: "แก้ไขเกรดสินค้าสำเร็จ" });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({
        variant: "error",
        message: err.response?.data?.error || "เกิดข้อผิดพลาดในการแก้ไขเกรดสินค้า",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="แก้ไขเกรดสินค้า"
      description="แก้ไขชื่อเกรดสินค้า"
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
            บันทึกการแก้ไข
          </Button>
        </div>
      </form>
    </Modal>
  );
}
