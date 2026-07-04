import apiClient from "../apiClient";
import type { CreateSaleOrderRequest, SaleOrderItemRequest } from "../../../interface/pos/pos_interface";
import type { POSProductResponse } from "../../../interface/pos/product_interface";
import type { StoreConfigInterface } from "../../../interface/pos/store_config_interface";
import type { CustomerDiscountResponse } from "../../../interface/pos/customer_interface";

// API Services 
export const posApiService = {
  /** ดึงค่าตั้งค่าคอนฟิกร้านค้า */
  getStoreConfig: (): Promise<StoreConfigInterface> => 
    apiClient.get<StoreConfigInterface>("/pos/store-config").then((res) => res.data),

  /** ค้นหาข้อมูลสิทธิ์ส่วนลดและโปรไฟล์ลูกค้า */
  searchCustomerDiscount: (query: string): Promise<CustomerDiscountResponse> => 
    apiClient.get<CustomerDiscountResponse>(`/pos/customer-discount?search=${query}`).then((res) => res.data),

  /** ค้นหาข้อมูลอะไหล่ยนต์ในสต๊อกระบบ */
  searchProducts: (query: string): Promise<POSProductResponse[]> => 
    apiClient.get<POSProductResponse[]>(`/pos/products?q=${query}`).then((res) => res.data),

  /** บันทึกคำสั่งซื้อออเดอร์ขาย POS */
  createPOSOrder: (payload: CreateSaleOrderRequest): Promise<any> => 
    apiClient.post("/pos/orders", payload).then((res) => res.data),
};

// Business Logic 
export const calculateValidatedDiscount = (
  item: SaleOrderItemRequest,
  value: number,
  storeConfig: StoreConfigInterface | null
): number => {
  const maxDiscountRate = storeConfig?.max_item_discount_rate ?? 2.00;
  const itemPrice = item.unit_price || 0;

  if (item.discount_type === "percentage") {
    if (value > maxDiscountRate) {
      alert(`ไม่สามารถให้ส่วนลดเกินข้อกำหนดของร้านค้าได้ (สูงสุดต่อรายการคือ ${maxDiscountRate}%)`);
      return maxDiscountRate; 
    }
    return value;
  }

  if (item.discount_type === "amount") {
    const maxDiscountBaht = (itemPrice * maxDiscountRate) / 100;

    if (value > maxDiscountBaht) {
      alert(
        `สินค้าชิ้นนี้ลดได้สูงสุดไม่เกิน ${maxDiscountBaht.toFixed(2)} ฿ (คำนวณจากเกณฑ์ร้านค้าสูงสุด ${maxDiscountRate}%)`
      );
      return parseFloat(maxDiscountBaht.toFixed(2)); 
    }
    return value;
  }

  return 0;
};