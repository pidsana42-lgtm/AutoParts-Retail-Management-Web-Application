import { useEffect, useState } from "react";
import { createMobileSession } from "../service/http/import/import_service";

// เดิมหน้าเว็บสุ่ม session ID เอง (Math.random) แล้วส่งขึ้นมือถือผ่าน QR โดย backend
// เช็คแค่รูปแบบตัวอักษรว่าถูกต้องหรือไม่ — ใครก็เดา session ที่ "หน้าตาถูกต้อง" มายิง API ได้
// ตอนนี้ backend เป็นคนสุ่มและจดทะเบียน session ให้ (มีอายุ 15 นาที) หน้าเว็บแค่ขอมาใช้เท่านั้น
export function useMobileUploadSession() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    createMobileSession()
      .then(res => {
        if (!cancelled) setSessionId(res.session);
      })
      .catch(err => {
        console.error("Failed to create mobile upload session:", err);
        if (!cancelled) setError(err?.message || "ไม่สามารถสร้าง session สำหรับอัปโหลดรูปจากมือถือได้");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { sessionId, error };
}
