import { isValidQuantity, validatePurchaseOrder } from './validation';
// React Libraries
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Building2, ChartNoAxesCombined, Info, ScanBarcode, ShoppingBag, ChevronRight, ShoppingCart, Plus, Minus, Trash2, MessageSquareMore} from 'lucide-react';
// Components
import Heading from '../../../components/elements/heading';
import Button from '../../../components/elements/button';
import Input from '../../../components/elements/input';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/elements/card';
import Select from '../../../components/elements/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter } from "../../../components/elements/table";
import ConfirmDialog from '../../../components/elements/confirm_dialog';
import { useToast } from '../../../components/elements/toast';
import { PreorderSelectionModal } from './components/PreorderSelectionModal';
// Interface
import type { CreatePORequest, LocalPOItem, PreorderItem, POAnalyticsResponse } from '../../../interface/purchase_orders/po_interface';
// Service & Utils
import { poService } from '../../../service/http/purchase_orders/po_service';
import { getSuppliersList } from '../../../service/http/wms/product';
import { getTodayDateString } from '../../../utils/formatdate';
import { generateLocalId } from '../../../utils/generateId';
// Hooks
import { usePoScanner } from './hooks/usePOScanner'; 
import { usePreorders } from './hooks/usePreorder';
// Utils
import { usePathBasePrefix } from '../../../utils/usePathBasePrefix';

