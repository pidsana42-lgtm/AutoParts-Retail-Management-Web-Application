import type { PosReceiptPrintParams } from '../interface/pos/statement_print_interface';
import { thaiBahtText } from './payment_history_print';

export type {
  PosReceiptPrintParams,
  PosReceiptPrintItem,
} from '../interface/pos/statement_print_interface';

function printHtml(html: string) {
  const win = window.open('', '_blank');
  if (!win) return;

  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 250);
}


/**
 * สั่งพิมพ์ใบเสร็จรับเงิน / ใบส่งของชั่วคราว POS อัตโนมัติ (ใช้สไตล์และรูปแบบเดียวกับ printCustomerStatement)
 */
export function printPosReceipt(params: PosReceiptPrintParams) {
  const comp = params.companyInfo || {};
  const companyName = comp.company_name || 'เจ.เจ อะไหล่ (หนองสาหร่าย)';
  const companyAddr = comp.address || '51 ม.20 ต.หนองสาหร่าย อ.ปากช่อง จ.นครราชสีมา 30130';
  const companyPhone = comp.phone_number || '096-7985115';
  const companyTax = comp.tax_id_number || '-';

  const docTitle =
    params.docTitle ||
    (params.paymentMethod.includes('เชื่อ') ? 'ใบส่งของชั่วคราว' : 'ใบเสร็จรับเงิน');
  const cust = params.customer || {};
  const custName = cust.customer_name || 'ลูกค้าทั่วไป';
  const custType = cust.customer_type ? ` (${cust.customer_type})` : '';
  const custPhone = cust.phone_number || '-';
  const custAddr = cust.address || '-';

  const thaiTotalText = thaiBahtText(params.finalTotal);

  const printDate = new Date().toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const itemRows =
    params.items.length > 0
      ? params.items
          .map(
            (item, idx) => `<tr>
        <td class="center">${item.index || idx + 1}</td>
        <td style="font-family: monospace; font-size: 11px;">${item.product_code || '-'}</td>
        <td class="bold">${item.product_name}</td>
        <td class="num">${item.quantity.toLocaleString()}</td>
        <td class="center">${item.unit || 'ชิ้น'}</td>
        <td class="num">฿${(Number(item.unit_price) || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
        <td class="num">${item.discount > 0 ? `฿${(Number(item.discount) || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}` : '-'}</td>
        <td class="num bold">฿${(Number(item.subtotal) || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
      </tr>`
          )
          .join('')
      : `<tr><td colspan="8" class="center" style="color:#888; padding: 16px;">- ไม่มีรายการสินค้า -</td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>${docTitle} - ${params.orderNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, sans-serif;
      padding: 24px;
      font-size: 12px;
      color: #1C1B1B;
      background: #FFF;
      line-height: 1.4;
    }
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    .header-table td { vertical-align: top; }
    .company-title { font-size: 18px; font-weight: 700; color: #1C1B1B; }
    .company-meta { font-size: 11px; color: #555; margin-top: 2px; }
    
    .doc-banner {
      background: #FFF;
      border-top: 3px solid #E51C23;
      border-bottom: 1px solid #DDD;
      padding: 8px 0;
      margin-bottom: 14px;
      text-align: center;
    }
    .doc-title {
      font-size: 16px;
      font-weight: 700;
      color: #E51C23;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .info-grid {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 14px;
      background: #F9F9F9;
      padding: 12px 14px;
      border: 1px solid #EAEAEA;
      border-left: 4px solid #E51C23;
    }
    .info-col { flex: 1; }
    .info-title { font-size: 11px; font-weight: 700; color: #E51C23; margin-bottom: 4px; text-transform: uppercase; }
    .info-line { font-size: 11.5px; margin-bottom: 2px; color: #222; }

    .section-title {
      font-size: 12.5px;
      font-weight: 700;
      color: #1C1B1B;
      margin: 14px 0 6px 0;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    .section-title span.count { font-size: 11px; font-weight: 400; color: #666; }

    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
    }
    table.data-table th {
      background: #F3F4F6;
      text-align: left;
      padding: 6px 8px;
      border: 1px solid #D1D5DB;
      font-size: 11px;
      font-weight: 700;
      color: #374151;
    }
    table.data-table td {
      padding: 5px 8px;
      border: 1px solid #E5E7EB;
      font-size: 11px;
      color: #1F2937;
    }
    table.data-table tr:nth-child(even) td { background: #FAFAFA; }
    .num { text-align: right; }
    .center { text-align: center; }
    .bold { font-weight: 600; }
    .badge-green { color: #059669; font-weight: 600; }
    .badge-red { color: #DC2626; font-weight: 600; }

    .summary-card {
      margin-top: 14px;
      border: 1px solid #D1D5DB;
      background: #FAFAFA;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      gap: 16px;
      page-break-inside: avoid;
    }
    .summary-left { flex: 1.2; }
    .summary-right { flex: 0.8; }
    .summary-row {
      display: flex;
      justify-content: space-between;
      font-size: 11.5px;
      margin-bottom: 4px;
      color: #333;
    }
    .summary-row.highlight {
      font-size: 13px;
      font-weight: 700;
      color: #E51C23;
      border-top: 1px solid #D1D5DB;
      padding-top: 5px;
      margin-top: 4px;
    }

    .signature-section {
      margin-top: 36px;
      display: flex;
      justify-content: space-around;
      page-break-inside: avoid;
      text-align: center;
    }
    .signature-box {
      width: 40%;
      font-size: 11px;
      color: #444;
    }
    .sign-line {
      border-bottom: 1px dotted #888;
      height: 32px;
      margin-bottom: 6px;
    }

    @media print {
      @page { size: A4 portrait; margin: 12mm 14mm; }
      body { padding: 0; }
      .no-print { display: none; }
      .no-break { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <table class="header-table">
    <tr>
      <td>
        <div class="company-title">${companyName}</div>
        <div class="company-meta">${companyAddr}</div>
        <div class="company-meta">โทร. ${companyPhone} | เลขประจำตัวผู้เสียภาษี: ${companyTax}</div>
      </td>
      <td style="text-align: right;">
        <div style="font-size: 11px; color: #666;">วันที่ออกเอกสาร: <span class="bold">${printDate}</span></div>
        ${params.salesStaff ? `<div style="font-size: 11px; color: #666;">พนักงานขาย: <span class="bold">${params.salesStaff}</span></div>` : ''}
      </td>
    </tr>
  </table>

  <!-- Title Banner -->
  <div class="doc-banner">
    <div class="doc-title">${docTitle}</div>
  </div>

  <!-- Customer and Sale Information -->
  <div class="info-grid">
    <div class="info-col">
      <div class="info-title">ข้อมูลลูกค้า</div>
      <div class="info-line"><strong>ชื่อลูกค้า:</strong> ${custName}${custType}</div>
      <div class="info-line"><strong>เบอร์โทรศัพท์:</strong> ${custPhone}</div>
      <div class="info-line"><strong>ที่อยู่:</strong> ${custAddr}</div>
    </div>
    <div class="info-col" style="border-left: 1px dashed #DDD; padding-left: 14px;">
      <div class="info-title">ข้อมูลเอกสารการขาย</div>
      <div class="info-line"><strong>เลขที่บิล:</strong> ${params.orderNumber}</div>
      <div class="info-line"><strong>วันที่ทำรายการ:</strong> ${params.orderDate}</div>
      <div class="info-line"><strong>ช่องทางชำระเงิน:</strong> <strong style="color: #E51C23;">${params.paymentMethod}</strong></div>
      <div class="info-line"><strong>พนักงานขาย:</strong> ${params.salesStaff}</div>
    </div>
  </div>

  <!-- Items Table -->
  <div class="section-title">
    <span>รายการสินค้าที่สั่งซื้อ</span>
    <span class="count">รวม ${params.items.length} รายการ</span>
  </div>
  <table class="data-table">
    <thead>
      <tr>
        <th class="center" style="width: 40px;">ลำดับ</th>
        <th style="width: 120px;">รหัสสินค้า</th>
        <th>ชื่อสินค้า / รายการ</th>
        <th class="num" style="width: 60px;">จำนวน</th>
        <th class="center" style="width: 50px;">หน่วย</th>
        <th class="num" style="width: 85px;">ราคา/หน่วย (฿)</th>
        <th class="num" style="width: 80px;">ส่วนลด (฿)</th>
        <th class="num" style="width: 95px;">จำนวนเงิน (฿)</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
    <tfoot>
      <tr style="background:#F3F4F6; font-weight:700;">
        <td colspan="7" class="num">ราคารวมสินค้า (${params.items.length} รายการ):</td>
        <td class="num bold" style="font-size:12px;">฿${params.totalItemPrice.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
      </tr>
    </tfoot>
  </table>

  <!-- Summary Box -->
  <div class="summary-card no-break">
    <div class="summary-left">
      <div style="font-weight: 700; margin-bottom: 4px;">สรุปภาพรวมการชำระเงิน:</div>
      <div style="font-size: 11px; color: #444; margin-bottom: 3px;"><strong>หมายเหตุ:</strong> ${params.remarks || 'ใบเสร็จรับเงินนี้จะสมบูรณ์เมื่อได้รับชำระเงินเรียบร้อยแล้ว'}</div>
      <div style="font-size: 11px; color: #444;">จำนวนเงินสุทธิตัวอักษร: <strong style="color:#1C1B1B;">${thaiTotalText}</strong></div>
    </div>
    <div class="summary-right">
      <div class="summary-row">
        <span>ราคารวมสินค้า:</span>
        <span class="bold">฿${params.totalItemPrice.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
      </div>
      ${
        params.lineDiscountTotal && params.lineDiscountTotal > 0
          ? `
      <div class="summary-row" style="color: #E51C23;">
        <span>ส่วนลดตามรายการ:</span>
        <span class="bold">-฿${params.lineDiscountTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
      </div>
      `
          : ''
      }
      <div class="summary-row" style="color: ${params.billDiscount && params.billDiscount > 0 ? '#E51C23' : '#333'};">
        <span>ส่วนลดท้ายบิล:</span>
        <span class="bold">${params.billDiscount && params.billDiscount > 0 ? `-฿${params.billDiscount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}` : '-'}</span>
      </div>
      <div class="summary-row" style="color: ${params.totalDiscount > 0 ? '#E51C23' : '#333'};">
        <span>ส่วนลดรวมทั้งสิ้น:</span>
        <span class="bold">${params.totalDiscount > 0 ? `-฿${params.totalDiscount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}` : '-'}</span>
      </div>
      <div class="summary-row highlight">
        <span>ยอดเงินสุทธิทั้งสิ้น:</span>
        <span>฿${params.finalTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
      </div>
      ${
        params.paymentMethod.includes('สด') && params.receivedAmount
          ? `
      <div class="summary-row" style="margin-top: 6px; color: #555;">
        <span>รับเงินมา:</span>
        <span class="bold">฿${params.receivedAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
      </div>
      <div class="summary-row" style="color: #059669; font-weight: 600;">
        <span>เงินทอน:</span>
        <span>฿${(params.changeAmount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
      </div>
      `
          : ''
      }
    </div>
  </div>

  <!-- Signatures -->
  <div class="signature-section no-break">
    <div class="signature-box">
      <div class="sign-line"></div>
      <div>( ${params.salesStaff} )</div>
      <div style="font-size: 10px; color: #777; margin-top: 2px;">ผู้รับเงิน / พนักงานขาย</div>
      <div style="font-size: 10px; color: #777;">วันที่ ......./......./............</div>
    </div>
    <div class="signature-box">
      <div class="sign-line"></div>
      <div>( ${custName} )</div>
      <div style="font-size: 10px; color: #777; margin-top: 2px;">ผู้รับสินค้า / ลูกค้า</div>
      <div style="font-size: 10px; color: #777;">วันที่ ......./......./............</div>
    </div>
  </div>
</body>
</html>`;

  printHtml(html);
}
