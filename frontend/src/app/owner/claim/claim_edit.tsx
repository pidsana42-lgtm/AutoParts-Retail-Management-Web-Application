import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ChevronRight, Save, Loader2, Package, Camera, X,
  UserCheck, Clock, UserX, Truck, SendHorizonal, CheckCircle2, XCircle, AlertCircle
} from 'lucide-react';
import Heading from '../../../components/elements/heading';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/elements/table';
import { getCustomerClaimById, updateCustomerClaim } from '../../../service/http/claim/claim';
import apiClient from '../../../service/http/apiClient';
import type { CustomerClaim, CustomerClaimItem } from '../../../interface/claim/claim';

interface ClaimEditPageProps {
  canApprove?: boolean;
}

interface EditableItem extends CustomerClaimItem {
  newFile?: File | null;
  newPreview?: string | null;
}

export default function ClaimEditPage({ canApprove = true }: ClaimEditPageProps): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [claim, setClaim] = useState<CustomerClaim | null>(null);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<EditableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeItemIdx, setActiveItemIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Operation fields state ────────────────────────────────────────────────────
  const [customerReceivedItem, setCustomerReceivedItem] = useState<boolean | null>(null);
  const [customerWaiting, setCustomerWaiting] = useState<boolean>(false);
  const [supplierResponseStatus, setSupplierResponseStatus] = useState<'WAITING' | 'APPROVED' | 'REJECTED' | null>(null);
  const [operationNote, setOperationNote] = useState('');

  const backPath = window.location.pathname.startsWith('/employee') ? '/employee/claims' : '/owner/claims';

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        setLoading(true);
        const data = await getCustomerClaimById(Number(id));
        setClaim(data);
        setNotes(data.notes ?? '');
        setItems(data.items ? data.items.map(i => ({ ...i })) : []);
        // โหลด operation fields
        setCustomerReceivedItem(data.customer_received_item ?? null);
        setCustomerWaiting(data.customer_waiting ?? false);
        setSupplierResponseStatus(data.supplier_response_status ?? null);
        setOperationNote(data.operation_note ?? '');
      } catch (err) {
        console.error('Failed to load claim:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleItemChange = (idx: number, field: keyof EditableItem, value: any) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const handlePhotoClick = (idx: number) => {
    setActiveItemIdx(idx);
    fileInputRef.current?.click();
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || activeItemIdx === null) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('ไฟล์ภาพขนาดใหญ่เกินไป (สูงสุด 5MB)');
      return;
    }
    const preview = URL.createObjectURL(file);
    setItems(prev =>
      prev.map((item, i) => i === activeItemIdx ? { ...item, newFile: file, newPreview: preview } : item)
    );
    if (fileInputRef.current) fileInputRef.current.value = '';
    setActiveItemIdx(null);
  };

  const handleRemovePhoto = (idx: number) => {
    setItems(prev =>
      prev.map((item, i) => i === idx ? { ...item, evidence_url: '', newFile: null, newPreview: null } : item)
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claim?.id) return;
    try {
      setSaving(true);

      // อัพเดต claim header (notes + operation fields)
      await updateCustomerClaim(claim.id, {
        ...claim,
        notes,
        customer_received_item: customerReceivedItem ?? undefined,
        customer_waiting: customerWaiting,
        supplier_response_status: supplierResponseStatus ?? undefined,
        operation_note: operationNote || undefined,
      } as any);

      // อัพเดตแต่ละ item และรูปภาพ
      await Promise.all(
        items
          .filter(item => item.id)
          .map(async item => {
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
              }
            }
            return apiClient.put(`/claims/customer-claims/items/${item.id}`, {
              qty: item.qty,
              reason: item.reason,
              evidence_url: evidenceUrl,
            });
          })
      );

      navigate(`${backPath}/detail/${claim.id}`);
    } catch (err) {
      console.error('Failed to save claim:', err);
      alert('เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่');
    } finally {
      setSaving(false);
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
  const statusKey = (claim.status ?? '').toUpperCase();
  const canEdit = canApprove || statusKey === 'PENDING';

  return (
    <div className="p-8 max-w-full mx-auto w-full animate-in fade-in duration-300">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handlePhotoSelect}
      />
      <form onSubmit={handleSave} className="space-y-6">

        {/* Header */}
        <div className="pb-5 border-b border-gray-100">
          <nav className="flex items-center text-sm text-gray-500 gap-2 font-light mb-1">
            <Link to={backPath} className="hover:text-gray-900 transition-colors cursor-pointer">
              จัดการเคลมสินค้า
            </Link>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <Link to={`${backPath}/detail/${claim.id}`} className="hover:text-gray-900 transition-colors cursor-pointer">
              รายละเอียดใบเคลม ({claimNo})
            </Link>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <span className="text-black font-normal">แก้ไขใบเคลม</span>
          </nav>
          <Heading level="h1" className="mb-0 font-extrabold text-[#1C1B1B]">แก้ไขใบเคลมสินค้า</Heading>
          <p className="text-sm text-[#5F5E5E] mt-0.5 font-mono">{claimNo}</p>
        </div>

        {/* ข้อมูลหัวใบเคลม */}
        <div className="bg-white border border-gray-200">
          <div className="bg-gray-100 px-5 py-3 border-b border-gray-200">
            <p className="text-xs font-bold text-[#5F5E5E] uppercase tracking-wider">ข้อมูลใบเคลม</p>
          </div>
          <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-[#5F5E5E] font-bold mb-1">เลขที่ใบเคลม</p>
              <p className="font-bold text-[#e51c23] font-mono">{claimNo}</p>
            </div>
            <div>
              <p className="text-xs text-[#5F5E5E] font-bold mb-1">ลูกค้า</p>
              <p className="font-bold text-[#1C1B1B]">{(claim as any).customer_name || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-[#5F5E5E] font-bold mb-1">สถานะ</p>
              <p className="font-bold text-[#1C1B1B]">{statusKey === 'PENDING' ? 'รอดำเนินการ' : statusKey === 'APPROVED' ? 'อนุมัติแล้ว' : 'ปฏิเสธ'}</p>
            </div>
          </div>
        </div>

        {/* รายการสินค้า */}
        <div className="bg-white border border-gray-200">
          <div className="bg-gray-100 px-5 py-3 border-b border-gray-200 flex items-center justify-between">
            <p className="text-xs font-bold text-[#5F5E5E] uppercase tracking-wider">รายการสินค้าที่เคลม</p>
            <span className="text-xs font-bold text-[#1C1B1B]">{items.length} รายการ</span>
          </div>
          {items.length > 0 ? (
            <Table>
              <TableHeader className="bg-gray-50 text-[#5F5E5E]">
                <TableRow>
                  <TableHead className="pl-5">สินค้า</TableHead>
                  <TableHead className="text-center w-28">จำนวน</TableHead>
                  <TableHead>สาเหตุ</TableHead>
                  <TableHead className="text-center pr-5 w-32">รูปภาพหลักฐาน</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, idx) => {
                  const displayImg = item.newPreview || item.evidence_url || (item as any).evidenceUrl || (item as any).image_url || (item as any).imageUrl || (item as any).evidence || '';
                  return (
                    <TableRow key={idx} className="hover:bg-gray-50/50">
                      <TableCell className="pl-5 font-semibold text-[#1C1B1B] text-sm">
                        {item.product_name || `#${item.product_id}`}
                      </TableCell>
                      <TableCell className="text-center">
                        {canEdit ? (
                          <input
                            type="number"
                            min={1}
                            value={item.qty}
                            onChange={e => handleItemChange(idx, 'qty', Number(e.target.value))}
                            className="w-16 text-center border border-gray-300 px-2 py-1 text-sm font-bold focus:outline-none focus:border-[#e51c23]"
                          />
                        ) : (
                          <span className="font-bold text-[#e51c23]">{item.qty}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {canEdit ? (
                          <input
                            type="text"
                            value={item.reason}
                            onChange={e => handleItemChange(idx, 'reason', e.target.value)}
                            placeholder="ระบุสาเหตุ"
                            className="w-full border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:border-[#e51c23]"
                          />
                        ) : (
                          <span className="text-sm text-[#5F5E5E]">{item.reason}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center pr-5">
                        {displayImg ? (
                          <div className="relative inline-block">
                            <img
                              src={displayImg}
                              alt="หลักฐาน"
                              className="w-12 h-12 object-cover border border-gray-200 rounded-none cursor-pointer"
                              onClick={() => canEdit && handlePhotoClick(idx)}
                            />
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => handleRemovePhoto(idx)}
                                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white flex items-center justify-center rounded-full cursor-pointer hover:bg-red-600"
                                title="ลบรูปภาพ"
                              >
                                <X size={10} />
                              </button>
                            )}
                          </div>
                        ) : canEdit ? (
                          <button
                            type="button"
                            onClick={() => handlePhotoClick(idx)}
                            className="px-3 py-1.5 border border-dashed border-gray-300 text-gray-500 hover:border-[#e51c23] hover:text-[#e51c23] flex items-center gap-1.5 text-xs font-semibold mx-auto cursor-pointer transition-colors"
                          >
                            <Camera size={14} /> เพิ่มรูปภาพ
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">ไม่มีรูปภาพ</span>
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
              <p className="text-sm">ไม่มีรายการสินค้า</p>
            </div>
          )}
        </div>

        {/* สถานะการดำเนินงาน */}
        <div className="bg-white border border-gray-200">
          <div className="bg-[#22252a] px-5 py-3">
            <p className="text-xs font-bold text-white uppercase tracking-wider">อัพเดทสถานะการดำเนินงาน</p>
          </div>
          <div className="p-5 space-y-5">

            {/* สถานะส่งมอบของ */}
            <div>
              <p className="text-xs font-bold text-[#1C1B1B] mb-2">สถานะส่งมอบของให้ลูกค้า</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => { setCustomerReceivedItem(true); setCustomerWaiting(false); }}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border transition-all cursor-pointer rounded-none ${
                    customerReceivedItem === true
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400 hover:text-emerald-600'
                  }`}
                >
                  <UserCheck size={13} /> ลูกค้าได้รับของแล้ว
                </button>
                <button
                  type="button"
                  onClick={() => { setCustomerReceivedItem(false); setCustomerWaiting(true); }}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border transition-all cursor-pointer rounded-none ${
                    customerWaiting === true
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-amber-400 hover:text-amber-600'
                  }`}
                >
                  <Clock size={13} /> ลูกค้ารอผลอยู่ (ยังไม่รับของ)
                </button>
                <button
                  type="button"
                  onClick={() => { setCustomerReceivedItem(false); setCustomerWaiting(false); }}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border transition-all cursor-pointer rounded-none ${
                    customerReceivedItem === false && customerWaiting === false
                      ? 'bg-gray-600 text-white border-gray-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
                  }`}
                >
                  <UserX size={13} /> ยังไม่ได้ส่งมอบ
                </button>
              </div>
            </div>

            {/* สถานะบริษัท (เฉพาะ SUPPLIER_PENDING) */}
            {claim.claim_type === 'SUPPLIER_PENDING' && (
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-bold text-[#1C1B1B] mb-2 flex items-center gap-1.5">
                  <Truck size={13} className="text-[#e51c23]" />
                  สถานะการส่งบริษัท
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSupplierResponseStatus('WAITING')}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border transition-all cursor-pointer rounded-none ${
                      supplierResponseStatus === 'WAITING'
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-amber-400 hover:text-amber-600'
                    }`}
                  >
                    <SendHorizonal size={13} /> ส่งสินค้าให้บริษัทแล้ว (รอผล)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSupplierResponseStatus('APPROVED')}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border transition-all cursor-pointer rounded-none ${
                      supplierResponseStatus === 'APPROVED'
                        ? 'bg-emerald-500 text-white border-emerald-500'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400 hover:text-emerald-600'
                    }`}
                  >
                    <CheckCircle2 size={13} /> บริษัทอนุมัติเคลม
                  </button>
                  <button
                    type="button"
                    onClick={() => setSupplierResponseStatus('REJECTED')}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border transition-all cursor-pointer rounded-none ${
                      supplierResponseStatus === 'REJECTED'
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-red-500 hover:text-red-600'
                    }`}
                  >
                    <XCircle size={13} /> บริษัทปฏิเสธเคลม
                  </button>
                </div>
                {supplierResponseStatus === 'REJECTED' && (
                  <div className="mt-2 px-3 py-2 text-xs font-semibold border border-red-200 bg-red-50 text-red-700 flex items-center gap-2 w-fit">
                    <AlertCircle size={12} /> บริษัทปฏิเสธ — ลูกค้าต้องซื้อสินค้าใหม่
                  </div>
                )}
              </div>
            )}

            {/* บันทึกการดำเนินงาน */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-bold text-[#5F5E5E] mb-2">บันทึกการดำเนินงานเพิ่มเติม</p>
              <textarea
                value={operationNote}
                onChange={e => setOperationNote(e.target.value)}
                rows={2}
                placeholder="เช่น: โทรแจ้งลูกค้าแล้ว, รอบริษัทติดต่อกลับ..."
                className="w-full border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:border-[#e51c23] resize-none"
              />
            </div>

          </div>
        </div>

        {/* หมายเหตุ */}
        <div className="bg-white border border-gray-200 p-5">
          <p className="text-xs font-bold text-[#5F5E5E] uppercase tracking-wider mb-3">หมายเหตุ / สาเหตุความเสียหาย</p>
          {canEdit ? (
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder="ระบุหมายเหตุเพิ่มเติม..."
              className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#e51c23] resize-none"
            />
          ) : (
            <div className="bg-gray-50 border border-gray-200 p-4 text-sm text-[#1C1B1B]">
              {notes || 'ไม่มีหมายเหตุ'}
            </div>
          )}
        </div>

        {/* ปุ่มบันทึกการแก้ไขด้านล่าง */}
        {canEdit ? (
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate(`${backPath}/detail/${claim.id}`)}
              className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold transition-colors cursor-pointer rounded-none"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-7 py-2.5 bg-[#e51c23] hover:bg-[#c9181f] disabled:opacity-60 text-white text-sm font-bold shadow-sm transition-colors cursor-pointer rounded-none"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
            </button>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 font-medium">
            ใบเคลมนี้ดำเนินการเสร็จสิ้นแล้ว ไม่สามารถแก้ไขได้
          </div>
        )}

      </form>
    </div>
  );
}
