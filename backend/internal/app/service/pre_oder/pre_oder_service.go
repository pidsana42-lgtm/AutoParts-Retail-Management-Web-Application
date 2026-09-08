package pre_order

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	preOrderDTO "backend/internal/app/dto/pre_oder"
	"backend/internal/app/entity"
	preOrderRepo "backend/internal/app/repository/pre_oder"
)

type PreOrderService interface {
	CreatePreOrder(input preOrderDTO.CreatePreOrderDTO) (preOrderDTO.PreOrderResponseDTO, error)
	CreatePreOrderItem(input preOrderDTO.CreatePreOrderItemDTO) (preOrderDTO.PreOrderItemResponseDTO, error)
	GetPreOrderByID(id uint) (preOrderDTO.PreOrderResponseDTO, error)
	ListPreOrders() ([]preOrderDTO.PreOrderResponseDTO, error)
	UpdatePreOrder(id uint, input preOrderDTO.UpdatePreOrderDTO) (preOrderDTO.PreOrderResponseDTO, error)
	DeletePreOrder(id uint) error
	ListPreOrdersForPOSelection(ctx context.Context) ([]preOrderDTO.PreOrderForPODTO, error)
}

type preOrderService struct {
	repo preOrderRepo.PreOrderRepository
}

func NewPreOrderService(repo preOrderRepo.PreOrderRepository) PreOrderService {
	return &preOrderService{repo: repo}
}

func (s *preOrderService) CreatePreOrder(input preOrderDTO.CreatePreOrderDTO) (preOrderDTO.PreOrderResponseDTO, error) {
	// ลูกค้าใหม่ที่พิมพ์ชื่อเองแต่ไม่ได้เลือกจาก dropdown (customer_id = 0) → หา/สร้างลูกค้าให้ก่อน
	if input.CustomerID == 0 {
		name := strings.TrimSpace(input.CustomerName)
		if name == "" {
			return preOrderDTO.PreOrderResponseDTO{}, fmt.Errorf("กรุณาระบุชื่อลูกค้า")
		}
		customerID, err := s.repo.FindOrCreateCustomerByName(name, input.CustomerPhone)
		if err != nil {
			return preOrderDTO.PreOrderResponseDTO{}, fmt.Errorf("ไม่สามารถสร้างข้อมูลลูกค้าใหม่ได้: %w", err)
		}
		input.CustomerID = customerID
	}

	poEntity := input.ToEntity()
	err := s.repo.CreatePreOrder(&poEntity)
	if err != nil {
		return preOrderDTO.PreOrderResponseDTO{}, err
	}

	// Trigger LINE OA push notification asynchronously
	go func(customerID, preOrderID uint) {
		lineUserID, errLU := s.repo.GetLineUserIDByCustomerID(customerID)
		if errLU != nil || lineUserID == "" {
			log.Printf("[LINE Send] LINE account is not linked for Customer ID %d. LINE notification skipped.\n", customerID)
			return
		}

		loadedPreOrder, errGet := s.repo.GetPreOrderByID(preOrderID)
		if errGet != nil || loadedPreOrder == nil {
			log.Printf("[LINE Send] Error loading pre-order details for notification: %v\n", errGet)
			return
		}

		sendLineNotification(lineUserID, loadedPreOrder)
	}(poEntity.CustomerID, poEntity.ID)

	return preOrderDTO.ToPreOrderResponseDTO(&poEntity), nil
}

