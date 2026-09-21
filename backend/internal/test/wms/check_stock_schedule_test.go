package wms

import (
	"errors"
	"strings"
	"testing"
	"time"

	dtoNotification "backend/internal/app/dto/notification"
	wmsDTO "backend/internal/app/dto/wms"
	"backend/internal/app/entity"
	wmsRepo "backend/internal/app/repository/wms"
	svcNotification "backend/internal/app/service/notification"
	wmsService "backend/internal/app/service/wms"

	"gorm.io/gorm"
)

// ---------------------------------------------------------------------------
// CheckStockScheduleService มี field `db *gorm.DB` แยกจาก repo ไว้ query ชื่อ/จำนวนสินค้าสำหรับหน้า UI โดยตรง
// (ดูรายละเอียดใน service/wms/check_stock_schedule.go) — เมธอดที่พึ่ง s.db ตรงๆ เช่น ApproveSchedule,
// RejectSchedule, ActivateDueSchedules, ListEmployees, GetZoneTree, GetCategoryTree และ path เสริมข้อมูลของ
// toResponse() (ตอน CheckType มีเป้าหมายจริง) ยังไม่ครอบคลุมในไฟล์นี้ เพราะต้องมี DB จริง (หรือ sqlite in-memory)
// ถึงจะเทสได้ — ไม่ใช้แค่ mock repo — ต่างจาก convention เดิมของทีมที่ทดสอบด้วย mock ล้วน จึงยังไม่เพิ่มเข้ามาเอง
// ทดสอบเฉพาะ path ที่ปลอดภัย (ไม่แตะ s.db เลย) โดยตั้งค่า fixture ให้ CheckType/ID ต่างๆ ไม่ตรงเงื่อนไขที่ต้อง query DB
// ---------------------------------------------------------------------------

type mockCheckStockScheduleRepo struct {
	createFn                  func(*entity.CheckStockSchedule) error
	getByIDFn                 func(uint) (*entity.CheckStockSchedule, error)
	updateStatusFn            func(uint, string) error
	updateFn                  func(*entity.CheckStockSchedule) error
	replaceTargetsFn          func(uint, []entity.CheckStockScheduleTarget) error
	replaceExcludedProductsFn func(uint, []entity.CheckStockScheduleExcludedProduct) error
	deleteFn                  func(uint) error
	listFn                    func(string) ([]entity.CheckStockSchedule, error)

	called map[string]int
}

func newMockCheckStockScheduleRepo() *mockCheckStockScheduleRepo {
	return &mockCheckStockScheduleRepo{called: map[string]int{}}
}

func (m *mockCheckStockScheduleRepo) track(name string) { m.called[name]++ }

func (m *mockCheckStockScheduleRepo) Create(schedule *entity.CheckStockSchedule) error {
	m.track("Create")
	if m.createFn != nil {
		return m.createFn(schedule)
	}
	schedule.ID = 1
	return nil
}

func (m *mockCheckStockScheduleRepo) GetByID(id uint) (*entity.CheckStockSchedule, error) {
	m.track("GetByID")
	if m.getByIDFn != nil {
		return m.getByIDFn(id)
	}
	return nil, errors.New("not found")
}

func (m *mockCheckStockScheduleRepo) UpdateStatus(id uint, status string) error {
	m.track("UpdateStatus")
	if m.updateStatusFn != nil {
		return m.updateStatusFn(id, status)
	}
	return nil
}

func (m *mockCheckStockScheduleRepo) Update(schedule *entity.CheckStockSchedule) error {
	m.track("Update")
	if m.updateFn != nil {
		return m.updateFn(schedule)
	}
	return nil
}

func (m *mockCheckStockScheduleRepo) ReplaceTargets(scheduleID uint, targets []entity.CheckStockScheduleTarget) error {
	m.track("ReplaceTargets")
	if m.replaceTargetsFn != nil {
		return m.replaceTargetsFn(scheduleID, targets)
	}
	return nil
}

