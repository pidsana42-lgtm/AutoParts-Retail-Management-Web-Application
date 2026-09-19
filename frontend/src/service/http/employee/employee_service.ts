import apiClient from "../apiClient";
import type {
  CreateEmployeeRequest,
  CreatedEmployee,
  EmployeeListResponse,
  EmployeeDetail,
  EmployeeRegistrationMetadata,
  UpdateEmployeeRequest,
} from "../../../interface/employee/employee_registration";

export const employeeService = {
  list: async (): Promise<EmployeeListResponse> => {
    const response = await apiClient.get<EmployeeListResponse>("/employees");
    return response.data;
  },

  getDetails: async (employeeId: number, password: string): Promise<EmployeeDetail> => {
    const response = await apiClient.post<EmployeeDetail>(`/employees/${employeeId}/details`, { password });
    return response.data;
  },

  update: async (employeeId: number, payload: UpdateEmployeeRequest): Promise<EmployeeDetail> => {
    const response = await apiClient.put<EmployeeDetail>(`/employees/${employeeId}`, payload);
    return response.data;
  },

  uploadAvatar: async (employeeId: number, file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("avatar", file);
    const response = await apiClient.post<{ profile_image_path: string }>(`/employees/${employeeId}/avatar`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data.profile_image_path;
  },

  getRegistrationMetadata: async (): Promise<EmployeeRegistrationMetadata> => {
    const response = await apiClient.get<EmployeeRegistrationMetadata>(
      "/employees/registration-metadata"
    );
    return response.data;
  },

  create: async (payload: CreateEmployeeRequest): Promise<CreatedEmployee> => {
    const response = await apiClient.post<{ message: string; data: CreatedEmployee }>(
      "/employees",
      payload
    );
    return response.data.data;
  },
};
