import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { Building2, ChevronRight, ClipboardClock, FileText, User, Trash2, Minus, Plus, Search, ChevronDown, MessageSquareWarning } from 'lucide-react';
// Components
import Heading from '../../../components/elements/heading';
import Badge from '../../../components/elements/badge';
import Card from '../../../components/elements/card';
import Input from '../../../components/elements/input';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '../../../components/elements/table';
import Button from '../../../components/elements/button';
import ConfirmDialog from '../../../components/elements/confirm_dialog';
import { useToast } from '../../../components/elements/toast';
import { PreorderSelectionModal } from './components/PreorderSelectionModal';
// Interface
import type { POResponse, LocalPOItem, POAnalyticsResponse } from '../../../interface/purchase_orders/po_interface';
// Service
import { poService } from '../../../service/http/purchase_orders/po_service';
import { formatDate } from '../../../utils/formatdate';
// Hook
import { usePoScanner } from './hooks/usePOScanner';
import { usePreorders } from './hooks/usePreorder';
// Utils
import { usePathBasePrefix } from '../../../utils/usePathBasePrefix';

// Map Status Eng -> Thai
const STATUS_LABEL: Record<string, string> = {
    DRAFT: 'ฉบับร่าง',
    PENDING: 'รออนุมัติ',
    APPROVED: 'อนุมัติแล้ว',
    RESUBMITTED: 'รอส่งอนุมัติใหม่',
    CANCELLED: 'ยกเลิกแล้ว',
    DELETED: 'อยู่ในถังขยะ',
};

// ฟังก์ชันสำหรับเช็คหัวข้อ
const getPageTitle = (status: string, role: string | null): string => {
    if (status === 'PENDING' && role !== 'Owner') {
        return 'รายละเอียดใบสั่งซื้อ';
    }
    const titles: Record<string, string> = {
        DRAFT: 'รายละเอียดใบสั่งซื้อ',
        PENDING: 'ตรวจสอบและอนุมัติใบสั่งซื้อ',
        APPROVED: 'รายละเอียดใบสั่งซื้อ',
        RESUBMITTED: 'แก้ไขใบสั่งซื้อเพื่อส่งอนุมัติใหม่',
        CANCELLED: 'รายละเอียดใบสั่งซื้อ',
        DELETED: 'รายละเอียดใบสั่งซื้อ',
    };
    return titles[status] || 'รายละเอียดใบสั่งซื้อ';
};

// ฟังก์ชันสำหรับเช็คคำอธิบายใต้หัวข้อ
const getPageSubtitle = (status: string, role: string | null): string => {
    if (status === 'PENDING' && role !== 'Owner') {
        return 'ใบสั่งซื้อนี้อยู่ระหว่างรอการอนุมัติจากเจ้าของร้าน';
    }
    const subtitles: Record<string, string> = {
        DRAFT: 'ใบสั่งซื้อนี้เป็นฉบับร่าง',
        PENDING: 'กรุณาตรวจสอบรายการสินค้าและยอดประเมินก่อนทำการอนุมัติ',
        APPROVED: 'ใบสั่งซื้อนี้ได้รับการอนุมัติเรียบร้อยแล้ว',
        RESUBMITTED: 'ใบสั่งซื้อนี้ถูกตีกลับ คุณสามารถแก้ไขรายการและส่งอนุมัติใหม่ได้',
        CANCELLED: 'ใบสั่งซื้อนี้ถูกยกเลิกโดยเจ้าของร้าน',
        DELETED: 'ใบสั่งซื้อนี้อยู่ในถังขยะ คุณสามารถกู้คืนเพื่อแก้ไขและส่งอนุมัติใหม่ได้',
    };
    return subtitles[status] || '';
};

