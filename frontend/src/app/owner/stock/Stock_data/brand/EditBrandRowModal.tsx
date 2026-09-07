import React, { useState, useEffect } from "react";
import { Save } from "lucide-react";
import Input from "../../../../../components/elements/input";
import Select from "../../../../../components/elements/select";
import Modal from "../../../../../components/elements/modal";
import Button from "../../../../../components/elements/button";
import { useToast } from "../../../../../components/elements/toast";
import { useAlertDialog } from "../../../../../components/elements/alert_dialog";
import type { Brand, Model } from "../../../../../interface/wms/stock_data";

import { stockDataService } from "../../../../../service/http/wms/stock_data_service";

interface EditBrandRowModalProps {
  isOpen: boolean;
  onClose: () => void;
  brand: Brand | null;
  model: Model | null;
  brands: Brand[];
  onSuccess: () => void;
}

export default function EditBrandRowModal({
  isOpen,
  onClose,
  brand,
  model,
  brands,
  onSuccess
}: EditBrandRowModalProps) {
  const { toast } = useToast();
  const { confirmDialog } = useAlertDialog();
  
  const [brandName, setBrandName] = useState("");
  const [modelName, setModelName] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState<number>(0);

  useEffect(() => {
    if (isOpen && brand) {
      setBrandName(brand.brand_name || "");
      setSelectedBrandId(brand.id);
      setModelName(model?.model_name || "");
    }
  }, [isOpen, brand, model]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand) return;

    // ตรวจข้อมูลที่กรอกให้ครบก่อนถามยืนยัน — ไม่ให้ผู้ใช้กดยืนยันแล้วเพิ่งเจอ error
    if (!model && brandName.trim() !== brand.brand_name && !brandName.trim()) {
      toast({ variant: "error", message: "กรุณากรอกชื่อแบรนด์" });
      return;
    }
    if (
      model &&
      (modelName.trim() !== model.model_name || selectedBrandId !== model.brand_id) &&
      !modelName.trim()
    ) {
      toast({ variant: "error", message: "กรุณากรอกชื่อรุ่นรถ (หรือหากต้องการลบ ให้ใช้ปุ่มลบด้านนอก)" });
      return;
    }

    // ยืนยันก่อนบันทึก (เคสนี้ทั้งแก้ไขและเพิ่มใหม่ได้ในครั้งเดียว)
    const confirmed = await confirmDialog(
      "ยืนยันบันทึกข้อมูลนี้หรือไม่?",
      { title: "ยืนยันการบันทึก", confirmText: "บันทึกข้อมูล", variant: "info", icon: Save }
    );
    if (!confirmed) return;

    try {
      let isUpdated = false;

      // 1. Update Brand (Only if we are editing the Brand itself, meaning no model)
      if (!model) {
        if (brandName.trim() !== brand.brand_name) {
          await stockDataService.updateBrand(brand.id, { brand_name: brandName.trim() });
          isUpdated = true;
        }
      }

      // 2. Update or Create Model
      if (model) {
        // Editing Model itself
        if (modelName.trim() !== model.model_name || selectedBrandId !== model.brand_id) {
          await stockDataService.updateModel(model.id, { model_name: modelName.trim(), brand_id: selectedBrandId });
          isUpdated = true;
        }
      } else if (modelName.trim()) {
        // Create new model
        await stockDataService.createModel({ model_name: modelName.trim(), brand_id: brand.id });
        isUpdated = true;
      }

      if (isUpdated) {
        toast({ variant: "success", message: "บันทึกข้อมูลสำเร็จ" });
        onSuccess();
      }
      onClose();
    } catch (err) {
      toast({ variant: "error", message: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" });
    }
  };

  if (!brand) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="แก้ไขข้อมูล แบรนด์/รุ่นรถ">
      <form onSubmit={handleSubmit} className="space-y-4">
        
        <div className="space-y-4 pb-2 border-b border-slate-100">
          {model ? (
            <Select
              label="เลือกแบรนด์รถ (ย้ายแบรนด์)"
              required
              options={brands.map((b) => ({ label: b.brand_name, value: String(b.id) }))}
              value={String(selectedBrandId)}
              onChange={(e) => setSelectedBrandId(Number(e.target.value))}
            />
          ) : (
            <Input
              label="ชื่อแบรนด์รถ"
              required
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
            />
          )}
        </div>

        <div className="space-y-4 pt-2">
          <Input
            label={model ? "ชื่อรุ่นรถ" : "เพิ่มรุ่นรถใหม่ (เว้นว่างได้ถ้าไม่ต้องการ)"}
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
          <Button type="button" variant="tertiary" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button type="submit" variant="primary">
            บันทึกการแก้ไข
          </Button>
        </div>
      </form>
    </Modal>
  );
}