func sendLineNotification(lineUserID string, preOrder *entity.PreOrder) {
	token := strings.TrimSpace(os.Getenv("LINE_CHANNEL_ACCESS_TOKEN"))
	if token == "" {
		log.Println("WARNING: LINE_CHANNEL_ACCESS_TOKEN not configured. LINE notification skipped.")
		return
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("🔔 *มีใบสั่งจองสินค้าล่วงหน้าใหม่ (Pre-Order)*\n\n"))
	sb.WriteString(fmt.Sprintf("เลขที่ใบจอง: PRE-%05d\n", preOrder.ID))
	sb.WriteString(fmt.Sprintf("วันที่จอง: %s\n", preOrder.OrderDate.Format("02/01/2006 15:04")))

	typeStr := "หน้าร้าน"
	if preOrder.PreOrderType == "LINE" {
		typeStr = "LINE OA"
	} else if preOrder.PreOrderType == "TEL" {
		typeStr = "โทรศัพท์"
	}
	sb.WriteString(fmt.Sprintf("ช่องทางการจอง: %s\n", typeStr))

	if preOrder.Customer != nil {
		sb.WriteString(fmt.Sprintf("ชื่อลูกค้า: %s\nเบอร์โทรศัพท์: %s\n", preOrder.Customer.CustomerName, preOrder.Customer.PhoneNumber))
	}

	sb.WriteString("\n📋 รายการอะไหล่ที่จอง:\n")
	var total float64 = 0
	for idx, item := range preOrder.PreOrderItems {
		pName := "อะไหล่ทั่วไป"
		if item.Product != nil {
			pName = item.Product.Product_Name
		}
		itemTotal := float64(item.Quantity) * item.UnitPrice
		total += itemTotal
		sb.WriteString(fmt.Sprintf("%d. %s x%d (฿%.2f)\n", idx+1, pName, item.Quantity, item.UnitPrice))
	}

	sb.WriteString(fmt.Sprintf("\n💰 ยอดรวม: ฿%.2f\n", total))
	sb.WriteString(fmt.Sprintf("💵 มัดจำแล้ว: ฿%.2f\n", preOrder.DepositAmount))
	sb.WriteString(fmt.Sprintf("💳 คงค้างตอนรับของ: ฿%.2f\n", total-preOrder.DepositAmount))
	sb.WriteString(fmt.Sprintf("สถานะ: %s\n\n", "กำลังจัดหาอะไหล่"))

	sb.WriteString("*ทางร้านได้รับยอดจองแล้วและกำลังดำเนินการสั่งอะไหล่ด่วนให้ทันทีค่ะ เมื่อของถึงร้านจะส่งไลน์แจ้งอีกครั้งนะคะ ขอบคุณค่ะ 🙏*")

	text := sb.String()

	url := "https://api.line.me/v2/bot/message/push"
	payload := map[string]interface{}{
		"to": lineUserID,
		"messages": []map[string]interface{}{
			{
				"type": "text",
				"text": text,
			},
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[LINE Send] Error marshaling LINE payload: %v\n", err)
		return
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		log.Printf("[LINE Send] Error creating LINE http request: %v\n", err)
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[LINE Send] Error calling LINE API: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		log.Printf("[LINE Send] LINE API returned code %d: %s\n", resp.StatusCode, string(respBody))
	} else {
		log.Printf("[LINE Send] Successfully sent pre-order notification to LINE User %s\n", lineUserID)
	}
}

func (s *preOrderService) CreatePreOrderItem(input preOrderDTO.CreatePreOrderItemDTO) (preOrderDTO.PreOrderItemResponseDTO, error) {
	entity := input.ToEntity()
	err := s.repo.CreatePreOrderItem(&entity)
	if err != nil {
		return preOrderDTO.PreOrderItemResponseDTO{}, err
	}
	return preOrderDTO.ToPreOrderItemResponseDTO(&entity), nil
}

func (s *preOrderService) GetPreOrderByID(id uint) (preOrderDTO.PreOrderResponseDTO, error) {
	entity, err := s.repo.GetPreOrderByID(id)
	if err != nil {
		return preOrderDTO.PreOrderResponseDTO{}, err
	}
	dto := preOrderDTO.ToPreOrderResponseDTO(entity)

	var itemIDs []uint
	for _, it := range entity.PreOrderItems {
		itemIDs = append(itemIDs, it.ID)
	}

	if len(itemIDs) > 0 {
		linkedPOs, _ := s.repo.GetLinkedPOsByItemIDs(context.Background(), itemIDs)
		for _, itID := range itemIDs {
			if po, ok := linkedPOs[itID]; ok && po.ID != 0 {
				dto.PONumber = po.PO_number
				dto.POStatus = string(po.Status)
				poID := po.ID
				dto.POID = &poID

				if dto.Status != "COMPLETED" && dto.Status != "CANCELLED" {
					if po.Status == "APPROVED" {
						dto.Status = "ORDERED"
					} else if po.Status == "PENDING" {
						dto.Status = "PO_PENDING"
					} else if po.Status == "DRAFT" {
						dto.Status = "PO_DRAFT"
					}
				}
				break
			}
		}
	}

	return dto, nil
}

func (s *preOrderService) ListPreOrders() ([]preOrderDTO.PreOrderResponseDTO, error) {
	entities, err := s.repo.ListPreOrders()
	if err != nil {
		return nil, err
	}

	var allItemIDs []uint
	for _, ent := range entities {
		for _, it := range ent.PreOrderItems {
			allItemIDs = append(allItemIDs, it.ID)
		}
	}

	linkedPOs, _ := s.repo.GetLinkedPOsByItemIDs(context.Background(), allItemIDs)

	res := make([]preOrderDTO.PreOrderResponseDTO, len(entities))
	for i := range entities {
		dto := preOrderDTO.ToPreOrderResponseDTO(&entities[i])

		for _, it := range entities[i].PreOrderItems {
			if po, ok := linkedPOs[it.ID]; ok && po.ID != 0 {
				dto.PONumber = po.PO_number
				dto.POStatus = string(po.Status)
				poID := po.ID
				dto.POID = &poID

				if dto.Status != "COMPLETED" && dto.Status != "CANCELLED" {
					if po.Status == "APPROVED" {
						dto.Status = "ORDERED"
					} else if po.Status == "PENDING" {
						dto.Status = "PO_PENDING"
					} else if po.Status == "DRAFT" {
						dto.Status = "PO_DRAFT"
					}
				}
				break
			}
		}

		res[i] = dto
	}
	return res, nil
}

func (s *preOrderService) UpdatePreOrder(id uint, input preOrderDTO.UpdatePreOrderDTO) (preOrderDTO.PreOrderResponseDTO, error) {
	existing, err := s.repo.GetPreOrderByID(id)
	if err != nil {
		return preOrderDTO.PreOrderResponseDTO{}, err
	}

	// เปลี่ยนชื่อลูกค้าเป็นคนใหม่ที่พิมพ์เองระหว่างแก้ไข (customer_id ถูก reset เป็น 0 ฝั่ง frontend) → หา/สร้างลูกค้าให้ก่อน
	if input.CustomerID != nil && *input.CustomerID == 0 {
		name := ""
		if input.CustomerName != nil {
			name = strings.TrimSpace(*input.CustomerName)
		}
		if name == "" {
			return preOrderDTO.PreOrderResponseDTO{}, fmt.Errorf("กรุณาระบุชื่อลูกค้า")
		}
		phone := ""
		if input.CustomerPhone != nil {
			phone = *input.CustomerPhone
		}
		customerID, errFind := s.repo.FindOrCreateCustomerByName(name, phone)
		if errFind != nil {
			return preOrderDTO.PreOrderResponseDTO{}, fmt.Errorf("ไม่สามารถสร้างข้อมูลลูกค้าใหม่ได้: %w", errFind)
		}
		input.CustomerID = &customerID
	}

	updated := input.ToEntity(*existing)
	err = s.repo.UpdatePreOrder(&updated)
	if err != nil {
		return preOrderDTO.PreOrderResponseDTO{}, err
	}
	return preOrderDTO.ToPreOrderResponseDTO(&updated), nil
}

func (s *preOrderService) DeletePreOrder(id uint) error {
	return s.repo.DeletePreOrder(id)
}

func (s *preOrderService) ListPreOrdersForPOSelection(ctx context.Context) ([]preOrderDTO.PreOrderForPODTO, error) {
	entities, err := s.repo.ListByStatus(ctx, "PENDING") // ฟังก์ชันนี้เราเขียน Preload ครบแล้ว
	if err != nil {
		return nil, err
	}

	res := make([]preOrderDTO.PreOrderForPODTO, len(entities))
	for i := range entities {
		res[i] = preOrderDTO.ToPreOrderForPODTO(&entities[i]) // เปลี่ยนมาใช้ To ตัวใหม่
	}
	return res, nil
}
