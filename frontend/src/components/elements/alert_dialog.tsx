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
import { type LucideIcon } from "lucide-react";
import Modal from "./modal";
import Button from "./button";
import ConfirmDialog from "./confirm_dialog";

interface AlertDialogState {
  message: ReactNode;
  title?: string;
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
  alertDialog: (message: ReactNode, title?: string) => Promise<void>;
  confirmDialog: (message: ReactNode, options?: ConfirmDialogOptions) => Promise<boolean>;
}

const AlertDialogContext = createContext<AlertDialogContextValue | null>(null);

export function AlertDialogProvider({ children }: { children: ReactNode }) {
  const [alertState, setAlertState] = useState<AlertDialogState | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmDialogState | null>(null);

  // เก็บ resolve ของ Promise ที่ค้างอยู่ไว้ใน ref เผื่อกดปิดก่อนที่ effect จะ re-render ทัน
  const resolveAlertRef = useRef<(() => void) | null>(null);
  const resolveConfirmRef = useRef<((confirmed: boolean) => void) | null>(null);

  const alertDialog = useCallback((message: ReactNode, title?: string) => {
    return new Promise<void>((resolve) => {
      resolveAlertRef.current = resolve;
      setAlertState({ message, title });
    });
  }, []);

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
          <Button type="button" variant="primary" onClick={closeAlert} className="w-full">
            ตกลง
          </Button>
        }
      >
        <p className="whitespace-pre-wrap text-sm text-slate-700">{alertState?.message}</p>
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
