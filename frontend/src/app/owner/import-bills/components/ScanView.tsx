import React from 'react';
import { 
  ChevronLeft, ChevronRight, AlertCircle, ZoomIn, ZoomOut, RotateCw, 
  Camera, FileUp, Loader2, Trash2, Save 
} from 'lucide-react';
import Heading from '../../../../components/elements/heading';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../../components/elements/table';
import type { ViewState, Supplier, Product, ScannedBillData } from '../../../../interface/import';
import ProductSearchSelect from './ProductSearchSelect';

interface ScanViewProps {
  setCurrentView: (view: ViewState) => void;
  formData: ScannedBillData | null;
  previewUrl: string | null;
  errorMsg: string | null;
  leftWidth: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  setRotate: React.Dispatch<React.SetStateAction<number>>;
  zoom: number;
  rotate: number;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  batchImages: File[];
  batchProgress: { [key: string]: 'pending' | 'scanning' | 'success' | 'failed' };
  batchResults: ScannedBillData[];
  activeBatchIndex: number;
  handleSelectBatchItem: (index: number) => void;
  handlePrevBatchItem: () => void;
  handleNextBatchItem: () => void;
  setActiveBatchIndex: (index: number) => void;
  setPreviewUrl: (url: string | null) => void;
  handleOcrProcess: () => void;
  scanning: boolean;
  isResizing: boolean;
  setIsResizing: (resizing: boolean) => void;
  suppliers: Supplier[];
  updateFormState: (updates: Partial<ScannedBillData>) => void;
  poReference: string;
  setPoReference: (ref: string) => void;
  poList: any[];
  products: Product[];
  categories: any[];
  handleItemChange: (idx: number, field: string, val: any) => void;
  handleRemoveRow: (idx: number) => void;
  handleAddRow: () => void;
  exportBillItemsToExcel: () => void;
  handleSaveBill: (skipCheck?: boolean) => void;
  handleSaveAllBatchBills: (skipCheck?: boolean) => void;
  handleMergeBatchResultsToSingleBill?: () => void;
  saving: boolean;
}

