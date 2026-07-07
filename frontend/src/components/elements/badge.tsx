import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../utils/component";
import { type HTMLAttributes } from "react";

const badgeVariants = cva(
  [
    "inline-flex items-center justify-center gap-1",
    "font-medium leading-none rounded-sm",
  ],
  {
    variants: {
      variant: {
        primary:     "bg-red-100 text-red-700",
        success:     "bg-green-100 text-green-700",
        error:       "bg-red-100 text-red-600",
        destructive: "bg-red-600 text-white",        // ✅ เพิ่มใหม่
        warning:     "bg-yellow-100 text-yellow-700",
        info:        "bg-blue-100 text-blue-700",
        neutral:     "bg-slate-100 text-slate-600",
        outline:     "border border-current bg-transparent text-slate-600",
      },
      size: {
        sm: "min-w-[4rem] px-1.5 py-0.5 text-xs",
        md: "min-w-[5rem] px-2 py-0.5 text-xs",
        lg: "min-w-[6rem] px-2.5 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size:    "md",
    },
  }
);

const dotVariants = cva("rounded-full shrink-0", {
  variants: {
    variant: {
      primary:     "bg-red-500",
      success:     "bg-green-500",
      error:       "bg-red-500",
      destructive: "bg-white",
      warning:     "bg-yellow-500",
      info:        "bg-blue-500",
      neutral:     "bg-slate-400",
      outline:     "bg-slate-400",
    },
    size: {
      sm: "h-1 w-1",
      md: "h-1.5 w-1.5",
      lg: "h-2 w-2",
    },
  },
  defaultVariants: {
    variant: "neutral",
    size:    "md",
  },
});

type BadgeVariantType = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;
type BadgeSizeType    = NonNullable<VariantProps<typeof badgeVariants>["size"]>;

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?:  BadgeVariantType;
  size?:     BadgeSizeType;
  dot?:      boolean;
  onRemove?: () => void;
}

export function Badge({
  variant  = "neutral",
  size     = "md",
  dot      = false,
  onRemove,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && <span aria-hidden="true" className={dotVariants({ variant, size })} />}
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="ลบ"
          className="ml-0.5 rounded-sm transition-opacity hover:opacity-70 focus:outline-none focus-visible:ring-1 focus-visible:ring-current"
        >
          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </span>
  );
}

export { badgeVariants };
export default Badge;