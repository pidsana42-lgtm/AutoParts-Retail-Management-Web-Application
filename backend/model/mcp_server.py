#!/usr/bin/env python3
"""
AutoParts Retail Management - Model Context Protocol (MCP) Server
================================================================
This MCP server integrates AI capabilities, Google Workspace basics
(Google Drive, Google Sheets, Google Visual AI / Gemini Vision),
and automotive parts retail workflows for LLM assistants.

Supported Google Integrations:
1. Google Drive: List files, find catalog PDFs, download documents
2. Google Sheets: Read price lists, export catalog & inventory data
3. Google Visual (Gemini Vision): Visual parts inspection & OCR
4. Local Database & AI Matcher Tools: Catalogs, WMS, Invoices, Pre-orders
"""

import os
import sys
import json
import io
import datetime
import traceback
from typing import Optional, List, Dict, Any
import requests
from PIL import Image

# Load environment variables cleanly from .env
try:
    from dotenv import load_dotenv
    current_dir = os.path.dirname(os.path.abspath(__file__))
    possible_env_paths = [
        os.path.join(current_dir, ".env"),
        os.path.join(current_dir, "..", ".env"),
        os.path.join(current_dir, "..", "..", ".env"),
    ]
    for env_p in possible_env_paths:
        if os.path.exists(env_p):
            load_dotenv(env_p, override=False)
except ImportError:
    pass

# Initialize FastMCP Server
try:
    from mcp.server.fastmcp import FastMCP
except ImportError:
    print("Error: 'mcp' package is required. Install via: pip install mcp", file=sys.stderr)
    sys.exit(1)

mcp = FastMCP("AutoParts-Management-MCP")

# Database connection helper
def get_db_connection():
    from sqlalchemy import create_engine
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "5432")
    db_user = os.getenv("DB_USER", "postgres")
    db_password = os.getenv("DB_PASSWORD", "postgres")
    db_name = os.getenv("DB_NAME", "Autopartsdb")
    
    db_url = f"postgresql+psycopg2://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    engine = create_engine(db_url, pool_pre_ping=True)
    return engine

# Google API Credentials Helper
# Resolve service account relative to THIS file so any working directory works.
SERVICE_ACCOUNT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "service_account.json")

def get_google_api_key():
    return os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_STUDIO") or os.getenv("GOOGLE_API_KEY")

def get_google_service_credentials():
    """Attempts to get Google credentials via Service Account or OAuth if available."""
    creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", SERVICE_ACCOUNT_PATH)
    if os.path.exists(creds_path):
        from google.oauth2 import service_account
        return service_account.Credentials.from_service_account_file(
            creds_path,
            scopes=[
                # drive (full) เพื่อให้อัปโหลดไฟล์ไปยังโฟลเดอร์ที่ถูกแชร์ให้บอทได้
                "https://www.googleapis.com/auth/drive",
                "https://www.googleapis.com/auth/spreadsheets"
            ]
        )
    return None

# ==============================================================================
# MCP TOOLS: 1. GOOGLE DRIVE INTEGRATION
# ==============================================================================

@mcp.tool()
def google_drive_list_files(query: str = "", folder_id: str = "", page_size: int = 15) -> Dict[str, Any]:
    """
    Search and list catalog files, PDFs, images, or spreadsheets from Google Drive.

    Args:
        query: Optional search keyword in file name (e.g. 'Isuzu Catalog', 'invoice.pdf').
        folder_id: Optional parent folder ID to search inside.
        page_size: Number of files to return (default: 15).
    """
    try:
        api_key = get_google_api_key()
        creds = get_google_service_credentials()
        
        q_parts = ["trashed = false"]
        if query:
            q_parts.append(f"name contains '{query}'")
        if folder_id:
            q_parts.append(f"'{folder_id}' in parents")
        q_str = " and ".join(q_parts)

        if creds:
            from googleapiclient.discovery import build
            service = build("drive", "v3", credentials=creds)
            results = service.files().list(
                q=q_str,
                pageSize=page_size,
                fields="nextPageToken, files(id, name, mimeType, size, webViewLink, createdTime)"
            ).execute()
            files = results.get("files", [])
            return {"status": "success", "source": "service_account", "count": len(files), "files": files}
        elif api_key:
            # Fallback using Google Drive REST API with API Key (Public/Shared Drive files)
            url = "https://www.googleapis.com/drive/v3/files"
            params = {
                "q": q_str,
                "pageSize": page_size,
                "fields": "files(id, name, mimeType, size, webViewLink)",
                "key": api_key
            }
            res = requests.get(url, params=params, timeout=10)
            if res.status_code == 200:
                data = res.json()
                return {"status": "success", "source": "api_key", "count": len(data.get("files", [])), "files": data.get("files", [])}
            else:
                return {
                    "status": "partial_configuration",
                    "message": "Google Drive requires Service Account (GOOGLE_APPLICATION_CREDENTIALS) or OAuth token for private files.",
                    "api_response": res.text
                }
        else:
            return {"status": "error", "message": "No Google API Key or Service Account credentials found in environment variables."}
    except Exception as e:
        return {"status": "error", "message": str(e), "traceback": traceback.format_exc()}


