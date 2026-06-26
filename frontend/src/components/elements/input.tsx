import React from 'react';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const InputField: React.FC<InputFieldProps> = ({
  label,
  id,
  type = 'text',
  error,
  className = '',
  ...props
}) => {
  return (
    <div className="w-full mb-5">
      {/* Label อยู่ด้านบนเสมอ */}
      {label && (
        <label 
          htmlFor={id} 
          className={`block mb-1.5 text-xs font-semibold uppercase tracking-wider ${
            error ? 'text-red-600' : 'text-gray-700'
          }`}
        >
          {label}
        </label>
      )}
      
      {/* Input Field */}
      <input
        type={type}
        id={id}
        // ปรับ Default ให้เป็นพื้นหลังสีเทา (bg-gray-100) และไม่มีขอบ (border-transparent) 
        // เมื่อคลิก (focus) จะเปลี่ยนเป็นสีขาวและมีขอบ/เงาสีแดงตามดีไซน์
        className={`block w-full p-3 text-sm rounded border transition-colors outline-none
          ${error 
            ? 'bg-red-50 border-red-500 text-red-900 focus:border-red-600 focus:ring-1 focus:ring-red-600 placeholder-red-300' 
            : 'bg-gray-100 border-transparent text-gray-900 focus:bg-white focus:border-[#B70011] focus:ring-1 focus:ring-[#B70011]'
          } ${className}`}
        {...props}
      />
      
      {/* แจ้งเตือนเมื่อกรอกผิด */}
      {error && (
        <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>
      )}
    </div>
  );
};

export default InputField;