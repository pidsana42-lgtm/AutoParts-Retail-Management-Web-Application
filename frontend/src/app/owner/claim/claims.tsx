import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Plus, Minus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Trash2, FileText, Loader2, Camera, X, Printer, SquarePen, Truck, CirclePlus, Check, ReceiptText, PenLine } from 'lucide-react';
import ClaimTrackingTab from './claim_tracking_tab';
import Heading from '../../../components/elements/heading';
import Card, { CardHeader, CardTitle, CardContent } from '../../../components/elements/card';
import Input from '../../../components/elements/input';
import Button from '../../../components/elements/button';
import Badge from '../../../components/elements/badge';
import Select from '../../../components/elements/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/elements/table';
import { getCustomerClaims, searchSaleOrders, deleteCustomerClaim, searchCustomerCreditByPhone, generateCustomerClaimPDF, exportCustomerClaimChecklistPDF } from '../../../service/http/claim/claim';
import type { CustomerDiscountResponse } from '../../../interface/pos/customer_interface';
import apiClient from '../../../service/http/apiClient';
import type { CustomerClaim, ClaimFormProduct, FlatRow, ClaimsPageProps, ClaimType, TrackingFilter } from '../../../interface/claim/claim';
import { cn } from '../../../utils/component';
import { useNotification } from '../../../contexts/NotificationContext';
import { useToast } from '../../../components/elements/toast';

const parseNote = (note: string | undefined, key: string): string => {
  if (!note) return '-';
  const match = note.match(new RegExp(`${key}:\\s*([^|]+)`));
  return match ? match[1].trim() : '-';
};

const parseDateSafe = (d?: string) => {
  if (!d) return 0;
  const t = new Date(d).getTime();
  return isNaN(t) ? 0 : t;
};

