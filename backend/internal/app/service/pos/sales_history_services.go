package pos

import (
	"backend/internal/app/dto/pos"
	salesHistoryRepo "backend/internal/app/repository/pos"
	"math"
)

type SalesHistoryService interface {
	GetSalesHistory(req pos.SalesHistoryFilterRequest) (*pos.SalesHistoryPaginationResponse, error)
}

type salesHistoryService struct {
	salesHistoryRepo salesHistoryRepo.SalesHistoryRepository
}

func NewSalesHistoryService(salesHistoryRepo salesHistoryRepo.SalesHistoryRepository) SalesHistoryService {
	return &salesHistoryService{salesHistoryRepo: salesHistoryRepo}
}

func (s *salesHistoryService) GetSalesHistory(req pos.SalesHistoryFilterRequest) (*pos.SalesHistoryPaginationResponse, error) {
	orders, totalRows, err := s.salesHistoryRepo.GetSalesHistory(req)
	if err != nil {
		return nil, err
	}

	items := pos.ToSalesHistoryItemResponseList(orders)

	// กำหนดค่า default ให้ Page
	page := req.Page
	if page <= 0 {
		page = 1
	}

	// คำนวณ TotalPages แบบเช็ค Limit
	totalPages := 1
	if req.Limit > 0 {
		totalPages = int(math.Ceil(float64(totalRows) / float64(req.Limit)))
	} else {
		// ถ้า req.Limit <= 0 (ดึงทั้งหมด) หน้าทั้งหมดจะมีแค่ 1 หน้า
		totalPages = 1
	}

	return &pos.SalesHistoryPaginationResponse{
		Items:      items,
		Page:       page,
		Limit:      req.Limit,
		TotalRows:  totalRows,
		TotalPages: totalPages,
	}, nil
}