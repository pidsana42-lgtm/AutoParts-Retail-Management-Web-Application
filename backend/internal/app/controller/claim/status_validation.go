package claim

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func requireClaimStaff(c *gin.Context) bool {
	switch getRoleFromContext(c) {
	// MANAGER เคยตกหล่นจากรายการนี้ ทำให้ผู้จัดการร้านสร้าง แก้ไข หรือลบใบเคลมไม่ได้เลย
	// ทั้งที่เมนูฝั่งหน้าจอเปิดให้เข้าถึงหน้าเคลมได้ปกติ
	case "OWNER", "ADMIN", "MANAGER", "EMPLOYEE":
		return true
	default:
		c.JSON(http.StatusForbidden, gin.H{"error": "only store staff can change customer claims"})
		return false
	}
}

// Employee forms may echo PENDING when saving details. Ignore that echo on
// updates so it cannot reset a decision made since the form was opened.
func prepareClaimStatus(c *gin.Context, status *string, creating bool) bool {
	if !requireClaimStaff(c) {
		return false
	}
	if *status == "" {
		return true
	}
	*status = strings.ToUpper(strings.TrimSpace(*status))
	switch *status {
	case "PENDING", "APPROVED", "REJECTED":
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid customer claim status"})
		return false
	}
	if !isOwnerOrManager(c) {
		if *status != "PENDING" {
			c.JSON(http.StatusForbidden, gin.H{"error": "only the store owner or manager can approve or reject a claim"})
			return false
		}
		if !creating {
			*status = ""
		}
	}
	return true
}

// isPendingClaimStatus: ใบเคลมยังไม่ผ่านการพิจารณา (ค่าว่างถือเป็นรอพิจารณา เพราะใบเก่า
// บางใบไม่ได้บันทึกสถานะไว้) ใช้ตัดสินว่าพนักงานลบใบนี้เองได้หรือไม่
func isPendingClaimStatus(status string) bool {
	normalized := strings.ToUpper(strings.TrimSpace(status))
	return normalized == "" || normalized == "PENDING"
}