func (m *mockCheckStockScheduleRepo) ReplaceExcludedProducts(scheduleID uint, excluded []entity.CheckStockScheduleExcludedProduct) error {
	m.track("ReplaceExcludedProducts")
	if m.replaceExcludedProductsFn != nil {
		return m.replaceExcludedProductsFn(scheduleID, excluded)
	}
	return nil
}

func (m *mockCheckStockScheduleRepo) Delete(id uint) error {
	m.track("Delete")
	if m.deleteFn != nil {
		return m.deleteFn(id)
	}
	return nil
}

func (m *mockCheckStockScheduleRepo) List(status string) ([]entity.CheckStockSchedule, error) {
	m.track("List")
	if m.listFn != nil {
		return m.listFn(status)
	}
	return nil, nil
}

var _ wmsRepo.CheckStockScheduleRepository = (*mockCheckStockScheduleRepo)(nil)

// ---------------------------------------------------------------------------
// mockNotificationService
// ---------------------------------------------------------------------------

type notifyCall struct {
	kind       string // "owners" | "user" | "employees"
	userID     uint
	notifType  string
	title      string
	message    string
	scheduleID *uint
}

type mockNotificationService struct {
	calls []notifyCall
}

func (m *mockNotificationService) NotifyOwners(notifType, title, message, link string, scheduleID *uint) error {
	m.calls = append(m.calls, notifyCall{kind: "owners", notifType: notifType, title: title, message: message, scheduleID: scheduleID})
	return nil
}

func (m *mockNotificationService) NotifyUser(userID uint, notifType, title, message, link string, scheduleID *uint) error {
	m.calls = append(m.calls, notifyCall{kind: "user", userID: userID, notifType: notifType, title: title, message: message, scheduleID: scheduleID})
	return nil
}

func (m *mockNotificationService) NotifyEmployees(notifType, title, message, link string, scheduleID *uint) error {
	m.calls = append(m.calls, notifyCall{kind: "employees", notifType: notifType, title: title, message: message, scheduleID: scheduleID})
	return nil
}

func (m *mockNotificationService) ListForOwners() (*dtoNotification.NotificationListResponseDTO, error) {
	return &dtoNotification.NotificationListResponseDTO{}, nil
}

func (m *mockNotificationService) ListForUser(uint) (*dtoNotification.NotificationListResponseDTO, error) {
	return &dtoNotification.NotificationListResponseDTO{}, nil
}

func (m *mockNotificationService) MarkRead(uint) error           { return nil }
func (m *mockNotificationService) MarkAllReadForOwners() error   { return nil }
func (m *mockNotificationService) MarkAllReadForUser(uint) error { return nil }

var _ svcNotification.NotificationService = (*mockNotificationService)(nil)

func (m *mockNotificationService) callsOfKind(kind string) []notifyCall {
	var out []notifyCall
	for _, c := range m.calls {
		if c.kind == kind {
			out = append(out, c)
		}
	}
	return out
}

// newCheckStockScheduleServiceForTest: ตั้งใจส่ง db เป็น nil เสมอ — ทุก test ในไฟล์นี้ต้องเลือก fixture
// ที่ไม่ทำให้ service เดินเข้า branch ที่ query s.db เอง (ดูคอมเมนต์ด้านบนไฟล์) ไม่งั้นจะ panic (nil pointer)
func newCheckStockScheduleServiceForTest(repo wmsRepo.CheckStockScheduleRepository, notif svcNotification.NotificationService) wmsService.CheckStockScheduleService {
	return wmsService.NewCheckStockScheduleService(repo, nil, notif)
}

// ---------------------------------------------------------------------------
// CreateSchedule
// ---------------------------------------------------------------------------

