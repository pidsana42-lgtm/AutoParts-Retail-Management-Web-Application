import type { LocalPOItem } from '../../../interface/purchase_orders/po_interface';

export const isValidQuantity = (value: number) => Number.isSafeInteger(value) && value > 0;
export const isValidPrice = (value: number) => Number.isFinite(value) && value > 0;

export function validatePurchaseOrder(
    supplierId: string | number,
    items: LocalPOItem[],
    quantityDrafts: Record<string | number, string> = {},
): string[] {
    const errors: string[] = [];
    if (!isValidQuantity(Number(supplierId))) errors.push('กรุณาเลือกผู้จัดจำหน่าย');
    if (items.length === 0) errors.push('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ');
    let total = 0;
    items.forEach((item, index) => {
        const label = `รายการที่ ${index + 1} (${item.product_name_snapshot})`;
        const quantity = Number(quantityDrafts[item.id] ?? item.quantity);
        if (!isValidQuantity(item.product_id)) errors.push(`${label}: สินค้าไม่ถูกต้อง กรุณาเลือกสินค้าใหม่`);
        if (!isValidQuantity(quantity)) errors.push(`${label}: จำนวนต้องเป็นจำนวนเต็มมากกว่า 0 และไม่เกิน ${Number.MAX_SAFE_INTEGER}`);
        if (!isValidPrice(item.unit_price)) errors.push(`${label}: ราคาต่อหน่วยต้องมากกว่า 0 และเป็นตัวเลขที่ถูกต้อง`);
        total += quantity * item.unit_price;
    });
    if (errors.length === 0 && !Number.isFinite(total)) errors.push('ยอดรวมสูงเกินกว่าที่ระบบรองรับ กรุณาตรวจสอบจำนวนและราคา');
    return errors;
}
