import React, { useState } from 'react';
import { 
  Camera, FileUp, ArrowRight, Eye, History, Trash2, 
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, LayoutPanelLeft, Loader2 
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
  fetchPOsList: () => void;
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
  fetchPOsList
}: HomeViewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const totalItems = bills.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const paginatedBills = bills.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

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
            setCurrentView('scan');
            setErrorMsg(null);
            setBatchErrorMsg(null);
          }}
          className="bg-[#e51c23] hover:bg-[#c9181f] text-white p-8 rounded-none flex items-center justify-between cursor-pointer transition-all shadow-md group"
        >
          <div className="flex items-center gap-6">
            <div className="bg-white/20 p-4 rounded-none">
              <Camera size={32} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-1">สแกนบิลด้วยรูปภาพ / PDF</h2>
              <p className="text-xs text-white/70">Scan Invoice using Image or PDF</p>
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
              <h2 className="text-xl font-bold mb-1">อัปโหลดไฟล์ Excel</h2>
              <p className="text-xs text-gray-400">Upload Excel File (.xlsx, .csv)</p>
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
              <p className="text-xs text-white/70">Import from Purchase Order</p>
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
              bill_image_id: 1
            });
            setEditingBillId(null);
            setCurrentView('manual');
            setErrorMsg(null);
            setBatchErrorMsg(null);
          }}
          className="bg-gray-600 hover:bg-gray-700 text-white p-8 rounded-none flex items-center justify-between cursor-pointer transition-all shadow-md group"
        >
          <div className="flex items-center gap-6">
            <div className="bg-white/20 p-4 rounded-none">
              <History size={32} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-1">กรอกข้อมูลด้วยตนเอง</h2>
              <p className="text-xs text-white/70">Manual Import Entry</p>
            </div>
          </div>
          <ArrowRight size={32} className="text-white/50 group-hover:text-white transition-colors" />
        </div>
      </div>

      {/* Recent Scans Table */}
      <Card className="overflow-hidden" noPadding>
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <div className="flex items-center gap-2 text-[#e51c23] font-bold">
            <History size={20} />
            <span className="text-sm font-bold">รายการนำเข้าสินค้าล่าสุด (Recent Product Imports)</span>
          </div>
        </div>
        
        {loadingBills ? (
          <div className="p-12 flex justify-center items-center">
            <Loader2 size={32} className="text-red-500 animate-spin" />
            <span className="ml-3 text-sm text-[#5F5E5E] font-medium">กำลังโหลดรายการบิลจากระบบ</span>
          </div>
        ) : bills.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm font-medium">
            ยังไม่มีบิลนำเข้าที่ถูกยืนยันในฐานข้อมูล
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-gray-100 text-[#5F5E5E]">
              <TableRow>
                <TableHead className="pl-6 text-center w-32">INVOICE NO.</TableHead>
                <TableHead>วันที่นำเข้า (IMPORT DATE)</TableHead>
                <TableHead>ผู้จัดจำหน่าย (SUPPLIER)</TableHead>
                <TableHead className="text-right">ยอดรวมสุทธิ (TOTAL)</TableHead>
                <TableHead className="text-center">สถานะ (STATUS)</TableHead>
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
                    <Badge variant="success" size="md">
                      บันทึกแล้ว
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center pr-6">
                    <div className="flex items-center justify-center gap-3">
                      <button 
                        onClick={() => handleViewSavedBill(row)} 
                        className="text-gray-400 hover:text-[#e51c23] transition-colors cursor-pointer"
                        title="ดูและแก้ไขบิล"
                      >
                        <Eye size={20} />
                      </button>
                      <button 
                        onClick={() => handleDeleteBill(row.id)} 
                        className="text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                        title="ลบบิล"
                      >
                        <Trash2 size={20} />
                      </button>
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
