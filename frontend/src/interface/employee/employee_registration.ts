export interface BankOption {
  id: number;
  name: string;
}

export interface EmployeeRegistrationMetadata {
  banks: BankOption[];
}

export interface CreateEmployeeRequest {
  role: "Employee" | "Manager";
  prefix: string;
  first_name: string;
  last_name: string;
  id_card_number_user: string;
  username: string;
  password: string;
  line_user_id: string;
  bank_id: number;
  bank_name: string;
  bank_account_number: string;
  bank_account_name: string;
}

export interface UpdateEmployeeRequest extends Omit<CreateEmployeeRequest, "username"> {}

export interface CreatedEmployee {
  id: number;
  first_name: string;
  last_name: string;
  username: string;
  role: string;
  bank_name: string;
  account_end: string;
  account_masked: string;
  line_connected: boolean;
  created_at: string;
  profile_image_path?: string;
}

export interface EmployeeListResponse {
  employees: CreatedEmployee[];
  total: number;
}

export interface EmployeeDetail {
  id: number;
  prefix: string;
  first_name: string;
  last_name: string;
  id_card_number_user: string;
  username: string;
  line_user_id: string;
  role: string;
  bank_name: string;
  bank_account_number: string;
  bank_account_name: string;
  created_at: string;
  profile_image_path?: string;
}

// UI
export interface FormState {
  role: "Employee" | "Manager" | "";
  prefix: string;
  firstName: string;
  lastName: string;
  idCardNumber: string;
  username: string;
  password: string;
  confirmPassword: string;
  lineUserId: string;
  bankId: string;
  bankAccountNumber: string;
  bankAccountName: string;
}
