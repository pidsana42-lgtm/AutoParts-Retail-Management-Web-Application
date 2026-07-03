package auth

import (
	authDTO "backend/internal/app/dto/auth"
	authSVC "backend/internal/app/service/auth"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

type AuthController struct {
	authService authSVC.AuthService
}

func NewAuthController(authService authSVC.AuthService) *AuthController {
	return &AuthController{authService: authService}
}

func (c *AuthController) Login(ctx *gin.Context) {
	var loginRequest authDTO.LoginRequest
	if err := ctx.ShouldBindJSON(&loginRequest); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน"})
		return
	}

	decodedPassword, err := base64.StdEncoding.DecodeString(loginRequest.Password)
	if err == nil {
		// ✅ ถ้า Decode สำเร็จ (มาจาก Frontend) ค่อยสลับเอาตัวถอดรหัสมาใช้
		loginRequest.Password = string(decodedPassword)
	}

	res, err := c.authService.Login(&loginRequest)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, res)
}

func (ctrl *AuthController) LineCallback(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		c.Redirect(http.StatusFound, "http://localhost:5173/login?error="+url.QueryEscape("ไม่มีรหัสยืนยันตัวตนจาก LINE"))
		return
	}

	channelID := strings.TrimSpace(os.Getenv("Channel_ID"))
	channelSecret := strings.TrimSpace(os.Getenv("Channel_secret"))

	// Construct dynamic redirect URI to match LINE login configuration automatically
	scheme := "http"
	if c.Request.TLS != nil || c.Request.Header.Get("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	redirectURI := scheme + "://" + c.Request.Host + "/api/auth/line/callback"

	log.Printf("[LINE Login] Exchanging authorization code. RedirectURI: %s, ChannelID: %s\n", redirectURI, channelID)

	// Exchanging code for LINE token
	tokenURL := "https://api.line.me/oauth2/v2.1/token"
	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", redirectURI)
	form.Set("client_id", channelID)
	form.Set("client_secret", channelSecret)

	resp, err := http.PostForm(tokenURL, form)
	if err != nil {
		c.Redirect(http.StatusFound, "http://localhost:5173/login?error="+url.QueryEscape("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ LINE ได้: "+err.Error()))
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.Redirect(http.StatusFound, "http://localhost:5173/login?error="+url.QueryEscape(fmt.Sprintf("LINE API ตอบกลับด้วยรหัส: %d", resp.StatusCode)))
		return
	}

	var tokenRes struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenRes); err != nil {
		c.Redirect(http.StatusFound, "http://localhost:5173/login?error="+url.QueryEscape("ไม่สามารถอ่านข้อมูลโทเคนจาก LINE ได้"))
		return
	}

	// Fetch LINE Profile to get user ID
	profileURL := "https://api.line.me/v2/profile"
	req, err := http.NewRequest("GET", profileURL, nil)
	if err != nil {
		c.Redirect(http.StatusFound, "http://localhost:5173/login?error="+url.QueryEscape("ไม่สามารถสร้างคำร้องขอโปรไฟล์ LINE ได้"))
		return
	}
	req.Header.Set("Authorization", "Bearer "+tokenRes.AccessToken)

	client := &http.Client{}
	profileResp, err := client.Do(req)
	if err != nil {
		c.Redirect(http.StatusFound, "http://localhost:5173/login?error="+url.QueryEscape("ไม่สามารถดึงข้อมูลโปรไฟล์จาก LINE ได้: "+err.Error()))
		return
	}
	defer profileResp.Body.Close()

	if profileResp.StatusCode != http.StatusOK {
		c.Redirect(http.StatusFound, "http://localhost:5173/login?error="+url.QueryEscape(fmt.Sprintf("LINE Profile API ตอบกลับด้วยรหัส: %d", profileResp.StatusCode)))
		return
	}

	var profileRes struct {
		UserID string `json:"userId"`
	}
	if err := json.NewDecoder(profileResp.Body).Decode(&profileRes); err != nil {
		c.Redirect(http.StatusFound, "http://localhost:5173/login?error="+url.QueryEscape("ไม่สามารถอ่านข้อมูลโปรไฟล์จาก LINE ได้"))
		return
	}

	// Exchange LINE UserID for internal signed JWT
	res, err := ctrl.authService.LoginWithLine(profileRes.UserID)
	if err != nil {
		c.Redirect(http.StatusFound, "http://localhost:5173/login?error="+url.QueryEscape(err.Error()))
		return
	}

	// Success! Redirect to frontend login callback parser
	c.Redirect(http.StatusFound, fmt.Sprintf("http://localhost:5173/login?token=%s&role=%s&username=%s&first_name=%s",
		res.Token, res.Role, res.Username, res.FirstName))
}