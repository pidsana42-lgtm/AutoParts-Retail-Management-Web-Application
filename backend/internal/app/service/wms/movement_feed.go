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

type MovementFeedService interface {
	// List: รวมเหตุการณ์จากทุกแหล่งข้อมูล WMS มาเรียงเป็นไทม์ไลน์เดียว (ใหม่สุดก่อน) ให้หน้า "การเคลื่อนไหวของสินค้า" ใช้
	List() ([]wmsDto.MovementFeedItem, error)
}

type movementFeedService struct {
	repo wmsRepo.MovementFeedRepository
}

func NewMovementFeedService(repo wmsRepo.MovementFeedRepository) MovementFeedService {
	return &movementFeedService{repo: repo}
}

func (s *movementFeedService) List() ([]wmsDto.MovementFeedItem, error) {
	var items []wmsDto.MovementFeedItem

	products, err := s.repo.ListRecentProducts()
	if err != nil {
		return nil, err
	}
	for _, p := range products {
		items = append(items, productAddedFeedItem(p))
	}

	movements, err := s.repo.ListStockInMovements()
	if err != nil {
		return nil, err
	}
	for _, m := range movements {
		items = append(items, stockInFeedItem(m))
	}

	schedules, err := s.repo.ListCheckSchedules()
	if err != nil {
		return nil, err
	}
	for _, sc := range schedules {
		items = append(items, checkFlaggedFeedItem(sc))
	}

	adjustments, err := s.repo.ListStockAdjustments()
	if err != nil {
		return nil, err
	}
	for _, adj := range adjustments {
		items = append(items, stockAdjustedFeedItem(adj))
	}

	lowStock, err := s.repo.ListLowStockProducts()
	if err != nil {
		return nil, err
	}
	for _, p := range lowStock {
		items = append(items, lowStockFeedItem(p))
	}

	saleItems, err := s.repo.ListSaleOutItems()
	if err != nil {
		return nil, err
	}
	for _, si := range saleItems {
		items = append(items, saleOutFeedItem(si))
	}

	returns, err := s.repo.ListReturnMovements()
	if err != nil {
		return nil, err
	}
	for _, rm := range returns {
		items = append(items, returnFeedItem(rm))
	}

	claimItems, err := s.repo.ListCustomerClaimItems()
	if err != nil {
		return nil, err
	}
	for _, ci := range claimItems {
		items = append(items, customerClaimFeedItem(ci))
	}

	preOrderItems, err := s.repo.ListPreOrderItems()
	if err != nil {
		return nil, err
	}
	for _, poi := range preOrderItems {
		items = append(items, preOrderFeedItem(poi))
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].OccurredAt.After(items[j].OccurredAt)
	})

	return items, nil
}

func productAddedFeedItem(p entity.Product) wmsDto.MovementFeedItem {
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
		Title:       fmt.Sprintf("เพิ่มสินค้าใหม่เข้าระบบ: %s", p.Product_Name),
		Detail:      fmt.Sprintf("จำนวนเริ่มต้น %d ชิ้น", p.Quantity),
	}
}

func stockInFeedItem(m entity.StockMovement) wmsDto.MovementFeedItem {
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
		Title:        fmt.Sprintf("รับสินค้าเข้าเพิ่ม: %s", name),
		Detail:       detail,
	}
}

func checkFlaggedFeedItem(sc entity.CheckStockSchedule) wmsDto.MovementFeedItem {
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
		Title:      title,
		Detail:     detail,
	}
}

// stockAdjustedFeedItem: สต็อกถูกปรับหลังเจ้าของร้านอนุมัติผลนับสต็อก (นับได้ไม่ตรงกับที่ระบบมี)
// ต่างจาก checkFlaggedFeedItem ตรงที่อันนี้คือ "ผลลัพธ์หลังนับเสร็จ" (สต็อกเปลี่ยนจริง) ไม่ใช่แค่ "สั่งให้ไปนับ"
func stockAdjustedFeedItem(cs entity.CheckStock) wmsDto.MovementFeedItem {
	diff := cs.Diff_Quantity
	name, code := "", ""
	if cs.Product != nil {
		name = cs.Product.Product_Name
		code = cs.Product.Product_Code
	}
	actor := userDisplayName(cs.User)

	sign := "เกิน"
	if diff < 0 {
		sign = "ขาด"
		diff = -diff
	}
	detail := fmt.Sprintf("เดิม %d → นับได้ %d (%s %d)", cs.Old_Quantity, cs.New_Quantity, sign, diff)
	if cs.Reason != "" {
		detail = fmt.Sprintf("%s — เหตุผล: %s", detail, cs.Reason)
	}
	if actor != "" {
		detail = fmt.Sprintf("%s (ผู้ตรวจนับ: %s)", detail, actor)
	}

	return wmsDto.MovementFeedItem{
		Type:        wmsDto.MovementFeedStockAdjusted,
		OccurredAt:  cs.Adjustment_DateTime,
		RefID:       cs.ID,
		ProductID:   cs.ProductID,
		ProductCode: code,
		ProductName: name,
		// ไม่ใส่ Quantity ตรงๆ (จะกลายเป็นค่าติดลบดูสับสนในหน้าฟีด) — รายละเอียดเดิม/ใหม่/ผลต่างอธิบายไว้ครบใน Detail แล้ว
		ActorName: actor,
		Title:     fmt.Sprintf("ปรับปรุงสต็อกจากผลเช็คสต็อก: %s", name),
		Detail:    detail,
	}
}

