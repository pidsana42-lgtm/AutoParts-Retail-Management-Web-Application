package returns

import (
	"errors"
	"strings"
	"time"

	reDto "backend/internal/app/dto/return"
	reEntity "backend/internal/app/entity"
	reEnum "backend/internal/app/enum"
	reRepo "backend/internal/app/repository/return"
)

type ReturnService interface {
	GetReturns(req reDto.GetReturnsRequest) (*reDto.GetReturnsResponse, error)
	SearchReturnableSaleOrders(keyword string) ([]reDto.ReturnableSaleOrderDTO, error)
	GetReturnByID(id uint) (*reDto.ReturnDetailResponseDTO, error)
	CreateReturn(input reDto.CreateReturnDTO, createdBy uint, role string) (*reDto.ReturnDetailResponseDTO, error)
	UpdateReturn(id uint, input reDto.UpdateReturnDTO, approvedBy uint) (*reDto.ReturnDetailResponseDTO, error)
	ProcessRefund(id uint, processedBy uint) (*reDto.ReturnDetailResponseDTO, error)
	DeleteReturn(id uint) error
}

type returnService struct {
	repo reRepo.ReturnRepository
}

var ErrInvalidReturnStatus = errors.New("invalid return status")

func NewReturnService(repo reRepo.ReturnRepository) ReturnService {
	return &returnService{repo: repo}
}

func (s *returnService) GetReturns(req reDto.GetReturnsRequest) (*reDto.GetReturnsResponse, error) {
	if req.Status != "" && !isValidReturnStatus(req.Status) {
		return nil, errors.New("invalid status")
	}

	page := req.Page
	if page < 1 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize < 1 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	// status counts ไม่ผูกกับ status filter เพื่อให้ทุกปุ่มเห็นตัวเลขครบ
	rawCounts, err := s.repo.GetStatusCounts(req.Search)
	if err != nil {
		return nil, err
	}
	fullCounts := ensureAllStatuses(rawCounts)

	returns, filteredCount, err := s.repo.GetList(req.Search, req.Status, pageSize, offset)
	if err != nil {
		return nil, err
	}

	totalCount := filteredCount
	if req.Status == "" {
		var sum int64
		for _, c := range fullCounts {
			sum += c.Count
		}
		totalCount = sum
	}

	items := make([]reDto.ReturnListItem, 0, len(returns))
	for _, r := range returns {
		var approvedAtStr *string
		if r.ApprovedAt != nil {
			s := r.ApprovedAt.Format("2006-01-02 15:04:05")
			approvedAtStr = &s
		}
		var refundedAtStr *string
		if r.RefundedAt != nil {
			s := r.RefundedAt.Format("2006-01-02 15:04:05")
			refundedAtStr = &s
		}
		items = append(items, reDto.ReturnListItem{
			ID:              r.ID,
			ReturnNumber:    r.ReturnNumber,
			OriginalOrderID: r.OriginalOrderID,
			Status:          r.Status,
			Reason:          r.Reason,
			RefundAmount:    r.RefundAmount,
			RefundMethod:    r.RefundMethod,
			RequestedAt:     r.RequestedAt.Format("2006-01-02 15:04:05"),
			ApprovedAt:      approvedAtStr,
			RefundedAt:      refundedAtStr,
			Note:            r.Note,
		})
	}

	return &reDto.GetReturnsResponse{
		Data:         items,
		StatusCounts: fullCounts,
		TotalCount:   totalCount,
		Page:         page,
		PageSize:     pageSize,
	}, nil
}

