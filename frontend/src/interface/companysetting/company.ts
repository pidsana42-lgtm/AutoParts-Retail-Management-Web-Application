export interface CompanySettingReq {
  company_name: string;
  tax_id_number: string;
  address: string;
  phone_number: string;
  email: string;
  logo_url: string;
}

export interface CompanySettingResponse {
  id: number;
  company_name: string;
  tax_id_number: string;
  address: string;
  phone_number: string;
  email: string;
  logo_url: string;
}