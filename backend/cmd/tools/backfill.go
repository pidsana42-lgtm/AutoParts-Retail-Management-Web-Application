package main

import (
	"context"
	"flag"
	"log"
	"time"

	"backend/config"
	"backend/internal/app/repository/dashboard"
)

func main() {
	from := flag.String("from", "", "YYYY-MM-DD")
	to := flag.String("to", "", "YYYY-MM-DD")
	flag.Parse()

	if *from == "" || *to == "" {
		log.Fatal("ต้องระบุ -from และ -to")
	}

	config.ConnectDB()
	repo := dashboard.NewDashboardRepository(config.DB())

	fromDate, err := time.Parse("2006-01-02", *from)
	if err != nil {
		log.Fatalf("รูปแบบ -from ไม่ถูกต้อง: %v", err)
	}
	toDate, err := time.Parse("2006-01-02", *to)
	if err != nil {
		log.Fatalf("รูปแบบ -to ไม่ถูกต้อง: %v", err)
	}
	ctx := context.Background()

	for d := fromDate; !d.After(toDate); d = d.AddDate(0, 0, 1) {
		if err := repo.FinalizeDailySummary(ctx, d); err != nil {
			log.Printf("backfill %s failed: %v", d.Format("2006-01-02"), err)
			continue
		}
		log.Printf("backfilled %s", d.Format("2006-01-02"))
	}
}