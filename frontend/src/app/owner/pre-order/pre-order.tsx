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
import Input from '../../../components/elements/input';

interface Customer {
  id: number;
  customer_name: string;
  customer_phone: string;
}

interface Supplier {
  id: number;
  supplier_name: string;
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
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
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
  const [formSupplierId, setFormSupplierId] = useState<number>(0);
  const [formDepositAmount, setFormDepositAmount] = useState<number>(0);
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
      const [custRes, suppRes, prodRes] = await Promise.all([
        apiClient.get('/customers'),
        apiClient.get('/wms/suppliers'),
        apiClient.get('/wms/products'),
      ]);
      
      setCustomers(Array.isArray(custRes.data) ? custRes.data : (custRes.data.data || []));
      setSuppliers(Array.isArray(suppRes.data) ? suppRes.data : (suppRes.data.data || []));
      setProducts(Array.isArray(prodRes.data) ? prodRes.data : (prodRes.data.data || []));
    } catch (err) {
      console.error('Error fetching dropdown helper data:', err);
    }
  };

  const handleCreateNew = () => {
    setEditingId(null);
    setFormType('WALK_IN');
    setFormCustomerId(customers[0]?.id || 0);
    setFormSupplierId(suppliers[0]?.id || 0);
    setFormDepositAmount(0);
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
        setFormSupplierId(data.supplier_id);
        setFormDepositAmount(data.deposit_amount);
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
      unit_price: defaultProduct.sale_price || 0
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
        const prod = products.find(p => p.id === Number(value));
        updated[index] = {
          ...updated[index],
          product_id: Number(value),
          unit_price: prod ? prod.sale_price : updated[index].unit_price
        };
      } else if (field === 'quantity') {
        updated[index] = { ...updated[index], quantity: Number(value) || 1 };
      } else if (field === 'unit_price') {
        updated[index] = { ...updated[index], unit_price: Number(value) || 0 };
      }
      return updated;
    });
  };

  const calculateTotal = () => {
    return formItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formCustomerId === 0) {
      setErrorMsg('กรุณาเลือกข้อมูลลูกค้า');
      return;
    }
    if (formSupplierId === 0) {
      setErrorMsg('กรุณาเลือกผู้ผลิต/ซัพพลายเออร์');
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
      deposit_amount: formDepositAmount,
      status: formStatus,
      supplier_id: formSupplierId,
      pre_order_items: formItems,
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
        <span className="font-mono font-bold text-[#b32025]">
          PRE-{String(po.id).padStart(5, '0')}
        </span>
      )
    },
    {
      key: 'order_date',
      header: 'วันที่จอง',
      render: (po: PreOrder) => (
        <span className="text-gray-500 text-xs">
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
          <div className="font-bold text-slate-800">{po.customer_name}</div>
          <div className="text-xs text-slate-400">{po.customer_phone}</div>
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
            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
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
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-5">
            <div>
              <Heading level="h1" className="mb-0 font-extrabold flex items-center gap-3">
                <Package className="text-[#b32025]" size={36} />
                ระบบจัดการสั่งจองสินค้าล่วงหน้า (Pre-Orders)
              </Heading>
              <p className="text-sm text-slate-500 mt-1">บันทึก ติดตามสถานะสินค้าจองมัดจำอะไหล่ด่วนสำหรับลูกค้าและช่าง</p>
            </div>
            <Button 
              onClick={handleCreateNew}
              variant="primary"
              size="md"
              className="gap-2 font-bold shadow-sm"
            >
              <Plus size={20} />
              สร้างใบสั่งจองใหม่
            </Button>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm items-stretch md:items-center">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="ค้นหาชื่อลูกค้า, เบอร์โทรศัพท์ หรือเลขที่ใบสั่งจอง..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search size={18} />}
                className="bg-slate-50 border border-slate-200"
              />
            </div>
            <div className="flex gap-2 shrink-0 items-center">
              {['', 'PENDING', 'COMPLETED', 'CANCELLED'].map((status) => (
                <Button
                  key={status}
                  type="button"
                  variant={statusFilter === status ? 'primary' : 'outline'}
                  onClick={() => setStatusFilter(status)}
                  className={`font-bold text-xs h-10 px-4 ${statusFilter === status ? 'border-2 border-transparent' : ''}`}
                >
                  {status === '' ? 'ทั้งหมด' : status === 'PENDING' ? 'ค้างส่งสินค้า' : status === 'COMPLETED' ? 'ส่งมอบแล้ว' : 'ยกเลิก'}
                </Button>
              ))}
            </div>
          </div>

          {/* Table List Section */}
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-slate-100 shadow-sm min-h-[300px]">
              <Loader2 className="animate-spin text-[#b32025] mb-3" size={40} />
              <span className="text-slate-500 font-medium">กำลังโหลดข้อมูลรายการจอง...</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-slate-100 shadow-sm min-h-[300px] text-slate-400">
              <FileText size={48} className="mb-3 text-slate-300" />
              <span className="font-semibold text-lg text-slate-600">ไม่พบข้อมูลรายการจองล่วงหน้า</span>
              <p className="text-xs text-slate-400 mt-1">ลองเปลี่ยนคำค้นหา หรือกดปุ่มบวกเพื่อเพิ่มใบสั่งจองใหม่</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden p-1">
              <Table 
                columns={columns}
                data={filteredOrders}
                rowKey={(row) => row.id!}
                isLoading={loading}
              />
            </div>
          )}
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
                <Heading level="h2" className="mb-0 font-extrabold text-slate-900">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select 
                    label="ช่องทางการจอง" 
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    options={[
                      { label: 'หน้าร้าน (Walk-in)', value: 'WALK_IN' },
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
                    label="สั่งของกับผู้ผลิต / ซัพพลายเออร์" 
                    value={String(formSupplierId)}
                    onChange={(e) => setFormSupplierId(Number(e.target.value))}
                    options={[
                      { label: '-- เลือกซัพพลายเออร์ --', value: '0' },
                      ...suppliers.map(s => ({
                        label: s.supplier_name,
                        value: String(s.id)
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
                      <tr className="border-b border-slate-100 text-xs font-bold text-slate-400">
                        <th className="py-2 w-1/2">เลือกสินค้า</th>
                        <th className="py-2 text-right w-1/5">จำนวน</th>
                        <th className="py-2 text-right w-1/5">ราคา/ชิ้น</th>
                        <th className="py-2 text-right">รวมเงิน</th>
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
                              className="w-full border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-semibold"
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
                              className="w-full border border-slate-200 p-1 text-xs text-right focus:outline-none focus:border-indigo-500 text-slate-800 font-semibold"
                            />
                          </td>
                          <td className="py-3 px-2">
                            <input
                              type="number"
                              min={0}
                              value={item.unit_price}
                              onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                              className="w-full border border-slate-200 p-1 text-xs text-right focus:outline-none focus:border-indigo-500 text-slate-800 font-semibold"
                            />
                          </td>
                          <td className="py-3 text-right font-bold text-gray-900 text-xs">
                            ฿{(item.quantity * item.unit_price).toLocaleString()}
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

            {/* เลนขวา: สรุปยอด */}
            <div className="lg:col-span-1 space-y-6 sticky top-24">
              <Card title="สรุปยอดใบสั่งจอง">
                <div className="space-y-4">
                  <div className="flex justify-between text-slate-500 text-sm">
                    <span>รวมราคาอะไหล่ทั้งสิ้น</span>
                    <span className="font-bold text-slate-900 text-base">฿{calculateTotal().toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                  </div>
                  
                  <hr className="border-slate-100" />
                  
                  <div className="flex justify-between items-end">
                    <span className="text-slate-800 font-bold text-sm">ยอดรวมสุทธิ</span>
                    <span className="text-3xl font-extrabold text-[#b32025]">฿{calculateTotal().toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </Card>

              {/* Action Buttons กลุ่มไว้ใต้สรุปยอด */}
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