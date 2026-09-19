package employee

import (
	employeeDTO "backend/internal/app/dto/employee"
	"backend/internal/app/entity"
	"backend/internal/app/enum"
	"errors"
	"regexp"
	"strings"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var (
	ErrOwnerNotFound       = errors.New("ไม่พบข้อมูลเจ้าของร้าน")
	ErrEmployeeRoleMissing = errors.New("ไม่พบสิทธิ์พนักงานในระบบ")
	ErrBankNotFound        = errors.New("ไม่พบธนาคารที่เลือก")
	ErrUsernameExists      = errors.New("ชื่อผู้ใช้นี้ถูกใช้งานแล้ว")
	ErrIDCardExists        = errors.New("เลขบัตรประชาชนนี้ถูกลงทะเบียนแล้ว")
	ErrLineUserIDExists    = errors.New("LINE User ID นี้ถูกเชื่อมกับบัญชีอื่นแล้ว")
	ErrNameRequired        = errors.New("กรุณากรอกชื่อและนามสกุล")
	ErrInvalidUsername     = errors.New("ชื่อผู้ใช้ใช้ได้เฉพาะตัวอักษรภาษาอังกฤษ ตัวเลข จุด ขีดกลาง และขีดล่าง")
	ErrInvalidIDCard       = errors.New("เลขบัตรประชาชนไม่ถูกต้อง")
	ErrInvalidPassword     = errors.New("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และประกอบด้วยตัวอักษรภาษาอังกฤษกับตัวเลข")
	ErrInvalidBankAccount  = errors.New("เลขบัญชีธนาคารต้องมี 6 ถึง 20 หลัก")
	ErrInvalidRole         = errors.New("กำหนดสิทธิ์ได้เฉพาะพนักงานหรือผู้จัดการ")
	ErrInvalidCredentials  = errors.New("รหัสผ่านไม่ถูกต้อง")
	ErrEmployeeNotFound    = errors.New("ไม่พบพนักงานในร้านนี้")
)

var usernamePattern = regexp.MustCompile(`^[a-zA-Z0-9._-]+$`)

var registrationBankNames = []string{
	"ธนาคารกสิกรไทย (KBANK)",
	"ธนาคารไทยพาณิชย์ (SCB)",
	"ธนาคารกรุงไทย (KTB)",
	"ธนาคารกรุงเทพ (BBL)",
	"ธนาคารกรุงศรีอยุธยา (BAY)",
	"ธนาคารทหารไทยธนชาต (TTB)",
	"ธนาคารออมสิน (GSB)",
	"ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร (ธ.ก.ส.)",
	"ธนาคารยูโอบี (UOB)",
	"ธนาคารเกียรตินาคินภัทร (KKP)",
	"ธนาคารซีไอเอ็มบีไทย (CIMB)",
	"ธนาคารทิสโก้ (TISCO)",
	"ธนาคารแลนด์ แอนด์ เฮ้าส์ (LH Bank)",
}

type Service interface {
	GetRegistrationMetadata() (*employeeDTO.RegistrationMetadata, error)
	ListEmployees(ownerID uint) (*employeeDTO.EmployeeListResponse, error)
	GetEmployeeDetails(ownerID, employeeID uint, password string) (*employeeDTO.EmployeeDetailResponse, error)
	UpdateEmployee(ownerID, employeeID uint, req employeeDTO.UpdateEmployeeRequest) (*employeeDTO.EmployeeDetailResponse, error)
	SaveEmployeeProfileImage(ownerID, employeeID uint, path string) error
	CreateEmployee(ownerID uint, req employeeDTO.CreateEmployeeRequest) (*employeeDTO.EmployeeResponse, error)
}

type service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) Service {
	return &service{db: db}
}

