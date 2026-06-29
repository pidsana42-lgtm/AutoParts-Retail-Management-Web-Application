// แมตช์ตาม POSProductResponse
export interface POSProductResponse {
  id: number;
  product_code: string;
  part_number: string;
  product_name: string;
  barcode: string;
  quantity: number;
  sale_price: number;
  note: string;
}