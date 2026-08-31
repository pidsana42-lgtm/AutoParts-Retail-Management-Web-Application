import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Loader2, Truck,
  ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import Input from '../../../components/elements/input';
import Badge from '../../../components/elements/badge';
import Select from '../../../components/elements/select';
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

type TrackingStage = 'WAITING_SEND' | 'SENT_TO_SUPPLIER' | 'REPLACEMENT_RECEIVED' | 'COMPLETED';
type TrackingFilter = 'ALL' | TrackingStage;

const TRACKING_STAGE_OPTIONS = [
  { value: 'WAITING_SEND', label: 'รอรวบรวมส่ง' },
  { value: 'SENT_TO_SUPPLIER', label: 'ส่งบริษัทแล้ว' },
  { value: 'REPLACEMENT_RECEIVED', label: 'ได้รับของเปลี่ยน' },
  { value: 'COMPLETED', label: 'ส่งมอบลูกค้าแล้ว' },
];

const parseNote = (note: string | undefined, key: string): string => {
  if (!note) return '-';
  const match = note.match(new RegExp(`${key}:\\s*([^|]+)`));
  return match ? match[1].trim() : '-';
};

function TypeBadge({ type }: { type: 'INSTANT' | 'SUPPLIER_PENDING' | 'CREDIT_ACCOUNT' | string }) {
  if (type === 'SUPPLIER_PENDING')
    return <Badge variant="neutral" size="sm">ส่งบริษัทตรวจ</Badge>;
  if (type === 'CREDIT_ACCOUNT')
    return <Badge variant="info" size="sm">ลงบัญชีเชื่อ</Badge>;
  return <Badge variant="primary" size="sm">เปลี่ยนทันที</Badge>;
}

