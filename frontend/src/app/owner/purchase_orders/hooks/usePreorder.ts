import { useState, useEffect, useCallback, type Dispatch, type SetStateAction } from 'react';
import type { PreorderItem, LocalPOItem } from '../../../../interface/purchase_orders/po_interface';
import { poService } from '../../../../service/http/purchase_orders/po_service';
import { generateLocalId } from '../../../../utils/generateId'; 

export const usePreorders = (items: LocalPOItem[], setItems: Dispatch<SetStateAction<LocalPOItem[]>>,
    setIsPreorderModalOpen: Dispatch<SetStateAction<boolean>>
) => {
    // 1. ส่วนดึงข้อมูล (Data Fetching)
    const [preorders, setPreorders] = useState<PreorderItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAllPendingPreorders = async () => {
            setIsLoading(true);
            setError(null);
            
            try {
                const response = await poService.getPendingPreorders();
                setPreorders(response || []);
            } catch (err) {
                if (err instanceof Error) {
                    setError(err.message);
                } else {
                    setError("เกิดข้อผิดพลาดในการดึงข้อมูลพรีออเดอร์");
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchAllPendingPreorders();
    }, []); 

    const totalPreorders = preorders.length;

    // 2. ส่วนจัดการ State (State Management)
    const handleAddPreorderToPO = useCallback((selectedPreorder: PreorderItem) => {
        const isDuplicate = items.some(existingItem => existingItem.product_id === selectedPreorder.product_id);
        
        if (isDuplicate) {
            alert(`มีรายการ "${selectedPreorder.product_name}" อยู่ในใบสั่งซื้อแล้ว`);
            return;
        }

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
            order_type: 'พรีออเดอร์',
            pre_order_item_id: selectedPreorder.id 
        };

        setItems(prev => [...prev, newItem]);
        setIsPreorderModalOpen(false); // ปิด Modal หรือ Panel ทันที
        
    }, [items, setItems, setIsPreorderModalOpen]);

    // 3. ส่งออกข้อมูลและฟังก์ชันทั้งหมด
    return {
        preorders,
        totalPreorders,
        isLoading,
        error,
        handleAddPreorderToPO 
    };
};
