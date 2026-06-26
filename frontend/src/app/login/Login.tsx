import React, { useState, type FormEvent } from 'react';

import loginImage from "../../assets/Autoparts-login.jpeg";

// นำเข้า Component ต่างๆ ที่คุณสร้างไว้
import Heading from '../../components/elements/heading';
import InputField from '../../components/elements/input';
import Button from '../../components/elements/button';

const Login: React.FC = () => {
  // สร้าง State สำหรับเปิด/ปิดการมองเห็นรหัสผ่าน
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  // ฟังก์ชันจัดการตอนกดปุ่มส่งฟอร์ม (Submit)
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('ข้อมูลเข้าสู่ระบบ:', { username, password });
    // จัดการส่งข้อมูล API ต่อตรงนี้
  };

  return (
    <div className="flex min-h-screen w-full font-sans">
      
      {/* =========================================
          ด้านซ้าย: รูปภาพพื้นหลัง และ ข้อความแนะนำระบบ
          ========================================= */}
      <div className="relative hidden w-1/2 flex-col justify-center bg-zinc-900 p-12 text-white lg:flex">
        
        {/* เลเยอร์รูปภาพและ Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src={loginImage}
            alt="AutoParts Background"
            className="h-full w-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-black/40"></div>
        </div>

        {/* ส่วนบน: โลโก้ */}
        <div className="absolute left-12 top-12 z-10">
          <div className="flex items-center gap-3 text-xl font-bold tracking-widest">
            {/* ไอคอนมุมซ้ายบน ใช้โค้ดสี #B70011 ตามที่คุณต้องการ */}
            <div className="flex-none flex h-[40px] w-[40px] items-center justify-center rounded bg-[#B70011] text-white">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            PARTSPRO
          </div>
        </div>

        {/* ส่วนกลาง: ข้อความอธิบายระบบ (เปลี่ยนมาใช้ Heading Component) */}
        <div className="relative z-10">
          <Heading level="h1" className="!text-white mb-4 leading-tight">
            ระบบบริหารจัดการ<br />ร้านขายปลีกอะไหล่ยนต์
          </Heading>
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
      <div className="flex w-full items-center justify-center bg-white px-8 sm:px-16 lg:w-1/2">
        <div className="w-full max-w-md">
          {/* เปลี่ยนมาใช้ Heading Component */}
          <Heading level="h2" className="!mb-2">ยินดีต้อนรับเข้าสู่ระบบ</Heading>
          <p className="mb-10 text-gray-500">มาเริ่มงานกันเลยไหม ?</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* เปลี่ยนมาใช้ InputField Component */}
            <InputField 
              id="username"
              label="ชื่อผู้ใช้งาน"
              placeholder="ตัวอย่าง: CPE0789"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-gray-100 border-none"
              required
            />

            {/* ช่องรหัสผ่าน (ใช้ InputField + วางไอคอนเปิด-ปิดตาทับ) */}
            <div className="relative">
              <InputField 
                id="password"
                type={showPassword ? 'text' : 'password'}
                label="รหัสผ่าน"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-gray-100 border-none pr-10"
                required
              />
              <div 
                className="absolute top-[34px] right-3 flex cursor-pointer items-center"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </div>
            </div>

            {/* จดจำการใช้งาน & ลืมรหัสผ่าน */}
            <div className="flex items-center justify-between pb-2">
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
                <a href="#" className="font-medium text-[#B70011] hover:text-red-800">
                  ลืมรหัสผ่าน?
                </a>
              </div>
            </div>

            {/* เปลี่ยนมาใช้ Button Component */}
            <Button 
              type="submit" 
              variant="primary" 
              className="w-full !bg-[#B70011] hover:!bg-red-800 border-none"
            >
              เข้าสู่ระบบ <span className="ml-2">→</span>
            </Button>
            
          </form>
        </div>
      </div>

    </div>
  );
};

export default Login;