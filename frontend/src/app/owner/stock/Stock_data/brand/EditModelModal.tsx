import React, { useState, useEffect } from "react";
import Input from "../../../../../components/elements/input";
import Select from "../../../../../components/elements/select";
import Modal from "../../../../../components/elements/modal";
import Button from "../../../../../components/elements/button";
import { useToast } from "../../../../../components/elements/toast";
import type { Brand, Model } from "../../../../../interface/wms/stock_data";

import { stockDataService } from "../../../../../service/http/wms/stock_data_service";

interface EditModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  brands: Brand[];
  model: Model | null;
  onSuccess: () => void;
}

export default function EditModelModal({
  isOpen,
  onClose,
  brands,
  model,
  onSuccess
}: EditModelModalProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    model_name: "",
    brand_id: 0,
  });

  useEffect(() => {
    if (model) {
      setForm({
        model_name: model.model_name || "",
        brand_id: model.brand_id || 0,
      });
    }
  }, [model]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!model) return;

    try {
      await stockDataService.updateModel(model.id, {
        model_name: form.model_name,
        brand_id: form.brand_id,
      });
      onSuccess();
      toast({ variant: "success", message: "แก้ไขรุ่นรถสำเร็จ" });
      onClose();
    } catch (err) {
      toast({ variant: "error", message: "ไม่สามารถแก้ไขรุ่นรถได้" });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="แก้ไขรุ่นรถยนต์">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="เลือกแบรนด์รถ"
          required
          options={brands.map((b) => ({ label: b.brand_name, value: String(b.id) }))}
          value={String(form.brand_id)}
          onChange={(e) => setForm({ ...form, brand_id: Number(e.target.value) })}
        />
        <Input
          label="ชื่อรุ่นรถ"
          required
          value={form.model_name}
          onChange={(e) => setForm({ ...form, model_name: e.target.value })}
          placeholder="เช่น HILUX REVO 2.8, CIVIC FE..."
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
