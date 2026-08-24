package cron

import (
	"log"
	"time"

	wmsSvc "backend/internal/app/service/wms"

	"github.com/robfig/cron/v3"
)

var checkStockCronInstance *cron.Cron

// StartCheckStockDueCron รันทุก 1 นาที เพื่อดูว่ามีตารางเช็คสต็อกไหนถึงเวลาเริ่มแล้วบ้าง
// (เปลี่ยนสถานะ "รอดำเนินการ" -> "กำลังเช็ค" จริงใน DB พร้อมแจ้งเตือนพนักงานที่ได้รับมอบหมาย)
func StartCheckStockDueCron(service wmsSvc.CheckStockScheduleService) {
	checkStockCronInstance = cron.New(cron.WithLocation(time.Local))

	_, err := checkStockCronInstance.AddFunc("* * * * *", func() {
		if err := service.ActivateDueSchedules(); err != nil {
			log.Printf("[check-stock-cron] failed to activate due schedules: %v", err)
		}
	})
	if err != nil {
		log.Fatalf("[check-stock-cron] failed to schedule due-check job: %v", err)
	}

	checkStockCronInstance.Start()
	log.Println("[check-stock-cron] started — checking every minute for check-stock schedules that have reached their start time")
}
