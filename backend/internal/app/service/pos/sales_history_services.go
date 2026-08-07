package pos

import (
	"backend/internal/app/dto/pos"
	salesHistoryRepo "backend/internal/app/repository/pos"
	"math"
	"context"
	"backend/internal/app/enum"
	"errors"
)

type SalesHistoryService interface {
	GetSalesHistory(req pos.SalesHistoryFilterRequest) (*pos.SalesHistoryPaginationResponse, error)
	GetSaleHistoryByID(ctx context.Context, identifier string) (*pos.GetSaleHistoryByIDResponse, error)
	RequestCancelSale(ctx context.Context, identifier string, userID uint, req pos.RequestCancelOrderRequest) error
	ApproveCancelSale(ctx context.Context, identifier string, req pos.ProcessCancelOrderRequest) error
	RejectCancelSale(ctx context.Context, identifier string, req pos.ProcessCancelOrderRequest) error
	GetCancellationRequests(ctx context.Context, req pos.SalesHistoryFilterRequest) (*pos.SalesHistoryPaginationResponse, error)
    GetMyCancellationRequests(ctx context.Context, userID uint, req pos.SalesHistoryFilterRequest) (*pos.SalesHistoryPaginationResponse, error)
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

func (s *salesHistoryService) GetSaleHistoryByID(ctx context.Context, identifier string) (*pos.GetSaleHistoryByIDResponse, error) {
	// เรียก Repository ดึงข้อมูล SaleOrder + Relations (Preload) โดยส่ง identifier (string)
	order, err := s.salesHistoryRepo.GetSaleHistoryByID(identifier)
	if err != nil {
		return nil, err
	}

	// แปลง Entity -> DTO Response โดยใช้ Mapper Function ที่เตรียมไว้ (*order เพื่อ Dereference Pointer)
	response := pos.ToGetSaleHistoryByIDResponse(*order)

	// ส่ง Pointer ของ DTO Response กลับไป
	return &response, nil
}

// ส่งคำขอยกเลิก
func (s *salesHistoryService) RequestCancelSale(ctx context.Context, identifier string, userID uint, req pos.RequestCancelOrderRequest) error {
    order, err := s.salesHistoryRepo.GetSaleHistoryByID(identifier)
    if err != nil {
    	return err
    }

	if order.Status == enum.OrderCancelled {
		return errors.New("รายการนี้ถูกยกเลิกไปแล้ว")
	}
	if order.Status == enum.OrderPendingCancel {
		return errors.New("รายการนี้อยู่ระหว่างรออนุมัติการยกเลิกอยู่แล้ว")
	}

    return s.salesHistoryRepo.RequestCancelOrder(order.ID, userID, req.Reason)
}

// เจ้าของร้านอนุมัติ
func (s *salesHistoryService) ApproveCancelSale(ctx context.Context, identifier string, req pos.ProcessCancelOrderRequest) error {
	order, err := s.salesHistoryRepo.GetSaleHistoryByID(identifier)
	if err != nil {
		return err
	}

	if order.Status != enum.OrderPendingCancel {
		return errors.New("รายการนี้ไม่ได้อยู่ในสถานะรออนุมัติการยกเลิก")
	}

	return s.salesHistoryRepo.ApproveCancelOrder(order, req.Remark)
}

// เจ้าของร้านปฏิเสธ
func (s *salesHistoryService) RejectCancelSale(ctx context.Context, identifier string, req pos.ProcessCancelOrderRequest) error {
	order, err := s.salesHistoryRepo.GetSaleHistoryByID(identifier)
	if err != nil {
		return err
	}

	if order.Status != enum.OrderPendingCancel {
		return errors.New("รายการนี้ไม่ได้อยู่ในสถานะรออนุมัติการยกเลิก")
	}

	return s.salesHistoryRepo.RejectCancelOrder(order.ID, req.Remark)
}

func (s *salesHistoryService) GetCancellationRequests(ctx context.Context, req pos.SalesHistoryFilterRequest) (*pos.SalesHistoryPaginationResponse, error) {
    orders, totalRows, err := s.salesHistoryRepo.GetCancellationRequests(req)
    if err != nil {
        return nil, err
    }

    items := pos.ToSalesHistoryItemResponseList(orders)
    page := req.Page
    if page <= 0 { page = 1 }

    totalPages := 1
    if req.Limit > 0 {
        totalPages = int(math.Ceil(float64(totalRows) / float64(req.Limit)))
    }

    return &pos.SalesHistoryPaginationResponse{
        Items:      items,
        Page:       page,
        Limit:      req.Limit,
        TotalRows:  totalRows,
        TotalPages: totalPages,
    }, nil
}

func (s *salesHistoryService) GetMyCancellationRequests(ctx context.Context, userID uint, req pos.SalesHistoryFilterRequest) (*pos.SalesHistoryPaginationResponse, error) {
    orders, totalRows, err := s.salesHistoryRepo.GetMyCancellationRequests(userID, req)
    if err != nil {
        return nil, err
    }

    items := pos.ToSalesHistoryItemResponseList(orders)
    page := req.Page
    if page <= 0 { page = 1 }

    totalPages := 1
    if req.Limit > 0 {
        totalPages = int(math.Ceil(float64(totalRows) / float64(req.Limit)))
    }

    return &pos.SalesHistoryPaginationResponse{
        Items:      items,
        Page:       page,
        Limit:      req.Limit,
        TotalRows:  totalRows,
        TotalPages: totalPages,
    }, nil
}