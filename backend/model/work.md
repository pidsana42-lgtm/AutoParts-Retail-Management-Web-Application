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

---

## 5. ประวัติการอัปเดตระบบและการปรับปรุงล่าสุด (Deployment & Recent Technical Updates)

### A. สถาปัตยกรรมระบบบนเซิร์ฟเวอร์จริง (Cloud VPS Production: 8.219.93.236)
ระบบบน Cloud VPS ควบคุมและรันผ่าน **PM2 Process Manager** ทั้งหมด 3 บริการ:
* **Frontend App (Port 3000):** สตาร์ตด้วย `pm2 serve dist 3000 --name "frontend-app" --spa`
* **Backend App (Port 8080):** สตาร์ตด้วย `pm2 start ./main --name "backend-app"` (รันไฟล์ไบนารี Go)
* **AI FastAPI API (Port 8000 - Internal Only):** สตาร์ตด้วย `pm2 start server.py --name "ai-fastapi-api" --interpreter python3`

---

### B. ระบบ OCR Scan Proxy & แก้ปัญหา CORS / Network Error
* **การซ่อนพอร์ต 8000 ไว้ภายใน (Internal Proxy):** เบราว์เซอร์ผู้ใช้จะไม่ยิงไปที่พอร์ต `8000` โดยตรงเพื่อป้องกันปัญหา CORS และ Network Error แต่จะยิงผ่าน Go Backend พอร์ต `8080` แทน
* **การผูกเส้นทาง Proxy บน Go Backend (`bill_route.go`):** ลงทะเบียน `ocrProxyHandler` รองรับทุกเส้นทาง ได้แก่ `/api/ocr/extract-invoice/upload`, `/api/ocr/api/extract-invoice/upload` และ `/ocr/api/extract-invoice/upload` โดย Go จะทำหน้าที่บีบอัดและยิงต่อไปยัง `http://127.0.0.1:8000/api/extract-invoice/upload` ภายในเซิร์ฟเวอร์ พร้อมกำหนด Timeout ไว้ที่ 300 วินาที (5 นาที)
* **ระบบ Dual Fallback บน Frontend (`import_service.ts`):** 
  1. ยิงผ่าน Go Backend Proxy (`apiClient.post('/ocr/extract-invoice/upload')`) เมื่อรันบน Production Server
  2. หากยิงไม่สำเร็จในโหมดพัฒนา Local จะสลับไปยิงผ่าน Vite Dev Proxy (`axios.post('/ocr/api/extract-invoice/upload')`) อัตโนมัติ

---

### C. ระบบถ่ายรูปบิลผ่านมือถือ (Mobile QR Scan) & Supabase Storage
* **การอัปโหลดผ่านมือถือ:** เมื่อผู้ใช้สแกน QR Code บนมือถือ มือถือจะส่งรูปภาพเข้าพอร์ต 8080 ผ่าน API `/api/mobile/upload-image?session=...`
* **การบันทึกภาพสองชั้น (Dual Storage Strategy):**
  1. ระบบจะอัปโหลดรูปขึ้น **Supabase Storage** บักเก็ต `G03-Capstone` และรับ Public URL กลับมา
  2. มีระบบสำรอง (Fallback) บันทึกไฟล์ลงดิสก์เครื่องท้องถิ่นในโฟลเดอร์ `./uploads/mobile-tmp/<session>/`
* **การ Polling บนจอคอมพิวเตอร์:** หน้าสแกนบิลบนคอมพิวเตอร์จะส่ง `GET /api/mobile/images?session=...` ทุกๆ 2 วินาทีเพื่อเช็ครูปภาพ เมื่อพบรูปภาพใหม่ รูปจะเด้งขึ้นหน้าจอพรีวิวฝั่งซ้ายอัตโนมัติทันที

---

