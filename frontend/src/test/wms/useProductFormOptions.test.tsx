import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProductFormOptions } from '../../app/owner/stock/hooks/useProductFormOptions';
import { getGradesList, getUnitsList, getSuppliersList } from '../../service/http/wms/product';
import { stockDataService } from '../../service/http/wms/stock_data_service';

vi.mock('../../service/http/wms/product', () => ({
  getGradesList: vi.fn(),
  getUnitsList: vi.fn(),
  getSuppliersList: vi.fn(),
}));

vi.mock('../../service/http/wms/stock_data_service', () => ({
  stockDataService: {
    getCategories: vi.fn(),
    getSubCategories: vi.fn(),
    getSubSubCategories: vi.fn(),
    getBrands: vi.fn(),
    getShelves: vi.fn(),
    getZones: vi.fn(),
  },
}));

function mockEverythingEmpty() {
  vi.mocked(stockDataService.getCategories).mockResolvedValue([]);
  vi.mocked(stockDataService.getSubCategories).mockResolvedValue([]);
  vi.mocked(stockDataService.getSubSubCategories).mockResolvedValue([]);
  vi.mocked(stockDataService.getBrands).mockResolvedValue([]);
  vi.mocked(stockDataService.getShelves).mockResolvedValue([]);
  vi.mocked(stockDataService.getZones).mockResolvedValue([]);
  vi.mocked(getGradesList).mockResolvedValue([]);
  vi.mocked(getUnitsList).mockResolvedValue([]);
  vi.mocked(getSuppliersList).mockResolvedValue([]);
}

describe('useProductFormOptions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockEverythingEmpty();
  });

  it('starts in a loading state with empty option lists', () => {
    const { result } = renderHook(() => useProductFormOptions());
    expect(result.current.loading).toBe(true);
    expect(result.current.categories).toEqual([]);
    expect(result.current.zones).toEqual([]);
    expect(result.current.models).toEqual([]);
  });

  it('builds a 3-level category tree, prefixing each id so cross-table collisions cannot merge', async () => {
    vi.mocked(stockDataService.getCategories).mockResolvedValue([
      { id: 2, category_name: 'เบรก', category_short_name: 'BRK', description: '' },
    ]);
    vi.mocked(stockDataService.getSubCategories).mockResolvedValue([
      { id: 2, sub_category_name: 'ผ้าเบรก', sub_category_short_name: 'PB', description: '', category_id: 2 },
    ]);
    vi.mocked(stockDataService.getSubSubCategories).mockResolvedValue([
      { id: 2, sub_sub_category_name: 'ผ้าเบรกหน้า', sub_sub_category_short_name: 'PBF', description: '', sub_category_id: 2 },
    ]);

    const { result } = renderHook(() => useProductFormOptions());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.categories).toEqual([
      {
        value: 'category-2',
        label: 'เบรก',
        children: [
          {
            value: 'subcategory-2',
            label: 'ผ้าเบรก',
            children: [{ value: 'subsubcategory-2', label: 'ผ้าเบรกหน้า' }],
          },
        ],
      },
    ]);
  });

  it('drops a sub-category whose parent category id does not exist (orphaned reference)', async () => {
    vi.mocked(stockDataService.getCategories).mockResolvedValue([
      { id: 1, category_name: 'เบรก', category_short_name: 'BRK', description: '' },
    ]);
    vi.mocked(stockDataService.getSubCategories).mockResolvedValue([
      { id: 9, sub_category_name: 'ลอย', sub_category_short_name: 'X', description: '', category_id: 999 },
    ]);

    const { result } = renderHook(() => useProductFormOptions());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.categories).toEqual([{ value: 'category-1', label: 'เบรก', children: [] }]);
  });

  it('builds a zone -> shelf -> shelf-level tree the same way, and omits children when a shelf has no levels', async () => {
    vi.mocked(stockDataService.getZones).mockResolvedValue([{ id: 1, zone_name: 'โซน A' }]);
    vi.mocked(stockDataService.getShelves).mockResolvedValue([
      { id: 10, shelf_name: 'ตู้ 1', zone_id: 1, shelf_levels: [{ id: 100, level_name: 'ชั้น 1', shelf_id: 10 }] },
      { id: 11, shelf_name: 'ตู้ 2 (ไม่มีชั้นย่อย)', zone_id: 1 },
    ]);

    const { result } = renderHook(() => useProductFormOptions());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.zones).toEqual([
      {
        value: 'zone-1',
        label: 'โซน A',
        children: [
          { value: 'shelf-10', label: 'ตู้ 1', children: [{ value: 'level-100', label: 'ชั้น 1' }] },
          { value: 'shelf-11', label: 'ตู้ 2 (ไม่มีชั้นย่อย)' },
        ],
      },
    ]);
  });

  it('flattens brand -> model into "Brand - Model" options, skipping brands with no models', async () => {
    vi.mocked(stockDataService.getBrands).mockResolvedValue([
      { id: 1, brand_name: 'Toyota', models: [{ id: 1, model_name: 'Vios', brand_id: 1 }] },
      { id: 2, brand_name: 'Honda', models: [] },
    ]);

    const { result } = renderHook(() => useProductFormOptions());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.models).toEqual([{ label: 'Toyota - Vios', value: '1' }]);
  });

  it('maps grades, units and suppliers into simple {label, value} options', async () => {
    vi.mocked(getGradesList).mockResolvedValue([{ id: 1, name: 'A' }]);
    vi.mocked(getUnitsList).mockResolvedValue([{ id: 2, name: 'ชิ้น' }]);
    vi.mocked(getSuppliersList).mockResolvedValue([{ id: 3, name: 'บริษัท เอ' }]);

    const { result } = renderHook(() => useProductFormOptions());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.grades).toEqual([{ label: 'A', value: '1' }]);
    expect(result.current.units).toEqual([{ label: 'ชิ้น', value: '2' }]);
    expect(result.current.suppliers).toEqual([{ label: 'บริษัท เอ', value: '3' }]);
  });

  it('stops loading (leaving empty lists) when a request fails', async () => {
    vi.mocked(stockDataService.getCategories).mockRejectedValue(new Error('network error'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useProductFormOptions());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.categories).toEqual([]);
  });

  describe('addSupplierOption', () => {
    it('appends a newly created supplier to the options list', async () => {
      const { result } = renderHook(() => useProductFormOptions());
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => result.current.addSupplierOption({ id: 5, supplier_name: 'บริษัทใหม่' }));
      expect(result.current.suppliers).toEqual([{ label: 'บริษัทใหม่', value: '5' }]);
    });

    it('does not add a duplicate when the supplier id is already in the list', async () => {
      vi.mocked(getSuppliersList).mockResolvedValue([{ id: 5, name: 'บริษัทเดิม' }]);
      const { result } = renderHook(() => useProductFormOptions());
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => result.current.addSupplierOption({ id: 5, supplier_name: 'บริษัทเดิม (พิมพ์ซ้ำ)' }));
      expect(result.current.suppliers).toEqual([{ label: 'บริษัทเดิม', value: '5' }]);
    });
  });
});
