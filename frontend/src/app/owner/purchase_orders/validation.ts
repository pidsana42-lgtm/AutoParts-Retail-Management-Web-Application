import type { LocalPOItem } from '../../../interface/purchase_orders/po_interface';

export const isValidQuantity = (value: number) => Number.isSafeInteger(value) && value > 0;
export const isValidPrice = (value: number, allowZero = false) => Number.isFinite(value) && (allowZero ? value >= 0 : value > 0);

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
        const isPreorder = isValidQuantity(item.pre_order_item_id ?? 0);
        const unlinkedPreorder = isPreorder && (item.product_id == null || item.product_id === 0);
        if (!isValidQuantity(item.product_id) && !unlinkedPreorder) errors.push(`${label}: สินค้าไม่ถูกต้อง กรุณาเลือกสินค้าใหม่`);
        if (!isValidQuantity(quantity)) errors.push(`${label}: จำนวนต้องเป็นจำนวนเต็มมากกว่า 0 และไม่เกิน ${Number.MAX_SAFE_INTEGER}`);
        // Use the persisted preorder link, as the API does, rather than a display label.
        if (!isValidPrice(item.unit_price, isPreorder)) errors.push(`${label}: ราคาต่อหน่วยต้อง${isPreorder ? 'ไม่น้อยกว่า' : 'มากกว่า'} 0 และเป็นตัวเลขที่ถูกต้อง`);
        total += quantity * item.unit_price;
    });
    if (errors.length === 0 && !Number.isFinite(total)) errors.push('ยอดรวมสูงเกินกว่าที่ระบบรองรับ กรุณาตรวจสอบจำนวนและราคา');
    return errors;
}
