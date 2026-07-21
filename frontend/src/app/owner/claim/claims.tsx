import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, UploadCloud, Plus, Minus, Send, 
  CheckCircle, Clock, XCircle, ChevronLeft, 
  FileText
} from 'lucide-react';
import Heading from '../../../components/elements/heading';
import Card from '../../../components/elements/card';
import Input from '../../../components/elements/input';
import Select from '../../../components/elements/select';
import Button from '../../../components/elements/button';
import Table from '../../../components/elements/table';
import { posApiService } from '../../../service/http/pos/pos_service';

interface ClaimItem {
  id: number;
  claim_no: string;
  claim_date: string;
  customer_name: string;
  customer_phone: string;
  product_name: string;
  quantity: number;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

interface ClaimFormProduct {
  product_name: string;
  price: number;
  sold_qty: number;
  claim_qty: number;
}

const DEFAULT_CLAIMS: ClaimItem[] = [
  {
    id: 1,
    claim_no: 'CLM-2026-0001',
    claim_date: '2026-07-02T10:30:00Z',
    customer_name: 'คุณสมชาย สายช่าง',
    customer_phone: '081-234-5678',
    product_name: 'กรองอากาศ เบอร์ 24',
    quantity: 2,
    amount: 1000,
    status: 'PENDING',
  },
  {
    id: 2,
    claim_no: 'CLM-2026-0002',
    claim_date: '2026-07-04T14:15:00Z',
    customer_name: 'อู่สงวนอะไหล่ยนต์',
    customer_phone: '089-876-5432',
    product_name: 'โช้คอัพหลัง ยี่ห้อ TOKI',
    quantity: 1,
    amount: 2500,
    status: 'APPROVED',
  },
];

export default function ClaimsPage(): React.JSX.Element {
  const navigate = useNavigate();

  // View states: 'list' | 'claim-form'
  const [view, setView] = useState<'list' | 'claim-form'>('list');

  // Search and Filter states
  const [claimSearch, setClaimSearch] = useState('');
  const [claimFilter, setClaimFilter] = useState<string>('');

  // ----------------------------------------------------
  // Mock Database for Claims (linked to localStorage)
  // ----------------------------------------------------
  const [claims, setClaims] = useState<ClaimItem[]>(() => {
    const saved = localStorage.getItem('mock_claims');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    localStorage.setItem('mock_claims', JSON.stringify(DEFAULT_CLAIMS));
    return DEFAULT_CLAIMS;
  });

  // ----------------------------------------------------
  // Form states for CLAIM
  // ----------------------------------------------------
  const [claimFormInvoice, setClaimFormInvoice] = useState('');
  const [claimCustomerName, setClaimCustomerName] = useState('');
  const [claimCustomerSurname, setClaimCustomerSurname] = useState('');
  const [claimCustomerPhone, setClaimCustomerPhone] = useState('');
  const [claimBranch, setClaimBranch] = useState('MAIN');
  const [claimDate, setClaimDate] = useState(new Date().toISOString().split('T')[0]);
  const [claimNotes, setClaimNotes] = useState('');
  const [claimItems, setClaimItems] = useState<ClaimFormProduct[]>([]);

  // Filtered Claims
  const filteredClaims = claims.filter(item => {
    const name = item.customer_name.toLowerCase();
    const phone = item.customer_phone;
    const no = item.claim_no.toLowerCase();
    const q = claimSearch.toLowerCase();
    
    const matchesQuery = name.includes(q) || phone.includes(q) || no.includes(q);
    const matchesStatus = claimFilter === '' || item.status === claimFilter;
    
    return matchesQuery && matchesStatus;
  });

  // Handle claim search invoice mapping
  const handleSearchClaimInvoice = async () => {
    const query = claimFormInvoice.trim().toUpperCase();
    if (!query) {
      alert('กรุณากรอกหมายเลขใบสั่งซื้อ');
      return;
    }

    try {
      const order = await posApiService.getSaleOrderByNumber(query);
      if (order) {
        // ดึงชื่อลูกค้าและเบอร์โทรจากข้อมูลจริงใน db
        const cName = order.customer?.customer_name || order.customer_name_temp || 'ลูกค้าทั่วไป';
        const cPhone = order.customer?.phone_number || order.customer_phone_temp || '-';
        
        // แยกชื่อ-นามสกุลเบื้องต้นสำหรับฟอร์ม
        const parts = cName.split(' ');
        setClaimCustomerName(parts[0] || '');
        setClaimCustomerSurname(parts.slice(1).join(' ') || '');
        setClaimCustomerPhone(cPhone);

        // ดึงรายการสินค้าทั้งหมดที่ขายในบิลนั้น
        if (order.items && order.items.length > 0) {
          const items = order.items.map((item: any) => ({
            product_name: item.product_name || (item.product ? item.product.Name : 'อะไหล่ยนต์'),
            price: item.final_unit_price || item.unit_price,
            sold_qty: item.qty || 1,
            claim_qty: 0
          }));
          setClaimItems(items);
        } else {
          setClaimItems([]);
        }
        return;
      }
    } catch (err) {
      console.warn('API call failed or order not found, falling back to mock mapping.', err);
    }

    if (query === 'INV-2023-089') {
      setClaimCustomerName('สมชาย');
      setClaimCustomerSurname('สายช่าง');
      setClaimCustomerPhone('081-234-5678');
      setClaimItems([
        { product_name: 'กรองอากาศ เบอร์ 24', price: 500, sold_qty: 5, claim_qty: 2 },
        { product_name: 'แบตเตอรี่ขนาด 25w', price: 1200, sold_qty: 2, claim_qty: 0 }
      ]);
    } else if (query === 'INV-2023-090') {
      setClaimCustomerName('กิตติศักดิ์');
      setClaimCustomerSurname('พรหมดี');
      setClaimCustomerPhone('085-111-2222');
      setClaimItems([
        { product_name: 'เครื่องพิมพ์บาร์โค้ด PRO-X', price: 12500, sold_qty: 2, claim_qty: 1 },
        { product_name: 'ม้วนกระดาษความร้อน 80x80mm', price: 45, sold_qty: 50, claim_qty: 0 }
      ]);
    } else {
      // Fallback mock data for general testing
      setClaimCustomerName('อู่พงษ์ศักดิ์');
      setClaimCustomerSurname('เจริญยนต์');
      setClaimCustomerPhone('089-999-8888');
      setClaimItems([
        { product_name: 'โช้คอัพหลัง ยี่ห้อ TOKI', price: 2500, sold_qty: 4, claim_qty: 1 },
        { product_name: 'กรองอากาศ เบอร์ 24', price: 500, sold_qty: 10, claim_qty: 2 }
      ]);
    }
  };

  // Adjust Claim Quantity within sold boundary
  const handleClaimItemQtyChange = (index: number, change: number) => {
    setClaimItems(prev => {
      const updated = [...prev];
      const target = updated[index];
      const nextQty = Math.max(0, Math.min(target.sold_qty, target.claim_qty + change));
      updated[index] = { ...target, claim_qty: nextQty };
      return updated;
    });
  };

  // Handle saving new Claim
  const handleSaveClaim = (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimCustomerName || !claimCustomerPhone) {
      alert('กรุณาค้นหาใบเสร็จเพื่อโหลดข้อมูลลูกค้าก่อน');
      return;
    }
    const selectedProducts = claimItems.filter(i => i.claim_qty > 0);
    if (selectedProducts.length === 0) {
      alert('กรุณาเลือกจำนวนสินค้าที่ต้องการเคลมอย่างน้อย 1 ชิ้น');
      return;
    }

    const totalQty = selectedProducts.reduce((sum, i) => sum + i.claim_qty, 0);
    const totalAmount = selectedProducts.reduce((sum, i) => sum + (i.claim_qty * i.price), 0);

    const newClaim: ClaimItem = {
      id: claims.length + 1,
      claim_no: `CLM-2026-${String(claims.length + 1).padStart(4, '0')}`,
      claim_date: new Date().toISOString(),
      customer_name: `${claimCustomerName} ${claimCustomerSurname}`.trim(),
      customer_phone: claimCustomerPhone,
      product_name: selectedProducts[0].product_name + (selectedProducts.length > 1 ? ` และอื่นๆ (${selectedProducts.length} รายการ)` : ''),
      quantity: totalQty,
      amount: totalAmount,
      status: 'PENDING',
    };
    
    const updated = [newClaim, ...claims];
    setClaims(updated);
    localStorage.setItem('mock_claims', JSON.stringify(updated));

    setView('list');
    resetClaimForm();
  };

