import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, ChevronDown, Check, Search } from "lucide-react";
import type { CascaderOption } from "./cascader";
import { cn } from "../../utils/component";

interface TreeSelectProps {
  options: CascaderOption[];
  value: string;
  onChange: (value: string, path: CascaderOption[]) => void;
  placeholder?: string;
  containerClassName?: string;
  label?: string;
  required?: boolean;
  // ซ่อนช่องค้นหาได้ถ้าไม่ต้องการ (default เปิด)
  searchable?: boolean;
  searchPlaceholder?: string;
}

// กรองต้นไม้ตามคำค้น: เก็บ node ที่ label ตรง หรือมีลูกหลานที่ตรง (ถ้า node เองตรงแล้ว โชว์ลูกทั้งหมดแบบเดิม)
function filterTree(options: CascaderOption[], term: string): CascaderOption[] {
  const lower = term.toLowerCase();
  const result: CascaderOption[] = [];
  for (const opt of options) {
    const selfMatch = opt.label.toLowerCase().includes(lower);
    const filteredChildren = opt.children ? filterTree(opt.children, term) : undefined;
    if (selfMatch || (filteredChildren && filteredChildren.length > 0)) {
      result.push({
        ...opt,
        children: selfMatch ? opt.children : filteredChildren,
      });
    }
  }
  return result;
}

// เก็บ value ของทุก node ที่มีลูก เพื่อกางกิ่งทั้งหมดอัตโนมัติตอนกำลังค้นหา
function collectExpandableIds(options: CascaderOption[]): Set<string> {
  const ids = new Set<string>();
  const walk = (opts: CascaderOption[]) => {
    for (const o of opts) {
      if (o.children && o.children.length > 0) {
        ids.add(o.value);
        walk(o.children);
      }
    }
  };
  walk(options);
  return ids;
}

