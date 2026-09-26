import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import apiClient from '../../../service/http/apiClient';
import * as XLSX from 'xlsx';
import heic2any from 'heic2any';
import { useMobileUploadSession } from '../../../hooks/useMobileUploadSession';

import {
  scanBill,
  confirmBillImport,
  updateBill,
  deleteBill,
  approveBill,
  getPurchaseOrders,
  getPurchaseOrderById,
  updateProductCostPrice,
  resolveImageUrl
} from '../../../service/http/import/import_service';

import type { 
  ViewState, 
  Supplier, 
  Product, 
  BillItemDTO, 
  ScannedBillData, 
  SavedBill,
  ExcelImportPreview,
  ColumnMapping
} from '../../../interface/import';

import HomeView from './views/home_view';
import ScanView from './views/scan_view';
import ExcelView from './views/excel_view';
import MappingView from './views/mapping_view';
import POView from './views/po_view';
import ManualEntryView from './views/manual_entry_view';
import ApproveView from './views/approve_view';
import ValidationModal from './components/validation_modal';
import PriceUpdateModal from './components/price_update_modal';
import type { PriceMismatchItem } from './components/price_update_modal';
import { guessColumnMapping, normalizeDateValue, REQUIRED_MAPPING_FIELDS } from '../../../utils/excelImport';
import { ToastProvider, useToast } from '../../../components/elements/toast';
import ConfirmDialog from '../../../components/elements/confirm_dialog';

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

interface ImportBillProps {
  isEmployee?: boolean;
}

interface ImportBillSavedSession {
  formData: ScannedBillData | null;
  editingBillId: number | null;
  poReference: string;
  // Keep empty slots aligned with files when a scan fails.
  batchResults: (ScannedBillData | null)[];
  isMergedBatch?: boolean;
  activeBatchIndex: number;
  excelPreview: ExcelImportPreview | null;
  excelMapping: ColumnMapping | null;
  excelBillMeta: { bill_no: string; supplier_name: string; due_date: string; receive_date: string } | null;
  originalPOItems: any[];
  savedAt: string;
}

interface ImportBillSavedFiles {
  billImage: File | null;
  batchImages: File[];
  activeBatchIndex: number;
}

const IMPORT_BILL_FILES_DB = 'autoparts-import-bill-files';
const IMPORT_BILL_FILES_STORE = 'sessions';

