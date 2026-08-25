import type { PaymentHistoryItem } from "./payment_interface";
export interface PaymentCancellationFilterRequest {
  search?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  payment_type?: string;
}

export interface UsePaymentCancellationHistoryReturn {
  dataList: PaymentHistoryItem[];
  selectedIds: number[];
  isSelectAll: boolean;
  isLoading: boolean;
  error: string | null;
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
  handleSelectAll: () => void;
  handleSelectRow: (id: number) => void;
  handleSearch: () => void;
  refetch: () => Promise<void>;
  
  // Drawer Details & Actions
  selectedReceipt: PaymentHistoryItem | null;
  setSelectedReceipt: (item: PaymentHistoryItem | null) => void;
  cancelRemark: string;
  setCancelRemark: (remark: string) => void;
  isProcessing: boolean;
  handleApproveCancel: () => Promise<void>;
  handleRejectCancel: () => Promise<void>;
  handleRevertCancel: () => Promise<void>;
  handleBatchApprove: () => Promise<void>;
  handleBatchReject: () => Promise<void>;
  handleBatchRevert: () => Promise<void>;
}