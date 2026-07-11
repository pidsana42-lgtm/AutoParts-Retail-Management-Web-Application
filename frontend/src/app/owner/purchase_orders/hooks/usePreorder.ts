import { useState, useEffect } from 'react';
import type { PreorderItem } from '../../../../interface/purchase_orders/po_interface';
import { poService } from '../../../../service/http/purchase_orders/po_service';

// ไม่ต้องรับ supplierId เป็นพารามิเตอร์แล้ว
export const usePreorders = () => {
    const [preorders, setPreorders] = useState<PreorderItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAllPendingPreorders = async () => {
            setIsLoading(true);
            setError(null);
            
            try {
                // เรียกใช้ Service แบบไม่ต้องส่ง ID
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

    return {
        preorders,
        totalPreorders,
        isLoading,
        error
    };
};