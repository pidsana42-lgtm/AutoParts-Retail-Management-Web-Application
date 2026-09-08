import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ChevronRight, Save, Loader2, Package, Camera, X,
} from 'lucide-react';
import Heading from '../../../components/elements/heading';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/elements/table';
import { getCustomerClaimById, updateCustomerClaim } from '../../../service/http/claim/claim';
import apiClient from '../../../service/http/apiClient';
import type { CustomerClaim, CustomerClaimItem } from '../../../interface/claim/claim';
import { useToast } from '../../../components/elements/toast';

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
  const { toast } = useToast();

  const [claim, setClaim] = useState<CustomerClaim | null>(null);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<EditableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeItemIdx, setActiveItemIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      } catch (err) {
        console.error('Failed to load claim:', err);
        toast({ variant: 'error', message: 'ไม่สามารถโหลดข้อมูลใบเคลมได้' });
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
      toast({ variant: 'warning', message: 'ไฟล์ภาพขนาดใหญ่เกินไป (สูงสุด 5MB)' });
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

      // อัพเดต claim header (notes)
      await updateCustomerClaim(claim.id, {
        ...claim,
        notes,
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
                toast({ variant: 'warning', message: 'อัปโหลดรูปหลักฐานไม่สำเร็จ' });
              }
            }
            return apiClient.put(`/claims/customer-claims/items/${item.id}`, {
              qty: item.qty,
              reason: item.reason,
              claim_type: item.claim_type,
              status: item.status,
              evidence_url: evidenceUrl,
            });
          })
      );

      // คำนวณสถานะรวมของใบเคลม
      if (canApprove && items.length > 0) {
        const anyApproved = items.some(i => (i.status ?? '').toLowerCase() === 'approved');
        const anyPending = items.some(i => !i.status || i.status.toLowerCase() === 'pending');
        const allRejected = items.every(i => (i.status ?? '').toLowerCase() === 'rejected');

        let newOverallStatus = 'Pending';
        if (allRejected) {
          newOverallStatus = 'Rejected';
        } else if (anyApproved && !anyPending) {
          newOverallStatus = 'Approved';
        } else if (anyApproved) {
          newOverallStatus = 'Approved';
        }

        await updateCustomerClaim(claim.id, {
          ...claim,
          notes,
          status: newOverallStatus,
        } as any);
      } else {
        await updateCustomerClaim(claim.id, {
          ...claim,
          notes,
        } as any);
      }

      toast({ variant: 'success', message: 'แก้ไขใบเคลมเรียบร้อยแล้ว' });
      navigate(`${backPath}/detail/${claim.id}`);
    } catch (err) {
      console.error('Failed to save claim:', err);
      toast({ variant: 'error', message: 'เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center min-h-75">
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
                  <TableHead className="text-center w-36">ประเภทเคลม</TableHead>
                  <TableHead className="text-center w-24">จำนวน</TableHead>
                  <TableHead className="min-w-55">หมายเหตุ / สาเหตุการเคลม</TableHead>
                  <TableHead className="text-center w-28">รูปภาพหลักฐาน</TableHead>
                  {canApprove && <TableHead className="text-center pr-5 w-36">สถานะ</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, idx) => {
                  const displayImg = item.newPreview || item.evidence_url || (item as any).evidenceUrl || (item as any).image_url || (item as any).imageUrl || (item as any).evidence || '';
                  const itemClaimType = item.claim_type || claim.claim_type || 'INSTANT';
                  const itemStatus = (item.status ?? 'Pending');
                  const itemStatusUp = itemStatus.toUpperCase();

                  return (
                    <TableRow key={idx} className="hover:bg-gray-50/50">
                      <TableCell className="pl-5 font-semibold text-[#1C1B1B] text-sm">
                        {item.product_name || `#${item.product_id}`}
                      </TableCell>

                      {/* ประเภทเคลม */}
                      <TableCell className="text-center">
                        {canEdit ? (
                          <select
                            value={item.claim_type || itemClaimType || 'INSTANT'}
                            onChange={e => handleItemChange(idx, 'claim_type', e.target.value)}
                            className="border border-gray-300 px-2 py-1.5 text-xs font-bold text-[#1C1B1B] bg-white focus:outline-none focus:border-[#e51c23] rounded-none cursor-pointer"
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

                      {/* จำนวน */}
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

                      {/* สาเหตุการเคลม */}
                      <TableCell>
                        {canEdit ? (
                          <input
                            type="text"
                            value={item.reason}
                            onChange={e => handleItemChange(idx, 'reason', e.target.value)}
                            placeholder="ระบุหมายเหตุ / สาเหตุการเคลม..."
                            className="w-full border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:border-[#e51c23]"
                          />
                        ) : (
                          <span className="text-sm text-[#1C1B1B] font-medium">{item.reason || '-'}</span>
                        )}
                      </TableCell>

                      {/* รูปภาพหลักฐาน */}
                      <TableCell className="text-center">
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
                                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#e51c23] text-white flex items-center justify-center rounded-full cursor-pointer hover:bg-[#c9181f]"
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

                      {/* สถานะ / การอนุมัติ */}
                      {canApprove && (
                        <TableCell className="text-center pr-5">
                          {canEdit ? (
                            <select
                              value={item.status || 'Pending'}
                              onChange={e => handleItemChange(idx, 'status', e.target.value)}
                              className={`border px-2 py-1.5 text-xs font-bold focus:outline-none rounded-none cursor-pointer ${
                                itemStatusUp === 'APPROVED'
                                  ? 'border-[#259b24]/30 bg-[#259b24]/10 text-[#259b24]'
                                  : itemStatusUp === 'REJECTED'
                                  ? 'border-red-200 bg-red-50 text-[#e51c23]'
                                  : 'border-amber-300 bg-amber-50 text-amber-800'
                              }`}
                            >
                              <option value="Approved">อนุมัติ</option>
                              <option value="Pending">รอดำเนินการ</option>
                              <option value="Rejected">ปฏิเสธ</option>
                            </select>
                          ) : itemStatusUp === 'APPROVED' ? (
                            <span className="text-xs font-bold text-[#259b24]">อนุมัติแล้ว</span>
                          ) : itemStatusUp === 'REJECTED' ? (
                            <span className="text-xs font-bold text-[#e51c23]">ปฏิเสธ</span>
                          ) : (
                            <span className="text-xs font-bold text-amber-600">รอดำเนินการ</span>
                          )}
                        </TableCell>
                      )}
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
