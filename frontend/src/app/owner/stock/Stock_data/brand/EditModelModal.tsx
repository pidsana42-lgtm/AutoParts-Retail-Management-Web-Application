import React, { useState, useEffect } from "react";
import Input from "../../../../../components/elements/input";
import Select from "../../../../../components/elements/select";
import Modal from "../../../../../components/elements/modal";
import Button from "../../../../../components/elements/button";
import { useToast } from "../../../../../components/elements/toast";
import type { Brand, Model } from "../../../../../interface/wms/stock_data";

interface EditModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  brands: Brand[];
  model: Model | null;
  saveLocalBrands: (brands: Brand[]) => void;
}

export default function EditModelModal({
  isOpen,
  onClose,
  brands,
  model,
  saveLocalBrands
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!model) return;

    // Update model inside brand list
    const updated = brands.map((b) => {
      if (b.models) {
        const updatedModels = b.models.map((m) =>
          m.id === model.id
            ? { ...m, model_name: form.model_name, brand_id: form.brand_id }
            : m
        );

        // Handle moving to another brand
        const modelToUpdate = updatedModels.find((m) => m.id === model.id);
        if (modelToUpdate && b.id !== form.brand_id) {
          // Remove from current brand
          return {
            ...b,
            models: b.models.filter((m) => m.id !== model.id),
          };
        }
        return { ...b, models: updatedModels };
      }
      return b;
    });

    const finalBrands = updated.map((b) => {
      if (b.id === form.brand_id) {
        const exists = b.models?.some((m) => m.id === model.id);
        if (!exists) {
          return {
            ...b,
            models: [...(b.models || []), { id: model.id, model_name: form.model_name, brand_id: form.brand_id }],
          };
        }
      }
      return b;
    });

    saveLocalBrands(finalBrands);
    toast({ variant: "success", message: "แก้ไขรุ่นรถสำเร็จ" });
    onClose();
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
