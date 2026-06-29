# คู่มือการทำงานและการติดตั้งระบบประมวลผลบิล (Go Backend & FastAPI AI Agent)

ไฟล์นี้อธิบายถึงสถาปัตยกรรมการทำงานร่วมกันระหว่าง **Go Backend** และ **FastAPI (Python)** สำหรับระบบนำเข้าบิลด้วยโมเดล OCR และการเตรียมระบบเพื่อรองรับ AI Agent ในอนาคต

---

## 1. สถาปัตยกรรมระบบ (Architecture Overview)

ระบบนี้ใช้สถาปัตยกรรมแบบ **Hybrid Architecture** เพื่อดึงข้อดีของทั้งสองภาษา:
*   **Go Backend:** ทำหน้าที่เป็นแอปพลิเคชันหลัก ดูแลระบบจัดการร้านอะไหล่ (WMS, POS), สิทธิ์ผู้ใช้งาน (Auth) และการทำธุรกรรมลงฐานข้อมูล (Database Transactions) ด้วย GORM
*   **FastAPI (Python) Service:** ทำหน้าที่เป็นเครื่องยนต์สำหรับงานด้านปัญญาประดิษฐ์ (AI Agent & OCR) เช่น การวิเคราะห์รูปภาพด้วยโมเดล Gemma-4, จัดเก็บสถานะโมเดลไว้บนหน่วยความจำ ทำให้การประมวลผลรวดเร็ว (ไม่ต้องโหลดโมเดลใหม่ทุกครั้งที่เรียกใช้)

```
[ Frontend / User ]
        │ (1. Upload Bill Image)
        ▼
[ Go Backend (Port: 8080) ]
        │
        ├──► (2. HTTP POST JSON) ──► [ FastAPI Service (Port: 8000) ]
        │                                  │
        │                            (วิเคราะห์บิลผ่าน Gemma-4 / AI Agent)
        │                                  │
        │◄── (3. Return JSON Data) ◄───────┘
        │
        ▼ (4. Save to DB)
[ PostgreSQL Database ]
```

---

## 2. รายละเอียดไฟล์และโค้ดหลัก

### A. FastAPI Server (`backend/model/server.py`)
ทำหน้าที่สร้าง Web API บนพอร์ต `8000` โดยโหลดโมเดล Gemma-4 ไว้ทันทีตอนเปิดเครื่อง (Hot Start) และ **เชื่อมต่อโดยตรงกับ PostgreSQL Database** (อ่านการตั้งค่าจากไฟล์ `.env`):
*   มีระบบเชื่อมฐานข้อมูลด้วย SQLAlchemy แบบดิบ (Raw SQL)
*   **เมื่อ Go Backend เรียกใช้งาน:** จะส่ง `job_id` มาด้วย FastAPI จะทำการ `UPDATE` สถานะและข้อมูลผลลัพธ์ลงตาราง `bill_import_jobs` ในฐานข้อมูลทันทีที่วิเคราะห์เสร็จ
*   **เมื่อเทสจากภายนอก (เช่น Swagger UI):** ไม่จำเป็นต้องส่ง `job_id` ตัว FastAPI จะทำการ `INSERT` ข้อมูลเป็นรายการใหม่ลงตาราง `bill_import_jobs` ให้โดยอัตโนมัติ
*   มี Endpoint หลัก:
    1.  `POST /api/extract-invoice` : รับพาธของไฟล์รูปภาพบนเครื่องเซิร์ฟเวอร์ พร้อม `job_id` (ถ้ามี)
    2.  `POST /api/extract-invoice/upload` : รองรับการอัปโหลดไฟล์ตรง พร้อม `job_id` (ถ้ามี)

### B. Go Integration Service (`backend/internal/app/service/import_data/import_bill_service.go`)
ในเมธอด `processOCRInBackground` จะปรับเปลี่ยนวิธีการดึงผลลัพธ์:
1.  ส่งคำขอ HTTP POST ไปหา FastAPI (`http://localhost:8000/api/extract-invoice`) พร้อมแนบ JSON บอดี้ระบุที่อยู่ไฟล์ภาพ
2.  รับข้อมูล JSON ผลวิเคราะห์กลับมาถอดรหัส แล้วบันทึกใส่ฐานข้อมูลในตาราง `bill_import_jobs` ในฟิลด์ `draft_json`
3.  **กลไกสำรอง (Fallback):** หากติดต่อ FastAPI ไม่สำเร็จ เช่น เซิร์ฟเวอร์ปิดอยู่ ตัว Go จะสลับไปรันแบบ Command Line (`python3 model/main.py`) อัตโนมัติ เพื่อให้ระบบไม่ล่ม

