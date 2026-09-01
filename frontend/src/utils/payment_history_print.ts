import type { CustomerStatementPrintParams } from '../interface/pos/statement_print_interface';
import { posApiService } from '../service/http/pos/pos_service';

export type { CustomerStatementPrintParams } from '../interface/pos/statement_print_interface';

export interface CustomerStatementBackendOptions {
  customerName?: string;
  startDate?: string;
  endDate?: string;
  action?: 'print' | 'preview' | 'download';
}

/**
 * สั่งพิมพ์หรือพรีวิวใบสรุปประวัติการชำระเงินและยอดค้างชำระของลูกค้า (Customer Statement)
 * โดยดึงไฟล์ PDF ตรงจาก Backend (Single Source of Truth)
 *
 * @param customerId ID ของลูกค้า
 * @param options ตัวเลือกเสริม เช่น startDate, endDate, action ('print' | 'preview' | 'download'), customerName
 */
export async function printCustomerStatementFromBackend(
  customerId: number,
  options?: CustomerStatementBackendOptions
): Promise<Blob> {
  const blob = await posApiService.printCustomerStatementPDF(
    customerId,
    options?.startDate,
    options?.endDate
  );

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  // กำหนดชื่อไฟล์ให้ตรงกับ Backend: STM-{CustomerID}-{YYYYMMDD}.pdf
  const fileName = `STM-${customerId}-${dateStr}.pdf`;

  if (options?.action === 'download') {
    downloadPdfBlob(blob, fileName);
  } else if (options?.action === 'preview') {
    openPdfBlobInNewTab(blob, fileName);
  } else {
    // ค่าเริ่มต้น: ส่งตรงเข้า Native Print Dialog ของเบราว์เซอร์ผ่าน Blob
    autoPrintPdfBlob(blob, fileName);
  }

  return blob;
}

/**
 * @deprecated แนะนำให้เปลี่ยนไปใช้ `printCustomerStatementFromBackend` เพื่อดึงและพิมพ์ไฟล์ PDF จาก Backend โดยตรง
 */
export function printCustomerStatement(params: CustomerStatementPrintParams) {
  const customerId = params.customerId || params.customer?.id;
  if (!customerId) {
    console.error('Customer ID is required to print customer statement from backend');
    return;
  }

  printCustomerStatementFromBackend(customerId, {
    customerName: params.customerName || params.customer?.customer_name,
    startDate: params.startDate,
    endDate: params.endDate,
    action: params.action || 'print',
  }).catch((err) => {
    console.error('Error auto-printing customer statement from backend:', err);
  });
}

/**
 * สั่งพิมพ์ไฟล์ PDF Blob โดยอัตโนมัติ (Trigger หน้าต่างเครื่องพิมพ์ทันที)
 */
export function autoPrintPdfBlob(blob: Blob, fileName?: string) {
  const finalName = fileName ? (fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`) : 'receipt.pdf';
  const blobUrl = window.URL.createObjectURL(
    blob instanceof Blob ? blob : new Blob([blob], { type: 'application/pdf' })
  );

  const iframe = document.createElement('iframe');
  iframe.title = finalName;
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.src = blobUrl;
  document.body.appendChild(iframe);

  iframe.onload = () => {
    try {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
            window.URL.revokeObjectURL(blobUrl);
          } catch (_) {}
        }, 60000);
      }, 400);
    } catch (err) {
      console.warn('Iframe print error, falling back to window print', err);
      const printWin = window.open(blobUrl, '_blank');
      if (printWin) {
        printWin.focus();
        setTimeout(() => printWin.print(), 400);
      }
    }
  };
}

/**
 * ดาวน์โหลดไฟล์ PDF Blob ลงเครื่องทันที (พร้อมชื่อไฟล์ .pdf ที่ถูกต้อง)
 */
export function downloadPdfBlob(blob: Blob, fileName: string) {
  const finalName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  const blobUrl = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = finalName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
}

/**
 * เปิดพรีวิวไฟล์ PDF Blob ในแท็บใหม่ โดยกำหนด Title และชื่อไฟล์ให้แสดงเป็น .pdf อย่างถูกต้อง
 */
export function openPdfBlobInNewTab(blob: Blob, fileName: string) {
  const finalName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  const blobUrl = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
  const win = window.open('', '_blank');

  if (!win) {
    // กรณีที่เบราว์เซอร์บล็อกป็อปอัป ให้ดาวน์โหลดไฟล์อัตโนมัติ
    downloadPdfBlob(blob, finalName);
    return;
  }

  win.document.title = finalName;
  win.document.write(`<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>${finalName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #525659; }
    iframe { width: 100%; height: 100%; border: none; display: block; }
  </style>
</head>
<body>
  <iframe src="${blobUrl}" title="${finalName}"></iframe>
</body>
</html>`);
  win.document.close();
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 120000);
}
