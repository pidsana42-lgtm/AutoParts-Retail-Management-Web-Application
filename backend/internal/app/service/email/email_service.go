package email

import (
	"crypto/tls"
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

	headers := make(map[string]string)
	headers["From"] = fmt.Sprintf("%s <%s>", s.fromName, s.user)
	headers["To"] = strings.Join(to, ",")
	headers["Subject"] = "=?UTF-8?B?" + strings.TrimSpace(subject) + "?="
	// Simple base64 subject or direct UTF-8
	message := fmt.Sprintf("From: %s <%s>\r\n", s.fromName, s.user) +
		fmt.Sprintf("To: %s\r\n", strings.Join(to, ",")) +
		fmt.Sprintf("Subject: %s\r\n", subject) +
		"MIME-Version: 1.0\r\n" +
		"Content-Type: text/html; charset=UTF-8\r\n\r\n" +
		htmlBody

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
	subject := "รหัสยืนยันการตั้งรหัสผ่านใหม่ (OTP) - JJ AutoParts"
	htmlBody := fmt.Sprintf(`
	<!DOCTYPE html>
	<html>
	<head><meta charset="utf-8"></head>
	<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f4f5f7;">
		<table width="100%%" border="0" cellspacing="0" cellpadding="0" style="padding: 40px 0;">
			<tr>
				<td align="center">
					<table width="500" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
						<!-- Header -->
						<tr>
							<td style="background-color: #1c1b1b; padding: 25px 30px; text-align: center;">
								<h1 style="color: #ffffff; margin: 0; font-size: 22px; letter-spacing: 1px;">JJ AUTO PARTS</h1>
								<p style="color: #e51c23; margin: 5px 0 0; font-size: 12px; font-weight: bold;">ระบบบริหารจัดการร้านขายปลีกอะไหล่ยนต์</p>
							</td>
						</tr>
						<!-- Body -->
						<tr>
							<td style="padding: 35px 30px;">
								<h2 style="color: #222222; margin: 0 0 15px; font-size: 18px;">รีเซ็ตรหัสผ่านสำหรับบัญชี %s</h2>
								<p style="color: #555555; line-height: 1.6; margin: 0 0 25px; font-size: 14px;">
									เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีผู้ใช้งานของคุณ กรุณานำรหัสยืนยัน (OTP) ด้านล่างนี้ไปกรอกในหน้าเว็บเพื่อตั้งรหัสผ่านใหม่:
								</p>
								<div style="background-color: #fff2f2; border: 1px dashed #e51c23; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 25px;">
									<span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #e51c23;">%s</span>
									<p style="color: #888888; font-size: 12px; margin: 8px 0 0;">(รหัสมีอายุการใช้งาน 15 นาที)</p>
								</div>
								<p style="color: #888888; font-size: 13px; line-height: 1.5; margin: 0;">
									* หากคุณไม่ได้เป็นผู้ส่งคำขอนี้ สามารถเพิกเฉยต่ออีเมลฉบับนี้ได้ บัญชีของคุณจะยังคงปลอดภัย
								</p>
							</td>
						</tr>
						<!-- Footer -->
						<tr>
							<td style="background-color: #f9fafb; padding: 18px 30px; text-align: center; border-top: 1px solid #eeeeee;">
								<p style="color: #999999; font-size: 12px; margin: 0;">&copy; %d JJ AutoParts Pakchong. All rights reserved.</p>
							</td>
						</tr>
					</table>
				</td>
			</tr>
		</table>
	</body>
	</html>
	`, username, otp, time.Now().Year())

	return s.SendEmail([]string{toEmail}, subject, htmlBody)
}

