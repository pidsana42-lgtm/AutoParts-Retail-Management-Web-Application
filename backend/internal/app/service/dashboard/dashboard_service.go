package dashboard

import (
	"context"
	"sort"
	"time"

	"backend/config"
	dashDto "backend/internal/app/dto/dashboard"
	"backend/internal/app/entity"
	"backend/internal/app/enum"
	dashRepo "backend/internal/app/repository/dashboard"
)

type DashboardService interface {
	GetSummaryData(ctx context.Context, query dashDto.SummaryQuery) (*dashDto.SummaryResponse, error)
	GetRecentSales(ctx context.Context, query dashDto.SummaryQuery, page, pageSize int) (*dashDto.RecentSalesResponse, error)
	GetAgingStock(ctx context.Context, thresholdDays int) ([]dashDto.AgingStockDTO, error)
	GetStockHealth(ctx context.Context) (*dashDto.StockHealthDTO, error)
	GetIncomeSummary(ctx context.Context, query dashDto.SummaryQuery) (*dashDto.RevenueBreakdownResponse, error)
	GetTopSellers(ctx context.Context, query dashDto.SummaryQuery, limit int) ([]dashDto.TopSellerDTO, error)
	GetDebtAging(ctx context.Context, query dashDto.DebtAgingQuery) (*dashDto.DebtAgingResponse, error)
}

type dashboardService struct {
	dashboardRepository dashRepo.DashboardRepository
}

func NewDashboardService(
	dashRepo dashRepo.DashboardRepository,
) DashboardService {
	return &dashboardService{
		dashboardRepository: dashRepo,
	}
}

func (s *dashboardService) GetSummaryData(ctx context.Context, query dashDto.SummaryQuery) (*dashDto.SummaryResponse, error) {
	if err := dashDto.ValidateSummaryQuery(query); err != nil {
		return nil, err
	}
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	// refNow ใช้สำหรับคำนวณ period boundary เท่านั้น (weekly/monthly/etc.)
	// ถ้ามี ref_date → shift anchor ไปยัง period ก่อนหน้า เช่น previous month
	refNow := now
	if query.RefDate != "" {
		if parsed, err := time.ParseInLocation("2006-01-02", query.RefDate, now.Location()); err == nil {
			refNow = parsed
		}
	}

	var summaries []entity.DailySummary

	// กรณีระบุวันเดียว
	if query.SummaryDate != "" {
		d, err := time.ParseInLocation("2006-01-02", query.SummaryDate, now.Location())
		if err != nil {
			return nil, err
		}
		if d.Equal(today) {
			live, err := s.dashboardRepository.GetLiveSummaryForDate(ctx, today)
			if err != nil {
				return nil, err
			}
			summaries = []entity.DailySummary{*live}
		} else {
			hist, err := s.dashboardRepository.GetHistoricalSummaries(ctx, d, d.AddDate(0, 0, 1))
			if err != nil {
				return nil, err
			}
			summaries = hist
		}
	} else {
		start, end, hasRange := resolveDateRange(query, refNow)
		if !hasRange {
			// ไม่ระบุ filter -> เอาแค่วันนี้ + ย้อนหลัง 30 วันเป็น default (กันดึงทั้ง table)
			start, end = today.AddDate(0, 0, -30), today.AddDate(0, 0, 1)
		}

		histEnd := end
		includeToday := false
		if !today.Before(start) && today.Before(end) {
			includeToday = true
			histEnd = today
		}

		if start.Before(histEnd) {
			hist, err := s.dashboardRepository.GetHistoricalSummaries(ctx, start, histEnd)
			if err != nil {
				return nil, err
			}
			summaries = append(summaries, hist...)
		}

		if includeToday {
			live, err := s.dashboardRepository.GetLiveSummaryForDate(ctx, today)
			if err != nil {
				return nil, err
			}
			summaries = append(summaries, *live)
		}
	}

	sort.Slice(summaries, func(i, j int) bool {
		return summaries[i].SummaryDate.After(summaries[j].SummaryDate)
	})

	data := make([]dashDto.DisplayDashboardDTO, 0) // make(..., 0) กัน nil slice marshal เป็น null ตอน summaries ว่างเปล่า
	for _, d := range summaries {
		data = append(data, dashDto.DisplayDashboardDTO{
			SummaryDate:             d.SummaryDate,
			TotalOrders:             d.TotalOrders,
			TotalItemsSold:          d.TotalItemsSold,
			OverdueDebtCount:        d.OverdueDebtCount,
			TotalRevenue:            d.TotalRevenue,
			NetRevenue:              d.NetRevenue,
			TotalCost:               d.TotalCost,
			GrossProfit:             d.GrossProfit,
			MarginPercent:           d.MarginPercent,
			CashAmount:              d.CashAmount,
			TransferAmount:          d.TransferAmount,
			CreditAmount:            d.CreditAmount,
			WalkinCustomerAmount:    d.WalkinCustomerAmount,
			GarageCustomerAmount:    d.GarageCustomerAmount,
			CorporateCustomerAmount: d.CorporateCustomerAmount,
			ReturnAmount:            d.ReturnAmount,
			CollectedDebtAmount:     d.CollectedDebtAmount,
			TotalOutstandingDebt:    d.TotalOutstandingDebt,
		})
	}

	return &dashDto.SummaryResponse{SummaryData: data, Total: int64(len(data))}, nil
}

