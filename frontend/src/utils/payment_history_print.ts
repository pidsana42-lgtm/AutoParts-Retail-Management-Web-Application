import type { CustomerStatementPrintParams } from '../interface/pos/statement_print_interface';
import { posApiService } from '../service/http/pos/pos_service';

export type { CustomerStatementPrintParams } from '../interface/pos/statement_print_interface';

export interface CustomerStatementBackendOptions {
  customerName?: string;
  startDate?: string;
  endDate?: string;
  paymentType?: string;
  status?: string;
  paymentMethod?: string;
  action?: 'print' | 'preview' | 'download';
}

export interface RepaymentReceiptBackendOptions {
  receiptNumber?: string;
  action?: 'print' | 'preview' | 'download';
}

/**
 * สั่งพิมพ์หรือพรีวิวใบเสร็จรับเงินชำระหนี้ (Repayment Receipt) โดยดึงไฟล์ PDF ตรงจาก Backend (Single Source of Truth)
 * ใช้มาตรฐานเดียวกับหน้าขายหน้าร้าน (pos.tsx)
 *
 * @param receiptIdOrNo ID หรือเลขที่ใบเสร็จรับเงิน (เช่น REC-xxx)
 * @param options ตัวเลือกเสริม เช่น receiptNumber, action ('print' | 'preview' | 'download')
 */
export async function printRepaymentReceiptFromBackend(
  receiptIdOrNo: number | string,
  options?: RepaymentReceiptBackendOptions
): Promise<Blob> {
  const blob = await posApiService.printPaymentReceiptPDF(receiptIdOrNo);
  const rawNum = options?.receiptNumber || receiptIdOrNo;
  const fileName = String(rawNum).startsWith('REC') ? `${rawNum}.pdf` : `Receipt-${rawNum}.pdf`;

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
 * สั่งพิมพ์หรือพรีวิวใบสรุปประวัติการชำระเงินและยอดค้างชำระของลูกค้า (Customer Statement)
 * โดยดึงไฟล์ PDF ตรงจาก Backend (Single Source of Truth)
 *
 * @param customerId ID ของลูกค้า
 * @param options ตัวเลือกเสริม เช่น startDate, endDate, paymentType, status, paymentMethod, action ('print' | 'preview' | 'download'), customerName
 */
export async function printCustomerStatementFromBackend(
  customerId: number,
  options?: CustomerStatementBackendOptions
): Promise<Blob> {
  const blob = await posApiService.printCustomerStatementPDF(
    customerId,
    options?.startDate,
    options?.endDate,
    options?.paymentType,
    options?.status,
    options?.paymentMethod
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
    paymentType: params.paymentType,
    status: params.status,
    paymentMethod: params.paymentMethod,
    action: params.action || 'print',
  }).catch((err) => {
    console.error('Error auto-printing customer statement from backend:', err);
  });
}

/**
 * สั่งพิมพ์ไฟล์ PDF Blob ผ่าน hidden iframe สำรองกรณีเบราว์เซอร์บล็อก popup
 */
function autoPrintPdfBlobViaIframe(blobUrl: string, finalName: string) {
  const iframe = document.createElement('iframe');
  iframe.title = finalName;
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.style.opacity = '0.01';
  iframe.style.pointerEvents = 'none';
  iframe.style.border = 'none';
  iframe.style.zIndex = '-9999';

  let hasPrinted = false;
  const triggerPrint = () => {
    if (hasPrinted) return;
    try {
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        hasPrinted = true;
      }
    } catch (_) {}
    setTimeout(() => {
      try {
        if (iframe.parentNode) {
          document.body.removeChild(iframe);
        }
        window.URL.revokeObjectURL(blobUrl);
      } catch (_) {}
    }, 60000);
  };

  iframe.onload = () => setTimeout(triggerPrint, 400);
  iframe.src = blobUrl;
  document.body.appendChild(iframe);
  setTimeout(() => {
    if (!hasPrinted) triggerPrint();
  }, 1000);
}

/**
 * สั่งพิมพ์ไฟล์ PDF Blob โดยเปิดแท็บใหม่แสดงตัวอย่าง (Preview) และเรียกหน้าต่างเครื่องพิมพ์ทันที (เหมือนหน้า WMS)
 * รองรับการทำงานข้ามเบราว์เซอร์ ทั้ง Chrome, Edge, Firefox, Safari
 */
export function autoPrintPdfBlob(blob: Blob, fileName?: string) {
  const finalName = fileName ? (fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`) : 'receipt.pdf';
  const blobUrl = window.URL.createObjectURL(
    blob instanceof Blob ? blob : new Blob([blob], { type: 'application/pdf' })
  );

  // เปิดแท็บใหม่ขึ้นมาแสดงตัวอย่างก่อนพิมพ์ เหมือน WMS
  const printWin = window.open('', '_blank');

  // หากเบราว์เซอร์บล็อกป็อปอัป ให้ใช้ iframe สำรองเพื่อสั่งพิมพ์ทันที
  if (!printWin) {
    autoPrintPdfBlobViaIframe(blobUrl, finalName);
    return;
  }

  printWin.document.title = finalName;
  printWin.document.write(`<!DOCTYPE html>
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
  <iframe id="pdfPreviewFrame" src="${blobUrl}" title="${finalName}"></iframe>
  <script>
    let hasTriggered = false;
    function triggerPrint() {
      if (hasTriggered) return;
      hasTriggered = true;
      try {
        const frame = document.getElementById('pdfPreviewFrame');
        if (frame && frame.contentWindow) {
          frame.contentWindow.focus();
          frame.contentWindow.print();
        } else {
          window.focus();
          window.print();
        }
      } catch (err) {
        try {
          window.focus();
          window.print();
        } catch (_) {}
      }
    }

    const frame = document.getElementById('pdfPreviewFrame');
    if (frame) {
      frame.onload = function() {
        setTimeout(triggerPrint, 400);
      };
    }
    setTimeout(function() {
      if (!hasTriggered) triggerPrint();
    }, 1000);
  </script>
</body>
</html>`);
  printWin.document.close();
  printWin.focus();

  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 120000);
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
