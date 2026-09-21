package claim

import (
	"testing"

	"backend/internal/app/entity"
	claimRepo "backend/internal/app/repository/claim"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func setupClaimDeleteTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&entity.CustomerClaim{},
		&entity.CustomerClaimItem{},
		&entity.SaleOrder{},
	))
	return db
}

// TestDeleteCustomerClaim_BlocksWhenStockAlreadyAdjusted: ห้ามลบใบเคลมที่มีรายการซึ่งตัด/เติมสต็อกจริงไปแล้ว
// (StockOutIssued/StockInReceived) เพราะการลบจะทำให้ผลที่เกิดกับสต็อกจริงกลายเป็นไม่มีหลักฐานอธิบายที่มา
func TestDeleteCustomerClaim_BlocksWhenStockAlreadyAdjusted(t *testing.T) {
	db := setupClaimDeleteTestDB(t)
	repo := claimRepo.NewCustomerClaimRepository(db)

	order := entity.SaleOrder{OrderNumber: "SO-DEL-1", CreatedByID: 1, TotalAmount: 100}
	require.NoError(t, db.Create(&order).Error)
	claim := entity.CustomerClaim{OriginalOrderID: order.ID, ClaimNo: "CLM-DEL-1", Status: "APPROVED", CreatedBy: 1}
	require.NoError(t, db.Create(&claim).Error)
	require.NoError(t, db.Create(&entity.CustomerClaimItem{
		CustomerClaimID: claim.ID, ProductID: 1, Qty: 1, ClaimType: "INSTANT", Status: "APPROVED", StockOutIssued: true,
	}).Error)

	err := repo.DeleteCustomerClaim(claim.ID)
	require.ErrorIs(t, err, claimRepo.ErrClaimAlreadyAdjusted)

	var stillThere entity.CustomerClaim
	require.NoError(t, db.First(&stillThere, claim.ID).Error, "ใบเคลมต้องยังอยู่ ไม่ถูกลบไป")
}

// TestDeleteCustomerClaim_BlocksWhenCreditAlreadyApplied: ห้ามลบใบเคลมที่หักหนี้บัญชีเชื่อของลูกค้าไปแล้วจริง
func TestDeleteCustomerClaim_BlocksWhenCreditAlreadyApplied(t *testing.T) {
	db := setupClaimDeleteTestDB(t)
	repo := claimRepo.NewCustomerClaimRepository(db)

	order := entity.SaleOrder{OrderNumber: "SO-DEL-2", CreatedByID: 1, TotalAmount: 100}
	require.NoError(t, db.Create(&order).Error)
	claim := entity.CustomerClaim{OriginalOrderID: order.ID, ClaimNo: "CLM-DEL-2", Status: "APPROVED", CreatedBy: 1}
	require.NoError(t, db.Create(&claim).Error)
	require.NoError(t, db.Create(&entity.CustomerClaimItem{
		CustomerClaimID: claim.ID, ProductID: 1, Qty: 1, ClaimType: "CREDIT_ACCOUNT", Status: "APPROVED", CreditApplied: true,
	}).Error)

	err := repo.DeleteCustomerClaim(claim.ID)
	require.ErrorIs(t, err, claimRepo.ErrClaimAlreadyAdjusted)
}

// TestDeleteCustomerClaim_AllowsWhenNothingAdjustedYet: ลบใบเคลมที่ยังไม่มีการตัดสต็อก/หักหนี้ใดๆ ได้ตามปกติ
func TestDeleteCustomerClaim_AllowsWhenNothingAdjustedYet(t *testing.T) {
	db := setupClaimDeleteTestDB(t)
	repo := claimRepo.NewCustomerClaimRepository(db)

	order := entity.SaleOrder{OrderNumber: "SO-DEL-3", CreatedByID: 1, TotalAmount: 100}
	require.NoError(t, db.Create(&order).Error)
	claim := entity.CustomerClaim{OriginalOrderID: order.ID, ClaimNo: "CLM-DEL-3", Status: "PENDING", CreatedBy: 1}
	require.NoError(t, db.Create(&claim).Error)
	require.NoError(t, db.Create(&entity.CustomerClaimItem{
		CustomerClaimID: claim.ID, ProductID: 1, Qty: 1, ClaimType: "INSTANT", Status: "Pending",
	}).Error)

	require.NoError(t, repo.DeleteCustomerClaim(claim.ID))

	var deleted entity.CustomerClaim
	err := db.First(&deleted, claim.ID).Error
	require.ErrorIs(t, err, gorm.ErrRecordNotFound, "ต้องลบสำเร็จ (soft delete) เมื่อยังไม่มีอะไรถูกปรับ")
}

