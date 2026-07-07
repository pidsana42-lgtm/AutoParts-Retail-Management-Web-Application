# Database Connection Testing Guide

## Overview
สคริปต์นี้ใช้ทดสอบการเชื่อมต่อระหว่าง Python model service กับ PostgreSQL database

## Prerequisites

1. **PostgreSQL** ต้องติดตั้งและรันอยู่
2. **Python 3.8+** และ dependencies ที่จำเป็น
3. **ไฟล์ .env** ที่มีการตั้งค่าฐานข้อมูล

## Setup

### 1. สร้างไฟล์ .env

สร้างไฟล์ `.env` ในโฟลเดอร์ `backend/model/` หรือ `backend/` หรือ root directory:

```bash
# คัดลอกจาก .env.example
cp .env.example .env
```

แก้ไขค่าในไฟล์ `.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_actual_password
DB_NAME=autoparts

MOCK_LLM=true
HF_TOKEN=your_token_here
```

### 2. ติดตั้ง Dependencies

```bash
cd backend/model
pip install -r requirements.txt
```

หรือติดตั้งเฉพาะที่จำเป็นสำหรับการทดสอบ:

```bash
pip install sqlalchemy psycopg2-binary
```

## Running Tests

### วิธีที่ 1: รันจากโฟลเดอร์ backend/model

```bash
cd backend/model
python test_db_connection.py
```

### วิธีที่ 2: รันจาก root directory

```bash
python backend/model/test_db_connection.py
```

## Expected Output

### เมื่อเชื่อมต่อสำเร็จ:

```
============================================================
PostgreSQL Database Connection Test
============================================================

✓ Found .env file at: .env
Database Configuration:
  Host:     localhost
  Port:     5432
  User:     postgres
  Password: ********
  Database: autoparts

📡 Attempting to connect to database...
✓ Successfully connected to database!

Test 1: PostgreSQL Version
  Version: PostgreSQL 15.3

Test 2: List Tables
  Found 45 table(s):
    1. banks
    2. bill_images
    3. bill_import_jobs
    4. bill_items
    5. bills
    ...

Test 3: Check Model-Related Tables
  bills                ✓ Exists
                       └─ 10 row(s)
  bill_items           ✓ Exists
                       └─ 25 row(s)
  bill_images          ✓ Exists
                       └─ 5 row(s)
  suppliers            ✓ Exists
                       └─ 3 row(s)
  products             ✓ Exists
                       └─ 100 row(s)

Test 4: Database Configuration
  Encoding: UTF8
  Timezone: Asia/Bangkok

============================================================
✅ All database tests completed successfully!
============================================================
```

### เมื่อเชื่อมต่อไม่สำเร็จ:

```
============================================================
❌ Database Connection Failed!
============================================================

Error Details:
  (psycopg2.OperationalError) could not connect to server: Connection refused
  Is the server running on host "localhost" and accepting TCP/IP connections on port 5432?

Possible causes:
  1. PostgreSQL server is not running
  2. Wrong host or port
  3. Invalid username or password
  4. Database does not exist
  5. Firewall blocking connection

Please check your .env file and database configuration.
```

## Troubleshooting

### Problem 1: "No module named 'sqlalchemy'"
```bash
pip install sqlalchemy psycopg2-binary
```

### Problem 2: "could not connect to server"
- ตรวจสอบว่า PostgreSQL รันอยู่หรือไม่
  ```bash
  # Windows
  pg_ctl status -D "C:\Program Files\PostgreSQL\15\data"
  
  # หรือเช็คจาก Services
  services.msc
  ```

### Problem 3: "password authentication failed"
- ตรวจสอบ username และ password ในไฟล์ .env
- ลองเชื่อมต่อด้วย psql เพื่อยืนยัน:
  ```bash
  psql -h localhost -U postgres -d autoparts
  ```

### Problem 4: "database does not exist"
- สร้างฐานข้อมูลก่อน:
  ```sql
  CREATE DATABASE autoparts;
  ```

### Problem 5: ".env file not found"
- ตรวจสอบว่าไฟล์ .env อยู่ในตำแหน่งที่ถูกต้อง
- สคริปต์จะค้นหาไฟล์ .env ในลำดับนี้:
  1. `backend/model/.env`
  2. `backend/.env`
  3. `./.env` (root directory)

## Integration with Model Service

เมื่อการทดสอบสำเร็จแล้ว คุณสามารถใช้การเชื่อมต่อฐานข้อมูลใน model service ได้:

```python
from sqlalchemy import create_engine, text

# ใน server.py หรือ main.py
def get_database_engine():
    connection_string = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    return create_engine(connection_string)

# ตัวอย่างการใช้งาน
@app.post("/api/save-bill")
def save_bill_to_db(bill_data: dict):
    engine = get_database_engine()
    with engine.connect() as conn:
        result = conn.execute(text("""
            INSERT INTO bills (bill_no, total_amount, ...)
            VALUES (:bill_no, :total_amount, ...)
        """), bill_data)
        conn.commit()
    return {"status": "success"}
```

## Next Steps

1. ✅ ทดสอบการเชื่อมต่อฐานข้อมูล
2. ⬜ เพิ่ม ORM models (SQLAlchemy) สำหรับ bills, bill_items
3. ⬜ สร้าง API endpoints สำหรับบันทึกข้อมูล OCR ลงฐานข้อมูล
4. ⬜ Integration test กับ Go backend

## Additional Resources

- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [psycopg2 Documentation](https://www.psycopg.org/docs/)
