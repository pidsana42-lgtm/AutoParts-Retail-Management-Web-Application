// order_detail_panel.tsx — เนื้อหารายละเอียดออเดอร์ 1 ใบ (ข้อมูลลูกค้า/รายการสินค้า/สรุปยอด/ปุ่มจัดการยกเลิก)
// แยกออกมาให้ใช้ร่วมกันได้ 2 ที่ ไม่ให้ตรรกะ/ดีไซน์เพี้ยนกันระหว่างจุดที่ใช้งาน:
// (1) แผงเลื่อนจากขวาที่หน้า "ประวัติการขายสินค้า" (variant="drawer", ของเดิม)
// (2) หน้าเดี่ยวที่กดเข้ามาจากฟีด "การเคลื่อนไหวของคลังสินค้า" (variant="page")
import { useNavigate } from "react-router-dom";
import { Printer, X, CopyPlus } from "lucide-react";
import Heading from "../../../../components/elements/heading";
import Text from "../../../../components/elements/text";
import Button from "../../../../components/elements/button";
import Badge from "../../../../components/elements/badge";
import { Card, CardContent } from "../../../../components/elements/card";
import { getDisplayCustomerName, getPaymentVariant } from "../../../../utils/poshelpers";
import { formatDate } from "../../../../utils/date";
import { cn } from "../../../../utils/component";
import type { useSalesHistory } from "../hooks/useSalesHistory";

type SalesHistoryHook = ReturnType<typeof useSalesHistory>;

export interface OrderDetailPanelProps
  extends Pick<
    SalesHistoryHook,
    | "selectedOrderId"
    | "orderDetail"
    | "isDetailLoading"
    | "cancelReason"
    | "setCancelReason"
    | "cancelRemark"
    | "setCancelRemark"
    | "isCancelling"
    | "handleRequestCancel"
    | "handleDirectCancelByOwner"
    | "handleRejectCancelByOwner"
    | "handleRevertCancel"
    | "getStatusText"
  > {
  handlePrintReceipt: (orderId: number | string, orderNumber?: string) => Promise<void>;
  printingOrderId: number | string | null;
  isOwnerOrAdmin: boolean;
  onClose: () => void;
  // drawer = แผงเลื่อนจากขวา มี backdrop มืด (ของเดิม) / page = การ์ดเต็มพื้นที่ ไม่มี backdrop (ใช้ตอนเป็นหน้าเดี่ยว)
  variant?: "drawer" | "page";
}

