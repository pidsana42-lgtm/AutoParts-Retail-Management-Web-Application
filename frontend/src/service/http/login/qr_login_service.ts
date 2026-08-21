import type { LoginResponse } from "../../../interface/login/login_interface";
import apiClient from "../apiClient";

export interface QrTokenResponse {
  token: string;
}

// ดึง QR token ส่วนตัวของ user ที่ล็อกอินอยู่ (backend จะสร้างให้อัตโนมัติถ้ายังไม่เคยมี)
// ใช้แสดงเป็น QR บนคอมที่ล็อกอินอยู่แล้ว ให้พนักงานเอามือถือมาสแกนเพื่อล็อกอินต่อได้เลย
export async function getMyQrToken(): Promise<QrTokenResponse> {
  const res = await apiClient.get<QrTokenResponse>("/auth/qr-token");
  return res.data;
}

// ยกเลิก QR เดิม แล้วออกอันใหม่ (เผื่อ QR เก่าหลุดไปอยู่ในมือคนอื่น)
export async function regenerateMyQrToken(): Promise<QrTokenResponse> {
  const res = await apiClient.post<QrTokenResponse>("/auth/qr-token/regenerate");
  return res.data;
}

// มือถือที่สแกน QR ส่วนตัวเอา token มาแลกเป็น session ล็อกอินจริง (ไม่ต้องกรอก username/password)
export async function loginWithQrToken(token: string): Promise<LoginResponse> {
  try {
    const res = await apiClient.post<LoginResponse>("/auth/qr-login", { token });
    return res.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.error || "เกิดข้อผิดพลาดในการเชื่อมต่อระบบ";
    throw new Error(errorMessage);
  }
}
