package claim

import (
	"backend/internal/app/entity"
	"gorm.io/gorm"
)

type CustomerClaimRepository interface {
	CreateCustomerClaim(claim *entity.CustomerClaim) error
	CreateCustomerClaimItem(item *entity.CustomerClaimItem) error
	GetCustomerClaimByID(id uint) (*entity.CustomerClaim, error)
	GetCustomerClaimItemByID(id uint) (*entity.CustomerClaimItem, error)
	ListCustomerClaims() ([]entity.CustomerClaim, error)
	UpdateCustomerClaim(claim *entity.CustomerClaim) error
	UpdateCustomerClaimItem(item *entity.CustomerClaimItem) error
	DeleteCustomerClaim(id uint) error
}

type customerClaimRepository struct {
	db *gorm.DB
}

func NewCustomerClaimRepository(db *gorm.DB) CustomerClaimRepository {
	return &customerClaimRepository{db: db}
}

func (r *customerClaimRepository) CreateCustomerClaim(claim *entity.CustomerClaim) error {
	return r.db.Create(claim).Error
}

func (r *customerClaimRepository) CreateCustomerClaimItem(item *entity.CustomerClaimItem) error {
	return r.db.Create(item).Error
}

func (r *customerClaimRepository) GetCustomerClaimByID(id uint) (*entity.CustomerClaim, error) {
	var claim entity.CustomerClaim
	err := r.db.Preload("OriginalOrder").
		Preload("OriginalOrder.Customer").
		Preload("Return").
		Preload("CreatedByUser").
		Preload("ApprovedByUser").
		Preload("Items").
		Preload("Items.Product").
		First(&claim, id).Error
	if err != nil {
		return nil, err
	}
	return &claim, nil
}

func (r *customerClaimRepository) ListCustomerClaims() ([]entity.CustomerClaim, error) {
	claims := make([]entity.CustomerClaim, 0)
	err := r.db.Preload("OriginalOrder").
		Preload("OriginalOrder.Customer").
		Preload("Return").
		Preload("CreatedByUser").
		Preload("ApprovedByUser").
		Preload("Items").
		Preload("Items.Product").
		Find(&claims).Error
	return claims, err
}

func (r *customerClaimRepository) GetCustomerClaimItemByID(id uint) (*entity.CustomerClaimItem, error) {
	var item entity.CustomerClaimItem
	err := r.db.Preload("Product").First(&item, id).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *customerClaimRepository) UpdateCustomerClaim(claim *entity.CustomerClaim) error {
	return r.db.Save(claim).Error
}

func (r *customerClaimRepository) UpdateCustomerClaimItem(item *entity.CustomerClaimItem) error {
	return r.db.Save(item).Error
}

func (r *customerClaimRepository) DeleteCustomerClaim(id uint) error {
	return r.db.Delete(&entity.CustomerClaim{}, id).Error
}
