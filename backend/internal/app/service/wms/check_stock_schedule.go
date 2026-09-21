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

// resolvedTargets: เป้าหมายการตรวจของตารางเช็คสต็อก 1 ใบ แยกเป็น slice ตามระดับ/ประเภท — ตารางเดียวเลือกได้
// หลายจุดพร้อมกัน (เช่น หลายโซน หรือหลายหมวดหมู่) ในการมอบหมายครั้งเดียว
type resolvedTargets struct {
	zoneIDs           []uint
	shelfIDs          []uint
	shelfLevelIDs     []uint
	categoryIDs       []uint
	subCategoryIDs    []uint
	subSubCategoryIDs []uint
	productIDs        []uint
}

// resolveTargets: อ่านเป้าหมายการตรวจของตารางนี้จาก sc.Targets (รองรับหลายเป้าหมาย) ถ้ามี ไม่งั้น fallback ไปอ่าน
// ฟิลด์เดี่ยวแบบเดิม (ตารางเก่าที่สร้างไว้ก่อนรองรับหลายเป้าหมาย ยังไม่มีแถวใน Targets เลย)
func resolveTargets(sc *entity.CheckStockSchedule) resolvedTargets {
	var t resolvedTargets
	if len(sc.Targets) > 0 {
		for _, target := range sc.Targets {
			switch target.TargetType {
			case "ZONE":
				t.zoneIDs = append(t.zoneIDs, target.TargetID)
			case "SHELF":
				t.shelfIDs = append(t.shelfIDs, target.TargetID)
			case "SHELF_LEVEL":
				t.shelfLevelIDs = append(t.shelfLevelIDs, target.TargetID)
			case "CATEGORY":
				t.categoryIDs = append(t.categoryIDs, target.TargetID)
			case "SUB_CATEGORY":
				t.subCategoryIDs = append(t.subCategoryIDs, target.TargetID)
			case "SUB_SUB_CATEGORY":
				t.subSubCategoryIDs = append(t.subSubCategoryIDs, target.TargetID)
			case "PRODUCT":
				t.productIDs = append(t.productIDs, target.TargetID)
			}
		}
		return t
	}

	if sc.ZoneID != nil {
		t.zoneIDs = []uint{*sc.ZoneID}
	}
	if sc.ShelfID != nil {
		t.shelfIDs = []uint{*sc.ShelfID}
	}
	if sc.ShelfLevelID != nil {
		t.shelfLevelIDs = []uint{*sc.ShelfLevelID}
	}
	if sc.CategoryID != nil {
		t.categoryIDs = []uint{*sc.CategoryID}
	}
	if sc.SubCategoryID != nil {
		t.subCategoryIDs = []uint{*sc.SubCategoryID}
	}
	if sc.SubSubCategoryID != nil {
		t.subSubCategoryIDs = []uint{*sc.SubSubCategoryID}
	}
	if sc.ProductID != nil {
		t.productIDs = []uint{*sc.ProductID}
	}
	return t
}

// excludedProductIDs: สินค้าที่เจ้าของร้านเอาออกจากรายการที่ระบบหามาให้อัตโนมัติ (เฉพาะ LOCATION/CATEGORY)
func excludedProductIDs(sc *entity.CheckStockSchedule) []uint {
	ids := make([]uint, 0, len(sc.ExcludedProducts))
	for _, ep := range sc.ExcludedProducts {
		ids = append(ids, ep.ProductID)
	}
	return ids
}

