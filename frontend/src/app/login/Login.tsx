import React, { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { UserIcon, Lock, Eye, EyeOff } from "lucide-react";
import loginImage from "../../assets/Autoparts-login.jpeg";
import storeBackgroundImage from "../../assets/auto-parts-store-background.jpg";
import autopart3Image from "../../assets/autopart3.jpg";
import Heading from "../../components/elements/heading";
import Input from "../../components/elements/input";
import Button from "../../components/elements/button";
import Typewriter from "../../components/elements/typewriter";
import { useAuth } from "../../contexts/AuthContexts";
import { getMenuByRole } from "../../config/menu";
import { cn } from "../../utils/component";

// ภาพพื้นหลังฝั่งซ้าย สลับกันแสดงทีละภาพทุก 10 วินาที (ดู useEffect ตั้งเวลาด้านล่าง)
const BACKGROUND_IMAGES = [loginImage, storeBackgroundImage, autopart3Image];

const Login: React.FC = () => {
  // State สำหรับเปิด/ปิดการมองเห็นรหัสผ่าน
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // ภาพพื้นหลังปัจจุบันที่กำลังแสดง (index ใน BACKGROUND_IMAGES) — สลับทุก 10 วินาทีแบบ crossfade
  const [bgIndex, setBgIndex] = useState<number>(0);

  useEffect(() => {
    if (BACKGROUND_IMAGES.length < 2) return;
    const interval = setInterval(() => {
      setBgIndex((i) => (i + 1) % BACKGROUND_IMAGES.length);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // ควบคุมจังหวะ animation ฝั่งซ้าย: เส้นใต้หัวข้อ + คำอธิบาย จะค่อยๆ ปรากฏ "หลัง" พิมพ์หัวข้อเสร็จเท่านั้น
  const [headingTyped, setHeadingTyped] = useState<boolean>(false);

  // State สำหรับเก็บข้อมูลฟอร์ม
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  // State สำหรับเก็บข้อความ Error
  const [usernameError, setUsernameError] = useState<string>("");
  const [passwordError, setPasswordError] = useState<string>("");

  // สถานะกำลังเข้าสู่ระบบ (โชว์สปินเนอร์ที่ปุ่ม) + ตัวนับสั่นการ์ด (เปลี่ยนค่าทุกครั้งที่ validate ไม่ผ่าน เพื่อ re-trigger CSS animation ได้ทุกครั้ง)
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [shakeKey, setShakeKey] = useState<number>(0);

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    let isValid = true;

    // เคลียร์ Error ก่อนเช็คใหม่
    setUsernameError("");
    setPasswordError("");

    // Validate ฟอร์ม
    if (!username) {
      setUsernameError("กรุณากรอกชื่อผู้ใช้งาน");
      isValid = false;
    }

    if (!password) {
      setPasswordError("กรุณากรอกรหัสผ่าน");
      isValid = false;
    }

    if (!isValid) {
      setShakeKey((k) => k + 1); // สั่นการ์ดฟอร์มเบาๆ ให้รู้ว่ากรอกไม่ครบ
      return;
    }

    try {
      setSubmitting(true);
      await login({ username, password });

      const userRole = localStorage.getItem("role") || "";
      const userMenus = getMenuByRole(userRole);

      if (userMenus && userMenus.length > 0) {
        const firstPath = userMenus[0].path; // จะได้เป็น /owner/dashboard หรือ /employee/dashboard
        navigate(firstPath, { replace: true });
      } else {
        alert("คุณไม่มีสิทธิ์เข้าใช้งานในหน้านี้");
        navigate("/login", { replace: true });
      }
    } catch (error: any) {
      console.error("Login failed:", error);
      alert(
        error.message ||
        "เข้าสู่ระบบไม่สำเร็จ: กรุณาตรวจสอบชื่อผู้ใช้หรือรหัสผ่าน"
      );
      setShakeKey((k) => k + 1); // login ไม่ผ่านก็สั่นเตือนเหมือนกัน
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full font-sans">
      
      {/* ด้านซ้าย: รูปภาพพื้นหลัง และ ข้อความแนะนำระบบ */}
      <div className="relative hidden w-2/3 flex-col justify-center bg-zinc-900 p-12 text-white lg:flex">
        
        {/* เลเยอร์รูปภาพและ Overlay — สลับภาพพื้นหลังทุก 10 วินาทีแบบ crossfade (ซ้อนภาพทุกใบไว้ แล้วไล่ opacity ทีละใบ) */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          {BACKGROUND_IMAGES.map((src, i) => (
            <img
              key={src}
              src={src}
              alt="AutoParts Background"
              className={cn(
                "absolute inset-0 h-full w-full origin-center object-cover transition-opacity duration-1500 ease-in-out animate-[bg-pan_20s_ease-in-out_infinite]",
                i === bgIndex ? "opacity-30" : "opacity-0"
              )}
            />
          ))}
          <div className="absolute inset-0 bg-black/40"></div>
        </div>

        {/* ส่วนบน: โลโก้ */}
        <div className="absolute left-12 top-12 z-10 animate-[fade-in-up_0.6s_ease-out_both]">
          <div className="flex items-center gap-3 text-xl font-bold tracking-widest text-white">
            <div className="flex-none flex h-10 w-10 items-center justify-center rounded bg-white p-1.5 shadow-md">
              <img src="/LOGO.png" alt="AutoParts Logo" className="h-full w-full object-contain" />
            </div>
            JJ AUTOPARTS
          </div>
        </div>

        {/* ส่วนกลาง: ข้อความอธิบายระบบ */}
        <div className="relative z-10">
          <Heading level="h1" className="text-white! mb-4 min-h-[2.6em] leading-tight tracking-wider md:min-h-[2.2em]">
            <Typewriter
              lines={["ระบบบริหารจัดการ", "ร้านขายปลีกอะไหล่ยนต์"]}
              speed={65}
              startDelay={400}
              lineDelay={200}
              onDone={() => setHeadingTyped(true)}
            />
          </Heading>

          {/* เส้นใต้หัวข้อ: ค่อยๆ ยืดออกจาก 0 หลังพิมพ์เสร็จ ให้ความรู้สึกต่อเนื่องจากการพิมพ์ */}
          <div
            className="mt-6 h-1 max-w-32 overflow-hidden bg-[#B70011]"
            style={headingTyped ? { animation: "grow-width 0.5s ease-out both" } : { width: 0 }}
          />

          <Heading
            level="h6"
            className={cn(
              "text-white mt-6 max-w-170 transition-opacity duration-700",
              headingTyped ? "opacity-100" : "opacity-0"
            )}
            style={headingTyped ? { animation: "fade-in-up 0.6s ease-out both" } : undefined}
          >
            เพิ่มความรวดเร็วในการจัดการสินค้าของคุณ ด้วยระบบรายงานภาพรวมที่ทำงานตลอด 24 ชม.
            การนำเข้าข้อมูลรายการสินค้าผ่านระบบที่มี AI ระบบจัดการสต๊อกสินค้าที่ยืดหยุ่น ระบบงานขาย
            และการวิเคราะห์ข้อมูลที่เต็มประสิทธิภาพ ออกแบบมาเพื่อธุรกิจร้านอะไหล่รถยนต์โดยเฉพาะ
          </Heading>
        </div>
      </div>

      {/* ด้านขวา: ฟอร์มเข้าสู่ระบบ (Login Form) */}
      <div className="flex w-full items-center justify-center bg-white px-8 sm:px-16 lg:w-1/2">
        {/* key={shakeKey} บังคับ React remount div นี้ทุกครั้งที่ validate ไม่ผ่าน/login พลาด เพื่อ replay animation สั่นได้ซ้ำๆ */}
        <div key={shakeKey} className={cn("w-full max-w-md", shakeKey > 0 && "animate-[shake_0.4s_ease-in-out_both]")}>
          <Heading
            level="h2"
            weight="light"
            className="mb-2! animate-[fade-in-up_0.55s_ease-out_0.1s_both]"
          >
            ยินดีต้อนรับเข้าสู่ระบบ
          </Heading>
          <Heading
            level="h5"
            className="mb-10 animate-[fade-in-up_0.55s_ease-out_0.2s_both]"
          >
            มาเริ่มงานกันเลยไหม?
          </Heading>

          <form noValidate onSubmit={handleSubmit} className="space-y-4">

            <div className="animate-[fade-in-up_0.55s_ease-out_0.3s_both]">
              <Input
                id="username"
                label="ชื่อผู้ใช้งาน"
                placeholder="ตัวอย่าง: CPE0789"
                leftIcon={<UserIcon className="h-5 w-5" />}
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (e.target.value) setUsernameError(""); // เคลียร์ Error เมื่อพิมพ์
                }}
                error={usernameError}
                disabled={submitting}
                className="bg-gray-100 pl-12 border-none py-4 h-14 transition-all duration-200 focus:ring-2 focus:ring-[#B70011]/30 focus:bg-white focus:shadow-md"
                required
              />
            </div>

            {/* ช่องรหัสผ่าน */}
            <div className="relative animate-[fade-in-up_0.55s_ease-out_0.4s_both]">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                label="รหัสผ่าน"
                placeholder="••••••••"
                leftIcon={<Lock className="h-5 w-5" />}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (e.target.value) setPasswordError(""); // เคลียร์ Error เมื่อพิมพ์
                }}
                error={passwordError}
                disabled={submitting}
                className="bg-gray-100 border-none pr-10 h-14 transition-all duration-200 focus:ring-2 focus:ring-[#B70011]/30 focus:bg-white focus:shadow-md"
                required
                rightIcon={
                  <div
                    className="flex cursor-pointer items-center transition-transform duration-150 hover:scale-110 active:scale-95"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <span key={showPassword ? "off" : "on"} className="inline-flex animate-[fade-in_0.15s_ease-out_both]">
                      {showPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      )}
                    </span>
                  </div>
                }
              />
            </div>

            {/* จดจำการใช้งาน & ลืมรหัสผ่าน */}
            <div className="flex items-center justify-between pb-2 animate-[fade-in-up_0.55s_ease-out_0.5s_both]">
              <div className="flex items-center">
                <input
                  id="remember_me"
                  type="checkbox"
                  className="h-4 w-4 cursor-pointer rounded border-gray-300 text-red-600 transition-transform duration-150 hover:scale-110 focus:ring-red-600"
                />
                <label htmlFor="remember_me" className="ml-2 block text-sm text-gray-700">
                  จดจำการใช้งาน
                </label>
              </div>
              <div className="text-sm">
                <a href="#" className="font-medium text-[#B70011] transition-colors hover:text-red-800 hover:underline">
                  ลืมรหัสผ่าน?
                </a>
              </div>
            </div>

            <div className="animate-[fade-in-up_0.55s_ease-out_0.6s_both]">
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={submitting}
                className="group w-full border-none transition-transform duration-150 hover:scale-[1.02] hover:shadow-lg hover:shadow-red-200 active:scale-[0.98]"
                rightIcon={
                  <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">→</span>
                }
              >
                {submitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
              </Button>
            </div>

          </form>
        </div>
      </div>

    </div>
  );
};

export default Login;