import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "../../../../utils/component";

interface ReasonSelectorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

// ตัวเลือกเหตุผลมาตรฐานสำหรับร้านอะไหล่รถยนต์
const DEFAULT_REASONS = [
  "สินค้าชำรุด/เสียหายจากโรงงาน",
  "ส่งสินค้าผิดรุ่น/ผิดสเปก",
  "ลูกค้าเปลี่ยนใจ/ซื้อผิด",
  "สินค้าไม่ตรงตามรูปภาพ/รายละเอียด",
  "อื่นๆ (ระบุเอง)",
];

export const ReasonSelector: React.FC<ReasonSelectorProps> = ({
  value,
  onChange,
  placeholder = "เลือกหรือพิมพ์เหตุผล...",
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCustom, setIsCustom] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // เช็คว่าค่าปัจจุบันตรงกับค่าเริ่มต้นไหม ถ้าไม่ตรงและมีค่า แสดงว่าเป็นโหมดพิมพ์เอง (Custom)
  useEffect(() => {
    if (value && !DEFAULT_REASONS.includes(value) && !value.startsWith("อื่นๆ")) {
      setIsCustom(true);
    }
  }, [value]);

  // ปิด Dropdown เมื่อคลิกพื้นที่ด้านนอก
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (reason: string) => {
    setIsOpen(false);
    if (reason.startsWith("อื่นๆ")) {
      setIsCustom(true);
      onChange(""); // เคลียร์ค่าให้พนักงานพิมพ์ใหม่
    } else {
      setIsCustom(false);
      onChange(reason);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* ถ้าอยู่ในโหมดพิมพ์เอง หรือเลือก "อื่นๆ" ให้แสดงเป็นช่อง Input ปกติ พร้อมปุ่มกดกลับไปเลือก Dropdown */}
      {isCustom ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            disabled={disabled}
            placeholder="พิมพ์ระบุเหตุผล..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
              "w-full border border-gray-300 rounded-none px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#d61c24] focus:border-[#d61c24] transition-colors bg-white text-black",
              disabled && "bg-gray-100 cursor-not-allowed text-gray-400"
            )}
            autoFocus
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setIsCustom(false);
              onChange("");
            }}
            className="text-xs text-gray-500 hover:text-[#d61c24] whitespace-nowrap underline"
          >
            เลือกจากรายการ
          </button>
        </div>
      ) : (
        /* แสดงผลแบบ Dropdown ปกติ */
        <div
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={cn(
            "w-full border border-gray-300 rounded-none px-3 py-2 text-sm bg-white flex items-center justify-between cursor-pointer transition-colors",
            disabled ? "bg-gray-100 cursor-not-allowed text-gray-400" : "hover:border-gray-400 text-black",
            isOpen && "ring-1 ring-red-600 border-red-600"
          )}
        >
          <span className={cn(!value && "text-gray-400")}>
            {value || placeholder}
          </span>
          <ChevronDown size={16} className={cn("text-gray-400 transition-transform", isOpen && "rotate-180")} />
        </div>
      )}

      {/* รายการ Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-none shadow-lg overflow-hidden">
          <ul className="max-h-60 overflow-y-auto divide-y divide-gray-100">
            {DEFAULT_REASONS.map((reason, idx) => {
              const isSelected = value === reason;
              return (
                <li key={idx}>
                  <button
                    type="button"
                    onClick={() => handleSelect(reason)}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-2.5 text-left text-sm transition-colors cursor-pointer",
                      isSelected ? "bg-red-50 text-red-600 font-medium" : "text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    <span>{reason}</span>
                    {isSelected && <Check size={16} className="text-red-600" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};