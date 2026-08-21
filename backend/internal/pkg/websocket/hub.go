package websocket

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for now
	},
}

type Message struct {
	Title   string `json:"title"`
	Message string `json:"message"`
	Type    string `json:"type"` // success, info, warning, error
}

type Hub struct {
	clients    map[*websocket.Conn]bool
	broadcast  chan Message
	register   chan *websocket.Conn
	unregister chan *websocket.Conn
}

var GlobalHub *Hub

func InitHub() {
	GlobalHub = &Hub{
		broadcast:  make(chan Message),
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
		clients:    make(map[*websocket.Conn]bool),
	}
	go GlobalHub.run()
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				client.Close()
			}
		case message := <-h.broadcast:
			msgBytes, _ := json.Marshal(message)
			for client := range h.clients {
				err := client.WriteMessage(websocket.TextMessage, msgBytes)
				if err != nil {
					client.Close()
					delete(h.clients, client)
				}
			}
		}
	}
}

func ServeWS(c *gin.Context) {
	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("upgrade error:", err)
		return
	}
	GlobalHub.register <- ws

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

func BroadcastNotification(title, msg, notifType string) {
	if GlobalHub != nil {
		GlobalHub.broadcast <- Message{
			Title:   title,
			Message: msg,
			Type:    notifType,
		}
	}
}
