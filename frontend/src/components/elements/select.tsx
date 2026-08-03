import { cn } from "../../utils/component";
import { useState, useRef, useEffect, useId } from "react";

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
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
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState(value ?? defaultValue);
  const containerRef = useRef<HTMLDivElement>(null);

  // sync ถ้า value เปลี่ยนจากข้างนอก (controlled)
  useEffect(() => {
    if (value !== undefined) setSelected(value);
  }, [value]);

  // ปิด dropdown เมื่อคลิกข้างนอก
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
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

  const displayLabel =
    options.find((o) => o.value === selected)?.label ?? placeholder ?? "เลือก...";

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

        {/* Trigger Button */}
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
            "h-10 w-full rounded-sm border bg-white px-3 pr-9 text-sm text-left",
            "transition-colors duration-150 ease-out",
            "focus:outline-none focus:ring-2 focus:ring-offset-0",
            "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
            isPlaceholder ? "text-slate-400" : "text-slate-800",
            error
              ? "border-red-400 focus:border-red-500 focus:ring-red-200"
              // ✅ focus สีแดง
              : "border-slate-300 focus:border-[#B70011] focus:ring-red-200",
            isOpen && "border-[#B70011] ring-2 ring-red-200",
            className
          )}
        >
          {displayLabel}
        </button>

        {/* Arrow Icon */}
        <svg
          className={cn(
            "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-transform",
            // ✅ arrow สีแดง
            "text-[#B70011]",
            isOpen && "rotate-180"
          )}
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        {/* Dropdown */}
        {isOpen && (
          <ul
            role="listbox"
            aria-label={label}
            className={cn(
              "absolute z-50 mt-1 w-full rounded-sm border border-slate-200 bg-white shadow-lg",
              "max-h-60 overflow-y-auto py-1"
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
                      ? "bg-[#B70011] text-white font-medium"
                      : "text-slate-800 hover:bg-red-50 hover:text-[#B70011]",
                    opt.disabled && "cursor-not-allowed opacity-40"
                  )}
                >
                  {opt.label}
                </li>
              );
            })}
          </ul>
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