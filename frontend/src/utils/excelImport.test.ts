import { describe, expect, it } from 'vitest';
import { guessColumnMapping, normalizeDateValue, validateBillItems } from './excelImport';
import { importItem } from '../test/importFixtures';

describe('Import spreadsheet normalization', () => {
  it.each([
    ['09/09/2569', '2026-09-09'], ['9/9/69', '2026-09-09'], ['09-09-2026', '2026-09-09'],
    ['2026-9-9', '2026-09-09'], [new Date(2026, 8, 9), '2026-09-09'],
    [25569, '1970-01-01'], [null, ''], [undefined, ''], ['', ''], ['not a date', ''], [10, ''],
  ])('normalizes %s to %s', (value, expected) => {
    expect(normalizeDateValue(value)).toBe(expected);
  });
  it.each([
    ['รหัสสินค้า', 'ชื่อสินค้า', 'จำนวน', 'หน่วย', 'ราคาต่อหน่วย'],
    ['product_code', 'description', 'qty', 'unit', 'price'],
  ])('maps Thai and English spreadsheet headers (%#)', (...headers) => {
    const { mapping, confidence } = guessColumnMapping(headers, [['PART-21', 'กรองน้ำมันเครื่อง', 2, 'ชิ้น', 100.50]]);
    expect(mapping).toEqual({ code: headers[0], name: headers[1], quantity: headers[2], unit: headers[3], price: headers[4] });
    expect(confidence).toBeGreaterThan(0.6);
    expect(new Set(Object.values(mapping)).size).toBe(5);
  });
  it('does not report confident mappings for a sheet without data', () => {
    expect(guessColumnMapping(['code', 'name', 'qty', 'price'], [])).toEqual({
      mapping: { code: '', name: '', quantity: '', unit: '', price: '' }, confidence: 0,
    });
  });
});

describe('Import item validation', () => {
  it('accepts valid rows and zero-price freebies', () => {
    expect(validateBillItems([importItem, { ...importItem, company_product_code: 'FREE-1', price_per_unit: 0, is_freebie: true }])).toEqual({});
  });
  it.each([
    { changes: { company_product_code: '', company_product_name: '' }, fields: ['code', 'name'] },
    { changes: { company_product_name: '' }, fields: ['name'] },
    { changes: { order_quantity: 0 }, fields: ['quantity'] },
    { changes: { order_quantity: -1 }, fields: ['quantity'] },
    { changes: { order_quantity: NaN }, fields: ['quantity'] },
    { changes: { price_per_unit: -1 }, fields: ['price'] },
    { changes: { price_per_unit: NaN }, fields: ['price'] },
  ])('identifies the affected fields for invalid row %#', ({ changes, fields }) => {
    const issues = validateBillItems([{ ...importItem, ...changes }]);
    expect(issues[0].fields).toEqual(fields);
    expect(issues[0].messages.length).toBeGreaterThan(0);
  });
  it('marks both duplicate rows while preserving other validation errors', () => {
    const issues = validateBillItems([importItem, { ...importItem, company_product_code: ' PART-21 ', order_quantity: 0 }]);
    expect(issues[0].fields).toContain('code');
    expect(issues[1].fields).toEqual(['quantity', 'code']);
    expect(issues[1].messages).toContain('รหัสสินค้าซ้ำกับแถว 1, 2');
  });
  it('does not flag a freshly added blank row (no code/name, price still 0) as an error', () => {
    // ค่าเริ่มต้นตรงกับ handleAddRow ใน import_bill.tsx: code/name ว่าง, qty=1, price=0
    const issues = validateBillItems([{
      ...importItem, company_product_code: '', company_product_name: '', price_per_unit: 0,
    }]);
    expect(issues).toEqual({});
  });
  it('still flags an otherwise-blank row once the user enters a real price without a code/name', () => {
    const issues = validateBillItems([{
      ...importItem, company_product_code: '', company_product_name: '', price_per_unit: 50,
    }]);
    expect(issues[0].fields).toEqual(['code', 'name']);
  });
  it('still flags a blank row with an invalid quantity even though code/name are excused', () => {
    const issues = validateBillItems([{
      ...importItem, company_product_code: '', company_product_name: '', price_per_unit: 0, order_quantity: -1,
    }]);
    expect(issues[0].fields).toEqual(['quantity']);
  });
});

// วันที่ที่มาจากไฟล์ CSV/Excel ต้องไม่เพี้ยนเพราะเขตเวลา — ก่อนหน้านี้ใช้ toISOString()
// ซึ่งแปลงเป็น UTC ทำให้วันที่ที่ถูกตีความเป็นเที่ยงคืนเวลาไทย (UTC+7) ถอยไป 1 วัน
describe('normalizeDateValue — รูปแบบวันที่ที่พบในบิลจริง', () => {
  it.each([
    ['ISO', '2025-08-01', '2025-08-01'],
    ['dd/mm/yyyy ค.ศ.', '01/08/2025', '2025-08-01'],
    ['dd/mm/yyyy พ.ศ.', '26/07/2568', '2025-07-26'],
    ['dd/mm/yy พ.ศ.', '26/07/68', '2025-07-26'],
    ['มีเว้นวรรคหน้าหลัง', ' 2025-08-01 ', '2025-08-01'],
    ['ข้อความอังกฤษย่อ', 'Aug 1 2025', '2025-08-01'],
    ['ข้อความอังกฤษเต็ม', 'August 1, 2025', '2025-08-01'],
  ])('%s: %s', (_label, input, want) => {
    expect(normalizeDateValue(input)).toBe(want);
  });

  it('รับ Date object ตามเขตเวลาเครื่อง ไม่ถอยวัน', () => {
    expect(normalizeDateValue(new Date(2025, 7, 1))).toBe('2025-08-01');
  });

  it('ค่าที่ไม่ใช่วันที่คืนค่าว่าง', () => {
    expect(normalizeDateValue('ไม่ใช่วันที่')).toBe('');
    expect(normalizeDateValue('')).toBe('');
    expect(normalizeDateValue(null)).toBe('');
  });
});