@mcp.tool()
def google_drive_get_file_info(file_id: str) -> Dict[str, Any]:
    """
    Retrieve metadata and download/preview link for a specific file in Google Drive.

    Args:
        file_id: Google Drive file ID.
    """
    try:
        api_key = get_google_api_key()
        creds = get_google_service_credentials()
        
        if creds:
            from googleapiclient.discovery import build
            service = build("drive", "v3", credentials=creds)
            file_meta = service.files().get(fileId=file_id, fields="id, name, mimeType, size, webViewLink, webContentLink").execute()
            return {"status": "success", "file": file_meta}
        elif api_key:
            url = f"https://www.googleapis.com/drive/v3/files/{file_id}"
            res = requests.get(url, params={"key": api_key, "fields": "id, name, mimeType, size, webViewLink"}, timeout=10)
            if res.status_code == 200:
                return {"status": "success", "file": res.json()}
            return {"status": "error", "message": res.text}
        return {"status": "error", "message": "Google credentials not configured."}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@mcp.tool()
def google_drive_upload_file(file_path: str, folder_name: str = "", description: str = "") -> Dict[str, Any]:
    """
    Upload a local file to Google Drive so it appears in the owner's Drive.

    Args:
        file_path: Local path of the file to upload (e.g. '/tmp/report.xlsx').
        folder_name: Target folder name in Drive (e.g. 'POS', 'Bill-import'). Empty = My Drive root.
        description: Optional file description.
    """
    try:
        creds = get_google_service_credentials()
        if not creds:
            return {"status": "error", "message": "Service account not configured."}
        if not os.path.exists(file_path):
            return {"status": "error", "message": f"ไม่พบไฟล์: {file_path}"}

        from googleapiclient.discovery import build
        from googleapiclient.http import MediaFileUpload

        service = build("drive", "v3", credentials=creds)

        metadata: Dict[str, Any] = {"name": os.path.basename(file_path)}
        if description:
            metadata["description"] = description

        if folder_name:
            q = f"name = '{folder_name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
            found = service.files().list(q=q, pageSize=1, fields="files(id, name)").execute().get("files", [])
            if not found:
                return {"status": "error", "message": f"ไม่พบโฟลเดอร์ชื่อ '{folder_name}' ใน Drive (ต้องแชร์โฟลเดอร์ให้บอทก่อน)"}
            metadata["parents"] = [found[0]["id"]]

        mime_map = {
            ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".xls": "application/vnd.ms-excel",
            ".csv": "text/csv",
            ".pdf": "application/pdf",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".txt": "text/plain",
            ".json": "application/json",
        }
        ext = os.path.splitext(file_path)[1].lower()
        media = MediaFileUpload(file_path, mimetype=mime_map.get(ext, "application/octet-stream"), resumable=False)

        created = service.files().create(body=metadata, media_body=media, fields="id, name, webViewLink, size").execute()
        return {
            "status": "success",
            "message": f"อัปโหลด '{created.get('name')}' ขึ้น Google Drive เรียบร้อย",
            "file": created,
        }
    except Exception as e:
        return {"status": "error", "message": str(e), "traceback": traceback.format_exc()}


# ==============================================================================
# MCP TOOLS: 2. GOOGLE SHEETS INTEGRATION
# ==============================================================================

@mcp.tool()
def google_sheets_read_data(spreadsheet_id: str, range_name: str = "A1:Z50") -> Dict[str, Any]:
    """
    Read tabular data (such as parts lists, pricing, supplier inventory) from a Google Sheet.

    Args:
        spreadsheet_id: The ID of the Google Spreadsheet (from the URL).
        range_name: The A1 notation range to read (e.g. 'Sheet1!A1:H30').
    """
    try:
        api_key = get_google_api_key()
        creds = get_google_service_credentials()

        if creds:
            from googleapiclient.discovery import build
            service = build("sheets", "v4", credentials=creds)
            sheet = service.spreadsheets()
            result = sheet.values().get(spreadsheetId=spreadsheet_id, range=range_name).execute()
            values = result.get("values", [])
            return {"status": "success", "rows_count": len(values), "data": values}
        elif api_key:
            url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/{range_name}"
            res = requests.get(url, params={"key": api_key}, timeout=10)
            if res.status_code == 200:
                data = res.json()
                values = data.get("values", [])
                return {"status": "success", "rows_count": len(values), "data": values}
            return {"status": "error", "message": f"Failed to read sheet: {res.text}"}
        return {"status": "error", "message": "Google credentials not configured."}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@mcp.tool()
