import { useState } from 'react';
import {
  Camera, FileUp, ArrowRight, Eye, History, Trash2,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, LayoutPanelLeft, Loader2, CheckCircle2
} from 'lucide-react';
import Heading from '../../../../components/elements/heading';
import Card from '../../../../components/elements/card';
import Badge from '../../../../components/elements/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../../components/elements/table';
import type { ViewState, Supplier, SavedBill, ScannedBillData } from '../../../../interface/import';

interface HomeViewProps {
  setCurrentView: (view: ViewState) => void;
  setBillImage: (file: File | null) => void;
  setBatchImages: (files: File[]) => void;
  setBatchResults: (results: ScannedBillData[]) => void;
  setPreviewUrl: (url: string | null) => void;
  setFormData: (data: ScannedBillData | null) => void;
  setEditingBillId: (id: number | null) => void;
  setErrorMsg: (msg: string | null) => void;
  setBatchErrorMsg: (msg: string | null) => void;
  suppliers: Supplier[];
  bills: SavedBill[];
  loadingBills: boolean;
  getSupplierName: (supplierId: number) => string;
  formatDate: (dateStr: string) => string;
  handleViewSavedBill: (bill: SavedBill) => void;
  handleDeleteBill: (id: number) => void;
  handleOpenApprove: (bill: SavedBill) => void;
  fetchPOsList: () => void;
  isEmployee?: boolean;
}