func (s *service) GetRegistrationMetadata() (*employeeDTO.RegistrationMetadata, error) {
	for _, bankName := range registrationBankNames {
		bank := entity.Bank{BankName: bankName}
		if err := s.db.Where("bank_name = ?", bankName).FirstOrCreate(&bank).Error; err != nil {
			return nil, err
		}
	}

	var banks []entity.Bank
	if err := s.db.Where("bank_name IN ?", registrationBankNames).Order("bank_name ASC").Find(&banks).Error; err != nil {
		return nil, err
	}

	options := make([]employeeDTO.BankOption, 0, len(banks))
	for _, bank := range banks {
		options = append(options, employeeDTO.BankOption{ID: bank.ID, Name: bank.BankName})
	}
	return &employeeDTO.RegistrationMetadata{Banks: options}, nil
}

func (s *service) ListEmployees(ownerID uint) (*employeeDTO.EmployeeListResponse, error) {
	var owner entity.User
	if err := s.db.First(&owner, ownerID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrOwnerNotFound
		}
		return nil, err
	}

	var users []entity.User
	if err := s.db.
		Preload("Role").
		Preload("Bank").
		Joins("JOIN roles ON roles.id = users.role_id").
		Where("users.store_config_id = ? AND roles.role_name IN ?", owner.StoreConfigID, []string{string(enum.RoleEmployee), string(enum.RoleManager)}).
		Order("users.created_at DESC, users.id DESC").
		Find(&users).Error; err != nil {
		return nil, err
	}

	employees := make([]employeeDTO.EmployeeResponse, 0, len(users))
	for _, user := range users {
		employees = append(employees, employeeDTO.EmployeeResponse{
			ID:               user.ID,
			FirstName:        user.FirstName,
			LastName:         user.LastName,
			Username:         user.Username,
			Role:             string(user.Role.RoleName),
			BankName:         user.Bank.BankName,
			AccountEnd:       lastFour(user.BankAccountNumber),
			AccountMasked:    maskBankAccount(user.BankAccountNumber),
			LineConnected:    strings.TrimSpace(user.LineUserID) != "",
			CreatedAt:        user.CreatedAt,
			ProfileImagePath: user.ProfileImagePath,
		})
	}

	return &employeeDTO.EmployeeListResponse{Employees: employees, Total: len(employees)}, nil
}

func (s *service) GetEmployeeDetails(ownerID, employeeID uint, password string) (*employeeDTO.EmployeeDetailResponse, error) {
	var owner entity.User
	if err := s.db.First(&owner, ownerID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrOwnerNotFound
		}
		return nil, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(owner.Password), []byte(password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	var employee entity.User
	if err := s.db.
		Preload("Role").
		Preload("Bank").
		Joins("JOIN roles ON roles.id = users.role_id").
		Where("users.id = ? AND users.store_config_id = ? AND roles.role_name IN ?", employeeID, owner.StoreConfigID, []string{string(enum.RoleEmployee), string(enum.RoleManager)}).
		First(&employee).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrEmployeeNotFound
		}
		return nil, err
	}

	return &employeeDTO.EmployeeDetailResponse{
		ID:                employee.ID,
		Prefix:            employee.Prefix,
		FirstName:         employee.FirstName,
		LastName:          employee.LastName,
		IDCardNumber:      employee.IdCardNumberUser,
		Username:          employee.Username,
		LineUserID:        employee.LineUserID,
		Role:              string(employee.Role.RoleName),
		BankName:          employee.Bank.BankName,
		BankAccountNumber: employee.BankAccountNumber,
		BankAccountName:   employee.BankAccountName,
		CreatedAt:         employee.CreatedAt,
		ProfileImagePath:  employee.ProfileImagePath,
	}, nil
}

func (s *service) SaveEmployeeProfileImage(ownerID, employeeID uint, path string) error {
	var owner entity.User
	if err := s.db.First(&owner, ownerID).Error; err != nil {
		return err
	}
	var employee entity.User
	if err := s.db.Joins("JOIN roles ON roles.id = users.role_id").Where("users.id = ? AND users.store_config_id = ? AND roles.role_name IN ?", employeeID, owner.StoreConfigID, []string{string(enum.RoleEmployee), string(enum.RoleManager)}).First(&employee).Error; err != nil {
		return err
	}
	return s.db.Model(&employee).Update("profile_image_path", path).Error
}

