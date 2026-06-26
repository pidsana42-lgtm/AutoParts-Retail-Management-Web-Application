import React, { useState, type FormEvent } from 'react';

import loginImage from "../../assets/Autoparts-login.jpeg";

const Login: React.FC = () => {
  // สร้าง State สำหรับเปิด/ปิดการมองเห็นรหัสผ่าน
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  // ฟังก์ชันจัดการตอนกดปุ่มส่งฟอร์ม (Submit)
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('ข้อมูลเข้าสู่ระบบ:', { username, password });
    // คุณสามารถจัดการส่งข้อมูลไปที่หลังบ้าน (API) ต่อตรงนี้ได้เลยครับ
  };

  return (
    <div className="flex min-h-screen w-full font-sans">
      
      {/* =========================================
          ด้านซ้าย: รูปภาพพื้นหลัง และ ข้อความแนะนำระบบ
          ========================================= */}
      <div className="relative hidden w-1/2 flex-col justify-center bg-zinc-900 p-12 text-white lg:flex">
        
        {/* เลเยอร์รูปภาพและ Overlay สีดำทับให้ตัวหนังสือชัดเจน */}
        <div className="absolute inset-0 z-0">
          <img
            src={loginImage}
            alt="AutoParts Background"
            className="h-full w-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-black/40"></div>
        </div>

        {/* ส่วนบน: โลโก้ (ล็อคตำแหน่งไว้มุมซ้ายบน) */}
        <div className="absolute left-12 top-12 z-10">
          <div className="flex items-center gap-3 text-xl font-bold tracking-widest">
            {/* กล่องสีแดงใส่ไอคอนเฟืองและประแจ */}
            <div className="flex-none flex h-[40px] w-[40px] items-center justify-center rounded bg-[#B70011] text-white">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            PARTSPRO
          </div>
        </div>

        {/* ส่วนกลาง: ข้อความอธิบายระบบ */}
        <div className="relative z-10">
          <h1 className="mb-4 text-4xl font-bold leading-tight sm:text-5xl">
            ระบบบริหารจัดการ<br />ร้านขายปลีกอะไหล่ยนต์
          </h1>
          <div className="mt-6 h-1 w-16 bg-[#B70011]"></div>
          <p className="mt-6 max-w-lg text-sm leading-relaxed text-gray-300">
            เพิ่มความรวดเร็วในการจัดการสินค้าของคุณ ด้วยระบบรายงานภาพรวมที่ทำงานตลอด 24 ชม.
            การนำเข้าข้อมูลรายการสินค้าผ่านระบบที่มี AI ระบบจัดการสต๊อกสินค้าที่ยืดหยุ่น ระบบงานขาย
            และการวิเคราะห์ข้อมูลที่เต็มประสิทธิภาพ ออกแบบมาเพื่อธุรกิจร้านอะไหล่รถยนต์โดยเฉพาะ
          </p>
        </div>
      </div>

      {/* =========================================
          ด้านขวา: ฟอร์มเข้าสู่ระบบ (Login Form)
          ========================================= */}
      <div className="flex w-full items-center justify-center bg-gray-50 px-8 sm:px-16 lg:w-1/2">
        <div className="w-full max-w-md">
          <h2 className="text-3xl font-bold text-gray-900">ยินดีต้อนรับเข้าสู่ระบบ</h2>
          <p className="mb-10 mt-2 text-gray-500">มาเริ่มงานกันเลยไหม ?</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* ช่องกรอกชื่อผู้ใช้งาน */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">ชื่อผู้ใช้งาน</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded bg-gray-200 py-3 pl-12 pr-4 text-gray-900 transition-colors focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600"
                  placeholder="ตัวอย่าง: CPE0789"
                  required
                />
              </div>
            </div>

            {/* ช่องกรอกรหัสผ่าน */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">รหัสผ่าน</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded bg-gray-200 py-3 pl-12 pr-10 text-gray-900 transition-colors focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600"
                  placeholder="••••••••"
                  required
                />
                {/* ปุ่มเปิด/ปิดการมองเห็นรหัสผ่าน */}
                <div 
                  className="absolute inset-y-0 right-0 flex cursor-pointer items-center pr-4"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    // ไอคอนปิดตา (เมื่อมองเห็นรหัสผ่านอยู่)
                    <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    // ไอคอนเปิดตา (เมื่อซ่อนรหัสผ่านอยู่)
                    <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </div>
              </div>
            </div>

            {/* จดจำการใช้งาน & ลืมรหัสผ่าน */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember_me"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-600"
                />
                <label htmlFor="remember_me" className="ml-2 block text-sm text-gray-700">
                  จดจำการใช้งาน
                </label>
              </div>
              <div className="text-sm">
                <a href="#" className="font-medium text-red-600 hover:text-red-700">
                  ลืมรหัสผ่าน?
                </a>
              </div>
            </div>

            {/* ปุ่มเข้าสู่ระบบ */}
            <button
              type="submit"
              className="mt-8 flex w-full items-center justify-center rounded bg-[#B70011] px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2"
            >
              เข้าสู่ระบบ <span className="ml-2">→</span>
            </button>
            
          </form>
        </div>
      </div>

    </div>
  );
};

export default Login;