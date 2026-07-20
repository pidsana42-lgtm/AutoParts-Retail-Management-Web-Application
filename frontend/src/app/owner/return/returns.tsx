import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, Plus, Minus, Upload, 
  CheckCircle, ChevronLeft, 
  FileText, Clock, XCircle
} from 'lucide-react';
import Heading from '../../../components/elements/heading';
import Card from '../../../components/elements/card';
import Input from '../../../components/elements/input';
import Select from '../../../components/elements/select';
import Button from '../../../components/elements/button';
import Table from '../../../components/elements/table';
import { posApiService } from '../../../service/http/pos/pos_service';

interface ReturnItem {
  id: number;
  return_no: string;
  return_date: string;
  customer_name: string;
  customer_phone: string;
  quantity: number;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  reason?: string;
  remarks?: string;
}

const DEFAULT_RETURNS: ReturnItem[] = [
  {
    id: 1,
    return_no: 'RTN-2026-0001',
    return_date: '2026-07-01T09:00:00Z',
    customer_name: 'บริษัท สมหวังไอที จำกัด',
    customer_phone: '02-345-6789',
    quantity: 1,
    amount: 12500,
    status: 'PENDING',
    reason: 'ORDER_ERROR',
    remarks: 'ลูกค้าแจ้งสั่งซื้อเครื่องพิมพ์รุ่นผิด ต้องการเปลี่ยนเป็นรุ่น PRO-X2'
  },
  {
    id: 2,
    return_no: 'RTN-2026-0002',
    return_date: '2026-07-05T16:45:00Z',
    customer_name: 'คุณกิตติศักดิ์ พรหมดี',
    customer_phone: '081-234-5678',
    quantity: 2,
    amount: 25090,
    status: 'COMPLETED',
    reason: 'QUALITY_ISSUE',
    remarks: 'สินค้ามีตำหนิและรอยบุบจากการขนส่ง'
  },
  {
    id: 3,
    return_no: 'RTN-2026-0003',
    return_date: '2026-07-06T11:20:00Z',
    customer_name: 'อู่สงวนอะไหล่ยนต์',
    customer_phone: '089-876-5432',
    quantity: 50,
    amount: 2250,
    status: 'CANCELLED',
    reason: 'CUSTOMER_CHANGE_MIND',
    remarks: 'เปลี่ยนใจยกเลิกความต้องการคืน'
  },
];

