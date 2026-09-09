package cron

import (
	"fmt"
	"log"

	svcNotification "backend/internal/app/service/notification"
	wmsSvc "backend/internal/app/service/wms"

	"github.com/robfig/cron/v3"
)

var lowStockCronInstance *cron.Cron

// StartLowStockCron รันทุก 5 นาที เพื่อตรวจหาสินค้าที่คงเหลือ <= จุดสั่งซื้อที่ตั้งไว้ แล้วสร้าง StockAlert
// (ให้หน้าแดชบอร์ด "เตือนสินค้าใกล้หมดสต็อก" อ่านได้) พร้อมยิงแจ้งเตือนที่กระดิ่งให้เจ้าของร้านทันที — เฉพาะสินค้าที่
// เพิ่งถึงเกณฑ์ หรือเปลี่ยนจากใกล้หมดเป็นหมดสต็อก (เติมพ้นเกณฑ์จะปิด alert เดิม)
func StartLowStockCron(service wmsSvc.StockAlertService, notificationService svcNotification.NotificationService) {
	lowStockCronInstance = cron.New(cron.WithLocation(bangkokLocation))

	_, err := lowStockCronInstance.AddFunc("*/5 * * * *", func() {
		if err := CheckLowStockAndNotify(service, notificationService); err != nil {
			log.Printf("[low-stock-cron] check failed: %v", err)
		}
	})
	if err != nil {
		log.Fatalf("[low-stock-cron] failed to schedule low-stock check job: %v", err)
	}
	lowStockCronInstance.Start()
	log.Println("[low-stock-cron] started — checking every 5 minutes using Asia/Bangkok timezone")
}

// CheckLowStockAndNotify is also called after HTTP mutations have committed.
func CheckLowStockAndNotify(service wmsSvc.StockAlertService, notificationService svcNotification.NotificationService) error {
	created, err := service.CheckAndCreateAlerts()
	if err != nil {
		return err
	}
	for _, alert := range created {
		title := "สินค้าใกล้หมดสต็อก"
		if alert.Alert_type == "OUT_OF_STOCK" {
			title = "สินค้าหมดสต็อก"
		}
		message := fmt.Sprintf("%s คงเหลือ %d ชิ้น ถึงหรือต่ำกว่าจุดสั่งซื้อ (%d ชิ้น) กดเพื่อสร้างใบสั่งซื้อ", alert.ProductName, alert.Quantity_At_Alert, alert.Limit_Quantity)
		link := "/owner/dashboard?stock-alerts=1"
		var productID uint
		if alert.ProductID != nil {
			productID = *alert.ProductID
		}
		if notificationService != nil {
			if err := notificationService.NotifyOwners("LOW_STOCK", title, message, link, nil); err != nil {
				log.Printf("[low-stock-cron] failed to notify owners for product %d: %v", productID, err)
			}
		}
	}
	return nil
}
