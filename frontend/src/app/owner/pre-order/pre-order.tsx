import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import apiClient from '../../../service/http/apiClient';
import { 
  Plus, Search, Edit, Trash2, ChevronRight, Save, 
  FileText, BookOpen, Building2, X,
  Loader2, AlertCircle, ImageIcon, Package
} from 'lucide-react';
import {
  getPreOrders, getPreOrderById, createPreOrder,
  updatePreOrder, deletePreOrder
} from '../../../service/http/pre-order/pre-order';
import type{ PreOrder, PreOrderItem } from '../../../interface/pre-order/pre-order';
import Heading from '../../../components/elements/heading';
import Card from '../../../components/elements/card';
import Select from '../../../components/elements/select';
import Button from '../../../components/elements/button';
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

export default function PreOrderManager() {
  const location = useLocation();
  const [preOrders, setPreOrders] = useState<PreOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  
  // UI Views & states
  const [view, setView] = useState<'list' | 'form'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
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
  const [formType, setFormType] = useState<string>('WALK_IN');
  const [formCustomerId, setFormCustomerId] = useState<number>(0);
  const [formCustomerFirstName, setFormCustomerFirstName] = useState<string>('');
  const [formCustomerLastName, setFormCustomerLastName] = useState<string>('');
  const [formCustomerPhone, setFormCustomerPhone] = useState<string>('');
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

      // Clean state so refreshing won't re-trigger
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

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
    setFormType('WALK_IN');
    setFormCustomerId(0);
    setFormCustomerFirstName('');
    setFormCustomerLastName('');
    setFormCustomerPhone('');
    setFormStatus('PENDING');
    setFormItems([]);
    setView('form');
    setErrorMsg(null);
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
    supplier_part_code?: string;
    supplier_name?: string;
    rawProd?: Product;
    rawCat?: CatalogItem;
    rawCatalog?: Catalog;
    image?: string;
  };

  const filteredQuickResults = React.useMemo(() => {
    if (!quickSearch) return [];
    const q = quickSearch.toLowerCase();
    
    const results: UnifiedSearchResult[] = [];
    
    // 1. Search in products (STOCK)
    const matchedProducts = products.filter(p => 
      p.product_code?.toLowerCase().includes(q) || 
      p.product_name?.toLowerCase().includes(q) ||
      p.category_name?.toLowerCase().includes(q)
    ).slice(0, 10);
    
    matchedProducts.forEach(p => {
       results.push({
         type: 'STOCK',
         id: `stock-${p.id}`,
         product_id: p.id,
         name: p.product_name,
         code: p.product_code,
         category: p.category_name,
         price: p.sale_price || p.retail_price || 0,
         rawProd: p
       });
    });

    // 2. Search in catalogs
    let catalogMatches = 0;
    for (const cat of catalogs) {
      if (catalogMatches >= 10) break;
      if (!cat.catalog_items) continue;
      
      for (const item of cat.catalog_items) {
        if (
          item.part_number.toLowerCase().includes(q) ||
          item.part_name.toLowerCase().includes(q) ||
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
             rawCatalog: cat
           });
           catalogMatches++;
           if (catalogMatches >= 10) break;
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
         product_code: prod.product_code,
         quantity: 1,
         unit_price: prod.sale_price || prod.retail_price || 0
       };
       setFormItems(prev => [...(prev || []), newItem]);
    } else {
       handleAddFromCatalogItem(res.rawCat!, res.rawCatalog!);
    }
    setQuickSearch('');
    setShowQuickSearch(false);
  };

  const handleEdit = async (id: number) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getPreOrderById(id);
      if (data) {
        setEditingId(id);
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
        setFormCustomerPhone(foundPhone);
        
        setFormStatus(data.status);
        setFormItems(data.pre_order_items || []);
        setView('form');
      }
    } catch (err: any) {
      console.error('Error fetching pre-order detail:', err);
      setErrorMsg('ไม่สามารถดึงข้อมูลรายละเอียดรายการจองนี้ได้');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการสั่งจองนี้?')) return;
    try {
      await deletePreOrder(id);
      setPreOrders(prev => prev.filter(po => po.id !== id));
    } catch (err) {
      console.error('Error deleting pre-order:', err);
      alert('ล้มเหลวในการลบรายการสั่งจอง');
    }
  };

  const handleRemoveItem = (index: number) => {
    setFormItems(prev => prev.filter((_, idx) => idx !== index));
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
    if (!formCustomerFirstName.trim() && !formCustomerId) {
      alert('กรุณาระบุชื่อลูกค้า');
      return;
    }
    if (formItems.length === 0) {
      alert('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ');
      return;
    }

    setSaving(true);
    try {
      const fullName = `${formCustomerFirstName} ${formCustomerLastName}`.trim();
      const payload: Partial<PreOrder> = {
        pre_order_type: formType,
        customer_id: formCustomerId,
        customer_name: fullName,
        customer_phone: formCustomerPhone,
        status: formStatus,
        deposit_amount: 0,
        supplier_id: 1, // Default supplier id
        order_date: new Date().toISOString(), // Fixed 400 Bad Request (OrderDate is required)
        pre_order_items: formItems.map(item => ({
          product_id: Number(item.product_id) || 1, // Fallback to 1 if 0/NaN to pass binding:"required"
          quantity: Number(item.quantity) || 1,
          unit_price: Number(item.unit_price) || 0,
          product_name: item.product_name,
          product_code: item.product_code,
        }))
      };

      if (editingId) {
        await updatePreOrder(editingId, payload);
      } else {
        await createPreOrder(payload);
      }
      await fetchPreOrders();
      setView('list');
    } catch (err: any) {
      console.error('Error saving pre-order:', err);
      setErrorMsg(err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูลใบจอง');
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

  const filteredOrders = preOrders.filter(po => {
    const cust = getCustomerInfo(po);
    const q = searchQuery.toLowerCase();
    const matchesSearch = (
      cust.name.toLowerCase().includes(q) || 
      cust.phone.includes(q) || 
      String(po.id).includes(q) ||
      `PRE-${String(po.id).padStart(5, '0')}`.toLowerCase().includes(q) ||
      (po.po_number && po.po_number.toLowerCase().includes(q))
    );

    if (!matchesSearch) return false;

    if (!statusFilter) return true;
    if (statusFilter === 'PO_PENDING') {
      return (
        po.status === 'PO_PENDING' || 
        po.status === 'PENDING' || 
        po.po_status === 'PENDING' || 
        po.po_status === 'DRAFT' || 
        !po.po_status
      );
    }
    if (statusFilter === 'ORDERED') {
      return po.status === 'ORDERED' || po.po_status === 'APPROVED';
    }

    return po.status === statusFilter;
  });

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
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-none text-xs font-bold bg-[#259b24]/10 text-[#259b24] border border-[#259b24]/30">
              ส่งมอบแล้ว
            </span>
          );
        }
        if (po.status === 'CANCELLED') {
          return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-none text-xs font-bold bg-red-50 text-[#e51c23] border border-red-200">
              ยกเลิก
            </span>
          );
        }
        if (po.status === 'ORDERED' || po.po_status === 'APPROVED') {
          return (
            <div className="flex flex-col items-start gap-0.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-none text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                รอสินค้า
              </span>
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
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-none text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              รออนุมัติสั่งซื้อ
            </span>
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
              handleEdit(po.id!);
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
            {/* Header Toolbar: Search on Left, Filter Tabs on Right */}
            <div className="p-4 bg-gray-50/80 border-b border-gray-200 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
              <div className="relative flex-1 min-w-[240px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อลูกค้า, เบอร์โทร, เลขใบจอง หรือเลข PO..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-none pl-9 pr-3 py-2 text-xs font-medium text-[#1C1B1B] focus:border-[#e51c23] outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto">
                {[
                  { label: 'ทั้งหมด', value: '' },
                  { label: 'รออนุมัติสั่งซื้อ', value: 'PO_PENDING' },
                  { label: 'รอสินค้า', value: 'ORDERED' }
                ].map((st) => (
                  <button
                    key={st.value}
                    type="button"
                    onClick={() => setStatusFilter(st.value)}
                    className={`px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer rounded-none border ${
                      statusFilter === st.value
                        ? 'bg-[#1C1B1B] text-white border-[#1C1B1B] shadow-xs'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
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
              <GenericTable 
                columns={columns}
                data={filteredOrders}
                rowKey={(row) => row.id!}
                isLoading={loading}
              />
            )}
          </Card>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="w-full animate-in fade-in duration-300 space-y-6">
          {/* Breadcrumbs Navigation */}
          <nav className="flex items-center gap-2 text-xs text-gray-500 mb-4">
            <button 
              type="button" 
              onClick={() => { setView('list'); setEditingId(null); }} 
              className="hover:text-[#e51c23] transition-colors cursor-pointer font-bold"
            >
              ระบบจัดการสั่งจองสินค้า
            </button>
            <ChevronRight size={14} className="text-gray-400" />
            <span className="text-[#1C1B1B] font-bold">
              {editingId ? 'แก้ไขใบสั่งจองสินค้า' : 'สร้างใบสั่งจองสินค้าล่วงหน้า'}
            </span>
          </nav>

          {/* 1. Header Section */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <Heading level="h2" className="mb-0 font-extrabold text-[#1C1B1B]">
                {editingId ? 'แก้ไขใบสั่งจองสินค้าล่วงหน้า' : 'สร้างใบสั่งจองสินค้าล่วงหน้า'}
              </Heading>
            </div>
          </div>

          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded flex items-center gap-3">
              <AlertCircle size={20} className="shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 2. Main Layout (1 Column Full Width) */}
          <div className="space-y-6">
            
              {/* ข้อมูลการสั่งจอง */}
              <Card title="ข้อมูลผู้สั่งจอง">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start relative">
                  <Select 
                    label="ช่องทางการจอง" 
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    options={[
                      { label: 'หน้าร้าน', value: 'WALK_IN' },
                      { label: 'LINE OA', value: 'LINE' },
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
                                  setFormCustomerPhone(phone);
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
                      value={formCustomerPhone}
                      onChange={(e) => setFormCustomerPhone(e.target.value)}
                      placeholder="08X-XXX-XXXX"
                      className="h-10 w-full bg-white border border-gray-300 rounded-none px-3 text-sm text-[#1C1B1B] focus:border-[#e51c23] outline-none transition-colors"
                    />
                  </div>
                </div>
              </Card>

            {/* Card: รายการสินค้า */}
            <Card title="รายการสินค้าสั่งจอง">
              <div className="pb-4">
                {/* Unified Search Input (Stock + Catalog) */}
                <div className="relative w-full max-w-md">
                  <label className="block text-xs font-bold text-[#1C1B1B] mb-1">
                    ค้นหาสินค้า (สต็อก + แคตตาล็อก)
                  </label>
                  <div className="flex items-center bg-white border border-gray-300 focus-within:border-[#e51c23] rounded-none px-3 py-2 shadow-xs transition-colors h-10 w-full">
                    <Search size={16} className="text-gray-400 mr-2 shrink-0" />
                    <input
                      type="text"
                      placeholder="พิมพ์ค้นหา หรือยิงบาร์โค้ดเพิ่ม..."
                      value={quickSearch}
                      onChange={(e) => { setQuickSearch(e.target.value); setShowQuickSearch(true); }}
                      onFocus={() => { if(quickSearch) setShowQuickSearch(true); }}
                      onBlur={() => setTimeout(() => setShowQuickSearch(false), 200)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && filteredQuickResults.length > 0) {
                          e.preventDefault();
                          handleQuickAddUnified(filteredQuickResults[0]);
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
                  {showQuickSearch && quickSearch && (
                    <div className="absolute top-full left-0 mt-1 w-full md:w-[500px] bg-white border border-gray-200 shadow-2xl z-50 max-h-72 overflow-y-auto rounded-none overflow-hidden">
                      {filteredQuickResults.length > 0 && (
                        <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-100 text-[10px] font-bold text-gray-500">
                          กด Enter เพื่อเพิ่มรายการแรก หรือคลิกเลือกรายการ
                        </div>
                      )}
                      {filteredQuickResults.map((res, i) => (
                        <div 
                          key={res.id} 
                          className={`px-3 py-2 border-b border-gray-50 cursor-pointer text-xs flex items-center justify-between hover:bg-red-50 ${i === 0 ? 'bg-red-50/30' : ''}`}
                          onClick={() => handleQuickAddUnified(res)}
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-[#1C1B1B]">{res.name}</span>
                            <div className="flex items-center gap-2">
                              <span className={`font-mono font-bold text-[10px] px-1 rounded-none ${res.type === 'STOCK' ? 'text-[#5F5E5E] bg-gray-100' : 'text-[#e51c23] bg-red-50 border border-red-100'}`}>
                                {res.code}
                              </span>
                              {res.category && <span className="text-[10px] text-gray-400">{res.category}</span>}
                              {res.type === 'CATALOG' && (
                                <span className="text-[10px] font-bold text-[#e51c23] flex items-center gap-0.5">
                                  <BookOpen size={10} /> จากแคตตาล็อก
                                </span>
                              )}
                            </div>
                          </div>
                          <Plus size={14} className="text-[#e51c23] opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      ))}
                      {filteredQuickResults.length === 0 && (
                        <div className="p-4 text-center text-gray-500 text-xs flex flex-col items-center gap-1">
                          <AlertCircle size={20} className="text-gray-300" />
                          <p>ไม่พบสินค้าในสต็อกและแคตตาล็อก</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto min-h-[220px]">
                <Table className="min-w-[800px] text-left text-sm border-collapse">
                  <TableHeader className="bg-gray-100 text-[#5F5E5E] border-b border-gray-200 text-xs font-bold uppercase tracking-wider">
                    <TableRow>
                      <TableHead className="py-3 px-3 text-center w-10 font-bold text-[#5F5E5E]">#</TableHead>
                      <TableHead className="py-3 px-3 text-center w-24 font-bold text-[#5F5E5E]">ภาพสินค้า</TableHead>
                      <TableHead className="py-3 px-3 font-bold text-left text-[#5F5E5E] min-w-[260px]">ชื่อสินค้า</TableHead>
                      <TableHead className="py-3 px-3 font-bold text-left text-[#5F5E5E] w-36">รหัสสินค้า</TableHead>
                      <TableHead className="py-3 px-3 font-bold text-left text-[#5F5E5E] w-36">รหัสสินค้าคู่ค้า</TableHead>
                      <TableHead className="py-3 px-3 font-bold text-left text-[#5F5E5E] w-36">บริษัทคู่ค้า</TableHead>
                      <TableHead className="py-3 px-3 font-bold text-center text-[#5F5E5E] w-24">จำนวน</TableHead>
                      <TableHead className="py-3 px-3 font-bold text-center text-[#5F5E5E] w-12 pr-4">ลบ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100">
                    {formItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-12 text-center text-gray-500 bg-gray-50/50">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <AlertCircle size={36} className="text-gray-400" />
                            <p className="text-xs text-[#5F5E5E]">พิมพ์ค้นหาและเลือกสินค้าจากช่องค้นหาด้านบนเพื่อเพิ่มรายการ</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      formItems.map((item, idx) => {
                        const matchedProd = products.find(p => p.id === Number(item.product_id));
                        const code = matchedProd?.product_code || item.product_code || '-';
                        const supplierPartCode = (item as any).supplier_part_code || '';
                        const supplierName = (item as any).supplier_name || '';
                        const fromCatalog = !!(item as any).supplier_part_code;
                        const imgUrl = (item as any).image || matchedProd?.thumbnail_url || matchedProd?.image || '';

                        return (
                          <TableRow key={idx} className={`hover:bg-gray-50/70 align-middle transition-colors ${fromCatalog ? 'bg-red-50/20' : ''}`}>
                            {/* # */}
                            <TableCell className="py-3 px-3 text-center text-xs font-bold text-[#5F5E5E]">
                              {idx + 1}
                            </TableCell>

                            {/* ภาพสินค้า */}
                            <TableCell className="py-2.5 px-3 text-center">
                              {imgUrl ? (
                                <img src={imgUrl} alt={item.product_name} className="w-16 h-10 object-contain bg-white border border-gray-200 p-0.5 mx-auto rounded-none shadow-xs" />
                              ) : (
                                <div className="w-16 h-10 bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center mx-auto text-gray-300 rounded-none">
                                  <ImageIcon size={14} />
                                </div>
                              )}
                            </TableCell>

                            {/* ชื่อสินค้า */}
                            <TableCell className="py-2.5 px-3">
                              <div>
                                <p className="font-bold text-xs text-[#1C1B1B]">{item.product_name}</p>
                                {fromCatalog && (
                                  <span className="text-[10px] text-[#e51c23] font-bold bg-red-50 border border-red-100 px-1.5 py-0.5 inline-block mt-0.5">จากแคตตาล็อก</span>
                                )}
                              </div>
                            </TableCell>

                            {/* รหัสสินค้า */}
                            <TableCell className="py-2.5 px-3">
                              <span className="font-mono text-xs font-bold text-[#1C1B1B] bg-gray-100 px-2 py-1 border border-gray-200 inline-block">
                                {code}
                              </span>
                            </TableCell>

                            {/* รหัสคู่ค้า */}
                            <TableCell className="py-2.5 px-3">
                              {supplierPartCode ? (
                                <span className="font-mono text-xs font-bold text-[#e51c23] bg-red-50 border border-red-100 px-2 py-1 inline-block">
                                  {supplierPartCode}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs">-</span>
                              )}
                            </TableCell>

                            {/* บริษัทคู่ค้า */}
                            <TableCell className="py-2.5 px-3">
                              {supplierName ? (
                                <span className="text-xs text-[#1C1B1B] font-bold flex items-center gap-1">
                                  <Building2 size={12} className="text-[#5F5E5E] shrink-0" />
                                  {supplierName}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs">-</span>
                              )}
                            </TableCell>

                            {/* จำนวน */}
                            <TableCell className="py-2.5 px-3 text-center">
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                className="w-20 bg-white border border-gray-300 rounded-none px-2 py-1.5 text-xs text-center font-bold text-[#1C1B1B] focus:border-[#e51c23] outline-none shadow-2xs"
                              />
                            </TableCell>

                            {/* ลบ */}
                            <TableCell className="py-2.5 px-3 text-center pr-4">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-gray-400 hover:text-[#e51c23] hover:bg-red-50 p-1.5 rounded transition-colors cursor-pointer inline-flex items-center justify-center"
                              >
                                <Trash2 size={15} />
                              </button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>

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
                  onClick={() => setView('list')}
                  disabled={saving}
                  className="bg-white border border-gray-300 text-[#1C1B1B] hover:bg-gray-100 px-5 py-3 rounded-none text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 h-[42px]"
                >
                  ยกเลิก
                </button>
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
              </div>
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
    </div>
  );
}