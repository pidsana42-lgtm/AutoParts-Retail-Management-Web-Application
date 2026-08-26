import apiClient from '../apiClient';
import type { Catalog, CatalogItem } from '../../../interface/catalog/catalog';

export const getCatalogs = async (params?: { search?: string; brand?: string; category?: string }): Promise<Catalog[]> => {
  const response = await apiClient.get('/catalogs', { params });
  return Array.isArray(response.data) ? response.data : (response.data?.data || []);
};

export const getCatalogById = async (id: number): Promise<Catalog> => {
  const response = await apiClient.get(`/catalogs/${id}`);
  return response.data;
};

export const createCatalog = async (data: Partial<Catalog>): Promise<Catalog> => {
  const response = await apiClient.post('/catalogs', data);
  return response.data;
};

export const updateCatalog = async (id: number, data: Partial<Catalog>): Promise<Catalog> => {
  const response = await apiClient.put(`/catalogs/${id}`, data);
  return response.data;
};

export const deleteCatalog = async (id: number): Promise<void> => {
  await apiClient.delete(`/catalogs/${id}`);
};

export const searchCatalogItems = async (search: string, brand?: string): Promise<CatalogItem[]> => {
  const response = await apiClient.get('/catalogs/items/search', {
    params: { search, brand }
  });
  return Array.isArray(response.data) ? response.data : (response.data?.data || []);
};

export const extractCatalogFromImage = async (file: File): Promise<any[]> => {
  const formData = new FormData();
  formData.append('file', file);
  try {
    const response = await apiClient.post('/catalogs/extract-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 300000,
    });
    return response.data?.data || [];
  } catch (err) {
    console.error('Failed to extract catalog from image:', err);
    throw err;
  }
};