### D. ปรับปรุงการคำนวณยอดรวมบิลแบบ Dynamic (Subtotal & Grand Total Fix)
* **แก้ปัญหายอดรวมไม่ตรงรายการ:** แก้ไขใน `scan_view.tsx` และ `manual_entry_view.tsx` โดยปรับการแสดงผล `subtotal` และ `total_amount` ให้คำนวณสดจากรายการสินค้าในตารางแบบ Dynamic (`calcSubtotal` และ `calcTotalAmount`) 
* **สูตรการคำนวณ:** `ยอดรวมสุทธิ = Sum(จำนวน x ราคาต่อหน่วย - ส่วนลด) - ส่วนลดรวมบิล + ภาษี (VAT)`
* ช่วยให้ยอดรวมของบิลตรงกับผลรวมราคาสินค้าทุกรายการในตาราง 100% เสมอ แม้มีการเพิ่ม/ลด/แก้ไขรายการสินค้า

---

### E. การแก้ไข TypeScript Build Errors & Dependencies
* **แก้ไขข้อผิดพลาด TS6133 (Unused Imports):** เคลียร์ `import React` และตัวแปรไม่ได้ใช้ออกใน 6 ไฟล์ ได้แก่ `sales_history.tsx`, `GradeTab.tsx`, `SearchableSelect.tsx`, `stock_check.tsx`, `tree_select.tsx`, และ `ProductDetailModal.tsx` เพื่อให้คำสั่ง `npm run build` (`tsc -b && vite build`) ทำงานผ่าน 100%
* **อัปเดต `requirements.txt` ฝั่ง Python:** เพิ่มการระบุแพ็กเกจ `sqlalchemy`, `psycopg2-binary`, `pillow-heif`, `PyMuPDF`, `scikit-learn`, `python-multipart` ครบถ้วน เพื่อให้ติดตั้งใช้งานได้รวดเร็วด้วย `pip3 install -r requirements.txt`

---

### F. คำสั่งสำหรับการ Rebuild และอัปเดตระบบบน Production Server (Build & Deploy Commands)

#### 1. อัปเดตและบิ้วฝั่ง **Go Backend**:
```bash
cd /var/www/AutoParts-Retail-Management-Web-Application/backend
git stash
git pull
export PATH=$PATH:/usr/local/go/bin
go build -o main main.go
pm2 restart backend-app || pm2 start ./main --name "backend-app" --update-env
```

#### 2. อัปเดตและบิ้วฝั่ง **Frontend (React / Vite)**:
```bash
cd /var/www/AutoParts-Retail-Management-Web-Application/frontend
git stash
git pull
npm run build
pm2 restart frontend-app || pm2 serve dist 3000 --name "frontend-app" --spa
```

#### 3. อัปเดตและบิ้วฝั่ง **Python AI Agent (FastAPI)**:
```bash
cd /var/www/AutoParts-Retail-Management-Web-Application/backend/model
pip3 install -r requirements.txt
# VPS RAM 4GB: บังคับใช้ TF-IDF (ประหยัด ~2GB RAM, boot เร็วขึ้น)
USE_TFIDF_ONLY=1 pm2 restart ai-fastapi-api || USE_TFIDF_ONLY=1 pm2 start server.py --name "ai-fastapi-api" --interpreter python3
```
> **หมายเหตุ:** ถ้า VPS มี RAM ≥ 8GB สามารถเอา `USE_TFIDF_ONLY=1` ออกได้ เพื่อใช้ ONNX embedding ที่แม่นยำกว่า

#### 4. สั่งบันทึกและตรวจสอบสถานะบริการ PM2:
```bash
pm2 save
pm2 status
```

---

## 6. การ Implement MCP (Model Context Protocol) เข้าสู่ระบบ

### MCP คืออะไร?
**MCP (Model Context Protocol)** คือมาตรฐานเปิด (Open Protocol) ที่พัฒนาโดย Anthropic เพื่อเชื่อม AI Model เข้ากับ Tools และ Data Sources ภายนอกแบบมาตรฐาน แทนที่การเขียน function calling เองแบบ ad-hoc เหมือนปัจจุบัน

---

