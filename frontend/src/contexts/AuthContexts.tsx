import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react"; 
import { useNavigate } from "react-router-dom"; 
import { loginUser } from "../service/http/login/login_service"; 
import type { LoginRequest } from "../interface/login/login_interface";

interface User {
  id: string;
  name: string;
  username: string;
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
  }, []);

  // --------------------------
  // LOGIN (พาร์ทสำคัญที่เพิ่มการจัดการสิทธิ์)
  // --------------------------
  const login = async (credentials: LoginRequest): Promise<User> => {
    // ยิงไปหา Go หลังบ้านผ่านไฟล์ Service ของโบว์
    const data = await loginUser(credentials);

    if (!data.token) throw new Error("เซิร์ฟเวอร์ไม่ได้ส่ง token มา");

    //  บันทึกทุกอย่างลง LocalStorage ด้วยชื่อคีย์มาตรฐานเดียวกัน
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    localStorage.setItem("role", data.role); //  บันทึกคำว่า "OWNER" หรือ "EMPLOYEE" ลงเครื่อง

    setUser(data.user);
    setToken(data.token);
    setRole(data.role); //  อัปเดตสิทธิ์เข้าไปในระบบส่วนกลาง
    setIsAuthenticated(true);

    return data.user;
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