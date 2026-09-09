import { useState } from 'react';
import { ChevronRight, Loader2, FileText } from 'lucide-react';
import Heading from '../../../../components/elements/heading';
import Card from '../../../../components/elements/card';
import Badge from '../../../../components/elements/badge';
import Button from '../../../../components/elements/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../../components/elements/table';
import type { ViewState } from '../../../../interface/import';

interface POViewProps {
  setCurrentView: (view: ViewState) => void;
  poSearchQuery: string;
  setPoSearchQuery: (query: string) => void;
  loadingPOs: boolean;
  poList: any[];
  formatDate: (dateStr: string) => string;
  handleSelectPO: (poId: number) => void;
}

type POStatusFilter = 'ALL' | 'DRAFT' | 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED';

const normalizePOStatus = (status: unknown): Exclude<POStatusFilter, 'ALL'> => {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'RECEIVED') return 'COMPLETED';
  if (normalized === 'CANCELLED') return 'REJECTED';
  if (normalized === 'RESUBMITTED') return 'PENDING';
  if (normalized === 'DRAFT' || normalized === 'PENDING' || normalized === 'APPROVED' || normalized === 'COMPLETED' || normalized === 'REJECTED') {
    return normalized;
  }
  return 'DRAFT';
};

function POStatusBadge({ status }: { status: unknown }) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'PENDING') return <Badge variant="warning" size="md" dot>รออนุมัติ</Badge>;
  if (normalized === 'APPROVED') return <Badge variant="success" size="md" dot>อนุมัติแล้ว</Badge>;
  if (normalized === 'COMPLETED' || normalized === 'RECEIVED') return <Badge variant="info" size="md" dot>รับสินค้าแล้ว</Badge>;
  if (normalized === 'REJECTED') return <Badge variant="error" size="md" dot>ไม่อนุมัติ</Badge>;
  if (normalized === 'CANCELLED') return <Badge variant="error" size="md" dot>ยกเลิกแล้ว</Badge>;
  if (normalized === 'RESUBMITTED') return <Badge variant="warning" size="md" dot>รออนุมัติใหม่</Badge>;
  if (normalized === 'DRAFT') return <Badge variant="neutral" size="md" dot>ฉบับร่าง</Badge>;
  return <Badge variant="neutral" size="md" dot>{normalized || 'ไม่ระบุ'}</Badge>;
}

