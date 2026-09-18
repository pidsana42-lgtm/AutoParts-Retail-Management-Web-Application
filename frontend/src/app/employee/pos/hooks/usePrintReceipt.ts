import { useState } from "react";
import { posApiService } from "../../../../service/http/pos/pos_service";
import { autoPrintPdfBlob } from "../../../../utils/print";
import { useToast } from "../../../../components/elements/toast";

// usePrintReceipt: สั่งพิมพ์ใบเสร็จ/ใบส่งของ PDF ของออเดอร์ พร้อม state บอกว่ากำลังพิมพ์ใบไหนอยู่
// แยกออกมาให้ใช้ร่วมกันได้ทั้งหน้า "ประวัติการขายสินค้า" และหน้า "รายละเอียดออเดอร์" ที่กดเข้ามาจากฟีดการเคลื่อนไหวคลังสินค้า
export function usePrintReceipt() {
  const { toast } = useToast();
  const [printingOrderId, setPrintingOrderId] = useState<number | string | null>(null);

  const handlePrintReceipt = async (orderId: number | string, orderNumber?: string) => {
    setPrintingOrderId(orderId);
    try {
      const blob = await posApiService.printOrderReceipt(orderId);
      const rawNum = orderNumber || orderId;
      const fileName = String(rawNum).startsWith("INV") ? `${rawNum}.pdf` : `INV-${rawNum}.pdf`;
      autoPrintPdfBlob(blob, fileName);
    } catch (err) {
      console.error("Failed to print receipt:", err);
      toast({ variant: "error", message: "ไม่สามารถสร้างไฟล์ PDF ใบเสร็จได้ กรุณาลองใหม่อีกครั้ง" });
    } finally {
      setPrintingOrderId(null);
    }
  };

  return { printingOrderId, handlePrintReceipt };
}
