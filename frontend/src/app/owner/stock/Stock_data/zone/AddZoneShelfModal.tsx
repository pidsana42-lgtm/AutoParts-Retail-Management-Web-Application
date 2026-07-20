import React, { useState, useEffect } from "react";
import Input from "../../../../../components/elements/input";
import Select from "../../../../../components/elements/select";
import Modal from "../../../../../components/elements/modal";
import Button from "../../../../../components/elements/button";
import { useToast } from "../../../../../components/elements/toast";
import { stockDataService } from "../../../../../service/http/wms/stock_data_service";
import type { Zone } from "../../../../../interface/wms/stock_data";

interface AddZoneShelfModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  zones: Zone[];
  defaultMode?: "new_zone" | "existing_zone";
  initialZoneId?: number;
}

export default function AddZoneShelfModal({
  isOpen,
  onClose,
  onSuccess,
  zones,
  defaultMode = "new_zone",
  initialZoneId
}: AddZoneShelfModalProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"new_zone" | "existing_zone">(defaultMode);

  // Zone input
  const [zoneName, setZoneName] = useState("");

  // Shelf inputs
  const [shelfForm, setShelfForm] = useState({
    shelf_name: "",
    zone_id: 0,
  });

  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode, isOpen]);

  useEffect(() => {
    setShelfForm((prev) => ({
      ...prev,
      zone_id: initialZoneId || (zones[0]?.id || 0),
    }));
  }, [initialZoneId, zones, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === "new_zone") {
        if (!zoneName.trim()) {
          toast({ variant: "error", message: "กรุณากรอกชื่อโซนสินค้าใหม่" });
          return;
        }

        // Create new zone
        await stockDataService.createZone({ zone_name: zoneName });

        // If shelf is also filled, create it
        if (shelfForm.shelf_name.trim()) {
          // Fetch updated zones to find the newly created zone's ID
          const updatedZones = await stockDataService.getZones();
          const newZone = updatedZones.find(
            (z) => z.zone_name.trim().toLowerCase() === zoneName.trim().toLowerCase()
          );

          if (newZone) {
            await stockDataService.createShelf({
              shelf_name: shelfForm.shelf_name,
              zone_id: newZone.id,
            });
          }
        }

        toast({ variant: "success", message: "บันทึกข้อมูลโซนสินค้าสำเร็จ" });
      } else {
        // Adding shelf to existing zone
        if (!shelfForm.zone_id) {
          toast({ variant: "error", message: "กรุณาเลือกโซนสินค้าหลัก" });
          return;
        }
        if (!shelfForm.shelf_name.trim()) {
          toast({ variant: "error", message: "กรุณากรอกชื่อชั้นวาง" });
          return;
        }

        await stockDataService.createShelf(shelfForm);
        toast({ variant: "success", message: "เพิ่มชั้นวางสินค้าสำเร็จ" });
      }

      // Reset
      setZoneName("");
      setShelfForm({ shelf_name: "", zone_id: zones[0]?.id || 0 });
      onSuccess();
      onClose();
    } catch (err) {
      toast({ variant: "error", message: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="จัดการโซน & ชั้นวางสินค้า">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Toggle Mode */}
        <div className="flex bg-slate-100 p-1 rounded-sm border border-slate-200">
          <button
            type="button"
            onClick={() => setMode("new_zone")}
            className={[
              "flex-1 text-center py-1.5 text-xs font-semibold rounded-sm transition-all duration-150 cursor-pointer",
              mode === "new_zone" ? "bg-white text-[#B70011] shadow-sm" : "text-slate-600"
            ].join(" ")}
          >
            สร้างโซนสินค้าใหม่
          </button>
          <button
            type="button"
            onClick={() => setMode("existing_zone")}
            className={[
              "flex-1 text-center py-1.5 text-xs font-semibold rounded-sm transition-all duration-150 cursor-pointer",
              mode === "existing_zone" ? "bg-white text-[#B70011] shadow-sm" : "text-slate-600"
            ].join(" ")}
          >
            เลือกโซนหลักที่มีอยู่แล้ว
          </button>
        </div>

        {mode === "new_zone" ? (
          <div className="space-y-4 border-b border-slate-100 pb-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">ข้อมูลโซนหลัก</h4>
            <Input
              label="ชื่อโซนสินค้า"
              required
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
              placeholder="เช่น A, B, โซนหน้าห้อง..."
            />
          </div>
        ) : (
          <div className="space-y-4">
            <Select
              label="เลือกโซนหลัก"
              required
              options={zones.map((z) => ({ label: z.zone_name, value: String(z.id) }))}
              value={String(shelfForm.zone_id)}
              onChange={(e) => setShelfForm({ ...shelfForm, zone_id: Number(e.target.value) })}
            />
          </div>
        )}

        {/* Shelf Fields (Optional for new zone, Required for existing zone) */}
        <div className="space-y-4 pt-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            ข้อมูลชั้นวางสินค้า {mode === "new_zone" && "(ไม่บังคับใส่)"}
          </h4>
          <Input
            label="ชื่อชั้นวาง/ตำแหน่ง"
            required={mode === "existing_zone"}
            value={shelfForm.shelf_name}
            onChange={(e) => setShelfForm({ ...shelfForm, shelf_name: e.target.value })}
            placeholder="เช่น A-01, A-02..."
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
