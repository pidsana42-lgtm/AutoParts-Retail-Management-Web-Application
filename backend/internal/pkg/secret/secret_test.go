package secret

import (
	"os"
	"os/exec"
	"testing"
)

// TestRequired_ReturnsValueWhenSet: กรณีปกติ ตั้งค่าไว้แล้วต้องได้ค่ากลับมาตรงๆ ไม่หยุดโปรแกรม
func TestRequired_ReturnsValueWhenSet(t *testing.T) {
	t.Setenv("SECRET_TEST_VAR", "some-value")
	if got := Required("SECRET_TEST_VAR"); got != "some-value" {
		t.Errorf("Required() = %q, want %q", got, "some-value")
	}
}

// TestRequired_ExitsWhenUnset: กรณีไม่ได้ตั้งค่าไว้ ต้องหยุดโปรแกรมทันที (ไม่ใช่คืนค่า default ที่ฝังใน
// ซอร์สโค้ดแล้วรันต่อเงียบๆ) — รันเป็น subprocess เพราะ log.Fatal เรียก os.Exit ซึ่งจะฆ่า test process จริง
// ถ้าเรียกตรงๆ ในเทสเดียวกัน
func TestRequired_ExitsWhenUnset(t *testing.T) {
	if os.Getenv("SECRET_TEST_SUBPROCESS") == "1" {
		Required("SECRET_TEST_MISSING_VAR")
		return
	}
	cmd := exec.Command(os.Args[0], "-test.run=TestRequired_ExitsWhenUnset")
	cmd.Env = append(os.Environ(), "SECRET_TEST_SUBPROCESS=1")
	err := cmd.Run()
	if err == nil {
		t.Fatal("expected the process to exit with a non-zero status when the env var is unset")
	}
	if exitErr, ok := err.(*exec.ExitError); !ok || exitErr.Success() {
		t.Fatalf("expected a failing exit, got: %v", err)
	}
}
