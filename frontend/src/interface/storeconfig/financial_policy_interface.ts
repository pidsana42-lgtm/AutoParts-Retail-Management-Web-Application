export interface FinancialPolicyConfig {
  max_credit: number;
  max_overdue_days: number;
  max_extra_discount_rate: number;
  supervised_pin?: string;
}

export interface FinancialPolicyAuditLog {
  id: number;
  action: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  details?: string;
  changed_by: string;
  changed_at: string;
}

export interface UseFinancialPolicyReturn {
  config: FinancialPolicyConfig;
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean;
  error: string | null;
  successMessage: string | null;
  showAuditModal: boolean;
  setShowAuditModal: (show: boolean) => void;
  handleChange: (field: keyof FinancialPolicyConfig, value: any) => void;
  handleReset: () => void;
  handleSave: () => Promise<boolean>;
  refetch: () => Promise<void>;
}