func (s *returnService) SearchReturnableSaleOrders(keyword string) ([]reDto.ReturnableSaleOrderDTO, error) {
	orders, err := s.repo.SearchReturnableSaleOrders(keyword)
	if err != nil {
		return nil, err
	}

	results := make([]reDto.ReturnableSaleOrderDTO, 0, len(orders))
	for _, order := range orders {
		custName := "ไม่ระบุ"
		if order.Customer.CustomerName != "" {
			custName = order.Customer.CustomerName
		} else if order.CustomerNameTemp != nil && *order.CustomerNameTemp != "" {
			custName = *order.CustomerNameTemp
		}

		empName := "ไม่ระบุ"
		if order.CreatedBy != nil {
			if order.CreatedBy.FirstName != "" {
				empName = strings.TrimSpace(order.CreatedBy.FirstName + " " + order.CreatedBy.LastName)
			} else if order.CreatedBy.Username != "" {
				empName = order.CreatedBy.Username
			}
		}

		soldAt := order.OrderDate.Format(time.RFC3339)
		if order.OrderDate.IsZero() {
			soldAt = order.CreatedAt.Format(time.RFC3339)
		}

		items := make([]reDto.ReturnableSaleOrderItemDTO, 0, len(order.Items))
		for _, item := range order.Items {
			prodCode := item.PartNumber
			if prodCode == "" && item.Product.Product_Code != "" {
				prodCode = item.Product.Product_Code
			}
			prodName := item.ProductName
			if prodName == "" && item.Product.Product_Name != "" {
				prodName = item.Product.Product_Name
			}
			price := item.FinalUnitPrice
			if price <= 0 {
				price = item.UnitPrice
			}

			items = append(items, reDto.ReturnableSaleOrderItemDTO{
				ProductID:   item.ProductID,
				ProductName: prodName,
				ProductCode: prodCode,
				Quantity:    item.Qty,
				UnitPrice:   price,
			})
		}

		results = append(results, reDto.ReturnableSaleOrderDTO{
			ID:           order.ID,
			OrderNumber:  order.OrderNumber,
			SoldAt:       soldAt,
			CustomerID:   order.CustomerID,
			CustomerName: custName,
			EmployeeName: empName,
			Items:        items,
		})
	}

	return results, nil
}

func (s *returnService) GetReturnByID(id uint) (*reDto.ReturnDetailResponseDTO, error) {
	returnEntity, err := s.repo.GetReturnByID(id)
	if err != nil {
		return nil, err
	}
	res := reDto.ToReturnDetailResponseDTO(returnEntity)
	return &res, nil
}

func (s *returnService) CreateReturn(input reDto.CreateReturnDTO, createdBy uint, role string) (*reDto.ReturnDetailResponseDTO, error) {
	returnEntity := input.ToEntity()
	if createdBy != 0 {
		returnEntity.CreatedBy = createdBy
	} else if returnEntity.CreatedBy == 0 {
		returnEntity.CreatedBy = 1
	}

	// Approval is decided from the authenticated role. Client-provided approval fields are ignored.
	returnEntity.Status = reEnum.ReturnPending
	returnEntity.ApprovedAt = nil
	returnEntity.ApprovedBy = nil
	role = strings.ToUpper(strings.TrimSpace(role))
	if role == "OWNER" || role == "ADMIN" {
		now := time.Now()
		returnEntity.Status = reEnum.ReturnApproved
		returnEntity.ApprovedAt = &now
		returnEntity.ApprovedBy = &returnEntity.CreatedBy
	}

	itemsInput := input.SalesReturnItems
	if len(itemsInput) == 0 {
		itemsInput = input.Items
	}

	items := make([]reEntity.SalesReturnItem, 0, len(itemsInput))
	var calculatedRefund float64
	for _, itemIn := range itemsInput {
		calculatedRefund += float64(itemIn.Quantity) * itemIn.UnitPrice
		items = append(items, reEntity.SalesReturnItem{
			ProductID: itemIn.ProductID,
			Quantity:  itemIn.Quantity,
			UnitPrice: itemIn.UnitPrice,
			Subtotal:  float64(itemIn.Quantity) * itemIn.UnitPrice,
		})
	}

	if returnEntity.RefundAmount <= 0 && calculatedRefund > 0 {
		returnEntity.RefundAmount = calculatedRefund
	}

	if err := s.repo.CreateReturn(&returnEntity, items); err != nil {
		return nil, err
	}

	created, err := s.repo.GetReturnByID(returnEntity.ID)
	if err != nil {
		res := reDto.ToReturnDetailResponseDTO(&returnEntity)
		return &res, nil
	}

	res := reDto.ToReturnDetailResponseDTO(created)
	return &res, nil
}

