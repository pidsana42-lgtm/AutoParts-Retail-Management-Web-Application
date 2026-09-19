/* 
    เอาไว้ใช้ตอน User ทุก Role ต้องใช้หน้าเดียวกันแต่แสดงผลต่างกัน
*/

// อ้างอิง Role

// export function getRoleBasePath(): string {
//   const role = localStorage.getItem('role');
//   return role === 'Owner' ? '/owner' : '/employee';
// }

import { useLocation } from 'react-router-dom';

// อ้างอิง ปุ่ม navigate/back พาผู้ใช้กลับไปที่เดิมที่เขามา
export function usePathBasePrefix(): string {
  const location = useLocation();
  if (location.pathname.startsWith('/employee')) return '/employee';
  if (location.pathname.startsWith('/owner')) return '/owner';
  if (location.pathname.startsWith('/manager')) return '/manager';
  if (location.pathname.startsWith('/admin')) return '/admin';
  return '/owner'; // fallback สุดท้ายจริงๆ ไม่ควรถึงจุดนี้
}