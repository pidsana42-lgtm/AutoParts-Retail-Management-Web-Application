package wms

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	wmsDto "backend/internal/app/dto/wms"
	"backend/internal/app/entity"
	wmsRepo "backend/internal/app/repository/wms"
	svcNotification "backend/internal/app/service/notification"

	"gorm.io/gorm"
)

// generateAccessToken: สุ่มรหัสสำหรับผูกกับ QR Code ของตารางเช็คสต็อกแต่ละอัน
func generateAccessToken() string {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		// แทบไม่เกิดขึ้นจริง แต่กันไว้ไม่ให้ตารางสร้างไม่ได้เพราะ token พัง
		return fmt.Sprintf("fallback-%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(b)
}

// bangkokTime: แปลงเวลาให้เป็นเขตเวลาไทยก่อนโชว์ในข้อความแจ้งเตือน — time.Time ที่เก็บ/ได้จาก DB เป็น UTC เสมอ
func bangkokTime(t time.Time) time.Time {
	loc, err := time.LoadLocation("Asia/Bangkok")
	if err != nil {
		loc = time.Local
	}
	return t.In(loc)
}

type CheckStockScheduleService interface {
	// คืน ID ของตารางที่สร้างเสร็จกลับไปด้วย ให้ frontend พาไปหน้ารายละเอียด (โชว์ QR Code) ได้ทันที
	CreateSchedule(req *wmsDto.CheckStockScheduleRequestDTO) (uint, error)
	GetByID(id uint) (*wmsDto.CheckStockScheduleResponseDTO, error)
	Update(id uint, req *wmsDto.CheckStockScheduleRequestDTO) error
	UpdateStatus(id uint, status string) error
	ApproveSchedule(id uint) error
	RejectSchedule(id uint, note string) error
	Delete(id uint) error
	List(status string) ([]wmsDto.CheckStockScheduleResponseDTO, error)
	ListEmployees() ([]entity.User, error)
	GetZoneTree() ([]entity.Zone, error)
	GetCategoryTree() ([]entity.Category, error)
	// ActivateDueSchedules: หาตารางที่ถึงเวลาเริ่มเช็คแล้วแต่ยัง "รอดำเนินการ" อยู่ -> เปลี่ยนเป็น "กำลังเช็ค" จริงใน DB
	// (ของเดิมสถานะนี้คำนวณแค่ตอนแสดงผล ไม่เคยบันทึกจริง) แล้วแจ้งเตือนพนักงานที่ได้รับมอบหมายว่าถึงเวลาต้องเช็คแล้ว
	ActivateDueSchedules() error
}

// resolveTargetName: สร้างข้อความอธิบาย "เป้าหมายการตรวจ" แบบสั้นๆ ใช้ในข้อความแจ้งเตือน
// (แยกจาก toResponse ที่คำนวณ TargetName+ProductCount เต็มรูปแบบสำหรับหน้าตาราง เพื่อไม่ให้ไปกระทบของเดิม)
func (s *checkStockScheduleService) resolveTargetName(sc *entity.CheckStockSchedule) string {
	switch sc.CheckType {
	case "LOCATION":
		if sc.ShelfLevelID != nil {
			var level entity.ShelfLevel
			if err := s.db.Preload("Shelf.Zone").First(&level, sc.ShelfLevelID).Error; err == nil && level.Shelf != nil && level.Shelf.Zone != nil {
				return fmt.Sprintf("Zone %s - %s - %s", level.Shelf.Zone.Zone_Name, level.Shelf.Shelf_Name, level.Level_Name)
			}
		} else if sc.ShelfID != nil {
			var shelf entity.Shelf
			if err := s.db.Preload("Zone").First(&shelf, sc.ShelfID).Error; err == nil && shelf.Zone != nil {
				return fmt.Sprintf("Zone %s - %s", shelf.Zone.Zone_Name, shelf.Shelf_Name)
			}
		} else if sc.ZoneID != nil {
			var zone entity.Zone
			s.db.First(&zone, sc.ZoneID)
			return fmt.Sprintf("Zone %s", zone.Zone_Name)
		}
		return "พื้นที่จัดเก็บสินค้า"
	case "CATEGORY":
		if sc.SubSubCategoryID != nil {
			var ssc entity.SubSubCategory
			s.db.First(&ssc, sc.SubSubCategoryID)
			return fmt.Sprintf("หมวดหมู่ย่อยที่สุด: %s", ssc.Sub_Sub_Category_Name)
		} else if sc.SubCategoryID != nil {
			var subcat entity.SubCategory
			s.db.First(&subcat, sc.SubCategoryID)
			return fmt.Sprintf("หมวดหมู่ย่อย: %s", subcat.Sub_Category_Name)
		} else if sc.CategoryID != nil {
			var cat entity.Category
			s.db.First(&cat, sc.CategoryID)
			return fmt.Sprintf("หมวดหมู่: %s", cat.Category_Name)
		}
		return "หมวดหมู่สินค้า"
	case "PRODUCT":
		if sc.ProductID != nil {
			var prod entity.Product
			s.db.First(&prod, sc.ProductID)
			return fmt.Sprintf("สินค้า [%s] %s", prod.Product_Code, prod.Product_Name)
		}
		return "สินค้าชิ้นนี้"
	}
	return "รายการนี้"
}

type checkStockScheduleService struct {
	repo         wmsRepo.CheckStockScheduleRepository
	db           *gorm.DB // injected to do simple lookups for UI names and counts
	notification svcNotification.NotificationService
}

func NewCheckStockScheduleService(repo wmsRepo.CheckStockScheduleRepository, db *gorm.DB, notificationService svcNotification.NotificationService) CheckStockScheduleService {
	return &checkStockScheduleService{repo: repo, db: db, notification: notificationService}
}

func (s *checkStockScheduleService) CreateSchedule(req *wmsDto.CheckStockScheduleRequestDTO) (uint, error) {
	schedule := entity.CheckStockSchedule{
		Scheduled_DateTime:     req.Scheduled_DateTime,
		Scheduled_End_DateTime: req.Scheduled_End_DateTime,
		Status:                 "รอดำเนินการ",
		Note:                   req.Note,
		CheckType:              req.CheckType,
		ZoneID:                 req.ZoneID,
		ShelfID:                req.ShelfID,
		ShelfLevelID:           req.ShelfLevelID,
		CategoryID:             req.CategoryID,
		SubCategoryID:          req.SubCategoryID,
		SubSubCategoryID:       req.SubSubCategoryID,
		ProductID:              req.ProductID,
		UserID:                 req.UserID,
		AccessToken:            generateAccessToken(),
	}
	if err := s.repo.Create(&schedule); err != nil {
		return 0, err
	}

	// เจ้าของร้านสร้างตารางเช็คสต็อกใหม่แล้วมอบหมายพนักงานตั้งแต่ตอนสร้างเลย -> แจ้งเตือนพนักงานคนนั้นทันที
	// (ไม่ต้องรอถึงเวลาเริ่มจริง หรือรอให้ไปแก้ไข/เปลี่ยนตัวพนักงานทีหลังถึงจะได้แจ้งเตือน)
	if schedule.UserID != nil && s.notification != nil {
		if err := s.notification.NotifyUser(
			*schedule.UserID,
			"CHECK_STOCK_ASSIGNED",
			"คุณได้รับมอบหมายงานเช็คสต็อกใหม่",
			fmt.Sprintf("มีตารางเช็คสต็อกใหม่ กำหนดตรวจวันที่ %s", bangkokTime(schedule.Scheduled_DateTime).Format("02/01/2006 15:04")),
			fmt.Sprintf("/employee/wms/check-stock/%d", schedule.ID),
			&schedule.ID,
		); err != nil {
			log.Printf("[Notification] failed to notify user %d (schedule %d): %v", *schedule.UserID, schedule.ID, err)
		}
	}

	// แจ้งเตือนพนักงาน "คนอื่น" ที่ไม่ได้รับมอบหมายด้วย ให้รู้ว่าสินค้า/โซน/หมวดหมู่นี้กำลังจะถูกเช็ค
	// (เผื่อมีคนกำลังจะไปตัด/ปรับสต็อกจุดเดียวกันพร้อมกัน จะได้เห็นว่ามีคนอื่นกำลังตรวจอยู่)
	if s.notification != nil {
		if err := s.notification.NotifyEmployees(
			"CHECK_STOCK_SCHEDULED",
			"มีการเช็คสต็อกใหม่",
			fmt.Sprintf("%s กำลังจะถูกเช็คสต็อก กำหนดตรวจวันที่ %s", s.resolveTargetName(&schedule), bangkokTime(schedule.Scheduled_DateTime).Format("02/01/2006 15:04")),
			"/employee/wms/check-stock",
			&schedule.ID,
		); err != nil {
			log.Printf("[Notification] failed to notify employees (schedule %d): %v", schedule.ID, err)
		}
	}

	return schedule.ID, nil
}

func (s *checkStockScheduleService) Update(id uint, req *wmsDto.CheckStockScheduleRequestDTO) error {
	schedule, err := s.repo.GetByID(id)
	if err != nil {
		return err
	}
	// Check if editable
	if schedule.Status != "รอดำเนินการ" || time.Now().After(schedule.Scheduled_DateTime) {
		return errors.New("cannot edit schedule that has already started or is completed")
	}

	previousUserID := schedule.UserID

	schedule.Scheduled_DateTime = req.Scheduled_DateTime
	schedule.Scheduled_End_DateTime = req.Scheduled_End_DateTime
	schedule.Note = req.Note
	schedule.CheckType = req.CheckType
	schedule.ZoneID = req.ZoneID
	schedule.ShelfID = req.ShelfID
	schedule.ShelfLevelID = req.ShelfLevelID
	schedule.CategoryID = req.CategoryID
	schedule.ProductID = req.ProductID
	schedule.UserID = req.UserID

	if err := s.repo.Update(schedule); err != nil {
		return err
	}

	// เจ้าของร้านมอบหมาย/เปลี่ยนตัวพนักงานที่รับผิดชอบ -> แจ้งเตือนพนักงานคนใหม่ (แจ้งเฉพาะตอนเปลี่ยนตัวจริงๆ ไม่ใช่ทุกครั้งที่แก้ไข)
	isNewAssignment := schedule.UserID != nil && (previousUserID == nil || *previousUserID != *schedule.UserID)
	if isNewAssignment && s.notification != nil {
		if err := s.notification.NotifyUser(
			*schedule.UserID,
			"CHECK_STOCK_ASSIGNED",
			"คุณได้รับมอบหมายงานเช็คสต็อก",
			fmt.Sprintf("มีตารางเช็คสต็อกมอบหมายให้คุณ กำหนดตรวจวันที่ %s", bangkokTime(schedule.Scheduled_DateTime).Format("02/01/2006 15:04")),
			fmt.Sprintf("/employee/wms/check-stock/%d", schedule.ID),
			&schedule.ID,
		); err != nil {
			log.Printf("[Notification] failed to notify user %d (schedule %d): %v", *schedule.UserID, schedule.ID, err)
		}
	}

	return nil
}

func (s *checkStockScheduleService) GetByID(id uint) (*wmsDto.CheckStockScheduleResponseDTO, error) {
	sc, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	return s.toResponse(sc), nil
}

func (s *checkStockScheduleService) UpdateStatus(id uint, status string) error {
	// กันพนักงานส่งผลนับ ("รอตรวจสอบ") หลังเลยกำหนดเวลาสิ้นสุดที่ตั้งไว้ — กันกรณี client ข้าม UI ยิง API ตรงๆ
	// (ถ้ายังไม่เคยตั้งเวลาสิ้นสุดไว้จริง (ค่าว่าง/zero value) ถือว่าไม่มีเดดไลน์ ไม่บล็อก)
	var schedule *entity.CheckStockSchedule
	if status == "รอตรวจสอบ" {
		sc, err := s.repo.GetByID(id)
		if err != nil {
			return err
		}
		schedule = sc
		if !schedule.Scheduled_End_DateTime.IsZero() && time.Now().After(schedule.Scheduled_End_DateTime) {
			return errors.New("หมดเวลาที่กำหนดให้ตรวจสอบตารางนี้แล้ว ไม่สามารถส่งผลนับได้")
		}
	}

	if err := s.repo.UpdateStatus(id, status); err != nil {
		return err
	}

	// พนักงานส่งผลนับมาแล้ว -> แจ้งเตือนเจ้าของร้าน/แอดมินทุกคน (ไม่ไปโผล่ฝั่งพนักงานคนอื่น)
	if status == "รอตรวจสอบ" && schedule != nil && s.notification != nil {
		empName := "พนักงาน"
		if schedule.User != nil {
			empName = strings.TrimSpace(schedule.User.FirstName + " " + schedule.User.LastName)
		}
		if err := s.notification.NotifyOwners(
			"CHECK_STOCK_SUBMITTED",
			"มีการส่งผลนับสต็อกมาตรวจสอบ",
			fmt.Sprintf("%s ส่งผลนับสต็อกมาให้ตรวจสอบแล้ว", empName),
			fmt.Sprintf("/owner/stock/stock-check/%d", id),
			&id,
		); err != nil {
			log.Printf("[Notification] failed to notify owners (schedule %d): %v", id, err)
		}
	}

	return nil
}

// ApproveSchedule: เจ้าของร้านอนุมัติผลนับสต็อกที่พนักงานส่งมา (สถานะ "รอตรวจสอบ")
// นำจำนวนที่นับได้จริง (New_Quantity) ของแต่ละสินค้าไปเซ็ตเป็นสต็อกจริงในตาราง product แล้วปิดตารางเช็คเป็น "เสร็จสิ้น"
func (s *checkStockScheduleService) ApproveSchedule(id uint) error {
	schedule, err := s.repo.GetByID(id)
	if err != nil {
		return err
	}
	if schedule.Status != "รอตรวจสอบ" {
		return errors.New("ตารางนี้ยังไม่ได้ส่งผลนับสต็อกมาให้ตรวจสอบ")
	}

	var records []entity.CheckStock
	if err := s.db.Where("check_stock_schedule_id = ?", id).Find(&records).Error; err != nil {
		return err
	}
	if len(records) == 0 {
		return errors.New("ยังไม่มีข้อมูลสินค้าที่นับให้ตรวจสอบ")
	}

	if err := s.db.Transaction(func(tx *gorm.DB) error {
		for _, rec := range records {
			if rec.ProductID == nil {
				continue
			}
			if err := tx.Model(&entity.Product{}).Where("id = ?", *rec.ProductID).
				Update("quantity", rec.New_Quantity).Error; err != nil {
				return err
			}

			// บันทึกลง stock_movements (movement_type = "ADJUST") เฉพาะแถวที่นับได้ไม่ตรงกับระบบจริง เพื่อให้หน้า
			// "การเคลื่อนไหวของสินค้า" อ่านประวัติปรับสต็อกจากตารางนี้ได้โดยตรง แทนที่จะอ่านสด ๆ จาก check_stocks เหมือนเดิม
			// — นับตรงเป๊ะ (diff = 0) ไม่ถือเป็น "การเคลื่อนไหว" เหมือนที่ฟีดเดิมกรองทิ้งอยู่แล้ว
			if rec.Diff_Quantity != 0 {
				sign := "เกิน"
				diffAbs := rec.Diff_Quantity
				if diffAbs < 0 {
					sign = "ขาด"
					diffAbs = -diffAbs
				}
				detail := fmt.Sprintf("เดิม %d → นับได้ %d (%s %d)", rec.Old_Quantity, rec.New_Quantity, sign, diffAbs)
				if rec.Reason != "" {
					detail = fmt.Sprintf("%s — เหตุผล: %s", detail, rec.Reason)
				}
				movement := entity.StockMovement{
					Movement_Type:     "ADJUST",
					Quantity:          rec.Diff_Quantity,
					Movement_DateTime: rec.Adjustment_DateTime,
					Note:              detail,
					ProductID:         *rec.ProductID,
					SupplierID:        rec.SupplierID,
					UserID:            rec.UserID,
				}
				if err := tx.Session(&gorm.Session{}).Create(&movement).Error; err != nil {
					return err
				}
			}
		}
		return tx.Model(&entity.CheckStockSchedule{}).Where("id = ?", id).Update("status", "เสร็จสิ้น").Error
	}); err != nil {
		return err
	}

	// อนุมัติสำเร็จ -> แจ้งเตือนเฉพาะพนักงานที่ส่งผลนับมา (ไม่ไปโผล่หน้าคนอื่น)
	if schedule.UserID != nil && s.notification != nil {
		if err := s.notification.NotifyUser(
			*schedule.UserID,
			"CHECK_STOCK_APPROVED",
			"ผลนับสต็อกได้รับการอนุมัติแล้ว",
			"เจ้าของร้านตรวจสอบและอนุมัติผลนับสต็อกของคุณแล้ว ระบบบันทึกสต็อกใหม่เรียบร้อย",
			fmt.Sprintf("/employee/wms/check-stock/%d", id),
			&id,
		); err != nil {
			log.Printf("[Notification] failed to notify user %d (schedule %d): %v", *schedule.UserID, id, err)
		}
	}
	return nil
}

// RejectSchedule: เจ้าของร้านตีกลับผลนับสต็อก ให้พนักงานนับใหม่
// ลบข้อมูลที่นับไว้เดิมทิ้ง (กันซ้ำตอนนับใหม่) แล้วเปิดตารางกลับไปสถานะ "กำลังเช็ค" พร้อมแนบเหตุผลไว้ในหมายเหตุ
func (s *checkStockScheduleService) RejectSchedule(id uint, note string) error {
	schedule, err := s.repo.GetByID(id)
	if err != nil {
		return err
	}
	if schedule.Status != "รอตรวจสอบ" {
		return errors.New("ตารางนี้ยังไม่ได้ส่งผลนับสต็อกมาให้ตรวจสอบ")
	}

	if err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("check_stock_schedule_id = ?", id).Delete(&entity.CheckStock{}).Error; err != nil {
			return err
		}
		updates := map[string]interface{}{"status": "กำลังเช็ค"}
		if note != "" {
			combined := fmt.Sprintf("[เจ้าของร้านตีกลับ] %s", note)
			if schedule.Note != "" {
				combined = combined + "\n" + schedule.Note
			}
			updates["note"] = combined
		}
		return tx.Model(&entity.CheckStockSchedule{}).Where("id = ?", id).Updates(updates).Error
	}); err != nil {
		return err
	}

	// ตีกลับสำเร็จ -> แจ้งเตือนเฉพาะพนักงานที่ส่งผลนับมาให้นับใหม่ (ไม่ไปโผล่หน้าคนอื่น)
	if schedule.UserID != nil && s.notification != nil {
		msg := "เจ้าของร้านตีกลับผลนับสต็อกของคุณ กรุณานับใหม่อีกครั้ง"
		if note != "" {
			msg += fmt.Sprintf(" (เหตุผล: %s)", note)
		}
		if err := s.notification.NotifyUser(
			*schedule.UserID,
			"CHECK_STOCK_REJECTED",
			"ผลนับสต็อกถูกตีกลับ ให้นับใหม่",
			msg,
			fmt.Sprintf("/employee/wms/check-stock/%d", id),
			&id,
		); err != nil {
			log.Printf("[Notification] failed to notify user %d (schedule %d): %v", *schedule.UserID, id, err)
		}
	}
	return nil
}

