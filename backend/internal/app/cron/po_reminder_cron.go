package cron

import (
	"context"
	"log"

	poSvc "backend/internal/app/service/purchase_orders"

	"github.com/robfig/cron/v3"
)

var poReminderCronInstance *cron.Cron

// StartPOReminderCron รันทุกวัน 08:00 (เวลาไทย) เช็คว่ามี PO สถานะ DRAFT/RESUBMITTED
// ตัวไหนไม่มีความเคลื่อนไหวมาแล้วอย่างน้อย 7 วัน แล้วแจ้งเตือนผู้ใช้งานทุกคน
func StartPOReminderCron(service poSvc.PurchaseOrderService) {
	poReminderCronInstance = cron.New(cron.WithLocation(bangkokLocation))
	_, err := poReminderCronInstance.AddFunc("0 8 * * *", func() {
		if err := service.SendStaleDraftReminders(context.Background()); err != nil {
			log.Printf("[po-reminder-cron] failed to send stale draft reminders: %v", err)
		}
	})
	if err != nil {
		log.Fatalf("[po-reminder-cron] failed to schedule reminder job: %v", err)
	}
	poReminderCronInstance.Start()
	log.Println("[po-reminder-cron] started — checking daily at 08:00 Asia/Bangkok for stale DRAFT/RESUBMITTED purchase orders")
}
