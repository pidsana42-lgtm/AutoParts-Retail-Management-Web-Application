import React, { useState } from 'react';
import { 
  Search, UploadCloud, Plus, Minus, Send, Upload, 
  RefreshCw, CheckCircle, Clock, XCircle, ChevronLeft, 
  FileText, Package, User, FileSpreadsheet, Building2
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContexts';
import Heading from '../../../components/elements/heading';
import Card from '../../../components/elements/card';
import Input from '../../../components/elements/input';
import Select from '../../../components/elements/select';
import Button from '../../../components/elements/button';
import Table from '../../../components/elements/table';

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

interface ReturnItem {
  id: number;
  return_no: string;
  return_date: string;
  customer_name: string;
  customer_phone: string;
  quantity: number;
  amount: number;
  status: 'COMPLETED' | 'CANCELLED';
}

interface ClaimFormProduct {
  product_name: string;
  price: number;
  sold_qty: number;
  claim_qty: number;
}

export default function ClaimsPage(): React.JSX.Element {
  // Authentication Role checks
  const { role } = useAuth() as any;
  const isManager = role === 'OWNER' || role === 'ADMIN';

  // Tab states: 'claim' | 'return'
  const [activeTab, setActiveTab] = useState<'claim' | 'return'>('claim');
  
  // View states: 'list' | 'claim-form' | 'return-form'
  const [view, setView] = useState<'list' | 'claim-form' | 'return-form'>('list');

  // Search and Filter states
  const [claimSearch, setClaimSearch] = useState('');
  const [claimFilter, setClaimFilter] = useState<string>('');
  const [returnSearch, setReturnSearch] = useState('');
  const [returnFilter, setReturnFilter] = useState<string>('');

  // Modals state for Approval Flow
  const [selectedClaim, setSelectedClaim] = useState<ClaimItem | null>(null);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);

  // ----------------------------------------------------
  // Mock Database for Claims
  // ----------------------------------------------------
  const [claims, setClaims] = useState<ClaimItem[]>([
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
  ]);

  // ----------------------------------------------------
  // Mock Database for Returns
  // ----------------------------------------------------
  const [returns, setReturns] = useState<ReturnItem[]>([
    {
      id: 1,
      return_no: 'RTN-2026-0001',
      return_date: '2026-07-01T09:00:00Z',
      customer_name: 'บริษัท สมหวังไอที จำกัด',
      customer_phone: '02-345-6789',
      quantity: 1,
      amount: 12500,
      status: 'COMPLETED',
    },
    {
      id: 2,
      return_no: 'RTN-2026-0002',
      return_date: '2026-07-05T16:45:00Z',
      customer_name: 'คุณกิตติศักดิ์ พรหมดี',
      customer_phone: '085-111-2222',
      quantity: 10,
      amount: 450,
      status: 'CANCELLED',
    },
  ]);

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

  // ----------------------------------------------------
  // Form states for RETURN
  // ----------------------------------------------------
  const [returnReceiptSearch, setReturnReceiptSearch] = useState('');
  const [isReceiptSearched, setIsReceiptSearched] = useState(false);
  const [returnItem1Checked, setReturnItem1Checked] = useState(true);
  const [returnItem2Checked, setReturnItem2Checked] = useState(false);
  const [returnQty1, setReturnQty1] = useState(1);
  const [returnQty2, setReturnQty2] = useState(0);

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

  // Filtered Returns
  const filteredReturns = returns.filter(item => {
    const name = item.customer_name.toLowerCase();
    const phone = item.customer_phone;
    const no = item.return_no.toLowerCase();
    const q = returnSearch.toLowerCase();
    
    const matchesQuery = name.includes(q) || phone.includes(q) || no.includes(q);
    const matchesStatus = returnFilter === '' || item.status === returnFilter;
    
    return matchesQuery && matchesStatus;
  });

  // Handle claim search invoice mapping
  const handleSearchClaimInvoice = () => {
    const query = claimFormInvoice.trim().toUpperCase();
    if (!query) {
      alert('กรุณากรอกหมายเลขใบสั่งซื้อ');
      return;
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

  // Handle claim status approval or rejection
  const handleClaimStatusUpdate = (id: number, newStatus: 'APPROVED' | 'REJECTED') => {
    setClaims(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
    setIsApprovalModalOpen(false);
    setSelectedClaim(null);
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
    setClaims([newClaim, ...claims]);
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

  // Handle saving new Return
  const handleSaveReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isReceiptSearched) {
      alert('กรุณาค้นหาและเลือกสินค้าที่ต้องการคืน');
      return;
    }
    const newReturn: ReturnItem = {
      id: returns.length + 1,
      return_no: `RTN-2026-${String(returns.length + 1).padStart(4, '0')}`,
      return_date: new Date().toISOString(),
      customer_name: 'บริษัท สมหวังไอที จำกัด',
      customer_phone: '02-345-6789',
      quantity: (returnItem1Checked ? returnQty1 : 0) + (returnItem2Checked ? returnQty2 : 0),
      amount: (returnItem1Checked ? returnQty1 * 12500 : 0) + (returnItem2Checked ? returnQty2 * 45 : 0),
      status: 'COMPLETED',
    };
    setReturns([newReturn, ...returns]);
    setView('list');
    resetReturnForm();
  };

  // Reset Return Form
  const resetReturnForm = () => {
    setReturnReceiptSearch('');
    setIsReceiptSearched(false);
    setReturnItem1Checked(true);
    setReturnItem2Checked(false);
    setReturnQty1(1);
    setReturnQty2(0);
  };

  // Table Columns config for claims
  const claimColumns = [
    {
      key: 'claim_no',
      header: 'เลขที่ใบเคลม',
      render: (row: ClaimItem) => (
        <span className="font-mono font-bold text-[#b32025]">
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
      render: (row: ClaimItem) => (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold ${
          row.status === 'APPROVED' 
            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
            : row.status === 'REJECTED' 
              ? 'bg-red-50 text-red-600 border border-red-100' 
              : 'bg-amber-50 text-amber-600 border border-amber-100'
        }`}>
          {row.status === 'APPROVED' ? (
            <CheckCircle size={14} />
          ) : row.status === 'REJECTED' ? (
            <XCircle size={14} />
          ) : (
            <Clock size={14} />
          )}
          {row.status === 'APPROVED' ? 'อนุมัติแล้ว' : row.status === 'REJECTED' ? 'ปฏิเสธ' : 'รอดำเนินการ'}
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
              setSelectedClaim(row);
              setIsApprovalModalOpen(true);
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
        <span className="text-xs text-slate-500">
          {new Date(row.return_date).toLocaleDateString('th-TH', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
          })}
        </span>
      )
    },
    {
      key: 'customer',
      header: 'ลูกค้า',
      render: (row: ReturnItem) => (
        <div>
          <div className="font-bold text-slate-800">{row.customer_name}</div>
          <div className="text-xs text-slate-400">{row.customer_phone}</div>
        </div>
      )
    },
    {
      key: 'quantity',
      header: 'จำนวนที่คืน',
      align: 'center' as const,
      render: (row: ReturnItem) => <span className="font-bold text-slate-800">{row.quantity} ชิ้น</span>
    },
    {
      key: 'amount',
      header: 'มูลค่าคืนสินค้า',
      align: 'right' as const,
      render: (row: ReturnItem) => <span className="font-bold text-slate-900">฿{row.amount.toLocaleString()}</span>
    },
    {
      key: 'status',
      header: 'สถานะ',
      render: (row: ReturnItem) => (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold ${
          row.status === 'COMPLETED' 
            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
            : 'bg-red-50 text-red-600 border border-red-100'
        }`}>
          {row.status === 'COMPLETED' ? (
            <CheckCircle size={14} />
          ) : (
            <XCircle size={14} />
          )}
          {row.status === 'COMPLETED' ? 'คืนเงินสำเร็จ' : 'ยกเลิก'}
        </span>
      )
    }
  ];

  return (
    <div className="p-8 w-full font-sans">
      
      {view === 'list' ? (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* 1. Header with Title & Action Button */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-5">
            <div>
              <Heading level="h1" className="mb-0 font-extrabold flex items-center gap-3">
                <RefreshCw className="text-[#b32025]" size={36} />
                ระบบจัดการรับคืนและเคลมสินค้า
              </Heading>
              <p className="text-sm text-slate-500 mt-1">
                บันทึก ประวัติการคืนเงินสินค้า หรือเปลี่ยนเคลมชิ้นส่วนอะไหล่จากซัพพลายเออร์และลูกค้า
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={() => setView('claim-form')}
                variant="primary"
                size="md"
                className="gap-2 font-bold shadow-sm"
              >
                <Plus size={20} />
                สร้างใบเคลมสินค้า
              </Button>
              
              <Button 
                onClick={() => setView('return-form')}
                variant="outline"
                size="md"
                className="gap-2 bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 font-bold shadow-sm"
              >
                <Upload size={20} />
                สร้างใบรับคืนสินค้า
              </Button>
            </div>
          </div>

          {/* 2. Custom Modern Tabs Section */}
          <div className="border-b border-slate-200">
            <nav className="flex gap-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('claim')}
                className={`py-4 px-1 border-b-2 font-bold text-sm transition-all cursor-pointer ${
                  activeTab === 'claim'
                    ? 'border-[#b32025] text-[#b32025]'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                รายการเคลมสินค้า ({claims.length})
              </button>
              <button
                onClick={() => setActiveTab('return')}
                className={`py-4 px-1 border-b-2 font-bold text-sm transition-all cursor-pointer ${
                  activeTab === 'return'
                    ? 'border-[#b32025] text-[#b32025]'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                รายการคืนสินค้า ({returns.length})
              </button>
            </nav>
          </div>

          {/* 3. Tab Contents: Claim */}
          {activeTab === 'claim' && (
            <div className="space-y-6">
              
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
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden p-1">
                <Table 
                  columns={claimColumns}
                  data={filteredClaims}
                  rowKey={(row) => row.id}
                  emptyText="ไม่พบข้อมูลรายการเคลมสินค้า"
                />
              </div>
            </div>
          )}

          {/* Tab Contents: Return */}
          {activeTab === 'return' && (
            <div className="space-y-6">
              
              {/* Search & Filters */}
              <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm items-stretch md:items-center">
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="ค้นหาชื่อลูกค้า, เบอร์โทรศัพท์ หรือเลขที่ใบเสร็จรับเงิน..."
                    value={returnSearch}
                    onChange={(e) => setReturnSearch(e.target.value)}
                    leftIcon={<Search size={18} />}
                    className="bg-slate-50 border border-slate-200"
                  />
                </div>
                <div className="flex gap-2 shrink-0 items-center">
                  {['', 'COMPLETED', 'CANCELLED'].map((status) => (
                    <Button
                      key={status}
                      type="button"
                      variant={returnFilter === status ? 'primary' : 'outline'}
                      onClick={() => setReturnFilter(status)}
                      className={`font-bold text-xs h-10 px-4 ${returnFilter === status ? 'border-2 border-transparent' : ''}`}
                    >
                      {status === '' ? 'ทั้งหมด' : status === 'COMPLETED' ? 'คืนเงินสำเร็จ' : 'ยกเลิก'}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Returns List Table */}
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden p-1">
                <Table 
                  columns={returnColumns}
                  data={filteredReturns}
                  rowKey={(row) => row.id}
                  emptyText="ไม่พบข้อมูลรายการคืนสินค้า"
                />
              </div>
            </div>
          )}

        </div>
      ) : view === 'claim-form' ? (
        
        // ----------------------------------------------------
        // VIEW: CLAIM DETAILS FORM (Grid 2/3 and 1/3)
        // ----------------------------------------------------
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
              className="bg-[#b32025] hover:bg-[#9a1a1f] gap-2 shadow-sm font-bold"
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
              <Card title={<span className="flex items-center gap-2 text-[#b32025] font-extrabold"><User size={18}/> ข้อมูลลูกค้า</span>}>
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
                  <div className="md:col-span-2">
                    <Input 
                      label="เบอร์โทรศัพท์" 
                      type="text" 
                      placeholder="08X-XXX-XXXX" 
                      value={claimCustomerPhone}
                      onChange={(e) => setClaimCustomerPhone(e.target.value)}
                      disabled
                      className="bg-slate-100 border border-slate-200 cursor-not-allowed"
                    />
                  </div>
                </div>
              </Card>

              {/* Card: Items list */}
              <Card title={<span className="flex items-center gap-2 text-[#b32025] font-extrabold"><Package size={18}/> เลือกรายการสินค้าที่ต้องการเคลม</span>} noPadding>
                {claimItems.length === 0 ? (
                  <div className="p-10 text-center text-slate-400 text-sm font-semibold flex flex-col items-center justify-center gap-2">
                    <Search size={32} className="text-slate-300" />
                    <span>กรุณาพิมพ์รหัสใบสั่งซื้อด้านบนแล้วคลิกค้นหา เพื่อดึงข้อมูลสินค้าที่ซื้ออัตโนมัติ</span>
                    <span className="text-[10px] text-slate-400 font-bold">(เช่น พิมพ์ INV-2023-089 หรือ INV-2023-090)</span>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto p-4 animate-in fade-in duration-200">
                      <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-slate-50 text-slate-500 text-xs border-b border-slate-100">
                          <tr>
                            <th className="py-3 px-4">ลำดับ</th>
                            <th className="py-3 px-4">ชื่อสินค้า</th>
                            <th className="py-3 px-4 text-center">จำนวนที่ขาย</th>
                            <th className="py-3 px-4 text-right">บาท/หน่วย</th>
                            <th className="py-3 px-4 text-center">จำนวนที่ต้องการเคลม</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {claimItems.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="py-4 px-4 font-bold">{idx + 1}</td>
                              <td className="py-4 px-4 font-semibold text-slate-800">{item.product_name}</td>
                              <td className="py-4 px-4 text-center text-slate-500 font-bold">{item.sold_qty}</td>
                              <td className="py-4 px-4 text-right font-bold text-slate-900">฿{item.price.toLocaleString()}</td>
                              <td className="py-4 px-4">
                                <div className="flex items-center justify-center gap-1">
                                  <button 
                                    type="button"
                                    onClick={() => handleClaimItemQtyChange(idx, -1)} 
                                    className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-500 hover:bg-slate-200 cursor-pointer rounded"
                                  >
                                    <Minus size={14}/>
                                  </button>
                                  <input 
                                    type="text" 
                                    value={item.claim_qty} 
                                    readOnly 
                                    className={`w-12 text-center border font-extrabold py-1 focus:outline-none rounded ${
                                      item.claim_qty > 0 ? 'border-[#b32025] text-[#b32025] bg-red-50/20' : 'border-slate-200 text-slate-400 bg-slate-50'
                                    }`} 
                                  />
                                  <button 
                                    type="button"
                                    onClick={() => handleClaimItemQtyChange(idx, 1)} 
                                    className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-500 hover:bg-slate-200 cursor-pointer rounded"
                                  >
                                    <Plus size={14}/>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Summary footer block */}
                    <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-between items-center rounded-b-lg font-semibold text-sm">
                      <div>
                        <p className="text-xs text-slate-500 font-bold">จำนวนรายการที่เลือกเคลม</p>
                        <p className="font-extrabold text-slate-800">
                          {claimItems.filter(i => i.claim_qty > 0).length} รายการ ({claimItems.reduce((acc, i) => acc + i.claim_qty, 0)} หน่วย)
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500 font-bold">มูลค่าสินค้ารวม</p>
                        <p className="font-extrabold text-[#b32025] text-lg">
                          ฿{claimItems.reduce((acc, i) => acc + (i.claim_qty * i.price), 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </Card>

            </div>

            {/* Right Column (1/3 width) */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* Card: Reference Branch Info */}
              <Card title={<span className="flex items-center gap-2 text-[#b32025] font-extrabold"><Building2 size={18}/> ข้อมูลอ้างอิง</span>}>
                <div className="space-y-4">
                  <Select 
                    label="สาขา / คลังสินค้า" 
                    value={claimBranch}
                    onChange={(e) => setClaimBranch(e.target.value)}
                    options={[
                      { label: 'คลังสินค้าใหญ่ (สำนักงานหลัก)', value: 'MAIN' },
                      { label: 'สาขา 2 (รังสิต)', value: 'BRANCH_2' },
                      { label: 'สาขา 3 (บางนา)', value: 'BRANCH_3' }
                    ]} 
                  />
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">วันที่รับเคลม</label>
                    <input 
                      type="date" 
                      value={claimDate}
                      onChange={(e) => setClaimDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-[#b32025] font-semibold" 
                    />
                  </div>
                </div>
              </Card>

              {/* Card: Notes & Evidence Upload */}
              <Card title={<span className="flex items-center gap-2 text-[#b32025] font-extrabold"><FileSpreadsheet size={18}/> หมายเหตุ / รูปภาพหลักฐาน</span>}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">หมายเหตุเพิ่มเติม</label>
                    <textarea 
                      rows={3} 
                      placeholder="ระบุรายละเอียดสาเหตุชำรุด..." 
                      value={claimNotes}
                      onChange={(e) => setClaimNotes(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded p-3 text-sm text-slate-800 focus:outline-none focus:border-[#b32025] resize-none font-semibold"
                    ></textarea>
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
      ) : (
        
        // ----------------------------------------------------
        // VIEW: RETURN DETAILS FORM (1 Column Layout)
        // ----------------------------------------------------
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
                onClick={() => {
                  setIsReceiptSearched(true);
                  setReturnQty1(1);
                  setReturnQty2(0);
                }}
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
                    <p className="font-bold text-slate-800">INV-2023-089</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">วันที่ซื้อ</p>
                    <p className="font-bold text-slate-800 text-xs">15 ตุลาคม 2025 14:30</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">ลูกค้า</p>
                    <p className="font-bold text-slate-800">บริษัท สมหวังไอที จำกัด</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">พนักงานขาย</p>
                    <p className="font-bold text-slate-800">น.ส. สมหญิง รักษ์บริการ</p>
                  </div>
                </div>
              </Card>

              {/* Items Card */}
              <Card noPadding>
                <div className="bg-slate-50 p-4 flex justify-between items-center border-b border-slate-100">
                  <h3 className="font-bold text-slate-800 text-sm">เลือกสินค้าที่ต้องการคืน</h3>
                  <span className="text-sm text-slate-500 font-semibold">พบ 2 รายการในใบเสร็จนี้</span>
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
                      
                      {/* Row 1 */}
                      <tr className={`hover:bg-slate-50/50 transition-colors ${!returnItem1Checked ? 'opacity-50' : ''}`}>
                        <td className="py-5 px-6 text-center">
                          <input 
                            type="checkbox" 
                            checked={returnItem1Checked}
                            onChange={(e) => setReturnItem1Checked(e.target.checked)}
                            className="w-4 h-4 text-[#b32025] bg-gray-100 border-gray-300 rounded focus:ring-[#b32025] accent-[#b32025] cursor-pointer" 
                          />
                        </td>
                        <td className="py-5 px-4">
                          <p className="font-bold text-slate-800 text-sm">เครื่องพิมพ์บาร์โค้ด PRO-X</p>
                          <p className="text-xs text-slate-400 mt-0.5">SKU: PRT-PX-001</p>
                        </td>
                        <td className="py-5 px-4 text-center font-semibold text-slate-500">2</td>
                        <td className="py-5 px-4 text-right font-bold text-slate-900">฿12,500.00</td>
                        <td className="py-5 px-6">
                          <div className="flex items-center justify-center gap-1.5">
                            <button 
                              type="button"
                              onClick={() => setReturnQty1(Math.max(0, returnQty1 - 1))}
                              disabled={!returnItem1Checked}
                              className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-500 rounded hover:bg-slate-200 cursor-pointer disabled:opacity-50"
                            >
                              <Minus size={14}/>
                            </button>
                            <input 
                              type="text" 
                              value={returnQty1} 
                              readOnly 
                              className={`w-12 text-center border font-bold rounded py-1 focus:outline-none ${
                                returnItem1Checked ? 'border-[#b32025] text-[#b32025]' : 'border-slate-200 text-slate-500 bg-slate-50'
                              }`} 
                            />
                            <button 
                              type="button"
                              onClick={() => setReturnQty1(returnQty1 + 1)}
                              disabled={!returnItem1Checked}
                              className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-500 rounded hover:bg-slate-200 cursor-pointer disabled:opacity-50"
                            >
                              <Plus size={14}/>
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Row 2 */}
                      <tr className={`hover:bg-slate-50/50 transition-colors ${!returnItem2Checked ? 'opacity-50' : ''}`}>
                        <td className="py-5 px-6 text-center">
                          <input 
                            type="checkbox" 
                            checked={returnItem2Checked}
                            onChange={(e) => setReturnItem2Checked(e.target.checked)}
                            className="w-4 h-4 text-[#b32025] bg-gray-100 border-gray-300 rounded focus:ring-[#b32025] accent-[#b32025] cursor-pointer" 
                          />
                        </td>
                        <td className="py-5 px-4">
                          <p className="font-bold text-slate-800 text-sm">ม้วนกระดาษความร้อน 80x80mm</p>
                          <p className="text-xs text-slate-400 mt-0.5">SKU: ROL-TH-8080</p>
                        </td>
                        <td className="py-5 px-4 text-center font-semibold text-slate-500">50</td>
                        <td className="py-5 px-4 text-right font-bold text-slate-900">฿45.00</td>
                        <td className="py-5 px-6">
                          <div className="flex items-center justify-center gap-1.5">
                            <button 
                              type="button"
                              onClick={() => setReturnQty2(Math.max(0, returnQty2 - 1))}
                              disabled={!returnItem2Checked}
                              className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-500 rounded hover:bg-slate-200 cursor-pointer disabled:opacity-50"
                            >
                              <Minus size={14}/>
                            </button>
                            <input 
                              type="text" 
                              value={returnQty2} 
                              readOnly 
                              className={`w-12 text-center border font-bold rounded py-1 focus:outline-none ${
                                returnItem2Checked ? 'border-[#b32025] text-[#b32025]' : 'border-slate-200 text-slate-500 bg-slate-50'
                              }`} 
                            />
                            <button 
                              type="button"
                              onClick={() => setReturnQty2(returnQty2 + 1)}
                              disabled={!returnItem2Checked}
                              className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-500 hover:bg-slate-200 cursor-pointer disabled:opacity-50"
                            >
                              <Plus size={14}/>
                            </button>
                          </div>
                        </td>
                      </tr>

                    </tbody>
                  </table>
                </div>

                {/* Summary Footer */}
                <div className="bg-slate-50 p-6 border-t border-slate-100 flex justify-between items-center rounded-b-lg">
                  <div>
                    <p className="text-xs text-slate-500 font-bold">จำนวนคืนรวม</p>
                    <p className="font-extrabold text-slate-800">
                      {((returnItem1Checked ? 1 : 0) + (returnItem2Checked ? 1 : 0))} รายการ ({ (returnItem1Checked ? returnQty1 : 0) + (returnItem2Checked ? returnQty2 : 0) } ชิ้น)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 font-bold">รวมยอดเงินรับคืนสุทธิ</p>
                    <p className="font-extrabold text-lg text-[#b32025]">
                      ฿{((returnItem1Checked ? returnQty1 * 12500 : 0) + (returnItem2Checked ? returnQty2 * 45 : 0)).toLocaleString()}
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

        </form>
      )}

      {/* 4. Approval & Details Modal */}
      {isApprovalModalOpen && selectedClaim && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-100 max-w-2xl w-full overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <div>
                <Heading level="h3" className="mb-0 font-extrabold text-slate-800 flex items-center gap-2">
                  <span className="text-[#b32025]">📋</span> ตรวจสอบรายละเอียดใบเคลมสินค้า
                </Heading>
                <p className="text-xs text-slate-400 font-bold mt-1">เลขที่ใบเคลม: {selectedClaim.claim_no}</p>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setIsApprovalModalOpen(false);
                  setSelectedClaim(null);
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors text-xl font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              
              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg">
                <div>
                  <p className="text-xs text-slate-400 font-bold mb-1">ชื่อลูกค้า</p>
                  <p className="font-bold text-slate-800 text-sm">{selectedClaim.customer_name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold mb-1">เบอร์โทรศัพท์</p>
                  <p className="font-bold text-slate-800 text-sm">{selectedClaim.customer_phone}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold mb-1">วันที่ยื่นขอเคลม</p>
                  <p className="font-semibold text-slate-600 text-xs">
                    {new Date(selectedClaim.claim_date).toLocaleDateString('th-TH', {
                      year: 'numeric', month: 'long', day: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold mb-1">สถานะปัจจุบัน</p>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold ${
                    selectedClaim.status === 'APPROVED' 
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                      : selectedClaim.status === 'REJECTED'
                        ? 'bg-red-50 text-red-600 border border-red-100'
                        : 'bg-amber-50 text-amber-600 border border-amber-100'
                  }`}>
                    {selectedClaim.status === 'APPROVED' ? 'อนุมัติแล้ว' : selectedClaim.status === 'REJECTED' ? 'ปฏิเสธ' : 'รอดำเนินการ'}
                  </span>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-100 rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 text-xs border-b border-slate-100">
                    <tr>
                      <th className="py-2.5 px-4 font-bold">ชื่อสินค้า</th>
                      <th className="py-2.5 px-4 text-center font-bold">จำนวนเคลม</th>
                      <th className="py-2.5 px-4 text-right font-bold">มูลค่าสินค้ารวม</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-700 font-semibold">
                    <tr>
                      <td className="py-3 px-4 text-slate-800">{selectedClaim.product_name}</td>
                      <td className="py-3 px-4 text-center text-slate-600">{selectedClaim.quantity} หน่วย</td>
                      <td className="py-3 px-4 text-right text-slate-900">฿{selectedClaim.amount.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Damaged Notes & Evidence */}
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-400 font-bold mb-1">หมายเหตุสาเหตุชำรุด</p>
                  <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded border border-slate-100 font-semibold italic">
                    "{selectedClaim.id === 1 ? 'ซีลยางกรองอากาศฉีกขาดหลังจากติดตั้งใช้งานได้ 1 วัน' : selectedClaim.id === 2 ? 'แกนโช้คอัพคดงอและมีคราบน้ำมันซึมออกมาด้านข้าง' : 'กรองอากาศบิดเบี้ยวผิดรูป'}"
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold mb-2">รูปภาพหลักฐานที่อัปโหลด</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="h-24 bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-slate-400 text-xs font-semibold relative overflow-hidden group">
                      <span className="text-[10px] text-slate-500">📷 รูปถ่ายรอยฉีกขาด.jpg</span>
                    </div>
                    <div className="h-24 bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-slate-400 text-xs font-semibold relative overflow-hidden group">
                      <span className="text-[10px] text-slate-500">📷 รูปซีลยางอะไหล่.png</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-between items-center">
              <Button 
                type="button"
                variant="outline" 
                onClick={() => {
                  setIsApprovalModalOpen(false);
                  setSelectedClaim(null);
                }}
                className="bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 font-bold"
              >
                ปิดหน้าต่าง
              </Button>

              {/* Approval controls - visible to Owner / Admin only, and only when status is PENDING */}
              {selectedClaim.status === 'PENDING' && (
                <div className="flex gap-2">
                  {isManager ? (
                    <>
                      <Button
                        type="button"
                        onClick={() => handleClaimStatusUpdate(selectedClaim.id, 'APPROVED')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 text-sm shadow-sm gap-1.5"
                      >
                        <CheckCircle size={16} /> อนุมัติผ่านเคลม
                      </Button>
                      <Button
                        type="button"
                        onClick={() => handleClaimStatusUpdate(selectedClaim.id, 'REJECTED')}
                        className="bg-red-700 hover:bg-red-800 text-white font-bold px-4 py-2 text-sm shadow-sm gap-1.5"
                      >
                        <XCircle size={16} /> ปฏิเสธคำขอ
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400 font-bold flex items-center gap-1">
                      🔒 สิทธิ์การอนุมัติเฉพาะเจ้าของร้าน/แอดมิน
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
