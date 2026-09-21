import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extractCatalogFromImage } from './catalog_service';

const http = vi.hoisted(() => ({ post: vi.fn(), directAI: vi.fn() }));
vi.mock('../apiClient', () => ({ default: { post: http.post } }));
vi.mock('axios', () => ({ default: { post: http.directAI } }));

describe('Catalog OCR access boundary', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('uploads through the authenticated client and preserves extracted items', async () => {
    const file = new File(['catalog'], 'catalog.jpg', { type: 'image/jpeg' });
    const items = [{ part_number: 'PART-1' }];
    http.post.mockResolvedValue({ data: { data: items } });
    expect(await extractCatalogFromImage(file)).toEqual(items);
    expect(http.post).toHaveBeenCalledExactlyOnceWith('/catalogs/extract-image', expect.any(FormData), {
      headers: { 'Content-Type': 'multipart/form-data' }, timeout: 300000,
    });
    expect(http.post.mock.calls[0][1].get('file')).toBe(file);
    expect(http.directAI).not.toHaveBeenCalled();
  });

  it.each([401, 403, 500])('never retries through unauthenticated AI after HTTP %s', async status => {
    const error = { response: { status, data: { error: 'denied or unavailable' } } };
    http.post.mockRejectedValue(error);
    await expect(extractCatalogFromImage(new File(['catalog'], 'catalog.jpg'))).rejects.toBe(error);
    expect(http.post).toHaveBeenCalledTimes(1);
    expect(http.directAI).not.toHaveBeenCalled();
  });
});
