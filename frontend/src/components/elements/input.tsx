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

      <input
        type={type}
        id={id}
        className={`block w-full p-3 text-sm rounded-none outline-none border transition-colors 
          ${error 
            ? 'bg-red-50 border-red-500 text-red-900 focus:border-red-600 placeholder-red-300' 
            : 'bg-white border-gray-300 text-gray-900 focus:border-black'
          } ${className}`}
        {...props}
      />

      {error && (
        <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>
      )}
    </div>
  );
};

export default InputField;