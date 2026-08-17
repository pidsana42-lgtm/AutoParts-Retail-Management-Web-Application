import apiClient from '../apiClient';
import type { DashboardSummaryResponse, StockAlertItem, SummaryQuery, RecentSaleItem, AgingStockItem, StockHealthStats } from '../../../interface/dashboard/dashboard_interface';

export const dashboardService = {
  getSummaryData: (query: SummaryQuery) =>
    apiClient.get<DashboardSummaryResponse>('/dashboard/summary', { params: query }),

  getStockAlerts: () =>
    apiClient.get<StockAlertItem[]>('/wms/stock-alerts'),

  getStockHealth: () =>
    apiClient.get<StockHealthStats>('/dashboard/stock-health'),

  getRecentSales: (query: SummaryQuery, limit = 10) =>
    apiClient.get<{ data: RecentSaleItem[] }>('/dashboard/recent-sales', {
      params: { ...query, limit },
    }),

  getAgingStock: () =>
    apiClient.get<{ data: AgingStockItem[] }>('/dashboard/aging-stock'),
};