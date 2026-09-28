import React, { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { UserIcon, Lock, Eye, EyeOff, Mail, KeyRound, CheckCircle2, X } from "lucide-react";
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
import { requestForgotPassword, resetPassword } from "../../service/http/login/login_service";
import { useAlertDialog } from "../../components/elements/alert_dialog";

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
  const { alertDialog } = useAlertDialog();

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
        await alertDialog("คุณไม่มีสิทธิ์เข้าใช้งานในหน้านี้", "แจ้งเตือน", "warning");
        navigate("/login", { replace: true });
      }
    } catch (error: any) {
      console.error("Login failed:", error);
      await alertDialog(
        error.message ||
        "เข้าสู่ระบบไม่สำเร็จ: กรุณาตรวจสอบชื่อผู้ใช้หรือรหัสผ่าน",
        "เข้าสู่ระบบไม่สำเร็จ",
        "danger"
      );
      setShakeKey((k) => k + 1); // login ไม่ผ่านก็สั่นเตือนเหมือนกัน
    } finally {
      setSubmitting(false);
    }
  };

  // State สำหรับ Modal ลืมรหัสผ่าน
  const [showForgotModal, setShowForgotModal] = useState<boolean>(false);
  const [forgotStep, setForgotStep] = useState<"request" | "reset">("request");
  const [forgotIdentifier, setForgotIdentifier] = useState<string>("");
  const [forgotOtp, setForgotOtp] = useState<string>("");
  const [forgotNewPassword, setForgotNewPassword] = useState<string>("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState<string>("");
  const [forgotShowPassword, setForgotShowPassword] = useState<boolean>(false);
  const [forgotLoading, setForgotLoading] = useState<boolean>(false);
  const [forgotMsg, setForgotMsg] = useState<string>("");
  const [forgotError, setForgotError] = useState<string>("");

  const handleOpenForgotModal = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowForgotModal(true);
    setForgotStep("request");
    setForgotIdentifier(username || "");
    setForgotOtp("");
    setForgotNewPassword("");
    setForgotConfirmPassword("");
    setForgotMsg("");
    setForgotError("");
  };

  const handleCloseForgotModal = () => {
    setShowForgotModal(false);
    setForgotStep("request");
    setForgotMsg("");
    setForgotError("");
  };

  const handleRequestOTP = async (e: FormEvent) => {
    e.preventDefault();
    if (!forgotIdentifier.trim()) {
      setForgotError("กรุณากรอกชื่อผู้ใช้งาน หรือ อีเมล");
      return;
    }
    setForgotError("");
    setForgotMsg("");
    setForgotLoading(true);
    try {
      const res = await requestForgotPassword(forgotIdentifier.trim());
      setForgotMsg(res.message || "ส่งรหัส OTP ไปยังอีเมลเรียบร้อยแล้ว");
      setForgotStep("reset");
    } catch (err: any) {
      setForgotError(err.message || "ไม่สามารถส่งรหัส OTP ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!forgotOtp.trim()) {
      setForgotError("กรุณากรอกรหัส OTP 6 หลัก");
      return;
    }
    if (forgotOtp.trim().length !== 6) {
      setForgotError("รหัส OTP ต้องมี 6 หลัก");
      return;
    }
    if (!forgotNewPassword || forgotNewPassword.length < 6) {
      setForgotError("รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError("รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    setForgotError("");
    setForgotMsg("");
    setForgotLoading(true);
    try {
      const res = await resetPassword({
        identifier: forgotIdentifier.trim(),
        otp: forgotOtp.trim(),
        new_password: forgotNewPassword,
      });
      handleCloseForgotModal();
      await alertDialog(
        res.message || "เปลี่ยนรหัสผ่านสำเร็จแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่",
        "เปลี่ยนรหัสผ่านสำเร็จ",
        "success"
      );
    } catch (err: any) {
      setForgotError(err.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setForgotLoading(false);
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

            {/* ลืมรหัสผ่าน */}
            <div className="flex justify-end pb-2 animate-[fade-in-up_0.55s_ease-out_0.5s_both]">
              <div className="text-sm">
                <button
                  type="button"
                  onClick={handleOpenForgotModal}
                  className="font-medium text-[#B70011] transition-colors hover:text-red-800 hover:underline cursor-pointer"
                >
                  ลืมรหัสผ่าน?
                </button>
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

      {/* Modal ลืมรหัสผ่าน */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-[fade-in_0.2s_ease-out]">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 shadow-2xl border border-gray-100 animate-[fade-in-up_0.25s_ease-out]">
            {/* ปุ่มปิด Modal */}
            <button
              type="button"
              onClick={handleCloseForgotModal}
              className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>

            {/* ส่วนหัว Modal */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-[#B70011]">
                {forgotStep === "request" ? (
                  <Mail className="h-6 w-6" />
                ) : (
                  <KeyRound className="h-6 w-6" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {forgotStep === "request" ? "ลืมรหัสผ่าน" : "ตั้งรหัสผ่านใหม่"}
                </h3>
                <p className="text-xs text-gray-500">
                  {forgotStep === "request"
                    ? "รับรหัส OTP เพื่อยืนยันตัวตนทางอีเมล"
                    : "กรอกรหัส OTP ที่ได้รับ และกำหนดรหัสผ่านใหม่"}
                </p>
              </div>
            </div>

            {/* ข้อความแจ้งเตือน Error / Success */}
            {forgotError && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {forgotError}
              </div>
            )}
            {forgotMsg && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{forgotMsg}</span>
              </div>
            )}

            {/* ขั้นตอนที่ 1: ขอรับรหัส OTP */}
            {forgotStep === "request" && (
              <form onSubmit={handleRequestOTP} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    ชื่อผู้ใช้งาน หรือ อีเมล
                  </label>
                  <input
                    type="text"
                    placeholder="ตัวอย่าง: boss หรือ user@example.com"
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    disabled={forgotLoading}
                    required
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 transition focus:border-[#B70011] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#B70011]/20"
                  />
                  <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">
                    ระบบจะตรวจสอบและส่งรหัส OTP 6 หลักไปยังอีเมลที่เชื่อมโยงกับบัญชีนี้ (หรืออีเมลผู้ดูแลร้าน)
                  </p>
                </div>

                <div className="pt-2 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    onClick={handleCloseForgotModal}
                    className="w-1/3"
                  >
                    ยกเลิก
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={forgotLoading}
                    className="w-2/3 border-none shadow-md hover:shadow-red-200"
                  >
                    {forgotLoading ? "กำลังส่ง OTP..." : "ส่งรหัส OTP"}
                  </Button>
                </div>
              </form>
            )}

            {/* ขั้นตอนที่ 2: ยืนยัน OTP และตั้งรหัสผ่านใหม่ */}
            {forgotStep === "reset" && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    รหัสยืนยัน OTP (6 หลัก)
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ""))}
                    disabled={forgotLoading}
                    required
                    className="w-full text-center text-xl font-bold tracking-widest rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-800 transition focus:border-[#B70011] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#B70011]/20"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    รหัส OTP มีอายุ 15 นาที
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    รหัสผ่านใหม่
                  </label>
                  <div className="relative">
                    <input
                      type={forgotShowPassword ? "text" : "password"}
                      placeholder="อย่างน้อย 6 ตัวอักษร"
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      disabled={forgotLoading}
                      required
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 pr-10 text-sm text-gray-800 transition focus:border-[#B70011] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#B70011]/20"
                    />
                    <button
                      type="button"
                      onClick={() => setForgotShowPassword(!forgotShowPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {forgotShowPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    ยืนยันรหัสผ่านใหม่
                  </label>
                  <input
                    type={forgotShowPassword ? "text" : "password"}
                    placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                    value={forgotConfirmPassword}
                    onChange={(e) => setForgotConfirmPassword(e.target.value)}
                    disabled={forgotLoading}
                    required
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 transition focus:border-[#B70011] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#B70011]/20"
                  />
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={forgotLoading}
                    className="w-full border-none shadow-md hover:shadow-red-200"
                  >
                    {forgotLoading ? "กำลังบันทึก..." : "ยืนยันเปลี่ยนรหัสผ่าน"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep("request");
                      setForgotError("");
                      setForgotMsg("");
                    }}
                    className="text-center text-xs text-gray-500 hover:text-[#B70011] transition underline cursor-pointer"
                  >
                    ← ขอรหัส OTP อีกครั้ง หรือ เปลี่ยนชื่อผู้ใช้งาน
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
