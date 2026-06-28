export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    name: string;
    username: string;
    first_name: string;
    last_name: string;
  };
  role: string;
}