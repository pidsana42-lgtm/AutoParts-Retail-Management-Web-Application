package pos

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"backend/internal/app/entity"
	posPdf "backend/internal/app/service/pos/pdf"
)

// ThaiBahtText re-exports ThaiBahtText from posPdf for backwards compatibility and unit tests
func ThaiBahtText(amount float64) string {
	return posPdf.ThaiBahtText(amount)
}

// GenerateSaleOrderPDF ดึงข้อมูลคำสั่งซื้อจาก DB และส่งต่อให้โมดูล PDF สร้างเอกสาร
func (s *salesHistoryService) GenerateSaleOrderPDF(ctx context.Context, identifier string, customTitle string) ([]byte, error) {
	// 1. ดึงข้อมูลจริงจาก Database
	order, err := s.salesHistoryRepo.GetSaleHistoryByID(identifier)
	if err != nil {
		return nil, fmt.Errorf("could not get sale order: %w", err)
	}

	companyData, err := s.salesHistoryRepo.GetCompanySetting(ctx)
	if err != nil || companyData == nil {
		companyData = nil
	}

	return posPdf.GenerateSaleOrderPDF(order, companyData, customTitle)
}

// GenerateDebtRepaymentReceiptPDF ดึงข้อมูลการชำระหนี้จาก DB และส่งต่อให้โมดูล PDF สร้างเอกสาร
func (s *paymentService) GenerateDebtRepaymentReceiptPDF(ctx context.Context, identifier string) ([]byte, error) {
	// 1. ค้นหารายการ Repayment
	var repayments []entity.PaymentRepayment

	id, err := strconv.ParseUint(identifier, 10, 64)
	if err == nil && id > 0 {
		singleRepayment, err := s.paymentRepo.GetRepaymentByID(uint(id))
		if err == nil && singleRepayment != nil && singleRepayment.ID > 0 {
			if singleRepayment.ReceiptNumber != "" {
				sameReceiptRepayments, err := s.paymentRepo.GetRepaymentsByReceiptNumber(singleRepayment.ReceiptNumber)
				if err == nil && len(sameReceiptRepayments) > 0 {
					repayments = sameReceiptRepayments
				} else {
					repayments = []entity.PaymentRepayment{*singleRepayment}
				}
			} else {
				repayments = []entity.PaymentRepayment{*singleRepayment}
			}
		}
	}

	if len(repayments) == 0 {
		sameReceiptRepayments, err := s.paymentRepo.GetRepaymentsByReceiptNumber(identifier)
		if err == nil && len(sameReceiptRepayments) > 0 {
			repayments = sameReceiptRepayments
		}
	}

	if len(repayments) == 0 {
		return nil, fmt.Errorf("could not find repayment receipt with identifier: %s", identifier)
	}

	// 2. ดึงข้อมูลบริษัท
	companyData, err := s.paymentRepo.GetCompanySetting(ctx)
	if err != nil || companyData == nil {
		companyData = nil
	}

	// 3. ฟังก์ชันดึงยอดชำระก่อนหน้า
	getPreviousRepaymentsSum := func(orderID, repaymentID uint) (float64, error) {
		return s.paymentRepo.GetPreviousRepaymentsSum(orderID, repaymentID)
	}

	return posPdf.GenerateDebtRepaymentReceiptPDF(repayments, companyData, getPreviousRepaymentsSum)
}

// matchPaymentMethod ตรวจสอบว่าชื่อช่องทางชำระเงินตรงกับตัวกรองที่เลือกหรือไม่
func matchPaymentMethod(methodName, queryMethod string) bool {
	q := strings.ToUpper(strings.TrimSpace(queryMethod))
	m := strings.ToUpper(strings.TrimSpace(methodName))
	if q == "" {
		return true
	}
	if q == "เงินสด" || strings.Contains(q, "CASH") {
		return strings.Contains(m, "เงินสด") || strings.Contains(m, "CASH")
	}
	if q == "QR" || strings.Contains(q, "TRANSFER") || strings.Contains(q, "โอน") {
		return strings.Contains(m, "QR") || strings.Contains(m, "TRANSFER") || strings.Contains(m, "โอน") || strings.Contains(m, "พร้อมเพย์") || strings.Contains(m, "PROMPTPAY")
	}
	return strings.Contains(m, q)
}

// GenerateCustomerStatementPDF ดึงข้อมูลสรุปยอดและส่งต่อให้โมดูล PDF สร้างเอกสาร
func (s *paymentService) GenerateCustomerStatementPDF(
	ctx context.Context,
	customerID uint,
	startDate, endDate string,
	paymentType, status, paymentMethod string,
) ([]byte, error) {
	// 1. ดึงข้อมูลลูกค้า
	customer, err := s.paymentRepo.GetCustomerByID(ctx, customerID)
	if err != nil {
		return nil, fmt.Errorf("could not get customer: %w", err)
	}

	// 2. ดึงข้อมูลบริษัท
	companyData, err := s.paymentRepo.GetCompanySetting(ctx)
	if err != nil || companyData == nil {
		companyData = nil
	}

	// 3. ดึงประวัติการชำระเงิน (Repayments & Direct Payments) พร้อมกรองตามเงื่อนไข
	var repayments []entity.PaymentRepayment
	var directPayments []entity.Payment

	// ถ้าไม่ได้เจาะจงเฉพาะ "ชำระสดหน้าร้าน" (payment) ให้ดึง repayments
	if !strings.EqualFold(paymentType, "payment") {
		allRepayments, _ := s.paymentRepo.GetRepaymentsByCustomerAndDate(customerID, startDate, endDate)
		for _, r := range allRepayments {
			if status != "" && !strings.EqualFold(r.Status, status) {
				continue
			}
			if paymentMethod != "" && !matchPaymentMethod(r.PaymentMethod.MethodName, paymentMethod) {
				continue
			}
			repayments = append(repayments, r)
		}
	}

	// ถ้าไม่ได้เจาะจงเฉพาะ "ชำระหนี้เงินเชื่อ" (repayment) ให้ดึง directPayments
	if !strings.EqualFold(paymentType, "repayment") {
		allDirectPayments, _ := s.paymentRepo.GetDirectPaymentsByCustomerAndDate(customerID, startDate, endDate)
		for _, p := range allDirectPayments {
			orderStatus := "completed"
			if strings.EqualFold(string(p.Order.Status), "cancelled") {
				orderStatus = "cancelled"
			}
			if status != "" && !strings.EqualFold(orderStatus, status) {
				continue
			}
			if paymentMethod != "" && !matchPaymentMethod(p.PaymentMethod.MethodName, paymentMethod) {
				continue
			}
			directPayments = append(directPayments, p)
		}
	}

	// 4. ดึงบิลที่ยังค้างชำระในปัจจุบัน (เฉพาะเมื่อไม่ได้กรองเฉพาะชำระสดหน้าร้าน และไม่ได้กรองเฉพาะสถานะยกเลิก)
	var unpaidOrders []entity.SaleOrder
	if !strings.EqualFold(paymentType, "payment") && !strings.EqualFold(status, "cancelled") {
		orders, _ := s.paymentRepo.GetUnpaidOrdersByCustomerID(customerID)
		unpaidOrders = orders
	}

	filterOpts := posPdf.CustomerStatementFilterOptions{
		PaymentType:   paymentType,
		Status:        status,
		PaymentMethod: paymentMethod,
	}

	return posPdf.GenerateCustomerStatementPDF(customer, companyData, startDate, endDate, filterOpts, repayments, directPayments, unpaidOrders)
}