def google_sheets_export_catalog(spreadsheet_id: str, range_name: str, catalog_id: int) -> Dict[str, Any]:
    """
    Export all extracted parts from a database catalog into a Google Spreadsheet.

    Args:
        spreadsheet_id: The ID of the target Google Spreadsheet.
        range_name: Target sheet range (e.g. 'Sheet1!A1').
        catalog_id: The ID of the catalog to export from PostgreSQL.
    """
    try:
        from sqlalchemy import text
        engine = get_db_connection()
        with engine.connect() as conn:
            sql = """
                SELECT c.catalog_code, c.catalog_name, c.brand, ci.part_number, 
                       ci.part_name, ci.compatible_cars, ci.standard_price, ci.unit, ci.remark
                FROM catalogs c
                JOIN catalog_items ci ON c.id = ci.catalog_id
                WHERE c.id = :cat_id AND ci.deleted_at IS NULL
                ORDER BY ci.id ASC
            """
            rows = conn.execute(text(sql), {"cat_id": catalog_id}).fetchall()
            if not rows:
                return {"status": "error", "message": f"No items found for catalog ID {catalog_id}"}

            header = ["Catalog Code", "Catalog Name", "Brand", "Part Number", "Part Name", "Compatible Cars", "Price", "Unit", "Remark"]
            values = [header]
            for r in rows:
                values.append([r.catalog_code, r.catalog_name, r.brand, r.part_number, r.part_name, r.compatible_cars or "", float(r.standard_price), r.unit, r.remark or ""])

        creds = get_google_service_credentials()
        if creds:
            from googleapiclient.discovery import build
            service = build("sheets", "v4", credentials=creds)
            body = {"values": values}
            result = service.spreadsheets().values().update(
                spreadsheetId=spreadsheet_id, range=range_name,
                valueInputOption="USER_ENTERED", body=body
            ).execute()
            return {"status": "success", "updated_cells": result.get("updatedCells"), "items_exported": len(rows)}
        else:
            return {
                "status": "ready_payload",
                "message": "Service account required for writing to Sheets. Formatted table ready for export:",
                "total_rows": len(values),
                "preview": values[:5]
            }
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ==============================================================================
# MCP TOOLS: 3. GOOGLE VISUALIZATION & CHARTS (กราฟและแดชบอร์ด)
# ==============================================================================

