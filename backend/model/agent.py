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

LIGHTNING_API_KEY = (os.getenv("LIGHTNING_API_KEY") or "").strip()
LIGHTNING_MODEL = "google/gemini-2.5-flash"
GEMINI_API_KEY = (os.getenv("GOOGLE_STUDIO") or os.getenv("GEMINI_API_KEY") or "").strip()
raw_model = (os.getenv("GEMINI_MODEL") or "gemini-2.5-flash").strip()
if "/" in raw_model:
    raw_model = raw_model.split("/")[-1]
GEMINI_MODEL = raw_model
MOCK_MODE = os.getenv("MOCK_LLM", "false").lower() == "true"

_engine = None

def query_llm_text(prompt):
    if LIGHTNING_API_KEY and not MOCK_MODE:
        try:
            import requests
            headers = {
                "Authorization": f"Bearer {LIGHTNING_API_KEY}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": LIGHTNING_MODEL,
                "messages": [{"role": "user", "content": prompt}]
            }
            r = requests.post("https://lightning.ai/api/v1/chat/completions", headers=headers, json=payload, timeout=25)
            r.raise_for_status()
            res_json = r.json()
            return res_json["choices"][0]["message"]["content"].strip()
        except Exception as err:
            print(f"Lightning AI query failed: {err}", file=sys.stderr)
            
    if GEMINI_API_KEY and not MOCK_MODE:
        try:
            genai.configure(api_key=GEMINI_API_KEY)
            model = genai.GenerativeModel(GEMINI_MODEL)
            response = model.generate_content(prompt)
            return response.text.strip()
        except Exception as err:
            print(f"Google Studio Gemini query failed: {err}", file=sys.stderr)
            
    return ""

def get_engine():
    global _engine
    if _engine is None:
        db_host = os.getenv("DB_HOST", "localhost")
        db_port = os.getenv("DB_PORT", "5432")
        db_user = os.getenv("DB_USER", "postgres")
        db_password = os.getenv("DB_PASSWORD", "1234")
        db_name = os.getenv("DB_NAME", "Autopartsdb")
        url = f"postgresql+psycopg2://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
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
    if MOCK_MODE or (not LIGHTNING_API_KEY and not GEMINI_API_KEY):
        return ""

    try:
        prompt = f"""{SCHEMA_CONTEXT}
        
        Customer context (linked profile info): {customer_context}
        User's question: {user_query}
        
        Generate the read-only PostgreSQL query:"""
        
        sql = query_llm_text(prompt)
        sql = re.sub(r"```(sql)?", "", sql).strip()
        if sql.upper().startswith("SELECT"):
            return sql
    except Exception as e:
        print(f"Error generating SQL: {e}", file=sys.stderr)

    keywords = re.findall(r'[A-Za-z0-9]+|[ก-๙]{3,}', user_query)
    stop_words = {"สอบถาม", "ราคา", "ขอเช็ค", "เช็ค", "ครับ", "ค่ะ", "อยากได้", "มีไหม", "มีมั้ย", "เท่าไหร่", "ไหม"}
    words = [w for w in keywords if w not in stop_words]
    if words:
        like_clauses = " OR ".join([f"product_name ILIKE '%{w}%'" for w in words])
        return f"SELECT id, product_code, product_name, sale_price, quantity FROM products WHERE {like_clauses} LIMIT 10;"
    return "SELECT id, product_code, product_name, sale_price, quantity FROM products LIMIT 5;"

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
    if MOCK_MODE or (not LIGHTNING_API_KEY and not GEMINI_API_KEY):
        # Mock answers
        q = user_query.lower()
        if "สินค้า" in q or "อะไหล่" in q:
            return "📌 รายการสินค้าคงเหลือพร้อมส่ง:\n📦 กรองน้ำมันเครื่อง Toyota Vios\n🔹 จำนวนคงเหลือ: 12 ชิ้น\n💰 ราคา: 150 บาท\n\nสนใจติดต่อสั่งซื้อหรือแจ้งทางแชทนี้ได้เลยค่ะ 😊"
        return "สวัสดีค่ะ ยินดีต้อนรับสู่บริการเช็คอะไหล่รถยนต์ด่วน คุณสามารถพิมพ์สอบถามสถานะสินค้า ราคา หรือยอดเครดิตค้างชำระได้เลยนะคะ"

    try:
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
        
        text_res = query_llm_text(prompt)
        if text_res:
            text_res = re.sub(r"\*\*|__", "", text_res)
            text_res = re.sub(r"###?\s*", "📌 ", text_res)
            return text_res
    except Exception as e:
        print(f"Error generating natural response: {e}", file=sys.stderr)

    if query_results and len(query_results) > 0 and "error" not in query_results[0]:
        lines = ["📌 ผลการค้นหาอะไหล่ในระบบ:"]
        for r in query_results:
            name = r.get("product_name") or r.get("name") or "อะไหล่"
            code = r.get("product_code") or ""
            price = r.get("sale_price") or r.get("retail_price") or r.get("price") or 0
            stock = r.get("quantity") or r.get("stock_quantity") or r.get("stock") or 0
            lines.append(f"\n📦 {name} (รหัส: {code})\n💰 ราคา: {price} บาท | 🔹 จำนวนคงเหลือ: {stock} ชิ้น")
        lines.append("\nสนใจสั่งซื้อหรือสอบถามรายละเอียดเพิ่มเติม สามารถแจ้งผ่านแชทนี้ได้เลยครับ! 😊")
        return "\n".join(lines)
    return "สวัสดีครับ ยินดีต้อนรับสู่บริการเช็คอะไหล่รถยนต์ คุณสามารถพิมพ์สอบถามสินค้า ราคา หรือสต็อกสินค้ากับแอดมินได้เลยครับ 😊"

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

