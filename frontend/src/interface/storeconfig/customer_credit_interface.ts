import type { CustomerTypeItem } from "../customer/customer_interface";

export interface CustomerCreditItem {
  id: number;
  customer_id: number;
  customer_name: string;
  phone_number: string;
  id_card_number_customer?: string;
  max_credit_limit: number;
  current_debt_amount: number;
  is_discount_enabled: boolean;
  standard_discount_rate: number;
  ontop_discount_rate: number;
  customer_type: CustomerTypeItem;
  customer_type_label?: string;
  shipping_address?: string;
  registered_address?: string;
  display_address?: string;
}

export interface CustomerCreditFilter {
  search: string;
  customer_type_id: string; // "" or type id string
  credit_status: "ALL" | "WITH_DEBT" | "NEAR_LIMIT" | "OVER_LIMIT" | "NO_DEBT";
  discount_status: "ALL" | "ENABLED" | "DISABLED";
}

export interface UpdateCustomerDiscountPayload {
  customerId: number;
  is_discount_enabled: boolean;
  ontop_discount_rate: number;
  standard_discount_rate?: number;
  max_credit_limit?: number;
}

export interface BulkUpdateCustomerDiscountItem {
  id: number;
  standard_discount_rate: number;
  is_discount_enabled: boolean;
}

export interface CustomerCreditStats {
  totalCustomers: number;
  garageCustomers: number;
  wholesaleCustomers: number;
  generalCustomers: number;
  totalOutstandingDebt: number;
  totalCreditLimit: number;
  discountEnabledCount: number;
  nearOrOverLimitCount: number;
}

export interface CustomerCreditAuditLog {
  id: number;
  action: string;
  customer_name: string;
  details: string;
  changed_by: string;
  changed_at: string;
}

export interface UseCustomerCreditControlReturn {
  // Data
  customers: CustomerCreditItem[];
  filteredCustomers: CustomerCreditItem[];
  paginatedCustomers: CustomerCreditItem[];
  customerTypes: CustomerTypeItem[];
  stats: CustomerCreditStats;

  // Loading & Feedback
  isLoading: boolean;
  isUpdating: boolean;
  error: string | null;
  successMessage: string | null;

  // Filter
  filter: CustomerCreditFilter;
  setFilter: React.Dispatch<React.SetStateAction<CustomerCreditFilter>>;
  handleSearchChange: (value: string) => void;
  handleCustomerTypeChange: (value: string) => void;
  handleCreditStatusChange: (value: CustomerCreditFilter["credit_status"]) => void;
  handleDiscountStatusChange: (value: CustomerCreditFilter["discount_status"]) => void;
  handleResetFilter: () => void;

  // Pagination
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  limit: number;
  setLimit: React.Dispatch<React.SetStateAction<number>>;
  totalRows: number;
  totalPages: number;

  // Modals & Selected items
  selectedCustomer: CustomerCreditItem | null;
  setSelectedCustomer: (customer: CustomerCreditItem | null) => void;
  drawerCustomer: CustomerCreditItem | null;
  setDrawerCustomer: (customer: CustomerCreditItem | null) => void;
  isEditModalOpen: boolean;
  setIsEditModalOpen: (open: boolean) => void;
  isAuditModalOpen: boolean;
  setIsAuditModalOpen: (open: boolean) => void;
  auditLogs: CustomerCreditAuditLog[];
  isLoadingAuditLogs: boolean;

  // Actions
  handleOpenEditModal: (customer: CustomerCreditItem) => void;
  handleUpdateDiscount: (payload: UpdateCustomerDiscountPayload) => Promise<boolean>;
  handleQuickToggleDiscount: (customer: CustomerCreditItem) => Promise<boolean>;
  refetch: () => Promise<void>;
}
