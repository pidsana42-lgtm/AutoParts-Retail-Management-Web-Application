import apiClient from '../apiClient';
import type { DashboardSummaryResponse, StockAlertItem, SummaryQuery, AgingStockItem, StockHealthStats,
  RecentSalesResponse, RevenueBreakdownResponse, TopSellerItem, DebtAgingQuery, DebtAgingResponse } from '../../../interface/dashboard/dashboard_interface';

export const dashboardService = {
  getSummaryData: (query: SummaryQuery) =>
    apiClient.get<DashboardSummaryResponse>('/dashboard/summary', { params: query }),

  getStockAlerts: () =>
    apiClient.get<StockAlertItem[]>('/wms/stock-alerts'),

  getStockHealth: () =>
    apiClient.get<StockHealthStats>('/dashboard/stock-health'),

  getRecentSales: (query: SummaryQuery, page = 1, pageSize = 10) =>
    apiClient.get<RecentSalesResponse>('/dashboard/recent-sales', {
      params: { ...query, page, page_size: pageSize },
    }),

  getAgingStock: (days = 180) =>
    apiClient.get<{ data: AgingStockItem[] }>('/dashboard/aging-stock', {
      params: { days },
    }),

  getSummaryIncomeData: (query: SummaryQuery) =>
    apiClient.get<RevenueBreakdownResponse>('/dashboard/income-summary', { params: query }),

  getTopSellers: (query: SummaryQuery, limit = 10) =>
    apiClient.get<{ data: TopSellerItem[] }>('/dashboard/top-sellers', {
      params: { ...query, limit },
    }),

  getDebtAging: (query: DebtAgingQuery) =>
    apiClient.get<DebtAgingResponse>('/dashboard/debt-aging', { params: query }),

  exportDebtAgingPdf: (query: DebtAgingQuery) =>
    apiClient.get('/dashboard/debt-aging/export/pdf', {
      params: query,
      responseType: 'blob',
    }),

  exportDebtAgingExcel: (query: DebtAgingQuery) =>
    apiClient.get('/dashboard/debt-aging/export/excel', {
      params: query,
      responseType: 'blob',
    }),
};