# ==============================================================================
# MCP Tools Bridge — ให้ Gemini เรียก tool จาก mcp_server.py ผ่าน Function Calling
# ==============================================================================

def _get_mcp_registry():
    """name -> (callable, function_declaration) ของ tool ที่ปลอดภัยพอจะเปิดผ่าน LINE"""
    import mcp_server
    return {
        "build_dashboard_tool": (
            mcp_server.build_dashboard_tool,
            {
                "name": "build_dashboard_tool",
                "description": (
                    "สร้าง/อัปเดตแดชบอร์ดร้านค้าลง Google Sheets: ตัวเลขสำคัญ "
                    "(สินค้า, สต็อกรวม, ใกล้หมด, พรีออเดอร์ค้าง) พร้อมกราฟ 4 ใบ "
                    "ใช้เมื่อผู้ใช้ขอ 'แดชบอร์ด' 'ภาพรวมร้าน' 'รายงานสรุป'"
                ),
                "parameters": {"type": "OBJECT", "properties": {}},
            },
        ),
        "search_inventory_tool": (
            mcp_server.search_inventory_tool,
            {
                "name": "search_inventory_tool",
                "description": "ค้นหาสินค้า/อะไหล่ในคลัง ตามชื่อสินค้า รหัสสินค้า part number หรือบาร์โค้ด พร้อมบอกจำนวนคงเหลือและราคา",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "query": {"type": "STRING", "description": "ชื่อ/รหัสอะไหล่ที่ต้องการค้นหา"},
                        "limit": {"type": "NUMBER", "description": "จำนวนผลลัพธ์สูงสุด (default 25)"},
                    },
                },
            },
        ),
        "list_catalogs_tool": (
            mcp_server.list_catalogs_tool,
            {
                "name": "list_catalogs_tool",
                "description": "แสดงรายการเล่มแคตตาล็อกอะไหล่ทั้งหมดในระบบ ค้นหาได้ตามชื่อ/รหัส/แบรนด์",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "search": {"type": "STRING", "description": "คำค้นชื่อ/รหัสแคตตาล็อก"},
                        "brand": {"type": "STRING", "description": "ชื่อแบรนด์ หรือ ALL"},
                    },
                },
            },
        ),
        "check_system_diagnostics_tool": (
            mcp_server.check_system_diagnostics_tool,
            {
                "name": "check_system_diagnostics_tool",
                "description": "ตรวจสถานะระบบ: DB, Google Sheets/Drive, Gemini Vision",
                "parameters": {"type": "OBJECT", "properties": {}},
            },
        ),
    }


