import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Minus,
  ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, History, Trash2,
  FileText, Loader2, Eye, Camera, X, Printer, SquarePen,
  Truck,
} from 'lucide-react';
import ClaimTrackingTab from './claim_tracking_tab';
import Heading from '../../../components/elements/heading';
import Card, { CardHeader, CardTitle, CardContent } from '../../../components/elements/card';
import Input from '../../../components/elements/input';
import Button from '../../../components/elements/button';
import Badge from '../../../components/elements/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/elements/table';
import { getCustomerClaims, searchSaleOrders, deleteCustomerClaim, searchCustomerCreditByPhone } from '../../../service/http/claim/claim';
import type { CustomerDiscountResponse } from '../../../interface/pos/customer_interface';
import apiClient from '../../../service/http/apiClient';
import type { CustomerClaim } from '../../../interface/claim/claim';
import { cn } from '../../../utils/component';
import { useNotification } from '../../../contexts/NotificationContext';

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
  const { addNotification } = useNotification();

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

  // Tab & Tracking state
  const [activeTab, setActiveTab] = useState<'claims' | 'tracking'>('claims');
  const [updatingItemId, setUpdatingItemId] = useState<number | null>(null);

  const handleUpdateTrackingStage = async (itemId: number, newStage: string) => {
    if (!itemId) return;
    try {
      setUpdatingItemId(itemId);
      await apiClient.put(`/claims/customer-claims/items/${itemId}`, {
        resolution: newStage,
      });
      setRawClaims(prev => prev.map(c => ({
        ...c,
        items: c.items?.map(i => i.id === itemId ? { ...i, resolution: newStage } : i),
      })));
    } catch (err) {
      console.error('Failed to update tracking stage:', err);
      alert('เกิดข้อผิดพลาดในการอัปเดตขั้นตอน กรุณาลองใหม่');
    } finally {
      setUpdatingItemId(null);
    }
  };

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


  useEffect(() => {
    if (claimCustomerPhone.trim() && claimCustomerPhone.trim() !== '-') {
      const fetchCredit = async () => {
        try {
          setLoadingPosCredit(true);
          const data = await searchCustomerCreditByPhone(claimCustomerPhone.trim());
          setPosCustomerCredit(data);
        } catch (err) {
          console.error('Failed to fetch customer credit:', err);
          setPosCustomerCredit(null);
        } finally {
          setLoadingPosCredit(false);
        }
      };
      fetchCredit();
    } else {
      setPosCustomerCredit(null);
    }
  }, [claimCustomerPhone]);

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
      const newQty = Math.max(0, Math.min(t.sold_qty, t.claim_qty + delta));
      updated[index] = { ...t, claim_qty: newQty };
      return updated;
    });
  };

  const handleDirectClaimItemQty = (index: number, val: number) => {
    setClaimItems(prev => {
      const updated = [...prev];
      const t = updated[index];
      const clamped = Math.max(0, Math.min(t.sold_qty, isNaN(val) ? 0 : val));
      updated[index] = { ...t, claim_qty: clamped };
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

    const isCreditEligible = Boolean(posCustomerCredit && posCustomerCredit.is_credit_enabled);
    const hasCreditAccountItem = selected.some(p => (p.claim_type || claimType) === 'CREDIT_ACCOUNT');
    if (hasCreditAccountItem && !isCreditEligible) {
      alert('ลูกค้าท่านนี้ไม่มีสิทธิ์ใช้วงเงินสินเชื่อ/เงินเชื่อ กรุณาเปลี่ยนประเภทการเคลมเป็น "เปลี่ยนทันที" หรือ "ฝากส่งบริษัทตรวจ"');
      return;
    }

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
        status: canApprove ? 'APPROVED' : 'PENDING',
        items: itemsWithUrls,
      });
      await loadClaims();
      setView('list');
      resetClaimForm();
      addNotification('สร้างใบเคลมสำเร็จ', `ใบเคลมของคุณถูกบันทึกในระบบเรียบร้อยแล้ว`, 'success');
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
    const approvedCount = flatRows.filter(r => r.itemStatus === 'APPROVED').length;
    const rejectedCount = flatRows.filter(r => r.itemStatus === 'REJECTED').length;

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
    const paginatedRows = filteredRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((row, index, arr) => ({
      ...row,
      isFirst: index === 0 || arr[index - 1].claimId !== row.claimId,
    }));

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

    // Active tracking items count for badge
    const activeTrackingCount = rawClaims.reduce((acc, c) => {
      const items = c.items ?? [];
      return acc + items.filter(i => {
        const res = (i.resolution || '').trim();
        const isCompleted = res === 'COMPLETED' || res.includes('ส่งมอบ') || res.includes('สำเร็จ');
        const isRejected = (i.status || '').toUpperCase() === 'REJECTED';
        return !isCompleted && !isRejected;
      }).length;
    }, 0);

    return (
      <div className="p-8 space-y-5 bg-gray-50 min-h-screen font-sans">

        {/* 1. Header */}
        <div className="flex items-center justify-between">
          <Heading level="h1" weight="semibold" className="m-0 text-[#1C1B1B]">
            จัดการเคลมสินค้า
          </Heading>
          <button
            onClick={() => setView('claim-form')}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#e51c23] hover:bg-[#c9181f] text-white text-sm font-bold transition-colors cursor-pointer rounded-none shadow-sm"
          >
            <Plus size={16} /> สร้างใบเคลม
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-3 pt-2 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab('claims')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'claims'
                ? 'border-[#e51c23] text-[#e51c23]'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <FileText size={16} /> รายการใบเคลมทั้งหมด
            <span className={`px-2 py-0.5 text-xs rounded-full ${
              activeTab === 'claims' ? 'bg-red-50 text-[#e51c23] font-bold' : 'bg-gray-100 text-gray-600'
            }`}>
              {rawClaims.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tracking')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'tracking'
                ? 'border-[#e51c23] text-[#e51c23]'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <Truck size={16} /> ติดตามสินค้าส่งเคลม
            <span className={`px-2 py-0.5 text-xs rounded-full ${
              activeTab === 'tracking' ? 'bg-red-50 text-[#e51c23] font-bold' : 'bg-gray-100 text-gray-600'
            }`}>
              {activeTrackingCount}
            </span>
          </button>
        </div>

        {activeTab === 'claims' ? (
          <>
            {/* 2. Stats row */}
            <div className="grid grid-cols-4 gap-4">
          <div className="bg-[#1C1B1B] text-white p-5 col-span-1 relative overflow-hidden">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">รายการทั้งหมด</p>
            <p className="text-4xl font-bold mt-1">{rawClaims.length}</p>
            <p className="text-xs text-gray-500 mt-1">ใบเคลม</p>
            <div className="absolute right-3 bottom-3 opacity-5 pointer-events-none">
              <History className="w-16 h-16" />
            </div>
          </div>
          <div className="bg-white border border-gray-200 border-l-[4px] border-l-amber-400 p-5 shadow-sm">
            <p className="text-xs text-[#5F5E5E] font-medium uppercase tracking-wider">รอดำเนินการ</p>
            <p className="text-3xl font-bold mt-1 text-[#1C1B1B]">{pendingCount}</p>
            <p className="text-xs text-[#5F5E5E] mt-1">รายการ</p>
          </div>
          <div className="bg-white border border-gray-200 border-l-[4px] border-l-[#259b24] p-5 shadow-sm">
            <p className="text-xs text-[#5F5E5E] font-medium uppercase tracking-wider">อนุมัติแล้ว</p>
            <p className="text-3xl font-bold mt-1 text-[#259b24]">{approvedCount}</p>
            <p className="text-xs text-[#5F5E5E] mt-1">รายการ</p>
          </div>
          <div className="bg-white border border-gray-200 border-l-[4px] border-l-[#e51c23] p-5 shadow-sm">
            <p className="text-xs text-[#5F5E5E] font-medium uppercase tracking-wider">ปฏิเสธ</p>
            <p className="text-3xl font-bold mt-1 text-[#e51c23]">{rejectedCount}</p>
            <p className="text-xs text-[#5F5E5E] mt-1">รายการ</p>
          </div>
        </div>

        {/* 3. Search & Filter Bar */}
        <div className="bg-white border border-gray-200 p-3.5 flex flex-col md:flex-row gap-3 items-center justify-between shadow-sm">
          <div className="flex flex-1 items-center gap-3 w-full">
            <div ref={searchRef} className="relative flex-1 max-w-md">
              <Input
                type="text"
                placeholder="ค้นหาเลขที่ใบเคลม, ชื่อลูกค้า, สินค้า..."
                value={claimSearch}
                onChange={e => { setClaimSearch(e.target.value); setShowSearchDrop(true); setCurrentPage(1); }}
                onFocus={() => setShowSearchDrop(true)}
                leftIcon={<Search size={15} className="text-gray-400" />}
                className="bg-gray-50/70 border-gray-200 text-sm h-10 w-full focus:bg-white"
              />
              {showSearchDrop && searchDropResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 shadow-xl mt-1 max-h-72 overflow-y-auto">
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
                        className="w-full text-left px-4 py-2.5 hover:bg-red-50/40 border-b border-gray-100 last:border-0 cursor-pointer transition-colors"
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
                        <p className="text-xs text-[#5F5E5E] font-semibold mt-0.5 truncate">{name}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => { setStatusFilter(''); setCurrentPage(1); }}
                className={`px-3 h-10 text-xs font-bold transition-colors cursor-pointer rounded-none border ${
                  statusFilter === ''
                    ? 'bg-[#1C1B1B] text-white border-[#1C1B1B]'
                    : 'bg-white text-[#1C1B1B] border-gray-200 hover:bg-gray-50'
                }`}
              >
                ทั้งหมด ({flatRows.length})
              </button>
              <button
                type="button"
                onClick={() => { setStatusFilter('PENDING'); setCurrentPage(1); }}
                className={`px-3 h-10 text-xs font-bold transition-colors cursor-pointer rounded-none border ${
                  statusFilter === 'PENDING'
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
                }`}
              >
                รอดำเนินการ ({pendingCount})
              </button>
              <button
                type="button"
                onClick={() => { setStatusFilter('APPROVED'); setCurrentPage(1); }}
                className={`px-3 h-10 text-xs font-bold transition-colors cursor-pointer rounded-none border ${
                  statusFilter === 'APPROVED'
                    ? 'bg-[#259b24] text-white border-[#259b24]'
                    : 'bg-white text-[#259b24] border-[#259b24]/30 hover:bg-[#259b24]/10'
                }`}
              >
                อนุมัติแล้ว ({approvedCount})
              </button>
              <button
                type="button"
                onClick={() => { setStatusFilter('REJECTED'); setCurrentPage(1); }}
                className={`px-3 h-10 text-xs font-bold transition-colors cursor-pointer rounded-none border ${
                  statusFilter === 'REJECTED'
                    ? 'bg-[#e51c23] text-white border-[#e51c23]'
                    : 'bg-white text-[#e51c23] border-red-200 hover:bg-red-50'
                }`}
              >
                ปฏิเสธ ({rejectedCount})
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center justify-center gap-2 px-4 h-10 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm font-semibold cursor-pointer transition-colors rounded-none shrink-0"
          >
            <Printer size={15} className="text-gray-500" />
            <span>พิมพ์ใบเช็คลิสต์เคลม</span>
          </button>
        </div>

        {/* 4. Table */}
        <div className="bg-white border border-gray-200 overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow className="border-b border-gray-200">
                <TableHead className="pl-6 w-44 text-[10px] font-bold text-gray-500 uppercase tracking-widest py-3">เลขที่ใบเคลม / วันที่</TableHead>
                <TableHead className="w-40 text-[10px] font-bold text-gray-500 uppercase tracking-widest py-3">ลูกค้า</TableHead>
                <TableHead className="text-[10px] font-bold text-gray-500 uppercase tracking-widest py-3">สินค้า</TableHead>
                <TableHead className="w-32 text-[10px] font-bold text-gray-500 uppercase tracking-widest py-3">ประเภทเคลม</TableHead>
                <TableHead className="text-center w-20 text-[10px] font-bold text-gray-500 uppercase tracking-widest py-3">จำนวน</TableHead>
                <TableHead className="w-48 text-[10px] font-bold text-gray-500 uppercase tracking-widest py-3">สาเหตุ</TableHead>
                <TableHead className="text-center w-32 text-[10px] font-bold text-gray-500 uppercase tracking-widest py-3">สถานะ</TableHead>
                <TableHead className="text-center pr-6 w-28 text-[10px] font-bold text-gray-500 uppercase tracking-widest py-3">จัดการ</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 size={22} className="animate-spin text-[#e51c23]" />
                      <span className="text-sm text-gray-400">กำลังโหลดข้อมูล...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2">
                      <FileText size={28} className="text-gray-200" />
                      <span className="text-sm text-gray-400 font-medium">ไม่พบข้อมูลรายการเคลมสินค้า</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRows.map((row, idx) => (
                  <TableRow
                    key={`${row.claimId}-${row.itemId}-${idx}`}
                    className={cn(
                      'transition-colors',
                      row.isFirst
                        ? 'bg-white hover:bg-red-50/20 border-t-2 border-gray-100 cursor-pointer'
                        : 'bg-gray-50/30 border-t border-gray-100'
                    )}
                    onClick={row.isFirst ? () => navigate(`${basePath}/detail/${row.claimId}`) : undefined}
                  >
                    <TableCell className="pl-6 py-3">
                      {row.isFirst ? (
                        <div>
                          <p className="font-bold text-[#e51c23] font-mono text-sm">{row.claimNo}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {new Date(row.claimDate).toLocaleDateString('th-TH', {
                              year: 'numeric', month: 'short', day: 'numeric',
                            })}
                          </p>
                        </div>
                      ) : (
                        <span className="text-gray-200 text-xs pl-2">└</span>
                      )}
                    </TableCell>

                    <TableCell className="py-3">
                      {row.isFirst ? (
                        <div>
                          <p className="font-semibold text-[#1C1B1B] text-sm">{row.customerName}</p>
                          {row.customerPhone !== '-' && (
                            <p className="text-[11px] text-gray-400 mt-0.5">{row.customerPhone}</p>
                          )}
                        </div>
                      ) : null}
                    </TableCell>

                    <TableCell className="py-3">
                      <p className="font-semibold text-[#1C1B1B] text-sm">{row.productName}</p>
                      {row.resolution && row.resolution !== 'รอการตรวจสอบ' && row.resolution !== '-' && (
                        <p className="text-[11px] text-[#259b24] mt-0.5">{row.resolution}</p>
                      )}
                    </TableCell>

                    <TableCell className="py-3">
                      <TypeBadge type={row.itemClaimType} />
                    </TableCell>

                    <TableCell className="text-center py-3">
                      <span className="font-bold text-[#1C1B1B] text-sm">{row.qty}</span>
                      <span className="text-[11px] text-gray-400 ml-1">ชิ้น</span>
                    </TableCell>

                    <TableCell className="py-3">
                      <p className="text-[#5F5E5E] text-sm truncate max-w-[180px]" title={row.reason}>
                        {row.reason || <span className="text-gray-300">—</span>}
                      </p>
                    </TableCell>

                    <TableCell className="text-center py-3">
                      <StatusBadge status={row.itemStatus} />
                    </TableCell>

                    <TableCell className="text-center pr-6 py-3" onClick={e => e.stopPropagation()}>
                      {row.isFirst && (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => navigate(`${basePath}/detail/${row.claimId}`)}
                            className="p-1.5 text-gray-400 hover:text-[#e51c23] hover:bg-red-50 rounded transition cursor-pointer"
                            title="ดูรายละเอียด"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => navigate(`${basePath}/edit/${row.claimId}`)}
                            className="p-1.5 text-gray-400 hover:text-[#1C1B1B] hover:bg-gray-100 rounded transition cursor-pointer"
                            title="แก้ไขใบเคลม"
                          >
                            <SquarePen className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClaim(row.claimId)}
                            className="p-1.5 text-gray-300 hover:text-[#e51c23] hover:bg-red-50 rounded transition cursor-pointer"
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
            <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
              <div className="flex items-center gap-3">
                <span>
                  แสดง {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)}–{Math.min(currentPage * itemsPerPage, totalItems)} จาก {totalItems} รายการ
                </span>
                <div className="flex items-center gap-1.5">
                  <span>แสดง:</span>
                  <select
                    value={itemsPerPage}
                    onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                    className="border border-gray-200 rounded px-1.5 py-0.5 text-gray-600 bg-white focus:outline-none cursor-pointer"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-0.5">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                  className="p-1.5 rounded text-gray-400 hover:bg-gray-200 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="p-1.5 rounded text-gray-400 hover:bg-gray-200 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                {getPageNumbers(currentPage, totalPages).map((page, idx) =>
                  page === "..." ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-gray-300">...</span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={cn(
                        "px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer",
                        currentPage === page ? "bg-[#e51c23] text-white" : "text-gray-500 hover:bg-gray-200"
                      )}
                    >
                      {page}
                    </button>
                  )
                )}

                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="p-1.5 rounded text-gray-400 hover:bg-gray-200 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  className="p-1.5 rounded text-gray-400 hover:bg-gray-200 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
          </>
        ) : (
          <ClaimTrackingTab
            rawClaims={rawClaims}
            loading={loading}
            basePath={basePath}
            onUpdateStage={handleUpdateTrackingStage}
            updatingItemId={updatingItemId}
          />
        )}

        {/* Printable Area for PDF / Paper Printing */}
        <style>{`
          @media print {
            @page {
              size: A4 portrait;
              margin: 12mm 10mm;
            }
            body * { visibility: hidden; }
            #printable-claim-checklist, #printable-claim-checklist * { visibility: visible; }
            #printable-claim-checklist {
              position: absolute; left: 0; top: 0; width: 100%; padding: 0;
              background: white; color: black; font-size: 12px;
            }
          }
        `}</style>

        {(() => {
          const approvedPrintRows = flatRows.filter(r => r.itemStatus === 'APPROVED' && (
            !claimSearch.trim() ||
            r.claimNo.toLowerCase().includes(claimSearch.toLowerCase().trim()) ||
            r.customerName.toLowerCase().includes(claimSearch.toLowerCase().trim()) ||
            r.customerPhone.includes(claimSearch.trim()) ||
            r.productName.toLowerCase().includes(claimSearch.toLowerCase().trim())
          ));

          return (
            <div id="printable-claim-checklist" className="hidden print:block font-sans text-slate-900 p-0">
              <div className="border-b-2 border-slate-800 pb-3 mb-4 flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-extrabold text-slate-900">AutoParts Retail Management</h1>
                  <h2 className="text-sm font-bold text-slate-700 mt-0.5">ใบรายงานเช็คลิสต์รายการเคลมสินค้า (เฉพาะรายการที่อนุมัติแล้ว)</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    สถานะ: อนุมัติแล้ว (APPROVED) | รวมทั้งหมด {approvedPrintRows.length} รายการ
                  </p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p className="font-bold text-slate-800">วันที่พิมพ์รายงาน</p>
                  <p>{new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>

              {approvedPrintRows.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm border border-slate-200">
                  ไม่พบรายการเคลมที่ได้รับการอนุมัติ
                </div>
              ) : (
                <table className="w-full border-collapse border border-slate-300 text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                      <th className="border border-slate-300 p-2 text-center w-10">ตรวจ</th>
                      <th className="border border-slate-300 p-2 text-left w-28">เลขใบเคลม / วันที่</th>
                      <th className="border border-slate-300 p-2 text-left w-36">ชื่อลูกค้า / เบอร์โทร</th>
                      <th className="border border-slate-300 p-2 text-left">รายการสินค้าอะไหล่</th>
                      <th className="border border-slate-300 p-2 text-center w-12">จำนวน</th>
                      <th className="border border-slate-300 p-2 text-left w-40">สาเหตุการขอเคลม</th>
                      <th className="border border-slate-300 p-2 text-center w-24">สถานะ</th>
                      <th className="border border-slate-300 p-2 text-left w-36">ผลการตรวจรับจริง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvedPrintRows.map((row, idx) => (
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
                        <td className="border border-slate-300 p-2 text-center font-bold text-[#259b24]">
                          อนุมัติแล้ว
                        </td>
                        <td className="border border-slate-300 p-2 text-slate-400"></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })()}
      </div>
    );
  }

  // ─── FORM VIEW ────────────────────────────────────────────────────────────────
  const isCreditEligible = Boolean(posCustomerCredit && posCustomerCredit.is_credit_enabled);

  return (
    <div className='p-8 space-y-6 bg-white min-h-screen'>
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

        </div>

        <div className="space-y-6">
          {/* Search Invoice — Top */}
          <Card className='border-l-[5px] border-l-[#1C1B1B] bg-white'>
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
                  className="bg-gray-50 border border-gray-300 hover:border-gray-400 focus:bg-white focus:border-black focus:ring-1 focus:ring-black transition-colors rounded-md"
                />
                {showInvoiceDrop && invoiceResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 shadow-lg rounded-none mt-1 max-h-72 overflow-y-auto">
                    {invoiceResults.map((order: any) => (
                      <button
                        key={order.id}
                        type="button"
                        onMouseDown={() => handleSelectOrder(order)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 cursor-pointer transition-colors"
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
                  <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 shadow-lg rounded-none mt-1 px-4 py-3 text-sm text-slate-500">
                    ไม่พบใบสั่งซื้อที่ตรงกับ &quot;{claimFormInvoice}&quot;
                  </div>
                )}
              </div>
            </CardContent>
          </Card>


          {/* Customer Info & Credit Section */}
          <Card title="ข้อมูลลูกค้าและรายละเอียดใบเคลม" subtitle="โหลดจากใบสั่งซื้อที่เลือก" className="w-full bg-white border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-2">
              <Input label="ชื่อ" type="text" value={claimCustomerName} disabled className="bg-gray-50 border border-gray-200" />
              <Input label="นามสกุล" type="text" value={claimCustomerSurname} disabled className="bg-gray-50 border border-gray-200" />
              <Input label="เบอร์โทรศัพท์" type="text" value={claimCustomerPhone} disabled className="bg-gray-50 border border-gray-200" />
              <Input
                label="วันที่เคลม"
                type="date"
                value={claimDate}
                onChange={(e) => setClaimDate(e.target.value)}
                className="bg-white border border-gray-200"
              />
            </div>

            {/* Credit Info inside Customer Info */}
            {claimCustomerPhone && claimCustomerPhone !== '-' && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="mb-3">
                  <span className="text-xs font-bold text-slate-800">ข้อมูลวงเงินและสถานะสินเชื่อ</span>
                </div>

                {loadingPosCredit ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Loader2 size={14} className="animate-spin text-[#e51c23]" /> กำลังตรวจสอบข้อมูลวงเงินเชื่อ...
                  </div>
                ) : posCustomerCredit ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs bg-gray-50/60 p-3 border border-gray-100">
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
                      <p className="font-bold text-[#259b24]">
                        ฿{Math.max(0, (posCustomerCredit.max_credit_limit || 0) - (posCustomerCredit.current_debt_amount || 0)).toLocaleString('th-TH')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 font-medium">
                    ไม่พบข้อมูลบัญชีเชื่อสำหรับเบอร์โทรนี้
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* Section: เลือกสินค้าที่ต้องการเคลม */}
          {(() => {
            const selectedClaimItems = claimItems.filter(i => i.claim_qty > 0);
            const totalClaimQuantity = selectedClaimItems.reduce((sum, i) => sum + i.claim_qty, 0);
            const totalClaimEstimatedAmount = selectedClaimItems.reduce((sum, i) => sum + (i.claim_qty * (i.price || 0)), 0);

            return (
              <Card noPadding className="w-full overflow-hidden border border-gray-200 shadow-xs bg-white">
                {/* Card Header */}
                <div className="p-5 bg-white border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <Heading level="h2" className="m-0 text-base font-bold text-[#1C1B1B]">
                      เลือกสินค้าที่ต้องการเคลม
                    </Heading>
                    <p className="text-xs text-[#5F5E5E] mt-1">
                      ระบุจำนวนสินค้าที่ต้องการเคลมและสาเหตุการเคลมให้ครบถ้วน
                    </p>
                  </div>


                </div>

                <input
                  ref={itemEvidenceRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleItemEvidenceSelect}
                />

                {claimItems.length > 0 ? (
                  <>
                    <div className="overflow-x-auto bg-white">
                      <Table>
                        <TableHeader className="bg-white border-b border-gray-200 text-[#5F5E5E]">
                          <TableRow>
                            <TableHead className="min-w-[220px] pl-6">รายการสินค้า</TableHead>
                            <TableHead className="text-center w-24">ซื้อมา</TableHead>
                            <TableHead className="text-center w-36">จำนวนที่เคลม</TableHead>
                            <TableHead className="w-48">ประเภทการเคลม</TableHead>
                            <TableHead className="min-w-[200px]">สาเหตุที่เคลม</TableHead>
                            <TableHead className="text-center w-28 pr-6">หลักฐานรูปภาพ</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-gray-100 bg-white">
                          {claimItems.map((item, idx) => {
                            const isSelected = item.claim_qty > 0;
                            const hasReason = item.reason.trim().length > 0;

                            return (
                              <TableRow
                                key={idx}
                                className="transition-colors bg-white hover:bg-gray-50/70"
                              >
                                {/* Product Details */}
                                <TableCell className="py-3.5 pl-6">
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-sm text-[#1C1B1B]">
                                      {item.product_name}
                                    </span>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                      {item.price > 0 && (
                                        <span className="font-medium text-gray-600">
                                          ราคาต่อหน่วย: ฿{item.price.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>

                                {/* Sold Qty */}
                                <TableCell className="text-center">
                                  <span className="inline-block px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded">
                                    {item.sold_qty} ชิ้น
                                  </span>
                                </TableCell>

                                {/* Claim Qty Stepper & Input */}
                                <TableCell className="text-center">
                                  <div className="inline-flex items-center border border-gray-300 bg-white">
                                    <button
                                      type="button"
                                      onClick={() => handleClaimItemQtyChange(idx, -1)}
                                      disabled={item.claim_qty <= 0}
                                      className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent text-gray-600 transition-colors cursor-pointer"
                                      title="ลดจำนวน"
                                    >
                                      <Minus size={13} />
                                    </button>
                                    <input
                                      type="number"
                                      min={0}
                                      max={item.sold_qty}
                                      value={item.claim_qty}
                                      onChange={(e) => handleDirectClaimItemQty(idx, parseInt(e.target.value, 10))}
                                      className="w-12 h-8 text-center text-xs font-bold border-x border-gray-300 focus:outline-none bg-white text-[#e51c23] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleClaimItemQtyChange(idx, 1)}
                                      disabled={item.claim_qty >= item.sold_qty}
                                      className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent text-gray-600 transition-colors cursor-pointer"
                                      title="เพิ่มจำนวน"
                                    >
                                      <Plus size={13} />
                                    </button>
                                  </div>
                                </TableCell>

                                {/* Claim Type */}
                                <TableCell>
                                  {canApprove ? (
                                    <select
                                      value={item.claim_type || claimType}
                                      onChange={(e) => {
                                        const val = e.target.value as 'INSTANT' | 'SUPPLIER_PENDING' | 'CREDIT_ACCOUNT';
                                        if (val === 'CREDIT_ACCOUNT' && !isCreditEligible) {
                                          alert('ลูกค้าท่านนี้ไม่มีสิทธิ์ใช้วงเงินสินเชื่อ/เงินเชื่อ');
                                          return;
                                        }
                                        setClaimItems(prev => prev.map((it, i) => i === idx ? { ...it, claim_type: val } : it));
                                      }}
                                      className="w-full border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:border-[#e51c23] bg-white font-medium text-gray-800 cursor-pointer"
                                    >
                                      <option value="INSTANT">เปลี่ยนทันที</option>
                                      <option value="SUPPLIER_PENDING">ฝากส่งบริษัทตรวจ</option>
                                      <option value="CREDIT_ACCOUNT">ลงบัญชีเชื่อ</option>
                                    </select>
                                  ) : (
                                    <span className="px-2.5 py-1 text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200 inline-block">
                                      รอเจ้าของร้านพิจารณา
                                    </span>
                                  )}
                                </TableCell>

                                {/* Reason */}
                                <TableCell>
                                  <div className="relative">
                                    <input
                                      type="text"
                                      value={item.reason}
                                      onChange={e => handleClaimItemReasonChange(idx, e.target.value)}
                                      placeholder="ระบุอาการเสีย / สาเหตุการเคลม..."
                                      className={`w-full border px-3 py-2 text-xs focus:outline-none focus:border-[#e51c23] bg-white text-gray-800 ${
                                        isSelected && !hasReason
                                          ? 'border-amber-400 bg-amber-50/20 placeholder:text-amber-600/70'
                                          : 'border-gray-300'
                                      }`}
                                    />
                                    {isSelected && !hasReason && (
                                      <span className="block text-[10px] text-amber-600 mt-1 font-medium">
                                        * จำเป็นต้องระบุสาเหตุ
                                      </span>
                                    )}
                                  </div>
                                </TableCell>

                                {/* Evidence Photo */}
                                <TableCell className="text-center pr-6">
                                  {item.evidencePreview ? (
                                    <div className="relative inline-block group">
                                      <img
                                        src={item.evidencePreview}
                                        alt="หลักฐาน"
                                        className="w-10 h-10 object-cover border border-gray-200 shadow-xs cursor-pointer"
                                        onClick={() => handleItemEvidenceClick(idx)}
                                        title="คลิกเพื่อเปลี่ยนรูปภาพ"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveItemEvidence(idx)}
                                        className="absolute -top-2 -right-2 w-5 h-5 bg-[#e51c23] hover:bg-[#c9181f] text-white flex items-center justify-center rounded-full shadow-sm cursor-pointer transition-transform group-hover:scale-110"
                                        title="ลบรูปภาพหลักฐาน"
                                      >
                                        <X size={10} />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleItemEvidenceClick(idx)}
                                      className="px-3 py-1.5 text-xs inline-flex items-center gap-1.5 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 shadow-2xs transition-colors cursor-pointer"
                                      title="แนบรูปภาพหลักฐาน"
                                    >
                                      <Camera size={14} className="text-gray-500" />
                                      <span>แนบรูป</span>
                                    </button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Card Footer Summary */}
                    <div className="p-4 bg-white border-t border-gray-200 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-6 text-xs text-gray-600">
                        <div>
                          <span>จำนวนชิ้นรวม: </span>
                          <span className="font-bold text-[#1C1B1B]">{totalClaimQuantity} ชิ้น</span>
                        </div>
                        {totalClaimEstimatedAmount > 0 && (
                          <div>
                            <span>มูลค่ารวม: </span>
                            <span className="font-bold text-[#e51c23]">
                              ฿{totalClaimEstimatedAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                      </div>

                      {selectedClaimItems.some(i => !i.reason.trim()) && (
                        <span className="text-xs text-amber-600 font-medium">
                          * มีรายการที่ยังไม่ได้ระบุสาเหตุการเคลม
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center px-4 bg-white">
                    <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-[#e51c23] mb-3">
                      <FileText className="w-8 h-8" />
                    </div>
                    <Heading level="h3" className="text-sm font-bold text-gray-800 m-0">
                      ยังไม่มีรายการสินค้าสำหรับเคลม
                    </Heading>
                    <p className="text-xs text-gray-500 mt-1 max-w-sm">
                      กรุณาค้นหาและเลือกเลขที่ใบสั่งซื้อ ในกล่อง &quot;ค้นหาใบสั่งซื้อ&quot; ด้านบนเพื่อโหลดรายการสินค้าที่ซื้อ
                    </p>
                  </div>
                )}
              </Card>
            );
          })()}
        </div>

        {/* Submit Actions */}
        <div className='flex items-center justify-end gap-3 mt-8'>
          <Button
            type="button"
            variant="outline"
            size='lg'
            onClick={() => { setView('list'); resetClaimForm(); }}
            disabled={saving}
            className="w-full sm:w-auto px-6 text-gray-600 border-gray-300 hover:bg-gray-50"
          >
            ยกเลิก
          </Button>
          <Button
            type="submit"
            size='lg'
            disabled={saving}
            className="w-full sm:w-auto px-8"
          >
            {saving && <Loader2 size={18} className="animate-spin mr-2" />}
            {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
          </Button>
        </div>
      </form>


      {/* Printable Checklist for Claims List Page (Only Approved Items) */}
      <div className="hidden print:block font-sans text-slate-900 p-0">
        <style>{`
          @media print {
            @page {
              size: A4 portrait;
              margin: 12mm 10mm;
            }
            body * { visibility: hidden; }
            #printable-claims-checklist, #printable-claims-checklist * { visibility: visible; }
            #printable-claims-checklist {
              position: absolute; left: 0; top: 0; width: 100%; padding: 0;
              background: white; color: black; font-size: 12px;
            }
          }
        `}</style>
        <div id="printable-claims-checklist">
          <div className="border-b-2 border-slate-800 pb-3 mb-4 flex justify-between items-start">
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">AutoParts Retail Management</h1>
              <h2 className="text-sm font-bold text-slate-700 mt-0.5">ใบเช็คลิสต์รายการสินค้าที่อนุมัติให้เคลม</h2>
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
                    <td className="border border-slate-300 p-2 text-center font-bold text-[#259b24]">อนุมัติเคลมแล้ว</td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
