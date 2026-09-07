package pdf

import (
	"testing"
	"time"
)

func TestThaiBahtText(t *testing.T) {
	tests := []struct {
		amount float64
		want   string
	}{
		{0.00, "ศูนย์บาทถ้วน"},
		{1.00, "หนึ่งบาทถ้วน"},
		{11.00, "สิบเอ็ดบาทถ้วน"},
		{21.00, "ยี่สิบเอ็ดบาทถ้วน"},
		{101.00, "หนึ่งร้อยเอ็ดบาทถ้วน"},
		{1001.00, "หนึ่งพันเอ็ดบาทถ้วน"},
		{1653.00, "หนึ่งพันหกร้อยห้าสิบสามบาทถ้วน"},
		{1653.50, "หนึ่งพันหกร้อยห้าสิบสามบาทห้าสิบสตางค์"},
		{25.25, "ยี่สิบห้าบาทยี่สิบห้าสตางค์"},
		{1000000.00, "หนึ่งล้านบาทถ้วน"},
		{1000001.00, "หนึ่งล้านหนึ่งบาทถ้วน"},
		{1234567.89, "หนึ่งล้านสองแสนสามหมื่นสี่พันห้าร้อยหกสิบเจ็ดบาทแปดสิบเก้าสตางค์"},
	}

	for _, tt := range tests {
		got := ThaiBahtText(tt.amount)
		if got != tt.want {
			t.Errorf("ThaiBahtText(%v) = %q, want %q", tt.amount, got, tt.want)
		}
	}
}

func TestFormatThaiDate(t *testing.T) {
	d := time.Date(2025, 10, 12, 0, 0, 0, 0, time.UTC)
	got := FormatThaiDate(d)
	want := "12 ต.ค. 2568"
	if got != want {
		t.Errorf("FormatThaiDate() = %q, want %q", got, want)
	}
}

func TestHexToColor(t *testing.T) {
	c := HexToColor("#E51C23")
	if c.Red != 229 || c.Green != 28 || c.Blue != 35 {
		t.Errorf("HexToColor(#E51C23) = {%d, %d, %d}, want {229, 28, 35}", c.Red, c.Green, c.Blue)
	}
}
