package cron

import (
	"context"
	"log"
	"time"

	"github.com/robfig/cron/v3"
	dashRepo "backend/internal/app/repository/dashboard"
)

var dashboardCronInstance *cron.Cron

// StartDashboardSummaryCron รันทุกวันตอนตี 00:05 เพื่อ finalize ยอดของ "เมื่อวาน"
// ตั้งเวลา 00:05 ไม่ใช่ 00:00 เผื่อ transaction ท้ายวันที่ commit ช้านิดหน่อยให้เข้าฐานข้อมูลก่อน
func StartDashboardSummaryCron(repo dashRepo.DashboardRepository) {
	dashboardCronInstance = cron.New(cron.WithLocation(time.Local))

	_, err := dashboardCronInstance.AddFunc("5 0 * * *", func() {
		yesterday := time.Now().AddDate(0, 0, -1)
		ctx := context.Background()
		if err := repo.FinalizeDailySummary(ctx, yesterday); err != nil {
			log.Printf("[dashboard-cron] finalize %s failed: %v", yesterday.Format("2006-01-02"), err)
			return
		}
		log.Printf("[dashboard-cron] finalized daily summary for %s", yesterday.Format("2006-01-02"))
	})
	if err != nil {
		log.Fatalf("[dashboard-cron] failed to schedule dashboard summary job: %v", err)
	}

	dashboardCronInstance.Start()
	log.Println("[dashboard-cron] started — will finalize daily summary at 00:05 every day")
}