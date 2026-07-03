# คู่มือการทำงานและการติดตั้งระบบประมวลผลบิล (Go Backend & FastAPI AI Agent)

ไฟล์นี้อธิบายถึงสถาปัตยกรรมการทำงานร่วมกันระหว่าง **Go Backend** และ **FastAPI (Python)** สำหรับระบบนำเข้าบิลด้วยโมเดล OCR และการเชื่อมต่อแชทบอท LINE OA ร่วมกับ AI Agent ในการดึงข้อมูลหลังบ้านโดยตรง

---

## 1. สถาปัตยกรรมระบบ (Architecture Overview)

ระบบนี้ใช้สถาปัตยกรรมแบบ **Hybrid Architecture** เพื่อดึงข้อดีของทั้งสองภาษา:
*   **Go Backend:** ทำหน้าที่เป็นแอปพลิเคชันหลัก ดูแลระบบจัดการร้านอะไหล่ (WMS, POS), สิทธิ์ผู้ใช้งาน (Auth) การทำธุรกรรมลงฐานข้อมูล (Database Transactions) ด้วย GORM และรับคำขอ Webhook จาก LINE Platform
*   **FastAPI (Python) Service:** ทำหน้าที่เป็นเครื่องยนต์สำหรับงานด้านปัญญาประดิษฐ์ (AI Agent & OCR) เช่น การวิเคราะห์รูปภาพบิล และการประมวลผลความเข้าใจภาษาธรรมชาติเพื่อแปลงภาษาคนเป็นคำสั่งคิวรี SQL ดึงข้อมูลจากฐานข้อมูลของระบบโดยตรง

### กราฟแสดงเส้นทางการเชื่อมต่อระบบนำเข้าบิล (OCR Flow):
```
[ Frontend / User ]
        │ (1. Upload Bill Image)
        ▼
[ Go Backend (Port: 8080) ]
        │
        ├──► (2. HTTP POST JSON) ──► [ FastAPI Service (Port: 8000) ]
        │                                  │
        │                       (วิเคราะห์บิลผ่าน Gemini / AI Agent)
        │                                  │
        │◄── (3. Return JSON Data) ◄───────┘
        │
        ▼ (4. Save to DB)
[ PostgreSQL Database ]
```

### กราฟแสดงเส้นทางการแชทถามข้อมูลผ่านไลน์ (LINE OA Chat & AI Agent Flow):
```
[ ลูกค้าพิมพ์แชทในมือถือ ]
        │ (1. ส่งข้อความเข้ามาใน LINE OA)
        ▼
[ LINE Platform ]
        │ (2. ยิง HTTPS Webhook)
        ▼ (ผ่านช่องทาง ngrok /webhook)
[ Go Backend (Port: 8080) ]
        │
        ├──► (3. ยิง HTTP POST) ──► [ FastAPI /api/agent (Port: 8000) ]
        │    (หรือรัน CLI fallback)        │
        │                           (4. แปลงคำถาม -> SELECT SQL)
        │                                  │
        │◄── (5. คืนคำตอบภาษาไทย) ◄─────────▼ (ดึงข้อมูลตรงจาก DB)
        │
        ▼ (6. ส่งข้อความตอบกลับ)
[ LINE Messaging API ] ──► [ มือถือลูกค้า ]
```

---

## 2. รายละเอียดไฟล์และโค้ดหลัก

