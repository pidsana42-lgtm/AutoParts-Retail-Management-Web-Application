package config  
import (
   "os"
   "strconv"
   "golang.org/x/crypto/bcrypt"
)
// hashPassword เป็น function สำหรับการแปลง password
func HashPassword(password string) (string, error) {
   bytes, err := bcrypt.GenerateFromPassword([]byte(password), 14)
   return string(bytes), err
}
// checkPasswordHash เป็น function สำหรับ check password ที่ hash แล้ว ว่าตรงกันหรือไม่
func CheckPasswordHash(password, hash []byte) bool {
   err := bcrypt.CompareHashAndPassword(hash, password)
   return err == nil
}

// GetEnvInt อ่านค่า env เป็น int ถ้าไม่มีหรือแปลงไม่ได้ ใช้ค่า default แทน
func GetEnvInt(key string, defaultVal int) int {
	val := os.Getenv(key)
	if val == "" {
		return defaultVal
	}
	n, err := strconv.Atoi(val)
	if err != nil {
		return defaultVal
	}
	return n
}