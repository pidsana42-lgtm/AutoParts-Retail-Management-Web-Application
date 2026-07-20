import React, { useState } from "react";
import Input from "../../../../../components/elements/input";
import Modal from "../../../../../components/elements/modal";
import Button from "../../../../../components/elements/button";
import { useToast } from "../../../../../components/elements/toast";
import type { Brand } from "../../../../../interface/wms/stock_data";

interface AddBrandModalProps {
  isOpen: boolean;
  onClose: () => void;
  brands: Brand[];
  saveLocalBrands: (brands: Brand[]) => void;
}

export default function AddBrandModal({ isOpen, onClose, brands, saveLocalBrands }: AddBrandModalProps) {
  const { toast } = useToast();
  const [brandName, setBrandName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newBrand: Brand = {
      id: Date.now(),
      brand_name: brandName,
      models: [],
    };
    saveLocalBrands([...brands, newBrand]);
    toast({ variant: "success", message: "เพิ่มแบรนด์รถสำเร็จ" });
    setBrandName("");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="เพิ่มแบรนด์รถยนต์">
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
