import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Save, Loader2, Package
} from 'lucide-react';
import Heading from '../../../components/elements/heading';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/elements/table';
import { getCustomerClaimById, updateCustomerClaim } from '../../../service/http/claim/claim';
import apiClient from '../../../service/http/apiClient';
import type { CustomerClaim, CustomerClaimItem } from '../../../interface/claim/claim';

interface ClaimEditPageProps {
  canApprove?: boolean;
}

export default function ClaimEditPage({ canApprove = true }: ClaimEditPageProps): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [claim, setClaim] = useState<CustomerClaim | null>(null);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<CustomerClaimItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleItemChange = (idx: number, field: keyof CustomerClaimItem, value: string | number) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claim?.id) return;
    try {
      setSaving(true);

      // อัพเดต claim header (notes)
      await updateCustomerClaim(claim.id, { ...claim, notes } as any);

      // อัพเดตแต่ละ item
      await Promise.all(
        items
          .filter(item => item.id)
          .map(item =>
            apiClient.put(`/claims/customer-claims/items/${item.id}`, {
              qty: item.qty,
              reason: item.reason,
              resolution: item.resolution,
            })
          )
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
      <form onSubmit={handleSave} className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between pb-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(`${backPath}/detail/${claim.id}`)}
              className="p-1.5 hover:bg-gray-100 transition-colors cursor-pointer rounded-none"
            >
              <ChevronLeft size={22} className="text-[#5F5E5E]" />
            </button>
            <div>
              <Heading level="h1" className="mb-0 font-extrabold text-[#1C1B1B]">แก้ไขใบเคลมสินค้า</Heading>
              <p className="text-sm text-[#5F5E5E] mt-0.5 font-mono">{claimNo}</p>
            </div>
          </div>
          {canEdit && (
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-[#e51c23] hover:bg-[#c9181f] disabled:opacity-60 text-white text-sm font-bold rounded-none transition-colors cursor-pointer"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          )}
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
                  <TableHead className="pr-5">วิธีแก้ไข</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, idx) => (
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
                    <TableCell className="pr-5">
                      {canEdit ? (
                        <input
                          type="text"
                          value={item.resolution ?? ''}
                          onChange={e => handleItemChange(idx, 'resolution', e.target.value)}
                          placeholder="วิธีแก้ไข"
                          className="w-full border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:border-[#e51c23]"
                        />
                      ) : (
                        <span className="text-sm text-[#5F5E5E]">{item.resolution || '-'}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center text-[#5F5E5E]">
              <Package size={28} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm">ไม่มีรายการสินค้า</p>
            </div>
          )}
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
            <div className="bg-gray-50 border border-gray-200 p-4 text-sm text-[#1C1B1B] italic">
              "{notes || 'ไม่มีหมายเหตุ'}"
            </div>
          )}
        </div>

        {!canEdit && (
          <div className="bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 font-medium">
            ใบเคลมนี้ดำเนินการเสร็จสิ้นแล้ว ไม่สามารถแก้ไขได้
          </div>
        )}

      </form>
    </div>
  );
}
