import { useState } from "react";
import type { SupplierRejectedSummary } from "../../../../interface/purchase_orders/po_interface";

export function useRejectedBreakdownModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [modalData, setModalData] = useState<SupplierRejectedSummary[]>([]);

  const openModal = (data?: SupplierRejectedSummary[]) => {
    setModalData(data || []);
    setIsOpen(true);
  };

  const closeModal = () => setIsOpen(false);

  // คืนค่าเฉพาะ State และฟังก์ชันออกไปให้ Component อื่นเรียกใช้
  return {
    isOpen,
    modalData,
    openModal,
    closeModal
  };
}