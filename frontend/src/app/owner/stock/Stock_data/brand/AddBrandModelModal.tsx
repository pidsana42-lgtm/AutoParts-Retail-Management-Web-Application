import React, { useState, useEffect } from "react";
import Input from "../../../../../components/elements/input";
import Select from "../../../../../components/elements/select";
import Modal from "../../../../../components/elements/modal";
import Button from "../../../../../components/elements/button";
import { useToast } from "../../../../../components/elements/toast";
import type { Brand, Model } from "../../../../../interface/wms/stock_data";

import { stockDataService } from "../../../../../service/http/wms/stock_data_service";

interface AddBrandModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  brands: Brand[];
  initialMode?: "new_brand" | "existing_brand";
  initialBrandId?: number;
  onSuccess: () => void;
}

export default function AddBrandModelModal({
  isOpen,
  onClose,
  brands,
  initialMode = "new_brand",
  initialBrandId,
  onSuccess
}: AddBrandModelModalProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"new_brand" | "existing_brand">(initialMode);

  // Brand Name
  const [brandName, setBrandName] = useState("");

  // Model Name
  const [modelForm, setModelForm] = useState({
    model_name: "",
    brand_id: 0,
  });

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode, isOpen]);

  useEffect(() => {
    setModelForm((prev) => ({
      ...prev,
      brand_id: initialBrandId || (brands[0]?.id || 0),
    }));
  }, [initialBrandId, brands, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "new_brand") {
      if (!brandName.trim()) {
        toast({ variant: "error", message: "กรุณากรอกชื่อแบรนด์ใหม่" });
        return;
      }

      try {
        const newBrand = await stockDataService.createBrand({ brand_name: brandName });
        
        // If model is also filled, create it inside
        if (modelForm.model_name.trim()) {
           await stockDataService.createModel({
             model_name: modelForm.model_name,
             brand_id: newBrand.ID || newBrand.id,
           });
        }
        
        onSuccess();
        toast({ variant: "success", message: "บันทึกข้อมูลแบรนด์รถสำเร็จ" });
      } catch (err) {
        toast({ variant: "error", message: "ไม่สามารถบันทึกข้อมูลแบรนด์รถได้" });
      }
    } else {
      // Adding model to existing brand
      if (!modelForm.brand_id) {
        toast({ variant: "error", message: "กรุณาเลือกแบรนด์รถ" });
        return;
      }
      if (!modelForm.model_name.trim()) {
        toast({ variant: "error", message: "กรุณากรอกชื่อรุ่นรถ" });
        return;
      }

      try {
        await stockDataService.createModel({
          model_name: modelForm.model_name,
          brand_id: Number(modelForm.brand_id),
        });
        
        onSuccess();
        toast({ variant: "success", message: "บันทึกรุ่นรถเข้าแบรนด์สำเร็จ" });
      } catch (err) {
        toast({ variant: "error", message: "ไม่สามารถบันทึกรุ่นรถได้" });
      }
    }
    
    // Clear forms and close
    setBrandName("");
    setModelForm({ model_name: "", brand_id: brands[0]?.id || 0 });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="จัดการแบรนด์ & รุ่นรถยนต์">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Toggle Mode */}
        <div className="flex bg-slate-100 p-1 rounded-sm border border-slate-200">
          <button
            type="button"
            onClick={() => setMode("new_brand")}
            className={[
              "flex-1 text-center py-1.5 text-xs font-semibold rounded-sm transition-all duration-150 cursor-pointer",
              mode === "new_brand" ? "bg-white text-[#B70011] shadow-sm" : "text-slate-600"
            ].join(" ")}
          >
            สร้างแบรนด์รถใหม่
          </button>
          <button
            type="button"
            onClick={() => setMode("existing_brand")}
            className={[
              "flex-1 text-center py-1.5 text-xs font-semibold rounded-sm transition-all duration-150 cursor-pointer",
              mode === "existing_brand" ? "bg-white text-[#B70011] shadow-sm" : "text-slate-600"
            ].join(" ")}
          >
            เลือกแบรนด์รถที่มีอยู่แล้ว
          </button>
        </div>

        {mode === "new_brand" ? (
          <div className="space-y-4 border-b border-slate-100 pb-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">ข้อมูลแบรนด์รถยนต์</h4>
            <Input
              label="ชื่อแบรนด์"
              required
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="เช่น Toyota, Honda, Isuzu..."
            />
          </div>
        ) : (
          <div className="space-y-4">
            <Select
              label="เลือกแบรนด์รถยนต์"
              required
              options={brands.map((b) => ({ label: b.brand_name, value: String(b.id) }))}
              value={String(modelForm.brand_id)}
              onChange={(e) => setModelForm({ ...modelForm, brand_id: Number(e.target.value) })}
            />
          </div>
        )}

        {/* Model Fields (Optional for new brand, Required for existing brand) */}
        <div className="space-y-4 pt-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            ข้อมูลรุ่นรถยนต์ {mode === "new_brand" && "(ไม่บังคับใส่)"}
          </h4>
          <Input
            label="ชื่อรุ่นรถ"
            required={mode === "existing_brand"}
            value={modelForm.model_name}
            onChange={(e) => setModelForm({ ...modelForm, model_name: e.target.value })}
            placeholder="เช่น HILUX REVO 2.8, CIVIC FE..."
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
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
