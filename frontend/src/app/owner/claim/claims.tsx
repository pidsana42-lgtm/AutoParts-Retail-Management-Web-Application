import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Minus, Send,
  ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, History, Trash2,
  FileText, Loader2, Eye, Camera, X, Printer, CheckCircle2, SquarePen,
  ClipboardEdit, UserCheck, UserX, Clock, Truck, SendHorizonal, XCircle,
} from 'lucide-react';
import Heading from '../../../components/elements/heading';
import Card, { CardHeader, CardTitle, CardContent } from '../../../components/elements/card';
import Input from '../../../components/elements/input';
import Button from '../../../components/elements/button';
import Badge from '../../../components/elements/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/elements/table';
import { getCustomerClaims, searchSaleOrders, deleteCustomerClaim, updateCustomerClaim } from '../../../service/http/claim/claim';
import { posApiService } from '../../../service/http/pos/pos_service';
import type { CustomerDiscountResponse } from '../../../interface/pos/customer_interface';
import apiClient from '../../../service/http/apiClient';
import type { CustomerClaim } from '../../../interface/claim/claim';
import { cn } from '../../../utils/component';

interface ClaimFormProduct {
  product_id: number;
  product_name: string;
  price: number;
  sold_qty: number;
  claim_qty: number;
  reason: string;
  claim_type?: 'INSTANT' | 'SUPPLIER_PENDING' | 'CREDIT_ACCOUNT';
  evidenceFile: File | null;
  evidencePreview: string | null;
}

interface FlatRow {
  claimId: number;
  claimNo: string;
  claimDate: string;
  customerName: string;
  customerPhone: string;
  claimType: 'INSTANT' | 'SUPPLIER_PENDING' | 'CREDIT_ACCOUNT';
  itemClaimType: 'INSTANT' | 'SUPPLIER_PENDING' | 'CREDIT_ACCOUNT';
  isFirst: boolean;
  totalItems: number;
  itemId: number;
  productName: string;
  qty: number;
  reason: string;
  resolution: string;
  itemStatus: string;
  rawClaim: CustomerClaim;
}

const parseNote = (note: string | undefined, key: string): string => {
  if (!note) return '-';
  const match = note.match(new RegExp(`${key}:\\s*([^|]+)`));
  return match ? match[1].trim() : '-';
};

const toFlatRows = (claims: CustomerClaim[]): FlatRow[] => {
  const rows: FlatRow[] = [];
  for (const claim of claims) {
    const items = claim.items ?? [];
    const noteText = claim.notes || claim.note;
    const customerName =
      claim.customer_name && claim.customer_name !== '-'
        ? claim.customer_name
        : parseNote(noteText, 'ลูกค้า');
    const customerPhone = parseNote(noteText, 'โทร');
    const typeFromNote = parseNote(noteText, 'ประเภทเคลม');

    const claimType: 'INSTANT' | 'SUPPLIER_PENDING' | 'CREDIT_ACCOUNT' =
      claim.claim_type ?? (
        typeFromNote.includes('เปลี่ยนทันที') ? 'INSTANT' :
        typeFromNote.includes('ส่งบริษัท') ? 'SUPPLIER_PENDING' :
        typeFromNote.includes('ลงบัญชีเชื่อ') ? 'CREDIT_ACCOUNT' : 'INSTANT'
      );

    if (items.length === 0) {
      rows.push({
        claimId: claim.id ?? 0,
        claimNo: claim.claim_no ?? `CLM-${claim.id}`,
        claimDate: claim.claim_date,
        customerName,
        customerPhone,
        claimType,
        itemClaimType: claimType,
        isFirst: true,
        totalItems: 0,
        itemId: 0,
        productName: '-',
        qty: 0,
        reason: '-',
        resolution: '-',
        itemStatus: (claim.status ?? 'PENDING').toUpperCase(),
        rawClaim: claim,
      });
    } else {
      items.forEach((item, idx) => {
        const rawStatus = item.status || claim.status || 'Pending';
        const itemClaimType: 'INSTANT' | 'SUPPLIER_PENDING' | 'CREDIT_ACCOUNT' =
          item.claim_type ?? claimType;

        rows.push({
          claimId: claim.id ?? 0,
          claimNo: claim.claim_no ?? `CLM-${claim.id}`,
          claimDate: claim.claim_date,
          customerName,
          customerPhone,
          claimType,
          itemClaimType,
          isFirst: idx === 0,
          totalItems: items.length,
          itemId: item.id ?? 0,
          productName: item.product_name || `#${item.product_id}`,
          qty: item.qty,
          reason: item.reason,
          resolution: item.resolution,
          itemStatus: rawStatus.toUpperCase(),
          rawClaim: claim,
        });
      });
    }
  }
  return rows;
};

function StatusBadge({ status }: { status: string }) {
  if (status === 'APPROVED') return <Badge variant="success" size="sm">อนุมัติแล้ว</Badge>;
  if (status === 'REJECTED') return <Badge variant="error" size="sm">ปฏิเสธ</Badge>;
  return <Badge variant="warning" size="sm">รอดำเนินการ</Badge>;
}

function TypeBadge({ type }: { type: 'INSTANT' | 'SUPPLIER_PENDING' | 'CREDIT_ACCOUNT' }) {
  if (type === 'SUPPLIER_PENDING')
    return <span className="px-2 py-0.5 text-[10px] font-bold text-[#1C1B1B] bg-gray-100 border border-gray-300 rounded-none inline-block">ส่งบริษัทตรวจ</span>;
  if (type === 'CREDIT_ACCOUNT')
    return <span className="px-2 py-0.5 text-[10px] font-bold text-gray-800 bg-gray-200 border border-gray-300 rounded-none inline-block">ลงบัญชีเชื่อ</span>;
  return <span className="px-2 py-0.5 text-[10px] font-bold text-[#e51c23] bg-red-50 border border-red-200 rounded-none inline-block">เปลี่ยนทันที</span>;
}


function getPageNumbers(current: number, total: number): (number | "...")[] {
  const delta = 1;
  const range: (number | "...")[] = [];
  const left = Math.max(2, current - delta);
  const right = Math.min(total - 1, current + delta);

  range.push(1);
  if (left > 2) range.push("...");
  for (let i = left; i <= right; i++) range.push(i);
  if (right < total - 1) range.push("...");
  if (total > 1) range.push(total);

  return range;
}

interface ClaimsPageProps {
  canApprove?: boolean;
}

