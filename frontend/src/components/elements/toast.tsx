// toast.tsx
import {
  type ReactNode,
  useEffect,
  useRef,
  createContext,
  useContext,
  useState,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../utils/component";

type ToastPosition = "top-right" | "top-left" | "bottom-right"
  | "bottom-left" | "top-center" | "bottom-center";

interface Toast {
  id: string;
  message: string;
  variant?: ToastVariantType;
  duration?: number;
  title?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  toast: (options: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const toastVariants = cva(
  // Base styles
  [
    "relative flex w-80 max-w-[calc(100vw-2rem)] items-start gap-3 overflow-hidden",
    "rounded-sm px-4 py-3 shadow-lg",
    "animate-in slide-in-from-right-5 fade-in duration-200",
    "border-l-4 bg-white text-slate-800",
  ],
  {
    variants: {
      variant: {
        success: "border-green-500",
        error:   "border-red-500",
        warning: "border-yellow-400",
        info:    "border-blue-500",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  }
);

const progressVariants = cva("absolute bottom-0 left-0 h-0.5 w-full", {
  variants: {
    variant: {
      success: "bg-green-400",
      error:   "bg-red-400",
      warning: "bg-yellow-300",
      info:    "bg-blue-400",
    },
  },
  defaultVariants: {
    variant: "info",
  },
});

const iconVariants = cva("h-5 w-5 shrink-0", {
  variants: {
    variant: {
      success: "text-green-500",
      error:   "text-red-500",
      warning: "text-yellow-400",
      info:    "text-blue-500",
    },
  },
  defaultVariants: {
    variant: "info",
  },
});

type ToastVariantType = NonNullable<
  VariantProps<typeof toastVariants>["variant"]
>;

const icons: Record<ToastVariantType, ReactNode> = {
  success: (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
    </svg>
  ),
};

const positionStyles: Record<ToastPosition, string> = {
  "top-right":     "top-4 right-4 items-end",
  "top-left":      "top-4 left-4 items-start",
  "bottom-right":  "bottom-4 right-4 items-end",
  "bottom-left":   "bottom-4 left-4 items-start",
  "top-center":    "top-4 left-1/2 -translate-x-1/2 items-center",
  "bottom-center": "bottom-4 left-1/2 -translate-x-1/2 items-center",
};

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const variant = toast.variant ?? "info";
  const duration = toast.duration ?? 4000;
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!progressRef.current) return;
    progressRef.current.style.transition = `width ${duration}ms linear`;
    const raf = requestAnimationFrame(() => {
      if (progressRef.current) progressRef.current.style.width = "0%";
    });
    return () => cancelAnimationFrame(raf);
  }, [duration]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={toastVariants({ variant })}
      //  ถ้าอยากเพิ่ม class พิเศษ ใช้ cn() ได้เลย
      // className={cn(toastVariants({ variant }), "my-extra-class")}
    >
      {/* Icon */}
      <span className={cn(iconVariants({ variant }), "mt-0.5")}>
        {icons[variant]}
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {toast.title && (
          <p className="text-sm font-semibold leading-snug">{toast.title}</p>
        )}
        <p className={cn("text-sm leading-snug text-slate-600", toast.title && "mt-0.5")}>
          {toast.message}
        </p>
        {toast.action && (
          <button
            onClick={() => {
              toast.action!.onClick();
              onDismiss(toast.id);
            }}
            className={cn(
              "mt-1.5 text-xs font-medium",
              "text-indigo-600 hover:text-indigo-700",
              "focus:outline-none focus-visible:underline"
            )}
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {/* Close Button */}
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="ปิดการแจ้งเตือน"
        className={cn(
          "mt-0.5 shrink-0 rounded p-0.5",
          "text-slate-400 transition-colors",
          "hover:bg-slate-100 hover:text-slate-600",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        )}
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {/* Progress Bar */}
      <div ref={progressRef} className={progressVariants({ variant })} />
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  position?: ToastPosition;
}

function ToastContainer({
  toasts,
  onDismiss,
  position = "top-right",
}: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return createPortal(
    <div
      aria-label="การแจ้งเตือน"
      className={cn("fixed z-9999 flex flex-col gap-2", positionStyles[position])}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body
  );
}

const ToastContext = createContext<ToastContextValue | null>(null);

interface ToastProviderProps {
  children: ReactNode;
  position?: ToastPosition;
  maxToasts?: number;
}

export function ToastProvider({
  children,
  position = "top-right",
  maxToasts = 5,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => setToasts([]), []);

  const toast = useCallback(
    (options: Omit<Toast, "id">) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const duration = options.duration ?? 4000;

      setToasts((prev) => {
        const next = [...prev, { ...options, id, duration }];
        return next.length > maxToasts ? next.slice(next.length - maxToasts) : next;
      });

      if (duration > 0) setTimeout(() => dismiss(id), duration);

      return id;
    },
    [dismiss, maxToasts]
  );

  return (
    <ToastContext.Provider value={{ toast, dismiss, dismissAll }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} position={position} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast ต้องใช้ภายใน <ToastProvider>");
  return ctx;
}