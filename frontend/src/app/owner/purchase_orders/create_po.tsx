// React Libraries
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, ChartNoAxesCombined, Info, ScanBarcode, ShoppingBag, 
    ChevronRight, ShoppingCart, PenLine } from 'lucide-react';
// Components
import Heading from '../../../components/elements/heading';
import Button from '../../../components/elements/button';
import Input from '../../../components/elements/input';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/elements/card';
import Select from '../../../components/elements/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/elements/table";
import { PreorderSelectionModal } from './components/PreorderSelectionModal';
// Interface
import type { CreatePORequest, POItemResponse, PreorderItem } from '../../../interface/purchase_orders/po_interface';
// Service & Utils
import { poService } from '../../../service/http/purchase_orders/po_service';
import { getSuppliersList } from '../../../service/http/wms/product';
import { getTodayDateString } from '../../../utils/formatdate';
import { generateLocalId } from '../../../utils/generateId';
// Hooks
import { usePoScanner } from './hooks/usePOScanner'; 
import { usePreorders } from './hooks/usePreorder';

const CreatePurchaseOrders: React.FC = () => {
    const navigate = useNavigate();
    // States ของ API
    const [item, setItem] = useState<POItemResponse[]>([]);
    const [totalItems, setTotalItems] = useState(0);
    const [date, setDate] = useState<string>(getTodayDateString());
    const [isPreorderModalOpen, setIsPreorderModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // States สำหรับ Supplier (ตัวเลือก Dropdown)
    const [listsSupplier, setlistsSupplier] = useState("");
    const [supplierOptions, setSupplierOptions] = useState<{label: string, value: string}[]>([]);
    
    // Hook การสแกนและค้นหาสินค้า
    const searchInputRef = useRef<HTMLInputElement>(null);
    const { searchInput, addQuantity, setAddQuantity, searchResults, handleSearchInput, handleSelectProduct,
        handleAddItem, handleScannerEnter } = usePoScanner(listsSupplier, item, setItem);
    // ดึงข้อมูลจาก Hook เรียกรายการพรีออเดอร์
    const { preorders, totalPreorders, isLoading: isPreordersLoading } = usePreorders();
    
    // อัปเดต totalItems อัตโนมัติเมื่อตะกร้า (item) มีการเปลี่ยนแปลง
    useEffect(() => {
        setTotalItems(item.length);
    }, [item]);

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
                console.error("ไม่สามารถดึงข้อมูลซัพพลายเออร์ได้:", error);
            }
        };

        fetchSuppliers();
    }, []);

    // ดึงข้อมูล Stock Alert อัตโนมัติ หลังเลือก Supplier แล้ว
    useEffect(() => {
        const fetchAlertsAutomatically = async () => {
            // 1. ถ้ายังไม่ได้เลือกบริษัท หรือเคลียร์ค่าทิ้ง ให้หยุดการทำงาน
            if (!listsSupplier) return;

            try {
                // 2. ไปดึงข้อมูลจาก API
                const alertItems = await poService.getStockAlertsBySupplier(listsSupplier);
                
                // 3. เอาข้อมูลมาใส่ตาราง => ใช้ setItem(alertItems) เพื่อล้างของเก่าแล้วใส่ของบริษัทใหม่
                // หรือใช้ setItem(prev => [...prev, ...alertItems]) ถ้าอยากให้ต่อท้ายของเดิม
                setItem(alertItems); 
                
            } catch (error) {
                console.error("โหลด Stock Alert อัตโนมัติล้มเหลว:", error);
            }
        };

        fetchAlertsAutomatically();
    }, [listsSupplier]);

    // Function เตือนก่อนว่ามีของในใบสั่งซื้ออยู่ ถ้าเปลี่ยนบริษัทจะดึง Stock Alert ชุดใหม่มาทับตะกร้าเดิม
    const handleSupplierChange = (newSupplierId: string) => {
        if (item.length > 0) {
            const confirmed = window.confirm(
                "การเปลี่ยนบริษัท/ผู้จัดจำหน่ายจะล้างรายการสินค้าที่เพิ่มไว้ในตะกร้าปัจจุบันทั้งหมด ต้องการดำเนินการต่อหรือไม่?"
            );
            if (!confirmed) return;
        }
        setlistsSupplier(newSupplierId);
    };

    // 3. ฟังก์ชันสำหรับรับรายการพรีออเดอร์ที่ถูกกด "เพิ่ม" มาแปลงใส่ลงตารางใบสั่งซื้อ (item)
    const handleAddPreorderToPO = (selectedPreorder: PreorderItem) => {
        const isDuplicate = item.some(existingItem => existingItem.product_id === selectedPreorder.product_id);
        
        if (isDuplicate) {
            alert(`มีรายการ "${selectedPreorder.product_name}" อยู่ในใบสั่งซื้อแล้ว`);
            return;
        }

        const unitCost = 0;
        
        const newItem: POItemResponse = {
            id: generateLocalId(), 
            product_id: selectedPreorder.product_id,
            product_name_snapshot: selectedPreorder.product_name,
            product_name_code_snapshot: selectedPreorder.product_code || "-",
            quantity: selectedPreorder.quantity,
            unit: selectedPreorder.unit || "ชิ้น",
            unit_price: unitCost,
            sub_total: unitCost * selectedPreorder.quantity
        };

        // เพิ่มเข้าตะกร้าหลัก (ตารางด้านล่างของจอ)
        setItem(prev => [...prev, newItem]);
        
        // ปิด Modal อัตโนมัติเมื่อกดเพิ่ม ให้ปลดคอมเมนต์บรรทัดล่าง
        setIsPreorderModalOpen(false);
    };

    // Function แก้ไขจำนวนของรายการในใบสั่งซื้อ
    const handleUpdateItem = (id: number, field: 'quantity', rawValue: string) => {
        const numValue = Number(rawValue);
        const safeValue = isNaN(numValue) || numValue < 0 ? 0 : numValue;

        setItem(prev => prev.map(row => {
            if (row.id !== id) return row;
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

    // ฟังก์ชัน: บันทึกร่าง / ส่งอนุมัติ
    const handleSavePO = async (submitStatus: 'DRAFT' | 'PENDING') => {
        if (item.length === 0) {
            alert("กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ");
            return;
        }

        if (!listsSupplier || listsSupplier === "all" || listsSupplier === "others") {
            alert("กรุณาเลือกผู้จัดจำหน่าย (Supplier)");
            return;
        }

        try {
            // เตรียมข้อมูลรายการสินค้า
            const poItemsPayload = item.map((p) => ({
                product_id: p.product_id,
                quantity: p.quantity,
                unit_price: p.unit_price,
            }));

            // สร้าง Payload และแนบ status ตามที่ปุ่มส่งมา
            const payload: CreatePORequest = {
                supplier_id: Number(listsSupplier),
                po_type_id: 1, 
                status: submitStatus, // ส่งสถานะ DRAFT หรือ PENDING ไปที่ Backend
                po_items: poItemsPayload,
            };

            // เรียกใช้ API ตัวเดียวกันได้เลย
            const response = await poService.createPurchaseOrder(payload);
            
            const createdPoNumber = response?.order_number || "";
            const message = submitStatus === 'DRAFT' 
                ? `บันทึกฉบับร่าง ${createdPoNumber} เรียบร้อยแล้ว` 
                : `ส่งใบสั่งซื้อ ${createdPoNumber} เพื่อขออนุมัติเรียบร้อยแล้ว`;
            
            alert(message);
            navigate('/owner/orders'); // กลับไปหน้ารวม

        } catch (error: any) {
            const backendMessage = error?.response?.data?.message || error?.message;
            alert(backendMessage || "เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง");
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <div className='p-8 space-y-6 bg-gray-50 min-h-screen'>
            { /* Header */ }
            <div className="flex items-center justify-between">
                <div className='flex-col space-y-2'>
                    <nav className="flex items-center text-sm text-gray-500 gap-2 font-light">
                        <Link to="/owner/orders" className="hover:text-gray-900 transition-colors cursor-pointer">
                            จัดการใบสั่งซื้อ
                        </Link>
                        <ChevronRight className="w-4 h-4 text-gray-400" />                        
                        <span className="text-black font-normal">สร้างใบสั่งซื้อสินค้าใหม่</span>
                    </nav>
                    <Heading level='h1' weight='semibold' className='m-0 text-black'>
                        สร้างใบสั่งซื้อสินค้าใหม่
                    </Heading>
                </div>
                <div className='flex items-end gap-4 justify-end'>
                    <Button size='md' variant='tertiary' onClick={() => handleSavePO('DRAFT') }>บันทึกฉบับร่าง</Button>
                    <Button size='md' onClick={() => handleSavePO('PENDING') }>ส่งอนุมัติ</Button>
                </div>
            </div>

            { /* Contents */ }
            { /* Left Side */ }
            <div className="flex gap-6 items-stretch">
                <div className='w-1/4 flex flex-col gap-6'>
                    <Card className='border-l-[5px] border-l-red-800'>
                        <CardHeader className='items-center justify-start gap-4 mt-2 mb-2'>
                            <CardTitle className='text-base text-red-800'><Building2 className="h-6 w-6" /></CardTitle>
                            <CardTitle className='text-lg text-black'>รายละเอียดบริษัท</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className='grid grid-rows-2 gap-6 items-end mb-2'>
                                <Select 
                                    label='ชื่อบริษัท/ผู้จัดจำหน่าย'
                                    value={listsSupplier}
                                    onChange={(e) => setlistsSupplier(e.target.value)}
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
                            <CardTitle className='text-base text-black'><ShoppingBag className="h-6 w-6" /></CardTitle>
                            <CardTitle className='text-lg text-black'>รายการพรีออเดอร์</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className='flex items-center justify-between h-fit'>
                                <Heading level='p' weight='light'>
                                    {isPreordersLoading 
                                        ? "กำลังดึงข้อมูล..." 
                                        : `มีรายการพรีออเดอร์ค้างอยู่ ${totalPreorders} รายการ`
                                    }
                                </Heading>
                                
                                {/* 4. สั่งให้ปุ่มตั้งค่า Modal เป็นเปิด */}
                                <Button 
                                    variant='tertiary' 
                                    size='sm'
                                    disabled={isPreordersLoading || totalPreorders === 0}
                                    onClick={() => setIsPreorderModalOpen(true)}
                                >
                                    เลือกรายการ
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                    <div className='bg-[#22252a] text-white rounded-md p-6 h-fit shadow-sm relative overflow-hidden'>
                        <div className='absolute right-4 top-4 opacity-5 pointer-events-none'>
                            <ChartNoAxesCombined className='w-12 h-12' />
                        </div>
                        <div>
                            <Heading level='h5' weight='semibold' className='text-white'>ข้อมูลวิเคราะห์จากระบบ</Heading>
                            <Heading level='p' weight='light' className='text-white mt-3'>โดยปกติบริษัทรายนี้จะใช้เวลาจัดส่ง  ทำการ เราขอแนะนำให้คุณวางแผนการขนส่งสำหรับ </Heading>
                            <div className='flex items-center justify-start gap-3 mt-3'>
                                <Heading className='text-base text-white w-auto m-0'>{<Info className="h-4 w-4" />}</Heading>
                                <Heading level='p' weight='light' className='text-white w-auto m-0'>ระยะเวลาการจัดส่ง: แม่นยำร้อยละ </Heading>
                            </div>
                        </div>
                    </div>
                </div>

                { /* Right Side */ }
                <div className='flex flex-col items-start w-3/4 gap-4'>
                    <Card className="flex items-center w-full h-fit bg-white p-4 gap-4">
                        <div className="relative flex-1">
                            <Input
                                ref={searchInputRef} // ผูก Ref เข้ากับ Input
                                value={searchInput}
                                onChange={(e) => handleSearchInput(e.target.value)}
                                onKeyDown={(e) => {
                                    // ดักจับว่าปุ่มที่กด (หรือที่เครื่องสแกนส่งมา) คือ Enter หรือไม่
                                    if (e.key === 'Enter') {
                                        e.preventDefault(); // ป้องกันฟอร์ม Submit อัตโนมัติ (ถ้ามี)
                                        handleScannerEnter();
                                    }
                                }}
                                className="bg-transparent border-none shadow-none focus:outline-none"
                                disabled={!listsSupplier}
                                leftIcon={
                                    <div className="pointer-events-auto relative z-10 flex items-center justify-center">
                                        <ScanBarcode 
                                            className={`w-6 h-6 transition-colors ${
                                                !listsSupplier 
                                                ? 'text-gray-300 cursor-not-allowed' 
                                                : 'text-gray-500 cursor-pointer hover:text-gray-700'
                                            }`} 
                                            onClick={(e) => {
                                                e.stopPropagation(); 
                                                if (!listsSupplier) {
                                                    alert("กรุณาเลือกผู้จัดจำหน่ายก่อน");
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
                            
                            {/* เพิ่ม Dropdown แสดงผลลัพธ์การค้นหา */}
                            {searchResults.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
                                    {searchResults.map((product) => (
                                        <div 
                                            key={product.id}
                                            className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                                            onClick={() => handleSelectProduct(product)}
                                        >
                                            {product.name} (รหัส: {product.code})
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="w-px h-8 bg-gray-300/60 mx-1"></div>

                        <Input
                            type="number"
                            min={1}
                            value={addQuantity}
                            onChange={(e) => {
                                const val = e.target.value;
                                setAddQuantity(val === "" ? "" : Math.max(0, Number(val)));
                            }}
                            containerClassName="w-32 shrink-0"
                            className="bg-transparent border-none shadow-none text-center px-1 focus:outline-none"
                            placeholder="จำนวน"
                        />

                        {/* เพิ่ม onClick */}
                        <Button size='md' variant='secondary' onClick={handleAddItem}>
                            เพิ่มลงใบสั่งซื้อ
                        </Button>
                    </Card>
                    <Card className="w-full h-full overflow-hidden" noPadding>
                        <Table>
                            <TableHeader className="bg-gray-100 text-gray-600">
                                <TableRow>
                                    <TableHead className="pl-6">ลำดับ</TableHead>
                                    <TableHead>ประเภท</TableHead>
                                    <TableHead>รหัสสินค้า</TableHead>
                                    <TableHead>ชื่อสินค้า</TableHead>
                                    <TableHead className="text-center">จำนวนต่อหน่วย</TableHead>
                                    <TableHead className="text-center">หน่วย</TableHead>
                                    <TableHead className="text-center">ราคาต่อหน่วย</TableHead>
                                    <TableHead className="text-right pr-6">ราคารวม</TableHead>
                                    <TableHead className="text-center">จัดการ</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody className="text-gray-700">
                                {item.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className='py-16'>
                                        <div className="flex flex-col items-center justify-center gap-4 text-gray-500">
                                            <ShoppingCart className="w-24 h-24 text-gray-300" />
                                            <span>ไม่พบข้อมูลรายการสินค้า กรุณาเพิ่มสินค้า</span>
                                        </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    item.map((row, index) => (
                                        <TableRow key={row.id}>
                                            <TableCell className="pl-6">{index + 1}</TableCell>
                                            <TableCell>ทั่วไป</TableCell> {/* ปรับตามประเภทจริง */}
                                            <TableCell>{row.product_name_code_snapshot}</TableCell>
                                            <TableCell>{row.product_name_snapshot}</TableCell>
                                            <TableCell className="text-center">
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={row.quantity}
                                                    onChange={(e) => handleUpdateItem(row.id, 'quantity', e.target.value)}
                                                    className="w-16 text-center bg-transparent border border-transparent hover:border-gray-200 focus:border-gray-400 rounded px-1 py-0.5 focus:outline-none"
                                                /></TableCell>
                                            <TableCell className="text-center">{row.unit}</TableCell>
                                            <TableCell className="text-center">{row.unit_price} ฿</TableCell>
                                            <TableCell className="text-right pr-6">{row.sub_total} ฿</TableCell>
                                            <TableCell className="text-center">
                                                <button 
                                                    onClick={() => handleRemoveItem(row.id.toString())}
                                                    className="text-red-500 hover:text-red-700 font-light"
                                                >
                                                    ลบ
                                                </button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
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
        </div>
    )
}

export default CreatePurchaseOrders;