var orderStatusLabel = map[enum.OrderStatus]string{
	enum.OrderPending:       "รอดำเนินการ",
	enum.OrderPendingCancel: "รอยกเลิก",
	enum.OrderCompleted:     "สำเร็จ",
	enum.OrderCancelled:     "ยกเลิกแล้ว",
	enum.OrderReturned:      "คืนสินค้า",
	enum.OrderRefunded:      "คืนเงินแล้ว",
	enum.OrderClaimed:       "เคลม",
}

func (s *dashboardService) GetRecentSales(ctx context.Context, query dashDto.SummaryQuery, page, pageSize int) (*dashDto.RecentSalesResponse, error) {
	if err := dashDto.ValidateSummaryQuery(query); err != nil {
		return nil, err
	}
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 10
	}
	if pageSize > 100 {
		pageSize = 100
	}

	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	var start, end time.Time
	if query.SummaryDate != "" {
		d, err := time.ParseInLocation("2006-01-02", query.SummaryDate, now.Location())
		if err != nil {
			return nil, err
		}
		start, end = d, d.AddDate(0, 0, 1)
	} else if s2, e2, ok := resolveDateRange(query, now); ok {
		start, end = s2, e2
	} else {
		// ไม่ระบุ filter -> default เป็นวันนี้
		start, end = today, today.AddDate(0, 0, 1)
	}

	orders, total, err := s.dashboardRepository.GetRecentSaleOrders(ctx, start, end, page, pageSize)
	if err != nil {
		return nil, err
	}

	result := make([]dashDto.RecentSaleDTO, len(orders))
	for i, o := range orders {
		result[i] = dashDto.RecentSaleDTO{
			ID:            o.ID,
			OrderNumber:   o.OrderNumber,
			Time:          o.CreatedAt,
			TotalAmount:   o.TotalAmount,
			OrderStatus:   resolveOrderStatusLabel(o.Status),
			PaymentMethod: resolvePaymentMethodLabel(o),
		}
	}
	return &dashDto.RecentSalesResponse{
		Data:     result,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

func resolveOrderStatusLabel(status enum.OrderStatus) string {
	if label, ok := orderStatusLabel[status]; ok {
		return label
	}
	return string(status)
}

func resolvePaymentMethodLabel(o entity.SaleOrder) string {
	if o.PaymentMethod == nil {
		return "-"
	}
	return string(o.PaymentMethod.MethodName)
}

func (s *dashboardService) GetAgingStock(ctx context.Context, thresholdDays int) ([]dashDto.AgingStockDTO, error) {
	if thresholdDays <= 0 {
		thresholdDays = config.GetEnvInt("AGING_STOCK_THRESHOLD_DAYS", 180)
	}

	products, err := s.dashboardRepository.GetProductsInStock(ctx)
	if err != nil {
		return nil, err
	}
	lastSoldMap, err := s.dashboardRepository.GetLastSoldDates(ctx)
	if err != nil {
		return nil, err
	}

	now := time.Now()

	type agingItem struct {
		product   entity.Product
		lastSold  *time.Time
		daysAging int
	}

	var candidates []agingItem
	for _, p := range products {
		var lastSold *time.Time
		// Legacy/imported products may have no import date. Never subtract Go's
		// zero time: time.Duration saturates and produces an apparent 106751 days.
		basis := p.Import_DateTime
		if basis.IsZero() {
			basis = p.CreatedAt
		}

		if ls, ok := lastSoldMap[p.ID]; ok && !ls.IsZero() {
			t := ls
			lastSold = &t
			basis = ls
		}
		// Unknown or future dates cannot establish that stock is old.
		if basis.IsZero() || basis.After(now) {
			continue
		}
		daysAging := int(now.Sub(basis).Hours() / 24)

		if daysAging > thresholdDays {
			candidates = append(candidates, agingItem{product: p, lastSold: lastSold, daysAging: daysAging})
		}
	}

	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].daysAging > candidates[j].daysAging
	})

	result := make([]dashDto.AgingStockDTO, len(candidates))
	for i, c := range candidates {
		unitName := "-"
		if c.product.Unit != nil && c.product.Unit.Unit_Name != "" {
			unitName = c.product.Unit.Unit_Name
		}
		result[i] = dashDto.AgingStockDTO{
			Rank:         i + 1,
			ProductCode:  c.product.Product_Code,
			ProductName:  c.product.Product_Name,
			LastSoldDate: c.lastSold,
			DaysAging:    c.daysAging,
			RemainingQty: c.product.Quantity,
			Unit:         unitName,
			SunkValue:    c.product.Cost_price * float64(c.product.Quantity),
		}
	}
	return result, nil
}

