import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import apiClient from '../../../service/http/apiClient';
import { 
  Plus, Search, Edit, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Save,
  FileText, BookOpen, Building2, X,
  Loader2, AlertCircle, ImageIcon, Package, ClockAlert
} from 'lucide-react';
import {
  getPreOrders, getPreOrderById, createPreOrder,
  updatePreOrder, deletePreOrder
} from '../../../service/http/pre-order/pre-order';
import type{ PreOrder, PreOrderItem } from '../../../interface/pre-order/pre-order';
import Heading from '../../../components/elements/heading';
import Card, { CardHeader, CardTitle, CardContent } from '../../../components/elements/card';
import Select from '../../../components/elements/select';
import Button from '../../../components/elements/button';
import ConfirmDialog from '../../../components/elements/confirm_dialog';
import { Badge } from '../../../components/elements/badge';
import Input from '../../../components/elements/input';
import { useToast } from '../../../components/elements/toast';
import GenericTable, { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/elements/table';
import type { Product } from '../../../interface/import';
import type { Catalog, CatalogItem } from '../../../interface/catalog/catalog';
import { getCatalogs } from '../../../service/http/catalog/catalog_service';

interface Customer {
  id: number;
  customer_name: string;
  customer_phone?: string;
  phone_number?: string;
}

function getPageNumbers(current: number, total: number): (number | '...')[] {
  const pages: (number | '...')[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);

  if (left > 2) pages.push('...');
  for (let page = left; page <= right; page += 1) pages.push(page);
  if (right < total - 1) pages.push('...');
  if (total > 1) pages.push(total);

  return pages;
}

// เบอร์โทรศัพท์ไทย: format เป็น 08X-XXXXXXX ระหว่างพิมพ์ (ตัดเหลือ 10 หลัก)
function formatPhoneNumber(val: string): string {
  const raw = val.replace(/\D/g, '').slice(0, 10);
  if (raw.length <= 3) return raw;
  return `${raw.slice(0, 3)}-${raw.slice(3)}`;
}

export default function PreOrderManager() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const basePath = location.pathname.startsWith('/employee') ? '/employee/pre-orders' : '/owner/pre-orders';
  const initialPageParams = new URLSearchParams(location.search);
  const [preOrders, setPreOrders] = useState<PreOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  
  // UI Views & states
  const [view, setView] = useState<'list' | 'form'>(() =>
    initialPageParams.get('view') === 'new' || initialPageParams.has('edit') ? 'form' : 'list'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [removeItemIndex, setRemoveItemIndex] = useState<number | null>(null);
  
  // Catalog Picker Modal
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCatalogId, setSelectedCatalogId] = useState<number | null>(null);
  const [catalogItemSearch, setCatalogItemSearch] = useState('');

  // Quick Search for adding from stock
  const [quickSearch, setQuickSearch] = useState('');
  const [showQuickSearch, setShowQuickSearch] = useState(false);

  // Form state
  const [editingId, setEditingId] = useState<number | null>(null);
  // เปิดจากการคลิกแถว = ดูอย่างเดียว (view), เปิดจากไอคอนแก้ไข = แก้ไขได้เลย (edit)
  const [formMode, setFormMode] = useState<'view' | 'edit'>('edit');
  const [formType, setFormType] = useState<string>('WALK_IN');
  const [formCustomerId, setFormCustomerId] = useState<number>(0);
  const [formCustomerFirstName, setFormCustomerFirstName] = useState<string>('');
  const [formCustomerLastName, setFormCustomerLastName] = useState<string>('');
  const [formCustomerPhone, setFormCustomerPhone] = useState<string>('');
  const [phoneError, setPhoneError] = useState<string>('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [formStatus, setFormStatus] = useState<string>('PENDING');
  const [formItems, setFormItems] = useState<PreOrderItem[]>([]);

  // Handle prefill item from catalog navigation (Leave customer info blank for user to fill)
  useEffect(() => {
    if (location.state && (location.state as any).prefillItem) {
      const catItem = (location.state as any).prefillItem;
      const catalog = (location.state as any).catalog;

      // Reset customer name and fields (leave empty as requested)
      setEditingId(null);
      setFormType('WALK_IN');
      setFormCustomerId(0);
      setFormCustomerFirstName('');
      setFormCustomerLastName('');
      setFormCustomerPhone('');
      setFormStatus('PENDING');

      const cleanSupplierCode = catItem.st_no || (catItem.remark ? catItem.remark.replace(/^S\.T\.\s*NO:\s*/i, '').split('|')[0].trim() : '') || catItem.part_number;

      const newItem: PreOrderItem = {
        product_id: 0,
        product_name: catItem.part_name || catItem.part_number,
        product_code: catItem.part_number,
        quantity: 1,
        unit_price: catItem.standard_price || 0,
        supplier_part_code: cleanSupplierCode,
        supplier_name: catalog?.supplier_name || catItem.supplier_name || '',
        image: catItem.image || catItem.image_thumbnail || '',
      } as any;

      setFormItems([newItem]);
      setView('form');
      setErrorMsg(null);

      // เก็บหน้าฟอร์มไว้ใน URL และล้าง navigation state เพื่อไม่ให้เติมสินค้าซ้ำ
      navigate(`${basePath}?view=new`, { replace: true });
    }
  }, [location.state, navigate, basePath]);

  // Fetch initial data
  useEffect(() => {
    fetchPreOrders();
    fetchSupportData();
  }, []);

  const fetchPreOrders = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getPreOrders(statusFilter || undefined);
      setPreOrders(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error fetching pre-orders:', err);
      setErrorMsg('ล้มเหลวในการโหลดรายการจองล่วงหน้า');
      toast({ variant: 'error', message: 'ล้มเหลวในการโหลดรายการจองล่วงหน้า' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPreOrders();
  }, [statusFilter]);

  const fetchSupportData = async () => {
    try {
      const [custRes, prodRes, catData] = await Promise.all([
        apiClient.get('/customers'),
        apiClient.get('/wms/products'),
        getCatalogs(),
      ]);
      
      setCustomers(Array.isArray(custRes.data) ? custRes.data : (custRes.data.data || []));
      setProducts(Array.isArray(prodRes.data) ? prodRes.data : (prodRes.data.data || []));
      setCatalogs(Array.isArray(catData) ? catData : []);
    } catch (err) {
      console.error('Error fetching dropdown helper data:', err);
    }
  };

  const handleCreateNew = () => {
    setEditingId(null);
    setFormMode('edit');
    setFormType('WALK_IN');
    setFormCustomerId(0);
    setFormCustomerFirstName('');
    setFormCustomerLastName('');
    setFormCustomerPhone('');
    setFormStatus('PENDING');
    setFormItems([]);
    setView('form');
    setErrorMsg(null);
    navigate(`${basePath}?view=new`);
  };

  // Add item(s) from catalog
  const handleAddFromCatalogItem = (catItem: CatalogItem, catalog: Catalog) => {
    const newItem: PreOrderItem = {
      product_id: 0,
      product_name: catItem.part_name || catItem.part_number,
      product_code: catItem.part_number,
      quantity: 1,
      unit_price: catItem.standard_price || 0,
      // store supplier code & supplier name for display
      supplier_part_code: catItem.st_no || catItem.part_number,
      supplier_name: (catalog as any).supplier_name || '',
      image: catItem.image || (catItem as any).image_thumbnail || '',
    } as any;
    setFormItems(prev => [...(prev || []), newItem]);
  };

  type UnifiedSearchResult = {
    type: 'STOCK' | 'CATALOG';
    id: string;
    product_id: number;
    name: string;
    code: string;
    category?: string;
    price: number;
    quantity?: number;
    supplier_part_code?: string;
    supplier_name?: string;
    rawProd?: Product;
    rawCat?: CatalogItem;
    rawCatalog?: Catalog;
    image?: string;
  };

  const filteredQuickResults = React.useMemo(() => {
    if (!quickSearch) return [];
    const q = quickSearch.toLowerCase().trim();
    if (!q) return [];
    
    const results: UnifiedSearchResult[] = [];
    
    // 1. Search in products (STOCK) - Includes out of stock (quantity = 0)
    const matchedProducts = products.filter(p => 
      p.product_code?.toLowerCase().includes(q) || 
      p.product_name?.toLowerCase().includes(q) ||
      p.category_name?.toLowerCase().includes(q) ||
      (p as any).part_number?.toLowerCase().includes(q) ||
      (p as any).company_product_code?.toLowerCase().includes(q) ||
      p.suppliers?.some(s => s.variant_code?.toLowerCase().includes(q))
    ).slice(0, 15);
    
    matchedProducts.forEach(p => {
       const preferredSupplier = p.suppliers?.find(supplier => supplier.supplier_name || supplier.variant_code);
       results.push({
         type: 'STOCK',
         id: `stock-${p.id}`,
         product_id: p.id,
         name: p.product_name,
         code: p.product_code || (p as any).part_number || '',
         category: p.category_name,
         price: p.sale_price || p.retail_price || 0,
         quantity: p.quantity ?? 0,
         supplier_part_code:
           p.company_product_code || preferredSupplier?.variant_code || (p as any).part_number || '',
         supplier_name: preferredSupplier?.supplier_name || p.supplier_name || '',
         rawProd: p,
         image: p.thumbnail_url || (p as any).image || '',
       });
    });

    // 2. Search in catalogs
    let catalogMatches = 0;
    for (const cat of catalogs) {
      if (catalogMatches >= 15) break;
      if (!cat.catalog_items) continue;
      
      for (const item of cat.catalog_items) {
        if (
          item.part_number?.toLowerCase().includes(q) ||
          item.part_name?.toLowerCase().includes(q) ||
          (item as any).st_no?.toLowerCase().includes(q)
        ) {
           results.push({
             type: 'CATALOG',
             id: `cat-${item.id || item.part_number}-${catalogMatches}`,
             product_id: 0,
             name: item.part_name || item.part_number,
             code: item.part_number,
             category: cat.catalog_name,
             price: item.standard_price || 0,
             supplier_part_code: (item as any).st_no || item.part_number,
             supplier_name: cat.supplier_name || '',
             rawCat: item,
             rawCatalog: cat,
             image: item.image || (item as any).image_thumbnail || '',
           });
           catalogMatches++;
           if (catalogMatches >= 15) break;
        }
      }
    }
    
    return results;
  }, [quickSearch, products, catalogs]);

  const handleQuickAddUnified = (res: UnifiedSearchResult) => {
    if (res.type === 'STOCK') {
       const prod = res.rawProd!;
       const newItem: PreOrderItem = {
         product_id: prod.id,
         product_name: prod.product_name,
         product_code: prod.product_code || (prod as any).part_number || '',
         supplier_part_code: res.supplier_part_code || '',
         supplier_name: res.supplier_name || '',
         quantity: 1,
         unit_price: prod.sale_price || prod.retail_price || 0,
         image: prod.thumbnail_url || (prod as any).image || '',
       } as any;
       setFormItems(prev => [...(prev || []), newItem]);
    } else {
       handleAddFromCatalogItem(res.rawCat!, res.rawCatalog!);
    }
    setQuickSearch('');
    setShowQuickSearch(false);
  };

  const handleAddCustomItem = (customName = '') => {
    const newItem: PreOrderItem = {
      product_id: 0,
      product_name: customName.trim(),
      product_code: '',
      supplier_part_code: '',
      supplier_name: '',
      quantity: 1,
      unit_price: 0,
    } as any;
    setFormItems(prev => [...(prev || []), newItem]);
    setQuickSearch('');
    setShowQuickSearch(false);
  };

  const handleEdit = async (id: number, updateUrl = true, mode: 'view' | 'edit' = 'edit') => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getPreOrderById(id);
      if (data) {
        setEditingId(id);
        setFormMode(mode);
        setFormType(data.pre_order_type);
        setFormCustomerId(data.customer_id);
        
        let foundName = data.customer_name || '';
        let foundPhone = data.customer_phone || '';
        
        // If empty name, try to fallback to customers list
        if (!foundName && data.customer_id) {
          const cust = customers.find(c => c.id === data.customer_id);
          if (cust) {
            foundName = cust.customer_name;
            foundPhone = cust.customer_phone || (cust as any).phone || (cust as any).phone_number || '';
          }
        }
        
        const nameParts = foundName.split(' ');
        setFormCustomerFirstName(nameParts[0] || '');
        setFormCustomerLastName(nameParts.slice(1).join(' '));
        setFormCustomerPhone(formatPhoneNumber(foundPhone));
        setPhoneError('');

        setFormStatus(data.status);
        setFormItems(data.pre_order_items || []);
        setView('form');
        if (updateUrl) navigate(`${basePath}?edit=${id}${mode === 'view' ? '&mode=view' : ''}`);
      }
    } catch (err: any) {
      console.error('Error fetching pre-order detail:', err);
      setErrorMsg('ไม่สามารถดึงข้อมูลรายละเอียดรายการจองนี้ได้');
      toast({ variant: 'error', message: 'ไม่สามารถดึงข้อมูลรายละเอียดรายการจองนี้ได้' });
    } finally {
      setLoading(false);
    }
  };

  // URL เป็นแหล่งข้อมูลของหน้าปัจจุบัน จึงเปิดหน้าเดิมและโหลดรายการเดิมได้หลังรีเฟรช
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const editId = Number(params.get('edit'));

    if (Number.isInteger(editId) && editId > 0) {
      const modeParam = params.get('mode') === 'view' ? 'view' : 'edit';
      setView('form');
      if (editingId !== editId) void handleEdit(editId, false, modeParam);
      else setFormMode(modeParam);
      return;
    }

    if (params.get('view') === 'new') {
      setView('form');
      setFormMode('edit');
      return;
    }

    setView('list');
    setEditingId(null);
  }, [location.search]);

  const handleDelete = (id: number) => {
    setDeleteTargetId(id);
  };

  const handleConfirmDelete = async () => {
    if (deleteTargetId === null) return;
    setIsDeleting(true);
    try {
      await deletePreOrder(deleteTargetId);
      setPreOrders(prev => prev.filter(po => po.id !== deleteTargetId));
      toast({ variant: 'success', message: 'ลบรายการสั่งจองเรียบร้อยแล้ว' });
      setDeleteTargetId(null);
    } catch (err) {
      console.error('Error deleting pre-order:', err);
      toast({ variant: 'error', message: 'ล้มเหลวในการลบรายการสั่งจอง' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRemoveItem = (index: number) => {
    setRemoveItemIndex(index);
  };

  const handleConfirmRemoveItem = () => {
    if (removeItemIndex === null) return;
    setFormItems(prev => prev.filter((_, idx) => idx !== removeItemIndex));
    setRemoveItemIndex(null);
  };

  const handleItemChange = (index: number, field: keyof PreOrderItem, value: any) => {
    setFormItems(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value
      };
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId !== null && formMode === 'view') return;
    if (!formCustomerFirstName.trim() && !formCustomerId) {
      toast({ variant: 'warning', message: 'กรุณาระบุชื่อลูกค้า' });
      return;
    }
    if (formItems.length === 0) {
      toast({ variant: 'warning', message: 'กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ' });
      return;
    }
    const rawPhone = formCustomerPhone.replace(/\D/g, '');
    if (rawPhone.length > 0 && rawPhone.length !== 10) {
      const msg = 'กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก (08X-XXXXXXX)';
      setPhoneError(msg);
      toast({ variant: 'warning', message: msg });
      return;
    }
    setPhoneError('');

    setSaving(true);
    try {
      const fullName = `${formCustomerFirstName} ${formCustomerLastName}`.trim();
      const payload: Partial<PreOrder> = {
        pre_order_type: formType,
        customer_id: formCustomerId,
        customer_name: fullName,
        customer_phone: formCustomerPhone,
        status: formStatus,
        // These fields are not editable here. Omit them on update so the
        // server preserves the original deposit, supplier and booking date.
        ...(editingId ? {} : {
          deposit_amount: 0,
          supplier_id: 1,
          order_date: new Date().toISOString(),
        }),
        pre_order_items: formItems.map(item => ({
          product_id: Number(item.product_id) || 0,
          quantity: Number(item.quantity) || 1,
          unit_price: Number(item.unit_price) || 0,
          product_name: item.product_name,
          product_code: item.product_code || '',
          supplier_part_code: item.supplier_part_code || '',
          supplier_name: item.supplier_name || '',
        }))
      };

      if (editingId) {
        await updatePreOrder(editingId, payload);
      } else {
        await createPreOrder(payload);
      }
      toast({
        variant: 'success',
        message: editingId ? 'แก้ไขรายการสั่งจองเรียบร้อยแล้ว' : 'สร้างรายการสั่งจองเรียบร้อยแล้ว',
      });
      await fetchPreOrders();
      setView('list');
      setEditingId(null);
      navigate(basePath, { replace: true });
    } catch (err: any) {
      console.error('Error saving pre-order:', err);
      const message = err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูลใบจอง';
      setErrorMsg(message);
      toast({ variant: 'error', message });
    } finally {
      setSaving(false);
    }
  };

  const getCustomerInfo = (po: PreOrder) => {
    if (po.customer_name) {
      return {
        name: po.customer_name,
        phone: po.customer_phone || ''
      };
    }
    const matched = customers.find(c => c.id === po.customer_id);
    if (matched) {
      return {
        name: matched.customer_name,
        phone: matched.phone_number || matched.customer_phone || ''
      };
    }
    return {
      name: po.customer_id ? `ลูกค้า ID: ${po.customer_id}` : 'ลูกค้าทั่วไป',
      phone: ''
    };
  };

  const matchesSearchQuery = (po: PreOrder) => {
    const cust = getCustomerInfo(po);
    const q = searchQuery.toLowerCase();
    return (
      cust.name.toLowerCase().includes(q) ||
      cust.phone.includes(q) ||
      String(po.id).includes(q) ||
      `PRE-${String(po.id).padStart(5, '0')}`.toLowerCase().includes(q) ||
      (po.po_number && po.po_number.toLowerCase().includes(q))
    );
  };

  const matchesStatusFilter = (po: PreOrder, status: string) => {
    if (!status) return true;
    if (status === 'PO_PENDING') {
      return (
        po.status === 'PO_PENDING' ||
        po.status === 'PENDING' ||
        po.po_status === 'PENDING' ||
        po.po_status === 'DRAFT' ||
        !po.po_status
      );
    }
    if (status === 'ORDERED') {
      return po.status === 'ORDERED' || po.po_status === 'APPROVED';
    }
    return po.status === status;
  };

  const filteredOrders = preOrders.filter(po => matchesSearchQuery(po) && matchesStatusFilter(po, statusFilter));

  const allCount = preOrders.filter(matchesSearchQuery).length;
  const pendingApprovalCount = preOrders.filter(po => matchesSearchQuery(po) && matchesStatusFilter(po, 'PO_PENDING')).length;
  const awaitingStockCount = preOrders.filter(po => matchesSearchQuery(po) && matchesStatusFilter(po, 'ORDERED')).length;

  const totalItems = filteredOrders.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const columns = [
    {
      key: 'id',
      header: 'เลขที่ใบจอง',
      render: (po: PreOrder) => (
        <span className="font-mono font-bold text-[#e51c23]">
          PRE-{String(po.id).padStart(5, '0')}
        </span>
      )
    },
    {
      key: 'order_date',
      header: 'วันที่จอง',
      render: (po: PreOrder) => (
        <span className="text-[#5F5E5E] text-xs">
          {po.order_date ? new Date(po.order_date).toLocaleDateString('th-TH', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
          }) : '-'}
        </span>
      )
    },
    {
      key: 'customer',
      header: 'ชื่อลูกค้า',
      render: (po: PreOrder) => {
        const cust = getCustomerInfo(po);
        return (
          <div>
            <div className="font-bold text-[#1C1B1B]">{cust.name}</div>
            {cust.phone && <div className="text-xs text-[#5F5E5E]/80">{cust.phone}</div>}
          </div>
        );
      }
    },
    {
      key: 'type',
      header: 'ช่องทางการสั่ง',
      render: (po: PreOrder) => (
        <span className="text-xs bg-slate-100 px-2.5 py-1 rounded text-slate-600 font-semibold">
          {po.pre_order_type === 'WALK_IN' ? 'หน้าร้าน' : po.pre_order_type === 'LINE' ? 'LINE OA' : 'เบอร์โทรศัพท์'}
        </span>
      )
    },
    {
      key: 'status',
      header: 'สถานะ',
      render: (po: PreOrder) => {
        if (po.status === 'COMPLETED') {
          return (
            <Badge variant="success" size="auto">ส่งมอบแล้ว</Badge>
          );
        }
        if (po.status === 'CANCELLED') {
          return (
            <Badge variant="error" size="auto">ยกเลิก</Badge>
          );
        }
        if (po.status === 'ORDERED' || po.po_status === 'APPROVED') {
          return (
            <div className="flex flex-col items-start gap-0.5">
              <Badge variant="info" size="auto">รอสินค้า</Badge>
              {po.po_number && (
                <span className="text-[10px] text-[#5F5E5E] font-mono font-semibold">
                  PO: {po.po_number}
                </span>
              )}
            </div>
          );
        }
        return (
          <div className="flex flex-col items-start gap-0.5">
            <Badge variant="warning" size="auto">รออนุมัติสั่งซื้อ</Badge>
            {po.po_number && (
              <span className="text-[10px] text-[#5F5E5E] font-mono font-semibold">
                PO: {po.po_number}
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: 'actions',
      header: 'จัดการ',
      align: 'center' as const,
      render: (po: PreOrder) => (
        <div className="flex justify-center gap-2">
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(po.id!, true, 'edit');
            }} 
            className="p-1.5 hover:bg-gray-100 rounded-none text-[#5F5E5E] hover:text-[#1C1B1B] transition-colors cursor-pointer"
            title="แก้ไข"
          >
            <Edit size={16} />
          </button>
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(po.id!);
            }} 
            className="p-1.5 hover:bg-red-50 rounded-none text-[#5F5E5E] hover:text-[#e51c23] transition-colors cursor-pointer"
            title="ลบ"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )
    }
  ];

  const isReadOnly = editingId !== null && formMode === 'view';

  return (
    <div className="p-8 w-full font-sans">
      {view === 'list' ? (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Top Header & Action */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-2">
            <div>
              <Heading level="h1" className="mb-0 font-extrabold">
                ระบบจัดการสั่งจองสินค้าล่วงหน้า
              </Heading>
            </div>
            <Button 
              onClick={handleCreateNew}
              variant="primary"
              size="md"
              className="gap-2 font-bold shadow-sm"
            >
              <Plus size={18} />
              สร้างใบสั่งจองใหม่
            </Button>
          </div>

          {/* Table Container Card */}
          <Card className="overflow-hidden border border-gray-200 shadow-xs" noPadding>
            {/* Header Toolbar: Search */}
            <div className="p-4 bg-gray-50/80 border-b border-gray-200 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
              <div className="relative flex-1 min-w-60">
                <Input
                  type="text"
                  placeholder="ค้นหาชื่อลูกค้า, เบอร์โทร, เลขใบจอง หรือเลข PO..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  leftIcon={<Search size={16} className="text-gray-400" />}
                  className="text-xs h-10 w-full"
                />
              </div>
            </div>

            {/* Filter Tabs (แบบเดียวกับหน้าคืนสินค้า) */}
            <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-3 pt-2 shadow-xs overflow-x-auto">
              {[
                { label: 'ทั้งหมด', value: '', icon: FileText, count: allCount },
                { label: 'รออนุมัติสั่งซื้อ', value: 'PO_PENDING', icon: ClockAlert, count: pendingApprovalCount },
                { label: 'รอสินค้า', value: 'ORDERED', icon: Package, count: awaitingStockCount },
              ].map((st) => (
                <button
                  key={st.value}
                  type="button"
                  onClick={() => { setStatusFilter(st.value); setCurrentPage(1); }}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-normal border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                    statusFilter === st.value
                      ? 'border-[#e51c23] text-[#e51c23]'
                      : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <st.icon size={16} /> {st.label}
                  <span
                    className={`px-2 py-0.5 text-sm rounded-full ${
                      statusFilter === st.value
                        ? 'bg-red-600 text-white font-normal'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {st.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Table Content */}
            {loading ? (
              <div className="flex flex-col items-center justify-center p-12 min-h-[300px]">
                <Loader2 className="animate-spin text-[#e51c23] mb-3" size={36} />
                <span className="text-[#5F5E5E] font-medium text-sm">กำลังโหลดข้อมูลรายการจอง...</span>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 min-h-[300px] text-[#5F5E5E]">
                <FileText size={44} className="mb-3 text-gray-300" />
                <span className="font-bold text-base text-[#1C1B1B]">ไม่พบข้อมูลรายการจองล่วงหน้า</span>
                <p className="text-xs text-[#5F5E5E] mt-1">ลองเปลี่ยนคำค้นหา หรือกดสร้างใบสั่งจองใหม่</p>
              </div>
            ) : (
              <>
                <GenericTable
                  columns={columns}
                  data={paginatedOrders}
                  rowKey={(row) => row.id!}
                  isLoading={loading}
                  onRowClick={(po) => handleEdit(po.id!, true, 'view')}
                  className="border-0"
                />

                <div className="bg-gray-50 px-5 py-3 border-t border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-gray-500">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span>
                      แสดง {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} ถึง {Math.min(currentPage * itemsPerPage, totalItems)} จาก {totalItems} รายการ
                    </span>
                    <label className="flex items-center gap-1.5">
                      <span>แสดงทีละ:</span>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                        className="border border-gray-200 bg-white px-2 py-1 text-gray-700 outline-none cursor-pointer"
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                      </select>
                    </label>
                  </div>

                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      aria-label="หน้าแรก"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(1)}
                      className="p-1.5 text-gray-400 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronsLeft size={15} />
                    </button>
                    <button
                      type="button"
                      aria-label="หน้าก่อนหน้า"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(page => page - 1)}
                      className="p-1.5 text-gray-400 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronLeft size={15} />
                    </button>

                    {getPageNumbers(currentPage, totalPages).map((page, index) =>
                      page === '...' ? (
                        <span key={`ellipsis-${index}`} className="px-2 py-1 text-gray-400">…</span>
                      ) : (
                        <button
                          key={page}
                          type="button"
                          aria-current={currentPage === page ? 'page' : undefined}
                          onClick={() => setCurrentPage(page)}
                          className={`min-w-8 px-2 py-1.5 font-bold transition-colors cursor-pointer ${
                            currentPage === page
                              ? 'bg-[#e51c23] text-white'
                              : 'text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {page}
                        </button>
                      )
                    )}

                    <button
                      type="button"
                      aria-label="หน้าถัดไป"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(page => page + 1)}
                      className="p-1.5 text-gray-400 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronRight size={15} />
                    </button>
                    <button
                      type="button"
                      aria-label="หน้าสุดท้าย"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(totalPages)}
                      className="p-1.5 text-gray-400 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronsRight size={15} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="w-full animate-in fade-in duration-300 space-y-6">
          {/* Breadcrumbs Navigation */}
          <nav className="flex items-center gap-2 text-xs text-gray-500 mb-4">
            <Link
              to={basePath}
              className="hover:text-[#e51c23] transition-colors font-bold"
            >
              ระบบจัดการสั่งจองสินค้า
            </Link>
            <ChevronRight size={14} className="text-gray-400" />
            <span className="text-[#1C1B1B] font-bold">
              {isReadOnly ? 'ดูรายละเอียดใบสั่งจองสินค้า' : editingId ? 'แก้ไขใบสั่งจองสินค้า' : 'สร้างใบสั่งจองสินค้าล่วงหน้า'}
            </span>
          </nav>

          {/* 1. Header Section */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <Heading level="h2" className="mb-0 font-extrabold text-[#1C1B1B]">
                {isReadOnly ? 'รายละเอียดใบสั่งจองสินค้าล่วงหน้า' : editingId ? 'แก้ไขใบสั่งจองสินค้าล่วงหน้า' : 'สร้างใบสั่งจองสินค้าล่วงหน้า'}
              </Heading>
            </div>
            {isReadOnly && (
              <button
                type="button"
                onClick={() => { setFormMode('edit'); navigate(`${basePath}?edit=${editingId}`, { replace: true }); }}
                className="flex items-center gap-2 bg-[#1C1B1B] hover:bg-black text-white px-4 py-2.5 rounded-none text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Edit size={16} />
                แก้ไขใบสั่งจอง
              </button>
            )}
          </div>

          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded flex items-center gap-3">
              <AlertCircle size={20} className="shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 2. Main Layout (1 Column Full Width) */}
          <fieldset disabled={isReadOnly} className="space-y-6 border-0 p-0 m-0 min-w-0">

              {/* ข้อมูลการสั่งจอง */}
              <Card className="border-l-[5px] border-l-red-600">
                <CardHeader className="items-center justify-start gap-4">
                  <CardTitle className="text-lg">ข้อมูลผู้สั่งจอง</CardTitle>
                </CardHeader>
                <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start relative">
                  <Select
                    label="ช่องทางการจอง"
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    options={[
                      { label: 'หน้าร้าน', value: 'WALK_IN' },
                      { label: 'โทรศัพท์', value: 'TEL' }
                    ]}
                  />

                  {/* First Name Autocomplete */}
                  <div className="relative flex flex-col gap-1.5">
                    <label className="text-sm font-bold text-[#1C1B1B]">
                      ชื่อ ผู้สั่งจอง <span className="text-[#e51c23]">*</span>
                    </label>
                    <input
                      type="text"
                      value={formCustomerFirstName}
                      onChange={(e) => {
                        setFormCustomerFirstName(e.target.value);
                        setFormCustomerId(0); // reset id when typing
                        setShowCustomerDropdown(true);
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                      placeholder="พิมพ์ชื่อ..."
                      className="h-10 w-full bg-white border border-gray-300 rounded-none px-3 text-sm text-[#1C1B1B] focus:border-[#e51c23] outline-none transition-colors"
                      required
                    />
                    
                    {/* Dropdown for suggestions */}
                    {showCustomerDropdown && formCustomerFirstName.trim().length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 shadow-xl z-30 max-h-48 overflow-y-auto rounded-none min-w-[250px]">
                        {customers
                          .filter(c => c.customer_name.toLowerCase().includes(formCustomerFirstName.toLowerCase()))
                          .map(c => {
                            const phone = c.customer_phone || (c as any).phone || (c as any).phone_number || '';
                            const parts = c.customer_name.split(' ');
                            return (
                              <div
                                key={c.id}
                                className="px-3 py-2 cursor-pointer hover:bg-red-50 text-sm border-b border-gray-50 last:border-0"
                                onClick={() => {
                                  setFormCustomerFirstName(parts[0] || '');
                                  setFormCustomerLastName(parts.slice(1).join(' '));
                                  setFormCustomerId(c.id);
                                  setFormCustomerPhone(formatPhoneNumber(phone));
                                  setPhoneError('');
                                  setShowCustomerDropdown(false);
                                }}
                              >
                                <span className="font-bold text-[#1C1B1B]">{c.customer_name}</span>
                                {phone && <span className="text-[#5F5E5E] text-xs ml-2">({phone})</span>}
                              </div>
                            );
                          })
                        }
                      </div>
                    )}
                  </div>
                  
                  {/* Last Name */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-bold text-[#1C1B1B]">
                      นามสกุล
                    </label>
                    <input
                      type="text"
                      value={formCustomerLastName}
                      onChange={(e) => setFormCustomerLastName(e.target.value)}
                      placeholder="พิมพ์นามสกุล..."
                      className="h-10 w-full bg-white border border-gray-300 rounded-none px-3 text-sm text-[#1C1B1B] focus:border-[#e51c23] outline-none transition-colors"
                    />
                  </div>
                  
                  {/* Phone Number */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-bold text-[#1C1B1B]">
                      เบอร์โทรศัพท์
                    </label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={formCustomerPhone}
                      onChange={(e) => {
                        setFormCustomerPhone(formatPhoneNumber(e.target.value));
                        setPhoneError('');
                      }}
                      placeholder="08X-XXXXXXX"
                      maxLength={11}
                      className={`h-10 w-full bg-white border rounded-none px-3 text-sm text-[#1C1B1B] outline-none transition-colors ${
                        phoneError ? 'border-[#e51c23] focus:border-[#e51c23]' : 'border-gray-300 focus:border-[#e51c23]'
                      }`}
                    />
                    {phoneError && (
                      <span className="text-xs text-[#e51c23] font-medium">{phoneError}</span>
                    )}
                  </div>
                </div>
                </CardContent>
              </Card>

            {/* Card: รายการสินค้า */}
            <Card className="border-l-[5px] border-l-black">
              <CardHeader className="items-center justify-start gap-4">
                <CardTitle className="text-lg">รายการสินค้าสั่งจอง</CardTitle>
              </CardHeader>
              <CardContent>
              <div className="pb-4 flex flex-col sm:flex-row items-start sm:items-end gap-3 justify-between">
                {/* Unified Search Input (Stock + Catalog) */}
                <div className="relative w-full max-w-lg">
                  <label className="block text-xs font-bold text-[#1C1B1B] mb-1">
                    ค้นหาสินค้า (สต็อก + แคตตาล็อก) หรือพิมพ์ชื่อเพื่อเพิ่มรายการเอง
                  </label>
                  <div className="flex items-center bg-white border border-gray-300 focus-within:border-[#e51c23] rounded-none px-3 py-2 shadow-xs transition-colors h-10 w-full">
                    <Search size={16} className="text-gray-400 mr-2 shrink-0" />
                    <input
                      type="text"
                      placeholder="พิมพ์ชื่อสินค้า, รหัสสินค้า, หรือ Part Number..."
                      value={quickSearch}
                      onChange={(e) => { setQuickSearch(e.target.value); setShowQuickSearch(true); }}
                      onFocus={() => { if(quickSearch) setShowQuickSearch(true); }}
                      onBlur={() => setTimeout(() => setShowQuickSearch(false), 250)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (filteredQuickResults.length > 0) {
                            handleQuickAddUnified(filteredQuickResults[0]);
                          } else if (quickSearch.trim()) {
                            handleAddCustomItem(quickSearch);
                          }
                        }
                      }}
                      className="w-full text-sm text-[#1C1B1B] outline-none bg-transparent placeholder-gray-400"
                    />
                    {quickSearch && (
                       <button type="button" onClick={() => setQuickSearch('')} className="text-gray-400 hover:text-gray-600">
                         <X size={14} />
                       </button>
                    )}
                  </div>
                  
                  {/* Results Dropdown */}
                  {showQuickSearch && quickSearch.trim() && (
                    <div className="absolute top-full left-0 mt-1 w-full md:w-[560px] bg-white border border-gray-200 shadow-2xl z-50 max-h-80 overflow-y-auto rounded-none overflow-hidden">
                      {/* Option to add custom item typed */}
                      <div
                        className="px-3 py-2.5 bg-red-50/70 hover:bg-red-100/90 border-b border-red-100 cursor-pointer text-xs flex items-center justify-between transition-colors font-medium"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleAddCustomItem(quickSearch)}
                      >
                        <div className="flex items-center gap-2">
                          <Plus size={14} className="text-[#e51c23] shrink-0" />
                          <span className="text-[#1C1B1B]">
                            เพิ่ม <strong>"{quickSearch}"</strong> เป็นสินค้าสั่งจองแบบกำหนดเอง
                          </span>
                        </div>
                        <span className="text-[10px] text-[#e51c23] font-bold bg-white px-2 py-0.5 border border-red-200 shrink-0">
                          + เพิ่มรายการเอง
                        </span>
                      </div>

                      {filteredQuickResults.length > 0 && (
                        <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-100 text-[10px] font-bold text-gray-500">
                          ผลการค้นหาจากสต็อกและแคตตาล็อก (คลิกเพื่อเลือก)
                        </div>
                      )}

                      {filteredQuickResults.map((res, i) => (
                        <div 
                          key={res.id} 
                          className={`px-3 py-2.5 border-b border-gray-50 cursor-pointer text-xs flex items-center justify-between hover:bg-red-50/60 ${i === 0 ? 'bg-red-50/20' : ''}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleQuickAddUnified(res)}
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-[#1C1B1B]">{res.name}</span>
                            <div className="flex items-center gap-2 flex-wrap">
                              {res.code && (
                                <span className={`font-mono font-bold text-[10px] px-1.5 py-0.5 rounded-none ${res.type === 'STOCK' ? 'text-[#5F5E5E] bg-gray-100' : 'text-[#e51c23] bg-red-50 border border-red-100'}`}>
                                  {res.code}
                                </span>
                              )}
                              {res.type === 'STOCK' && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-none border ${
                                  (res.quantity ?? 0) > 0
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                  {(res.quantity ?? 0) > 0 ? `สต็อก: ${res.quantity} ชิ้น` : 'สต็อก: 0 ชิ้น (หมด)'}
                                </span>
                              )}
                              {res.category && <span className="text-[10px] text-gray-400">{res.category}</span>}
                              {res.type === 'CATALOG' && (
                                <span className="text-[10px] font-bold text-[#e51c23] flex items-center gap-0.5">
                                  <BookOpen size={10} /> จากแคตตาล็อก
                                </span>
                              )}
                            </div>
                          </div>
                          <Plus size={14} className="text-[#e51c23] shrink-0 opacity-80 group-hover:opacity-100 transition-opacity" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Direct Manual Add Button */}
                <button
                  type="button"
                  onClick={() => handleAddCustomItem('')}
                  className="flex items-center gap-1.5 bg-white border border-gray-300 hover:border-[#e51c23] hover:text-[#e51c23] text-[#1C1B1B] text-xs font-bold px-4 py-2 h-10 transition-colors shadow-2xs shrink-0 cursor-pointer"
                >
                  <Plus size={14} className="text-[#e51c23]" />
                  <span>+ เพิ่มรายการเอง (ไม่มีในระบบ)</span>
                </button>
              </div>

              <div className="overflow-x-auto min-h-[220px]">
                <Table className="min-w-[700px] text-left text-sm border-collapse">
                  <TableHeader className="bg-gray-100 text-[#5F5E5E] border-b border-gray-200 text-xs font-bold uppercase tracking-wider">
                    <TableRow>
                      <TableHead className="py-3 px-2 text-center w-14 font-bold text-[#5F5E5E]">ลำดับ</TableHead>
                      <TableHead className="py-3 px-2 text-center w-16 font-bold text-[#5F5E5E]">รูปภาพ</TableHead>
                      <TableHead className="py-3 px-3 font-bold text-left text-[#5F5E5E] min-w-[260px]">ชื่อสินค้า <span className="text-[#e51c23]">*</span></TableHead>
                      <TableHead className="py-3 px-3 font-bold text-left text-[#5F5E5E] w-48">รหัสสินค้า <span className="font-normal text-gray-400">(ไม่บังคับ)</span></TableHead>
                      <TableHead className="py-3 px-3 font-bold text-center text-[#5F5E5E] w-28">จำนวน</TableHead>
                      {!isReadOnly && (
                        <TableHead className="py-3 px-3 font-bold text-center text-[#5F5E5E] w-14 pr-4">ลบ</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100">
                    {formItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isReadOnly ? 5 : 6} className="py-12 text-center text-gray-500 bg-gray-50/50">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <AlertCircle size={36} className="text-gray-400" />
                            <p className="text-xs text-[#5F5E5E]">พิมพ์ค้นหาสินค้าด้านบน หรือกดปุ่ม <strong>"+ เพิ่มรายการเอง"</strong> เพื่อกรอกข้อมูลสินค้า</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      formItems.map((item, idx) => {
                        const matchedProd = products.find(p => p.id === Number(item.product_id));
                        const fromCatalog = !!item.supplier_part_code && Number(item.product_id) === 0;
                        const isFromStock = Number(item.product_id) > 0;
                        const isCustom = !fromCatalog && !isFromStock;
                        const imgUrl = (item as any).image || matchedProd?.thumbnail_url || (matchedProd as any)?.image || '';

                        return (
                          <TableRow key={idx} className="hover:bg-gray-50/70 transition-colors">
                            {/* # */}
                            <TableCell className="py-2.5 px-2 text-center align-top">
                              <div className="h-9 flex items-center justify-center text-xs font-bold text-[#5F5E5E]">
                                {idx + 1}
                              </div>
                            </TableCell>

                            {/* ภาพสินค้า */}
                            <TableCell className="py-2.5 px-2 text-center align-top">
                              <div className="h-9 flex items-center justify-center">
                                {imgUrl ? (
                                  <img src={imgUrl} alt={item.product_name} className="w-12 h-8 object-contain bg-white border border-gray-200 p-0.5 mx-auto rounded-none shadow-xs" />
                                ) : (
                                  <div className="w-12 h-8 bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center mx-auto text-gray-300 rounded-none">
                                    <ImageIcon size={14} />
                                  </div>
                                )}
                              </div>
                            </TableCell>

                            {/* ชื่อสินค้า (Editable Input) */}
                            <TableCell className="py-2.5 px-3 align-top">
                              <div className="flex flex-col gap-1.5">
                                <input
                                  type="text"
                                  value={item.product_name || ''}
                                  onChange={(e) => handleItemChange(idx, 'product_name', e.target.value)}
                                  placeholder="ระบุชื่อสินค้า..."
                                  className="w-full h-9 bg-white border border-gray-300 focus:border-[#e51c23] rounded-none px-3 text-xs font-bold text-[#1C1B1B] outline-none shadow-2xs"
                                  required
                                />
                                <div className="flex items-center gap-1.5 min-h-[18px]">
                                  {fromCatalog && (
                                    <span className="text-[10px] text-[#e51c23] font-bold bg-red-50 border border-red-100 px-1.5 py-0.5 inline-block">จากแคตตาล็อก</span>
                                  )}
                                  {isFromStock && (
                                    <span className="text-[10px] text-blue-700 font-bold bg-blue-50 border border-blue-100 px-1.5 py-0.5 inline-block">จากสต็อก</span>
                                  )}
                                  {isCustom && (
                                    <span className="text-[10px] text-gray-600 font-bold bg-gray-100 border border-gray-200 px-1.5 py-0.5 inline-block">กรอกเอง</span>
                                  )}
                                </div>
                              </div>
                            </TableCell>

                            {/* รหัสสินค้า (Editable Input, ไม่บังคับ) */}
                            <TableCell className="py-2.5 px-3 align-top">
                              <div className="flex flex-col gap-1.5">
                                <input
                                  type="text"
                                  value={item.product_code || ''}
                                  onChange={(e) => handleItemChange(idx, 'product_code', e.target.value)}
                                  placeholder="-"
                                  className="w-full h-9 bg-white border border-gray-300 focus:border-[#e51c23] rounded-none px-3 text-xs font-mono font-bold text-[#1C1B1B] outline-none shadow-2xs"
                                />
                              </div>
                            </TableCell>

                            {/* จำนวน */}
                            <TableCell className="py-2.5 px-3 text-center align-top">
                              <div className="flex flex-col items-center gap-1.5">
                                <input
                                  type="number"
                                  min={1}
                                  value={item.quantity}
                                  onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                  className="w-20 h-9 bg-white border border-gray-300 rounded-none px-2 text-xs text-center font-bold text-[#1C1B1B] focus:border-[#e51c23] outline-none shadow-2xs"
                                />
                              </div>
                            </TableCell>

                            {/* ลบ — ซ่อนไปเลยตอนโหมดดูอย่างเดียว แทนที่จะโชว์ปุ่มค้างๆ กดไม่ได้ */}
                            {!isReadOnly && (
                              <TableCell className="py-2.5 px-3 text-center pr-4 align-top">
                                <div className="flex flex-col items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(idx)}
                                    className="h-9 w-9 text-gray-400 hover:text-[#e51c23] hover:bg-red-50 p-1.5 rounded transition-colors cursor-pointer inline-flex items-center justify-center"
                                    title="ลบรายการนี้"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              </CardContent>
            </Card>

          </fieldset>

          {/* Bottom Summary and Actions (Without Price) */}
          <div className="border-t border-gray-100 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#fafafa] rounded-none mt-6 gap-4">
            <div className="text-sm text-[#5F5E5E] space-y-1 text-left">
              <p>
                จำนวนรายการทั้งหมด :{' '}
                <span className="text-[#1C1B1B] font-bold">{formItems.length} รายการ</span>
              </p>
              <p>
                จำนวนชิ้นรวม :{' '}
                <span className="text-[#1C1B1B] font-bold">
                  {formItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)} ชิ้น
                </span>
              </p>
            </div>
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => { setView('list'); setEditingId(null); navigate(basePath); }}
                disabled={saving}
                className="bg-white border border-gray-300 text-[#1C1B1B] hover:bg-gray-100 px-5 py-3 rounded-none text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 h-[42px]"
              >
                {isReadOnly ? 'ปิด' : 'ยกเลิก'}
              </button>
              {!isReadOnly && (
                <Button
                  type="submit"
                  variant="primary"
                  disabled={saving}
                  className="gap-2 text-xs font-bold shadow-xs px-6 py-3 rounded-none h-[42px] bg-[#e51c23] hover:bg-[#c9181f] text-white"
                >
                  {saving ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>บันทึกใบสั่งจอง</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>
      )}

      {/* ===== CATALOG PICKER MODAL ===== */}
      {showCatalogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-gray-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
              <div>
                <h2 className="text-base font-extrabold text-[#1C1B1B] flex items-center gap-2">
                  <BookOpen size={18} className="text-[#e51c23]" /> เลือกสินค้าจากแคตตาล็อกคู่ค้า
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">เลือกเล่มแคตตาล็อก แล้วคลิกรายการอะไหล่ที่ต้องการเพิ่มลงใบจอง</p>
              </div>
              <button type="button" onClick={() => setShowCatalogModal(false)} className="text-gray-400 hover:text-black p-1 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Left: Catalog list */}
              <div className="w-64 border-r border-gray-200 flex flex-col shrink-0">
                <div className="p-3 border-b border-gray-100">
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="ค้นหาเล่ม..."
                      value={catalogSearch}
                      onChange={e => setCatalogSearch(e.target.value)}
                      className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-300 focus:border-[#e51c23] outline-none"
                    />
                  </div>
                </div>
                <div className="overflow-y-auto flex-1">
                  {catalogs
                    .filter(c => !catalogSearch || c.catalog_name.toLowerCase().includes(catalogSearch.toLowerCase()) || (c.supplier_name || '').toLowerCase().includes(catalogSearch.toLowerCase()))
                    .map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => { setSelectedCatalogId(cat.id!); setCatalogItemSearch(''); }}
                        className={`w-full text-left px-3 py-2.5 border-b border-gray-100 transition-colors cursor-pointer ${selectedCatalogId === cat.id ? 'bg-[#e51c23] text-white' : 'hover:bg-gray-50 text-[#1C1B1B]'}`}
                      >
                        <p className={`font-bold text-xs truncate ${selectedCatalogId === cat.id ? 'text-white' : 'text-[#1C1B1B]'}`}>{cat.catalog_name}</p>
                        <div className={`flex items-center gap-1 mt-0.5 ${selectedCatalogId === cat.id ? 'text-red-100' : 'text-gray-500'}`}>
                          <Building2 size={10} />
                          <p className="text-[10px] truncate">{cat.supplier_name || 'ไม่ระบุซัพพลายเออร์'}</p>
                        </div>
                        <p className={`text-[10px] mt-0.5 font-bold ${selectedCatalogId === cat.id ? 'text-red-100' : 'text-gray-400'}`}>
                          {cat.catalog_items?.length || 0} รายการ
                        </p>
                      </button>
                    ))
                  }
                  {catalogs.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-8">ยังไม่มีแคตตาล็อก</p>
                  )}
                </div>
              </div>

              {/* Right: Items in selected catalog */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {selectedCatalogId ? (() => {
                  const cat = catalogs.find(c => c.id === selectedCatalogId);
                  const items = (cat?.catalog_items || []).filter(it =>
                    !catalogItemSearch ||
                    (it.part_name || '').toLowerCase().includes(catalogItemSearch.toLowerCase()) ||
                    (it.part_number || '').toLowerCase().includes(catalogItemSearch.toLowerCase()) ||
                    (it.st_no || '').toLowerCase().includes(catalogItemSearch.toLowerCase())
                  );
                  return (
                    <>
                      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50/60 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-extrabold text-sm text-[#1C1B1B]">{cat?.catalog_name}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Building2 size={11} /> {cat?.supplier_name || 'ไม่ระบุ'} — {items.length} รายการ
                          </p>
                        </div>
                        <div className="relative w-52">
                          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            placeholder="ค้นหารายการ..."
                            value={catalogItemSearch}
                            onChange={e => setCatalogItemSearch(e.target.value)}
                            className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-300 focus:border-[#e51c23] outline-none"
                          />
                        </div>
                      </div>
                      <div className="overflow-y-auto flex-1">
                        <table className="w-full text-xs border-collapse">
                          <thead className="bg-gray-100 sticky top-0">
                            <tr>
                              <th className="py-2 px-3 text-left font-bold text-gray-600 w-16">รูปภาพ</th>
                              <th className="py-2 px-3 text-left font-bold text-gray-600 w-32">รหัสสินค้าคู่ค้า</th>
                              <th className="py-2 px-3 text-left font-bold text-gray-600 w-32">PART NO</th>
                              <th className="py-2 px-3 text-left font-bold text-gray-600">ชื่ออะไหล่</th>
                              <th className="py-2 px-3 text-left font-bold text-gray-600 w-40">รุ่นรถที่รองรับ</th>
                              <th className="py-2 px-3 text-center font-bold text-gray-600 w-20">เพิ่ม</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {items.length === 0 ? (
                              <tr><td colSpan={6} className="py-10 text-center text-gray-400">ไม่พบรายการ</td></tr>
                            ) : items.map((it, i) => (
                              <tr key={i} className="hover:bg-red-50/30 transition-colors">
                                <td className="py-2 px-3">
                                  {it.image ? (
                                    <img src={it.image} alt={it.part_name} className="w-12 h-12 object-cover bg-white border border-gray-200" />
                                  ) : (
                                    <div className="w-12 h-12 bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400">
                                      <Package size={16} />
                                    </div>
                                  )}
                                </td>
                                <td className="py-2 px-3">
                                  <span className="font-mono font-bold text-[#e51c23]">{it.st_no || '-'}</span>
                                </td>
                                <td className="py-2 px-3">
                                  <span className="font-mono font-bold text-gray-700">{it.part_number || '-'}</span>
                                </td>
                                <td className="py-2 px-3 font-bold text-[#1C1B1B]">{it.part_name}</td>
                                <td className="py-2 px-3 text-gray-500">{it.compatible_cars || '-'}</td>
                                <td className="py-2 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => { handleAddFromCatalogItem(it, cat!); }}
                                    className="bg-[#e51c23] hover:bg-[#c9181f] text-white text-[10px] font-bold px-2.5 py-1 cursor-pointer transition-colors inline-flex items-center gap-1"
                                  >
                                    <Plus size={11} /> เพิ่ม
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  );
                })() : (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2">
                    <BookOpen size={40} className="text-gray-300" />
                    <p className="text-sm font-bold">เลือกเล่มแคตตาล็อกทางด้านซ้าย</p>
                    <p className="text-xs">เพื่อดูรายการอะไหล่ในเล่ม</p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                รายการที่เลือกแล้ว: <strong className="text-[#e51c23]">{formItems.filter((it: any) => it.supplier_part_code).length}</strong> รายการจากแคตตาล็อก
              </span>
              <Button type="button" variant="primary" size="md" onClick={() => setShowCatalogModal(false)} className="bg-[#1C1B1B] hover:bg-black text-white font-bold text-xs">
                เสร็จสิ้น — ปิด
              </Button>
            </div>
          </div>
        </div>
      )}

      {(() => {
        const deleteTarget = deleteTargetId !== null ? preOrders.find(po => po.id === deleteTargetId) : null;
        const deleteCustomer = deleteTarget ? getCustomerInfo(deleteTarget) : null;
        return (
          <ConfirmDialog
            isOpen={deleteTargetId !== null}
            onClose={() => !isDeleting && setDeleteTargetId(null)}
            onConfirm={handleConfirmDelete}
            title="ยืนยันการลบใบสั่งจอง"
            description={(
              <div className="space-y-3 text-sm text-slate-700 text-left">
                <p className="text-center text-slate-600">คุณต้องการลบรายการสั่งจองนี้ใช่หรือไม่? การลบไม่สามารถย้อนกลับได้</p>
                {deleteTarget && (
                  <div className="bg-[#f6f3f2] p-3 space-y-2 mt-2">
                    <div className="flex justify-between gap-4 text-xs">
                      <span className="text-slate-500">ลูกค้า</span>
                      <span className="font-semibold text-slate-900">{deleteCustomer?.name || '-'}</span>
                    </div>
                    <div className="flex justify-between gap-4 text-xs">
                      <span className="text-slate-500">จำนวนรายการ</span>
                      <span className="font-medium text-slate-900">{deleteTarget.pre_order_items?.length || 0} รายการ</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            confirmText="ยืนยันการลบ"
            cancelText="ยกเลิก"
            variant="danger"
            isSubmitting={isDeleting}
          />
        );
      })()}

      {(() => {
        const removeTarget = removeItemIndex !== null ? formItems[removeItemIndex] : null;
        return (
          <ConfirmDialog
            isOpen={removeItemIndex !== null}
            onClose={() => setRemoveItemIndex(null)}
            onConfirm={handleConfirmRemoveItem}
            title="ลบรายการสินค้านี้"
            description={(
              <div className="space-y-3 text-sm text-slate-700 text-left">
                <p className="text-center text-slate-600">คุณต้องการลบสินค้ารายการนี้ออกจากใบสั่งจองใช่หรือไม่?</p>
                {removeTarget && (
                  <div className="bg-[#f6f3f2] p-3 space-y-2 mt-2">
                    <div className="flex justify-between gap-4 text-xs">
                      <span className="text-slate-500">สินค้า</span>
                      <span className="font-semibold text-slate-900 truncate max-w-48">{removeTarget.product_name || '-'}</span>
                    </div>
                    <div className="flex justify-between gap-4 text-xs">
                      <span className="text-slate-500">จำนวน</span>
                      <span className="font-medium text-slate-900">{removeTarget.quantity}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            confirmText="ยืนยันการลบ"
            cancelText="ยกเลิก"
            variant="danger"
          />
        );
      })()}
    </div>
  );
}
