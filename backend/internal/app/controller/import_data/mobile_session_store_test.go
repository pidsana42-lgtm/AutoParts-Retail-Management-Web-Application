package import_data

import (
	"testing"
	"time"
)

// TestMobileSessionStore_CreateThenValid: session ที่เพิ่งสร้างต้อง valid ทันที และไม่ใช่ค่าว่าง/เดาง่าย
func TestMobileSessionStore_CreateThenValid(t *testing.T) {
	store := &mobileSessionStore{sessions: make(map[string]time.Time)}

	session, expiresAt := store.create()
	if session == "" {
		t.Fatal("expected a non-empty session id")
	}
	if len(session) < 16 {
		t.Errorf("expected a long, hard-to-guess session id, got %q (len %d)", session, len(session))
	}
	if !expiresAt.After(time.Now()) {
		t.Error("expected expiresAt to be in the future")
	}
	if !store.valid(session) {
		t.Error("a freshly created session must be valid")
	}
}

// TestMobileSessionStore_UnknownSessionIsInvalid: session ที่ไม่เคยถูกสร้างจริง (แค่หน้าตาถูกต้อง) ต้องไม่ผ่าน
// — นี่คือช่องโหว่ที่แก้: เดิมมีแค่การเช็ครูปแบบตัวอักษร (regex) ไม่เช็คว่า session ถูกสร้างขึ้นจริงหรือไม่
func TestMobileSessionStore_UnknownSessionIsInvalid(t *testing.T) {
	store := &mobileSessionStore{sessions: make(map[string]time.Time)}
	if store.valid("guessed-session-id-12345") {
		t.Error("a session that was never created by the store must not be valid")
	}
}

// TestMobileSessionStore_ExpiredSessionIsInvalid: session ที่หมดอายุแล้วต้องใช้ไม่ได้อีก และถูกลบออกจาก store
func TestMobileSessionStore_ExpiredSessionIsInvalid(t *testing.T) {
	store := &mobileSessionStore{sessions: make(map[string]time.Time)}
	session, _ := store.create()
	store.sessions[session] = time.Now().Add(-1 * time.Minute) // จำลองว่าหมดอายุไปแล้ว

	if store.valid(session) {
		t.Error("an expired session must not be valid")
	}
	if _, stillThere := store.sessions[session]; stillThere {
		t.Error("an expired session should be purged from the store once checked")
	}
}

// TestMobileSessionStore_DeleteInvalidatesSession: หลังลบ (เช่น desktop กด 'เสร็จแล้ว') session ต้องใช้ไม่ได้อีก
func TestMobileSessionStore_DeleteInvalidatesSession(t *testing.T) {
	store := &mobileSessionStore{sessions: make(map[string]time.Time)}
	session, _ := store.create()
	store.delete(session)

	if store.valid(session) {
		t.Error("a deleted session must not be valid")
	}
}

// TestMobileSessionStore_EachSessionIsUnique: สุ่มหลายครั้งต้องไม่ซ้ำกัน (สุขภาพของตัวสุ่ม)
func TestMobileSessionStore_EachSessionIsUnique(t *testing.T) {
	store := &mobileSessionStore{sessions: make(map[string]time.Time)}
	seen := make(map[string]bool)
	for i := 0; i < 100; i++ {
		session, _ := store.create()
		if seen[session] {
			t.Fatalf("duplicate session id generated: %s", session)
		}
		seen[session] = true
	}
}
