import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ChevronRight, Save, Loader2, Package, Camera, X,
} from 'lucide-react';
import Heading from '../../../components/elements/heading';
import Button from '../../../components/elements/button';
import Badge from '../../../components/elements/badge';
import Input from '../../../components/elements/input';
import Select from '../../../components/elements/select';
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

const parseNote = (note: string | undefined, key: string): string => {
  if (!note) return '-';
  const match = note.match(new RegExp(`${key}:\\s*([^|]+)`));
  return match ? match[1].trim() : '-';
};

const CLAIM_TYPE_OPTIONS = [
  { value: 'INSTANT', label: 'เปลี่ยนทันที' },
  { value: 'SUPPLIER_PENDING', label: 'ส่งบริษัท' },
  { value: 'CREDIT_ACCOUNT', label: 'ลงบัญชีเชื่อ' },
];

const ITEM_STATUS_OPTIONS = [
  { value: 'Approved', label: 'อนุมัติ' },
  { value: 'Pending', label: 'รอดำเนินการ' },
  { value: 'Rejected', label: 'ปฏิเสธ' },
];

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
      <div className="p-8 flex justify-center items-center min-h-screen bg-white">
        <Loader2 size={28} className="text-[#d61c24] animate-spin" />
        <span className="ml-3 text-sm text-[#5F5E5E] font-medium">กำลังโหลดข้อมูล...</span>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="p-8 text-center min-h-screen bg-white py-24">
        <p className="text-[#5F5E5E] font-semibold">ไม่พบข้อมูลใบเคลม</p>
      </div>
    );
  }

  const claimNo = claim.claim_no ?? `CLM-${claim.id}`;
  const statusKey = (claim.status ?? '').toUpperCase();
  const canEdit = canApprove || statusKey === 'PENDING';
  const customerName = claim.customer_name && claim.customer_name !== '-'
    ? claim.customer_name
    : parseNote(claim.notes || claim.note, 'ลูกค้า');
  const customerPhone = (claim as any).customer_phone || parseNote(claim.notes || claim.note, 'โทร');

  return (
    <div className="p-8 space-y-6 bg-white min-h-screen font-sans text-slate-800 animate-in fade-in duration-300">
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
          <nav className="flex items-center text-sm text-gray-500 gap-2 font-light mb-2">
            <Link to={backPath} className="hover:text-black transition-colors cursor-pointer">
              จัดการเคลมสินค้า
            </Link>
            <ChevronRight size={16} className="text-gray-400" />
            <Link to={`${backPath}/detail/${claim.id}`} className="hover:text-black transition-colors cursor-pointer">
              รายละเอียดใบเคลมสินค้า
            </Link>
            <ChevronRight size={16} className="text-gray-400" />
            <span className="text-black font-normal">แก้ไขใบเคลมสินค้า</span>
          </nav>
          <div className="flex items-center gap-3">
            <Heading level="h1" className="mb-0 font-bold text-[#1C1B1B]">แก้ไขใบเคลมสินค้า</Heading>
            <span className="text-base font-semibold text-[#d61c24] font-mono">{claimNo}</span>
          </div>
        </div>

        {/* ข้อมูลหัวใบเคลม */}
        <div className="bg-white border border-gray-200">
          <div className="bg-[#F6F3F2] px-5 py-3 border-b border-gray-200 flex items-center justify-between">
            <span className="text-sm font-semibold text-[#5F5E5E] uppercase tracking-wider">ข้อมูลใบเคลม</span>
            <span className="text-sm text-gray-500 font-normal">{claimNo}</span>
          </div>
          <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
            <div>
              <p className="text-xs text-[#5F5E5E] font-medium mb-1">เลขที่ใบเคลม</p>
              <p className="font-semibold text-[#d61c24] font-mono text-base">{claimNo}</p>
            </div>
            <div>
              <p className="text-xs text-[#5F5E5E] font-medium mb-1">ลูกค้า</p>
              <p className="font-semibold text-[#1C1B1B]">{customerName || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-[#5F5E5E] font-medium mb-1">เบอร์โทรศัพท์</p>
              <p className="font-semibold text-[#1C1B1B]">{customerPhone || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-[#5F5E5E] font-medium mb-1">สถานะใบเคลม</p>
              <div>
                {statusKey === 'APPROVED' ? (
                  <Badge variant="success" size="sm">อนุมัติแล้ว</Badge>
                ) : statusKey === 'REJECTED' ? (
                  <Badge variant="error" size="sm">ปฏิเสธ</Badge>
                ) : (
                  <Badge variant="warning" size="sm">รอดำเนินการ</Badge>
                )}
              </div>
            </div>
          </div>
          {/* Notes field */}
          <div className="px-5 pb-5 pt-1 border-t border-gray-100">
            <label className="block text-xs font-medium text-[#5F5E5E] mb-1.5">
              หมายเหตุเพิ่มเติม (Notes)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="ระบุหมายเหตุเพิ่มเติมสำหรับใบเคลมนี้..."
              className="w-full bg-[#f6f3f2] p-3 text-sm text-black border-none focus:outline-none focus:ring-1 focus:ring-red-600 rounded-none resize-none placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* รายการสินค้า */}
        <div className="bg-white border border-gray-200 overflow-x-auto">
          <div className="bg-white px-5 py-3 border-b border-gray-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-[#5F5E5E] uppercase tracking-wider">รายการสินค้าที่เคลม</span>
            <span className="text-xs font-medium text-gray-600 bg-white px-2.5 py-0.5 border border-gray-200">{items.length} รายการ</span>
          </div>
          {items.length > 0 ? (
            <Table className="min-w-220">
              <TableHeader className="bg-[#F6F3F2] text-[#797878] text-sm font-semibold">
                <TableRow className="border-b border-gray-200">
                  <TableHead className="pl-6 py-3 uppercase tracking-widest">สินค้า</TableHead>
                  <TableHead className="text-center w-40 py-3 uppercase tracking-widest">ประเภทเคลม</TableHead>
                  <TableHead className="text-center w-28 py-3 uppercase tracking-widest">จำนวน</TableHead>
                  <TableHead className="min-w-50 py-3 uppercase tracking-widest">สาเหตุ / อาการเสีย</TableHead>
                  <TableHead className="text-center w-32 py-3 uppercase tracking-widest">รูปภาพหลักฐาน</TableHead>
                  {canApprove && <TableHead className="text-center pr-6 w-40 py-3 uppercase tracking-widest">สถานะพิจารณา</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, idx) => {
                  const displayImg = item.newPreview || item.evidence_url || (item as any).evidenceUrl || (item as any).image_url || (item as any).imageUrl || (item as any).evidence || '';
                  const itemClaimType = item.claim_type || claim.claim_type || 'INSTANT';
                  const itemStatus = (item.status ?? 'Pending');
                  const itemStatusUp = itemStatus.toUpperCase();

                  return (
                    <TableRow key={idx} className="hover:bg-gray-50/70 border-t border-gray-100">
                      <TableCell className="pl-6 py-3.5 align-middle">
                        <p className="font-medium text-[#1C1B1B] text-sm">
                          {item.product_name || `#${item.product_id}`}
                        </p>
                        {item.product_code && (
                          <p className="text-xs text-gray-400 mt-0.5">{item.product_code}</p>
                        )}
                      </TableCell>

                      {/* ประเภทเคลม */}
                      <TableCell className="py-3.5 align-middle">
                        {canEdit ? (
                          <Select
                            value={item.claim_type || itemClaimType}
                            options={CLAIM_TYPE_OPTIONS}
                            onChange={e => handleItemChange(idx, 'claim_type', e.target.value)}
                            className="h-9 text-sm"
                          />
                        ) : (
                          <div className="text-center">
                            {itemClaimType === 'SUPPLIER_PENDING' ? (
                              <Badge variant="neutral" size="md">ส่งบริษัท</Badge>
                            ) : itemClaimType === 'CREDIT_ACCOUNT' ? (
                              <Badge variant="info" size="md">ลงบัญชีเชื่อ</Badge>
                            ) : (
                              <Badge variant="primary" size="md">เปลี่ยนทันที</Badge>
                            )}
                          </div>
                        )}
                      </TableCell>

                      {/* จำนวน */}
                      <TableCell className="text-center py-3.5 align-middle">
                        {canEdit ? (
                          <div className="flex items-center justify-center">
                            <Input
                              type="number"
                              min={1}
                              value={item.qty}
                              onChange={e => handleItemChange(idx, 'qty', Math.max(1, Number(e.target.value) || 1))}
                              className="h-9 text-xs text-center w-20"
                            />
                          </div>
                        ) : (
                          <span className="font-medium text-[#1C1B1B] text-sm">{item.qty} ชิ้น</span>
                        )}
                      </TableCell>

                      {/* สาเหตุการเคลม */}
                      <TableCell className="py-3.5 align-middle">
                        {canEdit ? (
                          <Input
                            type="text"
                            value={item.reason || ''}
                            onChange={e => handleItemChange(idx, 'reason', e.target.value)}
                            placeholder="ระบุสาเหตุ / อาการเสียที่พบ..."
                            className="h-9 text-xs"
                          />
                        ) : (
                          <span className="text-sm text-[#1C1B1B]">{item.reason || '-'}</span>
                        )}
                      </TableCell>

                      {/* รูปภาพหลักฐาน */}
                      <TableCell className="text-center py-3.5 align-middle">
                        {displayImg ? (
                          <div className="relative inline-block">
                            <img
                              src={displayImg}
                              alt="หลักฐาน"
                              className="w-12 h-12 object-cover border border-gray-200 rounded-none cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => canEdit && handlePhotoClick(idx)}
                              title="คลิกเพื่อเปลี่ยนรูปภาพ"
                            />
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => handleRemovePhoto(idx)}
                                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#d61c24] text-white flex items-center justify-center rounded-full cursor-pointer hover:bg-[#b0141b] transition-colors"
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
                            className="px-2.5 py-1.5 border border-dashed border-gray-300 text-gray-500 hover:border-[#d61c24] hover:text-[#d61c24] bg-white flex items-center gap-1 text-xs mx-auto cursor-pointer transition-colors"
                          >
                            <Camera size={13} /> แนบรูป
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">ไม่มีรูปภาพ</span>
                        )}
                      </TableCell>

                      {/* สถานะ / การอนุมัติ */}
                      {canApprove && (
                        <TableCell className="text-center pr-6 py-3.5 align-middle">
                          {canEdit ? (
                            <Select
                              value={item.status || 'Pending'}
                              options={ITEM_STATUS_OPTIONS}
                              onChange={e => handleItemChange(idx, 'status', e.target.value)}
                              className="h-9 text-xs"
                            />
                          ) : itemStatusUp === 'APPROVED' ? (
                            <Badge variant="success" size="sm">อนุมัติแล้ว</Badge>
                          ) : itemStatusUp === 'REJECTED' ? (
                            <Badge variant="error" size="sm">ปฏิเสธ</Badge>
                          ) : (
                            <Badge variant="warning" size="sm">รอดำเนินการ</Badge>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-12 text-center text-[#5F5E5E]">
              <Package size={32} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm">ไม่มีรายการสินค้าในใบเคลมนี้</p>
            </div>
          )}
        </div>

        {/* ปุ่มบันทึกการแก้ไขด้านล่าง */}
        {canEdit ? (
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline-cancel"
              size="md"
              onClick={() => navigate(`${backPath}/detail/${claim.id}`)}
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={saving}
              isLoading={saving}
              leftIcon={<Save size={16} />}
            >
              บันทึกการแก้ไข
            </Button>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 px-5 py-3.5 text-sm text-amber-800 font-medium">
            ใบเคลมนี้ดำเนินการเสร็จสิ้นแล้ว ไม่สามารถแก้ไขได้
          </div>
        )}

      </form>
    </div>
  );
}

