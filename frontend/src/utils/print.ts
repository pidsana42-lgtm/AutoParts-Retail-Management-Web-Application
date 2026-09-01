import type { TopSellerItem, DebtAgingItem } from '../interface/dashboard/dashboard_interface';
import { formatDateThai } from './formatdate';

// Re-export all POS print utilities and statement interfaces
export * from './payment_history_print';

function printHtml(html: string) {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
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

export function exportDebtAgingPdf(rows: DebtAgingItem[], dateLabel: string) {
  if (rows.length === 0) return;

  const trs = rows
    .map(
      (r) => `<tr>
    <td>${r.customer_code}</td>
    <td>${r.customer_name}</td>
    <td class="num">฿${r.total_debt.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
    <td class="num" style="color:#dc2626">฿${r.remaining_balance.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
    <td class="center">${formatDateThai(r.last_purchase_date)}</td>
    <td class="center">${r.age_days}</td>
    <td class="${r.status === 'เกินกำหนด' ? 'badge-red' : r.status === 'ชำระหมดแล้ว' ? 'badge-gray' : 'badge-green'}">${r.status}</td>
  </tr>`,
    )
    .join('');

  printHtml(`<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
<title>รายงานอายุหนี้</title>
<style>
  body { font-family: 'Sarabun', sans-serif; padding: 24px; font-size: 13px; }
  h2 { margin-bottom: 4px; }
  p  { margin: 0 0 16px; color: #666; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f3f4f6; text-align: left; padding: 8px 10px; border: 1px solid #e5e7eb; }
  td { padding: 7px 10px; border: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #fafafa; }
  .num        { text-align: right; }
  .center     { text-align: center; }
  .badge-red  { color: #dc2626; font-weight: 600; }
  .badge-green{ color: #059669; font-weight: 600; }
  .badge-gray { color: #6b7280; font-weight: 600; }
  @media print { @page { margin: 16mm; } }
</style></head><body>
<h2>รายงานการวิเคราะห์อายุหนี้</h2>
<p>ช่วงวันที่: ${dateLabel}</p>
<table>
  <thead><tr>
    <th>รหัสลูกค้า</th><th>ชื่อลูกค้า</th>
    <th class="num">ยอดหนี้ทั้งหมด</th><th class="num">ยอดหนี้คงเหลือ</th>
    <th class="center">วันที่ซื้อล่าสุด</th><th class="center">อายุหนี้ (วัน)</th><th>สถานะ</th>
  </tr></thead>
  <tbody>${trs}</tbody>
</table>
</body></html>`);
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