func (s *emailService) SendLowStockAlert(productName, productCode string, currentQty, limitQty int) error {
	toEmail := s.user // ส่งหาเจ้าของร้านเอง
	if toEmail == "" {
		return nil
	}

	subject := fmt.Sprintf("⚠️ แจ้งเตือนสต็อกสินค้าใกล้หมด: %s (%s)", productName, productCode)
	htmlBody := fmt.Sprintf(`
	<!DOCTYPE html>
	<html>
	<head><meta charset="utf-8"></head>
	<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f4f5f7;">
		<table width="100%%" border="0" cellspacing="0" cellpadding="0" style="padding: 40px 0;">
			<tr>
				<td align="center">
					<table width="520" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
						<!-- Header -->
						<tr>
							<td style="background-color: #b70011; padding: 22px 30px; text-align: center;">
								<h1 style="color: #ffffff; margin: 0; font-size: 20px;">⚠️ แจ้งเตือนสต็อกสินค้าใกล้หมด</h1>
								<p style="color: #ffcccc; margin: 4px 0 0; font-size: 13px;">ระบบตรวจพบสินค้ามีจำนวนต่ำกว่าเกณฑ์ขั้นต่ำ</p>
							</td>
						</tr>
						<!-- Body -->
						<tr>
							<td style="padding: 30px;">
								<table width="100%%" border="0" cellspacing="0" cellpadding="8" style="font-size: 14px; border-collapse: collapse;">
									<tr style="border-bottom: 1px solid #eeeeee;">
										<td style="color: #666666; width: 35%%;">ชื่อสินค้า:</td>
										<td style="color: #111111; font-weight: bold;">%s</td>
									</tr>
									<tr style="border-bottom: 1px solid #eeeeee;">
										<td style="color: #666666;">รหัสสินค้า:</td>
										<td style="color: #111111; font-weight: bold;">%s</td>
									</tr>
									<tr style="border-bottom: 1px solid #eeeeee;">
										<td style="color: #666666;">คงเหลือปัจจุบัน:</td>
										<td style="color: #e51c23; font-size: 16px; font-weight: bold;">%d ชิ้น</td>
									</tr>
									<tr>
										<td style="color: #666666;">เกณฑ์เตือนขั้นต่ำ:</td>
										<td style="color: #555555;">%d ชิ้น</td>
									</tr>
								</table>
								<div style="margin-top: 25px; padding: 15px; background-color: #fff9e6; border-left: 4px solid #f59e0b; border-radius: 4px;">
									<p style="color: #92400e; margin: 0; font-size: 13px;">
										<strong>คำแนะนำ:</strong> กรุณาตรวจสอบและดำเนินการเปิดใบสั่งซื้อ (PO) หรือจัดเตรียมสินค้าเข้าคลังเพิ่มเติม
									</p>
								</div>
							</td>
						</tr>
						<!-- Footer -->
						<tr>
							<td style="background-color: #f9fafb; padding: 15px 30px; text-align: center; border-top: 1px solid #eeeeee;">
								<p style="color: #999999; font-size: 12px; margin: 0;">JJ AutoParts - ระบบแจ้งเตือนอัตโนมัติ</p>
							</td>
						</tr>
					</table>
				</td>
			</tr>
		</table>
	</body>
	</html>
	`, productName, productCode, currentQty, limitQty)

	return s.SendEmail([]string{toEmail}, subject, htmlBody)
}

func (s *emailService) SendNewOrderAlert(orderType, orderCode string, totalPrice float64, customerName string, items []string) error {
	toEmail := s.user
	if toEmail == "" {
		return nil
	}

	subject := fmt.Sprintf("📦 มีรายการ%sใหม่: %s", orderType, orderCode)
	
	itemsHtml := ""
	for _, itm := range items {
		itemsHtml += fmt.Sprintf("<li style='margin-bottom: 6px; color: #333;'>%s</li>", itm)
	}

	htmlBody := fmt.Sprintf(`
	<!DOCTYPE html>
	<html>
	<head><meta charset="utf-8"></head>
	<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f4f5f7;">
		<table width="100%%" border="0" cellspacing="0" cellpadding="0" style="padding: 40px 0;">
			<tr>
				<td align="center">
					<table width="520" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
						<!-- Header -->
						<tr>
							<td style="background-color: #1c1b1b; padding: 22px 30px; text-align: center;">
								<h1 style="color: #ffffff; margin: 0; font-size: 20px;">📦 มีรายการ%sใหม่</h1>
								<p style="color: #4ade80; margin: 4px 0 0; font-size: 14px; font-weight: bold;">รหัส: %s</p>
							</td>
						</tr>
						<!-- Body -->
						<tr>
							<td style="padding: 30px;">
								<table width="100%%" border="0" cellspacing="0" cellpadding="8" style="font-size: 14px; border-collapse: collapse;">
									<tr style="border-bottom: 1px solid #eeeeee;">
										<td style="color: #666666; width: 35%%;">ประเภทรายการ:</td>
										<td style="color: #111111; font-weight: bold;">%s</td>
									</tr>
									<tr style="border-bottom: 1px solid #eeeeee;">
										<td style="color: #666666;">ลูกค้า:</td>
										<td style="color: #111111; font-weight: bold;">%s</td>
									</tr>
									<tr style="border-bottom: 1px solid #eeeeee;">
										<td style="color: #666666;">ยอดรวม:</td>
										<td style="color: #059669; font-size: 18px; font-weight: bold;">฿%.2f</td>
									</tr>
								</table>
								%s
							</td>
						</tr>
						<!-- Footer -->
						<tr>
							<td style="background-color: #f9fafb; padding: 15px 30px; text-align: center; border-top: 1px solid #eeeeee;">
								<p style="color: #999999; font-size: 12px; margin: 0;">JJ AutoParts - ระบบแจ้งเตือนอัตโนมัติ</p>
							</td>
						</tr>
					</table>
				</td>
			</tr>
		</table>
	</body>
	</html>
	`, orderType, orderCode, orderType, customerName, totalPrice, 
		func() string {
			if itemsHtml != "" {
				return "<div style='margin-top: 20px;'><p style='color: #666; font-size: 13px; font-weight: bold; margin-bottom: 8px;'>รายการสินค้า:</p><ul style='padding-left: 20px; font-size: 13px; margin: 0;'>" + itemsHtml + "</ul></div>"
			}
			return ""
		}())

	return s.SendEmail([]string{toEmail}, subject, htmlBody)
}
