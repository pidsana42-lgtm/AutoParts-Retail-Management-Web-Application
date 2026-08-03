import { Search, Bell } from "lucide-react";
import { useAuth } from "../../contexts/AuthContexts";

export default function Navbar(): React.JSX.Element {
  const { user } = useAuth() as any;

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
        <div className="relative cursor-pointer text-[#4B5563] hover:text-gray-800 transition-colors p-1">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 bg-[#E51C23] w-1.5 h-1.5 rounded-full border border-white"></span>
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