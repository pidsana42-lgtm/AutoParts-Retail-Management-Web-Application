import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSalesCancellationHistory } from "./useSalesCancellationHistory";
import { posApiService } from "../../../../service/http/pos/pos_service";

vi.mock("../../../../service/http/pos/pos_service", () => ({
  posApiService: {
    getMyCancellationRequests: vi.fn(),
    revertCancellationRequest: vi.fn(),
  },
}));

describe("useSalesCancellationHistory - Restore Modal Flow", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.alert = vi.fn();
    (posApiService.getMyCancellationRequests as any).mockResolvedValue({
      items: [
        { id: 101, status: "PENDING_CANCEL", total_amount: 500 },
        { id: 102, status: "PENDING_CANCEL", total_amount: 300 },
        { id: 103, status: "CANCELLED", total_amount: 200 },
      ],
      total_rows: 3,
      total_pages: 1,
    });
    (posApiService.revertCancellationRequest as any).mockResolvedValue({
      message: "success",
    });
  });

  it("handleRestoreSelected does not open modal when no items are selected", async () => {
    const { result } = renderHook(() => useSalesCancellationHistory());

    await waitFor(() => {
      expect(result.current.dataList).toHaveLength(3);
    });

    act(() => {
      result.current.handleRestoreSelected();
    });

    expect(window.alert).toHaveBeenCalledWith(
      "กรุณาเลือกรายการที่ต้องการกู้คืนอย่างน้อย 1 รายการ"
    );
    expect(result.current.isRestoreModalOpen).toBe(false);
  });

  it("handleRestoreSelected opens modal when items are selected", async () => {
    const { result } = renderHook(() => useSalesCancellationHistory());

    await waitFor(() => {
      expect(result.current.dataList).toHaveLength(3);
    });

    act(() => {
      result.current.handleSelectRow(101);
    });
    expect(result.current.selectedIds).toEqual([101]);

    act(() => {
      result.current.handleRestoreSelected();
    });

    expect(result.current.isRestoreModalOpen).toBe(true);
  });

  it("handleConfirmRestore calls revert API for all selected items and closes modal on success", async () => {
    const { result } = renderHook(() => useSalesCancellationHistory());

    await waitFor(() => {
      expect(result.current.dataList).toHaveLength(3);
    });

    act(() => {
      result.current.handleSelectAll();
    });
    expect(result.current.selectedIds).toEqual([101, 102]);

    act(() => {
      result.current.handleRestoreSelected();
    });
    expect(result.current.isRestoreModalOpen).toBe(true);

    await act(async () => {
      await result.current.handleConfirmRestore();
    });

    expect(posApiService.revertCancellationRequest).toHaveBeenCalledWith(101);
    expect(posApiService.revertCancellationRequest).toHaveBeenCalledWith(102);
    expect(window.alert).toHaveBeenCalledWith("ดึงคำขอยกเลิกบิลกลับสำเร็จ");
    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.isRestoreModalOpen).toBe(false);
    expect(result.current.isRestoring).toBe(false);
  });

  it("handleConfirmRestore displays error message on API failure", async () => {
    (posApiService.revertCancellationRequest as any).mockRejectedValueOnce({
      response: { data: { message: "Failed to revert" } },
    });

    const { result } = renderHook(() => useSalesCancellationHistory());

    await waitFor(() => {
      expect(result.current.dataList).toHaveLength(3);
    });

    act(() => {
      result.current.handleSelectRow(101);
      result.current.handleRestoreSelected();
    });

    await act(async () => {
      await result.current.handleConfirmRestore();
    });

    expect(window.alert).toHaveBeenCalledWith("Failed to revert");
    expect(result.current.isRestoring).toBe(false);
  });
});
