package oa

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"

	dto "backend/internal/app/dto/oa"
	"backend/internal/app/entity"
	repo "backend/internal/app/repository/oa"
)

type Service interface {
	GetLineUsers() ([]dto.LineUserDTO, error)
	GetLineMessages(lineUserID string) ([]dto.LineMessageDTO, error)
	SendMessage(lineUserID string, text string) error
	LinkCustomer(lineUserID string, customerID uint) error
	HandleWebhook(req dto.LineWebhookRequest) error
	SetUserRichMenu(lineUserID string) error
}

type service struct {
	repo repo.Repository
}

func NewService(repo repo.Repository) Service {
	return &service{repo: repo}
}

func (s *service) GetLineUsers() ([]dto.LineUserDTO, error) {
	users, err := s.repo.GetLineUsers()
	if err != nil {
		return nil, err
	}

	var dtos []dto.LineUserDTO
	for _, u := range users {
		unread, _ := s.repo.GetUnreadCount(u.LineUserID)
		custName := ""
		if u.Customer != nil {
			custName = u.Customer.CustomerName
		}

		dtos = append(dtos, dto.LineUserDTO{
			ID:            u.ID,
			LineUserID:    u.LineUserID,
			DisplayName:   u.DisplayName,
			PictureURL:    u.PictureURL,
			StatusMessage: u.StatusMessage,
			CustomerID:    u.CustomerID,
			CustomerName:  custName,
			UnreadCount:   unread,
		})
	}
	return dtos, nil
}

func (s *service) GetLineMessages(lineUserID string) ([]dto.LineMessageDTO, error) {
	// First mark as read
	_ = s.repo.MarkMessagesAsRead(lineUserID)

	messages, err := s.repo.GetLineMessages(lineUserID)
	if err != nil {
		return nil, err
	}

	var dtos []dto.LineMessageDTO
	for _, m := range messages {
		dtos = append(dtos, dto.LineMessageDTO{
			ID:             m.ID,
			LineUserID:     m.LineUserID,
			Sender:         m.Sender,
			MessageType:    m.MessageType,
			MessageContent: m.MessageContent,
			CreatedAt:      m.CreatedAt.Format("2006-01-02 15:04:05"),
			IsRead:         m.IsRead,
		})
	}
	return dtos, nil
}

