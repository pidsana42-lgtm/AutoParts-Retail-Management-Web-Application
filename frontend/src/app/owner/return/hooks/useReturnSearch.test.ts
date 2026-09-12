import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReturnSearch } from './useReturnSearch';
import { deferred, returnableOrder } from '../../../../test/returnFixtures';
import type { ReturnableSaleOrder } from '../../../../interface/return/return_interface';

const search = vi.hoisted(() => vi.fn());
vi.mock('../../../../service/http/return/return_service', () => ({ returnService: { searchReturnableSaleOrders: search } }));

describe('Return receipt search', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.useFakeTimers(); search.mockResolvedValue([returnableOrder]); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('debounces typing for 400ms and sends only the latest trimmed keyword', async () => {
    const { result } = renderHook(useReturnSearch);
    act(() => result.current.handleSearchInput('SO'));
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    act(() => result.current.handleSearchInput('  SO-41  '));
    await act(async () => { await vi.advanceTimersByTimeAsync(399); });
    expect(search).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(search).toHaveBeenCalledExactlyOnceWith('SO-41');
    expect(result.current.searchResults).toEqual([returnableOrder]);
    expect(result.current.highlightedIndex).toBe(0);
    expect(result.current.isSearching).toBe(false);
  });

  it('forces an immediate search and cancels the scheduled duplicate', async () => {
    const { result } = renderHook(useReturnSearch);
    act(() => result.current.handleSearchInput('SO-41'));
    await act(async () => result.current.handleForceSearch());
    expect(search).toHaveBeenCalledExactlyOnceWith('SO-41');
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('cancels scheduled searches on empty input and unmount', async () => {
    const { result, unmount } = renderHook(useReturnSearch);
    act(() => result.current.handleSearchInput('SO'));
    act(() => result.current.handleSearchInput('   '));
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(search).not.toHaveBeenCalled();
    act(() => result.current.handleSearchInput('SO-41'));
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(search).not.toHaveBeenCalled();
  });

  it('ignores out-of-order responses once a newer search has started', async () => {
    const older = deferred<ReturnableSaleOrder[]>();
    const newer = deferred<ReturnableSaleOrder[]>();
    search.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    const { result } = renderHook(useReturnSearch);
    act(() => result.current.handleSearchInput('old'));
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    act(() => result.current.handleSearchInput('new'));
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    await act(async () => { newer.resolve([returnableOrder]); });
    await act(async () => { older.resolve([{ ...returnableOrder, id: 999, order_number: 'OLD' }]); });
    expect(result.current.searchResults).toEqual([returnableOrder]);
    expect(result.current.isSearching).toBe(false);
  });

  it.each(['empty', 'error'])('reports an explicit search with %s results and releases loading', async outcome => {
    if (outcome === 'empty') search.mockResolvedValue([]);
    else search.mockRejectedValue(new Error('Search unavailable'));
    const { result } = renderHook(useReturnSearch);
    act(() => result.current.handleSearchInput('SO-404'));
    await act(async () => result.current.handleForceSearch());
    expect(result.current.searchResults).toEqual([]);
    expect(result.current.isSearching).toBe(false);
    expect(result.current.searchError).toContain(outcome === 'empty' ? 'ไม่พบใบเสร็จ' : 'Search unavailable');
  });
});
