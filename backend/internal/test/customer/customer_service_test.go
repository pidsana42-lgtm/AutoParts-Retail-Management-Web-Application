package customer_test

import (
	"testing"

	customerDto "backend/internal/app/dto/customer"
	"backend/internal/app/entity"
	customerRepo "backend/internal/app/repository/customer"
	customerService "backend/internal/app/service/customer"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func setupCustomerTestDB(t *testing.T) (*gorm.DB, customerService.CustomerService) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	err = db.AutoMigrate(
		&entity.CustomerType{},
		&entity.Customer{},
		&entity.CustomerCreditAuditLog{},
		&entity.StoreConfig{},
		&entity.User{},
	)
	require.NoError(t, err)

	types := []entity.CustomerType{
		{TypeName: "GENERAL", TypeLabel: "ลูกค้าทั่วไป"},
		{TypeName: "GARAGE", TypeLabel: "ลูกค้าอู่ซ่อมรถ"},
	}
	for i := range types {
		err := db.Create(&types[i]).Error
		require.NoError(t, err)
	}

	repo := customerRepo.NewCustomerRepository(db)
	svc := customerService.NewCustomerService(repo, db)
	return db, svc
}

func TestRegisterNewCustomer_Success_WithImage(t *testing.T) {
	_, svc := setupCustomerTestDB(t)

	req := customerDto.RegisterCustomerRequest{
		CustomerName:         "นายสมชาย ใจดี",
		CustomerTypeID:       1,
		PhoneNumber:          "0812345678",
		IdCardNumberCustomer: "1234567890123",
		RegisteredAddress:    "123 ถ.สุขุมวิท กทม.",
		ShippingAddress:      "456 ถ.พระราม 4 กทม.",
		IdCardImagePath:      "https://example.com/storage/id_card_01.jpg",
	}

	err := svc.RegisterNewCustomer(req, "")
	require.NoError(t, err)

	customers, err := svc.GetAllCustomers()
	require.NoError(t, err)
	require.Len(t, customers, 1)
	assert.Equal(t, "นายสมชาย ใจดี", customers[0].CustomerName)
	assert.Equal(t, "https://example.com/storage/id_card_01.jpg", customers[0].IdCardImagePath)

	detail, err := svc.GetCustomerByID(customers[0].ID)
	require.NoError(t, err)
	assert.Equal(t, "https://example.com/storage/id_card_01.jpg", detail.IdCardImagePath)
}

func TestRegisterNewCustomer_DuplicateValidations(t *testing.T) {
	_, svc := setupCustomerTestDB(t)

	req1 := customerDto.RegisterCustomerRequest{
		CustomerName:         "ลูกค้า 1",
		CustomerTypeID:       1,
		PhoneNumber:          "0811111111",
		IdCardNumberCustomer: "1111111111111",
		RegisteredAddress:    "ที่อยู่ 1",
		ShippingAddress:      "ที่อยู่จัดส่ง 1",
	}
	err := svc.RegisterNewCustomer(req1, "")
	require.NoError(t, err)

	// ซ้ำเลขบัตรประชาชน
	reqDupCard := customerDto.RegisterCustomerRequest{
		CustomerName:         "ลูกค้า 2",
		CustomerTypeID:       1,
		PhoneNumber:          "0822222222",
		IdCardNumberCustomer: "1111111111111",
		RegisteredAddress:    "ที่อยู่ 2",
		ShippingAddress:      "ที่อยู่จัดส่ง 2",
	}
	err = svc.RegisterNewCustomer(reqDupCard, "")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "เลขบัตรประชาชนนี้เคยลงทะเบียน")

	// ซ้ำเบอร์โทรศัพท์
	reqDupPhone := customerDto.RegisterCustomerRequest{
		CustomerName:         "ลูกค้า 3",
		CustomerTypeID:       1,
		PhoneNumber:          "0811111111",
		IdCardNumberCustomer: "3333333333333",
		RegisteredAddress:    "ที่อยู่ 3",
		ShippingAddress:      "ที่อยู่จัดส่ง 3",
	}
	err = svc.RegisterNewCustomer(reqDupPhone, "")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "หมายเลขโทรศัพท์นี้เคยลงทะเบียน")
}

