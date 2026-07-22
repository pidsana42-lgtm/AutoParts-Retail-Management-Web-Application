import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../../../service/http/apiClient';
import * as XLSX from 'xlsx';

import { 
  scanBill,
  confirmBillImport,
  updateBill,
  deleteBill,
  getPurchaseOrders,
  getPurchaseOrderById,
  updateProductCostPrice
} from '../../../service/http/import/import_service';

import type { 
  ViewState, 
  Supplier, 
  Product, 
  BillItemDTO, 
  ScannedBillData, 
  SavedBill 
} from '../../../interface/import';

import HomeView from './components/HomeView';
import ScanView from './components/ScanView';
import ExcelView from './components/ExcelView';
import POView from './components/POView';
import ManualEntryView from './components/ManualEntryView';
import ValidationModal from './components/ValidationModal';
import PriceUpdateModal from './components/PriceUpdateModal';
import type { PriceMismatchItem } from './components/PriceUpdateModal';

const isPlaceholder = (val: any): boolean => {
  if (!val) return true;
  const s = val.toString().toLowerCase().trim();
  return (
    s === '' ||
    s === 'null' ||
    s === 'undefined' ||
    s.includes('product code') ||
    s.includes('product name') ||
    s.includes('ชื่อสินค้า') ||
    s.includes('รหัสสินค้า') ||
    s.includes('from invoice')
  );
};

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

  // Price Mismatch States
  const [priceMismatchedItems, setPriceMismatchedItems] = useState<PriceMismatchItem[]>([]);
  const [showPriceUpdateModal, setShowPriceUpdateModal] = useState<boolean>(false);
  const [onConfirmPriceUpdateAction, setOnConfirmPriceUpdateAction] = useState<((selectedIds: number[]) => void) | null>(null);

  // Loading and Error States
  const [loadingBills, setLoadingBills] = useState(false);
  const [loadingSuppliersProducts, setLoadingSuppliersProducts] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Batch Mode States
  const [batchImages, setBatchImages] = useState<File[]>([]);
  const [batchPreviewUrls, setBatchPreviewUrls] = useState<string[]>([]);
  const [batchResults, setBatchResults] = useState<ScannedBillData[]>([]);
  const [activeBatchIndex, setActiveBatchIndex] = useState<number>(0);
  const [batchProgress, setBatchProgress] = useState<{ [key: string]: 'pending' | 'scanning' | 'success' | 'failed' }>({});
  const [batchErrorMsg, setBatchErrorMsg] = useState<string | null>(null);

  // Synchronized Refs for Batch State Isolation
  const activeBatchIndexRef = useRef<number>(0);
  const batchResultsRef = useRef<ScannedBillData[]>([]);
  const formDataRef = useRef<ScannedBillData | null>(null);

  // Split Pane Resizing State
  const [leftWidth, setLeftWidth] = useState<number>(45);
  const [isResizing, setIsResizing] = useState<boolean>(false);

  // Scan View Form & Image Preview
  const [billImage, setBillImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotate, setRotate] = useState(0);

  const [formData, setFormData] = useState<ScannedBillData | null>(null);

  useEffect(() => {
    activeBatchIndexRef.current = activeBatchIndex;
  }, [activeBatchIndex]);

  useEffect(() => {
    batchResultsRef.current = batchResults;
  }, [batchResults]);

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  // PO Import Mode States
  const [poList, setPoList] = useState<any[]>([]);
  const [loadingPOs, setLoadingPOs] = useState(false);
  const [poSearchQuery, setPoSearchQuery] = useState('');
  const [poReference, setPoReference] = useState('');

  // Handle Split Pane Resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const container = document.getElementById('split-pane-container');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
      if (newWidth >= 20 && newWidth <= 80) {
        setLeftWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
      }
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Fetch initial data
  useEffect(() => {
    fetchBills();
    fetchSuppliersAndProducts();
    fetchPOsList();
    if (loadingSuppliersProducts || batchErrorMsg) {
      // noop
    }
  }, []);

  const fetchBills = async () => {
    setLoadingBills(true);
    try {
      const resp = await apiClient.get('/import-data/bills');
      const data = resp.data?.data || resp.data || [];
      setBills(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching bills:', err);
    } finally {
      setLoadingBills(false);
    }
  };

  const fetchSuppliersAndProducts = async () => {
    setLoadingSuppliersProducts(true);
    try {
      const [suppResp, prodResp, catResp] = await Promise.all([
        apiClient.get('/wms/suppliers'),
        apiClient.get('/wms/products'),
        apiClient.get('/wms/categories')
      ]);

      const suppData = suppResp.data?.data || suppResp.data || [];
      const prodData = prodResp.data?.data || prodResp.data || [];
      const catData = catResp.data?.data || catResp.data || [];

      setSuppliers(Array.isArray(suppData) ? suppData : []);
      setProducts(Array.isArray(prodData) ? prodData : []);
      setCategories(Array.isArray(catData) ? catData : []);
    } catch (err) {
      console.error('Error fetching suppliers/products/categories:', err);
    } finally {
      setLoadingSuppliersProducts(false);
    }
  };

  const fetchPOsList = async () => {
    setLoadingPOs(true);
    try {
      const data = await getPurchaseOrders();
      setPoList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching POs:', err);
      setPoList([]);
    } finally {
      setLoadingPOs(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setErrorMsg(null);
    setBatchErrorMsg(null);

    if (files.length === 1) {
      const singleFile = files[0];
      const singleUrl = URL.createObjectURL(singleFile);
      setBillImage(singleFile);
      setPreviewUrl(singleUrl);
      setBatchImages([]);
      setBatchPreviewUrls([]);
      setBatchResults([]);
      setActiveBatchIndex(0);
      setBatchProgress({});
      setFormData(null);
    } else {
      const fileList = Array.from(files);
      const urls = fileList.map(f => URL.createObjectURL(f));
      setBatchImages(fileList);
      setBatchPreviewUrls(urls);
      setBatchResults([]);
      setActiveBatchIndex(0);
      setBillImage(fileList[0]);
      setPreviewUrl(urls[0]);
      
      const initialProgress: { [key: string]: 'pending' | 'scanning' | 'success' | 'failed' } = {};
      fileList.forEach(f => {
        initialProgress[f.name] = 'pending';
      });
      setBatchProgress(initialProgress);
      setFormData(null);
    }
  };

  const handleOcrProcess = async () => {
    if (batchImages.length > 0) {
      await processBatchImages();
      return;
    }

    if (!billImage) {
      setErrorMsg('กรุณาเลือกไฟล์ภาพบิลหรือ PDF ก่อนทำรายการ');
      return;
    }

    setScanning(true);
    setErrorMsg(null);

    try {
      const scannedResult = await scanBill(billImage);
      
      let matchedSupplierId = 0;
      if (scannedResult.supplier_name) {
        const cleanedOcrName = scannedResult.supplier_name.toLowerCase().replace(/บริษัท|จำกัด|บจก\.|หจก\./g, '').trim();
        const found = suppliers.find(s => {
          const cleanedSuppName = s.supplier_name.toLowerCase().replace(/บริษัท|จำกัด|บจก\.|หจก\./g, '').trim();
          return cleanedSuppName === cleanedOcrName || cleanedSuppName.includes(cleanedOcrName) || cleanedOcrName.includes(cleanedSuppName);
        });
        if (found) matchedSupplierId = found.id;
      }

      const mappedScannedItems = (scannedResult.items || [])
        .filter((item: any) => {
          const code = item.company_product_code;
          const name = item.company_product_name;
          return (code && !isPlaceholder(code)) || (name && !isPlaceholder(name));
        })
        .map((item: any, idx: number) => {
          let matchedProdId: number | null = item.product_id ? Number(item.product_id) : null;
          let matchedCatId: number | null = null;
          let matchedSubCatId: number | null = null;

          if (matchedProdId) {
            const foundProd = products.find(p => p.id === matchedProdId);
            if (foundProd) {
              if (foundProd.category_name) {
                const foundCat = categories.find(c => c.category_name === foundProd.category_name);
                if (foundCat) matchedCatId = foundCat.ID;
              }
              if (foundProd.sub_category_name && matchedCatId) {
                const foundCat = categories.find(c => c.ID === matchedCatId);
                if (foundCat && foundCat.sub_categories) {
                  const foundSub = foundCat.sub_categories.find((sc: any) => sc.sub_category_name === foundProd.sub_category_name);
                  if (foundSub) matchedSubCatId = foundSub.ID;
                }
              }
            }
          }

          const qty = (item.order_quantity !== undefined && item.order_quantity !== null && item.order_quantity !== '') ? Number(item.order_quantity) : 1;
          const price = Number(item.price_per_unit) || 0;
          const disc = Number(item.discount_amount) || 0;
          const net = (item.net_amount !== undefined && item.net_amount !== null && item.net_amount !== '') ? Number(item.net_amount) : ((qty * price) - disc);

          return {
            item_sequence: idx + 1,
            company_product_code: item.company_product_code || '',
            company_product_name: item.company_product_name || '',
            order_quantity: qty,
            unit: item.unit || 'ชิ้น',
            conversion_factor: 1,
            price_per_unit: price,
            discount_amount: disc,
            net_amount: net,
            is_freebie: false,
            remark: item.remark || '',
            product_id: matchedProdId,
            category_id: matchedCatId,
            sub_category_id: matchedSubCatId
          };
        });

      const calcSubtotal = mappedScannedItems.reduce((sum, item) => sum + item.net_amount, 0);
      const vatAmount = Number(scannedResult.vat_amount) || 0;
      const discountTotal = Number(scannedResult.discount_total) || 0;
      const calcTotalAmount = mappedScannedItems.length > 0
        ? Math.round((calcSubtotal - discountTotal + vatAmount) * 100) / 100
        : (Number(scannedResult.total_amount) || 0);

      const formattedData: ScannedBillData = {
        bill_no: scannedResult.bill_no || '',
        total_amount: calcTotalAmount,
        due_date: scannedResult.due_date || new Date().toISOString().split('T')[0],
        credit_term: scannedResult.credit_term || '30 Days',
        transport_by: scannedResult.transport_by || '',
        supplier_id: matchedSupplierId,
        supplier_name: scannedResult.supplier_name || '',
        subtotal: Math.round(calcSubtotal * 100) / 100,
        discount_total: discountTotal,
        receive_date: new Date().toISOString().split('T')[0],
        vat_amount: vatAmount,
        grand_total: calcTotalAmount,
        payment_status: 'unpaid',
        items: mappedScannedItems,
        db_job_id: scannedResult.db_job_id || 0,
        bill_image_id: scannedResult.bill_image_id || 0,
        filename: billImage.name
      };

      setFormData(formattedData);
    } catch (err: any) {
      console.error('OCR Process Error:', err);
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการสแกนวิเคราะห์บิล');
    } finally {
      setScanning(false);
    }
  };

  const processBatchImages = async () => {
    if (batchImages.length === 0) return;

    setScanning(true);
    setBatchErrorMsg(null);
    const results: ScannedBillData[] = new Array(batchImages.length);
    const progressMap = { ...batchProgress };

    for (let i = 0; i < batchImages.length; i++) {
      const file = batchImages[i];
      progressMap[file.name] = 'scanning';
      setBatchProgress({ ...progressMap });

      try {
        const scannedResult = await scanBill(file);
        
        let matchedSupplierId = 0;
        if (scannedResult.supplier_name) {
          const cleanedOcrName = scannedResult.supplier_name.toLowerCase().replace(/บริษัท|จำกัด|บจก\.|หจก\./g, '').trim();
          const found = suppliers.find(s => {
            const cleanedSuppName = s.supplier_name.toLowerCase().replace(/บริษัท|จำกัด|บจก\.|หจก\./g, '').trim();
            return cleanedSuppName === cleanedOcrName || cleanedSuppName.includes(cleanedOcrName) || cleanedOcrName.includes(cleanedSuppName);
          });
          if (found) matchedSupplierId = found.id;
        }

        const mappedScannedItems = (scannedResult.items || [])
          .filter((item: any) => {
            const code = item.company_product_code;
            const name = item.company_product_name;
            return (code && !isPlaceholder(code)) || (name && !isPlaceholder(name));
          })
          .map((item: any, idx: number) => {
            let matchedProdId: number | null = item.product_id ? Number(item.product_id) : null;
            let matchedCatId: number | null = null;
            let matchedSubCatId: number | null = null;

            if (matchedProdId) {
              const foundProd = products.find(p => p.id === matchedProdId);
              if (foundProd) {
                if (foundProd.category_name) {
                  const foundCat = categories.find(c => c.category_name === foundProd.category_name);
                  if (foundCat) matchedCatId = foundCat.ID;
                }
                if (foundProd.sub_category_name && matchedCatId) {
                  const foundCat = categories.find(c => c.ID === matchedCatId);
                  if (foundCat && foundCat.sub_categories) {
                    const foundSub = foundCat.sub_categories.find((sc: any) => sc.sub_category_name === foundProd.sub_category_name);
                    if (foundSub) matchedSubCatId = foundSub.ID;
                  }
                }
              }
            }

            const qty = (item.order_quantity !== undefined && item.order_quantity !== null && item.order_quantity !== '') ? Number(item.order_quantity) : 1;
            const price = Number(item.price_per_unit) || 0;
            const disc = Number(item.discount_amount) || 0;
            const net = (item.net_amount !== undefined && item.net_amount !== null && item.net_amount !== '') ? Number(item.net_amount) : ((qty * price) - disc);

            return {
              item_sequence: idx + 1,
              company_product_code: item.company_product_code || '',
              company_product_name: item.company_product_name || '',
              order_quantity: qty,
              unit: item.unit || 'ชิ้น',
              conversion_factor: 1,
              price_per_unit: price,
              discount_amount: disc,
              net_amount: net,
              is_freebie: false,
              remark: item.remark || '',
              product_id: matchedProdId,
              category_id: matchedCatId,
              sub_category_id: matchedSubCatId
            };
          });

        const calcSubtotal = mappedScannedItems.reduce((sum, item) => sum + item.net_amount, 0);
        const vatAmount = Number(scannedResult.vat_amount) || 0;
        const discountTotal = Number(scannedResult.discount_total) || 0;
        const calcTotalAmount = mappedScannedItems.length > 0
          ? Math.round((calcSubtotal - discountTotal + vatAmount) * 100) / 100
          : (Number(scannedResult.total_amount) || 0);

        const formattedData: ScannedBillData = {
          bill_no: scannedResult.bill_no || '',
          total_amount: calcTotalAmount,
          due_date: scannedResult.due_date || new Date().toISOString().split('T')[0],
          credit_term: scannedResult.credit_term || '30 Days',
          transport_by: scannedResult.transport_by || '',
          supplier_id: matchedSupplierId,
          supplier_name: scannedResult.supplier_name || '',
          subtotal: Math.round(calcSubtotal * 100) / 100,
          discount_total: discountTotal,
          receive_date: new Date().toISOString().split('T')[0],
          vat_amount: vatAmount,
          grand_total: calcTotalAmount,
          payment_status: 'unpaid',
          items: mappedScannedItems,
          db_job_id: scannedResult.db_job_id || 0,
          bill_image_id: scannedResult.bill_image_id || 0,
          filename: file.name
        };

        results[i] = formattedData;
        progressMap[file.name] = 'success';
        
        // Update batchResults state and ref live as each file finishes
        setBatchResults([...results]);
        batchResultsRef.current = [...results];

        if (i === activeBatchIndexRef.current || !formDataRef.current) {
          setActiveBatchIndex(i);
          activeBatchIndexRef.current = i;
          setBillImage(batchImages[i]);
          setFormData({
            ...formattedData,
            items: [...(formattedData.items || [])]
          });
          const url = batchPreviewUrls[i] || URL.createObjectURL(batchImages[i]);
          setPreviewUrl(url);
        }
      } catch (err) {
        console.error(`Error scanning file ${file.name}:`, err);
        progressMap[file.name] = 'failed';
      }
      setBatchProgress({ ...progressMap });
    }

    setScanning(false);
  };

  const handleSelectBatchItem = (index: number) => {
    if (index < 0) return;

    // Flush active formData to ref before switching
    if (formDataRef.current && activeBatchIndexRef.current < batchResultsRef.current.length) {
      const nextResults = [...batchResultsRef.current];
      nextResults[activeBatchIndexRef.current] = formDataRef.current;
      setBatchResults(nextResults);
      batchResultsRef.current = nextResults;
    }

    setActiveBatchIndex(index);
    activeBatchIndexRef.current = index;

    if (batchImages[index]) {
      setBillImage(batchImages[index]);
      const url = batchPreviewUrls[index] || URL.createObjectURL(batchImages[index]);
      setPreviewUrl(url);
    }

    const targetData = batchResultsRef.current[index];
    if (targetData) {
      setFormData({
        ...targetData,
        items: targetData.items ? [...targetData.items] : []
      });
    } else {
      setFormData(null);
    }
  };

  const handleMergeBatchResultsToSingleBill = () => {
    if (batchResults.length === 0) return;

    const firstBill = batchResults[0];
    let combinedItems: BillItemDTO[] = [];
    let totalSubtotal = 0;
    let totalVat = 0;
    let totalGrand = 0;
    let totalDiscount = 0;

    batchResults.forEach((bill) => {
      totalSubtotal += Number(bill.subtotal) || 0;
      totalVat += Number(bill.vat_amount) || 0;
      totalGrand += Number(bill.grand_total) || 0;
      totalDiscount += Number(bill.discount_total) || 0;

      (bill.items || []).forEach((item) => {
        combinedItems.push({
          ...item,
          item_sequence: combinedItems.length + 1
        });
      });
    });

    const mergedBill: ScannedBillData = {
      ...firstBill,
      items: combinedItems,
      subtotal: totalSubtotal,
      vat_amount: totalVat,
      grand_total: totalGrand,
      total_amount: totalGrand,
      discount_total: totalDiscount
    };

    setFormData(mergedBill);
  };

  const handlePrevBatchItem = () => {
    if (activeBatchIndex > 0) {
      handleSelectBatchItem(activeBatchIndex - 1);
    }
  };

  const handleNextBatchItem = () => {
    const maxLen = Math.max(batchImages.length, batchResults.length);
    if (activeBatchIndex < maxLen - 1) {
      handleSelectBatchItem(activeBatchIndex + 1);
    }
  };

  const updateBatchResultForActiveIndex = (updated: ScannedBillData) => {
    const idx = activeBatchIndexRef.current;
    if (idx < batchResultsRef.current.length) {
      const next = [...batchResultsRef.current];
      next[idx] = updated;
      batchResultsRef.current = next;
      setBatchResults(next);
    }
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    if (!formData) return;
    const updatedItems = [...formData.items];
    const targetItem = { ...updatedItems[index], [field]: value };

    if (field === 'product_id' && value) {
      const selectedProd = products.find(p => p.id === Number(value));
      if (selectedProd && (!targetItem.company_product_code || targetItem.company_product_code.trim() === '')) {
        targetItem.company_product_code = selectedProd.product_code || '';
      }
    }

    if (field === 'order_quantity' || field === 'price_per_unit' || field === 'discount_amount') {
      const qty = Number(field === 'order_quantity' ? value : targetItem.order_quantity) || 0;
      const price = Number(field === 'price_per_unit' ? value : targetItem.price_per_unit) || 0;
      const disc = Number(field === 'discount_amount' ? value : targetItem.discount_amount) || 0;
      targetItem.net_amount = (qty * price) - disc;
    }

    updatedItems[index] = targetItem;

    let newSubtotal = 0;
    updatedItems.forEach(item => {
      newSubtotal += (Number(item.order_quantity || 0) * Number(item.price_per_unit || 0)) - Number(item.discount_amount || 0);
    });

    const vatAmount = Number(formData.vat_amount) || 0;
    const discTotal = Number(formData.discount_total) || 0;
    const newTotal = Math.round((newSubtotal - discTotal + vatAmount) * 100) / 100;

    const updatedForm = {
      ...formData,
      items: updatedItems,
      subtotal: Math.round(newSubtotal * 100) / 100,
      total_amount: newTotal,
      grand_total: newTotal
    };

    setFormData(updatedForm);
    updateBatchResultForActiveIndex(updatedForm);
  };

  const handleAddRow = () => {
    if (!formData) return;
    const newRow: BillItemDTO = {
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
    let newSubtotal = 0;
    updatedItems.forEach(item => {
      newSubtotal += (Number(item.order_quantity || 0) * Number(item.price_per_unit || 0)) - Number(item.discount_amount || 0);
    });

    const vatAmount = Number(formData.vat_amount) || 0;
    const discTotal = Number(formData.discount_total) || 0;
    const newTotal = Math.round((newSubtotal - discTotal + vatAmount) * 100) / 100;

    const updated = {
      ...formData,
      items: updatedItems,
      subtotal: Math.round(newSubtotal * 100) / 100,
      total_amount: newTotal,
      grand_total: newTotal
    };
    setFormData(updated);
    updateBatchResultForActiveIndex(updated);
  };

  const handleRemoveRow = (idx: number) => {
    if (!formData) return;
    const updatedItems = formData.items.filter((_, i) => i !== idx);
    
    let newSubtotal = 0;
    updatedItems.forEach(item => {
      newSubtotal += (Number(item.order_quantity || 0) * Number(item.price_per_unit || 0)) - Number(item.discount_amount || 0);
    });

    const vatAmount = Number(formData.vat_amount) || 0;
    const discTotal = Number(formData.discount_total) || 0;
    const newTotal = Math.round((newSubtotal - discTotal + vatAmount) * 100) / 100;
    
    const updated = {
      ...formData,
      items: updatedItems,
      subtotal: Math.round(newSubtotal * 100) / 100,
      total_amount: newTotal,
      grand_total: newTotal
    };
    setFormData(updated);
    updateBatchResultForActiveIndex(updated);
  };

  const updateFormState = (updates: Partial<ScannedBillData>) => {
    if (!formData) return;
    const updated = { ...formData, ...updates };

    let newSubtotal = 0;
    (updated.items || []).forEach(item => {
      const qty = Number(item.order_quantity) || 0;
      const price = Number(item.price_per_unit) || 0;
      const disc = Number(item.discount_amount) || 0;
      newSubtotal += (qty * price) - disc;
    });

    const vatAmount = Number(updated.vat_amount) || 0;
    const discTotal = Number(updated.discount_total) || 0;
    const newTotal = Math.round((newSubtotal - discTotal + vatAmount) * 100) / 100;

    updated.subtotal = Math.round(newSubtotal * 100) / 100;
    updated.total_amount = newTotal;
    updated.grand_total = newTotal;

    setFormData(updated);
    updateBatchResultForActiveIndex(updated);
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
      credit_term: bill.credit_term || '30 Days',
      transport_by: bill.transport_by,
      supplier_id: bill.supplier_id,
      subtotal: bill.subtotal,
      discount_total: bill.discount_total,
      receive_date: bill.receive_date ? bill.receive_date.split('T')[0] : '',
      vat_amount: bill.vat_amount,
      grand_total: bill.grand_total,
      payment_status: bill.payment_status,
      items: (bill.bill_items || []).map(item => ({
        item_sequence: item.item_sequence,
        company_product_code: item.company_product_code,
        company_product_name: item.company_product_name,
        order_quantity: item.order_quantity,
        unit: item.unit,
        conversion_factor: item.conversion_factor,
        price_per_unit: item.price_per_unit,
        discount_amount: item.discount_amount,
        net_amount: item.net_amount,
        is_freebie: item.is_freebie,
        remark: item.remark,
        product_id: item.product_id
      })),
      db_job_id: 0,
      bill_image_id: bill.bill_image?.id || 0
    });

    if (bill.bill_image && bill.bill_image.image_url) {
      setPreviewUrl(bill.bill_image.image_url);
    } else {
      setPreviewUrl(null);
    }

    setCurrentView('scan');
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

        const mappedItems: BillItemDTO[] = rows.map((row: any, index: number) => {
          const findValue = (keywords: string[]) => {
            const matchedKey = Object.keys(row).find(key => 
              keywords.some(kw => key.toLowerCase().includes(kw.toLowerCase()) || kw.toLowerCase().includes(key.toLowerCase()))
            );
            if (matchedKey) return row[matchedKey];

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

        setPreviewUrl(null);
        setCurrentView('manual');
        setErrorMsg(null);
      } catch (error) {
        console.error(error);
        alert('เกิดข้อผิดพลาดในการอ่านไฟล์: ' + String(error));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSelectPO = async (poId: number) => {
    try {
      const poData = await getPurchaseOrderById(poId);
      if (!poData) {
        alert('ไม่พบข้อมูลรายละเอียดใบสั่งซื้อ');
        return;
      }

      const poItems = poData.purchase_order_items || poData.items || [];
      setOriginalPOItems(poItems);

      const mappedItems: BillItemDTO[] = poItems.map((item: any, idx: number) => {
        const qty = Number(item.quantity) || 1;
        const price = Number(item.unit_price) || 0;
        return {
          item_sequence: idx + 1,
          company_product_code: item.product_code || '',
          company_product_name: item.product_name || '',
          order_quantity: qty,
          unit: 'ชิ้น',
          conversion_factor: 1,
          price_per_unit: price,
          discount_amount: 0,
          net_amount: qty * price,
          is_freebie: false,
          remark: '',
          product_id: item.product_id || null
        };
      });

      const subtotal = mappedItems.reduce((sum, i) => sum + i.net_amount, 0);

      setFormData({
        bill_no: `PO-IMPORT-${poData.order_number || poId}`,
        total_amount: poData.total_amount || subtotal,
        due_date: new Date().toISOString().split('T')[0],
        transport_by: '',
        supplier_id: poData.supplier_id || suppliers[0]?.id || 1,
        subtotal: subtotal,
        discount_total: 0,
        receive_date: new Date().toISOString().split('T')[0],
        vat_amount: 0,
        grand_total: poData.total_amount || subtotal,
        payment_status: 'unpaid',
        items: mappedItems,
        db_job_id: 0,
        bill_image_id: 0
      });

      setPoReference(String(poId));
      setPreviewUrl(null);
      setCurrentView('manual');
    } catch (err: any) {
      console.error('Error selecting PO:', err);
      alert('เกิดข้อผิดพลาดในการดึงข้อมูล PO: ' + (err.message || err));
    }
  };

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

  const validateBillBeforeSave = (): string[] => {
    const warnings: string[] = [];
    if (!formData) return warnings;

    let calcSubtotal = 0;
    formData.items.forEach(item => {
      const qty = Number(item.order_quantity) || 0;
      const price = Number(item.price_per_unit) || 0;
      const disc = Number(item.discount_amount) || 0;
      calcSubtotal += (qty * price) - disc;
    });

    if (Math.abs(calcSubtotal - formData.total_amount) > 1.0) {
      warnings.push(`ยอดเงินสุทธิในบิล (฿${formData.total_amount.toLocaleString()}) ไม่ตรงกับยอดรวมคำนวณจริงของสินค้าในตาราง (฿${calcSubtotal.toLocaleString()})`);
    }

    const unmappedItems = formData.items.filter(item => !item.product_id);
    if (unmappedItems.length > 0) {
      warnings.push(`มีรายการสินค้า ${unmappedItems.length} รายการที่ยังไม่ได้จับคู่กับสินค้าในระบบคลัง (ระบบจะลงทะเบียนเป็นสินค้าใหม่ให้อัตโนมัติ)`);
    }

    if (originalPOItems.length > 0) {
      if (formData.items.length !== originalPOItems.length) {
        warnings.push(`จำนวนรายการสินค้าในบิล (${formData.items.length} รายการ) ไม่ตรงกับจำนวนรายการในใบสั่งซื้อ PO (${originalPOItems.length} รายการ)`);
      }
    }

    return warnings;
  };

  const getPriceMismatchedItems = (data: ScannedBillData | null): PriceMismatchItem[] => {
    if (!data) return [];
    const items: PriceMismatchItem[] = [];
    data.items.forEach((item, idx) => {
      if (item.product_id) {
        const matchedProduct = products.find(p => p.id === Number(item.product_id));
        if (matchedProduct) {
          const dbPrice = matchedProduct.cost_price || 0;
          if (Number(item.price_per_unit) !== dbPrice) {
            items.push({
              index: idx + 1,
              productId: Number(item.product_id),
              productCode: matchedProduct.product_code || '',
              productName: matchedProduct.product_name || '',
              companyProductName: item.company_product_name || '',
              dbPrice,
              billPrice: Number(item.price_per_unit)
            });
          }
        }
      }
    });
    return items;
  };

  const handleSaveBill = async (skipCheck = false, skipPriceCheck = false) => {
    if (!formData) return;

    if (!skipPriceCheck) {
      const mismatches = getPriceMismatchedItems(formData);
      if (mismatches.length > 0) {
        setPriceMismatchedItems(mismatches);
        setOnConfirmPriceUpdateAction(() => async (selectedIds: number[]) => {
          setSaving(true);
          try {
            for (const prodId of selectedIds) {
              const item = mismatches.find(m => m.productId === prodId);
              if (item) {
                await updateProductCostPrice(prodId, item.billPrice);
              }
            }
            await fetchSuppliersAndProducts();
          } catch (err) {
            console.error("Error updating product cost price:", err);
          }
          await handleSaveBill(skipCheck, true);
        });
        setShowPriceUpdateModal(true);
        return;
      }
    }

    if (!skipCheck) {
      const warnings = validateBillBeforeSave();
      if (warnings.length > 0) {
        setValidationWarnings(warnings);
        setOnConfirmAction(() => () => handleSaveBill(true, true));
        setShowValidationModal(true);
        return;
      }
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const formatToRFC3339 = (dateStr?: string | null): string => {
        if (!dateStr || !dateStr.trim()) {
          return new Date().toISOString();
        }
        const trimmed = dateStr.trim();
        if (trimmed.includes('T')) {
          const d = new Date(trimmed);
          return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
        }
        const d = new Date(trimmed + 'T00:00:00Z');
        return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
      };

      const payload = {
        bill: {
          bill_no: formData.bill_no,
          total_amount: formData.total_amount,
          due_date: formatToRFC3339(formData.due_date),
          credit_term: formData.credit_term || '30 Days',
          transport_by: formData.transport_by,
          supplier_id: formData.supplier_id,
          supplier_name: formData.supplier_name || '',
          subtotal: formData.subtotal,
          discount_total: formData.discount_total,
          receive_date: formatToRFC3339(formData.receive_date),
          vat_amount: formData.vat_amount,
          grand_total: formData.grand_total,
          payment_status: formData.payment_status,
          po_id: poReference ? Number(poReference) : undefined,
          bill_image_id: formData.bill_image_id || undefined,
          verified_by: 1
        },
        items: formData.items.map((item, idx) => ({
          item_sequence: idx + 1,
          company_product_code: item.company_product_code,
          company_product_name: item.company_product_name,
          order_quantity: item.order_quantity,
          unit: item.unit,
          conversion_factor: item.conversion_factor,
          price_per_unit: item.price_per_unit,
          discount_amount: item.discount_amount,
          net_amount: item.net_amount,
          is_freebie: item.is_freebie,
          remark: item.remark,
          product_id: item.product_id ? Number(item.product_id) : 0,
          category_id: item.category_id ? Number(item.category_id) : undefined,
          sub_category_id: item.sub_category_id ? Number(item.sub_category_id) : undefined
        })),
        draft_json: JSON.stringify(formData)
      };

      if (editingBillId) {
        await updateBill(editingBillId, payload);
      } else {
        await confirmBillImport(formData.db_job_id || 0, payload);
      }

      await fetchBills();
      setCurrentView('home');
      setFormData(null);
      setEditingBillId(null);
      setPreviewUrl(null);
    } catch (err: any) {
      console.error('Error saving bill:', err);
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการบันทึกบิลเข้าสู่ระบบ');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAllBatchBills = async (skipCheck = false, skipPriceCheck = false) => {
    if (batchResults.length === 0) return;

    if (!skipPriceCheck) {
      const allMismatches: PriceMismatchItem[] = [];
      batchResults.forEach(bill => {
        const mismatches = getPriceMismatchedItems(bill);
        mismatches.forEach(m => {
          if (!allMismatches.some(am => am.productId === m.productId)) {
            allMismatches.push(m);
          }
        });
      });

      if (allMismatches.length > 0) {
        setPriceMismatchedItems(allMismatches);
        setOnConfirmPriceUpdateAction(() => async (selectedIds: number[]) => {
          setSaving(true);
          try {
            for (const prodId of selectedIds) {
              const item = allMismatches.find(m => m.productId === prodId);
              if (item) {
                await updateProductCostPrice(prodId, item.billPrice);
              }
            }
            await fetchSuppliersAndProducts();
          } catch (err) {
            console.error("Error updating product cost price:", err);
          }
          await handleSaveAllBatchBills(skipCheck, true);
        });
        setShowPriceUpdateModal(true);
        return;
      }
    }

    if (!skipCheck) {
      const allWarnings: string[] = [];
      batchResults.forEach((bill, idx) => {
        const unmapped = bill.items.filter(item => !item.product_id);
        if (unmapped.length > 0) {
          allWarnings.push(`⚠️ บิลไฟล์ที่ ${idx + 1} (${bill.filename || bill.bill_no}): มีสินค้า ${unmapped.length} รายการยังไม่ได้เทียบรหัสสินค้า`);
        }
      });

      if (allWarnings.length > 0) {
        setValidationWarnings(allWarnings);
        setOnConfirmAction(() => () => handleSaveAllBatchBills(true, true));
        setShowValidationModal(true);
        return;
      }
    }

    setSaving(true);
    setErrorMsg(null);

    let successCount = 0;
    for (const bill of batchResults) {
      try {
        const formatToRFC3339 = (dateStr?: string | null): string => {
          if (!dateStr || !dateStr.trim()) {
            return new Date().toISOString();
          }
          const trimmed = dateStr.trim();
          if (trimmed.includes('T')) {
            const d = new Date(trimmed);
            return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
          }
          const d = new Date(trimmed + 'T00:00:00Z');
          return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
        };

        const payload = {
          bill: {
            bill_no: bill.bill_no,
            total_amount: bill.total_amount,
            due_date: formatToRFC3339(bill.due_date),
            credit_term: bill.credit_term || '30 Days',
            transport_by: bill.transport_by,
            supplier_id: bill.supplier_id,
            supplier_name: bill.supplier_name || '',
            subtotal: bill.subtotal,
            discount_total: bill.discount_total,
            receive_date: formatToRFC3339(bill.receive_date),
            vat_amount: bill.vat_amount,
            grand_total: bill.grand_total,
            payment_status: bill.payment_status,
            bill_image_id: bill.bill_image_id || undefined,
            verified_by: 1
          },
          items: bill.items.map((item, idx) => ({
            item_sequence: idx + 1,
            company_product_code: item.company_product_code,
            company_product_name: item.company_product_name,
            order_quantity: item.order_quantity,
            unit: item.unit,
            conversion_factor: item.conversion_factor,
            price_per_unit: item.price_per_unit,
            discount_amount: item.discount_amount,
            net_amount: item.net_amount,
            is_freebie: item.is_freebie,
            remark: item.remark,
            product_id: item.product_id ? Number(item.product_id) : 0,
            category_id: item.category_id ? Number(item.category_id) : undefined,
            sub_category_id: item.sub_category_id ? Number(item.sub_category_id) : undefined
          })),
          draft_json: JSON.stringify(bill)
        };

        await confirmBillImport(bill.db_job_id || 0, payload);
        successCount++;
      } catch (err) {
        console.error(`Error saving batch bill ${bill.bill_no}:`, err);
      }
    }

    setSaving(false);
    await fetchBills();
    alert(`บันทึกบิลแบบกลุ่มสำเร็จทั้งหมด ${successCount} จาก ${batchResults.length} รายการ!`);
    setCurrentView('home');
    setFormData(null);
    setBatchResults([]);
    setBatchImages([]);
  };

  const getSupplierName = (supplierId: number) => {
    const s = suppliers.find(sup => sup.id === supplierId);
    return s ? s.supplier_name : `ซัพพลายเออร์ ID: ${supplierId}`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      {currentView === 'home' && (
        <HomeView
          setCurrentView={setCurrentView}
          setBillImage={setBillImage}
          setBatchImages={setBatchImages}
          setBatchResults={setBatchResults}
          setPreviewUrl={setPreviewUrl}
          setFormData={setFormData}
          setEditingBillId={setEditingBillId}
          setErrorMsg={setErrorMsg}
          setBatchErrorMsg={setBatchErrorMsg}
          suppliers={suppliers}
          bills={bills}
          loadingBills={loadingBills}
          getSupplierName={getSupplierName}
          formatDate={formatDate}
          handleViewSavedBill={handleViewSavedBill}
          handleDeleteBill={handleDeleteBill}
          fetchPOsList={fetchPOsList}
        />
      )}

      {currentView === 'scan' && (
        <ScanView
          setCurrentView={setCurrentView}
          formData={formData}
          previewUrl={previewUrl}
          errorMsg={errorMsg}
          leftWidth={leftWidth}
          setZoom={setZoom}
          setRotate={setRotate}
          zoom={zoom}
          rotate={rotate}
          handleFileChange={handleFileChange}
          batchImages={batchImages}
          batchProgress={batchProgress}
          batchResults={batchResults}
          activeBatchIndex={activeBatchIndex}
          handleSelectBatchItem={handleSelectBatchItem}
          handlePrevBatchItem={handlePrevBatchItem}
          handleNextBatchItem={handleNextBatchItem}
          setActiveBatchIndex={setActiveBatchIndex}
          setPreviewUrl={setPreviewUrl}
          handleOcrProcess={handleOcrProcess}
          scanning={scanning}
          isResizing={isResizing}
          setIsResizing={setIsResizing}
          suppliers={suppliers}
          updateFormState={updateFormState}
          poReference={poReference}
          setPoReference={setPoReference}
          poList={poList}
          products={products}
          categories={categories}
          handleItemChange={handleItemChange}
          handleRemoveRow={handleRemoveRow}
          handleAddRow={handleAddRow}
          exportBillItemsToExcel={exportBillItemsToExcel}
          handleSaveBill={handleSaveBill}
          handleSaveAllBatchBills={handleSaveAllBatchBills}
          handleMergeBatchResultsToSingleBill={handleMergeBatchResultsToSingleBill}
          saving={saving}
        />
      )}

      {currentView === 'manual' && (
        <ManualEntryView
          setCurrentView={setCurrentView}
          formData={formData}
          errorMsg={errorMsg}
          suppliers={suppliers}
          updateFormState={updateFormState}
          poReference={poReference}
          setPoReference={setPoReference}
          poList={poList}
          products={products}
          categories={categories}
          handleItemChange={handleItemChange}
          handleRemoveRow={handleRemoveRow}
          handleAddRow={handleAddRow}
          exportBillItemsToExcel={exportBillItemsToExcel}
          handleSaveBill={handleSaveBill}
          saving={saving}
        />
      )}

      {currentView === 'excel' && (
        <ExcelView
          setCurrentView={setCurrentView}
          processExcelFile={processExcelFile}
        />
      )}

      {currentView === 'po' && (
        <POView
          setCurrentView={setCurrentView}
          poSearchQuery={poSearchQuery}
          setPoSearchQuery={setPoSearchQuery}
          loadingPOs={loadingPOs}
          poList={poList}
          formatDate={formatDate}
          handleSelectPO={handleSelectPO}
        />
      )}

      {/* Validation Warning Modal */}
      <ValidationModal
        showValidationModal={showValidationModal}
        setShowValidationModal={setShowValidationModal}
        validationWarnings={validationWarnings}
        setValidationWarnings={setValidationWarnings}
        onConfirmAction={onConfirmAction}
        setOnConfirmAction={setOnConfirmAction}
      />

      {/* Price Update Confirmation Modal */}
      <PriceUpdateModal
        isOpen={showPriceUpdateModal}
        onClose={() => {
          setShowPriceUpdateModal(false);
          setOnConfirmPriceUpdateAction(null);
        }}
        mismatchedItems={priceMismatchedItems}
        onConfirm={(selectedIds) => {
          if (onConfirmPriceUpdateAction) {
            onConfirmPriceUpdateAction(selectedIds);
          }
        }}
      />
    </>
  );
}
