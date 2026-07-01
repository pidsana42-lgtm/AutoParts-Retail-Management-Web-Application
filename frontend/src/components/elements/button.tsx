import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../utils/component";
import React from "react";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 font-medium cursor-pointer",
    "rounded-sm transition-colors ",
    "focus:outline-none",
    "disabled:opacity-60 disabled:cursor-not-allowed",
  ],
  {
    variants: {
      variant: {
        primary: [
          "bg-gradient-to-r from-[#B70011] to-[#E51C23] text-white",
          "hover:from-[#9e0010] hover:to-[#c9181f]",
        ],
        secondary: "bg-black text-white hover:bg-gray-800",
        tertiary:  "bg-[#E5E2E1] text-black hover:bg-[#D4D0CE]",
        danger:    "bg-red-700 text-white hover:bg-red-800",
        outline:   "border-2 border-red-600 text-red-600 hover:bg-red-50",
      },
      size: {
        sm: "px-3 py-1.5 text-sm",
        md: "px-4 py-2 text-base",
        lg: "px-6 py-3 text-lg",
      },
    },
    defaultVariants: {
      variant: "primary",
      size:    "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  leftIcon?:  React.ReactNode;  // ✅ เพิ่มใหม่
  rightIcon?: React.ReactNode;  // ✅ เพิ่มใหม่
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant, size, isLoading = false, disabled = false,
     leftIcon, rightIcon, className, ...props }, ref) => {

    const spinner = (
      <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    );

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {isLoading ? spinner : leftIcon}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = "Button";

export { buttonVariants };
export default Button;