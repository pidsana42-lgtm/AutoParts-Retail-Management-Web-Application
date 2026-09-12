// usePosCart.interface.ts
import type { SaleOrderItemRequest } from "./pos_interface";
import type { CustomerDiscountResponse } from "./customer_interface";
import type { POSProductSupplierInfo } from "./product_interface";

// สำหรับ Props ที่ส่งเข้ามาใน Hook
export interface UsePosCartProps {
  customer: CustomerDiscountResponse | null;
  activeTypeId: number;
  isRecoverMode?: boolean;
  onRecoverCancelledOrder?: (orderId: number) => Promise<boolean>;
}

// สำหรับโครงสร้างสินค้าที่อยู่ในตะกร้า
export interface CartItem extends SaleOrderItemRequest {
  quantity: number;
  // supplier_name: ชื่อบริษัทที่ผูกไว้กับ supplier_id (เก็บไว้แสดงผลในตารางบิลเฉยๆ ไม่ได้ส่งขึ้น backend)
  supplier_name?: string;
}

// สำหรับผลลัพธ์ที่ Hook นี้จะส่งออกไป
export interface UsePosCartReturn {
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  totalItemPrice: number;
  totalLineDiscount: number;
  handleAddProduct: (e: React.FormEvent) => Promise<void>;
  updateQty: (index: number, delta: number) => void;
  handleSetQuantity: (index: number, inputValue: string | number) => void;
  handleRemoveItem: (index: number) => void;
  handleClearAllCart: (onClearSuccess?: () => void) => void;
  handleDiscountToggle: (index: number, isChecked: boolean) => void;
  handleDiscountTypeChange: (index: number, type: "amount" | "percentage") => void;
  handleDiscountValueChange: (index: number, valueStr: string) => void;
  suggestions: any[];
  setSuggestions: React.Dispatch<React.SetStateAction<any[]>>;
  cancelledOrderSuggestions: any[];
  setCancelledOrderSuggestions: React.Dispatch<React.SetStateAction<any[]>>;
  showSuggestions: boolean;
  setShowSuggestions: React.Dispatch<React.SetStateAction<boolean>>;
  handleSelectProduct: (product: any, supplierOverride?: POSProductSupplierInfo) => void;
  handleSelectCancelledOrder: (order: any) => Promise<void>;
}