const CreatePurchaseOrders: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const basePath = usePathBasePrefix();
    const { toast } = useToast();
    // States ของ API
    const [item, setItem] = useState<LocalPOItem[]>([]);
    const [totalItems, setTotalItems] = useState(0);
    const [date, setDate] = useState<string>(getTodayDateString());
    const [notes, setNotes] = useState("")
    const [isPreorderModalOpen, setIsPreorderModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    // States สำหรับ Supplier (ตัวเลือก Dropdown)
    const [listsSupplier, setlistsSupplier] = useState("");
    const [supplierOptions, setSupplierOptions] = useState<{label: string, value: string}[]>([]);
    // Hook การสแกนและค้นหาสินค้า
    const searchInputRef = useRef<HTMLInputElement>(null);
    const quantityInputRef = useRef<HTMLInputElement>(null);
    const { searchInput, addQuantity, setAddQuantity, searchResults, handleSearchInput, handleSelectProduct,
        handleAddItem, handleSearchKeyDown, highlightedIndex, setHighlightedIndex, selectedProduct, isSearching,
        duplicatePrompt, confirmDuplicateAdd, cancelDuplicateAdd } = usePoScanner(listsSupplier, item, setItem);
    // ดึงข้อมูลจาก Hook เรียกรายการพรีออเดอร์
    const { preorders, totalPreorders, isLoading: isPreordersLoading } = usePreorders(item, setItem, setIsPreorderModalOpen);
    // สิทธิ์เจ้าของร้าน: กดอนุมัติแล้วอนุมัติทันทีโดยไม่ต้องรอ
    const userRole = localStorage.getItem('role');
    const isOwner = userRole?.toUpperCase() === 'OWNER';
    // สำหรับดึงข้อมูลคาดการณ์ระยะเวลาจัดส่ง
    const [deliveryEstimate, setDeliveryEstimate] = useState<POAnalyticsResponse | null>(null);
    const [isEstimateLoading, setIsEstimateLoading] = useState(false);
    // เก็บค่าที่ผู้ใช้กำลังพิมพ์อยู่ (ระหว่างลบเลขเดิมทิ้งแล้วยังพิมพ์ไม่เสร็จ) แยกจาก items จริง
    const [qtyDrafts, setQtyDrafts] = useState<Record<string | number, string>>({});
    const [showValidation, setShowValidation] = useState(false);
    const validationErrors = validatePurchaseOrder(listsSupplier, item, qtyDrafts);
    const validateForm = () => {
        setShowValidation(true);
        if (validationErrors.length === 0) return true;
        toast({ title: 'กรุณาตรวจสอบข้อมูลใบสั่งซื้อ', message: validationErrors[0], variant: 'warning' });
        return false;
    };
    // เก็บ supplier ที่รอยืนยันเปลี่ยน (ถ้ามีของในตะกร้าอยู่แล้ว)
    const [pendingSupplierId, setPendingSupplierId] = useState<string | null>(null);
    // เก็บ key ของรายการที่รอยืนยันลบเนื่องจากจำนวนเหลือ 0
    const [removeConfirm, setRemoveConfirm] = useState<{ key: number | string } | null>(null);

    // อัปเดต totalItems อัตโนมัติเมื่อตะกร้า (item) มีการเปลี่ยนแปลง
    useEffect(() => {
        setTotalItems(item.length);
    }, [item]);
    // คำนวณจำนวนหน่วยรวม
    const totalQuantity = React.useMemo(
        () => item.reduce((sum, row) => sum + row.quantity, 0),
        [item]
    );
    // คำนวณราคาสั่งซื้อโดยประมาณ
    const totalEstimatedPrice = React.useMemo(
        () => item.reduce((sum, row) => sum + row.sub_total, 0),
        [item]
    );

    // ดึงข้อมูล Supplier ตอนโหลดหน้า
    useEffect(() => {
        const fetchSuppliers = async () => {
            try {
                const suppliers = await getSuppliersList();
                
                const formattedOptions = suppliers.map((sup) => ({
                    label: sup.name, // ชื่อที่จะแสดงให้ผู้ใช้เห็น
                    value: sup.id.toString(), // ID ที่จะถูกบันทึกลง State เมื่อถูกเลือก
                }));

                setSupplierOptions(formattedOptions);
            } catch (error) {
                console.error('ไม่สามารถดึงข้อมูลซัพพลายเออร์ได้:', error);
            }
        };

        fetchSuppliers();
    }, []);

    // Pre-fill จาก stock alert modal ของ dashboard (navigate state)
    useEffect(() => {
        const state = location.state as {
            supplierId?: string;
            preselectedItems?: LocalPOItem[];
        } | null;
        if (!state?.supplierId) return;

        setlistsSupplier(state.supplierId);
        if (state.preselectedItems && state.preselectedItems.length > 0) {
            setItem(state.preselectedItems);
        }
        // ล้าง state ออกจาก history เพื่อกัน re-fill เมื่อ navigate back
        window.history.replaceState({}, '');
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ดึงข้อมูลคาดการณ์ระยะเวลาจัดส่งของ Supplier ที่เลือก
    useEffect(() => {
        const fetchDeliveryEstimate = async () => {
            if (!listsSupplier) {
                setDeliveryEstimate(null);
                return;
            }

            setIsEstimateLoading(true);
            try {
                const estimate = await poService.getSupplierDeliveryEstimate(listsSupplier);
                setDeliveryEstimate(estimate);
            } catch (error) {
                console.error("โหลดข้อมูลคาดการณ์การจัดส่งล้มเหลว:", error);
                setDeliveryEstimate(null);
            } finally {
                setIsEstimateLoading(false);
            }
        };

        fetchDeliveryEstimate();
    }, [listsSupplier]);

    // เมื่อมีการเลือกสินค้า (จาก Enter ในช่องค้นหา หรือคลิก dropdown) ให้เด้งไปช่องจำนวน
    useEffect(() => {
        if (selectedProduct) {
            quantityInputRef.current?.focus();
        }
    }, [selectedProduct]);

    // Function เตือนก่อนว่ามีของในใบสั่งซื้ออยู่ ถ้าเปลี่ยนบริษัทจะดึง Stock Alert ชุดใหม่มาทับตะกร้าเดิม
    const handleSupplierChange = (newSupplierId: string) => {
        if (newSupplierId === listsSupplier) return;
        if (item.length > 0) {
            setPendingSupplierId(newSupplierId);
            return;
        }
        setlistsSupplier(newSupplierId);
    };

    const confirmSupplierChange = () => {
        if (pendingSupplierId !== null) setlistsSupplier(pendingSupplierId);
        setItem([]);
        setQtyDrafts({});
        setPendingSupplierId(null);
    };

    // 3. ฟังก์ชันสำหรับรับรายการพรีออเดอร์ที่ถูกกด "เพิ่ม" มาแปลงใส่ลงตารางใบสั่งซื้อ (item)
    const handleAddPreorderToPO = (selectedPreorder: PreorderItem) => {
        // ใช้ราคาที่ตกลงกันไว้ตอนสร้างพรีออเดอร์ (ไม่ใช่ 0) แล้วให้แก้ไขได้ทีหลังในตาราง
        const unitCost = Number(selectedPreorder.unit_price || 0);
        
        const newItem: LocalPOItem = {
            id: generateLocalId(), 
            product_id: selectedPreorder.product_id,
            product_name_snapshot: selectedPreorder.product_name,
            product_code_snapshot: selectedPreorder.product_code || "-",
            supply_product_code_snapshot: selectedPreorder.supplier_part_code || "",
            quantity: selectedPreorder.quantity,
            unit: selectedPreorder.unit || "ชิ้น",
            unit_price: unitCost,
            sub_total: unitCost * selectedPreorder.quantity,
            order_type: 'พรีออเดอร์', // มาจากพรีออเดอร์ ราคาแก้ไขได้ในตาราง
            pre_order_item_id: selectedPreorder.id
        };

        const isDuplicate = item.some(existingItem =>
            existingItem.pre_order_item_id === selectedPreorder.id &&
            existingItem.order_type === newItem.order_type
        );

        if (isDuplicate) {
            toast({ title: 'เกิดข้อผิดพลาด', message: `มีรายการ "${selectedPreorder.product_name}" ประเภท ${newItem.order_type} อยู่ในใบสั่งซื้อแล้ว`, variant: 'warning' });
            return;
        }

        // เพิ่มเข้าตะกร้าหลัก (ตารางด้านล่างของจอ)
        setItem(prev => [...prev, newItem]);
        
        // ปิด Modal อัตโนมัติเมื่อกดเพิ่ม ให้ปลดคอมเมนต์บรรทัดล่าง
        setIsPreorderModalOpen(false);
    };

    // Function แก้ไขจำนวน หรือราคาต่อหน่วย (เฉพาะแถวพรีออเดอร์) ของรายการในใบสั่งซื้อ
    const handleUpdateItem = (id: number, field: 'quantity' | 'unit_price', rawValue: string) => {
        const numValue = Number(rawValue);
        const safeValue = isNaN(numValue) || numValue < 0 ? 0 : numValue;

        setItem(prev => prev.map(row => {
            if (row.id !== id) return row;
            // กันไว้อีกชั้น: ห้ามแก้ราคาของแถวที่ไม่ใช่พรีออเดอร์ แม้จะถูกเรียกผิดทางก็ตาม
            if (field === 'unit_price' && row.order_type !== 'พรีออเดอร์') return row;
            const updatedRow = { ...row, [field]: safeValue };
            updatedRow.sub_total = updatedRow.quantity * updatedRow.unit_price;
            return updatedRow;
        }));
    };

    // ฟังก์ชัน: ลบสินค้าออกจากตาราง
    const handleRemoveItem = (idToRemove: string) => {
        const updatedItems = item.filter(product => product.id.toString() !== idToRemove);
        setItem(updatedItems);
    };

    const confirmRemoveItem = () => {
        if (removeConfirm) handleRemoveItem(removeConfirm.key.toString());
        setRemoveConfirm(null);
    };

    // ฟังก์ชัน: บันทึกร่าง / ส่งอนุมัติ
    const handleSavePO = async (submitStatus: 'DRAFT' | 'PENDING') => {
        if (isSaving) return;
        if (removeConfirm || !validateForm()) return;

        setIsSaving(true);
        try {
            // เตรียมข้อมูลรายการสินค้า
            const poItemsPayload = item.map((p) => ({
                product_id: p.product_id,
                quantity: Number(qtyDrafts[p.id] ?? p.quantity),
                unit_price: p.unit_price,
                alert_id: p.alert_id,
                pre_order_item_id: p.pre_order_item_id,
            }));

            // สร้าง Payload และแนบ status ตามที่ปุ่มส่งมา
            const payload: CreatePORequest = {
                supplier_id: Number(listsSupplier), 
                notes: notes,
                status: submitStatus, // ส่งสถานะ DRAFT หรือ PENDING ไปที่ Backend
                po_items: poItemsPayload,
            };

            // เรียกใช้ API ตัวเดียวกันได้เลย
            const response = await poService.createPurchaseOrder(payload);
            const createdPoNumber = response?.po_number || "";

            // Backend รุ่นใหม่จะสร้างเป็น APPROVED ให้ Owner ตั้งแต่ transaction แรก
            // fallback ด้านล่างยังรองรับ backend รุ่นเก่าระหว่าง deploy
            let message = submitStatus === 'DRAFT'
                ? `บันทึกฉบับร่าง ${createdPoNumber} เรียบร้อยแล้ว`
                : `ส่งใบสั่งซื้อ ${createdPoNumber} เพื่อขออนุมัติเรียบร้อยแล้ว`;

            if (submitStatus === 'PENDING' && isOwner && response?.id) {
                try {
                    if (response.status !== 'APPROVED') {
                        await poService.updatePOStatus(response.id, 'APPROVED');
                    }
                    message = `อนุมัติใบสั่งซื้อ ${createdPoNumber} เรียบร้อยแล้ว`;
                } catch (approveError: any) {
                    // สร้าง PO สำเร็จแล้ว แต่อนุมัติอัตโนมัติไม่สำเร็จ -> แจ้งเตือนแยก ไม่บล็อกการสร้าง
                    const approveMessage = approveError?.response?.data?.message || approveError?.message;
                    toast({ title: 'สร้างใบสั่งซื้อสำเร็จ แต่อนุมัติอัตโนมัติไม่สำเร็จ', message: approveMessage || 'กรุณาเข้าไปอนุมัติที่รายละเอียดใบสั่งซื้อ', variant: 'warning' });
                    navigate(`${basePath}/orders`);
                    return;
                }
            }

            toast({ title: 'ดำเนินการสำเร็จ', message, variant: 'success' });
            navigate(`${basePath}/orders`); // กลับไปหน้ารวม
        } catch (error: any) {
            const backendMessage = error?.response?.data?.message || error?.message;
            toast({ title: 'เกิดข้อผิดพลาด', message: backendMessage || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง', variant: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleQtyDraftChange = (key: number | string, rawValue: string) => {
        setQtyDrafts(prev => ({ ...prev, [key]: rawValue }));
    };

    // ตอนออกจากช่อง (blur) ค่อย commit ค่าจริง
    const handleQtyBlur = (id: number, key: number | string) => {
        const raw = qtyDrafts[key];
        if (raw === undefined) return; // ไม่ได้แก้ไขอะไร

        const trimmed = raw.trim();
        if (!isValidQuantity(Number(trimmed))) {
            setShowValidation(true);
            return;
        }
        handleUpdateItem(id, 'quantity', trimmed);
        setQtyDrafts(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };    

    return (
        <div className='p-8 space-y-6 bg-white min-h-screen'>
            {showValidation && validationErrors.length > 0 && (
                <div role="alert" className="border border-red-300 bg-red-50 p-4 text-sm text-red-700">
                    <p className="font-medium">กรุณาตรวจสอบข้อมูลใบสั่งซื้อ</p>
                    <ul className="list-disc pl-5 mt-2">
                        {validationErrors.map(message => <li key={message}>{message}</li>)}
                    </ul>
                </div>
            )}
            { /* Header */ }
            <div className='flex items-center justify-between'>
                <div className='flex-col space-y-2'>
                    <nav className='flex items-center text-sm text-gray-500 gap-2 font-light'>
                        <Link to={`${basePath}/orders`} className='hover:text-gray-900 transition-colors cursor-pointer'>
                            จัดการใบสั่งซื้อ
                        </Link>
                        <ChevronRight size={16} className='text-gray-400' />                        
                        <span className='text-black font-normal'>สร้างใบสั่งซื้อสินค้าใหม่</span>
                    </nav>
                    <Heading level='h1' weight='semibold' className='m-0 text-black'>
                        สร้างใบสั่งซื้อสินค้าใหม่
                    </Heading>
                </div>
                <div className='flex items-end gap-4 justify-end'>
                    <Button size='md' variant='tertiary' disabled={isSaving} onClick={() => handleSavePO('DRAFT')}>{isSaving ? "กำลังบันทึก..." : "บันทึกฉบับร่าง"}</Button>
                    <Button size='md' disabled={isSaving} onClick={() => handleSavePO('PENDING')}>
                        {isSaving ? (isOwner ? "กำลังอนุมัติใบสั่งซื้อ..." : "กำลังส่งอนุมัติ...") : (isOwner ? "อนุมัติใบสั่งซื้อ" : "ส่งอนุมัติ")}
                    </Button>
                </div>
            </div>

            { /* Contents */ }
            { /* Left Side */ }
            <div className='flex gap-6 items-start'>
                <div className='w-1/4 flex flex-col gap-6'>
                    <Card className='border-l-[5px] border-l-red-800'>
                        <CardHeader className='items-center justify-start gap-4 mt-2 mb-2'>
                            <CardTitle className='text-base text-red-800'><Building2 size={24} /></CardTitle>
                            <CardTitle className='text-lg text-black'>รายละเอียดบริษัท</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className='grid grid-rows-2 gap-6 items-end mb-2'>
                                <Select 
                                    label='ชื่อบริษัท/ผู้จัดจำหน่าย'
                                    value={listsSupplier}
                                    onChange={(e) => handleSupplierChange(e.target.value)}
                                    options={[
                                        { label: "เลือกบริษัท/ผู้จัดจำหน่าย...", value: "" },
                                        ...supplierOptions 
                                    ]}
                                />
                                <Input
                                    type='date'
                                    label='วันที่สั่งซื้อ'
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className='border-l-[5px] border-l-black'>
                        <CardHeader className='items-center justify-start gap-4 mt-2 mb-2'>
                            <CardTitle className='text-base text-black'><ShoppingBag size={24} /></CardTitle>
                            <CardTitle className='text-lg text-black'>รายการพรีออเดอร์</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className='flex items-center justify-between h-fit'>
                                <Heading level='p' weight='light'>
                                    {isPreordersLoading ? (
                                        "กำลังดึงข้อมูล..."
                                    ) : (
                                        <>
                                            มีรายการพรีออเดอร์ค้างอยู่ <strong className='font-medium'>{totalPreorders}</strong> รายการ
                                        </>
                                    )}
                                </Heading>
                                
                                {/* 4. สั่งให้ปุ่มตั้งค่า Modal เป็นเปิด */}
                                <Button 
                                    variant='tertiary' 
                                    size='sm'
                                    disabled={!listsSupplier || isPreordersLoading || totalPreorders === 0}
                                    onClick={() => setIsPreorderModalOpen(true)}
                                >
                                    เลือกรายการ
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                    {listsSupplier && (
                        <div className='bg-[#22252a] text-white rounded-none p-6 h-fit shadow-sm relative overflow-hidden'>
                            <div className='absolute right-4 top-4 opacity-5 pointer-events-none'>
                                <ChartNoAxesCombined size={48} />
                            </div>
                            <div>
                                <Heading level='h5' weight='semibold' className='text-white'>ข้อมูลวิเคราะห์จากระบบ</Heading>

                                {isEstimateLoading ? (
                                    <Heading level='p' weight='light' className='text-white mt-3'>
                                        กำลังวิเคราะห์ข้อมูล...
                                    </Heading>
                                ) : !deliveryEstimate?.has_enough_data ? (
                                    <Heading level='p' weight='light' className='text-white mt-3'>
                                        บริษัทรายนี้มีประวัติการจัดส่งไม่เพียงพอสำหรับการคาดการณ์ระยะเวลาจัดส่ง
                                    </Heading>
                                ) : (
                                    <>
                                        <Heading level='p' weight='light' className='text-white mt-3'>
                                            โดยปกติบริษัทรายนี้จะใช้เวลาจัดส่งประมาณ {deliveryEstimate.estimated_days} วันทำการ
                                            เราขอแนะนำให้คุณวางแผนการขนส่งล่วงหน้าตามนั้น
                                        </Heading>
                                        <div className='flex items-center justify-start gap-3 mt-3'>
                                            <Heading className='text-base text-white w-auto m-0'>{<Info size={16} />}</Heading>
                                            <Heading level='p' weight='light' className='text-white w-auto m-0'>
                                                ระยะเวลาการจัดส่ง: แม่นยำร้อยละ {deliveryEstimate.accuracy_rate}
                                            </Heading>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                    <Card>
                        <CardHeader className='items-center justify-start gap-4 mt-2 mb-2'>
                            <CardTitle className='text-base text-black'><MessageSquareMore size={24} /></CardTitle>
                            <CardTitle className='text-lg text-black'>ข้อความถึงเจ้าของร้าน</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Input
                                placeholder="ฝากข้อความถึงเจ้าของร้านที่นี่..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </CardContent>
                    </Card>
                </div>

                { /* Right Side */ }
                <div className='flex flex-col items-start w-3/4 gap-4'>
                    <Card className='flex items-center w-full h-fit bg-white p-4 gap-4'>
                        <div className='relative flex-1'>
                            <Input
                                ref={searchInputRef} // ผูก Ref เข้ากับ Input
                                value={searchInput}
                                onChange={(e) => handleSearchInput(e.target.value)}
                                onKeyDown={handleSearchKeyDown}
                                className='bg-transparent border-none shadow-none focus:outline-none'
                                disabled={!listsSupplier}
                                leftIcon={
                                    <div className='pointer-events-auto relative z-10 flex items-center justify-center'>
                                        <ScanBarcode 
                                            className={`w-6 h-6 transition-colors ${
                                                !listsSupplier 
                                                ? 'text-gray-300 cursor-not-allowed' 
                                                : 'text-gray-500 cursor-pointer hover:text-gray-700'
                                            }`} 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (!listsSupplier) {
                                                    toast({ title: 'เกิดข้อผิดพลาด', message: 'กรุณาเลือกผู้จัดจำหน่ายก่อน', variant: 'error' });
                                                    return;
                                                }
                                                // แทนที่จะเปิด Prompt ให้ทำการ Focus ไปที่ช่อง Input เพื่อให้พร้อมยิงบาร์โค้ด
                                                searchInputRef.current?.focus();
                                            }} 
                                        />
                                    </div>
                                }
                                placeholder="สแกนหรือพิมพ์ รหัส / ชื่อสินค้า..."
                            />
                            
                            {/* เพิ่ม Dropdown แสดงผลลัพธ์การค้นหา (รวมสถานะกำลังค้นหา/ไม่พบผลลัพธ์ เพื่อไม่ให้ดูเหมือนพิมพ์แล้วไม่มีอะไรเกิดขึ้น) */}
                            {searchInput.trim().length > 0 && !(selectedProduct && searchInput === selectedProduct.name) && (
                                <div className='absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-none shadow-lg'>
                                    {isSearching ? (
                                        <div className='px-4 py-3 text-sm text-gray-400'>กำลังค้นหา...</div>
                                    ) : searchResults.length > 0 ? (
                                        searchResults.map((product, index) => (
                                            <div
                                                key={product.id}
                                                className={`px-4 py-2 cursor-pointer text-sm ${
                                                    index === highlightedIndex ? 'bg-gray-100' : 'hover:bg-gray-100'
                                                }`}
                                                onMouseEnter={() => setHighlightedIndex(index)}
                                                onClick={() => handleSelectProduct(product)}
                                            >
                                                <div className='flex flex-row font-normal text-black items-baseline justify-between'>
                                                    <div>{product.name}</div>
                                                    <span className='text-red-600'>฿{product.price.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                </div>
                                                <div className='flex flex-row items-baseline justify-between text-gray-500 text-xs font-light'>
                                                    <span>รหัสร้าน: {product.code}</span>
                                                    <span>คงเหลือ: {product.stock_qty}</span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className='px-4 py-3 text-sm text-gray-400'>ไม่พบสินค้าที่ตรงกับคำค้นหา</div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className='w-px h-8 bg-gray-300/60 mx-1'></div>

                        <Input
                            ref={quantityInputRef}
                            type='number'
                            min={1}
                            step={1}
                            value={addQuantity}
                            onChange={(e) => {
                                const val = e.target.value;
                                setAddQuantity(val === "" ? "" : Math.max(0, Number(val)));
                            }}
                            onKeyDown={(e) => {
                                // เมื่ออยู่ช่องจำนวน แล้วกด Enter -> เพิ่มลงบิล -> เด้งกลับช่องค้นหา
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const isSuccess = handleAddItem();
                                    if (isSuccess) searchInputRef.current?.focus();
                                }
                            }}
                            containerClassName='w-32 shrink-0'
                            className='bg-transparent border-none shadow-none text-center px-1 focus:outline-none'
                            placeholder='จำนวน'
                        />

                        {/* เพิ่ม onClick */}
                        <Button size='md' variant='secondary' onClick={handleAddItem}>
                            เพิ่มลงใบสั่งซื้อ
                        </Button>
                    </Card>
                    <Card className='w-full overflow-hidden' noPadding>
                        <Table>
                            <TableHeader className='bg-gray-100 text-gray-600'>
                                <TableRow>
                                    <TableHead className='pl-6'>ลำดับ</TableHead>
                                    <TableHead>ประเภท</TableHead>
                                    <TableHead>รหัสสินค้า</TableHead>
                                    <TableHead>ชื่อสินค้า</TableHead>
                                    <TableHead className='text-center'>จำนวนต่อหน่วย</TableHead>
                                    <TableHead className='text-center'>หน่วย</TableHead>
                                    <TableHead className='text-center'>ราคาต่อหน่วย</TableHead>
                                    <TableHead className='text-right pr-6'>ราคารวม</TableHead>
                                    <TableHead className='text-center'>จัดการ</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody className='text-gray-700'>
                                {item.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className='py-16'>
                                        <div className='flex flex-col items-center justify-center gap-4 text-gray-500'>
                                            <ShoppingCart size={96} className='text-gray-300' />
                                            <span>ไม่พบข้อมูลรายการสินค้า กรุณาเพิ่มสินค้า</span>
                                        </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    item.map((row, index) => (
                                        <TableRow key={row.id}>
                                            <TableCell className='pl-6'>{index + 1}</TableCell>
                                            <TableCell>{row.order_type}</TableCell>
                                            <TableCell>{row.product_code_snapshot || '-'}</TableCell>
                                            <TableCell>{row.product_name_snapshot}</TableCell>
                                            <TableCell className='text-center'>
                                                <div className='inline-flex items-center border border-gray-300 rounded-none bg-[#F6F3F2]'>
                                                    <button
                                                        type='button'
                                                        disabled={row.order_type === 'พรีออเดอร์'}
                                                        onClick={() => {
                                                            setQtyDrafts(prev => {
                                                                const next = { ...prev };
                                                                delete next[row.id];
                                                                return next;
                                                            });
                                                            if (row.quantity <= 1) {
                                                                setRemoveConfirm({ key: row.id });
                                                                return;
                                                            }
                                                            handleUpdateItem(row.id, 'quantity', String(row.quantity - 1));
                                                        }}
                                                        className={`p-1.5 px-2 text-gray-600 transition-colors ${row.order_type === 'พรีออเดอร์' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:text-black'}`}
                                                    >
                                                        <Minus size={14} />
                                                    </button>
                                                    <input
                                                        type='text'
                                                        inputMode='numeric'
                                                        disabled={row.order_type === 'พรีออเดอร์'}
                                                        value={qtyDrafts[row.id] !== undefined ? qtyDrafts[row.id] : String(row.quantity)}
                                                        onChange={(e) => {
                                                            const raw = e.target.value;
                                                            if (raw !== '' && !/^\d*$/.test(raw)) return;
                                                            handleQtyDraftChange(row.id, raw);
                                                        }}
                                                        onBlur={() => handleQtyBlur(row.id, row.id)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                                        }}
                                                        className={`w-10 text-center bg-transparent border-none focus:outline-none focus:ring-0 text-sm p-0 m-0 font-medium text-black [appearance:textfield] 
                                                            [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${row.order_type === 'พรีออเดอร์' ? 'cursor-not-allowed text-gray-400' : ''}`}
                                                    />
                                                    <button
                                                        type='button'
                                                        disabled={row.order_type === 'พรีออเดอร์'}
                                                        onClick={() => {
                                                            setQtyDrafts(prev => {
                                                                const next = { ...prev };
                                                                delete next[row.id];
                                                                return next;
                                                            });
                                                            handleUpdateItem(row.id, 'quantity', String(row.quantity + 1));
                                                        }}
                                                        className={`p-1.5 px-2 text-gray-600 transition-colors ${row.order_type === 'พรีออเดอร์' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:text-black'}`}
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                </div>
                                            </TableCell>
                                            <TableCell className='text-center'>{row.unit}</TableCell>
                                            <TableCell className='text-right pr-10'>{(row.unit_price ?? 0).toLocaleString()} ฿</TableCell>
                                            <TableCell className='text-right pr-6'>{row.sub_total.toLocaleString()} ฿</TableCell>
                                            <TableCell className='text-center'>
                                                <button 
                                                    onClick={() => handleRemoveItem(row.id.toString())}
                                                    className='text-red-500 hover:text-red-700 font-light'
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                            <TableFooter>
                                <TableRow>
                                    <TableCell colSpan={9} className='py-5'>
                                        <div className='flex items-center justify-end gap-10 pr-4'>
                                            <div className='flex flex-col items-center gap-1'>
                                                <span className='text-sm text-gray-500 font-light'>รายการทั้งหมด</span>
                                                <span className='text-2xl font-semibold text-gray-900'>
                                                    {totalItems} <span className='text-sm font-normal text-gray-500'>รายการ</span>
                                                </span>
                                            </div>

                                            <div className='w-px h-10 bg-gray-200'></div>

                                            <div className='flex flex-col items-center gap-1'>
                                                <span className='text-sm text-gray-500 font-light'>จำนวนทั้งหมด</span>
                                                <span className='text-2xl font-semibold text-gray-900'>
                                                    {totalQuantity} <span className='text-sm font-normal text-gray-500'>หน่วย</span>
                                                </span>
                                            </div>

                                            <div className='w-px h-10 bg-gray-200'></div>

                                            <div className='flex flex-col items-center gap-1'>
                                                <span className='text-sm text-gray-500 font-light'>ราคาสั่งซื้อโดยประมาณ</span>
                                                <span className='text-2xl font-semibold text-red-600'>
                                                    {totalEstimatedPrice.toLocaleString()} <span className='text-sm font-normal text-gray-500'>บาท</span>
                                                </span>
                                            </div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </Card>
                </div>
            </div>
            <PreorderSelectionModal
                isOpen={isPreorderModalOpen}
                onClose={() => setIsPreorderModalOpen(false)}
                preorders={preorders}
                onSelectPreorder={handleAddPreorderToPO}
            />

            <ConfirmDialog
                isOpen={pendingSupplierId !== null}
                onClose={() => setPendingSupplierId(null)}
                onConfirm={confirmSupplierChange}
                title='ยืนยันการเปลี่ยนบริษัท/ผู้จัดจำหน่าย'
                description='การเปลี่ยนบริษัท/ผู้จัดจำหน่ายจะล้างรายการสินค้าที่เพิ่มไว้ในตะกร้าปัจจุบันทั้งหมด ต้องการดำเนินการต่อหรือไม่?'
                confirmText='ยืนยัน'
                variant='warning'
            />

            <ConfirmDialog
                isOpen={!!removeConfirm}
                onClose={() => setRemoveConfirm(null)}
                onConfirm={confirmRemoveItem}
                title='ยืนยันการลบรายการ'
                description='จำนวนสินค้าจะเหลือ 0 ต้องการลบรายการนี้ออกจากตะกร้าหรือไม่?'
                confirmText='ลบ'
                variant='danger'
            />

            <ConfirmDialog
                isOpen={!!duplicatePrompt}
                onClose={cancelDuplicateAdd}
                onConfirm={confirmDuplicateAdd}
                title='สินค้านี้มีอยู่ในใบสั่งซื้อแล้ว'
                description={
                    duplicatePrompt
                        ? `สินค้า "${duplicatePrompt.product.name}" มีอยู่ในใบสั่งซื้อแล้ว ${duplicatePrompt.existingQty} ${duplicatePrompt.unit} ต้องการเพิ่มอีก ${duplicatePrompt.addQty} ${duplicatePrompt.unit} รวมเป็น ${duplicatePrompt.existingQty + duplicatePrompt.addQty} ${duplicatePrompt.unit} ใช่หรือไม่?`
                        : ''
                }
                confirmText='ยืนยัน'
                variant='warning'
            />
        </div>
    )
}

export default CreatePurchaseOrders;
