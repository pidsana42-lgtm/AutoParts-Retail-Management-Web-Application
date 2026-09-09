import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useLocation, Link } from 'react-router-dom';
import {
  ChevronRight,
  Calendar, Hash, User, Package, Loader2, SquarePen, Printer, Save, Camera, X,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContexts';
import Heading from '../../../components/elements/heading';
import Badge from '../../../components/elements/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/elements/table';
import { getCustomerClaimById, updateClaimItemStatus, updateCustomerClaim, searchCustomerCreditByPhone, generateCustomerClaimPDF } from '../../../service/http/claim/claim';
import apiClient from '../../../service/http/apiClient';
import type { CustomerDiscountResponse } from '../../../interface/pos/customer_interface';
import type { CustomerClaim, CustomerClaimItem } from '../../../interface/claim/claim';
import { useToast } from '../../../components/elements/toast';

interface EditableItem extends CustomerClaimItem {
  newFile?: File | null;
  newPreview?: string | null;
}

const parseNote = (note: string | undefined, key: string): string => {
  if (!note) return '-';
  const match = note.match(new RegExp(`${key}:\\s*([^|]+)`));
  return match ? match[1].trim() : '-';
};

export default function ClaimDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const location = useLocation();
  // ที่มาของการเข้าหน้านี้ (ถ้ามี) — ใช้ปรับเกล็ดขนมปังให้ตรงกับหน้าที่กดเข้ามาจริงๆ เช่นจากหน้า
  // "การเคลื่อนไหวของคลังสินค้า" แทน "จัดการเคลมสินค้า" ตามปกติ
  const cameFromMovement = (location.state as { from?: string } | null)?.from === 'movement';
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useAuth() as any;
  const isManager = role?.toUpperCase() === 'OWNER' || role?.toUpperCase() === 'ADMIN';

  const [claim, setClaim] = useState<CustomerClaim | null>(null);
  const [loading, setLoading] = useState(true);
  const [posCustomerCredit, setPosCustomerCredit] = useState<CustomerDiscountResponse | null>(null);
  const [loadingPosCredit, setLoadingPosCredit] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editItems, setEditItems] = useState<EditableItem[]>([]);
  const [activeItemIdx, setActiveItemIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        setLoading(true);
        const data = await getCustomerClaimById(Number(id));
        setClaim(data);
      } catch (err) {
        console.error('Failed to load claim:', err);
        toast({ variant: 'error', message: 'ไม่สามารถโหลดข้อมูลใบเคลมได้' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  useEffect(() => {
    const phone = claim?.customer_phone || parseNote(claim?.notes || claim?.note, 'โทร');
    if (claim?.claim_type === 'CREDIT_ACCOUNT' && phone && phone !== '-') {
      const fetchCredit = async () => {
        try {
          setLoadingPosCredit(true);
          const data = await searchCustomerCreditByPhone(phone.trim());
          setPosCustomerCredit(data);
        } catch (err) {
          console.error('Failed to fetch customer credit:', err);
        } finally {
          setLoadingPosCredit(false);
        }
      };
      fetchCredit();
    }
  }, [claim]);

  useEffect(() => {
    if (!claim || !isManager) return;
    if (searchParams.get('edit') === '1' && !isEditing) {
      setEditItems(claim.items ? claim.items.map(i => ({ ...i })) : []);
      setIsEditing(true);
    }
  }, [claim, isManager, searchParams]);

  const startEditing = () => {
    setEditItems(claim?.items ? claim.items.map(i => ({ ...i })) : []);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setEditItems([]);
    setActiveItemIdx(null);
    setIsEditing(false);
    if (searchParams.get('edit')) {
      const next = new URLSearchParams(searchParams);
      next.delete('edit');
      setSearchParams(next, { replace: true });
    }
  };

  const handleItemChange = (idx: number, field: keyof EditableItem, value: any) => {
    setEditItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const handlePhotoClick = (idx: number) => {
    setActiveItemIdx(idx);
    fileInputRef.current?.click();
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || activeItemIdx === null) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'warning', message: 'ไฟล์ภาพขนาดใหญ่เกินไป (สูงสุด 5MB)' });
      return;
    }
    const preview = URL.createObjectURL(file);
    setEditItems(prev =>
      prev.map((item, i) => i === activeItemIdx ? { ...item, newFile: file, newPreview: preview } : item)
    );
    if (fileInputRef.current) fileInputRef.current.value = '';
    setActiveItemIdx(null);
  };

  const handleRemovePhoto = (idx: number) => {
    setEditItems(prev =>
      prev.map((item, i) => i === idx ? { ...item, evidence_url: '', newFile: null, newPreview: null } : item)
    );
  };

  const handleSave = async () => {
    if (!claim?.id) return;
    try {
      setSaving(true);

      const savedItems = await Promise.all(
        editItems.map(async item => {
          if (!item.id) return item;
          let evidenceUrl = item.evidence_url || '';
          if (item.newFile) {
            try {
              const fd = new FormData();
              fd.append('file', item.newFile);
              const res = await apiClient.post('/claims/evidence/upload', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
              });
              evidenceUrl = res.data?.url ?? evidenceUrl;
            } catch (err) {
              console.error('Failed to upload evidence:', err);
              toast({ variant: 'warning', message: 'อัปโหลดรูปหลักฐานไม่สำเร็จ' });
            }
          }

          // Update item data
          await apiClient.put(`/claims/customer-claims/items/${item.id}`, {
            qty: item.qty,
            reason: item.reason,
            evidence_url: evidenceUrl,
            claim_type: item.claim_type || 'INSTANT',
          });

          // Update item status if set
          if (item.status) {
            try {
              await updateClaimItemStatus(item.id, item.status);
            } catch (err) {
              console.error('Failed to update item status:', err);
              toast({ variant: 'warning', message: 'อัปเดตสถานะสินค้าบางรายการไม่สำเร็จ' });
            }
          }

          const { newFile, newPreview, ...rest } = item;
          return { ...rest, evidence_url: evidenceUrl } as CustomerClaimItem;
        })
      );

      // Determine overall claim status
      const allApproved = savedItems.length > 0 && savedItems.every(i => (i.status ?? '').toUpperCase() === 'APPROVED');
      const allRejected = savedItems.length > 0 && savedItems.every(i => (i.status ?? '').toUpperCase() === 'REJECTED');
      const nextClaimStatus = allApproved ? 'APPROVED' : allRejected ? 'REJECTED' : (claim.status || 'PENDING');

      await updateCustomerClaim(claim.id, {
        ...claim,
        status: nextClaimStatus,
      } as any);

      setClaim(prev => prev ? { ...prev, status: nextClaimStatus, items: savedItems as CustomerClaimItem[] } : prev);
      cancelEditing();
      toast({ variant: 'success', message: 'บันทึกข้อมูลใบเคลมเรียบร้อยแล้ว' });
    } catch (err) {
      console.error('Failed to save claim:', err);
      toast({ variant: 'error', message: 'เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่' });
    } finally {
      setSaving(false);
    }
  };

  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleDownloadPDF = async () => {
    if (!claim || !claim.id) return;
    setDownloadingPdf(true);
    try {
      const blob = await generateCustomerClaimPDF(claim.id);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      const fileNameId = claim.claim_no || `CLM-${claim.id}`;
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
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center min-h-[300px]">
        <Loader2 size={28} className="text-[#e51c23] animate-spin" />
        <span className="ml-3 text-sm text-[#5F5E5E] font-medium">กำลังโหลดข้อมูล...</span>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="p-8 text-center">
        <p className="text-[#5F5E5E] font-bold">ไม่พบข้อมูลใบเคลม</p>
      </div>
    );
  }

  const claimNo = claim.claim_no ?? `CLM-${claim.id}`;
  const orderRef = (claim as any).order_number || (claim as any).sale_order?.order_number || parseNote(claim.notes || claim.note, 'Order') || '-';
  const displayItems = isEditing ? editItems : (claim.items ?? []);
  const totalQty = displayItems.reduce((acc, i) => acc + (i.qty || 0), 0);
  const basePath = window.location.pathname.startsWith('/employee') ? '/employee/claims' : '/owner/claims';
  const breadcrumbRoot = cameFromMovement
    ? { label: 'การเคลื่อนไหวของคลังสินค้า', path: '/owner/stock/stock-movement' }
    : { label: 'จัดการเคลมสินค้า', path: basePath };

  return (
    <div className="p-8 max-w-full mx-auto w-full animate-in fade-in duration-300 font-sans text-slate-800">
      {/* Hidden file input for photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoSelect}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <nav className="flex items-center text-xs text-gray-400 gap-1.5 font-medium mb-2">
            <Link to={breadcrumbRoot.path} className="hover:text-[#e51c23] transition-colors cursor-pointer">
              {breadcrumbRoot.label}
            </Link>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <span className="text-gray-600">รายละเอียดใบเคลม</span>
          </nav>
          <div className="flex items-center gap-3">
            <Heading level="h1" className="mb-0 font-bold text-[#1C1B1B]">
              รายละเอียดใบเคลมสินค้า
            </Heading>
            <span className="text-base font-bold text-[#e51c23] font-mono">{claimNo}</span>
          </div>
        </div>
        {isManager && !isEditing && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={downloadingPdf}
              className="border border-gray-300 text-gray-700 hover:bg-gray-100 flex items-center gap-2 shadow-xs font-bold h-10 px-4 rounded-none text-sm shrink-0 cursor-pointer bg-white transition-colors disabled:opacity-50"
              title="ดาวน์โหลดหรือพิมพ์เอกสารใบรับเคลม PDF"
            >
              {downloadingPdf ? (
                <Loader2 size={16} className="text-[#e51c23] animate-spin" />
              ) : (
                <Printer size={16} className="text-[#e51c23]" />
              )}
              {downloadingPdf ? 'กำลังสร้าง PDF...' : 'พิมพ์ใบรับเคลม (PDF)'}
            </button>
            <button
              type="button"
              onClick={startEditing}
              className="bg-[#e51c23] hover:bg-[#c9181f] text-white flex items-center gap-2 shadow-sm font-bold h-10 px-4 rounded-none text-sm shrink-0 cursor-pointer transition-colors"
            >
              <SquarePen size={16} /> แก้ไขข้อมูลและการอนุมัติ
            </button>
          </div>
        )}
      </div>

      <div className="space-y-5">

          {/* Claim meta info */}
          <div className="bg-white border border-gray-200">
            <div className="bg-gray-100 px-5 py-3 border-b border-gray-200">
              <p className="text-xs font-bold text-[#5F5E5E] uppercase tracking-wider">ข้อมูลใบเคลม</p>
            </div>
            <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
              <div className="flex items-start gap-2">
                <Hash size={16} className="text-[#e51c23] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-[#5F5E5E] font-bold">เลขที่ใบเคลม</p>
                  <p className="font-bold text-[#1C1B1B] font-mono">{claimNo}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar size={16} className="text-[#e51c23] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-[#5F5E5E] font-bold">วันที่เคลม</p>
                  <p className="font-semibold text-[#1C1B1B] text-xs">
                    {new Date(claim.claim_date).toLocaleDateString('th-TH', {
                      year: 'numeric', month: 'long', day: 'numeric'
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <User size={16} className="text-[#e51c23] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-[#5F5E5E] font-bold">ลูกค้า</p>
                  <p className="font-bold text-[#1C1B1B]">
                    {claim.customer_name && claim.customer_name !== '-'
                      ? claim.customer_name
                      : parseNote(claim.notes || claim.note, 'ลูกค้า')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Package size={16} className="text-[#e51c23] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-[#5F5E5E] font-bold">Order อ้างอิง</p>
                  <p className="font-bold text-[#1C1B1B] font-mono">{orderRef}</p>
                </div>
              </div>
            </div>
          </div>

          {claim.claim_type === 'CREDIT_ACCOUNT' && (
            <div className="bg-white border border-gray-200 overflow-hidden">
              <div className="bg-slate-100 px-5 py-3 border-b border-gray-200 flex items-center justify-between">
                <p className="text-xs font-bold text-[#1C1B1B] uppercase tracking-wider">ข้อมูลบัญชีเชื่อและสินเชื่อ POS ของลูกค้า</p>
                {posCustomerCredit?.is_credit_enabled ? (
                  <Badge variant="success" size="sm">อนุมัติวงเงินเชื่อ</Badge>
                ) : (
                  <Badge variant="error" size="sm">ไม่อนุมัติวงเงินเชื่อ</Badge>
                )}
              </div>
              <div className="p-5">
                {loadingPosCredit ? (
                  <div className="flex items-center gap-2 text-xs text-[#5F5E5E]">
                    <Loader2 size={14} className="animate-spin text-[#e51c23]" /> กำลังโหลดข้อมูลสิทธิ์บัญชีเชื่อ POS...
                  </div>
                ) : posCustomerCredit ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-xs">
                    <div>
                      <p className="text-[#5F5E5E] font-bold mb-1">กลุ่มประเภทลูกค้า</p>
                      <p className="font-bold text-[#1C1B1B]">
                        {posCustomerCredit.customer_type?.type_label || posCustomerCredit.customer_type?.type_name || 'ลูกค้าทั่วไป'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#5F5E5E] font-bold mb-1">วงเงินสินเชื่อสูงสุด</p>
                      <p className="font-bold text-[#1C1B1B]">฿{(posCustomerCredit.max_credit_limit || 0).toLocaleString('th-TH')}</p>
                    </div>
                    <div>
                      <p className="text-[#5F5E5E] font-bold mb-1">ยอดหนี้ค้างชำระปัจจุบัน</p>
                      <p className="font-bold text-[#e51c23]">฿{(posCustomerCredit.current_debt_amount || 0).toLocaleString('th-TH')}</p>
                    </div>
                    <div>
                      <p className="text-[#5F5E5E] font-bold mb-1">วงเงินคงเหลือใช้ได้</p>
                      <p className="font-bold text-[#259b24]">
                        ฿{Math.max(0, (posCustomerCredit.max_credit_limit || 0) - (posCustomerCredit.current_debt_amount || 0)).toLocaleString('th-TH')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#5F5E5E]">ไม่พบข้อมูลวงเงินเชื่อ POS สำหรับลูกค้ารายนี้</p>
                )}
              </div>
            </div>
          )}

          {/* Items table */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="bg-gray-100 px-5 py-3 border-b border-gray-200 flex items-center justify-between">
              <p className="text-xs font-bold text-[#5F5E5E] uppercase tracking-wider">สินค้าที่เคลม</p>
              <span className="text-xs font-bold text-[#1C1B1B]">รวม {totalQty} ชิ้น</span>
            </div>

            {(displayItems.length) > 0 ? (
              <Table>
                <TableHeader className="bg-gray-50 text-[#5F5E5E]">
                  <TableRow>
                    <TableHead className="pl-5">สินค้า</TableHead>
                    <TableHead className="text-center w-32">ประเภทเคลม</TableHead>
                    <TableHead className="text-center w-24">จำนวน</TableHead>
                    <TableHead className="min-w-[220px]">หมายเหตุ / สาเหตุการเคลม</TableHead>
                    <TableHead className="text-center w-28">ภาพหลักฐาน</TableHead>
                    <TableHead className="text-center w-36 pr-5">สถานะ / จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-gray-700">
                  {displayItems.map((item: EditableItem, idx: number) => {
                    const itemStatus = (item.status ?? 'Pending');
                    const itemStatusUp = itemStatus.toUpperCase();
                    const itemEvidenceUrl = item.newPreview || item.evidence_url || (item as any).evidenceUrl || (item as any).image_url || (item as any).imageUrl || (item as any).evidence || '';
                    const itemClaimType = item.claim_type || claim.claim_type || 'INSTANT';

                    return (
                      <TableRow key={idx} className="hover:bg-gray-50/70">
                        <TableCell className="pl-5 font-bold text-[#1C1B1B]">
                          {item.product_name || `#${item.product_id}`}
                        </TableCell>
                        <TableCell className="text-center">
                          {isEditing ? (
                            <select
                              value={item.claim_type || itemClaimType || 'INSTANT'}
                              onChange={e => handleItemChange(idx, 'claim_type', e.target.value)}
                              className="border border-gray-300 px-2 py-1 text-xs font-bold text-[#1C1B1B] bg-white focus:outline-none focus:border-[#e51c23] rounded-none cursor-pointer"
                            >
                              <option value="INSTANT">เปลี่ยนทันที</option>
                              <option value="SUPPLIER_PENDING">ส่งบริษัท</option>
                              <option value="CREDIT_ACCOUNT">ลงบัญชีเชื่อ</option>
                            </select>
                          ) : itemClaimType === 'SUPPLIER_PENDING' ? (
                            <span className="px-2 py-0.5 text-[10px] font-bold text-[#1C1B1B] bg-gray-100 border border-gray-300 rounded-none inline-block">
                              ส่งบริษัท
                            </span>
                          ) : itemClaimType === 'CREDIT_ACCOUNT' ? (
                            <span className="px-2 py-0.5 text-[10px] font-bold text-gray-800 bg-gray-200 border border-gray-300 rounded-none inline-block">
                              ลงบัญชีเชื่อ
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] font-bold text-[#e51c23] bg-red-50 border border-red-200 rounded-none inline-block">
                              เปลี่ยนทันที
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-bold text-[#e51c23]">
                          {isEditing ? (
                            <input
                              type="number"
                              min={1}
                              value={item.qty}
                              onChange={e => handleItemChange(idx, 'qty', Number(e.target.value))}
                              className="w-16 text-center border border-gray-300 px-2 py-1 text-sm font-bold text-[#1C1B1B] focus:outline-none focus:border-[#e51c23]"
                            />
                          ) : (
                            <>{item.qty} ชิ้น</>
                          )}
                        </TableCell>
                        <TableCell className="text-[#1C1B1B] text-sm font-medium">
                          {isEditing ? (
                            <input
                              type="text"
                              value={item.reason ?? ''}
                              onChange={e => handleItemChange(idx, 'reason', e.target.value)}
                              placeholder="ระบุหมายเหตุ / สาเหตุการเคลม..."
                              className="w-full border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:border-[#e51c23]"
                            />
                          ) : (
                            item.reason || '-'
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {isEditing ? (
                            itemEvidenceUrl.trim() ? (
                              <div className="relative inline-block">
                                <img
                                  src={itemEvidenceUrl}
                                  alt="หลักฐาน"
                                  className="w-10 h-10 object-cover border border-gray-200 cursor-pointer"
                                  onClick={() => handlePhotoClick(idx)}
                                  title="คลิกเพื่อเปลี่ยนรูปภาพ"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemovePhoto(idx)}
                                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#e51c23] text-white flex items-center justify-center rounded-full cursor-pointer hover:bg-[#c9181f]"
                                  title="ลบรูปภาพ"
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handlePhotoClick(idx)}
                                className="px-2 py-1.5 border border-dashed border-gray-300 text-gray-500 hover:border-[#e51c23] hover:text-[#e51c23] flex items-center gap-1.5 text-xs font-semibold mx-auto cursor-pointer transition-colors"
                              >
                                <Camera size={14} /> เพิ่มรูป
                              </button>
                            )
                          ) : itemEvidenceUrl.trim() ? (
                            <a
                              href={itemEvidenceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block group"
                              title="ดูรูปภาพหลักฐานขนาดใหญ่"
                            >
                              <img
                                src={itemEvidenceUrl}
                                alt="หลักฐาน"
                                className="w-10 h-10 object-cover border border-gray-200 group-hover:scale-110 transition-transform"
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center pr-5">
                          {isEditing ? (
                            <select
                              value={item.status || itemStatus || 'Pending'}
                              onChange={e => handleItemChange(idx, 'status', e.target.value)}
                              className={`border px-2 py-1 text-xs font-bold focus:outline-none rounded-none cursor-pointer ${
                                (item.status || itemStatus || '').toUpperCase() === 'APPROVED'
                                  ? 'border-[#259b24]/30 bg-[#259b24]/10 text-[#259b24]'
                                  : (item.status || itemStatus || '').toUpperCase() === 'REJECTED'
                                  ? 'border-red-200 bg-red-50 text-[#e51c23]'
                                  : 'border-gray-300 bg-white text-[#1C1B1B]'
                              }`}
                            >
                              <option value="Approved">อนุมัติแล้ว</option>
                              <option value="Rejected">ปฏิเสธ</option>
                              <option value="Pending">รอดำเนินการ</option>
                            </select>
                          ) : itemStatusUp === 'APPROVED' ? (
                            <Badge variant="success" size="sm">อนุมัติแล้ว</Badge>
                          ) : itemStatusUp === 'REJECTED' ? (
                            <Badge variant="error" size="sm">ปฏิเสธ</Badge>
                          ) : (
                            <Badge variant="warning" size="sm">รอดำเนินการ</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="p-8 text-center text-[#5F5E5E]">
                <Package size={28} className="mx-auto mb-2 text-gray-300" />
                <p className="text-xs text-[#5F5E5E] mt-1">ไม่มีรายการสินค้า</p>
              </div>
            )}
          </div>

          {/* Action buttons at the bottom when editing */}
          {isEditing && (
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={cancelEditing}
                disabled={saving}
                className="border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-60 flex items-center gap-2 shadow-xs font-bold h-10 px-5 rounded-none text-sm shrink-0 cursor-pointer bg-white transition-colors"
              >
                <X size={16} /> ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="bg-[#e51c23] hover:bg-[#c9181f] disabled:opacity-60 text-white flex items-center gap-2 shadow-sm font-bold h-10 px-6 rounded-none text-sm shrink-0 cursor-pointer transition-colors"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
              </button>
            </div>
          )}



      </div>

      {/* Printable Document */}
      <div className="hidden print:block font-sans text-slate-900 p-0">
        <style>{`
          @media print {
            @page {
              size: A4 portrait;
              margin: 12mm 10mm;
            }
            body * { visibility: hidden; }
            #printable-claim-detail, #printable-claim-detail * { visibility: visible; }
            #printable-claim-detail {
              position: absolute; left: 0; top: 0; width: 100%; padding: 0;
              background: white; color: black; font-size: 12px;
            }
          }
        `}</style>
        <div id="printable-claim-detail">
          <div className="border-b-2 border-slate-800 pb-3 mb-4 flex justify-between items-start">
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">AutoParts Retail Management</h1>
              <h2 className="text-sm font-bold text-slate-700 mt-0.5">ใบขอเคลม / อนุมัติเคลมสินค้า</h2>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p className="font-bold text-slate-800">วันที่พิมพ์</p>
              <p>{new Date().toLocaleDateString('th-TH')}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4 text-xs">
            <div>
              <p className="font-bold text-slate-800">เลขที่ใบเคลม</p>
              <p>{claimNo}</p>
            </div>
            <div>
              <p className="font-bold text-slate-800">ลูกค้า</p>
              <p>{claim.customer_name || parseNote(claim.notes || claim.note, 'ลูกค้า')}</p>
            </div>
            <div>
              <p className="font-bold text-slate-800">เบอร์โทร</p>
              <p>{claim.customer_phone || parseNote(claim.notes || claim.note, 'โทร')}</p>
            </div>
          </div>

          <table className="w-full border-collapse border border-slate-300 text-xs mb-4">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                <th className="border border-slate-300 p-2 text-left">สินค้า</th>
                <th className="border border-slate-300 p-2 text-center w-28">ประเภทเคลม</th>
                <th className="border border-slate-300 p-2 text-center w-24">จำนวน</th>
                <th className="border border-slate-300 p-2 text-left">สาเหตุที่เคลม</th>
                <th className="border border-slate-300 p-2 text-center w-28">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const approvedItems = (claim.items ?? []).filter(item => (item.status ?? 'PENDING').toUpperCase() === 'APPROVED');
                // ถ้ายังไม่มี item ไหนเป็น APPROVED แต่หัวใบเคลมเป็น APPROVED ให้แสดงทั้งหมด
                const displayItems = approvedItems.length > 0
                  ? approvedItems
                  : (claim.status ?? '').toUpperCase() === 'APPROVED'
                  ? (claim.items ?? [])
                  : [];

                if (displayItems.length === 0) {
                  return (
                    <tr>
                      <td colSpan={5} className="border border-slate-300 p-4 text-center text-slate-500 font-medium">
                        ยังไม่มีรายการสินค้าที่ได้รับการอนุมัติให้เคลม
                      </td>
                    </tr>
                  );
                }

                return displayItems.map(item => {
                  const itemClaimType = item.claim_type || claim.claim_type || 'INSTANT';
                  return (
                    <tr key={item.id} className="border-b border-slate-200">
                      <td className="border border-slate-300 p-2 font-medium">{item.product_name || `#${item.product_id}`}</td>
                      <td className="border border-slate-300 p-2 text-center">
                        {itemClaimType === 'SUPPLIER_PENDING' ? 'ส่งบริษัท' : itemClaimType === 'CREDIT_ACCOUNT' ? 'ลงบัญชีเชื่อ' : 'เปลี่ยนทันที'}
                      </td>
                      <td className="border border-slate-300 p-2 text-center font-bold">{item.qty}</td>
                      <td className="border border-slate-300 p-2">{item.reason}</td>
                      <td className="border border-slate-300 p-2 text-center font-bold text-[#259b24]">อนุมัติเคลม</td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
