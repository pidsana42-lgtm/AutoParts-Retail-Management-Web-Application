import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../../service/http/apiClient';
import { stockDataService } from '../../service/http/wms/stock_data_service';

vi.mock('../../service/http/apiClient', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

describe('stockDataService._mapIds', () => {
  it('copies GORM-style ID into id when id is missing', () => {
    expect(stockDataService._mapIds([{ ID: 3, category_name: 'เบรก' }])).toEqual([
      { ID: 3, id: 3, category_name: 'เบรก' },
    ]);
  });

  it('leaves an existing id untouched even if ID is also present', () => {
    expect(stockDataService._mapIds([{ ID: 3, id: 3, category_name: 'เบรก' }])).toEqual([
      { ID: 3, id: 3, category_name: 'เบรก' },
    ]);
  });

  it('leaves id as 0 untouched (falsy but explicitly set, not "missing")', () => {
    expect(stockDataService._mapIds([{ ID: 5, id: 0 }])).toEqual([{ ID: 5, id: 0 }]);
  });

  it('returns an empty array for non-array input', () => {
    expect(stockDataService._mapIds(null as any)).toEqual([]);
    expect(stockDataService._mapIds(undefined as any)).toEqual([]);
  });
});

describe('stockDataService list endpoints (normalized via _mapIds)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it.each([
    ['getCategories', () => stockDataService.getCategories(), '/wms/categories'],
    ['getUnits', () => stockDataService.getUnits(), '/wms/units'],
    ['getGrades', () => stockDataService.getGrades(), '/wms/grades'],
    ['getZones', () => stockDataService.getZones(), '/wms/zones'],
    ['getShelves', () => stockDataService.getShelves(), '/wms/shelves'],
    ['getBrands', () => stockDataService.getBrands(), '/wms/brands'],
    ['getSuppliers', () => stockDataService.getSuppliers(), '/wms/suppliers'],
  ] as const)('%s hits %s and normalizes ID -> id', async (_name, run, endpoint) => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [{ ID: 1, name: 'x' }] });
    await expect(run()).resolves.toEqual([{ ID: 1, id: 1, name: 'x' }]);
    expect(apiClient.get).toHaveBeenCalledWith(endpoint);
  });

  it('getSubCategories fetches everything when no category id is given', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    await stockDataService.getSubCategories();
    expect(apiClient.get).toHaveBeenCalledWith('/wms/sub-categories');
  });

  it('getSubCategories filters by category id via query string when given', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    await stockDataService.getSubCategories(2);
    expect(apiClient.get).toHaveBeenCalledWith('/wms/sub-categories?category_id=2');
  });

  it('getSubSubCategories fetches everything when no sub-category id is given', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    await stockDataService.getSubSubCategories();
    expect(apiClient.get).toHaveBeenCalledWith('/wms/sub-sub-categories');
  });

  it('getSubSubCategories filters by sub-category id via query string when given', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    await stockDataService.getSubSubCategories(3);
    expect(apiClient.get).toHaveBeenCalledWith('/wms/sub-sub-categories?sub_category_id=3');
  });
});

