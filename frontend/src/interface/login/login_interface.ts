export interface LoginRequest {
  username: string;
  password: string;
}

// โครงสร้างจริงที่หลังบ้านส่งมา (flat ไม่มี user ซ้อนอยู่ข้างใน) — ดู backend/internal/app/dto/auth/auth_dto.go
export interface LoginResponse {
  id: number;
  token: string;
  role: string;
  first_name: string;
  last_name: string;
  username: string;
}