### ✅ ระบบนี้ Implement MCP ได้ไหม?

**ได้ครับ และเหมาะมากด้วย** เพราะระบบใช้ **Gemini API** ซึ่ง Google ประกาศรองรับ MCP อย่างเป็นทางการแล้วใน `google-genai` SDK ตั้งแต่ต้นปี 2025

---

### สถาปัตยกรรมหลังเพิ่ม MCP:

```
[ LINE Chat / Frontend ]
        │
        ▼
[ Go Backend (Port 8080) ]
        │
        ▼ HTTP POST /api/agent
[ FastAPI AI Service (Port 8000) ]
        │
        ▼ Gemini API (Function Calling via MCP)
[ MCP Server (ภายในหรือภายนอก) ]
        ├── Tool: query_stock(product_name)
        ├── Tool: get_customer_debt(customer_id)
        ├── Tool: get_order_history(customer_id, limit)
        ├── Tool: search_product(keyword)
        └── Tool: get_claim_status(claim_no)
        │
        ▼ execute SQL (Read-Only)
[ PostgreSQL Database ]
```

---

### แนวทางที่ Implement ได้ใน Project นี้

#### แนวทางที่ 1: MCP แบบ In-Process (แนะนำสำหรับ VPS ขนาดเล็ก)
ไม่ต้องรัน MCP server แยก — ประกาศ tools ตรงใน `agent.py` ผ่าน Gemini Function Calling API (compatible กับ MCP tool schema):

```python
# agent.py — ตัวอย่าง MCP-compatible tool definitions
tools = [
    {
        "name": "query_stock",
        "description": "ค้นหาจำนวนสต็อกสินค้าในคลังตามชื่อสินค้า",
        "input_schema": {
            "type": "object",
            "properties": {
                "product_name": {"type": "string", "description": "ชื่อสินค้า"}
            },
            "required": ["product_name"]
        }
    },
    {
        "name": "get_customer_debt",
        "description": "ดึงยอดหนี้ค้างชำระของลูกค้า",
        "input_schema": {
            "type": "object",
            "properties": {
                "customer_id": {"type": "integer"}
            },
            "required": ["customer_id"]
        }
    }
]
```

แทนที่โค้ด Text-to-SQL เดิม (ที่ใช้ Gemini generate SQL string ดิบ) ด้วย tool calling loop — ปลอดภัยกว่ามาก (ไม่มี SQL injection)

---

#### แนวทางที่ 2: MCP Server แยก (สำหรับอนาคต / เพิ่ม client ได้)
รัน MCP Server เป็น process แยก ให้ทั้ง agent.py และ tool อื่นๆ เชื่อมเข้ามาได้:

```bash
pip install mcp
```

```python
# mcp_server.py — รัน port 8001 (internal)
from mcp.server.fastmcp import FastMCP
import psycopg2

mcp = FastMCP("AutoParts MCP Server")

@mcp.tool()
def query_stock(product_name: str) -> str:
    """ค้นหาสต็อกสินค้าตามชื่อ"""
    # query DB แล้ว return string
    ...

@mcp.tool()
def get_customer_debt(customer_phone: str) -> str:
    """ดึงยอดหนี้ค้างชำระตามเบอร์โทร"""
    ...

if __name__ == "__main__":
    mcp.run(transport="streamable-http", host="127.0.0.1", port=8001)
```

PM2 start:
```bash
pm2 start mcp_server.py --name "mcp-server" --interpreter python3
```

---

### ข้อดีเมื่อเทียบกับ Text-to-SQL เดิม

| หัวข้อ | Text-to-SQL เดิม | MCP Tool Calling |
|---|---|---|
| ความปลอดภัย | Gemini generate SQL ตรงๆ (risk SQL injection) | Gemini เรียก tool ที่เราเขียนไว้ (safe) |
| ความแม่นยำ | ขึ้นอยู่กับ prompt ว่า SQL ถูกไหม | ตาม schema ที่กำหนดแน่นอน |
| Debug | ดู SQL ที่ generate ยาก | ดู tool call + arguments ได้ชัด |
| เพิ่ม feature | ต้องแก้ prompt | เพิ่ม `@mcp.tool()` function ใหม่ |
| Multi-step query | ทำยาก | Agent เรียก tools หลายรอบเองอัตโนมัติ |

