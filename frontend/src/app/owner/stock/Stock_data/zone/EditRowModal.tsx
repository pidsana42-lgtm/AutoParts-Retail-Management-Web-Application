import React, { useState, useEffect } from "react";
import { Save } from "lucide-react";
import Input from "../../../../../components/elements/input";
import Select from "../../../../../components/elements/select";
import Modal from "../../../../../components/elements/modal";
import Button from "../../../../../components/elements/button";
import { useToast } from "../../../../../components/elements/toast";
import { useAlertDialog } from "../../../../../components/elements/alert_dialog";
import { stockDataService } from "../../../../../service/http/wms/stock_data_service";
import type { Zone, Shelf, ShelfLevel } from "../../../../../interface/wms/stock_data";

interface EditRowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  zone: Zone | null;
  shelf: Shelf | null;
  level: ShelfLevel | null;
  zones: Zone[];
  shelves: Shelf[];
}

export default function EditRowModal({
  isOpen,
  onClose,
  onSuccess,
  zone,
  shelf,
  level,
  zones,
  shelves,
}: EditRowModalProps) {
  const { toast } = useToast();
  const { confirmDialog } = useAlertDialog();

  const [zoneName, setZoneName] = useState("");
  const [shelfName, setShelfName] = useState("");
  const [levelName, setLevelName] = useState("");
  const [selectedZoneId, setSelectedZoneId] = useState<number>(0);
  const [selectedShelfId, setSelectedShelfId] = useState<number>(0);

  useEffect(() => {
    if (isOpen && zone) {
      setZoneName(zone.zone_name);
      setSelectedZoneId(zone.id);
      
      setShelfName(shelf?.shelf_name || "");
      setSelectedShelfId(shelf?.id || 0);
      
      setLevelName(level?.level_name || "");
    }
  }, [isOpen, zone, shelf, level]);

  // Available shelves based on selected zone
  const availableShelves = shelves.filter((s) => s.zone_id === selectedZoneId);

  // If selectedZoneId changes, reset selectedShelfId to the first available if not editing a level that already has a valid shelf in this zone
  useEffect(() => {
    if (isOpen && selectedZoneId) {
      const avail = shelves.filter((s) => s.zone_id === selectedZoneId);
      if (!avail.find(s => s.id === selectedShelfId)) {
        setSelectedShelfId(avail.length > 0 ? avail[0].id : 0);
      }
    }
  }, [selectedZoneId, shelves, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zone) return;

    // ตรวจข้อมูลที่กรอกให้ครบก่อนถามยืนยัน — ไม่ให้ผู้ใช้กดยืนยันแล้วเพิ่งเจอ error
    if (!shelf && !level && zoneName.trim() !== zone.zone_name && !zoneName.trim()) {
      toast({ variant: "error", message: "กรุณากรอกชื่อโซนสินค้า" });
      return;
    }
    if (
      shelf &&
      !level &&
      (shelfName.trim() !== shelf.shelf_name || selectedZoneId !== shelf.zone_id) &&
      !shelfName.trim()
    ) {
      toast({ variant: "error", message: "กรุณากรอกชื่อตู้วางสินค้า (หรือหากต้องการลบ ให้ใช้ปุ่มลบด้านนอก)" });
      return;
    }
    if (
      level &&
      (levelName.trim() !== level.level_name || selectedShelfId !== level.shelf_id) &&
      !levelName.trim()
    ) {
      toast({ variant: "error", message: "กรุณากรอกชื่อชั้นระดับ (หรือหากต้องการลบ ให้ใช้ปุ่มลบด้านนอก)" });
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

      // 1. Update Zone (Only if we are editing the Zone itself, meaning no shelf/level)
      if (!shelf && !level) {
        if (zoneName.trim() !== zone.zone_name) {
          await stockDataService.updateZone(zone.id, { zone_name: zoneName.trim() });
          isUpdated = true;
        }
      }

      let currentShelfId = shelf?.id;

      // 2. Update or Create Shelf
      if (shelf && !level) {
        // Editing Shelf itself
        if (shelfName.trim() !== shelf.shelf_name || selectedZoneId !== shelf.zone_id) {
          await stockDataService.updateShelf(shelf.id, { shelf_name: shelfName.trim(), zone_id: selectedZoneId });
          isUpdated = true;
          currentShelfId = shelf.id;
        }
      } else if (!shelf && shelfName.trim()) {
        // Create new shelf
        await stockDataService.createShelf({ shelf_name: shelfName.trim(), zone_id: zone.id });
        isUpdated = true;
        const allShelves = await stockDataService.getShelves();
        const newShelf = allShelves.find(s => s.shelf_name === shelfName.trim() && s.zone_id === zone.id);
        if (newShelf) {
          currentShelfId = newShelf.id;
        }
      }

      // 3. Update or Create Level
      if (level) {
        // Editing Level itself
        if (levelName.trim() !== level.level_name || selectedShelfId !== level.shelf_id) {
          if (selectedShelfId) {
            await stockDataService.updateShelfLevel(level.id, { level_name: levelName.trim(), shelf_id: selectedShelfId });
            isUpdated = true;
          }
        }
      } else if (levelName.trim()) {
        // Create new level
        const targetShelfId = (shelf && !level) ? shelf.id : currentShelfId;
        if (!targetShelfId) {
          toast({ variant: "error", message: "ไม่สามารถสร้างชั้นระดับได้ เนื่องจากไม่มีตู้วางสินค้า" });
          return;
        }
        await stockDataService.createShelfLevel({ level_name: levelName.trim(), shelf_id: targetShelfId });
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

  if (!zone) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="แก้ไขข้อมูล โซน/ตู้/ชั้นระดับ">
      <form onSubmit={handleSubmit} className="space-y-4">
        
        <div className="space-y-4 pb-2 border-b border-slate-100">
          {shelf ? (
            <Select
              label="เลือกโซนสินค้า (ย้ายโซน)"
              required
              options={zones.map((z) => ({ label: z.zone_name, value: String(z.id) }))}
              value={String(selectedZoneId)}
              onChange={(e) => setSelectedZoneId(Number(e.target.value))}
            />
          ) : (
            <Input
              label="ชื่อโซนสินค้า"
              required
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
            />
          )}
        </div>

        <div className="space-y-4 py-2 border-b border-slate-100">
          {level ? (
            <Select
              label="เลือกตู้วางสินค้า (ย้ายตู้)"
              required
              options={availableShelves.map((s) => ({ label: s.shelf_name, value: String(s.id) }))}
              value={String(selectedShelfId)}
              onChange={(e) => setSelectedShelfId(Number(e.target.value))}
              disabled={availableShelves.length === 0}
            />
          ) : (
            <Input
              label={shelf ? "ชื่อตู้วางสินค้า" : "เพิ่มตู้วางสินค้าใหม่ (เว้นว่างได้ถ้าไม่ต้องการ)"}
              value={shelfName}
              onChange={(e) => setShelfName(e.target.value)}
            />
          )}
        </div>

        <div className="space-y-4 pt-2">
          <Input
            label={level ? "ชื่อชั้นระดับ" : "เพิ่มชั้นระดับใหม่ (เว้นว่างได้ถ้าไม่ต้องการ)"}
            value={levelName}
            onChange={(e) => setLevelName(e.target.value)}
            disabled={!shelf && !shelfName.trim()}
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