LINE_STYLE_NOTE = (
    "\n(ตอบเป็นภาษาไทย สไตล์แชท LINE: ไม่ใช้ markdown ** หรือ # หัวข้อ ไม่ต้องล้อม URL ด้วยอะไร "
    "ใช้ emoji นำรายการ เช่น 📌 📈 ✅ สรุปสั้น กระชับ อ่านง่าย)"
)


def run_mcp_tools(query_text, customer_context=""):
    """พยายามตอบด้วย MCP tools ก่อน — ถ้าโมเดลไม่เรียก tool คืนค่า None เพื่อ fallback Text-to-SQL"""
    if MOCK_MODE or (not LIGHTNING_API_KEY and not GEMINI_API_KEY):
        return None
    try:
        if GEMINI_API_KEY:
            genai.configure(api_key=GEMINI_API_KEY)
        registry = _get_mcp_registry()
        declarations = [d for _, d in registry.values()]
        model = genai.GenerativeModel(
            GEMINI_MODEL,
            tools=[{"function_declarations": declarations}],
        )
        system_note = (
            "You are the AI assistant of an auto parts retail shop. "
            f"Caller context: {customer_context or 'unknown LINE user'}. "
            "If one of the available tools can fulfill the user's request, call it. "
            "Otherwise do not force a tool call."
        )
        prompt = f"{system_note}\nUser: {query_text}"
        response = model.generate_content(prompt)

        calls = []
        try:
            for p in response.candidates[0].content.parts:
                fc = getattr(p, "function_call", None)
                if fc is not None and fc.name:
                    calls.append(fc)
        except Exception:
            calls = []
        if not calls:
            return None

        resp_parts = []
        for fc in calls:
            fn = registry.get(fc.name, (None,))[0]
            args = dict(fc.args or {})
            if fn is None:
                out = {"status": "error", "message": f"unknown tool {fc.name}"}
            else:
                try:
                    out = fn(**args)
                except TypeError:
                    out = fn()
            resp_parts.append(genai.protos.Part(
                function_response={
                    "name": fc.name,
                    "response": {"result": json.dumps(out, ensure_ascii=False, default=str)[:6000]},
                }
            ))

        contents = [
            genai.protos.Content(role="user", parts=[genai.protos.Part(text=prompt)]),
            response.candidates[0].content,
            genai.protos.Content(role="user", parts=resp_parts + [genai.protos.Part(text=LINE_STYLE_NOTE)]),
        ]
        final = model.generate_content(contents)
        reply = ""
        try:
            reply = (final.text or "").strip()
        except Exception:
            reply = ""
        if not reply:
            reply = "✅ เรียกใช้งาน " + ", ".join(c.name for c in calls) + " เรียบร้อย"
        return reply
    except Exception as e:
        print(f"MCP tools bridge failed: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return None


def run_agent(query_text, line_user_id=None):
    # 0. Try serving via MCP tools (Gemini Function Calling) — dashboard, inventory, catalogs
    customer_context = get_line_user_context(line_user_id) if line_user_id else ""
    mcp_reply = run_mcp_tools(query_text, customer_context)
    if mcp_reply:
        print("Served via MCP tools.", file=sys.stderr)
        return mcp_reply

    # 1. Fetch customer context from DB if line_user_id is provided
    
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
