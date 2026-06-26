import type { LoginRequest, LoginResponse } from "../../../interface/login/login_interface";
export async function loginUser(credentials: LoginRequest): Promise<LoginResponse> {
  const apiUrl = import.meta.env.VITE_API_URL

  if (!apiUrl) {
    throw new Error('Configuration Error: API_URL environment variable is missing.');
  }

  try {
    const response = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage = errorData?.message || `Login failed with status: ${response.status}`;
      
      throw new Error(errorMessage);
    }

    const data: LoginResponse = await response.json();
    return data;

  } catch (error) {
    console.error('Authentication error:', error);
    
    throw error; 
  }
}