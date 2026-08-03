import React, { useState, useRef, useEffect } from "react";
import { ChevronRight, ChevronLeft, ChevronDown, Check } from "lucide-react";

export interface CascaderOption {
  value: string;
  label: string;
  children?: CascaderOption[];
}

interface CascaderProps {
  options: CascaderOption[];
  value: string[]; // e.g. ["cat1", "sub1", "subsub1"]
  onChange: (value: string[], selectedOptions: CascaderOption[]) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  changeOnSelect?: boolean;
  expandDirection?: "right" | "left";
}

const Cascader: React.FC<CascaderProps> = ({
  options,
  value,
  onChange,
  placeholder = "Select...",
  label,
  required,
  changeOnSelect,
  expandDirection = "right",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activePath, setActivePath] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // When value changes from outside, reset activePath to value
  useEffect(() => {
    if (isOpen) {
      setActivePath(value || []);
    }
  }, [isOpen, value]);

  const handleOptionClick = (
    option: CascaderOption,
    level: number,
    path: CascaderOption[]
  ) => {
    const newActivePath = [...activePath.slice(0, level), option.value];
    setActivePath(newActivePath);

    if (!option.children || option.children.length === 0 || changeOnSelect) {
      // Leaf node clicked or changeOnSelect is true, commit selection
      onChange(newActivePath, path);
      if (!option.children || option.children.length === 0 || option.value === "") {
        setIsOpen(false);
      }
    }
  };

  const getDisplayLabel = () => {
    if (!value || value.length === 0) return "";

    let currentOptions = options;
    const labels = [];

    for (const val of value) {
      const opt = currentOptions.find((o) => o.value === val);
      if (opt) {
        labels.push(opt.label);
        currentOptions = opt.children || [];
      } else {
        break;
      }
    }
    return labels.join(" / ");
  };

  // Render a single menu level
  const renderMenu = (
    menuOptions: CascaderOption[],
    level: number,
    parentPath: CascaderOption[]
  ) => {
    if (!menuOptions || menuOptions.length === 0) return null;

    const activeValue = activePath[level];

    return (
      <ul className="min-w-[160px] max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-md shadow-sm py-1">
        {menuOptions.map((opt) => {
          const isActive = activeValue === opt.value;
          const isSelected = value && value[level] === opt.value;
          const hasChildren = opt.children && opt.children.length > 0;
          const currentPath = [...parentPath, opt];

          return (
            <li
              key={opt.value}
              className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between hover:bg-slate-50 transition-colors ${isActive ? "bg-slate-50 text-blue-600 font-medium" : "text-slate-700"
                }`}
              onClick={(e) => {
                e.stopPropagation();
                handleOptionClick(opt, level, currentPath);
              }}
              onMouseEnter={() => {
                if (hasChildren) {
                  const newActivePath = [...activePath.slice(0, level), opt.value];
                  setActivePath(newActivePath);
                }
              }}
            >
              {expandDirection === "left" && hasChildren && (
                <ChevronLeft className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" />
              )}
              <span className={`truncate ${expandDirection === "left" ? "text-right flex-1" : ""}`}>{opt.label}</span>
              {expandDirection === "right" && hasChildren && (
                <ChevronRight className="w-4 h-4 text-slate-400 ml-2 flex-shrink-0" />
              )}
              {!hasChildren && isSelected && (
                <Check className="w-4 h-4 text-blue-600 ml-2 flex-shrink-0" />
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  // Compute the cascading menus based on activePath
  const renderCascadingMenus = () => {
    const menus = [];
    let currentOptions = options;
    let currentPath: CascaderOption[] = [];

    // First level
    menus.push(
      <div key="level-0" className="flex-shrink-0">
        {renderMenu(currentOptions, 0, currentPath)}
      </div>
    );

    // Subsequent levels
    for (let i = 0; i < activePath.length; i++) {
      const activeVal = activePath[i];
      const activeOpt = currentOptions.find((o) => o.value === activeVal);

      if (activeOpt && activeOpt.children && activeOpt.children.length > 0) {
        currentOptions = activeOpt.children;
        currentPath = [...currentPath, activeOpt];
        menus.push(
          <div key={`level-${i + 1}`} className="flex-shrink-0 ml-1">
            {renderMenu(currentOptions, i + 1, currentPath)}
          </div>
        );
      } else {
        break;
      }
    }

    return (
      <div className={`absolute z-50 top-full mt-1 ${expandDirection === "left" ? "right-0" : "left-0"} flex items-start bg-transparent`}>
        <div className={`flex ${expandDirection === "left" ? "flex-row-reverse" : ""} bg-white rounded-md shadow-xl border border-slate-200 p-0.5`}>
          {menus}
        </div>
      </div>
    );
  };

  const displayLabel = getDisplayLabel();

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      {label && (
        <label className="text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <div
          className={`flex items-center justify-between w-full px-3 py-2 bg-white border rounded-lg cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${isOpen ? "border-blue-500 ring-2 ring-blue-500/20" : "border-slate-300 hover:border-slate-400"
            }`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className={`block truncate ${!displayLabel ? "text-slate-400" : "text-slate-900"}`}>
            {displayLabel || placeholder}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""
              }`}
          />
        </div>

        {isOpen && renderCascadingMenus()}
      </div>
    </div>
  );
};

export default Cascader;
