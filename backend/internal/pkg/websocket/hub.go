package websocket

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"backend/internal/middleware"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for now
	},
}

type Message struct {
	ID      uint   `json:"id,omitempty"`
	Title   string `json:"title"`
	Message string `json:"message"`
	Type    string `json:"type"` // success, info, warning, error
	Link    string `json:"link,omitempty"`
}

// ClientInfo: ข้อมูลผู้ใช้ของแต่ละ connection ที่เชื่อมเข้ามา (frontend ส่งมาผ่าน query string ตอนเปิด websocket)
// ใช้ตัดสินใจว่าข้อความไหนควรส่งให้ client ไหนบ้าง กันเจ้าของร้าน/พนักงานเห็นแจ้งเตือนของกันและกัน
type ClientInfo struct {
	Role   string
	UserID uint
}

type scope int

const (
	scopeAll scope = iota
	scopeOwners
	scopeUser
	scopeEmployees
)

type outgoing struct {
	Msg    Message
	Scope  scope
	UserID uint
}

type registration struct {
	Conn *websocket.Conn
	Info ClientInfo
}

type Hub struct {
	clients    map[*websocket.Conn]ClientInfo
	broadcast  chan outgoing
	register   chan *registration
	unregister chan *websocket.Conn
}

var GlobalHub *Hub

func InitHub() {
	GlobalHub = &Hub{
		broadcast:  make(chan outgoing),
		register:   make(chan *registration),
		unregister: make(chan *websocket.Conn),
		clients:    make(map[*websocket.Conn]ClientInfo),
	}
	go GlobalHub.run()
}

func (h *Hub) run() {
	for {
		select {
		case reg := <-h.register:
			h.clients[reg.Conn] = reg.Info
		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				client.Close()
			}
		case out := <-h.broadcast:
			msgBytes, _ := json.Marshal(out.Msg)
			for client, info := range h.clients {
				send := false
				switch out.Scope {
				case scopeAll:
					send = true
				case scopeOwners:
					send = info.Role == "OWNER" || info.Role == "MANAGER" || info.Role == "ADMIN"
				case scopeUser:
					send = info.UserID != 0 && info.UserID == out.UserID
				case scopeEmployees:
					send = info.Role == "EMPLOYEE" || info.Role == "STAFF"
				}
				if !send {
					continue
				}
				if err := client.WriteMessage(websocket.TextMessage, msgBytes); err != nil {
					client.Close()
					delete(h.clients, client)
				}
			}
		}
	}
}

// ServeWS: ต้องมี JWT ที่ตรวจผ่านก่อนถึงจะยอม upgrade เป็น WebSocket ได้ (เดิมรับ role/user_id ตรงๆ
// จาก query string โดยไม่ตรวจอะไรเลย ใครก็ต่อเข้ามาแล้วอ้างว่าตัวเองเป็นเจ้าของร้าน หรือสวมเป็น user_id
// คนอื่นเพื่อรับแจ้งเตือนที่ไม่ใช่ของตัวเองได้) — เบราว์เซอร์ส่ง Authorization header กับ WebSocket
// handshake ไม่ได้ จึงรับ token ผ่าน query param ?token= แทน (แบบเดียวกับที่ AuthMiddleware รองรับ
// สำหรับ <img> tag อยู่แล้ว) แล้ว derive role/user_id จาก token ที่ตรวจผ่านแล้วเท่านั้น
func ServeWS(c *gin.Context) {
	tokenString := c.Query("token")
	if tokenString == "" {
		auth := c.GetHeader("Authorization")
		parts := strings.SplitN(auth, " ", 2)
		if len(parts) == 2 && strings.EqualFold(parts[0], "bearer") {
			tokenString = parts[1]
		}
	}
	if tokenString == "" {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	claims, err := middleware.ParseToken(tokenString)
	if err != nil {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	var userID uint
	if uidRaw, ok := claims["user_id"]; ok {
		if f, ok := uidRaw.(float64); ok {
			userID = uint(f)
		}
	}
	role := ""
	if r, ok := claims["role"].(string); ok {
		role = strings.ToUpper(strings.TrimSpace(r))
	}
	if role == "" || userID == 0 {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("upgrade error:", err)
		return
	}

	GlobalHub.register <- &registration{Conn: ws, Info: ClientInfo{Role: role, UserID: userID}}

	// Listen for close
	go func() {
		defer func() {
			GlobalHub.unregister <- ws
		}()
		for {
			_, _, err := ws.ReadMessage()
			if err != nil {
				break
			}
		}
	}()
}

// BroadcastNotification: แจ้งทุกคนที่ล็อกอินอยู่ (พฤติกรรมเดิม ใช้กับใบเคลม/พรีออเดอร์ใหม่ — ไม่เปลี่ยนแปลง)
func BroadcastNotification(title, msg, notifType string) {
	if GlobalHub != nil {
		GlobalHub.broadcast <- outgoing{Msg: Message{Title: title, Message: msg, Type: notifType}, Scope: scopeAll}
	}
}

// NotifyOwners: แจ้งเตือนเฉพาะเจ้าของร้าน/แอดมินที่ล็อกอินอยู่ ณ ตอนนี้ (ไม่ไปโผล่ฝั่งพนักงาน)
func NotifyOwners(id uint, title, msg, notifType, link string) {
	if GlobalHub != nil {
		GlobalHub.broadcast <- outgoing{
			Msg:   Message{ID: id, Title: title, Message: msg, Type: notifType, Link: link},
			Scope: scopeOwners,
		}
	}
}

// NotifyUser: แจ้งเตือนพนักงานคนใดคนหนึ่งโดยเฉพาะ (ไม่ไปโผล่หน้าคนอื่น)
func NotifyUser(userID uint, id uint, title, msg, notifType, link string) {
	if GlobalHub != nil {
		GlobalHub.broadcast <- outgoing{
			Msg:    Message{ID: id, Title: title, Message: msg, Type: notifType, Link: link},
			Scope:  scopeUser,
			UserID: userID,
		}
	}
}

// NotifyEmployees: แจ้งเตือนพนักงานทุกคนที่ล็อกอินอยู่ ณ ตอนนี้ (ไม่ไปโผล่ฝั่งเจ้าของร้าน)
func NotifyEmployees(id uint, title, msg, notifType, link string) {
	if GlobalHub != nil {
		GlobalHub.broadcast <- outgoing{
			Msg:   Message{ID: id, Title: title, Message: msg, Type: notifType, Link: link},
			Scope: scopeEmployees,
		}
	}
}
