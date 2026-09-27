package wms

import (
	"fmt"
	"sort"
	"strings"

	wmsDto "backend/internal/app/dto/wms"
	"backend/internal/app/entity"
	wmsRepo "backend/internal/app/repository/wms"
)

// CHECK_TYPE label สำหรับแสดงผลในฟีด (ใช้ชุดเดียวกับหน้า "จัดการตารางเช็คสต็อก")
var checkTypeFeedLabel = map[string]string{
	"LOCATION": "ตรวจตามพื้นที่จัดเก็บ",
	"CATEGORY": "ตรวจตามหมวดหมู่",
	"PRODUCT":  "ตรวจสินค้ารายชิ้น",
}

// movementOriginState: ส่งแนบไปกับ navigate() ตอน LinkPath ชี้ไปหน้าที่ "ใช้ร่วมกับเมนูอื่นด้วย" (เช่นรายละเอียด
// สินค้า/ตารางเช็คสต็อก/ใบเคลม/ใบคืนสินค้า) เพื่อให้หน้านั้นปรับเกล็ดขนมปังกลับมาที่ฟีดนี้แทนเมนูปกติของมัน
// หน้าที่สร้างมาเฉพาะสำหรับฟีดนี้โดยเฉพาะ (เช่น รายละเอียดออเดอร์/ใบสั่งจองใต้ stock-movement) ไม่ต้องใช้ตัวนี้
var movementOriginState = map[string]string{"from": "movement"}

// productDetailLinkPath: URL หน้ารายละเอียดสินค้าของ productID ที่ระบุ — ใช้ซ้ำในหลาย mapper (สินค้าถูกเพิ่มใหม่/
// รับเข้าเพิ่ม/ปรับสต็อก/ใกล้หมด และเป็น fallback ของ mapper อื่นที่หา id เอกสารหลักไม่เจอด้วย)
// basePath: "/owner" หรือ "/manager" ตาม role ของผู้เรียก (คำนวณไว้แล้วที่ controller จาก JWT) — หน้าเดียวกันทุก
// ประการแต่คนละ path prefix กัน ต้องส่งมาจากภายนอก ไม่ใช่เดาเอาเองในนี้
func productDetailLinkPath(basePath string, productID uint) string {
	return fmt.Sprintf("%s/stock/%d", basePath, productID)
}

type MovementFeedService interface {
	// List: รวมเหตุการณ์จากทุกแหล่งข้อมูล WMS มาเรียงเป็นไทม์ไลน์เดียว (ใหม่สุดก่อน) ให้หน้า "การเคลื่อนไหวของสินค้า" ใช้
	// basePath: "/owner" หรือ "/manager" — ใช้ตอนคำนวณ LinkPath ของแต่ละ item ให้ตรงกับ role ของผู้เรียกจริง
	List(basePath string) ([]wmsDto.MovementFeedItem, error)
}

type movementFeedService struct {
	repo wmsRepo.MovementFeedRepository
}

func NewMovementFeedService(repo wmsRepo.MovementFeedRepository) MovementFeedService {
	return &movementFeedService{repo: repo}
}