  // Reset Claim Form
  const resetClaimForm = () => {
    setClaimFormInvoice('');
    setClaimCustomerName('');
    setClaimCustomerSurname('');
    setClaimCustomerPhone('');
    setClaimBranch('MAIN');
    setClaimNotes('');
    setClaimItems([]);
  };

  // Table Columns config for claims
  const claimColumns = [
    {
      key: 'claim_no',
      header: 'เลขที่ใบเคลม',
      render: (row: ClaimItem) => (
        <span className="font-mono font-bold text-[#e51c23]">
          {row.claim_no}
        </span>
      )
    },
    {
      key: 'claim_date',
      header: 'วันที่เคลม',
      render: (row: ClaimItem) => (
        <span className="text-xs text-slate-500">
          {new Date(row.claim_date).toLocaleDateString('th-TH', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
          })}
        </span>
      )
    },
    {
      key: 'customer',
      header: 'ลูกค้า',
      render: (row: ClaimItem) => (
        <div>
          <div className="font-bold text-slate-800">{row.customer_name}</div>
          <div className="text-xs text-slate-400">{row.customer_phone}</div>
        </div>
      )
    },
    {
      key: 'product_name',
      header: 'สินค้าที่เคลม',
      render: (row: ClaimItem) => (
        <div className="font-semibold text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded inline-block max-w-[200px] truncate">
          {row.product_name}
        </div>
      )
    },
    {
      key: 'quantity',
      header: 'จำนวน',
      align: 'center' as const,
      render: (row: ClaimItem) => <span className="font-bold text-slate-800">{row.quantity} ชิ้น</span>
    },
    {
      key: 'amount',
      header: 'มูลค่าเคลม',
      align: 'right' as const,
      render: (row: ClaimItem) => <span className="font-bold text-slate-900">฿{row.amount.toLocaleString()}</span>
    },
    {
      key: 'status',
      header: 'สถานะ',
      align: 'center' as const,
      render: (row: ClaimItem) => (
        <span 
          title={row.status === 'APPROVED' ? 'อนุมัติแล้ว' : row.status === 'REJECTED' ? 'ปฏิเสธ' : 'รอดำเนินการ'}
          className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${
            row.status === 'APPROVED' 
              ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
              : row.status === 'REJECTED' 
                ? 'bg-red-50 text-red-600 border border-red-100' 
                : 'bg-amber-50 text-amber-600 border border-amber-100'
          }`}
        >
          {row.status === 'APPROVED' ? (
            <CheckCircle size={18} />
          ) : row.status === 'REJECTED' ? (
            <XCircle size={18} />
          ) : (
            <Clock size={18} />
          )}
        </span>
      )
    },
    {
      key: 'actions',
      header: 'จัดการ',
      align: 'center' as const,
      render: (row: ClaimItem) => (
        <div className="flex justify-center gap-2">
          <Button 
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/owner/claims/detail/${row.id}`);
            }} 
            className="px-2.5 py-1 text-xs font-bold border border-slate-300 hover:bg-slate-50 cursor-pointer h-8"
            title="ตรวจสอบใบเคลม"
          >
            {row.status === 'PENDING' ? 'ตรวจใบเคลม' : 'ดูรายละเอียด'}
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="p-8 w-full font-sans">
      
      {view === 'list' ? (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-5">
            <div>
              <Heading level="h1" className="mb-0 font-extrabold flex items-center gap-3">
                <FileText className="text-[#e51c23]" size={36} />
                ระบบจัดการเคลมสินค้า
              </Heading>
              <p className="text-sm text-slate-500 mt-1">
                บันทึก ประวัติการเปลี่ยนเคลมชิ้นส่วนอะไหล่จากซัพพลายเออร์และลูกค้า
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={() => setView('claim-form')}
                className="bg-[#e51c23] hover:bg-[#c9181f] text-white flex items-center gap-2 shadow-sm font-bold h-10 px-5 rounded-lg text-sm"
              >
                <Plus size={20} />
                สร้างใบเคลมสินค้า
              </Button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm items-stretch md:items-center">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="ค้นหาชื่อลูกค้า, เบอร์โทรศัพท์ หรือเลขที่ใบเคลม..."
                value={claimSearch}
                onChange={(e) => setClaimSearch(e.target.value)}
                leftIcon={<Search size={18} />}
                className="bg-slate-50 border border-slate-200"
              />
            </div>
            <div className="flex gap-2 shrink-0 items-center">
              {['', 'PENDING', 'APPROVED', 'REJECTED'].map((status) => (
                <Button
                  key={status}
                  type="button"
                  variant={claimFilter === status ? 'primary' : 'outline'}
                  onClick={() => setClaimFilter(status)}
                  className={`font-bold text-xs h-10 px-4 ${claimFilter === status ? 'border-2 border-transparent' : ''}`}
                >
                  {status === '' ? 'ทั้งหมด' : status === 'PENDING' ? 'รอดำเนินการ' : status === 'APPROVED' ? 'อนุมัติแล้ว' : 'ปฏิเสธ'}
                </Button>
              ))}
            </div>
          </div>

          {/* Claims List Table */}
          <Card noPadding>
            <Table 
              columns={claimColumns}
              data={filteredClaims}
              rowKey={(row) => row.id}
              emptyText="ไม่พบข้อมูลรายการเคลมสินค้า"
            />
          </Card>
        </div>
      ) : (
        
        // VIEW: CLAIM DETAILS FORM (Grid 2/3 and 1/3)
        <form onSubmit={handleSaveClaim} className="w-full space-y-6 animate-in fade-in duration-300">
          
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
                  รายละเอียดการเคลมสินค้า
                </Heading>
              </div>
            </div>
            
            <Button 
              type="submit"
              variant="primary" 
              className="bg-[#e51c23] hover:bg-[#c9181f] gap-2 shadow-sm font-bold"
            >
              <Send size={18} /> ส่งใบเคลมสินค้า
            </Button>
          </div>

          {/* Search bar */}
          <div className="w-full bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-2">
            <p className="text-sm text-slate-600 font-bold">ค้นหาใบสั่งซื้อด้วยหมายเลขใบสั่งซื้อหรือชื่อลูกค้า</p>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input 
                  type="text" 
                  placeholder="ลองพิมพ์ค้นหา 'INV-2023-089' หรือ 'INV-2023-090' แล้วกดค้นหา..." 
                  value={claimFormInvoice}
                  onChange={(e) => setClaimFormInvoice(e.target.value)}
                  leftIcon={<Search size={20} />}
                  className="bg-slate-50 border border-slate-200"
                />
              </div>
              <Button 
                type="button"
                variant="outline" 
                onClick={handleSearchClaimInvoice}
                className="bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 px-6 h-10 font-bold text-xs"
              >
                ค้นหา
              </Button>
            </div>
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Left Column (2/3 width) */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Card: Customer Info */}
              <Card title="ข้อมูลลูกค้า">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input 
                    label="ชื่อ" 
                    type="text" 
                    placeholder="ระบุชื่อ (จะถูกดึงมาเมื่อค้นหาใบสั่งซื้อสำเร็จ)" 
                    value={claimCustomerName}
                    onChange={(e) => setClaimCustomerName(e.target.value)}
                    disabled
                    className="bg-slate-100 border border-slate-200 cursor-not-allowed"
                  />
                  <Input 
                    label="นามสกุล" 
                    type="text" 
                    placeholder="ระบุนามสกุล (จะถูกดึงมาเมื่อค้นหาใบสั่งซื้อสำเร็จ)" 
                    value={claimCustomerSurname}
                    onChange={(e) => setClaimCustomerSurname(e.target.value)}
                    disabled
                    className="bg-slate-100 border border-slate-200 cursor-not-allowed"
                  />
                  <Input 
                    label="เบอร์โทรศัพท์" 
                    type="text" 
                    placeholder="ระบุเบอร์โทรศัพท์" 
                    value={claimCustomerPhone}
                    onChange={(e) => setClaimCustomerPhone(e.target.value)}
                    disabled
                    className="bg-slate-100 border border-slate-200 cursor-not-allowed"
                  />
                </div>
              </Card>

              {/* Card: Select Products */}
              <Card noPadding>
                <div className="bg-slate-50 p-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-800 text-sm">เลือกรายการสินค้าเพื่อเคลม</h3>
                </div>

                <div className="overflow-x-auto p-4">
                  {claimItems.length > 0 ? (
                    <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-white text-slate-500 text-xs border-b border-slate-100">
                        <tr>
                          <th className="py-3 px-4 font-semibold">ชื่อสินค้า</th>
                          <th className="py-3 px-4 font-semibold text-center">ซื้อมา (จำนวน)</th>
                          <th className="py-3 px-4 font-semibold text-right">ราคา</th>
                          <th className="py-3 px-6 font-semibold text-center">จำนวนเคลม</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {claimItems.map((item, idx) => (
                          <tr key={idx} className={`hover:bg-slate-50/50 transition-colors ${item.claim_qty === 0 ? 'opacity-70' : ''}`}>
                            <td className="py-4 px-4">
                              <p className="font-bold text-slate-800 text-sm">{item.product_name}</p>
                            </td>
                            <td className="py-4 px-4 text-center font-semibold text-slate-500">{item.sold_qty}</td>
                            <td className="py-4 px-4 text-right font-bold text-[#900] dark:text-[#f00]">฿{item.price.toLocaleString()}</td>
                            <td className="py-4 px-6">
                              <div className="flex items-center justify-center gap-1.5">
                                <button 
                                  type="button"
                                  onClick={() => handleClaimItemQtyChange(idx, -1)}
                                  className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-500 rounded hover:bg-slate-200 cursor-pointer disabled:opacity-50"
                                >
                                  <Minus size={14}/>
                                </button>
                                <input 
                                  type="text" 
                                  value={item.claim_qty} 
                                  readOnly 
                                  className={`w-12 text-center border font-bold rounded py-1 focus:outline-none ${
                                    item.claim_qty > 0 ? 'border-[#e51c23] text-[#e51c23]' : 'border-slate-200 text-slate-500 bg-slate-50'
                                  }`} 
                                />
                                <button 
                                  type="button"
                                  onClick={() => handleClaimItemQtyChange(idx, 1)}
                                  className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-500 rounded hover:bg-slate-200 cursor-pointer disabled:opacity-50"
                                >
                                  <Plus size={14}/>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      กรุณาค้นหาใบสั่งซื้อเพื่อแสดงรายการสินค้า
                    </div>
                  )}
                </div>
              </Card>

            </div>

            {/* Right Column (1/3 width) */}
            <div className="space-y-6">
              
              {/* Card: Document Details */}
              <Card title="รายละเอียดเอกสาร">
                <div className="space-y-4 py-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">สาขา</label>
                    <Select
                      value={claimBranch}
                      onChange={(e) => setClaimBranch(e.target.value)}
                      options={[
                        { value: 'MAIN', label: 'สาขาใหญ่ (กรุงเทพฯ)' },
                        { value: 'BRANCH_1', label: 'สาขาพัทยา' },
                        { value: 'BRANCH_2', label: 'สาขาเชียงใหม่' },
                      ]}
                      className="bg-slate-50 border border-slate-200 font-semibold"
                    />
                  </div>

                  <Input 
                    label="วันที่ออกเอกสาร" 
                    type="date" 
                    value={claimDate}
                    onChange={(e) => setClaimDate(e.target.value)}
                    className="bg-slate-50 border border-slate-200 font-semibold"
                  />

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">หมายเหตุเพิ่มเติม</label>
                    <textarea 
                      value={claimNotes}
                      onChange={(e) => setClaimNotes(e.target.value)}
                      rows={4}
                      placeholder="ใส่หมายเหตุเกี่ยวกับสภาพสินค้าหรือรายละเอียดความเสียหาย..."
                      className="w-full text-sm border border-slate-200 bg-slate-50 rounded-lg p-3 focus:outline-none focus:border-[#e51c23] font-semibold text-slate-700 placeholder-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">อัปโหลดรูปภาพหลักฐาน</label>
                    <div 
                      className="border-2 border-dashed border-slate-200 rounded-lg p-6 bg-slate-50 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => alert('จำลองการเลือกไฟล์อัปโหลดรูปภาพหลักฐานเรียบร้อย')}
                    >
                      <UploadCloud className="text-slate-400 mb-2" size={32} />
                      <p className="text-xs text-slate-600 font-bold">ลากไฟล์มาวาง หรือ คลิกเพื่อเลือกไฟล์</p>
                      <p className="text-[10px] text-slate-400 mt-1">รองรับ JPG, PNG สูงสุด 5MB</p>
                    </div>
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