export default function ScanView({
  setCurrentView,
  formData,
  previewUrl,
  errorMsg,
  leftWidth,
  setZoom,
  setRotate,
  zoom,
  rotate,
  handleFileChange,
  batchImages,
  batchProgress,
  batchResults,
  activeBatchIndex,
  handleSelectBatchItem,
  handlePrevBatchItem,
  handleNextBatchItem,
  setActiveBatchIndex,
  setPreviewUrl,
  handleOcrProcess,
  scanning,
  isResizing,
  setIsResizing,
  suppliers,
  updateFormState,
  poReference,
  setPoReference,
  poList,
  products,
  categories,
  handleItemChange,
  handleRemoveRow,
  handleAddRow,
  exportBillItemsToExcel,
  handleSaveBill,
  handleSaveAllBatchBills,
  handleMergeBatchResultsToSingleBill,
  saving
}: ScanViewProps) {
  let calcSubtotal = 0;
  if (formData && formData.items) {
    formData.items.forEach((item: any) => {
      const qty = Number(item.order_quantity) || 0;
      const price = Number(item.price_per_unit) || 0;
      const disc = Number(item.discount_amount) || 0;
      calcSubtotal += (qty * price) - disc;
    });
  }
  const calcTotalAmount = formData
    ? Math.round((calcSubtotal - (Number(formData.discount_total) || 0) + (Number(formData.vat_amount) || 0)) * 100) / 100
    : 0;

  return (
    <div className="p-8 max-w-full mx-auto w-full animate-in fade-in duration-300">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setCurrentView('home')} className="p-2 hover:bg-gray-200 rounded-none transition-colors">
          <ChevronLeft size={24} className="text-[#5F5E5E]" />
        </button>
        <Heading level="h1" className="mb-0 font-extrabold text-[#1C1B1B]">
          ระบบสแกนนำเข้าใบสั่งซื้อ (รูปภาพ / PDF)
        </Heading>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-none flex items-center gap-3">
          <AlertCircle size={20} className="shrink-0 text-red-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div id="split-pane-container" className="flex flex-col lg:flex-row gap-0 w-full min-h-[750px] relative">
        {/* Left: Document Preview & File Selection */}
        <div 
          style={{ width: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${leftWidth}%` : '100%' }}
          className="bg-[#e2e2e2] rounded-none p-6 flex flex-col gap-4 min-h-[750px]"
        >
          {/* Top Bar: Zoom/Rotate and Change Image Button */}
          {previewUrl && (
            <div className="flex items-center justify-between bg-white p-2 rounded-none shadow-sm w-full">
              <div className="flex gap-1">
                <button onClick={() => setZoom(prev => Math.min(prev + 0.2, 2.5))} className="bg-gray-100 p-2 rounded-none hover:bg-gray-200 text-gray-700 cursor-pointer" title="ขยาย"><ZoomIn size={18} /></button>
                <button onClick={() => setZoom(prev => Math.max(prev - 0.2, 0.5))} className="bg-gray-100 p-2 rounded-none hover:bg-gray-200 text-gray-700 cursor-pointer" title="ย่อ"><ZoomOut size={18} /></button>
                <button onClick={() => setRotate(prev => (prev + 90) % 360)} className="bg-gray-100 p-2 rounded-none hover:bg-gray-200 text-gray-700 cursor-pointer" title="หมุน"><RotateCw size={18} /></button>
              </div>
              <label className="cursor-pointer text-sm text-[#e51c23] font-bold hover:underline py-2 px-4 bg-gray-50 rounded-none border border-gray-200">
                เปลี่ยนไฟล์บิล (ภาพ/PDF)
                <input type="file" className="hidden" accept="image/*,application/pdf" multiple onChange={handleFileChange} />
              </label>
            </div>
          )}
          
          {previewUrl ? (
            <div className="w-full flex-1 flex flex-col items-center justify-center p-0">
              {/* Batch items tabs list */}
              {batchImages.length > 0 && (
                <div className="w-full bg-white rounded-none border border-gray-200 p-3 mb-4 max-h-[160px] overflow-y-auto">
                  <h4 className="text-sm font-bold text-[#5F5E5E] mb-2 uppercase tracking-wider">รายการสแกนบิลแบบกลุ่ม ({batchImages.length} ไฟล์)</h4>
                  <div className="flex flex-col gap-1">
                    {batchImages.map((file, idx) => {
                      const status = batchProgress[file.name];
                      const isSelected = activeBatchIndex === idx;
                      
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectBatchItem(idx)}
                          className={`w-full flex items-center justify-between p-2 rounded-none text-left transition-all text-sm border cursor-pointer ${
                            isSelected 
                              ? 'border-[#e51c23] bg-red-50 text-[#e51c23] font-bold shadow-2xs' 
                              : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-gray-50'
                          }`}
                        >
                          <span className="truncate max-w-[220px] font-medium">{file.name}</span>
                          <span className={`text-sm px-1.5 py-0.5 rounded-none font-bold uppercase ${
                            status === 'success' 
                              ? 'bg-[#259b24]/10 text-[#259b24] border border-[#259b24]/30' 
                              : status === 'scanning'
                                ? 'bg-yellow-100 text-yellow-700 animate-pulse'
                                : status === 'failed'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-gray-100 text-[#5F5E5E]'
                          }`}>
                            {status === 'success' ? 'สำเร็จ' : status === 'scanning' ? 'กำลังสแกน' : status === 'failed' ? 'ล้มเหลว' : 'รอสแกน'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="relative w-full flex-1 flex flex-col items-center justify-center min-h-0">
                {/* Carousel Left/Right Buttons */}
                {batchImages.length > 1 && (
                  <>
                    <button 
                      type="button"
                      onClick={handlePrevBatchItem} 
                      className="absolute left-0 lg:left-[-15px] z-10 p-2.5 rounded-none bg-white/95 hover:bg-white text-[#1C1B1B] shadow-md border border-gray-150 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                      title="รูปภาพก่อนหน้า"
                    >
                      <ChevronLeft size={18} className="stroke-[3]" />
                    </button>

                    <button 
                      type="button"
                      onClick={handleNextBatchItem} 
                      className="absolute right-0 lg:right-[-15px] z-10 p-2.5 rounded-none bg-white/95 hover:bg-white text-[#1C1B1B] shadow-md border border-gray-150 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                      title="รูปภาพถัดไป"
                    >
                      <ChevronRight size={18} className="stroke-[3]" />
                    </button>
                  </>
                )}

                <div 
                  className="w-full flex-1 min-h-0 overflow-auto flex items-center justify-center rounded-none shadow-lg bg-white p-2"
                  style={{ transform: `rotate(${rotate}deg)`, transition: 'transform 0.3s' }}
                >
                  <img 
                    src={previewUrl} 
                    alt="Invoice Preview" 
                    className="w-full h-full object-contain"
                    style={{ scale: `${zoom}`, transition: 'scale 0.2s' }}
                    crossOrigin="anonymous"
                  />
                </div>

                {/* Dot indicators */}
                {batchImages.length > 1 && (
                  <div className="mt-4 flex flex-col items-center gap-1.5 w-full">
                    <div className="text-sm font-bold text-[#5F5E5E] bg-white/85 px-3 py-1 rounded-none border border-gray-200 shadow-sm">
                      รูปที่ {activeBatchIndex + 1} จาก {batchImages.length}
                    </div>
                    <div className="flex gap-1.5 justify-center">
                      {batchImages.map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectBatchItem(idx)}
                          className={`w-2 h-2 rounded-none transition-all cursor-pointer ${
                            activeBatchIndex === idx 
                              ? 'bg-[#e51c23] w-4' 
                              : 'bg-gray-400 hover:bg-gray-500'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {!formData && (
                <button 
                  type="button"
                  onClick={handleOcrProcess}
                  disabled={scanning}
                  className="mt-6 cursor-pointer text-sm text-[#e51c23] font-bold hover:bg-gray-50 bg-white py-2 px-6 rounded-none shadow-sm flex items-center gap-2 transition-all border border-gray-100 disabled:text-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  {scanning ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>{batchImages.length > 0 ? 'กำลังสแกนบิลแบบกลุ่ม' : 'กำลังสแกนบิล'}</span>
                    </>
                  ) : (
                    <>
                      <Camera size={18} />
                      <span>{batchImages.length > 0 ? 'สแกนข้อมูลแบบกลุ่ม' : 'สแกนข้อมูลบิล'}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <div className="w-full flex-1 border-4 border-dashed border-gray-300 rounded-none flex flex-col items-center justify-center p-8 bg-gray-50 text-center">
              <Camera size={64} className="text-gray-400 mb-4 animate-pulse" />
              <p className="text-[#5F5E5E] font-bold text-sm mb-2">ลากไฟล์บิลของคุณวางที่นี่ หรือ</p>
              <label className="cursor-pointer text-white bg-[#e51c23] hover:bg-[#c9181f] px-6 py-2.5 rounded-none font-bold transition-all shadow-sm">
                อัปโหลดบิล (ภาพ/PDF)
                <input type="file" className="hidden" accept="image/*,application/pdf" multiple onChange={handleFileChange} />
              </label>
              <p className="text-sm text-gray-400 mt-3">รองรับการเลือกทีละหลายไฟล์สำหรับสแกนแบบกลุ่ม</p>
            </div>
          )}
        </div>
        
        {/* Resizer Divider Bar */}
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
          }}
          className={`hidden lg:flex w-2.5 hover:w-3.5 cursor-col-resize hover:bg-[#e51c23]/50 bg-gray-200 border-l border-r border-gray-300 items-center justify-center relative select-none rounded-none transition-all group z-10 mx-2 ${
            isResizing ? 'bg-[#e51c23]/80 w-3.5' : ''
          }`}
          style={{ cursor: 'col-resize' }}
        >
          <div className="flex flex-col gap-1 text-gray-400 group-hover:text-white pointer-events-none select-none font-bold text-[8px]">
            <span>•</span>
            <span>•</span>
            <span>•</span>
          </div>
        </div>

        {/* Right: Extracted Data Fields */}
        <div 
          style={{ 
            width: typeof window !== 'undefined' && window.innerWidth >= 1024 
              ? `${100 - leftWidth}%` 
              : '100%' 
          }}
          className="bg-white rounded-none shadow-sm border border-gray-100 flex flex-col min-h-[700px]"
        >
          {!formData ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-gray-400">
              <FileUp size={48} className="text-gray-300 mb-4" />
              <h3 className="font-bold text-sm text-[#5F5E5E] mb-2">รอการประมวลผลข้อมูล</h3>
              <p className="text-sm max-w-md">กรุณาเลือกไฟล์บิลด้านซ้าย และกดปุ่มสแกนบิลเพื่อตรวจสอบวิเคราะห์ข้อมูล</p>
            </div>
          ) : (
            <div key={`form-view-active-${activeBatchIndex}-${formData.bill_no || ''}`} className="flex flex-col flex-1 animate-in fade-in duration-300">
              {/* Multi-Page Bill Merge Control Banner */}
              {batchImages.length > 1 && (
                <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center justify-between gap-4 flex-wrap text-xs">
                  <div className="flex items-center gap-2 text-amber-900 font-medium">
                    <AlertCircle size={16} className="text-amber-600 shrink-0" />
                    <span>
                      <strong>กรณีบิลชุดเดียวกันหลายแผ่น:</strong> หากรูปภาพทั้ง {batchImages.length} แผ่นเป็นเอกสารบิลชุดเดียวกัน สามารถกดปุ่มเพื่อรวมรายการสินค้าเข้าด้วยกันได้
                    </span>
                  </div>
                  {handleMergeBatchResultsToSingleBill && (
                    <button
                      type="button"
                      onClick={handleMergeBatchResultsToSingleBill}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3.5 py-1.5 rounded-none shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 hover:scale-105 active:scale-95"
                    >
                      <span>รวมทุกแผ่นเป็น 1 บิล (Merge Multi-Page Bill)</span>
                    </button>
                  )}
                </div>
              )}

              {/* Form Fields */}
              <div className="p-6 grid grid-cols-2 gap-6 border-b border-gray-100">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">ซัพพลายเออร์ (SUPPLIER)</label>
                  <input 
                    type="text" 
                    value={formData.supplier_name || ''} 
                    onChange={(e) => {
                      const typedName = e.target.value;
                      const matched = suppliers.find(s => 
                        s.supplier_name.toLowerCase().trim() === typedName.toLowerCase().trim()
                      );
                      updateFormState({ 
                        supplier_name: typedName,
                        supplier_id: matched ? matched.id : 0
                      });
                    }}
                    className="w-full bg-white border border-gray-300 rounded-none p-2.5 text-sm focus:border-[#e51c23] focus:ring-1 focus:ring-[#e51c23] text-[#1C1B1B] font-medium" 
                    placeholder="พิมพ์ชื่อซัพพลายเออร์"
                  />
                  {formData.supplier_name && !suppliers.some(s => 
                    s.supplier_name.toLowerCase().replace(/บริษัท|จำกัด|บจก\.|หจก\./g, '').trim() === formData.supplier_name!.toLowerCase().replace(/บริษัท|จำกัด|บจก\.|หจก\./g, '').trim()
                  ) && (
                    <span className="text-xs text-[#5F5E5E] mt-1.5 block font-medium">
                      * ซัพพลายเออร์นี้จะถูกลงทะเบียนเข้าสู่ระบบโดยอัตโนมัติเมื่อกดบันทึก
                    </span>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">เลขที่บิล (INVOICE NO.)</label>
                  <input 
                    type="text" 
                    value={formData.bill_no} 
                    onChange={(e) => updateFormState({ bill_no: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded-none p-2.5 text-sm focus:border-[#e51c23] focus:ring-1 focus:ring-[#e51c23] text-[#1C1B1B] font-medium" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">วันที่ครบกำหนดในบิล (DUE DATE)</label>
                  <input 
                    type="date" 
                    value={formData.due_date} 
                    onChange={(e) => updateFormState({ due_date: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded-none p-2.5 text-sm focus:border-[#e51c23] focus:ring-1 focus:ring-[#e51c23] text-[#1C1B1B] font-medium" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">อ้างอิงใบสั่งซื้อระบบ (PO ID)</label>
                  <select
                    value={poReference}
                    onChange={(e) => setPoReference(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-none p-2.5 text-sm focus:border-[#e51c23] focus:ring-1 focus:ring-[#e51c23] text-[#1C1B1B] font-medium appearance-none"
                  >
                    <option value="">-- นำเข้าทั่วไป (ไม่มีอ้างอิง PO) --</option>
                    {poList.map((po) => (
                      <option key={po.id} value={String(po.id)}>
                        {po.order_number} ({po.supplier_name || 'ไม่ระบุซัพพลายเออร์'}) - ฿{po.total_amount?.toLocaleString() || 0}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">ขนส่งโดย (TRANSPORT BY)</label>
                  <input 
                    type="text" 
                    value={formData.transport_by} 
                    onChange={(e) => updateFormState({ transport_by: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded-none p-2.5 text-sm focus:border-[#e51c23] focus:ring-1 focus:ring-[#e51c23] text-[#1C1B1B] font-medium" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">วันที่รับสินค้า (RECEIVE DATE)</label>
                  <input 
                    type="date" 
                    value={formData.receive_date ? formData.receive_date.split('T')[0] : ''} 
                    onChange={(e) => updateFormState({ receive_date: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded-none p-2.5 text-sm focus:border-[#e51c23] focus:ring-1 focus:ring-[#e51c23] text-[#1C1B1B] font-medium" 
                  />
                </div>
              </div>

              {/* Items Table */}
              <div className="flex-1 overflow-y-auto max-h-[380px]">
                <Table className="min-w-[1250px] text-left text-sm border-collapse">
                  <TableHeader className="bg-gray-100 text-[#5F5E5E] border-b border-gray-200 text-xs uppercase tracking-wider">
                    <TableRow>
                      <TableHead className="py-3.5 px-4 font-bold text-left text-[#5F5E5E] min-w-[150px]">รหัสสินค้าคู่ค้า (SUPPLIER CODE)</TableHead>
                      <TableHead className="py-3.5 px-4 font-bold text-left text-[#5F5E5E] min-w-[260px]">ชื่อสินค้าตามบิล (SUPPLIER ITEM)</TableHead>
                      <TableHead className="py-3.5 px-4 font-bold text-left text-[#5F5E5E] min-w-[280px]">จับคู่สินค้าในร้าน (MATCHED PRODUCT)</TableHead>
                      <TableHead className="py-3.5 px-4 font-bold text-left text-[#5F5E5E] min-w-[160px]">บาร์โค้ด (BARCODE)</TableHead>
                      <TableHead className="py-3.5 px-4 font-bold text-left text-[#5F5E5E] min-w-[130px]">หมวดหมู่หลัก</TableHead>
                      <TableHead className="py-3.5 px-4 font-bold text-left text-[#5F5E5E] min-w-[130px]">หมวดหมู่ย่อย</TableHead>
                      <TableHead className="py-3.5 px-4 font-bold text-right text-[#5F5E5E] min-w-[120px]">จำนวน</TableHead>
                      <TableHead className="py-3.5 px-4 font-bold text-right text-[#5F5E5E] min-w-[110px]">ราคา/หน่วย</TableHead>
                      <TableHead className="py-3.5 px-4 font-bold text-right text-[#5F5E5E] min-w-[120px]">ยอดรวม (TOTAL)</TableHead>
                      <TableHead className="py-3.5 px-4 font-bold text-center text-[#5F5E5E] w-12">ลบ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100">
                    {formData.items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="py-12 text-center text-gray-500 bg-gray-50/50">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <AlertCircle size={36} className="text-gray-400" />
                            <p className="font-bold text-[#1C1B1B] text-sm">ไม่พบรายการสินค้าในบิลนี้</p>
                            <p className="text-xs text-[#5F5E5E]">
                              การสแกนไม่พบข้อมูลรายการสินค้า หรือบิลนี้ไม่มีรายละเอียดสินค้า กรุณาเพิ่มรายการสินค้าด้วยตนเอง
                            </p>
                            <button
                              type="button"
                              onClick={handleAddRow}
                              className="mt-3 bg-[#e51c23] hover:bg-[#c9181f] text-white px-4 py-2 text-xs font-bold rounded-none shadow-sm cursor-pointer"
                            >
                              + เพิ่มรายการสินค้าเอง
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      formData.items.map((item, idx) => {
                        const matchedProduct = products.find(p => p.id === Number(item.product_id));
                        return (
                          <TableRow key={`item-${activeBatchIndex}-${idx}-${item.company_product_code || ''}-${item.company_product_name || ''}`} className="hover:bg-gray-50/80 align-top transition-colors">
                          <TableCell className="py-2.5 px-3">
                            <input 
                              type="text"
                              value={item.company_product_code || ''}
                              onChange={(e) => handleItemChange(idx, 'company_product_code', e.target.value)}
                              placeholder="รหัสสินค้าคู่ค้า"
                              className="bg-white border border-gray-300 rounded-none focus:border-[#e51c23] focus:ring-1 focus:ring-[#e51c23] w-full text-sm font-mono text-[#1C1B1B] px-3 py-1.5 shadow-2xs"
                            />
                          </TableCell>
                          <TableCell className="py-2.5 px-3">
                            <input 
                              type="text"
                              value={item.company_product_name || ''}
                              onChange={(e) => handleItemChange(idx, 'company_product_name', e.target.value)}
                              placeholder="ชื่อสินค้าในบิล"
                              className="bg-white border border-gray-300 rounded-none focus:border-[#e51c23] focus:ring-1 focus:ring-[#e51c23] w-full text-sm font-medium text-[#1C1B1B] px-3 py-1.5 shadow-2xs"
                            />
                          </TableCell>
                          <TableCell className="py-2.5 px-3">
                            <ProductSearchSelect
                              value={item.product_id ? Number(item.product_id) : null}
                              onChange={(newId) => handleItemChange(idx, 'product_id', newId)}
                              products={products}
                              companyProductCode={item.company_product_code}
                              companyProductName={item.company_product_name}
                            />
                          </TableCell>
                          <TableCell className="py-2.5 px-3">
                            {item.product_id ? (
                              (() => {
                                const prod = products.find(p => p.id === Number(item.product_id));
                                if (!prod) return <span className="text-gray-400">-</span>;

                                const paddedId = String(prod.id).padStart(6, '0');
                                const code = prod.barcode || prod.product_code || '';
                                const sanitized = code.replace(/[^a-zA-Z0-9_\-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
                                const baseName = sanitized ? `prod_${paddedId}_${sanitized}` : `prod_${paddedId}_PROD-${paddedId}`;
                                const barcodeImgUrl = `/barcode/${baseName}.png`;

                                return (
                                  <div className="flex flex-col items-center gap-1">
                                    <img 
                                      src={barcodeImgUrl} 
                                      alt={prod.barcode} 
                                      className="max-h-8 object-contain bg-white p-0.5 border border-gray-200"
                                      onError={(e) => {
                                        (e.target as HTMLElement).style.display = 'none';
                                      }}
                                    />
                                    <span className="font-mono text-xs font-semibold text-[#1C1B1B]">
                                      {prod.barcode || '-'}
                                    </span>
                                  </div>
                                );
                              })()
                            ) : (
                              <span className="text-xs text-gray-400 italic">
                                [สร้างให้อัตโนมัติ]
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5 px-3">
                            {item.product_id ? (
                              (() => {
                                const prod = products.find(p => p.id === Number(item.product_id));
                                if (prod) {
                                  return (
                                    <span className="text-xs text-[#5F5E5E] bg-gray-100 px-2 py-1 rounded-none font-medium inline-block truncate max-w-[140px]" title={prod.category_name}>
                                      {prod.category_name || 'ไม่ระบุหมวดหมู่'}
                                    </span>
                                  );
                                }
                                return <span className="text-gray-400 text-xs">-</span>;
                              })()
                            ) : (
                              <select
                                value={item.category_id || ''}
                                onChange={(e) => {
                                  const catId = e.target.value ? Number(e.target.value) : null;
                                  handleItemChange(idx, 'category_id', catId);
                                  handleItemChange(idx, 'sub_category_id', null);
                                }}
                                className="bg-white border border-gray-300 rounded-none p-1.5 text-sm w-full focus:ring-1 focus:ring-[#e51c23] focus:border-[#e51c23] text-gray-700 font-medium"
                              >
                                <option value="">-- หมวดหมู่หลัก --</option>
                                {categories.map((c: any, cIdx: number) => {
                                  const val = c.ID || c.id || cIdx;
                                  return <option key={`cat-${val}`} value={val}>{c.category_name}</option>;
                                })}
                              </select>
                            )}
                          </TableCell>
                          
                          <TableCell className="py-2.5 px-3">
                            {item.product_id ? (
                              (() => {
                                const prod = products.find(p => p.id === Number(item.product_id));
                                if (prod && prod.sub_category_name) {
                                  return (
                                    <span className="text-xs text-gray-500 pl-1 truncate max-w-[140px]" title={prod.sub_category_name}>
                                      └─ {prod.sub_category_name}
                                    </span>
                                  );
                                }
                                return <span className="text-gray-400 text-xs">-</span>;
                              })()
                            ) : (
                              <select
                                value={item.sub_category_id || ''}
                                disabled={!item.category_id}
                                onChange={(e) => {
                                  handleItemChange(idx, 'sub_category_id', e.target.value ? Number(e.target.value) : null);
                                }}
                                className="bg-white border border-gray-300 rounded-none p-1.5 text-sm w-full focus:ring-1 focus:ring-[#e51c23] focus:border-[#e51c23] text-gray-700 font-medium disabled:opacity-50"
                              >
                                <option value="">-- หมวดหมู่ย่อย --</option>
                                {item.category_id ? ((categories.find((c: any) => (c.ID || c.id) === item.category_id))?.sub_categories || []).map((sc: any, scIdx: number) => {
                                  const scVal = sc.ID || sc.id || scIdx;
                                  return <option key={`subcat-${scVal}`} value={scVal}>{sc.sub_category_name}</option>;
                                }) : null}
                              </select>
                            )}
                          </TableCell>

                          {Number(item.order_quantity) === 0 ? (
                            <TableCell colSpan={3} className="py-2.5 px-3 text-center font-bold text-[#e51c23] bg-red-50/20">
                              ไม่มีสินค้า
                            </TableCell>
                          ) : (
                            <>
                              <TableCell className="py-2.5 px-3">
                                <div className="flex items-center gap-1 justify-end">
                                  <input 
                                    type="number" 
                                    value={item.order_quantity ?? 0}
                                    onChange={(e) => handleItemChange(idx, 'order_quantity', e.target.value)}
                                    className="bg-white border border-gray-300 rounded-none focus:border-[#e51c23] focus:ring-1 focus:ring-[#e51c23] w-14 text-right text-sm text-[#1C1B1B] p-1.5 font-medium"
                                  />
                                  <input 
                                    type="text" 
                                    value={item.unit || ''}
                                    onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                                    className="bg-white border border-gray-300 rounded-none focus:border-[#e51c23] focus:ring-1 focus:ring-[#e51c23] w-12 text-center text-sm text-[#5F5E5E] p-1.5 font-medium"
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="py-2.5 px-3 text-right">
                                <input 
                                  type="number" 
                                  step="0.01"
                                  value={item.price_per_unit ?? 0}
                                  onChange={(e) => handleItemChange(idx, 'price_per_unit', e.target.value)}
                                  className="bg-white border border-gray-300 rounded-none focus:border-[#e51c23] focus:ring-1 focus:ring-[#e51c23] w-20 text-right text-sm text-[#1C1B1B] font-bold p-1.5"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-4 text-right font-bold text-[#1C1B1B] text-sm">
                                ฿{((item.order_quantity || 0) * (item.price_per_unit || 0) - (item.discount_amount || 0)).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                              </TableCell>
                            </>
                          )}
                        <TableCell className="py-2 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(idx)}
                            className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                            title="ลบรายการสินค้า"
                          >
                            <Trash2 size={16} />
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  }))}
                  </TableBody>
                </Table>
              </div>

              {/* Add Row Button */}
              <div className="p-4 border-b border-gray-100 flex justify-start bg-gray-50">
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="text-sm text-[#e51c23] hover:text-[#c9181f] font-bold flex items-center gap-1 hover:underline cursor-pointer"
                >
                  + เพิ่มรายการสินค้า (Add Row)
                </button>
              </div>

              {/* ราคานำเข้าไม่ตรงกับในคลัง Warning Banner */}
              {(() => {
                const priceMismatchedItems = formData ? formData.items.filter(item => {
                  if (item.product_id) {
                    const matchedProduct = products.find(p => p.id === Number(item.product_id));
                    if (matchedProduct) {
                      return Number(item.price_per_unit) !== (matchedProduct.cost_price || 0);
                    }
                  }
                  return false;
                }) : [];
                
                if (priceMismatchedItems.length === 0) return null;

                return (
                  <div className="mx-6 my-4 p-4 bg-red-50 border border-red-200 text-[#e51c23] text-sm rounded-none flex items-start gap-3 animate-in slide-in-from-top-2 duration-200 shadow-sm text-left">
                    <AlertCircle className="text-[#e51c23] shrink-0 mt-0.5" size={20} />
                    <div className="flex-1 text-sm">
                      <p className="font-bold text-sm text-[#e51c23] mb-1">ตรวจพบราคานำเข้าไม่ตรงกับฐานข้อมูลคลัง (Price Mismatch)</p>
                      <p className="leading-relaxed text-red-700">
                        มีสินค้าจำนวน <span className="font-bold">{priceMismatchedItems.length} รายการ</span> ที่มีราคานำเข้าไม่ตรงกับราคาทุนปัจจุบันในฐานข้อมูล 
                        ระบบจะแสดงหน้าต่างยืนยันการอัปเดตราคาทุนในระบบคลังเมื่อกดปุ่มยืนยันบันทึกบิล
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Summary & Submit */}
              <div className="border-t border-gray-100 p-6 flex justify-between items-end bg-[#fafafa] rounded-none mt-auto">
                <div className="text-sm text-[#5F5E5E] space-y-2 text-left">
                  <p>จำนวนรายการทั้งหมด : <span className="text-[#1C1B1B] font-bold">{formData.items.length} รายการ</span></p>
                  <p>มูลค่าสินค้า (SUBTOTAL) : <span className="text-[#1C1B1B] font-bold">฿{(formData.subtotal || calcSubtotal).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span></p>
                </div>
                <div className="text-right flex items-end gap-4">
                  <div>
                    <p className="text-sm text-[#e51c23] font-bold mb-1 text-left">ยอดเงินสุทธิรวม:</p>
                    <p className="text-xl text-[#e51c23] font-bold">{(formData.total_amount || calcTotalAmount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</p>
                  </div>
                  <button 
                    type="button"
                    onClick={exportBillItemsToExcel}
                    className="bg-[#1C1B1B] hover:bg-[#2a2929] text-white px-6 py-3 rounded-none text-sm font-bold flex items-center gap-2 transition-all shadow-sm cursor-pointer"
                  >
                    <FileUp size={18} />
                    <span>ส่งออกเป็น Excel</span>
                  </button>
                  <button 
                    onClick={() => batchResults.length > 0 ? handleSaveAllBatchBills(false) : handleSaveBill(false)}
                    disabled={saving || formData.items.length === 0}
                    className="bg-[#e51c23] hover:bg-[#c9181f] text-white px-8 py-3 rounded-none text-sm font-bold flex items-center gap-2 transition-all shadow-sm disabled:bg-gray-400 cursor-pointer"
                  >
                    {saving ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>กำลังบันทึกบิล...</span>
                      </>
                    ) : (
                      <>
                        <Save size={18} />
                        <span>{batchResults.length > 0 ? `บันทึกบิลทั้งหมด (${batchResults.length} บิล)` : 'ยืนยันบันทึกบิล'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