export default function OrderDetailPanel({
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
  handlePrintReceipt,
  printingOrderId,
  isOwnerOrAdmin,
  onClose,
  variant = "drawer",
}: OrderDetailPanelProps) {
  const navigate = useNavigate();

  if (!selectedOrderId) return null;

  const body =
            isDetailLoading ? (
              <div className="flex-1 flex items-center justify-center p-6">
                <Text variant="small" className="text-gray-500">
                  กำลังโหลดข้อมูลออเดอร์...
                </Text>
              </div>
            ) : orderDetail ? (
              <div className="flex-1 overflow-y-auto">
                {/* Header */}
                <div className="p-5 border-b border-[#E7BDB8] flex items-start justify-between bg-white">
                  <div>
                    <Heading
                      level="h3"
                      weight="normal"
                      className="text-xl text-[#1C1B1B] mb-0.5"
                    >
                      รายละเอียดออเดอร์
                    </Heading>
                    <Text variant="xs" className="text-[#6B7280]">
                      หมายเลขบิล:{" "}
                      <span className="font-semibold text-[#1C1B1B]">
                        {orderDetail.order_number}
                      </span>
                    </Text>
                  </div>
                  <button
                    type="button"
                    onClick={() => onClose()}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Scrollable Body Content */}
                <div className="p-6 space-y-6">
                  {/* ข้อมูลลูกค้า */}
                  <div>
                    <Text variant="xs" className="font-normal text-[#E51C23] mb-2">
                      ข้อมูลลูกค้า
                    </Text>
                    <Card className="bg-[#F6F3F2] rounded-none border-gray-100 border-l-3 border-l-[#E51C23] shadow-none">
                      <CardContent className="p-4 space-y-1">
                        <Text variant="small" className="font-medium text-[#1C1B1B] mb-0">
                          {getDisplayCustomerName(orderDetail)}
                        </Text>
                        <Text variant="xs" className="text-[#6B7280] mb-0">
                          เบอร์โทร: {orderDetail.phone_number || orderDetail.customer_phone_temp || "-"}
                        </Text>
                        {orderDetail.customer_type_name && (
                          <Text variant="xs" className="text-[#6B7280] mb-0">
                            ประเภท: {orderDetail.customer_type_name}
                          </Text>
                        )}
                        {orderDetail.address && (
                          <Text variant="xs" className="text-[#6B7280] mb-0 truncate">
                            ที่อยู่: {orderDetail.address}
                          </Text>
                        )}
                        <Text variant="xs" className="text-[#6B7280] mb-0">
                          พนักงานขาย: {orderDetail.created_by_name || "-"}
                        </Text>
                      </CardContent>
                    </Card>
                  </div>

                  {/* ประวัติการกู้คืนคำขอ (แสดงเฉพาะเมื่อมีการกู้คืน) */}
                  {(() => {
                    const revertNotes = (orderDetail.note || "")
                      .split("|")
                      .map((s) => s.trim())
                      .filter((s) => s.includes("กู้คืน"));

                    if (revertNotes.length === 0) return null;

                    return (
                      <div>
                        <Text variant="xs" className="font-normal text-[#E51C23] mb-2">
                          ประวัติการกู้คืนคำขอยกเลิก
                        </Text>
                        <Card className="bg-[#F6F3F2] rounded-none border-gray-200  shadow-none">
                          <CardContent className="p-3 space-y-1">
                            {revertNotes.map((noteText, idx) => (
                              <Text key={idx} variant="xs" className="text-[#1C1B1B] font-light mb-0">
                                {noteText}
                              </Text>
                            ))}
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })()}

                  {/* รายการสินค้าจริง */}
                  <div>
                    <Text
                      variant="xs"
                      className="font-normal text-[#E51C23] mb-3"
                    >
                      รายการสินค้า ({orderDetail.items?.length || 0})
                    </Text>
                    <div className="divide-y divide-gray-100">
                      {orderDetail.items &&
                        orderDetail.items.map((prod) => (
                          <div
                            key={prod.id}
                            className="flex items-center justify-between py-3 first:pt-0"
                          >
                            <div className="flex items-center gap-3">
                              <div>
                                <Text
                                  variant="small"
                                  className="font-medium text-[#1C1B1B] mb-0"
                                >
                                  {prod.product_name}
                                </Text>
                                <Text
                                  variant="xs"
                                  className="font-normal text-[#1C1B1B] mb-0"
                                >
                                  {prod.part_number &&
                                    `รหัสสินค้า: ${prod.part_number}`}
                                </Text>
                                <Text
                                  variant="xs"
                                  className="font-normal text-[#6B7280] mb-0"
                                >
                                  QTY: {prod.qty} {prod.unit} |{" "}
                                  {prod.unit_price.toLocaleString("th-TH", {
                                    minimumFractionDigits: 2,
                                  })}
                                </Text>
                              </div>
                            </div>
                            <Text
                              variant="small"
                              className="font-normal text-[#1C1B1B] mb-0"
                            >
                              {(prod.subtotal || 0).toLocaleString("th-TH", {
                                minimumFractionDigits: 2,
                              })}
                            </Text>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* สรุปยอดเงิน */}
                  <Card className="bg-[#1C1B1B] rounded-none border-none shadow-none">
                    <CardContent className="p-4 space-y-2.5">
                      {/* แถวราคารวมสินค้า */}
                      <div className="flex justify-between text-white">
                        <Text variant="xs" className="text-[#9CA3AF] mb-0">
                          ราคารวมสินค้า
                        </Text>
                        <Text
                          variant="xs"
                          className="font-normal text-white mb-0"
                        >
                          {(orderDetail.subtotal || 0).toLocaleString("th-TH", {
                            minimumFractionDigits: 2,
                          })}
                        </Text>
                      </div>

                      {/* แถวส่วนลดท้ายบิล */}
                      <div className="flex justify-between text-white">
                        <Text variant="xs" className="text-[#9CA3AF] mb-0">
                          ส่วนลดท้ายบิล
                        </Text>
                        <Text
                          variant="xs"
                          className="font-normal text-white mb-0"
                        >
                          {(orderDetail.discount_amount || 0).toLocaleString(
                            "th-TH",
                            { minimumFractionDigits: 2 },
                          )}
                        </Text>
                      </div>

                      {/* แถวส่วนลดรวมทั้งสิ้น*/}
                      <div className="flex justify-between text-white">
                        <Text variant="xs" className="text-[#9CA3AF] mb-0">
                          ส่วนลดรวมทั้งสิ้น
                        </Text>
                        <Text
                          variant="xs"
                          className="font-normal text-white mb-0"
                        >
                          {(
                            orderDetail.total_discount_items || 0
                          ).toLocaleString("th-TH", {
                            minimumFractionDigits: 2,
                          })}
                        </Text>
                      </div>

                      {/* แถวยอดชำระสุทธิ */}
                      <div className="border-t border-[#9CA3AF] pt-2.5 flex justify-between">
                        <Text
                          variant="small"
                          className="font-normal text-white mb-0"
                        >
                          ยอดชำระสุทธิ
                        </Text>
                        <Text
                          variant="small"
                          className="font-normal text-white mb-0"
                        >
                          {(orderDetail.total_amount || 0).toLocaleString(
                            "th-TH",
                            { minimumFractionDigits: 2 },
                          )}
                        </Text>
                      </div>


                      {/* แถววิธีชำระเงิน */}
                      <div className="pt-2 flex justify-end items-center gap-2">
                        <Badge
                          variant={getPaymentVariant(
                            orderDetail.payment_method_name,
                          )}
                        >
                          {orderDetail.payment_method_name || "เงินสด"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {/* ปุ่มพิมพ์ใบเสร็จ/ใบส่งของ (PDF) */}
                  {/* <Button
                    type="button"
                    variant="primary"
                    onClick={() =>
                      handlePrintReceipt(
                        orderDetail.id || orderDetail.order_number,
                        orderDetail.order_number
                      )
                    }
                    disabled={printingOrderId !== null}
                    className="w-full text-xs h-10 font-normal flex items-center justify-center gap-1.5 shadow-sm bg-[#1C1B1B] hover:bg-zinc-800 text-white cursor-pointer rounded-none"
                  >
                    <Printer className="w-4 h-4" />
                    <span>
                      {printingOrderId !== null
                        ? "กำลังดาวน์โหลด..."
                        : (orderDetail.status || "").toUpperCase() === "CANCELLED"
                        ? "พิมพ์ใบเสร็จที่ยกเลิก (Void Receipt)"
                        : "พิมพ์ใบเสร็จ/ใบส่งของ (PDF)"}
                    </span>
                  </Button> */}

                  {/* ==================== ส่วนจัดการการขอยกเลิก (DYNAMIC UI) ==================== */}
                  {(() => {
                    const status = (orderDetail.status || "")
                      .trim()
                      .toUpperCase();
                    const hasBeenRejected = Boolean(orderDetail.cancel_remark);

                    // 1. เคสรายการอยู่ระหว่างรออนุมัติการยกเลิก (PENDING_CANCEL)
                    if (status === "PENDING_CANCEL") {
                      // 1.1 ถ้าผู้ใช้เป็น OWNER / ADMIN: แยกเป็น 2 ส่วน (กล่องสรุปข้อมูล + ฟอร์มการดำเนินการ)
                      if (isOwnerOrAdmin) {
                        return (
                          <div className="space-y-4">
                            {/* ส่วนที่ 1: กล่องสรุปคำขอจากพนักงาน */}
                            <Card className="p-4 bg-[#FEFCE8] border border-[#FEF08A] rounded-none shadow-none space-y-2">
                              <div className="flex items-center justify-between">
                                <Text variant="small" className="font-normal text-[#854D0E] mb-0">
                                  สถานะคำขอ: คำขอยกเลิกจากพนักงาน
                                </Text>
                                <Badge
                                  variant="warning"
                                  size="auto"
                                  className="bg-[#FEF08A] text-[#854D0E] border-none text-[10px] font-normal rounded-none py-0.5 px-2"
                                >
                                  {getStatusText(orderDetail.status)}
                                </Badge>
                              </div>

                              <div className="text-xs text-[#1C1B1B] ">
                                <div>
                                  <span className="font-normal text-[#1C1B1B]">ผู้ส่งคำขอ:</span>{" "}
                                  <span className="text-[#1C1B1B]">{orderDetail.canceller || "-"}</span>
                                </div>
                                <div>
                                  <span className="font-normal text-[#1C1B1B]">เหตุผลที่พนักงานระบุ:</span>{" "}
                                  <span className="text-[#1C1B1B]">{orderDetail.cancel_reason || "-"}</span>
                                </div>
                                {orderDetail.cancel_requested_at && (
                                  <Text variant="xs" className="text-[#1C1B1B] pt-0.5">
                                    ส่งคำขอเมื่อ: {formatDate(orderDetail.cancel_requested_at)}
                                  </Text>
                                )}
                              </div>
                            </Card>

                            {/* ส่วนที่ 2: ฟอร์มอนุมัติ/ปฏิเสธ ของ Owner (อยู่นอก Card) */}
                            <div className="space-y-3 pt-1">
                              <div className="space-y-1.5">
                                <Text
                                  variant="xs"
                                  className="font-normal text-[#E51C23] uppercase tracking-wider mb-1"
                                >
                                  หมายเหตุการดำเนินการ (ถ้ามี):
                                </Text>
                                <textarea
                                  rows={3}
                                  value={cancelRemark}
                                  onChange={(e) => setCancelRemark(e.target.value)}
                                  placeholder="ระบุหมายเหตุการอนุมัติหรือเหตุผลในการปฏิเสธ..."
                                  className="w-full p-2.5 text-xs font-light bg-[#F6F3F2] border border-[#E51C23] rounded-none focus:outline-none text-[#1C1B1B] placeholder-[#6B7280] resize-none"
                                />
                              </div>

                              <div className="flex gap-2 pt-1">
                                <Button
                                  type="button"
                                  variant="approved"
                                  onClick={handleDirectCancelByOwner}
                                  disabled={isCancelling}
                                  className="flex-1 text-xs h-10 font-normal rounded-none"
                                >
                                  {isCancelling ? "กำลังดำเนินการ..." : "อนุมัติยกเลิก (คืนสต็อก)"}
                                </Button>

                                <Button
                                  type="button"
                                  variant="solid-red"
                                  onClick={handleRejectCancelByOwner}
                                  disabled={isCancelling}
                                  className="flex-1 text-xs h-10  font-normal rounded-none"
                                >
                                  {isCancelling ? "กำลังดำเนินการ..." : "ปฏิเสธคำขอ"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // 1.2 ถ้าเป็น EMPLOYEE / STAFF: ดูได้อย่างเดียวว่า รออนุมัติ
                      return (
                        <div className="space-y-3">
                          {/* 1. ส่วน Card แสดงรายละเอียดสถานะ */}
                          <Card className="p-4 bg-[#FEFCE8] border border-[#FEF08A] rounded-none shadow-none space-y-2">
                            <div className="flex items-center justify-between">
                              <Text variant="small" className="font-normal text-[#854D0E] mb-0">
                                สถานะ: รอเจ้าของร้านอนุมัติการยกเลิก
                              </Text>
                              <Badge
                                variant="warning"
                                size="auto"
                                className="bg-[#FEF08A] text-[#854D0E] border-none text-[10px] font-normal rounded-none py-0.5 px-2"
                              >
                                {getStatusText(orderDetail.status)}
                              </Badge>
                            </div>

                            <div className="text-xs text-[#1C1B1B]">
                              <div>
                                <span className="font-normal text-[#1C1B1B]">ผู้ส่งคำขอ:</span>{" "}
                                <span className="text-[#1C1B1B]">{orderDetail.canceller || "-"}</span>
                              </div>
                              <div>
                                <span className="font-normal text-[#1C1B1B]">เหตุผลที่ระบุ:</span>{" "}
                                <span className="text-[#1C1B1B]">{orderDetail.cancel_reason || "-"}</span>
                              </div>
                              {orderDetail.cancel_requested_at && (
                                <Text variant="xs" className="text-[#1C1B1B] pt-0.5 mb-0">
                                  ส่งคำขอเมื่อ: {formatDate(orderDetail.cancel_requested_at)}
                                </Text>
                              )}
                            </div>
                          </Card>

                          {/* 2. ปุ่ม Action ด้านล่าง (อยู่นอก Card) */}
                          <div className="flex gap-2 pt-1">
                            <Button
                              type="button"
                              variant="solid-red"
                              onClick={handleRevertCancel}
                              disabled={isCancelling}
                              className="flex-1 text-xs h-10 font-normal rounded-none"
                            >
                              {isCancelling ? "กำลังดำเนินการ..." : "ดึงคำขอยกเลิกกลับ (กู้คืนคำขอ)"}
                            </Button>

                            <Button
                              type="button"
                              variant="outline-cancel"
                              onClick={() => onClose()}
                              className="text-xs px-4 h-10 border border-gray-200 text-[#5F5E5E] hover:bg-[#F6F3F2] font-normal rounded-none"
                            >
                              ปิด
                            </Button>
                          </div>
                        </div>
                      );
                    }

                    // 2. ถ้ารายการถูกยกเลิกเรียบร้อยแล้ว (CANCELLED)
                    if (status === "CANCELLED" || status === "ยกเลิก") {
                      return (
                        <div className="space-y-3">
                          <Card className="p-4 bg-[#FCF7F7] border border-[#F5DFDF] rounded-none shadow-none space-y-2">
                            <div className="flex items-center justify-between">
                              <Text variant="small" className="font-normal text-[#E51C23] mb-0">
                                สถานะคำขอ: รายการนี้ถูกยกเลิกแล้ว
                              </Text>
                              <Badge
                                variant="neutral"
                                size="auto"
                                className="bg-[#E51C23] text-white border-none text-[10px] font-normal rounded-none py-0.5 px-2"
                              >
                                {getStatusText(orderDetail.status)}
                              </Badge>
                            </div>
                            
                            <div className="text-xs text-[#1C1B1B] ">
                              <div>
                                <span className="font-normal text-[#1C1B1B]">ผู้ส่งคำขอ:</span>{" "}
                                <span className="text-[#1C1B1B]">{orderDetail.canceller || "-"}</span>
                              </div>
                              <div>
                                <span className="font-normal text-[#1C1B1B]">เหตุผลที่ระบุ:</span>{" "}
                                <span className="text-[#1C1B1B]">{orderDetail.cancel_reason || "-"}</span>
                              </div>
                              {(orderDetail.cancel_processed_at || orderDetail.cancelled_at || orderDetail.cancel_requested_at) && (
                                <Text variant="xs" className="text-[#1C1B1B] pt-0.5">
                                  อนุมัติเมื่อ: {formatDate(orderDetail.cancel_processed_at || orderDetail.cancelled_at || orderDetail.cancel_requested_at || "")}
                                </Text>
                              )}
                              <div>
                                <span className="font-normal text-[#1C1B1B]">หมายเหตุ:</span>{" "}
                                <span className="text-[#1C1B1B]">{orderDetail.cancel_remark || "-"}</span>
                              </div>
                            </div>
                          </Card>

                          {/* <Button
                            type="button"
                            variant="outline-cancel"
                            onClick={() => handlePrintReceipt(orderDetail.id, orderDetail.order_number)}
                            disabled={printingOrderId !== null}
                            className="w-full text-xs h-10 font-normal rounded-none flex items-center justify-center gap-2 cursor-pointer shadow-sm border border-gray-300 hover:bg-gray-50"
                          >
                            <Printer className={cn("w-4 h-4 text-[#E51C23]", printingOrderId === orderDetail.id && "animate-pulse")} />
                            <span>พิมพ์ใบเสร็จที่ยกเลิก (เอกสารหลักฐาน)</span>
                          </Button> */}

                          <Button
                            type="button"
                            variant="solid-red"
                            onClick={() => {
                              navigate(
                                (isOwnerOrAdmin ? "/owner/pos/pos" : "/employee/pos/pos") +
                                  `?recover_order_id=${orderDetail.id}`,
                                { state: { recoverOrderId: orderDetail.id } }
                              );
                            }}
                            className="w-full text-xs h-10 font-normal rounded-none flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                          >
                            <CopyPlus className="w-4 h-4" />
                            <span>ดึงรายการไปเปิดบิลใหม่ที่หน้า POS</span>
                          </Button>
                          <p className="text-[11px] text-[#6B7280] text-center mt-1.5 mb-0">
                            *เป็นการคัดลอกรายการสินค้าและลูกค้าไปเปิดบิลขายใหม่ โดยไม่มีผลต่อบิลเดิมที่ยกเลิก
                          </p>
                        </div>
                      );
                    }

                    // 3. เคสบิลปกติ หรือ บิลที่เคยโดนปฏิเสธคำขอ
                    return (
                      <div className="space-y-4 pt-2">
                        {hasBeenRejected && (
                          <Card className="p-4 bg-[#FCF7F7] border border-[#F5DFDF] rounded-none shadow-none space-y-2">
                            <div className="flex items-center justify-between">
                              <Text variant="small" className="font-normal text-[#E51C23] mb-0">
                                สถานะ: คำขอยกเลิกก่อนหน้านี้ถูกปฏิเสธ
                              </Text>
                              <Badge
                                variant="neutral"
                                size="auto"
                                className="bg-[#E51C23] text-white border-none text-[10px] font-normal rounded-none py-0.5 px-2"
                              >
                                {getStatusText(orderDetail.status, orderDetail.cancel_remark)}
                              </Badge>
                            </div>

                            <div className="text-xs text-[#1C1B1B]">
                              {orderDetail.canceller && (
                                <div>
                                  <span className="font-normal text-[#1C1B1B]">ผู้ส่งคำขอเดิม:</span>{" "}
                                  <span className="text-[#1C1B1B]">{orderDetail.canceller}</span>
                                </div>
                              )}
                              <div>
                                <span className="font-normal text-[#1C1B1B]">เหตุผลจากเจ้าของร้าน:</span>{" "}
                                <span className="text-[#1C1B1B]">{orderDetail.cancel_remark || "-"}</span>
                              </div>
                              {orderDetail.cancel_processed_at && (
                                <Text variant="xs" className="text-[#1C1B1B] pt-0.5 mb-0">
                                  ปฏิเสธคำขอเมื่อ: {formatDate(orderDetail.cancel_processed_at)}
                                </Text>
                              )}
                            </div>
                          </Card>
                        )}

                        <div className="space-y-3">
                          <Text
                            variant="xs"
                            className="font-normal text-[#E51C23] uppercase tracking-wider mb-1"
                          >
                            {hasBeenRejected
                              ? "ระบุเหตุผลเพื่อยื่นขอยกเลิกใหม่อีกครั้ง"
                              : "ระบุเหตุผลในการขอยกเลิกรายการ"}
                          </Text>

                          <textarea
                            rows={3}
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            placeholder="ตัวอย่าง: ลูกค้าขอยกเลิกออเดอร์เนื่องจากเปลี่ยนใจ / ยิงรายการผิด..."
                            className="w-full p-2.5 text-xs font-light bg-[#F6F3F2] border border-[#E51C23] rounded-none focus:outline-none text-[#1C1B1B] placeholder-[#6B7280] resize-none"
                          />

                          <div className={cn("flex gap-3 pt-1", variant === "page" && "justify-end")}>
                            {/*  ปุ่มไดนามิก: ถ้าเป็น Owner จะอนุมัติทันที / ถ้าเป็น Employee จะส่งคำขอ */}
                            <Button
                              type="button"
                              variant="solid-red"
                              onClick={
                                isOwnerOrAdmin
                                  ? handleDirectCancelByOwner
                                  : handleRequestCancel
                              }
                              disabled={isCancelling}
                              className={cn(
                                "font-normal",
                                variant === "page" ? "text-xs h-9 px-4" : "flex-1 text-sm h-11"
                              )}
                            >
                              {isCancelling
                                ? "กำลังดำเนินการ..."
                                : isOwnerOrAdmin
                                  ? "อนุมัติยกเลิกรายการ (คืนสต็อก)"
                                  : "ยืนยันการขออนุมัติยกเลิก"}
                            </Button>

                            <Button
                              type="button"
                              variant="outline-cancel"
                              onClick={() => onClose()}
                              className={cn(
                                "border border-gray-200 text-[#5F5E5E] hover:bg-[#F6F3F2] font-normal",
                                variant === "page" ? "text-xs h-9 px-4" : "text-sm px-6 h-11"
                              )}
                            >
                              ยกเลิก
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-6">
                <Text variant="small" className="text-red-500">
                  ไม่พบข้อมูลออเดอร์
                </Text>
              </div>
            );

  if (variant === "page") {
    return <div className="w-full bg-white border border-gray-100 shadow-sm">{body}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop ฉากหลังมืด */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-none transition-opacity cursor-pointer"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <aside className="relative z-10 w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-200">
        {body}
      </aside>
    </div>
  );
}
