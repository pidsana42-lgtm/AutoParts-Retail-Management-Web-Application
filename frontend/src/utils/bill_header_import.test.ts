import { describe, it, expect } from 'vitest';
import { guessColumnMapping, normalizeDateValue } from './excelImport';

// จำลองการดึงข้อมูลหัวบิลแบบเดียวกับ import_bill.tsx (หลังแก้ label วันที่)
function extractHeader(rows: any[][]) {
  let billNo = '', supplier = '', due = '', receive = '';
  for (const row of rows) {
    if (!row || row.length < 2) continue;
    const label = String(row[0] || '').trim().toLowerCase();
    const val = String(row[1] || row[2] || '').trim(); if (!val) continue;
    if (label.includes('เลขที่บิล') || label.includes('bill no') || label.includes('invoice no')) billNo = val;
    else if (label.includes('ชื่อบริษัท') || label.includes('company name') || label.includes('ผู้จัดจำหน่าย') || label.includes('supplier')) supplier = val;
    else if (label.includes('ครบกำหนด') || label.includes('due date')) due = normalizeDateValue(row[1] || row[2]);
    else if (label.includes('วันที่') || label.includes('ลงวันที่') || label.includes('date')) receive = normalizeDateValue(row[1] || row[2]);
  }
  return { billNo, supplier, due, receive };
}

describe('ดึงวันที่จากหัวบิล — label ที่ซัพพลายเออร์ใช้จริง', () => {
  it.each([
    ['วันที่บิล', '2025-08-05'],
    ['วันที่รับสินค้า', '2025-08-05'],
    ['วันที่ใบกำกับภาษี', '2025-08-05'],
    ['ลงวันที่', '2025-08-05'],
    ['Bill Date', '2025-08-05'],
    ['Invoice Date', '2025-08-05'],
  ])('%s ต้องอ่านวันที่ได้', (label, want) => {
    const r = extractHeader([['ชื่อบริษัท', 'บ. ทดสอบ'], [label, '2025-08-05'], ['ครบกำหนดชำระ', '2025-09-04']]);
    expect(r.receive).toBe(want);
    expect(r.due).toBe('2025-09-04');
  });

  it('ครบกำหนดชำระต้องไม่ถูกจับเป็นวันที่บิล', () => {
    const r = extractHeader([['ครบกำหนดชำระ', '2025-09-04']]);
    expect(r.due).toBe('2025-09-04');
    expect(r.receive).toBe('');
  });
});

describe('เดาคอลัมน์จากหัวตารางหลายรูปแบบ', () => {
  it.each([
    ['ไทยเต็ม', ['รหัสสินค้า','ชื่อสินค้า','จำนวน','หน่วย','ราคาต่อหน่วย']],
    ['อังกฤษเต็ม', ['Product Code','Product Name','Qty','Unit','Unit Price']],
    ['อังกฤษย่อ', ['No.','name','qty','unit','price']],
    ['ศัพท์ซัพเฉพาะ', ['Part Number','Item Description','Quantity Ordered','UOM','Unit Cost']],
  ])('%s', (_l, headers) => {
    const rows = [['A-001','สินค้า ก',2,'ชิ้น',150],['A-002','สินค้า ข',5,'ชิ้น',80]];
    const { mapping, confidence } = guessColumnMapping(headers as string[], rows);
    expect(mapping.code).toBeTruthy();
    expect(mapping.name).toBeTruthy();
    expect(mapping.quantity).toBeTruthy();
    expect(mapping.price).toBeTruthy();
    expect(confidence).toBeGreaterThan(0.5);
  });
});