const TreeNode = ({
  option,
  depth,
  selectedValue,
  onSelect,
  expandedIds,
  toggleExpand,
  currentPath,
}: {
  option: CascaderOption;
  depth: number;
  selectedValue: string;
  onSelect: (val: string, path: CascaderOption[]) => void;
  expandedIds: Set<string>;
  toggleExpand: (val: string) => void;
  currentPath: CascaderOption[];
}) => {
  const hasChildren = option.children && option.children.length > 0;
  const isExpanded = expandedIds.has(option.value);
  const isSelected = selectedValue === option.value;
  const path = [...currentPath, option];

  return (
    <div>
      <div
        className={cn(
          "flex items-center justify-between py-2 pr-3 cursor-pointer transition-colors border-b border-slate-50/50",
          // ✅ selected สีแดง เหมือน select.tsx
          isSelected ? "bg-[#E51C23] text-white font-normal" : "text-slate-800 hover:bg-red-50 hover:text-[#B70011]"
        )}
        style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
        onClick={() => {
          onSelect(option.value, path);
          if (hasChildren && !isExpanded) {
            toggleExpand(option.value);
          }
        }}
      >
        <div className="flex items-center gap-1.5 flex-1 overflow-hidden">
          {hasChildren ? (
            <div
              className={cn(
                "p-1 -ml-1 cursor-pointer rounded hover:bg-black/10",
                isSelected ? "text-white" : "text-slate-400"
              )}
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(option.value);
              }}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </div>
          ) : (
            <div className="w-4 ml-1" />
          )}
          <span className="truncate">{option.label}</span>
        </div>
        {isSelected && <Check className="w-4 h-4 text-white shrink-0" />}
      </div>
      {hasChildren && isExpanded && (
        <div className="flex flex-col">
          {option.children!.map((child) => (
            <TreeNode
              key={child.value}
              option={child}
              depth={depth + 1}
              selectedValue={selectedValue}
              onSelect={onSelect}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              currentPath={path}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function TreeSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  containerClassName,
  label,
  required,
  searchable = true,
  searchPlaceholder = "ค้นหา...",
}: TreeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [dropUp, setDropUp] = useState(false);
  const [coords, setCoords] = useState<{ top: number; bottom: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ปิด dropdown แล้วล้างคำค้นหาทิ้ง
  useEffect(() => {
    if (!isOpen) setSearchTerm("");
  }, [isOpen]);

  const visibleOptions = searchTerm ? filterTree(options, searchTerm) : options;
  const visibleExpandedIds = searchTerm ? collectExpandableIds(visibleOptions) : expandedIds;

  // ✅ คำนวณตำแหน่ง dropdown เทียบกับ viewport (ใช้ portal เหมือน select.tsx เพื่อไม่ให้ถูก
  // parent ที่มี overflow ตัดขอบ และไม่ต้องพึ่ง z-50 hack จากฝั่งที่เรียกใช้)
  useEffect(() => {
    if (!isOpen) return;

    function updatePosition() {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setCoords({ top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width });

      const estimatedMenuHeight = Math.min(options.length * 36 + 16, 320); // เท่ากับ max-h-80 (320px)
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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") setIsOpen(false);
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    }
  }

  const getDisplayLabel = () => {
    if (!value) return "";

    // Breadcrumb logic
    const findPath = (opts: CascaderOption[], target: string, path: string[] = []): string[] | null => {
      for (const o of opts) {
        if (o.value === target) return [...path, o.label];
        if (o.children) {
          const res = findPath(o.children, target, [...path, o.label]);
          if (res) return res;
        }
      }
      return null;
    };

    const path = findPath(options, value);
    return path ? path.join(" / ") : "";
  };

  const displayLabel = getDisplayLabel();
  const isPlaceholder = !displayLabel;

  return (
    <div className={cn("flex flex-col gap-1.5", containerClassName)}>
      {label && (
        <label className="text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}

      <div className="relative" ref={containerRef}>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          onKeyDown={handleKeyDown}
          onClick={() => setIsOpen((prev) => !prev)}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-sm border bg-white px-3 pr-9 text-sm text-left",
            "transition-colors duration-150 ease-out",
            "focus:outline-none focus:ring-2 focus:ring-offset-0",
            // ✅ focus/open สีแดง เหมือน select.tsx
            "border-slate-300 hover:border-slate-400",
            isOpen && "border-[#B70011] ring-2 ring-red-200"
          )}
        >
          <span className={cn("block truncate", isPlaceholder && "text-slate-400")}>
            {displayLabel || placeholder}
          </span>
        </button>

        {/* Arrow Icon — สีแดงเหมือน select.tsx */}
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

        {/* Dropdown — portal ออกไปที่ document.body เหมือน select.tsx กัน parent ตัดขอบ */}
        {isOpen && coords && createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label={label}
            style={{
              position: "fixed",
              ...(dropUp
                ? { bottom: window.innerHeight - coords.top + 4 }
                : { top: coords.bottom + 4 }),
              left: coords.left,
              width: Math.max(coords.width, 280),
              maxHeight: 320,
            }}
            className="z-50 flex flex-col rounded-sm border border-slate-200 bg-white shadow-lg"
          >
            {searchable && (
              <div className="border-b border-slate-100 p-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={searchPlaceholder}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    className="h-8 w-full rounded-sm border border-slate-200 pl-7 pr-2 text-sm transition-colors focus:border-[#B70011] focus:outline-none focus:ring-1 focus:ring-red-200"
                  />
                </div>
              </div>
            )}

            <div className="overflow-y-auto p-1">
              {visibleOptions.map((opt) => (
                <TreeNode
                  key={opt.value}
                  option={opt}
                  depth={0}
                  selectedValue={value}
                  onSelect={(val, path) => {
                    onChange(val, path);
                    setIsOpen(false);
                  }}
                  expandedIds={visibleExpandedIds}
                  toggleExpand={toggleExpand}
                  currentPath={[]}
                />
              ))}
              {visibleOptions.length === 0 && (
                <div className="p-3 text-center text-sm text-slate-400">
                  {searchTerm ? "ไม่พบผลลัพธ์ที่ค้นหา" : "ไม่มีข้อมูล"}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}