func (s *movementFeedService) List(basePath string) ([]wmsDto.MovementFeedItem, error) {
	var items []wmsDto.MovementFeedItem

	products, err := s.repo.ListRecentProducts()
	if err != nil {
		return nil, err
	}
	for _, p := range products {
		items = append(items, productAddedFeedItem(basePath, p))
	}

	movements, err := s.repo.ListStockInMovements()
	if err != nil {
		return nil, err
	}
	for _, m := range movements {
		items = append(items, stockInFeedItem(basePath, m))
	}

	schedules, err := s.repo.ListCheckSchedules()
	if err != nil {
		return nil, err
	}
	for _, sc := range schedules {
		items = append(items, checkFlaggedFeedItem(basePath, sc))
	}

	adjustments, err := s.repo.ListStockAdjustments()
	if err != nil {
		return nil, err
	}
	for _, adj := range adjustments {
		items = append(items, stockAdjustedFeedItem(basePath, adj))
	}

	lowStock, err := s.repo.ListLowStockProducts()
	if err != nil {
		return nil, err
	}
	for _, p := range lowStock {
		items = append(items, lowStockFeedItem(basePath, p))
	}

	saleItems, err := s.repo.ListSaleOutItems()
	if err != nil {
		return nil, err
	}
	for _, si := range saleItems {
		items = append(items, saleOutFeedItem(basePath, si))
	}

	returns, err := s.repo.ListReturnMovements()
	if err != nil {
		return nil, err
	}
	// stock_movements ไม่มีคอลัมน์ผูกกับ sales_returns ตรงๆ ต้องย้อนกลับจากเลขที่ใบคืนที่ฝังไว้ใน Note แทน
	// ("Return <return_number>") — ดึง id จริงมาแบบ batch ครั้งเดียวกันยิง query ซ้ำทีละแถว
	returnNumberSet := make(map[string]struct{}, len(returns))
	for _, rm := range returns {
		if num := extractReturnNumber(rm.Note); num != "" {
			returnNumberSet[num] = struct{}{}
		}
	}
	returnNumbers := make([]string, 0, len(returnNumberSet))
	for num := range returnNumberSet {
		returnNumbers = append(returnNumbers, num)
	}
	returnIDByNumber, err := s.repo.GetSalesReturnIDsByReturnNumbers(returnNumbers)
	if err != nil {
		return nil, err
	}
	for _, rm := range returns {
		items = append(items, returnFeedItem(basePath, rm, returnIDByNumber))
	}

	claimItems, err := s.repo.ListCustomerClaimItems()
	if err != nil {
		return nil, err
	}
	for _, ci := range claimItems {
		items = append(items, customerClaimFeedItem(basePath, ci))
	}

	preOrderItems, err := s.repo.ListPreOrderItems()
	if err != nil {
		return nil, err
	}
	for _, poi := range preOrderItems {
		items = append(items, preOrderFeedItem(basePath, poi))
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].OccurredAt.After(items[j].OccurredAt)
	})

	return items, nil
}

func productAddedFeedItem(basePath string, p entity.Product) wmsDto.MovementFeedItem {
	qty := p.Quantity
	productID := p.ID
	return wmsDto.MovementFeedItem{
		Type:        wmsDto.MovementFeedProductAdded,
		OccurredAt:  p.CreatedAt,
		RefID:       p.ID,
		ProductID:   &productID,
		ProductCode: p.Product_Code,
		ProductName: p.Product_Name,
		Quantity:    &qty,
		LinkPath:    productDetailLinkPath(basePath, p.ID),
		LinkState:   movementOriginState,
		Title:       fmt.Sprintf("เพิ่มสินค้าใหม่เข้าระบบ: %s", p.Product_Name),
		Detail:      fmt.Sprintf("จำนวนเริ่มต้น %d ชิ้น", p.Quantity),
	}
}

func stockInFeedItem(basePath string, m entity.StockMovement) wmsDto.MovementFeedItem {
	qty := m.Quantity
	productID := m.ProductID
	name, code := "", ""
	if m.Product != nil {
		name = m.Product.Product_Name
		code = m.Product.Product_Code
	}
	actor := userDisplayName(m.User)
	supplier := ""
	if m.Supplier != nil {
		supplier = m.Supplier.SupplierName
	}
	detail := m.Note
	if supplier != "" {
		if detail != "" {
			detail = fmt.Sprintf("รับจาก %s — %s", supplier, detail)
		} else {
			detail = fmt.Sprintf("รับจาก %s", supplier)
		}
	}
	return wmsDto.MovementFeedItem{
		Type:         wmsDto.MovementFeedStockIn,
		OccurredAt:   m.Movement_DateTime,
		RefID:        m.ID,
		ProductID:    &productID,
		ProductCode:  code,
		ProductName:  name,
		Quantity:     &qty,
		ActorName:    actor,
		SupplierName: supplier,
		LinkPath:     productDetailLinkPath(basePath, productID),
		LinkState:    movementOriginState,
		Title:        fmt.Sprintf("รับสินค้าเข้าเพิ่ม: %s", name),
		Detail:       detail,
	}
}

func checkFlaggedFeedItem(basePath string, sc entity.CheckStockSchedule) wmsDto.MovementFeedItem {
	actor := userDisplayName(sc.User)
	typeLabel := checkTypeFeedLabel[sc.CheckType]
	if typeLabel == "" {
		typeLabel = sc.CheckType
	}
	title := "แจ้งเช็คสต็อกสินค้า"
	if typeLabel != "" {
		title = fmt.Sprintf("แจ้งเช็คสต็อกสินค้า: %s", typeLabel)
	}
	detail := sc.Note
	if actor != "" {
		if detail != "" {
			detail = fmt.Sprintf("มอบหมายให้ %s — %s", actor, detail)
		} else {
			detail = fmt.Sprintf("มอบหมายให้ %s", actor)
		}
	}
	return wmsDto.MovementFeedItem{
		Type:       wmsDto.MovementFeedCheckFlagged,
		OccurredAt: sc.CreatedAt,
		RefID:      sc.ID,
		ActorName:  actor,
		LinkPath:   fmt.Sprintf("%s/stock/stock-check/%d", basePath, sc.ID),
		LinkState:  movementOriginState,
		Title:      title,
		Detail:     detail,
	}
}