export default function ReturnsPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [view, setView] = useState<'list' | 'return-form'>('list');
  const [returnSearch, setReturnSearch] = useState('');
  const [returnFilter, setReturnFilter] = useState('');

  const [returns, setReturns] = useState<ReturnItem[]>(() => {
    const saved = localStorage.getItem('mock_returns');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    localStorage.setItem('mock_returns', JSON.stringify(DEFAULT_RETURNS));
    return DEFAULT_RETURNS;
  });

  // Return Form States
  const [returnReceiptSearch, setReturnReceiptSearch] = useState('');
  const [isReceiptSearched, setIsReceiptSearched] = useState(false);
  const [receiptCustomerName, setReceiptCustomerName] = useState('บริษัท สมหวังไอที จำกัด');
  const [receiptCustomerPhone, setReceiptCustomerPhone] = useState('02-345-6789');
  const [receiptSalesperson, setReceiptSalesperson] = useState('น.ส. สมหญิง รักษ์บริการ');
  const [receiptDateStr, setReceiptDateStr] = useState('15 ตุลาคม 2025 14:30');
  const [receiptItems, setReceiptItems] = useState<Array<{
    product_name: string;
    price: number;
    sold_qty: number;
    return_qty: number;
    checked: boolean;
  }>>([
    { product_name: 'เครื่องพิมพ์บาร์โค้ด PRO-X', price: 12500, sold_qty: 2, return_qty: 1, checked: true },
    { product_name: 'ม้วนกระดาษความร้อน 80x80mm', price: 45, sold_qty: 50, return_qty: 0, checked: false }
  ]);
  const [returnReason, setReturnReason] = useState('ORDER_ERROR');
  const [returnRemarks, setReturnRemarks] = useState('');

  // Filtered Returns
  const filteredReturns = returns.filter(item => {
    const matchesSearch = 
      item.return_no.toLowerCase().includes(returnSearch.toLowerCase()) ||
      item.customer_name.toLowerCase().includes(returnSearch.toLowerCase());
    
    const matchesStatus = returnFilter === '' || item.status === returnFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Handle return search invoice mapping
  const handleSearchReturnInvoice = async () => {
    const query = returnReceiptSearch.trim().toUpperCase();
    if (!query) {
      alert('กรุณากรอกหมายเลขใบสั่งซื้อ');
      return;
    }

    try {
      const order = await posApiService.getSaleOrderByNumber(query);
      if (order) {
        const cName = order.customer?.customer_name || order.customer_name_temp || 'ลูกค้าทั่วไป';
        const cPhone = order.customer?.phone_number || order.customer_phone_temp || '-';
        
        setReceiptCustomerName(cName);
        setReceiptCustomerPhone(cPhone);
        setReceiptSalesperson('พนักงาน POS');
        setReceiptDateStr(new Date(order.OrderDate).toLocaleDateString('th-TH', {
          year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }));
        
        if (order.items && order.items.length > 0) {
          const items = order.items.map((item: any) => ({
            product_name: item.product_name || (item.product ? item.product.Name : 'อะไหล่ยนต์'),
            price: item.final_unit_price || item.unit_price,
            sold_qty: item.qty || 1,
            return_qty: 0,
            checked: false
          }));
          setReceiptItems(items);
        } else {
          setReceiptItems([]);
        }
        setIsReceiptSearched(true);
        return;
      }
    } catch (err) {
      console.warn('API call failed, falling back to mock receipt.', err);
    }

    // Mock fallback
    if (query === 'INV-2023-089') {
      setReceiptCustomerName('บริษัท สมหวังไอที จำกัด');
      setReceiptCustomerPhone('02-345-6789');
      setReceiptSalesperson('น.ส. สมหญิง รักษ์บริการ');
      setReceiptDateStr('15 ตุลาคม 2025 14:30');
      setReceiptItems([
        { product_name: 'เครื่องพิมพ์บาร์โค้ด PRO-X', price: 12500, sold_qty: 2, return_qty: 1, checked: true },
        { product_name: 'ม้วนกระดาษความร้อน 80x80mm', price: 45, sold_qty: 50, return_qty: 0, checked: false }
      ]);
      setIsReceiptSearched(true);
    } else if (query === 'INV-2023-090') {
      setReceiptCustomerName('คุณกิตติศักดิ์ พรหมดี');
      setReceiptCustomerPhone('081-234-5678');
      setReceiptSalesperson('น.ส. สมหญิง รักษ์บริการ');
      setReceiptDateStr('18 ตุลาคม 2025 10:15');
      setReceiptItems([
        { product_name: 'โช้คอัพหลัง ยี่ห้อ TOKI', price: 2500, sold_qty: 4, return_qty: 1, checked: true },
        { product_name: 'กรองอากาศ เบอร์ 24', price: 500, sold_qty: 10, return_qty: 2, checked: true }
      ]);
      setIsReceiptSearched(true);
    } else {
      // Fallback general mock
      setReceiptCustomerName('ลูกค้าทั่วไป');
      setReceiptCustomerPhone('-');
      setReceiptSalesperson('พนักงาน POS');
      setReceiptDateStr('วันนี้');
      setReceiptItems([
        { product_name: 'กรองอากาศ เบอร์ 24', price: 500, sold_qty: 10, return_qty: 1, checked: true }
      ]);
      setIsReceiptSearched(true);
    }
  };

  // Handle saving new return
  const handleSaveReturn = (e: React.FormEvent) => {
    e.preventDefault();
    
    let totalQty = 0;
    let totalAmount = 0;

    const selectedItems = receiptItems.filter(item => item.checked && item.return_qty > 0);
    if (selectedItems.length === 0) {
      alert('กรุณาเลือกสินค้าและระบุจำนวนที่จะรับคืนอย่างน้อย 1 ชิ้น');
      return;
    }

    selectedItems.forEach(item => {
      totalQty += item.return_qty;
      totalAmount += item.return_qty * item.price;
    });

    const newReturn: ReturnItem = {
      id: returns.length + 1,
      return_no: `RTN-2026-${String(returns.length + 1).padStart(4, '0')}`,
      return_date: new Date().toISOString(),
      customer_name: receiptCustomerName,
      customer_phone: receiptCustomerPhone,
      quantity: totalQty,
      amount: totalAmount,
      status: 'PENDING',
      reason: returnReason,
      remarks: returnRemarks || `${selectedItems.map(si => `${si.product_name} (${si.return_qty} ชิ้น)`).join(', ')}`
    };

    const updated = [newReturn, ...returns];
    setReturns(updated);
    localStorage.setItem('mock_returns', JSON.stringify(updated));
    
    // Reset Form
    setIsReceiptSearched(false);
    setReturnReceiptSearch('');
    setReturnRemarks('');
    setView('list');
    alert('บันทึกคำขอการคืนเงินเรียบร้อยแล้ว (สถานะ: รอตรวจสอบ)');
  };

  // Table Columns config for returns
  const returnColumns = [
    {
      key: 'return_no',
      header: 'เลขที่ใบรับคืน',
      render: (row: ReturnItem) => (
        <span className="font-mono font-bold text-[#b32025]">
          {row.return_no}
        </span>
      )
    },
    {
      key: 'return_date',
      header: 'วันที่รับคืน',
      render: (row: ReturnItem) => (
        <span className="text-xs text-slate-500 font-semibold">
          {new Date(row.return_date).toLocaleDateString('th-TH', {
            year: 'numeric', month: 'short', day: 'numeric'
          })}
        </span>
      )
    },
    {
      key: 'customer_name',
      header: 'ชื่อลูกค้า',
      render: (row: ReturnItem) => (
        <div>
          <p className="font-bold text-slate-800 text-sm">{row.customer_name}</p>
          <p className="text-xs text-slate-400 font-bold">{row.customer_phone}</p>
        </div>
      )
    },
    {
      key: 'quantity',
      header: 'จำนวนรับคืน',
      align: 'center' as const,
      render: (row: ReturnItem) => (
        <span className="font-bold text-slate-700">{row.quantity} ชิ้น</span>
      )
    },
    {
      key: 'amount',
      header: 'ยอดเงินคืนสุทธิ',
      align: 'right' as const,
      render: (row: ReturnItem) => (
        <span className="font-extrabold text-slate-900">
          ฿{row.amount.toLocaleString()}
        </span>
      )
    },
    {
      key: 'status',
      header: 'สถานะ',
      align: 'center' as const,
      render: (row: ReturnItem) => (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
          row.status === 'COMPLETED' 
            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
            : row.status === 'CANCELLED' 
              ? 'bg-red-50 text-red-600 border border-red-100' 
              : 'bg-amber-50 text-amber-600 border border-amber-100'
        }`}>
          {row.status === 'COMPLETED' ? (
            <CheckCircle size={12} />
          ) : row.status === 'CANCELLED' ? (
            <XCircle size={12} />
          ) : (
            <Clock size={12} />
          )}
          {row.status === 'COMPLETED' ? 'คืนสำเร็จ' : row.status === 'CANCELLED' ? 'ยกเลิก' : 'รอตรวจสอบ'}
        </span>
      )
    },
    {
      key: 'actions',
      header: 'จัดการ',
      align: 'right' as const,
      render: (row: ReturnItem) => (
        <Button 
          onClick={() => navigate(`/owner/returns/detail/${row.id}`)}
          variant="outline" 
          size="sm"
          className="font-bold text-xs border-[#b32025] text-[#b32025] hover:bg-[#b32025] hover:text-white"
        >
          ตรวจบิลคืนเงิน
        </Button>
      )
    }
  ];

  return (
    <div className="space-y-6 p-6 font-sans">
      
      {view === 'list' ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Top Bar Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Heading level="h1" className="mb-1 text-slate-800">จัดการใบคืนสินค้าและคืนเงิน</Heading>
              <p className="text-sm text-slate-500 font-semibold">อนุมัติและจัดการใบคืนสินค้าของลูกค้าจากระบบหน้าร้าน POS</p>
            </div>
            <div>
              <Button 
                onClick={() => setView('return-form')}
                className="bg-[#b32025] hover:bg-[#9a1a1f] text-white flex items-center gap-2 shadow-sm font-bold h-10 px-5 rounded-lg text-sm"
              >
                <Plus size={18} /> สร้างเอกสารการรับคืน
              </Button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm items-stretch md:items-center justify-between">
            <div className="flex-1 max-w-md">
              <Input 
                type="text" 
                placeholder="ค้นหาด้วยเลขที่ใบรับคืน หรือชื่อลูกค้า..." 
                value={returnSearch}
                onChange={(e) => setReturnSearch(e.target.value)}
                leftIcon={<Search size={20} />}
                className="bg-slate-50 border border-slate-200"
              />
            </div>
            
            <div className="w-full md:w-48">
              <Select
                value={returnFilter}
                onChange={(e) => setReturnFilter(e.target.value)}
                options={[
                  { value: '', label: 'ทุกสถานะ' },
                  { value: 'PENDING', label: 'รอตรวจสอบ' },
                  { value: 'COMPLETED', label: 'คืนเงินสำเร็จ' },
                  { value: 'CANCELLED', label: 'ยกเลิก' },
                ]}
                className="bg-slate-50 border border-slate-200"
              />
            </div>
          </div>

          {/* Returns List Table */}
          <Card noPadding>
            <Table 
              columns={returnColumns}
              data={filteredReturns}
              rowKey={(row) => row.id}
            />
          </Card>
        </div>
      ) : (
        
        // VIEW: RETURN DETAILS FORM (1 Column Layout)
        <form onSubmit={handleSaveReturn} className="w-full space-y-6 animate-in fade-in duration-300">
          
          {/* Header */}
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
                  รายละเอียดการคืนสินค้า
                </Heading>
              </div>
            </div>
            
            <Button 
              type="submit"
              variant="primary" 
              className="bg-[#b32025] hover:bg-[#9a1a1f] gap-2 shadow-sm font-bold"
            >
              <Upload size={18} /> ส่งใบคืนสินค้า
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Left section: Search receipt & Select items */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Search bar */}
              <div className="w-full bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-2">
                <p className="text-sm text-slate-600 font-bold">ค้นหาใบเสร็จสั่งซื้อด้วยหมายเลขใบสั่งซื้อหรือชื่อลูกค้า</p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input 
                      type="text" 
                      placeholder="เช่น INV-2023-089" 
                      value={returnReceiptSearch}
                      onChange={(e) => setReturnReceiptSearch(e.target.value)}
                      leftIcon={<Search size={20} />}
                      className="bg-slate-50 border border-slate-200"
                    />
                  </div>
                  <Button 
                    type="button"
                    variant="outline" 
                    onClick={handleSearchReturnInvoice}
                    className="bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 px-6 h-10 font-bold text-xs"
                  >
                    ค้นหา
                  </Button>
                </div>
              </div>

              {/* If receipt searched, show cards */}
              {isReceiptSearched ? (
                <div className="space-y-6">
                  
                  {/* Receipt Info Card */}
                  <Card 
                    title="ข้อมูลใบเสร็จ" 
                    subtitle="รายละเอียดสำหรับการรับคืนสินค้าที่สั่งซื้อไปแล้ว"
                    headerAction={
                      <div className="bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-md flex items-center gap-1.5 border border-emerald-100">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div> ดำเนินการคืนสินค้าได้
                      </div>
                    }
                  >
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-2">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">เลขที่ใบเสร็จ</p>
                        <p className="font-bold text-slate-800">{returnReceiptSearch}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">วันที่ซื้อ</p>
                        <p className="font-bold text-slate-800 text-xs">{receiptDateStr}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">ลูกค้า</p>
                        <p className="font-bold text-slate-800">{receiptCustomerName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">พนักงานขาย</p>
                        <p className="font-bold text-slate-800">{receiptSalesperson}</p>
                      </div>
                    </div>
                  </Card>

                  {/* Items Card */}
                  <Card noPadding>
                    <div className="bg-slate-50 p-4 flex justify-between items-center border-b border-slate-100">
                      <h3 className="font-bold text-slate-800 text-sm">เลือกสินค้าที่ต้องการคืน</h3>
                      <span className="text-sm text-slate-500 font-semibold">พบ {receiptItems.length} รายการในใบเสร็จนี้</span>
                    </div>

                    <div className="overflow-x-auto p-4">
                      <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-white text-slate-500 text-xs border-b border-slate-100">
                          <tr>
                            <th className="py-4 px-6 w-12 text-center"></th>
                            <th className="py-4 px-4 font-semibold">ชื่อสินค้า</th>
                            <th className="py-4 px-4 font-semibold text-center">จำนวนที่ซื้อ</th>
                            <th className="py-4 px-4 font-semibold text-right">ราคาต่อหน่วย</th>
                            <th className="py-4 px-6 font-semibold text-center">จำนวนที่คืน</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {receiptItems.map((item, idx) => (
                            <tr key={idx} className={`hover:bg-slate-50/50 transition-colors ${!item.checked ? 'opacity-50' : ''}`}>
                              <td className="py-5 px-6 text-center">
                                <input 
                                  type="checkbox" 
                                  checked={item.checked}
                                  onChange={(e) => {
                                    const updated = [...receiptItems];
                                    updated[idx] = { 
                                      ...item, 
                                      checked: e.target.checked,
                                      return_qty: e.target.checked ? (item.return_qty || 1) : 0
                                    };
                                    setReceiptItems(updated);
                                  }}
                                  className="w-4 h-4 text-[#b32025] bg-gray-100 border-gray-300 rounded focus:ring-[#b32025] accent-[#b32025] cursor-pointer" 
                                />
                              </td>
                              <td className="py-5 px-4">
                                <div className="font-semibold text-slate-800">{item.product_name}</div>
                              </td>
                              <td className="py-5 px-4 text-center font-bold text-slate-600">{item.sold_qty} ชิ้น</td>
                              <td className="py-5 px-4 text-right font-extrabold text-slate-900">฿{item.price.toLocaleString()}</td>
                              <td className="py-5 px-6">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...receiptItems];
                                      const newQty = Math.max(0, item.return_qty - 1);
                                      updated[idx] = { 
                                        ...item, 
                                        return_qty: newQty,
                                        checked: newQty > 0 ? item.checked : false
                                      };
                                      setReceiptItems(updated);
                                    }}
                                    className="p-1 hover:bg-slate-100 rounded text-slate-500 cursor-pointer animate-none"
                                  >
                                    <Minus size={14} />
                                  </button>
                                  <span className="w-8 text-center font-bold">{item.return_qty}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...receiptItems];
                                      const newQty = Math.min(item.sold_qty, item.return_qty + 1);
                                      updated[idx] = { 
                                        ...item, 
                                        return_qty: newQty,
                                        checked: true 
                                      };
                                      setReceiptItems(updated);
                                    }}
                                    className="p-1 hover:bg-slate-100 rounded text-slate-500 cursor-pointer animate-none"
                                  >
                                    <Plus size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Summary Footer */}
                    <div className="bg-slate-50 p-6 border-t border-slate-100 flex justify-between items-center rounded-b-lg">
                      <div>
                        <p className="text-xs text-slate-500 font-bold">จำนวนคืนรวม</p>
                        <p className="font-extrabold text-slate-800">
                          {receiptItems.filter(item => item.checked && item.return_qty > 0).length} รายการ ({receiptItems.reduce((acc, curr) => acc + (curr.checked ? curr.return_qty : 0), 0)} ชิ้น)
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500 font-bold">รวมยอดเงินรับคืนสุทธิ</p>
                        <p className="font-extrabold text-lg text-[#b32025]">
                          ฿{receiptItems.reduce((acc, curr) => acc + (curr.checked ? curr.return_qty * curr.price : 0), 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </Card>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-slate-100 shadow-sm min-h-[250px] text-slate-400">
                  <FileText size={48} className="mb-3 text-slate-300" />
                  <span className="font-semibold text-lg text-slate-600">กรุณาพิมพ์ค้นหารหัสใบเสร็จ</span>
                  <p className="text-xs text-slate-400 mt-1">ตัวอย่างเช่นพิมพ์ค้นหา "INV-2023-089" เพื่อจำลองข้อมูลใบเสร็จ</p>
                </div>
              )}

            </div>

            {/* Right section: Return details & reason */}
            <div className="space-y-6">
              
              <Card title="รายละเอียดเพิ่มเติม">
                <div className="space-y-4 py-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">สาเหตุการรับคืน</label>
                    <Select
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      options={[
                        { value: 'ORDER_ERROR', label: 'สั่งสินค้าผิดรุ่น/ผิดขนาด' },
                        { value: 'QUALITY_ISSUE', label: 'สินค้าไม่ได้มาตรฐาน/ชำรุด' },
                        { value: 'CUSTOMER_CHANGE_MIND', label: 'ลูกค้าเปลี่ยนใจ' },
                        { value: 'OTHER', label: 'อื่น ๆ (ระบุในหมายเหตุ)' },
                      ]}
                      className="bg-slate-50 border border-slate-200 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">หมายเหตุเพิ่มเติม</label>
                    <textarea 
                      value={returnRemarks}
                      onChange={(e) => setReturnRemarks(e.target.value)}
                      rows={4}
                      placeholder="ใส่รายละเอียดเกี่ยวกับสินค้าหรือสาเหตุที่ต้องการคืนเพิ่มเติม..."
                      className="w-full text-sm border border-slate-200 bg-slate-50 rounded-lg p-3 focus:outline-none focus:border-[#b32025] font-semibold text-slate-700 placeholder-slate-400"
                    />
                  </div>
                </div>
              </Card>

            </div>

          </div>
        </form>
      )}

    </div>
  );
}
