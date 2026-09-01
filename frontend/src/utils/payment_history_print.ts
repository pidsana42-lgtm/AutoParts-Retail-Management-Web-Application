import type {
  CustomerStatementPrintParams,
} from '../interface/pos/statement_print_interface';
export type {
  CustomerStatementPrintParams,
  CustomerStatementPrintItem,
  CustomerStatementUnpaidBill,
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

/**
 * Helper: แปลงจำนวนเงิน (Number) เป็นตัวอักษรภาษาไทย เช่น 1500.50 -> "หนึ่งพันห้าร้อยบาทห้าสิบสตางค์"
 */
export function thaiBahtText(amount: number): string {
  if (isNaN(amount) || amount === 0) return 'ศูนย์บาทถ้วน';

  let negative = false;
  if (amount < 0) {
    negative = true;
    amount = -amount;
  }

  const rounded = Math.round(amount * 100) / 100;
  const baht = Math.floor(rounded);
  const satang = Math.round((rounded - baht) * 100);

  let result = '';
  if (negative) result += 'ลบ';

  if (baht > 0) {
    result += convertNumberToThaiText(baht) + 'บาท';
  }

  if (satang > 0) {
    result += convertNumberToThaiText(satang) + 'สตางค์';
  } else {
    result += 'ถ้วน';
  }

  return result;
}

function convertNumberToThaiText(num: number): string {
  const digits = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const positions = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

  if (num === 0) return 'ศูนย์';

  const numStr = num.toString();
  const len = numStr.length;

  if (len > 7) {
    const millionPart = Math.floor(num / 1000000);
    const remainder = num % 1000000;
    return convertNumberToThaiText(millionPart) + 'ล้าน' + (remainder > 0 ? convertNumberToThaiText(remainder) : '');
  }

  let result = '';
  for (let i = 0; i < len; i++) {
    const digit = parseInt(numStr.charAt(i), 10);
    const pos = len - i - 1;

    if (digit !== 0) {
      if (pos === 0 && digit === 1 && len > 1) {
        result += 'เอ็ด';
      } else if (pos === 1 && digit === 1) {
        result += 'สิบ';
      } else if (pos === 1 && digit === 2) {
        result += 'ยี่สิบ';
      } else {
        result += digits[digit] + positions[pos];
      }
    }
  }

  return result;
}

/**
 * สั่งพิมพ์เอกสารสรุปประวัติการชำระเงินและยอดค้างชำระของลูกค้า (Customer Statement)
 */
export function printCustomerStatement(params: CustomerStatementPrintParams) {
  const comp = params.companyInfo || {};
  const companyName = comp.company_name || 'เจ.เจ อะไหล่ (หนองสาหร่าย)';
  const companyAddr = comp.address || '51 ม.20 ต.หนองสาหร่าย อ.ปากช่อง จ.นครราชสีมา 30130';
  const companyPhone = comp.phone_number || '096-7985115';
  const companyTax = comp.tax_id_number || '-';

  const cust = params.customer;
  const custName = cust.customer_name || 'ลูกค้าทั่วไป';
  const custType = cust.customer_type ? ` (${cust.customer_type})` : '';
  const custPhone = cust.phone_number || '-';
  const custAddr = cust.address || '-';
  const currentDebt = cust.current_debt_amount || 0;

  const payments = params.payments || [];
  const unpaidBills = params.unpaidBills || [];

  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
  const totalUnpaid = unpaidBills.reduce((sum, b) => sum + (Number(b.balance_due) || 0), 0);
  const thaiPaidText = thaiBahtText(totalPaid);

  const printDate = new Date().toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const paymentRows =
    payments.length > 0
      ? payments
          .map(
            (p, idx) => `<tr>
        <td class="center">${p.round || idx + 1}</td>
        <td class="center">${p.paid_at || '-'}</td>
        <td class="bold">${p.receipt_number || '-'}</td>
        <td>${p.order_numbers || '-'}</td>
        <td class="center">${p.payment_type === 'repayment' ? 'ชำระหนี้เงินเชื่อ' : 'ชำระสดหน้าร้าน'}</td>
        <td class="center">${p.payment_method || 'เงินสด'}</td>
        <td>${p.received_by_name || '-'}</td>
        <td class="num bold">฿${(Number(p.amount_paid) || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
        <td class="center ${p.status === 'cancelled' ? 'badge-red' : 'badge-green'}">${p.status === 'cancelled' ? 'ยกเลิก' : 'สำเร็จ'}</td>
      </tr>`,
          )
          .join('')
      : `<tr><td colspan="9" class="center" style="color:#888; padding: 16px;">- ไม่พบประวัติการชำระเงินในช่วงเวลาดังกล่าว -</td></tr>`;

  const unpaidRows =
    unpaidBills.length > 0
      ? unpaidBills
          .map(
            (b, idx) => `<tr>
        <td class="center">${idx + 1}</td>
        <td class="bold">${b.order_number || '-'}</td>
        <td class="center">${b.order_date || '-'}</td>
        <td class="num">฿${(Number(b.total_amount) || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
        <td class="num">฿${(Number(b.paid_amount) || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
        <td class="num bold" style="color:#E51C23;">฿${(Number(b.balance_due) || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
        <td class="center"><span class="badge-warning">${b.payment_status === 'partial' ? 'ชำระบางส่วน' : 'ยังไม่ชำระ'}</span></td>
      </tr>`,
          )
          .join('')
      : '';

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>สรุปยอดชำระและยอดคงเหลือ - ${custName}</title>
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
      border-left: 4px solid #E51C23;
      border: 1px solid #EAEAEA;
      border-left-width: 4px;
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
    .badge-warning { background: #FEF3C7; color: #92400E; padding: 1px 6px; font-size: 10px; border-radius: 2px; font-weight: 600; }

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
        ${params.printedBy ? `<div style="font-size: 11px; color: #666;">ผู้ออกเอกสาร: <span class="bold">${params.printedBy}</span></div>` : ''}
      </td>
    </tr>
  </table>

  <!-- Title Banner -->
  <div class="doc-banner">
    <div class="doc-title">ใบสรุปประวัติการชำระเงินและยอดค้างชำระ (Customer Statement)</div>
  </div>

  <!-- Customer and Period Information -->
  <div class="info-grid">
    <div class="info-col">
      <div class="info-title">ข้อมูลลูกค้า</div>
      <div class="info-line"><strong>ชื่อลูกค้า:</strong> ${custName}${custType}</div>
      <div class="info-line"><strong>เบอร์โทรศัพท์:</strong> ${custPhone}</div>
      <div class="info-line"><strong>ที่อยู่:</strong> ${custAddr}</div>
    </div>
    <div class="info-col" style="border-left: 1px dashed #DDD; padding-left: 14px;">
      <div class="info-title">ข้อมูลรอบสรุปยอด</div>
      <div class="info-line"><strong>ช่วงเวลาที่สรุป:</strong> ${params.periodLabel}</div>
      <div class="info-line"><strong>จำนวนรอบที่ชำระ:</strong> ${payments.length} รายการ</div>
      <div class="info-line"><strong>บิลที่ค้างชำระปัจจุบัน:</strong> ${unpaidBills.length} บิล</div>
    </div>
  </div>

  <!-- Section 1: Payment Rounds Table -->
  <div class="section-title">
    <span>1. รายการประวัติการชำระเงินในช่วงเวลา</span>
    <span class="count">รวม ${payments.length} รอบ</span>
  </div>
  <table class="data-table">
    <thead>
      <tr>
        <th class="center" style="width: 40px;">รอบที่</th>
        <th class="center" style="width: 85px;">วันที่ชำระ</th>
        <th style="width: 100px;">เลขที่ใบเสร็จ</th>
        <th>บิลที่ชำระ</th>
        <th class="center" style="width: 95px;">ประเภท</th>
        <th class="center" style="width: 65px;">ช่องทาง</th>
        <th style="width: 90px;">ผู้รับเงิน</th>
        <th class="num" style="width: 85px;">ยอดชำระ (฿)</th>
        <th class="center" style="width: 55px;">สถานะ</th>
      </tr>
    </thead>
    <tbody>
      ${paymentRows}
    </tbody>
    ${
      payments.length > 0
        ? `<tfoot>
      <tr style="background:#F3F4F6; font-weight:700;">
        <td colspan="7" class="num">รวมยอดรับชำระทั้งหมดในช่วงเวลา (${payments.length} รายการ):</td>
        <td class="num" style="color:#E51C23; font-size:12px;">฿${totalPaid.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
        <td></td>
      </tr>
    </tfoot>`
        : ''
    }
  </table>

  <!-- Section 2: Outstanding Bills Table (if any) -->
  ${
    unpaidBills.length > 0
      ? `
  <div class="section-title" style="margin-top: 16px;">
    <span>2. รายการบิลที่ยังมียอดคงเหลือค้างชำระในปัจจุบัน</span>
    <span class="count">รวม ${unpaidBills.length} บิล</span>
  </div>
  <table class="data-table">
    <thead>
      <tr>
        <th class="center" style="width: 40px;">ลำดับ</th>
        <th style="width: 120px;">เลขที่บิล</th>
        <th class="center" style="width: 90px;">วันที่ออกบิล</th>
        <th class="num" style="width: 90px;">ยอดตามบิล (฿)</th>
        <th class="num" style="width: 90px;">ชำระแล้ว (฿)</th>
        <th class="num" style="width: 95px;">ยอดคงเหลือ (฿)</th>
        <th class="center" style="width: 85px;">สถานะการชำระ</th>
      </tr>
    </thead>
    <tbody>
      ${unpaidRows}
    </tbody>
    <tfoot>
      <tr style="background:#F3F4F6; font-weight:700;">
        <td colspan="5" class="num">รวมยอดหนี้ค้างชำระคงเหลือทั้งหมด (${unpaidBills.length} บิล):</td>
        <td class="num" style="color:#E51C23; font-size:12px;">฿${totalUnpaid.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>
  `
      : ''
  }

  <!-- Summary Box -->
  <div class="summary-card no-break">
    <div class="summary-left">
      <div style="font-weight: 700; margin-bottom: 4px;">สรุปภาพรวมทางการเงิน:</div>
      <div style="font-size: 11px; color: #444; margin-bottom: 3px;">จำนวนเงินที่ชำระตัวอักษร: <strong style="color:#1C1B1B;">${thaiPaidText}</strong></div>
      ${cust.credit_limit ? `<div style="font-size: 11px; color: #444;">วงเงินเครดิตที่ได้รับ: <strong>฿${cust.credit_limit.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</strong></div>` : ''}
    </div>
    <div class="summary-right">
      <div class="summary-row">
        <span>ยอดรับชำระในช่วงเวลา:</span>
        <span class="bold">฿${totalPaid.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
      </div>
      <div class="summary-row highlight">
        <span>ยอดหนี้คงเหลือปัจจุบัน:</span>
        <span>฿${(currentDebt || totalUnpaid).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
      </div>
    </div>
  </div>

  <!-- Signatures -->
  <div class="signature-section no-break">
    <div class="signature-box">
      <div class="sign-line"></div>
      <div>( พนักงานผู้จัดทำเอกสาร )</div>
      <div style="font-size: 10px; color: #777; margin-top: 2px;">วันที่ ......./......./............</div>
    </div>
    <div class="signature-box">
      <div class="sign-line"></div>
      <div>( ลูกค้า / ผู้ตรวจสอบรับทราบยอด )</div>
      <div style="font-size: 10px; color: #777; margin-top: 2px;">วันที่ ......./......./............</div>
    </div>
  </div>
</body>
</html>`;

  printHtml(html);
}