func (s *returnService) UpdateReturn(id uint, input reDto.UpdateReturnDTO, approvedBy uint) (*reDto.ReturnDetailResponseDTO, error) {
	existing, err := s.repo.GetReturnByID(id)
	if err != nil {
		return nil, err
	}
	if existing.Status == reEnum.ReturnRefunded {
		return nil, reRepo.ErrReturnAlreadyProcessed
	}

	updated := input.ToEntity(*existing)
	// Approval metadata is server-owned; never accept it from the request body.
	updated.ApprovedAt = existing.ApprovedAt
	updated.ApprovedBy = existing.ApprovedBy
	if input.Status != "" {
		status := reEnum.ReturnStatus(strings.ToUpper(strings.TrimSpace(input.Status)))
		if !isValidReturnStatus(string(status)) {
			return nil, ErrInvalidReturnStatus
		}
		if status == reEnum.ReturnRefunded {
			return nil, ErrInvalidReturnStatus
		}
		if status == reEnum.ReturnPending && existing.Status != reEnum.ReturnPending {
			return nil, reRepo.ErrReturnAlreadyProcessed
		}
		if status == reEnum.ReturnApproved {
			if existing.Status == reEnum.ReturnApproved {
				return s.GetReturnByID(id)
			}
			if existing.Status != reEnum.ReturnPending {
				return nil, reRepo.ErrReturnAlreadyProcessed
			}
			if err := s.repo.ApproveReturn(id, approvedBy); err != nil {
				return nil, err
			}

			refetched, err := s.repo.GetReturnByID(id)
			if err != nil {
				return nil, err
			}
			res := reDto.ToReturnDetailResponseDTO(refetched)
			return &res, nil
		}
		if status == reEnum.ReturnRejected && existing.Status != reEnum.ReturnPending {
			return nil, reRepo.ErrReturnAlreadyProcessed
		}
		updated.Status = status
		if status == reEnum.ReturnApproved || status == reEnum.ReturnRejected {
			now := time.Now()
			updated.ApprovedAt = &now
			if approvedBy != 0 {
				updated.ApprovedBy = &approvedBy
			}
		}
	}

	if err := s.repo.UpdateReturn(&updated); err != nil {
		return nil, err
	}

	refetched, err := s.repo.GetReturnByID(id)
	if err != nil {
		res := reDto.ToReturnDetailResponseDTO(&updated)
		return &res, nil
	}

	res := reDto.ToReturnDetailResponseDTO(refetched)
	return &res, nil
}

func (s *returnService) ProcessRefund(id uint, processedBy uint) (*reDto.ReturnDetailResponseDTO, error) {
	if err := s.repo.ProcessRefund(id, processedBy); err != nil {
		return nil, err
	}
	return s.GetReturnByID(id)
}

func (s *returnService) DeleteReturn(id uint) error {
	return s.repo.DeleteReturn(id)
}

func ensureAllStatuses(counts []reDto.ReturnStatusCount) []reDto.ReturnStatusCount {
	all := []reEnum.ReturnStatus{reEnum.ReturnPending, reEnum.ReturnApproved, reEnum.ReturnRefunded, reEnum.ReturnRejected}
	m := make(map[reEnum.ReturnStatus]int64)
	for _, c := range counts {
		m[c.Status] = c.Count
	}
	result := make([]reDto.ReturnStatusCount, 0, len(all))
	for _, s := range all {
		result = append(result, reDto.ReturnStatusCount{Status: s, Count: m[s]})
	}
	return result
}

func isValidReturnStatus(s string) bool {
	switch reEnum.ReturnStatus(s) {
	case reEnum.ReturnPending, reEnum.ReturnApproved, reEnum.ReturnRefunded, reEnum.ReturnRejected:
		return true
	}
	return false
}
