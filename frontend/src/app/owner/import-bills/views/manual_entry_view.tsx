import { useMemo } from 'react';
import { ChevronRight, Save, Trash2, AlertCircle } from 'lucide-react';
import Heading from '../../../../components/elements/heading';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../../components/elements/table';
import TreeSelect from '../../../../components/elements/tree_select';
import type { CascaderOption } from '../../../../components/elements/cascader';
import type { ViewState, Supplier, Product, ScannedBillData } from '../../../../interface/import';
import { validateBillItems, type ItemIssue } from '../../../../utils/excelImport';
import ProductSearchSelect from '../components/product_search_select';
import InlineValidationAlertBanner from '../components/inline_validation_alert_banner';
import BillSummaryFooterBar from '../components/BillSummaryFooterBar';
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
  handleItemCategoryChange?: (
    idx: number,
    categoryId: number | null,
    subCategoryId: number | null,
    subSubCategoryId: number | null
  ) => void;
  handleRemoveRow: (idx: number) => void;
  handleAddRow: () => void;
  exportBillItemsToExcel: () => void;
  handleSaveBill: (isDraft?: boolean, skipCheck?: boolean, skipPriceCheck?: boolean) => void;
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
  handleItemCategoryChange,
  handleRemoveRow,
  handleAddRow,
  handleSaveBill,
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


  const showBanner = (validationWarnings.length > 0 || priceMismatchedItems.length > 0 || pendingNewProducts.length > 0) && !!handleConfirmValidationSave && !!handleDismissValidation;

  // Row validation — แสดง error รายแถวแบบ inline (ไม่ block การบันทึก)
  const itemIssues: Record<number, ItemIssue> = formData ? validateBillItems(formData.items) : {};
  const issueCount = Object.keys(itemIssues).length;
  const issueField = (idx: number, field: string): boolean => !!itemIssues[idx]?.fields.includes(field);
  const errInputClass = 'border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-red-400';

  // สร้างต้นไม้หมวดหมู่ (หลัก > ย่อย) สำหรับ TreeSelect แบบ cascading — รูปแบบเดียวกับฟอร์มสินค้าของ WMS
  // prefix value ด้วย category-/subcategory- กัน id ชนกันข้ามตาราง
  const categoryTreeOptions: CascaderOption[] = useMemo(() => {
    return (categories || []).map((c: any, cIdx: number) => {
      const catId = c.id ?? c.ID ?? cIdx;
      return {
        value: `category-${catId}`,
        label: c.category_name || c.name || `หมวดหมู่ ${catId}`,
        children: (c.sub_categories || []).map((sc: any, scIdx: number) => {
          const subCatId = sc.id ?? sc.ID ?? scIdx;
          return {
            value: `subcategory-${subCatId}`,
            label: sc.sub_category_name || sc.name || `หมวดหมู่ย่อย ${subCatId}`,
            children: (sc.sub_sub_categories || []).map((ssc: any, sscIdx: number) => {
              const subSubCatId = ssc.id ?? ssc.ID ?? sscIdx;
              return {
                value: `subsubcategory-${subSubCatId}`,
                label: ssc.sub_sub_category_name || ssc.name || `หมวดหมู่ย่อยย่อย ${subSubCatId}`,
              };
            }),
          };
        }),
      };
    });
  }, [categories]);

  return (
    <div className="p-8 max-w-full mx-auto w-full animate-in fade-in duration-300">
      {/* Breadcrumbs Navigation */}
      <nav className="flex items-center gap-2 text-xs text-gray-500 mb-4">
        <button type="button" onClick={() => setCurrentView('home')} className="hover:text-[#e51c23] transition-colors cursor-pointer font-bold">
          นำเข้าสินค้าจากบิล
        </button>
        <ChevronRight size={14} className="text-gray-400" />
        <span className="text-[#1C1B1B] font-bold">กรอกข้อมูลด้วยตนเอง</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <Heading level="h1" className="mb-0 font-extrabold text-[#1C1B1B]">
          กรอกข้อมูลบิลนำเข้าด้วยตนเอง
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
              <label className="block text-xs font-bold text-gray-700 mb-2">วันที่ในบิล</label>
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
                    {po.po_number || po.order_number} ({po.supplier_name || 'ไม่ระบุซัพพลายเออร์'}) - ฿{po.total_amount?.toLocaleString() || 0}
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

          {/* Row Issues Summary */}
          {issueCount > 0 && (
            <div className="mx-6 mt-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-none flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 text-red-500 mt-0.5" />
              <div>
                <span className="font-bold">พบข้อมูลที่ควรตรวจสอบ {issueCount} รายการ</span>
                <ul className="list-disc ml-4 mt-1 space-y-0.5">
                  {Object.entries(itemIssues).slice(0, 5).map(([idx, issue]) => (
                    <li key={idx}>
                      แถวที่ {Number(idx) + 1}: {issue.messages.join(' · ')}
                    </li>
                  ))}
                  {issueCount > 5 && <li>และอีก {issueCount - 5} รายการ (ดูในตารางด้านล่าง)</li>}
                </ul>
                <p className="mt-1 text-red-500">* ยังสามารถบันทึกได้ แตะที่ช่องสีแดงในตารางเพื่อแก้ไข</p>
              </div>
            </div>
          )}

          {/* Items Table */}
          <div className="flex-1 overflow-y-auto max-h-[400px]">
            <Table className="min-w-[1250px] text-left text-sm border-collapse">
              <TableHeader className="bg-gray-100 text-[#5F5E5E] border-b border-gray-200 text-xs uppercase tracking-wider">
                <TableRow>
                  <TableHead className="py-3.5 px-4 font-bold text-left text-[#5F5E5E] min-w-[150px]">รหัสสินค้าคู่ค้า</TableHead>
                  <TableHead className="py-3.5 px-4 font-bold text-left text-[#5F5E5E] min-w-[260px]">ชื่อสินค้าตามบิล</TableHead>
                  <TableHead className="py-3.5 px-4 font-bold text-left text-[#5F5E5E] min-w-[280px]">จับคู่สินค้าในร้าน</TableHead>
                  <TableHead className="py-3.5 px-4 font-bold text-left text-[#5F5E5E] min-w-[200px]">หมวดหมู่</TableHead>
                  <TableHead className="py-3.5 px-4 font-bold text-right text-[#5F5E5E] min-w-[80px]">จำนวน</TableHead>
                  <TableHead className="py-3.5 px-4 font-bold text-center text-[#5F5E5E] min-w-[70px]">หน่วย</TableHead>
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
                    return (
                      <TableRow key={idx} className="hover:bg-gray-50/80 align-top transition-colors">
                      <TableCell className="py-2.5 px-3">
                        <div className="flex flex-col gap-1">
                          <input 
                            type="text"
                            value={item.company_product_code || ''}
                            onChange={(e) => handleItemChange(idx, 'company_product_code', e.target.value)}
                            placeholder="รหัสสินค้าคู่ค้า"
                            className={`bg-white border rounded-none focus:ring-1 w-full text-sm font-mono text-[#1C1B1B] px-3 py-1.5 shadow-2xs ${issueField(idx, 'code') ? errInputClass : 'border-gray-300 focus:border-[#e51c23] focus:ring-[#e51c23]'}`}
                          />
                          {issueField(idx, 'code') && itemIssues[idx] && (
                            <span className="text-[10px] font-bold text-red-600">{itemIssues[idx].messages.find((m) => m.includes('รหัส')) || itemIssues[idx].messages[0]}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 px-3">
                        <div className="flex flex-col gap-1">
                          <input 
                            type="text"
                            value={item.company_product_name || ''}
                            onChange={(e) => handleItemChange(idx, 'company_product_name', e.target.value)}
                            placeholder="ชื่อสินค้าในบิล"
                            className={`bg-white border rounded-none focus:ring-1 w-full text-sm font-medium text-[#1C1B1B] px-3 py-1.5 shadow-2xs ${issueField(idx, 'name') ? errInputClass : 'border-gray-300 focus:border-[#e51c23] focus:ring-[#e51c23]'}`}
                          />
                          {issueField(idx, 'name') && (
                            <span className="text-[10px] font-bold text-red-600">กรอกชื่อสินค้า</span>
                          )}
                          {item.pre_order_item_id && (
                            <span className="text-[10px] font-bold text-purple-700">
                              สินค้าพรีออเดอร์ของลูกค้า
                            </span>
                          )}
                          {item.po_item_id && !item.pre_order_item_id && <span className="text-[10px] text-slate-600">สินค้าเติมสต็อกร้าน</span>}
                        </div>
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
                            if (prod && (prod.category_name || prod.sub_category_name || prod.sub_sub_category_name)) {
                              return (
                                <span className="text-sm text-[#1C1B1B]" title={[prod.category_name, prod.sub_category_name, prod.sub_sub_category_name].filter(Boolean).join(' / ')}>
                                  {[prod.category_name, prod.sub_category_name, prod.sub_sub_category_name].filter(Boolean).join(' / ')}
                                </span>
                              );
                            }
                            return <span className="text-gray-400 text-sm">-</span>;
                          })()
                        ) : (
                          <TreeSelect
                            options={categoryTreeOptions}
                            placeholder="เลือกหมวดหมู่"
                            searchPlaceholder="ค้นหาหมวดหมู่..."
                            value={
                              item.sub_sub_category_id
                                ? `subsubcategory-${item.sub_sub_category_id}`
                                : item.sub_category_id
                                ? `subcategory-${item.sub_category_id}`
                                : item.category_id
                                  ? `category-${item.category_id}`
                                  : ''
                            }
                            onChange={(_val, path) => {
                              if (!handleItemCategoryChange) return;
                              const catVal = path[0]?.value || '';
                              const subVal = path[1]?.value || '';
                              const subSubVal = path[2]?.value || '';
                              const catId = catVal.startsWith('category-') ? Number(catVal.replace('category-', '')) : null;
                              const subCatId = subVal.startsWith('subcategory-') ? Number(subVal.replace('subcategory-', '')) : null;
                              const subSubCatId = subSubVal.startsWith('subsubcategory-') ? Number(subSubVal.replace('subsubcategory-', '')) : null;
                              handleItemCategoryChange(idx, catId, subCatId, subSubCatId);
                            }}
                          />
                        )}
                      </TableCell>
                      {Number(item.order_quantity) === 0 ? (
                        <TableCell colSpan={4} className="py-2.5 px-3 text-center font-bold text-[#e51c23] bg-red-50/20">
                          ไม่มีสินค้า
                        </TableCell>
                      ) : (
                        <>
                          <TableCell className="py-2.5 px-3 text-right">
                            <input
                              type="number"
                              value={item.order_quantity ?? 0}
                              onChange={(e) => handleItemChange(idx, 'order_quantity', e.target.value)}
                              className={`bg-white border rounded-none focus:ring-1 w-16 text-right text-sm text-[#1C1B1B] p-1.5 font-medium ${issueField(idx, 'quantity') ? errInputClass : 'border-gray-300 focus:border-[#e51c23] focus:ring-[#e51c23]'}`}
                            />
                          </TableCell>
                          <TableCell className="py-2.5 px-3 text-center">
                            <input
                              type="text"
                              value={item.unit || ''}
                              onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                              className="bg-white border border-gray-300 rounded-none focus:border-[#e51c23] focus:ring-1 focus:ring-[#e51c23] w-14 text-center text-sm text-[#5F5E5E] p-1.5 font-medium"
                            />
                          </TableCell>
                          <TableCell className="py-2.5 px-3 text-right">
                            <input 
                              type="number" 
                              step="0.01"
                              value={item.price_per_unit ?? 0}
                              onChange={(e) => handleItemChange(idx, 'price_per_unit', e.target.value)}
                              className={`bg-white border rounded-none focus:ring-1 w-20 text-right text-sm text-[#1C1B1B] font-bold p-1.5 ${issueField(idx, 'price') ? errInputClass : 'border-gray-300 focus:border-[#e51c23] focus:ring-[#e51c23]'}`}
                            />
                          </TableCell>
                          <TableCell className="py-2.5 px-4 text-right font-bold text-[#1C1B1B] text-sm">
                            ฿{((item.order_quantity || 0) * (item.price_per_unit || 0) - (item.discount_amount || 0)).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                          </TableCell>
                        </>
                      )}
                      <TableCell className="py-2.5 px-4 text-center">
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
                      onClick={() => showBanner ? handleSaveBill(false, true, true) : handleSaveBill(isDraftMode)}
                      disabled={saving || formData.items.length === 0}
                      className="bg-[#e51c23] hover:bg-[#c9181f] text-white px-8 py-3 rounded-none text-xs font-bold flex items-center gap-2 transition-all shadow-xs disabled:bg-gray-400 cursor-pointer"
                    >
                      {saving ? (
                        <span>กำลังบันทึก...</span>
                      ) : (
                        <>
                          <Save size={16} />
                          <span>{showBanner ? 'ยืนยันบันทึกข้อมูลต่อไป' : 'บันทึกข้อมูล'}</span>
                        </>
                      )}
                    </button>
                  </>
                )}
            </BillSummaryFooterBar>
        </div>
      </div>
    </div>
  );
}