// ActivateDueSchedules: เรียกจาก cron ทุก 1 นาที (ดู internal/app/cron/check_stock_cron.go)
// หาตารางที่ยังเป็น "รอดำเนินการ" แต่เวลาที่กำหนดเริ่มเช็คมาถึงแล้ว -> ปิดสถานะเป็น "กำลังเช็ค" จริงใน DB
// แล้วแจ้งเตือนพนักงานที่ได้รับมอบหมายว่าถึงเวลาต้องเริ่มเช็คสต็อกแล้ว (เดิมมีแค่ตอนมอบหมายงาน ไม่มีตอนถึงเวลาจริง)
func (s *checkStockScheduleService) ActivateDueSchedules() error {
	var due []entity.CheckStockSchedule
	if err := s.db.Preload("User").
		Where("status = ? AND scheduled_date_time <= ?", "รอดำเนินการ", time.Now()).
		Find(&due).Error; err != nil {
		return err
	}

	for _, sc := range due {
		if err := s.db.Model(&entity.CheckStockSchedule{}).Where("id = ?", sc.ID).Update("status", "กำลังเช็ค").Error; err != nil {
			log.Printf("[CheckStockCron] failed to activate schedule %d: %v", sc.ID, err)
			continue
		}

		if sc.UserID != nil && s.notification != nil {
			if err := s.notification.NotifyUser(
				*sc.UserID,
				"CHECK_STOCK_TIME_REACHED",
				"ถึงเวลาเช็คสต็อกแล้ว",
				fmt.Sprintf("ตารางเช็คสต็อกที่มอบหมายให้คุณ ถึงเวลาเริ่มตรวจแล้ว (เริ่ม %s น.) กรุณาดำเนินการนับสต็อก", bangkokTime(sc.Scheduled_DateTime).Format("15:04")),
				fmt.Sprintf("/employee/wms/check-stock/%d", sc.ID),
				&sc.ID,
			); err != nil {
				log.Printf("[Notification] failed to notify user %d (schedule %d): %v", *sc.UserID, sc.ID, err)
			}
		}

		// แจ้งเตือนพนักงานคนอื่นที่ไม่ได้รับมอบหมายด้วย ให้รู้ว่าตอนนี้มีการเช็คสต็อกจุดนี้อยู่จริงๆ แล้ว
		if s.notification != nil {
			if err := s.notification.NotifyEmployees(
				"CHECK_STOCK_IN_PROGRESS",
				"กำลังมีการเช็คสต็อก",
				fmt.Sprintf("%s กำลังถูกเช็คสต็อกอยู่ในขณะนี้", s.resolveTargetName(&sc)),
				"/employee/wms/check-stock",
				&sc.ID,
			); err != nil {
				log.Printf("[Notification] failed to notify employees (schedule %d): %v", sc.ID, err)
			}
		}
	}

	return nil
}

