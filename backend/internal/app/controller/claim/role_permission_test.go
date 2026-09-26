package claim

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"backend/internal/app/enum"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// สิทธิ์ตามบทบาทของโมดูลเคลมและคืนสินค้า
//
// บทบาท MANAGER ถูกเพิ่มเข้าระบบทีหลัง แต่เงื่อนไขในโมดูลนี้ไม่ได้อัปเดตตาม ทำให้ผู้จัดการร้าน
// ใช้งานหน้าเคลมไม่ได้เลยทั้งที่เมนูฝั่งหน้าจอเปิดให้เข้าถึง ชุดทดสอบนี้ล็อกกฎไว้ไม่ให้หลุดอีก
//
// กฎที่ตกลงไว้:
//   - อนุมัติ / ปฏิเสธ / ยกเลิกใบเคลม : เจ้าของและผู้จัดการ
//   - สร้าง / แก้ไขใบเคลม             : ทุกบทบาทในร้าน (พนักงานตั้งได้เฉพาะสถานะ PENDING)
//   - ลบใบเคลมและใบคืน                : เจ้าของกับผู้จัดการลบได้เสมอ พนักงานลบได้เฉพาะใบที่ยังไม่พิจารณา
//   - คืนเงิน                          : ทุกบทบาท แต่ใบต้องถูกอนุมัติมาก่อนเสมอ (maker-checker)

func roleContext(role string) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	if role != "" {
		c.Set("role", role)
	}
	return c, rec
}

func TestClaimRoles_ManagerCountsAsStoreStaff(t *testing.T) {
	for _, role := range []string{"Owner", "Manager", "Employee", "OWNER", "MANAGER", "EMPLOYEE"} {
		t.Run(role, func(t *testing.T) {
			c, _ := roleContext(role)
			require.Truef(t, requireClaimStaff(c), "%s ต้องนับเป็นพนักงานร้าน", role)
		})
	}
}

func TestClaimRoles_OutsiderRejected(t *testing.T) {
	for _, role := range []string{"", "CUSTOMER", "GUEST"} {
		c, _ := roleContext(role)
		require.Falsef(t, requireClaimStaff(c), "%q ต้องไม่ผ่าน", role)
	}
}

func TestClaimRoles_ApproveAndCancel_OwnerAndManagerOnly(t *testing.T) {
	for role, want := range map[string]bool{
		"Owner": true, "Manager": true, "ADMIN": true, "Employee": false, "": false,
	} {
		t.Run(role, func(t *testing.T) {
			c, _ := roleContext(role)
			require.Equalf(t, want, isOwnerOrManager(c),
				"สิทธิ์อนุมัติ/ยกเลิกใบเคลมของ %q ไม่ตรงกับที่ตกลงไว้", role)
		})
	}
}

func TestClaimRoles_EmployeeCannotSetApprovedStatus(t *testing.T) {
	c, rec := roleContext("Employee")
	status := "APPROVED"
	require.False(t, prepareClaimStatus(c, &status, true))
	require.Equal(t, http.StatusForbidden, rec.Code)

	c2, _ := roleContext("Employee")
	pending := "PENDING"
	require.True(t, prepareClaimStatus(c2, &pending, true))
}

func TestClaimRoles_ManagerCanSetApprovedStatus(t *testing.T) {
	c, _ := roleContext("Manager")
	status := "APPROVED"
	require.True(t, prepareClaimStatus(c, &status, true),
		"ผู้จัดการต้องอนุมัติใบเคลมได้ตามที่ตกลงไว้")
}

func TestClaimRoles_PendingStatusHelper(t *testing.T) {
	// ค่าว่างถือเป็นรอพิจารณา เพราะใบเก่าบางใบไม่ได้บันทึกสถานะไว้
	for _, s := range []string{"", "PENDING", " pending ", "Pending"} {
		require.Truef(t, isPendingClaimStatus(s), "%q ต้องนับเป็นรอพิจารณา", s)
	}
	for _, s := range []string{"APPROVED", "REJECTED", "CANCELLED"} {
		require.Falsef(t, isPendingClaimStatus(s), "%q ต้องไม่นับเป็นรอพิจารณา", s)
	}
}

func TestReturnStatus_PendingIsTheOnlyEmployeeDeletableState(t *testing.T) {
	require.Equal(t, "PENDING", string(enum.ReturnPending))
	for _, s := range []enum.ReturnStatus{enum.ReturnApproved, enum.ReturnRejected, enum.ReturnRefunded} {
		require.NotEqual(t, enum.ReturnPending, s)
	}
}
