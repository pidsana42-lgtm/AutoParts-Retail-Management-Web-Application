export interface CustomerStatementPrintParams {
  customerId?: number;
  customerName?: string;
  startDate?: string;
  endDate?: string;
  action?: 'print' | 'preview' | 'download';
  customer?: {
    id?: number;
    customer_name?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface PosReceiptPrintItem {
  index: number;
  product_code?: string;
  product_name: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  discount: number;
  subtotal: number;
}

export interface PosReceiptPrintParams {
  companyInfo?: {
    company_name?: string;
    address?: string;
    phone_number?: string;
    email?: string;
    tax_id_number?: string;
    logo_url?: string;
  };
  orderNumber: string;
  orderDate: string;
  salesStaff: string;
  paymentMethod: string;
  docTitle?: string;
  customer?: {
    id?: number;
    customer_name?: string;
    customer_type?: string;
    phone_number?: string;
    address?: string;
    tax_id?: string;
  };
  items: PosReceiptPrintItem[];
  totalItemPrice: number;
  lineDiscountTotal?: number;
  billDiscount?: number;
  totalDiscount: number;
  finalTotal: number;
  receivedAmount?: number;
  changeAmount?: number;
  remarks?: string;
}
