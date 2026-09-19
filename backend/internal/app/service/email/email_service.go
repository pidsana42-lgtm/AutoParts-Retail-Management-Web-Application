package email

import (
	"crypto/tls"
	"encoding/base64"
	"fmt"
	"net/smtp"
	"os"
	"strings"
	"time"
)

type EmailService interface {
	SendEmail(to []string, subject, htmlBody string) error
	SendPasswordResetOTP(toEmail, username, otp string) error
	SendLowStockAlert(productName, productCode string, currentQty, limitQty int) error
	SendNewOrderAlert(orderType, orderCode string, totalPrice float64, customerName string, items []string) error
}

type emailService struct {
	host     string
	port     string
	user     string
	password string
	fromName string
}

func NewEmailService() EmailService {
	host := os.Getenv("SMTP_HOST")
	if host == "" {
		host = "smtp.gmail.com"
	}
	port := os.Getenv("SMTP_PORT")
	if port == "" {
		port = "587"
	}
	user := os.Getenv("SMTP_USER")
	password := os.Getenv("SMTP_PASSWORD")
	fromName := os.Getenv("SMTP_FROM_NAME")
	if fromName == "" {
		fromName = "JJ AutoParts"
	}

	return &emailService{
		host:     host,
		port:     port,
		user:     user,
		password: password,
		fromName: fromName,
	}
}

func (s *emailService) SendEmail(to []string, subject, htmlBody string) error {
	if s.user == "" || s.password == "" {
		return fmt.Errorf("SMTP credentials not configured")
	}

	b64Subject := base64.StdEncoding.EncodeToString([]byte(subject))
	encodedSubject := fmt.Sprintf("=?UTF-8?B?%s?=", b64Subject)

	b64FromName := base64.StdEncoding.EncodeToString([]byte(s.fromName))
	encodedFrom := fmt.Sprintf("=?UTF-8?B?%s?= <%s>", b64FromName, s.user)

	now := time.Now()
	msgID := fmt.Sprintf("<%d.%d@jjautopart-pakchong.com>", now.UnixNano(), os.Getpid())
	dateStr := now.Format(time.RFC1123Z)

	b64Body := base64.StdEncoding.EncodeToString([]byte(htmlBody))
	var wrappedBody strings.Builder
	for i := 0; i < len(b64Body); i += 76 {
		end := i + 76
		if end > len(b64Body) {
			end = len(b64Body)
		}
		wrappedBody.WriteString(b64Body[i:end] + "\r\n")
	}

	message := fmt.Sprintf("From: %s\r\n", encodedFrom) +
		fmt.Sprintf("To: %s\r\n", strings.Join(to, ", ")) +
		fmt.Sprintf("Date: %s\r\n", dateStr) +
		fmt.Sprintf("Message-ID: %s\r\n", msgID) +
		fmt.Sprintf("Subject: %s\r\n", encodedSubject) +
		"MIME-Version: 1.0\r\n" +
		"Content-Type: text/html; charset=UTF-8\r\n" +
		"Content-Transfer-Encoding: base64\r\n\r\n" +
		wrappedBody.String()

	addr := fmt.Sprintf("%s:%s", s.host, s.port)
	auth := smtp.PlainAuth("", s.user, s.password, s.host)

	// TLS Config for STARTTLS
	tlsConfig := &tls.Config{
		ServerName: s.host,
	}

	c, err := smtp.Dial(addr)
	if err != nil {
		return fmt.Errorf("failed to dial SMTP server: %w", err)
	}
	defer c.Close()

	if ok, _ := c.Extension("STARTTLS"); ok {
		if err = c.StartTLS(tlsConfig); err != nil {
			return fmt.Errorf("failed to start TLS: %w", err)
		}
	}

	if err = c.Auth(auth); err != nil {
		return fmt.Errorf("failed to authenticate SMTP: %w", err)
	}

	if err = c.Mail(s.user); err != nil {
		return fmt.Errorf("failed to set sender: %w", err)
	}

	for _, recipient := range to {
		if err = c.Rcpt(recipient); err != nil {
			return fmt.Errorf("failed to set recipient %s: %w", recipient, err)
		}
	}

	w, err := c.Data()
	if err != nil {
		return fmt.Errorf("failed to open data writer: %w", err)
	}

	_, err = w.Write([]byte(message))
	if err != nil {
		return fmt.Errorf("failed to write email content: %w", err)
	}

	return w.Close()
}

