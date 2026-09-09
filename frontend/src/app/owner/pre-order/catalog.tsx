import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, Search, Plus, Edit,
  Layers, ChevronRight,
  Trash2, ShoppingBag, Eye, X, Loader2, Building2, 
  ChevronDown, Upload, Image as ImageIcon,
  FileText, SlidersHorizontal, Download, Camera,
  RotateCw, ZoomIn, ZoomOut, Save, ArrowRight, LayoutPanelLeft,
  Smartphone
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useLocation, useNavigate } from 'react-router-dom';
import Heading from '../../../components/elements/heading';
import Button from '../../../components/elements/button';
import Modal from '../../../components/elements/modal';
import ConfirmDialog from '../../../components/elements/confirm_dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/elements/table';
import apiClient from '../../../service/http/apiClient';
import { getCatalogs, createCatalog, updateCatalog, deleteCatalog, extractCatalogFromImage } from '../../../service/http/catalog/catalog_service';
import { getSuppliers } from '../../../service/http/import/import_service';
import type { Catalog, CatalogItem } from '../../../interface/catalog/catalog';
import type { Supplier } from '../../../interface/import';

interface CatalogManagerProps {
  isEmployee?: boolean;
}

export default function CatalogManager({ isEmployee = false }: CatalogManagerProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const basePath = isEmployee ? '/employee/pre-orders' : '/owner/pre-orders';
  const catalogPath = `${basePath}/catalog`;
  const initialCatalogParams = new URLSearchParams(location.search);

  // Navigation View Modes: 'home' | 'scan' | 'manual' | 'detail' (matching import-bills)
  const [currentView, setCurrentViewInternal] = useState<'home' | 'scan' | 'manual' | 'detail'>(() => {
    const requestedView = initialCatalogParams.get('view');
    return requestedView === 'scan' || requestedView === 'manual' || requestedView === 'detail'
      ? requestedView
      : 'home';
  });

  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const activeTab: 'books' | 'items' = initialCatalogParams.get('tab') === 'items' ? 'items' : 'books';
  
  // Detail View & PDF
  const [activeCatalog, setActiveCatalog] = useState<Catalog | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [removeItemIndex, setRemoveItemIndex] = useState<number | null>(null);
  const handleConfirmRemoveItem = () => {
    if (removeItemIndex === null) return;
    setNewItems(prev => prev.filter((_, i) => i !== removeItemIndex));
    setRemoveItemIndex(null);
  };
  const [showPdfViewer, setShowPdfViewer] = useState<boolean>(false);

  // Split-Screen Interactive Preview Controls (Zoom & Rotate like import-bills)
  const [zoom, setZoom] = useState<number>(1);
  const [rotate, setRotate] = useState<number>(0);
  const [leftWidth, setLeftWidth] = useState<number>(45); // percentage
  const [isResizing, setIsResizing] = useState<boolean>(false);

  // Form State for Create / Edit
  const [editingCatalogId, setEditingCatalogId] = useState<number | null>(null);
  const [newCatalog, setNewCatalog] = useState({
    catalog_code: '',
    catalog_name: '',
    brand: 'ISUZU',
    category: 'ไส้กรองน้ำมันเครื่อง',
    description: '',
    cover_image: '',
    catalog_file: '',
    supplier_id: 1,
    is_active: true,
  });

  interface ExtendedItemRow extends Partial<CatalogItem> {
    st_no?: string;
    image_thumbnail?: string;
    image?: string;
    height?: string;
    od?: string;
    threads?: string;
    box_2d?: number[];
  }

  const [newItems, setNewItems] = useState<ExtendedItemRow[]>([
    { part_number: '', part_name: '', brand: 'ISUZU', compatible_cars: '', standard_price: 0, unit: 'ชิ้น', st_no: '', image: '', image_thumbnail: '' }
  ]);

  // AI & Upload State
  const [extracting, setExtracting] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [, setPdfFileName] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const rowImageInputRef = useRef<HTMLInputElement>(null);
  const [activeRowImageIdx, setActiveRowImageIdx] = useState<number | null>(null);

  const setCurrentView = (
    nextView: 'home' | 'scan' | 'manual' | 'detail',
    catalogId?: number,
  ) => {
    setCurrentViewInternal(nextView);
    const params = new URLSearchParams(location.search);

    params.delete('view');
    params.delete('catalog');
    params.delete('edit');
    if (nextView !== 'home') params.set('view', nextView);
    if (nextView === 'detail' && catalogId) params.set('catalog', String(catalogId));
    if ((nextView === 'scan' || nextView === 'manual') && catalogId) params.set('edit', String(catalogId));

    const query = params.toString();
    navigate(`${catalogPath}${query ? `?${query}` : ''}`);
  };

  const setActiveTab = (tab: 'books' | 'items') => {
    const params = new URLSearchParams(location.search);
    if (tab === 'items') params.set('tab', 'items');
    else params.delete('tab');

    const query = params.toString();
    navigate(`${catalogPath}${query ? `?${query}` : ''}`);
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedView = params.get('view');
    setCurrentViewInternal(
      requestedView === 'scan' || requestedView === 'manual' || requestedView === 'detail'
        ? requestedView
        : 'home',
    );
  }, [location.search]);

  // Mobile Upload Session
  const [mobileSessionId] = useState<string>(
    () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
  );
  const [showQR, setShowQR] = useState<boolean>(false);
  const loadedMobileUrlsRef = useRef<Set<string>>(new Set());

  const mobileUrl = mobileSessionId
    ? `${window.location.origin}/mobile-scan?session=${mobileSessionId}`
    : window.location.href;
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // Poll for mobile-uploaded images
  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const resp = await apiClient.get(`/mobile/images?session=${mobileSessionId}`);
        const urls: string[] = resp.data?.images || [];
        if (urls.length > 0) {
          const newUrls = urls.filter(url => !loadedMobileUrlsRef.current.has(url));
          if (newUrls.length > 0) {
            const url = newUrls[newUrls.length - 1];
            newUrls.forEach(u => loadedMobileUrlsRef.current.add(u));
            const fullUrl = url.startsWith('http')
              ? url
              : `${window.location.protocol}//${window.location.hostname}:8080${url.startsWith('/') ? '' : '/'}${url}`;
            const response = await fetch(fullUrl);
            const blob = await response.blob();
            const fileName = `mobile_catalog_${url.split('/').pop() || 'image.jpg'}`;
            const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
            setSelectedFile(file);
            setPreviewImage(URL.createObjectURL(file));
            setShowQR(false);
            if (currentView === 'home') {
              setCurrentView('scan');
            }
          }
        }
      } catch {
        // ignore polling errors silently
      }
    }, 2000);
    return () => clearInterval(intervalId);
  }, [mobileSessionId, currentView]);

  const fetchCatalogList = async () => {
    setLoading(true);
    try {
      const [data, sups] = await Promise.all([
        getCatalogs(),
        getSuppliers().catch(() => [])
      ]);
      setCatalogs(data);
      setSuppliers(sups);
      if (sups.length > 0 && newCatalog.supplier_id === 1) {
        setNewCatalog(prev => ({ ...prev, supplier_id: sups[0].id }));
      }
    } catch (err) {
      console.error('Failed to load catalogs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalogList();
  }, []);

  const filteredCatalogs = catalogs.filter(c => {
    const matchSupplier = 
      selectedSupplier === 'ALL' || 
      String(c.supplier_id) === selectedSupplier || 
      (c.supplier_name && c.supplier_name.toLowerCase().includes(selectedSupplier.toLowerCase()));
    
    const q = searchQuery.toLowerCase();
    const matchSearch = 
      c.catalog_name.toLowerCase().includes(q) || 
      c.catalog_code.toLowerCase().includes(q) || 
      c.brand.toLowerCase().includes(q) ||
      (c.supplier_name && c.supplier_name.toLowerCase().includes(q)) ||
      (c.category && c.category.toLowerCase().includes(q)) ||
      (c.catalog_items && c.catalog_items.some(it => 
        it.part_number.toLowerCase().includes(q) || 
        it.part_name.toLowerCase().includes(q) || 
        (it.compatible_cars && it.compatible_cars.toLowerCase().includes(q))
      ));
    return matchSupplier && matchSearch;
  });

  // Flat list of all items for the Items tab
  const allCatalogItems: (CatalogItem & { 
    catalog_code: string; 
    catalog_title: string; 
    supplier_name?: string;
    cover_image?: string;
    catalog_file?: string;
    catalog_category?: string;
  })[] = [];
  filteredCatalogs.forEach(c => {
    if (c.catalog_items) {
      c.catalog_items.forEach(it => {
        allCatalogItems.push({
          ...it,
          catalog_code: c.catalog_code,
          catalog_title: c.catalog_name,
          supplier_name: c.supplier_name || suppliers.find(s => s.id === c.supplier_id)?.supplier_name,
          cover_image: c.cover_image,
          catalog_file: c.catalog_file,
          catalog_category: c.category,
        });
      });
    }
  });

  // Split-Screen Resize Logic (measure against the split container, not the window)
  const handleMouseDown = () => setIsResizing(true);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const container = document.getElementById('split-pane-container');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
      if (newWidth >= 25 && newWidth <= 75) setLeftWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizing) setIsResizing(false);
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

  const handleOpenDetail = (catalog: Catalog) => {
    setActiveCatalog(catalog);
    setShowPdfViewer(false);
    setCurrentView('detail', catalog.id);
  };

  const handleOpenScan = () => {
    setEditingCatalogId(null);
    setNewCatalog({
      catalog_code: `CAT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      catalog_name: '',
      brand: 'ISUZU',
      category: 'ไส้กรองน้ำมันเครื่อง',
      description: '',
      cover_image: '',
      catalog_file: '',
      supplier_id: suppliers.length > 0 ? suppliers[0].id : 1,
      is_active: true,
    });
    setNewItems([
      { part_number: '', part_name: '', brand: 'ISUZU', compatible_cars: '', standard_price: 0, unit: 'ชิ้น', st_no: '', image: '', image_thumbnail: '' }
    ]);
    setSelectedFile(null);
    setPreviewImage(null);
    setPdfFileName('');
    setZoom(1);
    setRotate(0);
    setCurrentView('scan');
  };

  const handleOpenManual = () => {
    setEditingCatalogId(null);
    setNewCatalog({
      catalog_code: `CAT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      catalog_name: '',
      brand: 'ISUZU',
      category: 'ไส้กรองน้ำมันเครื่อง',
      description: '',
      cover_image: '',
      catalog_file: '',
      supplier_id: suppliers.length > 0 ? suppliers[0].id : 1,
      is_active: true,
    });
    setNewItems([
      { part_number: '', part_name: '', brand: 'ISUZU', compatible_cars: '', standard_price: 0, unit: 'ชิ้น', st_no: '', image: '', image_thumbnail: '' }
    ]);
    setSelectedFile(null);
    setPreviewImage(null);
    setPdfFileName('');
    setCurrentView('manual');
  };

  const handleOpenEdit = (catalog: Catalog, updateUrl = true) => {
    setEditingCatalogId(catalog.id);
    setNewCatalog({
      catalog_code: catalog.catalog_code,
      catalog_name: catalog.catalog_name,
      brand: catalog.brand,
      category: catalog.category || '',
      description: catalog.description || '',
      cover_image: catalog.cover_image || '',
      catalog_file: catalog.catalog_file || '',
      supplier_id: catalog.supplier_id || (suppliers.length > 0 ? suppliers[0].id : 1),
      is_active: catalog.is_active,
    });
    if (catalog.catalog_items && catalog.catalog_items.length > 0) {
      setNewItems(catalog.catalog_items.map(it => ({
        part_number: it.part_number,
        part_name: it.part_name,
        brand: it.brand || catalog.brand,
        compatible_cars: it.compatible_cars || '',
        standard_price: it.standard_price || 0,
        unit: it.unit || 'ชิ้น',
        image: it.image || '',
        image_thumbnail: it.image || '',
        remark: it.remark || ''
      })));
    } else {
      setNewItems([
        { part_number: '', part_name: '', brand: catalog.brand, compatible_cars: '', standard_price: 0, unit: 'ชิ้น', st_no: '', image: '', image_thumbnail: '' }
      ]);
    }
    setSelectedFile(null);
    setPreviewImage(catalog.cover_image || null);
    setPdfFileName(catalog.catalog_file ? 'เอกสาร PDF แนบไว้แล้ว' : '');
    if (updateUrl) setCurrentView('manual', catalog.id);
    else setCurrentViewInternal('manual');
  };

  const handleDelete = (id: number) => {
    setDeleteTargetId(id);
  };

  const handleConfirmDelete = async () => {
    if (deleteTargetId === null) return;
    setIsDeleting(true);
    try {
      await deleteCatalog(deleteTargetId);
      setCatalogs(prev => prev.filter(c => c.id !== deleteTargetId));
      if (activeCatalog?.id === deleteTargetId) {
        setCurrentView('home');
      }
      setDeleteTargetId(null);
    } catch (err) {
      alert('ไม่สามารถลบแคตตาล็อกได้');
    } finally {
      setIsDeleting(false);
    }
  };

  // Image / PDF Selection for AI
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    if (file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf')) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setNewCatalog(prev => ({ ...prev, catalog_file: dataUrl }));
        setPdfFileName(file.name);
      };
      reader.readAsDataURL(file);
      setPreviewImage(null);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setNewCatalog(prev => ({ ...prev, catalog_file: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewImage(reader.result as string);
      setNewCatalog(prev => ({ ...prev, cover_image: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleRowImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || activeRowImageIdx === null) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setNewItems(prev => prev.map((it, i) => i === activeRowImageIdx ? { ...it, image: dataUrl, image_thumbnail: dataUrl } : it));
      setActiveRowImageIdx(null);
    };
    reader.readAsDataURL(file);
  };

  const handleAppendScan = (catalog: Catalog, updateUrl = true) => {
    setEditingCatalogId(catalog.id);
    setNewCatalog({
      catalog_code: catalog.catalog_code,
      catalog_name: catalog.catalog_name,
      brand: catalog.brand,
      category: catalog.category || '',
      description: catalog.description || '',
      cover_image: catalog.cover_image || '',
      catalog_file: catalog.catalog_file || '',
      supplier_id: catalog.supplier_id || (suppliers.length > 0 ? suppliers[0].id : 1),
      is_active: catalog.is_active,
    });
    if (catalog.catalog_items && catalog.catalog_items.length > 0) {
      setNewItems(catalog.catalog_items.map(it => ({
        part_number: it.part_number,
        part_name: it.part_name,
        brand: it.brand || catalog.brand,
        compatible_cars: it.compatible_cars || '',
        standard_price: it.standard_price || 0,
        unit: it.unit || 'ชิ้น',
        image: it.image || '',
        image_thumbnail: it.image || '',
        remark: it.remark || ''
      })));
    } else {
      setNewItems([]);
    }
    setSelectedFile(null);
    setPreviewImage(catalog.cover_image || null);
    setPdfFileName('');
    setZoom(1);
    setRotate(0);
    if (updateUrl) setCurrentView('scan', catalog.id);
    else setCurrentViewInternal('scan');
  };

  // โหลดแคตตาล็อกเดิมคืนตาม URL หลังรีเฟรช ทั้งหน้ารายละเอียดและหน้าแก้ไข/สแกนเพิ่ม
  useEffect(() => {
    if (catalogs.length === 0) return;

    const params = new URLSearchParams(location.search);
    const detailId = Number(params.get('catalog'));
    const editId = Number(params.get('edit'));

    if (currentView === 'detail' && detailId > 0) {
      const found = catalogs.find((catalog) => catalog.id === detailId);
      if (found && activeCatalog?.id !== detailId) setActiveCatalog(found);
      return;
    }

    if (editId > 0 && editingCatalogId !== editId) {
      const found = catalogs.find((catalog) => catalog.id === editId);
      if (!found) return;
      if (currentView === 'scan') handleAppendScan(found, false);
      else if (currentView === 'manual') handleOpenEdit(found, false);
    }
  }, [location.search, catalogs, currentView, activeCatalog?.id, editingCatalogId]);

  // AI Scan Execution
  const handleRunAiScan = async () => {
    if (!selectedFile) {
      alert('กรุณาเลือกไฟล์ภาพหรือ PDF หน้าแคตตาล็อกก่อนกดสแกน');
      return;
    }
    setExtracting(true);
    try {
      const extracted = await extractCatalogFromImage(selectedFile);
      if (extracted && extracted.length > 0) {
        if (!newCatalog.catalog_name) {
          const sample = extracted[0];
          let brandGuess = 'ISUZU';
          if (sample.car_model && sample.car_model.includes('มิตซูบิชิ')) brandGuess = 'MITSUBISHI';
          else if (sample.car_model && sample.car_model.includes('อีซูซุ')) brandGuess = 'ISUZU';
          else if (sample.car_model && sample.car_model.includes('โตโยต้า')) brandGuess = 'TOYOTA';

          setNewCatalog(prev => ({
            ...prev,
            catalog_name: `แคตตาล็อกไส้กรอง ${brandGuess} ${new Date().getFullYear()}`,
            brand: brandGuess,
            category: 'ไส้กรองน้ำมันเครื่อง'
          }));
        }

        const scannedItems: ExtendedItemRow[] = extracted.map((item: any) => ({
          part_number: (item.part_no || item.st_no || '').trim(),
          part_name: item.st_no ? `กรองน้ำมันเครื่อง ${item.st_no}` : (item.part_no ? `อะไหล่ ${item.part_no}` : 'กรองน้ำมันเครื่อง'),
          brand: newCatalog.brand || 'OEM',
          compatible_cars: item.car_model || '',
          standard_price: 0,
          unit: 'ชิ้น',
          st_no: item.st_no || '',
          image: item.image || item.image_thumbnail || '',
          image_thumbnail: item.image_thumbnail || item.image || '',
          box_2d: item.box_2d || null,
          remark: `S.T. NO: ${item.st_no || '-'} | H: ${item.height || '-'} | OD: ${item.od || '-'} | Threads: ${item.threads || '-'}`
        }));

        // Append to existing valid items if any
        const existingValid = newItems.filter(it => it.part_number || it.part_name);
        if (existingValid.length > 0) {
          setNewItems([...existingValid, ...scannedItems]);
          alert(`AI สแกนและเพิ่มรายการอะไหล่ต่อท้ายสำเร็จ ${scannedItems.length} รายการ (รวมเป็น ${existingValid.length + scannedItems.length} รายการ)`);
        } else {
          setNewItems(scannedItems);
          alert(`AI สแกนและดึงข้อมูลอะไหล่จากหน้าแคตตาล็อกสำเร็จ ${scannedItems.length} รายการ`);
        }
      } else {
        alert('ไม่พบรายการอะไหล่ในไฟล์ที่ส่งตรวจ');
      }
    } catch (err: any) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการสแกนด้วย AI: ' + (err.message || 'โปรดลองใหม่อีกครั้ง'));
    } finally {
      setExtracting(false);
    }
  };

  const handleFormSubmit = async () => {
    if (!newCatalog.catalog_name) {
      alert('กรุณากรอกชื่อแคตตาล็อก');
      return;
    }

    const catCode = newCatalog.catalog_code || `CAT-${Date.now().toString(36).toUpperCase()}`;
    const catBrand = newCatalog.brand || 'OEM';

    setSaving(true);
    try {
      const validItems = newItems
        .filter(it => it.part_number && it.part_name)
        .map(it => ({
          part_number: it.part_number,
          part_name: it.part_name,
          brand: it.brand || catBrand,
          compatible_cars: it.compatible_cars || '',
          standard_price: Number(it.standard_price) || 0,
          unit: it.unit || 'ชิ้น',
          image: it.image || it.image_thumbnail || '',
          remark: it.remark || (it.st_no ? `S.T. NO: ${it.st_no}` : '')
        }));

      const payload = {
        ...newCatalog,
        catalog_code: catCode,
        brand: catBrand,
        cover_image: previewImage || newCatalog.cover_image,
        catalog_file: newCatalog.catalog_file,
        catalog_items: validItems as any
      };

      if (editingCatalogId) {
        await updateCatalog(editingCatalogId, payload);
        alert('แก้ไขข้อมูลแคตตาล็อกเรียบร้อยแล้ว');
      } else {
        await createCatalog(payload);
        alert('บันทึกแคตตาล็อกใหม่เรียบร้อยแล้ว');
      }
      setCurrentView('home');
      fetchCatalogList();
    } catch (err) {
      alert(editingCatalogId ? 'ไม่สามารถแก้ไขแคตตาล็อกได้' : 'ไม่สามารถสร้างแคตตาล็อกได้');
    } finally {
      setSaving(false);
    }
  };

  const qrModal = (
    <Modal
      isOpen={showQR}
      onClose={() => setShowQR(false)}
      title="เปิดบนมือถือ"
      size="sm"
    >
      <div className="flex flex-col items-center gap-5">
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
    </Modal>
  );

  // =========================================================================
  // VIEW 1: HOME VIEW (MATCHING IMPORT-BILLS ACTION CARDS & HUB LAYOUT)
  // =========================================================================
  if (currentView === 'home') {
    return (
      <div className="p-8 max-w-full mx-auto w-full animate-in fade-in duration-300 font-sans">
        {qrModal}

        <div className="flex items-center justify-between mb-8">
          <Heading level="h1" className="mb-0 font-extrabold text-[#1C1B1B]">
            นำเข้าและจัดการแคตตาล็อกสินค้า
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

        {/* Action Cards Section (2 clean columns matching import-bills) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {/* Card 1: สแกนด้วยรูปภาพ / PDF (Red #e51c23) */}
          <div 
            onClick={handleOpenScan}
            className="bg-[#e51c23] hover:bg-[#c9181f] text-white p-8 rounded-none flex items-center justify-between cursor-pointer transition-all shadow-md group"
          >
            <div className="flex items-center gap-6">
              <div className="bg-white/20 p-4 rounded-none">
                <Camera size={32} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-1">สแกนด้วยรูปภาพ / PDF</h2>
                <p className="text-xs text-white/70">Scan & Extract Catalog Automatically</p>
              </div>
            </div>
            <ArrowRight size={32} className="text-white/50 group-hover:text-white transition-colors" />
          </div>

          {/* Card 2: กรอกข้อมูลด้วยตนเอง (Black #1C1B1B) */}
          <div 
            onClick={handleOpenManual}
            className="bg-[#1C1B1B] hover:bg-[#2a2929] text-white p-8 rounded-none flex items-center justify-between cursor-pointer transition-all shadow-md group"
          >
            <div className="flex items-center gap-6">
              <div className="bg-white/10 p-4 rounded-none">
                <SlidersHorizontal size={32} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-1">กรอกข้อมูลด้วยตนเอง</h2>
                <p className="text-xs text-gray-400">Manual Entry & Add Part Rows</p>
              </div>
            </div>
            <LayoutPanelLeft size={36} className="text-white/20" />
          </div>
        </div>

        {/* Filter Bar & Toolbar */}
        <div className="bg-white border border-gray-200 p-4 mb-6 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* ฝั่งซ้าย: ค้นหา */}
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหารหัสอะไหล่ ชื่อเล่ม หรือรุ่นรถยนต์..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-none pl-9 pr-4 py-2 text-xs text-[#1C1B1B] placeholder-gray-400 focus:border-[#e51c23] outline-none"
            />
          </div>

          {/* ฝั่งขวา: ดรอปดาวน์บริษัททั้งหมด + แท็บรายการ */}
          <div className="flex items-center gap-3 flex-wrap justify-end">
            {/* ดรอปดาวน์บริษัทซัพพลายเออร์ */}
            <div className="relative min-w-[210px]">
              <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-none pl-9 pr-8 py-2 text-xs font-bold text-[#1C1B1B] focus:border-[#e51c23] outline-none cursor-pointer appearance-none"
              >
                <option value="ALL">ทุกบริษัท ซัพพลายเออร์</option>
                {suppliers.map(sup => (
                  <option key={sup.id} value={String(sup.id)}>
                    {sup.supplier_name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            {/* แท็บเล่มแคตตาล็อก / รายการอะไหล่ทั้งหมด */}
            <div className="flex border border-gray-300 p-0.5 bg-gray-100">
              <button
                type="button"
                onClick={() => setActiveTab('books')}
                className={`px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'books' ? 'bg-white text-[#1C1B1B] shadow-2xs' : 'text-gray-500 hover:text-black'
                }`}
              >
                เล่มแคตตาล็อก {filteredCatalogs.length}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('items')}
                className={`px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'items' ? 'bg-white text-[#1C1B1B] shadow-2xs' : 'text-gray-500 hover:text-black'
                }`}
              >
                รายการอะไหล่ทั้งหมด {allCatalogItems.length}
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="flex flex-col items-center justify-center p-16 bg-white border border-gray-200">
            <Loader2 className="animate-spin text-[#e51c23] mb-3" size={36} />
            <span className="text-gray-500 text-sm font-medium">กำลังโหลดข้อมูลแคตตาล็อก...</span>
          </div>
        ) : activeTab === 'books' ? (
          filteredCatalogs.length === 0 ? (
            <div className="bg-white border border-gray-200 p-12 text-center flex flex-col items-center justify-center">
              <BookOpen size={48} className="text-gray-300 mb-3" />
              <p className="font-bold text-[#1C1B1B] text-base">ไม่พบข้อมูลแคตตาล็อก</p>
              <p className="text-xs text-gray-500 mt-1">ลองเปลี่ยนคำค้นหา หรือกดสแกนแคตตาล็อกใหม่</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredCatalogs.map(cat => (
                <div 
                  key={cat.id} 
                  className="bg-white border border-gray-200 hover:border-gray-400 hover:shadow-md transition-all flex flex-col justify-between group overflow-hidden"
                >
                  <div>
                    <div className="h-40 bg-gradient-to-br from-gray-900 to-gray-800 relative overflow-hidden flex items-center justify-center p-4">
                      {cat.cover_image ? (
                        <img 
                          src={cat.cover_image} 
                          alt={cat.catalog_name} 
                          className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-300" 
                        />
                      ) : null}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                      
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
                        {cat.category && (
                          <span className="bg-white/20 backdrop-blur-xs text-white text-[10px] font-medium px-2 py-0.5">
                            {cat.category}
                          </span>
                        )}
                        {cat.catalog_file && (
                          <span className="bg-[#e51c23] text-white text-[10px] font-black px-1.5 py-0.5 flex items-center gap-0.5">
                            <FileText size={10} /> PDF
                          </span>
                        )}
                      </div>

                      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-xs p-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEdit(cat);
                          }}
                          className="text-gray-300 hover:text-white hover:bg-white/20 p-1 transition-colors cursor-pointer"
                          title="แก้ไขแคตตาล็อก"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(cat.id);
                          }}
                          className="text-gray-300 hover:text-red-400 hover:bg-white/20 p-1 transition-colors cursor-pointer"
                          title="ลบแคตตาล็อก"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="absolute bottom-3 left-3 right-3 text-white">
                        <p className="text-[11px] font-mono text-gray-300 font-bold">{cat.catalog_code}</p>
                        <h3 className="font-bold text-sm text-white line-clamp-1 leading-snug">
                          {cat.catalog_name}
                        </h3>
                      </div>
                    </div>

                    <div className="p-4 space-y-3 text-xs">
                      {/* Highlighted Supplier Box */}
                      <div className="bg-gray-50 border border-gray-200 p-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-gray-700 truncate max-w-[200px]" title={cat.supplier_name || 'ซัพพลายเออร์'}>
                          <Building2 size={14} className="text-[#e51c23] shrink-0" />
                          <span className="font-extrabold text-[#1C1B1B] truncate">{cat.supplier_name || suppliers.find(s => s.id === cat.supplier_id)?.supplier_name || 'ไม่ระบุซัพพลายเออร์'}</span>
                        </div>
                        <span className="font-extrabold text-[#e51c23] bg-red-50 border border-red-200 px-2 py-0.5 shrink-0 text-[11px]">
                          {cat.item_count || cat.catalog_items?.length || 0} รายการ
                        </span>
                      </div>

                      <p className="text-gray-600 line-clamp-2 min-h-[32px] leading-relaxed">
                        {cat.description || 'ไม่มีคำอธิบายเพิ่มเติม'}
                      </p>

                      {cat.catalog_items && cat.catalog_items.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-gray-100">
                          <span className="text-[11px] text-gray-500 font-extrabold block uppercase flex items-center justify-between">
                            <span>สินค้าที่แกะมาในเล่ม:</span>
                            <span className="text-gray-400 font-normal">{cat.catalog_items.length} รายการ</span>
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {cat.catalog_items.slice(0, 3).map((it, idx) => (
                              <div key={idx} className="bg-white border border-gray-200 p-1 flex items-center gap-1 shadow-2xs">
                                {it.image ? (
                                  <img src={it.image} alt={it.part_name} className="w-6 h-6 object-contain bg-gray-50 border border-gray-100" />
                                ) : null}
                                <span className="text-[10px] font-mono font-bold text-gray-800">
                                  {it.part_number}
                                </span>
                              </div>
                            ))}
                            {cat.catalog_items.length > 3 && (
                              <span className="text-[10px] text-gray-500 font-bold self-center px-1.5 py-0.5 bg-gray-100 border border-gray-200">
                                + {cat.catalog_items.length - 3} รายการ
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => handleOpenDetail(cat)}
                      className="w-full bg-[#1C1B1B] hover:bg-black text-white text-xs font-bold py-2.5 px-3 flex items-center justify-center gap-1.5 transition-colors cursor-pointer rounded-none"
                    >
                      <Eye size={14} /> เปิดดูเล่มแคตตาล็อก
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {allCatalogItems.map((item, idx) => (
              <div 
                key={idx} 
                className="bg-white border border-gray-200 hover:border-gray-400 hover:shadow-md transition-all flex flex-col justify-between group overflow-hidden"
              >
                <div>
                  <div className="h-40 bg-gradient-to-br from-gray-900 to-gray-800 relative overflow-hidden flex items-center justify-center p-4">
                    {item.image || item.cover_image ? (
                      <img 
                        src={item.image || item.cover_image} 
                        alt={item.part_name} 
                        className="w-full h-full object-contain opacity-90 group-hover:scale-105 transition-transform duration-300" 
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                    
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 max-w-[85%]">
                      <span className="bg-[#e51c23] text-white text-[10px] font-black px-2 py-0.5 uppercase tracking-wider shrink-0">
                        {item.brand}
                      </span>
                      {item.catalog_category && (
                        <span className="bg-white/20 backdrop-blur-xs text-white text-[10px] font-medium px-2 py-0.5 truncate">
                          {item.catalog_category}
                        </span>
                      )}
                    </div>

                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <p className="text-[12px] font-mono text-red-400 font-extrabold tracking-wide">{item.part_number}</p>
                      <h3 className="font-bold text-sm text-white line-clamp-1 leading-snug">
                        {item.part_name}
                      </h3>
                    </div>
                  </div>

                  <div className="p-4 space-y-3 text-xs">
                    <div className="bg-gray-50 border border-gray-200 p-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-gray-700 truncate max-w-[190px]" title={item.supplier_name || 'ซัพพลายเออร์'}>
                        <Building2 size={13} className="text-[#e51c23] shrink-0" />
                        <span className="font-extrabold text-[#1C1B1B] truncate">{item.supplier_name || 'ซัพพลายเออร์'}</span>
                      </div>
                      <span className="font-bold text-gray-600 bg-white border border-gray-200 px-1.5 py-0.5 rounded-none shrink-0 text-[10px] font-mono truncate max-w-[110px]" title={item.catalog_title}>
                        {item.catalog_code}
                      </span>
                    </div>

                    <p className="text-gray-600 line-clamp-2 min-h-[32px] leading-relaxed">
                      {item.remark || 'อะไหล่แท้มาตรฐาน OEM คุณภาพสูง รองรับการใช้งานระยะยาว'}
                    </p>

                    <div className="space-y-1 pt-1 border-t border-gray-100">
                      <span className="text-[10px] text-gray-500 font-extrabold block uppercase flex items-center gap-1">
                        รุ่นรถยนต์ที่รองรับ
                      </span>
                      <div className="bg-gray-50 border border-gray-200 p-1.5 text-[11px] text-gray-800 font-medium truncate">
                        {item.compatible_cars || 'สามารถใช้ได้กับหลายรุ่น'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => navigate(basePath, { state: { prefillItem: item, catalog: { catalog_name: item.catalog_title, supplier_name: item.supplier_name } } })}
                    className="w-full bg-[#1C1B1B] hover:bg-black text-white text-xs font-bold py-2.5 px-3 flex items-center justify-center gap-1.5 transition-colors cursor-pointer rounded-none shadow-2xs"
                  >
                    <ShoppingBag size={14} className="text-[#e51c23]" /> สั่งจองสินค้านี้
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <ConfirmDialog
          isOpen={deleteTargetId !== null}
          onClose={() => !isDeleting && setDeleteTargetId(null)}
          onConfirm={handleConfirmDelete}
          title="ยืนยันการลบแคตตาล็อก"
          description="คุณต้องการลบแคตตาล็อกนี้ใช่หรือไม่? การลบไม่สามารถย้อนกลับได้"
          confirmText="ยืนยันการลบ"
          cancelText="ยกเลิก"
          variant="danger"
          isSubmitting={isDeleting}
        />
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: SCAN VIEW (SPLIT SCREEN 1:1 WITH IMPORT-BILLS SCAN_VIEW.TSX)
  // =========================================================================
  if (currentView === 'scan') {
    return (
      <div 
        className="p-8 max-w-full mx-auto w-full animate-in fade-in duration-300 font-sans"
      >
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*,application/pdf,.pdf"
          className="hidden"
          onChange={handleFileChange}
        />
        <input
          type="file"
          ref={rowImageInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleRowImageSelect}
        />
        <input
          type="file"
          ref={pdfInputRef}
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={handlePdfUpload}
        />

        {qrModal}

        {/* Breadcrumbs & Header Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="space-y-1">
            <nav className="flex items-center gap-2 text-xs text-gray-500">
              <button type="button" onClick={() => setCurrentView('home')} className="hover:text-[#e51c23] font-bold cursor-pointer">
                นำเข้าแคตตาล็อก
              </button>
              <ChevronRight size={14} className="text-gray-400" />
              <span className="text-[#1C1B1B] font-bold">สแกนหน้าแคตตาล็อก</span>
            </nav>
            <Heading level="h1" className="mb-0 font-extrabold text-[#1C1B1B]">
              สแกนและดึงข้อมูลแคตตาล็อก
            </Heading>
          </div>

          <button
            onClick={() => setShowQR(true)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 text-xs font-bold rounded-none transition-colors cursor-pointer"
            title="เปิดบนมือถือผ่าน QR Code"
          >
            <Smartphone size={16} />
            เปิดบนมือถือ
          </button>
        </div>

        {/* Split Screen Container */}
        <div id="split-pane-container" className="flex flex-col lg:flex-row gap-6 min-h-[750px] relative">
          {/* LEFT PANEL: Interactive Image / Document Viewer with Zoom & Rotate */}
          <div 
            style={{ width: `${leftWidth}%` }} 
            className="bg-white border border-gray-200 p-4 flex flex-col justify-between shadow-md"
          >
            {/* Viewer Control Bar */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 text-[#1C1B1B] text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#5F5E5E]">
                  {selectedFile ? selectedFile.name : 'ตัวอย่างเอกสารหน้าแคตตาล็อก'}
                </span>
                {selectedFile && (
                  <span className="bg-[#e51c23] text-white text-[10px] font-black px-1.5 py-0.5">
                    {selectedFile.type.includes('pdf') ? 'PDF' : 'IMAGE'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.max(0.5, prev - 0.2))}
                  className="p-1.5 hover:bg-gray-100 text-gray-500 hover:text-[#1C1B1B] transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="text-[11px] font-mono text-gray-500 w-10 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.min(3, prev + 0.2))}
                  className="p-1.5 hover:bg-gray-100 text-gray-500 hover:text-[#1C1B1B] transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setRotate(prev => (prev + 90) % 360)}
                  className="p-1.5 hover:bg-gray-100 text-gray-500 hover:text-[#1C1B1B] transition-colors ml-1"
                  title="Rotate"
                >
                  <RotateCw size={16} />
                </button>
              </div>
            </div>

            {/* Viewer Canvas */}
            <div className="flex-1 min-h-[450px] overflow-auto flex items-center justify-center p-2">
              {previewImage ? (
                <div 
                  style={{ 
                    transform: `scale(${zoom}) rotate(${rotate}deg)`,
                    transition: 'transform 0.15s ease-out'
                  }}
                  className="origin-center w-full h-full min-h-[450px] flex items-center justify-center"
                >
                  <img 
                    src={previewImage} 
                    alt="Catalog scan" 
                    className="w-full h-full max-w-full max-h-full object-contain shadow-md border border-gray-200" 
                  />
                </div>
              ) : selectedFile?.name.toLowerCase().endsWith('.pdf') ? (
                <div className="text-center p-8 text-[#1C1B1B] space-y-3">
                  <FileText size={56} className="text-[#e51c23] mx-auto" />
                  <p className="font-bold text-sm">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">ไฟล์ PDF พร้อมสำหรับการส่งให้ AI สแกนดึงข้อมูลอะไหล่</p>
                </div>
              ) : (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 hover:border-[#e51c23] p-12 text-center cursor-pointer transition-colors text-gray-500 space-y-3"
                >
                  <Camera size={44} className="mx-auto text-gray-400" />
                  <p className="font-bold text-sm text-[#1C1B1B]">คลิกเพื่อเลือกไฟล์ภาพ หรือไฟล์ PDF แคตตาล็อก</p>
                </div>
              )}
            </div>

            {/* Viewer Footer Bar with Trigger Button */}
            <div className="pt-3 border-t border-gray-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-[#1C1B1B] flex items-center gap-1.5 py-2 px-3 bg-gray-100 hover:bg-gray-200 font-bold transition-colors cursor-pointer"
                >
                  <Upload size={14} /> {selectedFile ? 'เลือกไฟล์อื่น' : 'อัปโหลดไฟล์'}
                </button>
              </div>

              <button
                type="button"
                disabled={!selectedFile || extracting}
                onClick={handleRunAiScan}
                className="bg-[#e51c23] hover:bg-[#c9181f] text-white text-xs font-black py-2.5 px-5 transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {extracting ? 'กำลังสแกนด้วย AI...' : 'เริ่มสแกนด้วย AI'}
              </button>
            </div>
          </div>

          {/* Resizer Handle */}
          <div 
            onMouseDown={handleMouseDown}
            className="w-1.5 hover:w-2 bg-gray-200 hover:bg-[#e51c23] cursor-col-resize transition-all hidden lg:block" 
            title="ลากเพื่อปรับขนาดหน้าจอซ้าย-ขวา"
          />

          {/* RIGHT PANEL: Extracted Form & Editable Parts Table */}
          <div className="flex-1 bg-white border border-gray-200 p-6 shadow-xs space-y-6 overflow-y-auto">
            {/* General Header Inputs */}
            <div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 mb-4 border-b border-gray-200">
                <h2 className="text-sm font-extrabold text-[#1C1B1B]">
                  ข้อมูลทั่วไปของเล่มแคตตาล็อก
                </h2>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs text-gray-500 font-bold shrink-0">บันทึกเข้า:</span>
                  <select
                    value={editingCatalogId ? String(editingCatalogId) : 'NEW'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'NEW') {
                        setEditingCatalogId(null);
                        setNewCatalog({
                          catalog_code: `CAT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
                          catalog_name: '',
                          brand: 'ISUZU',
                          category: 'ไส้กรองน้ำมันเครื่อง',
                          description: '',
                          cover_image: '',
                          catalog_file: '',
                          supplier_id: suppliers.length > 0 ? suppliers[0].id : 1,
                          is_active: true,
                        });
                        setNewItems([]);
                      } else {
                        const found = catalogs.find(c => String(c.id) === val);
                        if (found) {
                          handleAppendScan(found);
                        }
                      }
                    }}
                    className="bg-gray-50 border border-gray-300 py-1.5 px-2.5 text-xs font-bold text-[#1C1B1B] focus:border-[#e51c23] outline-none cursor-pointer max-w-[280px] truncate shadow-2xs"
                  >
                    <option value="NEW">[+] สร้างเป็นเล่มใหม่</option>
                    <optgroup label="-- เพิ่มรายการเข้าเล่มเดิม --">
                      {catalogs.map(c => (
                        <option key={c.id} value={String(c.id)}>
                          {c.catalog_name} ({c.catalog_items?.length || 0} รายการ)
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>




              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-gray-700 mb-1.5">ชื่อเล่มแคตตาล็อก *</label>
                  <input
                    type="text"
                    required
                    value={newCatalog.catalog_name}
                    onChange={e => setNewCatalog({ ...newCatalog, catalog_name: e.target.value })}
                    placeholder="เช่น แคตตาล็อกไส้กรอง 2026"
                    className="w-full h-10 border border-gray-300 px-3 text-xs font-bold text-[#1C1B1B] focus:border-[#e51c23] outline-none bg-white rounded-none placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1.5">บริษัท ซัพพลายเออร์ *</label>
                  <div className="relative">
                    <select
                      value={newCatalog.supplier_id}
                      onChange={e => setNewCatalog({ ...newCatalog, supplier_id: Number(e.target.value) })}
                      className="w-full h-10 border border-gray-300 pl-3 pr-8 text-xs font-bold text-[#1C1B1B] focus:border-[#e51c23] outline-none bg-white cursor-pointer rounded-none appearance-none"
                    >
                      {suppliers.map(sup => (
                        <option key={sup.id} value={sup.id}>
                          {sup.supplier_name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1.5">หมวดหมู่อะไหล่</label>
                  <input
                    type="text"
                    value={newCatalog.category}
                    onChange={e => setNewCatalog({ ...newCatalog, category: e.target.value })}
                    placeholder="เช่น ไส้กรองน้ำมันเครื่อง"
                    className="w-full h-10 border border-gray-300 px-3 text-xs font-bold text-[#1C1B1B] focus:border-[#e51c23] outline-none bg-white rounded-none placeholder-gray-400"
                  />
                </div>
              </div>
            </div>

            {/* Extracted Items Table */}
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-200">
                <h3 className="text-sm font-extrabold text-[#1C1B1B]">
                  รายการอะไหล่ที่แกะมาได้ ({newItems.length} รายการ)
                </h3>
                <button
                  type="button"
                  onClick={() => setNewItems(prev => [
                    ...prev,
                    { part_number: '', part_name: '', brand: newCatalog.brand, compatible_cars: '', standard_price: 0, unit: 'ชิ้น', st_no: '', image: '', image_thumbnail: '' }
                  ])}
                  className="text-xs font-bold text-gray-700 hover:text-black border border-gray-300 px-3 py-1.5 bg-gray-50 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus size={14} /> เพิ่มแถวอะไหล่
                </button>
              </div>

              <div className="overflow-x-auto border border-gray-200">
                <Table className="min-w-[750px]">
                  <TableHeader className="bg-gray-100 text-gray-700 text-xs font-bold">
                    <TableRow>
                      <TableHead className="py-2 px-2 w-20 text-center">ลำดับที่</TableHead>
                      <TableHead className="py-2 px-2 w-28 text-center">ภาพอะไหล่</TableHead>
                      <TableHead className="py-2 px-2 w-28">รหัสสินค้าคู่ค้า</TableHead>
                      <TableHead className="py-2 px-2 w-36">PART NO *</TableHead>
                      <TableHead className="py-2 px-2 min-w-[150px]">ชื่ออะไหล่ *</TableHead>
                      <TableHead className="py-2 px-2 min-w-[160px]">รุ่นรถยนต์ที่รองรับ</TableHead>
                      <TableHead className="py-2 px-2 w-8 text-center">ลบ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100 text-xs">
                    {newItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-12 text-center text-gray-400">
                          ยังไม่มีข้อมูลอะไหล่ กดปุ่มสแกนด้านซ้าย หรือเพิ่มแถวด้วยตนเอง
                        </TableCell>
                      </TableRow>
                    ) : (
                      newItems.map((it, idx) => (
                        <TableRow key={idx} className="hover:bg-gray-50">
                          <TableCell className="py-2 px-2 text-center font-bold text-gray-400">{idx + 1}</TableCell>
                          <TableCell className="py-1 px-2 text-center">
                            {it.image || it.image_thumbnail ? (
                              <div className="relative group inline-block">
                                <img 
                                  src={it.image || it.image_thumbnail} 
                                  alt={it.part_name || 'Part'} 
                                  className="w-20 h-12 object-contain bg-white border border-gray-300 p-0.5" 
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveRowImageIdx(idx);
                                    rowImageInputRef.current?.click();
                                  }}
                                  className="absolute inset-0 bg-black/60 text-white text-[9px] font-bold opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                >
                                  เปลี่ยนรูป
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveRowImageIdx(idx);
                                  rowImageInputRef.current?.click();
                                }}
                                className="w-20 h-12 bg-gray-50 hover:bg-gray-100 border border-dashed border-gray-300 flex flex-col items-center justify-center mx-auto text-gray-400"
                              >
                                <Upload size={12} />
                                <span className="text-[9px] font-bold">เพิ่มรูป</span>
                              </button>
                            )}
                          </TableCell>
                          <TableCell className="py-1 px-1">
                            <input
                              type="text"
                              value={it.st_no || ''}
                              onChange={e => {
                                const val = e.target.value;
                                setNewItems(prev => prev.map((item, i) => i === idx ? { ...item, st_no: val } : item));
                              }}
                              className="w-full border border-gray-300 p-1 text-xs font-mono font-bold text-gray-700 outline-none"
                            />
                          </TableCell>
                          <TableCell className="py-1 px-1">
                            <input
                              type="text"
                              required
                              value={it.part_number || ''}
                              onChange={e => {
                                const val = e.target.value;
                                setNewItems(prev => prev.map((item, i) => i === idx ? { ...item, part_number: val } : item));
                              }}
                              className="w-full border border-gray-300 p-1 text-xs font-mono font-bold text-[#e51c23] bg-red-50/20 outline-none"
                            />
                          </TableCell>
                          <TableCell className="py-1 px-1">
                            <input
                              type="text"
                              required
                              value={it.part_name || ''}
                              onChange={e => {
                                const val = e.target.value;
                                setNewItems(prev => prev.map((item, i) => i === idx ? { ...item, part_name: val } : item));
                              }}
                              className="w-full border border-gray-300 p-1 text-xs font-bold text-gray-800 outline-none"
                            />
                          </TableCell>
                          <TableCell className="py-1 px-1">
                            <input
                              type="text"
                              value={it.compatible_cars || ''}
                              onChange={e => {
                                const val = e.target.value;
                                setNewItems(prev => prev.map((item, i) => i === idx ? { ...item, compatible_cars: val } : item));
                              }}
                              className="w-full border border-gray-300 p-1 text-xs text-gray-700 outline-none"
                            />
                          </TableCell>
                          <TableCell className="py-1 px-1 text-center">
                            <button
                              type="button"
                              onClick={() => setRemoveItemIndex(idx)}
                              className="text-gray-400 hover:text-red-600 p-1"
                            >
                              <Trash2 size={14} />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="bg-white border border-gray-200 p-4 mt-6 shadow-xs flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-xs text-gray-500 font-bold">
            รายการอะไหล่ในเล่มทั้งหมด: <span className="text-[#e51c23] font-extrabold">{newItems.length}</span> รายการ
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setCurrentView('home')}
              className="font-bold text-xs cursor-pointer"
            >
              ยกเลิกและกลับ
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={saving}
              onClick={handleFormSubmit}
              className="gap-2 font-bold text-xs bg-[#e51c23] hover:bg-[#c9181f] text-white cursor-pointer shadow-xs"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              บันทึกแคตตาล็อกเข้าสู่ระบบ
            </Button>
          </div>
        </div>

        <ConfirmDialog
          isOpen={removeItemIndex !== null}
          onClose={() => setRemoveItemIndex(null)}
          onConfirm={handleConfirmRemoveItem}
          title="ลบรายการสินค้านี้"
          description="คุณต้องการลบสินค้ารายการนี้ออกใช่หรือไม่?"
          confirmText="ยืนยันการลบ"
          cancelText="ยกเลิก"
          variant="danger"
        />
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: MANUAL ENTRY VIEW (1:1 ENTERPRISE FORM LAYOUT)
  // =========================================================================
  if (currentView === 'manual') {
    return (
      <div className="p-8 max-w-full mx-auto w-full animate-in fade-in duration-300 font-sans">
        <input
          type="file"
          ref={rowImageInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleRowImageSelect}
        />
        <input
          type="file"
          ref={coverInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleCoverUpload}
        />
        <input
          type="file"
          ref={pdfInputRef}
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={handlePdfUpload}
        />

        {/* Header Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="space-y-1">
            <nav className="flex items-center gap-2 text-xs text-gray-500">
              <button type="button" onClick={() => setCurrentView('home')} className="hover:text-[#e51c23] font-bold cursor-pointer">
                นำเข้าแคตตาล็อก
              </button>
              <ChevronRight size={14} className="text-gray-400" />
              <span className="text-[#1C1B1B] font-bold">
                {editingCatalogId ? 'แก้ไขเล่มแคตตาล็อก' : 'กรอกข้อมูลแคตตาล็อกด้วยตนเอง'}
              </span>
            </nav>
            <Heading level="h1" className="mb-0 font-extrabold text-[#1C1B1B]">
              {editingCatalogId ? 'แก้ไขข้อมูลแคตตาล็อก' : 'สร้างเล่มแคตตาล็อกใหม่'}
            </Heading>
          </div>
        </div>

        {/* Form Container */}
        <div className="space-y-6">
          {/* General Information Card */}
          <div className="bg-white border border-gray-200 p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-extrabold text-[#1C1B1B] pb-2 border-b border-gray-200">
              ข้อมูลทั่วไปของเล่มแคตตาล็อก
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1.5">ชื่อเล่มแคตตาล็อก *</label>
                <input
                  type="text"
                  required
                  value={newCatalog.catalog_name}
                  onChange={e => setNewCatalog({ ...newCatalog, catalog_name: e.target.value })}
                  placeholder="เช่น แคตตาล็อกไส้กรอง 2026"
                  className="w-full h-10 border border-gray-300 px-3 text-xs font-bold text-[#1C1B1B] focus:border-[#e51c23] outline-none bg-white rounded-none placeholder-gray-400"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1.5">บริษัท ซัพพลายเออร์ *</label>
                <div className="relative">
                  <select
                    value={newCatalog.supplier_id}
                    onChange={e => setNewCatalog({ ...newCatalog, supplier_id: Number(e.target.value) })}
                    className="w-full h-10 border border-gray-300 pl-3 pr-8 text-xs font-bold text-[#1C1B1B] focus:border-[#e51c23] outline-none bg-white cursor-pointer rounded-none appearance-none"
                  >
                    {suppliers.map(sup => (
                      <option key={sup.id} value={sup.id}>
                        {sup.supplier_name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1.5">หมวดหมู่อะไหล่</label>
                <input
                  type="text"
                  value={newCatalog.category}
                  onChange={e => setNewCatalog({ ...newCatalog, category: e.target.value })}
                  placeholder="เช่น ไส้กรองน้ำมันเครื่อง"
                  className="w-full h-10 border border-gray-300 px-3 text-xs font-bold text-[#1C1B1B] focus:border-[#e51c23] outline-none bg-white rounded-none placeholder-gray-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
              <div>
                <label className="block font-bold text-gray-700 mb-1.5">
                  คำอธิบายเพิ่มเติมเกี่ยวกับเล่ม
                </label>
                <textarea
                  value={newCatalog.description}
                  onChange={e => setNewCatalog({ ...newCatalog, description: e.target.value })}
                  placeholder="รายละเอียดเนื้อหาในเล่ม..."
                  className="w-full h-16 border border-gray-300 p-2.5 text-xs text-[#1C1B1B] focus:border-[#e51c23] outline-none bg-white rounded-none placeholder-gray-400 resize-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block font-bold text-gray-700 flex items-center gap-1.5">
                    <ImageIcon size={15} className="text-[#e51c23]" /> รูปภาพหน้าปกแคตตาล็อก (ไม่บังคับ)
                  </label>
                  {previewImage && (
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewImage(null);
                        setNewCatalog(prev => ({ ...prev, cover_image: '' }));
                      }}
                      className="text-[#e51c23] hover:text-[#c9181f] text-[11px] font-bold cursor-pointer"
                    >
                      ลบหน้าปก
                    </button>
                  )}
                </div>
                
                {previewImage ? (
                  <div className="flex items-center justify-between bg-white border border-gray-300 px-3 py-2 h-16 rounded-none">
                    <div className="flex items-center gap-3">
                      <img src={previewImage} alt="Cover preview" className="w-12 h-12 object-cover border border-gray-200" />
                      <span className="font-bold text-[#1C1B1B] text-xs">ภาพหน้าปกเล่มแคตตาล็อก</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      className="text-xs text-[#1C1B1B] hover:text-[#e51c23] hover:underline font-bold cursor-pointer"
                    >
                      เปลี่ยนรูปภาพ
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="w-full h-16 border border-dashed border-gray-300 hover:border-gray-400 bg-gray-50/50 hover:bg-gray-100 text-gray-600 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors rounded-none"
                  >
                    <Upload size={15} className="text-gray-400" /> เลือกรูปภาพหน้าปกแคตตาล็อก
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Parts Table */}
          <div className="bg-white border border-gray-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-[#1C1B1B] flex items-center gap-2">
                  <Layers size={16} className="text-[#e51c23]" />
                  รายการอะไหล่ในเล่ม ({newItems.length} รายการ)
                </h3>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setNewItems(prev => [
                    ...prev, 
                    { part_number: '', part_name: '', brand: newCatalog.brand, compatible_cars: '', standard_price: 0, unit: 'ชิ้น', st_no: '', image: '', image_thumbnail: '' }
                  ])}
                  className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-xs font-bold px-3 py-1.5 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                >
                  <Plus size={14} /> เพิ่มแถวอะไหล่
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentView('scan', editingCatalogId || undefined)}
                  className="bg-red-50 hover:bg-[#e51c23] border border-red-200 hover:border-[#e51c23] text-[#e51c23] hover:text-white text-xs font-bold px-3 py-1.5 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                  title="เปิดหน้าสแกนด้วยรูปภาพหรือ PDF เพื่อดึงรายการเข้าเล่มนี้"
                >
                  <Camera size={14} /> สแกนด้วย AI เพิ่มรายการ
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table className="min-w-[1000px]">
                <TableHeader className="bg-gray-100 text-gray-600 text-xs font-bold">
                  <TableRow>
                    <TableHead className="py-2.5 px-3 w-20 text-center">ลำดับที่</TableHead>
                    <TableHead className="py-2.5 px-3 w-36 text-center">ภาพอะไหล่</TableHead>
                    <TableHead className="py-2.5 px-3 w-36">รหัสสินค้าคู่ค้า</TableHead>
                    <TableHead className="py-2.5 px-3 w-48">รหัส PART NO *</TableHead>
                    <TableHead className="py-2.5 px-3 min-w-[200px]">ชื่ออะไหล่ *</TableHead>
                    <TableHead className="py-2.5 px-3 min-w-[220px]">รุ่นรถยนต์ที่รองรับ</TableHead>
                    <TableHead className="py-2.5 px-2 w-10 text-center">ลบ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 text-xs">
                  {newItems.map((it, idx) => (
                    <TableRow key={idx} className="hover:bg-gray-50/70 align-middle">
                      <TableCell className="py-2 px-3 text-center font-bold text-gray-400">{idx + 1}</TableCell>
                      <TableCell className="py-2 px-3 text-center">
                        {it.image || it.image_thumbnail ? (
                          <div className="relative group inline-block">
                            <img 
                              src={it.image || it.image_thumbnail} 
                              alt={it.part_name || 'ภาพอะไหล่'} 
                              className="w-24 h-14 object-contain bg-white border border-gray-300 p-0.5 rounded shadow-2xs hover:scale-110 transition-transform" 
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setActiveRowImageIdx(idx);
                                rowImageInputRef.current?.click();
                              }}
                              className="absolute inset-0 bg-black/60 text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                            >
                              เปลี่ยนรูป
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveRowImageIdx(idx);
                              rowImageInputRef.current?.click();
                            }}
                            className="w-24 h-14 bg-gray-50 hover:bg-gray-100 border border-dashed border-gray-300 flex flex-col items-center justify-center mx-auto text-gray-400 hover:text-black cursor-pointer transition-colors"
                          >
                            <Upload size={14} className="mb-0.5" />
                            <span className="text-[10px] font-bold">เพิ่มรูป</span>
                          </button>
                        )}
                      </TableCell>

                      <TableCell className="py-2 px-2">
                        <input
                          type="text"
                          value={it.st_no || ''}
                          placeholder="ST-03137"
                          onChange={e => {
                            const val = e.target.value;
                            setNewItems(prev => prev.map((item, i) => i === idx ? { ...item, st_no: val } : item));
                          }}
                          className="w-full border border-gray-300 p-1.5 text-xs font-mono font-bold text-gray-700 outline-none"
                        />
                      </TableCell>
                      <TableCell className="py-2 px-2">
                        <input
                          type="text"
                          required
                          value={it.part_number || ''}
                          placeholder="8-94456741-0"
                          onChange={e => {
                            const val = e.target.value;
                            setNewItems(prev => prev.map((item, i) => i === idx ? { ...item, part_number: val } : item));
                          }}
                          className="w-full border border-gray-300 p-1.5 text-xs font-mono font-bold text-[#e51c23] bg-red-50/30 outline-none"
                        />
                      </TableCell>
                      <TableCell className="py-2 px-2">
                        <input
                          type="text"
                          required
                          value={it.part_name || ''}
                          placeholder="กรองน้ำมันเครื่อง ST-03137"
                          onChange={e => {
                            const val = e.target.value;
                            setNewItems(prev => prev.map((item, i) => i === idx ? { ...item, part_name: val } : item));
                          }}
                          className="w-full border border-gray-300 p-1.5 text-xs font-bold text-gray-800 outline-none"
                        />
                      </TableCell>
                      <TableCell className="py-2 px-2">
                        <input
                          type="text"
                          value={it.compatible_cars || ''}
                          placeholder="มิตซูบิชิ TROOPER 3.2 เบนซิน"
                          onChange={e => {
                            const val = e.target.value;
                            setNewItems(prev => prev.map((item, i) => i === idx ? { ...item, compatible_cars: val } : item));
                          }}
                          className="w-full border border-gray-300 p-1.5 text-xs text-gray-700 outline-none"
                        />
                      </TableCell>
                      <TableCell className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => setRemoveItemIndex(idx)}
                          className="text-gray-400 hover:text-red-600 p-1"
                        >
                          <Trash2 size={15} />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* BOTTOM ACTION BAR */}
          <div className="bg-white border border-gray-200 p-4 mt-6 shadow-xs flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-xs text-gray-500 font-bold">
              รายการอะไหล่ในเล่มทั้งหมด: <span className="text-[#e51c23] font-extrabold">{newItems.length}</span> รายการ
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setCurrentView('home')}
                className="font-bold text-xs cursor-pointer"
              >
                ยกเลิกและกลับ
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                disabled={saving}
                onClick={handleFormSubmit}
                className="gap-2 font-bold text-xs bg-[#e51c23] hover:bg-[#c9181f] text-white cursor-pointer shadow-xs"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {editingCatalogId ? 'บันทึกการแก้ไข' : 'บันทึกแคตตาล็อกเข้าสู่ระบบ'}
              </Button>
            </div>
          </div>
        </div>

        <ConfirmDialog
          isOpen={removeItemIndex !== null}
          onClose={() => setRemoveItemIndex(null)}
          onConfirm={handleConfirmRemoveItem}
          title="ลบรายการสินค้านี้"
          description="คุณต้องการลบสินค้ารายการนี้ออกใช่หรือไม่?"
          confirmText="ยืนยันการลบ"
          cancelText="ยกเลิก"
          variant="danger"
        />
      </div>
    );
  }

  // =========================================================================
  // VIEW 4: DETAIL VIEW (FULL PAGE VIEW & EMBEDDED PDF VIEWER)
  // =========================================================================
  if (currentView === 'detail' && activeCatalog) {
    return (
      <div className="p-8 max-w-full mx-auto w-full animate-in fade-in duration-300 font-sans">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-xs text-gray-500 mb-4">
          <button 
            type="button" 
            onClick={() => setCurrentView('home')} 
            className="hover:text-[#e51c23] transition-colors cursor-pointer font-bold"
          >
            นำเข้าแคตตาล็อก
          </button>
          <ChevronRight size={14} className="text-gray-400" />
          <span className="text-[#1C1B1B] font-bold">{activeCatalog.catalog_code}</span>
        </nav>

        {/* Detail Header Bar */}
        <div className="bg-white border border-gray-200 p-6 mb-6 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-[#e51c23] text-white text-xs font-black px-2.5 py-0.5 uppercase tracking-wider">
                {activeCatalog.brand}
              </span>
              {activeCatalog.category && (
                <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2.5 py-0.5 border border-gray-200">
                  {activeCatalog.category}
                </span>
              )}
              <span className="text-xs font-mono font-bold text-gray-500 bg-gray-50 px-2 py-0.5 border border-gray-200">
                {activeCatalog.catalog_code}
              </span>
            </div>
            <Heading level="h1" className="mb-0 font-extrabold text-[#1C1B1B] text-xl md:text-2xl">
              {activeCatalog.catalog_name}
            </Heading>
            <div className="flex items-center gap-2 text-xs text-gray-500 pt-1">
              <Building2 size={14} className="text-gray-400" />
              <span>บริษัทคู่ค้า <strong className="text-gray-800">{activeCatalog.supplier_name || suppliers.find(s => s.id === activeCatalog.supplier_id)?.supplier_name || 'ไม่ระบุ'}</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {activeCatalog.catalog_file && (
              <Button
                variant="outline"
                size="md"
                onClick={() => setShowPdfViewer(!showPdfViewer)}
                className="gap-1.5 font-bold text-xs bg-red-50 text-[#e51c23] border-red-200 hover:bg-red-100 cursor-pointer"
              >
                <FileText size={15} /> {showPdfViewer ? 'ซ่อนเอกสาร PDF' : 'เปิดดูไฟล์ PDF แคตตาล็อก'}
              </Button>
            )}
            <Button
              variant="primary"
              size="md"
              onClick={() => handleOpenEdit(activeCatalog)}
              className="gap-1.5 font-bold text-xs bg-[#e51c23] hover:bg-[#c9181f] text-white cursor-pointer shadow-xs"
            >
              <Edit size={15} /> แก้ไขเล่มนี้และจัดการรายการ
            </Button>
          </div>
        </div>

        {/* Embedded PDF Viewer */}
        {showPdfViewer && activeCatalog.catalog_file && (
          <div className="bg-white border border-gray-200 p-4 mb-6 shadow-xs animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-200">
              <span className="text-sm font-extrabold text-[#1C1B1B] flex items-center gap-2">
                <FileText size={16} className="text-[#e51c23]" /> เอกสาร PDF แคตตาล็อกฉบับสมบูรณ์
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={activeCatalog.catalog_file}
                  download={`${activeCatalog.catalog_code}.pdf`}
                  className="text-xs font-bold text-gray-600 hover:text-black flex items-center gap-1 border border-gray-300 px-3 py-1.5 bg-gray-50"
                >
                  <Download size={13} /> ดาวน์โหลด PDF
                </a>
                <button
                  type="button"
                  onClick={() => setShowPdfViewer(false)}
                  className="text-gray-400 hover:text-black p-1"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="w-full h-[700px] bg-gray-100 border border-gray-300">
              <iframe
                src={activeCatalog.catalog_file}
                title="Catalog PDF Viewer"
                className="w-full h-full"
              />
            </div>
          </div>
        )}

        {/* Table Container - Full Width */}
        <div className="bg-white border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-[#1C1B1B] flex items-center gap-2">
              <Layers size={16} className="text-[#e51c23]" />
              รายการอะไหล่ทั้งหมดในเล่ม {activeCatalog.catalog_items?.length || 0} รายการ
            </h3>
          </div>

          <div className="overflow-x-auto">
            <Table className="min-w-[850px]">
              <TableHeader className="bg-gray-100 text-gray-600 text-xs font-bold">
                <TableRow>
                  <TableHead className="py-3 px-3 w-20 text-center">ลำดับที่</TableHead>
                  <TableHead className="py-3 px-3 w-28 text-center">ภาพอะไหล่</TableHead>
                  <TableHead className="py-3 px-3 w-36">รหัสสินค้าคู่ค้า</TableHead>
                  <TableHead className="py-3 px-3 w-40">PART NO (พาร์ทนัมเบอร์)</TableHead>
                  <TableHead className="py-3 px-3">ชื่ออะไหล่</TableHead>
                  <TableHead className="py-3 px-3">รุ่นรถที่รองรับ</TableHead>
                  <TableHead className="py-3 px-3 w-24 text-center">การสั่งจอง</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 text-xs">
                {!activeCatalog.catalog_items || activeCatalog.catalog_items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-gray-400">
                      ยังไม่มีรายการอะไหล่ในเล่มแคตตาล็อกนี้
                    </TableCell>
                  </TableRow>
                ) : (
                  activeCatalog.catalog_items.map((it, idx) => {
                    const cleanSupplierCode = it.remark 
                      ? it.remark.replace(/^S\.T\.\s*NO:\s*/i, '').split('|')[0].trim() 
                      : '-';

                    return (
                      <TableRow key={idx} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="py-3 px-3 text-center font-bold text-gray-400">{idx + 1}</TableCell>
                        <TableCell className="py-2 px-3 text-center">
                          {it.image ? (
                            <img 
                              src={it.image} 
                              alt={it.part_name} 
                              className="w-24 h-14 object-contain bg-gray-50 border border-gray-200 p-0.5 rounded shadow-2xs mx-auto" 
                            />
                          ) : (
                            <div className="w-20 h-12 bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center mx-auto text-gray-300">
                              <ImageIcon size={18} />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-3 px-3 font-mono font-bold text-gray-700">
                          {cleanSupplierCode || '-'}
                        </TableCell>
                        <TableCell className="py-3 px-3 font-mono font-bold text-[#e51c23]">
                          {it.part_number}
                        </TableCell>
                        <TableCell className="py-3 px-3 font-bold text-gray-800">{it.part_name}</TableCell>
                        <TableCell className="py-3 px-3 text-gray-700">
                          <span>{it.compatible_cars || '-'}</span>
                        </TableCell>
                        <TableCell className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => navigate(basePath, { state: { prefillItem: it, catalog: activeCatalog } })}
                            className="bg-[#1C1B1B] hover:bg-black text-white text-[11px] font-bold px-3 py-1.5 transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                          >
                            <ShoppingBag size={13} className="text-[#e51c23]" /> สั่งจอง
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