// stockAdjustedFeedItem: สต็อกถูกปรับหลังเจ้าของร้านอนุมัติผลนับสต็อก (นับได้ไม่ตรงกับที่ระบบมี)
// ต่างจาก checkFlaggedFeedItem ตรงที่อันนี้คือ "ผลลัพธ์หลังนับเสร็จ" (สต็อกเปลี่ยนจริง) ไม่ใช่แค่ "สั่งให้ไปนับ"
// stockAdjustedFeedItem: อ่านจาก stock_movements (movement_type = ADJUST) ที่ทีม WMS เขียนไว้ให้ตอนอนุมัติผลเช็คสต็อก
// — ข้อความ "เดิม X → นับได้ Y" ถูกฝังไว้ใน Note ตั้งแต่ตอนเขียนแถวแล้ว (ดู ApproveSchedule) mapper แค่แต่งเติมชื่อผู้ตรวจนับต่อท้าย
func stockAdjustedFeedItem(basePath string, m entity.StockMovement) wmsDto.MovementFeedItem {
	productID := m.ProductID
	name, code := "", ""
	if m.Product != nil {
		name = m.Product.Product_Name
		code = m.Product.Product_Code
	}
	actor := userDisplayName(m.User)
	detail := m.Note
	if actor != "" {
		detail = fmt.Sprintf("%s (ผู้ตรวจนับ: %s)", detail, actor)
	}

	return wmsDto.MovementFeedItem{
		Type:        wmsDto.MovementFeedStockAdjusted,
		OccurredAt:  m.Movement_DateTime,
		RefID:       m.ID,
		ProductID:   &productID,
		ProductCode: code,
		ProductName: name,
		// ไม่ใส่ Quantity ตรงๆ (จะกลายเป็นค่าติดลบดูสับสนในหน้าฟีด) — รายละเอียดเดิม/ใหม่/ผลต่างอธิบายไว้ครบใน Detail แล้ว
		ActorName: actor,
		LinkPath:  productDetailLinkPath(basePath, productID),
		LinkState: movementOriginState,
		Title:     fmt.Sprintf("ปรับปรุงสต็อกจากผลเช็คสต็อก: %s", name),
		Detail:    detail,
	}
}

func lowStockFeedItem(basePath string, p entity.Product) wmsDto.MovementFeedItem {
	qty := p.Quantity
	productID := p.ID
	unit := "ชิ้น"
	if p.Unit != nil && p.Unit.Unit_Name != "" {
		unit = p.Unit.Unit_Name
	}
	return wmsDto.MovementFeedItem{
		Type:        wmsDto.MovementFeedLowStock,
		OccurredAt:  p.UpdatedAt,
		RefID:       p.ID,
		ProductID:   &productID,
		ProductCode: p.Product_Code,
		ProductName: p.Product_Name,
		Quantity:    &qty,
		LinkPath:    productDetailLinkPath(basePath, p.ID),
		LinkState:   movementOriginState,
		Title:       fmt.Sprintf("สินค้าใกล้หมด: %s", p.Product_Name),
		Detail:      fmt.Sprintf("คงเหลือ %d %s ต่ำกว่าจุดสั่งซื้อที่ตั้งไว้ (%d %s)", p.Quantity, unit, p.Limit_Quantity, unit),
	}
}

// saleOrderStatusFeedTitle: คำขึ้นต้นหัวข้อในฟีดตามสถานะออเดอร์จริง ณ ตอนนี้ (ไม่ใช่ตายตัวว่า "ขายออก" เสมอไป
// เพราะออเดอร์เดียวกันเปลี่ยนสถานะได้ตลอดอายุของมัน — ให้หัวข้อสะท้อนสถานะปัจจุบันแทน)
var saleOrderStatusFeedTitle = map[string]string{
	"pending":        "รอดำเนินการ",
	"completed":      "ขายออก",
	"pending_cancel": "รอยกเลิก",
	"cancelled":      "ยกเลิกแล้ว",
	"returned":       "คืนสินค้าแล้ว",
	"refunded":       "คืนเงินแล้ว",
	"claimed":        "เคลมแล้ว",
}

