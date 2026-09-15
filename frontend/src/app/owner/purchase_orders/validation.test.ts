import { describe, expect, it } from 'vitest';
import type { LocalPOItem } from '../../../../src/interface/purchase_orders/po_interface';
import { validatePurchaseOrder } from '../../../../src/app/owner/purchase_orders/validation';

const item: LocalPOItem = {
    id: 10, product_id: 3, product_name_snapshot: 'Filter', product_code_snapshot: 'P3', supply_product_code_snapshot: 'SUP-P3',
    quantity: 2, unit: 'piece', unit_price: 12.5, sub_total: 25, order_type: 'สั่งซื้อ',
};

describe('purchase order validation', () => {
    it('accepts positive whole quantities and decimal prices', () => {
        expect(validatePurchaseOrder('7', [item])).toEqual([]);
    });
    it.each(['', 'all', 'others', 'abc', '0', '-1', '1.5', 'Infinity'])('rejects supplier %s', supplier => {
        expect(validatePurchaseOrder(supplier, [item])).toContain('กรุณาเลือกผู้จัดจำหน่าย');
    });
    it('rejects an empty order', () => {
        expect(validatePurchaseOrder(7, [])).toContain('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ');
    });
    it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects quantity %s', quantity => {
        expect(validatePurchaseOrder(7, [{ ...item, quantity }])[0]).toContain('จำนวนต้องเป็นจำนวนเต็ม');
    });
    it.each([0, -1, NaN, Infinity])('rejects price %s', unit_price => {
        expect(validatePurchaseOrder(7, [{ ...item, unit_price }])[0]).toContain('ราคาต่อหน่วย');
    });
    it('validates unfinished input instead of accepting the previous quantity', () => {
        expect(validatePurchaseOrder(7, [item], { 10: '' })[0]).toContain('จำนวนต้องเป็นจำนวนเต็ม');
        expect(validatePurchaseOrder(7, [item], { 10: '3' })).toEqual([]);
    });
    it('ignores drafts belonging to removed rows', () => {
        expect(validatePurchaseOrder(7, [item], { 99: '' })).toEqual([]);
    });
    it('rejects overflowing totals', () => {
        expect(validatePurchaseOrder(7, [{ ...item, unit_price: Number.MAX_VALUE }])[0]).toContain('ยอดรวม');
    });
    it('identifies the invalid row', () => {
        expect(validatePurchaseOrder(7, [item, { ...item, id: 11, product_id: 0 }])[0]).toContain('รายการที่ 2');
    });
});


