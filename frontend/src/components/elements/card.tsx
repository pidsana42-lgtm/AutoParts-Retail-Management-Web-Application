import { type HTMLAttributes, type ReactNode } from "react";

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  subtitle?: ReactNode;
  headerAction?: ReactNode;
  footer?: ReactNode;
  noPadding?: boolean;
}

export default function Card({
  title,
  subtitle,
  headerAction,
  footer,
  noPadding = false,
  className = "",
  children,
  ...rest
}: CardProps) {
  const hasHeader = title || subtitle || headerAction;

  return (
    <div
      className={[
        "rounded-none border border-slate-200 bg-white shadow-sm",
        className,
      ].join(" ")}
      {...rest}
    >
      {hasHeader && (
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            {title && (
              <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
            )}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}

      <div className={noPadding ? "" : "px-5 py-4"}>{children}</div>

      {footer && (
        <div className="border-t border-slate-100 px-5 py-3">{footer}</div>
      )}
    </div>
  );
}