func lowStockFeedItem(p entity.Product) wmsDto.MovementFeedItem {
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

// saleOutFeedItem: สินค้าถูกขายออกผ่าน POS — สต็อกถูกตัดจริงตั้งแต่ตอนสร้างออเดอร์ไม่ว่าจะจบที่สถานะไหน (ดูเหตุผลใน repository)
func saleOutFeedItem(item entity.SaleOrderItem) wmsDto.MovementFeedItem {
	qty := -item.Qty // ขายออก = ลดสต็อก แสดงเป็นค่าติดลบให้เห็นทิศทางตรงข้ามกับรับเข้าชัดเจน
	productID := item.ProductID
	name := item.ProductName
	code := ""
	if item.Product.ID != 0 {
		code = item.Product.Product_Code
		if name == "" {
			name = item.Product.Product_Name
		}
	}
	actor := userDisplayName(item.Order.CreatedBy)
	detail := fmt.Sprintf("ออเดอร์ %s", item.OrderNumber)
	if actor != "" {
		detail = fmt.Sprintf("%s — แคชเชียร์: %s", detail, actor)
	}
	titlePrefix := saleOrderStatusFeedTitle[string(item.Order.Status)]
	if titlePrefix == "" {
		titlePrefix = "ขายออก" // เผื่อ enum เพิ่มสถานะใหม่ในอนาคตที่ยังไม่ได้ผูกป้ายไว้
	}
	return wmsDto.MovementFeedItem{
		Type:        wmsDto.MovementFeedSaleOut,
		OccurredAt:  item.Order.OrderDate,
		RefID:       item.ID,
		ProductID:   &productID,
		ProductCode: code,
		ProductName: name,
		Quantity:    &qty,
		ActorName:   actor,
		Title:       fmt.Sprintf("%s: %s", titlePrefix, name),
		Detail:      detail,
	}
}

// returnFeedItem: ลูกค้าคืนสินค้า (จากแถว stock_movements ที่ movement_type = RETURN — ทีมคืนสินค้าเขียนไว้ให้ตอนอนุมัติคำขอคืนแล้ว)
func returnFeedItem(m entity.StockMovement) wmsDto.MovementFeedItem {
	qty := m.Quantity
	productID := m.ProductID
	name, code := "", ""
	if m.Product != nil {
		name = m.Product.Product_Name
		code = m.Product.Product_Code
	}
	actor := userDisplayName(m.User)
	return wmsDto.MovementFeedItem{
		Type:        wmsDto.MovementFeedSalesReturn,
		OccurredAt:  m.Movement_DateTime,
		RefID:       m.ID,
		ProductID:   &productID,
		ProductCode: code,
		ProductName: name,
		Quantity:    &qty,
		ActorName:   actor,
		Title:       fmt.Sprintf("รับคืนสินค้าจากลูกค้า: %s", name),
		Detail:      m.Note,
	}
}

// customerClaimFeedItem: ลูกค้าแจ้งเคลมสินค้า (แสดงเวลาตามวันที่แจ้งเคลมของใบเคลม ไม่ใช่วันที่สร้างแถวรายการ)
func customerClaimFeedItem(item entity.CustomerClaimItem) wmsDto.MovementFeedItem {
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
		Title:       fmt.Sprintf("แจ้งเคลมสินค้า: %s", name),
		Detail:      detail,
	}
}

// preOrderFeedItem: สร้างพรีออเดอร์สั่งจองสินค้ากับบริษัท — ยังไม่ตัด/บวกสต็อกจริง (แค่บันทึกความต้องการล่วงหน้า)
func preOrderFeedItem(item entity.PreOrderItem) wmsDto.MovementFeedItem {
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
		Title:        fmt.Sprintf("สร้างพรีออเดอร์: %s", name),
		Detail:       detail,
	}
}

func userDisplayName(u *entity.User) string {
	if u == nil {
		return ""
	}
	name := strings.TrimSpace(fmt.Sprintf("%s %s", u.FirstName, u.LastName))
	return name
}
