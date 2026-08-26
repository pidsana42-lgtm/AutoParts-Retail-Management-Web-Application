import { Search, Bell, CheckCircle, Info, AlertTriangle, XCircle, Trash2, CheckCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContexts";
import { useNotification, type AppNotification } from "../../contexts/NotificationContext";
import { useState, useRef, useEffect } from "react";

export default function Navbar(): React.JSX.Element {
  const { user } = useAuth() as any;
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotification();

  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

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
    </nav>
  );
}
