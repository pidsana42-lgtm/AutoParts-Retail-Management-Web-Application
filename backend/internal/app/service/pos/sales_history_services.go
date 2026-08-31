package pos

import (
	"backend/internal/app/dto/pos"
	"backend/internal/app/entity"
	salesHistoryRepo "backend/internal/app/repository/pos"
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"
	"backend/internal/app/enum"
)

type SalesHistoryService interface {
	GetSalesHistory(req pos.SalesHistoryFilterRequest) (*pos.SalesHistoryPaginationResponse, error)
	GetSaleHistoryByID(ctx context.Context, identifier string) (*pos.GetSaleHistoryByIDResponse, error)
	RequestCancelSale(ctx context.Context, identifier string, userID uint, req pos.RequestCancelOrderRequest) error
	ApproveCancelSale(ctx context.Context, identifier string, userID uint, req pos.ProcessCancelOrderRequest) error
	RejectCancelSale(ctx context.Context, identifier string, req pos.ProcessCancelOrderRequest) error
	RevertCancellationRequest(ctx context.Context, identifier string, userID uint) (*pos.RevertCancellationRequestResponse, error)
	GetCancellationRequests(ctx context.Context, req pos.SalesHistoryFilterRequest) (*pos.SalesHistoryPaginationResponse, error)
	GetMyCancellationRequests(ctx context.Context, userID uint, req pos.SalesHistoryFilterRequest) (*pos.SalesHistoryPaginationResponse, error)
	GetEmployees(ctx context.Context) ([]entity.User, error)
	GenerateSaleOrderPDF(ctx context.Context, identifier string, customTitle string) ([]byte, error)
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

func (s *salesHistoryService) ApproveCancelSale(ctx context.Context, identifier string, userID uint, req pos.ProcessCancelOrderRequest) error {
	order, err := s.salesHistoryRepo.GetSaleHistoryByID(identifier)
	if err != nil {
		return err
	}

	if order.Status != enum.OrderPendingCancel && order.Status != enum.OrderCompleted {
		return errors.New("รายการนี้ไม่อยู่ในสถานะที่สามารถอนุมัติหรือยกเลิกได้")
	}

	// ถ้าเป็นการยกเลิกตรงโดยเจ้าของร้าน (บิลสำเร็จ) ให้บันทึกข้อมูลผู้ยกเลิกและเหตุผลในตารางด้วย
	if order.Status == enum.OrderCompleted {
		order.CancelRequestedByID = &userID
		if req.Remark != "" {
			order.CancelReason = &req.Remark
		} else {
			defaultReason := "ยกเลิกโดยเจ้าของร้าน"
			order.CancelReason = &defaultReason
		}
		now := time.Now()
		order.CancelRequestedAt = &now
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

func (s *salesHistoryService) RevertCancellationRequest(ctx context.Context, identifier string, userID uint) (*pos.RevertCancellationRequestResponse, error) {
	// ไปสั่ง repo ให้ค้นหาข้อมูลนี้ใน DB ว่ามีอยู่จริงหรือไม่ และดึงข้อมูลออกมา
	order, err := s.salesHistoryRepo.GetSaleHistoryByID(identifier)
	if err != nil {
		return nil, err
	}

	// ตรวจสอบว่า order นี้อยู่ในสถานะรออนุมัติการยกเลิกหรือไม่
	if order.Status != enum.OrderPendingCancel {
		return nil, errors.New("รายการนี้ไม่ได้อยู่ในสถานะรออนุมัติการยกเลิก")
	}

	// ตรวจสอบว่า userID ที่ส่งเข้ามาเป็นผู้ที่ส่งคำขอยกเลิกนี้หรือไม่ พนักงานคนอื่นไม่สามารถดึงคำขอยกเลิกของคนอื่นกลับได้
	if order.CancelRequestedByID == nil || *order.CancelRequestedByID != userID {
		return nil, errors.New("ไม่มีสิทธิ์ดึงคำขอยกเลิกนี้กลับ เนื่องจากคุณไม่ได้เป็นผู้ส่งคำขอ")
	}

	// ดึงชื่อผู้ทำรายการกู้คืน
	reverterName := "พนักงาน"
	user, errUser := s.salesHistoryRepo.GetUserByID(userID)
	if errUser == nil && user != nil {
		if user.FirstName != "" || user.LastName != "" {
			reverterName = strings.TrimSpace(user.FirstName + " " + user.LastName)
		} else if user.Username != "" {
			reverterName = user.Username
		}
	} else if order.CancelRequestedBy != nil {
		if order.CancelRequestedBy.FirstName != "" || order.CancelRequestedBy.LastName != "" {
			reverterName = strings.TrimSpace(order.CancelRequestedBy.FirstName + " " + order.CancelRequestedBy.LastName)
		} else if order.CancelRequestedBy.Username != "" {
			reverterName = order.CancelRequestedBy.Username
		}
	}

	now := time.Now()
	revertNote := fmt.Sprintf("กู้คืนคำขอยกเลิกทำรายการโดย: %s (เมื่อ %s)", reverterName, now.Format("02/01/2006 15:04 น."))

	var newNote string
	if order.Note != "" && strings.Contains(order.Note, "กู้คืน") {
		newNote = order.Note + " | " + revertNote
	} else {
		newNote = revertNote
	}

	// สั่ง Repository ให้อัปเดตข้อมูลใน Database
	err = s.salesHistoryRepo.RevertCancelOrder(order.ID, newNote)
	if err != nil {
		return nil, err
	}

	// ส่ง response กลับไปให้ controller
	return &pos.RevertCancellationRequestResponse{
		OrderID: order.ID,
		Status:  string(enum.OrderCompleted),
		Message: "ดึงคำขอยกเลิกบิลกลับสำเร็จ และเปลี่ยนสถานะบิลกลับเป็นสำเร็จเรียบร้อย",
	}, nil
}

func (s *salesHistoryService) GetEmployees(ctx context.Context) ([]entity.User, error) {
	return s.salesHistoryRepo.GetEmployees()
}