import React, { useState, useEffect } from "react";
import Input from "../../../../../components/elements/input";
import Modal from "../../../../../components/elements/modal";
import Button from "../../../../../components/elements/button";
import { useToast } from "../../../../../components/elements/toast";
import type { Brand } from "../../../../../interface/wms/stock_data";

interface EditBrandModalProps {
  isOpen: boolean;
  onClose: () => void;
  brands: Brand[];
  brand: Brand | null;
  saveLocalBrands: (brands: Brand[]) => void;
}

export default function EditBrandModal({
  isOpen,
  onClose,
  brands,
  brand,
  saveLocalBrands
}: EditBrandModalProps) {
  const { toast } = useToast();
  const [brandName, setBrandName] = useState("");

  useEffect(() => {
    if (brand) {
      setBrandName(brand.brand_name || "");
    }
  }, [brand]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand) return;
    const updated = brands.map((b) =>
      b.id === brand.id ? { ...b, brand_name: brandName } : b
    );
    saveLocalBrands(updated);
    toast({ variant: "success", message: "แก้ไขแบรนด์รถสำเร็จ" });
    onClose();
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
