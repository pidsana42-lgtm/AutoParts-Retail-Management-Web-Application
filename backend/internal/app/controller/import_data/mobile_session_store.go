package import_data

import (
	"crypto/rand"
	"encoding/base64"
	"sync"
	"time"
)

// mobileSessionTTL: อายุของ session อัปโหลดรูปผ่านมือถือ (สแกน QR) — สั้นพอที่จะจำกัดความเสี่ยง
// ถ้า session รั่วไหล แต่ยาวพอให้ผู้ใช้สแกน/ถ่าย/อัปโหลดรูปทันภายในครั้งเดียว
const mobileSessionTTL = 15 * time.Minute

// mobileSessionStore: เก็บ session ที่ backend สร้างให้จริง (ไม่ใช่แค่เช็ครูปแบบตัวอักษร) พร้อมเวลาหมดอายุ
// ใน memory ล้วน (ไม่ต้องคงอยู่ข้าม restart เพราะ session มีอายุสั้นและใช้ครั้งเดียวอยู่แล้ว)
type mobileSessionStore struct {
	mu       sync.Mutex
	sessions map[string]time.Time
}

var mobileSessions = &mobileSessionStore{sessions: make(map[string]time.Time)}

// create: สุ่ม session ID ด้วย crypto/rand (ไม่ใช่ Math.random ฝั่ง client แบบเดิม) แล้วจดทะเบียนไว้
func (s *mobileSessionStore) create() (string, time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.purgeExpiredLocked()

	buf := make([]byte, 24)
	_, _ = rand.Read(buf)
	session := base64.RawURLEncoding.EncodeToString(buf)
	expiresAt := time.Now().Add(mobileSessionTTL)
	s.sessions[session] = expiresAt
	return session, expiresAt
}

// valid: session ต้องเคยถูกสร้างจริงโดย create() และยังไม่หมดอายุ — ไม่ใช่แค่ "หน้าตา" ถูกต้อง
func (s *mobileSessionStore) valid(session string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	expiresAt, ok := s.sessions[session]
	if !ok {
		return false
	}
	if time.Now().After(expiresAt) {
		delete(s.sessions, session)
		return false
	}
	return true
}

func (s *mobileSessionStore) delete(session string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, session)
}

func (s *mobileSessionStore) purgeExpiredLocked() {
	now := time.Now()
	for k, v := range s.sessions {
		if now.After(v) {
			delete(s.sessions, k)
		}
	}
}
