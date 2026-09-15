import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePaymentCancellationHistory } from "./usePaymentCancellationHistory";
import { posApiService } from "../../../../service/http/pos/pos_service";

vi.mock("../../../../service/http/pos/pos_service", () => ({
  posApiService: {
    getPaymentCancellationHistory: vi.fn(),
    getPaymentHistory: vi.fn(),
    approveCancelPaymentReceipt: vi.fn(),
    rejectCancelPaymentReceipt: vi.fn(),
    revertCancelPaymentReceiptRequest: vi.fn(),
  },
}));

vi.mock("../../../../hooks/useUserRole", () => ({
  useUserRole: () => ({ isOwnerOrAdmin: true }),
}));

vi.mock("../../../../hooks/useEmployeeOptions", () => ({
  useEmployeeOptions: () => ({ employeeList: [] }),
}));

describe("usePaymentCancellationHistory - ConfirmDialog Flow", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.alert = vi.fn();
    (posApiService.getPaymentHistory as any).mockResolvedValue([
      { receipt_id: 1, receipt_number: "RCP-001", status: "pending_cancel", total_amount: 1000 },
      { receipt_id: 2, receipt_number: "RCP-002", status: "pending_cancel", total_amount: 2000 },
    ]);
    (posApiService.approveCancelPaymentReceipt as any).mockResolvedValue({ message: "approved" });
    (posApiService.rejectCancelPaymentReceipt as any).mockResolvedValue({ message: "rejected" });
    (posApiService.revertCancelPaymentReceiptRequest as any).mockResolvedValue({ message: "reverted" });
  });

  it("opens ConfirmDialog on handleBatchApprove and calls API on confirm", async () => {
    const { result } = renderHook(() => usePaymentCancellationHistory());

    await waitFor(() => {
      expect(result.current.dataList).toHaveLength(2);
    });

    act(() => {
      result.current.handleSelectAll();
    });
    expect(result.current.selectedIds).toEqual([1, 2]);

    act(() => {
      result.current.handleBatchApprove();
    });

    expect(result.current.confirmDialog.isOpen).toBe(true);
    expect(result.current.confirmDialog.title).toBe("ยืนยันการอนุมัติยกเลิกใบเสร็จ");
    expect(result.current.confirmDialog.variant).toBe("success");

    await act(async () => {
      await result.current.confirmDialog.onConfirm();
    });

    expect(posApiService.approveCancelPaymentReceipt).toHaveBeenCalledWith(1, { remark: "อนุมัติยกเลิกแบบกลุ่ม" });
    expect(posApiService.approveCancelPaymentReceipt).toHaveBeenCalledWith(2, { remark: "อนุมัติยกเลิกแบบกลุ่ม" });
    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.confirmDialog.isOpen).toBe(false);
  });

  it("opens ConfirmDialog on handleBatchReject and calls API on confirm", async () => {
    const { result } = renderHook(() => usePaymentCancellationHistory());

    await waitFor(() => {
      expect(result.current.dataList).toHaveLength(2);
    });

    act(() => {
      result.current.handleSelectRow(1);
    });
    expect(result.current.selectedIds).toEqual([1]);

    act(() => {
      result.current.handleBatchReject();
    });

    expect(result.current.confirmDialog.isOpen).toBe(true);
    expect(result.current.confirmDialog.title).toBe("ยืนยันการปฏิเสธคำขอยกเลิก");
    expect(result.current.confirmDialog.variant).toBe("danger");

    await act(async () => {
      await result.current.confirmDialog.onConfirm();
    });

    expect(posApiService.rejectCancelPaymentReceipt).toHaveBeenCalledWith(1, {
      remark: "ข้อความอัตโนมัติ ปฏิเสธคำขอยกเลิก",
    });
    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.confirmDialog.isOpen).toBe(false);
  });

  it("opens ConfirmDialog on handleBatchRevert and calls API on confirm", async () => {
    const { result } = renderHook(() => usePaymentCancellationHistory());

    await waitFor(() => {
      expect(result.current.dataList).toHaveLength(2);
    });

    act(() => {
      result.current.handleSelectRow(2);
    });
    expect(result.current.selectedIds).toEqual([2]);

    act(() => {
      result.current.handleBatchRevert();
    });

    expect(result.current.confirmDialog.isOpen).toBe(true);
    expect(result.current.confirmDialog.title).toBe("ยืนยันการดึงคำขอยกเลิกกลับ");
    expect(result.current.confirmDialog.variant).toBe("danger");

    await act(async () => {
      await result.current.confirmDialog.onConfirm();
    });

    expect(posApiService.revertCancelPaymentReceiptRequest).toHaveBeenCalledWith(2);
    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.confirmDialog.isOpen).toBe(false);
  });

  it("closeConfirmDialog closes the open confirm dialog", async () => {
    const { result } = renderHook(() => usePaymentCancellationHistory());

    await waitFor(() => {
      expect(result.current.dataList).toHaveLength(2);
    });

    act(() => {
      result.current.handleSelectRow(1);
    });

    act(() => {
      result.current.handleBatchApprove();
    });

    expect(result.current.confirmDialog.isOpen).toBe(true);

    act(() => {
      result.current.closeConfirmDialog();
    });

    expect(result.current.confirmDialog.isOpen).toBe(false);
  });
});
