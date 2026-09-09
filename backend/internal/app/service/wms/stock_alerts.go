package wms

import (
	wmsDto "backend/internal/app/dto/wms"
	"backend/internal/app/entity"
	wmsRepo "backend/internal/app/repository/wms"
)

type StockAlertService interface {
	Create(req *wmsDto.StockAlertRequestDTO) error
	GetByID(id uint) (*wmsDto.StockAlertResponseDTO, error)
	List(isResolved string) ([]wmsDto.StockAlertResponseDTO, error)
	UpdateResolved(id uint, req *wmsDto.StockAlertUpdateDTO) error
	// CheckAndCreateAlerts: หาสินค้าที่คงเหลือ <= จุดสั่งซื้อที่ตั้งไว้ แล้วสร้าง StockAlert ให้อัตโนมัติเฉพาะตัวที่ยัง
	// ไม่เคยมี alert ค้างอยู่ (กันสร้างซ้ำทุกรอบที่ cron รัน) — คืนเฉพาะ alert ที่สร้างใหม่รอบนี้ ให้ cron เอาไปยิงแจ้งเตือนต่อ
	CheckAndCreateAlerts() ([]wmsDto.StockAlertResponseDTO, error)
}

type stockAlertService struct {
	repo wmsRepo.StockAlertRepository
}

func NewStockAlertService(repo wmsRepo.StockAlertRepository) StockAlertService {
	return &stockAlertService{repo: repo}
}

func (s *stockAlertService) Create(req *wmsDto.StockAlertRequestDTO) error {
	// ค่าเริ่มต้น Is_Resolved = "false" ถ้าไม่ส่งมา
	isResolved := req.Is_Resolved
	if isResolved == "" {
		isResolved = "false"
	}

	sa := entity.StockAlert{
		Alert_type:        req.Alert_type,
		Quantity_At_Alert: req.Quantity_At_Alert,
		Limit_Quantity:    req.Limit_Quantity,
		Is_Resolved:       isResolved,
		ProductID:         &req.ProductID,
	}
	return s.repo.Create(&sa)
}

func (s *stockAlertService) GetByID(id uint) (*wmsDto.StockAlertResponseDTO, error) {
	sa, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	resp := toStockAlertResponse(sa)
	activePOMap, _ := s.repo.GetActivePOAlertMap([]uint{id})
	if poInfo, ok := activePOMap[id]; ok {
		resp.HasPO = true
		resp.POID = &poInfo.POID
		resp.PONumber = poInfo.PONumber
		resp.POCount = poInfo.POCount
		resp.PONumbers = poInfo.PONumbers
	}
	return resp, nil
}

func (s *stockAlertService) List(isResolved string) ([]wmsDto.StockAlertResponseDTO, error) {
	list, err := s.repo.List(isResolved)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return []wmsDto.StockAlertResponseDTO{}, nil
	}

	alertIDs := make([]uint, len(list))
	for i, sa := range list {
		alertIDs[i] = sa.ID
	}

	activePOMap, _ := s.repo.GetActivePOAlertMap(alertIDs)

	result := make([]wmsDto.StockAlertResponseDTO, len(list))
	for i, sa := range list {
		resp := toStockAlertResponse(&sa)
		if poInfo, ok := activePOMap[sa.ID]; ok {
			resp.HasPO = true
			resp.POID = &poInfo.POID
			resp.PONumber = poInfo.PONumber
			resp.POCount = poInfo.POCount
			resp.PONumbers = poInfo.PONumbers
		}
		result[i] = *resp
	}
	return result, nil
}

func (s *stockAlertService) CheckAndCreateAlerts() ([]wmsDto.StockAlertResponseDTO, error) {
	products, err := s.repo.ListLowStockProducts()
	if err != nil {
		return nil, err
	}
	if len(products) == 0 {
		return nil, nil
	}

	alreadyAlerted, err := s.repo.ListUnresolvedAlertProductIDs()
	if err != nil {
		return nil, err
	}

	var created []wmsDto.StockAlertResponseDTO
	for _, p := range products {
		if alreadyAlerted[p.ID] {
			continue
		}

		alertType := "LOW_STOCK"
		if p.Quantity <= 0 {
			alertType = "OUT_OF_STOCK"
		}

		sa := entity.StockAlert{
			Alert_type:        alertType,
			Quantity_At_Alert: p.Quantity,
			Limit_Quantity:    p.Limit_Quantity,
			Is_Resolved:       "false",
			ProductID:         &p.ID,
		}
		if err := s.repo.Create(&sa); err != nil {
			return created, err
		}

		product := p
		sa.Product = &product
		created = append(created, *toStockAlertResponse(&sa))
	}
	return created, nil
}

func (s *stockAlertService) UpdateResolved(id uint, req *wmsDto.StockAlertUpdateDTO) error {
	sa, err := s.repo.GetByID(id)
	if err != nil {
		return err
	}
	sa.Is_Resolved = req.Is_Resolved
	return s.repo.Update(sa)
}

func toStockAlertResponse(sa *entity.StockAlert) *wmsDto.StockAlertResponseDTO {
	res := &wmsDto.StockAlertResponseDTO{
		ID:                sa.ID,
		Alert_type:        sa.Alert_type,
		Quantity_At_Alert: sa.Quantity_At_Alert,
		Limit_Quantity:    sa.Limit_Quantity,
		Is_Resolved:       sa.Is_Resolved,
		ProductID:         sa.ProductID,
		CreatedAt:         sa.CreatedAt,
	}
	if sa.Product != nil {
		res.ProductName = sa.Product.Product_Name
		res.ProductCode = sa.Product.Product_Code
		res.CostPrice = sa.Product.Cost_price
		if sa.Product.Unit != nil {
			res.UnitName = sa.Product.Unit.Unit_Name
		}
		// ดึง supplier จาก inventory ล่าสุด (preloaded ordered by id desc → [0] = newest)
		if len(sa.Product.Inventories) > 0 {
			inv := sa.Product.Inventories[0]
			if inv.Supplier != nil {
				id := inv.Supplier.ID
				res.SupplierID = &id
				res.SupplierName = inv.Supplier.SupplierName
			}
		}
	}
	return res
}
