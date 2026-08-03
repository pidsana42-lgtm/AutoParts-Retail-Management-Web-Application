import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, CheckCircle2, XCircle,
  Calendar, Hash, User, Package, Camera, Loader2
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContexts';
import Heading from '../../../components/elements/heading';
import Badge from '../../../components/elements/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/elements/table';
import Button from '../../../components/elements/button';
import { getCustomerClaimById, updateClaimItemStatus } from '../../../service/http/claim/claim';
import type { CustomerClaim } from '../../../interface/claim/claim';

const parseNote = (note: string | undefined, key: string): string => {
  if (!note) return '-';
  const match = note.match(new RegExp(`${key}:\\s*([^|]+)`));
  return match ? match[1].trim() : '-';
};


const extractEvidenceImages = (claim: CustomerClaim | null): { url: string; productName: string }[] => {
  if (!claim?.items) return [];
  return claim.items
    .filter(item => item.evidence_url && item.evidence_url.trim() !== '')
    .map(item => ({
      url: item.evidence_url!,
      productName: item.product_name || `#${item.product_id}`,
    }));
};

export default function ClaimDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useAuth() as any;
  const isManager = role?.toUpperCase() === 'OWNER' || role?.toUpperCase() === 'ADMIN';

  const [claim, setClaim] = useState<CustomerClaim | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingItemId, setUpdatingItemId] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        setLoading(true);
        const data = await getCustomerClaimById(Number(id));
        setClaim(data);
      } catch (err) {
        console.error('Failed to load claim:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleItemStatusUpdate = async (itemId: number, newStatus: 'Approved' | 'Rejected') => {
    if (!itemId) return;
    try {
      setUpdatingItemId(itemId);
      await updateClaimItemStatus(itemId, newStatus);
      setClaim(prev => prev ? {
        ...prev,
        items: prev.items?.map(item =>
          item.id === itemId ? { ...item, status: newStatus } : item
        ),
      } : prev);
    } catch (err) {
      console.error('Failed to update item status:', err);
      alert('เกิดข้อผิดพลาดในการอัปเดตสถานะสินค้า กรุณาลองใหม่');
    } finally {
      setUpdatingItemId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center min-h-[300px]">
        <Loader2 size={28} className="text-[#e51c23] animate-spin" />
        <span className="ml-3 text-sm text-[#5F5E5E] font-medium">กำลังโหลดข้อมูลใบเคลม...</span>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-[#5F5E5E] font-bold">ไม่พบข้อมูลใบเคลมสินค้าที่คุณระบุ</p>
        <Button onClick={() => navigate('/owner/claims')} variant="outline" className="rounded-none">กลับหน้าหลัก</Button>
      </div>
    );
  }

  const totalQty  = claim.items?.reduce((s, i) => s + i.qty, 0) ?? 0;
  const claimNo   = claim.claim_no ?? `CLM-${claim.id}`;
  const orderRef  = claimNo.startsWith('CLM-') ? claimNo.replace('CLM-', '') : `#${claim.original_order_id}`;
  const basePath       = window.location.pathname.startsWith('/employee') ? '/employee/claims' : '/owner/claims';
  const evidenceImages = extractEvidenceImages(claim);

  return (
    <div className="p-8 max-w-full mx-auto w-full animate-in fade-in duration-300">

      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(basePath)}
            className="p-1.5 hover:bg-gray-100 transition-colors cursor-pointer rounded-none"
          >
            <ChevronLeft size={22} className="text-[#5F5E5E]" />
          </button>
          <div>
            <Heading level="h1" className="mb-0 font-extrabold text-[#1C1B1B]">
              รายละเอียดใบเคลมสินค้า
            </Heading>
            <p className="text-sm text-[#5F5E5E] mt-0.5 font-mono">{claimNo}</p>
          </div>
        </div>

        <div />
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

          {/* Items table */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="bg-gray-100 px-5 py-3 border-b border-gray-200 flex items-center justify-between">
              <p className="text-xs font-bold text-[#5F5E5E] uppercase tracking-wider">สินค้าที่เคลม</p>
              <span className="text-xs font-bold text-[#1C1B1B]">รวม {totalQty} ชิ้น</span>
            </div>

            {(claim.items?.length ?? 0) > 0 ? (
              <Table>
                <TableHeader className="bg-gray-50 text-[#5F5E5E]">
                  <TableRow>
                    <TableHead className="pl-5">สินค้า</TableHead>
                    <TableHead className="text-center w-24">จำนวน</TableHead>
                    <TableHead>สาเหตุ</TableHead>
                    <TableHead className="text-center w-32">สถานะ</TableHead>
                    {isManager && <TableHead className="text-center pr-5 w-28">จัดการ</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody className="text-gray-700">
                  {claim.items!.map((item, idx) => {
                    const itemStatus = (item.status ?? 'Pending');
                    const itemStatusUp = itemStatus.toUpperCase();
                    const isUpdating = updatingItemId === item.id;
                    return (
                      <TableRow key={idx} className="hover:bg-gray-50/70">
                        <TableCell className="pl-5 font-bold text-[#1C1B1B]">
                          {item.product_name || `#${item.product_id}`}
                        </TableCell>
                        <TableCell className="text-center font-bold text-[#e51c23]">{item.qty} ชิ้น</TableCell>
                        <TableCell className="text-[#5F5E5E] text-sm">{item.reason}</TableCell>
                        <TableCell className="text-center">
                          {itemStatusUp === 'APPROVED' ? (
                            <Badge variant="success" size="sm">อนุมัติแล้ว</Badge>
                          ) : itemStatusUp === 'REJECTED' ? (
                            <Badge variant="error" size="sm">ปฏิเสธ</Badge>
                          ) : (
                            <Badge variant="warning" size="sm">รอดำเนินการ</Badge>
                          )}
                        </TableCell>
                        {isManager && (
                          <TableCell className="text-center pr-5">
                            {itemStatusUp === 'PENDING' ? (
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => item.id && handleItemStatusUpdate(item.id, 'Approved')}
                                  disabled={isUpdating}
                                  className="text-emerald-600 hover:text-emerald-800 disabled:opacity-40 transition-colors cursor-pointer"
                                  title="อนุมัติ"
                                >
                                  {isUpdating ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                                </button>
                                <button
                                  onClick={() => item.id && handleItemStatusUpdate(item.id, 'Rejected')}
                                  disabled={isUpdating}
                                  className="text-gray-400 hover:text-red-600 disabled:opacity-40 transition-colors cursor-pointer"
                                  title="ปฏิเสธ"
                                >
                                  <XCircle size={18} />
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-[#5F5E5E]">—</span>
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
                <p className="text-xs text-[#5F5E5E] mt-1">ไม่มีรายการสินค้า</p>
              </div>
            )}
          </div>

          {/* Notes / damage description */}
          <div className="bg-white border border-gray-200 p-5">
            <p className="text-xs font-bold text-[#5F5E5E] uppercase tracking-wider mb-3">หมายเหตุ / สาเหตุความเสียหาย</p>
            <div className="bg-gray-50 border border-gray-200 p-4 text-sm text-[#1C1B1B] font-medium italic">
              "{claim.notes || claim.note || 'ไม่มีหมายเหตุเพิ่มเติม'}"
            </div>

            <div className="mt-4">
              <p className="text-xs text-[#5F5E5E] font-bold mb-2">รูปภาพหลักฐาน ({evidenceImages.length})</p>
              {evidenceImages.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {evidenceImages.map((img, idx) => (
                    <a
                      key={idx}
                      href={img.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block group border border-gray-200 overflow-hidden bg-black/5"
                    >
                      <img
                        src={img.url}
                        alt={`หลักฐาน ${img.productName}`}
                        className="h-28 w-full object-cover group-hover:scale-105 transition-transform"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <p className="text-[10px] text-[#5F5E5E] font-medium px-1.5 py-1 truncate bg-gray-50">
                        {img.productName}
                      </p>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="h-24 bg-gray-50 border border-gray-200 flex items-center justify-center text-[#5F5E5E] w-40">
                  <span className="text-[10px] flex items-center gap-1 font-medium">
                    <Camera size={13} /> ยังไม่มีรูปภาพแนบ
                  </span>
                </div>
              )}
            </div>
          </div>

      </div>
    </div>
  );
}
