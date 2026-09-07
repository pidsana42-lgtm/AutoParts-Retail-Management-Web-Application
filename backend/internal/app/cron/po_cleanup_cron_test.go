package cron

import (
	"context"
	"errors"
	"testing"
	"time"

	robfigcron "github.com/robfig/cron/v3"
)

type fakePOCleanupService struct {
	cutoff time.Time
	count  int64
	err    error
}

func (f *fakePOCleanupService) PurgeDeletedPOs(_ context.Context, cutoff time.Time) (int64, error) {
	f.cutoff = cutoff
	return f.count, f.err
}

func TestBangkokLocation(t *testing.T) {
	if bangkokLocation.String() != "Asia/Bangkok" {
		t.Fatalf("location = %q, want Asia/Bangkok", bangkokLocation.String())
	}

	_, offset := time.Date(2026, time.January, 1, 0, 0, 0, 0, bangkokLocation).Zone()
	if offset != 7*60*60 {
		t.Fatalf("UTC offset = %d, want %d", offset, 7*60*60)
	}
}

func TestPOCleanupScheduleRunsAt0315Bangkok(t *testing.T) {
	parser := robfigcron.NewParser(robfigcron.Minute | robfigcron.Hour | robfigcron.Dom | robfigcron.Month | robfigcron.Dow)
	schedule, err := parser.Parse(poCleanupSchedule)
	if err != nil {
		t.Fatalf("parse cleanup schedule: %v", err)
	}

	from := time.Date(2026, time.September, 6, 3, 14, 0, 0, bangkokLocation)
	want := time.Date(2026, time.September, 6, 3, 15, 0, 0, bangkokLocation)
	if got := schedule.Next(from); !got.Equal(want) {
		t.Fatalf("next run = %s, want %s", got, want)
	}
}

func TestPurgeExpiredDeletedPOsUsesThirtyDayBangkokCutoff(t *testing.T) {
	service := &fakePOCleanupService{count: 2}
	now := time.Date(2026, time.September, 6, 3, 15, 0, 0, time.UTC)

	count, err := purgeExpiredDeletedPOs(service, now)
	if err != nil {
		t.Fatalf("purge cleanup: %v", err)
	}
	if count != 2 {
		t.Fatalf("purged count = %d, want 2", count)
	}

	want := now.In(bangkokLocation).AddDate(0, 0, -poTrashRetentionDays)
	if !service.cutoff.Equal(want) || service.cutoff.Location() != bangkokLocation {
		t.Fatalf("cutoff = %s (%s), want %s (%s)", service.cutoff, service.cutoff.Location(), want, bangkokLocation)
	}
}

func TestPurgeExpiredDeletedPOsReturnsServiceError(t *testing.T) {
	wantErr := errors.New("database unavailable")
	service := &fakePOCleanupService{err: wantErr}

	_, err := purgeExpiredDeletedPOs(service, time.Now())
	if !errors.Is(err, wantErr) {
		t.Fatalf("error = %v, want %v", err, wantErr)
	}
}
