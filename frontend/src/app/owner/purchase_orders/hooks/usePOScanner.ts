import { useState } from 'react';
import { poService } from '../../../../service/http/purchase_orders/po_service';
import type { POItemResponse, ProductSearchResponse } from '../../../../interface/purchase_orders/po_interface';
import { generateLocalId } from '../../../../utils/generateId';

export const usePoScanner = (
    supplierId: string, 
    poItems: POItemResponse[], 
    setPoItems: React.Dispatch<React.SetStateAction<POItemResponse[]>>
) => {
    const [searchInput, setSearchInput] = useState("");
    const [addQuantity, setAddQuantity] = useState<number | "">("");
    const [searchResults, setSearchResults] = useState<ProductSearchResponse[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<ProductSearchResponse | null>(null);
    const [isSearching, setIsSearching] = useState(false);

    // 1. ฟังก์ชันค้นหาสินค้าจากการพิมพ์
    const handleSearchInput = async (keyword: string) => {
        setSearchInput(keyword);
        
        if (selectedProduct && keyword !== selectedProduct.name) {
            setSelectedProduct(null);
        }

        // ดักจับ Supplier ID
        if (!supplierId) {
            setSearchResults([]);
            if (keyword.length > 0) {
                console.warn("กรุณาเลือกชื่อบริษัท/ผู้จัดจำหน่ายก่อนค้นหาสินค้า"); 
            }
            return; 
        }

        if (keyword.length >= 2) {
            setIsSearching(true);
            try {
                const results = await poService.searchProduct(keyword, supplierId);
                setSearchResults(results || []);
            } catch (error) {
                console.error("ค้นหาสินค้าล้มเหลว:", error);
            } finally {
                setIsSearching(false);
            }
        } else {
            setSearchResults([]);
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
        if (!selectedProduct || !addQuantity) {
            alert("กรุณาเลือกสินค้าจากรายการค้นหา และระบุจำนวน");
            return;
        }

        // Logic ข้อ 3: เช็คสินค้าซ้ำ ถ้ามีแล้วให้แจ้งเตือนและหยุดการทำงาน
        const isDuplicate = poItems.some(item => item.product_id === selectedProduct.id);
        if (isDuplicate) {
            alert(`มีรายการ "${selectedProduct.name}" อยู่ในใบสั่งซื้อแล้ว ไม่สามารถเพิ่มซ้ำได้`);
            return;
        }

        const quantityNum = Number(addQuantity);
        
        // Logic ข้อ 2: ดึงราคาต้นทุน 
        const unitCost = Number(selectedProduct.price || 0); 

        const newItem: POItemResponse = {
            id: generateLocalId(), 
            product_id: selectedProduct.id,
            product_name_snapshot: selectedProduct.name,
            product_name_code_snapshot: selectedProduct.code || "-",
            quantity: quantityNum,
            unit: selectedProduct.unit || "ชิ้น", // Logic ข้อ 4: เก็บหน่วยนับ
            unit_price: unitCost,
            sub_total: unitCost * quantityNum
        };

        // แอดลงตะกร้า
        setPoItems(prev => [...prev, newItem]);

        // เคลียร์ช่องให้พร้อมสแกน/พิมพ์ชิ้นต่อไป
        setSearchInput("");
        setSelectedProduct(null);
        setAddQuantity("");
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

    return {
        searchInput,
        addQuantity,
        setAddQuantity,
        searchResults,
        isSearching,
        handleSearchInput,
        handleSelectProduct,
        handleAddItem,
        handleScannerEnter
    };
};