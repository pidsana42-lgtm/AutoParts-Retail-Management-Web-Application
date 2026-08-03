import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../utils/component";
import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

const modalPanelVariants = cva(
  [
    "relative z-10 w-full rounded-none bg-white shadow-xl",
    "animate-in fade-in zoom-in-95 duration-150",
  ],
  {
    variants: {
      size: {
        sm: "max-w-sm",
        md: "max-w-md",
        lg: "max-w-2xl",
        xl: "max-w-4xl",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

interface ModalProps extends VariantProps<typeof modalPanelVariants> {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  size,
  footer,
  children,
  className,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className={cn(modalPanelVariants({ size }), className)}>
        {(title || description) && (
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              {title && (
                <h2 id="modal-title" className="text-base font-semibold text-slate-800">
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-0.5 text-sm text-slate-400">{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="ปิด"
              className={cn(
                "rounded-none p-1 text-slate-400 transition-colors",
                "hover:bg-slate-100 hover:text-slate-600",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              )}
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}