import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../../service/http/apiClient';
import {
  getProductsList,
  getProductById,
  getCategoriesList,
  getSuppliersList,
  getBrandsList,
  getGradesList,
  getUnitsList,
  getShelvesList,
  createProduct,
  deleteProduct,
  getDeletedProductsList,
  restoreProduct,
  updateProduct,
  receiveStock,
  uploadProductImage,
} from '../../service/http/wms/product';

vi.mock('../../service/http/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    defaults: { baseURL: 'http://localhost:8080/api' },
  },
}));

const rawProduct = {
  id: 5,
  product_code: 'P-5',
  product_name: 'ผ้าเบรก',
  part_number: 'PN-5',
  models: [{ id: 1, model_name: 'Vios', brand_name: 'Toyota' }],
  category_name: 'เบรก',
  sub_category_name: 'ผ้าเบรก',
  sub_sub_category_name: 'ผ้าเบรกหน้า',
  grade_name: 'B',
  quantity: 12,
  limit_quantity: 3,
  sale_price: 350,
  cost_price: 200,
  max_discount_rate: 5,
  thumbnail_url: '/uploads/p5.jpg',
  note: 'ของแท้',
  unit_name: 'ชิ้น',
  shelf_name: 'ตู้ 1',
  shelf_level_name: 'ชั้น 1',
  zone_name: 'โซน A',
  supplier_name: 'บริษัท เอ, บริษัท บี',
  suppliers: [
    { supplier_id: 1, supplier_name: 'บริษัท เอ', quantity: 7, company_product_code: 'A-5', variant_code: 'V1', barcode: 'B1', qr_code: 'Q1' },
  ],
  updated_at: '2026-09-01T10:00:00Z',
  deleted_at: null,
};