export default function POView({
  setCurrentView,
  poSearchQuery,
  setPoSearchQuery,
  loadingPOs,
  poList,
  formatDate,
  handleSelectPO
}: POViewProps) {
  const [statusFilter, setStatusFilter] = useState<POStatusFilter>('ALL');

  const statusCounts = poList.reduce<Record<Exclude<POStatusFilter, 'ALL'>, number>>((counts, po) => {
    const status = normalizePOStatus(po.status);
    counts[status] += 1;
    return counts;
  }, { DRAFT: 0, PENDING: 0, APPROVED: 0, COMPLETED: 0, REJECTED: 0 });

  const statusTabs: Array<{ key: POStatusFilter; label: string; count: number }> = [
    { key: 'ALL', label: 'ทั้งหมด', count: poList.length },
    { key: 'PENDING', label: 'รออนุมัติ', count: statusCounts.PENDING },
    { key: 'APPROVED', label: 'อนุมัติแล้ว', count: statusCounts.APPROVED },
    { key: 'COMPLETED', label: 'รับสินค้าแล้ว', count: statusCounts.COMPLETED },
    ...(statusCounts.DRAFT > 0 ? [{ key: 'DRAFT' as const, label: 'ฉบับร่าง', count: statusCounts.DRAFT }] : []),
    ...(statusCounts.REJECTED > 0 ? [{ key: 'REJECTED' as const, label: 'ไม่อนุมัติ', count: statusCounts.REJECTED }] : []),
  ];

  const filteredPOs = poList.filter(po => {
    const q = poSearchQuery.toLowerCase();
    const num = (po.po_number || '').toLowerCase();
    const name = (po.supplier_name || '').toLowerCase();
    const matchesSearch = num.includes(q) || name.includes(q);
    const matchesStatus = statusFilter === 'ALL' || normalizePOStatus(po.status) === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-8 max-w-full mx-auto w-full animate-in fade-in duration-300">
      {/* Breadcrumbs Navigation */}
      <nav className="flex items-center gap-2 text-xs text-gray-500 mb-4">
        <button type="button" onClick={() => setCurrentView('home')} className="hover:text-[#e51c23] transition-colors cursor-pointer font-bold">
          นำเข้าสินค้าจากบิล
        </button>
        <ChevronRight size={14} className="text-gray-400" />
        <span className="text-[#1C1B1B] font-bold">อ้างอิงใบสั่งซื้อ (PO)</span>
      </nav>

      {/* Header Bar */}
      <div className="mb-8">
        <Heading level="h1" className="mb-0 font-extrabold text-[#1C1B1B]">
          นำเข้าบิลโดยอ้างอิงใบสั่งซื้อ (PO)
        </Heading>
      </div>

      {/* Content Box */}
      <div className="bg-white rounded-none shadow-sm border border-gray-100 p-6 flex flex-col min-h-[500px]">
        {/* Search Box */}
        <div className="mb-6">
          <label className="block text-xs font-bold text-gray-700 mb-2">ค้นหาใบสั่งซื้อ</label>
          <div className="flex gap-2">
            <input 
              type="text"
              placeholder="พิมพ์เลขที่ PO (เช่น PO-202607-001) หรือชื่อผู้จัดจำหน่าย"
              value={poSearchQuery}
              onChange={(e) => setPoSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-none p-3 text-sm focus:border-[#e51c23] focus:ring-1 focus:ring-[#e51c23] text-gray-800 font-medium shadow-2xs"
            />
            {poSearchQuery && (
              <button
                type="button"
                onClick={() => setPoSearchQuery('')}
                className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-3 text-xs font-bold rounded-none transition-colors shrink-0"
              >
                ล้างคำค้น
              </button>
            )}
          </div>

          {/* Status filters */}
          <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <span className="text-xs text-gray-500 font-bold">กรองตามสถานะใบสั่งซื้อ</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {statusTabs.map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  aria-pressed={statusFilter === tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-none transition-colors cursor-pointer flex items-center gap-1.5 ${
                    statusFilter === tab.key
                      ? tab.key === 'PENDING'
                        ? 'bg-amber-500 text-white'
                        : tab.key === 'APPROVED'
                        ? 'bg-[#259b24] text-white'
                        : tab.key === 'REJECTED'
                        ? 'bg-[#e51c23] text-white'
                        : tab.key === 'COMPLETED'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#1C1B1B] text-white'
                      : 'bg-gray-100 text-[#5F5E5E] hover:bg-gray-200'
                  }`}
                >
                  {tab.label}
                  <span className={`min-w-5 px-1.5 py-0.5 text-[10px] font-extrabold leading-none ${
                    statusFilter === tab.key ? 'bg-white/20 text-white' : 'bg-white text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* List Section */}
        <div className="flex-1 overflow-y-auto min-h-[300px]">
          {loadingPOs ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Loader2 size={36} className="animate-spin text-[#2563EB] mb-2" />
              <span className="text-sm font-medium">กำลังโหลดรายการใบสั่งซื้อ</span>
            </div>
          ) : filteredPOs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <FileText size={48} className="text-gray-300 mb-2" />
              <span className="text-sm font-bold text-gray-500">ไม่พบรายการใบสั่งซื้อที่ตรงกับเงื่อนไข</span>
              <span className="text-xs text-gray-400 mt-1">กรุณาตรวจสอบชื่อค้นหา หรือสร้างใบสั่งซื้อ (PO) ก่อนในหน้าระบบสั่งซื้อ</span>
            </div>
          ) : (
            <Card className="overflow-hidden" noPadding>
              <Table>
                <TableHeader className="bg-[#f6f3f2] text-[#5F5E5E]">
                  <TableRow>
                    <TableHead className="pl-6">เลขที่ใบสั่งซื้อ</TableHead>
                    <TableHead>ผู้จัดจำหน่าย</TableHead>
                    <TableHead>ประเภทสินค้า</TableHead>
                    <TableHead>วันที่ออกเอกสาร</TableHead>
                    <TableHead className="text-right">ยอดเงินรวม</TableHead>
                    <TableHead className="text-center">สถานะ PO</TableHead>
                    <TableHead className="text-center pr-6">ดำเนินการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-gray-700">
                  {filteredPOs.map((po) => {
                    const poItems = po.purchase_order_items || po.items || po.po_items || [];
                    const preOrderCount = poItems.filter((i: any) => i.pre_order_item_id || i.pre_order_id).length;
                    const totalCount = poItems.length;
                    const hasPreOrder = preOrderCount > 0 || Boolean(po.has_pre_order || po.pre_order_id);
                    const isPartial = hasPreOrder && preOrderCount > 0 && preOrderCount < totalCount;
                    const normalizedStatus = normalizePOStatus(po.status);
                    const isFullyReceived = normalizedStatus === 'COMPLETED';
                    const canImport = normalizedStatus === 'APPROVED';

                    return (
                      <TableRow key={po.id} className="hover:bg-gray-50/70 transition-colors">
                        <TableCell className="pl-6 font-bold text-[#1C1B1B]">
                          {po.po_number}
                        </TableCell>
                        <TableCell>{po.supplier_name || 'ไม่ระบุ'}</TableCell>
                        <TableCell>
                          {hasPreOrder ? (
                            <Badge variant="primary" size="lg" className="w-auto min-w-32">
                              {isPartial ? `พรีออเดอร์บางส่วน ${preOrderCount}/${totalCount}` : 'พรีออเดอร์ทั้งหมด'}
                            </Badge>
                          ) : (
                            <Badge variant="neutral" size="md">สต็อกทั่วไป</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-[#5F5E5E]">{formatDate(po.created_at)}</TableCell>
                        <TableCell className="text-right font-medium text-[#1C1B1B]">
                          ฿{po.total_amount?.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                        </TableCell>
                        <TableCell className="text-center">
                          <POStatusBadge status={po.status} />
                        </TableCell>
                        <TableCell className="text-center pr-6">
                          <Button
                            variant={canImport ? 'primary' : 'tertiary'}
                            size="sm"
                            onClick={() => handleSelectPO(po.id)}
                            disabled={!canImport}
                            className="shadow-sm font-bold text-xs min-w-28"
                          >
                            {canImport ? 'ดึงข้อมูลเข้าบิล' : isFullyReceived ? 'นำเข้าแล้ว' : normalizedStatus === 'PENDING' ? 'รออนุมัติ' : 'ยังไม่พร้อม'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
