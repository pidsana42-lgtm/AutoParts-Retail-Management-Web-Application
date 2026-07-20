import { useState, useRef, useEffect, useCallback } from 'react';
import { poService } from '../../../../service/http/purchase_orders/po_service';
import type { LocalPOItem, ProductSearchResponse } from '../../../../interface/purchase_orders/po_interface';
import { generateLocalId } from '../../../../utils/generateId';

const SEARCH_DEBOUNCE_MS = 300;

export const usePoScanner = (supplierId: string, setPoItems: React.Dispatch<React.SetStateAction<LocalPOItem[]>>
) => {
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

    // 3. ฟังก์ชันเพิ่มสินค้าลงใบสั่งซื้อ
    const handleAddItem = () => {
        // 1. เช็คว่ามีสินค้าถูกเลือกไว้จริงๆ หรือไม่ (สมมติว่าคุณเก็บไว้ใน state selectedProduct)
        if (!selectedProduct || !selectedProduct.id) {
            alert('กรุณาเลือกสินค้าจากรายการค้นหาก่อนเพิ่มลงบิล');
            return;
        }

        // 2. เช็คจำนวน
        if (!addQuantity || addQuantity <= 0) {
            alert('กรุณาระบุจำนวนสินค้าให้ถูกต้อง');
            return;
        }

        // 3. คำนวณ sub_total ให้ตั้งแต่ต้นทาง
        const subTotal = addQuantity * selectedProduct.price;

        const newItem: LocalPOItem = {
            id: generateLocalId(),
            product_id: selectedProduct.id,
            product_name_code_snapshot: selectedProduct.code,
            product_name_snapshot: selectedProduct.name,
            quantity: addQuantity,
            unit: selectedProduct.unit,
            unit_price: selectedProduct.price,
            sub_total: subTotal,
            order_type: 'สั่งซื้อ' as const,
            notes: "",
            alert_id: undefined,
            pre_order_item_id: undefined
        } as unknown as LocalPOItem;

        setPoItems(prev => [...prev, newItem]);
        
        // เคลียร์ค่า
        setSearchInput('');
        setAddQuantity(1);
        setSelectedProduct(null);
    };

    // 4. ฟังก์ชันสำหรับการสแกนด้วยกล้อง (ใช้งานผ่าน Icon)
    const handleScannerEnter = async () => {
        if (!supplierId) {
            alert("กรุณาเลือกชื่อบริษัท/ผู้จัดจำหน่ายก่อนสแกนสินค้า");
            return;
        }

        if (!searchInput) return;

        setIsSearching(true);
        try {
            // ค้นหาสินค้าด้วยรหัสบาร์โค้ดที่อยู่ในช่อง Input
            const results = await poService.searchProduct(searchInput, supplierId);
            
            if (results && results.length > 0) {
                // หากพบสินค้า ให้เลือกสินค้าตัวแรกหรือตัวที่รหัสตรงกันเป๊ะ
                const product = results.find((p) => p.code === searchInput) || results[0];
                handleSelectProduct(product);
            } else {
                // หากไม่พบ สามารถใช้ไลบรารี Toast แจ้งเตือนแทน Alert ได้ในอนาคต
                alert(`ไม่พบสินค้ารหัส: ${searchInput}`);
                setSearchInput(""); // เคลียร์ช่องทิ้งเพื่อรอสแกนใหม่
            }
        } catch (error) {
            console.error("สแกนบาร์โค้ดล้มเหลว:", error);
        } finally {
            setIsSearching(false);
        }
    };

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
        highlightedIndex,
        setHighlightedIndex,
        handleSearchKeyDown
    };
};