function TrackingStageBadge({ stage }: { stage: TrackingStage }) {
  if (stage === 'COMPLETED') return <Badge variant="success" size="md">ส่งมอบแล้ว</Badge>;
  if (stage === 'REPLACEMENT_RECEIVED') return <Badge variant="info" size="md">ได้รับของแล้ว</Badge>;
  if (stage === 'SENT_TO_SUPPLIER') return <Badge variant="neutral" size="md">ส่งบริษัทแล้ว</Badge>;
  return <Badge variant="warning" size="md">รอรวบรวมส่ง</Badge>;
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

  const [trackingFilter, setTrackingFilter] = useState<TrackingFilter>('ALL');
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
      let stage: TrackingStage = 'WAITING_SEND';
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
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          type="button"
          aria-pressed={trackingFilter === 'WAITING_SEND'}
          onClick={() => { setTrackingFilter(trackingFilter === 'WAITING_SEND' ? 'ALL' : 'WAITING_SEND'); setTrackingPage(1); }}
          className={cn(
            'text-left bg-white border border-l-[4px] border-l-amber-500 p-5 transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-md',
            trackingFilter === 'WAITING_SEND' ? 'border-amber-500 bg-amber-50/40 shadow-md -translate-y-0.5' : 'border-gray-200 shadow-sm',
          )}
        >
          <p className="text-xs text-[#5F5E5E] font-medium uppercase tracking-wider">รอรวบรวมส่งบริษัท</p>
          <p className="text-3xl font-bold mt-1 text-amber-600">{waitingSendCount}</p>
          <p className="text-xs text-[#5F5E5E] mt-1">รายการที่ต้องนำส่ง</p>
        </button>
        <button
          type="button"
          aria-pressed={trackingFilter === 'SENT_TO_SUPPLIER'}
          onClick={() => { setTrackingFilter(trackingFilter === 'SENT_TO_SUPPLIER' ? 'ALL' : 'SENT_TO_SUPPLIER'); setTrackingPage(1); }}
          className={cn(
            'text-left bg-white border border-l-[4px] border-l-[#1C1B1B] p-5 transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-md',
            trackingFilter === 'SENT_TO_SUPPLIER' ? 'border-[#1C1B1B] bg-gray-50 shadow-md -translate-y-0.5' : 'border-gray-200 shadow-sm',
          )}
        >
          <p className="text-xs text-[#5F5E5E] font-medium uppercase tracking-wider">ส่งบริษัทแล้ว</p>
          <p className="text-3xl font-bold mt-1 text-[#1C1B1B]">{sentSupplierCount}</p>
          <p className="text-xs text-[#5F5E5E] mt-1">อยู่ระหว่างรอผลตรวจ/ของใหม่</p>
        </button>
        <button
          type="button"
          aria-pressed={trackingFilter === 'REPLACEMENT_RECEIVED'}
          onClick={() => { setTrackingFilter(trackingFilter === 'REPLACEMENT_RECEIVED' ? 'ALL' : 'REPLACEMENT_RECEIVED'); setTrackingPage(1); }}
          className={cn(
            'text-left bg-white border border-l-[4px] border-l-blue-500 p-5 transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-md',
            trackingFilter === 'REPLACEMENT_RECEIVED' ? 'border-blue-500 bg-blue-50/40 shadow-md -translate-y-0.5' : 'border-gray-200 shadow-sm',
          )}
        >
          <p className="text-xs text-[#5F5E5E] font-medium uppercase tracking-wider">ได้รับของเปลี่ยนแล้ว</p>
          <p className="text-3xl font-bold mt-1 text-blue-600">{replacementReceivedCount}</p>
          <p className="text-xs text-[#5F5E5E] mt-1">รอลูกค้ามารับสินค้า</p>
        </button>
        <button
          type="button"
          aria-pressed={trackingFilter === 'COMPLETED'}
          onClick={() => { setTrackingFilter(trackingFilter === 'COMPLETED' ? 'ALL' : 'COMPLETED'); setTrackingPage(1); }}
          className={cn(
            'text-left bg-white border border-l-[4px] border-l-[#259b24] p-5 transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-md',
            trackingFilter === 'COMPLETED' ? 'border-[#259b24] bg-green-50/40 shadow-md -translate-y-0.5' : 'border-gray-200 shadow-sm',
          )}
        >
          <p className="text-xs text-[#5F5E5E] font-medium uppercase tracking-wider">เคลมสำเร็จ (ส่งมอบแล้ว)</p>
          <p className="text-3xl font-bold mt-1 text-[#259b24]">{completedCount}</p>
          <p className="text-xs text-[#5F5E5E] mt-1">ปิดงานเรียบร้อย</p>
        </button>
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

          <div className="flex items-center gap-2 shrink-0">
            {trackingFilter === 'ALL' ? (
              <span className="px-3 h-10 inline-flex items-center border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-500">
                แสดงทุกสถานะ
              </span>
            ) : (
              <>
                <span className="text-xs text-gray-400">กำลังกรอง:</span>
                <TrackingStageBadge stage={trackingFilter} />
                <button
                  type="button"
                  onClick={() => { setTrackingFilter('ALL'); setTrackingPage(1); }}
                  className="h-10 px-3 border border-gray-300 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 hover:text-[#e51c23] cursor-pointer transition-colors"
                >
                  แสดงทั้งหมด
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tracking Table */}
      <div className="bg-white border border-gray-200 overflow-x-auto shadow-sm">
        <Table className="min-w-[1000px]">
          <TableHeader className="bg-gray-50">
            <TableRow className="border-b border-gray-200">
              <TableHead className="pl-6 w-40 text-[10px] font-bold text-gray-500 uppercase tracking-widest py-3">เลขใบเคลม / วันที่</TableHead>
              <TableHead className="w-36 text-[10px] font-bold text-gray-500 uppercase tracking-widest py-3">ลูกค้า</TableHead>
              <TableHead className="text-[10px] font-bold text-gray-500 uppercase tracking-widest py-3">สินค้าที่เคลม</TableHead>
              <TableHead className="text-center w-20 text-[10px] font-bold text-gray-500 uppercase tracking-widest py-3">จำนวน</TableHead>
              <TableHead className="w-28 text-[10px] font-bold text-gray-500 uppercase tracking-widest py-3">ประเภทเคลม</TableHead>
              <TableHead className="text-center pr-6 w-52 text-[10px] font-bold text-gray-500 uppercase tracking-widest py-3">สถานะติดตาม</TableHead>
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
                          <Select
                            value={item.stage}
                            options={TRACKING_STAGE_OPTIONS}
                            onChange={e => onUpdateStage(item.itemId, e.target.value)}
                            containerClassName="inline-flex"
                            menuAlign="right"
                            renderTrigger={({ toggle, isOpen }) => (
                              <button
                                type="button"
                                onClick={toggle}
                                className="h-9 px-2 flex items-center gap-1.5 border border-gray-200 bg-white hover:border-[#e51c23] cursor-pointer transition-colors"
                                title="เปลี่ยนสถานะติดตาม"
                              >
                                <TrackingStageBadge stage={item.stage} />
                                <ChevronDown className={cn('w-3.5 h-3.5 text-gray-400 transition-transform', isOpen && 'rotate-180')} />
                              </button>
                            )}
                          />
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
