import { Search, Bell, CheckCircle, Info, AlertTriangle, XCircle, Trash2, CheckCheck, QrCode, Download, Printer, X, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContexts";
import { useNotification, type AppNotification } from "../../contexts/NotificationContext";
import { useState, useRef, useEffect } from "react";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { getMyQrToken, regenerateMyQrToken } from "../../service/http/login/qr_login_service";

export default function Navbar(): React.JSX.Element {
  const { user } = useAuth() as any;
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotification();

  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // QR ส่วนตัวสำหรับสแกนล็อกอินเข้ามือถือทันทีโดยไม่ต้องพิมพ์รหัสผ่าน
  const [showMyQr, setShowMyQr] = useState(false);
  const [myQrToken, setMyQrToken] = useState<string | null>(null);
  const [myQrLoading, setMyQrLoading] = useState(false);

  const myQrPayload = myQrToken ? `${window.location.origin}/qr-login?token=${myQrToken}` : "";

  const openMyQr = async () => {
    setShowMyQr(true);
    if (myQrToken) return;
    setMyQrLoading(true);
    try {
      const res = await getMyQrToken();
      setMyQrToken(res.token);
    } catch (e) {
      console.error("โหลด QR ส่วนตัวไม่สำเร็จ", e);
    } finally {
      setMyQrLoading(false);
    }
  };

  const handleRegenerateMyQr = async () => {
    if (!window.confirm("QR เดิมจะใช้ไม่ได้อีก ต้องการสร้างใหม่หรือไม่?")) return;
    setMyQrLoading(true);
    try {
      const res = await regenerateMyQrToken();
      setMyQrToken(res.token);
    } catch (e) {
      console.error("สร้าง QR ส่วนตัวใหม่ไม่สำเร็จ", e);
    } finally {
      setMyQrLoading(false);
    }
  };

  const handleDownloadMyQr = () => {
    const canvas = document.getElementById("my-qr-canvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-login-qr.png";
    a.click();
  };

  const handlePrintMyQr = () => {
    const canvas = document.getElementById("my-qr-canvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html>
        <head><title></title><style>@page { margin: 0; } body { margin: 0; display:flex; align-items:center; justify-content:center; }</style></head>
        <body><img src="${url}" onload="window.print();window.close();" /></body>
      </html>
    `);
    win.document.close();
  };

  const handleNotifClick = (notif: AppNotification) => {
    markAsRead(notif.id);
    if (notif.link) {
      setShowNotif(false);
      navigate(notif.link);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotif(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getDisplayName = () => {
    if (user?.name) return user.name;
    const savedUser = localStorage.getItem("user");
    if (savedUser && savedUser !== "undefined" && savedUser !== "null") {
      try {
        const parsedUser = JSON.parse(savedUser);
        if (parsedUser?.name) return parsedUser.name;
      } catch (e) {
        console.error(e);
      }
    }
    return null;
  };

  const displayName = getDisplayName() || "ผู้ใช้งานระบบ";

  const getNotifIcon = (type?: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />;
      default: return <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />;
    }
  };

  return (
    // ใส่ sticky top-0, z-40 และ shadow-sm เพื่อให้ Navbar ลอยอยู่เหนือกองสินค้าเวลาเลื่อนเมาส์
    <nav className="sticky top-0 z-40 flex items-center justify-between bg-white px-6 border-b-2 border-b-[#E51C23] h-16 select-none shrink-0 shadow-sm">

      {/* ช่องค้นหา */}
      <div className="flex items-center bg-[#F6F3F2] px-3 py-2 w-[350px] lg:w-[550px] rounded-lg border border-transparent focus-within:border-gray-300 transition-all">
        <Search className="w-4 h-4 text-[#6B7280] mr-2 shrink-0" />
        <input
          type="text"
          placeholder="ค้นหาสินค้าด้วยเลขอะไหล่ หรือรุ่นรถ"
          className="bg-transparent outline-none text-xs tracking-wider w-full text-[#6B7280] placeholder:text-[#6B7280]"
        />
      </div>

      {/* ฝั่งขวา: แจ้งเตือน & โปรไฟล์ */}
      <div className="flex items-center space-x-4 shrink-0">
        <div
          className="cursor-pointer text-[#4B5563] hover:text-gray-800 transition-colors p-1"
          onClick={openMyQr}
          title="QR เข้าสู่ระบบส่วนตัว — สแกนด้วยมือถือเพื่อล็อกอินทันที"
        >
          <QrCode className="w-5 h-5" />
        </div>

        <div className="relative" ref={notifRef}>
          <div 
            className="cursor-pointer text-[#4B5563] hover:text-gray-800 transition-colors p-1"
            onClick={() => setShowNotif(!showNotif)}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 bg-[#E51C23] text-white text-[9px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full border border-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>

          {/* Notification Dropdown */}
          {showNotif && (
            <div className="absolute right-0 mt-3 w-80 bg-white rounded-lg shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="px-4 py-2 flex items-center justify-between border-b border-gray-50">
                <h3 className="text-sm font-bold text-gray-800">การแจ้งเตือน</h3>
                <div className="flex gap-2">
                  <button 
                    onClick={markAllAsRead}
                    className="text-[10px] text-blue-600 hover:text-blue-800 flex items-center"
                    title="อ่านทั้งหมด"
                  >
                    <CheckCheck className="w-3 h-3 mr-0.5" /> อ่านทั้งหมด
                  </button>
                  <button 
                    onClick={clearAll}
                    className="text-[10px] text-gray-400 hover:text-red-500 flex items-center ml-2"
                    title="ล้างทั้งหมด"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-400 text-xs">
                    ไม่มีการแจ้งเตือนใหม่
                  </div>
                ) : (
                  notifications.map(notif => (
                    <div 
                      key={notif.id} 
                      className={`px-4 py-3 border-b border-gray-50 flex gap-3 cursor-pointer hover:bg-gray-50 transition-colors ${!notif.isRead ? 'bg-blue-50/30' : ''}`}
                      onClick={() => handleNotifClick(notif)}
                    >
                      {getNotifIcon(notif.type)}
                      <div className="flex-1">
                        <p className={`text-xs ${!notif.isRead ? 'font-bold text-gray-800' : 'text-gray-600'}`}>
                          {notif.title}
                        </p>
                        {notif.message && (
                          <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
                        )}
                        <p className="text-[9px] text-gray-400 mt-1">
                          {notif.createdAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {!notif.isRead && (
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1 shrink-0"></div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="h-6 w-[1px] bg-gray-200"></div>

        {/* ข้อมูลผู้ใช้งาน */}
        <div className="flex items-center space-x-2 text-xs min-w-[120px] max-w-[200px]">
          <div className="text-left flex flex-col justify-center min-w-0">
            <p className="text-[10px] text-gray-400 leading-none mb-0.5">บัญชีผู้ใช้</p>
            <p className=" text-gray-700 tracking-wide truncate pr-2" title={displayName}>
              {displayName}
            </p>
          </div>
        </div>
      </div>

      {/* Modal: QR เข้าสู่ระบบส่วนตัว */}
      {showMyQr && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowMyQr(false)}
        >
          <div
            className="flex w-full max-w-xs flex-col items-center gap-3 rounded-md bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex w-full items-center justify-between">
              <span className="text-sm font-semibold text-slate-800">QR เข้าสู่ระบบส่วนตัว</span>
              <button
                type="button"
                onClick={() => setShowMyQr(false)}
                className="cursor-pointer text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {myQrLoading && !myQrToken ? (
              <div className="flex h-40 w-40 items-center justify-center text-xs text-slate-400">
                กำลังโหลด...
              </div>
            ) : myQrPayload ? (
              <>
                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <QRCodeSVG value={myQrPayload} size={160} level="M" />
                </div>
                <div className="hidden">
                  <QRCodeCanvas id="my-qr-canvas" value={myQrPayload} size={320} level="H" includeMargin />
                </div>
                <p className="text-center text-xs text-slate-400">
                  เอามือถือของคุณมาสแกน QR นี้เพื่อเข้าสู่ระบบทันที โดยไม่ต้องพิมพ์รหัสผ่าน
                </p>
                <div className="flex w-full gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadMyQr}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-200 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    ดาวน์โหลด
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintMyQr}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-200 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    พิมพ์
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleRegenerateMyQr}
                  disabled={myQrLoading}
                  className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 hover:text-[#E51C23] disabled:opacity-50"
                  title="ใช้เมื่อ QR เดิมหลุดไปอยู่ในมือคนอื่น"
                >
                  <RefreshCw className="h-3 w-3" />
                  ยกเลิก QR เดิม แล้วสร้างใหม่
                </button>
              </>
            ) : (
              <p className="text-xs text-red-500">โหลด QR ไม่สำเร็จ ลองใหม่อีกครั้ง</p>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
