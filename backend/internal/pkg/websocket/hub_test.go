package websocket

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	gorillaws "github.com/gorilla/websocket"
)

const hubTestSecret = "websocket-hub-tests-only-not-a-production-secret"

func hubTestToken(t *testing.T, userID uint, role string) string {
	t.Helper()
	claims := jwt.MapClaims{"user_id": userID, "role": role, "exp": time.Now().Add(time.Hour).Unix()}
	tok, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(hubTestSecret))
	if err != nil {
		t.Fatal(err)
	}
	return tok
}

// hubTestOnce: InitHub() reassigns the package-level GlobalHub var, which isn't safe to do while a
// previous test's connection goroutines may still be finishing their unregister — real usage (main.go)
// only ever calls it once at startup, so tests do the same instead of once per test.
var hubTestOnce sync.Once

func newHubTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	t.Setenv("JWT_SECRET", hubTestSecret)
	hubTestOnce.Do(InitHub)
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/ws", ServeWS)
	server := httptest.NewServer(r)
	t.Cleanup(server.Close)
	return server
}

func wsURL(server *httptest.Server, query string) string {
	u := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws"
	if query != "" {
		u += "?" + query
	}
	return u
}

// TestServeWS_RejectsMissingToken: ต่อ websocket โดยไม่ส่ง token มาเลยต้องถูกปฏิเสธ (401) ไม่ใช่ upgrade ให้เฉยๆ
func TestServeWS_RejectsMissingToken(t *testing.T) {
	server := newHubTestServer(t)
	_, resp, err := gorillaws.DefaultDialer.Dial(wsURL(server, ""), nil)
	if err == nil {
		t.Fatal("expected the handshake to fail without a token")
	}
	if resp == nil || resp.StatusCode != http.StatusUnauthorized {
		status := 0
		if resp != nil {
			status = resp.StatusCode
		}
		t.Fatalf("status = %d, want 401", status)
	}
}

// TestServeWS_RejectsInvalidToken: token ที่ลงชื่อด้วย secret ผิด (หรือปลอม) ต้องถูกปฏิเสธ
func TestServeWS_RejectsInvalidToken(t *testing.T) {
	server := newHubTestServer(t)
	fake, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": 1, "role": "OWNER", "exp": time.Now().Add(time.Hour).Unix(),
	}).SignedString([]byte("wrong-secret"))

	_, resp, err := gorillaws.DefaultDialer.Dial(wsURL(server, "token="+fake), nil)
	if err == nil {
		t.Fatal("expected the handshake to fail with a wrongly-signed token")
	}
	if resp == nil || resp.StatusCode != http.StatusUnauthorized {
		status := 0
		if resp != nil {
			status = resp.StatusCode
		}
		t.Fatalf("status = %d, want 401", status)
	}
}

// TestServeWS_ClientSuppliedRoleAndUserIDAreIgnored: regression test for the actual vulnerability —
// a connection used to be trusted for whatever role/user_id it claimed via query string, with zero
// verification. Here a real EMPLOYEE token is presented, but the attacker also tacks on
// ?role=Owner&user_id=999 hoping the server trusts it. It must not: the connection is registered
// under the token's real identity (employee, user 5), so an owner-only broadcast never reaches it,
// while a broadcast addressed to the token's real user does.
func TestServeWS_ClientSuppliedRoleAndUserIDAreIgnored(t *testing.T) {
	server := newHubTestServer(t)
	token := hubTestToken(t, 5, "Employee")

	conn, resp, err := gorillaws.DefaultDialer.Dial(
		wsURL(server, "token="+token+"&role=Owner&user_id=999"), nil,
	)
	if err != nil {
		t.Fatalf("expected the handshake to succeed with a valid token, got err=%v resp=%v", err, resp)
	}
	defer conn.Close()
	messages := startReader(conn)
	waitForRegistration(t)

	NotifyOwners(1, "owner only", "should not reach the forged connection", "info", "")
	expectNoMessage(t, messages, "an EMPLOYEE token forging ?role=Owner must not receive an owner-only broadcast")

	NotifyUser(999, 3, "for user 999", "the forged user_id must not receive this", "info", "")
	expectNoMessage(t, messages, "a broadcast addressed to the forged user_id=999 must not reach user_id=5's connection")

	NotifyUser(5, 2, "for user 5", "the token's real user_id", "info", "")
	expectMessageContains(t, messages, "for user 5")
}

// TestServeWS_AcceptsValidOwnerToken: sanity check that a genuinely valid token still works end to end.
func TestServeWS_AcceptsValidOwnerToken(t *testing.T) {
	server := newHubTestServer(t)
	token := hubTestToken(t, 1, "Owner")

	conn, _, err := gorillaws.DefaultDialer.Dial(wsURL(server, "token="+token), nil)
	if err != nil {
		t.Fatalf("expected the handshake to succeed with a valid token: %v", err)
	}
	defer conn.Close()
	messages := startReader(conn)
	waitForRegistration(t)

	NotifyOwners(1, "owner broadcast", "hello owner", "info", "")
	expectMessageContains(t, messages, "hello owner")
}

func waitForRegistration(t *testing.T) {
	t.Helper()
	time.Sleep(100 * time.Millisecond) // give the hub's register channel a moment to process
}

// startReader keeps a single ReadMessage loop running for the life of the connection and forwards
// every payload onto a channel — avoids the flakiness of calling ReadMessage with a fresh deadline
// after a previous read already timed out on the same *gorillaws.Conn.
func startReader(conn *gorillaws.Conn) <-chan string {
	out := make(chan string, 8)
	go func() {
		defer close(out)
		for {
			_, data, err := conn.ReadMessage()
			if err != nil {
				return
			}
			out <- string(data)
		}
	}()
	return out
}

func expectMessageContains(t *testing.T, messages <-chan string, want string) {
	t.Helper()
	select {
	case data, ok := <-messages:
		if !ok {
			t.Fatalf("connection closed while expecting a message containing %q", want)
		}
		if !strings.Contains(data, want) {
			t.Fatalf("message = %s, want it to contain %q", data, want)
		}
	case <-time.After(2 * time.Second):
		t.Fatalf("timed out waiting for a message containing %q", want)
	}
}

func expectNoMessage(t *testing.T, messages <-chan string, reason string) {
	t.Helper()
	select {
	case data, ok := <-messages:
		if ok {
			t.Fatalf("%s, but received: %s", reason, data)
		}
	case <-time.After(300 * time.Millisecond):
		// no message arrived, as expected
	}
}
