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

export async function requestForgotPassword(identifier: string): Promise<{ message: string }> {
  try {
    const response = await apiClient.post<{ message: string }>('/auth/forgot-password', { identifier });
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.error || error.message || 'ไม่สามารถส่งรหัสยืนยัน (OTP) ได้';
    throw new Error(errorMessage);
  }
}

export async function resetPassword(payload: { identifier: string; otp: string; new_password: string }): Promise<{ message: string }> {
  try {
    const response = await apiClient.post<{ message: string }>('/auth/reset-password', payload);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.error || error.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้';
    throw new Error(errorMessage);
  }
}