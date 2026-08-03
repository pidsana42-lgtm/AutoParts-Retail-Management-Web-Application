import { cva } from "class-variance-authority";
import { cn } from "../../utils/component";
import { type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes, type ReactNode } from "react";

const tableRowVariants = cva("border-b border-slate-100 last:border-0", {
  variants: {
    clickable: {
      true:  "cursor-pointer transition-colors hover:bg-slate-50",
      false: "",
    },
  },
  defaultVariants: { clickable: false },
});

const tableCellVariants = cva("px-4 py-3", {
  variants: {
    align: {
      left:   "text-left",
      center: "text-center",
      right:  "text-right",
    },
  },
  defaultVariants: { align: "left" },
});

export function Table({ className, children, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full min-w-max text-sm", className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ className, children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn("border-b border-slate-200 bg-slate-50", className)} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ className, children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn(className)} {...props}>
      {children}
    </tbody>
  );
}

export function TableFooter({ className, children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot className={cn("border-t border-slate-200 bg-slate-50", className)} {...props}>
      {children}
    </tfoot>
  );
}

export function TableRow({
  className,
  onClick,
  children,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      onClick={onClick}
      className={cn(tableRowVariants({ clickable: !!onClick }), className)}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({ className, children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cn("px-4 py-3 font-normal text-slate-500 text-left", className)} {...props}>
      {children}
    </th>
  );
}

export function TableCell({ className, children, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn(tableCellVariants(), "text-slate-700", className)} {...props}>
      {children}
    </td>
  );
}

export interface TableColumn<T> {
  key: string;
  header: string;
  align?: "left" | "center" | "right";
  width?: string;
  render?: (row: T, rowIndex: number) => ReactNode;
}

interface GenericTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  rowKey: (row: T, rowIndex: number) => string | number;
  isLoading?: boolean;
  emptyText?: string;
  onRowClick?: (row: T) => void;
  className?: string;
}

export function GenericTable<T>({
  columns,
  data,
  rowKey,
  isLoading = false,
  emptyText = "ไม่พบข้อมูล",
  onRowClick,
  className,
}: GenericTableProps<T>) {
  return (
    <div className={cn("overflow-x-auto rounded-none border border-slate-200", className)}>
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ width: col.width }}
                className={cn("px-4 py-3 font-normal text-slate-500", tableCellVariants({ align: col.align }))}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <tr key={`skeleton-${i}`} className="border-b border-slate-100">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <div className="h-3.5 w-full max-w-30 animate-pulse rounded bg-slate-100" />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400">
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr
                key={rowKey(row, rowIndex)}
                onClick={() => onRowClick?.(row)}
                className={tableRowVariants({ clickable: !!onRowClick })}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn("text-slate-700", tableCellVariants({ align: col.align }))}
                  >
                    {col.render
                      ? col.render(row, rowIndex)
                      : (row as Record<string, ReactNode>)[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default GenericTable;