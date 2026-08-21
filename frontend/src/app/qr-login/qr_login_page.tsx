import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { loginWithQrToken } from "../../service/http/login/qr_login_service";
import { getMenuByRole } from "../../config/menu";

// หน้านี้เปิดจากมือถือหลังสแกน QR ส่วนตัวของพนักงาน/เจ้าของร้าน (จากคอมที่ล็อกอินอยู่แล้ว)
// ไม่ต้องกรอก username/password เอง — แลก token จาก QR เป็น session ล็อกอินจริงให้อัตโนมัติ
export default function QrLoginPage(): React.JSX.Element {
  const token = new URLSearchParams(window.location.search).get("token") || "";

  const [status, setStatus] = useState<"loading" | "success" | "error">(token ? "loading" : "error");
  const [errorMsg, setErrorMsg] = useState<string>(token ? "" : "ลิงก์ไม่ถูกต้อง กรุณาสแกน QR Code ใหม่จากคอมพิวเตอร์");

  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        const data = await loginWithQrToken(token);

        const userObj = {
          id: data.id != null ? String(data.id) : "",
          name: `${data.first_name} ${data.last_name}`,
          username: data.username,
          first_name: data.first_name,
          last_name: data.last_name,
        };

        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(userObj));
        localStorage.setItem("role", data.role);

        setStatus("success");

        const userMenus = getMenuByRole(data.role);
        const redirectPath = userMenus && userMenus.length > 0 ? userMenus[0].path : "/";

        // Hard navigation (ไม่ใช้ react-router) เพื่อให้ AuthProvider โหลดข้อมูลใหม่จาก localStorage ตั้งแต่ต้น
        setTimeout(() => {
          window.location.href = redirectPath;
        }, 600);
      } catch (err: any) {
        setStatus("error");
        setErrorMsg(err?.message || "QR Code นี้ไม่ถูกต้องหรือหมดอายุแล้ว");
      }
    })();
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-8">
      <div className="w-full max-w-xs space-y-3 text-center">
        {status === "loading" && (
          <>
            <Loader2 size={48} className="mx-auto animate-spin text-[#E51C23]" />
            <p className="text-sm font-medium text-gray-600">กำลังเข้าสู่ระบบ...</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 size={48} className="mx-auto text-green-500" />
            <p className="text-sm font-bold text-gray-800">เข้าสู่ระบบสำเร็จ</p>
            <p className="text-xs text-gray-400">กำลังพาไปหน้าแรก...</p>
          </>
        )}
        {status === "error" && (
          <>
            <AlertCircle size={48} className="mx-auto text-red-400" />
            <p className="text-sm font-bold text-red-600">เข้าสู่ระบบไม่สำเร็จ</p>
            <p className="text-xs text-gray-500">{errorMsg}</p>
          </>
        )}
      </div>
    </div>
  );
}
