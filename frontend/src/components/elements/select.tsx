import { type SelectHTMLAttributes, forwardRef, useId } from "react";

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  placeholder?: string;
  containerClassName?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      options,
      placeholder,
      containerClassName = "",
      className = "",
      id,
      required,
      defaultValue,
      ...rest
    },
    ref
  ) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;

    return (
      <div className={["flex flex-col gap-1.5", containerClassName].join(" ")}>
        {label && (
          <label
            htmlFor={selectId}
            className="text-sm font-medium text-slate-700"
          >
            {label}
            {required && <span className="ml-0.5 text-red-500">*</span>}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            required={required}
            defaultValue={defaultValue ?? ""}
            aria-invalid={!!error}
            aria-describedby={error ? `${selectId}-error` : undefined}
            className={[
              "h-10 w-full appearance-none rounded-none border bg-white px-3 pr-9 text-sm text-slate-800",
              "transition-colors duration-150 ease-out",
              "focus:outline-none focus:ring-2 focus:ring-offset-0",
              error
                ? "border-red-400 focus:border-red-500 focus:ring-red-200"
                : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-200",
              "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
              className,
            ].join(" ")}
            {...rest}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>

          <svg
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M5 7.5l5 5 5-5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {error ? (
          <p id={`${selectId}-error`} className="text-xs text-red-500">
            {error}
          </p>
        ) : helperText ? (
          <p className="text-xs text-slate-400">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = "Select";

export default Select;