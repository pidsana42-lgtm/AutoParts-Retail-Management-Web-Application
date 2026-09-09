export interface CompanySettingReq {
  company_name: string;
  tax_id_number: string;
  address: string;
  phone_number: string;
  email: string;
  logo_url: string;
  promptpay_type?: string;
  promptpay_number?: string;
  promptpay_name?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_name?: string;
}

export interface CompanySettingResponse {
  id: number;
  company_name: string;
  tax_id_number: string;
  address: string;
  phone_number: string;
  email: string;
  logo_url: string;
  promptpay_type?: string;
  promptpay_number_masked?: string;
  promptpay_name?: string;
  has_promptpay?: boolean;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_number_masked?: string;
  bank_account_name?: string;
  has_bank_account?: boolean;
}

export interface PaymentSettingRevealResponse {
  promptpay_number: string;
  promptpay_type: string;
  promptpay_name: string;
  bank_name: string;
  bank_account_number: string;
  bank_account_name: string;
}