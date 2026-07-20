import React, { useState, useEffect } from 'react';
import apiClient from '../../../service/http/apiClient';
import * as XLSX from 'xlsx';

import { 
  Camera, FileUp, ArrowRight, Eye, History, 
  ZoomIn, ZoomOut, RotateCw, Save, Trash2,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, LayoutPanelLeft, Loader2, AlertCircle, AlertTriangle,
  FileText
} from 'lucide-react';

import {
  scanBill,
  confirmBillImport,
  updateBill,
  deleteBill
} from '../../../service/http/import/import_service';

import Button from '../../../components/elements/button';
import Badge from '../../../components/elements/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/elements/table';
import Card from '../../../components/elements/card';
type ViewState = 'home' | 'scan' | 'excel' | 'po';

interface Supplier {
  id: number;
  supplier_name: string;
  short_supplier_name: string;
}

interface Product {
  id: number;
  product_name: string;
  product_code: string;
  category_name?: string;
  sub_category_name?: string;
  cost_price?: number;
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
  category_id?: number | null;
  sub_category_id?: number | null;
}

interface ScannedBillData {
  bill_no: string;
  total_amount: number;
  due_date: string;
  transport_by: string;
  supplier_id: number;
  supplier_name?: string;
  subtotal: number;
  discount_total: number;
  receive_date: string;
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
  receive_date: string;
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
  const [categories, setCategories] = useState<any[]>([]);
  // Validation & Warning States
  const [originalPOItems, setOriginalPOItems] = useState<any[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [showValidationModal, setShowValidationModal] = useState<boolean>(false);
  const [onConfirmAction, setOnConfirmAction] = useState<(() => void) | null>(null);

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

  // Resizable split panels state
  const [leftWidth, setLeftWidth] = useState<number>(50); // percentage (e.g. 50%)
  const [isResizing, setIsResizing] = useState<boolean>(false);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = document.getElementById('split-pane-container');
      if (!container) return;
      
      const containerRect = container.getBoundingClientRect();
      const relativeX = e.clientX - containerRect.left;
      const percentage = (relativeX / containerRect.width) * 100;
      
      // Constraint bounds between 25% and 75%
      if (percentage >= 25 && percentage <= 75) {
        setLeftWidth(percentage);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Form State
  const [formData, setFormData] = useState<ScannedBillData | null>(null);
  
  // PO Reference States
  const [poList, setPoList] = useState<any[]>([]);
  const [poSearchQuery, setPoSearchQuery] = useState('');
  const [loadingPOs, setLoadingPOs] = useState(false);
  const [poReference, setPoReference] = useState(''); // Empty string means no reference

  // Pagination States for Recent Scans Table
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);


  const exportBillItemsToExcel = () => {
    if (!formData || !formData.items || formData.items.length === 0) return;
    try {
      const exportData = formData.items.map((item, idx) => {
        const matchingProd = products.find(p => p.id === Number(item.product_id));
        const matchingCat = categories.find(c => c.ID === Number(item.category_id));
        const subCategories = matchingCat?.sub_categories || [];
        const matchingSubCat = subCategories.find((sc: any) => sc.ID === Number(item.sub_category_id));
        
        return {
          "ลำดับ (Seq)": item.item_sequence || (idx + 1),
          "รหัสสินค้าของคู่ค้า (Supplier Code)": item.company_product_code,
          "ชื่อสินค้าของคู่ค้า (Supplier Product Name)": item.company_product_name,
          "เทียบสินค้าในระบบ (Matched Code)": matchingProd ? matchingProd.product_code : '-',
          "ชื่อสินค้าในระบบ (Matched Name)": matchingProd ? matchingProd.product_name : '-',
          "หมวดหมู่หลัก (Category)": matchingCat ? matchingCat.category_name : '-',
          "หมวดหมู่ย่อย (Sub Category)": matchingSubCat ? matchingSubCat.sub_category_name : '-',
          "จำนวน (Quantity)": item.order_quantity,
          "หน่วย (Unit)": item.unit,
          "ราคาต่อหน่วย (Unit Price)": item.price_per_unit,
          "รวมเงิน (Net Amount)": item.net_amount
        };
      });
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "รายการในบิล");
      const filename = `bill_${formData.bill_no || 'import'}.xlsx`;
      XLSX.writeFile(workbook, filename);
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการส่งออกไฟล์ Excel: " + String(err));
    }
  };

  // Fetch lists on mount
  useEffect(() => {
    fetchBills();
    fetchSuppliersAndProducts();
    fetchPOsList();
    if (loadingSuppliersProducts || batchErrorMsg) {
      // noop
    }
  }, []);

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
      product_id: null,
      category_id: null,
      sub_category_id: null,
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
      receive_date: bill.receive_date ? bill.receive_date.split('T')[0] : '',
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

  const fetchPOsList = async () => {
    setLoadingPOs(true);
    try {
      const response = await apiClient.get('/po/get-all-po?limit=100');
      if (response.data) {
        setPoList(Array.isArray(response.data) ? response.data : (response.data.data || []));
      }
    } catch (err) {
      console.error('Error fetching POs list:', err);
    } finally {
      setLoadingPOs(false);
    }
  };