func (s *service) UpdateEmployee(ownerID, employeeID uint, req employeeDTO.UpdateEmployeeRequest) (*employeeDTO.EmployeeDetailResponse, error) {
	var owner entity.User
	if err := s.db.First(&owner, ownerID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrOwnerNotFound
		}
		return nil, err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(owner.Password), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	var employee entity.User
	if err := s.db.Joins("JOIN roles ON roles.id = users.role_id").Where(
		"users.id = ? AND users.store_config_id = ? AND roles.role_name IN ?",
		employeeID, owner.StoreConfigID, []string{string(enum.RoleEmployee), string(enum.RoleManager)},
	).First(&employee).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrEmployeeNotFound
		}
		return nil, err
	}

	req.Role = strings.TrimSpace(req.Role)
	req.Prefix = strings.TrimSpace(req.Prefix)
	req.FirstName = strings.TrimSpace(req.FirstName)
	req.LastName = strings.TrimSpace(req.LastName)
	req.IDCardNumber = digitsOnly(req.IDCardNumber)
	req.LineUserID = strings.TrimSpace(req.LineUserID)
	req.BankAccountNumber = digitsOnly(req.BankAccountNumber)
	req.BankAccountName = strings.TrimSpace(req.BankAccountName)
	req.BankName = strings.TrimSpace(req.BankName)
	if (req.Role != string(enum.RoleEmployee) && req.Role != string(enum.RoleManager)) || req.Prefix == "" || req.FirstName == "" || req.LastName == "" || !validThaiID(req.IDCardNumber) {
		return nil, ErrInvalidRole
	}
	if len(req.BankAccountNumber) < 6 || len(req.BankAccountNumber) > 20 {
		return nil, ErrInvalidBankAccount
	}

	var role entity.Role
	if err := s.db.Where("role_name = ?", req.Role).First(&role).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrEmployeeRoleMissing
		}
		return nil, err
	}
	var bank entity.Bank
	if req.BankID > 0 {
		if err := s.db.First(&bank, req.BankID).Error; err != nil {
			return nil, ErrBankNotFound
		}
	} else if err := s.db.Where("bank_name = ?", req.BankName).FirstOrCreate(&bank, entity.Bank{BankName: req.BankName}).Error; err != nil {
		return nil, err
	}

	lineUserID := any(nil)
	if req.LineUserID != "" {
		lineUserID = req.LineUserID
	}
	updates := map[string]any{
		"prefix":              req.Prefix,
		"first_name":          req.FirstName,
		"last_name":           req.LastName,
		"id_card_number_user": req.IDCardNumber,
		"line_user_id":        lineUserID,
		"role_id":             role.ID,
		"bank_id":             bank.ID,
		"bank_account_number": req.BankAccountNumber,
		"bank_account_name":   req.BankAccountName,
	}
	if err := s.db.Model(&employee).Updates(updates).Error; err != nil {
		return nil, err
	}
	return s.GetEmployeeDetails(ownerID, employeeID, req.Password)
}