// saleOutFeedItem: อ่านจาก stock_movements (movement_type = OUT) ที่ทีม POS เขียนไว้ให้ตอนสร้าง/แก้ไขออเดอร์ —
// สต็อกถูกตัดจริงตั้งแต่ตอนสร้างออเดอร์ไม่ว่าจะจบที่สถานะไหน แถวนี้ไม่ถูกลบตอนยกเลิก จึงยังโชว์เป็นประวัติได้ (ดู
// SaleOrder ที่ Preload มาเพื่ออ่านสถานะ "ล่าสุด" ของออเดอร์เสมอ ไม่ใช่สถานะ ณ ตอนขาย)
func saleOutFeedItem(basePath string, m entity.StockMovement) wmsDto.MovementFeedItem {
	qty := -m.Quantity // ขายออก = ลดสต็อก แสดงเป็นค่าติดลบให้เห็นทิศทางตรงข้ามกับรับเข้าชัดเจน
	productID := m.ProductID
	name, code := "", ""
	if m.Product != nil {
		name = m.Product.Product_Name
		code = m.Product.Product_Code
	}
	actor := userDisplayName(m.User)

	orderNumber, status := "", ""
	orderID := uint(0)
	if m.SaleOrder != nil {
		orderNumber = m.SaleOrder.OrderNumber
		status = string(m.SaleOrder.Status)
		orderID = m.SaleOrder.ID
	}

	detail := fmt.Sprintf("ออเดอร์ %s", orderNumber)
	if actor != "" {
		detail = fmt.Sprintf("%s — แคชเชียร์: %s", detail, actor)
	}
	titlePrefix := saleOrderStatusFeedTitle[status]
	if titlePrefix == "" {
		titlePrefix = "ขายออก" // เผื่อ enum เพิ่มสถานะใหม่ในอนาคตที่ยังไม่ได้ผูกป้ายไว้
	}
	return wmsDto.MovementFeedItem{
		Type:        wmsDto.MovementFeedSaleOut,
		OccurredAt:  m.Movement_DateTime,
		RefID:       m.ID,
		ProductID:   &productID,
		ProductCode: code,
		ProductName: name,
		Quantity:    &qty,
		ActorName:   actor,
		// หน้ารายละเอียดออเดอร์นี้สร้างมาเฉพาะสำหรับฟีดนี้โดยเฉพาะ (มีเกล็ดขนมปังของตัวเองแล้ว) ไม่ต้องใช้ movementOriginState
		LinkPath: fmt.Sprintf("%s/stock/stock-movement/orders/%d", basePath, orderID),
		Title:    fmt.Sprintf("%s: %s", titlePrefix, name),
		Detail:   detail,
	}
}

// extractReturnNumber: ถอดเลขที่ใบคืนสินค้ากลับจาก Note ของแถว stock_movements ที่ทีมคืนสินค้าฝังไว้ตอนอนุมัติ
// คำขอคืน ("Return RTN-2026-0001" -> "RTN-2026-0001") — คืนค่าว่างถ้ารูปแบบไม่ตรง
func extractReturnNumber(note string) string {
	const prefix = "Return "
	if !strings.HasPrefix(note, prefix) {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(note, prefix))
}

// returnFeedItem: ลูกค้าคืนสินค้า (จากแถว stock_movements ที่ movement_type = RETURN — ทีมคืนสินค้าเขียนไว้ให้ตอนอนุมัติคำขอคืนแล้ว)
func returnFeedItem(basePath string, m entity.StockMovement, returnIDByNumber map[string]uint) wmsDto.MovementFeedItem {
	qty := m.Quantity
	productID := m.ProductID
	name, code := "", ""
	if m.Product != nil {
		name = m.Product.Product_Name
		code = m.Product.Product_Code
	}
	actor := userDisplayName(m.User)
	// หา id ใบคืนสินค้าจริงจากเลขที่ใบคืนที่ฝังไว้ใน Note — ถ้าหาไม่เจอ (เช่นรูปแบบ Note ไม่ตรง) ให้ลิงก์ไปหน้า
	// รายละเอียดสินค้าแทน ยังดีกว่ากดไม่ได้เลย
	linkPath := productDetailLinkPath(basePath, productID)
	if num := extractReturnNumber(m.Note); num != "" {
		if id, ok := returnIDByNumber[num]; ok {
			linkPath = fmt.Sprintf("%s/returns/detail/%d", basePath, id)
		}
	}
	return wmsDto.MovementFeedItem{
		Type:        wmsDto.MovementFeedSalesReturn,
		OccurredAt:  m.Movement_DateTime,
		RefID:       m.ID,
		ProductID:   &productID,
		ProductCode: code,
		ProductName: name,
		Quantity:    &qty,
		ActorName:   actor,
		LinkPath:    linkPath,
		LinkState:   movementOriginState,
		Title:       fmt.Sprintf("รับคืนสินค้าจากลูกค้า: %s", name),
		Detail:      m.Note,
	}
}