### A. FastAPI Server (`backend/model/server.py` และ `backend/model/embedder.py`)
ทำหน้าที่สร้าง Web API บนพอร์ต `8000` โดยต่อสายใช้งานตรงกับ Google Gemini API และ **เชื่อมต่อโดยตรงกับ PostgreSQL Database**:
*   `POST /api/extract-invoice` : รับพาธของไฟล์รูปภาพบิล แล้วส่งให้โมเดลทำ OCR
*   `POST /api/agent` : รับคำถามภาษาไทยจาก Go Backend พร้อมรหัส LINE User ID แล้วเรียกตัว AI Agent ค้นหาข้อมูลใน DB ส่งคืนกลับไปให้แชทไลน์โดยตรง
*   **ระบบสแกนจับคู่สินค้าด้วย AI (Vector Similarity Product Mapping):** เมื่อสแกนบิล OCR สำเร็จ ระบบจะดึงโมเดล `onnx-community/embeddinggemma-300m-ONNX` (รันผ่าน ONNX Runtime ใน `embedder.py`) มาคำนวณเวกเตอร์ embeddings ของสินค้า แล้วเปรียบเทียบความคล้ายคลึง (Cosine Similarity) กับสินค้าของระบบ เพื่อเลือกผูก `product_id` ให้อัตโนมัติทันทีก่อนบันทึกใบสั่งซื้อ (มีระบบ TF-IDF เป็น Fallback ช่วยสำรองกรณีหน่วยความจำไม่เพียงพอ)

### B. AI Text-to-SQL Agent (`backend/model/agent.py`)
*   ทำหน้าที่เป็นตัวประสานงาน (Agent Core) ทำการประเมินประโยคคำถามของลูกค้าใน LINE
*   **Customer context mapping:** ระบบจะไปค้นหาข้อมูลไลน์ของลูกค้าก่อนว่าเชื่อมโยงเข้ากับอู่ซ่อมรถหรือโปรไฟล์ลูกค้าคนไหนในร้าน เพื่อให้คำตอบที่สอดคล้องกับเจ้าตัว
*   **Text-to-SQL:** หากคำถามเกี่ยวกับการเช็คสต็อกสินค้า, ค้างชำระ หรือราคาสินค้า บอทจะใช้โมเดล Gemini เจนเนอเรตคำสั่ง SQL (Read-Only) แล้วยิงคิวรีข้อมูลดิบจาก Postgres ทันที ก่อนที่จะเรียบเรียงออกมาเป็นประโยคคำตอบที่สุภาพเรียบร้อย

### C. Go Integration Service (`backend/internal/app/service/oa/oa_service.go`)
*   ทำหน้าที่ดักจับข้อความแชทที่ลูกค้าพิมพ์ส่งมาในแชนเนลไลน์
*   **ฟีเจอร์เชื่อมต่อบัญชีอัตโนมัติ (Chat-based Linking):** หากลูกค้าพิมพ์ว่า `#เชื่อมต่อ 0812345678` หรือ `#link <เบอร์โทรศัพท์>` ระบบจะวิ่งไปค้นเบอร์โทรในตาราง `customers` และผูก ID บัญชีไลน์เข้าด้วยกันทันที โดยไม่ต้องอาศัยหน้าเว็บล็อกอิน
*   **ระบบสลับริชเมนูตามสิทธิ์ (Dynamic Rich Menu Swapping):** เมื่อเกิดอีเวนต์ทักทาย (Follow) หรือผูกบัญชีสำเร็จ (Linked Account) ระบบจะตรวจค้นบทบาทผู้ใช้งานใน DB และยิง API สลับภาพ Rich Menu ให้สอดคล้องกับบทบาทรายคนทันที (Customer / Employee / Owner)
*   **กลไกการเรียกใช้งาน Agent:** จะเรียกหาทาง HTTP `/api/agent` ก่อน แต่หากเซิร์ฟเวอร์ไพทอนปิดอยู่ จะใช้ระบบสำรอง (CLI Fallback) รันคำสั่ง `python3 model/agent.py "<คำถาม>" "<UserID>"` อัตโนมัติ ป้องกันไม่ให้แชทบอทหยุดตอบสนอง

---

## 3. ขั้นตอนการติดตั้งและรันใช้งาน

### ขั้นตอนที่ 1: ติดตั้งไลบรารีของ Python (Dependencies)
เปิด Terminal และรันคำสั่งติดตั้งไลบรารีที่จำเป็นทั้งหมด:
```bash
pip install -r backend/model/requirements.txt
```

