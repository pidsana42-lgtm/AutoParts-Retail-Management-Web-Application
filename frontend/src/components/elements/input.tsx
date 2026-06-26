import { type InputHTMLAttributes, type ReactNode, forwardRef, useId } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
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
      containerClassName = "",
      className = "",
      id,
      required,
      ...rest
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    return (
      <div className={["flex flex-col gap-1.5", containerClassName].join(" ")}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-slate-700"
          >
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
            className={[
              "h-10 w-full rounded-none bg-gray-100 px-3 text-sm text-slate-800",
              "placeholder:text-slate-400",
              "transition-colors duration-150 ease-out",
              error
                ? "border border-red-400 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200"
                : "border-none focus:outline-none focus:ring-0",
              "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
              leftIcon ? "pl-12" : "",
              rightIcon ? "pr-9" : "",
              className,
            ].join(" ")}
            {...rest}
          />

          {rightIcon && (
            <span className="absolute right-3 flex items-center text-slate-400">
              {rightIcon}
            </span>
          )}
        </div>

        {error ? (
          <p id={`${inputId}-error`} className="text-xs text-red-500">
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

export default Input;