import React from 'react';
import { ChevronLeft, Save, Trash2, AlertCircle } from 'lucide-react';
import Heading from '../../../../components/elements/heading';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../../components/elements/table';
import type { ViewState, Supplier, Product, ScannedBillData } from '../../../../interface/import';
import ProductSearchSelect from '../components/product_search_select';
import InlineValidationAlertBanner from '../components/inline_validation_alert_banner';
import type { PriceMismatchItem } from '../components/price_update_modal';

interface ManualEntryViewProps {
  setCurrentView: (view: ViewState) => void;
  formData: ScannedBillData | null;
  errorMsg: string | null;
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
  saving: boolean;
  priceMismatchedItems?: PriceMismatchItem[];
  handleConfirmUpdatePrices?: () => void;
  handleSkipPriceUpdate?: () => void;
  validationWarnings?: string[];
  handleConfirmValidationSave?: () => void;
  handleDismissValidation?: () => void;
  isDraftMode?: boolean;
  isEmployee?: boolean;
}

export default function ManualEntryView({
  setCurrentView,
  formData,
  errorMsg,
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
  saving,
  priceMismatchedItems = [],
  handleConfirmUpdatePrices,
  handleSkipPriceUpdate,
  validationWarnings = [],
  handleConfirmValidationSave,
  handleDismissValidation,
  isDraftMode = false,
  isEmployee = false,
}: ManualEntryViewProps) {
  if (!formData) return null;

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

  const liveMismatchesCount = React.useMemo(() => {
    if (!formData || !formData.items) return 0;
    let count = 0;
    formData.items.forEach(item => {
      if (item.product_id) {
        const prod = products.find(p => p.id === Number(item.product_id));
        if (prod && Number(item.price_per_unit) !== (prod.cost_price || 0)) {
          count++;
        }
      } else if (item.company_product_name || Number(item.price_per_unit) > 0) {
        count++;
      }
    });
    return count;
  }, [formData?.items, products]);

  const showBanner = (validationWarnings.length > 0 || priceMismatchedItems.length > 0) && !!handleConfirmValidationSave && !!handleDismissValidation;

  return (
    <div className="p-8 max-w-full mx-auto w-full animate-in fade-in duration-300">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setCurrentView('home')} className="p-2 hover:bg-gray-200 rounded-none transition-colors cursor-pointer" title="ย้อนกลับ">
          <ChevronLeft size={24} className="text-[#5F5E5E]" />
        </button>
        <Heading level="h1" className="mb-0 font-extrabold text-[#1C1B1B]">
          นำเข้าใบสั่งซื้อ (กรอกข้อมูลด้วยตนเอง)
        </Heading>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-none flex items-center gap-3">
          <AlertCircle size={20} className="shrink-0 text-red-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="bg-white rounded-none shadow-sm border border-gray-100 flex flex-col min-h-[700px] w-full">
        <div className="flex flex-col flex-1 animate-in fade-in duration-300">
          {/* Form Fields */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 border-b border-gray-100">
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
          <div className="flex-1 overflow-y-auto max-h-[400px]">
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
                          ยังไม่มีรายการสินค้าถูกระบุ กรุณาเพิ่มรายการสินค้าโดยคลิกปุ่มด้านล่าง
                        </p>
                        <button
                          type="button"
                          onClick={handleAddRow}
                          className="mt-3 bg-[#e51c23] hover:bg-[#c9181f] text-white px-4 py-2 text-xs font-bold rounded-none shadow-sm cursor-pointer"
                        >
                          + เพิ่มรายการสินค้า
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  formData.items.map((item, idx) => {
                    const matchedProduct = products.find(p => p.id === Number(item.product_id));
                    return (
                      <TableRow key={idx} className="hover:bg-gray-50/80 align-top transition-colors">
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
                          <span className="text-xs text-black">
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
                               handleItemChange(idx, 'category_id', e.target.value ? Number(e.target.value) : null);
                             }}
                             className="bg-white border border-gray-300 rounded-none p-1.5 text-sm w-full focus:ring-1 focus:ring-[#e51c23] focus:border-[#e51c23] text-gray-700 font-medium"
                           >
                             <option value="">-- หมวดหมู่หลัก --</option>
                             {categories.map((c: any, cIdx: number) => {
                               const catId = c.id ?? c.ID ?? cIdx;
                               return (
                                 <option key={catId} value={catId}>{c.category_name || c.name}</option>
                               );
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
                            {item.category_id ? ((categories.find((c: any) => (c.id ?? c.ID) === item.category_id))?.sub_categories || []).map((sc: any, scIdx: number) => {
                              const subCatId = sc.id ?? sc.ID ?? scIdx;
                              return (
                                <option key={subCatId} value={subCatId}>{sc.sub_category_name || sc.name}</option>
                              );
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
                          <TableCell className="py-2.5 px-3 text-right">
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



          {/* Inline Alert Banner — informational only, action buttons stay in footer */}
          {(validationWarnings.length > 0 || priceMismatchedItems.length > 0) && (
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
              {/* Footer buttons — change context when banner is active */}
              {showBanner ? (
                <>
                  <button
                    type="button"
                    onClick={handleDismissValidation}
                    disabled={saving}
                    className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 px-5 py-3 rounded-none text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    ยกเลิก
                  </button>
                  {priceMismatchedItems.length > 0 && !isEmployee && !isDraftMode && (
                    <>
                      <button
                        type="button"
                        onClick={handleSkipPriceUpdate}
                        disabled={saving}
                        className="bg-[#1C1B1B] hover:bg-gray-800 text-white px-6 py-3 rounded-none text-xs font-bold flex items-center gap-2 transition-all shadow-xs disabled:bg-gray-400 cursor-pointer"
                      >
                        <Save size={16} />
                        <span>บันทึกโดยไม่อัปเดตราคาทุน</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmUpdatePrices}
                        disabled={saving}
                        className="bg-[#e51c23] hover:bg-[#c9181f] text-white px-8 py-3 rounded-none text-xs font-bold flex items-center gap-2 transition-all shadow-xs disabled:bg-gray-400 cursor-pointer"
                      >
                        <Save size={16} />
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
                      {saving ? (
                        <span>กำลังบันทึก...</span>
                      ) : (
                        <>
                          <Save size={16} />
                          <span>
                            {isDraftMode
                              ? 'ยืนยันบันทึกเป็นแบบร่าง'
                              : isEmployee
                                ? 'ยืนยันส่งให้ Owner ตรวจสอบ'
                                : 'ยืนยันบันทึก'}
                          </span>
                        </>
                      )}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setCurrentView('home')}
                    disabled={saving}
                    className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 px-5 py-3 rounded-none text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  {!isDraftMode && (
                    <button
                      type="button"
                      onClick={() => handleSaveBill(true)}
                      disabled={saving || formData.items.length === 0}
                      className="bg-[#1C1B1B] hover:bg-gray-800 text-white px-6 py-3 rounded-none text-xs font-bold flex items-center gap-2 transition-all shadow-xs disabled:bg-gray-400 cursor-pointer"
                    >
                      <Save size={16} />
                      <span>บันทึกเป็นแบบร่าง</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSaveBill(isDraftMode)}
                    disabled={saving || formData.items.length === 0}
                    className="bg-[#e51c23] hover:bg-[#c9181f] text-white px-8 py-3 rounded-none text-xs font-bold flex items-center gap-2 transition-all shadow-xs disabled:bg-gray-400 cursor-pointer"
                  >
                    {saving ? (
                      <span>กำลังบันทึก...</span>
                    ) : (
                      <>
                        <Save size={16} />
                        <span>{isDraftMode ? 'บันทึกเป็นแบบร่าง' : 'บันทึกบิลต่อไป'}</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
