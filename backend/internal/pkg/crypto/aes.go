package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"os"
	"strings"
)

const (
	PrefixV1       = "enc:v1:"
	FallbackSecret = "autoparts-management-aes-secret-key-32b"
)

// getEncryptionKey returns a 32-byte key derived via SHA-256
func getEncryptionKey() []byte {
	secret := os.Getenv("AES_ENCRYPTION_KEY")
	if secret == "" {
		secret = os.Getenv("ENCRYPTION_KEY")
	}
	if secret == "" {
		secret = os.Getenv("JWT_SECRET")
	}
	if secret == "" {
		secret = FallbackSecret
	}
	hash := sha256.Sum256([]byte(secret))
	return hash[:]
}

// IsEncrypted checks if a given string has the encryption prefix
func IsEncrypted(val string) bool {
	return strings.HasPrefix(val, PrefixV1)
}

// EncryptAES256 encrypts plaintext using AES-256-GCM.
// It uses a deterministic nonce derived from HMAC-SHA256(key, plaintext)[:12]
// so that identical plaintexts produce identical ciphertexts, allowing
// SQL WHERE queries and UNIQUE database indexes to function seamlessly.
func EncryptAES256(plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}
	// If already encrypted, return as is
	if IsEncrypted(plaintext) {
		return plaintext, nil
	}

	key := getEncryptionKey()
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	// Deterministic nonce generation (12 bytes for GCM)
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(plaintext))
	nonce := mac.Sum(nil)[:gcm.NonceSize()]

	// Encrypt & tag
	ciphertext := gcm.Seal(nil, nonce, []byte(plaintext), nil)

	// Combine nonce + ciphertext
	payload := append(nonce, ciphertext...)
	encoded := base64.RawURLEncoding.EncodeToString(payload)

	return PrefixV1 + encoded, nil
}

// DecryptAES256 decrypts an enc:v1: ciphertext using AES-256-GCM.
// If the input is not encrypted (e.g. legacy plain text), it returns the input unchanged.
func DecryptAES256(ciphertext string) (string, error) {
	if ciphertext == "" {
		return "", nil
	}
	// If not encrypted, return as is (backwards compatible with plain text in DB)
	if !IsEncrypted(ciphertext) {
		return ciphertext, nil
	}

	key := getEncryptionKey()
	block, err := aes.NewCipher(key)
	if err != nil {
		return ciphertext, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return ciphertext, err
	}

	rawPayload := strings.TrimPrefix(ciphertext, PrefixV1)
	payload, err := base64.RawURLEncoding.DecodeString(rawPayload)
	if err != nil {
		return ciphertext, err
	}

	nonceSize := gcm.NonceSize()
	if len(payload) < nonceSize {
		return ciphertext, errors.New("invalid ciphertext length")
	}

	nonce := payload[:nonceSize]
	data := payload[nonceSize:]

	plainBytes, err := gcm.Open(nil, nonce, data, nil)
	if err != nil {
		return ciphertext, err
	}

	return string(plainBytes), nil
}
