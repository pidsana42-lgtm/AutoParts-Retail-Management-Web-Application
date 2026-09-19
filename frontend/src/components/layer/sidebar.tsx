import React from "react";
import { Menu, ChevronLeft, LogOut, Percent, ChevronDown } from "lucide-react";
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
          className="absolute -right-4 top-9 bg-[#E51C23] text-white w-10 h-10 rounded-full flex items-center justify-center border border-gray-800 cursor-pointer z-10"
        >
          {collapsed ? <Menu size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div className="h-25  flex items-center justify-center px-3 overflow-hidden">
          <img
            src="/LOGO.png"
            alt="AutoParts Logo"
            className={`object-contain transition-all duration-300 filter brightness-0 invert ${
              collapsed ? "h-15 w-15" : "h-18 max-w-[90%]"
            }`}
          />
        </div>

        <ul className="mt-6 space-y-1">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.path ||
              (item.subPath ? location.pathname === item.subPath : false) ||
              (item.subs ? item.subs.some(sub => location.pathname === sub.path.split('?')[0]) : false);

            return (
              <li key={index} className="relative group">
                <button
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center py-3 text-sm transition-colors cursor-pointer ${
                    collapsed ? "justify-center px-0" : "px-6"
                  } ${
                    isActive
                      ? "bg-[#252525] text-white border-l-4 border-red-600 "
                      : "hover:bg-[#252525] hover:text-white"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : "text-gray-400"} ${
                      !collapsed ? "mr-3" : ""
                    }`}
                  />
                  {!collapsed && <span className="truncate flex-1 text-left">{item.label}</span>}
                  {!collapsed && (item.subPath || item.subs) && (
                    <ChevronDown
                      className={`w-3.5 h-3.5 shrink-0 transition-transform duration-300 ${
                        isActive ? "rotate-180 text-white" : "text-gray-500"
                      }`}
                    />
                  )}
                </button>

                {/* Submenu Area with Smooth Accordion Animation */}
                {(item.subPath || item.subs) && !collapsed && (
                  <div
                    className={`grid transition-all duration-300 ease-in-out ${
                      isActive ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
                    }`}
                  >
                    <div className="overflow-hidden flex flex-col">
                      {item.subs ? (
                        item.subs.map((sub, sIdx) => {
                          const SubIcon = sub.icon || Percent;
                          const isSubActive =
                            location.pathname + location.search === sub.path ||
                            location.pathname === sub.path;
                          return (
                            <div
                              key={sIdx}
                              onClick={() => navigate(sub.path)}
                              className={`bg-[#181818] py-2.5 flex items-center cursor-pointer hover:bg-[#202020] transition-colors duration-200 ${
                                isSubActive ? "text-white bg-[#202020] font-medium" : "text-gray-400 hover:text-gray-200"
                              } pl-12 text-xs`}
                            >
                              <SubIcon
                                className={`w-3.5 h-3.5 shrink-0 mr-2.5 ${
                                  isSubActive ? "text-red-500" : "text-gray-500"
                                }`}
                              />
                              <span className="truncate">{sub.label}</span>
                            </div>
                          );
                        })
                      ) : (
                        <div
                          onClick={() => navigate(item.subPath!)}
                          className={`bg-[#181818] py-2.5 flex items-center cursor-pointer hover:bg-[#202020] transition-colors duration-200 ${
                            location.pathname === item.subPath ? "text-white bg-[#202020] font-medium" : "text-gray-400 hover:text-gray-200"
                          } pl-12 text-xs`}
                        >
                          <span className="truncate">{item.subLabel || ""}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="p-4">
        <button
          onClick={handleLogout}
          className={`bg-gradient-to-r from-[#B70011] to-[#E51C23] text-white rounded flex items-center justify-center text-sm  cursor-pointer ${collapsed ? "w-12 h-12 mx-auto" : "w-full py-2.5 px-4"}`}
        >
          <LogOut className={`w-4 h-4 shrink-0 ${!collapsed ? "mr-2" : ""}`} />
          {!collapsed && <span>ออกจากระบบ</span>}
        </button>
      </div>
    </aside>
  );
}
