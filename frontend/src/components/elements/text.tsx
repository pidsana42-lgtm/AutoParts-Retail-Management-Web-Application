import React from 'react';

type TextVariant = 'body' | 'lead' | 'small' | 'muted';

interface TextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  variant?: TextVariant;
}

const Text: React.FC<TextProps> = ({ 
  variant = 'body', 
  className = '', 
  children, 
  ...props 
}) => {
  // ตั้งค่ามาตรฐานสำหรับแต่ละรูปแบบ พร้อมปรับระยะห่างบรรทัด (leading-relaxed) ให้อ่านง่าย
  const styles: Record<TextVariant, string> = {
    body: "text-base text-gray-800 leading-relaxed mb-4",
    lead: "text-lg md:text-xl text-gray-700 leading-relaxed mb-6 font-medium",
    small: "text-sm text-gray-600 mb-2",
    muted: "text-base text-gray-500 leading-relaxed mb-4",
  };

  return (
    <p className={`${styles[variant]} ${className}`} {...props}>
      {children}
    </p>
  );
};

export default Text;