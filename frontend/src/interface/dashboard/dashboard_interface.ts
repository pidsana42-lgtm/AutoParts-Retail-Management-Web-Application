export interface DashboardSummaryItem {
  summary_date: string;
  total_orders: number;
  total_items_sold: number;
  overdue_debt_count: number;
  total_revenue: number;
  net_revenue: number;
  total_cost: number;
  gross_profit: number;
  margin_profit: number;
  cash_amount: number;
  transfer_amount: number;
  credit_amount: number;
  walkin_customer_amount: number;
  garage_customer_amount: number;
  corporate_customer_amount: number;
  return_amount: number;
  collected_debt_amount: number;
  total_outstanding_amount: number;
}

export interface SummaryQuery {
  summary_date?: string;
  weekly_summary?: string;
  monthly_summary?: string;
  quarterly_summary?: string;
  yearly_summary?: string;
  ref_date?: string;
}

export interface DashboardSummaryResponse {
  summary_data: DashboardSummaryItem[];
  total: number;
}

export interface StockAlertItem {
  id: number;
  alert_type: string;
  quantity_at_alert: number;
  limit_quantity: number;
  is_resolved: string;
  product_id: number | null;
  product_code?: string;
  product_name?: string;
  unit_name?: string;
  cost_price?: number;
  supplier_id?: number;
  supplier_name?: string;
  created_at: string;
}

export interface AggrResult {
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  totalOrders: number;
}

export interface StockAlertStats {
  unresolved: number;
  total: number;
}

export interface StockHealthStats {
  total_products: number;
  healthy_count: number;
  low_stock_count: number;
  out_of_stock_count: number;
  health_percent: number;
}

export interface RecentSaleItem {
  id: number;
  order_number: string;
  time: string;
  total_amount: number;
  order_status: string;
  payment_method: string;
}

export interface AgingStockItem {
  rank: number;
  product_code: string;
  product_name: string;
  last_sold_date: string | null;
  days_aging: number;
  remaining_qty: number;
  unit: string;
  sunk_value: number;
}

export interface RevenueBreakdownResponse {
  customerData: ChartDatum[];
  paymentData: ChartDatum[];
}

export interface ChartDatum {
  name: string;
  value: number;
  fill: string;
}

export interface DonutChartCardProps {
  title: string;
  icon: React.ReactNode;
  data: ChartDatum[];
  total: number;
  isLoading?: boolean;
}

export interface TopSellerItem {
  id: number;
  product_name: string;
  category: string;
  total_sold: number;
  total_revenue: number;
}

export interface DebtAgingItem {
  customer_code: string;
  customer_name: string;
  total_debt: number;
  remaining_balance: number;
  last_purchase_date: string;
  age_days: number;
  status: 'ทยอยชำระ' | 'เกินกำหนด' | 'ชำระหมดแล้ว';
}

export interface DebtAgingQuery {
  start_date?: string;
  end_date?: string;
  status?: string;       // 'เกินกำหนด' | 'ทยอยชำระ' | '' (all)
  min_age_days?: number; // 0 = no lower bound
  max_age_days?: number; // 0 = no upper bound
  page?: number;
  page_size?: number;
}

export interface DebtAgingResponse {
  data: DebtAgingItem[];
  total: number;
  total_debtors: number;
  yearly_target: number;
}