describe('product service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (apiClient as any).defaults = { baseURL: 'http://localhost:8080/api' };
  });

  describe('mapProductItem (via getProductsList/getProductById)', () => {
    it('maps every backend field to its frontend StockItem shape', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: [rawProduct] });
      const [item] = await getProductsList();
      expect(item).toEqual({
        ID: 5,
        ProductCode: 'P-5',
        Name: 'ผ้าเบรก',
        PartNo: 'PN-5',
        Models: [{ id: 1, model_name: 'Vios', brand_name: 'Toyota' }],
        Category: 'เบรก',
        SubCategory: 'ผ้าเบรก',
        SubSubCategory: 'ผ้าเบรกหน้า',
        Grade: 'B',
        Stock: 12,
        MinStock: 3,
        Price: 350,
        CostPrice: 200,
        MaxDiscountRate: 5,
        ThumbnailUrl: 'http://localhost:8080/uploads/p5.jpg',
        Note: 'ของแท้',
        Unit: 'ชิ้น',
        Shelf: 'ตู้ 1',
        ShelfLevel: 'ชั้น 1',
        Zone: 'โซน A',
        Supplier: 'บริษัท เอ, บริษัท บี',
        Suppliers: [
          { SupplierID: 1, SupplierName: 'บริษัท เอ', Quantity: 7, CompanyProductCode: 'A-5', VariantCode: 'V1', Barcode: 'B1', QRCode: 'Q1' },
        ],
        UpdatedAt: '2026-09-01T10:00:00Z',
        DeletedAt: undefined,
      });
      expect(apiClient.get).toHaveBeenCalledWith('/wms/products');
    });

    it('defaults every optional field when the backend omits it', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { id: 9 } });
      const item = await getProductById(9);
      expect(item).toEqual({
        ID: 9,
        ProductCode: '',
        Name: '',
        PartNo: '',
        Models: [],
        Category: '',
        SubCategory: '',
        SubSubCategory: '',
        Grade: 'A',
        Stock: 0,
        MinStock: 0,
        Price: 0,
        CostPrice: 0,
        MaxDiscountRate: 0,
        ThumbnailUrl: '',
        Note: '',
        Unit: '',
        Shelf: '',
        ShelfLevel: '',
        Zone: '',
        Supplier: '',
        Suppliers: [],
        UpdatedAt: undefined,
        DeletedAt: undefined,
      });
      expect(apiClient.get).toHaveBeenCalledWith('/wms/products/9');
    });

    it('returns an empty list when the backend responds with no data', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: null });
      await expect(getProductsList()).resolves.toEqual([]);
    });

    describe('thumbnail URL resolution', () => {
      it('leaves an already-absolute URL untouched', async () => {
        vi.mocked(apiClient.get).mockResolvedValue({ data: { id: 1, thumbnail_url: 'https://cdn.example.com/x.jpg' } });
        const item = await getProductById(1);
        expect(item.ThumbnailUrl).toBe('https://cdn.example.com/x.jpg');
      });

      it('prefixes a relative path with the api origin (no baseURL path segment)', async () => {
        vi.mocked(apiClient.get).mockResolvedValue({ data: { id: 1, thumbnail_url: 'uploads/no-leading-slash.jpg' } });
        const item = await getProductById(1);
        expect(item.ThumbnailUrl).toBe('http://localhost:8080/uploads/no-leading-slash.jpg');
      });

      it('returns an empty string when there is no thumbnail at all', async () => {
        vi.mocked(apiClient.get).mockResolvedValue({ data: { id: 1 } });
        const item = await getProductById(1);
        expect(item.ThumbnailUrl).toBe('');
      });

      it('falls back to the raw path when baseURL cannot be parsed as a URL', async () => {
        (apiClient as any).defaults = { baseURL: '' };
        vi.mocked(apiClient.get).mockResolvedValue({ data: { id: 1, thumbnail_url: 'uploads/x.jpg' } });
        const item = await getProductById(1);
        expect(item.ThumbnailUrl).toBe('/uploads/x.jpg');
      });
    });
  });

  describe('reference option lists', () => {
    it.each([
      ['getCategoriesList', () => getCategoriesList(), '/wms/categories', 'category_name', { id: 1, category_name: 'เบรก' }],
      ['getSuppliersList', () => getSuppliersList(), '/wms/suppliers', 'supplier_name', { id: 1, supplier_name: 'บริษัท เอ' }],
    ] as const)('%s maps id/name and hits %s', async (_name, run, endpoint, nameField, raw) => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: [raw] });
      await expect(run()).resolves.toEqual([{ id: 1, name: (raw as any)[nameField] }]);
      expect(apiClient.get).toHaveBeenCalledWith(endpoint);
    });

    it.each([
      ['getBrandsList', () => getBrandsList(), '/wms/brands', 'brand_name'],
      ['getGradesList', () => getGradesList(), '/wms/grades', 'grade_name'],
      ['getUnitsList', () => getUnitsList(), '/wms/units', 'unit_name'],
      ['getShelvesList', () => getShelvesList(), '/wms/shelves', 'shelf_name'],
    ] as const)('%s falls back from ID to id and hits %s', async (_name, run, endpoint, nameField) => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: [{ ID: 7, [nameField]: 'ชื่อ' }] });
      await expect(run()).resolves.toEqual([{ id: 7, name: 'ชื่อ' }]);
      expect(apiClient.get).toHaveBeenCalledWith(endpoint);
    });

    it('defaults the name to an empty string when the backend omits it', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: [{ id: 1 }] });
      await expect(getCategoriesList()).resolves.toEqual([{ id: 1, name: '' }]);
    });
  });

  describe('CRUD passthrough', () => {
    it('creates a product', async () => {
      const payload = { product_name: 'สินค้าใหม่' };
      vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 1 } });
      await expect(createProduct(payload)).resolves.toEqual({ id: 1 });
      expect(apiClient.post).toHaveBeenCalledWith('/wms/products', payload);
    });

    it('updates a product', async () => {
      const payload = { product_name: 'แก้ไขแล้ว' };
      vi.mocked(apiClient.put).mockResolvedValue({ data: { id: 1 } });
      await expect(updateProduct(1, payload)).resolves.toEqual({ id: 1 });
      expect(apiClient.put).toHaveBeenCalledWith('/wms/products/1', payload);
    });

    it('soft-deletes and restores a product via separate endpoints', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ data: { message: 'deleted' } });
      vi.mocked(apiClient.post).mockResolvedValue({ data: { message: 'restored' } });
      await expect(deleteProduct(1)).resolves.toEqual({ message: 'deleted' });
      await expect(restoreProduct(1)).resolves.toEqual({ message: 'restored' });
      expect(apiClient.delete).toHaveBeenCalledWith('/wms/products/1');
      expect(apiClient.post).toHaveBeenCalledWith('/wms/products/1/restore');
    });

    it('lists deleted products through the trash endpoint', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: [rawProduct] });
      const [item] = await getDeletedProductsList();
      expect(item.ID).toBe(5);
      expect(apiClient.get).toHaveBeenCalledWith('/wms/deleted-products');
    });

    it('receives additional stock for an existing product', async () => {
      const payload = { quantity: 5, suppliers: [{ supplier_id: 1, quantity: 5, company_product_code: 'A-5' }] };
      vi.mocked(apiClient.post).mockResolvedValue({ data: { message: 'ok' } });
      await expect(receiveStock(5, payload)).resolves.toEqual({ message: 'ok' });
      expect(apiClient.post).toHaveBeenCalledWith('/wms/products/5/receive-stock', payload);
    });
  });

  describe('uploadProductImage', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      localStorage.clear();
    });

    afterAll(() => {
      globalThis.fetch = originalFetch;
    });

    it('sends multipart form data with a bearer token when one is stored', async () => {
      localStorage.setItem('token', 'abc123');
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: '/uploads/x.jpg' }) });
      globalThis.fetch = fetchMock as any;

      const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
      await expect(uploadProductImage(5, file)).resolves.toEqual({ url: '/uploads/x.jpg' });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('http://localhost:8080/api/wms/products/5/images');
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({ Authorization: 'Bearer abc123' });
      expect(options.body).toBeInstanceOf(FormData);
    });

    it('omits the Authorization header when there is no stored token', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
      globalThis.fetch = fetchMock as any;

      await uploadProductImage(5, new File(['x'], 'photo.jpg'));
      expect(fetchMock.mock.calls[0][1].headers).toEqual({});
    });

    it('throws the backend error message when the upload fails', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'ไฟล์ใหญ่เกินไป' }) });
      globalThis.fetch = fetchMock as any;

      await expect(uploadProductImage(5, new File(['x'], 'photo.jpg'))).rejects.toThrow('ไฟล์ใหญ่เกินไป');
    });

    it('falls back to a generic error message when the failure response has no JSON body', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => { throw new Error('not json'); } });
      globalThis.fetch = fetchMock as any;

      await expect(uploadProductImage(5, new File(['x'], 'photo.jpg'))).rejects.toThrow('Upload failed');
    });
  });
});
