import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ChevronRight, CheckCircle2, XCircle,
  Calendar, Hash, User, Package, Loader2, SquarePen, Printer,
  Truck, PackageCheck, ClipboardEdit, AlertCircle, SendHorizonal,
  UserCheck, UserX, Clock,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContexts';
import Heading from '../../../components/elements/heading';
import Badge from '../../../components/elements/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/elements/table';
import { getCustomerClaimById, updateClaimItemStatus, updateCustomerClaim } from '../../../service/http/claim/claim';
import { posApiService } from '../../../service/http/pos/pos_service';
import type { CustomerDiscountResponse } from '../../../interface/pos/customer_interface';
import type { CustomerClaim } from '../../../interface/claim/claim';

const parseNote = (note: string | undefined, key: string): string => {
  if (!note) return '-';
  const match = note.match(new RegExp(`${key}:\\s*([^|]+)`));
  return match ? match[1].trim() : '-';
};

const cleanNoteText = (note: string | undefined): string => {
  if (!note) return '';
  return note
    .split('|')
    .map(s => s.trim())
    .filter(s => !s.startsWith('ลูกค้า:') && !s.startsWith('โทร:') && !s.startsWith('ประเภทเคลม:'))
    .join(' | ')
    .trim();
};



export default function ClaimDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useAuth() as any;
  const isManager = role?.toUpperCase() === 'OWNER' || role?.toUpperCase() === 'ADMIN';

  const [claim, setClaim] = useState<CustomerClaim | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingItemId, setUpdatingItemId] = useState<number | null>(null);
  const [posCustomerCredit, setPosCustomerCredit] = useState<CustomerDiscountResponse | null>(null);
  const [loadingPosCredit, setLoadingPosCredit] = useState(false);

  // ─── Operation Update State ────────────────────────────────────────────────
  const [opNote, setOpNote] = useState('');
  const [savingOp, setSavingOp] = useState(false);
  const [opSuccess, setOpSuccess] = useState(false);

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

  useEffect(() => {
    const phone = claim?.customer_phone || parseNote(claim?.notes || claim?.note, 'โทร');
    if (claim?.claim_type === 'CREDIT_ACCOUNT' && phone && phone !== '-') {
      const fetchCredit = async () => {
        try {
          setLoadingPosCredit(true);
          const data = await posApiService.searchCustomerDiscount(phone.trim());
          setPosCustomerCredit(data);
        } catch (err) {
          console.error('Failed to fetch POS customer credit:', err);
        } finally {
          setLoadingPosCredit(false);
        }
      };
      fetchCredit();
    }
  }, [claim]);

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

  // ─── Update Operation Fields ────────────────────────────────────────────────
  const handleOperationUpdate = async (patch: Partial<CustomerClaim>) => {
    if (!claim?.id) return;
    try {
      setSavingOp(true);
      const updated = { ...claim, ...patch };
      await updateCustomerClaim(claim.id, updated as any);
      setClaim(updated);
      setOpSuccess(true);
      setTimeout(() => setOpSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to update operation:', err);
      alert('เกิดข้อผิดพลาดในการอัพเดท กรุณาลองใหม่');
    } finally {
      setSavingOp(false);
    }
  };

  const handleSaveOpNote = async () => {
    if (!opNote.trim()) return;
    await handleOperationUpdate({ operation_note: opNote.trim() });
    setOpNote('');
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
        <button type="button" onClick={() => navigate('/owner/claims')} className="border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 font-bold px-4 py-2 rounded-none text-sm cursor-pointer transition-colors">กลับหน้าหลัก</button>
      </div>
    );
  }

  const totalQty  = claim.items?.reduce((s, i) => s + i.qty, 0) ?? 0;
  const claimNo   = claim.claim_no ?? `CLM-${claim.id}`;
  const orderRef  = claimNo.startsWith('CLM-') ? claimNo.replace('CLM-', '') : `#${claim.original_order_id}`;
  const basePath       = window.location.pathname.startsWith('/employee') ? '/employee/claims' : '/owner/claims';

  return (
    <div className="p-8 max-w-full mx-auto w-full animate-in fade-in duration-300">

      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <nav className="flex items-center text-sm text-gray-500 gap-2 font-light mb-1">
            <Link to={basePath} className="hover:text-gray-900 transition-colors cursor-pointer">
              จัดการเคลมสินค้า
            </Link>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <span className="text-black font-normal">รายละเอียดใบเคลม</span>
          </nav>
          <Heading level="h1" className="mb-0 font-extrabold text-[#1C1B1B]">
            รายละเอียดใบเคลมสินค้า
          </Heading>
          <p className="text-sm text-[#5F5E5E] mt-0.5 font-mono">{claimNo}</p>
        </div>

        {isManager && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(`${basePath}/status/${claim.id}`)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 shadow-xs font-bold h-10 px-4 rounded-none text-sm shrink-0 cursor-pointer transition-colors"
            >
              <ClipboardEdit size={16} /> อัปเดทสถานะการดำเนินงาน
            </button>
            <button
              type="button"
              onClick={() => navigate(`${basePath}/edit/${claim.id}`)}
              className="border border-gray-300 text-gray-700 hover:bg-gray-100 flex items-center gap-2 shadow-xs font-bold h-10 px-4 rounded-none text-sm shrink-0 cursor-pointer bg-white transition-colors"
            >
              <SquarePen size={16} /> แก้ไขรายละเอียด
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="bg-[#e51c23] hover:bg-[#c9181f] text-white flex items-center gap-2 shadow-sm font-bold h-10 px-5 rounded-none text-sm shrink-0 cursor-pointer transition-colors"
            >
              <Printer size={16} /> พิมพ์ใบเคลม
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

            {/* Claim Type Banner */}
            {(() => {
              const noteText = claim.notes || claim.note;
              const typeFromNote = parseNote(noteText, 'ประเภทเคลม');
              const cType = claim.claim_type ?? (
                typeFromNote.includes('เปลี่ยนทันที') ? 'INSTANT' :
                typeFromNote.includes('ส่งบริษัท') ? 'SUPPLIER_PENDING' :
                typeFromNote.includes('ลงบัญชีเชื่อ') ? 'CREDIT_ACCOUNT' : 'INSTANT'
              );

              return (
                <div className="px-5 py-3 border-t border-gray-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#5F5E5E]">ประเภทการรับเคลม:</span>
                    {cType === 'SUPPLIER_PENDING' ? (
                      <span className="px-2.5 py-1 font-bold text-[#1C1B1B] bg-gray-200 border border-gray-300 rounded-none">
                        เคลมฝากส่งบริษัท
                      </span>
                    ) : cType === 'CREDIT_ACCOUNT' ? (
                      <span className="px-2.5 py-1 font-bold text-[#1C1B1B] bg-gray-200 border border-gray-300 rounded-none">
                        เคลมลงบัญชีเชื่อ
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 font-bold text-[#e51c23] bg-red-50 border border-red-200 rounded-none">
                        เคลมเปลี่ยนทันที
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[#5F5E5E]">
                      {cType === 'SUPPLIER_PENDING'
                        ? 'อยู่ระหว่างรอคำตอบผลการตรวจวิเคราะห์ชิ้นส่วนจากซัพพลายเออร์'
                        : cType === 'CREDIT_ACCOUNT'
                        ? 'อนุมัติเปลี่ยนของให้ก่อน ตั้งหักยอดในรอบบิลเครดิตช่าง'
                        : 'เปลี่ยนชิ้นใหม่หรือคืนเงินให้ลูกค้าทันทีหน้าร้านเรียบร้อย'}
                    </span>
                    {claim.customer_received_item === true && (
                      <span className="px-2 py-0.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">
                        ลูกค้าได้รับของแล้ว
                      </span>
                    )}
                    {claim.customer_waiting === true && (
                      <span className="px-2 py-0.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200">
                        ลูกค้ารอผลอยู่
                      </span>
                    )}
                    {claim.supplier_response_status === 'WAITING' && (
                      <span className="px-2 py-0.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200">
                        ส่งบริษัทแล้ว (รอผล)
                      </span>
                    )}
                    {claim.supplier_response_status === 'APPROVED' && (
                      <span className="px-2 py-0.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">
                        บริษัทอนุมัติ
                      </span>
                    )}
                    {claim.supplier_response_status === 'REJECTED' && (
                      <span className="px-2 py-0.5 text-xs font-bold text-red-700 bg-red-50 border border-red-200">
                        บริษัทปฏิเสธ
                      </span>
                    )}
                    {claim.operation_note && (
                      <span className="text-xs text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 border border-blue-200">
                        โน้ต: {claim.operation_note}
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}
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
                      <p className="font-bold text-emerald-600">
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

            {(claim.items?.length ?? 0) > 0 ? (
              <Table>
                <TableHeader className="bg-gray-50 text-[#5F5E5E]">
                  <TableRow>
                    <TableHead className="pl-5">สินค้า</TableHead>
                    <TableHead className="text-center w-28">ประเภทเคลม</TableHead>
                    <TableHead className="text-center w-24">จำนวน</TableHead>
                    <TableHead>สาเหตุ</TableHead>
                    <TableHead className="text-center w-28">ภาพหลักฐาน</TableHead>
                    <TableHead className="text-center w-32">สถานะ</TableHead>
                    {isManager && <TableHead className="text-center pr-5 w-28">จัดการ</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody className="text-gray-700">
                  {claim.items!.map((item, idx) => {
                    const itemStatus = (item.status ?? 'Pending');
                    const itemStatusUp = itemStatus.toUpperCase();
                    const isUpdating = updatingItemId === item.id;
                    const itemEvidenceUrl = item.evidence_url || (item as any).evidenceUrl || (item as any).image_url || (item as any).imageUrl || (item as any).evidence || '';
                    const itemClaimType = item.claim_type || claim.claim_type || 'INSTANT';

                    return (
                      <TableRow key={idx} className="hover:bg-gray-50/70">
                        <TableCell className="pl-5 font-bold text-[#1C1B1B]">
                          {item.product_name || `#${item.product_id}`}
                        </TableCell>
                        <TableCell className="text-center">
                          {itemClaimType === 'SUPPLIER_PENDING' ? (
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
                        <TableCell className="text-center font-bold text-[#e51c23]">{item.qty} ชิ้น</TableCell>
                        <TableCell className="text-[#5F5E5E] text-sm">{item.reason}</TableCell>
                        <TableCell className="text-center">
                          {itemEvidenceUrl.trim() ? (
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
            <div className="bg-gray-50 border border-gray-200 p-4 text-sm text-[#1C1B1B]">
              {cleanNoteText(claim.notes || claim.note) || 'ไม่มีหมายเหตุเพิ่มเติม'}
            </div>
          </div>

          {/* ─── Operation Status Update Panel ─────────────────────────────── */}
          <div id="op-status-panel" className="bg-white border-2 border-emerald-500 overflow-hidden shadow-md scroll-mt-6">
            <div className="bg-emerald-800 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardEdit size={15} className="text-gray-300" />
                <p className="text-xs font-bold text-white uppercase tracking-wider">อัพเดทสถานะการดำเนินงาน</p>
              </div>
              {opSuccess && (
                <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 size={13} /> บันทึกสำเร็จ
                </span>
              )}
            </div>

            <div className="p-5 space-y-5">

              {/* ── ส่วน 1: สถานะการส่งมอบของให้ลูกค้า ── */}
              <div>
                <p className="text-xs font-bold text-[#1C1B1B] mb-2 flex items-center gap-1.5">
                  <PackageCheck size={14} className="text-[#e51c23]" />
                  สถานะการส่งมอบของให้ลูกค้า
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={savingOp}
                    onClick={() => handleOperationUpdate({ customer_received_item: true, customer_waiting: false })}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border transition-all cursor-pointer rounded-none ${
                      claim.customer_received_item === true
                        ? 'bg-emerald-500 text-white border-emerald-500'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400 hover:text-emerald-600'
                    }`}
                  >
                    <UserCheck size={13} /> ลูกค้าได้รับของแล้ว
                  </button>
                  <button
                    type="button"
                    disabled={savingOp}
                    onClick={() => handleOperationUpdate({ customer_received_item: false, customer_waiting: true })}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border transition-all cursor-pointer rounded-none ${
                      claim.customer_waiting === true
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-amber-400 hover:text-amber-600'
                    }`}
                  >
                    <Clock size={13} /> ลูกค้ารอผลอยู่ (ยังไม่รับของ)
                  </button>
                  <button
                    type="button"
                    disabled={savingOp}
                    onClick={() => handleOperationUpdate({ customer_received_item: false, customer_waiting: false })}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border transition-all cursor-pointer rounded-none ${
                      claim.customer_received_item === false && claim.customer_waiting === false
                        ? 'bg-gray-600 text-white border-gray-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
                    }`}
                  >
                    <UserX size={13} /> ยังไม่ได้ส่งมอบ
                  </button>
                </div>

                {/* แหล่งที่มาของสินค้า — สำหรับ INSTANT */}
                {(claim.claim_type === 'INSTANT' || !claim.claim_type) && (
                  <div className="mt-3">
                    <p className="text-[10px] text-[#5F5E5E] font-bold mb-1.5">สินค้าที่ส่งมอบเอามาจาก</p>
                    <div className="flex gap-2">
                      {claim.items?.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <span className="text-[10px] font-semibold text-[#5F5E5E]">{item.product_name || `#${item.product_id}`}:</span>
                        </div>
                      ))}
                      <button
                        type="button"
                        disabled={savingOp}
                        onClick={() => handleOperationUpdate({ notes: (claim.notes || '') + ' | แหล่งสินค้า: สต็อกร้าน' })}
                        className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold border border-gray-300 hover:border-[#e51c23] hover:text-[#e51c23] bg-white cursor-pointer rounded-none transition-colors"
                      >
                        <PackageCheck size={11} /> จากสต็อกร้าน
                      </button>
                      <button
                        type="button"
                        disabled={savingOp}
                        onClick={() => handleOperationUpdate({ notes: (claim.notes || '') + ' | แหล่งสินค้า: รอจากซัพพลายเออร์' })}
                        className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold border border-gray-300 hover:border-amber-500 hover:text-amber-600 bg-white cursor-pointer rounded-none transition-colors"
                      >
                        <Truck size={11} /> รอจากซัพพลายเออร์
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── ส่วน 2: สถานะการส่งบริษัท — สำหรับ SUPPLIER_PENDING เท่านั้น ── */}
              {claim.claim_type === 'SUPPLIER_PENDING' && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs font-bold text-[#1C1B1B] mb-2 flex items-center gap-1.5">
                    <Truck size={14} className="text-[#e51c23]" />
                    สถานะการส่งบริษัทและผลการตรวจ
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={savingOp}
                      onClick={() => handleOperationUpdate({ supplier_response_status: 'WAITING' })}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border transition-all cursor-pointer rounded-none ${
                        claim.supplier_response_status === 'WAITING'
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-amber-400 hover:text-amber-600'
                      }`}
                    >
                      <SendHorizonal size={13} /> ส่งสินค้าให้บริษัทแล้ว (รอผล)
                    </button>
                    <button
                      type="button"
                      disabled={savingOp}
                      onClick={() => handleOperationUpdate({ supplier_response_status: 'APPROVED', status: 'APPROVED' })}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border transition-all cursor-pointer rounded-none ${
                        claim.supplier_response_status === 'APPROVED'
                          ? 'bg-emerald-500 text-white border-emerald-500'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400 hover:text-emerald-600'
                      }`}
                    >
                      <CheckCircle2 size={13} /> บริษัทอนุมัติเคลม
                    </button>
                    <button
                      type="button"
                      disabled={savingOp}
                      onClick={() => handleOperationUpdate({ supplier_response_status: 'REJECTED', status: 'REJECTED' })}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border transition-all cursor-pointer rounded-none ${
                        claim.supplier_response_status === 'REJECTED'
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-red-500 hover:text-red-600'
                      }`}
                    >
                      <XCircle size={13} /> บริษัทปฏิเสธเคลม
                    </button>
                  </div>

                  {/* แสดงสถานะปัจจุบัน */}
                  {claim.supplier_response_status && (
                    <div className={`mt-3 px-3 py-2 text-xs font-semibold rounded-none border flex items-center gap-2 w-fit ${
                      claim.supplier_response_status === 'WAITING'
                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : claim.supplier_response_status === 'APPROVED'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}>
                      <AlertCircle size={12} />
                      {claim.supplier_response_status === 'WAITING'
                        ? 'รอผลการตรวจจากบริษัท — ยังไม่มีคำตอบ'
                        : claim.supplier_response_status === 'APPROVED'
                        ? 'บริษัทอนุมัติเคลมแล้ว — สามารถดำเนินการต่อได้'
                        : 'บริษัทปฏิเสธเคลม — ลูกค้าต้องซื้อสินค้าใหม่'}
                    </div>
                  )}
                </div>
              )}

              {/* ── ส่วน 3: CREDIT_ACCOUNT — สถานะบิลเครดิต ── */}
              {claim.claim_type === 'CREDIT_ACCOUNT' && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs font-bold text-[#1C1B1B] mb-2 flex items-center gap-1.5">
                    <AlertCircle size={14} className="text-amber-500" />
                    สถานะบิลเครดิต (ลูกค้าได้รับของไปก่อน)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={savingOp}
                      onClick={() => handleOperationUpdate({ status: 'APPROVED', customer_received_item: true })}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border transition-all cursor-pointer rounded-none ${
                        claim.status?.toUpperCase() === 'APPROVED'
                          ? 'bg-emerald-500 text-white border-emerald-500'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400 hover:text-emerald-600'
                      }`}
                    >
                      <CheckCircle2 size={13} /> เคลมผ่าน — ไม่ต้องจ่าย
                    </button>
                    <button
                      type="button"
                      disabled={savingOp}
                      onClick={() => handleOperationUpdate({ status: 'REJECTED', customer_received_item: true })}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border transition-all cursor-pointer rounded-none ${
                        claim.status?.toUpperCase() === 'REJECTED'
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-red-500 hover:text-red-600'
                      }`}
                    >
                      <XCircle size={13} /> เคลมไม่ผ่าน — ลูกค้าต้องจ่ายคืน
                    </button>
                  </div>
                  {claim.status?.toUpperCase() === 'REJECTED' && (
                    <div className="mt-2 px-3 py-2 text-xs font-semibold rounded-none border border-red-200 bg-red-50 text-red-700 flex items-center gap-2 w-fit">
                      <AlertCircle size={12} />
                      ลูกค้าต้องซื้อสินค้าชดเชยคืนให้ร้าน
                    </div>
                  )}
                </div>
              )}

              {/* ── ส่วน 4: บันทึกการดำเนินงาน ── */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-bold text-[#1C1B1B] mb-2 flex items-center gap-1.5">
                  <ClipboardEdit size={14} className="text-[#5F5E5E]" />
                  บันทึกการดำเนินงานเพิ่มเติม
                </p>
                {claim.operation_note && (
                  <div className="mb-2 px-3 py-2 bg-blue-50 border border-blue-200 text-xs text-blue-800 font-medium rounded-none">
                    <span className="font-bold">บันทึกล่าสุด:</span> {claim.operation_note}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={opNote}
                    onChange={e => setOpNote(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveOpNote()}
                    placeholder="เช่น: โทรแจ้งลูกค้าแล้ว, ส่งของวันที่..., รอบริษัทติดต่อกลับ..."
                    className="flex-1 border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:border-[#e51c23] rounded-none"
                  />
                  <button
                    type="button"
                    onClick={handleSaveOpNote}
                    disabled={savingOp || !opNote.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#1C1B1B] hover:bg-black disabled:opacity-40 text-white text-xs font-bold cursor-pointer transition-colors rounded-none"
                  >
                    {savingOp ? <Loader2 size={12} className="animate-spin" /> : <SendHorizonal size={12} />}
                    บันทึก
                  </button>
                </div>
              </div>

            </div>
          </div>

      </div>

      {/* Printable Document */}
      <div className="hidden print:block font-sans text-slate-900 p-4">
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #printable-claim-detail, #printable-claim-detail * { visibility: visible; }
            #printable-claim-detail {
              position: absolute; left: 0; top: 0; width: 100%; padding: 20px;
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
                      <td className="border border-slate-300 p-2 text-center font-bold text-emerald-600">อนุมัติเคลม</td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>

          {cleanNoteText(claim.notes || claim.note) && (
            <div className="mb-4 text-xs">
              <p className="font-bold text-slate-800">หมายเหตุเพิ่มเติม:</p>
              <p className="text-slate-700">{cleanNoteText(claim.notes || claim.note)}</p>
            </div>
          )}

          <div className="mt-8 pt-4 flex justify-between items-end text-xs text-slate-700">
            <div>
              <p>ผู้ทำรายการ: ________________________</p>
            </div>
            <div className="text-center border-t border-slate-400 pt-2 min-w-[220px]">
              <p className="font-bold">ลายเซ็นเจ้าของร้าน / ผู้อนุมัติ</p>
              <p className="mt-6">วันที่ ____/____/________</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
