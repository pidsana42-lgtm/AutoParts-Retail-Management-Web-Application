import type { PaymentHistoryItem } from "./payment_interface";
export interface PaymentCancellationFilterRequest {
  search?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  payment_type?: string;
}

export interface OwnerPaymentCancellationStats {
  pendingCount: number;
  pendingAmount: number;
  approvedCount: number;
  approvedAmount: number;
  rejectedCount: number;
  rejectedAmount: number;
  totalCount: number;
  totalAmount: number;
}

export interface EmployeePaymentCancellationStats {
  totalCount: number;
  totalAmount: number;
  pendingCount: number;
  pendingAmount: number;
  approvedCount: number;
  approvedAmount: number;
  rejectedCount: number;
  rejectedAmount: number;
}

export interface PaymentCancellationConfirmDialogState {
  isOpen: boolean;
  title: string;
  description: React.ReactNode;
  confirmText: string;
  variant: "danger" | "warning" | "success" | "info";
  icon?: any;
  onConfirm: () => void;
}

export interface UsePaymentCancellationHistoryReturn {
  dataList: PaymentHistoryItem[];
  selectedIds: number[];
  isSelectAll: boolean;
  isLoading: boolean;
  error: string | null;
  ownerStats: OwnerPaymentCancellationStats;
  employeeStats: EmployeePaymentCancellationStats;
  isStatsLoading: boolean;
  fetchOverallStats: () => Promise<void>;
  page: number;
  limit: number;
  totalRows: number;
  totalPages: number;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  status: string;
  setStatus: (status: string) => void;
  paymentType: string;
  setPaymentType: (type: string) => void;
  employeeId: string;
  setEmployeeId: (id: string) => void;
  handleSelectAll: () => void;
  handleSelectRow: (id: number) => void;
  handleSearch: () => void;
  refetch: () => Promise<void>;
  
  // Confirm Dialog State & Actions
  confirmDialog: PaymentCancellationConfirmDialogState;
  closeConfirmDialog: () => void;

  // Drawer Details & Actions
  selectedReceipt: PaymentHistoryItem | null;
  setSelectedReceipt: (item: PaymentHistoryItem | null) => void;
  cancelRemark: string;
  setCancelRemark: (remark: string) => void;
  cancelReason: string;
  setCancelReason: (reason: string) => void;
  isProcessing: boolean;
  handleApproveCancel: () => Promise<void>;
  handleRejectCancel: () => Promise<void>;
  handleRevertCancel: () => Promise<void> | void;
  handleResubmitCancel: () => Promise<void>;
  handleBatchApprove: () => Promise<void> | void;
  handleBatchReject: () => Promise<void> | void;
  handleBatchRevert: () => Promise<void> | void;
}