// buildTargetRows/buildExcludedProductRows: แปลง ID ที่ส่งมาจากหน้าสร้าง/แก้ไขตาราง (แยกเป็น array ตามระดับ/ประเภท)
// เป็นแถว entity ที่จะเก็บลงตาราง Targets/ExcludedProducts
func buildTargetRows(req *wmsDto.CheckStockScheduleRequestDTO) []entity.CheckStockScheduleTarget {
	var rows []entity.CheckStockScheduleTarget
	appendRows := func(targetType string, ids []uint) {
		for _, id := range ids {
			rows = append(rows, entity.CheckStockScheduleTarget{TargetType: targetType, TargetID: id})
		}
	}
	appendRows("ZONE", req.ZoneIDs)
	appendRows("SHELF", req.ShelfIDs)
	appendRows("SHELF_LEVEL", req.ShelfLevelIDs)
	appendRows("CATEGORY", req.CategoryIDs)
	appendRows("SUB_CATEGORY", req.SubCategoryIDs)
	appendRows("SUB_SUB_CATEGORY", req.SubSubCategoryIDs)
	appendRows("PRODUCT", req.ProductIDs)
	return rows
}

func buildExcludedProductRows(productIDs []uint) []entity.CheckStockScheduleExcludedProduct {
	rows := make([]entity.CheckStockScheduleExcludedProduct, 0, len(productIDs))
	for _, id := range productIDs {
		rows = append(rows, entity.CheckStockScheduleExcludedProduct{ProductID: id})
	}
	return rows
}

// resolveTargetName: สร้างข้อความอธิบาย "เป้าหมายการตรวจ" แบบสั้นๆ ใช้ในข้อความแจ้งเตือน
// (แยกจาก toResponse ที่คำนวณ TargetName+ProductCount เต็มรูปแบบสำหรับหน้าตาราง เพื่อไม่ให้ไปกระทบของเดิม)
func (s *checkStockScheduleService) resolveTargetName(sc *entity.CheckStockSchedule) string {
	name, _ := s.buildTargetNameAndCount(sc.CheckType, resolveTargets(sc), excludedProductIDs(sc))
	return name
}

func (s *checkStockScheduleService) describeZone(id uint) string {
	var zone entity.Zone
	s.db.First(&zone, id)
	return fmt.Sprintf("Zone %s", zone.Zone_Name)
}

func (s *checkStockScheduleService) describeShelf(id uint) string {
	var shelf entity.Shelf
	if err := s.db.Preload("Zone").First(&shelf, id).Error; err == nil && shelf.Zone != nil {
		return fmt.Sprintf("Zone %s - %s", shelf.Zone.Zone_Name, shelf.Shelf_Name)
	}
	return "พื้นที่จัดเก็บสินค้า"
}

func (s *checkStockScheduleService) describeShelfLevel(id uint) string {
	var level entity.ShelfLevel
	if err := s.db.Preload("Shelf.Zone").First(&level, id).Error; err == nil && level.Shelf != nil && level.Shelf.Zone != nil {
		return fmt.Sprintf("Zone %s - %s - %s", level.Shelf.Zone.Zone_Name, level.Shelf.Shelf_Name, level.Level_Name)
	}
	return "พื้นที่จัดเก็บสินค้า"
}

func (s *checkStockScheduleService) describeCategory(id uint) string {
	var cat entity.Category
	s.db.First(&cat, id)
	return fmt.Sprintf("หมวดหมู่: %s", cat.Category_Name)
}

func (s *checkStockScheduleService) describeSubCategory(id uint) string {
	var subcat entity.SubCategory
	s.db.First(&subcat, id)
	return fmt.Sprintf("หมวดหมู่ย่อย: %s", subcat.Sub_Category_Name)
}

func (s *checkStockScheduleService) describeSubSubCategory(id uint) string {
	var ssc entity.SubSubCategory
	s.db.First(&ssc, id)
	return fmt.Sprintf("หมวดหมู่ย่อยที่สุด: %s", ssc.Sub_Sub_Category_Name)
}

