import os
import sys
import json
import re
import traceback
from sqlalchemy import create_engine, text
import google.generativeai as genai

# Load environment variables manually
def load_env():
    env_paths = ["backend/.env", ".env", "model/.env", "backend/model/.env", "../.env", "../../.env"]
    for path in env_paths:
        if os.path.exists(path):
            with open(path, "r") as f:
                for line in f:
                    if "=" in line and not line.startswith("#"):
                        parts = line.strip().split("=", 1)
                        if len(parts) == 2:
                            os.environ[parts[0].strip()] = parts[1].strip()
            return True
    return False

load_env()

GEMINI_API_KEY = (os.getenv("GOOGLE_STUDIO") or os.getenv("GEMINI_API_KEY") or "").strip()
GEMINI_MODEL = (os.getenv("GEMINI_MODEL") or "gemini-3.5-flash").strip()
MOCK_MODE = os.getenv("MOCK_LLM", "false").lower() == "true"

_engine = None

def get_engine():
    global _engine
    if _engine is None:
        db_host = os.getenv("DB_HOST", "localhost")
        db_port = os.getenv("DB_PORT", "5432")
        db_user = os.getenv("DB_USER", "postgres")
        db_password = os.getenv("DB_PASSWORD", "1234")
        db_name = os.getenv("DB_NAME", "Autopartsdb")
        url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
        _engine = create_engine(url, pool_size=5, max_overflow=10, pool_pre_ping=True)
    return _engine

# Define schemas for the Text-to-SQL agent
SCHEMA_CONTEXT = """
You are an expert PostgreSQL database analyst for an Auto Parts Retail store.
Based on the user's natural language question, write a read-only PostgreSQL query.
Here are the relevant tables in the public schema:

1. Table: "products"
   - "id": integer (primary key)
   - "product_code": varchar (e.g. SPK-001)
   - "part_number": varchar
   - "product_name": varchar
   - "quantity": integer (current stock count)
   - "sale_price": numeric (unit selling price)
   - "is_active": boolean
   - "brand_id", "unit_id", "category_id", "shelf_id": integer relations

2. Table: "customers"
   - "id": integer (primary key)
   - "customer_name": varchar
   - "phone_number": varchar
   - "credit_limit": numeric
   - "current_debt_amount": numeric

3. Table: "suppliers"
   - "id": integer
   - "supplier_name": varchar
   - "contact_line_sale": varchar

4. Table: "bills" (import records)
   - "id": integer
   - "bill_no": varchar
   - "total_amount": numeric
   - "due_date": timestamp
   - "payment_status": varchar ("paid", "unpaid")
   - "supplier_id": integer

5. Table: "purchase_orders"
   - "id": integer
   - "po_number": varchar
   - "status": varchar ("DRAFT", "APPROVED")
   - "total_amount": numeric

6. Table: "line_users" (LINE followers)
   - "id": integer
   - "line_user_id": varchar (e.g. U1234567890...)
   - "display_name": varchar
   - "customer_id": integer (optional foreign key to "customers")

Guidelines:
- Return ONLY the raw SELECT SQL query.
- Do NOT wrap the query in markdown formatting like ```sql ... ```.
- Make queries safe and read-only.
- If the question cannot be answered by querying the database, return empty string.
"""

def generate_sql(user_query, customer_context=""):
    if MOCK_MODE or not GEMINI_API_KEY:
        # Simple heuristic fallback mock SQL
        q = user_query.lower()
        if "สินค้า" in q or "อะไหล่" in q or "มี" in q:
            return "SELECT product_name, quantity, sale_price FROM products WHERE is_active = true ORDER BY quantity DESC LIMIT 5;"
        return ""

    try:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel(GEMINI_MODEL)
        
        prompt = f"""{SCHEMA_CONTEXT}
        
        Customer context (linked profile info): {customer_context}
        User's question: {user_query}
        
        Generate the read-only PostgreSQL query:"""
        
        response = model.generate_content(prompt)
        sql = response.text.strip()
        # Clean up any generated markdown wrappers
        sql = re.sub(r"```(sql)?", "", sql).strip()
        if sql.upper().startswith("SELECT"):
            return sql
        return ""
    except Exception as e:
        print(f"Error generating SQL: {e}", file=sys.stderr)
        return ""

def execute_query(sql):
    try:
        engine = get_engine()
        with engine.connect() as conn:
            result = conn.execute(text(sql))
            keys = result.keys()
            rows = [dict(zip(keys, row)) for row in result.fetchall()]
            return rows
    except Exception as e:
        print(f"Error executing SQL: {e}", file=sys.stderr)
        return [{"error": str(e)}]

