// src/utils/posHelpers.ts
import type { SalesHistoryItemResponse } from "../interface/pos/sales_history_interface";

/** ฟังก์ชันช่วยดึงชื่อลูกค้าที่ถูกต้องในการแสดงผล */
export const getDisplayCustomerName = (item: SalesHistoryItemResponse): string => {
  if (item.customer_name && item.customer_name.trim() !== "") {
    return item.customer_name;
  }
  if (item.customer_name_temp && item.customer_name_temp.trim() !== "") {
    return `${item.customer_name_temp} (ขาจร)`;
  }
  return "ลูกค้าทั่วไป";
};