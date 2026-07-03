import React, { useState, useEffect } from 'react';
import apiClient from '../../../service/http/apiClient';

import { 
  Camera, FileUp, ArrowRight, Eye, History, 
  ZoomIn, ZoomOut, RotateCw, Save, Trash2,
  ChevronLeft, ChevronRight, LayoutPanelLeft, Loader2, AlertCircle
} from 'lucide-react';

import {
  scanBill,
  confirmBillImport,
  updateBill,
  deleteBill
} from '../../../service/http/import/import_service';

type ViewState = 'home' | 'scan' | 'excel';

interface Supplier {
  id: number;
  supplier_name: string;
  short_supplier_name: string;
}

interface Product {
  id: number;
  product_name: string;
  product_code: string;
}

interface BillItemDTO {
  item_sequence: number;
  company_product_code: string;
  company_product_name: string;
  ai_product_code?: string;
  ai_product_name?: string;
  order_quantity: number;
  unit: string;
  conversion_factor: number;
  price_per_unit: number;
  discount_amount: number;
  net_amount: number;
  is_freebie: boolean;
  remark: string;
  product_id: number | null;
}

interface ScannedBillData {
  bill_no: string;
  total_amount: number;
  due_date: string;
  transport_by: string;
  supplier_id: number;
  subtotal: number;
  discount_total: number;
  credit_term: string;
  vat_amount: number;
  grand_total: number;
  payment_status: string;
  items: BillItemDTO[];
  db_job_id: number;
  bill_image_id: number;
  filename?: string;
}

interface SavedBill {
  id: number;
  bill_no: string;
  total_amount: number;
  due_date: string;
  transport_by: string;
  supplier_id: number;
  subtotal: number;
  discount_total: number;
  credit_term: string;
  vat_amount: number;
  grand_total: number;
  payment_status: string;
  is_verified: boolean;
  created_at: string;
  bill_image?: {
    id: number;
    image_url: string;
  };
  bill_items?: {
    id: number;
    bill_id: number;
    item_sequence: number;
    company_product_code: string;
    company_product_name: string;
    order_quantity: number;
    unit: string;
    conversion_factor: number;
    price_per_unit: number;
    discount_amount: number;
    net_amount: number;
    is_freebie: boolean;
    remark: string;
    product_id: number;
  }[];
}

