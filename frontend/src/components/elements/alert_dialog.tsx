// alert_dialog.tsx
// ป๊อปอัพแจ้งเตือน/ยืนยัน ที่ใช้คอมโพเนนต์กลางของระบบ แทน alert() และ window.confirm() ของเบราว์เซอร์
//   - alertDialog("ข้อความ")            -> Modal ปุ่มเดียว "ตกลง" (แทน alert)
//   - confirmDialog("ข้อความ", {...})   -> ConfirmDialog 2 ปุ่ม คืน true/false (แทน window.confirm)
// เรียกใช้แบบ imperative เหมือน useToast() ไม่ต้องจัดการ state เปิด/ปิดเองในทุกหน้า
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { type LucideIcon, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import Modal from "./modal";
import Button from "./button";
import ConfirmDialog from "./confirm_dialog";

interface AlertDialogState {
  message: ReactNode;
  title?: string;
  variant?: "danger" | "warning" | "success" | "info";
}

// ConfirmDialogOptions: ปรับหน้าตา/ข้อความปุ่มของป๊อปอัพยืนยันได้ตามงานที่กำลังทำ
export interface ConfirmDialogOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "success" | "info";
  // icon: เปลี่ยนไอคอนกลางป๊อปอัพให้ตรงกับงาน (ค่าเริ่มต้นของ ConfirmDialog เป็นสามเหลี่ยมเตือนภัย
  // ซึ่งเหมาะกับงานลบ/ยกเลิก แต่ไม่เข้ากับงานอย่างการกู้คืนหรือยืนยันส่งข้อมูล)
  icon?: LucideIcon;
}

interface ConfirmDialogState extends ConfirmDialogOptions {
  message: ReactNode;
}

interface AlertDialogContextValue {
  alertDialog: (
    message: ReactNode,
    title?: string,
    variant?: "danger" | "warning" | "success" | "info"
  ) => Promise<void>;
  confirmDialog: (message: ReactNode, options?: ConfirmDialogOptions) => Promise<boolean>;
}

const AlertDialogContext = createContext<AlertDialogContextValue | null>(null);

export function AlertDialogProvider({ children }: { children: ReactNode }) {
  const [alertState, setAlertState] = useState<AlertDialogState | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmDialogState | null>(null);

  // เก็บ resolve ของ Promise ที่ค้างอยู่ไว้ใน ref เผื่อกดปิดก่อนที่ effect จะ re-render ทัน
  const resolveAlertRef = useRef<(() => void) | null>(null);
  const resolveConfirmRef = useRef<((confirmed: boolean) => void) | null>(null);

  const alertDialog = useCallback(
    (
      message: ReactNode,
      title?: string,
      variant?: "danger" | "warning" | "success" | "info"
    ) => {
      return new Promise<void>((resolve) => {
        resolveAlertRef.current = resolve;
        setAlertState({ message, title, variant });
      });
    },
    []
  );

  const closeAlert = useCallback(() => {
    setAlertState(null);
    resolveAlertRef.current?.();
    resolveAlertRef.current = null;
  }, []);

  const confirmDialog = useCallback((message: ReactNode, options?: ConfirmDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveConfirmRef.current = resolve;
      setConfirmState({ message, ...options });
    });
  }, []);

  // ปิดป๊อปอัพยืนยัน — กด "ยกเลิก"/กดพื้นหลัง/กด Escape ถือว่าไม่ยืนยัน (false) เหมือน window.confirm เดิม
  const settleConfirm = useCallback((confirmed: boolean) => {
    setConfirmState(null);
    resolveConfirmRef.current?.(confirmed);
    resolveConfirmRef.current = null;
  }, []);

  return (
    <AlertDialogContext.Provider value={{ alertDialog, confirmDialog }}>
      {children}

      <Modal
        isOpen={alertState !== null}
        onClose={closeAlert}
        title={alertState?.title ?? "แจ้งเตือน"}
        size="sm"
        footer={
          <Button
            type="button"
            variant={
              alertState?.variant === "success"
                ? "approved"
                : alertState?.variant === "danger"
                ? "danger"
                : "primary"
            }
            onClick={closeAlert}
            className="w-full"
          >
            ตกลง
          </Button>
        }
      >
        <div className="flex flex-col items-center text-center py-2">
          {alertState?.variant === "success" && (
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
          )}
          {alertState?.variant === "danger" && (
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertTriangle className="h-8 w-8" />
            </div>
          )}
          {alertState?.variant === "warning" && (
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <AlertTriangle className="h-8 w-8" />
            </div>
          )}
          {alertState?.variant === "info" && (
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <Info className="h-8 w-8" />
            </div>
          )}
          <p className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed font-normal">
            {alertState?.message}
          </p>
        </div>
      </Modal>

      {confirmState !== null && (
        <ConfirmDialog
          isOpen
          onClose={() => settleConfirm(false)}
          onConfirm={() => settleConfirm(true)}
          title={confirmState.title ?? "ยืนยันการทำรายการ"}
          description={confirmState.message}
          confirmText={confirmState.confirmText ?? "ยืนยัน"}
          cancelText={confirmState.cancelText ?? "ยกเลิก"}
          variant={confirmState.variant ?? "warning"}
          {...(confirmState.icon ? { icon: confirmState.icon } : {})}
        />
      )}
    </AlertDialogContext.Provider>
  );
}

export function useAlertDialog(): AlertDialogContextValue {
  const ctx = useContext(AlertDialogContext);
  if (!ctx) throw new Error("useAlertDialog ต้องใช้ภายใน <AlertDialogProvider>");
  return ctx;
}