export default function HomeView({
  setCurrentView,
  setBillImage,
  setBatchImages,
  setBatchResults,
  setPreviewUrl,
  setFormData,
  setEditingBillId,
  setErrorMsg,
  setBatchErrorMsg,
  suppliers,
  bills,
  loadingBills,
  getSupplierName,
  formatDate,
  handleViewSavedBill,
  handleDeleteBill,
  handleOpenApprove,
  fetchPOsList,
  isEmployee = false,
}: HomeViewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [statusTabFilter, setStatusTabFilter] = useState<'ALL' | 'PENDING_REVIEW' | 'APPROVED' | 'DRAFT'>('ALL');

  const needsApproval = (row: SavedBill) =>
    row.payment_status !== 'Draft' && row.payment_status !== 'approved' && !row.is_verified;

  const filteredBills = bills.filter(row => {
    if (statusTabFilter === 'PENDING_REVIEW') return needsApproval(row);
    if (statusTabFilter === 'APPROVED') return row.is_verified === true;
    if (statusTabFilter === 'DRAFT') return row.payment_status === 'Draft';
    return true;
  });

  const totalItems = filteredBills.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const paginatedBills = filteredBills.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  const pendingCount = bills.filter(needsApproval).length;

  return (
    <div className="p-8 max-w-full mx-auto w-full animate-in fade-in duration-300">
      <Heading level="h1" className="mb-8 font-extrabold text-[#1C1B1B]">นำเข้าใบสั่งซื้อ</Heading>

      {/* Cards Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {/* Card 1: สแกนบิลด้วยรูปภาพ / PDF */}
        <div 
          onClick={() => {
            setBillImage(null);
            setBatchImages([]);
            setBatchResults([]);
            setPreviewUrl(null);
            setFormData(null);
            setEditingBillId(null);
            setErrorMsg(null);
            setBatchErrorMsg(null);
            setCurrentView('scan');
          }}
          className="bg-[#e51c23] hover:bg-[#c9181f] text-white p-8 rounded-none flex items-center justify-between cursor-pointer transition-all shadow-md group"
        >
          <div className="flex items-center gap-6">
            <div className="bg-white/20 p-4 rounded-none">
              <Camera size={32} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-1">สแกนบิลด้วยรูปภาพหรือเอกสาร</h2>
              <p className="text-xs text-white/70">นำเข้าบิลจากไฟล์รูปภาพหรือเอกสาร</p>
            </div>
          </div>
          <ArrowRight size={32} className="text-white/50 group-hover:text-white transition-colors" />
        </div>

        {/* Card 2: อัปโหลดไฟล์ Excel */}
        <div 
          onClick={() => setCurrentView('excel')}
          className="bg-[#1C1B1B] hover:bg-[#2a2929] text-white p-8 rounded-none flex items-center justify-between cursor-pointer transition-all shadow-md group"
        >
          <div className="flex items-center gap-6">
            <div className="bg-white/10 p-4 rounded-none">
              <FileUp size={32} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-1">อัปโหลดไฟล์ตารางสินค้า</h2>
              <p className="text-xs text-gray-400">นำเข้ารายการสินค้าจากไฟล์ตาราง</p>
            </div>
          </div>
          <LayoutPanelLeft size={36} className="text-white/20" />
        </div>

        {/* Card 3: อ้างอิงใบสั่งซื้อ PO */}
        <div 
          onClick={() => {
            fetchPOsList();
            setCurrentView('po');
          }}
          className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white p-8 rounded-none flex items-center justify-between cursor-pointer transition-all shadow-md group"
        >
          <div className="flex items-center gap-6">
            <div>
              <h2 className="text-xl font-bold mb-1">นำเข้าจากใบสั่งซื้อ</h2>
              <p className="text-xs text-white/70">นำเข้าข้อมูลจากใบสั่งซื้อในระบบ</p>
            </div>
          </div>
          <ArrowRight size={32} className="text-white/50 group-hover:text-white transition-colors" />
        </div>

        {/* Card 4: กรอกข้อมูลด้วยตนเอง */}
        <div 
          onClick={() => {
            setBillImage(null);
            setBatchImages([]);
            setBatchResults([]);
            setPreviewUrl(null);
            setFormData({
              bill_no: '',
              total_amount: 0,
              due_date: new Date().toISOString().split('T')[0],
              transport_by: '',
              supplier_id: suppliers[0]?.id || 1,
              subtotal: 0,
              discount_total: 0,
              receive_date: new Date().toISOString().split('T')[0],
              vat_amount: 0,
              grand_total: 0,
              payment_status: 'unpaid',
              items: [
                {
                  item_sequence: 1,
                  company_product_code: '',
                  company_product_name: '',
                  order_quantity: 1,
                  unit: 'ชิ้น',
                  conversion_factor: 1,
                  price_per_unit: 0,
                  discount_amount: 0,
                  net_amount: 0,
                  is_freebie: false,
                  remark: '',
                  product_id: null
                }
              ],
              db_job_id: 0,
              bill_image_id: 0
            });
            setEditingBillId(null);
            setErrorMsg(null);
            setBatchErrorMsg(null);
            setCurrentView('manual');
          }}
          className="bg-[#059669] hover:bg-[#047857] text-white p-8 rounded-none flex items-center justify-between cursor-pointer transition-all shadow-md group"
        >
          <div className="flex items-center gap-6">
            <div>
              <h2 className="text-xl font-bold mb-1">กรอกข้อมูลด้วยตนเอง</h2>
              <p className="text-xs text-white/70">สร้างบิลและกรอกรายการสินค้าเอง</p>
            </div>
          </div>
          <ArrowRight size={32} className="text-white/50 group-hover:text-white transition-colors" />
        </div>
      </div>

      {/* Recent Scans Table */}
      <Card className="overflow-hidden" noPadding>
        <div className="flex flex-col md:flex-row md:items-center justify-between p-6 border-b border-gray-100 gap-4">
          <div className="flex items-center gap-2 text-[#e51c23] font-bold">
            <History size={20} />
            <span className="text-sm font-bold">รายการนำเข้าสินค้าล่าสุด</span>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { key: 'ALL',            label: `ทั้งหมด ${bills.length}`,  activeClass: 'bg-[#1C1B1B] text-white' },
                ...(!isEmployee ? [{ key: 'PENDING_REVIEW', label: 'รอเจ้าของอนุมัติ', activeClass: 'bg-[#e51c23] text-white', count: pendingCount }] : []),
                { key: 'APPROVED',       label: 'อนุมัติแล้ว',               activeClass: 'bg-[#1C1B1B] text-white' },
                { key: 'DRAFT',          label: 'แบบร่าง',                   activeClass: 'bg-[#1C1B1B] text-white' },
              ] as { key: string; label: string; activeClass: string; count?: number }[]
            ).map(tab => (
              <button
                key={tab.key}
                onClick={() => { setStatusTabFilter(tab.key as typeof statusTabFilter); setCurrentPage(1); }}
                className={`px-3 py-1.5 text-xs font-bold rounded-none transition-colors cursor-pointer flex items-center gap-1.5 ${
                  statusTabFilter === tab.key
                    ? tab.activeClass
                    : 'bg-gray-100 text-[#5F5E5E] hover:bg-gray-200'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`px-1.5 py-0.5 text-[10px] font-extrabold rounded-none leading-none ${
                    statusTabFilter === tab.key ? 'bg-white text-[#e51c23]' : 'bg-[#e51c23] text-white'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        
        {loadingBills ? (
          <div className="p-12 flex justify-center items-center">
            <Loader2 size={32} className="text-red-500 animate-spin" />
            <span className="ml-3 text-sm text-[#5F5E5E] font-medium">กำลังโหลดรายการบิลจากระบบ</span>
          </div>
        ) : filteredBills.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm font-medium">
            ไม่พบบิลนำเข้าตรงตามเงื่อนไขที่เลือก
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-gray-100 text-[#5F5E5E]">
              <TableRow>
                <TableHead className="pl-6 text-center w-32">เลขที่บิล</TableHead>
                <TableHead>วันที่นำเข้า</TableHead>
                <TableHead>ผู้จัดจำหน่าย</TableHead>
                <TableHead className="text-right">ยอดรวมสุทธิ</TableHead>
                <TableHead className="text-center">สถานะบิล</TableHead>
                <TableHead className="text-center pr-6 w-24">การจัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-gray-700">
              {paginatedBills.map((row) => (
                <TableRow key={row.id} className="hover:bg-gray-50/70 transition-colors">
                  <TableCell className="pl-6 font-bold text-[#1C1B1B] text-center">{row.bill_no}</TableCell>
                  <TableCell className="text-[#5F5E5E]">{formatDate(row.created_at)}</TableCell>
                  <TableCell className="text-[#1C1B1B] font-medium">{getSupplierName(row.supplier_id)}</TableCell>
                  <TableCell className="text-right font-bold text-[#1C1B1B]">
                    ฿{row.total_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-center">
                    {needsApproval(row) ? (
                      <Badge variant="warning" size="md">รอเจ้าของอนุมัติ</Badge>
                    ) : row.payment_status === 'Draft' ? (
                      <Badge variant="neutral" size="md">แบบร่าง</Badge>
                    ) : (
                      <Badge variant="success" size="md">อนุมัติแล้ว</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center pr-6">
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-5 flex items-center justify-center">
                        {needsApproval(row) && !isEmployee && (
                          <button
                            onClick={() => handleOpenApprove(row)}
                            className="text-emerald-600 hover:text-emerald-800 transition-colors cursor-pointer"
                            title="อนุมัติบิล"
                          >
                            <CheckCircle2 size={20} />
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => needsApproval(row) && !isEmployee ? handleOpenApprove(row) : handleViewSavedBill(row)}
                        className="text-gray-400 hover:text-[#e51c23] transition-colors cursor-pointer"
                        title={needsApproval(row) && !isEmployee ? "ดูรายละเอียดและอนุมัติบิล" : "ดูและแก้ไขบิล"}
                      >
                        <Eye size={20} />
                      </button>
                      {(!isEmployee || needsApproval(row)) && (
                        <button
                          onClick={() => handleDeleteBill(row.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                          title={isEmployee ? "ลบบิลเฉพาะรายการที่ยังไม่อนุมัติ" : "ลบบิล"}
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {totalItems > 0 && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-6 border-t border-gray-100 text-sm text-[#5F5E5E] bg-gray-50">
            <div className="flex items-center gap-4">
              <span>
                แสดง {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} ถึง {Math.min(currentPage * itemsPerPage, totalItems)} จาก {totalItems} รายการบิล
              </span>
              <div className="flex items-center gap-2">
                <span>รายการต่อหน้า:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="border border-gray-200 rounded-none px-2 py-1 text-[#5F5E5E] bg-white hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-200 cursor-pointer"
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
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
                aria-label="หน้าแรก"
                className="p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => prev - 1)}
                aria-label="หน้าก่อนหน้า"
                className="p-1.5 rounded-none text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {pageNumbers.map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1.5 rounded-none font-medium transition-colors cursor-pointer ${
                    currentPage === page
                      ? "bg-[#e51c23] text-white"
                      : "text-[#5F5E5E] hover:bg-gray-100"
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => prev + 1)}
                aria-label="หน้าถัดไป"
                className="p-1.5 rounded-none text-[#5F5E5E] hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
                aria-label="หน้าสุดท้าย"
                className="p-1.5 rounded-none text-[#5F5E5E] hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
