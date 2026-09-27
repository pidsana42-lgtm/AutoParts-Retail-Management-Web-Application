import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

import Breadcrumb from "../../../../components/elements/breadcrumb";
import { useUserRole } from "../../../../hooks/useUserRole";
import { useSalesHistory } from "../../../employee/pos/hooks/useSalesHistory";
import { usePrintReceipt } from "../../../employee/pos/hooks/usePrintReceipt";
import OrderDetailPanel from "../../../employee/pos/components/order_detail_panel";
import { usePathBasePrefix } from "../../../../utils/usePathBasePrefix";

// StockMovementOrderDetail: หน้ารายละเอียดออเดอร์ขาย (POS) ที่กดเข้ามาจากฟีด "การเคลื่อนไหวของคลังสินค้า"
// ใช้ข้อมูล/ตรรกะชุดเดียวกับแผงรายละเอียดที่หน้า "ประวัติการขายสินค้า" ทุกอย่าง (ผ่าน OrderDetailPanel ที่แยกออกมา
// ใช้ร่วมกัน) ต่างกันแค่ดีไซน์ที่นี่เป็นหน้าเดี่ยวมีเกล็ดขนมปังของตัวเอง ไม่ใช่แผงเลื่อนทับหน้ารายการ
export default function StockMovementOrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const basePath = usePathBasePrefix();
  const { isOwnerOrManager } = useUserRole();
  const { printingOrderId, handlePrintReceipt } = usePrintReceipt();

  const {
    selectedOrderId,
    orderDetail,
    isDetailLoading,
    cancelReason,
    setCancelReason,
    cancelRemark,
    setCancelRemark,
    isCancelling,
    handleRequestCancel,
    handleDirectCancelByOwner,
    handleRejectCancelByOwner,
    handleRevertCancel,
    getStatusText,
    setSelectedOrderId,
  } = useSalesHistory();

  // โหลดรายละเอียดออเดอร์ตาม :orderId ใน URL ทันทีที่เข้าหน้านี้
  useEffect(() => {
    const id = Number(orderId);
    if (id) setSelectedOrderId(id);
  }, [orderId, setSelectedOrderId]);

  return (
    <div className="space-y-6 p-6 font-sans bg-gray-50 min-h-screen">
      <Breadcrumb
        items={[
          { label: "การเคลื่อนไหวของคลังสินค้า", path: `${basePath}/stock/stock-movement` },
          { label: "รายละเอียดออเดอร์" },
        ]}
      />

      {selectedOrderId ? (
        <OrderDetailPanel
          selectedOrderId={selectedOrderId}
          orderDetail={orderDetail}
          isDetailLoading={isDetailLoading}
          cancelReason={cancelReason}
          setCancelReason={setCancelReason}
          cancelRemark={cancelRemark}
          setCancelRemark={setCancelRemark}
          isCancelling={isCancelling}
          handleRequestCancel={handleRequestCancel}
          handleDirectCancelByOwner={handleDirectCancelByOwner}
          handleRejectCancelByOwner={handleRejectCancelByOwner}
          handleRevertCancel={handleRevertCancel}
          getStatusText={getStatusText}
          handlePrintReceipt={handlePrintReceipt}
          printingOrderId={printingOrderId}
          isOwnerOrManager={isOwnerOrManager}
          onClose={() => navigate(`${basePath}/stock/stock-movement`)}
          variant="page"
        />
      ) : (
        <div className="flex h-[calc(100vh-16rem)] w-full flex-col items-center justify-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-[#B70011]" />
          <span className="text-sm font-medium text-slate-400">กำลังโหลดข้อมูลออเดอร์...</span>
        </div>
      )}
    </div>
  );
}