### ขั้นตอนที่ 2: ตั้งค่าไฟล์ `.env`
ตรวจสอบไฟล์ `backend/.env` ว่ามีข้อมูลการเชื่อมต่อฐานข้อมูลและ API Key ครบถ้วน:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=1234
DB_NAME=Autopartsdb
GOOGLE_STUDIO= AIzaSy... (คีย์ Gemini ของคุณ)
Channel_ID= 2010... (LINE Channel ID)
Channel_secret= 28f9... (LINE Channel Secret)
LINE_RICH_MENU_CUSTOMER=richmenu-customer-mock-id
LINE_RICH_MENU_OWNER=richmenu-owner-mock-id
LINE_RICH_MENU_EMPLOYEE=richmenu-employee-mock-id
```

### ขั้นตอนที่ 3: เริ่มต้นสตาร์ทระบบหลังบ้านคู่ขนาน
1.  **เปิดใช้งาน FastAPI Service (พอร์ต 8000):**
    ```bash
    python backend/model/server.py
    ```
2.  **เปิดใช้งาน Go Backend (พอร์ต 8080):**
    เปิด Terminal อีกหน้าต่างหนึ่ง รันคำสั่ง:
    ```bash
    go run backend/main.go
    ```

---

## 4. วิธีการทดสอบระบบแชทบอท LINE OA & AI Agent

คุณสามารถทดสอบความถูกต้องของการเชื่อมต่อแชทและ AI ได้สองแนวทาง:

### วิธีที่ 1: ทดสอบผ่านแชท LINE จริงบนโทรศัพท์มือถือ 📱
1.  ทำการดาวน์โหลดและรันอุโมงค์ Ngrok เพื่อส่งผ่านข้อมูล HTTPS:
    ```bash
    ngrok http 8080
    ```
2.  คัดลอก URL HTTPS ที่ได้ (เช่น `https://abcd-1234.ngrok-free.app/webhook`) ไปวางในช่อง **Webhook URL** บนหน้าตั้งค่า Messaging API ของ LINE Developers Console
3.  เปิดสวิตช์ **Use webhook** เป็นเปิด (On) แล้วกดปุ่ม **Verify** (ต้องได้รับสถานะสีเขียว Success 200 OK)
4.  สแกน QR Code เพื่อติดตาม LINE OA ของร้านค้า และทดลองพิมพ์คำสั่งเหล่านี้ในแชท:
    *   `#เชื่อมต่อ 0812345678` *(เพื่อผูกเบอร์โทรศัพท์เข้ากับลูกค้าในระบบ)*
    *   `เช็คยอดหนี้ค้างชำระของฉันให้หน่อย`
    *   `มีปะเก็นฝาสูบหรือกรองน้ำมันเครื่องกี่ชิ้น`

### วิธีที่ 2: ทดสอบแบบรวดเร็วผ่าน Webhook Simulator (ผ่าน cURL 💻)
หากไม่ต้องการต่อ Ngrok หรือใช้โทรศัพท์มือถือจริง คุณสามารถใช้คำสั่งจำลองเหตุการณ์ส่งจากคอมพิวเตอร์ของคุณเอง:

*   **จำลองการพิมพ์ขอเชื่อมต่อหมายเลขโทรศัพท์ลูกค้าในแชท:**
    ```bash
    curl -X POST http://localhost:8080/api/oa/simulate \
      -H "Content-Type: application/json" \
      -d '{
        "line_user_id": "U_TEST_USER_999",
        "display_name": "อู่วิชัยยนต์",
        "text": "#เชื่อมต่อ 0812345678"
      }'
    ```
*   **จำลองการถามข้อมูลยอดคงค้างหนี้สิน (หลังจากทำการเชื่อมต่อเสร็จสิ้น):**
    ```bash
    curl -X POST http://localhost:8080/api/oa/simulate \
      -H "Content-Type: application/json" \
      -d '{
        "line_user_id": "U_TEST_USER_999",
        "display_name": "อู่วิชัยยนต์",
        "text": "ยอดค้างชำระของฉันทั้งหมดเท่าไหร่ครับตอนนี้"
      }'
    ```
    *(หลังบ้าน Go จะส่งคำถามเข้า Agent ไพทอนเพื่อดึงข้อมูลเครดิตลูกค้า 'อู่วิชัยยนต์' และส่งคำตอบแสดงผลออกมาในทันที)*