func TestUpdateCustomer_Success(t *testing.T) {
	_, svc := setupCustomerTestDB(t)

	req := customerDto.RegisterCustomerRequest{
		CustomerName:         "อู่ช่างยอด",
		CustomerTypeID:       1,
		PhoneNumber:          "0899999999",
		IdCardNumberCustomer: "1999999999999",
		RegisteredAddress:    "ที่อยู่เดิม",
		ShippingAddress:      "ที่อยู่ส่งเดิม",
		IdCardImagePath:      "old_image.jpg",
	}
	err := svc.RegisterNewCustomer(req, "")
	require.NoError(t, err)

	customers, err := svc.GetAllCustomers()
	require.NoError(t, err)
	customerID := customers[0].ID

	updateReq := customerDto.UpdateCustomerRequest{
		CustomerName:         "อู่ช่างยอด การาจ (แก้ไข)",
		CustomerTypeID:       2,
		PhoneNumber:          "0898888888",
		IdCardNumberCustomer: "1999999999999",
		RegisteredAddress:    "ที่อยู่ใหม่ 789",
		ShippingAddress:      "ที่อยู่จัดส่งใหม่ 101",
		IdCardImagePath:      "https://supabase.co/storage/v1/new_id.jpg",
	}

	err = svc.UpdateCustomer(customerID, updateReq, 1)
	require.NoError(t, err)

	detail, err := svc.GetCustomerByID(customerID)
	require.NoError(t, err)
	assert.Equal(t, "อู่ช่างยอด การาจ (แก้ไข)", detail.CustomerName)
	assert.Equal(t, uint(2), detail.CustomerTypeID)
	assert.Equal(t, "0898888888", detail.PhoneNumber)
	assert.Equal(t, "ที่อยู่ใหม่ 789", detail.RegisteredAddress)
	assert.Equal(t, "ที่อยู่จัดส่งใหม่ 101", detail.ShippingAddress)
	assert.Equal(t, "https://supabase.co/storage/v1/new_id.jpg", detail.IdCardImagePath)

	logs, err := svc.GetCreditAuditLogs()
	require.NoError(t, err)
	require.NotEmpty(t, logs)
	assert.Equal(t, "แก้ไขข้อมูลลูกค้า", logs[0].Action)
}

func TestUpdateCustomer_DuplicateConflictWithOther(t *testing.T) {
	_, svc := setupCustomerTestDB(t)

	err := svc.RegisterNewCustomer(customerDto.RegisterCustomerRequest{
		CustomerName:         "ลูกค้า A",
		CustomerTypeID:       1,
		PhoneNumber:          "0811111111",
		IdCardNumberCustomer: "1111111111111",
		RegisteredAddress:    "Address A",
		ShippingAddress:      "Ship A",
	}, "")
	require.NoError(t, err)

	err = svc.RegisterNewCustomer(customerDto.RegisterCustomerRequest{
		CustomerName:         "ลูกค้า B",
		CustomerTypeID:       1,
		PhoneNumber:          "0822222222",
		IdCardNumberCustomer: "2222222222222",
		RegisteredAddress:    "Address B",
		ShippingAddress:      "Ship B",
	}, "")
	require.NoError(t, err)

	customers, err := svc.GetAllCustomers()
	require.NoError(t, err)
	var customerBID uint
	for _, c := range customers {
		if c.CustomerName == "ลูกค้า B" {
			customerBID = c.ID
		}
	}

	// พยายามแก้ลูกค้า B ให้ใช้เลขบัตรของลูกค้า A
	err = svc.UpdateCustomer(customerBID, customerDto.UpdateCustomerRequest{
		CustomerName:         "ลูกค้า B",
		CustomerTypeID:       1,
		PhoneNumber:          "0822222222",
		IdCardNumberCustomer: "1111111111111",
		RegisteredAddress:    "Address B",
		ShippingAddress:      "Ship B",
	}, 1)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "เลขบัตรประชาชนนี้เคยลงทะเบียน")

	// พยายามแก้ลูกค้า B ให้ใช้เบอร์โทรของลูกค้า A
	err = svc.UpdateCustomer(customerBID, customerDto.UpdateCustomerRequest{
		CustomerName:         "ลูกค้า B",
		CustomerTypeID:       1,
		PhoneNumber:          "0811111111",
		IdCardNumberCustomer: "2222222222222",
		RegisteredAddress:    "Address B",
		ShippingAddress:      "Ship B",
	}, 1)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "หมายเลขโทรศัพท์นี้เคยลงทะเบียน")
}
