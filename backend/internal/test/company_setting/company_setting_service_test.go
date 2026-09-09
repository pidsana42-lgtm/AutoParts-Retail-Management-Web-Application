package company_setting_test

import (
	"context"
	"strings"
	"testing"

	dto "backend/internal/app/dto/company_setting"
	"backend/internal/app/entity"
	repo "backend/internal/app/repository/company_setting"
	service "backend/internal/app/service/company_setting"
	"backend/internal/pkg/crypto"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func setupCompanySettingTestDB(t *testing.T) (*gorm.DB, service.CompanySettingService) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	err = db.AutoMigrate(&entity.CompanySetting{})
	require.NoError(t, err)

	repository := repo.NewCompanySettingRepository(db)
	svc := service.NewCompanySettingService(repository)
	return db, svc
}

func TestCompanySettingPaymentAESEncryptionAndMasking(t *testing.T) {
	db, svc := setupCompanySettingTestDB(t)
	ctx := context.Background()

	promptPayPlain := "0812345678"
	bankAccountPlain := "1234567890"

	// 1. Update company setting with plaintext payment info
	req := &dto.CompanySettingReq{
		CompanyName:       "ร้าน เจ.เจ. อะไหล่ยนต์",
		TaxIDNumber:       "0105565012345",
		Address:           "123 ถนนพหลโยธิน",
		PhoneNumber:       "02-123-4567",
		Email:             "contact@autopart.co.th",
		PromptPayType:     "phone",
		PromptPayNumber:   promptPayPlain,
		PromptPayName:     "เจเจ อะไหล่ยนต์",
		BankName:          "ธนาคารกสิกรไทย (KBANK)",
		BankAccountNumber: bankAccountPlain,
		BankAccountName:   "เจเจ อะไหล่ยนต์",
	}

	res, err := svc.UpdateCompanySetting(ctx, req)
	require.NoError(t, err)
	require.NotNil(t, res)

	// Response from Update/Get should be masked
	assert.Equal(t, "******5678", res.PromptPayNumberMasked)
	assert.True(t, res.HasPromptPay)
	assert.Equal(t, "******7890", res.BankAccountNumberMasked)
	assert.True(t, res.HasBankAccount)
	assert.Equal(t, "ธนาคารกสิกรไทย (KBANK)", res.BankName)

	// 2. Check Raw Database: verify that stored number is AES encrypted with enc:v1: prefix
	var rawRow struct {
		PromptPayNumber   string `gorm:"column:prompt_pay_number"`
		BankAccountNumber string `gorm:"column:bank_account_number"`
	}
	err = db.Raw("SELECT prompt_pay_number, bank_account_number FROM company_setting WHERE id = ?", res.ID).Scan(&rawRow).Error
	require.NoError(t, err)

	assert.True(t, crypto.IsEncrypted(rawRow.PromptPayNumber), "DB raw PromptPay should be encrypted with enc:v1:")
	assert.NotEqual(t, promptPayPlain, rawRow.PromptPayNumber)
	assert.True(t, crypto.IsEncrypted(rawRow.BankAccountNumber), "DB raw BankAccount should be encrypted with enc:v1:")
	assert.NotEqual(t, bankAccountPlain, rawRow.BankAccountNumber)

	// 3. Check Reveal API: should return decrypted plaintext
	revealed, err := svc.RevealPaymentSetting(ctx)
	require.NoError(t, err)
	require.NotNil(t, revealed)
	assert.Equal(t, promptPayPlain, revealed.PromptPayNumber)
	assert.Equal(t, bankAccountPlain, revealed.BankAccountNumber)
	assert.Equal(t, "ธนาคารกสิกรไทย (KBANK)", revealed.BankName)

	// 4. Test Partial Update: when frontend sends masked value back, it shouldn't overwrite the secret
	updateReq := &dto.CompanySettingReq{
		CompanyName:       "ร้าน เจ.เจ. อะไหล่ยนต์ (สาขา 2)",
		TaxIDNumber:       "0105565012345",
		Address:           "456 ถนนวิภาวดี",
		PhoneNumber:       "02-999-8888",
		Email:             "contact@autopart.co.th",
		PromptPayType:     "phone",
		PromptPayNumber:   res.PromptPayNumberMasked,   // Contains asterisks "******5678"
		PromptPayName:     "เจเจ อะไหล่ยนต์",
		BankName:          "ธนาคารไทยพาณิชย์ (SCB)",
		BankAccountNumber: res.BankAccountNumberMasked, // Contains asterisks "******7890"
		BankAccountName:   "เจเจ อะไหล่ยนต์",
	}

	updateRes, err := svc.UpdateCompanySetting(ctx, updateReq)
	require.NoError(t, err)
	assert.Equal(t, "ร้าน เจ.เจ. อะไหล่ยนต์ (สาขา 2)", updateRes.CompanyName)
	assert.Equal(t, "ธนาคารไทยพาณิชย์ (SCB)", updateRes.BankName)

	// Ensure revealed numbers still have the original plaintext!
	revealedAgain, err := svc.RevealPaymentSetting(ctx)
	require.NoError(t, err)
	assert.Equal(t, promptPayPlain, revealedAgain.PromptPayNumber)
	assert.False(t, strings.Contains(revealedAgain.PromptPayNumber, "*"))
	assert.Equal(t, bankAccountPlain, revealedAgain.BankAccountNumber)
	assert.False(t, strings.Contains(revealedAgain.BankAccountNumber, "*"))
}
