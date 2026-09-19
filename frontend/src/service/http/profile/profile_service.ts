import apiClient from "../apiClient";

export interface UserProfile {
  id: number;
  prefix: string;
  first_name: string;
  last_name: string;
  username: string;
  role: string;
  profile_image_path?: string;
	 id_card_number_user: string;
	 line_user_id: string;
	 bank_id: number;
	 bank_name: string;
	 bank_account_number: string;
	 bank_account_name: string;
}

export interface UpdateProfileRequest {
  prefix: string;
  first_name: string;
  last_name: string;
	 id_card_number_user: string;
	 line_user_id: string;
	 bank_name: string;
	 bank_account_number: string;
	 bank_account_name: string;
}

export const profileService = {
  get: async (): Promise<UserProfile> => {
    const response = await apiClient.get<UserProfile>("/auth/profile");
    return response.data;
  },

  update: async (payload: UpdateProfileRequest): Promise<UserProfile> => {
    const response = await apiClient.put<UserProfile>("/auth/profile", payload);
    return response.data;
  },

  uploadAvatar: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("avatar", file);
    const response = await apiClient.post<{ profile_image_path: string }>("/auth/profile/avatar", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data.profile_image_path;
  },

  deleteAvatar: async (): Promise<void> => {
    await apiClient.delete("/auth/profile/avatar");
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await apiClient.put("/auth/password", {
      current_password: currentPassword,
      new_password: newPassword,
    });
  },
};
