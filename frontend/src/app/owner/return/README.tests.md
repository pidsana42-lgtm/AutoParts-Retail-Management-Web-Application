# Frontend tests: Return

รันจากโฟลเดอร์ `frontend`:

```sh
npm test -- src/app/owner/return src/service/http/return
```

ใช้ Vitest, React Testing Library และ jsdom โดยใช้หน้าจอ คอมโพเนนต์ และ router จริง
จำลอง API และ toast เพื่อไม่สร้างใบคืนหรือคืนเงินในฐานข้อมูลจริง

- `new_return.test.tsx`: เลือกใบขาย/สินค้า จำนวนคืนไม่เกินจำนวนซื้อ เหตุผลและสภาพของแต่ละชิ้น ยอดเงิน ช่องทางคืนเงิน สิทธิ์เครดิตร้านค้า payload การกดซ้ำ และข้อผิดพลาด
- `return_detail.test.tsx`: แสดงรายละเอียดและเหตุผลรายสินค้า สิทธิ์อนุมัติ/ปฏิเสธ/คืนเงิน การกดซ้ำ และข้อผิดพลาดจาก API
- `returns.test.tsx`: รายการ ยอดนับ กรองสถานะ แบ่งหน้า ค้นหา อนุมัติ คืนเงิน และเส้นทางเจ้าของ/พนักงาน
- `hooks/useReturnSearch.test.ts`: debounce ค้นหาทันที ยกเลิก timer และผลลัพธ์ที่ตอบกลับผิดลำดับ
- `../../../service/http/return/return_service.test.ts`: HTTP method, endpoint, parameters, payload, response และการส่งต่อ errors
- ข้อมูลตัวอย่างร่วมอยู่ใน `../../../test/returnFixtures.ts`

เทสนี้ตรวจพฤติกรรม frontend และสัญญาการเรียก API ไม่ได้ตรวจฐานข้อมูล JWT middleware
การจ่ายเงินจริง หรือภาพที่แสดงในเบราว์เซอร์จริง ส่วน backend มีเทสแยกที่ `backend/internal/test/return`
เทสการคืนเงินใช้หน้าต่างยืนยันที่มีอยู่เดิมของ Return

Regression การส่งคำขอล้มเหลว: ไม่พาออกจากฟอร์มหลัง 4 วินาที เก็บเหตุผล/หมายเหตุ/ช่องทางคืนเงินไว้ และกดลองบันทึกใหม่ได้
