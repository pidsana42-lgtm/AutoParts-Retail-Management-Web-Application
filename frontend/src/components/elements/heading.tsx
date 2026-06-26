import React from 'react';

type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: HeadingLevel;
}

const Heading: React.FC<HeadingProps> = ({ 
  level = 'h2', // ค่าเริ่มต้น
  className = '', 
  children, 
  ...props 
}) => {
  const Tag = level; // แปลง level เป็น HTML Tag แบบไดนามิก (<h1/>, <h2/>)
  
  // ตั้งค่า
  const baseStyle = "font-heading text-gray-900";
  const styles: Record<HeadingLevel, string> = {
    h1: "text-4xl md:text-5xl font-bold tracking-tight mb-6",
    h2: "text-3xl md:text-4xl font-semibold tracking-tight mb-5",
    h3: "text-2xl md:text-3xl font-medium mb-4",
    h4: "text-xl md:text-2xl font-medium mb-3",
    h5: "text-lg md:text-xl font-medium mb-2",
    h6: "text-base md:text-lg font-medium mb-2",
  };

  return (
    <Tag className={`${baseStyle} ${styles[level]} ${className}`} {...props}>
      {children}
    </Tag>
  );
};

export default Heading;