import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Truck, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import Badge from '../../../components/elements/badge';
import Select from '../../../components/elements/select';
import ConfirmDialog from '../../../components/elements/confirm_dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/elements/table';
import type { ClaimTrackingTabProps, TrackingStage, ClaimType } from '../../../interface/claim/claim';
import { cn } from '../../../utils/component';

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

function TypeBadge({ type }: { type: ClaimType | string }) {
  if (type === 'SUPPLIER_PENDING')
    return <Badge variant="neutral" size="sm">ส่งบริษัทตรวจ</Badge>;
  if (type === 'CREDIT_ACCOUNT')
    return <Badge variant="info" size="sm">ลงบัญชีเชื่อ</Badge>;
  return <Badge variant="primary" size="sm">เปลี่ยนทันที</Badge>;
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

export default function ClaimTrackingTab({ rawClaims, loading, basePath, onUpdateStage, updatingItemId, trackingSearch, trackingFilter
}: ClaimTrackingTabProps): React.JSX.Element {
  const navigate = useNavigate();

  const [trackingPage, setTrackingPage] = useState(1);
  const [trackingPerPage, setTrackingPerPage] = useState(10);
  const [pendingCompletedItem, setPendingCompletedItem] = useState<{
    itemId: number;
    claimNo: string;
    customerName: string;
    productName: string;
  } | null>(null);

  const handleConfirmCompleted = async () => {
    if (!pendingCompletedItem) return;
    const { itemId } = pendingCompletedItem;
    try {
      await onUpdateStage(itemId, 'COMPLETED');
    } finally {
      setPendingCompletedItem(null);
    }
  };

  const parseDateSafe = (d?: string) => {
    if (!d) return 0;
    const t = new Date(d).getTime();
    return isNaN(t) ? 0 : t;
  };

  // Tracking items calculation
  const allTrackingItems = [...rawClaims]
    .sort((a, b) => {
      const timeA = parseDateSafe(a.claim_date);
      const timeB = parseDateSafe(b.claim_date);
      if (timeB !== timeA) return timeB - timeA;
      return (b.id ?? 0) - (a.id ?? 0);
    })
    .flatMap(claim => {
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

  const filteredTrackingItems = allTrackingItems.filter(item => {
    if (item.itemStatus === 'REJECTED') return false;
    if (trackingFilter !== 'ALL' && item.stage !== trackingFilter) return false;
    if (trackingSearch.trim()) {
      const q = trackingSearch.toLowerCase().trim();
      if (
        !item.claimNo.toLowerCase().includes(q) &&
        !item.customerName.toLowerCase().includes(q) &&
        !item.customerPhone.includes(q) &&
        !item.productName.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const totalTrackingPages = Math.ceil(filteredTrackingItems.length / trackingPerPage) || 1;
  const paginatedTrackingRows = filteredTrackingItems.slice((trackingPage - 1) * trackingPerPage, trackingPage * trackingPerPage);

  return (
    <div className="space-y-5">

      {/* Tracking Table */}
      <div className="bg-white border border-gray-200 overflow-x-auto shadow-sm">
        <Table className="min-w-250">
          <TableHeader className="bg-[#F6F3F2] text-[#797878]">
            <TableRow className="border-b border-gray-200">
              <TableHead className="pl-6 w-48 text-[10px] font-bold text-gray-500 uppercase tracking-widest py-3">เลขใบเคลม / วันที่</TableHead>
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
                    <TableCell className="pl-6 font-normal text-sm">
                      <div
                        onClick={() => navigate(`${basePath}/detail/${item.claimId}`)}
                        className="font-normal text-[#e51c23] hover:underline cursor-pointer"
                      >
                        {item.claimNo}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {new Date(item.claimDate).toLocaleDateString('th-TH')}
                      </div>
                    </TableCell>

                    <TableCell>
                      <p className="font-normal text-gray-800 text-sm truncate max-w-35">
                        {item.customerName}
                      </p>
                      {item.customerPhone && item.customerPhone !== '-' && (
                        <p className="text-[11px] text-gray-400 mt-0.5">{item.customerPhone}</p>
                      )}
                    </TableCell>

                    <TableCell>
                      <p className="font-normal text-gray-900 text-sm">{item.productName}</p>
                      {item.reason && (
                        <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-50" title={item.reason}>
                          สาเหตุ: {item.reason}
                        </p>
                      )}
                    </TableCell>

                    <TableCell className="text-center font-normal text-gray-900 text-xs">
                      {item.qty} ชิ้น
                    </TableCell>

                    <TableCell>
                      <TypeBadge type={item.claimType} />
                    </TableCell>

                    {/* Update Stage Action */}
                    <TableCell className="text-center pr-6">
                      <div
                        className="flex items-center justify-center gap-1.5"
                        title={item.stage === 'COMPLETED' ? 'ส่งมอบลูกค้าแล้ว ไม่สามารถแก้ไขสถานะได้อีก' : undefined}
                      >
                        {isUpdating ? (
                          <Loader2 size={16} className="animate-spin text-[#e51c23]" />
                        ) : (
                          <Select
                            value={item.stage}
                            options={TRACKING_STAGE_OPTIONS}
                            disabled={item.stage === 'COMPLETED'}
                            onChange={e => {
                              if (item.stage === 'COMPLETED') return;
                              if (e.target.value === 'COMPLETED') {
                                setPendingCompletedItem({
                                  itemId: item.itemId,
                                  claimNo: item.claimNo,
                                  customerName: item.customerName,
                                  productName: item.productName,
                                });
                                return;
                              }
                              onUpdateStage(item.itemId, e.target.value);
                            }}
                            containerClassName="w-44 text-left"
                            className={cn(
                              "h-9 text-xs",
                              item.stage === 'COMPLETED' && "cursor-not-allowed opacity-75"
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
          <div className="bg-[#fcfbfa] px-6 py-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-3">
              <span>
                แสดง {filteredTrackingItems.length === 0 ? 0 : (trackingPage - 1) * trackingPerPage + 1} ถึง{' '}
                {Math.min(trackingPage * trackingPerPage, filteredTrackingItems.length)} จาก {filteredTrackingItems.length} รายการ
              </span>
              <div className="flex items-center gap-1.5">
                <span>แสดง:</span>
                <select
                  value={trackingPerPage}
                  onChange={e => { setTrackingPerPage(Number(e.target.value)); setTrackingPage(1); }}
                  className="border border-gray-200 rounded-none px-1.5 py-0.5 text-gray-600 bg-white focus:outline-none cursor-pointer"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                aria-label="หน้าแรก"
                disabled={trackingPage === 1}
                onClick={() => setTrackingPage(1)}
                className="p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronsLeft size={16} />
              </button>
              <button
                aria-label="หน้าก่อนหน้า"
                disabled={trackingPage === 1}
                onClick={() => setTrackingPage(p => p - 1)}
                className="p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>

              {getPageNumbers(trackingPage, totalTrackingPages).map((page, idx) =>
                page === "..." ? (
                  <span key={`ellipsis-tr-${idx}`} className="px-2 text-gray-400">...</span>
                ) : (
                  <button
                    key={page}
                    onClick={() => setTrackingPage(page as number)}
                    className={cn(
                      "px-3 py-1.5 rounded-none font-medium transition-colors cursor-pointer",
                      trackingPage === page ? "bg-[#d61c24] text-white" : "text-gray-600 hover:bg-gray-100"
                    )}
                  >
                    {page}
                  </button>
                )
              )}

              <button
                aria-label="หน้าถัดไป"
                disabled={trackingPage === totalTrackingPages}
                onClick={() => setTrackingPage(p => p + 1)}
                className="p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
              <button
                aria-label="หน้าสุดท้าย"
                disabled={trackingPage === totalTrackingPages}
                onClick={() => setTrackingPage(totalTrackingPages)}
                className="p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal เตือนเมื่อจะเปลี่ยนสถานะเป็นส่งมอบลูกค้าแล้ว */}
      <ConfirmDialog
        isOpen={pendingCompletedItem !== null}
        onClose={() => !updatingItemId && setPendingCompletedItem(null)}
        onConfirm={handleConfirmCompleted}
        title="ยืนยันการส่งมอบสินค้า"
        description={
          pendingCompletedItem && (
            <div className="space-y-3 text-sm text-left">
              <p className="text-red-600 font-medium text-center">
                คำเตือน: เมื่อเปลี่ยนสถานะเป็น &ldquo;ส่งมอบลูกค้าแล้ว&rdquo; จะไม่สามารถแก้ไขสถานะของรายการนี้ได้อีก
              </p>
              <div className="bg-[#fcfbfa] border border-gray-100 p-3 space-y-1.5 text-xs text-gray-700">
                <div className="flex justify-between">
                  <span className="text-gray-400">เลขที่ใบเคลม:</span>
                  <span className="font-semibold text-gray-900">{pendingCompletedItem.claimNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">ลูกค้า:</span>
                  <span className="font-semibold text-gray-900">{pendingCompletedItem.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">สินค้า:</span>
                  <span className="font-semibold text-gray-900">{pendingCompletedItem.productName}</span>
                </div>
              </div>
              <p className="text-center text-gray-500 text-xs">
                คุณแน่ใจหรือไม่ว่าต้องการดำเนินการต่อ?
              </p>
            </div>
          )
        }
        confirmText="ยืนยันส่งมอบ"
        cancelText="ยกเลิก"
        variant="danger"
        isSubmitting={updatingItemId === pendingCompletedItem?.itemId}
      />
    </div>
  );
}
