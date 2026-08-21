package auth

import (
	authDTO "backend/internal/app/dto/auth"
	authRepo "backend/internal/app/repository/auth"
	"errors"
	"time"
	"os"
	"golang.org/x/crypto/bcrypt"
    "log"
	"github.com/golang-jwt/jwt/v5"
)

type AuthService interface {
    Login(req *authDTO.LoginRequest) (*authDTO.LoginResponse, error)
    LoginWithLine(lineUserID string) (*authDTO.LoginResponse, error)
}

type authService struct {
	userRepo authRepo.UserRepository
}

func NewAuthService(userRepo authRepo.UserRepository) AuthService {
	return &authService{userRepo: userRepo}
}

func (s *authService) Login(req *authDTO.LoginRequest) (*authDTO.LoginResponse, error) {
    // 1. ค้นหาผู้ใช้ในฐานข้อมูลผ่าน Repo
    user, err := s.userRepo.GetByUsername(req.Username)
    if err != nil {
        return nil, errors.New("ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง")
    }

    log.Println("=== [DEBUG AUTH] ===")
    log.Printf("Trying Username: %s", req.Username)
    log.Printf("Input Raw Password from Client: '%s'", req.Password)

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

