import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../../service/http/apiClient';
import { stockCheckService, checkStockRecordService, type CheckStockScheduleCreateInput, type CheckStockRecordInput } from '../../service/http/wms/stock_check_service';

vi.mock('../../service/http/apiClient', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const scheduleInput: CheckStockScheduleCreateInput = {
  scheduled_datetime: '2026-09-10T09:00:00Z',
  scheduled_end_datetime: '2026-09-10T12:00:00Z',
  note: '',
  check_type: 'LOCATION',
  zone_ids: [1],
};

describe('stockCheckService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('lists all schedules when no status filter is given', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [{ id: 1 }] });
    await expect(stockCheckService.getSchedules()).resolves.toEqual([{ id: 1 }]);
    expect(apiClient.get).toHaveBeenCalledWith('/wms/check-stock-schedules');
  });

  it('appends the status filter as a query string when given', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    await stockCheckService.getSchedules('รอตรวจสอบ');
    expect(apiClient.get).toHaveBeenCalledWith('/wms/check-stock-schedules?status=รอตรวจสอบ');
  });

  it('returns an empty array when list endpoints respond with no data', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: null });
    await expect(stockCheckService.getSchedules()).resolves.toEqual([]);
    await expect(stockCheckService.getEmployees()).resolves.toEqual([]);
    await expect(stockCheckService.getZoneTree()).resolves.toEqual([]);
    await expect(stockCheckService.getCategoryTree()).resolves.toEqual([]);
  });

  it.each([
    ['getEmployees', () => stockCheckService.getEmployees(), '/wms/check-stock-schedules/employees'],
    ['getZoneTree', () => stockCheckService.getZoneTree(), '/wms/check-stock-schedules/options/zone-tree'],
    ['getCategoryTree', () => stockCheckService.getCategoryTree(), '/wms/check-stock-schedules/options/category-tree'],
  ] as const)('%s hits %s', async (_name, run, endpoint) => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [{ id: 1 }] });
    await expect(run()).resolves.toEqual([{ id: 1 }]);
    expect(apiClient.get).toHaveBeenCalledWith(endpoint);
  });

  it('fetches a single schedule by id', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { id: 5 } });
    await expect(stockCheckService.getScheduleById(5)).resolves.toEqual({ id: 5 });
    expect(apiClient.get).toHaveBeenCalledWith('/wms/check-stock-schedules/5');
  });

  it('creates a schedule with the given payload', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { message: 'created', id: 9 } });
    await expect(stockCheckService.createSchedule(scheduleInput)).resolves.toEqual({ message: 'created', id: 9 });
    expect(apiClient.post).toHaveBeenCalledWith('/wms/check-stock-schedules', scheduleInput);
  });

  it('updates a schedule by id with the given payload', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: { message: 'updated' } });
    await expect(stockCheckService.updateSchedule(5, scheduleInput)).resolves.toEqual({ message: 'updated' });
    expect(apiClient.put).toHaveBeenCalledWith('/wms/check-stock-schedules/5', scheduleInput);
  });

  it('patches only the status field', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { message: 'ok' } });
    await expect(stockCheckService.updateStatus(5, 'กำลังเช็ค')).resolves.toEqual({ message: 'ok' });
    expect(apiClient.patch).toHaveBeenCalledWith('/wms/check-stock-schedules/5/status', { status: 'กำลังเช็ค' });
  });

  it('approves a schedule with no body', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { message: 'approved' } });
    await expect(stockCheckService.approveSchedule(5)).resolves.toEqual({ message: 'approved' });
    expect(apiClient.post).toHaveBeenCalledWith('/wms/check-stock-schedules/5/approve');
  });

  it('rejects a schedule with a note', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { message: 'rejected' } });
    await expect(stockCheckService.rejectSchedule(5, 'นับผิด')).resolves.toEqual({ message: 'rejected' });
    expect(apiClient.post).toHaveBeenCalledWith('/wms/check-stock-schedules/5/reject', { note: 'นับผิด' });
  });

  it('defaults the reject note to an empty string when omitted', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { message: 'rejected' } });
    await stockCheckService.rejectSchedule(5);
    expect(apiClient.post).toHaveBeenCalledWith('/wms/check-stock-schedules/5/reject', { note: '' });
  });

  it('deletes a schedule by id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: { message: 'deleted' } });
    await expect(stockCheckService.deleteSchedule(5)).resolves.toEqual({ message: 'deleted' });
    expect(apiClient.delete).toHaveBeenCalledWith('/wms/check-stock-schedules/5');
  });
});

describe('checkStockRecordService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('creates a check-stock record', async () => {
    const input: CheckStockRecordInput = {
      old_quantity: 10,
      new_quantity: 8,
      adjustment_datetime: '2026-09-10T09:00:00Z',
      product_id: 1,
      user_id: 2,
      check_stock_schedule_id: 5,
    };
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 1 } });
    await expect(checkStockRecordService.create(input)).resolves.toEqual({ id: 1 });
    expect(apiClient.post).toHaveBeenCalledWith('/wms/check-stocks', input);
  });

  it('lists records scoped to a schedule id via query string', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [{ id: 1 }] });
    await expect(checkStockRecordService.listBySchedule(5)).resolves.toEqual([{ id: 1 }]);
    expect(apiClient.get).toHaveBeenCalledWith('/wms/check-stocks?schedule_id=5');
  });

  it('returns an empty array when there is no data', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: null });
    await expect(checkStockRecordService.listBySchedule(5)).resolves.toEqual([]);
  });
});
