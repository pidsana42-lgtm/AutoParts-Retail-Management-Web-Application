import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../../service/http/apiClient';
import { movementFeedService, type MovementFeedItem } from '../../service/http/wms/movement_feed_service';

vi.mock('../../service/http/apiClient', () => ({
  default: { get: vi.fn() },
}));

describe('movementFeedService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('fetches the feed from the movement-feed endpoint', async () => {
    const items: MovementFeedItem[] = [
      {
        type: 'SALE_OUT',
        occurred_at: '2026-09-08T18:16:00+07:00',
        ref_id: 11,
        title: 'ขายออก: test',
        link_path: '/owner/stock/stock-movement/orders/6',
      },
    ];
    vi.mocked(apiClient.get).mockResolvedValue({ data: items });
    await expect(movementFeedService.getFeed()).resolves.toEqual(items);
    expect(apiClient.get).toHaveBeenCalledWith('/wms/movement-feed');
  });

  it('propagates request failures to the caller', async () => {
    const error = new Error('Network unavailable');
    vi.mocked(apiClient.get).mockRejectedValue(error);
    await expect(movementFeedService.getFeed()).rejects.toBe(error);
  });
});