---

## 3. ขั้นตอนการติดตั้งและรันใช้งาน

### ขั้นตอนที่ 1: ติดตั้งไลบรารีของ Python (Dependencies)
เปิด Terminal และรันคำสั่งติดตั้งไลบรารีที่จำเป็นทั้งหมด (รวมถึงตัวเชื่อมต่อฐานข้อมูล `psycopg2-binary`):

*   **หากอยู่ที่โฟลเดอร์ root ของโปรเจกต์:**
    ```bash
    pip install -r backend/model/requirements.txt
    ```
*   **หากอยู่ที่โฟลเดอร์ `backend/model`:**
    ```bash
    pip install -r requirements.txt
    ```

### ขั้นตอนที่ 2: ตั้งค่าไฟล์ `.env`
ตรวจสอบไฟล์ `backend/.env` ว่ามีข้อมูลการเชื่อมต่อฐานข้อมูลถูกต้อง เช่น:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=1234
DB_NAME=Autopartsdb
```

### ขั้นตอนที่ 3: เริ่มต้นสตาร์ทระบบ

1.  **เปิดใช้งาน FastAPI Service (พอร์ต 8000):**
    *   **หากรันจากโฟลเดอร์ `backend`:**
        ```bash
        python model/server.py
        ```
    *   **หากรันจากโฟลเดอร์ `backend/model`:**
        ```bash
        python server.py
        ```
    *(ปล่อยหน้าต่าง Terminal นี้ไว้ ห้ามปิดเด็ดขาดเพื่อเปิดให้เซิร์ฟเวอร์รันอยู่)*

2.  **เปิดใช้งาน Go Backend (พอร์ต 8080):**
    เปิด Terminal อีกหน้าต่างหนึ่ง เข้าไปที่โฟลเดอร์ `backend` แล้วรัน:
    ```bash
    go run main.go
    ```

---

## 4. แนวทางการพัฒนา AI Agent ในอนาคต

เมื่อคุณใช้ FastAPI รันควบคู่ไปแล้ว คุณสามารถสร้าง **AI Agent** (เช่น ใช้ LangChain หรือ LangGraph) ในฝั่ง Python ได้สะดวกมาก โดยการเพิ่ม API และเชื่อมโยง Database ดังนี้:

1.  **สร้าง Tools ให้ Agent:** สามารถสร้างฟังก์ชัน Python เพื่อดึงสต็อกสินค้าจากตาราง `products` หรือบันทึกบิลอิงตาม SQLAlchemy ใน `server.py`
2.  **รัน LLM Agent Reasoning:** เมื่อหน้าบ้านต้องการปรึกษา Agent สามารถส่งคำสั่งมายัง FastAPI จากนั้นให้ Agent ดำเนินการเช็คข้อมูลใน DB และคืนการวิเคราะห์ที่ซับซ้อนให้หน้าบ้านแสดงผลได้ทันที

---

## 5. วิธีการทดสอบระบบ (System Testing)

คุณสามารถทดสอบความถูกต้องของระบบนำเข้าบิลได้ 3 ช่องทางตามความสะดวกครับ:

### วิธีที่ 1: ทดสอบผ่าน Swagger UI ของ FastAPI (ง่ายที่สุด 💻)
FastAPI มีหน้าเว็บสำหรับทดสอบ API ให้ในตัว:
1.  ตรวจสอบว่ารัน FastAPI อยู่ (`python model/server.py`)
2.  เปิดเว็บเบราว์เซอร์ไปที่: `http://localhost:8000/docs`
3.  ค้นหาหัวข้อ `POST /api/extract-invoice/upload` (แถบสีเขียว)
4.  คลิกขยายขึ้นมา -> กดปุ่ม **Try it out**
5.  ที่ช่อง `file` ให้คลิกอัปโหลดรูปภาพบิลตัวอย่างของคุณจากเครื่องคอมพิวเตอร์
6.  กดปุ่ม **Execute** สีน้ำเงิน -> ระบบจะส่งรูปภาพเข้าโมเดล Gemma-4 และแสดงผลลัพธ์เป็น JSON ข้อมูลบิลด้านล่างทันที

### วิธีที่ 2: ทดสอบด้วยคำสั่ง cURL (ผ่าน Terminal)
หากต้องการยิงเทสด้วยคำสั่ง Command line:

*   **ทดสอบการส่งแบบ Multipart Upload (อัปโหลดรูปตรง):**
    ```bash
    curl -X POST "http://localhost:8000/api/extract-invoice/upload" \
         -F "file=@/path/to/your/invoice.jpg"
    ```
*   **ทดสอบการระบุ Path บนเครื่อง (ส่ง JSON):**
    ```bash
    curl -X POST "http://localhost:8000/api/extract-invoice" \
         -H "Content-Type: application/json" \
         -d '{"file_path": "uploads/your_bill.jpg"}'
    ```

### วิธีที่ 3: ทดสอบการทำงานร่วมกันแบบ End-to-End (ผ่าน Go Backend)
เป็นการทดสอบจำลองภาพการทำงานที่ติดต่อข้อมูลกับฐานข้อมูลและการควบคุมความปลอดภัยผ่าน Go API:

1.  ให้แน่ใจว่าทั้ง **Go Backend (พอร์ต 8080)** และ **FastAPI (พอร์ต 8000)** รันอยู่คู่กัน
2.  **ดึงข้อมูล JWT Token สำหรับล็อกอิน:**
    เนื่องจากทางเดิน API ของ Go มีระบบ Auth ป้องกันอยู่ และหลังบ้านคาดหวังรหัสผ่านที่เป็น Base64 (รหัสผ่าน `owner123` ในรูปแบบ Base64 คือ `b3duZXIxMjM=`) ให้รันคำสั่งบรรทัดเดียวนี้เพื่อรับ Token:
    ```bash
    curl -X POST "http://localhost:8080/api/auth/login" -H "Content-Type: application/json" -d '{"username": "owner", "password": "b3duZXIxMjM="}'
    ```
    คัดลอกคีย์ข้อความยาว ๆ ในช่อง `"token"` ที่ได้กลับมา เพื่อนำไปใช้ในขั้นตอนถัดไป
3.  **ทำการสร้าง Job วิเคราะห์บิล:**
    ส่งคำขอสร้าง Job โดยแนบ Token ใน Header (สับเปลี่ยน `<ใส่_JWT_Token_ที่นี่>` ด้วย Token จริงที่ได้ในข้อ 2):
    ```bash
    curl -X POST "http://localhost:8080/api/import-data/bill-import-jobs" -H "Content-Type: application/json" -H "Authorization: Bearer <ใส่_JWT_Token_ที่นี่>" -d '{"file_url": "uploads/your_bill.jpg", "file_type": "invoice", "created_by": 1}'
    ```
4.  **ตรวจสอบสถานะ Job และ JSON ดราฟต์:**
    เช็คว่าระบบบันทึกผลการแปลงภาพบิลสำเร็จหรือไม่:
    ```bash
    curl -X GET "http://localhost:8080/api/import-data/bill-import-jobs/1" -H "Authorization: Bearer <ใส่_JWT_Token_ที่นี่>"
    ```
    จะพบข้อมูลบิลที่แปลเสร็จแล้วบันทึกในตารางฐานข้อมูลในคอลัมน์ `draft_json`
5.  **กดยืนยัน (Confirm) บันทึกบิลลงตารางหลัก:**
    ส่งข้อมูลผลลัพธ์บิลเพื่อเขียนลงตาราง `bills` และ `bill_items` ในฐานข้อมูลจริง (คำสั่งแบบบรรทัดเดียวป้องกัน Error ใน zsh):
    ```bash
    curl -X POST "http://localhost:8080/api/import-data/bill-import-jobs/1/confirm" -H "Content-Type: application/json" -H "Authorization: Bearer <ใส่_JWT_Token_ที่นี่>" -d '{"bill": {"total_amount": 15450.00, "bill_no": "INV-9923841", "due_date": "2026-07-24T00:00:00Z", "transport_by": "Kerry Express Logistics", "supplier_id": 1, "subtotal": 14439.25, "bill_image_id": 1, "discount_total": 500.00, "credit_term": "30 Days", "vat_amount": 1010.75, "grand_total": 15450.00, "payment_status": "unpaid", "po_id": 1}, "items": [{"bill_id": 1, "item_sequence": 1, "company_product_code": "SPK-001", "company_product_name": "Spark Plug Premium Bosch", "order_quantity": 10, "unit": "PCS", "conversion_factor": 1.0, "price_per_unit": 350.00, "discount_amount": 0.0, "net_amount": 3500.00, "is_freebie": false, "product_id": 1}]}'
    ```