func (s *dashboardService) GetStockHealth(ctx context.Context) (*dashDto.StockHealthDTO, error) {
	return s.dashboardRepository.GetStockHealth(ctx)
}

func (s *dashboardService) GetIncomeSummary(ctx context.Context, query dashDto.SummaryQuery) (*dashDto.RevenueBreakdownResponse, error) {
	result, err := s.GetSummaryData(ctx, query)
	if err != nil {
		return nil, err
	}

	var general, garage, corporate float64
	var cash, transfer, credit float64
	for _, d := range result.SummaryData {
		general += d.WalkinCustomerAmount
		garage += d.GarageCustomerAmount
		corporate += d.CorporateCustomerAmount
		cash += d.CashAmount
		transfer += d.TransferAmount
		credit += d.CreditAmount
	}

	return &dashDto.RevenueBreakdownResponse{
		CustomerData: []dashDto.ChartDatumDTO{
			{Name: "ลูกค้าทั่วไป", Value: general, Fill: "#B70011"},
			{Name: "ลูกค้าอู่ซ่อมรถ", Value: garage, Fill: "#FF9999"},
			{Name: "ลูกค้าบริษัท", Value: corporate, Fill: "#FFC9C9"},
		},
		PaymentData: []dashDto.ChartDatumDTO{
			{Name: enum.PaymentMethodCash, Value: cash, Fill: "#005E8D"},
			{Name: enum.PaymentMethodQR, Value: transfer, Fill: "#CBE6FF"},
			{Name: enum.PaymentMethodCredit, Value: credit, Fill: "#E0ECF8"},
		},
	}, nil
}

func (s *dashboardService) GetTopSellers(ctx context.Context, query dashDto.SummaryQuery, limit int) ([]dashDto.TopSellerDTO, error) {
	if err := dashDto.ValidateSummaryQuery(query); err != nil {
		return nil, err
	}
	if limit <= 0 {
		limit = 10
	}

	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	var start, end time.Time
	if query.SummaryDate != "" {
		d, err := time.ParseInLocation("2006-01-02", query.SummaryDate, now.Location())
		if err != nil {
			return nil, err
		}
		start, end = d, d.AddDate(0, 0, 1)
	} else if s2, e2, ok := resolveDateRange(query, now); ok {
		start, end = s2, e2
	} else {
		start, end = today, today.AddDate(0, 0, 1)
	}

	return s.dashboardRepository.GetTopSellers(ctx, start, end, limit)
}

func (s *dashboardService) GetDebtAging(ctx context.Context, query dashDto.DebtAgingQuery) (*dashDto.DebtAgingResponse, error) {
	if err := dashDto.ValidateDebtAgingQuery(query); err != nil {
		return nil, err
	}
	data, total, err := s.dashboardRepository.GetDebtAging(ctx, query)
	if err != nil {
		return nil, err
	}
	totalDebtors, err := s.dashboardRepository.GetTotalDebtors(ctx)
	if err != nil {
		return nil, err
	}
	return &dashDto.DebtAgingResponse{
		Data:         data,
		Total:        total,
		TotalDebtors: totalDebtors,
		YearlyTarget: 0,
	}, nil
}

// resolveDateRange คำนวณช่วงวันที่จาก weekly/monthly/quarterly/yearly filter
func resolveDateRange(query dashDto.SummaryQuery, now time.Time) (start, end time.Time, ok bool) {
	daysSinceSunday := int(now.Weekday())
	startOfWeek := time.Date(now.Year(), now.Month(), now.Day()-daysSinceSunday, 0, 0, 0, 0, now.Location())
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	startMonthOfQuarter := time.Month(((int(now.Month())-1)/3)*3 + 1)
	startOfQuarter := time.Date(now.Year(), startMonthOfQuarter, 1, 0, 0, 0, 0, now.Location())
	startOfYear := time.Date(now.Year(), time.January, 1, 0, 0, 0, 0, now.Location())

	switch {
	case query.StartDate != "" && query.EndDate != "":
		s, errS := time.ParseInLocation("2006-01-02", query.StartDate, now.Location())
		e, errE := time.ParseInLocation("2006-01-02", query.EndDate, now.Location())
		if errS == nil && errE == nil {
			return s, e.AddDate(0, 0, 1), true
		}
	case query.StartDate != "":
		s, errS := time.ParseInLocation("2006-01-02", query.StartDate, now.Location())
		if errS == nil {
			return s, s.AddDate(0, 0, 1), true
		}
	case query.Weekly != "":
		return startOfWeek, startOfWeek.AddDate(0, 0, 7), true
	case query.Monthly != "":
		return startOfMonth, startOfMonth.AddDate(0, 1, 0), true
	case query.Quarterly != "":
		return startOfQuarter, startOfQuarter.AddDate(0, 3, 0), true
	case query.Yearly != "":
		return startOfYear, startOfYear.AddDate(1, 0, 0), true
	default:
		return time.Time{}, time.Time{}, false
	}
	return time.Time{}, time.Time{}, false
}
