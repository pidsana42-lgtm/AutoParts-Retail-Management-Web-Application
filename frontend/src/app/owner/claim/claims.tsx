import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Minus, Send,
  ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, History, Trash2,
  FileText, Loader2, Eye, Camera, X,
} from 'lucide-react';
import Heading from '../../../components/elements/heading';
import Card from '../../../components/elements/card';
import Input from '../../../components/elements/input';
import Button from '../../../components/elements/button';
import Badge from '../../../components/elements/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/elements/table';
import { getCustomerClaims, searchSaleOrders, deleteCustomerClaim } from '../../../service/http/claim/claim';
import apiClient from '../../../service/http/apiClient';
import type { CustomerClaim } from '../../../interface/claim/claim';

interface ClaimFormProduct {
  product_id: number;
  product_name: string;
  price: number;
  sold_qty: number;
  claim_qty: number;
  reason: string;
  evidenceFile: File | null;
  evidencePreview: string | null;
}

interface FlatRow {
  claimId: number;
  claimNo: string;
  claimDate: string;
  customerName: string;
  customerPhone: string;
  isFirst: boolean;
  totalItems: number;
  itemId: number;
  productName: string;
  qty: number;
  reason: string;
  resolution: string;
  itemStatus: string;
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

    if (items.length === 0) {
      rows.push({
        claimId: claim.id ?? 0,
        claimNo: claim.claim_no ?? `CLM-${claim.id}`,
        claimDate: claim.claim_date,
        customerName,
        customerPhone,
        isFirst: true,
        totalItems: 0,
        itemId: 0,
        productName: '-',
        qty: 0,
        reason: '-',
        resolution: '-',
        itemStatus: (claim.status ?? 'PENDING').toUpperCase(),
      });
    } else {
      items.forEach((item, idx) => {
        const rawStatus = item.status || claim.status || 'Pending';
        rows.push({
          claimId: claim.id ?? 0,
          claimNo: claim.claim_no ?? `CLM-${claim.id}`,
          claimDate: claim.claim_date,
          customerName,
          customerPhone,
          isFirst: idx === 0,
          totalItems: items.length,
          itemId: item.id ?? 0,
          productName: item.product_name || `#${item.product_id}`,
          qty: item.qty,
          reason: item.reason,
          resolution: item.resolution,
          itemStatus: rawStatus.toUpperCase(),
        });
      });
    }
  }
  return rows;
};

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
  const [claimItems, setClaimItems] = useState<ClaimFormProduct[]>([]);

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
            evidence_url: evidenceUrl,
          };
        })
      );

      const noteText = [
        `ลูกค้า: ${claimCustomerName} ${claimCustomerSurname}`.trim(),
        `โทร: ${claimCustomerPhone}`,
      ].filter(Boolean).join(' | ');

      await apiClient.post('/claims/customer-claims', {
        original_order_id: claimOrderId ?? 0,
        notes: noteText,
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
    setClaimFormInvoice('');
    setClaimOrderId(null);
    setClaimCustomerName('');
    setClaimCustomerSurname('');
    setClaimCustomerPhone('');
    setClaimDate(new Date().toISOString().split('T')[0]);
    setClaimItems([]);
    setInvoiceResults([]);
  };

  const basePath = canApprove ? '/owner/claims' : '/employee/claims';

  // ─── LIST VIEW ────────────────────────────────────────────────────────────────
  if (view === 'list') {
    const pendingCount = flatRows.filter(r => r.itemStatus === 'PENDING' && r.itemId > 0).length;

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
    const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

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

    const tabs = [
      { key: '',         label: `ทั้งหมด (${rawClaims.length})`, activeClass: 'bg-[#1C1B1B] text-white' },
      { key: 'PENDING',  label: 'รอดำเนินการ',                    activeClass: 'bg-[#e51c23] text-white',  count: pendingCount },
      { key: 'APPROVED', label: 'อนุมัติแล้ว',                    activeClass: 'bg-[#1C1B1B] text-white' },
      { key: 'REJECTED', label: 'ปฏิเสธ',                         activeClass: 'bg-[#1C1B1B] text-white' },
    ];

    return (
      <div className="p-8 max-w-full mx-auto w-full animate-in fade-in duration-300">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
          <div>
            <Heading level="h1" className="mb-1 font-extrabold text-[#1C1B1B]">จัดการเคลมสินค้า</Heading>
            <p className="text-sm text-[#5F5E5E] font-semibold">
              ติดตามและอนุมัติรายการเคลมอะไหล่จากลูกค้า
            </p>
          </div>
          <Button
            onClick={() => setView('claim-form')}
            className="bg-[#e51c23] hover:bg-[#c9181f] text-white flex items-center gap-2 shadow-sm font-bold h-10 px-5 rounded-none text-sm shrink-0"
          >
            <Plus size={16} /> สร้างใบเคลม
          </Button>
        </div>

        {/* Table Card */}
        <Card noPadding className="overflow-hidden">

          {/* Card Header */}
          <div className="flex flex-col gap-4 p-6 border-b border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-[#e51c23] font-bold">
                <History size={20} />
                <span className="text-sm font-bold">รายการเคลมสินค้า (Customer Claims)</span>
              </div>

              {/* Search */}
              <div ref={searchRef} className="relative w-full md:w-72">
                <Input
                  type="text"
                  placeholder="ค้นหาเลขที่ใบเคลม, ชื่อลูกค้า, สินค้า..."
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
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setStatusFilter(tab.key); setCurrentPage(1); }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-none transition-colors cursor-pointer flex items-center gap-1.5 ${
                    statusFilter === tab.key
                      ? tab.activeClass
                      : 'bg-gray-100 text-[#5F5E5E] hover:bg-gray-200'
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={`px-1.5 py-0.5 text-[10px] font-extrabold rounded-none leading-none ${
                      statusFilter === tab.key ? 'bg-white text-[#e51c23]' : 'bg-[#e51c23] text-white'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="p-12 flex justify-center items-center gap-3">
              <Loader2 size={24} className="text-[#e51c23] animate-spin" />
              <span className="text-sm text-[#5F5E5E] font-medium">กำลังโหลดรายการเคลม...</span>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-sm font-medium">
              ไม่พบข้อมูลรายการเคลมสินค้า
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-gray-100 text-[#5F5E5E]">
                <TableRow>
                  <TableHead className="pl-6 w-44">เลขที่ใบเคลม / วันที่</TableHead>
                  <TableHead className="w-40">ลูกค้า</TableHead>
                  <TableHead>สินค้า</TableHead>
                  <TableHead className="text-center w-20">จำนวน</TableHead>
                  <TableHead className="w-48">สาเหตุ</TableHead>
                  <TableHead className="text-center w-32">สถานะ</TableHead>
                  <TableHead className="text-center pr-6 w-32">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-gray-700">
                {paginatedRows.map((row, idx) => {
                  return (
                    <TableRow
                      key={`${row.claimId}-${row.itemId}-${idx}`}
                      className={`hover:bg-gray-50/70 transition-colors ${
                        row.isFirst
                          ? 'border-t-2 border-gray-200'
                          : 'border-t border-gray-100 bg-gray-50/30'
                      }`}
                    >
                      {/* เลขที่ / วันที่ */}
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

                      {/* ลูกค้า */}
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

                      {/* สินค้า */}
                      <TableCell>
                        <p className="font-semibold text-[#1C1B1B]">{row.productName}</p>
                        {row.resolution && row.resolution !== 'รอการตรวจสอบ' && row.resolution !== '-' && (
                          <p className="text-xs text-emerald-600 mt-0.5">{row.resolution}</p>
                        )}
                      </TableCell>

                      {/* จำนวน */}
                      <TableCell className="text-center">
                        <span className="font-bold text-[#1C1B1B]">{row.qty} ชิ้น</span>
                      </TableCell>

                      {/* สาเหตุ */}
                      <TableCell>
                        <p className="text-[#5F5E5E] text-sm truncate max-w-[180px]" title={row.reason}>
                          {row.reason || '-'}
                        </p>
                      </TableCell>

                      {/* สถานะ */}
                      <TableCell className="text-center">
                        {row.itemStatus === 'APPROVED' ? (
                          <Badge variant="success" size="md">อนุมัติแล้ว</Badge>
                        ) : row.itemStatus === 'REJECTED' ? (
                          <Badge variant="error" size="md">ปฏิเสธ</Badge>
                        ) : (
                          <Badge variant="warning" size="md">รอดำเนินการ</Badge>
                        )}
                      </TableCell>

                      {/* จัดการ */}
                      <TableCell className="text-center pr-6">
                        {row.isFirst && (
                          <div className="flex items-center justify-center gap-3">
                            <button
                              onClick={() => navigate(`${basePath}/detail/${row.claimId}`)}
                              className="text-gray-400 hover:text-[#e51c23] transition-colors cursor-pointer"
                              title="ดูรายละเอียด"
                            >
                              <Eye size={20} />
                            </button>
                            <button
                              onClick={() => handleDeleteClaim(row.claimId)}
                              className="text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                              title="ลบใบเคลม"
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {totalItems > 0 && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-6 border-t border-gray-100 text-sm text-[#5F5E5E] bg-gray-50">
              <div className="flex items-center gap-4">
                <span>
                  แสดง {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} ถึง {Math.min(currentPage * itemsPerPage, totalItems)} จาก {totalItems} รายการ
                </span>
                <div className="flex items-center gap-2">
                  <span>รายการต่อหน้า:</span>
                  <select
                    value={itemsPerPage}
                    onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                    className="border border-gray-200 rounded-none px-2 py-1 text-[#5F5E5E] bg-white hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-200 cursor-pointer"
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
                  className="p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {pageNumbers.map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1.5 rounded-none font-medium transition-colors cursor-pointer ${
                      currentPage === page
                        ? 'bg-[#e51c23] text-white'
                        : 'text-[#5F5E5E] hover:bg-gray-100'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="p-1.5 rounded-none text-[#5F5E5E] hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  className="p-1.5 rounded-none text-[#5F5E5E] hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    );
  }

  // ─── FORM VIEW ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-6 font-sans">
      <form onSubmit={handleSaveClaim} className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { setView('list'); resetClaimForm(); }}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            >
              <ChevronLeft size={22} className="text-slate-600" />
            </button>
            <div>
              <Heading level="h1" className="mb-0 font-extrabold text-slate-800">สร้างใบเคลมสินค้า</Heading>
              <p className="text-sm text-slate-500 font-semibold mt-0.5">กรอกข้อมูลการเคลมอะไหล่จากลูกค้า</p>
            </div>
          </div>
          <Button
            type="submit"
            disabled={saving}
            className="bg-[#e51c23] hover:bg-[#c9181f] disabled:opacity-60 text-white gap-2 shadow-sm font-bold"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {saving ? 'กำลังบันทึก...' : 'ส่งใบเคลม'}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* Left 2/3 */}
          <div className="lg:col-span-2 space-y-5">

            {/* Invoice search */}
            <Card className="space-y-3">
              <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Search size={15} className="text-[#e51c23]" /> ค้นหาใบสั่งซื้อ (เลขที่ SO หรือชื่อลูกค้า)
              </p>
              <div ref={invoiceRef} className="relative">
                <Input
                  type="text"
                  placeholder="พิมพ์ชื่อลูกค้า หรือเลขที่ SO เช่น SO-2026-0001..."
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
                          <span className="text-xs text-slate-400">฿{Number(order.total_amount).toLocaleString('th-TH')}</span>
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
                    ไม่พบใบสั่งซื้อที่ตรงกับ "{claimFormInvoice}"
                  </div>
                )}
              </div>
            </Card>

            {/* Customer info */}
            <Card title="ข้อมูลลูกค้า" subtitle="โหลดจากใบสั่งซื้อที่เลือก">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-2">
                <Input label="ชื่อ" type="text" value={claimCustomerName}
                  onChange={e => setClaimCustomerName(e.target.value)} disabled className="bg-slate-50 border border-slate-200" />
                <Input label="นามสกุล" type="text" value={claimCustomerSurname}
                  onChange={e => setClaimCustomerSurname(e.target.value)} disabled className="bg-slate-50 border border-slate-200" />
                <Input label="เบอร์โทรศัพท์" type="text" value={claimCustomerPhone}
                  onChange={e => setClaimCustomerPhone(e.target.value)} disabled className="bg-slate-50 border border-slate-200" />
              </div>
            </Card>

            {/* Items table */}
            <Card noPadding title="เลือกสินค้าที่ต้องการเคลม" subtitle="กดไอคอนกล้องเพื่อแนบหลักฐานรายสินค้า">
              <input
                ref={itemEvidenceRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleItemEvidenceSelect}
              />
              {claimItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs font-bold text-slate-500">
                        <th className="py-3 px-4 text-left font-normal">ชื่อสินค้า</th>
                        <th className="py-3 px-4 text-center font-normal w-16">ซื้อมา</th>
                        <th className="py-3 px-4 text-right font-normal w-28">ราคา/ชิ้น</th>
                        <th className="py-3 px-4 text-center font-normal w-28">จำนวนเคลม</th>
                        <th className="py-3 px-4 text-left font-normal">สาเหตุที่เคลม</th>
                        <th className="py-3 px-4 text-center font-normal w-20">หลักฐาน</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-slate-700">
                      {claimItems.map((item, idx) => (
                        <tr key={idx} className={`hover:bg-slate-50/50 ${item.claim_qty === 0 ? 'opacity-50' : ''}`}>
                          <td className="py-3 px-4 font-semibold text-slate-800">{item.product_name}</td>
                          <td className="py-3 px-4 text-center text-slate-500">{item.sold_qty}</td>
                          <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                            ฿{item.price.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <button type="button" onClick={() => handleClaimItemQtyChange(idx, -1)}
                                className="p-1 hover:bg-slate-100 rounded text-slate-500 cursor-pointer">
                                <Minus size={13} />
                              </button>
                              <span className={`w-8 text-center font-bold ${item.claim_qty > 0 ? 'text-[#e51c23]' : 'text-slate-400'}`}>
                                {item.claim_qty}
                              </span>
                              <button type="button" onClick={() => handleClaimItemQtyChange(idx, 1)}
                                className="p-1 hover:bg-slate-100 rounded text-slate-500 cursor-pointer">
                                <Plus size={13} />
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              value={item.reason}
                              onChange={e => handleClaimItemReasonChange(idx, e.target.value)}
                              placeholder="ระบุสาเหตุ..."
                              disabled={item.claim_qty === 0}
                              className="w-full border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:border-[#e51c23] disabled:bg-slate-50 disabled:text-slate-400 rounded"
                            />
                          </td>
                          <td className="py-3 px-4 text-center">
                            {item.evidencePreview ? (
                              <div className="relative inline-block">
                                <img src={item.evidencePreview} alt="หลักฐาน"
                                  className="w-9 h-9 object-cover border border-slate-200 rounded" />
                                <button type="button" onClick={() => handleRemoveItemEvidence(idx)}
                                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white flex items-center justify-center rounded-full cursor-pointer">
                                  <X size={8} />
                                </button>
                              </div>
                            ) : (
                              <button type="button"
                                onClick={() => item.claim_qty > 0 && handleItemEvidenceClick(idx)}
                                disabled={item.claim_qty === 0}
                                className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                title="แนบหลักฐาน">
                                <Camera size={15} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <FileText size={36} className="mb-3 text-slate-300" />
                  <span className="font-semibold text-slate-500">กรุณาค้นหาใบสั่งซื้อเพื่อแสดงรายการสินค้า</span>
                </div>
              )}
            </Card>

          </div>

          {/* Right 1/3 */}
          <div className="space-y-5">

            <Card title="รายละเอียดเอกสาร">
              <div className="py-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">วันที่เคลม</label>
                <input
                  type="date"
                  value={claimDate}
                  onChange={e => setClaimDate(e.target.value)}
                  className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#e51c23] bg-slate-50 text-slate-800"
                />
              </div>
            </Card>

          </div>
        </div>
      </form>
    </div>
  );
}
