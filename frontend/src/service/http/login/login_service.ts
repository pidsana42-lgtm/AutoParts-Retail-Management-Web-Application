import type { LoginRequest, LoginResponse } from "../../../interface/login/login_interface";
import apiClient from "../apiClient"; 

export async function loginUser(credentials: LoginRequest): Promise<LoginResponse> {
  try {
    const securePayload = {
      username: credentials.username,
      password: btoa(credentials.password) // สมมติพิมพ์ owner123 ในแท็บ Network จะเห็นเป็น "b3duZXIxMjM=" แทนทันที!
    };

    // ส่ง securePayload ที่แปลงรหัสแล้วไปแทน
    const response = await apiClient.post<LoginResponse>('/auth/login', securePayload);
    return response.data;

  } catch (error: any) {
    console.error('Authentication error:', error);
    const errorMessage = error.response?.data?.error || 'เกิดข้อผิดพลาดในการเชื่อมต่อระบบ';
    throw new Error(errorMessage); 
  }
}