import type  { ReactNode } from "react";

export interface TableColumn<T> {
  key: string;
  header: string;
  align?: "left" | "center" | "right";
  width?: string;
  render?: (row: T, rowIndex: number) => ReactNode;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  rowKey: (row: T, rowIndex: number) => string | number;
  isLoading?: boolean;
  emptyText?: string;
  onRowClick?: (row: T) => void;
  className?: string;
}

const alignClass: Record<"left" | "center" | "right", string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export default function Table<T>({
  columns,
  data,
  rowKey,
  isLoading = false,
  emptyText = "ไม่พบข้อมูล",
  onRowClick,
  className = "",
}: TableProps<T>) {
  return (
    <div className={["overflow-x-auto rounded-none border border-slate-200", className].join(" ")}>
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ width: col.width }}
                className={[
                  "px-4 py-3 font-medium text-slate-500",
                  alignClass[col.align ?? "left"],
                ].join(" ")}
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
              <td
                colSpan={columns.length}
                className="px-4 py-10 text-center text-slate-400"
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr
                key={rowKey(row, rowIndex)}
                onClick={() => onRowClick?.(row)}
                className={[
                  "border-b border-slate-100 last:border-0",
                  onRowClick
                    ? "cursor-pointer transition-colors hover:bg-slate-50"
                    : "",
                ].join(" ")}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={[
                      "px-4 py-3 text-slate-700",
                      alignClass[col.align ?? "left"],
                    ].join(" ")}
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