import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    disabled = false,
    className = '',
    ...props
}) => {
    // Base Styles
    const baseClasses = [
        "inline-flex items-center justify-center font-medium", // การจัดวาง
        "rounded-none",                                        // ขอบเหลี่ยม
        "transition-colors",                                   // อนิเมชั่นตอนเปลี่ยนสี
        "focus:outline-none focus:ring-2 focus:ring-offset-2", // สไตล์ตอนกด Tab หรือ Focus
        "disabled:opacity-60 disabled:cursor-not-allowed"      // สไตล์ตอนปุ่มถูก Disable
    ].join(" ");

    // Size Styles
    const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
        sm: "px-3 py-1.5 text-sm",
        md: "px-4 py-2 text-base",
        lg: "px-6 py-3 text-lg",
    };

    // Variant Styles
    const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
        primary: [
            "bg-gradient-to-r from-red-600 via-red-800 to-red-950 text-white",
            "hover:from-red-700 hover:via-red-900 hover:to-red-950", 
            "focus:ring-red-500"
        ].join(" "),
        secondary: "bg-black-200 text-white hover:bg-black-300 focus:ring-black-500",
        danger: "bg-red-700 text-white hover:bg-red-800 focus:ring-red-600",
        outline: "border-2 border-red-600 text-red-600 hover:bg-red-50 focus:ring-red-500",
    };

    // Spinner
    const spinner = (
        <svg 
        className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" 
        xmlns="http://www.w3.org/2000/svg" 
        fill="none" 
        viewBox="0 0 24 24"
        >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    );

    return (
        <button
        disabled={disabled || isLoading}
        className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
        {...props}
        >
        {isLoading && spinner}
        {children}
        </button>
    );
};

export default Button;