// TestDeleteCustomerClaim_BlocksWhenAlreadyCancelled: ห้ามลบใบเคลมที่ถูกยกเลิกไปแล้ว ต้องเก็บไว้เป็นประวัติ
func TestDeleteCustomerClaim_BlocksWhenAlreadyCancelled(t *testing.T) {
	db := setupClaimDeleteTestDB(t)
	repo := claimRepo.NewCustomerClaimRepository(db)

	order := entity.SaleOrder{OrderNumber: "SO-DEL-4", CreatedByID: 1, TotalAmount: 100}
	require.NoError(t, db.Create(&order).Error)
	claim := entity.CustomerClaim{OriginalOrderID: order.ID, ClaimNo: "CLM-DEL-4", Status: "CANCELLED", CreatedBy: 1}
	require.NoError(t, db.Create(&claim).Error)

	err := repo.DeleteCustomerClaim(claim.ID)
	require.ErrorIs(t, err, claimRepo.ErrClaimAlreadyCancelled)
}

// TestCancelCustomerClaim_ApprovedInstant_ResetsFlagsAndReturnsPreCancelItems: ยกเลิกใบเคลมที่อนุมัติแล้ว
// ต้องเปลี่ยนสถานะเป็น CANCELLED ทั้งหัวบิล/รายการ รีเซ็ต flag ทั้งหมดเป็น false และคืนรายการ "ก่อนรีเซ็ต"
// (ที่ยัง flag เป็น true อยู่) กลับไปให้ service ใช้คำนวณว่าต้องคืนสต็อก/หนี้เท่าไหร่
func TestCancelCustomerClaim_ApprovedInstant_ResetsFlagsAndReturnsPreCancelItems(t *testing.T) {
	db := setupClaimDeleteTestDB(t)
	repo := claimRepo.NewCustomerClaimRepository(db)

	order := entity.SaleOrder{OrderNumber: "SO-CANCEL-1", CreatedByID: 1, TotalAmount: 100}
	require.NoError(t, db.Create(&order).Error)
	claim := entity.CustomerClaim{OriginalOrderID: order.ID, ClaimNo: "CLM-CANCEL-1", Status: "APPROVED", CreatedBy: 1}
	require.NoError(t, db.Create(&claim).Error)
	item := entity.CustomerClaimItem{
		CustomerClaimID: claim.ID, ProductID: 1, Qty: 2, ClaimType: "INSTANT", Status: "APPROVED", StockOutIssued: true,
	}
	require.NoError(t, db.Create(&item).Error)

	itemsBefore, err := repo.CancelCustomerClaim(claim.ID)
	require.NoError(t, err)
	require.Len(t, itemsBefore, 1)
	require.True(t, itemsBefore[0].StockOutIssued, "ค่าที่คืนกลับมาต้องเป็นสถานะ 'ก่อน' รีเซ็ต เพื่อให้ service รู้ว่าต้องคืนสต็อก")

	var persistedClaim entity.CustomerClaim
	require.NoError(t, db.First(&persistedClaim, claim.ID).Error)
	require.Equal(t, "CANCELLED", persistedClaim.Status)

	var persistedItem entity.CustomerClaimItem
	require.NoError(t, db.First(&persistedItem, item.ID).Error)
	require.Equal(t, "CANCELLED", persistedItem.Status)
	require.False(t, persistedItem.StockOutIssued, "flag ในฐานข้อมูลต้องถูกรีเซ็ตเป็น false หลังยกเลิก")
}

// TestCancelCustomerClaim_BlocksWhenNotApproved: ยกเลิกได้เฉพาะใบเคลมที่อนุมัติแล้วเท่านั้น
func TestCancelCustomerClaim_BlocksWhenNotApproved(t *testing.T) {
	db := setupClaimDeleteTestDB(t)
	repo := claimRepo.NewCustomerClaimRepository(db)

	order := entity.SaleOrder{OrderNumber: "SO-CANCEL-2", CreatedByID: 1, TotalAmount: 100}
	require.NoError(t, db.Create(&order).Error)
	claim := entity.CustomerClaim{OriginalOrderID: order.ID, ClaimNo: "CLM-CANCEL-2", Status: "PENDING", CreatedBy: 1}
	require.NoError(t, db.Create(&claim).Error)

	_, err := repo.CancelCustomerClaim(claim.ID)
	require.ErrorIs(t, err, claimRepo.ErrClaimNotApproved)
}

// TestCancelCustomerClaim_BlocksWhenAlreadyCancelled: กันยกเลิกซ้ำ
func TestCancelCustomerClaim_BlocksWhenAlreadyCancelled(t *testing.T) {
	db := setupClaimDeleteTestDB(t)
	repo := claimRepo.NewCustomerClaimRepository(db)

	order := entity.SaleOrder{OrderNumber: "SO-CANCEL-3", CreatedByID: 1, TotalAmount: 100}
	require.NoError(t, db.Create(&order).Error)
	claim := entity.CustomerClaim{OriginalOrderID: order.ID, ClaimNo: "CLM-CANCEL-3", Status: "CANCELLED", CreatedBy: 1}
	require.NoError(t, db.Create(&claim).Error)

	_, err := repo.CancelCustomerClaim(claim.ID)
	require.ErrorIs(t, err, claimRepo.ErrClaimAlreadyCancelled)
}
