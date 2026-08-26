import React, { useState } from 'react';
import {
  ChevronLeft, ChevronRight, AlertCircle, ZoomIn, ZoomOut, RotateCw,
  Camera, FileUp, Loader2, Trash2, Save, Smartphone, X
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Heading from '../../../../components/elements/heading';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../../components/elements/table';
import type { ViewState, Supplier, Product, ScannedBillData } from '../../../../interface/import';
import ProductSearchSelect from '../components/product_search_select';
import InlineValidationAlertBanner from '../components/inline_validation_alert_banner';
import BillSummaryFooterBar from '../components/BillSummaryFooterBar';
import type { PriceMismatchItem } from '../components/price_update_modal';

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
  handleSaveBill: (isDraft?: boolean, skipCheck?: boolean, skipPriceCheck?: boolean) => void;
  handleSaveAllBatchBills: (isDraft?: boolean, skipCheck?: boolean, skipPriceCheck?: boolean) => void;
  handleMergeBatchResultsToSingleBill?: () => void;
  saving: boolean;
  priceMismatchedItems?: PriceMismatchItem[];
  pendingNewProducts?: any[];
  setPendingNewProducts?: (v: any[]) => void;
  handleConfirmUpdatePrices?: () => void;
  handleSkipPriceUpdate?: () => void;
  validationWarnings?: string[];
  handleConfirmValidationSave?: () => void;
  handleDismissValidation?: () => void;
  isDraftMode?: boolean;
  isEmployee?: boolean;
  mobileSessionId?: string;
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
  handleItemChange,
  handleRemoveRow,
  handleAddRow,
  handleSaveBill,
  handleSaveAllBatchBills,
  handleMergeBatchResultsToSingleBill,
  saving,
  priceMismatchedItems = [],
  pendingNewProducts = [],
  setPendingNewProducts: _setPendingNewProducts,
  handleConfirmUpdatePrices,
  handleSkipPriceUpdate,
  validationWarnings = [],
  handleConfirmValidationSave,
  handleDismissValidation,
  isDraftMode = false,
  isEmployee = false,
  mobileSessionId = '',
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

  const showBanner = (validationWarnings.length > 0 || priceMismatchedItems.length > 0 || pendingNewProducts.length > 0) && !!handleConfirmValidationSave && !!handleDismissValidation;

  const [showQR, setShowQR] = useState(false);
  const mobileUrl = mobileSessionId
    ? `${window.location.origin}/mobile-scan?session=${mobileSessionId}`
    : window.location.href;
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  return (
    <div className="p-8 max-w-full mx-auto w-full animate-in fade-in duration-300">
      {/* QR Modal */}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowQR(false)}>
          <div className="bg-white shadow-2xl p-8 flex flex-col items-center gap-5 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between w-full">
              <p className="font-extrabold text-[#1C1B1B] text-base flex items-center gap-2">
                <Smartphone size={18} /> เปิดบนมือถือ
              </p>
              <button onClick={() => setShowQR(false)} className="text-gray-400 hover:text-gray-700 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {isLocalhost ? (
              <div className="bg-amber-50 border border-amber-300 text-amber-800 text-xs p-3 w-full">
                <p className="font-bold mb-1">⚠ เปิดเว็บด้วย IP Address ก่อน</p>
                <p>มือถือไม่สามารถเข้า <code>localhost</code> ได้</p>
                <p className="mt-1">ให้เปิดใน browser ด้วย:</p>
                <p className="font-mono font-bold text-amber-900 mt-1 break-all">
                  http://192.168.1.109:{window.location.port || '5173'}
                </p>
                <p className="mt-1 text-[10px] text-amber-600">แล้วคลิกปุ่ม "เปิดบนมือถือ" อีกครั้ง</p>
              </div>
            ) : (
              <>
                <QRCodeSVG value={mobileUrl} size={220} marginSize={2} />
                <div className="bg-gray-50 border border-gray-200 text-gray-600 text-xs p-3 w-full text-center space-y-1">
                  <p className="font-bold text-[#1C1B1B]">สแกนด้วยมือถือที่อยู่บน WiFi เดียวกัน</p>
                  <p>มือถือจะเห็นหน้าส่งรูปอย่างง่าย — ถ่ายหรืออัปรูป แล้วรูปจะขึ้นบนคอมทันที</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Breadcrumbs Navigation */}
      <nav className="flex items-center gap-2 text-xs text-gray-500 mb-4">
        <button type="button" onClick={() => setCurrentView('home')} className="hover:text-[#e51c23] transition-colors cursor-pointer font-bold">
          นำเข้าสินค้าจากบิล
        </button>
        <ChevronRight size={14} className="text-gray-400" />
        <span className="text-[#1C1B1B] font-bold">สแกนและสกัดไฟล์บิล</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <Heading level="h1" className="mb-0 font-extrabold text-[#1C1B1B]">
          สแกนและนำเข้าไฟล์บิลสินค้า
        </Heading>
        <button
          onClick={() => setShowQR(true)}
          className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 text-xs font-bold rounded-none transition-colors cursor-pointer"
          title="เปิดบนมือถือผ่าน QR Code"
        >
          <Smartphone size={16} />
          เปิดบนมือถือ
        </button>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-none flex items-center gap-3">
          <AlertCircle size={20} className="shrink-0 text-red-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* บิลที่ไม่ได้นำเข้าด้วยภาพ (Excel/กรอกมือ) จะไม่มีรูปและไม่มีไฟล์แบตช์ → ซ่อน panel ภาพ ให้ฟอร์มเต็มจอ */}
      {(() => {
        const hideImagePane = !!formData && !previewUrl && batchImages.length === 0;
        return (
      <div id="split-pane-container" className="flex flex-col lg:flex-row gap-0 w-full min-h-[750px] relative">
        {/* Left: Document Preview & File Selection */}
        {!hideImagePane && (
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
                <input type="file" className="hidden" accept="image/*,.heic,.heif,application/pdf" multiple onChange={handleFileChange} />
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
                  {previewUrl === 'heic-no-preview' ? (
                    <div className="flex flex-col items-center justify-center gap-3 text-gray-400 p-8">
                      <Camera size={64} className="text-gray-300" />
                      <p className="text-sm font-bold text-gray-500">ไม่สามารถแสดงตัวอย่าง HEIC ได้</p>
                      <p className="text-xs text-gray-400">ไฟล์ถูกเลือกแล้ว — กด "สแกนข้อมูลบิล" เพื่อประมวลผล</p>
                    </div>
                  ) : (
                    <img
                      src={previewUrl ?? ''}
                      alt="Invoice Preview"
                      className="w-full h-full object-contain"
                      style={{ scale: `${zoom}`, transition: 'scale 0.2s' }}
                      crossOrigin="anonymous"
                    />
                  )}
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
                อัปโหลดบิล (ภาพ/HEIC/PDF)
                <input type="file" className="hidden" accept="image/*,.heic,.heif,application/pdf" multiple onChange={handleFileChange} />
              </label>
              <p className="text-sm text-gray-400 mt-3">รองรับการเลือกทีละหลายไฟล์สำหรับสแกนแบบกลุ่ม</p>
              {mobileSessionId && (
                <div className="mt-5 flex items-center gap-2 text-xs text-gray-400 border-t border-dashed border-gray-200 pt-4 w-full justify-center">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
                  กำลังรอรูปจากมือถือ — สแกน QR "เปิดบนมือถือ" แล้วถ่าย/ส่งรูป
                </div>
              )}
            </div>
          )}
        </div>
        )}

        {/* Resizer Divider Bar */}
        {!hideImagePane && (
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
        )}

        {/* Right: Extracted Data Fields */}
        <div 
          style={{ 
            width: typeof window !== 'undefined' && window.innerWidth >= 1024 
              ? (hideImagePane ? '100%' : `${100 - leftWidth}%`)
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
                  <label className="block text-xs font-bold text-gray-700 mb-2">ซัพพลายเออร์</label>
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
                  <label className="block text-xs font-bold text-gray-700 mb-2">เลขที่บิล</label>
                  <input 
                    type="text" 
                    value={formData.bill_no} 
                    onChange={(e) => updateFormState({ bill_no: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded-none p-2.5 text-sm focus:border-[#e51c23] focus:ring-1 focus:ring-[#e51c23] text-[#1C1B1B] font-medium" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">วันที่ครบกำหนดในบิล</label>
                  <input 
                    type="date" 
                    value={formData.due_date} 
                    onChange={(e) => updateFormState({ due_date: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded-none p-2.5 text-sm focus:border-[#e51c23] focus:ring-1 focus:ring-[#e51c23] text-[#1C1B1B] font-medium" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">อ้างอิงใบสั่งซื้อระบบ</label>
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
                  <label className="block text-xs font-bold text-gray-700 mb-2">ขนส่งโดย</label>
                  <input 
                    type="text" 
                    value={formData.transport_by} 
                    onChange={(e) => updateFormState({ transport_by: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded-none p-2.5 text-sm focus:border-[#e51c23] focus:ring-1 focus:ring-[#e51c23] text-[#1C1B1B] font-medium" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">วันที่รับสินค้า</label>
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
                      <TableHead className="py-3.5 px-4 font-bold text-left text-[#5F5E5E] min-w-[150px]">รหัสสินค้าคู่ค้า</TableHead>
                      <TableHead className="py-3.5 px-4 font-bold text-left text-[#5F5E5E] min-w-[260px]">ชื่อสินค้าตามบิล</TableHead>
                      <TableHead className="py-3.5 px-4 font-bold text-left text-[#5F5E5E] min-w-[280px]">จับคู่สินค้าในร้าน</TableHead>
                      <TableHead className="py-3.5 px-4 font-bold text-left text-[#5F5E5E] min-w-[130px]">หมวดหมู่หลัก</TableHead>
                      <TableHead className="py-3.5 px-4 font-bold text-left text-[#5F5E5E] min-w-[130px]">หมวดหมู่ย่อย</TableHead>
                      <TableHead className="py-3.5 px-4 font-bold text-right text-[#5F5E5E] min-w-[120px]">จำนวน</TableHead>
                      <TableHead className="py-3.5 px-4 font-bold text-right text-[#5F5E5E] min-w-[110px]">ราคา/หน่วย</TableHead>
                      <TableHead className="py-3.5 px-4 font-bold text-right text-[#5F5E5E] min-w-[120px]">ยอดรวม</TableHead>
                      <TableHead className="py-3.5 px-4 font-bold text-center text-[#5F5E5E] w-12">ลบ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100">
                    {formData.items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-12 text-center text-gray-500 bg-gray-50/50">
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
                              onChange={(newId: number | null) => handleItemChange(idx, 'product_id', newId)}
                              products={products}
                              companyProductCode={item.company_product_code}
                              companyProductName={item.company_product_name}
                            />
                          </TableCell>
                          <TableCell className="py-2.5 px-3">
                            {item.product_id ? (
                              (() => {
                                const prod = products.find(p => p.id === Number(item.product_id));
                                if (prod && prod.category_name) {
                                  return (
                                    <span className="text-sm text-[#1C1B1B]" title={prod.category_name}>
                                      {prod.category_name}
                                    </span>
                                  );
                                }
                                return <span className="text-gray-400 text-sm">-</span>;
                              })()
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </TableCell>
                          
                          <TableCell className="py-2.5 px-3">
                            {item.product_id ? (
                              (() => {
                                const prod = products.find(p => p.id === Number(item.product_id));
                                if (prod && prod.sub_category_name) {
                                  return (
                                    <span className="text-sm text-[#1C1B1B]" title={prod.sub_category_name}>
                                      {prod.sub_category_name}
                                    </span>
                                  );
                                }
                                return <span className="text-gray-400 text-sm">-</span>;
                              })()
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
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

              {/* Single Unified Alert Banner */}
              {(validationWarnings.length > 0 || priceMismatchedItems.length > 0) && handleConfirmValidationSave && handleDismissValidation && (
                <div className="px-6 pt-4">
                  <InlineValidationAlertBanner
                    warnings={validationWarnings}
                    mismatchedItems={priceMismatchedItems}
                    onDismiss={handleDismissValidation}
                    isDraftMode={isDraftMode}
                    isEmployee={isEmployee}
                  />
                </div>
              )}

              {/* Summary & Submit */}
              <BillSummaryFooterBar
                totalItems={formData.items.length}
                subtotal={calcSubtotal > 0 ? calcSubtotal : (formData.subtotal || 0)}
                totalAmount={calcTotalAmount > 0 ? calcTotalAmount : (formData.total_amount || 0)}
                onCancel={showBanner ? handleDismissValidation : () => setCurrentView('home')}
                disabled={saving}
                className="mt-auto"
              >
                  {/* Footer buttons — change context when banner is active */}
                  {showBanner ? (
                    <>
                      {priceMismatchedItems.length > 0 && !isEmployee && !isDraftMode && (
                        <>
                          <button
                            type="button"
                            onClick={handleSkipPriceUpdate}
                            disabled={saving}
                            className="bg-[#1C1B1B] hover:bg-gray-800 text-white px-6 py-3 rounded-none text-xs font-bold flex items-center gap-2 transition-all shadow-xs disabled:bg-gray-400 cursor-pointer"
                          >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            <span>บันทึกโดยไม่อัปเดตราคาทุน</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleConfirmUpdatePrices}
                            disabled={saving}
                            className="bg-[#e51c23] hover:bg-[#c9181f] text-white px-8 py-3 rounded-none text-xs font-bold flex items-center gap-2 transition-all shadow-xs disabled:bg-gray-400 cursor-pointer"
                          >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            <span>อัปเดตราคาทุนและบันทึก</span>
                          </button>
                        </>
                      )}
                      {(priceMismatchedItems.length === 0 || isEmployee) && (
                        <button
                          type="button"
                          onClick={handleConfirmValidationSave}
                          disabled={saving}
                          className="bg-[#e51c23] hover:bg-[#c9181f] text-white px-8 py-3 rounded-none text-xs font-bold flex items-center gap-2 transition-all shadow-xs disabled:bg-gray-400 cursor-pointer"
                        >
                          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                          <span>
                            {isDraftMode
                              ? 'ยืนยันบันทึกเป็นแบบร่าง'
                              : isEmployee
                                ? 'ยืนยันส่งให้ Owner ตรวจสอบ'
                                : 'ยืนยันบันทึก'}
                          </span>
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      {!isDraftMode && (
                        <button
                          type="button"
                          onClick={() => batchResults.length > 0 ? handleSaveAllBatchBills(true) : handleSaveBill(true)}
                          disabled={saving || formData.items.length === 0}
                          className="bg-[#1C1B1B] hover:bg-gray-800 text-white px-6 py-3 rounded-none text-xs font-bold flex items-center gap-2 transition-all shadow-xs disabled:bg-gray-400 cursor-pointer"
                        >
                          <Save size={16} />
                          <span>บันทึกเป็นแบบร่าง</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (showBanner) {
                            if (batchResults.length > 0) {
                              handleSaveAllBatchBills(false, true, true);
                            } else {
                              handleSaveBill(false, true, true);
                            }
                          } else {
                            if (batchResults.length > 0) {
                              handleSaveAllBatchBills(isDraftMode);
                            } else {
                              handleSaveBill(isDraftMode);
                            }
                          }
                        }}
                        disabled={saving || formData.items.length === 0}
                        className="bg-[#e51c23] hover:bg-[#c9181f] text-white px-8 py-3 rounded-none text-xs font-bold flex items-center gap-2 transition-all shadow-xs disabled:bg-gray-400 cursor-pointer"
                      >
                        {saving ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>กำลังบันทึก...</span>
                          </>
                        ) : (
                          <>
                            <Save size={16} />
                            <span>
                              {showBanner
                                ? 'ยืนยันบันทึกข้อมูลต่อไป'
                                : isDraftMode
                                  ? 'บันทึกเป็นแบบร่าง'
                                  : batchResults.length > 0
                                    ? `บันทึกข้อมูลทั้งหมด (${batchResults.length} บิล)`
                                    : 'บันทึกข้อมูล'}
                            </span>
                          </>
                        )}
                      </button>
                    </>
                  )}
              </BillSummaryFooterBar>
            </div>
          )}
        </div>
      </div>
        );
      })()}
    </div>
  );
}
