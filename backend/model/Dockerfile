FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for OpenCV, Pillow, PyMuPDF, and compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1
# ไม่ตั้ง USE_TFIDF_ONLY แล้ว — embedder โหลด ONNX ตรงผ่าน onnxruntime ใช้แรม ~1.2GB
# ตั้งเป็น 1 ได้ถ้าเครื่องปลายทางหน่วยความจำไม่พอ (จะข้ามโมเดลไปใช้ TF-IDF แทน)

COPY requirements.txt .
RUN pip install --no-cache-dir --prefer-binary -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["python", "server.py", "--port", "8000"]