const openImportBillFilesDb = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(IMPORT_BILL_FILES_DB, 1);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(IMPORT_BILL_FILES_STORE)) {
      db.createObjectStore(IMPORT_BILL_FILES_STORE);
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const loadImportBillFiles = async (key: string): Promise<ImportBillSavedFiles | null> => {
  const db = await openImportBillFilesDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(IMPORT_BILL_FILES_STORE, 'readonly')
        .objectStore(IMPORT_BILL_FILES_STORE)
        .get(key);
      request.onsuccess = () => resolve((request.result as ImportBillSavedFiles | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
};

const saveImportBillFiles = async (key: string, files: ImportBillSavedFiles): Promise<void> => {
  const db = await openImportBillFilesDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(IMPORT_BILL_FILES_STORE, 'readwrite');
      transaction.objectStore(IMPORT_BILL_FILES_STORE).put(files, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
};

const clearImportBillFiles = async (key: string): Promise<void> => {
  const db = await openImportBillFilesDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(IMPORT_BILL_FILES_STORE, 'readwrite');
      transaction.objectStore(IMPORT_BILL_FILES_STORE).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
};

const getImportBillSessionKey = (isEmployee: boolean): string => {
  let userKey = 'current-user';
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    userKey = String(user.id || user.username || userKey);
  } catch {
    // ใช้ fallback key เมื่อข้อมูลผู้ใช้ใน localStorage ไม่สมบูรณ์
  }
  return `import-bill-session:${isEmployee ? 'employee' : 'owner'}:${userKey}`;
};

const loadImportBillSession = (key: string): ImportBillSavedSession | null => {
  try {
    const saved = sessionStorage.getItem(key);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as ImportBillSavedSession;
    return {
      ...parsed,
      batchResults: Array.isArray(parsed.batchResults) ? parsed.batchResults.map(bill => bill || null) : [],
      originalPOItems: Array.isArray(parsed.originalPOItems) ? parsed.originalPOItems : [],
    };
  } catch (error) {
    console.error('Failed to restore import bill session:', error);
    sessionStorage.removeItem(key);
    return null;
  }
};

function ImportBillContent({ isEmployee = false }: ImportBillProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const basePath = isEmployee ? '/employee/import' : '/owner/import-bills';
  const importSessionKey = getImportBillSessionKey(isEmployee);
  const [restoredSession] = useState<ImportBillSavedSession | null>(() => loadImportBillSession(importSessionKey));
  const [deleteBillTargetId, setDeleteBillTargetId] = useState<number | null>(null);
  const [isDeletingBill, setIsDeletingBill] = useState(false);
  const [removeRowIndex, setRemoveRowIndex] = useState<number | null>(null);

  const clearSavedImportSession = useCallback(() => {
    try {
      sessionStorage.removeItem(importSessionKey);
    } catch (error) {
      console.error('Failed to clear import bill session:', error);
    }
    void clearImportBillFiles(importSessionKey).catch((error) => {
      console.error('Failed to clear saved import bill image:', error);
    });
  }, [importSessionKey]);

  const getViewFromPath = (path: string): ViewState => {
    if (/\/approve\/\d+$/.test(path)) return 'approve';
    if (path.endsWith('/scan')) return 'scan';
    if (path.endsWith('/excel')) return 'excel';
    if (path.endsWith('/mapping')) return 'mapping';
    if (path.endsWith('/manual')) return 'manual';
    if (path.endsWith('/po')) return 'po';
    return 'home';
  };

  const [currentView, setCurrentViewInternal] = useState<ViewState>(() => getViewFromPath(location.pathname));

  useEffect(() => {
    const v = getViewFromPath(location.pathname);
    setCurrentViewInternal(v);
  }, [location.pathname]);

  const setCurrentView = (view: ViewState) => {
    if (view === 'home') setIsMergedBatch(false);
    if (view === 'home') clearSavedImportSession();
    setCurrentViewInternal(view);
    let targetPath = basePath;
    if (view === 'scan') targetPath = `${basePath}/scan`;
    else if (view === 'excel') targetPath = `${basePath}/excel`;
    else if (view === 'mapping') targetPath = `${basePath}/mapping`;
    else if (view === 'manual') targetPath = `${basePath}/manual`;
    else if (view === 'po') targetPath = `${basePath}/po`;
    
    if (location.pathname !== targetPath) {
      navigate(targetPath);
    }
  };
  const [editingBillId, setEditingBillId] = useState<number | null>(() => restoredSession?.editingBillId ?? null);
  const [approvingBill, setApprovingBill] = useState<SavedBill | null>(null);
  const [bills, setBills] = useState<SavedBill[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  
  // Validation & Warning States
  const [originalPOItems, setOriginalPOItems] = useState<any[]>(() => restoredSession?.originalPOItems ?? []);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [showValidationModal, setShowValidationModal] = useState<boolean>(false);
  const [onConfirmAction, setOnConfirmAction] = useState<(() => void) | null>(null);

  // Price Mismatch States
  const [priceMismatchedItems, setPriceMismatchedItems] = useState<PriceMismatchItem[]>([]);
  const [, setPendingNewProducts] = useState<any[]>([]); // เก็บไว้ใช้ในอนาคต (ตอนนี้ set แล้วยังไม่มี UI แสดงผล)
  const [showPriceUpdateModal, setShowPriceUpdateModal] = useState<boolean>(false);
  const [onConfirmPriceUpdateAction, setOnConfirmPriceUpdateAction] = useState<((selectedIds: number[]) => void) | null>(null);

  // Loading and Error States
  const [loadingBills, setLoadingBills] = useState(false);
  const [loadingSuppliersProducts, setLoadingSuppliersProducts] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Excel Import States
  const [excelPreview, setExcelPreview] = useState<ExcelImportPreview | null>(() => restoredSession?.excelPreview ?? null);
  const [excelMapping, setExcelMapping] = useState<ColumnMapping | null>(() => restoredSession?.excelMapping ?? null);
  const [excelBillMeta, setExcelBillMeta] = useState<{ bill_no: string; supplier_name: string; due_date: string; receive_date: string } | null>(() => restoredSession?.excelBillMeta ?? null);

  // Batch Mode States
  const [batchImages, setBatchImages] = useState<File[]>([]);
  const [batchPreviewUrls, setBatchPreviewUrls] = useState<string[]>([]);
  const [batchResults, setBatchResults] = useState<(ScannedBillData | null)[]>(() => restoredSession?.batchResults ?? []);
  const [isMergedBatch, setIsMergedBatch] = useState(() => restoredSession?.isMergedBatch ?? false);
  const batchSaveInProgress = useRef(false);
  const [activeBatchIndex, setActiveBatchIndex] = useState<number>(() => restoredSession?.activeBatchIndex ?? 0);
  const [batchProgress, setBatchProgress] = useState<{ [key: string]: 'pending' | 'scanning' | 'success' | 'failed' }>({});
  const [batchErrorMsg, setBatchErrorMsg] = useState<string | null>(null);

  // Synchronized Refs for Batch State Isolation
  const activeBatchIndexRef = useRef<number>(0);
  const batchResultsRef = useRef<(ScannedBillData | null)[]>([]);
  const formDataRef = useRef<ScannedBillData | null>(null);

  // Mobile Upload Session — สุ่มและจดทะเบียนโดย backend (ดู useMobileUploadSession)
  const { sessionId: mobileSessionId } = useMobileUploadSession();
  const loadedMobileUrlsRef = useRef<Set<string>>(new Set());
  const batchImagesRef = useRef<File[]>([]);
  const batchPreviewUrlsRef = useRef<string[]>([]);

  // Split Pane Resizing State
  const [leftWidth, setLeftWidth] = useState<number>(45);
  const [isResizing, setIsResizing] = useState<boolean>(false);

  // Scan View Form & Image Preview
  const [billImage, setBillImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileSessionReady, setFileSessionReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotate, setRotate] = useState(0);

  const [formData, setFormData] = useState<ScannedBillData | null>(() => restoredSession?.formData ?? null);

  useEffect(() => { activeBatchIndexRef.current = activeBatchIndex; }, [activeBatchIndex]);
  useEffect(() => { batchResultsRef.current = batchResults; }, [batchResults]);
  useEffect(() => { formDataRef.current = formData; }, [formData]);
  useEffect(() => { batchImagesRef.current = batchImages; }, [batchImages]);
  useEffect(() => { batchPreviewUrlsRef.current = batchPreviewUrls; }, [batchPreviewUrls]);

  // PO Import Mode States
  const [poList, setPoList] = useState<any[]>([]);
  const [loadingPOs, setLoadingPOs] = useState(false);
  const [poSearchQuery, setPoSearchQuery] = useState('');
  const [poReference, setPoReference] = useState(() => restoredSession?.poReference ?? '');

  // ข้อมูลฟอร์มเก็บใน sessionStorage ส่วนไฟล์รูปเก็บแยกใน IndexedDB
  useEffect(() => {
    if (!fileSessionReady) return;

    if (currentView === 'home') {
      clearSavedImportSession();
      return;
    }

    const completedBatchResults = batchResults.filter(Boolean);
    const hasRecoverableData = Boolean(
      formData || completedBatchResults.length > 0 || excelPreview || billImage || batchImages.length > 0
    );
    if (!hasRecoverableData) {
      clearSavedImportSession();
      return;
    }

    const session: ImportBillSavedSession = {
      formData,
      editingBillId,
      poReference,
      batchResults,
      isMergedBatch,
      activeBatchIndex,
      excelPreview,
      excelMapping,
      excelBillMeta,
      originalPOItems,
      savedAt: new Date().toISOString(),
    };

    try {
      sessionStorage.setItem(importSessionKey, JSON.stringify(session));
    } catch (error) {
      console.error('Failed to save import bill session:', error);
    }
  }, [
    currentView,
    formData,
    editingBillId,
    poReference,
    batchResults,
    isMergedBatch,
    activeBatchIndex,
    excelPreview,
    excelMapping,
    excelBillMeta,
    originalPOItems,
    billImage,
    batchImages,
    fileSessionReady,
    importSessionKey,
    clearSavedImportSession,
  ]);

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

  // เปิด approve view คืนหลังจากกลับจาก edit-stock-bill
  useEffect(() => {
    const targetBillId = location.state?.openApproveForBill;
    if (!targetBillId) return;
    // clear state เพื่อไม่ให้ loop
    window.history.replaceState({}, '');
    const open = async () => {
      let billList = bills;
      if (billList.length === 0) {
        const resp = await apiClient.get('/import-data/bills');
        billList = resp.data?.data || resp.data || [];
        setBills(billList);
      }
      const found = billList.find((b: SavedBill) => b.id === targetBillId);
      if (found) {
        setApprovingBill(found);
        setCurrentViewInternal('approve');
        navigate(`${basePath}/approve/${found.id}`, { replace: true });
      }
    };
    open();
  }, [location.state]);

  // คืนหน้าตรวจอนุมัติบิลจาก URL หลังรีเฟรช เมื่อรายการบิลโหลดเสร็จแล้ว
  useEffect(() => {
    const match = location.pathname.match(/\/approve\/(\d+)$/);
    if (!match) return;

    const billId = Number(match[1]);
    const found = bills.find((bill) => bill.id === billId);
    if (found) {
      setApprovingBill(found);
      setCurrentViewInternal('approve');
    }
  }, [location.pathname, bills]);

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
      const [suppResp, prodResp, catResp, subSubCatResp] = await Promise.all([
        apiClient.get('/wms/suppliers'),
        apiClient.get('/wms/products'),
        apiClient.get('/wms/categories'),
        apiClient.get('/wms/sub-sub-categories')
      ]);

      const suppData = suppResp.data?.data || suppResp.data || [];
      const prodData = prodResp.data?.data || prodResp.data || [];
      const catData = catResp.data?.data || catResp.data || [];
      const subSubCatData = subSubCatResp.data?.data || subSubCatResp.data || [];
      const categoriesWithThreeLevels = Array.isArray(catData)
        ? catData.map((category: any) => ({
            ...category,
            sub_categories: (category.sub_categories || []).map((subCategory: any) => {
              const subCategoryId = subCategory.id ?? subCategory.ID;
              return {
                ...subCategory,
                sub_sub_categories: Array.isArray(subSubCatData)
                  ? subSubCatData.filter((subSubCategory: any) =>
                      Number(subSubCategory.sub_category_id) === Number(subCategoryId)
                    )
                  : [],
              };
            }),
          }))
        : [];

      setSuppliers(Array.isArray(suppData) ? suppData : []);
      setProducts(Array.isArray(prodData) ? prodData : []);
      setCategories(categoriesWithThreeLevels);
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

  const isHeicFile = (file: File) =>
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif') ||
    file.type === 'image/heic' ||
    file.type === 'image/heif';

  const HEIC_NO_PREVIEW = 'heic-no-preview';

  const toPreviewUrl = async (file: File): Promise<string> => {
    if (isHeicFile(file)) {
      try {
        const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
        const blob = Array.isArray(converted) ? converted[0] : converted;
        return URL.createObjectURL(blob);
      } catch {
        return HEIC_NO_PREVIEW;
      }
    }
    return URL.createObjectURL(file);
  };

  // คืนไฟล์รูปจาก IndexedDB หลัง Refresh และสร้าง Blob URL ใหม่สำหรับแสดงตัวอย่าง
  useEffect(() => {
    let cancelled = false;

    const restoreSavedFiles = async () => {
      if (!restoredSession || currentView === 'home') {
        if (!cancelled) setFileSessionReady(true);
        return;
      }

      try {
        const savedFiles = await loadImportBillFiles(importSessionKey);
        if (!savedFiles) return;

        const restoredBatchImages = Array.isArray(savedFiles.batchImages)
          ? savedFiles.batchImages.filter((file): file is File => file instanceof Blob)
          : [];

        if (restoredBatchImages.length > 0) {
          const urls = await Promise.all(restoredBatchImages.map(toPreviewUrl));
          if (cancelled) {
            urls.forEach((url) => {
              if (url.startsWith('blob:')) URL.revokeObjectURL(url);
            });
            return;
          }

          const restoredIndex = Math.min(
            Math.max(savedFiles.activeBatchIndex || 0, 0),
            restoredBatchImages.length - 1
          );
          setBatchImages(restoredBatchImages);
          setBatchPreviewUrls(urls);
          setActiveBatchIndex(restoredIndex);
          setBillImage(restoredBatchImages[restoredIndex]);
          setPreviewUrl(urls[restoredIndex]);
          return;
        }

        if (savedFiles.billImage instanceof Blob) {
          const url = await toPreviewUrl(savedFiles.billImage);
          if (cancelled) {
            if (url.startsWith('blob:')) URL.revokeObjectURL(url);
            return;
          }
          setBillImage(savedFiles.billImage);
          setPreviewUrl(url);
        }
      } catch (error) {
        console.error('Failed to restore saved import bill image:', error);
      } finally {
        if (!cancelled) setFileSessionReady(true);
      }
    };

    void restoreSavedFiles();
    return () => {
      cancelled = true;
    };
  }, [importSessionKey]);

  // IndexedDB รองรับ File/Blob โดยตรง จึงคงรูปเดิมได้แม้หน้าเว็บถูก Refresh
  useEffect(() => {
    if (!fileSessionReady || currentView === 'home') return;

    if (!billImage && batchImages.length === 0) {
      void clearImportBillFiles(importSessionKey).catch((error) => {
        console.error('Failed to clear saved import bill image:', error);
      });
      return;
    }

    void saveImportBillFiles(importSessionKey, {
      billImage,
      batchImages,
      activeBatchIndex,
    }).catch((error) => {
      console.error('Failed to save import bill image:', error);
    });
  }, [fileSessionReady, currentView, importSessionKey, billImage, batchImages, activeBatchIndex]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (scanning || saving) return;
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setErrorMsg(null);
    setBatchErrorMsg(null);
    setIsMergedBatch(false);

    if (files.length === 1) {
      const singleFile = files[0];
      const singleUrl = await toPreviewUrl(singleFile);
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
      const urls = await Promise.all(fileList.map(toPreviewUrl));
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

  const handleLoadMobileFiles = useCallback(async (allUrls: string[]) => {
    const newUrls = allUrls.filter(url => !loadedMobileUrlsRef.current.has(url));
    if (newUrls.length === 0) return;

    const newFiles: File[] = await Promise.all(
      newUrls.map(async (url) => {
        const isStandardWebPort = window.location.protocol === 'https:' || window.location.port === '' || window.location.port === '80' || window.location.port === '443';
        const fullUrl = url.startsWith('http')
          ? url
          : isStandardWebPort && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
            ? `${window.location.protocol}//${window.location.hostname}${url.startsWith('/') ? '' : '/'}${url}`
            : `${window.location.protocol}//${window.location.hostname}:8080${url.startsWith('/') ? '' : '/'}${url}`;
        const resp = await fetch(fullUrl);
        const blob = await resp.blob();
        const fileName = `mobile_${url.split('/').pop() || 'image.jpg'}`;
        return new File([blob], fileName, { type: blob.type || 'image/jpeg' });
      })
    );

    newUrls.forEach(url => loadedMobileUrlsRef.current.add(url));

    const combined = [...batchImagesRef.current, ...newFiles];
    const combinedUrls = [...batchPreviewUrlsRef.current, ...await Promise.all(newFiles.map(toPreviewUrl))];

    if (combined.length === 1) {
      setBillImage(combined[0]);
      setPreviewUrl(combinedUrls[0]);
      setBatchImages([]);
      setBatchPreviewUrls([]);
      setActiveBatchIndex(0);
      setBatchProgress({});
    } else {
      setBatchImages(combined);
      setBatchPreviewUrls(combinedUrls);
      setBillImage(combined[0]);
      setPreviewUrl(combinedUrls[0]);
      setActiveBatchIndex(combined.length - newFiles.length);
      const progress: { [key: string]: 'pending' } = {};
      combined.forEach(f => { progress[f.name] = 'pending'; });
      setBatchProgress(progress);
    }
    setFormData(null);
    setBatchResults([]);
    setErrorMsg(null);
    setCurrentView('scan');
  }, []);

  // Poll for mobile-uploaded images when in scan view
  useEffect(() => {
    if (currentView !== 'scan' || isMergedBatch || saving || !mobileSessionId) return;
    const intervalId = setInterval(async () => {
      try {
        const resp = await apiClient.get(`/mobile/images?session=${mobileSessionId}`);
        const urls: string[] = resp.data?.images || [];
        if (urls.length > 0) await handleLoadMobileFiles(urls);
      } catch {
        // ignore polling errors silently
      }
    }, 2000);
    return () => clearInterval(intervalId);
  }, [currentView, mobileSessionId, handleLoadMobileFiles, isMergedBatch, saving]);

  const handleOcrProcess = async () => {
    if (scanning || saving || isMergedBatch) return;
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
          let matchedSubSubCatId: number | null = null;

          if (matchedProdId) {
            const foundProd = products.find(p => p.id === matchedProdId);
            if (foundProd) {
              if (foundProd.category_name) {
                const foundCat = categories.find(c => c.category_name === foundProd.category_name);
                if (foundCat) matchedCatId = foundCat.id ?? foundCat.ID;
              }
              if (foundProd.sub_category_name && matchedCatId) {
                const foundCat = categories.find(c => Number(c.id ?? c.ID) === Number(matchedCatId));
                if (foundCat && foundCat.sub_categories) {
                  const foundSub = foundCat.sub_categories.find((sc: any) => sc.sub_category_name === foundProd.sub_category_name);
                  if (foundSub) {
                    matchedSubCatId = foundSub.id ?? foundSub.ID;
                    if (foundProd.sub_sub_category_name) {
                      const foundSubSub = (foundSub.sub_sub_categories || []).find(
                        (ssc: any) => ssc.sub_sub_category_name === foundProd.sub_sub_category_name
                      );
                      if (foundSubSub) matchedSubSubCatId = foundSubSub.id ?? foundSubSub.ID;
                    }
                  }
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
            sub_category_id: matchedSubCatId,
            sub_sub_category_id: matchedSubSubCatId
          };
        });

      const calcSubtotal = mappedScannedItems.reduce((sum: number, item: { net_amount: number }) => sum + item.net_amount, 0);
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
    // Retry only failed scans, preserving already reviewed/edited results.
    const results = batchImages.map((_, index) => batchResultsRef.current[index] ?? null);
    const progressMap = { ...batchProgress };

    for (let i = 0; i < batchImages.length; i++) {
      const file = batchImages[i];
      if (results[i]) continue;
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
            let matchedSubSubCatId: number | null = null;

            if (matchedProdId) {
              const foundProd = products.find(p => p.id === matchedProdId);
              if (foundProd) {
                if (foundProd.category_name) {
                  const foundCat = categories.find(c => c.category_name === foundProd.category_name);
                  if (foundCat) matchedCatId = foundCat.id ?? foundCat.ID;
                }
                if (foundProd.sub_category_name && matchedCatId) {
                  const foundCat = categories.find(c => Number(c.id ?? c.ID) === Number(matchedCatId));
                  if (foundCat && foundCat.sub_categories) {
                    const foundSub = foundCat.sub_categories.find((sc: any) => sc.sub_category_name === foundProd.sub_category_name);
                    if (foundSub) {
                      matchedSubCatId = foundSub.id ?? foundSub.ID;
                      if (foundProd.sub_sub_category_name) {
                        const foundSubSub = (foundSub.sub_sub_categories || []).find(
                          (ssc: any) => ssc.sub_sub_category_name === foundProd.sub_sub_category_name
                        );
                        if (foundSubSub) matchedSubSubCatId = foundSubSub.id ?? foundSubSub.ID;
                      }
                    }
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
              sub_category_id: matchedSubCatId,
              sub_sub_category_id: matchedSubSubCatId
            };
          });

        const calcSubtotal = mappedScannedItems.reduce((sum: number, item: { net_amount: number }) => sum + item.net_amount, 0);
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
      setBatchResults([...results]);
      batchResultsRef.current = [...results];
      setBatchProgress({ ...progressMap });
    }

    setScanning(false);
  };

  const handleSelectBatchItem = (index: number) => {
    if (index < 0 || scanning || saving) return;

    // A merged bill has one editable form but can still preview every source page.
    if (isMergedBatch) {
      setActiveBatchIndex(index);
      activeBatchIndexRef.current = index;
      if (batchImages[index]) {
        setBillImage(batchImages[index]);
        setPreviewUrl(batchPreviewUrls[index] || URL.createObjectURL(batchImages[index]));
      }
      return;
    }

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
    if (scanning || saving || isMergedBatch || batchResults.length < 2) return;
    if (batchResults.some(bill => !bill) || batchResults.length !== batchImages.length) {
      setErrorMsg('กรุณาสแกนทุกไฟล์ให้สำเร็จก่อนรวมเป็นบิลเดียว');
      return;
    }

    const billsToMerge = batchResults.filter((bill): bill is ScannedBillData => bill !== null);
    const firstBill = billsToMerge[0];
    let combinedItems: BillItemDTO[] = [];
    let totalSubtotal = 0;
    let totalVat = 0;
    let totalGrand = 0;
    let totalDiscount = 0;

    billsToMerge.forEach((bill) => {
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
    formDataRef.current = mergedBill;
    // Save through the single-bill path; keep source images for preview/recovery.
    setBatchResults([]);
    batchResultsRef.current = [];
    setIsMergedBatch(true);
    setActiveBatchIndex(0);
    activeBatchIndexRef.current = 0;
    setBillImage(batchImages[0]);
    setPreviewUrl(batchPreviewUrls[0] || null);
    setErrorMsg(null);
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

    if (field === 'category_id') {
      targetItem.sub_category_id = null;
      targetItem.sub_sub_category_id = null;
    }

    if (field === 'sub_category_id') {
      targetItem.sub_sub_category_id = null;
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

  // ตั้งหมวดหมู่ทั้ง 3 ระดับของรายการในครั้งเดียว (รูปแบบเดียวกับ TreeSelect ของ WMS)
  const handleItemCategoryChange = (
    index: number,
    categoryId: number | null,
    subCategoryId: number | null,
    subSubCategoryId: number | null
  ) => {
    if (!formData) return;
    const updatedItems = [...formData.items];
    updatedItems[index] = {
      ...updatedItems[index],
      category_id: categoryId,
      sub_category_id: subCategoryId,
      sub_sub_category_id: subSubCategoryId
    };

    const updatedForm = { ...formData, items: updatedItems };
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
      sub_sub_category_id: null,
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
    setRemoveRowIndex(idx);
  };

  const handleConfirmRemoveRow = () => {
    if (!formData || removeRowIndex === null) return;
    const idx = removeRowIndex;
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
    setRemoveRowIndex(null);
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

  const handleDeleteBill = (id: number) => {
    setDeleteBillTargetId(id);
  };

  const handleConfirmDeleteBill = async () => {
    if (deleteBillTargetId === null) return;
    setIsDeletingBill(true);
    try {
      await deleteBill(deleteBillTargetId);
      await fetchBills();
      setDeleteBillTargetId(null);
    } catch (err: any) {
      console.error('Error deleting bill:', err);
      alert('ล้มเหลวในการลบบิล: ' + (err.message || err));
    } finally {
      setIsDeletingBill(false);
    }
  };

  const handleOpenApprove = (bill: SavedBill) => {
    setApprovingBill(bill);
    setCurrentViewInternal('approve');
    navigate(`${basePath}/approve/${bill.id}`);
  };

  const handleApproveBill = async (billId: number) => {
    const bill = approvingBill;
    if (!bill) return;
    // approveBill sets is_verified=true; backend UpdateBill auto-updates cost_price for all items
    await approveBill(billId, bill);
    toast({
      variant: 'success',
      title: 'อนุมัติบิลสำเร็จ',
      message: `บิล ${bill.bill_no || ''} ถูกอนุมัติเรียบร้อยแล้ว`,
    });
    await fetchBills();
    setApprovingBill(null);
    setCurrentView('home');
  };

  const handleRejectBill = async (billId: number) => {
    try {
      await updateBill(billId, {
        bill: {
          bill_no: approvingBill!.bill_no,
          total_amount: approvingBill!.total_amount,
          due_date: approvingBill!.due_date,
          credit_term: approvingBill!.credit_term,
          transport_by: approvingBill!.transport_by,
          supplier_id: approvingBill!.supplier_id,
          subtotal: approvingBill!.subtotal,
          discount_total: approvingBill!.discount_total,
          receive_date: approvingBill!.receive_date,
          vat_amount: approvingBill!.vat_amount,
          grand_total: approvingBill!.grand_total,
          payment_status: 'Draft',
          is_verified: false,
          bill_image_id: approvingBill!.bill_image?.id,
        },
        items: (approvingBill!.bill_items || []).map(item => ({
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
          product_id: item.product_id,
        po_item_id: item.po_item_id,
        pre_order_item_id: item.pre_order_item_id,
          category_id: item.category_id,
          sub_category_id: item.sub_category_id,
          sub_sub_category_id: item.sub_sub_category_id,
        })),
      });
      await fetchBills();
      setApprovingBill(null);
      setCurrentView('home');
    } catch (err: any) {
      alert('ส่งกลับไม่สำเร็จ: ' + (err.message || err));
    }
  };

  const handleViewSavedBill = (bill: SavedBill) => {
    setEditingBillId(bill.id);
    setPoReference(bill.po_id ? String(bill.po_id) : '');
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
        product_id: item.product_id,
        po_item_id: item.po_item_id,
        pre_order_item_id: item.pre_order_item_id,
        category_id: item.category_id,
        sub_category_id: item.sub_category_id,
        sub_sub_category_id: item.sub_sub_category_id
      })),
      db_job_id: 0,
      bill_image_id: bill.bill_image?.id || 0
    });

    const rawImgUrl = bill.bill_image?.image_url || bill.evidence_file_url;
    if (rawImgUrl) {
      setPreviewUrl(resolveImageUrl(rawImgUrl));
    } else {
      setPreviewUrl(null);
    }

    setCurrentView('scan');
  };

  const processExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        let workbook: XLSX.WorkBook;

        const isCsvOrTxt = file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.txt');
        if (isCsvOrTxt) {
          let text = '';
          try {
            // Try decoding as strict UTF-8 first
            const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
            text = utf8Decoder.decode(buffer);
          } catch (e) {
            // Fallback to Thai Windows-874 / TIS-620 for Thai CSV files exported from Windows / Excel
            const thaiDecoder = new TextDecoder('windows-874');
            text = thaiDecoder.decode(buffer);
          }
          workbook = XLSX.read(text, { type: 'string' });
        } else {
          // Binary Excel files (.xlsx, .xls) — cellDates so date cells arrive as Date objects
          const data = new Uint8Array(buffer);
          workbook = XLSX.read(data, { type: 'array', cellDates: true });
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const allRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', blankrows: false });

        // ตรวจหา header row จริง — รองรับไฟล์ที่มีข้อมูลบริษัทอยู่บนสุด
        let headerRowIdx = -1;
        let maxMatchCount = 0;

        for (let i = 0; i < Math.min(allRows.length, 30); i++) {
          const row = allRows[i];
          if (!Array.isArray(row) || row.length < 2) continue;

          let matchCount = 0;
          row.forEach((cell: any) => {
            const text = String(cell ?? '').trim().toLowerCase();
            if (!text) return;

            const explicitTerms = [
              'รหัสสินค้า', 'รหัสอะไหล่', 'ชื่อสินค้า', 'ชื่ออะไหล่', 'จำนวน', 'หน่วย', 'ราคาต่อหน่วย', 'ราคา', 'ส่วนลด', 'คำอธิบาย', 'รายการ',
              'part number', 'part_number', 'item description', 'item_description', 'quantity ordered', 'unit cost', 'uom', 'sku', 'product_code', 'unit_price', 'part_no'
            ];
            const singleTerms = ['code', 'qty', 'quantity', 'price', 'unit', 'amount', 'uom', 'sku', 'part', 'item', 'description', 'รหัส', 'จำนวน', 'หน่วย', 'ราคา'];

            if (explicitTerms.some(term => text.includes(term))) {
              matchCount += 2;
            } else if (singleTerms.some(term => text === term || text.includes(term))) {
              if (text.includes('ชื่อบริษัท') || text.includes('ชื่อย่อ') || text.includes('เลขที่') || text.includes('วันที่') || text.includes('เบอร์โทร') || text.includes('อีเมล') || text.includes('ที่อยู่')) {
                // Ignore metadata label matches
              } else {
                matchCount += 1;
              }
            }
          });

          if (matchCount >= 2 && matchCount > maxMatchCount) {
            maxMatchCount = matchCount;
            headerRowIdx = i;
          }
        }

        // ดึงข้อมูลบริษัท เลขที่บิล วันที่ จากส่วนหัวของไฟล์ (ถ้ามี)
        let extractedBillNo = '';
        let extractedSupplierName = '';
        let extractedDueDate = '';
        let extractedReceiveDate = '';

        const scanHeaderLimit = headerRowIdx > 0 ? headerRowIdx : Math.min(allRows.length, 15);
        for (let r = 0; r < scanHeaderLimit; r++) {
          const row = allRows[r];
          if (!row || row.length < 2) continue;
          const label = String(row[0] || '').trim().toLowerCase();
          const val = String(row[1] || row[2] || '').trim();
          if (!val) continue;

          if (label.includes('เลขที่บิล') || label.includes('bill no') || label.includes('invoice no')) {
            extractedBillNo = val;
          } else if (label.includes('ชื่อบริษัท') || label.includes('company name') || label.includes('ผู้จัดจำหน่าย') || label.includes('supplier')) {
            extractedSupplierName = val;
          } else if (label.includes('ครบกำหนด') || label.includes('due date')) {
            extractedDueDate = normalizeDateValue(row[1] || row[2]);
          } else if (
            // ซัพพลายเออร์แต่ละเจ้าเรียกวันที่บิลไม่เหมือนกัน และคำไทยไม่มีคำว่า "date" อยู่ในนั้น
            // การเช็คแค่ 'วันที่รับ' กับ 'date' ทำให้ไฟล์ที่ใช้ 'วันที่บิล' ดึงวันที่ไม่ได้เลย
            // เช็ค 'ครบกำหนด' ไปก่อนหน้านี้แล้ว จึงเหลือเฉพาะวันที่ของตัวบิลตรงนี้
            label.includes('วันที่') || label.includes('ลงวันที่') || label.includes('date')
          ) {
            extractedReceiveDate = normalizeDateValue(row[1] || row[2]);
          }
        }

        // ถ้าหา header row ไม่เจอเลย → สร้างชื่อคอลัมน์สังเคราะห์ และให้ทุกแถวเป็นข้อมูล (ระบบจะเดาจากเนื้อหา cell แทน)
        const hasHeaderRow = headerRowIdx >= 0;
        const maxCols = allRows.reduce((max: number, r: any[]) => Math.max(max, Array.isArray(r) ? r.length : 0), 0);
        const headers = hasHeaderRow
          ? (allRows[headerRowIdx] || []).map((h: any, idx: number) => {
              const text = String(h ?? '').trim();
              return text || `(คอลัมน์ ${idx + 1})`;
            })
          : Array.from({ length: maxCols }, (_, idx) => `(คอลัมน์ ${idx + 1})`);
        const dataRows = (hasHeaderRow ? allRows.slice(headerRowIdx + 1) : allRows).filter(
          (row: any[]) => Array.isArray(row) && row.some((cell: any) => String(cell ?? '').trim() !== '')
        );

        if (dataRows.length === 0) {
          setErrorMsg('ไม่พบข้อมูลรายการสินค้าในไฟล์ กรุณาตรวจสอบว่าไฟล์มีแถวหัวตารางและข้อมูลรายการสินค้า');
          return;
        }

        const billMeta = {
          bill_no: extractedBillNo,
          supplier_name: extractedSupplierName,
          due_date: extractedDueDate,
          receive_date: extractedReceiveDate,
        };

        // เดาการจับคู่คอลัมน์อัตโนมัติ — ถ้ามั่นใจพอ นำเข้าหน้ากรอกข้อมูลได้เลยโดยไม่ต้องผ่านหน้าจับคู่
        const { mapping: guessedMapping, confidence } = guessColumnMapping(headers, dataRows);
        const allRequiredFound = REQUIRED_MAPPING_FIELDS.every((f) => !!guessedMapping[f]);
        const CONFIDENT_THRESHOLD = 0.55;

        if (allRequiredFound && confidence >= CONFIDENT_THRESHOLD) {
          applyExcelMapping(guessedMapping, billMeta, { headers, rows: dataRows, fileName: file.name });
          return;
        }

        setExcelBillMeta(billMeta);
        setExcelPreview({
          fileName: file.name,
          sheetNames: workbook.SheetNames,
          activeSheet: sheetName,
          headers,
          rows: dataRows,
        });
        setExcelMapping(guessedMapping);
        setErrorMsg(null);
        setCurrentView('mapping');
      } catch (error) {
        console.error(error);
        setErrorMsg('เกิดข้อผิดพลาดในการอ่านไฟล์: ' + String(error));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // นำผลลัพธ์การจับคู่คอลัมน์มาสร้างรายการบิล พร้อมตรวจสอบแถวที่ข้อมูลไม่ครบ
  // overrides ใช้กรณีเรียกจาก processExcelFile (state ยังไม่ทัน update)
  const applyExcelMapping = (
    mappingOverride?: ColumnMapping,
    billMetaOverride?: { bill_no: string; supplier_name: string; due_date: string; receive_date: string },
    previewOverride?: { headers: string[]; rows: any[][]; fileName: string }
  ) => {
    const activeMapping = mappingOverride || excelMapping;
    const meta = billMetaOverride || excelBillMeta;
    const preview = previewOverride || excelPreview;
    if (!preview || !activeMapping) return;

    try {
      const colIndexOf = (field: keyof ColumnMapping): number => {
        const header = activeMapping[field];
        return header ? preview.headers.indexOf(header) : -1;
      };
      const cellOf = (row: any[], field: keyof ColumnMapping): any => {
        const idx = colIndexOf(field);
        return idx >= 0 ? row[idx] : '';
      };

      const parseNum = (val: any, defaultVal = 0): number => {
        if (val === null || val === undefined || val === '') return defaultVal;
        if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
        const cleaned = String(val).replace(/[^0-9.-]/g, '');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? defaultVal : parsed;
      };

      const mappedItems: BillItemDTO[] = preview.rows.map((row: any[], index: number) => {
        const qty = parseNum(cellOf(row, 'quantity'), 1);
        const price = parseNum(cellOf(row, 'price'), 0);

        return {
          item_sequence: index + 1,
          company_product_code: String(cellOf(row, 'code') || '').trim(),
          company_product_name: String(cellOf(row, 'name') || '').trim(),
          order_quantity: qty,
          unit: String(cellOf(row, 'unit') || 'ชิ้น').trim(),
          conversion_factor: 1,
          price_per_unit: price,
          discount_amount: 0,
          net_amount: qty * price,
          is_freebie: false,
          remark: '',
          product_id: null
        };
      });

      // กรองเฉพาะแถวที่เป็นรายการสินค้าจริง (ตัดแถวส่วนหัว/ส่วนสรุปที่หลุดเข้ามาออก)
      const validMappedItems = mappedItems.filter((item) => {
        const code = item.company_product_code.trim();
        const name = item.company_product_name.trim();
        if (!code && !name) return false;

        const lowerName = name.toLowerCase();
        const lowerCode = code.toLowerCase();
        const metadataKeywords = ['ที่อยู่', 'เบอร์โทร', 'อีเมล', 'เลขที่บิล', 'วันที่', 'เครดิต', 'ผู้จัดจำหน่าย', 'บริษัท', 'รวมเงิน', 'ภาษี', 'ยอดสุทธิ', 'total', 'subtotal', 'vat', 'address', 'phone', 'email', 'invoice'];
        if (metadataKeywords.some(kw => lowerName.startsWith(kw) || lowerCode.startsWith(kw))) {
          return false;
        }
        return true;
      }).map((item, idx) => ({ ...item, item_sequence: idx + 1 }));

      const subtotal = validMappedItems.reduce((sum, item) => sum + item.net_amount, 0);

      let matchedSupplierId = suppliers[0]?.id || 1;
      let supplierName = meta?.supplier_name || suppliers[0]?.supplier_name || '';

      if (meta?.supplier_name) {
        const found = suppliers.find(s => 
          s.supplier_name.toLowerCase().replace(/บริษัท|จำกัด|บจก\.|หจก\./g, '').trim() === 
          String(meta?.supplier_name).toLowerCase().replace(/บริษัท|จำกัด|บจก\.|หจก\./g, '').trim()
        );
        if (found) {
          matchedSupplierId = found.id;
          supplierName = found.supplier_name;
        }
      }

      setFormData({
        bill_no: meta?.bill_no || ('IMPORT-' + Math.floor(1000 + Math.random() * 9000)),
        supplier_id: matchedSupplierId,
        supplier_name: supplierName,
        total_amount: subtotal,
        due_date: meta?.due_date || new Date().toISOString().split('T')[0],
        transport_by: '',
        subtotal: subtotal,
        discount_total: 0,
        receive_date: meta?.receive_date || new Date().toISOString().split('T')[0],
        vat_amount: 0,
        grand_total: subtotal,
        payment_status: 'unpaid',
        items: validMappedItems,
        db_job_id: 0,
        bill_image_id: 0,
        filename: preview.fileName
      });

      setPreviewUrl(null);
      setCurrentView('manual');
      setErrorMsg(null);
    } catch (error) {
      console.error(error);
      setErrorMsg('เกิดข้อผิดพลาดในการประมวลผลไฟล์: ' + String(error));
      setCurrentView('excel');
    }
  };

  const handleSelectPO = async (poId: number) => {
    try {
      const [poData, receiptResponse] = await Promise.all([
        getPurchaseOrderById(poId),
        apiClient.get('/import-data/bills'),
      ]);
      const receipts: SavedBill[] = receiptResponse.data?.data || receiptResponse.data || [];
      const receivedByLine = new Map<number, number>();
      for (const receipt of receipts) {
        if (Number(receipt.po_id) !== poId || receipt.payment_status.toLowerCase() === 'draft') continue;
        for (const item of receipt.bill_items || []) {
          if (item.po_item_id) receivedByLine.set(item.po_item_id, (receivedByLine.get(item.po_item_id) || 0) + item.order_quantity);
        }
      }
      if (!poData) {
        toast({ variant: 'error', message: 'ไม่พบข้อมูลรายละเอียดใบสั่งซื้อ' });
        return;
      }

      const poItems = poData.po_items || poData.purchase_order_items || poData.items || [];
      setOriginalPOItems(poItems);

      const mappedItems: BillItemDTO[] = poItems.map((item: any, idx: number) => {
        const qty = Math.max(0, Number(item.quantity ?? item.order_quantity ?? 0) - (receivedByLine.get(Number(item.id)) || 0));
        const price = Number(item.unit_price ?? item.price_per_unit) || 0;
        return {
          item_sequence: idx + 1,
          company_product_code: item.supply_product_code_snapshot || item.company_product_code || '',
          company_product_name: item.product_name_snapshot || item.product_name || item.company_product_name || '',
          order_quantity: qty,
          unit: item.unit || 'ชิ้น',
          conversion_factor: 1,
          price_per_unit: price,
          discount_amount: 0,
          net_amount: qty * price,
          is_freebie: false,
          remark: '',
          product_id: item.product_id || null,
          pre_order_item_id: item.pre_order_item_id || null,
          po_item_id: item.id
        };
      }).filter((item: BillItemDTO) => item.order_quantity > 0);
      if (mappedItems.length === 0) {
        toast({ variant: 'info', message: 'รับสินค้าครบตามใบสั่งซื้อนี้แล้ว' });
        return;
      }

      const subtotal = mappedItems.reduce((sum, i) => sum + i.net_amount, 0);
      const selectedPO = poList.find(po => Number(po.id) === Number(poId));
      const supplierId = Number(poData.supplier_id || selectedPO?.supplier_id || 0);
      const registeredSupplier = suppliers.find(supplier => Number(supplier.id) === supplierId);
      const supplierName = String(
        poData.supplier_name ||
        poData.supplier?.supplier_name ||
        selectedPO?.supplier_name ||
        registeredSupplier?.supplier_name ||
        ''
      );

      setFormData({
        bill_no: `PO-IMPORT-${poData.po_number || poData.order_number || poId}-${Date.now()}`,
        total_amount: subtotal,
        due_date: new Date().toISOString().split('T')[0],
        transport_by: '',
        supplier_id: supplierId,
        supplier_name: supplierName,
        subtotal: subtotal,
        discount_total: 0,
        receive_date: new Date().toISOString().split('T')[0],
        vat_amount: 0,
        grand_total: subtotal,
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
      toast({ variant: 'error', message: 'เกิดข้อผิดพลาดในการดึงข้อมูล PO: ' + (err.message || err) });
    }
  };

  const exportBillItemsToExcel = () => {
    if (!formData || !formData.items || formData.items.length === 0) return;
    try {
      const supplier = suppliers.find(s => s.id === formData.supplier_id);
      const supplierName = supplier ? supplier.supplier_name : `ซัพพลายเออร์ ID: ${formData.supplier_id}`;
      const fmtDate = (d: string) => d ? formatDate(d) : '-';

      // ── Section 1: Bill header metadata ──────────────────────────────
      const headerRows: (string | number)[][] = [
        ['ใบนำเข้าสินค้า (Import Bill)'],
        [],
        ['เลขที่บิล (Bill No)',              formData.bill_no || '-'],
        [],
        ['── ข้อมูลผู้จัดจำหน่าย ──────────────────────'],
        ['ชื่อบริษัท (Supplier)',            supplierName],
        ['ชื่อย่อ (Short Name)',             supplier?.short_supplier_name || '-'],
        ['ที่อยู่ (Address)',                supplier?.supplier_address || '-'],
        ['เบอร์โทรฝ่ายขาย (Phone Sale)',    supplier?.phone_number_sale || '-'],
        ['Line ฝ่ายขาย (Line Sale)',         supplier?.contact_line_sale || '-'],
        ['อีเมลฝ่ายขาย (Email Sale)',        supplier?.email_sale || '-'],
        [],
        ['── ข้อมูลบิล ────────────────────────────────'],
        ['วันที่รับสินค้า (Receive Date)',   fmtDate(formData.receive_date)],
        ['วันที่ในบิล (Bill Date)',          fmtDate(formData.due_date)],
        ['เครดิต (Credit Term)',              formData.credit_term || '-'],
        ['ขนส่งโดย (Transport By)',          formData.transport_by || '-'],
        ['สถานะ (Payment Status)',            formData.payment_status || '-'],
        [],
      ];

      // ── Section 2: Items table ────────────────────────────────────────
      const itemHeaders = [
        'ลำดับ', 'รหัสสินค้าคู่ค้า', 'ชื่อสินค้าคู่ค้า',
        'รหัสในระบบ', 'ชื่อในระบบ',
        'หมวดหมู่หลัก', 'หมวดหมู่ย่อย', 'หมวดหมู่ย่อยย่อย',
        'จำนวน', 'หน่วย', 'ราคาต่อหน่วย', 'ส่วนลด', 'ยอดสุทธิ', 'สินค้าแถม',
      ];

      const itemRows = formData.items.map((item, idx) => {
        const matchingProd = products.find(p => p.id === Number(item.product_id));
        const matchingCat  = categories.find((c: any) => Number(c.id ?? c.ID) === Number(item.category_id));
        const subCategories = matchingCat?.sub_categories || [];
        const matchingSubCat = subCategories.find((sc: any) => Number(sc.id ?? sc.ID) === Number(item.sub_category_id));
        const subSubCategories = matchingSubCat?.sub_sub_categories || [];
        const matchingSubSubCat = subSubCategories.find(
          (ssc: any) => Number(ssc.id ?? ssc.ID) === Number(item.sub_sub_category_id)
        );
        return [
          item.item_sequence || (idx + 1),
          item.company_product_code || '-',
          item.company_product_name || '-',
          matchingProd ? matchingProd.product_code : '-',
          matchingProd ? matchingProd.product_name : '-',
          matchingCat   ? (matchingCat as any).category_name : '-',
          matchingSubCat ? (matchingSubCat as any).sub_category_name : '-',
          matchingSubSubCat ? (matchingSubSubCat as any).sub_sub_category_name : '-',
          item.order_quantity,
          item.unit,
          item.price_per_unit,
          item.discount_amount || 0,
          item.net_amount,
          item.is_freebie ? 'ใช่' : '-',
        ];
      });

      // ── Section 3: Summary totals ─────────────────────────────────────
      const summaryRows: (string | number)[][] = [
        [],
        ['', '', '', '', '', '', '', '', '', '', 'Subtotal',   formData.subtotal || 0],
        ['', '', '', '', '', '', '', '', '', '', 'ส่วนลดรวม',  formData.discount_total || 0],
        ['', '', '', '', '', '', '', '', '', '', 'VAT',        formData.vat_amount || 0],
        ['', '', '', '', '', '', '', '', '', '', 'ยอดรวมสุทธิ', formData.grand_total || 0],
      ];

      // ── Combine all sections ─────────────────────────────────────────
      const aoa: (string | number)[][] = [
        ...headerRows,
        itemHeaders,
        ...itemRows,
        ...summaryRows,
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(aoa);

      // Column widths
      worksheet['!cols'] = [
        { wch: 8 },  // ลำดับ
        { wch: 22 }, // รหัสคู่ค้า
        { wch: 36 }, // ชื่อคู่ค้า
        { wch: 18 }, // รหัสในระบบ
        { wch: 36 }, // ชื่อในระบบ
        { wch: 20 }, // หมวดหมู่หลัก
        { wch: 20 }, // หมวดหมู่ย่อย
        { wch: 20 }, // หมวดหมู่ย่อยย่อย
        { wch: 10 }, // จำนวน
        { wch: 10 }, // หน่วย
        { wch: 16 }, // ราคาต่อหน่วย
        { wch: 12 }, // ส่วนลด
        { wch: 16 }, // ยอดสุทธิ
        { wch: 12 }, // สินค้าแถม
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'รายการในบิล');
      XLSX.writeFile(workbook, `bill_${formData.bill_no || 'import'}.xlsx`);
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการส่งออกไฟล์ Excel: ' + String(err));
    }
  };

  const validateBillBeforeSave = (): string[] => {
    const warnings: string[] = [];
    if (!formData) return warnings;

    const billNo = String(formData.bill_no || '').trim().toLowerCase();
    if (billNo) {
      const duplicate = bills.find(b =>
        String(b.bill_no || '').trim().toLowerCase() === billNo && b.id !== editingBillId
      );
      if (duplicate) {
        warnings.push(`เลขที่บิล "${formData.bill_no}" มีอยู่ในระบบแล้ว หากยืนยันบันทึกต่อ ข้อมูลบิลเดิม (${duplicate.bill_no}) จะถูกเขียนทับด้วยข้อมูลนี้`);
      }
    }

    let calcSubtotal = 0;
    formData.items.forEach(item => {
      calcSubtotal += Number(item.net_amount) || 0;
    });

    const billSubtotal = Number(formData.subtotal) || Number(formData.total_amount) || 0;
    if (billSubtotal > 0 && Math.abs(calcSubtotal - billSubtotal) > 1.0) {
      warnings.push(`ยอดรวมสินค้าในตาราง (฿${calcSubtotal.toLocaleString()}) ไม่ตรงกับ Subtotal ในบิล (฿${billSubtotal.toLocaleString()}) — ยอด VAT แยกต่างหาก`);
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

  const handleConfirmUpdatePrices = async () => {
    if (priceMismatchedItems.length === 0) return;
    setSaving(true);
    try {
      for (const item of priceMismatchedItems) {
        await updateProductCostPrice(item.productId, item.billPrice);
      }
      await fetchSuppliersAndProducts();
    } catch (err) {
      console.error("Error updating product cost price:", err);
    } finally {
      setSaving(false);
    }
    setPriceMismatchedItems([]);
    await handleSaveBill(false, true);
  };

  const handleSkipPriceUpdate = async () => {
    setPriceMismatchedItems([]);
    await handleSaveBill(false, true);
  };

  const [isDraftMode, setIsDraftMode] = useState<boolean>(false);

  const handleConfirmValidationSave = async () => {
    setValidationWarnings([]);
    const draftState = isDraftMode;
    setIsDraftMode(false);
    if (batchResults.length > 0 && !isMergedBatch) {
      await handleSaveAllBatchBills(draftState, true, true);
    } else {
      await handleSaveBill(draftState, true, true);
    }
  };

  const handleDismissValidation = () => {
    setValidationWarnings([]);
    setIsDraftMode(false);
  };

  const handleSaveBill = async (isDraft = false, skipCheck = false, skipPriceCheck = false) => {
    if (!formData || scanning || saving) return;

    if (!String(formData.bill_no || '').trim()) {
      toast({ variant: 'error', message: 'กรุณากรอกเลขที่บิลก่อนบันทึก' });
      setSaving(false);
      return;
    }

    const zeroQtyCount = formData.items.filter(item => Number(item.order_quantity) <= 0).length;
    if (zeroQtyCount > 0) {
      toast({
        variant: 'error',
        message: `มีรายการสินค้า ${zeroQtyCount} รายการที่จำนวนเป็น 0 กรุณาระบุจำนวนที่รับจริง หรือกดลบรายการนั้นออกก่อนบันทึก`,
      });
      setSaving(false);
      return;
    }

    if (!skipPriceCheck && !isDraft) {
      const mismatches = getPriceMismatchedItems(formData);
      if (mismatches.length > 0) {
        setPriceMismatchedItems(mismatches);
      }
    }

    if (isDraft && !skipCheck) {
      setIsDraftMode(true);
      const warnings = validateBillBeforeSave();
      if (warnings.length > 0) {
        setValidationWarnings(['คุณยืนยันจะบันทึกข้อมูลบิลนี้เป็นแบบร่างใช่หรือไม่?', ...warnings]);
      } else {
        setValidationWarnings(['คุณยืนยันจะบันทึกข้อมูลบิลนี้เป็นแบบร่างใช่หรือไม่?']);
      }
      setSaving(false);
      return;
    }

    if (!skipCheck && !isDraft) {
      setIsDraftMode(false);
      const warnings = validateBillBeforeSave();
      const mismatches = getPriceMismatchedItems(formData);
      const newProds = (formData.items ?? []).filter((item: any) => !item.product_id);

      if (warnings.length > 0 || mismatches.length > 0 || newProds.length > 0) {
        if (newProds.length > 0) setPendingNewProducts(newProds);
        if (mismatches.length > 0) setPriceMismatchedItems(mismatches);
        if (warnings.length > 0) {
          setValidationWarnings(warnings);
        } else if (mismatches.length > 0 || newProds.length > 0) {
          setValidationWarnings(['ตรวจพบข้อมูลที่ต้องการการยืนยันก่อนบันทึก']);
        }
        setSaving(false);
        return;
      }
      // ไม่มีการเปลี่ยนแปลง — clear แล้วบันทึกตรง
      setPendingNewProducts([]);
      setPriceMismatchedItems([]);
      setValidationWarnings([]);
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
          bill_no: String(formData.bill_no || ''),
          total_amount: Number(formData.total_amount || 0),
          due_date: formatToRFC3339(formData.due_date),
          credit_term: String(formData.credit_term || '30 Days'),
          transport_by: String(formData.transport_by || ''),
          supplier_id: Number(formData.supplier_id || 0),
          supplier_name: String(formData.supplier_name || ''),
          subtotal: Number(formData.subtotal || 0),
          discount_total: Number(formData.discount_total || 0),
          receive_date: formatToRFC3339(formData.receive_date),
          vat_amount: Number(formData.vat_amount || 0),
          grand_total: Number(formData.grand_total || 0),
          payment_status: isDraft ? 'Draft' : String(formData.payment_status || 'Completed'),
          po_id: poReference ? Number(poReference) : undefined,
          bill_image_id: formData.bill_image_id ? Number(formData.bill_image_id) : undefined,
          verified_by: 1
        },
        items: formData.items.map((item, idx) => ({
          item_sequence: idx + 1,
          company_product_code: String(item.company_product_code || ''),
          company_product_name: String(item.company_product_name || ''),
          order_quantity: Number(item.order_quantity || 0),
          unit: String(item.unit || 'ชิ้น'),
          conversion_factor: Number(item.conversion_factor || 1),
          price_per_unit: Number(item.price_per_unit || 0),
          discount_amount: Number(item.discount_amount || 0),
          net_amount: Number(item.net_amount || 0),
          is_freebie: Boolean(item.is_freebie),
          remark: String(item.remark || ''),
          product_id: item.product_id ? Number(item.product_id) : 0,
          po_item_id: item.po_item_id || undefined,
          pre_order_item_id: item.pre_order_item_id || undefined,
          category_id: item.category_id ? Number(item.category_id) : undefined,
          sub_category_id: item.sub_category_id ? Number(item.sub_category_id) : undefined,
          sub_sub_category_id: item.sub_sub_category_id ? Number(item.sub_sub_category_id) : undefined
        })),
        draft_json: JSON.stringify(formData)
      };

      if (editingBillId) {
        await updateBill(editingBillId, payload);
      } else {
        await confirmBillImport(formData.db_job_id || 0, payload);
      }

      const pendingOwnerReview = isEmployee && !isDraft && priceMismatchedItems.length > 0;

      toast({
        variant: 'success',
        title: isDraft
          ? 'บันทึกแบบร่างสำเร็จ'
          : editingBillId
            ? 'แก้ไขบิลสำเร็จ'
            : pendingOwnerReview
              ? 'ส่งบิลให้เจ้าของร้านตรวจสอบแล้ว'
              : 'นำเข้าบิลสำเร็จ',
        message: isDraft
          ? `บิล ${formData.bill_no || ''} ถูกบันทึกเป็นแบบร่างแล้ว`
          : editingBillId
            ? `แก้ไขข้อมูลบิล ${formData.bill_no || ''} เรียบร้อยแล้ว`
            : pendingOwnerReview
              ? `บิล ${formData.bill_no || ''} ถูกบันทึกเข้าระบบแล้ว รอเจ้าของร้านตรวจสอบและอนุมัติราคาทุนใหม่ก่อนจึงจะมีผล`
              : `บิล ${formData.bill_no || ''} ถูกบันทึกเข้าระบบเรียบร้อยแล้ว`,
      });
      setPriceMismatchedItems([]);
      // บิลอาจสร้างซัพพลายเออร์ใหม่อัตโนมัติตอน confirm (FindOrCreateSupplierByName ฝั่ง backend)
      // ต้องดึงรายชื่อซัพพลายเออร์ใหม่ด้วย ไม่งั้นตารางจะโชว์ "ซัพพลายเออร์ ID: X" แทนชื่อจริง
      await Promise.all([fetchBills(), fetchSuppliersAndProducts()]);
      setCurrentView('home');
      setFormData(null);
      setEditingBillId(null);
      setPreviewUrl(null);
      setBatchImages([]);
      setBatchPreviewUrls([]);
      setBatchResults([]);
      batchResultsRef.current = [];
    } catch (err: any) {
      console.error('Error saving bill:', err);
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการบันทึกบิลเข้าสู่ระบบ');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAllBatchBills = async (isDraft = false, skipCheck = false, _skipPriceCheck = false) => {
    if (batchSaveInProgress.current || saving || scanning || isMergedBatch) return;
    const readyBills = batchResults.flatMap((bill, index) => bill ? [{ bill, index }] : []);
    if (readyBills.length === 0) {
      setErrorMsg('ยังไม่มีบิลที่สแกนสำเร็จ กรุณาลองสแกนอีกครั้ง');
      return;
    }

    // เช็คก่อนเสมอไม่ว่าจะบันทึกแบบร่างหรือไม่ — backend บังคับเลขที่บิลห้ามว่างและจำนวนต้องมากกว่า 0
    // เสมอ ถ้าปล่อยให้ยิงไปก่อนจะเจอ error ดิบๆ ต่อบิล และบิลอื่นๆ ที่ถูกต้องอยู่แล้วจะถูกข้ามไปด้วยเปล่าประโยชน์
    const blockingIssues: string[] = [];
    readyBills.forEach(({ bill, index: idx }) => {
      const label = bill.filename || bill.bill_no || `ไฟล์ที่ ${idx + 1}`;
      if (!String(bill.bill_no || '').trim()) {
        blockingIssues.push(`บิล "${label}": ยังไม่มีเลขที่บิล`);
      }
      const zeroQtyCount = bill.items.filter(item => Number(item.order_quantity) <= 0).length;
      if (zeroQtyCount > 0) {
        blockingIssues.push(`บิล "${label}": มีสินค้า ${zeroQtyCount} รายการที่จำนวนเป็น 0`);
      }
    });
    if (blockingIssues.length > 0) {
      toast({
        variant: 'error',
        title: 'มีข้อมูลไม่ครบก่อนบันทึก',
        message: blockingIssues.join(' / '),
      });
      setSaving(false);
      return;
    }

    if (isDraft && !skipCheck) {
      setIsDraftMode(true);
      setValidationWarnings([`คุณยืนยันจะบันทึกข้อมูลแบบกลุ่มทั้งหมด (${readyBills.length} บิล) เป็นแบบร่างใช่หรือไม่?`]);
      setSaving(false);
      return;
    }

    if (!skipCheck && !isDraft) {
      setIsDraftMode(false);
      const allWarnings: string[] = [];
      readyBills.forEach(({ bill, index: idx }) => {
        const unmapped = bill.items.filter(item => !item.product_id);
        if (unmapped.length > 0) {
          allWarnings.push(`บิลไฟล์ที่ ${idx + 1} (${bill.filename || bill.bill_no}): มีสินค้า ${unmapped.length} รายการยังไม่ได้เทียบรหัสสินค้า`);
        }
      });

      if (allWarnings.length > 0) {
        setValidationWarnings(allWarnings);
        setSaving(false);
        return;
      }
    }

    setSaving(true);
    batchSaveInProgress.current = true;
    setErrorMsg(null);

    let successCount = 0;
    const savedIndices = new Set<number>();
    for (const { bill, index } of readyBills) {
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
            payment_status: isDraft ? 'Draft' : String(bill.payment_status || 'Completed'),
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
          po_item_id: item.po_item_id || undefined,
          pre_order_item_id: item.pre_order_item_id || undefined,
            category_id: item.category_id ? Number(item.category_id) : undefined,
            sub_category_id: item.sub_category_id ? Number(item.sub_category_id) : undefined,
            sub_sub_category_id: item.sub_sub_category_id ? Number(item.sub_sub_category_id) : undefined
          })),
          draft_json: JSON.stringify(bill)
        };

        await confirmBillImport(bill.db_job_id || 0, payload);
        successCount++;
        savedIndices.add(index);
      } catch (err) {
        console.error(`Error saving batch bill ${bill.bill_no}:`, err);
      }
    }

    // Remove only confirmed writes. Unscanned files and failed saves stay aligned
    // with their form data, so retry cannot resend the successful bills.
    const remainingIndices = Array.from({ length: Math.max(batchImages.length, batchResults.length) }, (_, index) => index)
      .filter(index => !savedIndices.has(index));
    const remainingResults = remainingIndices.map(index => batchResults[index] ?? null);
    const remainingImages = remainingIndices.flatMap(index => batchImages[index] ? [batchImages[index]] : []);
    const remainingUrls = remainingIndices.map(index => batchPreviewUrls[index] || '');
    const allSucceeded = remainingIndices.length === 0;
    setBatchResults(remainingResults);
    batchResultsRef.current = remainingResults;
    setBatchImages(remainingImages);
    batchImagesRef.current = remainingImages;
    setBatchPreviewUrls(remainingUrls);
    batchPreviewUrlsRef.current = remainingUrls;
    setValidationWarnings([]);
    setIsDraftMode(false);
    const previousIndex = remainingIndices.indexOf(activeBatchIndex);
    const nextIndex = previousIndex >= 0 && remainingResults[previousIndex]
      ? previousIndex : Math.max(0, remainingResults.findIndex(Boolean));
    setActiveBatchIndex(nextIndex);
    activeBatchIndexRef.current = nextIndex;
    setFormData(remainingResults[nextIndex] ?? null);
    formDataRef.current = remainingResults[nextIndex] ?? null;
    setBillImage(remainingImages[nextIndex] ?? null);
    setPreviewUrl(remainingUrls[nextIndex] || null);
    setSaving(false);
    batchSaveInProgress.current = false;
    await Promise.all([fetchBills(), fetchSuppliersAndProducts()]);
    toast({
      variant: allSucceeded ? 'success' : successCount > 0 ? 'warning' : 'error',
      title: allSucceeded ? 'นำเข้าบิลแบบกลุ่มสำเร็จ' : 'นำเข้าบิลแบบกลุ่มเสร็จสิ้น',
      message: `บันทึกสำเร็จ ${successCount} จาก ${readyBills.length} บิล${allSucceeded ? '' : ' เก็บรายการที่ยังไม่สำเร็จไว้ให้ลองใหม่แล้ว'}`,
    });
    if (allSucceeded) {
      setCurrentView('home');
    } else {
      setErrorMsg('ยังมีรายการที่ไม่สำเร็จ ข้อมูลและไฟล์ยังอยู่ กรุณาตรวจสอบแล้วลองสแกนหรือบันทึกอีกครั้ง');
    }
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
          setPoReference={setPoReference}
          suppliers={suppliers}
          bills={bills}
          loadingBills={loadingBills}
          getSupplierName={getSupplierName}
          formatDate={formatDate}
          handleViewSavedBill={handleViewSavedBill}
          handleDeleteBill={handleDeleteBill}
          handleOpenApprove={handleOpenApprove}
          fetchPOsList={fetchPOsList}
          isEmployee={isEmployee}
        />
      )}

      {currentView === 'scan' && (
        <ScanView
          setCurrentView={setCurrentView}
          formData={formData}
          previewUrl={previewUrl}
          previewIsPdf={billImage?.type === 'application/pdf' || !!billImage?.name.toLowerCase().endsWith('.pdf')}
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
          isMergedBatch={isMergedBatch}
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
          handleItemCategoryChange={handleItemCategoryChange}
          handleRemoveRow={handleRemoveRow}
          handleAddRow={handleAddRow}
          exportBillItemsToExcel={exportBillItemsToExcel}
          handleSaveBill={handleSaveBill}
          handleSaveAllBatchBills={handleSaveAllBatchBills}
          handleMergeBatchResultsToSingleBill={handleMergeBatchResultsToSingleBill}
          saving={saving}
          priceMismatchedItems={priceMismatchedItems}
          handleConfirmUpdatePrices={handleConfirmUpdatePrices}
          handleSkipPriceUpdate={handleSkipPriceUpdate}
          validationWarnings={validationWarnings}
          handleConfirmValidationSave={handleConfirmValidationSave}
          handleDismissValidation={handleDismissValidation}
          isDraftMode={isDraftMode}
          isEmployee={isEmployee}
          mobileSessionId={mobileSessionId ?? undefined}
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
          handleItemCategoryChange={handleItemCategoryChange}
          handleRemoveRow={handleRemoveRow}
          handleAddRow={handleAddRow}
          exportBillItemsToExcel={exportBillItemsToExcel}
          handleSaveBill={handleSaveBill}
          saving={saving}
          priceMismatchedItems={priceMismatchedItems}
          handleConfirmUpdatePrices={handleConfirmUpdatePrices}
          handleSkipPriceUpdate={handleSkipPriceUpdate}
          validationWarnings={validationWarnings}
          handleConfirmValidationSave={handleConfirmValidationSave}
          handleDismissValidation={handleDismissValidation}
          isDraftMode={isDraftMode}
          isEmployee={isEmployee}
        />
      )}

      {currentView === 'approve' && approvingBill && (
        <ApproveView
          bill={approvingBill}
          suppliers={suppliers}
          products={products}
          onApprove={handleApproveBill}
          onReject={handleRejectBill}
          onBack={() => { setApprovingBill(null); setCurrentView('home'); }}
          formatDate={formatDate}
          getSupplierName={getSupplierName}
          isEmployee={isEmployee}
        />
      )}

      {currentView === 'excel' && (
        <ExcelView
          setCurrentView={setCurrentView}
          processExcelFile={processExcelFile}
          errorMsg={errorMsg}
          onDismissError={() => setErrorMsg(null)}
        />
      )}

      {currentView === 'mapping' && (
        <MappingView
          setCurrentView={setCurrentView}
          preview={excelPreview}
          mapping={excelMapping}
          onMappingChange={setExcelMapping}
          onConfirm={() => applyExcelMapping()}
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

      {(() => {
        const deleteTarget = deleteBillTargetId !== null ? bills.find(b => b.id === deleteBillTargetId) : null;
        return (
          <ConfirmDialog
            isOpen={deleteBillTargetId !== null}
            onClose={() => !isDeletingBill && setDeleteBillTargetId(null)}
            onConfirm={handleConfirmDeleteBill}
            title="ยืนยันการลบบิล"
            description={(
              <div className="space-y-3 text-sm text-slate-700 text-left">
                <p className="text-center text-slate-600">คุณต้องการลบบิลนี้ออกจากระบบใช่หรือไม่? การลบจะไม่สามารถกู้คืนข้อมูลกลับมาได้</p>
                {deleteTarget && (
                  <div className="bg-[#f6f3f2] p-3 space-y-2 mt-2">
                    <div className="flex justify-between gap-4 text-xs">
                      <span className="text-slate-500">เลขที่บิล</span>
                      <span className="font-semibold text-slate-900">{deleteTarget.bill_no || '-'}</span>
                    </div>
                    <div className="flex justify-between gap-4 text-xs">
                      <span className="text-slate-500">ยอดรวมสุทธิ</span>
                      <span className="font-semibold text-[#e51c23]">
                        ฿{deleteTarget.total_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
            confirmText="ยืนยันการลบ"
            cancelText="ยกเลิก"
            variant="danger"
            isSubmitting={isDeletingBill}
          />
        );
      })()}

      {(() => {
        const removeTarget = removeRowIndex !== null ? formData?.items[removeRowIndex] : null;
        return (
          <ConfirmDialog
            isOpen={removeRowIndex !== null}
            onClose={() => setRemoveRowIndex(null)}
            onConfirm={handleConfirmRemoveRow}
            title="ลบรายการสินค้านี้"
            description={(
              <div className="space-y-3 text-sm text-slate-700 text-left">
                <p className="text-center text-slate-600">คุณต้องการลบสินค้ารายการนี้ออกจากบิลใช่หรือไม่?</p>
                {removeTarget && (
                  <div className="bg-[#f6f3f2] p-3 space-y-2 mt-2">
                    <div className="flex justify-between gap-4 text-xs">
                      <span className="text-slate-500">สินค้า</span>
                      <span className="font-semibold text-slate-900 truncate max-w-48">{removeTarget.company_product_name || '-'}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            confirmText="ยืนยันการลบ"
            cancelText="ยกเลิก"
            variant="danger"
          />
        );
      })()}
    </>
  );
}

export default function ImportBill(props: ImportBillProps) {
  return (
      <ToastProvider position="top-center">
      <ImportBillContent {...props} />
    </ToastProvider>
  );
}