const toFlatRows = (claims: CustomerClaim[]): FlatRow[] => {
  const sorted = [...claims].sort((a, b) => {
    const timeA = parseDateSafe(a.claim_date);
    const timeB = parseDateSafe(b.claim_date);
    if (timeB !== timeA) return timeB - timeA;
    return (b.id ?? 0) - (a.id ?? 0);
  });
  const rows: FlatRow[] = [];
  for (const claim of sorted) {
    const items = claim.items ?? [];
    const noteText = claim.notes || claim.note;
    const customerName =
      claim.customer_name && claim.customer_name !== '-'
        ? claim.customer_name
        : parseNote(noteText, 'ลูกค้า');
    const customerPhone = parseNote(noteText, 'โทร');
    const typeFromNote = parseNote(noteText, 'ประเภทเคลม');

    const claimType: ClaimType =
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
        const itemClaimType: ClaimType =
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

function TypeBadge({ type }: { type: ClaimType }) {
  if (type === 'SUPPLIER_PENDING')
    return <Badge variant="neutral" size="md">ส่งบริษัทตรวจ</Badge>;
  if (type === 'CREDIT_ACCOUNT')
    return <Badge variant="credit" size="md">ลงบัญชีเชื่อ</Badge>;
  return <Badge variant="primary" size="md">เปลี่ยนทันที</Badge>;
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

export default function ClaimsPage({ canApprove = true }: ClaimsPageProps): React.JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const { addNotification } = useNotification();
  const { toast } = useToast();
  const basePath = canApprove ? '/owner/claims' : '/employee/claims';
  const pageParams = new URLSearchParams(location.search);
  const view: 'list' | 'claim-form' = pageParams.get('view') === 'new' ? 'claim-form' : 'list';
  const activeTab: 'claims' | 'tracking' = pageParams.get('tab') === 'tracking' ? 'tracking' : 'claims';
  const [claimSearch, setClaimSearch] = useState('');
  const [showSearchDrop, setShowSearchDrop] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [rawClaims, setRawClaims] = useState<CustomerClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Tracking state
  const [updatingItemId, setUpdatingItemId] = useState<number | null>(null);
  const [trackingSearch, setTrackingSearch] = useState('');
  const [trackingFilter, setTrackingFilter] = useState<TrackingFilter>('ALL');

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
      toast({ variant: 'success', message: 'อัปเดตขั้นตอนการเคลมเรียบร้อยแล้ว' });
    } catch (err: any) {
      console.error('Failed to update tracking stage:', err);
      const serverMsg = err?.response?.data?.error;
      toast({
        variant: 'error',
        message: serverMsg || 'เกิดข้อผิดพลาดในการอัปเดตขั้นตอน กรุณาลองใหม่',
      });
    } finally {
      setUpdatingItemId(null);
    }
  };

  const [claimType, setClaimType] = useState<ClaimType>('INSTANT');
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
      const sorted = [...(data || [])].sort((a, b) => {
        const timeA = parseDateSafe(a.claim_date);
        const timeB = parseDateSafe(b.claim_date);
        if (timeB !== timeA) return timeB - timeA;
        return (b.id ?? 0) - (a.id ?? 0);
      });
      setRawClaims(sorted);
    } catch (err) {
      console.error('Failed to load claims:', err);
      toast({ variant: 'error', message: 'ไม่สามารถโหลดรายการเคลมได้' });
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
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'warning', message: 'ไฟล์ใหญ่เกินไป (สูงสุด 5MB)' });
      return;
    }
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
      toast({ variant: 'warning', message: 'กรุณาค้นหาใบเสร็จเพื่อโหลดข้อมูลลูกค้าก่อน' });
      return;
    }
    const selected = claimItems.filter(i => i.claim_qty > 0);
    if (selected.length === 0) {
      toast({ variant: 'warning', message: 'กรุณาเลือกจำนวนสินค้าที่ต้องการเคลมอย่างน้อย 1 ชิ้น' });
      return;
    }
    const missing = selected.find(p => !p.reason.trim());
    if (missing) {
      toast({ variant: 'warning', message: `กรุณาระบุสาเหตุที่เคลมสำหรับ "${missing.product_name}"` });
      return;
    }

    const isCreditEligible = Boolean(posCustomerCredit && posCustomerCredit.is_credit_enabled);
    const hasCreditAccountItem = selected.some(p => (p.claim_type || claimType) === 'CREDIT_ACCOUNT');
    if (hasCreditAccountItem && !isCreditEligible) {
      toast({
        variant: 'warning',
        message: 'ลูกค้าท่านนี้ไม่มีสิทธิ์ใช้วงเงินสินเชื่อ/เงินเชื่อ กรุณาเปลี่ยนประเภทการเคลมเป็น "เปลี่ยนทันที" หรือ "ฝากส่งบริษัทตรวจ"',
      });
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
      navigate(basePath, { replace: true });
      resetClaimForm();
      addNotification('สร้างใบเคลมสำเร็จ', `ใบเคลมของคุณถูกบันทึกในระบบเรียบร้อยแล้ว`, 'success');
      toast({ variant: 'success', message: 'สร้างใบเคลมเรียบร้อยแล้ว' });
    } catch (err) {
      console.error('Failed to create claim:', err);
      toast({ variant: 'error', message: 'เกิดข้อผิดพลาดในการบันทึกใบเคลม กรุณาลองใหม่อีกครั้ง' });
    } finally {
      setSaving(false);
    }
  };

  const [downloadingClaimId, setDownloadingClaimId] = useState<number | null>(null);

  const handleDownloadPDF = async (claimId: number, claimNoStr?: string) => {
    setDownloadingClaimId(claimId);
    try {
      const blob = await generateCustomerClaimPDF(claimId);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      const fileNameId = claimNoStr || `CLM-${claimId}`;
      a.download = `${fileNameId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        variant: 'success',
        title: 'ดาวน์โหลดสำเร็จ',
        message: `ดาวน์โหลดไฟล์ PDF ใบรับเคลม ${fileNameId} เรียบร้อยแล้ว`,
      });
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'ดาวน์โหลดไม่สำเร็จ',
        message: 'ไม่สามารถสร้างไฟล์ PDF ใบรับเคลมได้: ' + (err.message || err),
      });
    } finally {
      setDownloadingClaimId(null);
    }
  };

  const [downloadingChecklist, setDownloadingChecklist] = useState(false);

  const handleDownloadChecklistPDF = async () => {
    setDownloadingChecklist(true);
    try {
      const activeSearch = activeTab === 'claims' ? claimSearch : trackingSearch;
      const activeStatus = activeTab === 'claims' ? statusFilter : (trackingFilter === 'ALL' ? '' : trackingFilter);
      const blob = await exportCustomerClaimChecklistPDF(activeStatus, activeSearch);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
      a.download = `Claim_Checklist_${dateStr}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        variant: 'success',
        title: 'ดาวน์โหลดสำเร็จ',
        message: 'ดาวน์โหลดไฟล์ PDF ใบเช็คลิสต์เคลมเรียบร้อยแล้ว',
      });
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'ดาวน์โหลดไม่สำเร็จ',
        message: 'ไม่สามารถสร้างไฟล์ PDF ใบเช็คลิสต์ได้: ' + (err.message || err),
      });
    } finally {
      setDownloadingChecklist(false);
    }
  };

  const handleDeleteClaim = async (claimId: number) => {
    if (!window.confirm('ยืนยันการลบใบเคลมนี้?')) return;
    try {
      await deleteCustomerClaim(claimId);
      setRawClaims(prev => prev.filter(c => c.id !== claimId));
      toast({ variant: 'success', message: 'ลบใบเคลมเรียบร้อยแล้ว' });
    } catch (err) {
      console.error('Failed to delete claim:', err);
      toast({ variant: 'error', message: 'เกิดข้อผิดพลาดในการลบ กรุณาลองใหม่' });
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

  // ─── LIST VIEW ────────────────────────────────────────────────────────────────
  if (view === 'list') {
    const pendingCount = flatRows.filter(r => r.itemStatus === 'PENDING').length;
    const approvedCount = flatRows.filter(r => r.itemStatus === 'APPROVED').length;
    const rejectedCount = flatRows.filter(r => r.itemStatus === 'REJECTED').length;

    // Tracking counts (same logic as ClaimTrackingTab)
    const allTrackingItems = rawClaims.flatMap(claim =>
      (claim.items ?? []).map(item => {
        const resolution = (item.resolution || '').trim();
        let stage: 'WAITING_SEND' | 'SENT_TO_SUPPLIER' | 'REPLACEMENT_RECEIVED' | 'COMPLETED' = 'WAITING_SEND';
        if (resolution === 'COMPLETED' || resolution.includes('ส่งมอบ') || resolution.includes('สำเร็จ')) {
          stage = 'COMPLETED';
        } else if (resolution === 'REPLACEMENT_RECEIVED' || resolution.includes('ได้รับของ') || resolution.includes('รับสินค้าทดแทน')) {
          stage = 'REPLACEMENT_RECEIVED';
        } else if (resolution === 'SENT_TO_SUPPLIER' || resolution.includes('ส่งบริษัท') || resolution.includes('ส่งโรงงาน')) {
          stage = 'SENT_TO_SUPPLIER';
        }
        return { stage, itemStatus: (item.status ?? 'PENDING').toUpperCase() };
      })
    );
    const trackingTotalCount = allTrackingItems.filter(i => i.itemStatus !== 'REJECTED').length;
    const trackingWaitingCount = allTrackingItems.filter(i => i.stage === 'WAITING_SEND' && i.itemStatus !== 'REJECTED').length;
    const trackingSentCount = allTrackingItems.filter(i => i.stage === 'SENT_TO_SUPPLIER').length;
    const trackingCompletedCount = allTrackingItems.filter(i => i.stage === 'COMPLETED').length;

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

    return (
      <div className="p-8 space-y-6 bg-white min-h-screen font-sans">

        {/* 1. Header */}
        <div className="flex items-center justify-between">
          <Heading level="h1" weight="semibold" className="m-0 text-[#1C1B1B]">
            จัดการเคลมสินค้า
          </Heading>
          <Button
            leftIcon={<CirclePlus size={20} />}
            size="md"
            onClick={() => navigate(`${basePath}?view=new`)}
          >
            สร้างใบเคลม
          </Button>
        </div>

        {/* 2. Summary Cards — changes based on active tab */}
        {activeTab === 'claims' ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-[#1C1B1B] border-none text-white p-5 col-span-1 relative overflow-hidden flex flex-col justify-between">
              <Heading level="h6" className="text-xs text-gray-400 font-normal uppercase tracking-wider">
                รายการสินค้าเคลมทั้งหมด
              </Heading>
              <Heading level="h2" className="font-bold text-white">{flatRows.length}</Heading>
              <Heading level="p" className="text-slate-400">รายการ</Heading>
            </Card>
            <Card className="border-l-[5px] border-l-amber-400 flex flex-col justify-between p-5">
              <Heading level="h6">รอดำเนินการ</Heading>
              <Heading level="h2" className="font-bold text-black">{pendingCount}</Heading>
              <Heading level="p">รายการ</Heading>
            </Card>
            <Card className="border-l-[5px] border-l-emerald-500 flex flex-col justify-between p-5">
              <Heading level="h6">อนุมัติแล้ว</Heading>
              <Heading level="h2" className="font-bold text-black">{approvedCount}</Heading>
              <Heading level="p">รายการ</Heading>
            </Card>
            <Card className="border-l-[5px] border-l-red-600 flex flex-col justify-between p-5">
              <Heading level="h6">ปฏิเสธ</Heading>
              <Heading level="h2" className="font-bold text-black">{rejectedCount}</Heading>
              <Heading level="p">รายการ</Heading>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-[#1C1B1B] border-none text-white p-5 col-span-1 relative overflow-hidden flex flex-col justify-between">
              <Heading level="h6" className="text-xs text-gray-400 font-normal uppercase tracking-wider">
                รายการส่งเคลมทั้งหมด
              </Heading>
              <Heading level="h2" className="font-bold text-white">{trackingTotalCount}</Heading>
              <Heading level="p" className="text-slate-400">รายการ</Heading>
            </Card>
            <Card className="border-l-[5px] border-l-amber-400 flex flex-col justify-between p-5">
              <Heading level="h6">รอรวบรวมส่งบริษัท</Heading>
              <Heading level="h2" className="font-bold text-black">{trackingWaitingCount}</Heading>
              <Heading level="p">รายการ</Heading>
            </Card>
            <Card className="border-l-[5px] border-l-sky-500 flex flex-col justify-between p-5">
              <Heading level="h6">ส่งบริษัทแล้ว</Heading>
              <Heading level="h2" className="font-bold text-black">{trackingSentCount}</Heading>
              <Heading level="p">รายการ</Heading>
            </Card>
            <Card className="border-l-[5px] border-l-emerald-500 flex flex-col justify-between p-5">
              <Heading level="h6">เคลมสำเร็จแล้ว</Heading>
              <Heading level="h2" className="font-bold text-black">{trackingCompletedCount}</Heading>
              <Heading level="p">รายการ</Heading>
            </Card>
          </div>
        )}

        {/* 3. Search + Filter Bar — ทั้ง 2 tab */}
        <div className="p-3.5 flex flex-col md:flex-row gap-3 items-center justify-between shadow-sm">
          <div className="flex flex-1 items-center gap-3 w-full">
            <div ref={searchRef} className="relative flex-1 min-w-60">
              <Input
                type="text"
                placeholder={activeTab === 'claims' ? 'ค้นหาเลขที่ใบเคลม, ชื่อลูกค้า, สินค้า...' : 'ค้นหาเลขใบเคลม, ชื่อลูกค้า, สินค้า...'}
                value={activeTab === 'claims' ? claimSearch : trackingSearch}
                onChange={e => {
                  if (activeTab === 'claims') {
                    setClaimSearch(e.target.value);
                    setShowSearchDrop(true);
                    setCurrentPage(1);
                  } else {
                    setTrackingSearch(e.target.value);
                  }
                }}
                onFocus={() => activeTab === 'claims' && setShowSearchDrop(true)}
                leftIcon={<Search size={15} className="text-gray-400" />}
                className="text-sm h-10 w-full"
              />
              {activeTab === 'claims' && showSearchDrop && searchDropResults.length > 0 && (
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
          </div>

          <div className="w-full md:w-60 shrink-0">
            {activeTab === 'claims' ? (
              <Select
                placeholder="สถานะทั้งหมด"
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                options={[
                  { label: 'ทั้งหมด', value: '' },
                  { label: 'รอดำเนินการ', value: 'PENDING' },
                  { label: 'อนุมัติแล้ว', value: 'APPROVED' },
                  { label: 'ปฏิเสธ', value: 'REJECTED' },
                ]}
              />
            ) : (
              <Select
                placeholder="สถานะการติดตาม"
                value={trackingFilter}
                onChange={e => setTrackingFilter(e.target.value as typeof trackingFilter)}
                options={[
                  { label: 'ทั้งหมด', value: 'ALL' },
                  { label: 'รอรวบรวมส่งบริษัท', value: 'WAITING_SEND' },
                  { label: 'ส่งบริษัทแล้ว', value: 'SENT_TO_SUPPLIER' },
                  { label: 'ได้รับของเปลี่ยนแล้ว', value: 'REPLACEMENT_RECEIVED' },
                  { label: 'เคลมสำเร็จแล้ว', value: 'COMPLETED' },
                ]}
              />
            )}
          </div>

          <button
            type="button"
            onClick={handleDownloadChecklistPDF}
            disabled={downloadingChecklist}
            className="flex items-center justify-center gap-2 px-4 h-10 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm font-semibold cursor-pointer transition-colors rounded-none shrink-0 disabled:opacity-50"
            title="ดาวน์โหลดหรือพิมพ์เอกสารใบเช็คลิสต์เคลม PDF"
          >
            {downloadingChecklist ? (
              <Loader2 size={15} className="text-[#e51c23] animate-spin" />
            ) : (
              <Printer size={15} className="text-gray-500" />
            )}
            <span>{downloadingChecklist ? 'กำลังสร้าง PDF...' : 'พิมพ์ใบเช็คลิสต์เคลม (PDF)'}</span>
          </button>
        </div>

        <div className="gap-0">
          {/* 4. Tab Navigation */}
          <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-3 pt-2 shadow-xs">
            <button
              type="button"
              onClick={() => navigate(basePath)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-normal border-b-2 transition-all cursor-pointer ${
                activeTab === 'claims'
                  ? 'border-[#e51c23] text-[#e51c23]'
                  : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <FileText size={16} /> รายการใบเคลมทั้งหมด
              <span
                className={`px-2 py-0.5 text-sm rounded-full ${
                  activeTab === 'claims'
                    ? 'bg-red-600 text-white font-normal'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {flatRows.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => navigate(`${basePath}?tab=tracking`)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-normal border-b-2 transition-all cursor-pointer ${
                activeTab === 'tracking'
                  ? 'border-[#e51c23] text-[#e51c23]'
                  : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <Truck size={16} /> ติดตามสินค้าส่งเคลม
              <span
                className={`px-2 py-0.5 text-sm rounded-full ${
                  activeTab === 'tracking'
                    ? 'bg-red-600 text-white font-normal'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {trackingTotalCount}
              </span>
            </button>
          </div>

          {activeTab === 'claims' ? (
            <>
              {/* 5. Table */}
              <Table>
                <TableHeader className='bg-[#F6F3F2] text-[#797878]'>
                  <TableRow>
                    <TableHead className="pl-6 w-48 text-[10px] font-bold text-gray-500 uppercase tracking-widest py-3">เลขที่ใบเคลม / วันที่</TableHead>
                    <TableHead className="w-44 text-[10px] font-bold text-gray-500 uppercase tracking-widest py-3">ลูกค้า</TableHead>
                    <TableHead className="text-[10px] font-bold text-gray-500 uppercase tracking-widest py-3">สินค้า</TableHead>
                    <TableHead className="w-32 text-[10px] text-center font-bold text-gray-500 uppercase tracking-widest py-3">ประเภทเคลม</TableHead>
                    <TableHead className="text-center w-20 text-[10px] font-bold text-gray-500 uppercase tracking-widest py-3">จำนวน</TableHead>
                    <TableHead className="w-52 text-[10px] font-bold text-gray-500 uppercase tracking-widest py-3">สาเหตุ</TableHead>
                    <TableHead className="text-center w-32 text-[10px] font-bold text-gray-500 uppercase tracking-widest py-3">สถานะ</TableHead>
                    <TableHead className="text-center pr-6 w-28 text-[10px] font-bold text-gray-500 uppercase tracking-widest py-3">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody className='text-black'>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-gray-400">
                        <Loader2 size={32} className='animate-spin mx-auto' />
                      </TableCell>
                    </TableRow>
                  ) : paginatedRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-gray-400">
                        <FileText size={40} strokeWidth={0.7} className='mx-auto' /> <br />
                        ไม่พบข้อมูลรายการเคลมสินค้า
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
                              <p className="text-[#e51c23] font-normal text-sm">{row.claimNo}</p>
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                {new Date(row.claimDate).toLocaleDateString('th-TH')}
                              </p>
                            </div>
                          ) : (
                            <span className="text-gray-200 text-xs pl-2">└</span>
                          )}
                        </TableCell>

                        <TableCell className="py-3">
                          {row.isFirst ? (
                            <div>
                              <p className="font-normal text-[#1C1B1B] text-sm">{row.customerName}</p>
                              {row.customerPhone !== '-' && (
                                <p className="text-[11px] text-gray-400 mt-0.5">{row.customerPhone}</p>
                              )}
                            </div>
                          ) : null}
                        </TableCell>

                        <TableCell className="py-3">
                          <p className="font-normal text-[#1C1B1B] text-sm">{row.productName}</p>
                        </TableCell>

                        <TableCell className="text-center py-3">
                          <TypeBadge type={row.itemClaimType} />
                        </TableCell>

                        <TableCell className="text-center py-3">
                          <span className="font-medium text-[#1C1B1B] text-sm">{row.qty}</span>
                          <span className="text-xs text-gray-600 ml-1">ชิ้น</span>
                        </TableCell>

                        <TableCell className="py-3">
                          <p className="text-black text-sm truncate max-w-45" title={row.reason}>
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
                                onClick={() => handleDownloadPDF(row.claimId, row.claimNo)}
                                disabled={downloadingClaimId === row.claimId}
                                className="p-1.5 text-gray-400 hover:text-[#e51c23] transition cursor-pointer disabled:opacity-50"
                                title="พิมพ์/ดาวน์โหลด PDF ใบรับเคลม"
                              >
                                {downloadingClaimId === row.claimId ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-[#e51c23]" />
                                ) : (
                                  <Printer className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                onClick={() => canApprove
                                  ? navigate(`${basePath}/detail/${row.claimId}?edit=1`)
                                  : navigate(`${basePath}/edit/${row.claimId}`)}
                                className="p-1.5 text-gray-400 hover:text-[#1C1B1B] transition cursor-pointer"
                                title="แก้ไขใบเคลม"
                              >
                                <PenLine className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteClaim(row.claimId)}
                                className="p-1.5 text-gray-300 hover:text-[#e51c23] transition cursor-pointer"
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
              {(() => {
                return (
                  <div className='bg-[#fcfbfa] px-6 py-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500'>
                    <div className="flex items-center gap-3">
                      <span>
                        แสดง {totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} ถึง{' '}
                        {Math.min(currentPage * itemsPerPage, totalItems)} จาก {totalItems} รายการ
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span>แสดง:</span>
                        <select
                          value={itemsPerPage}
                          onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                          className="border border-gray-200 rounded-none px-1.5 py-0.5 text-gray-600 bg-white focus:outline-none cursor-pointer"
                        >
                          <option value={5}>5</option>
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                        </select>
                      </div>
                    </div>
                    <div className='flex items-center gap-1'>
                      <button disabled={currentPage === 1} onClick={() => setCurrentPage(1)} className='p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed'><ChevronsLeft size={16} /></button>
                      <button disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)} className='p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed'><ChevronLeft size={16} /></button>
                      {getPageNumbers(currentPage, totalPages).map((p, idx) =>
                        p === '...' ? <span key={`e-${idx}`} className='px-2 text-gray-400'>...</span>
                        : <button key={p} onClick={() => setCurrentPage(p as number)} className={cn('px-3 py-1.5 rounded-none font-medium transition-colors cursor-pointer', currentPage === p ? 'bg-[#d61c24] text-white' : 'text-gray-600 hover:bg-gray-100')}>{p}</button>
                      )}
                      <button disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)} className='p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed'><ChevronRight size={16} /></button>
                      <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)} className='p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed'><ChevronsRight size={16} /></button>
                    </div>
                  </div>
                );
              })()}
            </>
          ) : (
            <ClaimTrackingTab
              rawClaims={rawClaims}
              loading={loading}
              basePath={basePath}
              onUpdateStage={handleUpdateTrackingStage}
              updatingItemId={updatingItemId}
              trackingSearch={trackingSearch}
              trackingFilter={trackingFilter}
            />
          )}
        </div>

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
  const selectedClaimItems = claimItems.filter(i => i.claim_qty > 0);
  const totalClaimQuantity = selectedClaimItems.reduce((sum, i) => sum + i.claim_qty, 0);
  const totalClaimEstimatedAmount = selectedClaimItems.reduce((sum, i) => sum + (i.claim_qty * (i.price || 0)), 0);
  const hasMissingReason = selectedClaimItems.some(i => !i.reason.trim());
  const canSubmit = !!claimOrderId && selectedClaimItems.length > 0 && !hasMissingReason && !saving;

  return (
    <div className="p-8 space-y-6 bg-white min-h-screen">
      <form onSubmit={handleSaveClaim} className="space-y-6">
        {/* Hidden evidence file input */}
        <input
          ref={itemEvidenceRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleItemEvidenceSelect}
        />

        {/* 1. Header */}
        <div className="flex items-center justify-between">
          <div className="flex-col space-y-2">
            <nav className="flex items-center text-sm text-gray-500 gap-2 font-light">
              <button
                type="button"
                onClick={() => { navigate(basePath); resetClaimForm(); }}
                className="hover:text-gray-900 transition-colors cursor-pointer"
              >
                จัดการเคลมสินค้า
              </button>
              <ChevronRight size={16} className="text-gray-400" />
              <span className="text-black font-normal">
                สร้างใบเคลมสินค้าใหม่
              </span>
            </nav>
            <Heading level="h1" weight="semibold" className="m-0 text-black">
              สร้างใบเคลมสินค้าใหม่
            </Heading>
          </div>

          <div className="flex items-end gap-4 justify-end">
            <Button
              type="button"
              size="md"
              variant="tertiary"
              onClick={() => { navigate(basePath); resetClaimForm(); }}
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              size="md"
              variant="primary"
              disabled={!canSubmit}
            >
              {saving ? (
                <><Loader2 size={16} className="animate-spin" /> กำลังบันทึก...</>
              ) : (
                <><Check size={16} /> บันทึกใบเคลม</>
              )}
            </Button>
          </div>
        </div>

        {/* 2. ค้นหาใบสั่งซื้อ */}
        <Card className="flex-1">
          <CardContent>
            <div className="flex items-end gap-4">
              <div ref={invoiceRef} className="flex-1 relative">
                <Input
                  label="ค้นหาด้วยหมายเลขใบขายหรือชื่อลูกค้า..."
                  leftIcon={invoiceSearching ? <Loader2 size={16} className="text-[#d61c24] animate-spin" /> : <Search size={16} className="text-gray-400" />}
                  placeholder="INVXXXXXXXX หรือ ชื่อลูกค้า..."
                  value={claimFormInvoice}
                  onChange={e => handleInvoiceInput(e.target.value)}
                  onFocus={() => invoiceResults.length > 0 && setShowInvoiceDrop(true)}
                />
                {showInvoiceDrop && invoiceResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-none shadow-lg overflow-hidden">
                    <ul className="max-h-60 overflow-y-auto divide-y divide-gray-100">
                      {invoiceResults.map((order: any) => (
                        <li key={order.id}>
                          <button
                            type="button"
                            onMouseDown={() => handleSelectOrder(order)}
                            className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors cursor-pointer hover:bg-gray-50"
                          >
                            <div>
                              <Heading level="h6" className="font-medium text-[#d61c24] mb-0">{order.order_number}</Heading>
                              <Heading level="p" className="text-gray-700">ชื่อลูกค้า: {order.customer_name || "ลูกค้าทั่วไป"}</Heading>
                            </div>
                            <Heading level="p" className="text-gray-700">{order.customer_phone && order.customer_phone !== '-' ? order.customer_phone : ''}</Heading>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {showInvoiceDrop && !invoiceSearching && invoiceResults.length === 0 && claimFormInvoice.length >= 2 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-none shadow-lg px-4 py-3 text-sm text-gray-500">
                    ไม่พบใบสั่งซื้อที่ตรงกับ &quot;{claimFormInvoice}&quot;
                  </div>
                )}
              </div>
              <Button size="md" variant="tertiary" onClick={() => handleInvoiceInput(claimFormInvoice)} disabled={invoiceSearching || !claimFormInvoice.trim()} className="w-32">
                {invoiceSearching ? <Loader2 size={16} className="animate-spin" /> : "ค้นหา"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 3. กล่องแจ้งเตือนเมื่อยังไม่เลือกใบสั่งซื้อ */}
        {!claimOrderId && (
          <Card className="flex-1">
            <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-gray-400">
              <ReceiptText size={40} strokeWidth={0.7} />
              <p className="text-sm">ค้นหาด้วยหมายเลขใบขายหรือชื่อลูกค้า เพื่อเริ่มสร้างใบเคลมสินค้า</p>
            </CardContent>
          </Card>
        )}

        {/* 4. เมื่อเลือกใบสั่งซื้อแล้ว */}
        {claimOrderId && (
          <>
            {/* ข้อมูลใบสั่งซื้อและลูกค้า */}
            <div className="flex gap-6 items-stretch">
              <Card className="flex-1">
                <CardHeader className="relative pb-4">
                  <div className="pr-40">
                    <CardTitle className="text-xl text-black">ข้อมูลใบสั่งซื้อ</CardTitle>
                    <p className="mt-1 text-base text-gray-600">รายละเอียดสำหรับการเคลมสินค้า</p>
                  </div>
                  <Badge variant="outline" size="lg" className="absolute right-6 top-6 w-auto px-3 py-1.5 border-gray-200 bg-gray-100 text-sm text-gray-700">
                    <span className="mr-2 h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0 aspect-square inline-block" />
                    พร้อมดำเนินการ
                  </Badge>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="border-t border-t-gray-200 pt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                      <div>
                        <Heading level="p" className="mb-0">เลขที่ใบสั่งซื้อ</Heading>
                        <Heading level="h6" className="font-normal font-mono mt-1">{claimFormInvoice}</Heading>
                      </div>
                      <div>
                        <Heading level="p" className="mb-0">ลูกค้า</Heading>
                        <Heading level="h6" className="font-normal mt-1">{claimCustomerName} {claimCustomerSurname}</Heading>
                      </div>
                      <div>
                        <Heading level="p" className="mb-0">เบอร์โทรศัพท์</Heading>
                        <Heading level="h6" className="font-normal mt-1">{claimCustomerPhone || '-'}</Heading>
                      </div>
                      <div>
                        <Heading level="p" className="mb-0">วันที่เคลม</Heading>
                        <Input
                          type="date"
                          value={claimDate}
                          onChange={(e) => setClaimDate(e.target.value)}
                          className="mt-1 h-8 text-sm"
                        />
                      </div>
                    </div>

                    {/* ข้อมูลวงเงินและสถานะสินเชื่อ */}
                    {claimCustomerPhone && claimCustomerPhone !== '-' && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="mb-2">
                          <Heading level="p" className="mb-0 font-medium text-gray-700">ข้อมูลวงเงินและสถานะสินเชื่อ</Heading>
                        </div>
                        {loadingPosCredit ? (
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Loader2 size={14} className="animate-spin text-[#d61c24]" /> กำลังตรวจสอบข้อมูลวงเงินเชื่อ...
                          </div>
                        ) : posCustomerCredit ? (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-[#f6f3f2] border border-gray-200 rounded-none">
                            <div>
                              <Heading level="p" className="text-gray-500 text-xs mb-0.5">กลุ่มลูกค้า</Heading>
                              <Heading level="h6" className="font-semibold text-gray-800">
                                {posCustomerCredit.customer_type?.type_label || posCustomerCredit.customer_type?.type_name || 'ลูกค้าทั่วไป'}
                              </Heading>
                            </div>
                            <div>
                              <Heading level="p" className="text-gray-500 text-xs mb-0.5">วงเงินสินเชื่อสูงสุด</Heading>
                              <Heading level="h6" className="font-semibold text-gray-800">
                                ฿{(posCustomerCredit.max_credit_limit || 0).toLocaleString('th-TH')}
                              </Heading>
                            </div>
                            <div>
                              <Heading level="p" className="text-gray-500 text-xs mb-0.5">ยอดหนี้ค้างชำระปัจจุบัน</Heading>
                              <Heading level="h6" className="font-semibold text-[#d61c24]">
                                ฿{(posCustomerCredit.current_debt_amount || 0).toLocaleString('th-TH')}
                              </Heading>
                            </div>
                            <div>
                              <Heading level="p" className="text-gray-500 text-xs mb-0.5">วงเงินคงเหลือใช้ได้</Heading>
                              <Heading level="h6" className="font-semibold text-[#259b24]">
                                ฿{Math.max(0, (posCustomerCredit.max_credit_limit || 0) - (posCustomerCredit.current_debt_amount || 0)).toLocaleString('th-TH')}
                              </Heading>
                            </div>
                          </div>
                        ) : (
                          <Heading level="p" className="text-xs text-gray-400 font-normal">
                            ไม่พบข้อมูลบัญชีเชื่อสำหรับลูกค้ารายนี้
                          </Heading>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ตารางเลือกสินค้าที่จะเคลม */}
            <Card className="overflow-visible" noPadding>
              <CardHeader className="flex flex-row items-center justify-between bg-[#f6f3f2]">
                <CardTitle className="text-base font-normal text-gray-800">เลือกสินค้าที่ต้องการเคลม</CardTitle>
                <span className="text-base font-normal text-gray-800">พบ {claimItems.length} รายการในใบสั่งซื้อนี้</span>
              </CardHeader>
              <Table>
                <TableHeader className="text-[#797878] bg-white">
                  <TableRow>
                    <TableHead className="min-w-55 pl-6">ชื่อสินค้า</TableHead>
                    <TableHead className="text-center w-24">จำนวนที่ซื้อ</TableHead>
                    <TableHead className="text-center w-36">จำนวนที่เคลม</TableHead>
                    <TableHead className="w-52">ประเภทการเคลม</TableHead>
                    <TableHead className="min-w-50">สาเหตุที่เคลม</TableHead>
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
                        <TableCell className="py-3.5 pl-6 align-middle">
                          <div>
                            <Heading level="h6" className="mb-0 font-medium text-black">{item.product_name}</Heading>
                            {item.price > 0 && (
                              <Heading level="p" className="text-gray-500 text-xs mt-0.5">
                                ราคาต่อหน่วย: ฿{item.price.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                              </Heading>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="py-3.5 text-center font-normal text-gray-800 align-middle">
                          {item.sold_qty}
                        </TableCell>

                        <TableCell className="py-3.5 text-center align-middle">
                          <div className="inline-flex items-center h-9 border border-gray-300 rounded-none bg-[#F6F3F2] justify-center mx-auto">
                            <button
                              type="button"
                              disabled={item.claim_qty <= 0}
                              onClick={() => handleClaimItemQtyChange(idx, -1)}
                              className={`h-full p-1.5 px-2 transition-colors ${item.claim_qty <= 0 ? "cursor-not-allowed opacity-50 text-gray-400" : "cursor-pointer text-gray-600 hover:text-black"}`}
                              title="ลดจำนวน"
                            >
                              <Minus size={14} />
                            </button>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={item.claim_qty}
                              onChange={(e) => {
                                const raw = e.target.value;
                                if (raw !== "" && !/^\d*$/.test(raw)) return;
                                const val = raw === "" ? 0 : parseInt(raw, 10);
                                handleDirectClaimItemQty(idx, val);
                              }}
                              className="w-10 h-full text-center bg-transparent border-none focus:outline-none focus:ring-0 text-sm p-0 m-0 font-medium text-black [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              type="button"
                              disabled={item.claim_qty >= item.sold_qty}
                              onClick={() => handleClaimItemQtyChange(idx, 1)}
                              className={`h-full p-1.5 px-2 transition-colors ${item.claim_qty >= item.sold_qty ? "cursor-not-allowed opacity-50 text-gray-400" : "cursor-pointer text-gray-600 hover:text-black"}`}
                              title="เพิ่มจำนวน"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </TableCell>

                        <TableCell className="py-3.5 align-middle">
                          {canApprove ? (
                            <Select
                              value={item.claim_type || claimType}
                              onChange={(e) => {
                                const val = e.target.value as ClaimType;
                                if (val === 'CREDIT_ACCOUNT' && !isCreditEligible) {
                                  toast({ variant: 'warning', message: 'ลูกค้าท่านนี้ไม่มีสิทธิ์ใช้วงเงินสินเชื่อ/เงินเชื่อ' });
                                  return;
                                }
                                setClaimItems(prev => prev.map((it, i) => i === idx ? { ...it, claim_type: val } : it));
                              }}
                              options={[
                                { label: 'เปลี่ยนทันที', value: 'INSTANT' },
                                { label: 'ฝากส่งบริษัทตรวจ', value: 'SUPPLIER_PENDING' },
                                { label: 'ลงบัญชีเชื่อ', value: 'CREDIT_ACCOUNT', disabled: !isCreditEligible },
                              ]}
                              className="h-9 text-xs"
                            />
                          ) : (
                            <Badge variant="outline" className="bg-[#f6f3f2] text-gray-600 border-none px-3 py-1.5 text-xs">
                              รอเจ้าของร้านพิจารณา
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="py-3.5 align-middle">
                          <div className="relative">
                            <Input
                              placeholder="ระบุอาการเสีย / สาเหตุการเคลม..."
                              value={item.reason}
                              onChange={e => handleClaimItemReasonChange(idx, e.target.value)}
                              error={isSelected && !hasReason ? "จำเป็นต้องระบุสาเหตุ" : undefined}
                              containerClassName="relative [&>p]:absolute [&>p]:top-full [&>p]:left-0 [&>p]:mt-0.5 [&>p]:text-[10px] [&>p]:text-red-500 [&>p]:whitespace-nowrap [&>p]:font-medium [&>p]:z-10"
                              className="h-9 text-xs"
                            />
                          </div>
                        </TableCell>

                        <TableCell className="py-3.5 text-center pr-6 align-middle">
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
                                className="absolute -top-2 -right-2 w-5 h-5 bg-[#d61c24] hover:bg-red-700 text-white flex items-center justify-center rounded-full shadow-sm cursor-pointer transition-transform group-hover:scale-110"
                                title="ลบรูปภาพหลักฐาน"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="tertiary"
                              onClick={() => handleItemEvidenceClick(idx)}
                              className="h-9 text-xs gap-1.5 px-3"
                              title="แนบรูปภาพหลักฐาน"
                            >
                              <Camera size={14} className="text-gray-500" />
                              <span>แนบรูป</span>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Card Footer Summary */}
              <div className="p-4 bg-white border-t border-gray-200 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-6 text-sm text-gray-600">
                  <div>
                    <span>จำนวนที่เลือกเคลม: </span>
                    <span className="font-bold text-black">{totalClaimQuantity} ชิ้น</span>
                  </div>
                  {totalClaimEstimatedAmount > 0 && (
                    <div>
                      <span>มูลค่าประมาณการ: </span>
                      <span className="font-bold text-[#d61c24]">
                        ฿{totalClaimEstimatedAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>

                {selectedClaimItems.some(i => !i.reason.trim()) && (
                  <span className="text-xs text-red-500 font-medium">
                    * มีรายการที่ยังไม่ได้ระบุสาเหตุการเคลม
                  </span>
                )}
              </div>
            </Card>

            {/* หมายเหตุ */}
            <Card>
              <CardHeader className="border-b border-gray-100 pb-4">
                <CardTitle className="text-lg">หมายเหตุเพิ่มเติม</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <textarea
                  value={claimNote}
                  onChange={(e) => setClaimNote(e.target.value)}
                  rows={4}
                  maxLength={500}
                  placeholder="ระบุหมายเหตุเพิ่มเติมของใบเคลมสินค้า (ถ้ามี)"
                  className="w-full resize-y rounded-none border border-gray-200 bg-[#f6f3f2] px-3 py-2 text-sm text-black placeholder:text-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
                <p className="mt-1 text-right text-xs text-gray-400">{claimNote.length}/500</p>
              </CardContent>
            </Card>
          </>
        )}
      </form>
    </div>
  );
}
