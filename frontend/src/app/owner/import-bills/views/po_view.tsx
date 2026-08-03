import { ChevronLeft, Loader2, FileText } from 'lucide-react';
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

export default function POView({
  setCurrentView,
  poSearchQuery,
  setPoSearchQuery,
  loadingPOs,
  poList,
  formatDate,
  handleSelectPO
}: POViewProps) {
  const filteredPOs = poList.filter(po => {
    const q = poSearchQuery.toLowerCase();
    const num = (po.order_number || '').toLowerCase();
    const name = (po.supplier_name || '').toLowerCase();
    return num.includes(q) || name.includes(q);
  });

  return (
    <div className="p-8 max-w-full mx-auto w-full animate-in fade-in duration-300">
      {/* Header Bar */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setCurrentView('home')} className="p-2 hover:bg-gray-200 rounded-none transition-colors">
          <ChevronLeft size={24} className="text-gray-600" />
        </button>
        <Heading level="h1" className="mb-0 font-extrabold text-[#1C1B1B]">นำเข้าสินค้าด้วยใบสั่งซื้อ</Heading>
      </div>

      {/* Content Box */}
      <div className="bg-white rounded-none shadow-sm border border-gray-100 p-6 flex flex-col min-h-[500px]">
        {/* Search Box */}
        <div className="mb-6">
          <label className="block text-xs font-bold text-gray-700 mb-2">ค้นหาใบสั่งซื้อ (SEARCH PURCHASE ORDER)</label>
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

          {/* PO Number Quick Selection Badges */}
          {poList.length > 0 && (
            <div className="mt-3 flex items-center gap-2 flex-wrap text-xs">
              <span className="text-gray-500 font-medium">เลขที่ PO ในระบบ:</span>
              {poList.slice(0, 5).map(po => (
                <button
                  key={po.id}
                  type="button"
                  onClick={() => setPoSearchQuery(po.order_number || '')}
                  className="bg-gray-100 hover:bg-[#e51c23] hover:text-white text-gray-700 px-2.5 py-1 font-mono text-[11px] font-bold rounded-none transition-colors border border-gray-200 cursor-pointer"
                >
                  {po.order_number}
                </button>
              ))}
            </div>
          )}
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
                <TableHeader className="bg-gray-100 text-[#5F5E5E]">
                  <TableRow>
                    <TableHead className="pl-6">เลขที่ใบสั่งซื้อ (PO NO.)</TableHead>
                    <TableHead>ผู้จัดจำหน่าย (SUPPLIER)</TableHead>
                    <TableHead>วันที่ออกเอกสาร (DATE)</TableHead>
                    <TableHead className="text-right">ยอดเงินรวม (TOTAL)</TableHead>
                    <TableHead className="text-center">สถานะบิล (BILL STATUS)</TableHead>
                    <TableHead className="text-center pr-6">ดำเนินการ (ACTION)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-gray-700">
                  {filteredPOs.map((po) => (
                    <TableRow key={po.id} className="hover:bg-gray-50/70 transition-colors">
                      <TableCell className="pl-6 font-semibold text-[#1C1B1B]">{po.order_number}</TableCell>
                      <TableCell>{po.supplier_name || 'ไม่ระบุ'}</TableCell>
                      <TableCell className="text-xs text-[#5F5E5E]">{formatDate(po.created_at)}</TableCell>
                      <TableCell className="text-right font-medium text-[#1C1B1B]">
                        ฿{po.total_amount?.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant={
                            po.status === 'APPROVED' 
                              ? 'success' 
                              : po.status === 'PENDING'
                              ? 'warning'
                              : po.status === 'REJECTED'
                              ? 'error'
                              : 'neutral'
                          }
                          size="md"
                        >
                          {po.status === 'APPROVED' ? 'อนุมัติแล้ว' : po.status === 'PENDING' ? 'รออนุมัติ' : po.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center pr-6">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleSelectPO(po.id)}
                          className="shadow-sm"
                        >
                          ดึงข้อมูลเข้าบิล
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
