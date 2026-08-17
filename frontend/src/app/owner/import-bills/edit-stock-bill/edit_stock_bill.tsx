import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ChevronLeft, ChevronRight, Search, RefreshCw, 
  Edit3, CheckCircle2, DollarSign, Tag
} from 'lucide-react';
import Heading from '../../../../components/elements/heading';
import Card from '../../../../components/elements/card';
import Input from '../../../../components/elements/input';
import Select from '../../../../components/elements/select';
import MultiSelect from '../../../../components/elements/multiselect';
import Button from '../../../../components/elements/button';

import { 
  getProductsList, getCategoriesList, 
  getGradesList, getUnitsList, getShelvesList, getBrandsList 
} from '../../../../service/http/wms/product';
import { updateImportProduct } from '../../../../service/http/import/import_service';
import PriceMismatchBanner from '../components/price_mismatch_banner';
import type { StockItem } from '../../../../interface/wms/product';

interface SelectOption {
  label: string;
  value: string;
}

export default function EditStockBillPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Passed state or URL focus or sessionStorage
  const passedMismatches = useMemo(() => {
    if (location.state?.mismatchedItems && Array.isArray(location.state.mismatchedItems)) {
      return location.state.mismatchedItems;
    }
    try {
      const saved = sessionStorage.getItem('temp_import_bill_items');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  }, [location.state]);

  const isFromImportBill = passedMismatches.length > 0;
  const [showOnlyBillItems, setShowOnlyBillItems] = useState<boolean>(true);

  const [products, setProducts] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter] = useState<'all' | 'mismatched' | 'increase' | 'decrease'>('all');
  const [categoryFilter] = useState<string>('all');

  // Options for Edit Form
  const [categories, setCategories] = useState<SelectOption[]>([]);
  const [grades, setGrades] = useState<SelectOption[]>([]);
  const [units, setUnits] = useState<SelectOption[]>([]);
  const [shelves, setShelves] = useState<SelectOption[]>([]);
  const [models, setModels] = useState<SelectOption[]>([]);

  // Selected item being edited on the right side
  const [editingProduct, setEditingProduct] = useState<StockItem | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    product_code: '',
    part_number: '',
    product_name: '',
    barcode: '',
    quantity: 0,
    limit_quantity: 5,
    sale_price: 0,
    cost_price: 0,
    note: '',
    model_ids: [] as string[],
    category_id: '',
    grade_id: '',
    unit_id: '',
    shelf_id: '',
  });

  // Map of mismatched prices passed from import bill
  const mismatchMap = useMemo(() => {
    const map = new Map<number, { newPrice: number; companyName?: string }>();
    if (Array.isArray(passedMismatches)) {
      passedMismatches.forEach((item: any) => {
        if (item.productId) {
          map.set(Number(item.productId), {
            newPrice: Number(item.billPrice || item.newPrice || 0),
            companyName: item.companyProductName || item.productName
          });
        }
      });
    }
    return map;
  }, [passedMismatches]);

  // Filtered Products List
  const filteredItems = useMemo(() => {
    return products.filter(item => {
      const mismatch = mismatchMap.get(item.ID);
      const isMismatched = !!mismatch;

      if (isFromImportBill && showOnlyBillItems && !isMismatched) {
        return false;
      }

      if (statusFilter === 'mismatched' && !isMismatched) return false;
      if (statusFilter === 'increase') {
        if (!mismatch || mismatch.newPrice <= (item.CostPrice || 0)) return false;
      }
      if (statusFilter === 'decrease') {
        if (!mismatch || mismatch.newPrice >= (item.CostPrice || 0)) return false;
      }

      if (categoryFilter !== 'all' && item.Category !== categoryFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = item.Name?.toLowerCase().includes(q);
        const codeMatch = item.ProductCode?.toLowerCase().includes(q);
        const partMatch = item.PartNo?.toLowerCase().includes(q);
        const barMatch = item.Barcode?.toLowerCase().includes(q);
        const companyMatch = mismatch?.companyName?.toLowerCase().includes(q);
        return nameMatch || codeMatch || partMatch || barMatch || companyMatch;
      }

      return true;
    });
  }, [products, mismatchMap, statusFilter, categoryFilter, searchQuery, isFromImportBill, showOnlyBillItems]);

  // Load product into editing form
  const selectProductForEditing = (product: StockItem, suggestedCostPrice?: number) => {
    setEditingProduct(product);

    const matchedCategory = categories.find(c => c.label.toUpperCase() === product.Category?.toUpperCase());
    const matchedGrade = grades.find(g => g.label.toUpperCase() === product.Grade?.toUpperCase());
    const matchedUnit = units.find(u => u.label.toUpperCase() === product.Unit?.toUpperCase());
    const matchedShelf = shelves.find(s => s.label.toUpperCase() === product.Shelf?.toUpperCase());

    const matchedModelIds: string[] = [];
    if (product.Models && product.Models.length > 0) {
      const modelNames = product.Models.map((m: any) => (m.model_name || m.name || '').trim().toUpperCase());
      models.forEach(m => {
        const mName = m.label.split(' - ')[1]?.trim().toUpperCase();
        if (mName && modelNames.includes(mName)) {
          matchedModelIds.push(m.value);
        }
      });
    }

    const mm = mismatchMap.get(product.ID);
    const costToSet = suggestedCostPrice !== undefined 
      ? suggestedCostPrice 
      : (mm ? mm.newPrice : (product.CostPrice || 0));

    setFormData({
      product_code: product.ProductCode || '',
      part_number: product.PartNo || '',
      product_name: product.Name || '',
      barcode: product.Barcode || '',
      quantity: product.Stock || 0,
      limit_quantity: product.MinStock || 5,
      cost_price: costToSet,
      sale_price: product.Price || Math.round(costToSet * 1.25),
      note: product.Note || '',
      model_ids: matchedModelIds,
      category_id: matchedCategory ? matchedCategory.value : (categories[0]?.value || '1'),
      grade_id: matchedGrade ? matchedGrade.value : (grades[0]?.value || '1'),
      unit_id: matchedUnit ? matchedUnit.value : (units[0]?.value || '1'),
      shelf_id: matchedShelf ? matchedShelf.value : (shelves[0]?.value || '1'),
    });
  };

  // Fetch initial products and metadata
  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodData, catData, gradeData, unitData, shelfData, brandData] = await Promise.all([
        getProductsList(),
        getCategoriesList(),
        getGradesList(),
        getUnitsList(),
        getShelvesList(),
        getBrandsList(),
      ]);

      const catOpts = catData.map(c => ({ label: c.name, value: String(c.id) }));
      const gradeOpts = gradeData.map(g => ({ label: g.name, value: String(g.id) }));
      const unitOpts = unitData.map(u => ({ label: u.name, value: String(u.id) }));
      const shelfOpts = shelfData.map(s => ({ label: s.name, value: String(s.id) }));

      setProducts(prodData);
      setCategories(catOpts);
      setGrades(gradeOpts);
      setUnits(unitOpts);
      setShelves(shelfOpts);

      const modelOptions: SelectOption[] = [];
      brandData.forEach((b: any) => {
        if (b.models) {
          b.models.forEach((m: any) => {
            modelOptions.push({
              label: `${b.name || b.brand_name || ''} - ${m.model_name || m.name}`,
              value: String(m.id || m.ID),
            });
          });
        }
      });
      setModels(modelOptions);

      // Auto select first item or URL parameter
      const focusProductId = searchParams.get('productId') ? Number(searchParams.get('productId')) : null;
      let initialItem: StockItem | undefined;

      if (focusProductId) {
        initialItem = prodData.find(p => p.ID === focusProductId);
      }
      
      if (!initialItem && prodData.length > 0) {
        // If from import bill, pick first mismatched item
        if (passedMismatches.length > 0) {
          const firstMismatchId = passedMismatches[0].productId;
          initialItem = prodData.find(p => p.ID === firstMismatchId) || prodData[0];
        } else {
          initialItem = prodData[0];
        }
      }

      if (initialItem) {
        selectProductForEditing(initialItem);
      }
    } catch (err) {
      console.error('Error fetching stock bill data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);
  // Submit product update to PostgreSQL DB
  const handleSaveProduct = async (e?: React.FormEvent, goToNext = false) => {
    if (e) e.preventDefault();
    if (!editingProduct) return;

    if (!formData.product_name || !formData.category_id || !formData.unit_id) {
      alert('กรุณากรอกข้อมูลสำคัญ (ชื่อสินค้า, หมวดหมู่, หน่วยนับ) ให้ครบถ้วน');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        product_code: formData.product_code,
        part_number: formData.part_number,
        product_name: formData.product_name,
        barcode: formData.barcode,
        quantity: Number(formData.quantity),
        limit_quantity: Number(formData.limit_quantity),
        cost_price: Number(formData.cost_price),
        sale_price: Number(formData.sale_price),
        note: formData.note,
        model_ids: formData.model_ids.map(Number),
        category_id: Number(formData.category_id),
        grade_id: Number(formData.grade_id),
        unit_id: Number(formData.unit_id),
        shelf_id: Number(formData.shelf_id),
      };

      await updateImportProduct(editingProduct.ID, payload);

      setSaveSuccessMsg(`อัปเดตข้อมูลสินค้า "${formData.product_name}" เรียบร้อยแล้ว`);
      setTimeout(() => setSaveSuccessMsg(null), 3000);

      // If requested, navigate to next item in left list
      if (goToNext && filteredItems.length > 0) {
        const currentIdx = filteredItems.findIndex(i => i.ID === editingProduct.ID);
        if (currentIdx >= 0 && currentIdx < filteredItems.length - 1) {
          const nextItem = filteredItems[currentIdx + 1];
          selectProductForEditing(nextItem);
        }
      }

      // Refresh list in background
      const prodData = await getProductsList();
      setProducts(prodData);
    } catch (err: any) {
      console.error('Error updating product:', err);
      alert(err.response?.data?.error || 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลสินค้าในฐานข้อมูล');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-full mx-auto w-full animate-in fade-in duration-300">
      {/* Breadcrumbs Navigation */}
      <nav className="flex items-center gap-2 text-xs text-gray-500 mb-4">
        <button
          type="button"
          onClick={() => navigate('/owner/import-bills')}
          className="hover:text-[#e51c23] transition-colors cursor-pointer font-bold"
        >
          นำเข้าสินค้าจากบิล
        </button>
        {location.state?.returnFrom === 'approve' && location.state?.returnBillId && (
          <>
            <ChevronRight size={14} className="text-gray-400" />
            <button
              type="button"
              onClick={() => navigate('/owner/import-bills', { state: { openApproveForBill: location.state.returnBillId } })}
              className="hover:text-[#e51c23] transition-colors cursor-pointer"
            >
              อนุมัติบิลนำเข้าสินค้า {location.state.billNo ? `(เลขที่: ${location.state.billNo})` : ''}
            </button>
          </>
        )}
        <ChevronRight size={14} className="text-gray-400" />
        <span className="text-[#1C1B1B] font-bold">แก้ไขและปรับราคาสินค้า</span>
      </nav>

      {/* Top Header Bar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Heading level="h1" className="mb-0 font-extrabold text-[#1C1B1B]">
            จัดการการเปลี่ยนแปลงราคาในบิล
          </Heading>
          <p className="text-xs text-[#5F5E5E] mt-1">
            เลือกรายการสินค้าฝั่งซ้ายเพื่อตรวจสอบ และปรับแก้ไขรายละเอียด ราคาทุน และราคาขายรายสินค้าฝั่งขวา
          </p>
        </div>

        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1C1B1B] hover:bg-gray-800 text-white text-xs font-bold rounded-none border border-gray-700 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>รีเฟรชข้อมูลคลัง</span>
        </button>
      </div>

      {/* Mismatch Alert Banner Component */}
      <PriceMismatchBanner count={passedMismatches.length} />

      {/* Toast Alert */}
      {saveSuccessMsg && (
        <div className="mb-4 bg-emerald-50 border border-emerald-300 text-emerald-800 px-5 py-3 rounded-none flex items-center gap-3 animate-in fade-in duration-300 shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-xs font-bold">{saveSuccessMsg}</span>
        </div>
      )}

      {/* 2-Column Full Page Layout (Split View) */}
      <Card className="overflow-hidden rounded-none border border-gray-200 shadow-sm flex flex-col md:flex-row min-h-[75vh]" noPadding>
        
        {/* LEFT COLUMN: Sidebar list of bill items (ฝั่งซ้าย: แท็บรายการสินค้าในบิล) */}
        <div className="w-full md:w-80 lg:w-96 bg-gray-50 border-r border-gray-200 flex flex-col shrink-0">
          
          {/* Left Column Header & Search */}
          <div className="p-4 bg-gray-100 border-b border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-[#1C1B1B] flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-[#e51c23]" />
                รายการสินค้าในบิล ({filteredItems.length})
              </span>

              {isFromImportBill && (
                <button
                  type="button"
                  onClick={() => setShowOnlyBillItems(!showOnlyBillItems)}
                  className="text-[10px] font-bold text-[#e51c23] hover:underline cursor-pointer"
                >
                  {showOnlyBillItems ? 'ดูทั้งหมดในคลัง' : 'เฉพาะในบิลนี้'}
                </button>
              )}
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อสินค้า, รหัสระบบ..."
                className="w-full bg-white border border-gray-300 rounded-none pl-8 pr-3 py-1.5 text-xs font-medium text-[#1C1B1B] focus:border-[#e51c23] outline-none"
              />
            </div>
          </div>

          {/* Left Column Scrollable Item List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-200">
            {loading ? (
              <div className="p-8 text-center text-xs text-[#5F5E5E]">
                <RefreshCw className="w-6 h-6 animate-spin text-[#e51c23] mx-auto mb-2" />
                กำลังโหลดรายการ...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">
                ไม่พบรายการสินค้า
              </div>
            ) : (
              filteredItems.map((item, idx) => {
                const isSelected = editingProduct?.ID === item.ID;
                const mismatch = mismatchMap.get(item.ID);
                const isMismatched = !!mismatch;

                return (
                  <div
                    key={item.ID}
                    onClick={() => selectProductForEditing(item, mismatch?.newPrice)}
                    className={`p-3.5 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-white text-[#1C1B1B] font-bold border-l-4 border-[#e51c23] shadow-xs'
                        : 'bg-gray-50 text-[#5F5E5E] hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] font-mono text-gray-400 shrink-0 mt-0.5">
                        #{idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-xs truncate ${isSelected ? 'font-extrabold text-[#1C1B1B]' : 'font-semibold'}`}>
                          {item.Name}
                        </h4>
                        <div className="text-[10px] font-mono text-gray-500 truncate mt-0.5">
                          {item.ProductCode} {item.PartNo ? `| ${item.PartNo}` : ''}
                        </div>
                      </div>
                    </div>

                    {isMismatched && (
                      <div className="mt-2 text-[10px] bg-red-50 p-1.5 border border-red-200 text-red-800 flex justify-between items-center">
                        <span>ราคานำเข้าใหม่:</span>
                        <strong className="text-[#e51c23] font-bold">฿{mismatch.newPrice.toLocaleString()}</strong>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Detailed Product Editing Form (ฝั่งขวา: รายละเอียดสินค้านั้นๆ) */}
        <div className="flex-1 bg-white p-6 flex flex-col justify-between overflow-y-auto">
          {editingProduct ? (
            <form onSubmit={(e) => handleSaveProduct(e, false)} className="space-y-5 flex-1 flex flex-col justify-between">
              <div className="space-y-5">
                
                {/* Product Title Banner */}
                <div className="bg-[#1C1B1B] text-white p-4 rounded-none flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#e51c23] tracking-wider">
                      กำลังแก้ไขรายละเอียดสินค้า
                    </span>
                    <h3 className="text-base font-extrabold text-white mt-0.5">
                      {formData.product_name || editingProduct.Name}
                    </h3>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">
                      CODE: {editingProduct.ProductCode} | PART NO: {editingProduct.PartNo || '-'}
                    </p>
                  </div>
                  <div className="p-2.5 bg-gray-800 text-[#e51c23]">
                    <Edit3 className="w-5 h-5" />
                  </div>
                </div>
                {/* Main Form Inputs */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="ชื่อสินค้า"
                    required
                    value={formData.product_name}
                    onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                    placeholder="เช่น ผ้าเบรคหน้า Toyota Vios"
                  />
                  <Input
                    label="รหัสสินค้า"
                    required
                    value={formData.product_code}
                    onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
                    placeholder="เช่น BR-900X"
                  />
                  <Input
                    label="PART NO."
                    value={formData.part_number}
                    onChange={(e) => setFormData({ ...formData, part_number: e.target.value })}
                    placeholder="เช่น PT-TURBO-01"
                  />
                  <Input
                    label="บาร์โค้ด"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="เช่น 8850000000001"
                  />
                </div>

                {/* Price Setup Box */}
                <div className="p-4 bg-gray-50 border border-gray-200 space-y-3">
                  <div className="font-bold text-[#1C1B1B] text-xs flex items-center gap-1.5 border-b border-gray-200 pb-2">
                    <DollarSign className="w-4 h-4 text-[#e51c23]" />
                    กำหนดราคาทุนและราคาขายใหม่
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-slate-700">
                        ราคาทุนเดิมในคลัง
                      </label>
                      <div className="h-10 w-full rounded-none bg-gray-100 border border-gray-300 px-3 flex items-center text-sm font-bold text-slate-800">
                        ฿{(editingProduct?.CostPrice || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    <Input
                      label="ราคาทุนใหม่จากบิล"
                      type="number"
                      step="any"
                      required
                      value={formData.cost_price || ''}
                      onChange={(e) => setFormData({ ...formData, cost_price: Number(e.target.value) })}
                      placeholder="เช่น 600"
                    />
                    <Input
                      label="ราคาขายตั้งใหม่"
                      type="number"
                      step="any"
                      required
                      value={formData.sale_price || ''}
                      onChange={(e) => setFormData({ ...formData, sale_price: Number(e.target.value) })}
                      placeholder="เช่น 900"
                    />
                  </div>
                </div>

                {/* Quantities */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="จำนวนคงเหลือในคลัง"
                    type="number"
                    value={formData.quantity || ''}
                    onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                    placeholder="เช่น 50"
                  />
                  <Input
                    label="จำนวนขั้นต่ำแจ้งเตือนสต็อก"
                    type="number"
                    value={formData.limit_quantity || ''}
                    onChange={(e) => setFormData({ ...formData, limit_quantity: Number(e.target.value) })}
                    placeholder="เช่น 5"
                  />
                </div>

                {/* Categories & Dropdowns */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Select
                    label="หมวดหมู่สินค้า"
                    required
                    options={categories}
                    placeholder="เลือกหมวดหมู่"
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  />
                  <Select
                    label="เกรดสินค้า"
                    required
                    options={grades}
                    placeholder="เลือกเกรด"
                    value={formData.grade_id}
                    onChange={(e) => setFormData({ ...formData, grade_id: e.target.value })}
                  />
                  <Select
                    label="หน่วยนับ"
                    required
                    options={units}
                    placeholder="เลือกหน่วย"
                    value={formData.unit_id}
                    onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
                  />
                  <Select
                    label="ชั้นวาง (Shelf)"
                    required
                    options={shelves}
                    placeholder="เลือกชั้นวาง"
                    value={formData.shelf_id}
                    onChange={(e) => setFormData({ ...formData, shelf_id: e.target.value })}
                  />
                  <div className="sm:col-span-2">
                    <MultiSelect
                      label="รุ่นรถที่รองรับ (Models)"
                      options={models}
                      placeholder="เลือกรุ่นรถที่รองรับ..."
                      value={formData.model_ids}
                      onChange={(values) => setFormData({ ...formData, model_ids: values })}
                    />
                  </div>
                </div>

                <Input
                  label="หมายเหตุ / รายละเอียดเพิ่มเติม"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  placeholder="เช่น หมายเหตุการปรับราคา หรือรายละเอียดของสินค้า"
                />
              </div>

              {/* Action Buttons Footer */}
              <div className="flex items-center justify-end border-t border-gray-200 pt-4 mt-6">
                <div className="flex items-center gap-3">
                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={submitting}
                    className="bg-[#1C1B1B] hover:bg-gray-800 text-white font-bold rounded-none text-xs px-5"
                  >
                    บันทึกสินค้ารายการนี้
                  </Button>

                  <Button
                    type="button"
                    variant="primary"
                    onClick={(e) => handleSaveProduct(e, true)}
                    isLoading={submitting}
                    className="bg-[#e51c23] hover:bg-[#c9181f] text-white font-bold rounded-none text-xs px-6 flex items-center gap-1"
                  >
                    <span>บันทึกและไปรายการถัดไป</span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </form>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              กรุณาเลือกรายการสินค้าฝั่งซ้าย
            </div>
          )}
        </div>

      </Card>
    </div>
  );
}
