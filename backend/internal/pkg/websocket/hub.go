package websocket

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

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
					send = info.Role == "OWNER" || info.Role == "ADMIN"
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

// ServeWS: รับ role/user_id มาจาก query string ตอนเปิด connection (?role=Owner&user_id=5)
// เพื่อให้ hub รู้ว่า connection นี้เป็นของใคร จะได้ส่งแจ้งเตือนแบบเจาะจงได้ถูกคน
func ServeWS(c *gin.Context) {
	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("upgrade error:", err)
		return
	}

	role := strings.ToUpper(c.Query("role"))
	var userID uint
	if id, err := strconv.ParseUint(c.Query("user_id"), 10, 64); err == nil {
		userID = uint(id)
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