function OrderDetail() {
    const navigate = useNavigate();
    const basePath = usePathBasePrefix();
    const { toast } = useToast();
    // ดึง id จาก URL มาใช้งาน (เช่น เอาไป Fetch API ต่อ)
    const { id } = useParams();
    const userRole = localStorage.getItem('role');
    const [po, setPo] = useState<POResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState<LocalPOItem[]>([]);
    const [activeAction, setActiveAction] = useState<'draft' | 'submit' | 'approve' | 'resubmitted' | 'restore' | null>(null);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [rejectMode, setRejectMode] = useState<'cancel' | 'return' | null>(null);
    // เปิด/ปิด modal ยืนยันการกู้คืนใบสั่งซื้อ
    const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
    // เก็บ key ของรายการที่รอยืนยันลบ พร้อมเหตุผล (ลบเอง หรือ จำนวนเหลือ 0)
    const [removeConfirm, setRemoveConfirm] = useState<{ key: number | string; reason: 'manual' | 'zero-qty' } | null>(null);
    // เก็บค่าที่ผู้ใช้กำลังพิมพ์อยู่ (ระหว่างลบเลขเดิมทิ้งแล้วยังพิมพ์ไม่เสร็จ) แยกจาก items จริง
    const [qtyDrafts, setQtyDrafts] = useState<Record<string | number, string>>({});
    // เก็บ id ของรายการที่ "มีอยู่แล้วจริงใน DB" ตอนโหลดหน้ามาครั้งแรก
    // ใช้แยกว่ารายการไหนเป็นของเดิม (ต้องส่ง id ตอนบันทึก) กับรายการที่เพิ่งเพิ่มระหว่างแก้ไข (ไม่ส่ง id ให้ backend สร้างเอง)
    const [initialItemIds, setInitialItemIds] = useState<Set<number>>(new Set());
    // เปิด/ปิดแถบค้นหา-สแกนสินค้า (ปุ่ม "+ เพิ่มสินค้า" มุมขวาบนของการ์ด)
    const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);
    // เปิด/ปิดปุ่มเพิ่มรายการและเปิด Modal ของ Preorder
    const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
    const [isPreorderModalOpen, setIsPreorderModalOpen] = useState(false);
    // State สำหรับข้อมูลวิเคราะห์จากระบบ
    const [deliveryEstimate, setDeliveryEstimate] = useState<POAnalyticsResponse | null>(null);
    const [isEstimateLoading, setIsEstimateLoading] = useState(false);
    // เรียกใช้งาน Hook
    const searchInputRef = useRef<HTMLInputElement>(null);
    const supplierId = po?.supplier_id ? String(po.supplier_id) : '';
    const { searchInput, addQuantity, setAddQuantity, searchResults, isSearching, selectedProduct,
        handleSearchInput, handleSelectProduct, handleAddItem, handleScannerEnter,
        duplicatePrompt, confirmDuplicateAdd, cancelDuplicateAdd } =
        usePoScanner(supplierId, items, setItems);
    const { preorders, handleAddPreorderToPO } = usePreorders(items, setItems, setIsPreorderModalOpen);
    
    useEffect(() => {
        if (po) {
            setNotes(po.notes ?? '');
            setItems(po.po_items as LocalPOItem[]);
            setInitialItemIds(new Set(po.po_items.map(item => item.id)));
        }
    }, [po]);

    useEffect(() => {
        if (!id) return;
            setLoading(true);
            poService.getPurchaseOrderById(id)
            .then(setPo)
            .catch(() => setError('ไม่สามารถโหลดข้อมูลใบสั่งซื้อได้'))
            .finally(() => setLoading(false));
    }, [id]);

    useEffect(() => {
        if (!supplierId) {
            setDeliveryEstimate(null);
            return;
        }
        setIsEstimateLoading(true);
        poService.getSupplierDeliveryEstimate(supplierId)
            .then(setDeliveryEstimate)
            .catch(() => setDeliveryEstimate(null))
            .finally(() => setIsEstimateLoading(false));
    }, [supplierId]);

    if (loading) return <div>กำลังโหลด...</div>;
    if (error || !po) return <div>{error ?? 'ไม่พบใบสั่งซื้อ'}</div>;

    const canApprove = po.status === 'PENDING' && userRole === 'Owner'; // เจ้าของร้านพิจารณา
    const canEditDraft = po.status === 'DRAFT' || po.status === 'RESUBMITTED';  // พนักงานยังแก้ไขร่างได้อยู่
    const canRestore = po.status === 'DELETED';
    const isEditable = canApprove || canEditDraft;

    // คำนวณจาก items ปัจจุบัน (ไม่ใช้ po.total_amount ตรงๆ เพราะผู้ใช้อาจแก้ไขจำนวน/ราคาแล้วยังไม่ได้กดบันทึก)
    const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const totalAmount = items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_price || 0)), 0);

    const handleApprove = async () => {
        if (!id) return;
        setActiveAction('approve');
        try {
            await poService.updatePOStatus(id, 'APPROVED');
            toast({ title: 'ดำเนินการสำเร็จ', message: 'อนุมัติใบสั่งซื้อสำเร็จ', variant: 'success' });
            navigate(`${basePath}/orders`);
        } catch {
            toast({ title: 'เกิดข้อผิดพลาด', message: 'อนุมัติไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', variant: 'error' });
        } finally {
            setActiveAction(null);
        }
    };

    const handleReject = () => {
        setIsRejectModalOpen(true);
        setRejectMode(null);
    };

    const handleConfirmReject = async () => {
        if (!id || !rejectMode) return;
        setIsRejectModalOpen(false);
        setActiveAction('resubmitted');
        try {
            if (rejectMode === 'cancel') {
                await poService.updatePOStatus(id, 'CANCELLED');
                toast({ title: 'ดำเนินการสำเร็จ', message: 'ยกเลิกใบสั่งซื้อสำเร็จ', variant: 'success' });
            } else {
                await poService.updatePOStatus(id, 'RESUBMITTED');
                toast({ title: 'ดำเนินการสำเร็จ', message: 'ตีกลับใบสั่งซื้อสำเร็จ', variant: 'success' });
            }
            navigate(`${basePath}/orders`);
        } catch {
            toast({ title: 'เกิดข้อผิดพลาด', message: 'ไม่สามารถดำเนินการได้ กรุณาลองใหม่อีกครั้ง', variant: 'error' });
        } finally {
            setActiveAction(null);
        }
    };

    const handleRestore = async () => {
        if (!id) return;
        setActiveAction('restore');
        try {
            await poService.restorePurchaseOrder(id);
            toast({ title: 'ดำเนินการสำเร็จ', message: 'กู้คืนใบสั่งซื้อสำเร็จ', variant: 'success' });
            setIsRestoreConfirmOpen(false);
            navigate(`${basePath}/orders/restore`);
        } catch {
            toast({ title: 'เกิดข้อผิดพลาด', message: 'ไม่สามารถกู้คืนใบสั่งซื้อได้ กรุณาลองใหม่อีกครั้ง', variant: 'error' });
        } finally {
            setActiveAction(null);
        }
    };

    const handleItemChange = (
        key: number | string,
        field: 'quantity' | 'unit_price' | 'product_id' | 'product_name_snapshot' | 'product_name_code_snapshot' | 'unit',
        value: number | string
    ) => {
        setItems(prev =>
            prev.map(item => {
            if (item.id !== key) return item;
            const updated: LocalPOItem = { ...item, [field]: value };
            if (field === 'quantity' || field === 'unit_price') {
                updated.sub_total = Number(updated.quantity) * Number(updated.unit_price);
            }
            return updated;
            })
        );
    };

    const handleQtyDraftChange = (key: number | string, rawValue: string) => {
        setQtyDrafts(prev => ({ ...prev, [key]: rawValue }));
    };

    // ตอนออกจากช่อง (blur) ค่อยตัดสินใจจริงว่าจะ commit ค่าไหน
    const handleQtyBlur = (key: number | string) => {
        const raw = qtyDrafts[key];
        if (raw === undefined) return; // ไม่ได้แก้ไขอะไร ไม่ต้องทำอะไรต่อ
        const trimmed = raw.trim();
        // พิมพ์ไม่เสร็จ/ลบจนว่างแล้วไม่พิมพ์ต่อ -> เอาค่าตัวเลขเดิมกลับไปเลย ไม่ต้องเตือน
        if (trimmed === '' || isNaN(Number(trimmed))) {
            setQtyDrafts(prev => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
            return;
        }
        const value = Number(trimmed);
        if (value <= 0) {
            setRemoveConfirm({ key, reason: 'zero-qty' });
            // ไม่ว่าจะยืนยันหรือยกเลิก ก็เคลียร์ draft ทิ้ง (ถ้าไม่ลบ ตัวเลขจะกลับไปเป็นค่าเดิมของ item)
            setQtyDrafts(prev => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
            return;
        }
        handleItemChange(key, 'quantity', value);
        setQtyDrafts(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const removeItemImmediate = (key: number | string) => {
        setItems(prev => prev.filter(item => item.id !== key));
    };

    const handleRemoveItem = (key: number | string) => {
        setRemoveConfirm({ key, reason: 'manual' });
    };

    const confirmRemoveItem = () => {
        if (removeConfirm) removeItemImmediate(removeConfirm.key);
        setRemoveConfirm(null);
    };

    // ฟังก์ชันกลาง: บันทึกรายการแก้ไขปัจจุบันลง PO (ใช้ร่วมกันทั้งบันทึกร่างและส่งอนุมัติ)
    const savePOChanges = async () => {
        const payload = {
            notes: notes !== '' ? notes : undefined,
            items: items.map(item => {
                const isExistingItem = initialItemIds.has(Number(item.id));
                return {
                    id: isExistingItem ? Number(item.id) : undefined,
                    product_id: Number(item.product_id),
                    quantity: Number(item.quantity),
                    unit_price: Number(item.unit_price),
                    pre_order_item_id: item.pre_order_item_id ? Number(item.pre_order_item_id) : undefined,
                    alert_id: item.alert_id ? Number(item.alert_id) : undefined
                };
            }),
        };
        const updated = await poService.updatePurchaseOrder(id!, payload);
        const formattedUpdatedItems = updated.po_items.map((item: any) => ({
            ...item,
            order_type: item.order_type || 'สั่งซื้อ'
        }));
        setPo(prev => prev ? { ...prev, ...updated, po_items: formattedUpdatedItems } : prev);
        setItems(formattedUpdatedItems);
        setInitialItemIds(new Set(formattedUpdatedItems.map((item: LocalPOItem) => item.id)));
    };

    // บันทึกฉบับร่าง (ไม่เปลี่ยนสถานะ)
    const handleSaveEdit = async () => {
        if (!id) return;
        setActiveAction('draft');
        try {
            await savePOChanges();
            toast({ title: 'ดำเนินการสำเร็จ', message: 'บันทึกการแก้ไขข้อมูลสำเร็จ', variant: 'success' });
        } catch (err: any) {
            console.error("Update Error:", err.response?.data || err);
            toast({ title: 'เกิดข้อผิดพลาด', message: 'บันทึกการแก้ไขไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', variant: 'error' });
        } finally {
            setActiveAction(null);
        }
    };

    // ส่งอนุมัติ: บันทึกรายการที่แก้ไขก่อน แล้วค่อยเปลี่ยนสถานะเป็น PENDING
    const handleSubmitForApproval = async () => {
        if (!id) return;
        setActiveAction('submit');
        try {
            await savePOChanges();
            await poService.updatePOStatus(id, 'PENDING');
            toast({ title: 'ดำเนินการสำเร็จ', message: 'ส่งใบสั่งซื้อเพื่อขออนุมัติเรียบร้อยแล้ว', variant: 'success' });
            navigate(`${basePath}/orders`);
        } catch (err: any) {
            console.error("Submit Error:", err.response?.data || err);
            toast({ title: 'เกิดข้อผิดพลาด', message: 'ส่งอนุมัติไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', variant: 'error' });
        } finally {
            setActiveAction(null);
        }
    };

    return (
        <div className='p-8 space-y-6 bg-white min-h-screen relative pb-28'>
            { /* Header */ }
            <div className='flex items-center justify-between'>
                <div className='flex-col space-y-2'>
                    <nav className='flex items-center text-sm text-gray-500 gap-2 font-light'>
                        {po.status === 'DELETED' || po.status === 'CANCELLED' ? (
                            <Link to={`${basePath}/orders/restore`} className='hover:text-black transition-colors'>
                                กู้คืนใบสั่งซื้อ
                            </Link>
                        ) : (
                            <Link to={`${basePath}/orders`} className='hover:text-black transition-colors'>
                                จัดการใบสั่งซื้อ
                            </Link>
                        )}
                        <ChevronRight size={16} className='text-gray-400' />
                        <span className="text-black font-normal">{isEditable ? 'ตรวจสอบใบสั่งซื้อสินค้า' : 'รายละเอียดใบสั่งซื้อสินค้า'}</span>
                    </nav>
                    <Heading level='h1' weight='semibold' className='m-0 text-black'>
                        {getPageTitle(po.status, userRole)}
                    </Heading>
                    <Heading level='h6' weight='normal' className='m-0 text-black'>
                        {getPageSubtitle(po.status, userRole)}
                    </Heading>
                </div>
                <div className='flex items-end gap-4 justify-end'>
                    <Badge variant='outline' size='lg' className='w-fit gap-2 p-2'>
                        <ClipboardClock size={14}/>
                        สถานะ : {STATUS_LABEL[po.status]}
                    </Badge>
                </div>
            </div>

            {po.status === 'RESUBMITTED' && (
                <div className='flex items-center gap-2 border-l-[3px] border-l-red-600 bg-red-50 rounded-r-sm px-4 py-2.5'>
                    <MessageSquareWarning className='w-4 h-4 text-red-600 shrink-0' />
                    <span className='font-semibold text-red-700 text-sm'>เจ้าของร้านตีกลับใบสั่งซื้อนี้ กรุณาแก้ไขและส่งอนุมัติใหม่</span>
                </div>
            )}
            {po.status === 'CANCELLED' && (
                <div className='flex items-center gap-2 border-l-[3px] border-l-red-600 bg-red-50 rounded-r-sm px-4 py-2.5'>
                    <MessageSquareWarning className='w-4 h-4 text-red-600 shrink-0' />
                    <span className='font-semibold text-red-700 text-sm'>ใบสั่งซื้อนี้ถูกยกเลิกโดยเจ้าของร้าน</span>
                </div>
            )}

            { /* ส่วนการ์ดรายละเอียดบริษัท ดึงจากใบสั่งซื้อใน DB */ }
            <div className='grid grid-cols-2 gap-8 items-stretch'>
                { /* Left Card ส่วนของบริษัท */ }
                <Card className='border-l-[5px] border-l-black h-full' noPadding>
                    <div className='flex items-center gap-3 px-6 py-5'>
                        <Building2 className='w-5 h-5 text-red-700' />
                        <span className='font-semibold text-red-700 text-base'>รายละเอียดบริษัท</span>
                    </div>
                    <div className='px-6 pb-4 flex flex-col gap-4 h-full'>
                        <div className='grid grid-cols-2 gap-4'>
                            <div>
                                <Heading level='p' weight='normal'>ชื่อบริษัท/ผู้จัดจำหน่าย</Heading>
                                <Heading level='p'>{po.supplier_name}</Heading>
                            </div>
                            <div>
                                <Heading level='p' weight='normal'>วันที่สั่งซื้อ</Heading>
                                <Heading level='p'>{formatDate(po.created_at)}</Heading>
                            </div>
                        </div>

                        {supplierId && (
                            <div>
                                <Heading level='p' weight='normal' className='text-black'>ข้อมูลวิเคราะห์จากระบบ</Heading>
                                {isEstimateLoading ? (
                                    <Heading level='p'>กำลังวิเคราะห์ข้อมูล...</Heading>
                                ) : !deliveryEstimate?.has_enough_data ? (
                                    <Heading level='p'>บริษัทรายนี้มีประวัติการจัดส่งไม่เพียงพอสำหรับการคาดการณ์ระยะเวลาจัดส่ง</Heading>
                                ) : (
                                    <>
                                        <Heading level='p'>
                                            โดยปกติบริษัทรายนี้จะใช้เวลาจัดส่งประมาณ {deliveryEstimate.estimated_days} วันทำการ
                                        </Heading>
                                        <Heading level='p'>
                                            เราขอแนะนำให้คุณวางแผนการขนส่งล่วงหน้าตามนั้น
                                        </Heading>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </Card>

                { /* Right Card ส่วนของผู้ทำรายการ */ }
                <Card className='h-full bg-[#F6F3F2] border-none shadow-sm relative overflow-hidden' noPadding>
                    <div className='absolute right-4 top-4 opacity-5 pointer-events-none'>
                        <FileText className='h-24 w-24' />
                    </div>
                    <div className='relative flex items-center gap-3 z-10 px-6 py-5'>
                        <User className='w-5 h-5 text-black' />
                        <span className='font-semibold text-black text-base'>ข้อมูลผู้ทำรายการ</span>
                    </div>
                    <div className='relative z-10 px-6 pb-4 flex flex-col gap-4 h-full'>
                        <div className='grid grid-cols-2 gap-4'>
                            <div>
                                <Heading level='p' weight='normal'>พนักงานผู้สร้าง</Heading>
                                <Heading level='p'>{po.creator_name}</Heading>
                            </div>
                            <div>
                                <Heading level='p' weight='normal'>วันที่ทำรายการ</Heading>
                                <Heading level='p'>{formatDate(po.created_at)}</Heading>
                            </div>
                        </div>
                        <div>
                            <Heading level='p' weight='normal'>หมายเหตุจากพนักงาน</Heading>
                            <div className='bg-[#E5E2E1] px-3 flex items-center justify-between rounded-sm min-h-10'>
                                {!isEditingNotes ? (
                                    <>
                                        <Heading level='p' className="truncate mr-2">
                                            {notes || '-'}
                                        </Heading>                                        
                                        {(po.status === 'DRAFT' || po.status === 'RESUBMITTED') && (
                                            <span 
                                                className='text-[#6B7280] hover:text-black cursor-pointer text-sm font-medium shrink-0'
                                                onClick={() => setIsEditingNotes(true)}
                                            >
                                                แก้ไข
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    <div className='w-full flex-1 p-0'>
                                        <Input
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            placeholder='พิมพ์ข้อความหมายเหตุที่นี่..'
                                            className='bg-transparent'
                                            min={255}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            { /* ส่วนของตารางรายละเอียดใบสั่งซื้อ */ }
            <Card className='w-full overflow-hidden' noPadding>
                <div className='bg-[#F0EDEC] flex items-center justify-between px-6 py-4'>
                    <span className='font-semibold text-black'>รายการสินค้าที่สั่งซื้อ</span>
                    <div className='flex items-center gap-3'>
                        {/* ส่วนปุ่ม Dropdown เลือกประเภทการเพิ่มรายการ */}
                        {isEditable && (
                            <div className='relative'>
                                <Button
                                    variant='outline' size='sm'
                                    className='px-4 py-1.5 text-[13px] flex items-center gap-2'
                                    onClick={() => setIsAddMenuOpen(prev => !prev)}
                                >
                                    เพิ่มรายการ
                                    <ChevronDown className={`w-4 h-4 transition-transform ${isAddMenuOpen ? 'rotate-180' : ''}`} />
                                </Button>

                                {/* Dropdown Menu */}
                                {isAddMenuOpen && (
                                    <div className='absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded shadow-lg z-20 py-1'>
                                        <button
                                            type="button"
                                            className='w-full text-left px-4 py-2.5 text-sm text-black hover:bg-gray-50 border-b border-gray-100'
                                            onClick={() => {
                                                setIsAddPanelOpen(true);
                                                setIsPreorderModalOpen(false);
                                                setIsAddMenuOpen(false);
                                                setTimeout(() => searchInputRef.current?.focus(), 0);
                                            }}
                                        >
                                            เพิ่มสินค้าปกติ
                                        </button>
                                        <button
                                            type="button"
                                            className='w-full text-left px-4 py-2.5 text-sm text-black hover:bg-gray-50'
                                            onClick={() => {
                                                setIsPreorderModalOpen(true);
                                                setIsAddPanelOpen(false);
                                                setIsAddMenuOpen(false);
                                            }}
                                        >
                                            เพิ่มรายการพรีออเดอร์
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        <span className='bg-black text-white text-sm font-normal px-3 py-1.5 rounded-none'>เลขที่ใบสั่งซื้อ: {po.po_number}</span>
                    </div>
                </div>
                {isAddPanelOpen && (
                    <div className='px-6 py-4 bg-gray-50 border-b border-gray-100 flex flex-col gap-3'>
                        <div className='flex items-center gap-3'>
                            <div className='relative flex-1'>
                                <Search className='w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2' />
                                <input
                                    ref={searchInputRef}
                                    type='text'
                                    placeholder='สแกนหรือพิมพ์ รหัส / ชื่อสินค้า...'
                                    value={searchInput}
                                    onChange={(e) => handleSearchInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleScannerEnter(); }}
                                    className='w-full border border-gray-200 rounded pl-9 pr-3 py-2 text-sm outline-none focus:border-gray-400 bg-white'
                                />
                                {searchInput.trim().length > 0 && !(selectedProduct && searchInput === selectedProduct.name) && (
                                    <div className='absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-64 overflow-y-auto'>
                                        {isSearching ? (
                                            <div className='px-4 py-2.5 text-sm text-gray-400'>กำลังค้นหา...</div>
                                        ) : searchResults.length > 0 ? (
                                            searchResults.map((product) => (
                                                <button
                                                    key={product.id}
                                                    type='button'
                                                    onClick={() => handleSelectProduct(product)}
                                                    className='w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-b-0 flex items-center justify-between gap-3'
                                                >
                                                    <div>
                                                        <div className='text-sm font-medium text-black'>{product.name}</div>
                                                        <div className='text-xs text-gray-400'>{product.code} · คงเหลือ {product.stock_qty} {product.unit}</div>
                                                    </div>
                                                    <div className='text-sm font-medium text-black whitespace-nowrap'>{product.price.toLocaleString()} ฿</div>
                                                </button>
                                            ))
                                        ) : (
                                            <div className='px-4 py-2.5 text-sm text-gray-400'>ไม่พบสินค้าที่ตรงกับคำค้นหา</div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <input
                                type='number'
                                min={1}
                                placeholder='จำนวน'
                                value={addQuantity}
                                onChange={(e) => setAddQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                                className='w-24 border border-gray-200 rounded px-3 py-2 text-sm outline-none focus:border-gray-400 bg-white'
                            />
                            <Button
                                variant='primary'
                                className='px-6 py-2 text-sm whitespace-nowrap'
                                onClick={() => {
                                    handleAddItem();
                                    searchInputRef.current?.focus();
                                }}
                            >
                                เพิ่มลงรายการ
                            </Button>
                        </div>
                        {!supplierId && (
                            <p className='text-xs text-red-600'>
                                ยังไม่มีข้อมูล supplier_id ของใบสั่งซื้อนี้ (POResponse ยังไม่ส่งค่านี้มา) การค้นหาสินค้าจะยังกรองตามบริษัทไม่ได้ถูกต้อง
                            </p>
                        )}
                    </div>
                )}
                <Table>
                    <TableHeader className='bg-[#F6F3F2] text-gray-700 font-light text-sm border-b border-gray-100'>
                        <TableRow>
                            <TableHead className='pl-6 font-medium'>ลำดับ</TableHead>
                            <TableHead className='font-medium'>ประเภท</TableHead>
                            <TableHead className='font-medium'>รหัสสินค้า</TableHead>
                            <TableHead className='font-medium'>ชื่อสินค้า</TableHead>
                            <TableHead className='text-center font-medium'>จำนวนต่อหน่วย</TableHead>
                            <TableHead className='text-center font-medium'>หน่วย</TableHead>
                            <TableHead className='text-right font-medium'>ราคาต่อหน่วย</TableHead>
                            <TableHead className='text-right font-medium'>ราคารวม</TableHead>
                            {isEditable && (
                                <TableHead className='text-center font-medium'>จัดการ</TableHead>
                            )}
                        </TableRow>
                    </TableHeader>
                    <TableBody className='text-black'>
                        {items.map((item, index) => {
                            const itemKey = item.id || index;
                            return (
                            <TableRow key={itemKey}>
                                <TableCell className='pl-6 text-black'>{index + 1}</TableCell>
                                <TableCell className='text-black'>{item.order_type}</TableCell>
                                <TableCell className='text-black'>{item.product_name_code_snapshot}</TableCell>
                                <TableCell className='text-black'>{item.product_name_snapshot}</TableCell>
                                <TableCell className='text-center'>
                                    {isEditable ? (
                                        <div className='inline-flex items-center border border-gray-300 rounded-none bg-[#F6F3F2]'>
                                            <button
                                                type='button'
                                                onClick={() => {
                                                    setQtyDrafts(prev => {
                                                        const next = { ...prev };
                                                        delete next[itemKey];
                                                        return next;
                                                    });
                                                    if (item.quantity <= 1) {
                                                        setRemoveConfirm({ key: itemKey, reason: 'zero-qty' });
                                                        return;
                                                    }
                                                    handleItemChange(itemKey, 'quantity', item.quantity - 1);
                                                }}
                                                className='p-1.5 px-2 cursor-pointer text-gray-600 hover:text-black transition-colors'
                                            >
                                                <Minus size={14} />
                                            </button>
                                            <input
                                                type='text'
                                                inputMode='numeric'
                                                value={qtyDrafts[itemKey] !== undefined ? qtyDrafts[itemKey] : String(item.quantity)}
                                                onChange={(e) => {
                                                    // อนุญาตให้พิมพ์เฉพาะตัวเลข (หรือค่าว่างระหว่างลบเลขเดิมทิ้ง)
                                                    const raw = e.target.value;
                                                    if (raw !== '' && !/^\d*$/.test(raw)) return;
                                                    handleQtyDraftChange(itemKey, raw);
                                                }}
                                                onBlur={() => handleQtyBlur(itemKey)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                                }}
                                                className='w-10 text-center bg-transparent border-none focus:outline-none focus:ring-0 text-sm p-0 m-0 font-medium text-black [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                                            />
                                            <button
                                                type='button'
                                                onClick={() => {
                                                    setQtyDrafts(prev => {
                                                        const next = { ...prev };
                                                        delete next[itemKey];
                                                        return next;
                                                    });
                                                    handleItemChange(itemKey, 'quantity', item.quantity + 1);
                                                }}
                                                className='p-1.5 px-2 cursor-pointer text-gray-600 hover:text-black transition-colors'
                                            >
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <span className='font-medium text-black'>{item.quantity}</span>
                                    )}
                                </TableCell>
                                <TableCell className='text-center text-black'>{item.unit}</TableCell>
                                <TableCell className='text-right text-black'>
                                    {item.unit_price.toLocaleString()} ฿
                                </TableCell>
                                <TableCell className='text-right text-black'>{((item.quantity || 0) * (item.unit_price || 0)).toLocaleString()} ฿</TableCell>
                                {isEditable && (
                                    <TableCell className='text-center text-black'>
                                        <button onClick={() => handleRemoveItem(itemKey)} className='text-red-600 hover:text-red-800'>
                                            <Trash2 className='w-4 h-4' />
                                        </button>
                                    </TableCell>
                                )}
                            </TableRow>
                            );
                        })}
                        </TableBody>
                    <TableFooter>
                        <TableRow>
                            <TableCell colSpan={isEditable ? 9 : 8} className='py-0 px-0 bg-white!'>
                                <div className='flex items-stretch justify-end'>
                                    <div className='flex flex-col items-center justify-center px-12 py-6'>
                                        <span className='text-sm text-black font-medium mb-1'>จำนวนทั้งหมด</span>
                                        <div className='flex items-baseline gap-2'>
                                            <span className='text-2xl font-bold text-black'>{totalQuantity.toLocaleString()}</span>
                                            <span className='text-base font-medium text-black'>หน่วย</span>
                                        </div>
                                    </div>
                                    <div className='flex flex-col items-center justify-center px-12 py-6 bg-red-50'>
                                        <span className='text-sm text-red-700 font-medium mb-1'>ยอดรวมทั้งสิ้น</span>
                                        <div className='flex items-baseline gap-2'>
                                            <span className='text-2xl font-bold text-red-700'>{totalAmount.toLocaleString()}</span>
                                            <span className='text-base font-medium text-red-700'>บาท</span>
                                        </div>
                                    </div>
                                </div>
                            </TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </Card>

            { /* Button Actions */ }
            {canEditDraft && (
                <div className='sticky bottom-0 z-20 bg-gray-50 py-4 border-t border-gray-200 flex justify-between'>
                    <Button variant='outline' className='w-40' onClick={() => navigate(`${basePath}/orders`)} disabled={!!activeAction}>
                        ยกเลิก
                    </Button>
                    <div className='flex gap-4'>
                        <Button variant='secondary' className='w-40' onClick={handleSaveEdit} disabled={!!activeAction}>
                            {activeAction === 'draft' ? 'กำลังบันทึก...' : 'บันทึกฉบับร่าง'}
                        </Button>
                        <Button variant='primary' className='w-40' onClick={handleSubmitForApproval} disabled={!!activeAction}>
                            {activeAction === 'submit' ? 'กำลังส่งอนุมัติ...' : 'ส่งอนุมัติ'}
                        </Button>
                    </div>
                </div>
            )}

            {canApprove && (
                <div className='sticky bottom-0 z-20 bg-gray-50 py-4 border-t border-gray-200 flex justify-between'>
                    <Button variant='outline' className='w-40' onClick={handleReject} disabled={!!activeAction}>
                        {activeAction === 'resubmitted' ? 'กำลังดำเนินการ...' : 'ไม่อนุมัติ'}
                    </Button>
                    <div className='flex gap-4'>
                        <Button variant='secondary' className='w-40' onClick={handleSaveEdit} disabled={!!activeAction}>
                            {activeAction === 'draft' ? 'กำลังบันทึก...' : 'บันทึกฉบับร่าง'}
                        </Button>
                        <Button variant='primary' className='w-40' onClick={handleApprove} disabled={!!activeAction}>
                            {activeAction === 'approve' ? 'กำลังดำเนินการ...' : 'อนุมัติสั่งซื้อ'}
                        </Button>
                    </div>
                </div>
            )}

            {canRestore && (
                <div className='sticky bottom-0 z-20 bg-gray-50 py-4 border-t border-gray-200 flex justify-between'>
                    <Button variant='outline' className='w-40' onClick={() => navigate(`${basePath}/orders/restore`)} disabled={!!activeAction}>
                        ย้อนกลับ
                    </Button>
                    <div className='flex gap-4'>
                        <Button variant='primary' className='w-40' onClick={() => setIsRestoreConfirmOpen(true)} disabled={!!activeAction}>
                            {activeAction === 'restore' ? 'กำลังกู้คืน...' : 'กู้คืนใบสั่งซื้อ'}
                        </Button>
                    </div>
                </div>
            )}

            <PreorderSelectionModal
                isOpen={isPreorderModalOpen}
                onClose={() => setIsPreorderModalOpen(false)}
                preorders={preorders}
                onSelectPreorder={handleAddPreorderToPO}
            />

            {/* Reject Modal */}
            {isRejectModalOpen && (
                <div className='fixed inset-0 z-50 flex items-center justify-center'>
                    <div className='absolute inset-0 bg-black/40' onClick={() => setIsRejectModalOpen(false)} />
                    <div className='relative bg-white rounded-sm shadow-xl w-full max-w-md mx-4 p-6 space-y-5'>
                        <Heading level='h4' weight='semibold' className='text-black'>ไม่อนุมัติใบสั่งซื้อ</Heading>
                        <p className='text-sm text-gray-600'>กรุณาเลือกวิธีดำเนินการสำหรับใบสั่งซื้อนี้</p>

                        <div className='space-y-3'>
                            {/* ตัวเลือก 1: ตีกลับให้แก้ไข */}
                            <button
                                type='button'
                                onClick={() => setRejectMode('return')}
                                className={`w-full text-left p-4 border-2 rounded-sm transition-colors ${rejectMode === 'return' ? 'border-red-600 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}
                            >
                                <div className='font-semibold text-sm text-black'>ตีกลับให้แก้ไข</div>
                                <div className='text-xs text-gray-500 mt-1'>ส่งกลับให้พนักงานแก้ไขรายการและส่งอนุมัติใหม่</div>
                            </button>

                            {/* ตัวเลือก 2: ยกเลิกทั้งบิล */}
                            <button
                                type='button'
                                onClick={() => setRejectMode('cancel')}
                                className={`w-full text-left p-4 border-2 rounded-sm transition-colors ${rejectMode === 'cancel' ? 'border-red-600 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}
                            >
                                <div className='font-semibold text-sm text-black'>ยกเลิกทั้งบิล</div>
                                <div className='text-xs text-gray-500 mt-1'>ยกเลิกใบสั่งซื้อนี้ถาวร (สถานะจะเปลี่ยนเป็น "ยกเลิกแล้ว")</div>
                            </button>
                        </div>

                        <div className='flex gap-3 justify-end'>
                            <Button variant='outline' className='w-28' onClick={() => setIsRejectModalOpen(false)}>
                                ยกเลิก
                            </Button>
                            <Button
                                variant='primary'
                                className='w-36'
                                onClick={handleConfirmReject}
                                disabled={!rejectMode}
                            >
                                ยืนยัน
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={isRestoreConfirmOpen}
                onClose={() => setIsRestoreConfirmOpen(false)}
                onConfirm={handleRestore}
                title='ยืนยันการกู้คืนใบสั่งซื้อ'
                description='คุณต้องการกู้คืนใบสั่งซื้อนี้ใช่หรือไม่? ระบบจะเปลี่ยนสถานะกลับเป็นฉบับร่าง'
                confirmText='กู้คืน'
                variant='info'
                isSubmitting={activeAction === 'restore'}
            />

            <ConfirmDialog
                isOpen={!!removeConfirm}
                onClose={() => setRemoveConfirm(null)}
                onConfirm={confirmRemoveItem}
                title='ยืนยันการลบรายการ'
                description={
                    removeConfirm?.reason === 'zero-qty'
                        ? 'จำนวนสินค้าจะเหลือ 0 ต้องการลบรายการนี้ออกจากรายการหรือไม่?'
                        : 'ต้องการลบสินค้ารายการนี้ออกจากรายการหรือไม่?'
                }
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
    );
}

export default OrderDetail;