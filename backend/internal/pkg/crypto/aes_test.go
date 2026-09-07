package crypto

import (
	"testing"
)

func TestAES256EncryptDecrypt(t *testing.T) {
	plain := "1103702456789"
	enc, err := EncryptAES256(plain)
	if err != nil {
		t.Fatalf("EncryptAES256 failed: %v", err)
	}
	if !IsEncrypted(enc) {
		t.Fatalf("Expected encrypted string to start with prefix, got %s", enc)
	}

	// Test determinism (same plain text must yield same ciphertext)
	enc2, err := EncryptAES256(plain)
	if err != nil {
		t.Fatalf("EncryptAES256 2nd call failed: %v", err)
	}
	if enc != enc2 {
		t.Fatalf("Expected deterministic encryption, got %s vs %s", enc, enc2)
	}

	// Test Decrypt
	decrypted, err := DecryptAES256(enc)
	if err != nil {
		t.Fatalf("DecryptAES256 failed: %v", err)
	}
	if decrypted != plain {
		t.Fatalf("Expected %s, got %s", plain, decrypted)
	}

	// Test legacy plain text decryption (backward compatibility)
	legacyPlain := "1234567890123"
	decLegacy, err := DecryptAES256(legacyPlain)
	if err != nil {
		t.Fatalf("DecryptAES256 legacy failed: %v", err)
	}
	if decLegacy != legacyPlain {
		t.Fatalf("Expected legacy string %s, got %s", legacyPlain, decLegacy)
	}

	// Test empty string
	encEmpty, _ := EncryptAES256("")
	if encEmpty != "" {
		t.Fatalf("Expected empty, got %s", encEmpty)
	}
	decEmpty, _ := DecryptAES256("")
	if decEmpty != "" {
		t.Fatalf("Expected empty, got %s", decEmpty)
	}
}
