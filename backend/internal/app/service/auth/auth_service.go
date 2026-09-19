package auth

import (
	authDTO "backend/internal/app/dto/auth"
	"backend/internal/app/entity"
	authRepo "backend/internal/app/repository/auth"
	"backend/internal/app/service/email"
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type AuthService interface {
	Login(req *authDTO.LoginRequest) (*authDTO.LoginResponse, error)
	LoginWithLine(lineUserID string) (*authDTO.LoginResponse, error)
	ForgotPassword(req *authDTO.ForgotPasswordRequest) error
	ResetPassword(req *authDTO.ResetPasswordRequest) error
}

type authService struct {
	userRepo authRepo.UserRepository
	emailSvc email.EmailService
}

func NewAuthService(userRepo authRepo.UserRepository, emailSvc email.EmailService) AuthService {
	return &authService{userRepo: userRepo, emailSvc: emailSvc}
}

func (s *authService) Login(req *authDTO.LoginRequest) (*authDTO.LoginResponse, error) {
    // 1. ค้นหาผู้ใช้ในฐานข้อมูลผ่าน Repo (รองรับทั้ง Username และ Email)
    user, err := s.userRepo.GetByIdentifier(req.Username)
    if err != nil {
        return nil, errors.New("ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง")
    }

    err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password))
    if err != nil {
        return nil, errors.New("ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง")
    }

    claims := jwt.MapClaims{
        "user_id": user.ID,
        "role":    string(user.Role.RoleName), // ดึงค่าจาก Enum ในตาราง Role ของโบว์มาแปลงเป็น string
        "exp":     time.Now().Add(time.Hour * 24).Unix(), // ตั๋วมีอายุ 24 ชั่วโมง
    }

    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    
    // ดึงรหัสลับสำหรับล็อก Token (ให้ล้อตามฟังก์ชัน jwtSecret ใน Middleware ของโบว์)
    secret := os.Getenv("JWT_SECRET")
    if secret == "" {
        secret = "replace-with-secure-secret"
    }

    tokenString, err := token.SignedString([]byte(secret))
    if err != nil {
        return nil, errors.New("ไม่สามารถสร้างรหัสเข้าสู่ระบบได้")
    }

    // 4. ส่ง Token และสิทธิ์ของ User กลับไปให้ Controller
    return &authDTO.LoginResponse{
        ID:    user.ID,
        Token: tokenString,
        Role:  string(user.Role.RoleName),
        FirstName: user.FirstName,
        LastName: user.LastName,
        Username: user.Username,
    }, nil
}

func (s *authService) LoginWithLine(lineUserID string) (*authDTO.LoginResponse, error) {
    // 1. ค้นหาผู้ใช้ในฐานข้อมูลผ่าน Repo
    user, err := s.userRepo.GetByLineUserID(lineUserID)
    if err != nil {
        return nil, errors.New("บัญชี LINE นี้ยังไม่ได้ลงทะเบียนในระบบ หรือยังไม่ได้รับการเชื่อมต่อบัญชี")
    }

    // 2. สร้าง Claims สำหรับตั๋ว JWT
    claims := jwt.MapClaims{
        "user_id": user.ID,
        "role":    string(user.Role.RoleName),
        "exp":     time.Now().Add(time.Hour * 24).Unix(), // 24 ชั่วโมง
    }

    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    
    secret := os.Getenv("JWT_SECRET")
    if secret == "" {
        secret = "replace-with-secure-secret"
    }

    tokenString, err := token.SignedString([]byte(secret))
    if err != nil {
        return nil, errors.New("ไม่สามารถสร้างรหัสเข้าสู่ระบบได้")
    }

    // 3. ส่ง Token และข้อมูลผู้ใช้กลับไป
    return &authDTO.LoginResponse{
        ID:        user.ID,
        Token:     tokenString,
        Role:      string(user.Role.RoleName),
        FirstName: user.FirstName,
        LastName:  user.LastName,
        Username:  user.Username,
    }, nil
}

func generateOTP(max int) string {
	var table = [...]byte{'1', '2', '3', '4', '5', '6', '7', '8', '9', '0'}
	b := make([]byte, max)
	n, err := io.ReadAtLeast(rand.Reader, b, max)
	if n != max || err != nil {
		return fmt.Sprintf("%06d", time.Now().UnixNano()%1000000)
	}
	for i := 0; i < len(b); i++ {
		b[i] = table[int(b[i])%len(table)]
	}
	return string(b)
}

func (s *authService) ForgotPassword(req *authDTO.ForgotPasswordRequest) error {
	user, err := s.userRepo.GetByIdentifier(req.Identifier)
	if err != nil {
		return errors.New("ไม่พบบัญชีผู้ใช้งานในระบบ")
	}

	targetEmail := user.Email
	if targetEmail == "" {
		targetEmail = os.Getenv("SMTP_USER")
		if targetEmail == "" {
			return errors.New("บัญชีนี้ยังไม่ได้ผูกอีเมล และไม่มีอีเมลระบบสำหรับจัดส่ง")
		}
	}

	otp := generateOTP(6)
	expiresAt := time.Now().Add(15 * time.Minute)

	reset := &entity.PasswordReset{
		UserID:    user.ID,
		Email:     targetEmail,
		OTP:       otp,
		ExpiresAt: expiresAt,
		IsUsed:    false,
	}

	if err := s.userRepo.SavePasswordReset(reset); err != nil {
		return errors.New("เกิดข้อผิดพลาดในการสร้างรหัส OTP")
	}

	go func() {
		if err := s.emailSvc.SendPasswordResetOTP(targetEmail, user.Username, otp); err != nil {
			log.Printf("[Email] Failed to send OTP to %s: %v\n", targetEmail, err)
		} else {
			log.Printf("[Email] Successfully sent OTP to %s\n", targetEmail)
		}
	}()

	return nil
}

func (s *authService) ResetPassword(req *authDTO.ResetPasswordRequest) error {
	user, err := s.userRepo.GetByIdentifier(req.Identifier)
	if err != nil {
		return errors.New("ไม่พบบัญชีผู้ใช้งานในระบบ")
	}

	reset, err := s.userRepo.GetValidPasswordReset(user.ID, req.OTP)
	if err != nil {
		return errors.New("รหัส OTP ไม่ถูกต้องหรือหมดอายุแล้ว")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return errors.New("เกิดข้อผิดพลาดในการเข้ารหัสผ่านใหม่")
	}

	if err := s.userRepo.UpdatePassword(user.ID, string(hashedPassword)); err != nil {
		return errors.New("ไม่สามารถเปลี่ยนรหัสผ่านได้")
	}

	_ = s.userRepo.MarkPasswordResetUsed(reset.ID)
	return nil
}

