import { useState, useRef, useEffect, useCallback } from 'react';
import { poService } from '../../../../service/http/purchase_orders/po_service';
import type { LocalPOItem, ProductSearchResponse } from '../../../../interface/purchase_orders/po_interface';
import { generateLocalId } from '../../../../utils/generateId';
import { useToast } from '../../../../components/elements/toast';
import { isValidPrice, isValidQuantity } from '../validation';

const SEARCH_DEBOUNCE_MS = 300;

export const usePoScanner = (supplierId: string, poItems: LocalPOItem[], setPoItems: React.Dispatch<React.SetStateAction<LocalPOItem[]>>
) => {
    const { toast } = useToast();
    const [searchInput, setSearchInput] = useState("");
    const [addQuantity, setAddQuantity] = useState<number | "">("");
    const [searchResults, setSearchResults] = useState<ProductSearchResponse[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<ProductSearchResponse | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    // กัน race condition: ยิงหลายคำค้นพร้อมกัน ผลลัพธ์เก่าต้องไม่ทับผลลัพธ์ใหม่
    const latestRequestId = useRef(0);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // ควบคุมการ Hightlight สินค้าด้วยลูกศรแล้ว enter ได้
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    // เก็บข้อมูลรอยืนยัน เมื่อสินค้าที่จะเพิ่มมีอยู่ในใบสั่งซื้อแล้ว (แถวประเภท "สั่งซื้อ")
    const [duplicatePrompt, setDuplicatePrompt] = useState<{
        product: ProductSearchResponse;
        addQty: number;
        existingQty: number;
        unit: string;
    } | null>(null);
    useEffect(() => {
        latestRequestId.current++;
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        setSearchInput('');
        setSearchResults([]);
        setSelectedProduct(null);
        setDuplicatePrompt(null);
        setAddQuantity('');
        setIsSearching(false);
    }, [supplierId]);
    // รีเซ็ตไฮไลต์กลับไปที่รายการแรกทุกครั้งที่ผลการค้นหาเปลี่ยน
    useEffect(() => {
        setHighlightedIndex(searchResults.length > 0 ? 0 : -1);
    }, [searchResults]);
    // แยกฟังก์ชันยิง API ออกมา เพื่อเรียกได้ทั้งแบบ debounce (พิมพ์) และทันที (สแกน)
    const runSearch = useCallback(async (keyword: string, supId: string) => {
        const requestId = ++latestRequestId.current;
        setIsSearching(true);
        try {
            const results = await poService.searchProduct(keyword, supId);
            if (requestId === latestRequestId.current) {
                setSearchResults(results || []);
            }
        } catch (error) {
            console.error("ค้นหาสินค้าล้มเหลว:", error);
        } finally {
            if (requestId === latestRequestId.current) {
                setIsSearching(false);
            }
        }
    }, []);
    
    useEffect(() => {
        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
        };
    }, []);

    // 1. ฟังก์ชันค้นหาสินค้าจากการพิมพ์ (debounce กันยิง API ถี่เกินไป)
    const handleSearchInput = (keyword: string) => {
        setSearchInput(keyword);
        setSearchResults([]); 
        setHighlightedIndex(-1);
        if (selectedProduct && keyword !== selectedProduct.name) {
            setSelectedProduct(null);
        }
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        // ดักจับ Supplier ID
        if (!supplierId) {
            setSearchResults([]);
            if (keyword.length > 0) {
                console.warn("กรุณาเลือกชื่อบริษัท/ผู้จัดจำหน่ายก่อนค้นหาสินค้า"); 
            }
            return; 
        }
        if (keyword.length >= 1) {
            debounceTimer.current = setTimeout(() => {
                runSearch(keyword, supplierId);
            }, SEARCH_DEBOUNCE_MS);
        } else {
            setSearchResults([]);
            latestRequestId.current++; // ยกเลิก request ที่ค้างอยู่ (ถ้ามี)
        }
    };

    // 2. ฟังก์ชันเมื่อเลือกสินค้าจาก Dropdown
    const handleSelectProduct = (product: ProductSearchResponse) => {
        setSelectedProduct(product);
        setSearchInput(product.name);
        setSearchResults([]); 
    };

    // ฟังก์ชันกลาง: เพิ่ม/บวกจำนวนสินค้าลงตะกร้าจริง ๆ (เรียกทั้งจากเพิ่มปกติ และจากยืนยัน duplicate)
    const commitAddItem = (product: ProductSearchResponse, qty: number) => {
        const subTotal = qty * product.price;
        setPoItems(prev => {
            const idx = prev.findIndex(
                row => row.product_id === product.id && row.order_type === 'สั่งซื้อ'
            );
            if (idx !== -1) {
                // มีอยู่แล้ว -> บวกจำนวนเข้าแถวเดิม
                const updated = [...prev];
                const target = updated[idx];
                const newQuantity = target.quantity + qty;
                updated[idx] = {
                    ...target,
                    quantity: newQuantity,
                    sub_total: newQuantity * target.unit_price,
                };
                return updated;
            }
            // ยังไม่มี -> สร้างแถวใหม่ตามปกติ
            const newItem: LocalPOItem = {
                id: generateLocalId(),
                product_id: product.id,
                product_code_snapshot: product.code,
                supply_product_code_snapshot: product.supply_product_code || '',
                product_name_snapshot: product.name,
                quantity: qty,
                unit: product.unit,
                unit_price: product.price,
                sub_total: subTotal,
                order_type: 'สั่งซื้อ' as const,
                notes: "",
                alert_id: undefined,
                pre_order_item_id: undefined
            } as unknown as LocalPOItem;
            return [...prev, newItem];
        });
        // เคลียร์ค่า
        setSearchInput('');
        setAddQuantity(1);
        setSelectedProduct(null);
    };

    // 3. ฟังก์ชันเพิ่มสินค้าลงใบสั่งซื้อ
    const handleAddItem = () => {
        if (!isValidQuantity(Number(supplierId))) {
            toast({ title: 'เกิดข้อผิดพลาด', message: 'กรุณาเลือกผู้จัดจำหน่าย', variant: 'error' });
            return false;
        }
        if (!selectedProduct || !selectedProduct.id) {
            toast({ title: 'เกิดข้อผิดพลาด', message: 'กรุณาเลือกสินค้าจากรายการค้นหาก่อนเพิ่มลงบิล', variant: 'error' });
            return;
        }
        if (!isValidQuantity(Number(addQuantity))) {
            toast({ title: 'เกิดข้อผิดพลาด', message: 'กรุณาระบุจำนวนสินค้าให้ถูกต้อง', variant: 'error' });
            return;
        }
        const qty = Number(addQuantity);
        if (!isValidPrice(selectedProduct.price) || !Number.isFinite(qty * selectedProduct.price)) {
            toast({ title: 'เกิดข้อผิดพลาด', message: 'ราคาสินค้าไม่ถูกต้อง กรุณาตรวจสอบราคาก่อนเพิ่มลงใบสั่งซื้อ', variant: 'error' });
            return false;
        }
        // เช็คว่ามีสินค้านี้ในตะกร้าแล้วหรือยัง (เฉพาะแถวประเภท "สั่งซื้อ" ไม่ปนกับพรีออเดอร์)
        const existing = poItems.find(
            row => row.product_id === selectedProduct.id && row.order_type === 'สั่งซื้อ'
        );
        if (existing) {
            if (!isValidQuantity(existing.quantity + qty) || !Number.isFinite((existing.quantity + qty) * existing.unit_price)) {
                toast({ title: 'เกิดข้อผิดพลาด', message: 'จำนวนหรือยอดรวมสูงเกินกว่าที่ระบบรองรับ', variant: 'error' });
                return false;
            }
            // มีอยู่แล้ว -> รอให้ผู้ใช้ยืนยันผ่าน Modal ก่อน (ดู duplicatePrompt / confirmDuplicateAdd)
            setDuplicatePrompt({ product: selectedProduct, addQty: qty, existingQty: existing.quantity, unit: existing.unit });
            return false;
        }
        commitAddItem(selectedProduct, qty);
        return true;
    };

    // ยืนยันเพิ่มจำนวนทับรายการเดิม (จาก Modal)
    const confirmDuplicateAdd = () => {
        if (!duplicatePrompt) return;
        commitAddItem(duplicatePrompt.product, duplicatePrompt.addQty);
        setDuplicatePrompt(null);
    };

    // ยกเลิกการเพิ่มจำนวนทับรายการเดิม
    const cancelDuplicateAdd = () => setDuplicatePrompt(null);

    // 4. ฟังก์ชันกลางสำหรับ "รหัสบาร์โค้ด" ไม่ว่าจะมาจากเครื่องสแกน (HID) หรือกล้อง
    //    ใช้ exact match กับ code ก่อน ถ้าไม่เจอค่อย fallback ไปที่ผลลัพธ์แรก
    const handleBarcodeDetected = useCallback(async (rawCode: string) => {
        const code = rawCode.trim();
        if (!code) return;
        if (!supplierId) {
            toast({ title: 'เกิดข้อผิดพลาด', message: 'กรุณาเลือกชื่อบริษัท/ผู้จัดจำหน่ายก่อนสแกนสินค้า', variant: 'error' });
            return;
        }
        // ยกเลิก debounce/การค้นหาจากการพิมพ์ที่อาจค้างอยู่ ไม่ให้ทับผลลัพธ์การสแกน
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        const requestId = ++latestRequestId.current;
        setSearchInput(code);
        setSearchResults([]);
        setIsSearching(true);
        try {
            const results = await poService.searchProduct(code, supplierId);
            if (requestId !== latestRequestId.current) return;
            if (results && results.length > 0) {
                // หาโค้ดที่ตรงเป๊ะก่อน ถ้าไม่เจอค่อยใช้ตัวแรกของผลลัพธ์
                const product = results.find((p) => p.barcode === code || p.code === code) || results[0];
                handleSelectProduct(product);
            } else {
                toast({ title: 'เกิดข้อผิดพลาด', message: `ไม่พบสินค้ารหัส: ${code}`, variant: 'error' });
                setSearchInput("");
            }
        } catch (error) {
            console.error("สแกนบาร์โค้ดล้มเหลว:", error);
        } finally {
            if (requestId === latestRequestId.current) setIsSearching(false);
        }
    }, [supplierId]);

    // 4a. เครื่องสแกน HID (พิมพ์เป็นคีย์บอร์ดแล้ว Enter) — ใช้ค่าจาก searchInput ที่พิมพ์เข้ามาแล้ว
    const handleScannerEnter = useCallback(async () => {
        if (!searchInput) return;
        await handleBarcodeDetected(searchInput);
    }, [searchInput, handleBarcodeDetected]);

    // 4b. กล้อง/เว็บแคม (เช่น react-qr-barcode-scanner) — เรียกตอน decode ได้ผลลัพธ์ ส่ง code มาตรง ๆ
    const handleCameraScan = useCallback(async (code: string) => {
        await handleBarcodeDetected(code);
    }, [handleBarcodeDetected]);

    // 5. ฟังก์ชันดักปุ่มคีย์บอร์ดตอนอยู่ในช่องค้นหา (ลูกศรเลื่อน, Enter เลือก)
    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (searchResults.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlightedIndex((prev) => (prev + 1) % searchResults.length);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlightedIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                const selected = searchResults[highlightedIndex] ?? searchResults[0];
                handleSelectProduct(selected);
                setHighlightedIndex(-1);
                return;
            }
            if (e.key === 'Escape') {
                setSearchResults([]);
                setHighlightedIndex(-1);
                return;
            }
        }
        // ไม่มี dropdown ให้เลือก -> พฤติกรรมเดิม (บาร์โค้ดสแกนแล้ว auto-add)
        if (e.key === 'Enter') {
            e.preventDefault();
            handleScannerEnter();
        }
    };

    return {
        searchInput,
        addQuantity,
        setAddQuantity,
        searchResults,
        isSearching,
        handleSearchInput,
        handleSelectProduct,
        handleAddItem,
        handleScannerEnter,
        handleCameraScan,
        highlightedIndex,
        setHighlightedIndex,
        handleSearchKeyDown,
        selectedProduct,
        duplicatePrompt,
        confirmDuplicateAdd,
        cancelDuplicateAdd
    };
};
