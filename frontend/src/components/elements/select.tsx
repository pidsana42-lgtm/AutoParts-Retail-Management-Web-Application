import { cn } from "../../utils/component";
import { useState, useRef, useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface SelectTriggerRenderProps {
  isOpen: boolean;
  selectedOption?: SelectOption;
  disabled?: boolean;
  toggle: () => void;
}

interface SelectProps {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: { target: { value: string } }) => void;
  containerClassName?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  // ✅ เพิ่มใหม่: override หน้าตาปุ่ม trigger เอง (เช่น icon-only trigger)
  // ยังใช้ logic เปิด/ปิด dropdown และ handleSelect เดิมทั้งหมด
  renderTrigger?: (props: SelectTriggerRenderProps) => ReactNode;
  // ตำแหน่ง dropdown เทียบกับ trigger เมื่อใช้ renderTrigger (default: "left")
  menuAlign?: "left" | "right";
}

export default function Select({
  label,
  error,
  helperText,
  options,
  placeholder,
  value,
  defaultValue = "",
  onChange,
  containerClassName,
  className,
  required,
  disabled,
  id,
  renderTrigger,
  menuAlign = "left",
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState(value ?? defaultValue);
  const [dropUp,   setDropUp]   = useState(false);
  const [coords,   setCoords]   = useState<{ top: number; bottom: number; left: number; right: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  // sync ถ้า value เปลี่ยนจากข้างนอก (controlled)
  useEffect(() => {
    if (value !== undefined) setSelected(value);
  }, [value]);

  // ✅ คำนวณตำแหน่ง dropdown เทียบกับ viewport (ใช้ portal เพื่อไม่ให้ดันความสูงของ
  // ตาราง/คอนเทนเนอร์ที่มี overflow-y-auto — absolute เดิมทำให้พื้นที่เลื่อนขยายเอง)
  useEffect(() => {
    if (!isOpen) return;

    function updatePosition() {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setCoords({ top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width });

      const estimatedMenuHeight = Math.min(options.length * 36 + 8, 240); // เท่ากับ max-h-60 (240px)
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setDropUp(spaceBelow < estimatedMenuHeight + 8 && spaceAbove > spaceBelow);
    }

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, options.length]);

  // ปิด dropdown เมื่อคลิกข้างนอก (เช็คทั้ง trigger และเมนูที่ portal ออกไปแล้ว)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const insideTrigger = containerRef.current?.contains(target);
      const insideMenu = menuRef.current?.contains(target);
      if (!insideTrigger && !insideMenu) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // keyboard support
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") setIsOpen(false);
    if (e.key === "Enter" || e.key === " ") setIsOpen((prev) => !prev);
  }

  function handleSelect(opt: SelectOption) {
    if (opt.disabled) return;
    setSelected(opt.value);
    setIsOpen(false);
    onChange?.({ target: { value: opt.value } });
  }

  const selectedOption = options.find((o) => o.value === selected);

  const displayLabel = selectedOption?.label ?? placeholder ?? "เลือก...";

  const isPlaceholder = !selected || selected === "";

  return (
    <div className={cn("flex flex-col gap-1.5", containerClassName)}>
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}

      <div ref={containerRef} className="relative">

        {renderTrigger ? (
          // ✅ Custom trigger — ใช้ logic เปิด/ปิด dropdown เดิม แต่ปล่อยให้ผู้ใช้กำหนดหน้าตาเอง
          // (เช่น icon-only trigger แทน input-style เดิม)
          <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            id={selectId}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-invalid={!!error}
            onKeyDown={handleKeyDown}
            className={cn("outline-none focus:outline-none", disabled && "pointer-events-none opacity-60", className)}
          >
            {renderTrigger({
              isOpen,
              selectedOption,
              disabled,
              toggle: () => setIsOpen((prev) => !prev),
            })}
          </div>
        ) : (
          <>
            {/* Trigger Button (default) */}
            <button
              type="button"
              id={selectId}
              disabled={disabled}
              aria-haspopup="listbox"
              aria-expanded={isOpen}
              aria-invalid={!!error}
              onKeyDown={handleKeyDown}
              onClick={() => setIsOpen((prev) => !prev)}
              className={cn(
                "h-10 w-full rounded-none border-none bg-[#f6f3f2] px-3 pr-9 text-sm text-left",
                "transition-colors duration-150 ease-out cursor-pointer",
                "focus:outline-none focus:ring-1 focus:ring-offset-0",
                "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
                isPlaceholder ? "text-slate-400" : "text-slate-800",
                error
                  ? "border-red-500! focus:border-red-500 ring-1 ring-red-500"
                  // ✅ focus สีแดง
                  : "border-slate-300 focus:border-[#B70011] focus:ring-red-600",
                isOpen && "border-[#B70011] ring-1 ring-red-200",
                className
              )}
            >
              {displayLabel}
            </button>

            {/* Arrow Icon */}
            <svg
              className={cn(
                "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-transform",
                // ✅ arrow สีแดง (หรือสีเทาเมื่อ disabled)
                disabled ? "text-slate-300" : "text-[#B70011]",
                isOpen && "rotate-180"
              )}
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        )}

        {/* Dropdown — portal ออกไปที่ document.body กัน parent ที่มี overflow-y-auto (เช่นตาราง) ขยายพื้นที่เอง */}
        {isOpen && coords && createPortal(
          <ul
            ref={menuRef}
            role="listbox"
            aria-label={label}
            style={{
              position: "fixed",
              ...(dropUp
                ? { bottom: window.innerHeight - coords.top + 4 }
                : { top: coords.bottom + 4 }),
              ...(renderTrigger
                ? (menuAlign === "right"
                    ? { right: window.innerWidth - coords.right }
                    : { left: coords.left })
                : { left: coords.left, width: coords.width }),
            }}
            className={cn(
              "z-50 rounded-sm border border-slate-200 bg-white shadow-lg",
              "max-h-60 overflow-y-auto py-1",
              renderTrigger && "min-w-40 w-max"
            )}
          >
            {options.map((opt) => {
              const isSelected = opt.value === selected;
              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={opt.disabled}
                  onClick={() => handleSelect(opt)}
                  className={cn(
                    "px-3 py-2 text-sm cursor-pointer transition-colors",
                    // ✅ selected สีแดง
                    isSelected
                      ? "bg-[#E51C23] text-white font-normal"
                      : "text-slate-800 hover:bg-red-50 hover:text-[#B70011]",
                    opt.disabled && "cursor-not-allowed opacity-40"
                  )}
                >
                  {opt.label}
                </li>
              );
            })}
          </ul>,
          document.body
        )}

      </div>

      {error ? (
        <p id={`${selectId}-error`} className="text-xs text-red-500">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-slate-400">{helperText}</p>
      ) : null}
    </div>
  );
}