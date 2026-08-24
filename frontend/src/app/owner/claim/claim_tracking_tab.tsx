import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Loader2, Truck,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import Input from '../../../components/elements/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/elements/table';
import type { CustomerClaim } from '../../../interface/claim/claim';
import { cn } from '../../../utils/component';

interface ClaimTrackingTabProps {
  rawClaims: CustomerClaim[];
  loading: boolean;
  basePath: string;
  onUpdateStage: (itemId: number, newStage: string) => Promise<void>;
  updatingItemId: number | null;
}

const parseNote = (note: string | undefined, key: string): string => {
  if (!note) return '-';
  const match = note.match(new RegExp(`${key}:\\s*([^|]+)`));
  return match ? match[1].trim() : '-';
};

function TypeBadge({ type }: { type: 'INSTANT' | 'SUPPLIER_PENDING' | 'CREDIT_ACCOUNT' | string }) {
  if (type === 'SUPPLIER_PENDING')
    return <span className="px-2 py-0.5 text-[10px] font-bold text-[#1C1B1B] bg-gray-100 border border-gray-300 rounded-none inline-block">ส่งบริษัทตรวจ</span>;
  if (type === 'CREDIT_ACCOUNT')
    return <span className="px-2 py-0.5 text-[10px] font-bold text-gray-800 bg-gray-200 border border-gray-300 rounded-none inline-block">ลงบัญชีเชื่อ</span>;
  return <span className="px-2 py-0.5 text-[10px] font-bold text-[#e51c23] bg-red-50 border border-red-200 rounded-none inline-block">เปลี่ยนทันที</span>;
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  const delta = 1;
  const range: (number | "...")[] = [];
  const left = Math.max(2, current - delta);
  const right = Math.min(total - 1, current + delta);

  range.push(1);
  if (left > 2) range.push("...");
  for (let i = left; i <= right; i++) range.push(i);
  if (right < total - 1) range.push("...");
  if (total > 1) range.push(total);

  return range;
}

