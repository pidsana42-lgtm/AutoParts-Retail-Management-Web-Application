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
ทำหน้าที่สร้าง Web API บนพอร์ต `8000` โดยโหลดโมเดล Gemma-4 ไว้ทันทีตอนเปิดเครื่อง (Hot Start) มี Endpoint สำคัญ 2 จุด:
1.  `POST /api/extract-invoice` : รับพาธของไฟล์รูปภาพบนเครื่องเซิร์ฟเวอร์ จากนั้นเปิดไฟล์และส่งเข้าโมเดล
2.  `POST /api/extract-invoice/upload` : รองรับการอัปโหลดไฟล์ในรูปแบบ Multipart Form Data (กรณีที่ระบบอื่นหรือหน้าบ้านต้องการเรียกใช้งานตรง)

### B. Go Integration Service (`backend/internal/app/service/import_data/import_bill_service.go`)
ในเมธอด `processOCRInBackground` จะปรับเปลี่ยนวิธีการดึงผลลัพธ์:
1.  ส่งคำขอ HTTP POST ไปหา FastAPI (`http://localhost:8000/api/extract-invoice`) พร้อมแนบ JSON บอดี้ระบุที่อยู่ไฟล์ภาพ
2.  รับข้อมูล JSON ผลวิเคราะห์กลับมาถอดรหัส แล้วบันทึกใส่ฐานข้อมูลในตาราง `bill_import_jobs` ในฟิลด์ `draft_json`
3.  **กลไกสำรอง (Fallback):** หากติดต่อ FastAPI ไม่สำเร็จ เช่น เซิร์ฟเวอร์ปิดอยู่ ตัว Go จะสลับไปรันแบบ Command Line (`python3 model/main.py`) อัตโนมัติ เพื่อให้ระบบไม่ล่ม

---

## 3. ขั้นตอนการติดตั้งและรันใช้งาน

### ขั้นตอนที่ 1: ติดตั้งไลบรารีของ Python
เปิด Terminal แล้วเข้าไปที่โฟลเดอร์ Python `model`:
```bash
cd backend/model
pip install -r requirements.txt
```

### ขั้นตอนที่ 2: ตั้งค่าไฟล์ `.env`
ตรวจสอบว่ามีข้อมูลเชื่อมต่อฐานข้อมูลและ Token ของ Hugging Face ในไฟล์ `.env` เรียบร้อยแล้ว (โดยเฉพาะ `HF_TOKEN` สำหรับดึงโมเดล Gemma)

### ขั้นตอนที่ 3: สตาร์ทระบบ

1.  **เปิดใช้งาน FastAPI Service:**
    ```bash
    # จากโฟลเดอร์ backend
    python model/server.py
    ```
    *(เซิร์ฟเวอร์จะเปิดที่ `http://localhost:8000` และตรวจสุขภาพระบบได้ที่ `http://localhost:8000/health`)*

2.  **เปิดใช้งาน Go Backend:**
    เปิด Terminal อีกหน้าต่างหนึ่งในโฟลเดอร์ `backend` แล้วรัน:
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
เป็นการทดสอบว่าระบบ Go ติดต่อเขียนฐานข้อมูลและเรียกใช้ FastAPI สำเร็จหรือไม่:
1.  ให้แน่ใจว่าทั้ง **Go Backend (พอร์ต 8080)** และ **FastAPI (พอร์ต 8000)** รันอยู่คู่กัน
2.  ทำการสร้าง Job วิเคราะห์บิลผ่าน API ของ Go:
    ```bash
    curl -X POST "http://localhost:8080/api/import-data/bill-import-jobs" \
         -H "Content-Type: application/json" \
         -d '{"file_url": "uploads/your_bill.jpg", "file_type": "invoice", "created_by": 1}'
    ```
    *(หมายเหตุ: ต้องแนบ Token หรือปิด Middleware Auth ชั่วคราวสำหรับการทดสอบภายนอก)*
3.  ตรวจสอบสถานะ Job และ JSON ดราฟต์ที่ได้จากฐานข้อมูล:
    ```bash
    curl -X GET "http://localhost:8080/api/import-data/bill-import-jobs/1"
    ```
    จะเห็นข้อมูลบิลที่ประมวลผลเสร็จแล้วพร้อมในคอลัมน์ `draft_json`
4.  กดอนุมัติ (Confirm) เพื่อแปลงข้อมูลบิลลงตารางหลักจริง:
    ```bash
    curl -X POST "http://localhost:8080/api/import-data/bill-import-jobs/1/confirm" \
         -H "Content-Type: application/json" \
         -d '{
               "bill": { ...ข้อมูลบิล... },
               "items": [ ...รายการอะไหล่... ]
             }'
    ```