func (s *emailService) SendPasswordResetOTP(toEmail, username, otp string) error {
	subject := "รหัสยืนยันสำหรับตั้งรหัสผ่านใหม่ - JJ AutoParts"
	currentYear := time.Now().Year()

	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html lang="th">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>รหัสยืนยัน OTP - JJ AutoParts</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Prompt', 'Kanit', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #27272a;">
	<table width="100%%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5; padding: 32px 16px;">
		<tr>
			<td align="center">
				<table width="100%%" border="0" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #ffffff; border: 1px solid #e4e4e7;">

					<!-- Header -->
					<tr>
						<td style="padding: 24px 32px; border-bottom: 3px solid #b70011;">
							<span style="font-size: 15px; font-weight: 700; color: #18181b; letter-spacing: 0.5px;">JJ AUTOPARTS</span>
							<span style="font-size: 13px; color: #71717a; margin-left: 6px;">ปากช่อง</span>
						</td>
					</tr>

					<!-- Content -->
					<tr>
						<td style="padding: 32px;">
							<p style="font-size: 14px; line-height: 1.7; margin: 0 0 4px; color: #27272a;">
								สวัสดีคุณ %s
							</p>
							<p style="font-size: 14px; line-height: 1.7; margin: 0 0 24px; color: #52525b;">
								มีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ กรอกรหัสด้านล่างนี้ในหน้าเว็บเพื่อดำเนินการต่อ
							</p>

							<!-- OTP -->
							<div style="background-color: #fafafa; border: 1px solid #e4e4e7; border-radius: 6px; padding: 20px; text-align: center; margin-bottom: 20px;">
								<div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #18181b; font-family: 'Courier New', Courier, monospace;">
									%s
								</div>
							</div>

							<p style="font-size: 13px; color: #71717a; margin: 0 0 24px;">
								รหัสนี้ใช้ได้ครั้งเดียวและหมดอายุภายใน 15 นาที
							</p>

							<p style="font-size: 13px; line-height: 1.6; color: #71717a; margin: 0; padding-top: 16px; border-top: 1px solid #e4e4e7;">
								หากคุณไม่ได้ขอตั้งรหัสผ่านใหม่ ไม่ต้องดำเนินการใดๆ กับอีเมลฉบับนี้ บัญชีของคุณยังปลอดภัยอยู่
							</p>
						</td>
					</tr>

					<!-- Footer -->
					<tr>
						<td style="padding: 16px 32px; background-color: #fafafa; border-top: 1px solid #e4e4e7;">
							<p style="font-size: 11px; color: #a1a1aa; margin: 0;">
								JJ AutoParts Pak Chong &middot; &copy; %d
							</p>
						</td>
					</tr>

				</table>
			</td>
		</tr>
	</table>
</body>
</html>`, username, otp, currentYear)

	return s.SendEmail([]string{toEmail}, subject, htmlBody)
}

func (s *emailService) SendLowStockAlert(productName, productCode string, currentQty, limitQty int) error {
	toEmail := s.user
	if toEmail == "" {
		return nil
	}

	subject := fmt.Sprintf("⚠️ แจ้งเตือนสต็อกสินค้าใกล้หมด: %s (%s)", productName, productCode)
	currentYear := time.Now().Year()
	currentTime := time.Now().Format("02/01/2006 15:04 น.")

	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html lang="th">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>แจ้งเตือนสต็อกสินค้า</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Prompt', 'Kanit', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
	<table width="100%%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 35px 15px;">
		<tr>
			<td align="center">
				<table width="100%%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0;">
					
					<!-- Header -->
					<tr>
						<td style="background: linear-gradient(135deg, #991b1b 0%%, #b70011 100%%); padding: 32px 30px; text-align: center; border-bottom: 4px solid #7f1d1d;">
							<div style="font-size: 32px; margin-bottom: 8px;">⚠️</div>
							<h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.5px;">
								แจ้งเตือนสต็อกสินค้าใกล้หมด
							</h1>
							<p style="color: #fecaca; margin: 6px 0 0; font-size: 13px;">
								ระบบตรวจพบสินค้ามีจำนวนคงเหลือต่ำกว่าเกณฑ์ขั้นต่ำ
							</p>
						</td>
					</tr>

					<!-- Content -->
					<tr>
						<td style="padding: 36px 32px;">
							<!-- Product Card -->
							<table width="100%%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; margin-bottom: 24px;">
								<tr>
									<td style="padding: 20px 22px; border-bottom: 1px solid #e2e8f0; background-color: #ffffff;">
										<div style="color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">
											รายการสินค้า
										</div>
										<div style="color: #0f172a; font-size: 17px; font-weight: 800; line-height: 1.4;">
											%s
										</div>
										<div style="color: #b70011; font-size: 13px; font-weight: 700; margin-top: 4px;">
											รหัสสินค้า: %s
										</div>
									</td>
								</tr>
								<tr>
									<td style="padding: 18px 22px;">
										<table width="100%%" border="0" cellspacing="0" cellpadding="0">
											<tr>
												<td width="50%%">
													<div style="color: #64748b; font-size: 12px; margin-bottom: 4px;">จำนวนคงเหลือ:</div>
													<div style="color: #dc2626; font-size: 26px; font-weight: 900;">
														%d <span style="font-size: 14px; font-weight: 600; color: #64748b;">ชิ้น</span>
													</div>
												</td>
												<td width="50%%">
													<div style="color: #64748b; font-size: 12px; margin-bottom: 4px;">เกณฑ์แจ้งเตือนขั้นต่ำ:</div>
													<div style="color: #0f172a; font-size: 26px; font-weight: 900;">
														%d <span style="font-size: 14px; font-weight: 600; color: #64748b;">ชิ้น</span>
													</div>
												</td>
											</tr>
										</table>
									</td>
								</tr>
							</table>

							<!-- Suggestion -->
							<div style="background-color: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; border-radius: 10px; padding: 16px 18px; margin-bottom: 26px;">
								<div style="color: #92400e; font-size: 13px; line-height: 1.6;">
									<strong>💡 ข้อแนะนำ:</strong> กรุณาเข้าสู่ระบบเพื่อดำเนินการเปิดใบสั่งซื้อ (PO) กับตัวแทนจำหน่าย หรือวางแผนสต็อกสินค้าเข้าคลังเพื่อไม่ให้กระทบต่อยอดขาย
								</div>
							</div>

							<!-- Button -->
							<table width="100%%" border="0" cellspacing="0" cellpadding="0">
								<tr>
									<td align="center">
										<a href="https://jjautopart-pakchong.com" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #18181b 0%%, #27272a 100%%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 13px 28px; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
											เข้าสู่ระบบจัดการสต็อกสินค้า →
										</a>
									</td>
								</tr>
							</table>

							<p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 24px 0 0;">
								เวลาที่ตรวจพบ: %s
							</p>
						</td>
					</tr>

					<!-- Footer -->
					<tr>
						<td style="background-color: #0f172a; padding: 20px 30px; text-align: center;">
							<p style="color: #64748b; font-size: 11px; margin: 0;">
								&copy; %d JJ AutoParts Pak Chong • ระบบแจ้งเตือนสต็อกสินค้าอัตโนมัติ
							</p>
						</td>
					</tr>

				</table>
			</td>
		</tr>
	</table>
</body>
</html>`, productName, productCode, currentQty, limitQty, currentTime, currentYear)

	return s.SendEmail([]string{toEmail}, subject, htmlBody)
}

