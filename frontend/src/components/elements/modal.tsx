import { cva } from "class-variance-authority";
import { cn } from "../../utils/component";
import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X, type LucideIcon } from "lucide-react";
import Button, { type ButtonProps } from "../elements/button";

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

type ConfirmDialogVariant = "danger" | "warning" | "success" | "info";
const variantStyles: Record<
  ConfirmDialogVariant,
  { iconBg: string; iconColor: string; confirmButtonVariant: ButtonProps["variant"] }
> = {
  danger: {
    iconBg: "bg-red-50",
    iconColor: "text-red-500",
    confirmButtonVariant: "danger",
  },
  warning: {
    iconBg: "bg-amber-50",
    iconColor: "text-amber-500",
    confirmButtonVariant: "tertiary",
  },
  success: {
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-500",
    confirmButtonVariant: "approved",
  },
  info: {
    iconBg: "bg-orange-50",
    iconColor: "text-[#F26522]",
    confirmButtonVariant: "secondary",
  },
};

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | string;
  // Confirm Dialog props
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmDialogVariant;
  icon?: LucideIcon;
  isSubmitting?: boolean;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  size = "md",
  footer,
  children,
  className,
  onConfirm,
  confirmText = "ยืนยัน",
  cancelText = "ยกเลิก",
  variant = "danger",
  icon: Icon = AlertTriangle,
  isSubmitting = false,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  // Confirm dialog mode (when onConfirm is provided and there are no custom children)
  if (onConfirm && !children) {
    const styles = variantStyles[variant];

    return createPortal(
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isSubmitting) onClose();
        }}
      >
        <div
          className={cn(
            "w-full max-w-sm rounded-none bg-white p-8 text-center shadow-2xl",
            "animate-in fade-in zoom-in-95 duration-150",
            className
          )}
        >
          {/* Icon */}
          <div
            className={cn(
              "mx-auto flex h-16 w-16 items-center justify-center rounded-md",
              styles.iconBg
            )}
          >
            <Icon className={cn("h-8 w-8", styles.iconColor)} strokeWidth={2} />
          </div>

          {/* Title */}
          {title && (
            <h2 id="confirm-dialog-title" className="mt-5 text-xl font-bold text-slate-800">
              {title}
            </h2>
          )}

          {/* Description */}
          {description && (
            <div className="mt-2 text-sm leading-relaxed text-slate-500">{description}</div>
          )}

          {/* Actions */}
          <div className="mt-7 flex gap-3">
            <Button
              type="button"
              variant="outline-cancel"
              className="flex-1"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {cancelText}
            </Button>
            <Button
              type="button"
              variant={styles.confirmButtonVariant}
              className="flex-1"
              onClick={onConfirm}
              isLoading={isSubmitting}
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // Standard modal mode
  const validSize: "sm" | "md" | "lg" | "xl" = size === "sm" || size === "md" || size === "lg" || size === "xl" ? size : "md";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        onClick={() => {
          if (!isSubmitting) onClose();
        }}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className={cn(modalPanelVariants({ size: validSize }), className)}>
        {(title || description) && (
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              {title && (
                <h2 id="modal-title" className="text-base font-semibold text-slate-800">
                  {title}
                </h2>
              )}
              {description && (
                <div className="mt-0.5 text-sm text-slate-400">{description}</div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              aria-label="ปิด"
              className={cn(
                "rounded-none p-1 text-slate-400 transition-colors",
                "hover:bg-slate-100 hover:text-slate-600",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
              )}
            >
              <X className="h-5 w-5" />
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