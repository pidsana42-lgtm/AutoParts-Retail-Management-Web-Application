import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../apiClient';
import { customerApiService, getCustomerDocumentUrl } from './customer_service';
import type {
  CustomerTypeItem,
  CustomerListItem,
  CustomerDetailResponse,
  RegisterCustomerRequest,
  UpdateCustomerRequest,
  UpdateCustomerDiscountRequest,
} from '../../../interface/customer/customer_interface';
import type { CustomerDiscountResponse } from '../../../interface/pos/customer_interface';
import type {
  BulkUpdateCustomerDiscountItem,
  CustomerCreditAuditLog,
} from '../../../interface/storeconfig/customer_credit_interface';

vi.mock('../apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('customer_service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ===========================================================================
  // 1. customerApiService
  // ===========================================================================
  describe('customerApiService', () => {
    describe('getCustomerTypes', () => {
      it('fetches customer types successfully', async () => {
        const mockTypes: CustomerTypeItem[] = [
          { id: 1, type_name: 'GENERAL', type_label: 'ลูกค้าทั่วไป' },
          { id: 2, type_name: 'GARAGE', type_label: 'ลูกค้าอู่ซ่อมรถ' },
        ];
        vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockTypes });

        const result = await customerApiService.getCustomerTypes();
        expect(result).toEqual(mockTypes);
        expect(apiClient.get).toHaveBeenCalledWith('/pos/customer-types');
      });

      it('returns empty array when response data is undefined or null', async () => {
        vi.mocked(apiClient.get).mockResolvedValueOnce({ data: null });

        const result = await customerApiService.getCustomerTypes();
        expect(result).toEqual([]);
      });
    });

    describe('getCustomers', () => {
      it('fetches customer list successfully', async () => {
        const mockCustomers: CustomerListItem[] = [
          {
            id: 1,
            customer_name: 'สมชาย ใจดี',
            phone_number: '0812345678',
            id_card_number_customer: '1234567890123',
            display_address: 'กรุงเทพฯ',
            customer_type_label: 'ลูกค้าทั่วไป',
            current_debt_amount: 0,
            max_credit_limit: 50000,
            is_discount_enabled: true,
            standard_discount_rate: 0,
            ontop_discount_rate: 0,
            customer_type: { id: 1, type_name: 'GENERAL', type_label: 'ลูกค้าทั่วไป' },
          },
        ];
        vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockCustomers });

        const result = await customerApiService.getCustomers();
        expect(result).toEqual(mockCustomers);
        expect(apiClient.get).toHaveBeenCalledWith('/customers');
      });

      it('returns empty array when response data is undefined or null', async () => {
        vi.mocked(apiClient.get).mockResolvedValueOnce({ data: null });

        const result = await customerApiService.getCustomers();
        expect(result).toEqual([]);
      });
    });

    describe('getCustomerById', () => {
      it('fetches single customer details by ID', async () => {
        const mockCustomer: CustomerDetailResponse = {
          id: 42,
          customer_name: 'อู่ช่างชาติ',
          customer_type_id: 2,
          customer_type_label: 'ลูกค้าอู่ซ่อมรถ',
          credit_limit: 100000,
          phone_number: '0899999999',
          id_card_number_customer: '9876543210987',
          id_card_image_path: 'customer_docs/id_42.jpg',
          registered_address: '123 ม.4 ชลบุรี',
          shipping_address: '123 ม.4 ชลบุรี',
          current_balance: 85000,
          is_discount_enabled: true,
          standard_discount_rate: 5,
          ontop_discount_rate: 3,
          current_debt_amount: 15000,
        };
        vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockCustomer });

        const result = await customerApiService.getCustomerById(42);
        expect(result).toEqual(mockCustomer);
        expect(apiClient.get).toHaveBeenCalledWith('/customers/42');
      });
    });

    describe('registerCustomer', () => {
      it('registers customer with JSON payload', async () => {
        const payload: RegisterCustomerRequest = {
          customer_name: 'สมหมาย การช่าง',
          customer_type_id: 2,
          phone_number: '0851112233',
          id_card_number_customer: '1100223344556',
          registered_address: 'ระยอง',
          shipping_address: 'ระยอง',
        };
        const mockResponse = { id: 99, message: 'registered successfully' };
        vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockResponse });

        const result = await customerApiService.registerCustomer(payload);
        expect(result).toEqual(mockResponse);
        expect(apiClient.post).toHaveBeenCalledWith('/customers/register', payload, {
          headers: undefined,
        });
      });

      it('registers customer with FormData payload including multipart/form-data header', async () => {
        const formData = new FormData();
        formData.append('customer_name', 'สมหมาย การช่าง');
        formData.append('phone_number', '0851112233');

        const mockResponse = { id: 99, message: 'registered with document' };
        vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockResponse });

        const result = await customerApiService.registerCustomer(formData);
        expect(result).toEqual(mockResponse);
        expect(apiClient.post).toHaveBeenCalledWith('/customers/register', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      });
    });

    describe('updateCustomer', () => {
      it('updates customer with JSON payload', async () => {
        const payload: UpdateCustomerRequest = {
          customer_name: 'สมชาย ใจดี (แก้ไข)',
          customer_type_id: 1,
          phone_number: '0812345678',
          id_card_number_customer: '1234567890123',
          registered_address: 'กทม. ใหม่',
          shipping_address: 'กทม. ใหม่',
        };
        const mockResponse = { message: 'updated successfully' };
        vi.mocked(apiClient.put).mockResolvedValueOnce({ data: mockResponse });

        const result = await customerApiService.updateCustomer(1, payload);
        expect(result).toEqual(mockResponse);
        expect(apiClient.put).toHaveBeenCalledWith('/customers/1', payload, {
          headers: undefined,
        });
      });

      it('updates customer with FormData payload including multipart/form-data header', async () => {
        const formData = new FormData();
        formData.append('customer_name', 'สมชาย ใจดี (แก้ไขรูป)');

        const mockResponse = { message: 'updated with file' };
        vi.mocked(apiClient.put).mockResolvedValueOnce({ data: mockResponse });

        const result = await customerApiService.updateCustomer(1, formData);
        expect(result).toEqual(mockResponse);
        expect(apiClient.put).toHaveBeenCalledWith('/customers/1', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      });
    });

    describe('getCustomerDiscounts', () => {
      it('fetches discounts with default empty query', async () => {
        const mockDiscounts: CustomerDiscountResponse[] = [
          {
            id: 1,
            customer_name: 'ลูกค้าทั่วไป',
            phone_number: '0812345678',
            standard_discount_rate: 0,
            is_discount_enabled: true,
            current_debt_amount: 0,
            max_credit_limit: 50000,
            is_credit_enabled: true,
          },
        ];
        vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockDiscounts });

        const result = await customerApiService.getCustomerDiscounts();
        expect(result).toEqual(mockDiscounts);
        expect(apiClient.get).toHaveBeenCalledWith('/pos/customer-discount?search=');
      });

      it('encodes search query parameter properly', async () => {
        const mockDiscounts: CustomerDiscountResponse[] = [];
        vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockDiscounts });

        const result = await customerApiService.getCustomerDiscounts('อู่ สมบูรณ์');
        expect(result).toEqual(mockDiscounts);
        expect(apiClient.get).toHaveBeenCalledWith(
          `/pos/customer-discount?search=${encodeURIComponent('อู่ สมบูรณ์')}`
        );
      });

      it('returns empty array when response data is undefined or null', async () => {
        vi.mocked(apiClient.get).mockResolvedValueOnce({ data: null });

        const result = await customerApiService.getCustomerDiscounts();
        expect(result).toEqual([]);
      });
    });

    describe('updateCustomerDiscount', () => {
      it('updates customer discount settings', async () => {
        const payload: UpdateCustomerDiscountRequest = {
          is_discount_enabled: true,
          ontop_discount_rate: 5.0,
          credit_limit: 80000,
          standard_discount_rate: 2.0,
        };
        const mockResponse = { message: 'discount updated' };
        vi.mocked(apiClient.put).mockResolvedValueOnce({ data: mockResponse });

        const result = await customerApiService.updateCustomerDiscount(10, payload);
        expect(result).toEqual(mockResponse);
        expect(apiClient.put).toHaveBeenCalledWith('/customers/10/discount', payload);
      });
    });

    describe('bulkUpdateCustomerDiscounts', () => {
      it('submits bulk customer discount updates with correct wrapper key', async () => {
        const items: BulkUpdateCustomerDiscountItem[] = [
          { id: 1, standard_discount_rate: 3, is_discount_enabled: true },
          { id: 2, standard_discount_rate: 5, is_discount_enabled: false },
        ];
        const mockResponse = { updated_count: 2 };
        vi.mocked(apiClient.put).mockResolvedValueOnce({ data: mockResponse });

        const result = await customerApiService.bulkUpdateCustomerDiscounts(items);
        expect(result).toEqual(mockResponse);
        expect(apiClient.put).toHaveBeenCalledWith('/pos/customer-discount', {
          discount_items: items,
        });
      });
    });

    describe('getCustomerCreditAuditLogs', () => {
      it('fetches customer credit audit logs', async () => {
        const mockLogs: CustomerCreditAuditLog[] = [
          {
            id: 1,
            customer_name: 'อู่ช่างชาติ',
            action: 'UPDATE_DISCOUNT',
            details: 'เปลี่ยนส่วนลดเป็น 5%',
            changed_by: 'Manager',
            changed_at: '2026-09-07T10:00:00Z',
          },
        ];
        vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockLogs });

        const result = await customerApiService.getCustomerCreditAuditLogs();
        expect(result).toEqual(mockLogs);
        expect(apiClient.get).toHaveBeenCalledWith('/customers/credit/audit-logs');
      });

      it('returns empty array when audit logs response data is undefined or null', async () => {
        vi.mocked(apiClient.get).mockResolvedValueOnce({ data: null });

        const result = await customerApiService.getCustomerCreditAuditLogs();
        expect(result).toEqual([]);
      });
    });

    describe('createCustomerCreditAuditLog', () => {
      it('creates customer credit audit log', async () => {
        const payload = {
          customer_id: 10,
          customer_name: 'อู่ช่างชาติ',
          action: 'UPDATE_LIMIT',
          details: 'เพิ่มวงเงินเครดิตเป็น 150,000 บาท',
        };
        const mockResponse = { id: 5, success: true };
        vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockResponse });

        const result = await customerApiService.createCustomerCreditAuditLog(payload);
        expect(result).toEqual(mockResponse);
        expect(apiClient.post).toHaveBeenCalledWith('/customers/credit/audit-logs', payload);
      });
    });
  });

  // ===========================================================================
  // 2. getCustomerDocumentUrl
  // ===========================================================================
  describe('getCustomerDocumentUrl', () => {
    it('returns empty string when neither customerId nor pathOrUrl is provided', () => {
      expect(getCustomerDocumentUrl()).toBe('');
      expect(getCustomerDocumentUrl(undefined, undefined)).toBe('');
      expect(getCustomerDocumentUrl(undefined, '')).toBe('');
    });

    it('returns protected customer document URL with token when customerId is provided', () => {
      localStorage.setItem('token', 'sample-jwt-token-123');

      const url = getCustomerDocumentUrl(42);
      expect(url).toBe('/api/customers/42/document?token=sample-jwt-token-123');
    });

    it('returns protected customer document URL without token query if token is not in localStorage', () => {
      localStorage.removeItem('token');

      const url = getCustomerDocumentUrl(42);
      expect(url).toBe('/api/customers/42/document');
    });

    it('returns document view URL by path with encoded token when pathOrUrl is provided', () => {
      localStorage.setItem('token', 'sample-jwt-token-456');

      const url = getCustomerDocumentUrl(undefined, 'customer_docs/id_card_42.jpg');
      expect(url).toBe(
        `/api/customers/document/view?path=${encodeURIComponent('customer_docs/id_card_42.jpg')}&token=sample-jwt-token-456`
      );
    });

    it('returns document view URL by path without token when token is absent', () => {
      localStorage.removeItem('token');

      const url = getCustomerDocumentUrl(undefined, 'customer_docs/test space & symbols.pdf');
      expect(url).toBe(
        `/api/customers/document/view?path=${encodeURIComponent('customer_docs/test space & symbols.pdf')}`
      );
    });

    it('encodes special characters in token and path properly', () => {
      localStorage.setItem('token', 'token+with special=chars&more');

      const urlWithId = getCustomerDocumentUrl(10);
      expect(urlWithId).toBe(
        `/api/customers/10/document?token=${encodeURIComponent('token+with special=chars&more')}`
      );

      const urlWithPath = getCustomerDocumentUrl(undefined, 'folder/ภาพ บัตร.png');
      expect(urlWithPath).toBe(
        `/api/customers/document/view?path=${encodeURIComponent('folder/ภาพ บัตร.png')}&token=${encodeURIComponent('token+with special=chars&more')}`
      );
    });

    it('prioritizes customerId route when both customerId and pathOrUrl are provided', () => {
      localStorage.setItem('token', 'jwt-token');

      const url = getCustomerDocumentUrl(99, 'ignored_path.jpg');
      expect(url).toBe('/api/customers/99/document?token=jwt-token');
    });
  });
});