---

### ขั้นตอน Implement (ถ้าจะทำ)

1. `pip install mcp google-genai` (update `requirements.txt`)
2. สร้างไฟล์ `backend/model/mcp_server.py` — ประกาศ tools ตาม DB schema
3. แก้ `backend/model/agent.py` — เปลี่ยนจาก Text-to-SQL เป็น Gemini + MCP tool loop
4. เพิ่ม PM2 process สำหรับ `mcp_server.py` (แนวทางที่ 2) หรือ inline ใน `agent.py` (แนวทางที่ 1)
5. ทดสอบผ่าน LINE Chat หรือ `/api/oa/simulate`

> **สรุป:** MCP เป็น upgrade ที่ทำได้และเหมาะมากกับ project นี้ โดยเฉพาะส่วน AI Agent ที่ปัจจุบัน generate SQL ดิบ — เปลี่ยนเป็น MCP tool calling จะ **ปลอดภัยกว่า แม่นยำกว่า และ maintain ง่ายกว่า** มาก

---

## 7. คู่มือการ Deploy ด้วย Docker และการผูกโดเมน (Docker Production Deployment)

### A. ข้อมูลโครงสร้างพื้นฐาน (Infrastructure Overview)
* **โดเมนหลัก (Frontend):** `jjautopart-pakchong.com` และ `www.jjautopart-pakchong.com` (จัดการผ่าน Hostinger DNS)
* **ซับโดเมน API (Backend):** `api.jjautopart-pakchong.com`
* **คลาวด์เซิร์ฟเวอร์ (Cloud VPS):** Alibaba Cloud ECS (Singapore)
  * **Public IP:** `8.219.93.236`
  * **OS & Specs:** Ubuntu, 2 vCPU, 4GB RAM
  * **พอร์ตที่เปิดใน Security Group:** `80` (HTTP), `443` (HTTPS), `22` (SSH)

---

### B. สถาปัตยกรรม Docker Compose (`docker-compose.yml`)
ระบบถูกจัดให้อยู่ใน Container เพื่อให้บิวด์และดูแลรักษาง่ายในคำสั่งเดียว:
1. **`postgres` (PostgreSQL 15):** จัดเก็บข้อมูลระบบทั้งหมด โดยผูกข้อมูลไว้กับ Docker Volume `postgres_data` (ข้อมูลไม่สูญหายเมื่อรีสตาร์ต)
2. **`backend` (Go Gin API):** รันบนพอร์ต `8080` โดยเชื่อมต่อไปยังฐานข้อมูล `postgres` อัตโนมัติ พร้อมผูก Volume สำหรับเก็บรูปภาพ (`uploads`), บาร์โค้ด (`barcode`), และคิวอาร์โค้ด (`QRCode`)
3. **`frontend` (React + Nginx):** บิวด์ไฟล์ static และรัน Nginx บนพอร์ต `80` ทำหน้าที่เป็นทั้ง Web Server แจกจ่ายหน้าเว็บ และ Reverse Proxy ส่งต่อคำขอ API ไปยัง Go Backend
4. *(หมายเหตุ: บริการ AI on-local `ai-service` ถูกคอมเมนต์ปิดไว้ชั่วคราวเพื่อประหยัด RAM บน VPS 4GB)*

---

### C. ขั้นตอนการนำระบบขึ้นเซิร์ฟเวอร์ครั้งแรก (Initial Deployment)

#### 1. บนเครื่อง Mac (ผู้พัฒนา):
Push โค้ดและไฟล์ตั้งค่า Docker ขึ้น GitHub:
```bash
git checkout -b deploy-docker
git add .
git commit -m "Add Docker deployment setup"
git push -u origin deploy-docker
```

