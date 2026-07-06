// แมตช์ตาม StoreConfigResponse และ StoreConfigRequest
export interface StoreConfigInterface {
  max_credit: number;
  max_overdue_days: number;
  max_item_discount_rate: number;
  max_extra_discount_rate: number;
  supervised_pin: string;
}