def generate_natural_response(user_query, sql_used, query_results, customer_context=""):
    if MOCK_MODE or not GEMINI_API_KEY:
        # Mock answers
        q = user_query.lower()
        if "สินค้า" in q or "อะไหล่" in q:
            return "📌 รายการสินค้าคงเหลือพร้อมส่ง:\n📦 กรองน้ำมันเครื่อง Toyota Vios\n🔹 จำนวนคงเหลือ: 12 ชิ้น\n💰 ราคา: 150 บาท\n\nสนใจติดต่อสั่งซื้อหรือแจ้งทางแชทนี้ได้เลยค่ะ 😊"
        return "สวัสดีค่ะ ยินดีต้อนรับสู่บริการเช็คอะไหล่รถยนต์ด่วน คุณสามารถพิมพ์สอบถามสถานะสินค้า ราคา หรือยอดเครดิตค้างชำระได้เลยนะคะ"

    try:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel(GEMINI_MODEL)
        
        prompt = f"""You are a helpful customer service AI representative for an Auto Parts Retail store.
        Translate database query results into a polite, professional, and clear Thai response answering the user's question.
        
        Format guidelines for LINE chat bubble compatibility:
        - Do NOT use markdown bold text markers like '**' or '__'.
        - Do NOT use markdown header indicators like '###' or '##'.
        - Use clean structural text headers, for example: [ รายชื่อสินค้าที่พบ ] or 📌 หัวข้อหลัก:
        - Use emojis for bullet points and lists to make it look beautiful (e.g., 🔹, 🔸, 📦, 💰, ✅, 📌, ℹ️).
        - Keep the reply clear, concise, and friendly, utilizing newline breaks (\\n) for spacing.
        
        User's question: {user_query}
        Customer Context: {customer_context}
        SQL Query Used: {sql_used}
        Database Results: {json.dumps(query_results, ensure_ascii=False, default=str)}
        
        Write a beautiful response in Thai:"""
        
        response = model.generate_content(prompt)
        text_res = response.text.strip()
        # Regex safety fallback to remove any lingering markdown asterisks or hash headers
        text_res = re.sub(r"\*\*|__", "", text_res)
        text_res = re.sub(r"###?\s*", "📌 ", text_res)
        return text_res
    except Exception as e:
        # Fallback to simple formatted output
        return f"📌 ข้อมูลการค้นหาที่พบในระบบ:\n{json.dumps(query_results, ensure_ascii=False, default=str)}"

def get_line_user_context(line_user_id):
    if not line_user_id:
        return ""
    try:
        engine = get_engine()
        with engine.connect() as conn:
            query = text("""
                SELECT u.display_name, c.customer_name, c.phone_number, c.credit_limit, c.current_debt_amount
                FROM line_users u
                LEFT JOIN customers c ON u.customer_id = c.id
                WHERE u.line_user_id = :line_user_id
            """)
            res = conn.execute(query, {"line_user_id": line_user_id}).fetchone()
            if res:
                display_name, customer_name, phone_number, credit_limit, debt = res
                return f"LINE Name: {display_name}, Linked Customer Profile: {customer_name or 'None'}, Phone: {phone_number or 'N/A'}, Credit Limit: {credit_limit or 0.0}, Current Debt Balance: {debt or 0.0}"
    except Exception as e:
        print(f"Error fetching line user context: {e}", file=sys.stderr)
    return ""

def run_agent(query_text, line_user_id=None):
    # 1. Fetch customer context from DB if line_user_id is provided
    customer_context = get_line_user_context(line_user_id) if line_user_id else ""
    
    # 2. Generate database SQL query based on question
    sql = generate_sql(query_text, customer_context)
    
    # 3. If SQL is generated, run it on DB
    results = []
    if sql:
        print(f"Generated SQL: {sql}", file=sys.stderr)
        results = execute_query(sql)
        print(f"Query Results: {results}", file=sys.stderr)
    else:
        print("No SQL query required for this conversation turn.", file=sys.stderr)
        results = []

    # 4. Generate natural Thai response from Gemini
    response = generate_natural_response(query_text, sql, results, customer_context)
    return response

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 agent.py <question> [line_user_id]")
        sys.exit(1)
        
    query_text = sys.argv[1]
    line_user_id = sys.argv[2] if len(sys.argv) > 2 else None
    
    answer = run_agent(query_text, line_user_id)
    print(answer)
