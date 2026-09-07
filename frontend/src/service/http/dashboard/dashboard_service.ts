import apiClient from '../apiClient';
import type { DashboardSummaryResponse, StockAlertItem, SummaryQuery, AgingStockItem, StockHealthStats,
  RecentSalesResponse, RevenueBreakdownResponse, TopSellerItem, DebtAgingQuery, DebtAgingResponse } from '../../../interface/dashboard/dashboard_interface';
import {
  assertPositiveInteger,
  validateDebtAgingQuery,
  validateSummaryQuery,
} from '../../../utils/dashboardValidation';

export const dashboardService = {
  getSummaryData: (query: SummaryQuery) => {
    validateSummaryQuery(query);
    return apiClient.get<DashboardSummaryResponse>('/dashboard/summary', { params: query });
  },

  getStockAlerts: () =>
    apiClient.get<StockAlertItem[]>('/wms/stock-alerts'),

  getStockHealth: () =>
    apiClient.get<StockHealthStats>('/dashboard/stock-health'),

  getRecentSales: (query: SummaryQuery, page = 1, pageSize = 10) => {
    validateSummaryQuery(query);
    assertPositiveInteger('page', page);
    assertPositiveInteger('page_size', pageSize, 100);
    return apiClient.get<RecentSalesResponse>('/dashboard/recent-sales', {
      params: { ...query, page, page_size: pageSize },
    });
  },

  getAgingStock: (days = 180) => {
    assertPositiveInteger('days', days);
    return apiClient.get<{ data: AgingStockItem[] }>('/dashboard/aging-stock', {
      params: { days },
    });
  },

  getSummaryIncomeData: (query: SummaryQuery) => {
    validateSummaryQuery(query);
    return apiClient.get<RevenueBreakdownResponse>('/dashboard/income-summary', { params: query });
  },

  getTopSellers: (query: SummaryQuery, limit = 10) => {
    validateSummaryQuery(query);
    assertPositiveInteger('limit', limit, 100);
    return apiClient.get<{ data: TopSellerItem[] }>('/dashboard/top-sellers', {
      params: { ...query, limit },
    });
  },

  getDebtAging: (query: DebtAgingQuery) => {
    validateDebtAgingQuery(query);
    return apiClient.get<DebtAgingResponse>('/dashboard/debt-aging', { params: query });
  },

  getAllDebtAging: async (query: DebtAgingQuery) => {
    const baseQuery = { ...query };
    delete baseQuery.page;
    delete baseQuery.page_size;
    validateDebtAgingQuery(baseQuery);

    const pageSize = 100;
    const first = await apiClient.get<DebtAgingResponse>('/dashboard/debt-aging', {
      params: { ...baseQuery, page: 1, page_size: pageSize },
    });
    const totalPages = Math.ceil(first.data.total / pageSize);
    if (totalPages <= 1) return first;

    const allRows = [...first.data.data];
    for (let page = 2; page <= totalPages; page += 1) {
      const response = await apiClient.get<DebtAgingResponse>('/dashboard/debt-aging', {
        params: { ...baseQuery, page, page_size: pageSize },
      });
      allRows.push(...response.data.data);
    }

    return {
      ...first,
      data: {
        ...first.data,
        data: allRows,
      },
    };
  },

  exportDebtAgingPdf: (query: DebtAgingQuery) => {
    validateDebtAgingQuery(query);
    return apiClient.get('/dashboard/debt-aging/export/pdf', {
      params: query,
      responseType: 'blob',
    });
  },

  exportDebtAgingExcel: (query: DebtAgingQuery) => {
    validateDebtAgingQuery(query);
    return apiClient.get('/dashboard/debt-aging/export/excel', {
      params: query,
      responseType: 'blob',
    });
  },
};