export default function ClaimsPage({ canApprove = true }: ClaimsPageProps): React.JSX.Element {
  const navigate = useNavigate();

  const [view, setView] = useState<'list' | 'claim-form'>('list');
  const [claimSearch, setClaimSearch] = useState('');
  const [showSearchDrop, setShowSearchDrop] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [rawClaims, setRawClaims] = useState<CustomerClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [claimType, setClaimType] = useState<'INSTANT' | 'SUPPLIER_PENDING' | 'CREDIT_ACCOUNT'>('INSTANT');
  const [claimFormInvoice, setClaimFormInvoice] = useState('');
  const [invoiceResults, setInvoiceResults] = useState<any[]>([]);
  const [showInvoiceDrop, setShowInvoiceDrop] = useState(false);
  const [invoiceSearching, setInvoiceSearching] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [claimOrderId, setClaimOrderId] = useState<number | null>(null);
  const [claimCustomerName, setClaimCustomerName] = useState('');
  const [claimCustomerSurname, setClaimCustomerSurname] = useState('');
  const [claimCustomerPhone, setClaimCustomerPhone] = useState('');
  const [claimDate, setClaimDate] = useState(new Date().toISOString().split('T')[0]);
  const [claimNote, setClaimNote] = useState('');
  const [claimItems, setClaimItems] = useState<ClaimFormProduct[]>([]);
  const [posCustomerCredit, setPosCustomerCredit] = useState<CustomerDiscountResponse | null>(null);
  const [loadingPosCredit, setLoadingPosCredit] = useState(false);

  const [quickUpdateClaim, setQuickUpdateClaim] = useState<CustomerClaim | null>(null);
  const [savingQuickOp, setSavingQuickOp] = useState(false);
  const [quickOpNote, setQuickOpNote] = useState('');

  const handleQuickUpdate = async (patch: Partial<CustomerClaim>) => {
    if (!quickUpdateClaim?.id) return;
    try {
      setSavingQuickOp(true);
      const updated = { ...quickUpdateClaim, ...patch };
      await updateCustomerClaim(quickUpdateClaim.id, updated as any);
      setQuickUpdateClaim(updated);
      await loadClaims();
    } catch (err) {
      console.error('Failed to quick update claim status:', err);
      alert('เกิดข้อผิดพลาดในการอัปเดตสถานะ กรุณาลองใหม่');
    } finally {
      setSavingQuickOp(false);
    }
  };

  useEffect(() => {
    if (claimType === 'CREDIT_ACCOUNT' && claimCustomerPhone.trim()) {
      const fetchCredit = async () => {
        try {
          setLoadingPosCredit(true);
          const data = await posApiService.searchCustomerDiscount(claimCustomerPhone.trim());
          setPosCustomerCredit(data);
        } catch (err) {
          console.error('Failed to fetch POS customer credit:', err);
          setPosCustomerCredit(null);
        } finally {
          setLoadingPosCredit(false);
        }
      };
      fetchCredit();
    } else {
      setPosCustomerCredit(null);
    }
  }, [claimType, claimCustomerPhone]);

  const [activeEvidenceIdx, setActiveEvidenceIdx] = useState<number | null>(null);
  const itemEvidenceRef = useRef<HTMLInputElement>(null);

  const loadClaims = async () => {
    try {
      setLoading(true);
      const data = await getCustomerClaims();
      setRawClaims(data);
    } catch (err) {
      console.error('Failed to load claims:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadClaims(); }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSearchDrop(false);
      if (invoiceRef.current && !invoiceRef.current.contains(e.target as Node)) setShowInvoiceDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const flatRows = toFlatRows(rawClaims);

  const handleInvoiceInput = async (value: string) => {
    setClaimFormInvoice(value);
    if (value.trim().length < 2) { setInvoiceResults([]); setShowInvoiceDrop(false); return; }
    try {
      setInvoiceSearching(true);
      const results = await searchSaleOrders(value.trim());
      setInvoiceResults(results);
      setShowInvoiceDrop(true);
    } catch { setInvoiceResults([]); } finally { setInvoiceSearching(false); }
  };

  const handleSelectOrder = (order: any) => {
    const cName = order.customer_name || 'ลูกค้าทั่วไป';
    const cPhone = order.customer_phone || '-';
    setClaimFormInvoice(order.order_number);
    setClaimOrderId(order.id ?? null);
    const parts = cName.split(' ');
    setClaimCustomerName(parts[0] || '');
    setClaimCustomerSurname(parts.slice(1).join(' ') || '');
    setClaimCustomerPhone(cPhone);
    setClaimItems(
      (order.items ?? []).map((item: any) => ({
        product_id: item.product_id ?? 0,
        product_name: item.product_name || 'อะไหล่ยนต์',
        price: item.unit_price,
        sold_qty: item.qty || 1,
        claim_qty: 0,
        reason: '',
        evidenceFile: null,
        evidencePreview: null,
      }))
    );
    setShowInvoiceDrop(false);
    setInvoiceResults([]);
  };

  const handleClaimItemQtyChange = (index: number, delta: number) => {
    setClaimItems(prev => {
      const updated = [...prev];
      const t = updated[index];
      updated[index] = { ...t, claim_qty: Math.max(0, Math.min(t.sold_qty, t.claim_qty + delta)) };
      return updated;
    });
  };

  const handleClaimItemReasonChange = (index: number, value: string) => {
    setClaimItems(prev => prev.map((item, i) => i === index ? { ...item, reason: value } : item));
  };

  const handleItemEvidenceClick = (idx: number) => {
    setActiveEvidenceIdx(idx);
    itemEvidenceRef.current?.click();
  };

  const handleItemEvidenceSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || activeEvidenceIdx === null) return;
    if (file.size > 5 * 1024 * 1024) { alert('ไฟล์ใหญ่เกินไป (สูงสุด 5MB)'); return; }
    const preview = URL.createObjectURL(file);
    setClaimItems(prev =>
      prev.map((item, i) => i === activeEvidenceIdx ? { ...item, evidenceFile: file, evidencePreview: preview } : item)
    );
    if (itemEvidenceRef.current) itemEvidenceRef.current.value = '';
    setActiveEvidenceIdx(null);
  };

  const handleRemoveItemEvidence = (idx: number) => {
    setClaimItems(prev =>
      prev.map((item, i) => i === idx ? { ...item, evidenceFile: null, evidencePreview: null } : item)
    );
  };

  const handleSaveClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimCustomerName || !claimCustomerPhone) {
      alert('กรุณาค้นหาใบเสร็จเพื่อโหลดข้อมูลลูกค้าก่อน'); return;
    }
    const selected = claimItems.filter(i => i.claim_qty > 0);
    if (selected.length === 0) { alert('กรุณาเลือกจำนวนสินค้าที่ต้องการเคลมอย่างน้อย 1 ชิ้น'); return; }
    const missing = selected.find(p => !p.reason.trim());
    if (missing) { alert(`กรุณาระบุสาเหตุที่เคลมสำหรับ "${missing.product_name}"`); return; }

    try {
      setSaving(true);
      const itemsWithUrls = await Promise.all(
        selected.map(async p => {
          let evidenceUrl = '';
          if (p.evidenceFile) {
            try {
              const fd = new FormData();
              fd.append('file', p.evidenceFile);
              const res = await apiClient.post('/claims/evidence/upload', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
              });
              evidenceUrl = res.data?.url ?? '';
            } catch (err) { console.error('Evidence upload error:', err); }
          }
          return {
            product_id: p.product_id,
            qty: p.claim_qty,
            reason: p.reason || 'สินค้าชำรุด/ไม่ได้มาตรฐาน',
            resolution: 'รอการตรวจสอบ',
            claim_type: p.claim_type || claimType,
            evidence_url: evidenceUrl,
          };
        })
      );

      await apiClient.post('/claims/customer-claims', {
        original_order_id: claimOrderId ?? 0,
        claim_type: claimType,
        notes: claimNote.trim(),
        items: itemsWithUrls,
      });
      await loadClaims();
      setView('list');
      resetClaimForm();
    } catch (err) {
      console.error('Failed to create claim:', err);
      alert('เกิดข้อผิดพลาดในการบันทึกใบเคลม กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClaim = async (claimId: number) => {
    if (!window.confirm('ยืนยันการลบใบเคลมนี้?')) return;
    try {
      await deleteCustomerClaim(claimId);
      setRawClaims(prev => prev.filter(c => c.id !== claimId));
    } catch (err) {
      console.error('Failed to delete claim:', err);
      alert('เกิดข้อผิดพลาดในการลบ กรุณาลองใหม่');
    }
  };

  const resetClaimForm = () => {
    setClaimType('INSTANT');
    setClaimFormInvoice('');
    setClaimOrderId(null);
    setClaimCustomerName('');
    setClaimCustomerSurname('');
    setClaimCustomerPhone('');
    setClaimDate(new Date().toISOString().split('T')[0]);
    setClaimNote('');
    setClaimItems([]);
    setInvoiceResults([]);
  };

  const basePath = canApprove ? '/owner/claims' : '/employee/claims';

  // ─── LIST VIEW ────────────────────────────────────────────────────────────────
  if (view === 'list') {
    const pendingCount = flatRows.filter(r => r.itemStatus === 'PENDING' && r.itemId > 0).length;
    const approvedCount = flatRows.filter(r => r.itemStatus === 'APPROVED' && r.isFirst).length;
    const rejectedCount = flatRows.filter(r => r.itemStatus === 'REJECTED' && r.isFirst).length;

    const filteredRows = flatRows.filter(row => {
      const q = claimSearch.toLowerCase();
      const matchesQuery =
        row.claimNo.toLowerCase().includes(q) ||
        row.customerName.toLowerCase().includes(q) ||
        row.customerPhone.includes(q) ||
        row.productName.toLowerCase().includes(q);

      const matchesStatus = !statusFilter || row.itemStatus === statusFilter;

      return matchesQuery && matchesStatus;
    });

    const totalItems = filteredRows.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    const paginatedRows = filteredRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const searchDropResults = claimSearch.trim().length > 0
      ? rawClaims.filter(c => {
          const q = claimSearch.toLowerCase();
          const noteText = c.notes || c.note;
          const name = c.customer_name && c.customer_name !== '-'
            ? c.customer_name
            : parseNote(noteText, 'ลูกค้า');
          return (c.claim_no ?? '').toLowerCase().includes(q) || name.toLowerCase().includes(q);
        }).slice(0, 8)
      : [];

    return (
      <div className="p-8 space-y-6 bg-gray-50 min-h-screen font-sans">

        {/* 1. Header */}
        <div className="flex items-center justify-between">
          <Heading level="h1" weight="semibold" className="m-0 text-black">
            จัดการเคลมสินค้า
          </Heading>
          <Button
            leftIcon={<Plus className="h-5 w-5" />}
            size="md"
            onClick={() => setView('claim-form')}
          >
            สร้างใบเคลม
          </Button>
        </div>

        {/* 2. Search + Stats */}
        <div className="flex gap-6 items-stretch">
          <Card className="flex-1 w-3/4">
            <div className="p-5">
              <h3 className="text-base font-semibold text-black mb-4">ค้นหาใบเคลมด้วย</h3>
              <div className="grid grid-cols-3 gap-4 items-end">
                <div ref={searchRef} className="relative">
                  <Input
                    type="text"
                    placeholder="เลขที่ใบเคลม, ชื่อลูกค้า, สินค้า..."
                    value={claimSearch}
                    onChange={e => { setClaimSearch(e.target.value); setShowSearchDrop(true); setCurrentPage(1); }}
                    onFocus={() => setShowSearchDrop(true)}
                    leftIcon={<Search size={16} />}
                    className="bg-gray-50 border border-gray-200"
                  />
                  {showSearchDrop && searchDropResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 shadow-lg rounded mt-1 max-h-72 overflow-y-auto">
                      {searchDropResults.map(c => {
                        const noteText = c.notes || c.note;
                        const name = c.customer_name && c.customer_name !== '-'
                          ? c.customer_name
                          : parseNote(noteText, 'ลูกค้า');
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onMouseDown={() => { navigate(`${basePath}/detail/${c.id}`); setShowSearchDrop(false); }}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-[#e51c23] font-mono text-sm">
                                {c.claim_no ?? `CLM-${c.id}`}
                              </span>
                              {(c.status ?? '').toUpperCase() === 'APPROVED' ? (
                                <Badge variant="success" size="sm">อนุมัติแล้ว</Badge>
                              ) : (c.status ?? '').toUpperCase() === 'REJECTED' ? (
                                <Badge variant="error" size="sm">ปฏิเสธ</Badge>
                              ) : (
                                <Badge variant="warning" size="sm">รอดำเนินการ</Badge>
                              )}
                            </div>
                            <p className="text-xs text-[#1C1B1B] font-semibold mt-0.5 truncate">{name}</p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <select
                  value={statusFilter}
                  onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                  className="border border-gray-200 rounded-none px-3 py-2 text-sm text-gray-700 bg-white hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-200 h-[42px] cursor-pointer"
                >
                  <option value="">ทุกสถานะ</option>
                  <option value="PENDING">รอดำเนินการ</option>
                  <option value="APPROVED">อนุมัติแล้ว</option>
                  <option value="REJECTED">ปฏิเสธ</option>
                </select>
                <div className="h-[42px] flex items-center">
                  <Button
                    type="button"
                    onClick={() => window.print()}
                    className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 flex items-center gap-2 shadow-xs font-bold rounded-none text-sm shrink-0 cursor-pointer"
                  >
                    <Printer size={16} /> พิมพ์ใบเช็คลิสต์เคลม
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Monthly Stats Card */}
          <div className="bg-[#22252a] text-white rounded-none p-6 w-1/4 flex flex-col justify-between shadow-sm relative overflow-hidden">
            <div>
              <p className="text-sm text-gray-400 font-light">รายการเคลมในเดือนนี้</p>
              <p className="text-4xl font-bold mt-2 flex items-baseline gap-2">
                {rawClaims.length} <span className="text-lg font-normal text-gray-300">รายการ</span>
              </p>
            </div>
            <div className="absolute right-4 bottom-4 opacity-5 pointer-events-none">
              <History className="w-24 h-24" />
            </div>
          </div>
        </div>

        {/* 3. Summary Cards */}
        <div className="grid grid-cols-3 gap-6">
          <Card className="border-l-[5px] border-l-black flex flex-col justify-center h-24 p-5">
            <p className="text-sm text-[#6B7280] font-medium">รอดำเนินการ</p>
            <p className="text-2xl font-bold mt-1 text-gray-900">{pendingCount} รายการ</p>
          </Card>
          <Card className="border-l-[5px] border-l-emerald-500 flex flex-col justify-center h-24 p-5">
            <p className="text-sm text-[#6B7280] font-medium">อนุมัติแล้ว</p>
            <p className="text-2xl font-bold mt-1 text-gray-900">{approvedCount} รายการ</p>
          </Card>
          <Card className="border-l-[5px] border-l-red-500 flex flex-col justify-center h-24 p-5">
            <p className="text-sm text-[#6B7280] font-medium">ปฏิเสธ</p>
            <p className="text-2xl font-bold mt-1 text-gray-900">{rejectedCount} รายการ</p>
          </Card>
        </div>

        {/* 4. Table */}
        <Card className="overflow-hidden" noPadding>
          <Table>
            <TableHeader className="bg-[#f6f3f2] text-[#797878]">
              <TableRow>
                <TableHead className="pl-6 w-44">เลขที่ใบเคลม / วันที่</TableHead>
                <TableHead className="w-40">ลูกค้า</TableHead>
                <TableHead>สินค้า</TableHead>
                <TableHead className="w-32">ประเภทเคลม</TableHead>
                <TableHead className="text-center w-20">จำนวน</TableHead>
                <TableHead className="w-48">สาเหตุ</TableHead>
                <TableHead className="text-center w-32">สถานะ</TableHead>
                <TableHead className="text-center pr-6 w-32">จัดการ</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody className="text-gray-700">
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-gray-500">
                    กำลังโหลดข้อมูล...
                  </TableCell>
                </TableRow>
              ) : paginatedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-gray-500">
                    ไม่พบข้อมูลรายการเคลมสินค้า
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRows.map((row, idx) => (
                  <TableRow
                    key={`${row.claimId}-${row.itemId}-${idx}`}
                    className={cn(
                      'hover:bg-gray-50/70 transition-colors',
                      row.isFirst ? 'border-t-2 border-gray-200' : 'border-t border-gray-100 bg-gray-50/30'
                    )}
                  >
                    <TableCell className="pl-6">
                      {row.isFirst ? (
                        <div>
                          <p className="font-bold text-[#e51c23] font-mono text-sm">{row.claimNo}</p>
                          <p className="text-xs text-[#5F5E5E] mt-0.5">
                            {new Date(row.claimDate).toLocaleDateString('th-TH', {
                              year: 'numeric', month: 'short', day: 'numeric',
                            })}
                          </p>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs pl-2">└</span>
                      )}
                    </TableCell>

                    <TableCell>
                      {row.isFirst ? (
                        <div>
                          <p className="font-bold text-[#1C1B1B] text-sm">{row.customerName}</p>
                          {row.customerPhone !== '-' && (
                            <p className="text-xs text-[#5F5E5E] font-bold mt-0.5">{row.customerPhone}</p>
                          )}
                        </div>
                      ) : null}
                    </TableCell>

                    <TableCell>
                      <p className="font-semibold text-[#1C1B1B]">{row.productName}</p>
                      {row.resolution && row.resolution !== 'รอการตรวจสอบ' && row.resolution !== '-' && (
                        <p className="text-xs text-emerald-600 mt-0.5">{row.resolution}</p>
                      )}
                    </TableCell>

                    <TableCell>
                      <TypeBadge type={row.itemClaimType} />
                    </TableCell>

                    <TableCell className="text-center">
                      <span className="font-bold text-[#1C1B1B]">{row.qty} ชิ้น</span>
                    </TableCell>

                    <TableCell>
                      <p className="text-[#5F5E5E] text-sm truncate max-w-[180px]" title={row.reason}>
                        {row.reason || '-'}
                      </p>
                    </TableCell>

                    <TableCell className="text-center">
                      <div
                        onClick={() => navigate(`${basePath}/status/${row.claimId}`)}
                        className="inline-flex flex-col items-center gap-1 cursor-pointer group p-1 hover:bg-gray-100 rounded transition-colors"
                        title="คลิกเพื่ออัปเดตสถานะการดำเนินงาน"
                      >
                        <div className="flex items-center gap-1">
                          <StatusBadge status={row.itemStatus} />
                          <SquarePen className="w-3 h-3 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>

                        {row.isFirst && (
                          <div className="flex flex-col items-center gap-0.5 mt-0.5">
                            {row.rawClaim.customer_received_item === true && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">
                                ได้รับของแล้ว
                              </span>
                            )}
                            {row.rawClaim.customer_waiting === true && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200">
                                ลูกค้ารอผล
                              </span>
                            )}
                            {row.rawClaim.supplier_response_status === 'WAITING' && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200">
                                ส่งบริษัท (รอผล)
                              </span>
                            )}
                            {row.rawClaim.supplier_response_status === 'APPROVED' && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">
                                บริษัทอนุมัติ
                              </span>
                            )}
                            {row.rawClaim.supplier_response_status === 'REJECTED' && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold text-red-700 bg-red-50 border border-red-200">
                                บริษัทปฏิเสธ
                              </span>
                            )}
                            {row.rawClaim.operation_note && (
                              <span className="text-[9px] text-[#5F5E5E] max-w-[130px] truncate" title={row.rawClaim.operation_note}>
                                โน้ต: {row.rawClaim.operation_note}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="text-center pr-6">
                      {row.isFirst && (
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => navigate(`${basePath}/detail/${row.claimId}`)}
                            className="text-gray-600 hover:text-gray-800 transition cursor-pointer"
                            title="ดูรายละเอียด"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => navigate(`${basePath}/edit/${row.claimId}`)}
                            className="text-gray-600 hover:text-gray-800 transition cursor-pointer"
                            title="แก้ไขใบเคลม"
                          >
                            <SquarePen className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClaim(row.claimId)}
                            className="text-red-600 hover:text-red-700 transition cursor-pointer"
                            title="ลบใบเคลม"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {!loading && totalItems > 0 && (
            <div className="bg-[#fcfbfa] px-6 py-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-4">
                <span>
                  แสดง {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} ถึง {Math.min(currentPage * itemsPerPage, totalItems)} จาก {totalItems} รายการ
                </span>
                <div className="flex items-center gap-2">
                  <span>รายการต่อหน้า:</span>
                  <select
                    value={itemsPerPage}
                    onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                    className="border border-gray-200 rounded-none px-2 py-1 text-gray-600 bg-white hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-200 cursor-pointer"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                  aria-label="หน้าแรก"
                  className="p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  aria-label="หน้าก่อนหน้า"
                  className="p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {getPageNumbers(currentPage, totalPages).map((page, idx) =>
                  page === "..." ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      aria-current={currentPage === page ? "page" : undefined}
                      className={cn(
                        "px-3 py-1.5 rounded-none font-medium transition-colors cursor-pointer",
                        currentPage === page ? "bg-[#d61c24] text-white" : "text-gray-600 hover:bg-gray-100"
                      )}
                    >
                      {page}
                    </button>
                  )
                )}

                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  aria-label="หน้าถัดไป"
                  className="p-1.5 rounded-none text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  aria-label="หน้าสุดท้าย"
                  className="p-1.5 rounded-none text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </Card>

        {/* Printable Area for PDF / Paper Printing */}
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #printable-claim-checklist, #printable-claim-checklist * { visibility: visible; }
            #printable-claim-checklist {
              position: absolute; left: 0; top: 0; width: 100%; padding: 20px;
              background: white; color: black; font-size: 12px;
            }
          }
        `}</style>

        <div id="printable-claim-checklist" className="hidden print:block font-sans text-slate-900 p-4">
          <div className="border-b-2 border-slate-800 pb-3 mb-4 flex justify-between items-start">
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">AutoParts Retail Management</h1>
              <h2 className="text-sm font-bold text-slate-700 mt-0.5">ใบรายงานเช็คลิสต์ตรวจสอบรายการเคลมสินค้า (Customer Claims Checklist Report)</h2>
              <p className="text-xs text-slate-500 mt-1">
                เงื่อนไขตัวกรอง: {statusFilter ? `สถานะ ${statusFilter.toUpperCase()}` : 'ทุกสถานะ'} | รวมทั้งหมด {filteredRows.length} รายการ
              </p>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p className="font-bold text-slate-800">วันที่พิมพ์รายงาน</p>
              <p>{new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>

          <table className="w-full border-collapse border border-slate-300 text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                <th className="border border-slate-300 p-2 text-center w-10">ตรวจ</th>
                <th className="border border-slate-300 p-2 text-left w-28">เลขใบเคลม / วันที่</th>
                <th className="border border-slate-300 p-2 text-left w-36">ชื่อลูกค้า / เบอร์โทร</th>
                <th className="border border-slate-300 p-2 text-left">รายการสินค้าอะไหล่</th>
                <th className="border border-slate-300 p-2 text-center w-12">จำนวน</th>
                <th className="border border-slate-300 p-2 text-left w-40">สาเหตุการขอเคลม</th>
                <th className="border border-slate-300 p-2 text-center w-24">สถานะปัจจุบัน</th>
                <th className="border border-slate-300 p-2 text-left w-36">ผลการตรวจรับจริง</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => (
                <tr key={idx} className="border-b border-slate-200">
                  <td className="border border-slate-300 p-2 text-center font-mono text-slate-500 font-bold">[ &nbsp; ]</td>
                  <td className="border border-slate-300 p-2">
                    <div className="font-bold text-slate-900 font-mono">{row.claimNo}</div>
                    <div className="text-[10px] text-slate-500">{new Date(row.claimDate).toLocaleDateString('th-TH')}</div>
                  </td>
                  <td className="border border-slate-300 p-2">
                    <div className="font-bold text-slate-800">{row.customerName}</div>
                    <div className="text-[10px] text-slate-500">{row.customerPhone}</div>
                  </td>
                  <td className="border border-slate-300 p-2 font-medium text-slate-800">{row.productName}</td>
                  <td className="border border-slate-300 p-2 text-center font-bold">{row.qty}</td>
                  <td className="border border-slate-300 p-2 text-slate-600">{row.reason}</td>
                  <td className="border border-slate-300 p-2 text-center font-bold">
                    {row.itemStatus === 'APPROVED' ? 'อนุมัติ' : row.itemStatus === 'REJECTED' ? 'ปฏิเสธ' : 'รอดำเนินการ'}
                  </td>
                  <td className="border border-slate-300 p-2 text-slate-400"></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-8 pt-4 flex justify-between items-end text-xs text-slate-700">
            <div>
              <p>หมายเหตุเพิ่มเติม: __________________________________________________________________</p>
            </div>
            <div className="text-center border-t border-slate-400 pt-2 min-w-[220px]">
              <p className="font-bold">ลายเซ็นเจ้าของร้าน / ผู้ตรวจสอบสินค้า</p>
              <p className="mt-6">วันที่ ____/____/________</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── FORM VIEW ────────────────────────────────────────────────────────────────
  return (
    <div className='p-8 space-y-6 bg-gray-50 min-h-screen'>
      <form onSubmit={handleSaveClaim} className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className='flex-col space-y-2'>
            <nav className="flex items-center text-sm text-gray-500 gap-2 font-light">
              <button
                type="button"
                onClick={() => { setView('list'); resetClaimForm(); }}
                className="hover:text-gray-900 transition-colors cursor-pointer"
              >
                จัดการเคลมสินค้า
              </button>
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <span className="text-black font-normal">สร้างใบเคลมสินค้า</span>
            </nav>
            <Heading level='h1' weight='semibold' className='m-0 text-black'>
              สร้างใบเคลมสินค้า
            </Heading>
          </div>
          <div className='flex items-end gap-4 justify-end'>
            <Button
              type="submit"
              size='md'
              disabled={saving}
            >
              {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Send size={16} className="mr-2" />}
              {saving ? 'กำลังบันทึก...' : 'ส่งใบเคลม'}
            </Button>
          </div>
        </div>

        <div className="flex gap-6 items-start">
          {/* Left Side */}
          <div className='w-1/4 flex flex-col gap-6'>
            <Card className='border-l-[5px] border-l-black'>
              <CardHeader className='items-center justify-start gap-4 mt-2 mb-2'>
                <CardTitle className='text-base text-black'><Search className="h-6 w-6" /></CardTitle>
                <CardTitle className='text-lg text-black'>ค้นหาใบสั่งซื้อ</CardTitle>
              </CardHeader>
              <CardContent>
                <div ref={invoiceRef} className="relative">
                  <Input
                    type="text"
                    placeholder="เลขที่ SO หรือชื่อลูกค้า..."
                    value={claimFormInvoice}
                    onChange={e => handleInvoiceInput(e.target.value)}
                    onFocus={() => invoiceResults.length > 0 && setShowInvoiceDrop(true)}
                    leftIcon={invoiceSearching
                      ? <Loader2 size={14} className="text-[#e51c23] animate-spin" />
                      : <Search size={14} />}
                    className="bg-slate-50 border border-slate-200"
                  />
                  {showInvoiceDrop && invoiceResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 bg-white border border-slate-200 shadow-lg rounded-lg mt-1 max-h-72 overflow-y-auto">
                      {invoiceResults.map((order: any) => (
                        <button
                          key={order.id}
                          type="button"
                          onMouseDown={() => handleSelectOrder(order)}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-[#e51c23] font-mono text-sm">{order.order_number}</span>
                          </div>
                          <p className="text-sm font-semibold text-slate-700 mt-0.5">{order.customer_name || 'ลูกค้าทั่วไป'}</p>
                          {order.customer_phone && order.customer_phone !== '-' && (
                            <p className="text-xs text-slate-400">{order.customer_phone}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {showInvoiceDrop && !invoiceSearching && invoiceResults.length === 0 && claimFormInvoice.length >= 2 && (
                    <div className="absolute top-full left-0 right-0 z-50 bg-white border border-slate-200 shadow-lg rounded-lg mt-1 px-4 py-3 text-sm text-slate-500">
                      ไม่พบใบสั่งซื้อที่ตรงกับ &quot;{claimFormInvoice}&quot;
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className='border-l-[5px] border-l-gray-500'>
              <CardHeader className='items-center justify-start gap-4 mt-2 mb-2'>
                <CardTitle className='text-base text-gray-700'><History className="h-6 w-6" /></CardTitle>
                <CardTitle className='text-lg text-black'>ประเภทการเคลม</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { key: 'INSTANT', title: 'เปลี่ยนทันที', desc: 'สินค้าเสียชัดเจน เปลี่ยนชิ้นใหม่ทันที', color: 'text-[#e51c23]' },
                    { key: 'SUPPLIER_PENDING', title: 'ส่งบริษัทตรวจ', desc: 'ฝากส่งซัพพลายเออร์ตรวจก่อนอนุมัติ', color: 'text-[#1C1B1B]' },
                    { key: 'CREDIT_ACCOUNT', title: 'ลงบัญชีเชื่อ', desc: 'เปลี่ยนของให้ + ตั้งหักยอดบิล', color: 'text-gray-700' },
                  ].map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setClaimType(t.key as any)}
                      className={`w-full text-left p-3 border rounded-none transition-all cursor-pointer ${
                        claimType === t.key
                          ? 'border-[#e51c23] bg-red-50/50 ring-1 ring-[#e51c23]'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <p className={`text-sm font-bold ${t.color}`}>{t.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Side */}
          <div className='flex flex-col items-start w-3/4 gap-4'>
            <Card title="ข้อมูลลูกค้าและรายละเอียดใบเคลม" subtitle="โหลดจากใบสั่งซื้อที่เลือก" className="w-full">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-2">
                <Input label="ชื่อ" type="text" value={claimCustomerName} disabled className="bg-slate-50 border border-slate-200" />
                <Input label="นามสกุล" type="text" value={claimCustomerSurname} disabled className="bg-slate-50 border border-slate-200" />
                <Input label="เบอร์โทรศัพท์" type="text" value={claimCustomerPhone} disabled className="bg-slate-50 border border-slate-200" />
                <Input
                  label="วันที่เคลม"
                  type="date"
                  value={claimDate}
                  onChange={(e) => setClaimDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200"
                />
              </div>
              <div className="mt-3">
                <p className="text-xs text-slate-500 font-semibold mb-1">หมายเหตุเพิ่มเติม</p>
                <textarea
                  value={claimNote}
                  onChange={(e) => setClaimNote(e.target.value)}
                  rows={2}
                  placeholder="ระบุหมายเหตุเพิ่มเติม (ถ้ามี)..."
                  className="w-full border border-gray-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#e51c23] rounded-none resize-none"
                />
              </div>
            </Card>

            {claimType === 'CREDIT_ACCOUNT' && (
              <Card className="border-l-[5px] border-l-slate-800 bg-slate-50 w-full" noPadding>
                <div className="py-3 px-5 border-b border-slate-200 flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-800">ข้อมูลวงเงินและบัญชีเชื่อ POS</p>
                  {posCustomerCredit?.is_credit_enabled ? (
                    <Badge variant="success" size="sm">อนุมัติวงเงินเชื่อ</Badge>
                  ) : (
                    <Badge variant="error" size="sm">ไม่อนุมัติวงเงินเชื่อ</Badge>
                  )}
                </div>
                <div className="p-4">
                  {loadingPosCredit ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Loader2 size={14} className="animate-spin text-[#e51c23]" /> กำลังโหลดข้อมูลบัญชีเชื่อ POS...
                    </div>
                  ) : posCustomerCredit ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                      <div>
                        <p className="text-slate-500 font-semibold mb-0.5">กลุ่มลูกค้า</p>
                        <p className="font-bold text-slate-800">
                          {posCustomerCredit.customer_type?.type_label || posCustomerCredit.customer_type?.type_name || 'ลูกค้าทั่วไป'}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-semibold mb-0.5">วงเงินสินเชื่อสูงสุด</p>
                        <p className="font-bold text-slate-800">฿{(posCustomerCredit.max_credit_limit || 0).toLocaleString('th-TH')}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-semibold mb-0.5">ยอดหนี้ค้างชำระปัจจุบัน</p>
                        <p className="font-bold text-[#e51c23]">฿{(posCustomerCredit.current_debt_amount || 0).toLocaleString('th-TH')}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-semibold mb-0.5">วงเงินคงเหลือใช้ได้</p>
                        <p className="font-bold text-emerald-600">
                          ฿{Math.max(0, (posCustomerCredit.max_credit_limit || 0) - (posCustomerCredit.current_debt_amount || 0)).toLocaleString('th-TH')}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 font-medium">
                      {claimCustomerPhone ? 'ค้นหาข้อมูลวงเงินเชื่อ POS สำหรับเบอร์นี้ไม่พบ' : 'กรุณาเลือกใบสั่งซื้อเพื่อโหลดเบอร์โทรลูกค้า POS'}
                    </p>
                  )}
                </div>
              </Card>
            )}

            <Card noPadding title="เลือกสินค้าที่ต้องการเคลม" subtitle="กดไอคอนกล้องเพื่อแนบหลักฐานรายสินค้า" className="w-full overflow-hidden">
              <input
                ref={itemEvidenceRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleItemEvidenceSelect}
              />
              {claimItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-gray-100 text-gray-600">
                      <TableRow>
                        <TableHead className="pl-6">ชื่อสินค้า</TableHead>
                        <TableHead className="text-center w-20">ซื้อมา</TableHead>
                        <TableHead className="text-center w-28">จำนวนเคลม</TableHead>
                        <TableHead className="w-36">ประเภทเคลม</TableHead>
                        <TableHead>สาเหตุที่เคลม</TableHead>
                        <TableHead className="text-center w-24">หลักฐาน</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-gray-700">
                      {claimItems.map((item, idx) => {
                        const isSelected = item.claim_qty > 0;
                        return (
                        <TableRow
                          key={idx}
                          onClick={(e) => {
                            // ไม่ toggle ถ้า click ที่ปุ่ม +/- หรือ input หรือ select หรือ camera
                            const tag = (e.target as HTMLElement).closest('button, input, select');
                            if (tag) return;
                            // toggle: ถ้าเลือกอยู่ → 0, ถ้าไม่เลือก → sold_qty
                            setClaimItems(prev => {
                              const updated = [...prev];
                              updated[idx] = { ...updated[idx], claim_qty: isSelected ? 0 : updated[idx].sold_qty };
                              return updated;
                            });
                          }}
                          className={`cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-red-50 border-l-4 border-l-[#e51c23]'
                              : 'opacity-50 hover:opacity-75 hover:bg-gray-50 border-l-4 border-l-transparent'
                          }`}
                        >
                          <TableCell className="pl-5 font-semibold text-slate-800">
                            <div className="flex items-center gap-2">
                              {isSelected
                                ? <span className="w-2 h-2 rounded-full bg-[#e51c23] shrink-0" />
                                : <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />}
                              {item.product_name}
                            </div>
                          </TableCell>
                          <TableCell className="text-center text-slate-500">{item.sold_qty}</TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-2">
                              <button type="button" onClick={(e) => { e.stopPropagation(); handleClaimItemQtyChange(idx, -1); }}
                                className="p-1 hover:bg-slate-100 rounded text-slate-500 cursor-pointer">
                                <Minus size={13} />
                              </button>
                              <span className={`w-8 text-center font-bold ${isSelected ? 'text-[#e51c23]' : 'text-slate-400'}`}>
                                {item.claim_qty}
                              </span>
                              <button type="button" onClick={(e) => { e.stopPropagation(); handleClaimItemQtyChange(idx, 1); }}
                                className="p-1 hover:bg-slate-100 rounded text-slate-500 cursor-pointer">
                                <Plus size={13} />
                              </button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <select
                              value={item.claim_type || claimType}
                              disabled={!isSelected}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const val = e.target.value as 'INSTANT' | 'SUPPLIER_PENDING' | 'CREDIT_ACCOUNT';
                                setClaimItems(prev => prev.map((it, i) => i === idx ? { ...it, claim_type: val } : it));
                              }}
                              className="w-full border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:border-[#e51c23] disabled:bg-slate-50 disabled:text-slate-400 bg-white rounded cursor-pointer font-bold text-slate-700"
                            >
                              <option value="INSTANT">เปลี่ยนทันที</option>
                              <option value="SUPPLIER_PENDING">ส่งบริษัทตรวจ</option>
                              <option value="CREDIT_ACCOUNT">ลงบัญชีเชื่อ</option>
                            </select>
                          </TableCell>
                          <TableCell>
                            <input
                              type="text"
                              value={item.reason}
                              onChange={e => handleClaimItemReasonChange(idx, e.target.value)}
                              onClick={e => e.stopPropagation()}
                              placeholder="ระบุสาเหตุ..."
                              disabled={!isSelected}
                              className="w-full border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:border-[#e51c23] disabled:bg-slate-50 disabled:text-slate-400 rounded"
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            {item.evidencePreview ? (
                              <div className="relative inline-block">
                                <img src={item.evidencePreview} alt="หลักฐาน"
                                  className="w-9 h-9 object-cover border border-slate-200 rounded" />
                                <button type="button" onClick={(e) => { e.stopPropagation(); handleRemoveItemEvidence(idx); }}
                                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white flex items-center justify-center rounded-full cursor-pointer">
                                  <X size={8} />
                                </button>
                              </div>
                            ) : (
                              <button type="button"
                                onClick={(e) => { e.stopPropagation(); isSelected && handleItemEvidenceClick(idx); }}
                                disabled={!isSelected}
                                className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                title="แนบหลักฐาน">
                                <Camera size={15} />
                              </button>
                            )}
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                  <FileText className="w-24 h-24 text-gray-300 mb-3" />
                  <span className="font-semibold text-gray-500">กรุณาค้นหาใบสั่งซื้อเพื่อแสดงรายการสินค้า</span>
                </div>
              )}
            </Card>
          </div>
        </div>
      </form>

      {/* Quick Status Update Modal */}
      {quickUpdateClaim && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white max-w-lg w-full p-6 shadow-2xl border border-gray-200 space-y-5 rounded-none relative">
            <button
              onClick={() => setQuickUpdateClaim(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <ClipboardEdit size={18} className="text-emerald-600" />
                <Heading level="h2" className="mb-0 text-base font-bold text-[#1C1B1B]">
                  อัปเดทสถานะใบเคลม ({quickUpdateClaim.claim_no || `CLM-${quickUpdateClaim.id}`})
                </Heading>
              </div>
              <p className="text-xs text-[#5F5E5E] mt-1">
                ลูกค้า: {quickUpdateClaim.customer_name && quickUpdateClaim.customer_name !== '-' ? quickUpdateClaim.customer_name : parseNote(quickUpdateClaim.notes || quickUpdateClaim.note, 'ลูกค้า')}
              </p>
            </div>

            {/* ส่วนที่ 0: ผลการอนุมัติใบเคลมหลัก */}
            <div className="bg-gray-50 p-3 border border-gray-200">
              <p className="text-xs font-bold text-[#1C1B1B] mb-2 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-[#e51c23]" />
                สถานะผลการพิจารณาเคลม (สำเร็จ / ยังไม่สำเร็จ)
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={savingQuickOp}
                  onClick={() => handleQuickUpdate({ status: 'PENDING' })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border transition-all cursor-pointer rounded-none ${
                    (quickUpdateClaim.status ?? 'PENDING').toUpperCase() === 'PENDING'
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-amber-400'
                  }`}
                >
                  <Clock size={13} /> รอดำเนินการ (ยังไม่สำเร็จ)
                </button>
                <button
                  type="button"
                  disabled={savingQuickOp}
                  onClick={() => handleQuickUpdate({ status: 'APPROVED' })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border transition-all cursor-pointer rounded-none ${
                    (quickUpdateClaim.status ?? '').toUpperCase() === 'APPROVED'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-500'
                  }`}
                >
                  <CheckCircle2 size={13} /> อนุมัติเคลม (สำเร็จ)
                </button>
                <button
                  type="button"
                  disabled={savingQuickOp}
                  onClick={() => handleQuickUpdate({ status: 'REJECTED' })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border transition-all cursor-pointer rounded-none ${
                    (quickUpdateClaim.status ?? '').toUpperCase() === 'REJECTED'
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-red-500'
                  }`}
                >
                  <XCircle size={13} /> ปฏิเสธเคลม (จบงาน)
                </button>
              </div>
            </div>

            {/* ส่วนที่ 1: สถานะการส่งมอบของให้ลูกค้า */}
            <div>
              <p className="text-xs font-bold text-[#1C1B1B] mb-2 flex items-center gap-1.5">
                <UserCheck size={14} className="text-[#e51c23]" />
                สถานะการส่งมอบของให้ลูกค้า
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={savingQuickOp}
                  onClick={() => handleQuickUpdate({ customer_received_item: true, customer_waiting: false })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border transition-all cursor-pointer rounded-none ${
                    quickUpdateClaim.customer_received_item === true
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400'
                  }`}
                >
                  <UserCheck size={13} /> ลูกค้าได้รับของแล้ว
                </button>
                <button
                  type="button"
                  disabled={savingQuickOp}
                  onClick={() => handleQuickUpdate({ customer_received_item: false, customer_waiting: true })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border transition-all cursor-pointer rounded-none ${
                    quickUpdateClaim.customer_waiting === true
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-amber-400'
                  }`}
                >
                  <Clock size={13} /> ลูกค้ารอผลอยู่ (ยังไม่รับของ)
                </button>
                <button
                  type="button"
                  disabled={savingQuickOp}
                  onClick={() => handleQuickUpdate({ customer_received_item: false, customer_waiting: false })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border transition-all cursor-pointer rounded-none ${
                    quickUpdateClaim.customer_received_item === false && quickUpdateClaim.customer_waiting === false
                      ? 'bg-gray-600 text-white border-gray-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
                  }`}
                >
                  <UserX size={13} /> ยังไม่ได้ส่งมอบ
                </button>
              </div>
            </div>

            {/* ส่วนที่ 2: ถ้าเป็นเคลมส่งบริษัท */}
            {quickUpdateClaim.claim_type === 'SUPPLIER_PENDING' && (
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs font-bold text-[#1C1B1B] mb-2 flex items-center gap-1.5">
                  <Truck size={14} className="text-[#e51c23]" />
                  สถานะการส่งบริษัทและผลการตรวจ
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={savingQuickOp}
                    onClick={() => handleQuickUpdate({ supplier_response_status: 'WAITING' })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border transition-all cursor-pointer rounded-none ${
                      quickUpdateClaim.supplier_response_status === 'WAITING'
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-amber-400'
                    }`}
                  >
                    <SendHorizonal size={13} /> ส่งบริษัทแล้ว (รอผล)
                  </button>
                  <button
                    type="button"
                    disabled={savingQuickOp}
                    onClick={() => handleQuickUpdate({ supplier_response_status: 'APPROVED', status: 'APPROVED' })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border transition-all cursor-pointer rounded-none ${
                      quickUpdateClaim.supplier_response_status === 'APPROVED'
                        ? 'bg-emerald-500 text-white border-emerald-500'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400'
                    }`}
                  >
                    <CheckCircle2 size={13} /> บริษัทอนุมัติ
                  </button>
                  <button
                    type="button"
                    disabled={savingQuickOp}
                    onClick={() => handleQuickUpdate({ supplier_response_status: 'REJECTED', status: 'REJECTED' })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border transition-all cursor-pointer rounded-none ${
                      quickUpdateClaim.supplier_response_status === 'REJECTED'
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-red-500'
                    }`}
                  >
                    <XCircle size={13} /> บริษัทปฏิเสธ
                  </button>
                </div>
              </div>
            )}

            {/* ส่วนที่ 3: บันทึกการดำเนินงาน */}
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-bold text-[#1C1B1B] mb-2">บันทึกการดำเนินงานเพิ่มเติม</p>
              {quickUpdateClaim.operation_note && (
                <div className="mb-2 px-3 py-1.5 bg-blue-50 border border-blue-200 text-xs text-blue-800 font-medium">
                  <span className="font-bold">ล่าสุด:</span> {quickUpdateClaim.operation_note}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={quickOpNote}
                  onChange={e => setQuickOpNote(e.target.value)}
                  placeholder="พิมพ์บันทึกแล้วกดบันทึก..."
                  className="flex-1 border border-gray-300 px-3 py-1.5 text-xs focus:outline-none focus:border-[#e51c23]"
                />
                <button
                  type="button"
                  disabled={savingQuickOp || !quickOpNote.trim()}
                  onClick={async () => {
                    if (!quickOpNote.trim()) return;
                    await handleQuickUpdate({ operation_note: quickOpNote.trim() });
                    setQuickOpNote('');
                  }}
                  className="px-3 py-1.5 bg-[#1C1B1B] text-white text-xs font-bold disabled:opacity-40 cursor-pointer"
                >
                  บันทึกโน้ต
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setQuickUpdateClaim(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold cursor-pointer rounded-none"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Checklist for Claims List Page (Only Approved Items) */}
      <div className="hidden print:block font-sans text-slate-900 p-4">
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #printable-claims-checklist, #printable-claims-checklist * { visibility: visible; }
            #printable-claims-checklist {
              position: absolute; left: 0; top: 0; width: 100%; padding: 20px;
              background: white; color: black; font-size: 12px;
            }
          }
        `}</style>
        <div id="printable-claims-checklist">
          <div className="border-b-2 border-slate-800 pb-3 mb-4 flex justify-between items-start">
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">AutoParts Retail Management</h1>
              <h2 className="text-sm font-bold text-slate-700 mt-0.5">ใบเช็คลิสต์รายการสินค้าที่อนุมัติให้เคลม (Approved Claims Checklist)</h2>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p className="font-bold text-slate-800">วันที่พิมพ์</p>
              <p>{new Date().toLocaleDateString('th-TH')}</p>
            </div>
          </div>

          <table className="w-full border-collapse border border-slate-300 text-xs mb-4">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                <th className="border border-slate-300 p-2 text-left w-32">เลขที่ใบเคลม</th>
                <th className="border border-slate-300 p-2 text-left">สินค้าที่อนุมัติเคลม</th>
                <th className="border border-slate-300 p-2 text-center w-24">ประเภทเคลม</th>
                <th className="border border-slate-300 p-2 text-center w-16">จำนวน</th>
                <th className="border border-slate-300 p-2 text-left">สาเหตุ</th>
                <th className="border border-slate-300 p-2 text-left w-32">ลูกค้า</th>
                <th className="border border-slate-300 p-2 text-center w-24">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const approvedRows = flatRows.filter(r => r.itemStatus === 'APPROVED');
                if (approvedRows.length === 0) {
                  return (
                    <tr>
                      <td colSpan={7} className="border border-slate-300 p-4 text-center text-slate-500 font-medium">
                        ไม่พบรายการสินค้าที่ได้รับการอนุมัติให้เคลมในระบบ
                      </td>
                    </tr>
                  );
                }
                return approvedRows.map((r, i) => (
                  <tr key={i} className="border-b border-slate-200">
                    <td className="border border-slate-300 p-2 font-mono font-bold">{r.claimNo}</td>
                    <td className="border border-slate-300 p-2 font-medium">{r.productName}</td>
                    <td className="border border-slate-300 p-2 text-center">
                      {r.itemClaimType === 'SUPPLIER_PENDING' ? 'ส่งบริษัท' : r.itemClaimType === 'CREDIT_ACCOUNT' ? 'ลงบัญชีเชื่อ' : 'เปลี่ยนทันที'}
                    </td>
                    <td className="border border-slate-300 p-2 text-center font-bold">{r.qty}</td>
                    <td className="border border-slate-300 p-2">{r.reason}</td>
                    <td className="border border-slate-300 p-2">{r.customerName}</td>
                    <td className="border border-slate-300 p-2 text-center font-bold text-emerald-600">อนุมัติเคลมแล้ว</td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>

          <div className="mt-8 pt-4 flex justify-between items-end text-xs text-slate-700">
            <div>
              <p>ผู้พิมพ์รายการ: ________________________</p>
            </div>
            <div className="text-center border-t border-slate-400 pt-2 min-w-[220px]">
              <p className="font-bold">ลายเซ็นเจ้าของร้าน / ผู้อนุมัติ</p>
              <p className="mt-6">วันที่ ____/____/________</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