func (s *service) SendMessage(lineUserID string, text string) error {
	// Save outgoing message log
	msg := entity.LineMessage{
		LineUserID:     lineUserID,
		Sender:         "admin",
		MessageType:    "text",
		MessageContent: text,
		IsRead:         true,
	}
	if err := s.repo.SaveLineMessage(&msg); err != nil {
		return err
	}

	token := strings.TrimSpace(os.Getenv("LINE_CHANNEL_ACCESS_TOKEN"))
	if token == "" {
		log.Println("WARNING: LINE_CHANNEL_ACCESS_TOKEN not configured. Simulating LINE message send locally.")
		return nil
	}

	// Make call to LINE push API
	url := "https://api.line.me/v2/bot/message/push"
	payload := map[string]interface{}{
		"to": lineUserID,
		"messages": []map[string]interface{}{
			{
				"type": "text",
				"text": text,
			},
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		log.Printf("[LINE Send] Failed to push message to %s. HTTP %d: %s\n", lineUserID, resp.StatusCode, string(respBody))
		return fmt.Errorf("LINE API returned non-OK status: %d, body: %s", resp.StatusCode, string(respBody))
	}

	log.Printf("[LINE Send] Successfully sent reply message to %s\n", lineUserID)
	return nil
}

func (s *service) LinkCustomer(lineUserID string, customerID uint) error {
	err := s.repo.LinkCustomer(lineUserID, customerID)
	if err == nil {
		go func() { _ = s.SetUserRichMenu(lineUserID) }()
	}
	return err
}

func (s *service) HandleWebhook(req dto.LineWebhookRequest) error {
	for _, event := range req.Events {
		if event.Source.UserID == "" {
			continue
		}

		// 1. Get or create LINE user
		lineUser, err := s.repo.GetLineUserByID(event.Source.UserID)
		if err != nil {
			return err
		}

		if lineUser == nil {
			// Profile lookup from LINE API
			lineUser = s.fetchUserProfile(event.Source.UserID)
			if err := s.repo.SaveLineUser(lineUser); err != nil {
				log.Printf("Error saving new LINE user: %v", err)
			}
		}

		// 2. Handle message events
		if event.Type == "message" && event.Message != nil {
			msg := entity.LineMessage{
				LineUserID:     event.Source.UserID,
				Sender:         "user",
				MessageType:    event.Message.Type,
				MessageContent: event.Message.Text,
				IsRead:         false,
			}
			if err := s.repo.SaveLineMessage(&msg); err != nil {
				log.Printf("Error saving incoming LINE message: %v", err)
			}

			// If it's a text message, query command or AI agent in the background and reply!
			if event.Message.Type == "text" && event.Message.Text != "" {
				textVal := strings.TrimSpace(event.Message.Text)
				log.Printf("[LINE Webhook] Processing text message from %s: %s\n", event.Source.UserID, textVal)
				
				isLinkCommand := false
				var phone string
				
				if strings.HasPrefix(textVal, "#เชื่อมต่อ ") {
					phone = strings.TrimSpace(strings.TrimPrefix(textVal, "#เชื่อมต่อ "))
					isLinkCommand = true
				} else if strings.HasPrefix(textVal, "#link ") {
					phone = strings.TrimSpace(strings.TrimPrefix(textVal, "#link "))
					isLinkCommand = true
				}

				if isLinkCommand {
					log.Printf("[LINE Webhook] Link command detected for user %s, phone: %s\n", event.Source.UserID, phone)
					go func(userId, phoneNo string) {
						phoneNo = strings.ReplaceAll(phoneNo, "-", "")
						phoneNo = strings.ReplaceAll(phoneNo, " ", "")

						cust, errCust := s.repo.GetCustomerByPhone(phoneNo)
						if errCust != nil {
							log.Printf("[Agent] Error looking up customer: %v", errCust)
							_ = s.SendMessage(userId, "เกิดข้อผิดพลาดในการตรวจสอบข้อมูลในระบบ กรุณาลองใหม่อีกครั้งค่ะ")
							return
						}

						if cust == nil {
							log.Printf("[Agent] Customer with phone %s not found\n", phoneNo)
							_ = s.SendMessage(userId, fmt.Sprintf("ไม่พบข้อมูลหมายเลขโทรศัพท์ %s ในระบบฐานข้อมูลของร้านค้า กรุณาติดต่อเจ้าหน้าที่เพื่อลงทะเบียนค่ะ", phoneNo))
							return
						}

						// Link this line user to the found customer
						errLink := s.repo.LinkCustomer(userId, cust.ID)
						if errLink != nil {
							log.Printf("[Agent] Error linking customer: %v", errLink)
							_ = s.SendMessage(userId, "ระบบขัดข้องชั่วคราว ไม่สามารถทำการเชื่อมโยงข้อมูลได้ในขณะนี้")
							return
						}

						log.Printf("[Agent] Successfully linked user %s to customer: %s\n", userId, cust.CustomerName)
						replyMsg := fmt.Sprintf("เชื่อมโยงบัญชีไลน์ของคุณเข้ากับโปรไฟล์ลูกค้า '%s' สำเร็จแล้วค่ะ! 🎉\nตอนนี้คุณสามารถพิมพ์ถามคำถามเกี่ยวกับสินค้า เช็คสต็อก หรือเช็คยอดค้างชำระได้ทันทีค่ะ", cust.CustomerName)
						_ = s.SendMessage(userId, replyMsg)
						
						// Trigger rich menu update dynamically
						go func() { _ = s.SetUserRichMenu(userId) }()
					}(event.Source.UserID, phone)
				} else {
					log.Printf("[LINE Webhook] Querying AI Agent: %s for user %s\n", textVal, event.Source.UserID)
					go func(userId, text string) {
						reply, errAgent := s.queryAgent(text, userId)
						if errAgent != nil {
							log.Printf("[Agent] Error querying AI agent: %v", errAgent)
							return
						}
						log.Printf("[Agent] AI Agent response: %s\n", reply)
						if reply != "" {
							if errSend := s.SendMessage(userId, reply); errSend != nil {
								log.Printf("[Agent] Error sending AI auto-reply to user %s: %v", userId, errSend)
							}
						}
					}(event.Source.UserID, event.Message.Text)
				}
			}
		} else if event.Type == "follow" {
			log.Printf("LINE user followed: %s\n", event.Source.UserID)
			// Assign default rich menu to new follower
			go func(userId string) { _ = s.SetUserRichMenu(userId) }(event.Source.UserID)
		}
	}
	return nil
}

func (s *service) queryAgent(queryText string, lineUserID string) (string, error) {
	// Try sending HTTP Request to FastAPI Server first
	fastAPIURL := "http://localhost:8000/api/agent"
	payload := map[string]interface{}{
		"query":        queryText,
		"line_user_id": lineUserID,
	}
	jsonPayload, errPayload := json.Marshal(payload)
	if errPayload == nil {
		client := http.Client{
			Timeout: 30 * time.Second,
		}
		log.Printf("[Agent] Attempting FastAPI query for user %s...\n", lineUserID)
		resp, errReq := client.Post(fastAPIURL, "application/json", bytes.NewBuffer(jsonPayload))
		if errReq == nil {
			defer resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				var result struct {
					Response string `json:"response"`
				}
				if errDec := json.NewDecoder(resp.Body).Decode(&result); errDec == nil {
					log.Printf("[Agent] Successfully queried agent via FastAPI for user %s\n", lineUserID)
					return result.Response, nil
				}
			} else {
				log.Printf("[Agent] FastAPI returned non-OK status: %d\n", resp.StatusCode)
			}
		} else {
			log.Printf("[Agent] Failed to connect to FastAPI: %v\n", errReq)
		}
	}

	// Fallback to CLI Python agent execution if FastAPI failed
	log.Printf("[Agent] Falling back to CLI execution for user %s\n", lineUserID)
	cmd := exec.Command("python3", "model/agent.py", queryText, lineUserID)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err != nil {
		log.Printf("[Agent] CLI execution failed: %v, stderr: %s\n", err, stderr.String())
		return "", err
	}

	return stdout.String(), nil
}