export default function ClaimTrackingTab({
  rawClaims,
  loading,
  basePath,
  onUpdateStage,
  updatingItemId,
}: ClaimTrackingTabProps): React.JSX.Element {
  const navigate = useNavigate();

  const [trackingFilter, setTrackingFilter] = useState<'ALL' | 'WAITING_SEND' | 'SENT_TO_SUPPLIER' | 'REPLACEMENT_RECEIVED' | 'COMPLETED'>('ALL');
  const [trackingSearch, setTrackingSearch] = useState('');
  const [trackingPage, setTrackingPage] = useState(1);
  const [trackingPerPage, setTrackingPerPage] = useState(10);

  // Tracking items calculation
  const allTrackingItems = rawClaims.flatMap(claim => {
    const noteText = claim.notes || claim.note;
    const customerName = claim.customer_name && claim.customer_name !== '-'
      ? claim.customer_name
      : parseNote(noteText, 'ลูกค้า');
    const customerPhone = parseNote(noteText, 'โทร');
    const claimNo = claim.claim_no ?? `CLM-${claim.id}`;

    return (claim.items ?? []).map(item => {
      const resolution = (item.resolution || '').trim();
      let stage: 'WAITING_SEND' | 'SENT_TO_SUPPLIER' | 'REPLACEMENT_RECEIVED' | 'COMPLETED' = 'WAITING_SEND';
      if (resolution === 'COMPLETED' || resolution.includes('ส่งมอบ') || resolution.includes('สำเร็จ')) {
        stage = 'COMPLETED';
      } else if (resolution === 'REPLACEMENT_RECEIVED' || resolution.includes('ได้รับของ') || resolution.includes('รับสินค้าทดแทน')) {
        stage = 'REPLACEMENT_RECEIVED';
      } else if (resolution === 'SENT_TO_SUPPLIER' || resolution.includes('ส่งบริษัท') || resolution.includes('ส่งโรงงาน')) {
        stage = 'SENT_TO_SUPPLIER';
      }

      return {
        claimId: claim.id ?? 0,
        claimNo,
        claimDate: claim.claim_date,
        customerName,
        customerPhone,
        claimStatus: (claim.status ?? 'PENDING').toUpperCase(),
        itemId: item.id ?? 0,
        productName: item.product_name || `#${item.product_id}`,
        qty: item.qty,
        reason: item.reason,
        claimType: item.claim_type || claim.claim_type || 'SUPPLIER_PENDING',
        itemStatus: (item.status ?? 'PENDING').toUpperCase(),
        resolution: item.resolution,
        stage,
        rawClaim: claim,
        rawItem: item,
      };
    });
  });

  const waitingSendCount = allTrackingItems.filter(i => i.stage === 'WAITING_SEND' && i.itemStatus !== 'REJECTED').length;
  const sentSupplierCount = allTrackingItems.filter(i => i.stage === 'SENT_TO_SUPPLIER').length;
  const replacementReceivedCount = allTrackingItems.filter(i => i.stage === 'REPLACEMENT_RECEIVED').length;
  const completedCount = allTrackingItems.filter(i => i.stage === 'COMPLETED').length;

  const filteredTrackingItems = allTrackingItems.filter(item => {
    if (item.itemStatus === 'REJECTED') return false;
    if (trackingFilter !== 'ALL' && item.stage !== trackingFilter) return false;
    if (trackingSearch.trim()) {
      const q = trackingSearch.toLowerCase().trim();
      const matchNo = item.claimNo.toLowerCase().includes(q);
      const matchCust = item.customerName.toLowerCase().includes(q) || item.customerPhone.includes(q);
      const matchProd = item.productName.toLowerCase().includes(q);
      if (!matchNo && !matchCust && !matchProd) return false;
    }
    return true;
  });

  const totalTrackingPages = Math.ceil(filteredTrackingItems.length / trackingPerPage) || 1;
  const paginatedTrackingRows = filteredTrackingItems.slice((trackingPage - 1) * trackingPerPage, trackingPage * trackingPerPage);

  return (
    <div className="space-y-5">
      {/* Tracking Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 border-l-[4px] border-l-amber-500 p-5 shadow-sm">
          <p className="text-xs text-[#5F5E5E] font-medium uppercase tracking-wider">รอรวบรวมส่งบริษัท</p>
          <p className="text-3xl font-bold mt-1 text-amber-600">{waitingSendCount}</p>
          <p className="text-xs text-[#5F5E5E] mt-1">รายการที่ต้องนำส่ง</p>
        </div>
        <div className="bg-white border border-gray-200 border-l-[4px] border-l-[#1C1B1B] p-5 shadow-sm">
          <p className="text-xs text-[#5F5E5E] font-medium uppercase tracking-wider">ส่งบริษัทแล้ว</p>
          <p className="text-3xl font-bold mt-1 text-[#1C1B1B]">{sentSupplierCount}</p>
          <p className="text-xs text-[#5F5E5E] mt-1">อยู่ระหว่างรอผลตรวจ/ของใหม่</p>
        </div>
        <div className="bg-white border border-gray-200 border-l-[4px] border-l-[#5F5E5E] p-5 shadow-sm">
          <p className="text-xs text-[#5F5E5E] font-medium uppercase tracking-wider">ได้รับของเปลี่ยนแล้ว</p>
          <p className="text-3xl font-bold mt-1 text-[#5F5E5E]">{replacementReceivedCount}</p>
          <p className="text-xs text-[#5F5E5E] mt-1">รอลูกค้ามารับสินค้า</p>
        </div>
        <div className="bg-white border border-gray-200 border-l-[4px] border-l-[#259b24] p-5 shadow-sm">
          <p className="text-xs text-[#5F5E5E] font-medium uppercase tracking-wider">เคลมสำเร็จ (ส่งมอบแล้ว)</p>
          <p className="text-3xl font-bold mt-1 text-[#259b24]">{completedCount}</p>
          <p className="text-xs text-[#5F5E5E] mt-1">ปิดงานเรียบร้อย</p>
        </div>
      </div>

      {/* Tracking Search & Filter */}
      <div className="bg-white border border-gray-200 p-3.5 flex flex-col md:flex-row gap-3 items-center justify-between shadow-sm">
        <div className="flex flex-1 items-center gap-3 w-full">
          <div className="relative flex-1 max-w-md">
            <Input
              type="text"
              placeholder="ค้นหาสินค้า, เลขที่ใบเคลม, หรือชื่อลูกค้า..."
              value={trackingSearch}
              onChange={e => { setTrackingSearch(e.target.value); setTrackingPage(1); }}
              leftIcon={<Search size={15} className="text-gray-400" />}
              className="bg-gray-50/70 border-gray-200 text-sm h-10 w-full focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => { setTrackingFilter('ALL'); setTrackingPage(1); }}
              className={`px-3 h-10 text-xs font-bold transition-colors cursor-pointer rounded-none border ${
                trackingFilter === 'ALL'
                  ? 'bg-[#1C1B1B] text-white border-[#1C1B1B]'
                  : 'bg-white text-[#1C1B1B] border-gray-200 hover:bg-gray-50'
              }`}
            >
              ทั้งหมด ({allTrackingItems.filter(i => i.itemStatus !== 'REJECTED').length})
            </button>
            <button
              type="button"
              onClick={() => { setTrackingFilter('WAITING_SEND'); setTrackingPage(1); }}
              className={`px-3 h-10 text-xs font-bold transition-colors cursor-pointer rounded-none border ${
                trackingFilter === 'WAITING_SEND'
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
              }`}
            >
              รอรวบรวมส่ง ({waitingSendCount})
            </button>
            <button
              type="button"
              onClick={() => { setTrackingFilter('SENT_TO_SUPPLIER'); setTrackingPage(1); }}
              className={`px-3 h-10 text-xs font-bold transition-colors cursor-pointer rounded-none border ${
                trackingFilter === 'SENT_TO_SUPPLIER'
                  ? 'bg-[#1C1B1B] text-white border-[#1C1B1B]'
                  : 'bg-white text-[#1C1B1B] border-gray-200 hover:bg-gray-50'
              }`}
            >
              ส่งบริษัทแล้ว ({sentSupplierCount})
            </button>
            <button
              type="button"
              onClick={() => { setTrackingFilter('REPLACEMENT_RECEIVED'); setTrackingPage(1); }}
              className={`px-3 h-10 text-xs font-bold transition-colors cursor-pointer rounded-none border ${
                trackingFilter === 'REPLACEMENT_RECEIVED'
                  ? 'bg-[#5F5E5E] text-white border-[#5F5E5E]'
                  : 'bg-white text-[#5F5E5E] border-gray-200 hover:bg-gray-50'
              }`}
            >
              ได้รับของแล้ว ({replacementReceivedCount})
            </button>
            <button
              type="button"
              onClick={() => { setTrackingFilter('COMPLETED'); setTrackingPage(1); }}
              className={`px-3 h-10 text-xs font-bold transition-colors cursor-pointer rounded-none border ${
                trackingFilter === 'COMPLETED'
                  ? 'bg-[#259b24] text-white border-[#259b24]'
                  : 'bg-white text-[#259b24] border-[#259b24]/30 hover:bg-[#259b24]/10'
              }`}
            >
              เคลมสำเร็จ ({completedCount})
            </button>
          </div>
        </div>
      </div>

      {/* Tracking Table */}
      <div className="bg-white border border-gray-200 overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow className="border-b border-gray-200">
              <TableHead className="pl-6 w-40 text-[10px] font-bold text-gray-500 uppercase tracking-widest py-3">เลขใบเคลม / วันที่</TableHead>
              <TableHead className="w-36 text-[10px] font-bold text-gray-500 uppercase tracking-widest py-3">ลูกค้า</TableHead>
              <TableHead className="text-[10px] font-bold text-gray-500 uppercase tracking-widest py-3">สินค้าที่เคลม</TableHead>
              <TableHead className="text-center w-20 text-[10px] font-bold text-gray-500 uppercase tracking-widest py-3">จำนวน</TableHead>
              <TableHead className="w-28 text-[10px] font-bold text-gray-500 uppercase tracking-widest py-3">ประเภทเคลม</TableHead>
              <TableHead className="text-center pr-6 w-52 text-[10px] font-bold text-gray-500 uppercase tracking-widest py-3">อัปเดตขั้นตอน</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-16">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 size={22} className="animate-spin text-[#e51c23]" />
                    <span className="text-sm text-gray-400">กำลังโหลดข้อมูลติดตาม...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : paginatedTrackingRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-16">
                  <div className="flex flex-col items-center gap-2">
                    <Truck size={28} className="text-gray-200" />
                    <span className="text-sm text-gray-400 font-medium">ไม่มีรายการสินค้าที่ต้องติดตามในสถานะนี้</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedTrackingRows.map((item, idx) => {
                const isUpdating = updatingItemId === item.itemId;

                return (
                  <TableRow key={`${item.claimId}-${item.itemId}-${idx}`} className="hover:bg-gray-50/70 border-t border-gray-100">
                    <TableCell className="pl-6 font-mono text-xs">
                      <div
                        onClick={() => navigate(`${basePath}/detail/${item.claimId}`)}
                        className="font-bold text-[#e51c23] hover:underline cursor-pointer"
                      >
                        {item.claimNo}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {new Date(item.claimDate).toLocaleDateString('th-TH')}
                      </div>
                    </TableCell>

                    <TableCell>
                      <p className="font-semibold text-gray-800 text-xs truncate max-w-[140px]">
                        {item.customerName}
                      </p>
                      {item.customerPhone && item.customerPhone !== '-' && (
                        <p className="text-[11px] text-gray-400 mt-0.5">{item.customerPhone}</p>
                      )}
                    </TableCell>

                    <TableCell>
                      <p className="font-semibold text-gray-900 text-xs">{item.productName}</p>
                      {item.reason && (
                        <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[200px]" title={item.reason}>
                          สาเหตุ: {item.reason}
                        </p>
                      )}
                    </TableCell>

                    <TableCell className="text-center font-bold text-gray-900 text-xs">
                      {item.qty} ชิ้น
                    </TableCell>

                    <TableCell>
                      <TypeBadge type={item.claimType} />
                    </TableCell>

                    {/* Update Stage Action */}
                    <TableCell className="text-center pr-6">
                      <div className="flex items-center justify-center gap-1.5">
                        {isUpdating ? (
                          <Loader2 size={16} className="animate-spin text-[#e51c23]" />
                        ) : (
                          <select
                            value={item.stage}
                            onChange={e => onUpdateStage(item.itemId, e.target.value)}
                            className="border border-gray-300 text-xs px-2 py-1 font-semibold rounded-none bg-white hover:border-[#e51c23] focus:outline-none focus:border-[#e51c23] cursor-pointer"
                          >
                            <option value="WAITING_SEND">รอรวบรวมส่ง</option>
                            <option value="SENT_TO_SUPPLIER">ส่งบริษัทแล้ว</option>
                            <option value="REPLACEMENT_RECEIVED">ได้รับของเปลี่ยน</option>
                            <option value="COMPLETED">ส่งมอบลูกค้าแล้ว</option>
                          </select>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Tracking Pagination */}
        {!loading && filteredTrackingItems.length > 0 && (
          <div className="px-6 py-3.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <span>แสดง</span>
              <select
                value={trackingPerPage}
                onChange={e => { setTrackingPerPage(Number(e.target.value)); setTrackingPage(1); }}
                className="border border-gray-200 rounded px-2 py-1 bg-white text-xs text-gray-700 cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span>จากทั้งหมด {filteredTrackingItems.length} รายการ</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                disabled={trackingPage === 1}
                onClick={() => setTrackingPage(1)}
                className="p-1.5 rounded text-gray-400 hover:bg-gray-200 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
              <button
                disabled={trackingPage === 1}
                onClick={() => setTrackingPage(p => p - 1)}
                className="p-1.5 rounded text-gray-400 hover:bg-gray-200 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {getPageNumbers(trackingPage, totalTrackingPages).map((page, idx) =>
                page === "..." ? (
                  <span key={`ellipsis-tr-${idx}`} className="px-2 text-gray-300">...</span>
                ) : (
                  <button
                    key={page}
                    onClick={() => setTrackingPage(page)}
                    className={cn(
                      "px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer",
                      trackingPage === page ? "bg-[#e51c23] text-white" : "text-gray-500 hover:bg-gray-200"
                    )}
                  >
                    {page}
                  </button>
                )
              )}

              <button
                disabled={trackingPage === totalTrackingPages}
                onClick={() => setTrackingPage(p => p + 1)}
                className="p-1.5 rounded text-gray-400 hover:bg-gray-200 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                disabled={trackingPage === totalTrackingPages}
                onClick={() => setTrackingPage(totalTrackingPages)}
                className="p-1.5 rounded text-gray-400 hover:bg-gray-200 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