func TestCreateSchedule_SetsInitialStatusAndAccessToken(t *testing.T) {
	repo := newMockCheckStockScheduleRepo()
	var captured entity.CheckStockSchedule
	repo.createFn = func(sc *entity.CheckStockSchedule) error {
		sc.ID = 1
		captured = *sc
		return nil
	}
	notif := &mockNotificationService{}
	svc := newCheckStockScheduleServiceForTest(repo, notif)

	req := &wmsDTO.CheckStockScheduleRequestDTO{
		Scheduled_DateTime:     time.Now().Add(time.Hour),
		Scheduled_End_DateTime: time.Now().Add(2 * time.Hour),
		CheckType:              "LOCATION", // ตั้งใจไม่ใส่ ZoneID/ShelfID/ShelfLevelID กัน resolveTargetName แตะ s.db
	}
	id, err := svc.CreateSchedule(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if id != 1 {
		t.Errorf("expected returned ID 1, got %d", id)
	}
	if captured.Status != "รอดำเนินการ" {
		t.Errorf("expected initial status รอดำเนินการ, got %q", captured.Status)
	}
	if captured.AccessToken == "" {
		t.Error("expected a non-empty access token to be generated for the QR code")
	}
}

func TestCreateSchedule_NotifiesAssignedUserWhenUserIDSet(t *testing.T) {
	repo := newMockCheckStockScheduleRepo()
	repo.createFn = func(sc *entity.CheckStockSchedule) error {
		sc.ID = 1
		return nil
	}
	notif := &mockNotificationService{}
	svc := newCheckStockScheduleServiceForTest(repo, notif)

	userID := uint(9)
	req := &wmsDTO.CheckStockScheduleRequestDTO{
		Scheduled_DateTime:     time.Now().Add(time.Hour),
		Scheduled_End_DateTime: time.Now().Add(2 * time.Hour),
		CheckType:              "LOCATION",
		UserID:                 &userID,
	}
	if _, err := svc.CreateSchedule(req); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	userNotifs := notif.callsOfKind("user")
	if len(userNotifs) != 1 || userNotifs[0].userID != 9 {
		t.Errorf("expected exactly 1 notification to user 9, got %+v", userNotifs)
	}
	// ต้องแจ้งพนักงานคนอื่นด้วยเสมอ ไม่ว่าจะมอบหมายใครหรือไม่ก็ตาม
	if len(notif.callsOfKind("employees")) != 1 {
		t.Errorf("expected employees to also be notified about the new schedule, got %d calls", len(notif.callsOfKind("employees")))
	}
}

func TestCreateSchedule_DoesNotNotifyUserWhenUnassigned(t *testing.T) {
	repo := newMockCheckStockScheduleRepo()
	notif := &mockNotificationService{}
	svc := newCheckStockScheduleServiceForTest(repo, notif)

	req := &wmsDTO.CheckStockScheduleRequestDTO{
		Scheduled_DateTime:     time.Now().Add(time.Hour),
		Scheduled_End_DateTime: time.Now().Add(2 * time.Hour),
		CheckType:              "LOCATION",
		UserID:                 nil,
	}
	if _, err := svc.CreateSchedule(req); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(notif.callsOfKind("user")) != 0 {
		t.Errorf("expected no per-user notification when no employee is assigned, got %d", len(notif.callsOfKind("user")))
	}
}

func TestCreateSchedule_RepoError_Propagates(t *testing.T) {
	repo := newMockCheckStockScheduleRepo()
	wantErr := errors.New("insert failed")
	repo.createFn = func(*entity.CheckStockSchedule) error { return wantErr }
	svc := newCheckStockScheduleServiceForTest(repo, &mockNotificationService{})

	_, err := svc.CreateSchedule(&wmsDTO.CheckStockScheduleRequestDTO{
		Scheduled_DateTime:     time.Now().Add(time.Hour),
		Scheduled_End_DateTime: time.Now().Add(2 * time.Hour),
		CheckType:              "LOCATION",
	})
	if !errors.Is(err, wantErr) {
		t.Fatalf("expected error %v, got %v", wantErr, err)
	}
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

func TestUpdate_RejectsWhenStatusIsNotPending(t *testing.T) {
	repo := newMockCheckStockScheduleRepo()
	repo.getByIDFn = func(id uint) (*entity.CheckStockSchedule, error) {
		return &entity.CheckStockSchedule{
			Model:              modelWithID(id),
			Status:             "กำลังเช็ค",
			Scheduled_DateTime: time.Now().Add(time.Hour),
		}, nil
	}
	svc := newCheckStockScheduleServiceForTest(repo, &mockNotificationService{})

	err := svc.Update(1, &wmsDTO.CheckStockScheduleRequestDTO{
		Scheduled_DateTime:     time.Now().Add(time.Hour),
		Scheduled_End_DateTime: time.Now().Add(2 * time.Hour),
		CheckType:              "LOCATION",
	})
	if err == nil {
		t.Fatal("expected error when editing a schedule that is not still รอดำเนินการ")
	}
	if repo.called["Update"] != 0 {
		t.Error("expected repo.Update not to be called when the guard rejects the edit")
	}
}

func TestUpdate_RejectsWhenAlreadyStarted(t *testing.T) {
	repo := newMockCheckStockScheduleRepo()
	repo.getByIDFn = func(id uint) (*entity.CheckStockSchedule, error) {
		return &entity.CheckStockSchedule{
			Model:              modelWithID(id),
			Status:             "รอดำเนินการ",
			Scheduled_DateTime: time.Now().Add(-time.Hour), // เวลาเริ่มผ่านไปแล้ว
		}, nil
	}
	svc := newCheckStockScheduleServiceForTest(repo, &mockNotificationService{})

	err := svc.Update(1, &wmsDTO.CheckStockScheduleRequestDTO{
		Scheduled_DateTime:     time.Now().Add(time.Hour),
		Scheduled_End_DateTime: time.Now().Add(2 * time.Hour),
		CheckType:              "LOCATION",
	})
	if err == nil {
		t.Fatal("expected error when the schedule's start time has already passed")
	}
}

func TestUpdate_OverdueSchedule_AllowsEditAndResetsToRodamnoenkarn(t *testing.T) {
	repo := newMockCheckStockScheduleRepo()
	repo.getByIDFn = func(id uint) (*entity.CheckStockSchedule, error) {
		return &entity.CheckStockSchedule{
			Model:                  modelWithID(id),
			Status:                 "กำลังเช็ค",
			Scheduled_DateTime:     time.Now().Add(-3 * time.Hour),
			Scheduled_End_DateTime: time.Now().Add(-time.Hour), // เลยเวลาสิ้นสุดที่กำหนดไปแล้ว
		}, nil
	}
	var captured entity.CheckStockSchedule
	repo.updateFn = func(sc *entity.CheckStockSchedule) error {
		captured = *sc
		return nil
	}
	svc := newCheckStockScheduleServiceForTest(repo, &mockNotificationService{})

	newStart := time.Now().Add(time.Hour)
	newEnd := time.Now().Add(2 * time.Hour)
	err := svc.Update(1, &wmsDTO.CheckStockScheduleRequestDTO{
		Scheduled_DateTime:     newStart,
		Scheduled_End_DateTime: newEnd,
		CheckType:              "LOCATION",
	})
	if err != nil {
		t.Fatalf("expected overdue schedule to be editable (owner reviewing/reissuing it), got error: %v", err)
	}
	if repo.called["Update"] != 1 {
		t.Fatalf("expected repo.Update to be called once, got %d", repo.called["Update"])
	}
	if captured.Status != "รอดำเนินการ" {
		t.Errorf("expected reissued schedule status to reset to รอดำเนินการ, got %q", captured.Status)
	}
	if !captured.Scheduled_DateTime.Equal(newStart) {
		t.Errorf("expected new start time to be applied")
	}
}

func TestUpdate_NotYetOverdue_StillGuardedByOriginalStartTimeCheck(t *testing.T) {
	repo := newMockCheckStockScheduleRepo()
	repo.getByIDFn = func(id uint) (*entity.CheckStockSchedule, error) {
		return &entity.CheckStockSchedule{
			Model:                  modelWithID(id),
			Status:                 "กำลังเช็ค",
			Scheduled_DateTime:     time.Now().Add(-time.Hour),
			Scheduled_End_DateTime: time.Now().Add(time.Hour), // ยังไม่ถึงเวลาสิ้นสุด -> ยังไม่เลยกำหนด
		}, nil
	}
	svc := newCheckStockScheduleServiceForTest(repo, &mockNotificationService{})

	err := svc.Update(1, &wmsDTO.CheckStockScheduleRequestDTO{
		Scheduled_DateTime:     time.Now().Add(time.Hour),
		Scheduled_End_DateTime: time.Now().Add(2 * time.Hour),
		CheckType:              "LOCATION",
	})
	if err == nil {
		t.Fatal("expected error editing a schedule that is currently in progress but not yet overdue")
	}
	if repo.called["Update"] != 0 {
		t.Error("expected repo.Update not to be called when the guard rejects the edit")
	}
}

func TestUpdate_ReassigningUser_SendsNotification(t *testing.T) {
	repo := newMockCheckStockScheduleRepo()
	oldUserID := uint(1)
	repo.getByIDFn = func(id uint) (*entity.CheckStockSchedule, error) {
		return &entity.CheckStockSchedule{
			Model:              modelWithID(id),
			Status:             "รอดำเนินการ",
			Scheduled_DateTime: time.Now().Add(time.Hour),
			UserID:             &oldUserID,
		}, nil
	}
	notif := &mockNotificationService{}
	svc := newCheckStockScheduleServiceForTest(repo, notif)

	newUserID := uint(2)
	err := svc.Update(1, &wmsDTO.CheckStockScheduleRequestDTO{
		Scheduled_DateTime:     time.Now().Add(time.Hour),
		Scheduled_End_DateTime: time.Now().Add(2 * time.Hour),
		CheckType:              "LOCATION",
		UserID:                 &newUserID,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	userNotifs := notif.callsOfKind("user")
	if len(userNotifs) != 1 || userNotifs[0].userID != 2 {
		t.Errorf("expected a notification to the newly-assigned user 2, got %+v", userNotifs)
	}
}

func TestUpdate_SameAssignee_DoesNotNotifyAgain(t *testing.T) {
	repo := newMockCheckStockScheduleRepo()
	sameUserID := uint(1)
	repo.getByIDFn = func(id uint) (*entity.CheckStockSchedule, error) {
		return &entity.CheckStockSchedule{
			Model:              modelWithID(id),
			Status:             "รอดำเนินการ",
			Scheduled_DateTime: time.Now().Add(time.Hour),
			UserID:             &sameUserID,
		}, nil
	}
	notif := &mockNotificationService{}
	svc := newCheckStockScheduleServiceForTest(repo, notif)

	err := svc.Update(1, &wmsDTO.CheckStockScheduleRequestDTO{
		Scheduled_DateTime:     time.Now().Add(time.Hour),
		Scheduled_End_DateTime: time.Now().Add(2 * time.Hour),
		CheckType:              "LOCATION",
		UserID:                 &sameUserID,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(notif.callsOfKind("user")) != 0 {
		t.Errorf("expected no notification when the assignee did not actually change, got %d", len(notif.callsOfKind("user")))
	}
}

// ---------------------------------------------------------------------------
// UpdateStatus
// ---------------------------------------------------------------------------

func TestUpdateStatus_SubmittingAfterDeadline_IsBlocked(t *testing.T) {
	repo := newMockCheckStockScheduleRepo()
	repo.getByIDFn = func(id uint) (*entity.CheckStockSchedule, error) {
		return &entity.CheckStockSchedule{
			Model:                  modelWithID(id),
			Scheduled_End_DateTime: time.Now().Add(-time.Hour), // เลยกำหนดไปแล้ว
		}, nil
	}
	svc := newCheckStockScheduleServiceForTest(repo, &mockNotificationService{})

	err := svc.UpdateStatus(1, "รอตรวจสอบ")
	if err == nil {
		t.Fatal("expected error when submitting results after the deadline")
	}
	if repo.called["UpdateStatus"] != 0 {
		t.Error("expected repo.UpdateStatus not to be called when the deadline guard rejects the submission")
	}
}

func TestUpdateStatus_SubmittingBeforeDeadline_Succeeds(t *testing.T) {
	repo := newMockCheckStockScheduleRepo()
	repo.getByIDFn = func(id uint) (*entity.CheckStockSchedule, error) {
		return &entity.CheckStockSchedule{
			Model:                  modelWithID(id),
			Scheduled_End_DateTime: time.Now().Add(time.Hour),
		}, nil
	}
	svc := newCheckStockScheduleServiceForTest(repo, &mockNotificationService{})

	if err := svc.UpdateStatus(1, "รอตรวจสอบ"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.called["UpdateStatus"] != 1 {
		t.Errorf("expected repo.UpdateStatus called once, got %d", repo.called["UpdateStatus"])
	}
}

func TestUpdateStatus_NoDeadlineSet_AllowsSubmission(t *testing.T) {
	repo := newMockCheckStockScheduleRepo()
	repo.getByIDFn = func(id uint) (*entity.CheckStockSchedule, error) {
		return &entity.CheckStockSchedule{Model: modelWithID(id)}, nil // Scheduled_End_DateTime เป็น zero value
	}
	svc := newCheckStockScheduleServiceForTest(repo, &mockNotificationService{})

	if err := svc.UpdateStatus(1, "รอตรวจสอบ"); err != nil {
		t.Fatalf("expected no deadline enforced when Scheduled_End_DateTime was never set, got error: %v", err)
	}
}

func TestUpdateStatus_SubmittedForReview_NotifiesOwners(t *testing.T) {
	repo := newMockCheckStockScheduleRepo()
	repo.getByIDFn = func(id uint) (*entity.CheckStockSchedule, error) {
		return &entity.CheckStockSchedule{
			Model:                  modelWithID(id),
			Scheduled_End_DateTime: time.Now().Add(time.Hour),
			User:                   &entity.User{FirstName: "Somchai", LastName: "Naruedee"},
		}, nil
	}
	notif := &mockNotificationService{}
	svc := newCheckStockScheduleServiceForTest(repo, notif)

	if err := svc.UpdateStatus(1, "รอตรวจสอบ"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	ownerNotifs := notif.callsOfKind("owners")
	if len(ownerNotifs) != 1 {
		t.Fatalf("expected exactly 1 owner notification, got %d", len(ownerNotifs))
	}
	if !strings.Contains(ownerNotifs[0].message, "Somchai") {
		t.Errorf("expected owner notification to mention the employee's name, got %q", ownerNotifs[0].message)
	}
}

func TestUpdateStatus_OtherStatuses_SkipDeadlineCheckAndOwnerNotification(t *testing.T) {
	repo := newMockCheckStockScheduleRepo()
	// ไม่ตั้ง getByIDFn เลย -> ถ้าโค้ดดันไปเรียก GetByID ทั้งที่ status ไม่ใช่ "รอตรวจสอบ" จะได้ error แล้ว test พังให้เห็นทันที
	notif := &mockNotificationService{}
	svc := newCheckStockScheduleServiceForTest(repo, notif)

	if err := svc.UpdateStatus(1, "กำลังเช็ค"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.called["GetByID"] != 0 {
		t.Error("expected GetByID not to be called for statuses other than รอตรวจสอบ (deadline guard is specific to that transition)")
	}
	if len(notif.callsOfKind("owners")) != 0 {
		t.Error("expected no owner notification for statuses other than รอตรวจสอบ")
	}
}

// ---------------------------------------------------------------------------
// GetByID / List — เฉพาะ fixture ที่ไม่ทำให้ toResponse ไป query s.db (ดูคอมเมนต์หัวไฟล์)
// ---------------------------------------------------------------------------

func TestGetByID_RecalculatesStatusToInProgressWhenPastDue(t *testing.T) {
	repo := newMockCheckStockScheduleRepo()
	repo.getByIDFn = func(id uint) (*entity.CheckStockSchedule, error) {
		return &entity.CheckStockSchedule{
			Model:              modelWithID(id),
			Status:             "รอดำเนินการ",
			Scheduled_DateTime: time.Now().Add(-time.Hour), // เวลาที่นัดเช็คผ่านไปแล้ว แต่สถานะในฐานข้อมูลยังไม่ถูกอัปเดต
			CheckType:          "",                         // เว้นว่างกัน toResponse เดินเข้า branch ที่ query s.db
		}, nil
	}
	svc := newCheckStockScheduleServiceForTest(repo, &mockNotificationService{})

	dto, err := svc.GetByID(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dto.Status != "กำลังเช็ค" {
		t.Errorf("expected status to be dynamically shown as กำลังเช็ค once start time has passed, got %q", dto.Status)
	}
}

func TestGetByID_StatusUnchangedWhenNotYetDue(t *testing.T) {
	repo := newMockCheckStockScheduleRepo()
	repo.getByIDFn = func(id uint) (*entity.CheckStockSchedule, error) {
		return &entity.CheckStockSchedule{
			Model:              modelWithID(id),
			Status:             "รอดำเนินการ",
			Scheduled_DateTime: time.Now().Add(time.Hour),
			CheckType:          "",
		}, nil
	}
	svc := newCheckStockScheduleServiceForTest(repo, &mockNotificationService{})

	dto, err := svc.GetByID(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dto.Status != "รอดำเนินการ" {
		t.Errorf("expected status to stay รอดำเนินการ before the start time, got %q", dto.Status)
	}
}

func TestGetByID_NotFound_ReturnsRepoError(t *testing.T) {
	repo := newMockCheckStockScheduleRepo()
	wantErr := errors.New("not found")
	repo.getByIDFn = func(uint) (*entity.CheckStockSchedule, error) { return nil, wantErr }
	svc := newCheckStockScheduleServiceForTest(repo, &mockNotificationService{})

	_, err := svc.GetByID(999)
	if !errors.Is(err, wantErr) {
		t.Fatalf("expected error %v, got %v", wantErr, err)
	}
}

func TestList_PassesStatusFilterThroughAndMapsAll(t *testing.T) {
	repo := newMockCheckStockScheduleRepo()
	var gotStatus string
	repo.listFn = func(status string) ([]entity.CheckStockSchedule, error) {
		gotStatus = status
		return []entity.CheckStockSchedule{
			{Model: modelWithID(1), CheckType: ""},
			{Model: modelWithID(2), CheckType: ""},
		}, nil
	}
	svc := newCheckStockScheduleServiceForTest(repo, &mockNotificationService{})

	result, err := svc.List("รอดำเนินการ")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 2 {
		t.Fatalf("expected 2 mapped items, got %d", len(result))
	}
	if gotStatus != "รอดำเนินการ" {
		t.Errorf("expected status filter to be passed through unchanged, got %q", gotStatus)
	}
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

func TestScheduleDelete_PassesIDAndError(t *testing.T) {
	repo := newMockCheckStockScheduleRepo()
	var gotID uint
	repo.deleteFn = func(id uint) error {
		gotID = id
		return nil
	}
	svc := newCheckStockScheduleServiceForTest(repo, &mockNotificationService{})

	if err := svc.Delete(5); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if gotID != 5 {
		t.Errorf("expected Delete called with id 5, got %d", gotID)
	}
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

func modelWithID(id uint) gorm.Model {
	return gorm.Model{ID: id}
}
