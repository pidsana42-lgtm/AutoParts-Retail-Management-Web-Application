import React, { useState, useEffect } from 'react';
import apiClient from '../../../service/http/apiClient';
import { 
  Plus, Search, Edit, Trash2, ChevronLeft, Save, 
  Package, FileText, 
  CheckCircle, Clock, XCircle, Loader2, AlertCircle
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
import Table from '../../../components/elements/table';

interface Customer {
  id: number;
  customer_name: string;
  customer_phone: string;
}

interface Product {
  id: number;
  product_name: string;
  product_code: string;
  sale_price: number;
}

export default function PreOrderManager() {
  const [preOrders, setPreOrders] = useState<PreOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  // UI Views & states
  const [view, setView] = useState<'list' | 'form'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Form state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formType, setFormType] = useState<string>('WALK_IN');
  const [formCustomerId, setFormCustomerId] = useState<number>(0);
  const [formStatus, setFormStatus] = useState<string>('PENDING');
  const [formItems, setFormItems] = useState<PreOrderItem[]>([]);

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
      const [custRes, prodRes] = await Promise.all([
        apiClient.get('/customers'),
        apiClient.get('/wms/products'),
      ]);
      
      setCustomers(Array.isArray(custRes.data) ? custRes.data : (custRes.data.data || []));
      setProducts(Array.isArray(prodRes.data) ? prodRes.data : (prodRes.data.data || []));
    } catch (err) {
      console.error('Error fetching dropdown helper data:', err);
    }
  };

  const handleCreateNew = () => {
    setEditingId(null);
    setFormType('WALK_IN');
    setFormCustomerId(customers[0]?.id || 0);
    setFormStatus('PENDING');
    setFormItems([]);
    setView('form');
    setErrorMsg(null);
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

  const handleAddItem = () => {
    if (products.length === 0) return;
    const defaultProduct = products[0];
    const newItem: PreOrderItem = {
      product_id: defaultProduct.id,
      quantity: 1,
      unit_price: 0
    };
    setFormItems(prev => [...prev, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    setFormItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: keyof PreOrderItem, value: any) => {
    setFormItems(prev => {
      const updated = [...prev];
      if (field === 'product_id') {
        updated[index] = {
          ...updated[index],
          product_id: Number(value)
        };
      } else if (field === 'quantity') {
        updated[index] = { ...updated[index], quantity: Number(value) || 1 };
      }
      return updated;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formCustomerId === 0) {
      setErrorMsg('กรุณาเลือกข้อมูลลูกค้า');
      return;
    }
    if (formItems.length === 0) {
      setErrorMsg('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    const payload: PreOrder = {
      pre_order_type: formType,
      customer_id: formCustomerId,
      deposit_amount: 0,
      status: formStatus,
      supplier_id: 1,
      pre_order_items: formItems.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: 0
      })),
      order_date: new Date().toISOString()
    };

    try {
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

  const filteredOrders = preOrders.filter(po => {
    const custName = po.customer_name?.toLowerCase() || '';
    const phone = po.customer_phone || '';
    const q = searchQuery.toLowerCase();
    return custName.includes(q) || phone.includes(q) || String(po.id).includes(q);
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
      render: (po: PreOrder) => (
        <div>
          <div className="font-bold text-[#1C1B1B]">{po.customer_name}</div>
          <div className="text-xs text-[#5F5E5E]/80">{po.customer_phone}</div>
        </div>
      )
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
      render: (po: PreOrder) => (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold ${
          po.status === 'COMPLETED' 
            ? 'bg-[#259b24]/10 text-[#259b24] border border-[#259b24]/30' 
            : po.status === 'CANCELLED' 
              ? 'bg-red-50 text-red-600 border border-red-100' 
              : 'bg-amber-50 text-amber-600 border border-amber-100'
        }`}>
          {po.status === 'COMPLETED' ? (
            <CheckCircle size={14} />
          ) : po.status === 'CANCELLED' ? (
            <XCircle size={14} />
          ) : (
            <Clock size={14} />
          )}
          {po.status === 'COMPLETED' ? 'ส่งมอบแล้ว' : po.status === 'CANCELLED' ? 'ยกเลิก' : 'กำลังจัดหาอะไหล่'}
        </span>
      )
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
            className="p-1.5 hover:bg-slate-100 rounded text-slate-600 transition-colors cursor-pointer"
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
            className="p-1.5 hover:bg-red-50 rounded text-red-600 transition-colors cursor-pointer"
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
              <Heading level="h1" className="mb-0 font-extrabold flex items-center gap-3">
                <Package className="text-[#e51c23]" size={32} />
                ระบบจัดการสั่งจองสินค้าล่วงหน้า
              </Heading>
              <p className="text-sm text-[#5F5E5E] mt-1">บันทึกและติดตามสถานะสั่งจองมัดจำอะไหล่สำหรับลูกค้าและช่าง</p>
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
              <div className="relative w-full md:w-80">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อลูกค้า, เบอร์โทร หรือเลขใบจอง..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-none pl-9 pr-3 py-2 text-xs font-medium text-[#1C1B1B] focus:border-[#e51c23] outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto">
                {[
                  { label: 'ทั้งหมด', value: '' },
                  { label: 'ค้างส่งสินค้า', value: 'PENDING' },
                  { label: 'ส่งมอบแล้ว', value: 'COMPLETED' },
                  { label: 'ยกเลิก', value: 'CANCELLED' }
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
              <Table 
                columns={columns}
                data={filteredOrders}
                rowKey={(row) => row.id!}
                isLoading={loading}
              />
            )}
          </Card>
        </div>
      ) : (
        <form onSubmit={handleSave} className="w-full animate-in fade-in duration-300 space-y-6">
          {/* 1. Header Section */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <button 
                type="button" 
                onClick={() => setView('list')} 
                className="p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                <ChevronLeft size={24} className="text-slate-600" />
              </button>
              <div>
                <Heading level="h2" className="mb-0 font-extrabold text-[#1C1B1B]">
                  {editingId ? 'แก้ไขใบสั่งจองสินค้าล่วงหน้า' : 'สร้างใบสั่งจองสินค้าล่วงหน้า'}
                </Heading>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded flex items-center gap-3">
              <AlertCircle size={20} className="shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 2. Main Layout (Grid 2/3 and 1/3) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* เลนซ้าย: ข้อมูลหลัก และ รายการสินค้า */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Card: ข้อมูลการสั่งจอง */}
              <Card title="ข้อมูลการสั่งจอง">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <Select 
                    label="ลูกค้าในระบบ" 
                    value={String(formCustomerId)}
                    onChange={(e) => setFormCustomerId(Number(e.target.value))}
                    options={[
                      { label: '-- เลือกข้อมูลลูกค้า --', value: '0' },
                      ...customers.map(c => ({
                        label: `${c.customer_name} (${c.customer_phone})`,
                        value: String(c.id)
                      }))
                    ]} 
                  />
                  <Select 
                    label="สถานะใบสั่งจอง" 
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    options={[
                      { label: 'กำลังดำเนินการ / รอส่งมอบ', value: 'PENDING' },
                      { label: 'ส่งมอบเสร็จสิ้น', value: 'COMPLETED' },
                      { label: 'ยกเลิกรายการสั่งจอง', value: 'CANCELLED' }
                    ]} 
                  />
                </div>
              </Card>

              {/* Card: รายการสินค้า */}
              <Card 
                title="รายการสินค้าสั่งจอง" 
                headerAction={
                  <Button 
                    type="button"
                    variant="outline" 
                    size="sm" 
                    onClick={handleAddItem}
                    className="gap-2"
                  >
                    <Plus size={16} /> เพิ่มสินค้า
                  </Button>
                }
                noPadding
              >
                <div className="p-5 overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs font-bold text-[#5F5E5E]/80">
                        <th className="py-2 w-3/4">เลือกสินค้า</th>
                        <th className="py-2 text-right w-1/4">จำนวน</th>
                        <th className="py-2 text-center w-12">ลบ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-slate-700">
                      {formItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-3">
                            <select
                              value={item.product_id}
                              onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                              className="w-full border border-slate-200 px-3 py-1.5 text-xs text-[#1C1B1B] focus:outline-none focus:border-indigo-500 font-semibold"
                            >
                              {products.map(p => (
                                <option key={p.id} value={p.id}>[{p.product_code}] {p.product_name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3 px-2">
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                              className="w-full border border-slate-200 p-1 text-xs text-right focus:outline-none focus:border-indigo-500 text-[#1C1B1B] font-semibold"
                            />
                          </td>
                          <td className="py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

            </div>

            {/* เลนขวา: การดำเนินการ */}
            <div className="lg:col-span-1 space-y-6 sticky top-24">
              <Card title="สรุปใบสั่งจอง">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-[#5F5E5E]">
                    <span>จำนวนรายการสินค้า:</span>
                    <span className="font-bold text-[#1C1B1B]">{formItems.length} รายการ</span>
                  </div>
                  <div className="flex justify-between text-[#5F5E5E]">
                    <span>รวมจำนวนอะไหล่ทั้งสิ้น:</span>
                    <span className="font-bold text-[#e51c23]">{formItems.reduce((s, i) => s + i.quantity, 0)} ชิ้น</span>
                  </div>
                </div>
              </Card>

              {/* Action Buttons กลุ่มไว้ใต้สรุป */}
              <div className="flex flex-col gap-3">
                <Button 
                  type="submit" 
                  variant="primary" 
                  size="lg" 
                  disabled={saving}
                  className="w-full gap-2 text-sm font-bold shadow-sm"
                >
                  {saving ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <>
                      <Save size={20} />
                      <span>บันทึกใบสั่งจอง</span>
                    </>
                  )}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="lg" 
                  onClick={() => setView('list')}
                  className="w-full bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 text-sm font-bold shadow-sm"
                >
                  ยกเลิก
                </Button>
              </div>
            </div>

          </div>
        </form>
      )}
    </div>
  );
}