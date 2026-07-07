import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../utils/component";
import React from "react";

const textVariants = cva("", {
  variants: {
    variant: {
      body:  "text-base text-gray-800 leading-relaxed mb-4",
      lead:  "text-lg md:text-xl text-gray-700 leading-relaxed mb-6 font-medium",
      small: "text-sm text-gray-600 mb-2",
      muted: "text-base text-gray-500 leading-relaxed mb-4",
    },
  },
  defaultVariants: {
    variant: "body",
  },
});

interface TextProps
  extends React.HTMLAttributes<HTMLParagraphElement>,
    VariantProps<typeof textVariants> {}

const Text = React.forwardRef<HTMLParagraphElement, TextProps>(
  ({ variant, className, children, ...props }, ref) => (
    <p
      ref={ref}
      className={cn(textVariants({ variant }), className)}
      {...props}
    >
      {children}
    </p>
  )
);

Text.displayName = "Text";

export { textVariants };
export default Text;