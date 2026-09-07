package cron

import (
	"time"
	_ "time/tzdata"
)

var bangkokLocation = func() *time.Location {
	location, err := time.LoadLocation("Asia/Bangkok")
	if err != nil {
		panic("load Asia/Bangkok timezone: " + err.Error())
	}
	return location
}()