func (s *service) fetchUserProfile(userId string) *entity.LineUser {
	token := strings.TrimSpace(os.Getenv("LINE_CHANNEL_ACCESS_TOKEN"))
	defaultUser := &entity.LineUser{
		LineUserID:    userId,
		DisplayName:   "LINE User (" + userId[:6] + ")",
		PictureURL:    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200",
		StatusMessage: "สวัสดี! ฉันเป็นสมาชิกร้านค้าผ่าน LINE",
		Language:      "th",
	}

	if token == "" {
		return defaultUser
	}

	url := "https://api.line.me/v2/bot/profile/" + userId
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return defaultUser
	}

	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return defaultUser
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		var profile struct {
			DisplayName   string `json:"displayName"`
			UserId        string `json:"userId"`
			PictureUrl    string `json:"pictureUrl"`
			StatusMessage string `json:"statusMessage"`
			Language      string `json:"language"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&profile); err == nil {
			return &entity.LineUser{
				LineUserID:    profile.UserId,
				DisplayName:   profile.DisplayName,
				PictureURL:    profile.PictureUrl,
				StatusMessage: profile.StatusMessage,
				Language:      profile.Language,
			}
		}
	}

	return defaultUser
}

func (s *service) SetUserRichMenu(lineUserID string) error {
	token := strings.TrimSpace(os.Getenv("LINE_CHANNEL_ACCESS_TOKEN"))
	if token == "" {
		return nil
	}

	// 1. Determine User Role
	// Check if they are a system user (OWNER, EMPLOYEE, etc.)
	sysUser, err := s.repo.GetSystemUserByLineID(lineUserID)
	var richMenuID string

	if err == nil && sysUser != nil && sysUser.Role.RoleName != "" {
		roleName := strings.ToUpper(string(sysUser.Role.RoleName))
		log.Printf("[RichMenu] User %s is a system staff. Role: %s\n", lineUserID, roleName)
		if roleName == "OWNER" || roleName == "ADMIN" {
			richMenuID = os.Getenv("LINE_RICH_MENU_OWNER")
		} else {
			richMenuID = os.Getenv("LINE_RICH_MENU_EMPLOYEE")
		}
	} else {
		// All other users (linked customers, guests, general followers) default to the Customer menu
		log.Printf("[RichMenu] User %s is a customer/general user.\n", lineUserID)
		richMenuID = os.Getenv("LINE_RICH_MENU_CUSTOMER")
	}

	richMenuID = strings.TrimSpace(richMenuID)

	// 2. Perform binding via LINE API
	var apiURL string
	var method string

	if richMenuID != "" && !strings.Contains(richMenuID, "mock-id") {
		// Link custom rich menu
		apiURL = fmt.Sprintf("https://api.line.me/v2/bot/user/%s/richmenu/%s", lineUserID, richMenuID)
		method = "POST"
		log.Printf("[RichMenu] Linking rich menu %s to user %s\n", richMenuID, lineUserID)
	} else {
		// Unlink custom rich menu (falls back to default rich menu)
		apiURL = fmt.Sprintf("https://api.line.me/v2/bot/user/%s/richmenu", lineUserID)
		method = "DELETE"
		log.Printf("[RichMenu] Unlinking rich menu from user %s (mock-id or empty)\n", lineUserID)
	}

	req, err := http.NewRequest(method, apiURL, nil)
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[RichMenu] Connection error during binding: %v\n", err)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		log.Printf("[RichMenu] API returned non-OK status: %d, body: %s\n", resp.StatusCode, string(respBody))
		return fmt.Errorf("LINE API returned status %d: %s", resp.StatusCode, string(respBody))
	}

	log.Printf("[RichMenu] Successfully updated rich menu for user %s\n", lineUserID)
	return nil
}
