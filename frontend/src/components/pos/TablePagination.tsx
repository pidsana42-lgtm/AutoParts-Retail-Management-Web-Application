import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import Text from "../elements/text";
import { cn } from "../../utils/component";
import { getPageNumbers } from "../../utils/poshelpers";

export interface TablePaginationProps {
  page: number;
  totalPages: number;
  totalRows: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  unitLabel?: string;
  limitOptions?: number[];
  className?: string;
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  page,
  totalPages,
  totalRows,
  limit,
  onPageChange,
  onLimitChange,
  unitLabel = "รายการ",
  limitOptions = [5, 10, 20, 50],
  className,
}) => {
  if (totalRows <= 0) return null;

  const startRow = Math.min((page - 1) * limit + 1, totalRows);
  const endRow = Math.min(page * limit, totalRows);

  // Pagination ควบคุมตารางแบบครบวงจร: แสดงจำนวนรายการทั้งหมด, แสดงช่วงรายการที่กำลังดูอยู่, เลือกจำนวนรายการต่อหน้า, และปุ่มควบคุมการเปลี่ยนหน้า (หน้าแรก, หน้าก่อนหน้า, หน้าถัดไป, หน้าสุดท้าย)
  // ตัวเลือกจำนวนรายการต่อหน้า (5, 10, 20, 50) สามารถปรับแต่งได้ผ่าน prop limitOptions
  // ข้อความระบุช่วงรายการและจำนวนทั้งหมด
  return (
    <div
      className={cn(
        "bg-[#FCFBFA] px-6 py-4 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500",
        className
      )}
    >
      {/* ฝั่งซ้าย: สรุปจำนวนรายการ และ Selector */}
      <div className="flex items-center gap-4">
        <Text variant="xs" className="text-[#5F5E5E] mb-0">
          แสดง {startRow} ถึง {endRow} จาก {totalRows} {unitLabel}
        </Text>

        <div className="flex items-center gap-2">
          <Text variant="xs" className="text-[#5F5E5E] mb-0">
            รายการต่อหน้า:
          </Text>
          <select
            value={limit}
            onChange={(e) => {
              onLimitChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="border border-gray-200 rounded-none px-2 py-1 text-gray-700 bg-white hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-300 cursor-pointer"
          >
            {limitOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ฝั่งขวา: Controls Navigation */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page === 1}
          onClick={() => onPageChange(1)}
          aria-label="หน้าแรก"
          className="p-1.5 rounded-none text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          disabled={page === 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          aria-label="หน้าก่อนหน้า"
          className="p-1.5 rounded-none text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {getPageNumbers(page, totalPages).map((p, idx) =>
          p === "..." ? (
            <span
              key={`ellipsis-${idx}`}
              className="px-2 text-gray-400 select-none"
            >
              ...
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(Number(p))}
              aria-current={page === p ? "page" : undefined}
              className={cn(
                "px-3 py-1.5 rounded-none font-medium text-xs transition-colors cursor-pointer",
                page === p
                  ? "bg-[#E51C23] text-white"
                  : "text-gray-600 hover:bg-gray-100 border border-transparent"
              )}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          disabled={page === totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          aria-label="หน้าถัดไป"
          className="p-1.5 rounded-none text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          type="button"
          disabled={page === totalPages}
          onClick={() => onPageChange(totalPages)}
          aria-label="หน้าสุดท้าย"
          className="p-1.5 rounded-none text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default TablePagination;
