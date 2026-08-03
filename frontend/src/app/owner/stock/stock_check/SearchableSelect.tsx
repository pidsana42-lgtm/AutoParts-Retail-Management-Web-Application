import { useState, useRef, useEffect, useId } from "react";
import { cn } from "../../../../utils/component";

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function SearchableSelect({
  label,
  error,
  options,
  placeholder,
  value,
  onChange,
  disabled,
}: SearchableSelectProps) {
  const selectId = useId();

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(opt: SelectOption) {
    if (opt.disabled) return;
    setIsOpen(false);
    setSearchTerm("");
    onChange(opt.value);
  }

  const filteredOptions = options.filter((o) => 
    o.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayLabel =
    options.find((o) => o.value === value)?.label ?? placeholder ?? "เลือก...";

  const isPlaceholder = !value || value === "";

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}

      <div ref={containerRef} className="relative">
        <button
          type="button"
          id={selectId}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((prev) => !prev)}
          className={cn(
            "h-10 w-full rounded-sm border bg-white px-3 pr-9 text-sm text-left",
            "transition-colors duration-150 ease-out",
            "focus:outline-none focus:ring-2 focus:ring-offset-0",
            "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
            isPlaceholder ? "text-slate-400" : "text-slate-800",
            error
              ? "border-red-400 focus:border-red-500 focus:ring-red-200"
              : "border-slate-300 focus:border-[#B70011] focus:ring-red-200",
            isOpen && "border-[#B70011] ring-2 ring-red-200"
          )}
        >
          {displayLabel}
        </button>

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
          <div
            className={cn(
              "absolute z-50 mt-1 w-full rounded-sm border border-slate-200 bg-white shadow-lg",
              "flex flex-col"
            )}
          >
            <div className="p-2 border-b border-slate-100">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="ค้นหาสินค้า..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-8 px-2 text-sm border border-slate-200 rounded-sm focus:outline-none focus:border-[#B70011] focus:ring-1 focus:ring-red-200 transition-colors"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsOpen(false);
                    setSearchTerm("");
                  }
                }}
                autoFocus
              />
            </div>
            
            <ul
              role="listbox"
              className="max-h-60 overflow-y-auto py-1"
            >
              {filteredOptions.length === 0 ? (
                <li className="px-3 py-4 text-sm text-center text-slate-400">ไม่พบสินค้าที่ค้นหา</li>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <li
                      key={opt.value}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={opt.disabled}
                      onClick={() => handleSelect(opt)}
                      className={cn(
                        "px-3 py-2 text-sm cursor-pointer transition-colors",
                        isSelected
                          ? "bg-[#B70011] text-white font-medium"
                          : "text-slate-800 hover:bg-red-50 hover:text-[#B70011]",
                        opt.disabled && "cursor-not-allowed opacity-40"
                      )}
                    >
                      {opt.label}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
