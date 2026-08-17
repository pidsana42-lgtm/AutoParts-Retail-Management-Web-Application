import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

function getPageNumbers(current: number, total: number): (number | "...")[] {
  const delta = 1; // จำนวนหน้าที่แสดงข้างๆ หน้าปัจจุบัน
  const range: (number | "...")[] = [];
  const left = Math.max(2, current - delta);
  const right = Math.min(total - 1, current + delta);

  range.push(1);
  if (left > 2) range.push("...");
  for (let i = left; i <= right; i++) range.push(i);
  if (right < total - 1) range.push("...");
  if (total > 1) range.push(total);

  return range;
}

interface TablePaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (itemsPerPage: number) => void;
  /** หน่วยของแถวที่กำลังนับ เช่น "หน่วยสินค้า", "ประเภทสินค้า" */
  itemLabel?: string;
}

export default function TablePagination({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  itemLabel = "รายการ",
}: TablePaginationProps) {
  if (totalItems === 0) return null;

  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  return (
    <div className="bg-[#fcfbfa] px-6 py-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
      <div className="flex items-center gap-4">
        <span>
          แสดง {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} ถึง{" "}
          {Math.min(currentPage * itemsPerPage, totalItems)} จาก {totalItems} {itemLabel}
        </span>
        <div className="flex items-center gap-2">
          <span>รายการต่อหน้า:</span>
          <select
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
            className="border border-slate-200 rounded-none px-2 py-1 text-slate-600 bg-white hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-200 cursor-pointer"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          disabled={currentPage === 1}
          onClick={() => onPageChange(1)}
          aria-label="หน้าแรก"
          className="p-1.5 rounded-none text-slate-400 hover:bg-slate-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="หน้าก่อนหน้า"
          className="p-1.5 rounded-none text-slate-400 hover:bg-slate-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {getPageNumbers(currentPage, totalPages).map((page, idx) =>
          page === "..." ? (
            <span key={`ellipsis-${idx}`} className="px-2 text-slate-400">
              ...
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              aria-current={currentPage === page ? "page" : undefined}
              className={[
                "px-3 py-1.5 rounded-none font-medium transition-colors cursor-pointer",
                currentPage === page ? "bg-[#B70011] text-white" : "text-slate-600 hover:bg-slate-100",
              ].join(" ")}
            >
              {page}
            </button>
          )
        )}

        <button
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="หน้าถัดไป"
          className="p-1.5 rounded-none text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(totalPages)}
          aria-label="หน้าสุดท้าย"
          className="p-1.5 rounded-none text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
