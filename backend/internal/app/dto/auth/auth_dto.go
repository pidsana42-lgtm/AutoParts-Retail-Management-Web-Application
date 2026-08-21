package auth

// หน้าบ้านส่งมาตอนจะล็อกอิน
type LoginRequest struct {
    Username string `json:"username" binding:"required"`
    Password string `json:"password" binding:"required"`
}

// หลังบ้านตอบกลับไปเมื่อล็อกอินสำเร็จ
type LoginResponse struct {
    ID    uint   `json:"id"` // เดิมไม่เคยส่งมา ทำให้ฝั่งหน้าบ้านไม่รู้ user id ของตัวเองเลย (user.id ว่างเปล่าตลอด)
    Token string `json:"token"`
    Role  string `json:"role"`
    FirstName string `json:"first_name"`
    LastName string `json:"last_name"`
    Username string `json:"username"`
}

// หน้าบ้านส่งมาตอนสแกน QR ส่วนตัวของพนักงาน (มือถือ) เพื่อขอแลก token เป็น session ล็อกอินจริง
type QrLoginRequest struct {
    Token string `json:"token" binding:"required"`
}

// ตอบกลับตอนดึง/สร้าง QR login token ของ user ที่ล็อกอินอยู่ (แสดงเป็น QR บนคอม)
type QrTokenResponse struct {
    Token string `json:"token"`
}