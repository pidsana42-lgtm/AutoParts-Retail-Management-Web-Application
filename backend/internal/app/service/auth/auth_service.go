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
	"net/mail"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"regexp"
	"strings"
)

type AuthService interface {
	Login(req *authDTO.LoginRequest) (*authDTO.LoginResponse, error)
	LoginWithLine(lineUserID string) (*authDTO.LoginResponse, error)
	GetProfile(userID uint) (*authDTO.ProfileResponse, error)
	UpdateProfile(userID uint, req *authDTO.UpdateProfileRequest) (*authDTO.ProfileResponse, error)
	SaveProfileImage(userID uint, path string) error
	ChangePassword(userID uint, req *authDTO.ChangePasswordRequest) error
	ForgotPassword(req *authDTO.ForgotPasswordRequest) error
	ResetPassword(req *authDTO.ResetPasswordRequest) error
}

func profileResponse(user *entity.User) *authDTO.ProfileResponse {
	return &authDTO.ProfileResponse{
		ID:                user.ID,
		Prefix:            user.Prefix,
		FirstName:         user.FirstName,
		LastName:          user.LastName,
		Username:          user.Username,
		Email:             user.Email,
		Role:              string(user.Role.RoleName),
		ProfileImagePath:  user.ProfileImagePath,
		IDCardNumber:      user.IdCardNumberUser,
		LineUserID:        user.LineUserID,
		BankID:            user.BankID,
		BankName:          user.Bank.BankName,
		BankAccountNumber: user.BankAccountNumber,
		BankAccountName:   user.BankAccountName,
	}
}

func (s *authService) GetProfile(userID uint) (*authDTO.ProfileResponse, error) {
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return nil, err
	}
	return profileResponse(user), nil
}

func (s *authService) UpdateProfile(userID uint, req *authDTO.UpdateProfileRequest) (*authDTO.ProfileResponse, error) {
	currentUser, err := s.userRepo.GetByID(userID)
	if err != nil {
		return nil, err
	}
	isOwner := strings.EqualFold(string(currentUser.Role.RoleName), "OWNER")

	req.Prefix = strings.TrimSpace(req.Prefix)
	req.FirstName = strings.TrimSpace(req.FirstName)
	req.LastName = strings.TrimSpace(req.LastName)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.IDCardNumber = regexp.MustCompile(`\D`).ReplaceAllString(req.IDCardNumber, "")
	req.LineUserID = strings.TrimSpace(req.LineUserID)
	req.BankName = strings.TrimSpace(req.BankName)
	req.BankAccountNumber = regexp.MustCompile(`\D`).ReplaceAllString(req.BankAccountNumber, "")
	req.BankAccountName = strings.TrimSpace(req.BankAccountName)
	if req.Prefix == "" || req.FirstName == "" || req.LastName == "" {
		return nil, errors.New("กรุณากรอกข้อมูลส่วนตัวให้ครบ")
	}
	parsedEmail, emailErr := mail.ParseAddress(req.Email)
	if emailErr != nil || parsedEmail.Address != req.Email {
		return nil, errors.New("กรุณากรอกอีเมลให้ถูกต้อง")
	}
	if len(req.IDCardNumber) != 13 {
		return nil, errors.New("เลขบัตรประชาชนต้องมี 13 หลัก")
	}
	if !isOwner {
		if req.BankName == "" || req.BankAccountName == "" {
			return nil, errors.New("กรุณากรอกข้อมูลบัญชีธนาคารให้ครบ")
		}
		if len(req.BankAccountNumber) < 6 || len(req.BankAccountNumber) > 20 {
			return nil, errors.New("เลขบัญชีธนาคารต้องมี 6 ถึง 20 หลัก")
		}
	}
	if exists, err := s.userRepo.ValueExistsExcludingUser("id_card_number_user", req.IDCardNumber, userID); err != nil {
		return nil, err
	} else if exists {
		return nil, errors.New("เลขบัตรประชาชนนี้ถูกใช้งานแล้ว")
	}
	if exists, err := s.userRepo.ValueExistsExcludingUser("LOWER(email)", req.Email, userID); err != nil {
		return nil, err
	} else if exists {
		return nil, errors.New("อีเมลนี้ถูกใช้งานแล้ว")
	}
	if req.LineUserID != "" {
		if exists, err := s.userRepo.ValueExistsExcludingUser("line_user_id", req.LineUserID, userID); err != nil {
			return nil, err
		} else if exists {
			return nil, errors.New("LINE User ID นี้ถูกใช้งานแล้ว")
		}
	}

	user, err := s.userRepo.UpdateProfile(userID, authRepo.ProfileUpdates{
		Prefix:            req.Prefix,
		FirstName:         req.FirstName,
		LastName:          req.LastName,
		Email:             req.Email,
		IDCardNumber:      req.IDCardNumber,
		LineUserID:        req.LineUserID,
		BankName:          req.BankName,
		BankAccountNumber: req.BankAccountNumber,
		BankAccountName:   req.BankAccountName,
		UpdateBank:        !isOwner,
	})
	if err != nil {
		return nil, err
	}
	return profileResponse(user), nil
}

func (s *authService) ChangePassword(userID uint, req *authDTO.ChangePasswordRequest) error {
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.CurrentPassword)); err != nil {
		return errors.New("รหัสผ่านปัจจุบันไม่ถูกต้อง")
	}
	if len(req.NewPassword) < 8 || !regexp.MustCompile(`[a-zA-Z]`).MatchString(req.NewPassword) || !regexp.MustCompile(`\d`).MatchString(req.NewPassword) {
		return errors.New("รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัว และประกอบด้วยตัวอักษรกับตัวเลข")
	}
	if bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.NewPassword)) == nil {
		return errors.New("รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน")
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return s.userRepo.UpdatePassword(userID, string(passwordHash))
}

func (s *authService) SaveProfileImage(userID uint, path string) error {
	return s.userRepo.UpdateProfileImage(userID, path)
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
		"role":    string(user.Role.RoleName),            // ดึงค่าจาก Enum ในตาราง Role ของโบว์มาแปลงเป็น string
		"exp":     time.Now().Add(time.Hour * 24).Unix(), // ตั๋วมีอายุ 24 ชั่วโมง
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// ดึงรหัสลับสำหรับล็อก Token (ให้ล้อตามฟังก์ชัน jwtSecret ใน Middleware ของโบว์ — main.go เช็คตั้งแต่
	// ตอนสตาร์ทแล้วว่า JWT_SECRET ต้องถูกตั้งค่าไว้ ไม่มี fallback เป็นค่า default ในซอร์สโค้ดอีกต่อไป)
	tokenString, err := token.SignedString([]byte(os.Getenv("JWT_SECRET")))
	if err != nil {
		return nil, errors.New("ไม่สามารถสร้างรหัสเข้าสู่ระบบได้")
	}

	// 4. ส่ง Token และสิทธิ์ของ User กลับไปให้ Controller
	return &authDTO.LoginResponse{
		ID:        user.ID,
		Token:     tokenString,
		Role:      string(user.Role.RoleName),
		FirstName: user.FirstName,
		LastName:  user.LastName,
		Username:  user.Username,
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

	tokenString, err := token.SignedString([]byte(os.Getenv("JWT_SECRET")))
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
