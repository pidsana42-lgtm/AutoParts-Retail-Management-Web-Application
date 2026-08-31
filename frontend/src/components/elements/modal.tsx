import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, type LucideIcon } from "lucide-react";
import { cn } from "../../utils/component";
import Button, { type ButtonProps } from "../elements/button";

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
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmDialogVariant;
  icon?: LucideIcon;
  isSubmitting?: boolean;
}

export default function Modal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
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

  const styles = variantStyles[variant];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
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
          "animate-in fade-in zoom-in-95 duration-150"
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
        <h2 id="confirm-dialog-title" className="mt-5 text-xl font-bold text-slate-800">
          {title}
        </h2>

        {/* Description */}
        <div className="mt-2 text-sm leading-relaxed text-slate-500">{description}</div>

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