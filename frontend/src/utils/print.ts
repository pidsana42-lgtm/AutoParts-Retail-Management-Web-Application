import type { TopSellerItem, DebtAgingItem } from '../interface/dashboard/dashboard_interface';
import { formatDateThai } from './formatdate';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Re-export all POS & statement print utilities
export {
  printCustomerStatement,
  printCustomerStatementFromBackend,
  type CustomerStatementBackendOptions,
  type CustomerStatementPrintParams,
  autoPrintPdfBlob,
} from './payment_history_print';

export {
  printPosReceipt,
  printPosReceiptFromBackend,
  type PosPrintBackendOptions,
  type PosReceiptPrintParams,
  type PosReceiptPrintItem,
} from './pos_print';

function printHtml(html: string) {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

function escapeHtml(value: string | number) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function downloadHtmlPagesAsPdf(pages: string[], fileName: string) {
  const pageWidthPx = 1123; // A4 landscape at roughly 96 dpi
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidthMm = pdf.internal.pageSize.getWidth();
  const pageHeightMm = pdf.internal.pageSize.getHeight();
  const marginMm = 8;

  await Promise.all([
    document.fonts?.load('600 18px "Sarabun"'),
    document.fonts?.load('400 12px "Sarabun"'),
  ]).catch(() => {});
  await document.fonts?.ready;

  for (let index = 0; index < pages.length; index += 1) {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-10000px';
    container.style.top = '0';
    container.style.width = `${pageWidthPx}px`;
    container.style.background = '#ffffff';
    container.innerHTML = pages[index];
    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        windowWidth: pageWidthPx,
      });

      if (index > 0) pdf.addPage();

      const maxWidthMm = pageWidthMm - (marginMm * 2);
      const maxHeightMm = pageHeightMm - (marginMm * 2);
      const scale = Math.min(maxWidthMm / canvas.width, maxHeightMm / canvas.height);
      const imageWidthMm = canvas.width * scale;
      const imageHeightMm = canvas.height * scale;
      const x = (pageWidthMm - imageWidthMm) / 2;

      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, marginMm, imageWidthMm, imageHeightMm);
    } finally {
      container.remove();
    }
  }

  pdf.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
}

export function exportTopSellerPdf(items: TopSellerItem[], periodLabel: string) {
  if (items.length === 0) return;

  const rows = items
    .map(
      (item, i) => `<tr>
    <td class="center">#${i + 1}</td>
    <td>${item.product_name}</td>
    <td class="center">${item.category}</td>
    <td class="num">${item.total_sold.toLocaleString('th-TH')}</td>
    <td class="num">${item.total_revenue.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
  </tr>`,
    )
    .join('');

  printHtml(`<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
<title>สินค้าขายดี 10 อันดับ</title>
<style>
  body { font-family: 'Sarabun', sans-serif; padding: 24px; font-size: 13px; }
  h2 { margin-bottom: 4px; }
  p  { margin: 0 0 16px; color: #666; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f3f4f6; text-align: left; padding: 8px 10px; border: 1px solid #e5e7eb; }
  td { padding: 7px 10px; border: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #fafafa; }
  .num    { text-align: right; }
  .center { text-align: center; }
  @media print { @page { margin: 16mm; } }
</style></head><body>
<h2>สินค้าขายดี 10 อันดับของร้าน</h2>
<p>ช่วงเวลา: ${periodLabel}</p>
<table>
  <thead><tr>
    <th class="center">อันดับ</th>
    <th>ชื่อสินค้า</th>
    <th class="center">หมวดหมู่</th>
    <th class="num">ขายแล้ว (ชิ้น)</th>
    <th class="num">ยอดขายรวม (บาท)</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`);
}

export async function exportDebtAgingPdf(
  rows: DebtAgingItem[],
  dateLabel: string,
  fileName = 'debt-aging-report.pdf',
) {
  if (rows.length === 0) return;

  const rowsPerPage = 20;
  const totalPages = Math.ceil(rows.length / rowsPerPage);
  const pages = Array.from({ length: totalPages }, (_, pageIndex) => {
    const pageRows = rows.slice(pageIndex * rowsPerPage, (pageIndex + 1) * rowsPerPage);
    const trs = pageRows.map((r) => `<tr>
      <td>${escapeHtml(r.customer_code)}</td>
      <td>${escapeHtml(r.customer_name)}</td>
      <td class="num">฿${r.total_debt.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
      <td class="num debt">฿${r.remaining_balance.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
      <td class="center">${escapeHtml(formatDateThai(r.last_purchase_date, '-'))}</td>
      <td class="center">${escapeHtml(r.age_days)}</td>
      <td class="${r.status === 'เกินกำหนด' ? 'badge-red' : r.status === 'ชำระหมดแล้ว' ? 'badge-gray' : 'badge-green'}">${escapeHtml(r.status)}</td>
    </tr>`).join('');

    return `<style>
      .debt-pdf { box-sizing: border-box; width: 1123px; padding: 20px 28px; background: #fff; color: #111827; font-family: 'Sarabun', sans-serif; font-size: 12px; }
      .debt-pdf h2 { margin: 0 0 4px; font-size: 18px; }
      .debt-pdf .meta { display: flex; justify-content: space-between; margin: 0 0 14px; color: #4b5563; }
      .debt-pdf table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      .debt-pdf th { background: #f3f4f6; text-align: left; padding: 7px 8px; border: 1px solid #d1d5db; }
      .debt-pdf td { padding: 6px 8px; border: 1px solid #e5e7eb; overflow-wrap: anywhere; }
      .debt-pdf tr:nth-child(even) td { background: #fafafa; }
      .debt-pdf .num { text-align: right; white-space: nowrap; }
      .debt-pdf .center { text-align: center; }
      .debt-pdf .debt, .debt-pdf .badge-red { color: #dc2626; font-weight: 600; }
      .debt-pdf .badge-green { color: #059669; font-weight: 600; }
      .debt-pdf .badge-gray { color: #6b7280; font-weight: 600; }
    </style>
    <div class="debt-pdf">
      <h2>รายงานการวิเคราะห์อายุหนี้</h2>
      <div class="meta"><span>ช่วงวันที่: ${escapeHtml(dateLabel)}</span><span>หน้า ${pageIndex + 1} / ${totalPages}</span></div>
      <table>
        <thead><tr>
          <th style="width:12%">รหัสลูกค้า</th><th style="width:19%">ชื่อลูกค้า</th>
          <th class="num" style="width:15%">ยอดหนี้ทั้งหมด</th><th class="num" style="width:15%">ยอดหนี้คงเหลือ</th>
          <th class="center" style="width:15%">วันที่ซื้อล่าสุด</th><th class="center" style="width:12%">อายุหนี้ (วัน)</th><th style="width:12%">สถานะ</th>
        </tr></thead>
        <tbody>${trs}</tbody>
      </table>
    </div>`;
  });

  await downloadHtmlPagesAsPdf(pages, fileName);
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