func (s *checkStockScheduleService) Delete(id uint) error {
	return s.repo.Delete(id)
}

func (s *checkStockScheduleService) List(status string) ([]wmsDto.CheckStockScheduleResponseDTO, error) {
	schedules, err := s.repo.List(status)
	if err != nil {
		return nil, err
	}
	result := make([]wmsDto.CheckStockScheduleResponseDTO, len(schedules))
	for i, sc := range schedules {
		result[i] = *s.toResponse(&sc)
	}
	return result, nil
}

func (s *checkStockScheduleService) ListEmployees() ([]entity.User, error) {
	var users []entity.User
	err := s.db.Joins("JOIN roles ON roles.id = users.role_id").
		Where("roles.role_name = ?", "Employee").
		Find(&users).Error
	return users, err
}

func (s *checkStockScheduleService) GetZoneTree() ([]entity.Zone, error) {
	var zones []entity.Zone
	err := s.db.Preload("Shelves.ShelfLevels").Find(&zones).Error
	return zones, err
}

func (s *checkStockScheduleService) GetCategoryTree() ([]entity.Category, error) {
	var categories []entity.Category
	err := s.db.Preload("SubCategories.SubSubCategories").Find(&categories).Error
	return categories, err
}

func (s *checkStockScheduleService) toResponse(sc *entity.CheckStockSchedule) *wmsDto.CheckStockScheduleResponseDTO {
	res := &wmsDto.CheckStockScheduleResponseDTO{
		ID:                     sc.ID,
		Scheduled_DateTime:     sc.Scheduled_DateTime,
		Scheduled_End_DateTime: sc.Scheduled_End_DateTime,
		Status:                 sc.Status,
		Note:                   sc.Note,
		CreatedAt:              sc.CreatedAt,
		CheckType:              sc.CheckType,
		ZoneID:                 sc.ZoneID,
		ShelfID:                sc.ShelfID,
		ShelfLevelID:           sc.ShelfLevelID,
		CategoryID:             sc.CategoryID,
		SubCategoryID:          sc.SubCategoryID,
		SubSubCategoryID:       sc.SubSubCategoryID,
		ProductID:              sc.ProductID,
		UserID:                 sc.UserID,
	}

	if sc.User != nil {
		res.UserFullName = sc.User.FirstName + " " + sc.User.LastName
	}
	res.AccessToken = sc.AccessToken

	// Update status dynamically if it's pending but time has passed
	if res.Status == "รอดำเนินการ" && time.Now().After(res.Scheduled_DateTime) {
		res.Status = "กำลังเช็ค"
		// Ideally we should also update the DB, but doing it in presentation is fine for now
	}

	// Derive TargetName and ProductCount based on CheckType
	// หมายเหตุ: ของเดิมเช็คแค่ "sc.ZoneID != nil" เป็นเงื่อนไขเข้าบล็อกนี้ทั้งก้อน แต่ตอนสร้าง/แก้ไขตาราง
	// ถ้าเลือกที่ระดับ "ตู้/ชั้นวาง" (shelf) หรือ "ชั้นระดับ" (shelf level) โดยตรงจาก tree เลือกโซน
	// หน้าบ้านจะส่งมาแค่ shelf_id หรือ shelf_level_id เท่านั้น ไม่ได้แนบ zone_id มาด้วย (ดู add_check_stock_schedule.tsx)
	// ทำให้เงื่อนไขนี้ไม่ผ่าน เลยข้ามการคำนวณทั้งชื่อเป้าหมายและจำนวนสินค้าไปเฉยๆ (โชว์ว่างเปล่า/0 ชิ้น)
	// แก้โดยเช็คแค่ประเภทเป็น LOCATION แล้วไล่หาโซนจากต้นทางที่มีจริง (shelf level -> shelf -> zone) แทน
	if sc.CheckType == "LOCATION" && (sc.ZoneID != nil || sc.ShelfID != nil || sc.ShelfLevelID != nil) {
		var zoneName, shelfName, levelName string
		resolvedZoneID := sc.ZoneID

		if sc.ShelfLevelID != nil {
			var level entity.ShelfLevel
			if err := s.db.Preload("Shelf.Zone").First(&level, sc.ShelfLevelID).Error; err == nil {
				levelName = level.Level_Name
				if level.Shelf != nil {
					shelfName = level.Shelf.Shelf_Name
					if level.Shelf.Zone != nil {
						zoneName = level.Shelf.Zone.Zone_Name
					}
					resolvedZoneID = &level.Shelf.ZoneID
				}
			}
		} else if sc.ShelfID != nil {
			var shelf entity.Shelf
			if err := s.db.Preload("Zone").First(&shelf, sc.ShelfID).Error; err == nil {
				shelfName = shelf.Shelf_Name
				if shelf.Zone != nil {
					zoneName = shelf.Zone.Zone_Name
				}
				resolvedZoneID = &shelf.ZoneID
			}
		} else if sc.ZoneID != nil {
			var zone entity.Zone
			s.db.First(&zone, sc.ZoneID)
			zoneName = zone.Zone_Name
		}

		target := fmt.Sprintf("Zone %s", zoneName)
		if shelfName != "" {
			target += fmt.Sprintf(" - %s", shelfName)
		}
		if levelName != "" {
			target += fmt.Sprintf(" - %s", levelName)
		}
		res.TargetName = target

		var count int64
		q := s.db.Model(&entity.Product{})
		if sc.ShelfLevelID != nil {
			q = q.Where("shelf_level_id = ?", sc.ShelfLevelID)
		} else if sc.ShelfID != nil {
			q = q.Where("shelf_id = ?", sc.ShelfID)
		} else if resolvedZoneID != nil {
			// Product ไม่มีคอลัมน์ zone_id ตรงๆ (โซนเชื่อมผ่าน shelf เท่านั้น) ต้อง join เพื่อกรองที่ระดับโซน
			// ของเดิม query "zone_id = ?" ตรงๆ ทับกับ column ที่ไม่มีจริงในตาราง products ทำให้ query fail เงียบๆ
			// แล้ว count ค้างเป็น 0 เสมอ (error จาก .Count() ไม่ได้ถูกเช็ค)
			q = q.Joins("JOIN shelves ON shelves.id = products.shelf_id").Where("shelves.zone_id = ?", resolvedZoneID)
		}
		if err := q.Count(&count).Error; err != nil {
			log.Printf("[CheckStockSchedule] failed to count products for schedule %d: %v", sc.ID, err)
		}
		res.ProductCount = int(count)

	} else if sc.CheckType == "CATEGORY" {
		if sc.SubSubCategoryID != nil {
			var ssc entity.SubSubCategory
			s.db.First(&ssc, sc.SubSubCategoryID)
			res.TargetName = fmt.Sprintf("หมวดหมู่ย่อยที่สุด: %s", ssc.Sub_Sub_Category_Name)
			var count int64
			s.db.Model(&entity.Product{}).Where("sub_sub_category_id = ?", sc.SubSubCategoryID).Count(&count)
			res.ProductCount = int(count)
		} else if sc.SubCategoryID != nil {
			var subcat entity.SubCategory
			s.db.First(&subcat, sc.SubCategoryID)
			res.TargetName = fmt.Sprintf("หมวดหมู่ย่อย: %s", subcat.Sub_Category_Name)
			var count int64
			s.db.Model(&entity.Product{}).Where("sub_category_id = ?", sc.SubCategoryID).Count(&count)
			res.ProductCount = int(count)
		} else if sc.CategoryID != nil {
			var cat entity.Category
			s.db.First(&cat, sc.CategoryID)
			res.TargetName = fmt.Sprintf("หมวดหมู่: %s", cat.Category_Name)

			var count int64
			s.db.Model(&entity.Product{}).Where("category_id = ?", sc.CategoryID).Count(&count)
			res.ProductCount = int(count)
		}
	} else if sc.CheckType == "PRODUCT" && sc.ProductID != nil {
		var prod entity.Product
		s.db.First(&prod, sc.ProductID)
		// รวมรหัสสินค้าไว้ใน TargetName ด้วย ให้ค้นหาได้ทั้งรหัสและชื่อจากฟิลด์เดียวกัน
		res.TargetName = fmt.Sprintf("[%s] %s", prod.Product_Code, prod.Product_Name)
		res.ProductCount = 1
	}

	return res
}
