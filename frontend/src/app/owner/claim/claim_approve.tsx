import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, Printer, Loader2, CheckCircle2, XCircle, FileText } from 'lucide-react';
import Heading from '../../../components/elements/heading';
import Button from '../../../components/elements/button';
import Card from '../../../components/elements/card';
import Badge from '../../../components/elements/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/elements/table';
import { getCustomerClaimById, updateCustomerClaim, updateClaimItemStatus } from '../../../service/http/claim/claim';
import type { CustomerClaim } from '../../../interface/claim/claim';

interface ApprovedItemState {
  [itemId: number]: boolean;
}

export default function ClaimApprovePage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

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
    if (!claim?.id) return;
    try {
      setSaving(true);

      // Update each item status
      await Promise.all(
        (claim.items ?? []).map(item => {
          const itemId = item.id ?? 0;
          const status = approvedItems[itemId] ? 'APPROVED' : 'REJECTED';
          return updateClaimItemStatus(itemId, status);
        })
      );

      // Update claim header status to APPROVED
      await updateCustomerClaim(claim.id, {
        ...claim,
        status: 'APPROVED',
      } as any);

      // Print
      window.print();

      // Navigate back to detail
      navigate(`/owner/claims/detail/${claim.id}`);
    } catch (err) {
      console.error('Failed to approve claim:', err);
      alert('เกิดข้อผิดพลาดในการอนุมัติใบเคลม กรุณาลองใหม่');
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
  const customerName = claim.customer_name || '-';
  const customerPhone = claim.customer_phone || '-';

  return (
    <div className="p-8 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className='flex-col space-y-2'>
          <nav className="flex items-center text-sm text-gray-500 gap-2 font-light">
            <Link to="/owner/claims" className="hover:text-gray-900 transition-colors cursor-pointer">
              จัดการเคลมสินค้า
            </Link>
            <ChevronLeft className="w-4 h-4 text-gray-400 rotate-180" />
            <span className="text-black font-normal">อนุมัติรายการเคลม</span>
          </nav>
          <Heading level="h1" weight="semibold" className="m-0 text-black">
            อนุมัติรายการเคลม
          </Heading>
        </div>
        <Button
          leftIcon={<Printer className="h-5 w-5" />}
          size="md"
          onClick={handleApproveAndPrint}
          disabled={saving}
        >
          {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
          {saving ? 'กำลังบันทึก...' : 'อนุมัติและปริ้นใบเคลม'}
        </Button>
      </div>

      {/* Customer Info */}
      <Card className="border-l-[5px] border-l-[#e51c23]">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5">
          <div>
            <p className="text-xs text-[#5F5E5E] font-medium mb-1">เลขที่ใบเคลม</p>
            <p className="font-bold text-[#e51c23] font-mono text-lg">{claimNo}</p>
          </div>
          <div>
            <p className="text-xs text-[#5F5E5E] font-medium mb-1">ลูกค้า</p>
            <p className="font-bold text-[#1C1B1B]">{customerName}</p>
          </div>
          <div>
            <p className="text-xs text-[#5F5E5E] font-medium mb-1">เบอร์โทร</p>
            <p className="font-bold text-[#1C1B1B]">{customerPhone}</p>
          </div>
          <div>
            <p className="text-xs text-[#5F5E5E] font-medium mb-1">วันที่เคลม</p>
            <p className="font-bold text-[#1C1B1B]">
              {new Date(claim.claim_date).toLocaleDateString('th-TH')}
            </p>
          </div>
        </div>
      </Card>

      {/* Items Table */}
      <Card className="overflow-hidden" noPadding>
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <Heading level="h2" className="m-0 text-base font-semibold text-[#1C1B1B]">
            รายการสินค้าที่ขอเคลม
          </Heading>
          <p className="text-sm text-[#5F5E5E]">
            ติ๊กรายการที่เคลมได้ ไม่ติ๊ก = ปฏิเสธเคลม
          </p>
        </div>

        <Table>
          <TableHeader className="bg-gray-50 text-[#5F5E5E]">
            <TableRow>
              <TableHead className="pl-6">สินค้า</TableHead>
              <TableHead className="text-center w-24">จำนวน</TableHead>
              <TableHead className="text-center w-40">สถานะเคลม</TableHead>
              <TableHead className="text-center pr-6 w-32">ติ๊กเคลมได้</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="text-gray-700">
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
                  <TableRow key={itemId} className="hover:bg-gray-50/70">
                    <TableCell className="pl-6">
                      <p className="font-semibold text-[#1C1B1B]">{item.product_name || `#${item.product_id}`}</p>
                      <p className="text-xs text-[#5F5E5E] mt-0.5">{item.reason}</p>
                    </TableCell>
                    <TableCell className="text-center font-bold text-[#e51c23]">{item.qty}</TableCell>
                    <TableCell className="text-center">
                      {isApproved ? (
                        <Badge variant="success" size="sm">เคลมได้</Badge>
                      ) : (
                        <Badge variant="error" size="sm">ปฏิเสธ</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center pr-6">
                      <button
                        type="button"
                        onClick={() => toggleItem(itemId)}
                        className={`w-8 h-8 rounded-none flex items-center justify-center transition-colors cursor-pointer ${
                          isApproved
                            ? 'bg-[#e51c23] text-white hover:bg-[#c9181f]'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}
                      >
                        {isApproved ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Summary */}
      <Card className="bg-[#1C1B1B] text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400 font-light">รายการสินค้าที่อนุมัติเคลม</p>
            <p className="text-3xl font-bold mt-2">
              {Object.values(approvedItems).filter(Boolean).length} / {(claim.items ?? []).length} รายการ
            </p>
          </div>
          <div className="text-right opacity-5">
            <FileText className="w-24 h-24" />
          </div>
        </div>
      </Card>

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
              <p>{customerName}</p>
            </div>
            <div>
              <p className="font-bold text-slate-800">เบอร์โทร</p>
              <p>{customerPhone}</p>
            </div>
          </div>

          <table className="w-full border-collapse border border-slate-300 text-xs mb-4">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
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
                      <td className="border border-slate-300 p-2 text-center font-bold">{item.qty}</td>
                      <td className="border border-slate-300 p-2 text-center font-bold text-[#259b24]">อนุมัติเคลม</td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold">
                <td className="border border-slate-300 p-2 text-right">จำนวนอนุมัติรวม</td>
                <td className="border border-slate-300 p-2 text-center font-bold">
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
