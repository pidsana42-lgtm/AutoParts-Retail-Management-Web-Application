package pos_test

import (
	"errors"
	"testing"
	"time"

	posDto "backend/internal/app/dto/pos"
	"backend/internal/app/entity"
	posRepo "backend/internal/app/repository/pos"
	posService "backend/internal/app/service/pos"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// -----------------------------------------------------------------------------
// Mock StoreConfigRepository
// -----------------------------------------------------------------------------

type mockStoreConfigRepo struct {
	getConfigFn      func() (*entity.StoreConfig, error)
	createConfigFn   func(config *entity.StoreConfig) error
	updateConfigFn   func(config *entity.StoreConfig) error
	createAuditLogFn func(log *entity.StoreConfigAuditLog) error
	getAuditLogsFn   func(limit int) ([]entity.StoreConfigAuditLog, error)
	getUserByIDFn    func(userID uint) (*entity.User, error)
	syncCreditFn     func(creditLimit float64) error

	calls     map[string]int
	auditLogs []*entity.StoreConfigAuditLog
}

var _ posRepo.StoreConfigRepository = (*mockStoreConfigRepo)(nil)

func newMockStoreConfigRepo() *mockStoreConfigRepo {
	return &mockStoreConfigRepo{
		calls:     make(map[string]int),
		auditLogs: make([]*entity.StoreConfigAuditLog, 0),
	}
}

func (m *mockStoreConfigRepo) track(name string) {
	m.calls[name]++
}

func (m *mockStoreConfigRepo) GetStoreConfig() (*entity.StoreConfig, error) {
	m.track("GetStoreConfig")
	if m.getConfigFn != nil {
		return m.getConfigFn()
	}
	return nil, gorm.ErrRecordNotFound
}

func (m *mockStoreConfigRepo) CreateStoreConfig(config *entity.StoreConfig) error {
	m.track("CreateStoreConfig")
	if m.createConfigFn != nil {
		return m.createConfigFn(config)
	}
	config.ID = 1
	return nil
}

func (m *mockStoreConfigRepo) UpdateStoreConfig(config *entity.StoreConfig) error {
	m.track("UpdateStoreConfig")
	if m.updateConfigFn != nil {
		return m.updateConfigFn(config)
	}
	return nil
}

func (m *mockStoreConfigRepo) CreateAuditLog(log *entity.StoreConfigAuditLog) error {
	m.track("CreateAuditLog")
	m.auditLogs = append(m.auditLogs, log)
	if m.createAuditLogFn != nil {
		return m.createAuditLogFn(log)
	}
	log.ID = uint(len(m.auditLogs))
	return nil
}

func (m *mockStoreConfigRepo) GetAuditLogs(limit int) ([]entity.StoreConfigAuditLog, error) {
	m.track("GetAuditLogs")
	if m.getAuditLogsFn != nil {
		return m.getAuditLogsFn(limit)
	}
	return nil, nil
}

func (m *mockStoreConfigRepo) GetUserByID(userID uint) (*entity.User, error) {
	m.track("GetUserByID")
	if m.getUserByIDFn != nil {
		return m.getUserByIDFn(userID)
	}
	return nil, gorm.ErrRecordNotFound
}

func (m *mockStoreConfigRepo) SyncAllCustomersCreditLimit(creditLimit float64) error {
	m.track("SyncAllCustomersCreditLimit")
	if m.syncCreditFn != nil {
		return m.syncCreditFn(creditLimit)
	}
	return nil
}

// -----------------------------------------------------------------------------
// 1. GetStoreConfig Tests
// -----------------------------------------------------------------------------

func TestGetStoreConfig_Success(t *testing.T) {
	repo := newMockStoreConfigRepo()
	service := posService.NewStoreConfigService(repo)

	repo.getConfigFn = func() (*entity.StoreConfig, error) {
		return &entity.StoreConfig{
			Model:                gorm.Model{ID: 1},
			MaxCredit:            50000.0,
			MaxOverdueDays:       45,
			MaxExtraDiscountRate: 15.0,
			SupervisedPin:        "9876",
		}, nil
	}

	res, err := service.GetStoreConfig()
	require.NoError(t, err)
	require.NotNil(t, res)

	assert.Equal(t, 50000.0, res.MaxCredit)
	assert.Equal(t, 45, res.MaxOverdueDays)
	assert.Equal(t, 15.0, res.MaxExtraDiscountRate)
	assert.Equal(t, "9876", res.SupervisedPin)
	assert.Equal(t, 1, repo.calls["GetStoreConfig"])
}

func TestGetStoreConfig_NotFound_ReturnsDefault(t *testing.T) {
	repo := newMockStoreConfigRepo()
	service := posService.NewStoreConfigService(repo)

	repo.getConfigFn = func() (*entity.StoreConfig, error) {
		return nil, gorm.ErrRecordNotFound
	}

	res, err := service.GetStoreConfig()
	require.NoError(t, err)
	require.NotNil(t, res)

	assert.Equal(t, 0.0, res.MaxCredit)
	assert.Equal(t, 0, res.MaxOverdueDays)
	assert.Equal(t, 0.0, res.MaxExtraDiscountRate)
	assert.Equal(t, "", res.SupervisedPin)
}

func TestGetStoreConfig_RepoError(t *testing.T) {
	repo := newMockStoreConfigRepo()
	service := posService.NewStoreConfigService(repo)

	repo.getConfigFn = func() (*entity.StoreConfig, error) {
		return nil, errors.New("db connection failure")
	}

	res, err := service.GetStoreConfig()
	require.Error(t, err)
	assert.Nil(t, res)
	assert.Equal(t, "db connection failure", err.Error())
}

// -----------------------------------------------------------------------------
// 2. CreateStoreConfig Tests
// -----------------------------------------------------------------------------

func TestCreateStoreConfig_NewRecord_Success(t *testing.T) {
	repo := newMockStoreConfigRepo()
	service := posService.NewStoreConfigService(repo)

	repo.getConfigFn = func() (*entity.StoreConfig, error) {
		return nil, gorm.ErrRecordNotFound
	}

	req := &posDto.StoreConfigRequest{
		MaxCredit:            30000.0,
		MaxOverdueDays:       30,
		MaxExtraDiscountRate: 10.0,
		SupervisedPin:        "1111",
	}

	err := service.CreateStoreConfig(req, 0)
	require.NoError(t, err)

	assert.Equal(t, 1, repo.calls["CreateStoreConfig"])
	assert.Equal(t, 0, repo.calls["UpdateStoreConfig"])
	assert.Equal(t, 1, repo.calls["CreateAuditLog"])
	require.Len(t, repo.auditLogs, 1)
	assert.Equal(t, "เจ้าของร้าน", repo.auditLogs[0].ChangedBy)
	assert.Contains(t, repo.auditLogs[0].Details, "ส่วนลดสูงสุด: 10%")
	assert.Contains(t, repo.auditLogs[0].Details, "วงเงินเครดิต: ฿30000.00")
}

func TestCreateStoreConfig_AlreadyExists_UpdatesInstead(t *testing.T) {
	repo := newMockStoreConfigRepo()
	service := posService.NewStoreConfigService(repo)

	existing := &entity.StoreConfig{
		Model:                gorm.Model{ID: 1},
		MaxCredit:            10000.0,
		MaxOverdueDays:       15,
		MaxExtraDiscountRate: 5.0,
		SupervisedPin:        "0000",
	}
	repo.getConfigFn = func() (*entity.StoreConfig, error) {
		return existing, nil
	}

	req := &posDto.StoreConfigRequest{
		MaxCredit:            40000.0,
		MaxOverdueDays:       60,
		MaxExtraDiscountRate: 12.0,
		SupervisedPin:        "2222",
	}

	err := service.CreateStoreConfig(req, 0)
	require.NoError(t, err)

	assert.Equal(t, 0, repo.calls["CreateStoreConfig"])
	assert.Equal(t, 1, repo.calls["UpdateStoreConfig"])
	assert.Equal(t, 40000.0, existing.MaxCredit)
	assert.Equal(t, 60, existing.MaxOverdueDays)
	assert.Equal(t, 12.0, existing.MaxExtraDiscountRate)
	assert.Equal(t, "2222", existing.SupervisedPin)
}

func TestCreateStoreConfig_GetConfigError(t *testing.T) {
	repo := newMockStoreConfigRepo()
	service := posService.NewStoreConfigService(repo)

	repo.getConfigFn = func() (*entity.StoreConfig, error) {
		return nil, errors.New("db error")
	}

	req := &posDto.StoreConfigRequest{MaxCredit: 10000.0}
	err := service.CreateStoreConfig(req, 1)
	require.Error(t, err)
	assert.Equal(t, "db error", err.Error())
}

func TestCreateStoreConfig_CreateRepoError(t *testing.T) {
	repo := newMockStoreConfigRepo()
	service := posService.NewStoreConfigService(repo)

	repo.getConfigFn = func() (*entity.StoreConfig, error) {
		return nil, gorm.ErrRecordNotFound
	}
	repo.createConfigFn = func(config *entity.StoreConfig) error {
		return errors.New("insert error")
	}

	req := &posDto.StoreConfigRequest{MaxCredit: 10000.0}
	err := service.CreateStoreConfig(req, 1)
	require.Error(t, err)
	assert.Equal(t, "insert error", err.Error())
}

func TestCreateStoreConfig_UpdateRepoError(t *testing.T) {
	repo := newMockStoreConfigRepo()
	service := posService.NewStoreConfigService(repo)

	repo.getConfigFn = func() (*entity.StoreConfig, error) {
		return &entity.StoreConfig{Model: gorm.Model{ID: 1}}, nil
	}
	repo.updateConfigFn = func(config *entity.StoreConfig) error {
		return errors.New("update error")
	}

	req := &posDto.StoreConfigRequest{MaxCredit: 10000.0}
	err := service.CreateStoreConfig(req, 1)
	require.Error(t, err)
	assert.Equal(t, "update error", err.Error())
}

// -----------------------------------------------------------------------------
// 3. UpdateStoreConfig Tests
// -----------------------------------------------------------------------------

func TestUpdateStoreConfig_Existing_Success(t *testing.T) {
	repo := newMockStoreConfigRepo()
	service := posService.NewStoreConfigService(repo)

	existing := &entity.StoreConfig{
		Model:                gorm.Model{ID: 1},
		MaxCredit:            20000.0,
		MaxOverdueDays:       30,
		MaxExtraDiscountRate: 5.0,
		SupervisedPin:        "1234",
	}
	repo.getConfigFn = func() (*entity.StoreConfig, error) {
		return existing, nil
	}

	repo.getUserByIDFn = func(userID uint) (*entity.User, error) {
		return &entity.User{
			FirstName: "สมศักดิ์",
			LastName:  "ใจดี",
		}, nil
	}

	req := &posDto.StoreConfigRequest{
		MaxCredit:            80000.0,
		MaxOverdueDays:       45,
		MaxExtraDiscountRate: 20.0,
		SupervisedPin:        "5555",
	}

	err := service.UpdateStoreConfig(req, 10)
	require.NoError(t, err)

	assert.Equal(t, 1, repo.calls["UpdateStoreConfig"])
	assert.Equal(t, 80000.0, existing.MaxCredit)
	assert.Equal(t, 45, existing.MaxOverdueDays)
	assert.Equal(t, 20.0, existing.MaxExtraDiscountRate)
	assert.Equal(t, "5555", existing.SupervisedPin)

	require.Len(t, repo.auditLogs, 1)
	assert.Equal(t, "สมศักดิ์ ใจดี", repo.auditLogs[0].ChangedBy)
	assert.Equal(t, uint(10), *repo.auditLogs[0].UserID)
}

func TestUpdateStoreConfig_NotFound_CreatesNew(t *testing.T) {
	repo := newMockStoreConfigRepo()
	service := posService.NewStoreConfigService(repo)

	repo.getConfigFn = func() (*entity.StoreConfig, error) {
		return nil, gorm.ErrRecordNotFound
	}

	req := &posDto.StoreConfigRequest{
		MaxCredit:            50000.0,
		MaxOverdueDays:       30,
		MaxExtraDiscountRate: 10.0,
		SupervisedPin:        "9999",
	}

	err := service.UpdateStoreConfig(req, 0)
	require.NoError(t, err)

	assert.Equal(t, 1, repo.calls["CreateStoreConfig"])
	assert.Equal(t, 0, repo.calls["UpdateStoreConfig"])
	require.Len(t, repo.auditLogs, 1)
}

func TestUpdateStoreConfig_GetConfigError(t *testing.T) {
	repo := newMockStoreConfigRepo()
	service := posService.NewStoreConfigService(repo)

	repo.getConfigFn = func() (*entity.StoreConfig, error) {
		return nil, errors.New("db disconnect")
	}

	req := &posDto.StoreConfigRequest{MaxCredit: 10000.0}
	err := service.UpdateStoreConfig(req, 1)
	require.Error(t, err)
	assert.Equal(t, "db disconnect", err.Error())
}

func TestUpdateStoreConfig_CreateRepoError(t *testing.T) {
	repo := newMockStoreConfigRepo()
	service := posService.NewStoreConfigService(repo)

	repo.getConfigFn = func() (*entity.StoreConfig, error) {
		return nil, gorm.ErrRecordNotFound
	}
	repo.createConfigFn = func(config *entity.StoreConfig) error {
		return errors.New("insert failed")
	}

	req := &posDto.StoreConfigRequest{MaxCredit: 10000.0}
	err := service.UpdateStoreConfig(req, 1)
	require.Error(t, err)
	assert.Equal(t, "insert failed", err.Error())
}

func TestUpdateStoreConfig_UpdateRepoError(t *testing.T) {
	repo := newMockStoreConfigRepo()
	service := posService.NewStoreConfigService(repo)

	repo.getConfigFn = func() (*entity.StoreConfig, error) {
		return &entity.StoreConfig{Model: gorm.Model{ID: 1}}, nil
	}
	repo.updateConfigFn = func(config *entity.StoreConfig) error {
		return errors.New("update failed")
	}

	req := &posDto.StoreConfigRequest{MaxCredit: 10000.0}
	err := service.UpdateStoreConfig(req, 1)
	require.Error(t, err)
	assert.Equal(t, "update failed", err.Error())
}

// -----------------------------------------------------------------------------
// 4. Audit Log Recording Logic Tests
// -----------------------------------------------------------------------------

func TestRecordAuditLog_UsernameFallbackWhenNoFullName(t *testing.T) {
	repo := newMockStoreConfigRepo()
	service := posService.NewStoreConfigService(repo)

	repo.getConfigFn = func() (*entity.StoreConfig, error) {
		return &entity.StoreConfig{Model: gorm.Model{ID: 1}}, nil
	}

	// User has only Username
	repo.getUserByIDFn = func(userID uint) (*entity.User, error) {
		return &entity.User{
			Username: "manager_user",
		}, nil
	}

	req := &posDto.StoreConfigRequest{MaxCredit: 1000.0}
	err := service.UpdateStoreConfig(req, 5)
	require.NoError(t, err)

	require.Len(t, repo.auditLogs, 1)
	assert.Equal(t, "manager_user", repo.auditLogs[0].ChangedBy)
	assert.Equal(t, uint(5), *repo.auditLogs[0].UserID)
}

func TestRecordAuditLog_UserNotFound_FallbackStoreOwner(t *testing.T) {
	repo := newMockStoreConfigRepo()
	service := posService.NewStoreConfigService(repo)

	repo.getConfigFn = func() (*entity.StoreConfig, error) {
		return &entity.StoreConfig{Model: gorm.Model{ID: 1}}, nil
	}

	// User not found in DB
	repo.getUserByIDFn = func(userID uint) (*entity.User, error) {
		return nil, gorm.ErrRecordNotFound
	}

	req := &posDto.StoreConfigRequest{MaxCredit: 1000.0}
	err := service.UpdateStoreConfig(req, 99)
	require.NoError(t, err)

	require.Len(t, repo.auditLogs, 1)
	assert.Equal(t, "เจ้าของร้าน", repo.auditLogs[0].ChangedBy)
	assert.Equal(t, uint(99), *repo.auditLogs[0].UserID)
}

func TestRecordAuditLog_UserIDZero_DefaultsToOwner(t *testing.T) {
	repo := newMockStoreConfigRepo()
	service := posService.NewStoreConfigService(repo)

	repo.getConfigFn = func() (*entity.StoreConfig, error) {
		return &entity.StoreConfig{Model: gorm.Model{ID: 1}}, nil
	}

	req := &posDto.StoreConfigRequest{MaxCredit: 1000.0}
	err := service.UpdateStoreConfig(req, 0)
	require.NoError(t, err)

	require.Len(t, repo.auditLogs, 1)
	assert.Equal(t, "เจ้าของร้าน", repo.auditLogs[0].ChangedBy)
	assert.Nil(t, repo.auditLogs[0].UserID)
}

// -----------------------------------------------------------------------------
// 5. GetAuditLogs Tests
// -----------------------------------------------------------------------------

func TestGetAuditLogs_Success(t *testing.T) {
	repo := newMockStoreConfigRepo()
	service := posService.NewStoreConfigService(repo)

	fixedTime := time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC)
	repo.getAuditLogsFn = func(limit int) ([]entity.StoreConfigAuditLog, error) {
		assert.Equal(t, 50, limit)
		return []entity.StoreConfigAuditLog{
			{
				Model:     gorm.Model{ID: 1, CreatedAt: fixedTime},
				Action:    "แก้ไขการตั้งค่านโยบายการเงินและเครดิต",
				Details:   "ส่วนลดสูงสุด: 10%, วงเงินเครดิต: ฿50000.00, ระยะเวลาค้างชำระ: 30 วัน",
				ChangedBy: "สมศักดิ์ ใจดี",
			},
			{
				Model:     gorm.Model{ID: 2, CreatedAt: fixedTime.Add(1 * time.Hour)},
				Action:    "แก้ไขการตั้งค่านโยบายการเงินและเครดิต",
				Details:   "ส่วนลดสูงสุด: 15%, วงเงินเครดิต: ฿80000.00, ระยะเวลาค้างชำระ: 45 วัน",
				ChangedBy: "manager_user",
			},
		}, nil
	}

	logs, err := service.GetAuditLogs()
	require.NoError(t, err)
	require.Len(t, logs, 2)

	assert.Equal(t, uint(1), logs[0].ID)
	assert.Equal(t, "แก้ไขการตั้งค่านโยบายการเงินและเครดิต", logs[0].Action)
	assert.Equal(t, "สมศักดิ์ ใจดี", logs[0].ChangedBy)
	assert.Equal(t, fixedTime, logs[0].ChangedAt)

	assert.Equal(t, uint(2), logs[1].ID)
	assert.Equal(t, "manager_user", logs[1].ChangedBy)
}

func TestGetAuditLogs_RepoError(t *testing.T) {
	repo := newMockStoreConfigRepo()
	service := posService.NewStoreConfigService(repo)

	repo.getAuditLogsFn = func(limit int) ([]entity.StoreConfigAuditLog, error) {
		return nil, errors.New("cannot fetch audit logs")
	}

	logs, err := service.GetAuditLogs()
	require.Error(t, err)
	assert.Nil(t, logs)
	assert.Equal(t, "cannot fetch audit logs", err.Error())
}
