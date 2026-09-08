package preorder

import (
	"testing"

	"backend/internal/app/entity"
	preOrderRepo "backend/internal/app/repository/pre_oder"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// -----------------------------------------------------------------------------
// ทดสอบ FindOrCreateCustomerByName ตรงๆ ผ่าน sqlite in-memory (ไม่ mock repo)
// เพราะเป็น logic ที่คุยกับตาราง customers/customer_types โดยตรง
// -----------------------------------------------------------------------------

func setupPreOrderRepoTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	err = db.AutoMigrate(
		&entity.CustomerType{},
		&entity.Customer{},
	)
	require.NoError(t, err)

	// เหมือน seed จริง: ระบบต้องมีประเภทลูกค้า GENERAL อยู่ก่อนเสมอ
	require.NoError(t, db.Create(&entity.CustomerType{TypeName: "GENERAL", TypeLabel: "ลูกค้าทั่วไป"}).Error)

	return db
}

func TestFindOrCreateCustomerByName_CreatesNewCustomerWithPhone(t *testing.T) {
	db := setupPreOrderRepoTestDB(t)
	repo := preOrderRepo.NewPreOrderRepository(db)

	id, err := repo.FindOrCreateCustomerByName("สมชาย ใจดี", "0812345678")
	require.NoError(t, err)
	require.NotZero(t, id)

	var customer entity.Customer
	require.NoError(t, db.First(&customer, id).Error)
	require.Equal(t, "สมชาย ใจดี", customer.CustomerName)
	require.Equal(t, "0812345678", customer.PhoneNumber)
	require.Equal(t, float64(0), customer.CreditLimit)

	var generalType entity.CustomerType
	require.NoError(t, db.Where("type_name = ?", "GENERAL").First(&generalType).Error)
	require.Equal(t, generalType.ID, customer.CustomerTypeID, "ลูกค้าใหม่ต้องผูกกับประเภท GENERAL โดย default")
}

func TestFindOrCreateCustomerByName_ReusesExistingCustomerByPhone(t *testing.T) {
	db := setupPreOrderRepoTestDB(t)
	repo := preOrderRepo.NewPreOrderRepository(db)

	firstID, err := repo.FindOrCreateCustomerByName("สมชาย ใจดี", "0812345678")
	require.NoError(t, err)

	// ชื่อพิมพ์คนละแบบ แต่เบอร์เดิม -> ต้อง match ลูกค้าเดิม ไม่สร้างซ้ำ
	secondID, err := repo.FindOrCreateCustomerByName("สมชาย", "0812345678")
	require.NoError(t, err)

	require.Equal(t, firstID, secondID)

	var count int64
	require.NoError(t, db.Model(&entity.Customer{}).Count(&count).Error)
	require.Equal(t, int64(1), count, "ห้ามสร้างลูกค้าซ้ำเมื่อเบอร์โทรตรงกับที่มีอยู่แล้ว")
}

func TestFindOrCreateCustomerByName_ReusesExistingCustomerByName(t *testing.T) {
	db := setupPreOrderRepoTestDB(t)
	repo := preOrderRepo.NewPreOrderRepository(db)

	firstID, err := repo.FindOrCreateCustomerByName("สมหญิง รักดี", "")
	require.NoError(t, err)

	// ไม่มีเบอร์ทั้งคู่ แต่ชื่อตรงกัน (ไม่สนตัวพิมพ์เล็ก/ใหญ่ และช่องว่างหน้า-หลัง) -> ต้อง match
	secondID, err := repo.FindOrCreateCustomerByName("  สมหญิง รักดี  ", "")
	require.NoError(t, err)

	require.Equal(t, firstID, secondID)
}

func TestFindOrCreateCustomerByName_MultipleBlankPhonesDoNotCollide(t *testing.T) {
	db := setupPreOrderRepoTestDB(t)
	repo := preOrderRepo.NewPreOrderRepository(db)

	// ลูกค้าคนที่ 1 ไม่มีเบอร์
	id1, err := repo.FindOrCreateCustomerByName("ลูกค้า เอ", "")
	require.NoError(t, err)

	// ลูกค้าคนที่ 2 ชื่อไม่ซ้ำ ก็ไม่มีเบอร์เหมือนกัน -> ต้องสร้างสำเร็จ ไม่ชนกับ unique constraint ของเบอร์โทรที่ว่างเหมือนกัน
	id2, err := repo.FindOrCreateCustomerByName("ลูกค้า บี", "")
	require.NoError(t, err)

	require.NotEqual(t, id1, id2)

	var count int64
	require.NoError(t, db.Model(&entity.Customer{}).Count(&count).Error)
	require.Equal(t, int64(2), count)
}

// การกันชื่อว่างเป็นหน้าที่ของ service layer (ดู pre_oder_service.go: CreatePreOrder/UpdatePreOrder
// เช็ค strings.TrimSpace(input.CustomerName) == "" ก่อนเรียก repo) — repository ชั้นนี้ไม่ validate เอง
func TestFindOrCreateCustomerByName_DoesNotValidateNameItself(t *testing.T) {
	db := setupPreOrderRepoTestDB(t)
	repo := preOrderRepo.NewPreOrderRepository(db)

	id, err := repo.FindOrCreateCustomerByName("   ", "")
	require.NoError(t, err)
	require.NotZero(t, id)
}