// customerClaimFeedItem: ลูกค้าแจ้งเคลมสินค้า (แสดงเวลาตามวันที่แจ้งเคลมของใบเคลม ไม่ใช่วันที่สร้างแถวรายการ)
func customerClaimFeedItem(basePath string, item entity.CustomerClaimItem) wmsDto.MovementFeedItem {
	qty := int(item.Qty)
	productID := item.ProductID
	name, code := "", ""
	if item.Product != nil {
		name = item.Product.Product_Name
		code = item.Product.Product_Code
	}
	occurredAt := item.CreatedAt
	actor := ""
	detail := item.Reason
	if item.CustomerClaim != nil {
		occurredAt = item.CustomerClaim.ClaimDate
		actor = userDisplayName(item.CustomerClaim.CreatedByUser)
		if item.CustomerClaim.ClaimNo != "" {
			if detail != "" {
				detail = fmt.Sprintf("เคลม %s — %s", item.CustomerClaim.ClaimNo, detail)
			} else {
				detail = fmt.Sprintf("เคลม %s", item.CustomerClaim.ClaimNo)
			}
		}
	}
	return wmsDto.MovementFeedItem{
		Type:        wmsDto.MovementFeedCustomerClaim,
		OccurredAt:  occurredAt,
		RefID:       item.ID,
		ProductID:   &productID,
		ProductCode: code,
		ProductName: name,
		Quantity:    &qty,
		ActorName:   actor,
		LinkPath:    fmt.Sprintf("%s/claims/detail/%d", basePath, item.CustomerClaimID),
		LinkState:   movementOriginState,
		Title:       fmt.Sprintf("แจ้งเคลมสินค้า: %s", name),
		Detail:      detail,
	}
}

// preOrderFeedItem: สร้างพรีออเดอร์สั่งจองสินค้ากับบริษัท — ยังไม่ตัด/บวกสต็อกจริง (แค่บันทึกความต้องการล่วงหน้า)
func preOrderFeedItem(basePath string, item entity.PreOrderItem) wmsDto.MovementFeedItem {
	qty := item.Quantity
	name := item.ProductNameSnapshot
	code := item.ProductCodeSnapshot
	occurredAt := item.CreatedAt
	supplier := item.SupplierName
	if item.PreOrder != nil {
		occurredAt = item.PreOrder.OrderDate
		if supplier == "" && item.PreOrder.Supplier != nil {
			supplier = item.PreOrder.Supplier.SupplierName
		}
	}
	detail := fmt.Sprintf("สั่งจอง %d ชิ้น", qty)
	if supplier != "" {
		detail = fmt.Sprintf("%s จากบริษัท %s", detail, supplier)
	}
	return wmsDto.MovementFeedItem{
		Type:         wmsDto.MovementFeedPreOrder,
		OccurredAt:   occurredAt,
		RefID:        item.ID,
		ProductID:    item.ProductID,
		ProductCode:  code,
		ProductName:  name,
		Quantity:     &qty,
		SupplierName: supplier,
		// หน้ารายละเอียดใบสั่งจองนี้สร้างมาเฉพาะสำหรับฟีดนี้โดยเฉพาะ (มีเกล็ดขนมปังของตัวเองแล้ว) ไม่ต้องใช้ movementOriginState
		LinkPath: fmt.Sprintf("%s/stock/stock-movement/pre-orders/%d", basePath, item.PreOrderID),
		Title:    fmt.Sprintf("สร้างพรีออเดอร์: %s", name),
		Detail:   detail,
	}
}

func userDisplayName(u *entity.User) string {
	if u == nil {
		return ""
	}
	name := strings.TrimSpace(fmt.Sprintf("%s %s", u.FirstName, u.LastName))
	return name
}