  const handleSelectPO = async (poId: number) => {
    if (!poId) {
      setPoReference('');
      setOriginalPOItems([]);
      return;
    }
    setErrorMsg(null);
    setLoadingPOs(true);
    try {
      const response = await apiClient.get(`/po/${poId}`);
      if (response.data) {
        const po = response.data;
        setOriginalPOItems(po.po_items || []);
        // Map PO Items to ScannedBillData format
        const mappedItems = (po.po_items || []).map((item: any, idx: number) => {
          return {
            item_sequence: idx + 1,
            company_product_code: item.product_name_code_snapshot || '',
            company_product_name: item.product_name_snapshot || '',
            order_quantity: item.quantity,
            unit: item.unit || 'ชิ้น',
            conversion_factor: 1,
            price_per_unit: item.unit_price,
            discount_amount: 0,
            net_amount: item.sub_total || (item.quantity * item.unit_price),
            is_freebie: false,
            remark: '',
            product_id: item.product_id || null
          };
        });

        setFormData({
          bill_no: '',
          total_amount: po.total_amount || 0,
          due_date: new Date().toISOString().split('T')[0],
          transport_by: '',
          supplier_id: po.supplier_id || (suppliers[0]?.id || 1),
          subtotal: po.total_amount || 0,
          discount_total: 0,
          receive_date: new Date().toISOString().split('T')[0],
          vat_amount: 0,
          grand_total: po.total_amount || 0,
          payment_status: 'unpaid',
          items: mappedItems.length > 0 ? mappedItems : [
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

        setPoReference(String(po.id));
        setPreviewUrl(null);
        setBillImage(null);
        setBatchImages([]);
        setBatchResults([]);
        setEditingBillId(null);
        setCurrentView('scan');
      }
    } catch (err: any) {
      console.error('Error fetching PO details:', err);
      alert('ล้มเหลวในการดึงข้อมูลใบสั่งซื้อ: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoadingPOs(false);
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

    const updated = {
      ...formData,
      items: updatedItems,
      subtotal: newSubtotal,
      vat_amount: 0,
      discount_total: 0,
      total_amount: newSubtotal,
      grand_total: newSubtotal
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
      const [suppliersRes, productsRes, categoriesRes] = await Promise.all([
        apiClient.get('/wms/suppliers'),
        apiClient.get('/wms/products'),
        apiClient.get('/import-data/categories-tree')
      ]);
      if (suppliersRes.data) {
        setSuppliers(Array.isArray(suppliersRes.data) ? suppliersRes.data : (suppliersRes.data.data || []));
      }
      if (productsRes.data) {
        setProducts(Array.isArray(productsRes.data) ? productsRes.data : (productsRes.data.data || []));
      }
      if (categoriesRes.data) {
        setCategories(categoriesRes.data || []);
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

      // Refetch suppliers list to load any auto-created supplier
      await fetchSuppliersAndProducts();

      // Map parsed items to associate product_id automatically if they match codes in local DB
      const mappedItems = (parsedData.items || []).map((item: any) => {
        let finalProductId = item.product_id || null;
        if (!finalProductId && item.company_product_code) {
          const matchedProduct = products.find(
            (p) => p.product_code.toLowerCase() === item.company_product_code.toLowerCase()
          );
          if (matchedProduct) {
            finalProductId = matchedProduct.id;
          }
        }
        return {
          ...item,
          ai_product_name: item.company_product_name,
          ai_product_code: item.company_product_code,
          product_id: finalProductId,
        };
      });

      setFormData({
        bill_no: parsedData.bill_no || '',
        total_amount: parsedData.total_amount || 0,
        due_date: parsedData.due_date || new Date().toISOString().split('T')[0],
        transport_by: parsedData.transport_by || '',
        supplier_id: parsedData.supplier_id || (suppliers[0]?.id || 1),
        supplier_name: parsedData.supplier_name || '',
        subtotal: parsedData.subtotal || 0,
        discount_total: parsedData.discount_total || 0,
        receive_date: new Date().toISOString().split('T')[0],
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
        
        // Refetch suppliers list to load any auto-created supplier
        await fetchSuppliersAndProducts();
        
        const mappedItems = (parsedData.items || []).map((item: any) => {
          let finalProductId = item.product_id || null;
          if (!finalProductId && item.company_product_code) {
            const matchedProduct = products.find(
              (p) => p.product_code.toLowerCase() === item.company_product_code.toLowerCase()
            );
            if (matchedProduct) {
              finalProductId = matchedProduct.id;
            }
          }
          return {
            ...item,
            ai_product_name: item.company_product_name,
            ai_product_code: item.company_product_code,
            product_id: finalProductId,
          };
        });
        
        results.push({
          bill_no: parsedData.bill_no || '',
          total_amount: parsedData.total_amount || 0,
          due_date: parsedData.due_date || new Date().toISOString().split('T')[0],
          transport_by: parsedData.transport_by || '',
          supplier_id: parsedData.supplier_id || (suppliers[0]?.id || 1),
          supplier_name: parsedData.supplier_name || '',
          subtotal: parsedData.subtotal || 0,
          discount_total: parsedData.discount_total || 0,
          receive_date: new Date().toISOString().split('T')[0],
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

  const getBillWarnings = (billData: any, poItemsList: any[]) => {
    const warnings: string[] = [];
    if (!billData || !billData.items) return warnings;
    
    let calcSubtotal = 0;
    billData.items.forEach((item: any) => {
      const qty = Number(item.order_quantity) || 0;
      const price = Number(item.price_per_unit) || 0;
      const disc = Number(item.discount_amount) || 0;
      calcSubtotal += (qty * price) - disc;
    });
    
    const expectedGrandTotal = calcSubtotal - (billData.discount_total || 0) + (billData.vat_amount || 0);
    if (Math.abs(expectedGrandTotal - (billData.grand_total || 0)) > 1.0) {
      warnings.push(`ราคารวมบิลสุทธิ (฿${billData.grand_total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}) ไม่ตรงกับยอดคำนวณจริงของรายการสินค้าทั้งหมด (฿${expectedGrandTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })})`);
    }
    
    return warnings;
  };

  const handleSaveAllBatchBills = async (bypassWarnings: boolean = false) => {
    if (batchResults.length === 0) return;

    if (!bypassWarnings) {
      const allWarnings: string[] = [];
      batchResults.forEach((bill, bIdx) => {
        const warnings = getBillWarnings(bill, []);
        if (warnings.length > 0) {
          allWarnings.push(`[บิลที่ ${bIdx + 1} เลขที่ ${bill.bill_no || 'ไม่ระบุ'}]:`);
          warnings.forEach(w => allWarnings.push(`  - ${w}`));
        }
      });

      if (allWarnings.length > 0) {
        setValidationWarnings(allWarnings);
        setOnConfirmAction(() => () => handleSaveAllBatchBills(true));
        setShowValidationModal(true);
        return;
      }
    }

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
            receive_date: billData.receive_date.includes('T') ? billData.receive_date : `${billData.receive_date}T00:00:00Z`,
            vat_amount: billData.vat_amount,
            grand_total: billData.grand_total,
            payment_status: billData.payment_status,
            verified_by: 1, // Default owner ID
            po_id: poReference ? Number(poReference) : (poList[0]?.id || 1),
          },
          items: billData.items.map(item => ({
            ...item,
            ai_product_name: item.ai_product_name || item.company_product_name,
            ai_product_code: item.ai_product_code || item.company_product_code,
            product_id: item.product_id ? Number(item.product_id) : 0,
            category_id: item.category_id ? Number(item.category_id) : null,
            sub_category_id: item.sub_category_id ? Number(item.sub_category_id) : null,
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
  const handleSaveBill = async (bypassWarnings: boolean = false) => {
    if (!formData) return;

    if (!bypassWarnings) {
      const warnings = getBillWarnings(formData, originalPOItems);
      if (warnings.length > 0) {
        setValidationWarnings(warnings);
        setOnConfirmAction(() => () => handleSaveBill(true));
        setShowValidationModal(true);
        return;
      }
    }

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
          receive_date: formData.receive_date.includes('T') ? formData.receive_date : `${formData.receive_date}T00:00:00Z`,
          vat_amount: formData.vat_amount,
          grand_total: formData.grand_total,
          payment_status: formData.payment_status,
          verified_by: 1, // User Owner ID 1
          po_id: poReference ? Number(poReference) : (poList[0]?.id || 1),
        },
        items: formData.items.map(item => ({
          ...item,
          ai_product_name: item.ai_product_name || item.company_product_name,
          ai_product_code: item.ai_product_code || item.company_product_code,
          product_id: item.product_id ? Number(item.product_id) : 0,
          category_id: item.category_id ? Number(item.category_id) : null,
          sub_category_id: item.sub_category_id ? Number(item.sub_category_id) : null,
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
  const renderHomeView = () => {
    const totalItems = bills.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    const paginatedBills = bills.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

    return (
      <div className="p-8 max-w-full mx-auto w-full animate-in fade-in duration-300">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">นำเข้าใบสั่งซื้อ</h1>

      {/* Cards Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
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
              <h2 className="text-2xl font-bold mb-1">สแกนบิลด้วยรูปภาพ / PDF</h2>
              <p className="text-sm text-white/70">Scan Invoice using Image or PDF</p>
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

        {/* Card 3: อ้างอิงใบสั่งซื้อ PO */}
        <div 
          onClick={() => {
            fetchPOsList();
            setCurrentView('po');
          }}
          className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white p-8 rounded-xl flex items-center justify-between cursor-pointer transition-all shadow-md group"
        >
          <div className="flex items-center gap-6">
            <div>
              <h2 className="text-2xl font-bold mb-1">นำเข้าจากใบสั่งซื้อ</h2>
              <p className="text-sm text-white/70">Import from Purchase Order</p>
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
      <Card className="overflow-hidden" noPadding>
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <div className="flex items-center gap-2 text-[#b32025] font-bold">
            <History size={20} />
            <span>รายการสแกนล่าสุด (Recent Scans)</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={fetchBills} className="text-gray-500 hover:text-gray-900 text-xs font-bold flex items-center gap-1.5 cursor-pointer bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg transition-all">
              รีเฟรชข้อมูล
            </button>
          </div>
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
          <Table>
            <TableHeader className="bg-gray-100 text-gray-600">
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
                  <TableCell className="pl-6 font-bold text-gray-900 text-center">{row.bill_no}</TableCell>
                  <TableCell className="text-gray-600">{formatDate(row.created_at)}</TableCell>
                  <TableCell className="text-gray-800 font-medium">{getSupplierName(row.supplier_id)}</TableCell>
                  <TableCell className="text-right font-bold text-gray-900">
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {totalItems > 0 && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-6 border-t border-gray-100 text-xs text-gray-500 bg-gray-50">
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
                  className="border border-gray-200 rounded px-2 py-1 text-gray-600 bg-white hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-200 cursor-pointer"
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
                className="p-1.5 rounded text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => prev - 1)}
                aria-label="หน้าก่อนหน้า"
                className="p-1.5 rounded text-gray-400 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {pageNumbers.map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1.5 rounded font-medium transition-colors cursor-pointer ${
                    currentPage === page
                      ? "bg-[#d61c24] text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => prev + 1)}
                aria-label="หน้าถัดไป"
                className="p-1.5 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
                aria-label="หน้าสุดท้าย"
                className="p-1.5 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
    );
  };

  // --------------------------------------------------------
  // 2. หน้าสแกนบิล (Scan View)
  // --------------------------------------------------------
  const renderScanView = () => {
    const isManualEntry = formData && !previewUrl;

    let calcSubtotal = 0;
    if (formData && formData.items) {
      formData.items.forEach((item: any) => {
        const qty = Number(item.order_quantity) || 0;
        const price = Number(item.price_per_unit) || 0;
        const disc = Number(item.discount_amount) || 0;
        calcSubtotal += (qty * price) - disc;
      });
    }
    const expectedGrandTotal = formData ? calcSubtotal : 0;
    const isTotalMismatched = formData ? Math.abs(expectedGrandTotal - formData.total_amount) > 1.0 : false;

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

        <div id="split-pane-container" className="flex flex-col lg:flex-row gap-0 w-full min-h-[750px] relative">
          {/* Left: Document Preview & File Selection */}
          {!isManualEntry && (
            <>
              <div 
                style={{ width: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${leftWidth}%` : '100%' }}
                className="bg-[#e2e2e2] rounded-xl p-6 flex flex-col gap-4 min-h-[750px]"
              >
          {/* Top Bar: Zoom/Rotate and Change Image Button */}
          {previewUrl && (
            <div className="flex items-center justify-between bg-white p-2 rounded shadow-sm w-full">
              <div className="flex gap-1">
                <button onClick={() => setZoom(prev => Math.min(prev + 0.2, 2.5))} className="bg-gray-100 p-2 rounded hover:bg-gray-200 text-gray-700 cursor-pointer" title="ขยาย"><ZoomIn size={18} /></button>
                <button onClick={() => setZoom(prev => Math.max(prev - 0.2, 0.5))} className="bg-gray-100 p-2 rounded hover:bg-gray-200 text-gray-700 cursor-pointer" title="ย่อ"><ZoomOut size={18} /></button>
                <button onClick={() => setRotate(prev => (prev + 90) % 360)} className="bg-gray-100 p-2 rounded hover:bg-gray-200 text-gray-700 cursor-pointer" title="หมุน"><RotateCw size={18} /></button>
              </div>
              <label className="cursor-pointer text-xs text-red-600 font-bold hover:underline py-2 px-4 bg-gray-50 rounded border border-gray-200">
                เปลี่ยนไฟล์บิล (ภาพ/PDF)
                <input type="file" className="hidden" accept="image/*,application/pdf" multiple onChange={handleFileChange} />
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
                      รูปที่ {activeBatchIndex + 1} จาก {batchImages.length}
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
                      <span>{batchImages.length > 0 ? 'กำลังสแกนบิลแบบกลุ่ม...' : 'กำลังสแกนรูปภาพ/PDF...'}</span>
                    </>
                  ) : (
                    <>
                      <Camera size={18} />
                      <span>{batchImages.length > 0 ? 'สแกนข้อมูลแบบกลุ่ม (OCR Batch)' : 'สแกนข้อมูลจากบิล (รูปภาพ/PDF)'}</span>
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
                อัปโหลดบิล (ภาพ/PDF)
                <input type="file" className="hidden" accept="image/*,application/pdf" multiple onChange={handleFileChange} />
              </label>
              <p className="text-xs text-gray-400 mt-3">รองรับการเลือกทีละหลายไฟล์สำหรับสแกนแบบกลุ่ม</p>
            </div>
          )}


        </div>
        
        {/* Resizer Divider Bar */}
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
          }}
          className={`hidden lg:flex w-2.5 hover:w-3.5 cursor-col-resize hover:bg-[#b32025]/50 bg-gray-200 border-l border-r border-gray-300 items-center justify-center relative select-none rounded-md transition-all group z-10 mx-2 ${
            isResizing ? 'bg-[#b32025]/80 w-3.5' : ''
          }`}
          style={{ cursor: 'col-resize' }}
        >
          <div className="flex flex-col gap-1 text-gray-400 group-hover:text-white pointer-events-none select-none font-bold text-[8px]">
            <span>•</span>
            <span>•</span>
            <span>•</span>
          </div>
        </div>
      </>
      )}

      {/* Right: Extracted Data Fields */}
      <div 
        style={{ 
          width: typeof window !== 'undefined' && window.innerWidth >= 1024 
            ? (isManualEntry ? '100%' : `${100 - leftWidth}%`) 
            : '100%' 
        }}
        className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col min-h-[700px]"
      >
          {!formData ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-gray-400">
              <FileUp size={48} className="text-gray-300 mb-4" />
              <h3 className="font-bold text-lg text-gray-600 mb-2">รอการประมวลผลข้อมูล</h3>
              <p className="text-sm max-w-md">กรุณาเลือกไฟล์บิลด้านซ้าย และกดปุ่มสแกนบิลเพื่อตรวจสอบวิเคราะห์ข้อมูล</p>
            </div>
          ) : (
            <div className="flex flex-col flex-1 animate-in fade-in duration-300">
              {/* Form Fields */}
              <div className="p-6 grid grid-cols-2 gap-6 border-b border-gray-100">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2">ซัพพลายเออร์ (SUPPLIER)</label>
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
                    className="w-full bg-[#f4f4f5] border-none rounded p-3 text-sm focus:ring-0 text-gray-800 font-medium" 
                    placeholder="พิมพ์ชื่อซัพพลายเออร์..."
                  />
                  {formData.supplier_name && !suppliers.some(s => 
                    s.supplier_name.toLowerCase().replace(/บริษัท|จำกัด|บจก\.|หจก\./g, '').trim() === formData.supplier_name!.toLowerCase().replace(/บริษัท|จำกัด|บจก\.|หจก\./g, '').trim()
                  ) && (
                    <span className="text-[11px] text-amber-500 mt-1.5 block font-medium">
                      ⚠️ ซัพพลายเออร์นี้จะถูกลงทะเบียนเข้าสู่ระบบโดยอัตโนมัติเมื่อกดบันทึก
                    </span>
                  )}
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
                    <option value="">-- นำเข้าทั่วไป (ไม่มีอ้างอิง PO) --</option>
                    {poList.map((po) => (
                      <option key={po.id} value={String(po.id)}>
                        {po.order_number} ({po.supplier_name || 'ไม่ระบุซัพพลายเออร์'}) - ฿{po.total_amount?.toLocaleString() || 0}
                      </option>
                    ))}
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
                  <label className="block text-xs font-bold text-gray-500 mb-2">วันที่รับสินค้า (RECEIVE DATE)</label>
                  <input 
                    type="date" 
                    value={formData.receive_date ? formData.receive_date.split('T')[0] : ''} 
                    onChange={(e) => updateFormState({ receive_date: e.target.value })}
                    className="w-full bg-[#f4f4f5] border-none rounded p-3 text-sm focus:ring-0 text-gray-800 font-medium" 
                  />
                </div>
              </div>

              {/* Items Table */}
              <div className="flex-1 overflow-y-auto max-h-[350px]">
                <Table className="min-w-[1200px] text-left text-sm border-collapse">
                  <TableHeader className="bg-gray-100 text-gray-600 border-b border-gray-100 text-xs">
                    <TableRow>
                      <TableHead className="py-4 px-6 font-bold text-left text-gray-600 min-w-[120px]">สแกนรหัส (บิล)</TableHead>
                      <TableHead className="py-4 px-6 font-bold text-left text-gray-600 min-w-[280px]">ชื่อสินค้า (บิล)</TableHead>
                      <TableHead className="py-4 px-6 font-bold text-left text-gray-600 min-w-[250px]">เทียบสินค้าในระบบ</TableHead>
                      <TableHead className="py-4 px-6 font-bold text-left text-gray-600 min-w-[130px]">หมวดหมู่หลัก</TableHead>
                      <TableHead className="py-4 px-6 font-bold text-left text-gray-600 min-w-[130px]">หมวดหมู่ย่อย</TableHead>
                      <TableHead className="py-4 px-6 font-bold text-right text-gray-600 min-w-[100px]">จำนวน</TableHead>
                      <TableHead className="py-4 px-6 font-bold text-right text-gray-600 min-w-[100px]">ราคา/หน่วย</TableHead>
                      <TableHead className="py-4 px-6 font-bold text-right text-gray-600 min-w-[120px]">ยอดรวม (TOTAL)</TableHead>
                      <TableHead className="py-4 px-6 font-bold text-center text-gray-600 min-w-[50px]">ลบ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-50">
                    {formData.items.map((item, idx) => (
                      <TableRow key={idx} className="hover:bg-gray-50 align-top">
                        <TableCell className="py-2 px-4">
                          <textarea 
                            value={item.company_product_code || ''}
                            onChange={(e) => handleItemChange(idx, 'company_product_code', e.target.value)}
                            rows={1}
                            onInput={(e) => {
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = 'auto';
                              target.style.height = `${target.scrollHeight}px`;
                            }}
                            ref={(el) => {
                              if (el) {
                                el.style.height = 'auto';
                                el.style.height = `${el.scrollHeight}px`;
                              }
                            }}
                            className="bg-transparent border-none border-b border-gray-200 focus:border-red-500 focus:ring-0 w-full text-xs font-mono text-gray-700 p-1 resize-none overflow-hidden min-h-[36px]"
                          />
                        </TableCell>
                        <TableCell className="py-2 px-4">
                          <textarea 
                            value={item.company_product_name || ''}
                            onChange={(e) => handleItemChange(idx, 'company_product_name', e.target.value)}
                            rows={1}
                            onInput={(e) => {
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = 'auto';
                              target.style.height = `${target.scrollHeight}px`;
                            }}
                            ref={(el) => {
                              if (el) {
                                el.style.height = 'auto';
                                el.style.height = `${el.scrollHeight}px`;
                              }
                            }}
                            className="bg-transparent border-none border-b border-gray-200 focus:border-red-500 focus:ring-0 w-full text-xs font-medium text-gray-900 p-1 resize-none overflow-hidden min-h-[36px]"
                          />
                        </TableCell>
                        <TableCell className="py-2 px-4">
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
                        </TableCell>
                        {/* Category Column */}
                        <TableCell className="py-2 px-4">
                          {item.product_id ? (
                            (() => {
                              const prod = products.find(p => p.id === Number(item.product_id));
                              if (prod) {
                                return (
                                  <span className="text-[10px] text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded font-medium inline-block truncate max-w-[150px]" title={prod.category_name}>
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
                                handleItemChange(idx, 'sub_category_id', null); // Reset subcategory when category changes
                              }}
                              className="bg-white border border-gray-200 rounded p-0.5 text-[10px] w-full focus:ring-0 text-gray-700 font-medium"
                            >
                              <option value="">-- หมวดหมู่หลัก --</option>
                              {categories.map((c: any) => (
                                <option key={c.ID} value={c.ID}>{c.category_name}</option>
                              ))}
                            </select>
                          )}
                        </TableCell>

                        {/* Sub-Category Column */}
                        <TableCell className="py-2 px-4">
                          {item.product_id ? (
                            (() => {
                              const prod = products.find(p => p.id === Number(item.product_id));
                              if (prod && prod.sub_category_name) {
                                return (
                                  <span className="text-[9px] text-gray-400 pl-1 truncate max-w-[150px]" title={prod.sub_category_name}>
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
                              className="bg-white border border-gray-200 rounded p-0.5 text-[10px] w-full focus:ring-0 text-gray-700 font-medium disabled:opacity-50"
                            >
                              <option value="">-- หมวดหมู่ย่อย --</option>
                              {item.category_id ? ((categories.find((c: any) => c.ID === item.category_id))?.sub_categories || []).map((sc: any) => (
                                <option key={sc.ID} value={sc.ID}>{sc.sub_category_name}</option>
                              )) : null}
                            </select>
                          )}
                        </TableCell>
                        <TableCell className="py-2 px-4 text-right">
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
                        </TableCell>
                        <TableCell className="py-2 px-4 text-right">
                          <input 
                            type="number" 
                            step="0.01"
                            value={item.price_per_unit ?? 0}
                            onChange={(e) => handleItemChange(idx, 'price_per_unit', e.target.value)}
                            className="bg-transparent border-b border-gray-200 focus:border-red-500 focus:ring-0 w-16 text-right text-xs text-gray-700 font-bold p-1"
                          />
                        </TableCell>
                        <TableCell className="py-2 px-4 text-right font-bold text-gray-900 text-xs">
                          ฿{((item.order_quantity || 0) * (item.price_per_unit || 0) - (item.discount_amount || 0)).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="py-2 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(idx)}
                            className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                            disabled={formData.items.length <= 1}
                            title="ลบรายการสินค้า"
                          >
                            <Trash2 size={16} />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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

              {/* ยอดรวมไม่ตรงกัน Warning Banner */}
              {isTotalMismatched && (
                <div className="mx-6 my-4 p-4 bg-red-50 border border-red-200 text-[#b32025] text-sm rounded-lg flex items-start gap-3 animate-in slide-in-from-top-2 duration-200 shadow-sm text-left">
                  <AlertCircle className="text-[#b32025] shrink-0 mt-0.5" size={20} />
                  <div className="flex-1 text-xs">
                    <p className="font-bold text-sm text-[#b32025] mb-1">ยอดเงินไม่ตรงกัน (Amount Mismatch)</p>
                    <p className="leading-relaxed text-red-700">
                      ยอดเงินสุทธิรวมในบิล (<span className="font-bold">฿{formData.total_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>) 
                      ไม่ตรงกับผลรวมคำนวณจริงของรายการสินค้าทั้งหมดในตาราง (<span className="font-bold">฿{expectedGrandTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>)
                    </p>
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => updateFormState({ total_amount: expectedGrandTotal })}
                        className="bg-[#b32025] hover:bg-[#9a1a1f] text-white font-bold px-3 py-1.5 rounded transition-all cursor-pointer text-[11px] shadow-sm"
                      >
                        ปรับยอดบิลให้ตรงตามตาราง
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary & Submit */}
              <div className="border-t border-gray-100 p-6 flex justify-between items-end bg-[#fafafa] rounded-b-xl mt-auto">
                <div className="text-xs text-gray-600 space-y-2 text-left">
                  <p>จำนวนรายการทั้งหมด : <span className="text-gray-900 font-bold">{formData.items.length} รายการ</span></p>
                  <p>มูลค่าสินค้า (SUBTOTAL) : <span className="text-gray-900 font-bold">฿{formData.subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span></p>
                </div>
                <div className="text-right flex items-end gap-4">
                  <div>
                    <p className="text-xs text-[#b32025] font-bold mb-1 text-left">ยอดเงินสุทธิรวม:</p>
                    <p className="text-3xl text-[#b32025] font-bold">{formData.total_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</p>
                  </div>
                  <button 
                    type="button"
                    onClick={exportBillItemsToExcel}
                    className="bg-[#1C1B1B] hover:bg-[#2a2929] text-white px-6 py-3 rounded text-sm font-bold flex items-center gap-2 transition-all shadow-sm cursor-pointer"
                  >
                    <FileUp size={18} />
                    <span>ส่งออกเป็น Excel</span>
                  </button>
                  <button 
                    onClick={() => batchResults.length > 0 ? handleSaveAllBatchBills(false) : handleSaveBill(false)}
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
  const renderExcelView = () => {
    const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      processExcelFile(file);
    };

    const processExcelFile = (file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet);
          
          if (rows.length === 0) {
            alert('ไม่พบข้อมูลในไฟล์ หรือรูปแบบไฟล์ไม่ถูกต้อง');
            return;
          }

          const getSimilarity = (s1: string, s2: string): number => {
            const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '');
            const w1 = clean(s1);
            const w2 = clean(s2);
            
            if (w1 === w2) return 1.0;
            if (w1.includes(w2) || w2.includes(w1)) return 0.8;
            
            const track = Array(w2.length + 1).fill(null).map(() =>
              Array(w1.length + 1).fill(null)
            );
            for (let i = 0; i <= w1.length; i += 1) track[0][i] = i;
            for (let j = 0; j <= w2.length; j += 1) track[j][0] = j;
            for (let j = 1; j <= w2.length; j += 1) {
              for (let i = 1; i <= w1.length; i += 1) {
                const indicator = w1[i - 1] === w2[j - 1] ? 0 : 1;
                track[j][i] = Math.min(
                  track[j][i - 1] + 1,
                  track[j - 1][i] + 1,
                  track[j - 1][i - 1] + indicator
                );
              }
            }
            const distance = track[w2.length][w1.length];
            const maxLength = Math.max(w1.length, w2.length);
            return maxLength === 0 ? 0 : 1 - (distance / maxLength);
          };

          // Smart map Excel/CSV columns to BillItemDTO structure
          const mappedItems: BillItemDTO[] = rows.map((row: any, index: number) => {
            const findValue = (keywords: string[]) => {
              // 1. Direct or substring matching
              const matchedKey = Object.keys(row).find(key => 
                keywords.some(kw => key.toLowerCase().includes(kw.toLowerCase()) || kw.toLowerCase().includes(key.toLowerCase()))
              );
              if (matchedKey) return row[matchedKey];

              // 2. Fuzzy Levenshtein semantic similarity matching
              let bestKey = '';
              let bestScore = 0;
              for (const key of Object.keys(row)) {
                for (const kw of keywords) {
                  const score = getSimilarity(key, kw);
                  if (score > bestScore) {
                    bestScore = score;
                    bestKey = key;
                  }
                }
              }

              if (bestScore > 0.55 && bestKey) {
                return row[bestKey];
              }
              return '';
            };

            const code = findValue(['code', 'product_code', 'รหัส', 'รหัสสินค้า', 'part_number', 'part_no', 'sku', 'รหัสอะไหล่']);
            const name = findValue(['name', 'product_name', 'ชื่อ', 'ชื่อสินค้า', 'description', 'detail', 'รายการ', 'ชื่ออะไหล่']);
            const qty = parseFloat(findValue(['quantity', 'qty', 'จำนวน', 'จำนวนต่อหน่วย', 'ordered', 'vol', 'ยอดสั่งซื้อ']) || '1') || 1;
            const unit = findValue(['unit', 'หน่วย', 'uom', 'pack', 'ขนาดบรรจุ']) || 'ชิ้น';
            const price = parseFloat(findValue(['price', 'rate', 'ราคา', 'ราคาต่อหน่วย', 'cost', 'unit_cost', 'ราคา/หน่วย']) || '0') || 0;

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
            bill_no: 'IMPORT-' + Math.floor(1000 + Math.random() * 9000),
            total_amount: subtotal,
            due_date: new Date().toISOString().split('T')[0],
            transport_by: '',
            supplier_id: suppliers[0]?.id || 1,
            subtotal: subtotal,
            discount_total: 0,
            receive_date: new Date().toISOString().split('T')[0],
            vat_amount: 0,
            grand_total: subtotal,
            payment_status: 'unpaid',
            items: mappedItems,
            db_job_id: 0,
            bill_image_id: 0,
            filename: file.name
          });

          setPreviewUrl(null); // No image preview for Excel/CSV mode
          setCurrentView('scan'); // Direct to scan view editor
          setErrorMsg(null);
        } catch (error) {
          console.error(error);
          alert('เกิดข้อผิดพลาดในการอ่านไฟล์: ' + String(error));
        }
      };
      reader.readAsArrayBuffer(file);
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
          {/* Centered Icon Box styled consistently with Home View card */}
          <div className="bg-[#1c1b1b] text-white p-5 rounded-xl mb-6 shadow-sm">
            <FileUp size={48} className="text-white" />
          </div>

          <h3 className="text-2xl font-bold text-gray-900 mb-2">นำเข้าไฟล์สั่งซื้ออะไหล่ (Excel / CSV)</h3>
          <p className="text-gray-500 text-sm max-w-md mb-8 leading-relaxed">
            อัปโหลดไฟล์ในรูปแบบ Excel (.xlsx, .xls) หรือ CSV (.csv) เพื่อนำข้อมูลไปแปลงเป็นหน้าตารางและทำการตรวจสอบแก้ไขได้ทันที
          </p>

          <label className="cursor-pointer text-white bg-[#b32025] hover:bg-[#9a1a1f] px-8 py-3 rounded-lg font-bold transition-all shadow-sm">
            เลือกไฟล์ Excel / CSV เพื่อนำเข้า
            <input 
              type="file" 
              className="hidden" 
              accept=".csv, .xlsx, .xls" 
              onChange={handleExcelFileChange} 
            />
          </label>
        </div>
      </div>
    );
  };

  // Render PO Selection Page View
  const renderPOView = () => {
    // Filter POs by search query (OrderNumber or SupplierName)
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
          <button onClick={() => setCurrentView('home')} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <ChevronLeft size={24} className="text-gray-600" />
          </button>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <span>นำเข้าสินค้าด้วยใบสั่งซื้อ</span>
          </h1>
        </div>

        {/* Content Box */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col min-h-[500px]">
          {/* Search Box */}
          <div className="mb-6">
            <label className="block text-xs font-bold text-gray-500 mb-2">ค้นหาใบสั่งซื้อ (SEARCH PURCHASE ORDER)</label>
            <input 
              type="text"
              placeholder="พิมพ์ค้นหาเลขที่ PO หรือชื่อผู้จัดจำหน่าย..."
              value={poSearchQuery}
              onChange={(e) => setPoSearchQuery(e.target.value)}
              className="w-full bg-[#f4f4f5] border-none rounded-lg p-3 text-sm focus:ring-1 focus:ring-blue-500 text-gray-800 font-medium"
            />
          </div>

          {/* List Section */}
          <div className="flex-1 overflow-y-auto min-h-[300px]">
            {loadingPOs ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Loader2 size={36} className="animate-spin text-[#2563EB] mb-2" />
                <span className="text-sm font-medium">กำลังโหลดรายการใบสั่งซื้อ...</span>
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
                  <TableHeader className="bg-gray-100 text-gray-600">
                    <TableRow>
                      <TableHead className="pl-6">เลขที่ใบสั่งซื้อ (PO NO.)</TableHead>
                      <TableHead>ผู้จัดจำหน่าย (SUPPLIER)</TableHead>
                      <TableHead>วันที่ออกเอกสาร (DATE)</TableHead>
                      <TableHead className="text-right">ยอดเงินรวม (TOTAL)</TableHead>
                      <TableHead className="text-center">สถานะ (STATUS)</TableHead>
                      <TableHead className="text-center pr-6">ดำเนินการ (ACTION)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-gray-700">
                    {filteredPOs.map((po) => (
                      <TableRow key={po.id} className="hover:bg-gray-50/70 transition-colors">
                        <TableCell className="pl-6 font-semibold text-gray-900">{po.order_number}</TableCell>
                        <TableCell>{po.supplier_name || 'ไม่ระบุ'}</TableCell>
                        <TableCell className="text-xs text-gray-500">{formatDate(po.created_at)}</TableCell>
                        <TableCell className="text-right font-medium text-gray-900">
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
  };

  return (
    <>
      {currentView === 'home' && renderHomeView()}
      {currentView === 'scan' && renderScanView()}
      {currentView === 'excel' && renderExcelView()}
      {currentView === 'po' && renderPOView()}

      {/* Validation Warning Modal */}
      {showValidationModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="bg-[#fffbeb] border-b border-amber-200 px-6 py-4 flex items-center gap-3 text-amber-800">
              <AlertTriangle className="w-6 h-6 shrink-0 text-amber-600 animate-pulse" />
              <div>
                <h3 className="font-bold text-lg">คำเตือน: ตรวจพบข้อมูลไม่สอดคล้องหรือน่าสงสัย</h3>
                <p className="text-xs text-amber-700">กรุณาตรวจสอบรายละเอียดด้านล่างก่อนยืนยันบันทึกข้อมูล</p>
              </div>
            </div>
            
            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-3 flex-1">
              <div className="text-sm text-gray-600 mb-4 bg-gray-50 p-3 rounded border border-gray-100">
                ระบบวิเคราะห์ข้อมูลใบเสร็จของคุณแล้วพบจุดผิดพลาดหรือแจ้งเตือนที่อาจเกิดจากความไม่สอดคล้อง (เช่น ยอดผลรวมต่างกัน, จำนวน/ราคาไม่ตรงกับใบสั่งซื้อ PO หรือยังไม่ได้จับคู่สินค้า)
              </div>
              <div className="space-y-2">
                {validationWarnings.map((w, idx) => (
                  <div key={idx} className="flex gap-2 text-xs text-red-700 bg-red-50 p-2 rounded border border-red-100">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                    <span className="font-medium whitespace-pre-wrap">{w}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowValidationModal(false);
                  setValidationWarnings([]);
                  setOnConfirmAction(null);
                }}
                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                ย้อนกลับไปแก้ไข
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowValidationModal(false);
                  if (onConfirmAction) {
                    onConfirmAction();
                  }
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                ยืนยันบันทึกข้อมูลต่อไป
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
