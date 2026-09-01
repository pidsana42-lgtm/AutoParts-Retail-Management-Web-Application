import type { PosReceiptPrintParams } from '../interface/pos/statement_print_interface';
import {
  autoPrintPdfBlob,
  downloadPdfBlob,
  openPdfBlobInNewTab,
} from './payment_history_print';
import { posApiService } from '../service/http/pos/pos_service';

export type {
  PosReceiptPrintParams,
  PosReceiptPrintItem,
} from '../interface/pos/statement_print_interface';

export interface PosPrintBackendOptions {
  orderNumber?: string;
  customTitle?: string;
  action?: 'print' | 'preview' | 'download';
}

/**
 * สั่งพิมพ์หรือพรีวิวใบเสร็จรับเงิน POS โดยดึงไฟล์ PDF ตรงจาก Backend (Single Source of Truth)
 * ใช้มาตรฐานเดียวกับหน้าประวัติการขาย (sales_history.tsx)
 *
 * @param orderId ID ของคำสั่งซื้อ หรือ Order Number
 * @param options การตั้งค่าเพิ่มเติม เช่น action ('print' | 'preview' | 'download'), customTitle, orderNumber
 */
export async function printPosReceiptFromBackend(
  orderId: number | string,
  options?: PosPrintBackendOptions
): Promise<Blob> {
  const blob = await posApiService.printOrderReceipt(orderId, options?.customTitle);
  const rawNum = options?.orderNumber || orderId;
  const fileName = String(rawNum).startsWith('INV') ? `${rawNum}.pdf` : `Receipt-${rawNum}.pdf`;

  if (options?.action === 'download') {
    downloadPdfBlob(blob, fileName);
  } else if (options?.action === 'preview') {
    openPdfBlobInNewTab(blob, fileName);
  } else {
    // ค่าเริ่มต้น: ส่งตรงเข้า Native Print Dialog ของบราวเซอร์ผ่าน Blob
    autoPrintPdfBlob(blob, fileName);
  }

  return blob;
}

/**
 * @deprecated แนะนำให้เปลี่ยนไปใช้ `printPosReceiptFromBackend` เพื่อดึงและพิมพ์ใบเสร็จ PDF จาก Backend โดยตรง
 */
export function printPosReceipt(params: PosReceiptPrintParams) {
  if (params.orderNumber) {
    printPosReceiptFromBackend(params.orderNumber, {
      orderNumber: params.orderNumber,
      customTitle: params.docTitle,
      action: 'print',
    }).catch((err) => {
      console.error('Failed to print receipt from backend:', err);
    });
  }
}