export default function ImportBill() {
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [editingBillId, setEditingBillId] = useState<number | null>(null);
  const [bills, setBills] = useState<SavedBill[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  // Loading and Error States
  const [loadingBills, setLoadingBills] = useState(false);
  const [loadingSuppliersProducts, setLoadingSuppliersProducts] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Batch Mode States
  const [batchImages, setBatchImages] = useState<File[]>([]);
  const [batchResults, setBatchResults] = useState<ScannedBillData[]>([]);
  const [activeBatchIndex, setActiveBatchIndex] = useState<number>(0);
  const [batchProgress, setBatchProgress] = useState<{ [key: string]: 'pending' | 'scanning' | 'success' | 'failed' }>({});
  const [batchErrorMsg, setBatchErrorMsg] = useState<string | null>(null);

  // File Upload State
  const [billImage, setBillImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotate, setRotate] = useState(0);

  // Form State
  const [formData, setFormData] = useState<ScannedBillData | null>(null);
  const [poReference, setPoReference] = useState('1'); // Default to PO ID 1 in local seed

  // Fetch lists on mount
  useEffect(() => {
    fetchBills();
    fetchSuppliersAndProducts();
    if (loadingSuppliersProducts || batchErrorMsg) {
      // noop
    }
  }, [loadingSuppliersProducts, batchErrorMsg]);

  const handleAddRow = () => {
    if (!formData) return;
    const newRow = {
      item_sequence: formData.items.length + 1,
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
      product_id: products[0]?.id || 2
    };
    
    const updatedItems = [...formData.items, newRow];
    const updated = {
      ...formData,
      items: updatedItems
    };
    setFormData(updated);
    if (batchResults.length > 0) {
      const newResults = [...batchResults];
      newResults[activeBatchIndex] = updated;
      setBatchResults(newResults);
    }
  };

  const handleRemoveRow = (idx: number) => {
    if (!formData) return;
    const updatedItems = formData.items.filter((_, i) => i !== idx);
    
    let newSubtotal = 0;
    updatedItems.forEach(item => {
      newSubtotal += item.net_amount;
    });
    const newVat = Math.round((newSubtotal * 0.07) * 100) / 100;
    const newTotal = newSubtotal - formData.discount_total + newVat;
    
    const updated = {
      ...formData,
      items: updatedItems,
      subtotal: newSubtotal,
      vat_amount: newVat,
      total_amount: newTotal,
      grand_total: newTotal
    };
    setFormData(updated);
    if (batchResults.length > 0) {
      const newResults = [...batchResults];
      newResults[activeBatchIndex] = updated;
      setBatchResults(newResults);
    }
  };

  const updateFormState = (updates: Partial<ScannedBillData>) => {
    if (!formData) return;
    const updated = { ...formData, ...updates };
    setFormData(updated);
    if (batchResults.length > 0) {
      const newResults = [...batchResults];
      newResults[activeBatchIndex] = updated;
      setBatchResults(newResults);
    }
  };

  const handleDeleteBill = async (id: number) => {
    if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบบิลนี้ออกจากระบบ? การลบจะไม่สามารถกู้คืนข้อมูลกลับมาได้')) {
      return;
    }
    
    try {
      await deleteBill(id);
      await fetchBills();
    } catch (err: any) {
      console.error('Error deleting bill:', err);
      alert('ล้มเหลวในการลบบิล: ' + (err.message || err));
    }
  };

  const handleViewSavedBill = (bill: SavedBill) => {
    setEditingBillId(bill.id);
    setErrorMsg(null);
    
    setFormData({
      bill_no: bill.bill_no,
      total_amount: bill.total_amount,
      due_date: bill.due_date ? bill.due_date.split('T')[0] : '',
      transport_by: bill.transport_by || '',
      supplier_id: bill.supplier_id,
      subtotal: bill.subtotal || bill.total_amount,
      discount_total: bill.discount_total || 0,
      credit_term: bill.credit_term || '',
      vat_amount: bill.vat_amount || 0,
      grand_total: bill.grand_total || bill.total_amount,
      payment_status: bill.payment_status || 'unpaid',
      items: (bill.bill_items || []).map((item, idx) => ({
        item_sequence: item.item_sequence || (idx + 1),
        company_product_code: item.company_product_code,
        company_product_name: item.company_product_name,
        order_quantity: item.order_quantity,
        unit: item.unit,
        conversion_factor: item.conversion_factor || 1.0,
        price_per_unit: item.price_per_unit,
        discount_amount: item.discount_amount || 0,
        net_amount: item.net_amount || (item.order_quantity * item.price_per_unit),
        is_freebie: item.is_freebie || false,
        remark: item.remark || '',
        product_id: item.product_id || null,
      })),
      db_job_id: 0,
      bill_image_id: bill.bill_image?.id || 1,
    });

    if (bill.bill_image && bill.bill_image.image_url) {
      const url = bill.bill_image.image_url;
      if (url.startsWith('http')) {
        setPreviewUrl(url);
      } else {
        const cleanUrl = url.startsWith('/') ? url.substring(1) : url;
        const finalPath = cleanUrl.startsWith('uploads/') ? cleanUrl : `uploads/${cleanUrl}`;
        setPreviewUrl(`http://localhost:8080/${finalPath}`);
      }
    } else {
      setPreviewUrl(null);
    }
    
    setCurrentView('scan');
  };

  const fetchBills = async () => {
    setLoadingBills(true);
    try {
      const response = await apiClient.get('/import-data/bills');
      if (response.data) {
        setBills(Array.isArray(response.data) ? response.data : (response.data.data || []));
      }
    } catch (err: any) {
      console.error('Error fetching bills:', err);
    } finally {
      setLoadingBills(false);
    }
  };

  const handleItemChange = (idx: number, key: keyof BillItemDTO, value: any) => {
    if (!formData) return;
    const updatedItems = [...formData.items];
    
    let val = value;
    if (key === 'order_quantity' || key === 'price_per_unit' || key === 'discount_amount' || key === 'conversion_factor') {
      val = Number(value) || 0;
    } else if (key === 'is_freebie') {
      val = value === 'true' || value === true;
      if (val) {
        updatedItems[idx].price_per_unit = 0;
      }
    }
    
    updatedItems[idx] = {
      ...updatedItems[idx],
      [key]: val
    };

    // Calculate net_amount: (qty * price) - discount
    const qty = updatedItems[idx].order_quantity;
    const price = updatedItems[idx].price_per_unit;
    const disc = updatedItems[idx].discount_amount;
    updatedItems[idx].net_amount = (qty * price) - disc;

    // Recompute bill subtotal, vat, and grand total
    let newSubtotal = 0;
    updatedItems.forEach(item => {
      newSubtotal += item.net_amount;
    });

    const newVat = Math.round((newSubtotal * 0.07) * 100) / 100;
    const newTotal = newSubtotal - formData.discount_total + newVat;

    const updated = {
      ...formData,
      items: updatedItems,
      subtotal: newSubtotal,
      vat_amount: newVat,
      total_amount: newTotal,
      grand_total: newTotal
    };
    setFormData(updated);

    if (batchResults.length > 0) {
      const newResults = [...batchResults];
      newResults[activeBatchIndex] = updated;
      setBatchResults(newResults);
    }
  };

  const fetchSuppliersAndProducts = async () => {
    setLoadingSuppliersProducts(true);
    try {
      const [suppliersRes, productsRes] = await Promise.all([
        apiClient.get('/wms/suppliers'),
        apiClient.get('/wms/products')
      ]);
      if (suppliersRes.data) {
        setSuppliers(Array.isArray(suppliersRes.data) ? suppliersRes.data : (suppliersRes.data.data || []));
      }
      if (productsRes.data) {
        setProducts(Array.isArray(productsRes.data) ? productsRes.data : (productsRes.data.data || []));
      }
    } catch (err: any) {
      console.error('Error fetching configuration details:', err);
    } finally {
      setLoadingSuppliersProducts(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      if (files.length === 1) {
        // Single file flow
        const file = files[0];
        setBillImage(file);
        setBatchImages([]);
        setPreviewUrl(URL.createObjectURL(file));
        setFormData(null);
        setBatchResults([]);
      } else {
        // Batch file flow
        setBatchImages(files);
        setBillImage(null);
        setPreviewUrl(URL.createObjectURL(files[0])); // Preview first file initially
        setFormData(null);
        setBatchResults([]);
        
        // Initialize progress
        const initProgress: { [key: string]: 'pending' | 'scanning' | 'success' | 'failed' } = {};
        files.forEach(f => {
          initProgress[f.name] = 'pending';
        });
        setBatchProgress(initProgress);
      }
      setErrorMsg(null);
      setBatchErrorMsg(null);
    }
  };

  // Call FastAPI OCR Endpoint directly
  const handleOcrProcess = async () => {
    if (batchImages.length > 0) {
      await handleBatchOcrProcess();
      return;
    }

    if (!billImage) {
      setErrorMsg('กรุณาเลือกไฟล์ภาพบิลก่อนทำการสแกน');
      return;
    }

    setScanning(true);
    setErrorMsg(null);

    try {
      const parsedData = await scanBill(billImage);
      if (parsedData.error) {
        throw new Error(parsedData.error);
      }

      // Map parsed items to associate product_id automatically if they match codes in local DB
      const mappedItems = (parsedData.items || []).map((item: any) => {
        const matchedProduct = products.find(
          (p) => p.product_code.toLowerCase() === item.company_product_code.toLowerCase()
        );
        return {
          ...item,
          ai_product_name: item.company_product_name,
          ai_product_code: item.company_product_code,
          product_id: matchedProduct ? matchedProduct.id : (products[0]?.id || 2), // Default fallback to first product or 2
        };
      });

      setFormData({
        bill_no: parsedData.bill_no || '',
        total_amount: parsedData.total_amount || 0,
        due_date: parsedData.due_date || new Date().toISOString().split('T')[0],
        transport_by: parsedData.transport_by || '',
        supplier_id: parsedData.supplier_id || (suppliers[0]?.id || 1),
        subtotal: parsedData.subtotal || 0,
        discount_total: parsedData.discount_total || 0,
        credit_term: parsedData.credit_term || '30 Days',
        vat_amount: parsedData.vat_amount || 0,
        grand_total: parsedData.grand_total || 0,
        payment_status: parsedData.payment_status || 'unpaid',
        items: mappedItems,
        db_job_id: parsedData.db_job_id,
        bill_image_id: parsedData.bill_image_id || 1,
      });

    } catch (err: any) {
      console.error('Error parsing OCR:', err);
      setErrorMsg('เกิดข้อผิดพลาดในการเชื่อมต่อสแกนบิล: ' + (err.message || err));
    } finally {
      setScanning(false);
    }
  };

  const handleBatchOcrProcess = async () => {
    if (batchImages.length === 0) return;
    setScanning(true);
    setBatchErrorMsg(null);
    setErrorMsg(null);
    
    const results: ScannedBillData[] = [];
    const progress = { ...batchProgress };
    
    for (let i = 0; i < batchImages.length; i++) {
      const file = batchImages[i];
      progress[file.name] = 'scanning';
      setBatchProgress({ ...progress });
      
      try {
        const parsedData = await scanBill(file);
        if (parsedData.error) {
          throw new Error(parsedData.error);
        }
        
        const mappedItems = (parsedData.items || []).map((item: any) => {
          const matchedProduct = products.find(
            (p) => p.product_code.toLowerCase() === item.company_product_code.toLowerCase()
          );
          return {
            ...item,
            ai_product_name: item.company_product_name,
            ai_product_code: item.company_product_code,
            product_id: matchedProduct ? matchedProduct.id : (products[0]?.id || 2),
          };
        });
        
        results.push({
          bill_no: parsedData.bill_no || '',
          total_amount: parsedData.total_amount || 0,
          due_date: parsedData.due_date || new Date().toISOString().split('T')[0],
          transport_by: parsedData.transport_by || '',
          supplier_id: parsedData.supplier_id || (suppliers[0]?.id || 1),
          subtotal: parsedData.subtotal || 0,
          discount_total: parsedData.discount_total || 0,
          credit_term: parsedData.credit_term || '30 Days',
          vat_amount: parsedData.vat_amount || 0,
          grand_total: parsedData.grand_total || 0,
          payment_status: parsedData.payment_status || 'unpaid',
          items: mappedItems,
          db_job_id: parsedData.db_job_id,
          bill_image_id: parsedData.bill_image_id || 1,
          filename: file.name
        });
        
        progress[file.name] = 'success';
      } catch (err: any) {
        console.error(`Failed to scan ${file.name}:`, err);
        progress[file.name] = 'failed';
      }
      setBatchProgress({ ...progress });
    }
    
    setScanning(false);
    if (results.length > 0) {
      setBatchResults(results);
      setActiveBatchIndex(0);
      setFormData(results[0]);
      
      const firstSuccessFile = batchImages.find(f => progress[f.name] === 'success');
      if (firstSuccessFile) {
        setPreviewUrl(URL.createObjectURL(firstSuccessFile));
      }
    } else {
      setBatchErrorMsg('สแกนบิลแบบกลุ่มล้มเหลวทุกไฟล์');
    }
  };

  const handleSelectBatchItem = (index: number) => {
    if (index < 0 || index >= batchResults.length) return;
    setActiveBatchIndex(index);
    setFormData(batchResults[index]);
    
    const matchedFile = batchImages.find(f => f.name === batchResults[index].filename);
    if (matchedFile) {
      setPreviewUrl(URL.createObjectURL(matchedFile));
    }
  };

  const handlePrevBatchItem = () => {
    if (batchImages.length <= 1) return;
    
    if (batchResults.length > 0) {
      const newIdx = (activeBatchIndex - 1 + batchResults.length) % batchResults.length;
      handleSelectBatchItem(newIdx);
    } else {
      const newIdx = (activeBatchIndex - 1 + batchImages.length) % batchImages.length;
      setActiveBatchIndex(newIdx);
      setPreviewUrl(URL.createObjectURL(batchImages[newIdx]));
    }
  };

  const handleNextBatchItem = () => {
    if (batchImages.length <= 1) return;
    
    if (batchResults.length > 0) {
      const newIdx = (activeBatchIndex + 1) % batchResults.length;
      handleSelectBatchItem(newIdx);
    } else {
      const newIdx = (activeBatchIndex + 1) % batchImages.length;
      setActiveBatchIndex(newIdx);
      setPreviewUrl(URL.createObjectURL(batchImages[newIdx]));
    }
  };

  const handleSaveAllBatchBills = async () => {
    if (batchResults.length === 0) return;
    setSaving(true);
    setErrorMsg(null);
    setBatchErrorMsg(null);
    
    try {
      for (const billData of batchResults) {
        const payload = {
          bill: {
            total_amount: billData.total_amount,
            bill_no: billData.bill_no,
            due_date: billData.due_date.includes('T') ? billData.due_date : `${billData.due_date}T00:00:00Z`,
            transport_by: billData.transport_by,
            supplier_id: Number(billData.supplier_id),
            subtotal: billData.subtotal,
            bill_image_id: Number(billData.bill_image_id || 1),
            discount_total: billData.discount_total,
            credit_term: billData.credit_term,
            vat_amount: billData.vat_amount,
            grand_total: billData.grand_total,
            payment_status: billData.payment_status,
            verified_by: 1, // Default owner ID
            po_id: Number(poReference),
          },
          items: billData.items.map(item => ({
            ...item,
            ai_product_name: item.ai_product_name || item.company_product_name,
            ai_product_code: item.ai_product_code || item.company_product_code,
            product_id: item.product_id ? Number(item.product_id) : 2,
          }))
        };
        
        await confirmBillImport(billData.db_job_id, payload);
      }
      
      // Success! Refresh list and go home
      await fetchBills();
      setBillImage(null);
      setBatchImages([]);
      setBatchResults([]);
      setPreviewUrl(null);
      setFormData(null);
      setEditingBillId(null);
      setCurrentView('home');
      alert('บันทึกบิลทั้งหมดสำเร็จเรียบร้อยแล้ว!');
    } catch (err: any) {
      console.error('Error saving batch bills:', err);
      const errMsg = err.message || String(err);
      setBatchErrorMsg('ล้มเหลวในการบันทึกบิลบางรายการ: ' + errMsg);
      setErrorMsg('ล้มเหลวในการบันทึกบิลบางรายการ: ' + errMsg);
    } finally {
      setSaving(false);
    }
  };

  // Submit confirmed bill to Go Backend
  const handleSaveBill = async () => {
    if (!formData) return;
    setSaving(true);
    setErrorMsg(null);

    try {
      const payload = {
        bill: {
          total_amount: formData.total_amount,
          bill_no: formData.bill_no,
          due_date: formData.due_date.includes('T') ? formData.due_date : `${formData.due_date}T00:00:00Z`,
          transport_by: formData.transport_by,
          supplier_id: Number(formData.supplier_id),
          subtotal: formData.subtotal,
          bill_image_id: Number(formData.bill_image_id || 1),
          discount_total: formData.discount_total,
          credit_term: formData.credit_term,
          vat_amount: formData.vat_amount,
          grand_total: formData.grand_total,
          payment_status: formData.payment_status,
          verified_by: 1, // User Owner ID 1
          po_id: Number(poReference),
        },
        items: formData.items.map(item => ({
          ...item,
          ai_product_name: item.ai_product_name || item.company_product_name,
          ai_product_code: item.ai_product_code || item.company_product_code,
          product_id: item.product_id ? Number(item.product_id) : 2,
        }))
      };

      if (editingBillId) {
        // Call Go API to update existing bill
        await updateBill(editingBillId, payload);
      } else {
        // Call Go API to confirm bill import job
        await confirmBillImport(formData.db_job_id, payload);
      }
      
      // Refresh list and go back home
      await fetchBills();
      setBillImage(null);
      setPreviewUrl(null);
      setFormData(null);
      setEditingBillId(null);
      setCurrentView('home');

    } catch (err: any) {
      console.error('Error confirming/saving bill:', err);
      const errMsg = err.message || String(err);
      if (errMsg.includes('duplicate key') || errMsg.includes('23505') || errMsg.includes('unique constraint')) {
        setErrorMsg('เลขที่บิลนี้มีอยู่ในระบบแล้ว (Duplicate Invoice No.) กรุณาเปลี่ยนเลขที่บิลบนฟอร์ม หรือเปิดแก้ไขบิลเดิม');
      } else {
        setErrorMsg('ล้มเหลวในการบันทึกบิล: ' + errMsg);
      }
    } finally {
      setSaving(false);
    }
  };

  const getSupplierName = (id: number) => {
    const s = suppliers.find(sup => sup.id === id);
    return s ? s.supplier_name : `ซัพพลายเออร์ ID ${id}`;
  };

  // Helper to format Date
  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleDateString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  // --------------------------------------------------------
  // 1. หน้าหลัก (Home View)
  // --------------------------------------------------------
  const renderHomeView = () => (
    <div className="p-8 max-w-full mx-auto w-full animate-in fade-in duration-300">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">นำเข้าใบสั่งซื้อ</h1>

      {/* Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {/* Card 1: สแกนบิล */}
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
          className="bg-[#b32025] hover:bg-[#9a1a1f] text-white p-8 rounded-xl flex items-center justify-between cursor-pointer transition-all shadow-md group"
        >
          <div className="flex items-center gap-6">
            <div className="bg-white/20 p-4 rounded-lg">
              <Camera size={32} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1">สแกนบิลด้วย AI (Gemini)</h2>
              <p className="text-sm text-white/70">Scan Invoice using Gemini 3.5 Flash</p>
            </div>
          </div>
          <ArrowRight size={32} className="text-white/50 group-hover:text-white transition-colors" />
        </div>

        {/* Card 2: Excel */}
        <div 
          onClick={() => setCurrentView('excel')}
          className="bg-[#1C1B1B] hover:bg-[#2a2929] text-white p-8 rounded-xl flex items-center justify-between cursor-pointer transition-all shadow-md group"
        >
          <div className="flex items-center gap-6">
            <div className="bg-white/10 p-4 rounded-lg">
              <FileUp size={32} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1">อัปโหลดไฟล์ Excel</h2>
              <p className="text-sm text-gray-400">Upload Excel File (.xlsx, .csv)</p>
            </div>
          </div>
          <LayoutPanelLeft size={36} className="text-white/20" />
        </div>

        {/* Card 3: กรอกข้อมูลด้วยตนเอง */}
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
              credit_term: '30 Days',
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
                  product_id: products[0]?.id || 2
                }
              ],
              db_job_id: 0,
              bill_image_id: 1
            });
            setEditingBillId(null);
            setCurrentView('scan');
            setErrorMsg(null);
            setBatchErrorMsg(null);
          }}
          className="bg-gray-600 hover:bg-gray-700 text-white p-8 rounded-xl flex items-center justify-between cursor-pointer transition-all shadow-md group"
        >
          <div className="flex items-center gap-6">
            <div className="bg-white/20 p-4 rounded-lg">
              <History size={32} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1">กรอกข้อมูลด้วยตนเอง</h2>
              <p className="text-sm text-white/70">Manual Import Entry</p>
            </div>
          </div>
          <ArrowRight size={32} className="text-white/50 group-hover:text-white transition-colors" />
        </div>
      </div>

      {/* Recent Scans Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <div className="flex items-center gap-2 text-[#b32025] font-bold">
            <History size={20} />
            <span>รายการสแกนล่าสุด (Recent Scans)</span>
          </div>
          <button onClick={fetchBills} className="text-[#b32025] text-sm font-bold hover:underline cursor-pointer">
            ดูทั้งหมด
          </button>
        </div>
        
        {loadingBills ? (
          <div className="p-12 flex justify-center items-center">
            <Loader2 size={32} className="text-red-500 animate-spin" />
            <span className="ml-3 text-sm text-gray-500 font-medium">กำลังโหลดรายการบิลจากระบบ...</span>
          </div>
        ) : bills.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm font-medium">
            ยังไม่มีบิลนำเข้าที่ถูกยืนยันในฐานข้อมูล
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f9fafb] text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-4 px-6 text-center w-32">INVOICE NO.</th>
                <th className="py-4 px-6">วันที่นำเข้า (IMPORT DATE)</th>
                <th className="py-4 px-6">ผู้จัดจำหน่าย (SUPPLIER)</th>
                <th className="py-4 px-6 text-right">ยอดรวมสุทธิ (TOTAL)</th>
                <th className="py-4 px-6 text-center">สถานะ (STATUS)</th>
                <th className="py-4 px-6 text-center w-24">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-50">
              {bills.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-5 px-6 font-bold text-gray-900 text-center">{row.bill_no}</td>
                  <td className="py-5 px-6 text-gray-600">{formatDate(row.created_at)}</td>
                  <td className="py-5 px-6 text-gray-800 font-medium">{getSupplierName(row.supplier_id)}</td>
                  <td className="py-5 px-6 text-right font-bold text-gray-900">{row.total_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</td>
                  <td className="py-5 px-6 text-center">
                    <span className="inline-block bg-green-50 text-green-600 text-xs font-bold px-4 py-1.5 rounded-full border border-green-100">
                      บันทึกแล้ว
                    </span>
                  </td>
                  <td className="py-5 px-6 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <button 
                        onClick={() => handleViewSavedBill(row)} 
                        className="text-gray-400 hover:text-[#b32025] transition-colors cursor-pointer"
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  // --------------------------------------------------------
  // 2. หน้าสแกนบิล (Scan View)
  // --------------------------------------------------------
  const renderScanView = () => {
    const isManualEntry = formData && !previewUrl;

    return (
      <div className="p-8 max-w-full mx-auto w-full animate-in fade-in duration-300">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => setCurrentView('home')} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <ChevronLeft size={24} className="text-gray-600" />
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            {isManualEntry ? 'นำเข้าใบสั่งซื้อ (กรอกข้อมูลด้วยตนเอง)' : 'ระบบสแกนนำเข้าใบสั่งซื้อ'}
          </h1>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-3">
            <AlertCircle size={20} className="shrink-0 text-red-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Document Preview & File Selection */}
          {!isManualEntry && (
            <div className="lg:col-span-6 bg-[#e2e2e2] rounded-xl p-6 flex flex-col gap-4 min-h-[750px]">
          {/* Top Bar: Zoom/Rotate and Change Image Button */}
          {previewUrl && (
            <div className="flex items-center justify-between bg-white p-2 rounded shadow-sm w-full">
              <div className="flex gap-1">
                <button onClick={() => setZoom(prev => Math.min(prev + 0.2, 2.5))} className="bg-gray-100 p-2 rounded hover:bg-gray-200 text-gray-700 cursor-pointer" title="ขยาย"><ZoomIn size={18} /></button>
                <button onClick={() => setZoom(prev => Math.max(prev - 0.2, 0.5))} className="bg-gray-100 p-2 rounded hover:bg-gray-200 text-gray-700 cursor-pointer" title="ย่อ"><ZoomOut size={18} /></button>
                <button onClick={() => setRotate(prev => (prev + 90) % 360)} className="bg-gray-100 p-2 rounded hover:bg-gray-200 text-gray-700 cursor-pointer" title="หมุน"><RotateCw size={18} /></button>
              </div>
              <label className="cursor-pointer text-xs text-red-600 font-bold hover:underline py-2 px-4 bg-gray-50 rounded border border-gray-200">
                เปลี่ยนรูปภาพ
                <input type="file" className="hidden" accept="image/*" multiple onChange={handleFileChange} />
              </label>
            </div>
          )}
          
          {previewUrl ? (
            <div className="w-full flex-1 flex flex-col items-center justify-center p-0">
              {/* Batch items tabs list */}
              {batchImages.length > 0 && (
                <div className="w-full bg-white rounded-lg border border-gray-200 p-3 mb-4 max-h-[160px] overflow-y-auto">
                  <h4 className="text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-wider">รายการสแกนบิลแบบกลุ่ม ({batchImages.length} ไฟล์)</h4>
                  <div className="flex flex-col gap-1">
                    {batchImages.map((file, idx) => {
                      const status = batchProgress[file.name];
                      const isSelected = batchResults.length > 0 && batchResults[activeBatchIndex]?.filename === file.name;
                      const matchedResultIndex = batchResults.findIndex(r => r.filename === file.name);
                      
                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={matchedResultIndex === -1}
                          onClick={() => handleSelectBatchItem(matchedResultIndex)}
                          className={`w-full flex items-center justify-between p-2 rounded text-left transition-all text-xs border ${
                            isSelected 
                              ? 'border-[#b32025] bg-red-50 text-[#b32025] font-bold' 
                              : matchedResultIndex !== -1
                                ? 'border-gray-200 hover:border-gray-300 text-gray-700 bg-gray-50 cursor-pointer'
                                : 'border-gray-100 text-gray-400 bg-gray-50/50'
                          }`}
                        >
                          <span className="truncate max-w-[220px] font-medium">{file.name}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                            status === 'success' 
                              ? 'bg-green-100 text-green-700' 
                              : status === 'scanning'
                                ? 'bg-yellow-100 text-yellow-700 animate-pulse'
                                : status === 'failed'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-gray-100 text-gray-500'
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
                      className="absolute left-0 lg:left-[-15px] z-10 p-2.5 rounded-full bg-white/95 hover:bg-white text-gray-800 shadow-md border border-gray-150 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                      title="รูปภาพก่อนหน้า"
                    >
                      <ChevronLeft size={18} className="stroke-[3]" />
                    </button>

                    <button 
                      type="button"
                      onClick={handleNextBatchItem} 
                      className="absolute right-0 lg:right-[-15px] z-10 p-2.5 rounded-full bg-white/95 hover:bg-white text-gray-800 shadow-md border border-gray-150 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                      title="รูปภาพถัดไป"
                    >
                      <ChevronRight size={18} className="stroke-[3]" />
                    </button>
                  </>
                )}

                <div 
                  className="w-full flex-1 min-h-0 overflow-auto flex items-center justify-center rounded-lg shadow-lg bg-white p-2"
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
                    <div className="text-[10px] font-bold text-gray-500 bg-white/85 px-3 py-1 rounded-full border border-gray-200 shadow-sm">
                      📄 รูปที่ {activeBatchIndex + 1} จาก {batchImages.length}
                    </div>
                    <div className="flex gap-1.5 justify-center">
                      {batchImages.map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            if (batchResults.length > 0) {
                              handleSelectBatchItem(idx);
                            } else {
                              setActiveBatchIndex(idx);
                              setPreviewUrl(URL.createObjectURL(batchImages[idx]));
                            }
                          }}
                          className={`w-1.5 h-1.5 rounded-full transition-all cursor-pointer ${
                            activeBatchIndex === idx 
                              ? 'bg-[#b32025] w-3.5' 
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
                  className="mt-6 cursor-pointer text-sm text-[#b32025] font-bold hover:bg-gray-50 bg-white py-2 px-6 rounded-full shadow-sm flex items-center gap-2 transition-all border border-gray-100 disabled:text-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  {scanning ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>{batchImages.length > 0 ? 'กำลังสแกนบิลแบบกลุ่ม...' : 'กำลังสแกนรูปภาพผ่าน AI...'}</span>
                    </>
                  ) : (
                    <>
                      <Camera size={18} />
                      <span>{batchImages.length > 0 ? 'สแกนข้อมูลแบบกลุ่ม (OCR Batch)' : 'สแกนข้อมูลจากบิล (OCR)'}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <div className="w-full flex-1 border-4 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center p-8 bg-gray-50 text-center">
              <Camera size={64} className="text-gray-400 mb-4 animate-pulse" />
              <p className="text-gray-600 font-bold mb-2">ลากไฟล์บิลของคุณวางที่นี่ หรือ</p>
              <label className="cursor-pointer text-white bg-[#b32025] hover:bg-[#9a1a1f] px-6 py-2.5 rounded font-bold transition-all shadow-sm">
                อัปโหลดภาพบิล
                <input type="file" className="hidden" accept="image/*" multiple onChange={handleFileChange} />
              </label>
              <p className="text-xs text-gray-400 mt-3">รองรับการเลือกทีละหลายไฟล์สำหรับสแกนแบบกลุ่ม</p>
            </div>
          )}


        </div>
        )}

        {/* Right: Extracted Data Fields */}
        <div className={`${isManualEntry ? 'lg:col-span-12' : 'lg:col-span-6'} bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col min-h-[700px]`}>
          {!formData ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-gray-400">
              <FileUp size={48} className="text-gray-300 mb-4" />
              <h3 className="font-bold text-lg text-gray-600 mb-2">รอการประมวลผลข้อมูล</h3>
              <p className="text-sm max-w-md">กรุณาเลือกไฟล์ภาพบิลด้านซ้าย และกดปุ่มสแกนบิลด้วย AI เพื่อตรวจสอบวิเคราะห์ข้อมูล</p>
            </div>
          ) : (
            <div className="flex flex-col flex-1 animate-in fade-in duration-300">
              {/* Form Fields */}
              <div className="p-6 grid grid-cols-2 gap-6 border-b border-gray-100">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2">ซัพพลายเออร์ (SUPPLIER)</label>
                  <select 
                    value={formData.supplier_id}
                    onChange={(e) => updateFormState({ supplier_id: Number(e.target.value) })}
                    className="w-full bg-[#f4f4f5] border-none rounded p-3 text-sm focus:ring-0 text-gray-800 font-medium appearance-none"
                  >
                    {suppliers.map(sup => (
                      <option key={sup.id} value={sup.id}>{sup.supplier_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2">เลขที่บิล (INVOICE NO.)</label>
                  <input 
                    type="text" 
                    value={formData.bill_no} 
                    onChange={(e) => updateFormState({ bill_no: e.target.value })}
                    className="w-full bg-[#f4f4f5] border-none rounded p-3 text-sm focus:ring-0 text-gray-800 font-medium" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2">วันที่ครบกำหนดในบิล (DUE DATE)</label>
                  <input 
                    type="date" 
                    value={formData.due_date} 
                    onChange={(e) => updateFormState({ due_date: e.target.value })}
                    className="w-full bg-[#f4f4f5] border-none rounded p-3 text-sm focus:ring-0 text-gray-800 font-medium" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2">อ้างอิงใบสั่งซื้อระบบ (PO ID)</label>
                  <select
                    value={poReference}
                    onChange={(e) => setPoReference(e.target.value)}
                    className="w-full bg-[#f4f4f5] border-none rounded p-3 text-sm focus:ring-0 text-gray-800 font-medium appearance-none"
                  >
                    <option value="1">ใบสั่งซื้อ PO #1 (จำลองสินค้า)</option>
                    <option value="2">ใบสั่งซื้อ PO #2</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2">ขนส่งโดย (TRANSPORT BY)</label>
                  <input 
                    type="text" 
                    value={formData.transport_by} 
                    onChange={(e) => updateFormState({ transport_by: e.target.value })}
                    className="w-full bg-[#f4f4f5] border-none rounded p-3 text-sm focus:ring-0 text-gray-800 font-medium" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2">เงื่อนไขเครดิต (CREDIT TERM)</label>
                  <input 
                    type="text" 
                    value={formData.credit_term} 
                    onChange={(e) => updateFormState({ credit_term: e.target.value })}
                    className="w-full bg-[#f4f4f5] border-none rounded p-3 text-sm focus:ring-0 text-gray-800 font-medium" 
                  />
                </div>
              </div>

              {/* Items Table */}
              <div className="flex-1 overflow-auto max-h-[350px]">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500">
                      <th className="py-4 px-6 font-bold w-1/4">สแกนรหัส (บิล)</th>
                      <th className="py-4 px-6 font-bold w-1/3">ชื่อสินค้า (บิล)</th>
                      <th className="py-4 px-6 font-bold w-1/4">เทียบสินค้าในระบบ</th>
                      <th className="py-4 px-6 font-bold text-right">จำนวน</th>
                      <th className="py-4 px-6 font-bold text-right">ราคา/หน่วย</th>
                      <th className="py-4 px-6 font-bold text-center w-12">ลบ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {formData.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="py-2 px-4">
                          <input 
                            type="text" 
                            value={item.company_product_code || ''}
                            onChange={(e) => handleItemChange(idx, 'company_product_code', e.target.value)}
                            className="bg-transparent border-b border-gray-200 focus:border-red-500 focus:ring-0 w-full text-xs font-mono text-gray-700 p-1"
                          />
                        </td>
                        <td className="py-2 px-4">
                          <input 
                            type="text" 
                            value={item.company_product_name || ''}
                            onChange={(e) => handleItemChange(idx, 'company_product_name', e.target.value)}
                            className="bg-transparent border-b border-gray-200 focus:border-red-500 focus:ring-0 w-full text-xs font-medium text-gray-900 p-1"
                          />
                        </td>
                        <td className="py-2 px-4">
                          <select
                            value={item.product_id || ''}
                            onChange={(e) => {
                              handleItemChange(idx, 'product_id', e.target.value ? Number(e.target.value) : null);
                            }}
                            className="bg-white border border-gray-300 rounded p-1 text-[11px] w-full focus:ring-0 text-gray-700 font-semibold"
                          >
                            <option value="">-- ไม่พบสินค้าที่คล้ายกัน --</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>[{p.product_code}] {p.product_name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-4 text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <input 
                              type="number" 
                              value={item.order_quantity ?? 0}
                              onChange={(e) => handleItemChange(idx, 'order_quantity', e.target.value)}
                              className="bg-transparent border-b border-gray-200 focus:border-red-500 focus:ring-0 w-12 text-right text-xs text-gray-700 p-1"
                            />
                            <input 
                              type="text" 
                              value={item.unit || ''}
                              onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                              className="bg-transparent border-b border-gray-200 focus:border-red-500 focus:ring-0 w-8 text-left text-xs text-gray-500 p-1"
                            />
                          </div>
                        </td>
                        <td className="py-2 px-4 text-right">
                          <input 
                            type="number" 
                            step="0.01"
                            value={item.price_per_unit ?? 0}
                            onChange={(e) => handleItemChange(idx, 'price_per_unit', e.target.value)}
                            className="bg-transparent border-b border-gray-200 focus:border-red-500 focus:ring-0 w-16 text-right text-xs text-gray-700 font-bold p-1"
                          />
                        </td>
                        <td className="py-2 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(idx)}
                            className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                            disabled={formData.items.length <= 1}
                            title="ลบรายการสินค้า"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add Row Button */}
              <div className="p-4 border-b border-gray-100 flex justify-start bg-gray-50">
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="text-xs text-[#b32025] hover:text-[#9a1a1f] font-bold flex items-center gap-1 hover:underline cursor-pointer"
                >
                  + เพิ่มรายการสินค้า (Add Row)
                </button>
              </div>

              {/* Summary & Submit */}
              <div className="border-t border-gray-100 p-6 flex justify-between items-end bg-[#fafafa] rounded-b-xl mt-auto">
                <div className="text-xs text-gray-600 space-y-2">
                  <p>จำนวนรายการทั้งหมด : <span className="text-gray-900 font-bold">{formData.items.length} รายการ</span></p>
                  <p>ภาษีมูลค่าเพิ่ม (VAT 7%) : <span className="text-gray-900 font-bold">{formData.vat_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</span></p>
                </div>
                <div className="text-right flex items-end gap-8">
                  <div>
                    <p className="text-xs text-[#b32025] font-bold mb-1 text-left">ยอดเงินสุทธิรวม:</p>
                    <p className="text-3xl text-[#b32025] font-bold">{formData.total_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</p>
                  </div>
                  <button 
                    onClick={batchResults.length > 0 ? handleSaveAllBatchBills : handleSaveBill}
                    disabled={saving}
                    className="bg-[#b32025] hover:bg-[#9a1a1f] text-white px-8 py-3 rounded text-sm font-bold flex items-center gap-2 transition-all shadow-sm disabled:bg-gray-400 cursor-pointer"
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
};

  // --------------------------------------------------------
  // 3. หน้าอัปโหลด Excel / CSV (Excel View)
  // --------------------------------------------------------
  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];
    
    const firstLine = lines[0];
    let delimiter = ',';
    if (firstLine.includes(';')) delimiter = ';';
    else if (firstLine.includes('\t')) delimiter = '\t';
    
    const headers = firstLine.split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
    
    const items: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          values.push(current.trim().replace(/^["']|["']$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim().replace(/^["']|["']$/g, ''));
      
      if (values.length >= headers.length) {
        const itemObj: any = {};
        headers.forEach((header, idx) => {
          itemObj[header] = values[idx];
        });
        items.push(itemObj);
      }
    }
    return items;
  };

  const renderExcelView = () => {
    const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      processCsvFile(file);
    };

    const processCsvFile = (file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (!text) return;
        
        try {
          const rows = parseCSV(text);
          if (rows.length === 0) {
            alert('ไม่พบข้อมูลในไฟล์ CSV หรือรูปแบบไฟล์ไม่ถูกต้อง');
            return;
          }

          // Smart map CSV columns to BillItemDTO structure
          const mappedItems: BillItemDTO[] = rows.map((row: any, index: number) => {
            const findValue = (keywords: string[]) => {
              const matchedKey = Object.keys(row).find(key => 
                keywords.some(kw => key.toLowerCase().includes(kw.toLowerCase()))
              );
              return matchedKey ? row[matchedKey] : '';
            };

            const code = findValue(['code', 'product_code', 'รหัส', 'รหัสสินค้า']);
            const name = findValue(['name', 'product_name', 'ชื่อ', 'ชื่อสินค้า']);
            const qty = parseFloat(findValue(['quantity', 'qty', 'จำนวน', 'จำนวนต่อหน่วย']) || '1') || 1;
            const unit = findValue(['unit', 'หน่วย']) || 'ชิ้น';
            const price = parseFloat(findValue(['price', 'rate', 'ราคา', 'ราคาต่อหน่วย']) || '0') || 0;

            return {
              item_sequence: index + 1,
              company_product_code: String(code || '').trim(),
              company_product_name: String(name || '').trim(),
              order_quantity: qty,
              unit: String(unit || 'ชิ้น').trim(),
              conversion_factor: 1,
              price_per_unit: price,
              discount_amount: 0,
              net_amount: qty * price,
              is_freebie: false,
              remark: '',
              product_id: null
            };
          });

          // Calculate subtotal
          const subtotal = mappedItems.reduce((sum, item) => sum + item.net_amount, 0);

          setFormData({
            bill_no: 'CSV-' + Math.floor(1000 + Math.random() * 9000),
            total_amount: subtotal,
            due_date: new Date().toISOString().split('T')[0],
            transport_by: '',
            supplier_id: suppliers[0]?.id || 1,
            subtotal: subtotal,
            discount_total: 0,
            credit_term: '30 Days',
            vat_amount: 0,
            grand_total: subtotal,
            payment_status: 'unpaid',
            items: mappedItems,
            db_job_id: 0,
            bill_image_id: 0,
            filename: file.name
          });

          setPreviewUrl(null); // No image preview for CSV mode
          setCurrentView('scan'); // Direct to scan view editor
          setErrorMsg(null);
        } catch (error) {
          console.error(error);
          alert('เกิดข้อผิดพลาดในการอ่านไฟล์ CSV: ' + String(error));
        }
      };
      reader.readAsText(file);
    };

    return (
      <div className="p-8 max-w-full mx-auto w-full animate-in fade-in duration-300">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => setCurrentView('home')} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <ChevronLeft size={24} className="text-gray-600" />
          </button>
          <h1 className="text-3xl font-bold text-gray-900">นำเข้าใบสั่งซื้อด้วย CSV / Excel</h1>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 flex flex-col items-center justify-center text-center min-h-[500px]">
          <div className="bg-[#1c1b1b]/5 p-6 rounded-full mb-6 text-gray-800">
            <FileUp size={64} />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">นำเข้าไฟล์สั่งซื้ออะไหล่</h3>
          <p className="text-gray-500 text-sm max-w-md mb-8">
            อัปโหลดไฟล์ในรูปแบบ CSV (.csv) โดยสามารถส่งออกข้อมูลจาก Excel เป็นไฟล์ CSV ก่อนนำมานำเข้าได้ที่นี่
          </p>

          <label className="cursor-pointer text-white bg-[#b32025] hover:bg-[#9a1a1f] px-8 py-3 rounded font-bold transition-all shadow-sm">
            เลือกไฟล์ CSV เพื่อนำเข้า
            <input 
              type="file" 
              className="hidden" 
              accept=".csv" 
              onChange={handleCsvFileChange} 
            />
          </label>

          <div className="mt-8 border-t border-gray-100 pt-6 w-full max-w-lg text-left">
            <h4 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">💡 รูปแบบคอลัมน์ในไฟล์ที่แนะนำ:</h4>
            <div className="bg-gray-50 p-4 rounded-lg font-mono text-xs text-gray-600 overflow-x-auto">
              รหัสสินค้า, ชื่อสินค้า, จำนวน, หน่วย, ราคาต่อหน่วย <br/>
              BR-900X, Turbocharger, 50, ชิ้น, 870 <br/>
              GSK-882, Gasket Set, 40, ชุด, 240
            </div>
            <p className="text-[11px] text-gray-400 mt-2">
              * ระบบจะทำการจับคู่คอลัมน์อัตโนมัติทั้งชื่อคอลัมน์ภาษาไทยและภาษาอังกฤษ
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {currentView === 'home' && renderHomeView()}
      {currentView === 'scan' && renderScanView()}
      {currentView === 'excel' && renderExcelView()}
    </>
  );
}