#### 2. บนเครื่องเซิร์ฟเวอร์ (Alibaba Cloud VM ผ่าน SSH):
```bash
# 1. เข้าสู่โฟลเดอร์โปรเจกต์
cd /var/www/AutoParts-Retail-Management-Web-Application

# 2. ปิด service เดิมที่อาจจะรันค้างอยู่ (ป้องกันพอร์ตชนกัน)
sudo systemctl stop nginx 2>/dev/null || true
pm2 stop all 2>/dev/null || true

# 3. ดึงโค้ด Branch ที่มี Docker
git fetch origin
git checkout deploy-docker
git pull origin deploy-docker

# 4. สั่งรันทั้งระบบด้วย Docker Compose
docker compose up -d --build
```

---

### D. ขั้นตอนการอัปเดตเมื่อเพื่อนแก้โค้ดเสร็จ (Update & Redeploy Workflow)

เมื่อเพื่อนร่วมทีมทำการแก้โค้ดเสร็จแล้ว และทำการ Merge รวมโค้ดเข้าสู่ Branch หลักบน GitHub เรียบร้อยแล้ว การนำโค้ดใหม่ขึ้นเซิร์ฟเวอร์มีขั้นตอนเพียง **3 ขั้นตอนสั้นๆ**:

```bash
# 1. เข้าสู่โฟลเดอร์โปรเจกต์บนเซิร์ฟเวอร์
cd /var/www/AutoParts-Retail-Management-Web-Application

# 2. ดึงโค้ดล่าสุดที่เพื่อนแก้ลงมา
git pull

# 3. สั่งให้ Docker บิวด์ใหม่เฉพาะส่วนที่เปลี่ยนแปลง และเริ่มทำงานใหม่อัตโนมัติ
docker compose up -d --build
```

> **จุดเด่นของการใช้ Docker ในขั้นตอนนี้:**
> * **Zero Data Loss:** ข้อมูลใน Database (PostgreSQL) และรูปภาพบิล/อะไหล่ที่อัปโหลดไว้จะไม่สูญหาย 100% เพราะถูกเก็บแยกไว้ใน Docker Volume
> * **Auto-Migrate:** หากมีการเพิ่มโมเดลหรือคอลัมน์ใหม่ใน Go Backend ระบบจะ Migrate ฐานข้อมูลให้อัตโนมัติทันที
> * **Fast Build:** Docker จะใช้ Cache บิวด์ใหม่เฉพาะส่วนของไฟล์ที่มีการแก้ไขเท่านั้น
> * **Pre-built Frontend:** หากมีการแก้โค้ด Frontend ให้รันบิวด์บนเครื่องก่อน (`cd frontend && npx vite build`) แล้ว commit โฟลเดอร์ `dist` ขึ้นมา เซิร์ฟเวอร์จะใช้เวลาบิวด์ Nginx เพียงแค่ 2 วินาที ไม่ต้องลง Node.js หรือเสียเวลารัน npm install บนเซิร์ฟเวอร์ใหม่อีกเลย

---

### E. คำสั่งที่มีประโยชน์ในการตรวจสอบและดูแลระบบ (Useful Docker Commands)

```bash
# ตรวจสอบสถานะว่าคอนเทนเนอร์ไหนรันอยู่บ้าง
docker compose ps

# ดู Log การทำงานของ Backend (ดู Error หรือการเชื่อมต่อ)
docker compose logs -f backend

# ดู Log การทำงานของ Frontend (Nginx)
docker compose logs -f frontend

# ตรวจสอบการใช้งาน RAM และ CPU ของแต่ละคอนเทนเนอร์
docker stats

# สั่ง Restart ทุกบริการ
docker compose restart

# สำรองข้อมูลฐานข้อมูล (Backup Database) ออกมาเป็นไฟล์ .sql
docker exec -t autoparts-postgres pg_dump -U postgres Autopartsdb > backup_$(date +%Y%m%d).sql
```