func (s *emailService) SendNewOrderAlert(orderType, orderCode string, totalPrice float64, customerName string, items []string) error {
	toEmail := s.user
	if toEmail == "" {
		return nil
	}

	subject := fmt.Sprintf("📦 มีรายการ%sใหม่: %s (฿%.2f)", orderType, orderCode, totalPrice)
	currentYear := time.Now().Year()
	currentTime := time.Now().Format("02/01/2006 15:04 น.")

	itemsRows := ""
	for i, itm := range items {
		bgColor := "#ffffff"
		if i%2 == 1 {
			bgColor = "#f8fafc"
		}
		itemsRows += fmt.Sprintf(`
		<tr style="background-color: %s;">
			<td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #334155; font-size: 13px;">• %s</td>
		</tr>`, bgColor, itm)
	}

	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html lang="th">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>รายการสั่งซื้อใหม่ - JJ AutoParts</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Prompt', 'Kanit', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
	<table width="100%%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 35px 15px;">
		<tr>
			<td align="center">
				<table width="100%%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0;">
					
					<!-- Header -->
					<tr>
						<td style="background: linear-gradient(135deg, #18181b 0%%, #09090b 100%%); padding: 32px 30px; text-align: center; border-bottom: 4px solid #16a34a;">
							<div style="display: inline-block; background-color: #15803d; color: #ffffff; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-bottom: 10px;">
								✨ NEW ORDER ALERT
							</div>
							<h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800;">
								มีรายการ%sใหม่
							</h1>
							<p style="color: #86efac; margin: 6px 0 0; font-size: 15px; font-weight: 700; font-family: 'Courier New', monospace;">
								%s
							</p>
						</td>
					</tr>

					<!-- Content -->
					<tr>
						<td style="padding: 36px 32px;">
							<!-- Order Info Table -->
							<table width="100%%" border="0" cellspacing="0" cellpadding="10" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 14px; margin-bottom: 24px;">
								<tr style="border-bottom: 1px solid #e2e8f0;">
									<td style="color: #64748b; font-weight: 600; width: 35%%;">ประเภทรายการ:</td>
									<td style="color: #0f172a; font-weight: 700;">%s</td>
								</tr>
								<tr style="border-bottom: 1px solid #e2e8f0;">
									<td style="color: #64748b; font-weight: 600;">ลูกค้า:</td>
									<td style="color: #0f172a; font-weight: 700;">%s</td>
								</tr>
								<tr>
									<td style="color: #64748b; font-weight: 600;">ยอดรวมทั้งสิ้น:</td>
									<td style="color: #16a34a; font-size: 22px; font-weight: 900;">฿%.2f</td>
								</tr>
							</table>

							<!-- Items List -->
							%s

							<!-- Button -->
							<table width="100%%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 28px;">
								<tr>
									<td align="center">
										<a href="https://jjautopart-pakchong.com" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%%, #15803d 100%%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 13px 30px; border-radius: 10px; box-shadow: 0 4px 14px rgba(22, 163, 74, 0.3);">
											ดูรายละเอียดรายการสั่งซื้อ →
										</a>
									</td>
								</tr>
							</table>

							<p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 24px 0 0;">
								เวลาที่บันทึกรายการ: %s
							</p>
						</td>
					</tr>

					<!-- Footer -->
					<tr>
						<td style="background-color: #0f172a; padding: 20px 30px; text-align: center;">
							<p style="color: #64748b; font-size: 11px; margin: 0;">
								&copy; %d JJ AutoParts Pak Chong • ระบบแจ้งเตือนอัตโนมัติ
							</p>
						</td>
					</tr>

				</table>
			</td>
		</tr>
	</table>
</body>
</html>`, orderType, orderCode, orderType, customerName, totalPrice,
		func() string {
			if itemsRows != "" {
				return `<div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-top: 10px;">
					<div style="background-color: #f1f5f9; padding: 10px 14px; color: #475569; font-size: 12px; font-weight: 700; text-transform: uppercase;">
						รายการสินค้าในออเดอร์
					</div>
					<table width="100%" border="0" cellspacing="0" cellpadding="0">` + itemsRows + `</table>
				</div>`
			}
			return ""
		}(), currentTime, currentYear)

	return s.SendEmail([]string{toEmail}, subject, htmlBody)
}
