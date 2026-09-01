export interface CustomerStatementPrintItem {
  round: number;
  paid_at: string;
  receipt_number: string;
  order_numbers: string;
  payment_type: string;
  payment_method: string;
  received_by_name: string;
  amount_paid: number;
  status: string;
}

export interface CustomerStatementUnpaidBill {
  order_number: string;
  order_date: string;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  payment_status?: string;
}

export interface CustomerStatementPrintParams {
  companyInfo?: {
    company_name?: string;
    address?: string;
    phone_number?: string;
    email?: string;
    tax_id_number?: string;
    logo_url?: string;
  };
  customer: {
    id?: number;
    customer_name: string;
    phone_number?: string;
    customer_type?: string;
    address?: string;
    current_debt_amount?: number;
    credit_limit?: number;
  };
  periodLabel: string;
  payments: CustomerStatementPrintItem[];
  unpaidBills?: CustomerStatementUnpaidBill[];
  printedBy?: string;
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
