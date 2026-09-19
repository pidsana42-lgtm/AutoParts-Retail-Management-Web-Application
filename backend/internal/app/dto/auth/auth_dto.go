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

type ForgotPasswordRequest struct {
    Identifier string `json:"identifier" binding:"required"` // Username or Email
}

type ResetPasswordRequest struct {
    Identifier  string `json:"identifier" binding:"required"`
    OTP         string `json:"otp" binding:"required"`
    NewPassword string `json:"new_password" binding:"required,min=6"`
}