@mcp.tool()
def google_charts_generate_report(report_type: str = "brand_stock", chart_type: str = "bar") -> Dict[str, Any]:
    """
    Generate Google Visualization (Google Charts) and chart images for AutoParts analytics.
    Completely FREE to use without any API key or billing required.

    Args:
        report_type: 'brand_stock' (Stock by brand), 'category_stock' (Stock by category), 
                     'pre_orders_status' (Pre-order status), or 'catalogs_summary'.
        chart_type: 'bar' (Bar/Column chart), 'pie' (Donut/Pie chart), or 'line' (Line chart).
    """
    try:
        from sqlalchemy import text
        engine = get_db_connection()
        data_table = []
        title = ""

        with engine.connect() as conn:
            if report_type == "brand_stock":
                title = "รายงานจำนวนสินค้าในแคตตาล็อกจำแนกตามแบรนด์ (Catalog Items by Brand)"
                sql = """
                    SELECT c.brand, COUNT(ci.id) as total_items 
                    FROM catalogs c 
                    LEFT JOIN catalog_items ci ON c.id = ci.catalog_id AND ci.deleted_at IS NULL
                    WHERE c.deleted_at IS NULL 
                    GROUP BY c.brand 
                    ORDER BY total_items DESC LIMIT 10
                """
                rows = conn.execute(text(sql)).fetchall()
                data_table = [["Brand", "Total Items"]] + [[r.brand or "Unknown", int(r.total_items or 0)] for r in rows]
                
            elif report_type == "category_stock":
                title = "รายงานจำนวนสินค้าคงคลังจำแนกตามหมวดหมู่ (Stock by Category)"
                sql = """
                    SELECT COALESCE(cat.category_name, 'ทั่วไป') as cat_name, SUM(p.quantity) as total_qty 
                    FROM products p 
                    LEFT JOIN categories cat ON p.category_id = cat.id 
                    WHERE p.deleted_at IS NULL 
                    GROUP BY cat.category_name 
                    ORDER BY total_qty DESC LIMIT 10
                """
                rows = conn.execute(text(sql)).fetchall()
                data_table = [["Category", "Stock Quantity"]] + [[r.cat_name, int(r.total_qty or 0)] for r in rows]

            elif report_type == "pre_orders_status":
                title = "รายงานสัดส่วนสถานะรายการสั่งจองสินค้า (Pre-Orders by Status)"
                sql = "SELECT status, COUNT(id) as count_orders FROM pre_orders WHERE deleted_at IS NULL GROUP BY status"
                rows = conn.execute(text(sql)).fetchall()
                data_table = [["Status", "Orders Count"]] + [[r.status or "PENDING", int(r.count_orders)] for r in rows]

            else:
                title = "รายงานจำนวนรายการอะไหล่ในแต่ละเล่มแคตตาล็อก"
                sql = """
                    SELECT c.catalog_name, COUNT(ci.id) as item_count 
                    FROM catalogs c 
                    LEFT JOIN catalog_items ci ON c.id = ci.catalog_id AND ci.deleted_at IS NULL
                    WHERE c.deleted_at IS NULL 
                    GROUP BY c.id, c.catalog_name 
                    ORDER BY item_count DESC LIMIT 8
                """
                rows = conn.execute(text(sql)).fetchall()
                data_table = [["Catalog Name", "Items Count"]] + [[r.catalog_name, int(r.item_count)] for r in rows]

        # Generate Google Charts JavaScript embed configuration
        google_chart_js = f"""
        google.charts.load('current', {{'packages':['corechart']}});
        google.charts.setOnLoadCallback(drawChart);
        function drawChart() {{
            var data = google.visualization.arrayToDataTable({json.dumps(data_table)});
            var options = {{
                title: '{title}',
                chartArea: {{width: '70%', height: '75%'}},
                colors: ['#e51c23', '#1C1B1B', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'],
                is3D: true
            }};
            var chart = new google.visualization.{'PieChart' if chart_type == 'pie' else 'ColumnChart' if chart_type == 'bar' else 'LineChart'}(document.getElementById('chart_div'));
            chart.draw(data, options);
        }}
        """

        # Generate direct QuickChart static image URL for instant markdown rendering
        labels = [row[0] for row in data_table[1:]]
        values = [row[1] for row in data_table[1:]]
        qc_type = "doughnut" if chart_type == "pie" else "bar" if chart_type == "bar" else "line"
        
        chart_config = {
            "type": qc_type,
            "data": {
                "labels": labels,
                "datasets": [{
                    "label": data_table[0][1],
                    "data": values,
                    "backgroundColor": ["#e51c23", "#1C1B1B", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#64748B", "#EC4899"]
                }]
            },
            "options": {
                "title": {"display": True, "text": title}
            }
        }
        chart_image_url = f"https://quickchart.io/chart?c={requests.utils.quote(json.dumps(chart_config))}&w=600&h=350&bkg=white"

        return {
            "status": "success",
            "title": title,
            "report_type": report_type,
            "chart_type": chart_type,
            "data": data_table,
            "google_visualization_code": google_chart_js,
            "chart_image_url": chart_image_url,
            "is_free": True
        }
    except Exception as e:
        return {"status": "error", "message": str(e), "traceback": traceback.format_exc()}


@mcp.tool()
def build_dashboard_tool(spreadsheet_id: str = "") -> Dict[str, Any]:
    """
    สร้างแดชบอร์ดสรุปร้านค้าลง Google Sheets: ตัวเลขสำคัญ (สต็อก, ใกล้หมด, พรีออเดอร์)
    + กราฟ 4 ใบฝังในชีต + ตารางข้อมูลดิบ — เขียนลงแท็บ 'Dashboard' ของไฟล์ที่ระบุ
    ถ้าไม่ระบุ spreadsheet_id จะค้นหาไฟล์ชื่อ 'ผู้ช่วย AI' ใน Drive อัตโนมัติ
    """
    try:
        creds = get_google_service_credentials()
        if not creds:
            return {"status": "error", "message": "Service account not configured."}
        from googleapiclient.discovery import build
        from decimal import Decimal

        drive = build("drive", "v3", credentials=creds)
        sid = spreadsheet_id
        if not sid:
            found = drive.files().list(
                q="name contains 'ผู้ช่วย AI' and trashed = false",
                pageSize=1, fields="files(id, name)"
            ).execute().get("files", [])
            if not found:
                return {"status": "error", "message": "ไม่พบไฟล์ 'ผู้ช่วย AI' — ระบุ spreadsheet_id หรือแชร์ไฟล์ให้บอทก่อน"}
            sid = found[0]["id"]

        # 1) รายงาน 4 แบบ
        reports = {}
        for rt in ["brand_stock", "category_stock", "pre_orders_status", "catalogs_summary"]:
            ct = "pie" if rt == "pre_orders_status" else "bar"
            r = google_charts_generate_report(report_type=rt, chart_type=ct)
            if r.get("status") != "success":
                return {"status": "error", "message": f"รายงาน {rt} ล้มเหลว: {r.get('message')}"}
            reports[rt] = r

        # 2) ตัวเลขสำคัญ
        from sqlalchemy import text
        engine = get_db_connection()
        with engine.connect() as conn:
            q = lambda s: conn.execute(text(s)).scalar()
            total_products = q("SELECT COUNT(*) FROM products WHERE deleted_at IS NULL")
            total_qty = q("SELECT COALESCE(SUM(quantity),0) FROM products WHERE deleted_at IS NULL")
            low_stock = q("SELECT COUNT(*) FROM products WHERE deleted_at IS NULL AND quantity <= limit_quantity")
            total_catalogs = q("SELECT COUNT(*) FROM catalogs WHERE deleted_at IS NULL")
            po_pending = q("SELECT COUNT(*) FROM pre_orders WHERE deleted_at IS NULL AND status = 'PENDING'")

        now = datetime.datetime.now().strftime("%d/%m/%Y %H:%M")

        # 3) เตรียมแท็บ Dashboard + แท็บข้อมูลกราฟ (ซ่อน)
        sheets = build("sheets", "v4", credentials=creds)
        meta = sheets.spreadsheets().get(spreadsheetId=sid).execute()
        sheet_ids = {s["properties"]["title"]: s["properties"]["sheetId"] for s in meta["sheets"]}
        TAB = "Dashboard"
        DATA_TAB = "_chart_data"
        add_reqs = []
        if TAB not in sheet_ids:
            add_reqs.append({"addSheet": {"properties": {"title": TAB}}})
        if DATA_TAB not in sheet_ids:
            add_reqs.append({"addSheet": {"properties": {"title": DATA_TAB}}})
        if add_reqs:
            sheets.spreadsheets().batchUpdate(spreadsheetId=sid, body={"requests": add_reqs}).execute()
            meta = sheets.spreadsheets().get(spreadsheetId=sid).execute()
            sheet_ids = {s["properties"]["title"]: s["properties"]["sheetId"] for s in meta["sheets"]}
        dash_id = sheet_ids[TAB]
        data_id = sheet_ids[DATA_TAB]

        # 4) เรียง layout
        rows = [[] for _ in range(120)]
        def put(r, c, v):
            if isinstance(v, Decimal):
                v = float(v)
            if v is None:
                v = ""
            row = rows[r - 1]
            while len(row) < c:
                row.append("")
            row[c - 1] = v

        put(1, 1, "📊 DASHBOARD ร้านอะไหล่ — โดยผู้ช่วย AI")
        put(2, 1, f"อัปเดตล่าสุด: {now}")
        put(4, 1, "📌 ตัวเลขสำคัญ")
        put(5, 1, "สินค้าในระบบ"); put(5, 2, total_products)
        put(5, 4, "ชิ้นรวมในสต็อก"); put(5, 5, total_qty)
        put(5, 7, "⚠️ ใกล้หมดสต็อก"); put(5, 8, low_stock)
        put(6, 1, "เล่มแคตตาล็อก"); put(6, 2, total_catalogs)
        put(6, 4, "พรีออเดอร์รอดำเนินการ"); put(6, 5, po_pending)
        put(8, 1, "📈 กราฟสรุป")

        r = 43
        put(r, 1, "📋 ตารางข้อมูลดิบ"); r += 2
        for key, label in [("brand_stock", "แบรนด์"), ("category_stock", "หมวดหมู่"),
                           ("pre_orders_status", "สถานะพรีออเดอร์"), ("catalogs_summary", "แคตตาล็อก")]:
            put(r, 1, f"— {label} —"); r += 1
            for row in reports[key]["data"]:
                for ci, v in enumerate(row):
                    put(r, 1 + ci, v)
                r += 1
            r += 1

        max_len = max(len(x) for x in rows)
        grid = [row + [""] * (max_len - len(row)) for row in rows]
        sheets.spreadsheets().values().update(
            spreadsheetId=sid, range=f"{TAB}!A1",
            valueInputOption="USER_ENTERED",
            body={"values": grid}
        ).execute()

        # 5) ข้อมูลดิบของกราฟ -> แท็บ _chart_data (block ละ 30 แถว)
        ROW_STRIDE = 30
        blocks = [
            ("brand_stock", reports["brand_stock"]["data"]),
            ("category_stock", reports["category_stock"]["data"]),
            ("pre_orders_status", reports["pre_orders_status"]["data"]),
            ("catalogs_summary", reports["catalogs_summary"]["data"]),
        ]
        data_values = [[""] * 2 for _ in range(ROW_STRIDE * len(blocks))]
        ranges = {}
        for i, (name, tbl) in enumerate(blocks):
            base = i * ROW_STRIDE
            for ri, rowv in enumerate(tbl):
                for ci, v in enumerate(rowv[:2]):
                    if isinstance(v, Decimal):
                        v = float(v)
                    data_values[base + ri][ci] = v
            ranges[name] = {
                "startRowIndex": base,
                "endRowIndex": base + len(tbl),
                "startColumnIndex": 0,
                "endColumnIndex": 2,
            }
        sheets.spreadsheets().values().update(
            spreadsheetId=sid, range=f"{DATA_TAB}!A1",
            valueInputOption="RAW",
            body={"values": data_values}
        ).execute()

        # 6) กราฟ native ของ Sheets (ลบของเก่าก่อน กันซ้อนทับ)
        dash_meta = next(s for s in meta["sheets"] if s["properties"]["title"] == TAB)
        requests_ = [{"deleteEmbeddedObject": {"objectId": c["chartId"]}} for c in dash_meta.get("charts", [])]

        def chart_req(title, name, ctype, anchor_row, anchor_col):
            rng = ranges[name]
            def src(col):
                return {"sheetId": data_id, **{k: rng[k] for k in
                        ("startRowIndex", "endRowIndex")}, "startColumnIndex": col, "endColumnIndex": col + 1}
            if ctype == "pie":
                spec = {
                    "title": title,
                    "pieChart": {
                        "legendPosition": "RIGHT_LEGEND",
                        "domain": {"sourceRange": {"sources": [src(0)]}},
                        "series": {"sourceRange": {"sources": [src(1)]}},
                    },
                }
            else:
                spec = {
                    "title": title,
                    "basicChart": {
                        "chartType": "COLUMN",
                        "legendPosition": "BOTTOM_LEGEND",
                        "domains": [{"domain": {"sourceRange": {"sources": [src(0)]}}}],
                        "series": [{"series": {"sourceRange": {"sources": [src(1)]}}}],
                        "headerCount": 1,
                    },
                }
            return {"addChart": {"chart": {
                "spec": spec,
                "position": {"overlayPosition": {
                    "anchorCell": {"sheetId": dash_id, "rowIndex": anchor_row, "columnIndex": anchor_col},
                    "offsetXPixels": 10,
                    "offsetYPixels": 10,
                    "widthPixels": 600,
                    "heightPixels": 330,
                }},
            }}}

        chart_layout = [
            ("brand_stock", "bar", 8, 11),
            ("category_stock", "bar", 8, 1),
            ("pre_orders_status", "pie", 25, 1),
            ("catalogs_summary", "bar", 25, 11),
        ]
        for name, ctype, ar, ac in chart_layout:
            requests_.append(chart_req(reports[name]["title"], name, ctype, ar, ac))
        requests_.append({
            "updateSheetProperties": {
                "properties": {"sheetId": data_id, "hidden": True},
                "fields": "hidden",
            }
        })
        sheets.spreadsheets().batchUpdate(spreadsheetId=sid, body={"requests": requests_}).execute()
        chart_count = len(chart_layout)

        return {
            "status": "success",
            "message": f"สร้างแดชบอร์ดเรียบร้อย — สินค้า {total_products} | ชิ้นรวม {total_qty} | ใกล้หมด {low_stock} | PO ค้าง {po_pending}",
            "spreadsheet_id": sid,
            "sheet_url": f"https://docs.google.com/spreadsheets/d/{sid}/edit",
            "charts_created": chart_count,
            "updated_at": now,
        }
    except Exception as e:
        return {"status": "error", "message": str(e), "traceback": traceback.format_exc()}


# ==============================================================================
# MCP TOOLS: 3. GOOGLE VISUAL & GEMINI VISION AI
# ==============================================================================

@mcp.tool()
def google_visual_inspect_part(image_path: str, prompt: str = "") -> Dict[str, Any]:
    """
    Perform AI visual inspection of an automotive spare part (filter, brake pad, spark plug)
    using Google Gemini 3.5 Flash Visual AI.

    Args:
        image_path: Path to the part photo.
        prompt: Optional specific inspection prompt (e.g. 'Identify part type and condition').
    """
    try:
        import google.generativeai as genai
        api_key = get_google_api_key()
        if not api_key:
            return {"status": "error", "message": "Google Gemini API key not found."}

        genai.configure(api_key=api_key)
        
        if not os.path.exists(image_path):
            return {"status": "error", "message": f"Image file not found: {image_path}"}

        img = Image.open(image_path).convert("RGB")
        model = genai.GenerativeModel("gemini-3.5-flash")

        default_prompt = (
            "You are an automotive parts expert. Inspect this automotive part photo. "
            "Identify: 1) Part Category & Type, 2) Brand/Stamped Markings, 3) Estimated Vehicle Compatibility, "
            "4) Physical Condition and Dimensions. Respond in clear Thai and English."
        )
        final_prompt = prompt if prompt else default_prompt

        response = model.generate_content([final_prompt, img])
        return {
            "status": "success",
            "model": "gemini-3.5-flash",
            "analysis": response.text
        }
    except Exception as e:
        return {"status": "error", "message": str(e), "traceback": traceback.format_exc()}


@mcp.tool()
def google_visual_ocr_document(image_path: str) -> Dict[str, Any]:
    """
    Run high-accuracy Google Visual OCR on invoices, bill receipts, or catalog pages.

    Args:
        image_path: Path to the document image or PDF page.
    """
    try:
        import google.generativeai as genai
        api_key = get_google_api_key()
        if not api_key:
            return {"status": "error", "message": "Google Gemini API key not found."}

        genai.configure(api_key=api_key)
        if not os.path.exists(image_path):
            return {"status": "error", "message": f"File not found: {image_path}"}

        img = Image.open(image_path).convert("RGB")
        model = genai.GenerativeModel("gemini-3.5-flash")
        
        prompt = "Perform accurate OCR on this document. Extract all text, numbers, tables, and headers verbatim."
        response = model.generate_content([prompt, img])
        return {"status": "success", "extracted_text": response.text}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ==============================================================================
# MCP TOOLS: 4. CORE CATALOG, WMS & STORE TOOLS
# ==============================================================================

@mcp.tool()
def extract_catalog_from_image_tool(image_path: str, crop_thumbnails: bool = True) -> Dict[str, Any]:
    """
    Extract automotive parts product information from a Thai automotive catalog page image using Gemini 3.5 Flash.
    Returns structured JSON with S.T. NO, PART NO, Thai car models, dimensions, 2D bounding boxes, and cropped thumbnails.
    """
    try:
        from catalog_extractor import extract_catalog_from_image
        if not os.path.isabs(image_path):
            image_path = os.path.abspath(image_path)
            
        if not os.path.exists(image_path):
            return {"status": "error", "message": f"Image file not found: {image_path}"}

        items = extract_catalog_from_image(image_path, crop_thumbnails=crop_thumbnails)
        return {
            "status": "success",
            "image_path": image_path,
            "total_items": len(items),
            "items": items
        }
    except Exception as e:
        return {"status": "error", "message": str(e), "traceback": traceback.format_exc()}


@mcp.tool()
def list_catalogs_tool(search: str = "", brand: str = "") -> Dict[str, Any]:
    """List all catalog books and their items stored in PostgreSQL."""
    try:
        from sqlalchemy import text
        engine = get_db_connection()
        with engine.connect() as conn:
            query_str = """
                SELECT c.id, c.catalog_code, c.catalog_name, c.brand, c.category, c.supplier_id, 
                       s.supplier_name, c.description, c.cover_image, c.catalog_file, c.is_active,
                       COUNT(ci.id) as item_count
                FROM catalogs c
                LEFT JOIN suppliers s ON c.supplier_id = s.id
                LEFT JOIN catalog_items ci ON c.id = ci.catalog_id AND ci.deleted_at IS NULL
                WHERE c.deleted_at IS NULL
            """
            params = {}
            if search:
                query_str += " AND (c.catalog_code ILIKE :search OR c.catalog_name ILIKE :search OR c.brand ILIKE :search)"
                params["search"] = f"%{search}%"
            if brand and brand != "ALL":
                query_str += " AND c.brand = :brand"
                params["brand"] = brand

            query_str += " GROUP BY c.id, s.supplier_name ORDER BY c.id DESC"
            rows = conn.execute(text(query_str), params).fetchall()
            
            result = []
            for r in rows:
                result.append({
                    "id": r.id,
                    "catalog_code": r.catalog_code,
                    "catalog_name": r.catalog_name,
                    "brand": r.brand,
                    "category": r.category,
                    "supplier_id": r.supplier_id,
                    "supplier_name": r.supplier_name,
                    "description": r.description,
                    "cover_image": r.cover_image,
                    "catalog_file": r.catalog_file,
                    "is_active": r.is_active,
                    "item_count": r.item_count
                })
            return {"status": "success", "total": len(result), "catalogs": result}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@mcp.tool()
def search_inventory_tool(query: str = "", limit: int = 25) -> Dict[str, Any]:
    """Search warehouse inventory for products by name, product code, part number, or barcode."""
    try:
        from sqlalchemy import text
        engine = get_db_connection()
        with engine.connect() as conn:
            sql = """
                SELECT p.id, p.product_code, p.part_number, p.product_name, p.barcode,
                       p.quantity, p.limit_quantity, p.cost_price, p.sale_price, p.is_active
                FROM products p
                WHERE p.deleted_at IS NULL
            """
            params = {"limit": limit}
            if query:
                sql += """ AND (p.product_code ILIKE :q OR p.product_name ILIKE :q
                           OR p.part_number ILIKE :q OR p.barcode ILIKE :q)"""
                params["q"] = f"%{query}%"
            sql += " ORDER BY p.id ASC LIMIT :limit"

            rows = conn.execute(text(sql), params).fetchall()
            products = [dict(r._mapping) for r in rows]
            return {"status": "success", "count": len(products), "products": products}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ==============================================================================
# LINE OA Tools — ลูกค้าที่ติดต่อผ่าน LINE Official Account
# ==============================================================================

def get_line_channel_token():
    return os.getenv("LINE_CHANNEL_ACCESS_TOKEN", "")


@mcp.tool()
def line_list_customers(limit: int = 25) -> Dict[str, Any]:
    """List customers who contacted via LINE OA — display name, linked customer, unread messages, last message time."""
    try:
        from sqlalchemy import text
        engine = get_db_connection()
        with engine.connect() as conn:
            sql = """
                SELECT lu.line_user_id, lu.display_name, lu.customer_id,
                       c.customer_name, c.phone_number,
                       (SELECT COUNT(*) FROM line_messages lm
                        WHERE lm.line_user_id = lu.line_user_id AND lm.sender = 'user' AND lm.is_read = false) AS unread_count,
                       (SELECT MAX(lm.created_at) FROM line_messages lm
                        WHERE lm.line_user_id = lu.line_user_id) AS last_message_at
                FROM line_users lu
                LEFT JOIN customers c ON c.id = lu.customer_id
                WHERE lu.deleted_at IS NULL
                ORDER BY last_message_at DESC NULLS LAST
                LIMIT :limit
            """
            rows = conn.execute(text(sql), {"limit": limit}).fetchall()
            customers = [dict(r._mapping) for r in rows]
            return {"status": "success", "count": len(customers), "customers": customers}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@mcp.tool()
def line_get_chat_history(line_user_id: str, limit: int = 30) -> Dict[str, Any]:
    """Read recent chat history with a LINE customer (returned oldest → newest)."""
    try:
        from sqlalchemy import text
        engine = get_db_connection()
        with engine.connect() as conn:
            sql = """
                SELECT sender, message_type, message_content, is_read, created_at
                FROM line_messages
                WHERE line_user_id = :lid AND deleted_at IS NULL
                ORDER BY created_at DESC
                LIMIT :limit
            """
            rows = conn.execute(text(sql), {"lid": line_user_id, "limit": limit}).fetchall()
            messages = [dict(r._mapping) for r in rows][::-1]  # oldest → newest
            return {"status": "success", "count": len(messages), "messages": messages}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@mcp.tool()
def line_send_message(line_user_id: str, text: str) -> Dict[str, Any]:
    """Send a REAL LINE push message to a customer. Only use when the owner explicitly asks to send a message."""
    try:
        token = get_line_channel_token()
        if not token:
            return {"status": "error", "message": "LINE_CHANNEL_ACCESS_TOKEN not configured"}
        import requests as http
        resp = http.post(
            "https://api.line.me/v2/bot/message/push",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={
                "to": line_user_id,
                "messages": [{"type": "text", "text": text}],
            },
            timeout=15,
        )
        if resp.status_code == 200:
            return {"status": "success", "message": "ส่งข้อความ LINE เรียบร้อยแล้ว"}
        return {"status": "error", "message": f"LINE API error {resp.status_code}: {resp.text[:200]}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@mcp.tool()
def check_system_diagnostics_tool() -> Dict[str, Any]:
    """Diagnostics across Google Workspace APIs, Gemini Vision, DB, and OCR engines."""
    try:
        from sqlalchemy import text
        engine = get_db_connection()
        db_ok = False
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            db_ok = True
    except Exception:
        db_ok = False

    gemini_key = bool(get_google_api_key())
    service_acc = os.path.exists(os.getenv("GOOGLE_APPLICATION_CREDENTIALS", SERVICE_ACCOUNT_PATH))

    return {
        "status": "healthy" if db_ok and gemini_key else "degraded",
        "database_connected": db_ok,
        "google_gemini_vision_active": gemini_key,
        "google_service_account_configured": service_acc,
        "google_drive_enabled": gemini_key or service_acc,
        "google_sheets_enabled": gemini_key or service_acc,
        "primary_catalog_model": "gemini-3.5-flash",
        "mcp_version": "1.1.0"
    }


if __name__ == "__main__":
    print("AutoParts Management & Google Workspace MCP Server running on stdio...", file=sys.stderr)
    mcp.run(transport="stdio")
