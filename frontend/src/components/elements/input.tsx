import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../utils/component";
import { type InputHTMLAttributes, type ReactNode, forwardRef, useId } from "react";

const inputVariants = cva(
  [
    "h-10 w-full rounded-none bg-gray-100 px-3 text-sm text-slate-800",
    "placeholder:text-slate-400",
    "transition-colors duration-150 ease-out",
    "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
  ],
  {
    variants: {
      hasError: {
        //เพิ่มการจัดการ focus state สำหรับ input ที่มี error
        true:  "border border-red-400 focus:outline-none focus:border-red-500 ring-1 ring-red-500", // ไฮไลต์ขอบสีแดง 1px ตอนกรอกข้อมูลไม่ถูกต้อง
        false: "border-none focus:outline-none",
      },
      hasLeftIcon: {
        true:  "pl-12",
        false: "",
      },
      hasRightIcon: {
        true:  "pr-9",
        false: "",
      },
    },
    defaultVariants: {
      hasError:     false,
      hasLeftIcon:  false,
      hasRightIcon: false,
    },
  }
);

interface InputProps
  extends InputHTMLAttributes<HTMLInputElement>,
    Omit<VariantProps<typeof inputVariants>, "hasError" | "hasLeftIcon" | "hasRightIcon"> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  containerClassName?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      containerClassName,
      className,
      id,
      required,
      ...rest
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    return (
      <div className={cn("flex flex-col gap-1.5", containerClassName)}>
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
            {label}
            {required && <span className="ml-0.5 text-red-500">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <span className="pointer-events-none absolute left-3 flex items-center text-slate-400">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            required={required}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
            className={cn(
              inputVariants({
                hasError:     !!error,
                hasLeftIcon:  !!leftIcon,
                hasRightIcon: !!rightIcon,
              }),
               rest.type === "date" && "[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:hover:opacity-100",
              className
            )}
            {...rest}
          />

          {rightIcon && (
            <span className="absolute right-3 flex items-center text-slate-400">
              {rightIcon}
            </span>
          )}
        </div>

        {error ? (
          <p id={`${inputId}-error`} className="text-xs text-red-500 text-left mt-0.5">
            {error}
          </p>
        ) : helperText ? (
          <p className="text-xs text-slate-400">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";

export { inputVariants };
export default Input;