// countProductsForLocation/countProductsForCategory: นับสินค้าที่ตรงกับเป้าหมายที่เลือกไว้ "จุดใดจุดหนึ่งก็ได้"
// (union หลายเป้าหมาย ไม่ใช่ต้องตรงทุกจุด) แล้วหักสินค้าที่เจ้าของร้านเอาออกด้วยตนเองออกไป
func (s *checkStockScheduleService) countProductsForLocation(t resolvedTargets, excluded []uint) int {
	var conditions []string
	var args []interface{}
	if len(t.shelfLevelIDs) > 0 {
		conditions = append(conditions, "shelf_level_id IN (?)")
		args = append(args, t.shelfLevelIDs)
	}
	if len(t.shelfIDs) > 0 {
		conditions = append(conditions, "shelf_id IN (?)")
		args = append(args, t.shelfIDs)
	}
	if len(t.zoneIDs) > 0 {
		conditions = append(conditions, "shelf_id IN (SELECT id FROM shelves WHERE zone_id IN (?))")
		args = append(args, t.zoneIDs)
	}
	if len(conditions) == 0 {
		return 0
	}
	q := s.db.Model(&entity.Product{}).Where(strings.Join(conditions, " OR "), args...)
	if len(excluded) > 0 {
		q = q.Where("id NOT IN (?)", excluded)
	}
	var count int64
	if err := q.Count(&count).Error; err != nil {
		log.Printf("[CheckStockSchedule] failed to count products for location targets: %v", err)
	}
	return int(count)
}

func (s *checkStockScheduleService) countProductsForCategory(t resolvedTargets, excluded []uint) int {
	var conditions []string
	var args []interface{}
	if len(t.subSubCategoryIDs) > 0 {
		conditions = append(conditions, "sub_sub_category_id IN (?)")
		args = append(args, t.subSubCategoryIDs)
	}
	if len(t.subCategoryIDs) > 0 {
		conditions = append(conditions, "sub_category_id IN (?)")
		args = append(args, t.subCategoryIDs)
	}
	if len(t.categoryIDs) > 0 {
		conditions = append(conditions, "category_id IN (?)")
		args = append(args, t.categoryIDs)
	}
	if len(conditions) == 0 {
		return 0
	}
	q := s.db.Model(&entity.Product{}).Where(strings.Join(conditions, " OR "), args...)
	if len(excluded) > 0 {
		q = q.Where("id NOT IN (?)", excluded)
	}
	var count int64
	if err := q.Count(&count).Error; err != nil {
		log.Printf("[CheckStockSchedule] failed to count products for category targets: %v", err)
	}
	return int(count)
}

func (s *checkStockScheduleService) locationTargetNameAndCount(t resolvedTargets, excluded []uint) (string, int) {
	var names []string
	for _, id := range t.shelfLevelIDs {
		names = append(names, s.describeShelfLevel(id))
	}
	for _, id := range t.shelfIDs {
		names = append(names, s.describeShelf(id))
	}
	for _, id := range t.zoneIDs {
		names = append(names, s.describeZone(id))
	}
	if len(names) == 0 {
		return "พื้นที่จัดเก็บสินค้า", 0
	}
	count := s.countProductsForLocation(t, excluded)
	if len(names) == 1 {
		return names[0], count
	}
	return fmt.Sprintf("หลายพื้นที่ (%d): %s", len(names), strings.Join(names, ", ")), count
}

func (s *checkStockScheduleService) categoryTargetNameAndCount(t resolvedTargets, excluded []uint) (string, int) {
	var names []string
	for _, id := range t.subSubCategoryIDs {
		names = append(names, s.describeSubSubCategory(id))
	}
	for _, id := range t.subCategoryIDs {
		names = append(names, s.describeSubCategory(id))
	}
	for _, id := range t.categoryIDs {
		names = append(names, s.describeCategory(id))
	}
	if len(names) == 0 {
		return "หมวดหมู่สินค้า", 0
	}
	count := s.countProductsForCategory(t, excluded)
	if len(names) == 1 {
		return names[0], count
	}
	return fmt.Sprintf("หลายหมวดหมู่ (%d): %s", len(names), strings.Join(names, ", ")), count
}

