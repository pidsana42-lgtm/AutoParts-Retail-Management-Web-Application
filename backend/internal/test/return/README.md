# เทสระบบคืนสินค้า

ชุดนี้ทดสอบ `internal/app/service/return` และ `internal/app/controller/return`
โดยใช้ mock repository และ HTTP service stub จึงไม่ต้องตั้งค่า `.env`, เปิด server หรือเชื่อมต่อฐานข้อมูล

- `return_service_test.go`: สร้างใบคืน คำนวณยอดคืน สิทธิ์อนุมัติจากผู้ใช้ การเปลี่ยนสถานะ คืนเงิน ลบรายการ และ repository errors
- `return_query_test.go`: ค้นหา แบ่งหน้า จำนวนรายการตามสถานะ รายละเอียดใบคืน และค่าทดแทนเมื่อข้อมูลไม่ครบ
- `return_controller_test.go`: HTTP requests/responses, validation, สิทธิ์ตาม role, actor จาก context และการแปลง domain errors เป็น HTTP status

รันจากโฟลเดอร์ `backend`:

```sh
go test ./internal/test/return -v
```

รันรวมกับเทสเดิมและวัด statement coverage เฉพาะ Service/Controller ของระบบคืนสินค้า:

```sh
go test ./internal/test/... -coverpkg=./internal/app/service/return,./internal/app/controller/return
```

ขอบเขต: เทสนี้ไม่ได้ตรวจ SQL/transaction, การคืนสต็อก, การบันทึกการจ่ายเงิน,
ยอดสรุปรายวัน หรือ JWT middleware จริง ซึ่งต้องทดสอบแบบ integration เพิ่มต่างหาก
กรณี repository ส่ง error ตรวจว่าชั้น Service/Controller ส่งต่อและตอบกลับได้ถูกต้อง
ไม่ได้ยืนยันกฎธุรกิจภายใน repository
