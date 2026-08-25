import apiClient from "../apiClient";
import type {
  CompanySettingReq,
  CompanySettingResponse,
} from "../../../interface/companysetting/company";

export const resolveAssetUrl = (url: string): string => {
  if (!url) return "";
  if (/^https?:\/\//i.test(url) || url.startsWith("blob:") || url.startsWith("data:")) return url;
  const normalized = url.startsWith("/") ? url : `/${url}`;
  try {
    const apiOrigin = new URL(apiClient.defaults.baseURL || "").origin;
    return `${apiOrigin}${normalized}`;
  } catch {
    return normalized;
  }
};

export const companyService = {
  /**
   * ดึงข้อมูลการตั้งค่าร้านค้า
   */
  getCompanySetting: async (): Promise<CompanySettingResponse> => {
    const response = await apiClient.get<CompanySettingResponse>("/company-setting");
    return response.data;
  },

  /**
   * บันทึก/อัปเดตข้อมูลการตั้งค่าร้านค้า
   */
  updateCompanySetting: async (data: CompanySettingReq): Promise<CompanySettingResponse> => {
    const response = await apiClient.put<{ message: string; data: CompanySettingResponse }>(
      "/company-setting",
      data
    );
    return response.data?.data || (response.data as unknown as CompanySettingResponse);
  },

  /**
   * อัปโหลดไฟล์รูปภาพโลโก้ร้านค้า
   */
  uploadCompanyLogo: async (file: File): Promise<{ url: string; logo_url: string; filename: string }> => {
    const formData = new FormData();
    formData.append("logo", file);

    const token = localStorage.getItem("token");
    const baseURL = apiClient.defaults.baseURL || "http://localhost:8080/api";
    const url = `${baseURL}/company-setting/logo`;

    const response = await fetch(url, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: "อัปโหลดรูปภาพไม่สำเร็จ" }));
      throw new Error(err.error || "อัปโหลดรูปภาพไม่สำเร็จ");
    }

    return response.json();
  },
};