func (s *checkStockScheduleService) productTargetNameAndCount(t resolvedTargets) (string, int) {
	if len(t.productIDs) == 0 {
		return "สินค้าชิ้นนี้", 0
	}
	var products []entity.Product
	s.db.Where("id IN (?)", t.productIDs).Find(&products)
	names := make([]string, 0, len(products))
	for _, p := range products {
		names = append(names, fmt.Sprintf("[%s] %s", p.Product_Code, p.Product_Name))
	}
	count := len(t.productIDs)
	switch len(names) {
	case 0:
		return "สินค้าชิ้นนี้", count
	case 1:
		return names[0], count
	default:
		return fmt.Sprintf("หลายรายการ (%d): %s", len(names), strings.Join(names, ", ")), count
	}
}

// buildTargetNameAndCount: คำนวณชื่อเป้าหมาย + จำนวนสินค้าที่คาดว่าต้องนับ ใช้ร่วมกันทั้ง toResponse (แสดงหน้าตาราง)
// และ resolveTargetName (ข้อความแจ้งเตือน)
func (s *checkStockScheduleService) buildTargetNameAndCount(checkType string, t resolvedTargets, excluded []uint) (string, int) {
	switch checkType {
	case "LOCATION":
		return s.locationTargetNameAndCount(t, excluded)
	case "CATEGORY":
		return s.categoryTargetNameAndCount(t, excluded)
	case "PRODUCT":
		return s.productTargetNameAndCount(t)
	}
	return "รายการนี้", 0
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
		Targets:                buildTargetRows(req),
		ExcludedProducts:       buildExcludedProductRows(req.ExcludedProductIDs),
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

// isScheduleOverdue: ตารางเลยเวลาสิ้นสุดที่กำหนดไว้แล้ว แต่พนักงานยังไม่ส่งผลนับมา (ค้างอยู่ที่ "กำลังเช็ค")
// ถ้ายังไม่เคยตั้งเวลาสิ้นสุดไว้จริง (ค่าว่าง/zero value) ถือว่าไม่มีเดดไลน์ ไม่ถือว่าเลยกำหนด
func isScheduleOverdue(schedule *entity.CheckStockSchedule) bool {
	return schedule.Status == "กำลังเช็ค" && !schedule.Scheduled_End_DateTime.IsZero() && time.Now().After(schedule.Scheduled_End_DateTime)
}

func (s *checkStockScheduleService) Update(id uint, req *wmsDto.CheckStockScheduleRequestDTO) error {
	schedule, err := s.repo.GetByID(id)
	if err != nil {
		return err
	}
	// แก้ไขได้ปกติตอนยัง "รอดำเนินการ" และเวลาเริ่มยังไม่มาถึง หรือกรณีเลยเวลากำหนดแล้ว (เจ้าของร้านต้องพิจารณาแก้ไข/สั่งงานซ้ำ)
	overdue := isScheduleOverdue(schedule)
	notStartedYet := schedule.Status == "รอดำเนินการ" && !time.Now().After(schedule.Scheduled_DateTime)
	if !notStartedYet && !overdue {
		return errors.New("cannot edit schedule that has already started or is completed")
	}

	previousUserID := schedule.UserID

	// ตารางที่เลยกำหนดแล้วถูกแก้ไข = เจ้าของร้านสั่งงานซ้ำด้วยเวลาใหม่ -> เปิดสถานะกลับไป "รอดำเนินการ"
	// ให้ cron (ActivateDueSchedules) มาเปลี่ยนเป็น "กำลังเช็ค" เองอีกครั้งตอนถึงเวลาเริ่มใหม่
	if overdue {
		schedule.Status = "รอดำเนินการ"
	}

	schedule.Scheduled_DateTime = req.Scheduled_DateTime
	schedule.Scheduled_End_DateTime = req.Scheduled_End_DateTime
	schedule.Note = req.Note
	schedule.CheckType = req.CheckType
	schedule.UserID = req.UserID
	// เลิกใช้ฟิลด์เป้าหมายเดี่ยวแบบเดิมแล้ว (ย้ายไปเก็บที่ Targets ทั้งหมด) เคลียร์ทิ้งกันมีค่าเก่าค้างสับสน
	schedule.ZoneID = nil
	schedule.ShelfID = nil
	schedule.ShelfLevelID = nil
	schedule.CategoryID = nil
	schedule.SubCategoryID = nil
	schedule.SubSubCategoryID = nil
	schedule.ProductID = nil

	if err := s.repo.Update(schedule); err != nil {
		return err
	}
	// แทนที่เป้าหมาย/รายการที่เอาออกทั้งชุดด้วยของใหม่ที่ส่งมา (ลบของเก่าทิ้งหมดแล้วสร้างใหม่ ไม่ใช่ merge)
	if err := s.repo.ReplaceTargets(id, buildTargetRows(req)); err != nil {
		return err
	}
	if err := s.repo.ReplaceExcludedProducts(id, buildExcludedProductRows(req.ExcludedProductIDs)); err != nil {
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
// สินค้าที่มีหลายบริษัท พนักงานจะนับแยกเป็นคนละแถว (คนละ record) ต่อบริษัทมาแล้ว — แถวที่ระบุบริษัทไว้ (SupplierID
// ไม่ null) จะไปเซ็ตยอดคงเหลือของบริษัทนั้นตรงๆ ที่ Inventory เลย ไม่ต้องเดา/กระจายสัดส่วนอีกต่อไป ส่วน Product.Quantity
// (ยอดรวมทั้งหมด) จะถูกเซ็ตเป็นผลรวมของทุกแถวของสินค้านั้นหลังวนครบทุกแถวแล้ว (กันไม่ให้แถวหลังทับแถวก่อนจนยอดรวมหาย)
// ปิดตารางเช็คเป็น "เสร็จสิ้น" เมื่อเสร็จ
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
		// ยอดรวมใหม่ต่อสินค้า สะสมจากทุกแถวที่นับของสินค้านั้น (ทั้งที่ระบุบริษัทและไม่ระบุ) ไว้ set ทีเดียวหลังวนครบลูป
		productNewTotal := make(map[uint]int)

		for _, rec := range records {
			if rec.ProductID == nil {
				continue
			}
			productNewTotal[*rec.ProductID] += rec.New_Quantity

			// แถวที่ระบุบริษัทไว้ -> เซ็ตยอดคงเหลือของบริษัทนั้นตรงๆ ที่ Inventory (แถวที่ไม่ระบุบริษัท เช่นส่วนต่างที่
			// หาที่มาไม่ได้ จะปรับแค่ยอดรวมสินค้าอย่างเดียว ไม่มี Inventory ให้ปรับ)
			if rec.SupplierID != nil {
				if err := tx.Model(&entity.Inventory{}).
					Where("product_id = ? AND supplier_id = ?", *rec.ProductID, *rec.SupplierID).
					Updates(map[string]interface{}{
						"inventory_quantity":     rec.New_Quantity,
						"last_updated_date_time": rec.Adjustment_DateTime,
					}).Error; err != nil {
					return err
				}
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

		for productID, total := range productNewTotal {
			if err := tx.Model(&entity.Product{}).Where("id = ?", productID).Update("quantity", total).Error; err != nil {
				return err
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
	t := resolveTargets(sc)
	excluded := excludedProductIDs(sc)

	res := &wmsDto.CheckStockScheduleResponseDTO{
		ID:                     sc.ID,
		Scheduled_DateTime:     sc.Scheduled_DateTime,
		Scheduled_End_DateTime: sc.Scheduled_End_DateTime,
		Status:                 sc.Status,
		Note:                   sc.Note,
		CreatedAt:              sc.CreatedAt,
		CheckType:              sc.CheckType,
		ZoneIDs:                t.zoneIDs,
		ShelfIDs:               t.shelfIDs,
		ShelfLevelIDs:          t.shelfLevelIDs,
		CategoryIDs:            t.categoryIDs,
		SubCategoryIDs:         t.subCategoryIDs,
		SubSubCategoryIDs:      t.subSubCategoryIDs,
		ProductIDs:             t.productIDs,
		ExcludedProductIDs:     excluded,
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

	res.TargetName, res.ProductCount = s.buildTargetNameAndCount(sc.CheckType, t, excluded)

	return res
}
