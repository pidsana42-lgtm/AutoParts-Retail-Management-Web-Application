import React, { useState, useEffect } from "react";
import Input from "../../../../../components/elements/input";
import Select from "../../../../../components/elements/select";
import Modal from "../../../../../components/elements/modal";
import Button from "../../../../../components/elements/button";
import { useToast } from "../../../../../components/elements/toast";
import type { Brand, Model } from "../../../../../interface/wms/stock_data";

interface AddModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  brands: Brand[];
  initialBrandId?: number;
  saveLocalBrands: (brands: Brand[]) => void;
}

export default function AddModelModal({
  isOpen,
  onClose,
  brands,
  initialBrandId,
  saveLocalBrands
}: AddModelModalProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    model_name: "",
    brand_id: 0,
  });

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      brand_id: initialBrandId || (brands[0]?.id || 0),
    }));
  }, [initialBrandId, brands]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.brand_id) {
      toast({ variant: "error", message: "กรุณาเลือกแบรนด์รถ" });
      return;
    }
    const newModel: Model = {
      id: Date.now(),
      model_name: form.model_name,
      brand_id: form.brand_id,
    };
    const updated = brands.map((b) => {
      if (b.id === form.brand_id) {
        return {
          ...b,
          models: [...(b.models || []), newModel],
        };
      }
      return b;
    });
    saveLocalBrands(updated);
    toast({ variant: "success", message: "เพิ่มรุ่นรถสำเร็จ" });
    setForm({
      model_name: "",
      brand_id: initialBrandId || (brands[0]?.id || 0),
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="เพิ่มรุ่นรถยนต์">
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
