import { Calendar, Clock } from "lucide-react";

export interface CheckDateTimeRangeValue {
  date: string; // yyyy-mm-dd
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

// วันที่ปัจจุบันตามเวลาท้องถิ่น (yyyy-mm-dd) — ห้ามใช้ new Date().toISOString() เพราะแปลงเป็น UTC ก่อน
// ช่วงเวลา 00:00-06:59 น. ของไทย (UTC+7) จะเพี้ยนไปเป็นเมื่อวานทันที
function getLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

interface CheckDateTimeRangeFieldProps {
  value: CheckDateTimeRangeValue;
  onChange: (next: CheckDateTimeRangeValue) => void;
  disabled?: boolean;
  required?: boolean;
}

// ตัวเลือก "วันที่ตรวจ + ช่วงเวลาเริ่มเช็ค-หมดเวลาเช็ค" แทน input datetime-local เดี่ยวๆ แบบเดิม
// - เลือกได้แค่วันนี้และวันในอนาคต (min = วันนี้)
// - กำหนดเวลาเริ่ม/สิ้นสุดแยกกัน เพื่อให้รู้ "กรอบเวลา" ที่ต้องเช็คสต็อกให้เสร็จ
export default function CheckDateTimeRangeField({
  value,
  onChange,
  disabled,
  required,
}: CheckDateTimeRangeFieldProps) {
  const today = getLocalDateString(new Date());

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-700">
        วันที่และช่วงเวลาที่กำหนด
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <Calendar className="h-3.5 w-3.5" /> วันที่ตรวจ
          </span>
          <input
            type="date"
            min={today}
            value={value.date}
            onChange={(e) => onChange({ ...value, date: e.target.value })}
            disabled={disabled}
            required={required}
            className="h-10 w-full rounded-sm border border-slate-300 bg-white px-3 text-sm text-slate-800 transition-colors duration-150 ease-out focus:border-[#B70011] focus:outline-none focus:ring-2 focus:ring-red-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <Clock className="h-3.5 w-3.5" /> เวลาเริ่มเช็ค
          </span>
          <input
            type="time"
            value={value.startTime}
            onChange={(e) => onChange({ ...value, startTime: e.target.value })}
            disabled={disabled}
            required={required}
            className="h-10 w-full rounded-sm border border-slate-300 bg-white px-3 text-sm text-slate-800 transition-colors duration-150 ease-out focus:border-[#B70011] focus:outline-none focus:ring-2 focus:ring-red-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <Clock className="h-3.5 w-3.5" /> เวลาหมดเขตเช็ค
          </span>
          <input
            type="time"
            value={value.endTime}
            onChange={(e) => onChange({ ...value, endTime: e.target.value })}
            disabled={disabled}
            required={required}
            className="h-10 w-full rounded-sm border border-slate-300 bg-white px-3 text-sm text-slate-800 transition-colors duration-150 ease-out focus:border-[#B70011] focus:outline-none focus:ring-2 focus:ring-red-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
          />
        </div>
      </div>
    </div>
  );
}

// ตรวจสอบความถูกต้องของช่วงวันเวลา คืน error message ถ้าไม่ผ่าน (ใช้ร่วมกันทั้งหน้าเพิ่ม/แก้ไข)
export function validateCheckDateTimeRange(value: CheckDateTimeRangeValue): string | null {
  if (!value.date || !value.startTime || !value.endTime) {
    return "กรุณากรอกวันที่และช่วงเวลาให้ครบถ้วน";
  }
  const today = getLocalDateString(new Date());
  if (value.date < today) {
    return "เลือกได้เฉพาะวันนี้หรือวันในอนาคตเท่านั้น";
  }
  if (value.endTime <= value.startTime) {
    return "เวลาหมดเขตเช็คต้องอยู่หลังเวลาเริ่มเช็ค";
  }
  return null;
}

// รวมวันที่ + เวลา เป็น Date object เดียว
export function combineDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}`);
}
