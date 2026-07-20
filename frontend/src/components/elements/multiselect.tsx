import { cn } from "../../utils/component";
import { useState, useRef, useEffect, useId } from "react";
import { X } from "lucide-react";

export interface MultiSelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

interface MultiSelectProps {
  label?: string;
  error?: string;
  helperText?: string;
  options: MultiSelectOption[];
  placeholder?: string;
  value?: string[];
  defaultValue?: string[];
  onChange?: (values: string[]) => void;
  containerClassName?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
}

export default function MultiSelect({
  label,
  error,
  helperText,
  options,
  placeholder,
  value,
  defaultValue = [],
  onChange,
  containerClassName,
  className,
  required,
  disabled,
  id,
}: MultiSelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(value ?? defaultValue);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value !== undefined) setSelected(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") setIsOpen(false);
    if ((e.key === "Enter" || e.key === " ") && !isOpen) {
      setIsOpen(true);
      e.preventDefault();
    }
  }

  function handleSelect(opt: MultiSelectOption, e: React.MouseEvent | React.KeyboardEvent) {
    e.stopPropagation();
    if (opt.disabled) return;
    
    let newSelected;
    if (selected.includes(opt.value)) {
      newSelected = selected.filter((v) => v !== opt.value);
    } else {
      newSelected = [...selected, opt.value];
    }
    
    setSelected(newSelected);
    onChange?.(newSelected);
  }

  function handleRemove(optValue: string, e: React.MouseEvent) {
    e.stopPropagation();
    const newSelected = selected.filter((v) => v !== optValue);
    setSelected(newSelected);
    onChange?.(newSelected);
  }

  const isPlaceholder = selected.length === 0;

  return (
    <div className={cn("flex flex-col gap-1.5", containerClassName)}>
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}

      <div ref={containerRef} className="relative">
        <div
          id={selectId}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-invalid={!!error}
          onKeyDown={handleKeyDown}
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          tabIndex={disabled ? -1 : 0}
          className={cn(
            "min-h-10 w-full rounded-sm border bg-white px-2 py-1 pr-9 text-sm text-left flex flex-wrap gap-1 items-center",
            "transition-colors duration-150 ease-out",
            "focus:outline-none focus:ring-2 focus:ring-offset-0",
            disabled && "cursor-not-allowed bg-slate-50 text-slate-400 opacity-60",
            !disabled && "cursor-pointer",
            error
              ? "border-red-400 focus:border-red-500 focus:ring-red-200"
              : "border-slate-300 focus:border-[#B70011] focus:ring-red-200",
            isOpen && "border-[#B70011] ring-2 ring-red-200",
            className
          )}
        >
          {isPlaceholder ? (
            <span className="text-slate-400 px-1 py-1">{placeholder ?? "เลือก..."}</span>
          ) : (
            selected.map((val) => {
              const opt = options.find((o) => o.value === val);
              if (!opt) return null;
              return (
                <span
                  key={val}
                  className="flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700"
                >
                  {opt.label}
                  <button
                    type="button"
                    onClick={(e) => handleRemove(val, e)}
                    className="rounded hover:bg-slate-200 hover:text-red-600 focus:outline-none ml-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })
          )}
        </div>

        <svg
          className={cn(
            "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-transform",
            "text-[#B70011]",
            isOpen && "rotate-180"
          )}
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        {isOpen && (
          <ul
            role="listbox"
            aria-multiselectable="true"
            aria-label={label}
            className={cn(
              "absolute z-50 mt-1 w-full rounded-sm border border-slate-200 bg-white shadow-lg",
              "max-h-60 overflow-y-auto py-1"
            )}
          >
            {options.map((opt) => {
              const isSelected = selected.includes(opt.value);
              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={opt.disabled}
                  onClick={(e) => handleSelect(opt, e)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleSelect(opt, e);
                    }
                  }}
                  tabIndex={0}
                  className={cn(
                    "px-3 py-2 text-sm cursor-pointer transition-colors flex items-center justify-between",
                    isSelected
                      ? "bg-red-50 text-[#B70011] font-medium"
                      : "text-slate-800 hover:bg-slate-50",
                    opt.disabled && "cursor-not-allowed opacity-40 focus:outline-none"
                  )}
                >
                  <span>{opt.label}</span>
                  {isSelected && (
                    <svg className="h-4 w-4 text-[#B70011]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </li>
              );
            })}
            {options.length === 0 && (
              <li className="px-3 py-2 text-sm text-slate-400 text-center">ไม่มีตัวเลือก</li>
            )}
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
