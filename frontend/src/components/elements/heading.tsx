import { cva } from "class-variance-authority";
import { cn } from "../../utils/component";
import React from "react";

type HeadingLevel  = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
type HeadingWeight = "light" | "normal" | "medium" | "semibold" | "bold" | "extrabold";

const headingVariants = cva("font-heading text-gray-900", {
  variants: {
    level: {
      h1: "text-4xl md:text-5xl tracking-tight mb-6",
      h2: "text-3xl md:text-4xl tracking-tight mb-5",
      h3: "text-2xl md:text-3xl mb-4",
      h4: "text-xl md:text-2xl mb-3",
      h5: "text-lg md:text-xl mb-2",
      h6: "text-base md:text-lg mb-2",
    },
    weight: {
      light:     "font-light",
      normal:    "font-normal",
      medium:    "font-medium",
      semibold:  "font-semibold",
      bold:      "font-bold",
      extrabold: "font-extrabold",
    },
  },
  defaultVariants: {
    level:  "h2",
    weight: "semibold",
  },
});

const defaultWeights: Record<HeadingLevel, HeadingWeight> = {
  h1: "bold",
  h2: "semibold",
  h3: "medium",
  h4: "medium",
  h5: "medium",
  h6: "medium",
};

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?:  HeadingLevel;
  weight?: HeadingWeight;
}

const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ level = "h2", weight, className, children, ...props }, ref) => {

    const Tag = level as React.ElementType;

    const finalWeight = weight ?? defaultWeights[level];

    return (
      <Tag
        ref={ref}
        className={cn(headingVariants({ level, weight: finalWeight }), className)}
        {...props}
      >
        {children}
      </Tag>
    );
  }
);

Heading.displayName = "Heading";

export { headingVariants };
export default Heading;