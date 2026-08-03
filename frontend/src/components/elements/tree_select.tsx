import React, { useState, useRef, useEffect } from "react";
import { ChevronRight, ChevronDown, Check } from "lucide-react";
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
          "flex items-center justify-between py-2 pr-3 cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-50/50",
          isSelected ? "text-blue-600 bg-blue-50/50 font-medium" : "text-slate-700"
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
              className="p-1 -ml-1 cursor-pointer rounded hover:bg-slate-200 text-slate-400"
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
        {isSelected && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
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
}: TreeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  return (
    <div className={cn("flex flex-col gap-1.5", containerClassName)} ref={containerRef}>
      {label && (
        <label className="text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex w-full items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2",
            isOpen ? "border-blue-500 ring-2 ring-blue-500/20" : "border-slate-300 hover:border-slate-400"
          )}
        >
          <span className={cn("block truncate text-left", !displayLabel && "text-slate-400")}>
            {displayLabel || placeholder}
          </span>
          <ChevronDown
            className={cn("w-4 h-4 text-slate-400 transition-transform", isOpen && "rotate-180")}
          />
        </button>

        {isOpen && (
          <div className="absolute z-50 top-full mt-1 left-0 w-full md:min-w-[280px] max-h-80 overflow-y-auto bg-white rounded-md shadow-xl border border-slate-200 p-1">
            {options.map((opt) => (
              <TreeNode
                key={opt.value}
                option={opt}
                depth={0}
                selectedValue={value}
                onSelect={(val, path) => {
                  onChange(val, path);
                  setIsOpen(false);
                }}
                expandedIds={expandedIds}
                toggleExpand={toggleExpand}
                currentPath={[]}
              />
            ))}
            {options.length === 0 && (
              <div className="p-3 text-sm text-center text-slate-400">ไม่มีข้อมูล</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
