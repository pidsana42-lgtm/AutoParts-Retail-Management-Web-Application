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

  getCustomerTypes: (): Promise<{ id: number; type_name: string }[]> => 
    apiClient.get<{ id: number; type_name: string }[]>("/pos/customer-types").then((res) => res.data),

  /** ดึงรายการวิธีชำระเงินทั้งหมด */
  getPaymentMethods: (): Promise<{ id: number; method_name: string }[]> => 
    apiClient.get<{ id: number; method_name: string }[]>("/pos/payment-methods").then((res) => res.data),
};

// Business Logic 
export const calculateValidatedDiscount = (
  item: SaleOrderItemRequest,
  value: number,
  customer: CustomerDiscountResponse | null,
  activeTypeId?: number
): number => {
  const itemPrice = item.unit_price || 0;
  const currentCustomerTypeId = customer?.customer_type?.id || activeTypeId;
  const currentCustomerTypeName = customer?.customer_type?.type_name || "";

  // [กฎข้อที่ 1]: ลูกค้ากลุ่มบริษัท (WHOLESALE) ห้ามรับส่วนลดใดๆ ทั้งสิ้นในระบบ
  if (currentCustomerTypeId === 3 || currentCustomerTypeName === "WHOLESALE") {
    alert("ลูกค้ากลุ่มบริษัทไม่ได้รับสิทธิ์ส่วนลดใดๆ ทั้งสิ้น");
    return 0;
  }

  // [กฎข้อที่ 2]: ตรวจสอบสิทธิ์กลุ่มอู่ซ่อมรถ (GARAGE) และต้องเปิดใช้งานระบบส่วนลด (is_discount_enabled)
  const isDiscountEnabled = customer ? customer.is_discount_enabled : true; // ถ้าเป็น Guest ทั่วไปยอมให้กดส่วนลดได้ตามปกติ
  const isGarageMode = 
    isDiscountEnabled && (
      currentCustomerTypeId === 2 || 
      currentCustomerTypeName === "GARAGE" ||
      (customer?.customer_name?.includes("อู่"))
    );

  let allowedMaxDiscount = (item as any).max_discount_rate ?? 2.00;

  if (isGarageMode) {
    const ontopRate = customer ? ((customer as any).ontop_discount_rate ?? 3.00) : 3.00;
    allowedMaxDiscount += ontopRate; // เพดานขยายเป็น (Product Max + Ontop อู่)
  }

  if (item.discount_type === "percentage") {
    // ปรับการเปรียบเทียบทศนิยม ป้องกันบั๊ก floating point ของ javascript (เช่น 5.00000001 > 5)
    if (value > (allowedMaxDiscount + 0.01)) {
      alert(`เกินข้อกำหนดสูงสุด (จำกัดที่ ${allowedMaxDiscount.toFixed(2)}%)`);
      return 0;
    }
    return value;
  }

  if (item.discount_type === "amount") {
    const lineTotal = itemPrice * (item.qty || 1);
    const maxDiscountBaht = (lineTotal * allowedMaxDiscount) / 100;

    if (value > (maxDiscountBaht + 0.01)) {
      alert(`เกินข้อกำหนดสูงสุด (จำกัดที่ ฿${maxDiscountBaht.toFixed(2)})`);
      return 0;
    }
    return value;
  }

  return 0;
};

/**
 * ฟังก์ชันหาค่าส่วนลดเริ่มต้น (Default) ทันทีตอนดึงสินค้าเข้าตะกร้า
 */
export const getDefaultProductDiscount = (
  product: any,
  customer: CustomerDiscountResponse | null,
  activeTypeId?: number
): { type: "none" | "percentage" | "amount"; value: number } => {
  const currentCustomerTypeId = customer?.customer_type?.id || activeTypeId;
  const currentCustomerTypeName = customer?.customer_type?.type_name || "";

  if (currentCustomerTypeId === 3 || currentCustomerTypeName === "WHOLESALE") {
    return { type: "none", value: 0 };
  }

  const isGarage = 
    currentCustomerTypeId === 2 || 
    currentCustomerTypeName === "GARAGE" || 
    customer?.customer_name?.includes("อู่");

  // อู่ซ่อมรถ และ ต้องเปิดใช้งานส่วนลดระบบ
  if (isGarage && customer && customer.is_discount_enabled) {
    // อู่ซ่อมรถ: คีย์ปุ๊บ ลดให้ทันทีอัตโนมัติ = สิทธิ์สินค้า + สิทธิ์ออนท็อปอู่
    const baseRate = product.max_discount_rate ?? 2.0;
    const ontopRate = (customer as any).ontop_discount_rate ?? 3.0;
    return { type: "percentage", value: baseRate + ontopRate };
  }

  // ลูกค้าทั่วไป: เริ่มต้นไม่มีส่วนลดอัตโนมัติ
  return { type: "none", value: 0 };
};