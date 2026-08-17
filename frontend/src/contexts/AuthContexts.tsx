import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react"; 
import { useNavigate } from "react-router-dom"; 
import { loginUser } from "../service/http/login/login_service"; 
import type { LoginRequest } from "../interface/login/login_interface";
import { getMenuByRole } from "../config/menu";

interface User {
  id: string;
  name: string;
  username: string;
  first_name: string;
  last_name: string;
}

// 1. เพิ่มตัวแปร role เข้ามาในแผนผังประเภทข้อมูล (Type) ส่วนกลาง
type AuthContextType = {
  user: User | null;
  token: string | null;
  role: string | null; 
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<User>;
  logout: () => void;
  setUser: (user: User | null) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate(); 

  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null); 
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // --------------------------
  // ตรวจประวัติคนเคยล็อกอิน (ตอนเปิด/รีเฟรชหน้าเว็บ)
  // --------------------------
  useEffect(() => {
    try {
      // Handle URL redirect query parameters from LINE Login
      const searchParams = new URLSearchParams(window.location.search);
      const urlToken = searchParams.get("token");
      const urlRole = searchParams.get("role");
      const urlUsername = searchParams.get("username");
      const urlFirstName = searchParams.get("first_name");
      const urlId = searchParams.get("id");
      const urlError = searchParams.get("error");

      if (urlError) {
        alert("เข้าสู่ระบบผ่าน LINE ล้มเหลว: " + urlError);
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (urlToken && urlRole) {
        const userObj = {
          id: urlId || "",
          name: urlFirstName ? decodeURIComponent(urlFirstName) : (urlUsername || "LINE User"),
          username: urlUsername || "line_user",
          first_name: urlFirstName ? decodeURIComponent(urlFirstName) : "",
          last_name: ""
        };

        localStorage.setItem("token", urlToken);
        localStorage.setItem("role", urlRole);
        localStorage.setItem("user", JSON.stringify(userObj));

        setUser(userObj);
        setToken(urlToken);
        setRole(urlRole);
        setIsAuthenticated(true);

        // Remove parameters from URL
        window.history.replaceState({}, document.title, window.location.pathname);

        // Redirect to dashboard
        const userMenus = getMenuByRole(urlRole);
        if (userMenus && userMenus.length > 0) {
          navigate(userMenus[0].path, { replace: true });
        }
        setIsLoading(false);
        return;
      }

      const savedUser = localStorage.getItem("user");
      const savedToken = localStorage.getItem("token");
      const savedRole = localStorage.getItem("role"); 

      if (savedUser && savedToken && savedUser !== "undefined" && savedToken !== "undefined") {
        const parsedUser = JSON.parse(savedUser);

        setUser(parsedUser);
        setToken(savedToken);
        setRole(savedRole); 
        setIsAuthenticated(true);
      } else {
        localStorage.clear(); // เคลียร์ทั้งหมดถ้าข้อมูลพัง
      }
    } catch (e) {
      console.warn("Invalid auth data, clearing...", e);
      localStorage.clear();
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  // --------------------------
  // LOGIN (พาร์ทสำคัญที่เพิ่มการจัดการสิทธิ์)
  // --------------------------
  const login = async (credentials: LoginRequest): Promise<User> => {
    // ยิงไปหา Go หลังบ้านดึงข้อมูลชุดใหม่
    const data = await loginUser(credentials) as any; 

    if (!data.token) throw new Error("เซิร์ฟเวอร์ไม่ได้ส่ง token มา");

    // 1. ประกอบร่างวัตถุ User ตัวใหม่ ดึงข้อมูลจากฐานข้อมูลของ Go โดยตรง
    // หมายเหตุ: backend ส่ง id มาแบบ flat (data.id) ไม่ได้ซ้อนอยู่ใต้ data.user — ของเดิมอ่านผิด field ทำให้ user.id ว่างเปล่าตลอด
    const userObj = {
      id: data.id != null ? String(data.id) : "",
      name: `${data.first_name} ${data.last_name}`,
      username: data.username,
      first_name: data.first_name,
      last_name: data.last_name
    };

    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(userObj)); // 💾 บันทึกก้อนที่มีชื่อไทยแล้วลงเครื่อง
    localStorage.setItem("role", data.role); 

    setUser(userObj);
    setToken(data.token);
    setRole(data.role); 
    setIsAuthenticated(true);

    return userObj as any;
  };

  // --------------------------
  // LOGOUT
  // --------------------------
  const logout = () => {
    localStorage.clear(); // ล้างข้อมูลตู้เซฟบราวเซอร์ออกทั้งหมดเพื่อความปลอดภัย

    setUser(null);
    setToken(null);
    setRole(null); // ล้างสิทธิ์ทิ้ง
    setIsAuthenticated(false);

    navigate("/login"); // เด้งกลับหน้าล็อกอินด้วยคำสั่งของ React
  };

  // ป้องกันการโหลด UI ก่อนแกะตั๋วเสร็จ
  if (isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role, //  ส่งค่า role กระจายออกไปให้หน้าอื่น ๆ หยิบไปเช็กต่อได้
        isAuthenticated,
        isLoading,
        login,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth ต้องใช้ภายใน AuthProvider เท่านั้น");
  return ctx;
};