describe('stockDataService create/update/delete passthrough', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it.each([
    ['createCategory', () => stockDataService.createCategory({ category_name: 'x', category_short_name: 'X', description: '' }), 'post', '/wms/categories'],
    ['createSubCategory', () => stockDataService.createSubCategory({ sub_category_name: 'x', sub_category_short_name: 'X', description: '', category_id: 1 }), 'post', '/wms/sub-categories'],
    ['createSubSubCategory', () => stockDataService.createSubSubCategory({ sub_sub_category_name: 'x', sub_sub_category_short_name: 'X', description: '', sub_category_id: 1 }), 'post', '/wms/sub-sub-categories'],
    ['createUnit', () => stockDataService.createUnit({ unit_name: 'ชิ้น' }), 'post', '/wms/units'],
    ['createGrade', () => stockDataService.createGrade({ grade_name: 'A' }), 'post', '/wms/grades'],
    ['createZone', () => stockDataService.createZone({ zone_name: 'โซน A' }), 'post', '/wms/zones'],
    ['createShelf', () => stockDataService.createShelf({ shelf_name: 'ตู้ 1', zone_id: 1 }), 'post', '/wms/shelves'],
    ['createShelfLevel', () => stockDataService.createShelfLevel({ level_name: 'ชั้น 1', shelf_id: 1 }), 'post', '/wms/shelf-levels'],
    ['createBrand', () => stockDataService.createBrand({ brand_name: 'Toyota' }), 'post', '/wms/brands'],
    ['createModel', () => stockDataService.createModel({ model_name: 'Vios', brand_id: 1 }), 'post', '/wms/models'],
    ['createSupplier', () => stockDataService.createSupplier({ supplier_name: 'บริษัท เอ' } as any), 'post', '/wms/suppliers'],
  ] as const)('%s posts the payload to %s', async (_name, run, method, endpoint) => {
    vi.mocked(apiClient[method]).mockResolvedValue({ data: { id: 1 } });
    await expect(run()).resolves.toEqual({ id: 1 });
    expect(apiClient[method]).toHaveBeenCalledWith(endpoint, expect.any(Object));
  });

  it.each([
    ['updateCategory', () => stockDataService.updateCategory(1, { category_name: 'edited' }), '/wms/categories/1'],
    ['updateSubCategory', () => stockDataService.updateSubCategory(1, { sub_category_name: 'edited' }), '/wms/sub-categories/1'],
    ['updateSubSubCategory', () => stockDataService.updateSubSubCategory(1, { sub_sub_category_name: 'edited' }), '/wms/sub-sub-categories/1'],
    ['updateUnit', () => stockDataService.updateUnit(1, { unit_name: 'edited' }), '/wms/units/1'],
    ['updateGrade', () => stockDataService.updateGrade(1, { grade_name: 'edited' }), '/wms/grades/1'],
    ['updateZone', () => stockDataService.updateZone(1, { zone_name: 'edited' }), '/wms/zones/1'],
    ['updateShelf', () => stockDataService.updateShelf(1, { shelf_name: 'edited' }), '/wms/shelves/1'],
    ['updateShelfLevel', () => stockDataService.updateShelfLevel(1, { level_name: 'edited' }), '/wms/shelf-levels/1'],
    ['updateBrand', () => stockDataService.updateBrand(1, { brand_name: 'edited' }), '/wms/brands/1'],
    ['updateModel', () => stockDataService.updateModel(1, { model_name: 'edited', brand_id: 1 }), '/wms/models/1'],
    ['updateSupplier', () => stockDataService.updateSupplier(1, { supplier_name: 'edited' }), '/wms/suppliers/1'],
  ] as const)('%s puts the payload to %s', async (_name, run, endpoint) => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: { message: 'updated' } });
    await expect(run()).resolves.toEqual({ message: 'updated' });
    expect(apiClient.put).toHaveBeenCalledWith(endpoint, expect.any(Object));
  });

  it.each([
    ['deleteCategory', () => stockDataService.deleteCategory(1), '/wms/categories/1'],
    ['deleteSubCategory', () => stockDataService.deleteSubCategory(1), '/wms/sub-categories/1'],
    ['deleteSubSubCategory', () => stockDataService.deleteSubSubCategory(1), '/wms/sub-sub-categories/1'],
    ['deleteUnit', () => stockDataService.deleteUnit(1), '/wms/units/1'],
    ['deleteGrade', () => stockDataService.deleteGrade(1), '/wms/grades/1'],
    ['deleteZone', () => stockDataService.deleteZone(1), '/wms/zones/1'],
    ['deleteShelf', () => stockDataService.deleteShelf(1), '/wms/shelves/1'],
    ['deleteShelfLevel', () => stockDataService.deleteShelfLevel(1), '/wms/shelf-levels/1'],
    ['deleteBrand', () => stockDataService.deleteBrand(1), '/wms/brands/1'],
    ['deleteModel', () => stockDataService.deleteModel(1), '/wms/models/1'],
    ['deleteSupplier', () => stockDataService.deleteSupplier(1), '/wms/suppliers/1'],
  ] as const)('%s deletes %s', async (_name, run, endpoint) => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: { message: 'deleted' } });
    await expect(run()).resolves.toEqual({ message: 'deleted' });
    expect(apiClient.delete).toHaveBeenCalledWith(endpoint);
  });
});
