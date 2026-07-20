import React from "react";
import { Menu, ChevronLeft, LogOut, Percent } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContexts";
import { useMenu } from "../../hooks/useMenu"; 

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({
  collapsed,
  onToggle,
}: SidebarProps): React.JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth() as any;

  // เรียกใช้เมนูที่ถูกกรองตามสิทธิ์มาจาก Hook
  const { menuItems } = useMenu();

  const handleLogout = () => {
    localStorage.clear(); 
    if (logout) logout();
    navigate("/login");
  };

  return (
    <aside
      className={`${collapsed ? "w-20" : "w-64"} bg-[#1C1B1B] text-gray-400 flex flex-col justify-between h-screen sticky top-0 border-r border-gray-800 transition-all duration-300 z-50`}
    >
      <div className="relative">
        <button
          onClick={onToggle}
          className="absolute -right-4 top-5 bg-[#E51C23] text-white w-10 h-10 rounded-full flex items-center justify-center border border-gray-800 cursor-pointer"
        >
          {collapsed ? <Menu size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div className="h-16 border-b border-gray-800 opacity-0">Logo</div>

        <ul className="mt-4 space-y-0.5">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            const subItems = item.subs || (item.subPath ? [{ icon: item.subIcon, path: item.subPath, label: item.subLabel || "" }] : []);
            const isActive =
              location.pathname === item.path ||
              subItems.some((sub) => location.pathname === sub.path);

            return (
              <li key={index} className="relative group">
                <button
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center py-3 text-sm transition-colors cursor-pointer ${collapsed ? "justify-center px-0" : "px-6"} ${isActive ? "bg-[#252525] text-white border-l-4 border-red-600 font-medium" : "hover:bg-[#252525] hover:text-white"}`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : "text-gray-400"} ${!collapsed ? "mr-3" : ""}`}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>

                {/* Submenu Area */}
                {isActive && subItems.length > 0 && subItems.map((sub) => {
                  const SubIcon = sub.icon || Percent;
                  const isSubActive = location.pathname === sub.path;

                  return (
                    <div
                      key={sub.path}
                      onClick={() => navigate(sub.path)}
                      className={`bg-[#181818] py-2 flex items-center cursor-pointer hover:bg-[#202020] ${isSubActive ? "text-gray-400" : "text-gray-500"} ${collapsed ? "justify-center" : "pl-13 py-3 text-xs"}`}
                    >
                      <SubIcon
                        className={`w-4 h-4 shrink-0 ${isSubActive ? "text-white" : "text-gray-400"} ${!collapsed ? "mr-3" : ""}`}
                      />
                      {!collapsed && (
                        <span className="ml-2 truncate">{sub.label}</span>
                      )}
                    </div>
                  );
                })}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="p-4">
        <button
          onClick={handleLogout}
          className={`bg-gradient-to-r from-[#B70011] to-[#E51C23] text-white rounded flex items-center justify-center text-sm font-medium cursor-pointer ${collapsed ? "w-12 h-12 mx-auto" : "w-full py-2.5 px-4"}`}
        >
          <LogOut className={`w-4 h-4 shrink-0 ${!collapsed ? "mr-2" : ""}`} />
          {!collapsed && <span>ออกจากระบบ</span>}
        </button>
      </div>
    </aside>
  );
}
