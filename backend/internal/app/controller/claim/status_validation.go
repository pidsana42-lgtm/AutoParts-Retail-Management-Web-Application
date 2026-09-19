package claim

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func requireClaimStaff(c *gin.Context) bool {
	switch getRoleFromContext(c) {
	case "OWNER", "ADMIN", "EMPLOYEE":
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
	if !isOwnerOrAdmin(c) {
		if *status != "PENDING" {
			c.JSON(http.StatusForbidden, gin.H{"error": "only the store owner can approve or reject a claim"})
			return false
		}
		if !creating {
			*status = ""
		}
	}
	return true
}
