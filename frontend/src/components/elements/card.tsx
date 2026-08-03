import { cva } from "class-variance-authority";
import { cn } from "../../utils/component";
import { type HTMLAttributes, type ReactNode } from "react";

const cardVariants = cva(
  "rounded-none border border-slate-200 bg-white shadow-sm"
);

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  noPadding?: boolean;
  // legacy props ยังคงไว้เพื่อ backward compatible
  title?: string;
  subtitle?: string;
  headerAction?: ReactNode;
  footer?: ReactNode;
}

export function Card({
  noPadding = false,
  title,
  subtitle,
  headerAction,
  footer,
  className,
  children,
  ...rest
}: CardProps) {
  const hasHeader = title || subtitle || headerAction;

  // Legacy mode — ถ้าส่ง title/subtitle มาตรงๆ
  if (hasHeader || footer) {
    return (
      <div className={cn(cardVariants(), className)} {...rest}>
        {hasHeader && (
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              {title    && <h3 className="text-sm font-semibold text-slate-800">{title}</h3>}
              {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
            </div>
            {headerAction && <div className="shrink-0">{headerAction}</div>}
          </div>
        )}
        <div className={cn(!noPadding && "px-5 py-4")}>{children}</div>
        {footer && (
          <div className="border-t border-slate-100 px-5 py-3">{footer}</div>
        )}
      </div>
    );
  }

  // Composition mode — ใช้ CardHeader, CardContent ฯลฯ
  return (
    <div className={cn(cardVariants(), className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-sm font-semibold text-slate-800", className)} {...props}>
      {children}
    </h3>
  );
}

export function CardContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-5 py-4", className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export default Card;