func (s *service) CreateEmployee(ownerID uint, req employeeDTO.CreateEmployeeRequest) (*employeeDTO.EmployeeResponse, error) {
	req.Role = strings.TrimSpace(req.Role)
	req.Prefix = strings.TrimSpace(req.Prefix)
	req.FirstName = strings.TrimSpace(req.FirstName)
	req.LastName = strings.TrimSpace(req.LastName)
	req.IDCardNumber = digitsOnly(req.IDCardNumber)
	req.Username = strings.ToLower(strings.TrimSpace(req.Username))
	req.LineUserID = strings.TrimSpace(req.LineUserID)
	req.BankAccountNumber = digitsOnly(req.BankAccountNumber)
	req.BankAccountName = strings.TrimSpace(req.BankAccountName)
	req.BankName = strings.TrimSpace(req.BankName)

	if req.Role != string(enum.RoleEmployee) && req.Role != string(enum.RoleManager) {
		return nil, ErrInvalidRole
	}
	if req.Prefix == "" || req.FirstName == "" || req.LastName == "" {
		return nil, ErrNameRequired
	}
	if !usernamePattern.MatchString(req.Username) {
		return nil, ErrInvalidUsername
	}
	if !validThaiID(req.IDCardNumber) {
		return nil, ErrInvalidIDCard
	}
	if len(req.Password) < 8 || !regexp.MustCompile(`[a-zA-Z]`).MatchString(req.Password) || !regexp.MustCompile(`\d`).MatchString(req.Password) {
		return nil, ErrInvalidPassword
	}
	if len(req.BankAccountNumber) < 6 || len(req.BankAccountNumber) > 20 {
		return nil, ErrInvalidBankAccount
	}

	var owner entity.User
	if err := s.db.First(&owner, ownerID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrOwnerNotFound
		}
		return nil, err
	}

	var role entity.Role
	if err := s.db.Where("role_name = ?", req.Role).First(&role).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrEmployeeRoleMissing
		}
		return nil, err
	}

	var bank entity.Bank
	bankQuery := s.db
	if req.BankID > 0 {
		bankQuery = bankQuery.First(&bank, req.BankID)
	} else {
		// The frontend sends the selected bank name when the metadata endpoint
		// was loaded before all bank rows existed. Ensure the selected option is
		// available before creating the employee instead of failing with 404.
		bank = entity.Bank{BankName: req.BankName}
		bankQuery = bankQuery.Where("bank_name = ?", req.BankName).FirstOrCreate(&bank)
	}
	if err := bankQuery.Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrBankNotFound
		}
		return nil, err
	}

	if exists, err := s.valueExists("username", req.Username); err != nil {
		return nil, err
	} else if exists {
		return nil, ErrUsernameExists
	}
	if exists, err := s.valueExists("id_card_number_user", req.IDCardNumber); err != nil {
		return nil, err
	} else if exists {
		return nil, ErrIDCardExists
	}
	if req.LineUserID != "" {
		if exists, err := s.valueExists("line_user_id", req.LineUserID); err != nil {
			return nil, err
		} else if exists {
			return nil, ErrLineUserIDExists
		}
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	user := entity.User{
		Prefix:            req.Prefix,
		FirstName:         req.FirstName,
		LastName:          req.LastName,
		IdCardNumberUser:  req.IDCardNumber,
		Username:          req.Username,
		Password:          string(passwordHash),
		LineUserID:        req.LineUserID,
		StoreConfigID:     owner.StoreConfigID,
		BankID:            bank.ID,
		BankAccountNumber: req.BankAccountNumber,
		BankAccountName:   req.BankAccountName,
		RoleID:            role.ID,
	}
	createQuery := s.db
	if user.LineUserID == "" {
		// Store a missing optional LINE ID as NULL. An empty string would collide
		// with the unique index when more than one employee has not linked LINE.
		createQuery = createQuery.Omit("LineUserID")
	}
	if err := createQuery.Create(&user).Error; err != nil {
		return nil, err
	}

	return &employeeDTO.EmployeeResponse{
		ID:            user.ID,
		FirstName:     user.FirstName,
		LastName:      user.LastName,
		Username:      user.Username,
		Role:          req.Role,
		BankName:      bank.BankName,
		AccountEnd:    lastFour(user.BankAccountNumber),
		LineConnected: user.LineUserID != "",
		CreatedAt:     user.CreatedAt,
	}, nil
}

func (s *service) valueExists(column, value string) (bool, error) {
	var count int64
	if err := s.db.Model(&entity.User{}).Where(column+" = ?", value).Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func digitsOnly(value string) string {
	return regexp.MustCompile(`\D`).ReplaceAllString(value, "")
}

func validThaiID(value string) bool {
	if len(value) != 13 {
		return false
	}
	for _, digit := range value {
		if digit < '0' || digit > '9' {
			return false
		}
	}
	return true
}

func lastFour(value string) string {
	if len(value) <= 4 {
		return value
	}
	return value[len(value)-4:]
}

func maskBankAccount(value string) string {
	digits := digitsOnly(value)
	if digits == "" {
		return "-"
	}
	return strings.Repeat("*", len(digits))
}
