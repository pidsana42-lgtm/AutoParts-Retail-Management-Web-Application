package pos

import (
	"context"
	"fmt"
	"strconv"

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

// GenerateCustomerStatementPDF ดึงข้อมูลสรุปยอดและส่งต่อให้โมดูล PDF สร้างเอกสาร
func (s *paymentService) GenerateCustomerStatementPDF(ctx context.Context, customerID uint, startDate, endDate string) ([]byte, error) {
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

	// 3. ดึงประวัติการชำระเงิน (Repayments & Direct Payments)
	repayments, _ := s.paymentRepo.GetRepaymentsByCustomerAndDate(customerID, startDate, endDate)
	directPayments, _ := s.paymentRepo.GetDirectPaymentsByCustomerAndDate(customerID, startDate, endDate)

	// 4. ดึงบิลที่ยังค้างชำระในปัจจุบัน
	unpaidOrders, _ := s.paymentRepo.GetUnpaidOrdersByCustomerID(customerID)

	return posPdf.GenerateCustomerStatementPDF(customer, companyData, startDate, endDate, repayments, directPayments, unpaidOrders)
}
