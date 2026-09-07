package cron

import (
	"context"
	"log"
	"time"

	"github.com/robfig/cron/v3"
)

const poTrashRetentionDays = 30
const poCleanupSchedule = "15 3 * * *"

var poCleanupCronInstance *cron.Cron

type poCleanupService interface {
	PurgeDeletedPOs(ctx context.Context, cutoff time.Time) (int64, error)
}

func purgeExpiredDeletedPOs(service poCleanupService, now time.Time) (int64, error) {
	cutoff := now.In(bangkokLocation).AddDate(0, 0, -poTrashRetentionDays)
	return service.PurgeDeletedPOs(context.Background(), cutoff)
}

// StartPOCleanupCron ลบถาวรเฉพาะ PO สถานะ DELETED ที่อยู่ในถังขยะเกิน 30 วัน
// ทำงานทุกวันเวลา 03:15 Asia/Bangkok และไม่แตะ PO สถานะ CANCELLED
func StartPOCleanupCron(service poCleanupService) {
	poCleanupCronInstance = cron.New(cron.WithLocation(bangkokLocation))
	_, err := poCleanupCronInstance.AddFunc(poCleanupSchedule, func() {
		count, err := purgeExpiredDeletedPOs(service, time.Now())
		if err != nil {
			log.Printf("[po-cleanup-cron] failed to purge expired deleted purchase orders: %v", err)
			return
		}
		if count > 0 {
			log.Printf("[po-cleanup-cron] permanently deleted %d purchase order(s) older than %d days", count, poTrashRetentionDays)
		}
	})
	if err != nil {
		log.Fatalf("[po-cleanup-cron] failed to schedule cleanup job: %v", err)
	}
	poCleanupCronInstance.Start()
	log.Printf("[po-cleanup-cron] started — purging DELETED purchase orders older than %d days every day at 03:15 Asia/Bangkok", poTrashRetentionDays)
}
