import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ChevronRight, Printer, Loader2, CheckCircle2, XCircle, Hash, Calendar, User, Phone,
} from 'lucide-react';
import Heading from '../../../components/elements/heading';
import Button from '../../../components/elements/button';
import Badge from '../../../components/elements/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/elements/table';
import { getCustomerClaimById, updateClaimItemStatus } from '../../../service/http/claim/claim';
import type { CustomerClaim } from '../../../interface/claim/claim';
import { useToast } from '../../../components/elements/toast';
import { cn } from '../../../utils/component';

interface ApprovedItemState {
  [itemId: number]: boolean;
}

const parseNote = (note: string | undefined, key: string): string => {
  if (!note) return '-';
  const match = note.match(new RegExp(`${key}:\\s*([^|]+)`));
  return match ? match[1].trim() : '-';
};

export default function ClaimApprovePage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [claim, setClaim] = useState<CustomerClaim | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approvedItems, setApprovedItems] = useState<ApprovedItemState>({});
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        setLoading(true);
        const data = await getCustomerClaimById(Number(id));
        setClaim(data);
        if (data?.items) {
          const initialState: ApprovedItemState = {};
          data.items.forEach(item => {
            initialState[item.id ?? 0] = (item.status ?? 'PENDING').toUpperCase() === 'APPROVED';
          });
          setApprovedItems(initialState);
        }
      } catch (err) {
        console.error('Failed to load claim:', err);
        toast({ variant: 'error', message: 'ไม่สามารถโหลดข้อมูลใบเคลมได้' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const toggleItem = (itemId: number) => {
    setApprovedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const handleApproveAndPrint = async () => {
    if (!claim?.id || saving || !claim.items?.length) return;
    try {
      setSaving(true);

      // The item endpoint derives the parent status. Serialize these writes
      // so parent-status synchronization cannot race between item requests.
      for (const item of claim.items) {
        if (!item.id) throw new Error('Missing claim item ID');
        const status = approvedItems[item.id] ? 'APPROVED' : 'REJECTED';
        const updated = await updateClaimItemStatus(item.id, status);
        if (!updated || updated.id !== item.id || updated.status?.trim().toUpperCase() !== status) {
          throw new Error('Status update returned an unexpected result');
        }
      }

      // Print
      window.print();

      // Navigate back to detail
      toast({ variant: 'success', message: 'บันทึกผลการพิจารณาใบเคลมเรียบร้อยแล้ว' });
      navigate(`/owner/claims/detail/${claim.id}`, { state: { authorizedId: Number(claim.id) } });
    } catch (err) {
      console.error('Failed to approve claim:', err);
      toast({ variant: 'error', message: 'เกิดข้อผิดพลาดในการอนุมัติใบเคลม กรุณาลองใหม่' });
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
  const customerName = claim.customer_name && claim.customer_name !== '-'
    ? claim.customer_name
    : parseNote(claim.notes || claim.note, 'ลูกค้า');
  const customerPhone = (claim as any).customer_phone || parseNote(claim.notes || claim.note, 'โทร');

  const totalCount = (claim.items ?? []).length;
  const approvedCount = Object.values(approvedItems).filter(Boolean).length;
  const rejectedCount = totalCount - approvedCount;

  return (
    <div className="p-8 space-y-6 bg-white min-h-screen font-sans text-slate-800 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between pb-5 border-b border-gray-100">
        <div>
          <nav className="flex items-center text-sm text-gray-500 gap-2 font-light mb-2">
            <Link to="/owner/claims" className="hover:text-black transition-colors cursor-pointer">
              จัดการเคลมสินค้า
            </Link>
            <ChevronRight size={16} className="text-gray-400" />
            <Link to={`/owner/claims/detail/${claim.id}`} state={{ authorizedId: Number(claim.id) }} className="hover:text-black transition-colors cursor-pointer">
              รายละเอียดใบเคลมสินค้า
            </Link>
            <ChevronRight size={16} className="text-gray-400" />
            <span className="text-black font-normal">อนุมัติรายการเคลม</span>
          </nav>
          <div className="flex items-center gap-3">
            <Heading level="h1" className="mb-0 font-bold text-[#1C1B1B]">
              อนุมัติรายการเคลมสินค้า
            </Heading>
            <span className="text-base font-semibold text-[#d61c24] font-mono">{claimNo}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline-cancel"
            size="md"
            onClick={() => navigate(`/owner/claims/detail/${claim.id}`, { state: { authorizedId: Number(claim.id) } })}
          >
            ย้อนกลับ
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            leftIcon={<Printer className="h-4 w-4" />}
            onClick={handleApproveAndPrint}
            disabled={saving || !claim.items?.length}
            isLoading={saving}
          >
            {saving ? 'กำลังบันทึก...' : 'อนุมัติและพิมพ์ใบเคลม'}
          </Button>
        </div>
      </div>

      {/* Customer & Claim Info */}
      <div className="bg-white border border-gray-200">
        <div className="bg-[#F6F3F2] px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-[#5F5E5E] uppercase tracking-wider">ข้อมูลใบเคลม</span>
          <span className="text-xs text-gray-500 font-mono">{claimNo}</span>
        </div>
        <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
          <div className="flex items-start gap-2.5">
            <Hash size={16} className="text-[#d61c24] mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-[#5F5E5E] font-medium mb-1">เลขที่ใบเคลม</p>
              <p className="font-semibold text-[#d61c24] font-mono text-base">{claimNo}</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <User size={16} className="text-[#d61c24] mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-[#5F5E5E] font-medium mb-1">ลูกค้า</p>
              <p className="font-semibold text-[#1C1B1B]">{customerName || '-'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Phone size={16} className="text-[#d61c24] mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-[#5F5E5E] font-medium mb-1">เบอร์โทรศัพท์</p>
              <p className="font-semibold text-[#1C1B1B]">{customerPhone || '-'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Calendar size={16} className="text-[#d61c24] mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-[#5F5E5E] font-medium mb-1">วันที่แจ้งเคลม</p>
              <p className="font-semibold text-[#1C1B1B]">
                {new Date(claim.claim_date).toLocaleDateString('th-TH', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white border border-gray-200 overflow-x-auto">
        <div className="bg-[#F6F3F2] px-5 py-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-semibold text-[#5F5E5E] uppercase tracking-wider">รายการสินค้าที่ขอเคลม</span>
            <span className="text-xs text-gray-500 ml-2.5 font-normal">
              (คลิกเพื่อสลับสถานะ อนุมัติ / ปฏิเสธ)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const allApp: ApprovedItemState = {};
                (claim.items ?? []).forEach(i => { allApp[i.id ?? 0] = true; });
                setApprovedItems(allApp);
              }}
              className="text-xs text-emerald-700 hover:text-emerald-800 font-medium px-2.5 py-1 bg-white border border-emerald-300 cursor-pointer transition-colors"
            >
              อนุมัติทั้งหมด
            </button>
            <button
              type="button"
              onClick={() => {
                const allRej: ApprovedItemState = {};
                (claim.items ?? []).forEach(i => { allRej[i.id ?? 0] = false; });
                setApprovedItems(allRej);
              }}
              className="text-xs text-red-700 hover:text-red-800 font-medium px-2.5 py-1 bg-white border border-red-300 cursor-pointer transition-colors"
            >
              ปฏิเสธทั้งหมด
            </button>
          </div>
        </div>

        <Table className="min-w-180">
          <TableHeader className="bg-[#F6F3F2] text-[#797878]">
            <TableRow className="border-b border-gray-200">
              <TableHead className="pl-6 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">สินค้า</TableHead>
              <TableHead className="text-center w-28 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">จำนวน</TableHead>
              <TableHead className="text-center w-36 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">สถานะปัจจุบัน</TableHead>
              <TableHead className="text-center pr-6 w-44 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">ผลการพิจารณา</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(claim.items ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-[#5F5E5E]">
                  ไม่มีรายการสินค้าในใบเคลมนี้
                </TableCell>
              </TableRow>
            ) : (
              (claim.items ?? []).map((item) => {
                const itemId = item.id ?? 0;
                const isApproved = approvedItems[itemId] || false;

                return (
                  <TableRow key={itemId} className="hover:bg-gray-50/70 border-t border-gray-100">
                    <TableCell className="pl-6 py-3.5 align-middle">
                      <p className="font-semibold text-[#1C1B1B] text-sm">{item.product_name || `#${item.product_id}`}</p>
                      {item.product_code && (
                        <p className="text-xs text-gray-400 mt-0.5">{item.product_code}</p>
                      )}
                      {item.reason && (
                        <p className="text-xs text-[#5F5E5E] mt-0.5">สาเหตุ: {item.reason}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-center py-3.5 align-middle font-medium text-[#1C1B1B] text-sm">
                      {item.qty} ชิ้น
                    </TableCell>
                    <TableCell className="text-center py-3.5 align-middle">
                      {isApproved ? (
                        <Badge variant="success" size="sm">เคลมได้</Badge>
                      ) : (
                        <Badge variant="error" size="sm">ปฏิเสธ</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center pr-6 py-3.5 align-middle">
                      <button
                        type="button"
                        onClick={() => toggleItem(itemId)}
                        className={cn(
                          "inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium cursor-pointer transition-all border w-32",
                          isApproved
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                            : "bg-red-50 text-red-700 border-red-300 hover:bg-red-100"
                        )}
                      >
                        {isApproved ? (
                          <>
                            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                            <span>อนุมัติเคลม</span>
                          </>
                        ) : (
                          <>
                            <XCircle size={14} className="text-red-500 shrink-0" />
                            <span>ปฏิเสธ</span>
                          </>
                        )}
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary Card */}
      <div className="bg-white border border-gray-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className="text-xs text-gray-500 font-medium mb-1">รายการทั้งหมด</p>
            <p className="text-2xl font-semibold text-gray-900">{totalCount} <span className="text-sm font-normal text-gray-500">รายการ</span></p>
          </div>
          <div className="h-10 w-px bg-gray-200 hidden sm:block" />
          <div>
            <p className="text-xs text-emerald-600 font-medium mb-1 flex items-center gap-1">
              <CheckCircle2 size={13} /> อนุมัติเคลม
            </p>
            <p className="text-2xl font-semibold text-emerald-600">
              {approvedCount} <span className="text-sm font-normal text-gray-500">รายการ</span>
            </p>
          </div>
          <div className="h-10 w-px bg-gray-200 hidden sm:block" />
          <div>
            <p className="text-xs text-red-600 font-medium mb-1 flex items-center gap-1">
              <XCircle size={13} /> ปฏิเสธเคลม
            </p>
            <p className="text-2xl font-semibold text-red-600">
              {rejectedCount} <span className="text-sm font-normal text-gray-500">รายการ</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2 md:pt-0">
          <Button
            type="button"
            variant="outline-cancel"
            size="md"
            onClick={() => navigate(`/owner/claims/detail/${claim.id}`, { state: { authorizedId: Number(claim.id) } })}
          >
            ยกเลิก
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            leftIcon={<Printer className="h-4 w-4" />}
            onClick={handleApproveAndPrint}
            disabled={saving || !claim.items?.length}
            isLoading={saving}
          >
            {saving ? 'กำลังบันทึก...' : 'อนุมัติและพิมพ์ใบเคลม'}
          </Button>
        </div>
      </div>

      {/* Print-only Document */}
      <div ref={printRef} className="hidden print:block font-sans text-slate-900 p-0">
        <style>{`
          @media print {
            @page {
              size: A4 portrait;
              margin: 12mm 10mm;
            }
            body * { visibility: hidden; }
            #printable-claim-approval, #printable-claim-approval * { visibility: visible; }
            #printable-claim-approval {
              position: absolute; left: 0; top: 0; width: 100%; padding: 0;
              background: white; color: black; font-size: 12px;
            }
          }
        `}</style>
        <div id="printable-claim-approval">
          <div className="border-b-2 border-slate-800 pb-3 mb-4 flex justify-between items-start">
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">AutoParts Retail Management</h1>
              <h2 className="text-sm font-bold text-slate-700 mt-0.5">ใบอนุมัติเคลมสินค้า</h2>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p className="font-semibold text-slate-800">วันที่พิมพ์</p>
              <p>{new Date().toLocaleDateString('th-TH')}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4 text-xs">
            <div>
              <p className="font-medium text-slate-800">เลขที่ใบเคลม</p>
              <p>{claimNo}</p>
            </div>
            <div>
              <p className="font-medium text-slate-800">ลูกค้า</p>
              <p>{customerName}</p>
            </div>
            <div>
              <p className="font-medium text-slate-800">เบอร์โทร</p>
              <p>{customerPhone}</p>
            </div>
          </div>

          <table className="w-full border-collapse border border-slate-300 text-xs mb-4">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-semibold border-b border-slate-300">
                <th className="border border-slate-300 p-2 text-left">สินค้า</th>
                <th className="border border-slate-300 p-2 text-center w-24">จำนวน</th>
                <th className="border border-slate-300 p-2 text-center w-32">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {(claim.items ?? []).filter(item => approvedItems[item.id ?? 0]).length === 0 ? (
                <tr>
                  <td colSpan={3} className="border border-slate-300 p-2 text-center text-slate-500">
                    ไม่มีรายการสินค้าที่อนุมัติเคลม
                  </td>
                </tr>
              ) : (
                (claim.items ?? []).filter(item => approvedItems[item.id ?? 0]).map(item => {
                  return (
                    <tr key={item.id} className="border-b border-slate-200">
                      <td className="border border-slate-300 p-2 font-medium">{item.product_name || `#${item.product_id}`}</td>
                      <td className="border border-slate-300 p-2 text-center font-semibold">{item.qty}</td>
                      <td className="border border-slate-300 p-2 text-center font-semibold text-[#259b24]">อนุมัติเคลม</td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-semibold">
                <td className="border border-slate-300 p-2 text-right">จำนวนอนุมัติรวม</td>
                <td className="border border-slate-300 p-2 text-center font-semibold">
                  {Object.values(approvedItems).filter(Boolean).length} รายการ
                </td>
                <td className="border border-slate-300 p-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

