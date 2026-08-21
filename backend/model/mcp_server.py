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
    
    db_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    engine = create_engine(db_url, pool_pre_ping=True)
    return engine

# Google API Credentials Helper
def get_google_api_key():
    return os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_STUDIO") or os.getenv("GOOGLE_API_KEY")

def get_google_service_credentials():
    """Attempts to get Google credentials via Service Account or OAuth if available."""
    creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "service_account.json")
    if os.path.exists(creds_path):
        from google.oauth2 import service_account
        return service_account.Credentials.from_service_account_file(
            creds_path,
            scopes=[
                "https://www.googleapis.com/auth/drive.readonly",
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
    """Search warehouse inventory for products by name, product code, barcode, brand, or category."""
    try:
        from sqlalchemy import text
        engine = get_db_connection()
        with engine.connect() as conn:
            sql = """
                SELECT p.id, p.product_code, p.product_name, p.brand, p.category, 
                       p.quantity, p.min_quantity, p.cost_price, p.retail_price,
                       p.location_zone, p.unit
                FROM products p
                WHERE p.deleted_at IS NULL
            """
            params = {"limit": limit}
            if query:
                sql += " AND (p.product_code ILIKE :q OR p.product_name ILIKE :q OR p.brand ILIKE :q)"
                params["q"] = f"%{query}%"
            sql += " ORDER BY p.id ASC LIMIT :limit"

            rows = conn.execute(text(sql), params).fetchall()
            products = [dict(r._mapping) for r in rows]
            return {"status": "success", "count": len(products), "products": products}
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
    service_acc = os.path.exists(os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "service_account.json"))

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
