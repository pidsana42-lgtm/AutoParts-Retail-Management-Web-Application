import React from 'react';

type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
type FontWeight = 'light' | 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold';

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: HeadingLevel;
  weight?: FontWeight;
}

const Heading: React.FC<HeadingProps> = ({ 
  level = 'h2', // ค่าเริ่มต้น
  weight,
  className = '', 
  children, 
  ...props 
}) => {
  const Tag = level; // แปลง level เป็น HTML Tag แบบไดนามิก (<h1/>, <h2/>)
  
  // ตั้งค่า
  const baseStyle = "font-heading text-gray-900";
  const sizeStyles: Record<HeadingLevel, string> = {
    h1: "text-4xl md:text-5xl tracking-tight mb-6",
    h2: "text-3xl md:text-4xl tracking-tight mb-5",
    h3: "text-2xl md:text-3xl mb-4",
    h4: "text-xl md:text-2xl mb-3",
    h5: "text-lg md:text-xl mb-2",
    h6: "text-base md:text-lg mb-2",
  };

  const weightStyles: Record<FontWeight, string> = {
    light: "font-light",
    normal: "font-normal",
    medium: "font-medium",
    semibold: "font-semibold",
    bold: "font-bold",
    extrabold: "font-extrabold",
  };
  
  const defaultWeights: Record<HeadingLevel, FontWeight> = {
    h1: 'bold', h2: 'semibold', h3: 'medium', 
    h4: 'medium', h5: 'medium', h6: 'medium'
  };

  const finalWeight = weight || defaultWeights[level];

  return (
    <Tag className={`${baseStyle} ${sizeStyles[level]} ${weightStyles[finalWeight]} ${className}`}{...props}>
      {children}
    </Tag>
  );
};

export default Heading;