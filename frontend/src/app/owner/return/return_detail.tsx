import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { AlertCircle, Calendar, ChevronRight, CircleCheck, ClipboardClock, Loader2, Lock, Phone, User, XCircle } from 'lucide-react';
// Components
import Heading from '../../../components/elements/heading';
import Badge from '../../../components/elements/badge';
import Card, { CardContent, CardHeader, CardTitle } from '../../../components/elements/card';
import Button from '../../../components/elements/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/elements/table';
// Service + Interface + Utils
import type { SalesReturn } from '../../../interface/return/return_interface';
import { returnService } from '../../../service/http/return/return_service';
import { formatDateThai } from '../../../utils/formatdate';
import { usePathBasePrefix } from '../../../utils/usePathBasePrefix';
import { useToast } from '../../../components/elements/toast';
import Modal from '../../../components/elements/modal';
import ConfirmDialog from '../../../components/elements/confirm_dialog';

const STATUS_LABEL: Record<string, string> = {
  REFUNDED: 'คืนเงินจริงแล้ว',
  PENDING: 'รออนุมัติ',
  APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ปฏิเสธ',
};

const getItemReason = (reason: string | undefined, productName: string, index: number) => {
  const fullReason = reason?.trim() || '-';
  const reasonParts = fullReason.split(/\s*\|\s*/).filter(Boolean);
  if (reasonParts.length <= 1) return fullReason;

  const productPrefix = `${productName}:`.toLowerCase();
  const matchedReason = reasonParts.find((part) => part.toLowerCase().startsWith(productPrefix));
  const reasonForItem = matchedReason || reasonParts[index] || fullReason;
  const separatorIndex = reasonForItem.indexOf(':');

  return separatorIndex >= 0 ? reasonForItem.slice(separatorIndex + 1).trim() : reasonForItem;
};

const ReturnDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const basePath = usePathBasePrefix();
  const userRole = (localStorage.getItem('role') || '').toUpperCase();
  const isManager = userRole === 'OWNER' || userRole === 'ADMIN';
  const canProcessRefund = userRole === 'OWNER' || userRole === 'EMPLOYEE' || userRole === 'ADMIN';
  const { toast } = useToast();

  const [returnItem, setReturnItem] = useState<SalesReturn | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchDetail = async () => {
      setIsLoading(true);
      try {
        const data = await returnService.getReturnById(Number(id));
        setReturnItem(data);
      } catch (err) {
        console.error('Failed to load return detail:', err);
        setReturnItem(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetail();
  }, [id]);

  const handleStatusUpdate = async (newStatus: 'APPROVED' | 'REJECTED') => {
    if (!returnItem?.id || isUpdating) return;

    setIsUpdating(true);
    try {
      const updated = await returnService.updateSalesReturn(returnItem.id, { status: newStatus });
      setReturnItem(updated || { ...returnItem, status: newStatus });
      toast({
        title: newStatus === 'APPROVED' ? 'อนุมัติสำเร็จ' : 'ปฏิเสธสำเร็จ',
        message: `ดำเนินการ${newStatus === 'APPROVED' ? 'อนุมัติคืนเงิน' : 'ปฏิเสธคำขอคืนเงิน'}เรียบร้อยแล้ว`,
        variant: newStatus === 'APPROVED' ? 'success' : 'info',
      });
      navigate(`${basePath}/returns`);
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'เกิดข้อผิดพลาดในการอัปเดตสถานะ';
      toast({
        title: 'เกิดข้อผิดพลาด',
        message,
        variant: 'error',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleProcessRefund = async () => {
    if (!returnItem?.id || isUpdating || !canProcessRefund) return;

    setIsUpdating(true);
    try {
      const updated = await returnService.processRefund(returnItem.id);
      setReturnItem(updated || { ...returnItem, status: 'REFUNDED' });
      toast({
        title: 'คืนเงินสำเร็จ',
        message: 'สร้างรายการคืนเงินและอัปเดตยอดสุทธิเรียบร้อยแล้ว',
        variant: 'success',
      });
    } catch (err: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        message: err?.response?.data?.error || err?.response?.data?.message || 'ไม่สามารถดำเนินการคืนเงินจริงได้',
        variant: 'error',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center py-24 text-gray-400">
        <Loader2 size={36} className="animate-spin mx-auto mb-2" />
        <p className="text-sm">กำลังโหลดข้อมูลใบคืนสินค้า...</p>
      </div>
    );
  }

  if (!returnItem) {
    return (
      <div className="p-8 text-center space-y-4 py-24">
        <AlertCircle size={40} className="mx-auto text-red-500" />
        <p className="text-slate-600 font-medium">ไม่พบข้อมูลใบคืนสินค้าที่คุณระบุ</p>
        <Button onClick={() => navigate(`${basePath}/returns`)} variant="outline">กลับหน้าหลัก</Button>
      </div>
    );
  }

  const originalOrder = returnItem.original_order || {};
  const customer = originalOrder.customer || {};
  const customerName = customer.customer_name || originalOrder.customer_name_temp || 'ไม่ระบุ';
  const customerPhone = customer.phone || originalOrder.customer_phone_temp || 'ไม่ระบุ';
  const orderNumber = originalOrder.order_number || '-';
  const items = returnItem.sales_return_items || [];
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const status = returnItem.status || 'PENDING';
  const actionStatus = status === 'REFUNDED' ? 'APPROVED' : status;

  return (
    <div className="p-8 space-y-6 bg-white min-h-screen relative pb-28 font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex-col space-y-2">
            <nav className="flex items-center text-sm text-gray-500 gap-2 font-light">
              <Link to={`${basePath}/returns`} className="hover:text-black transition-colors">
                จัดการคืนสินค้า
              </Link>
              <ChevronRight size={16} className="text-gray-400" />
              <span className="text-black font-normal">รายละเอียดใบคืนสินค้า</span>
            </nav>
            <Heading level="h1" weight="semibold" className="m-0 text-black">
              รายละเอียดใบคืนสินค้า
            </Heading>
            <Heading level="h6" weight="normal" className="m-0 text-gray-500">
              เลขที่ใบคืนสินค้า: {returnItem.return_number || '-'} | อ้างอิงใบเสร็จ: {orderNumber}
            </Heading>
          </div>
        </div>
        <Badge variant="outline" size="lg" className="w-fit gap-2 p-2">
          <ClipboardClock size={14} />
          สถานะ: {STATUS_LABEL[status] || status}
        </Badge>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        <div className="w-full lg:w-3/4 flex flex-col gap-6">
          <Card className="border-l-[5px] border-l-red-600">
            <CardHeader className="items-center justify-start gap-4">
              <CardTitle className="text-lg">ข้อมูลลูกค้าและใบขาย</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
                <div className="flex items-center gap-3">
                  <User className="text-slate-700" size={18} />
                  <div>
                    <Heading level="p" className="text-slate-700 mb-0">ชื่อลูกค้า</Heading>
                    <Heading level="h6" weight="medium" className="text-black">{customerName}</Heading>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="text-slate-700" size={18} />
                  <div>
                    <Heading level="p" className="text-slate-700 mb-0">เบอร์โทรศัพท์</Heading>
                    <Heading level="h6" weight="medium" className="text-black">{customerPhone}</Heading>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="text-slate-700" size={18} />
                  <div>
                    <Heading level="p" className="text-slate-700 mb-0">วันที่ส่งคำขอคืน</Heading>
                    <Heading level="h6" weight="medium" className="text-black">{formatDateThai(returnItem.requested_at || returnItem.return_date)}</Heading>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-[5px] border-l-black overflow-hidden" noPadding>
            <CardHeader className="items-center justify-between bg-white px-6 py-4">
              <CardTitle className="text-lg">รายการสินค้าที่คืน</CardTitle>
              <span className="text-sm text-black font-medium">รวม {totalQuantity} ชิ้น</span>
            </CardHeader>
            <Table>
              <TableHeader className="text-[#797878] bg-[#f6f3f2]">
                <TableRow>
                  <TableHead className="pl-6">ลำดับ</TableHead>
                  <TableHead className="text-left">สินค้า</TableHead>
                  <TableHead className="text-center">จำนวนคืน</TableHead>
                  <TableHead className="text-right">ราคาต่อหน่วย</TableHead>
                  <TableHead className="text-right pr-6">รวมเงินคืน</TableHead>
                  <TableHead className="text-left">สาเหตุการคืน</TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-400">
                      ไม่พบรายละเอียดรายการสินค้า
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="pl-6">
                        {index + 1}
                      </TableCell>
                      <TableCell className="text-left">
                        <Heading level="p" weight="medium" className="text-black mb-0">{item.product_name || `สินค้า #${item.product_id}`}</Heading>
                        {item.product_code && <Heading level="p" weight="light" className="text-gray-700">SKU: {item.product_code}</Heading>}
                      </TableCell>
                      <TableCell className="text-center text-black">{item.quantity}</TableCell>
                      <TableCell className="text-right text-black">
                        ฿ {item.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right pr-6 text-black">
                        ฿ {(item.subtotal || item.quantity * item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-left text-black max-w-60 whitespace-pre-wrap wrap-break-word">
                         {getItemReason(returnItem.reason, item.product_name || `สินค้า #${item.product_id}`, index)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <div className="bg-white px-6 py-4 border-t border-slate-100 flex justify-between items-center">
              <span className="text-sm font-medium text-black">ช่องทางการคืนเงิน: {returnItem.refund_method || 'เงินสด'}</span>
              <div className="text-right">
                <span className="text-sm text-slate-500 mr-2">ยอดคืนสุทธิ:</span>
                <span className="text-2xl font-extrabold text-[#e51c23]">
                  ฿ {returnItem.refund_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </Card>

          <Card className="border-l-[5px] border-l-gray-400">
            <CardHeader className="items-center justify-start gap-2 pb-2">
              <CardTitle className="text-lg">หมายเหตุเพิ่มเติม</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-sm text-black bg-[#f6f3f2] p-2 rounded-none border-none mt-0">
                <Heading level="p" weight="normal">{returnItem.note || '-'}</Heading>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="w-full lg:w-1/4 flex flex-col gap-6">
          <Card className="border-t-[5px] border-t-red-600">
            <CardHeader className="items-center justify-start gap-4">
              <CardTitle className="text-lg">ดำเนินการบิลคืนเงิน</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-xs">
                <div className="flex">
                  <span className="text-red-500">*</span>
                  <Heading level="p" weight="normal" className="text-gray-600"> กรุณาตรวจสอบความถูกต้องของสินค้าและใบเสร็จก่อนอนุมัติคืนเงิน</Heading>
                </div>
                {status === 'PENDING' ? (
                  <div className="space-y-3 pt-2">
                    {isManager ? (
                      <>
                        <Button
                          type="button"
                          variant="approved"
                          disabled={isUpdating}
                          onClick={() => setIsApproveModalOpen(true)}
                          className="w-full cursor-pointer"
                        >
                          {isUpdating ? <Loader2 size={16} className="animate-spin" /> : <CircleCheck size={18} />} อนุมัติคืนเงินสำเร็จ
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          disabled={isUpdating}
                          onClick={() => setIsRejectModalOpen(true)}
                          className="w-full cursor-pointer"
                        >
                          {isUpdating ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={18} />} ปฏิเสธคำขอคืนเงิน
                        </Button>
                      </>
                    ) : (
                      <div className="bg-[#f6f3f2] p-3 rounded-none text-center text-sm text-gray-400 font-semibold flex items-center justify-center gap-1.5">
                        <Lock size={14} /> สิทธิ์การอนุมัติเฉพาะผู้จัดการหรือเจ้าของร้าน
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-[#f6f3f2] p-4 rounded-none border border-slate-150 text-center space-y-2">
                    <Heading level="p" weight="medium">ดำเนินการตรวจสอบเสร็จสิ้น</Heading>
                    <Heading level="p" weight="medium" className={`${actionStatus === 'APPROVED' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {actionStatus === 'APPROVED' ? (status === 'REFUNDED' ? 'คืนเงินจริงแล้ว' : 'อนุมัติคืนเงินสำเร็จแล้ว') : 'ปฏิเสธคำขอคืนเงินแล้ว'}
                    </Heading>
                    {status === 'APPROVED' && canProcessRefund && (
                      <Button
                        type="button"
                        variant="approved"
                        disabled={isUpdating}
                        onClick={() => setIsRefundModalOpen(true)}
                        className="w-full mt-2 cursor-pointer"
                      >
                        {isUpdating ? <Loader2 size={16} className="animate-spin" /> : <></>} ดำเนินการคืนเงินจริง
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <Modal
        isOpen={isRefundModalOpen}
        onClose={() => !isUpdating && setIsRefundModalOpen(false)}
        title="ยืนยันการคืนเงินจริง"
        description="การดำเนินการนี้จะสร้างรายการ Payment และเพิ่มสินค้าเข้าคลัง"
        size="sm"
        footer={(
          <>
            <Button
              type="button"
              variant="tertiary"
              disabled={isUpdating}
              onClick={() => setIsRefundModalOpen(false)}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              variant="approved"
              disabled={isUpdating}
              onClick={async () => {
                setIsRefundModalOpen(false);
                await handleProcessRefund();
              }}
            >
              {isUpdating ? <Loader2 size={16} className="animate-spin" /> : <></>}
              ยืนยันคืนเงินจริง
            </Button>
          </>
        )}
      >
        <div className="space-y-3 text-sm text-slate-700">
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">เลขที่ใบคืน</span>
            <span className="font-semibold text-slate-900">{returnItem.return_number || '-'}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">ยอดเงินคืน</span>
            <span className="font-semibold text-red-600">
              ฿ {returnItem.refund_amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">ช่องทางคืนเงิน</span>
            <span className="font-medium text-slate-900">{returnItem.refund_method || '-'}</span>
          </div>
        </div>
      </Modal>

      {/* Modal ยืนยันการอนุมัติคืนเงิน */}
      <ConfirmDialog
        isOpen={isApproveModalOpen}
        onClose={() => !isUpdating && setIsApproveModalOpen(false)}
        title="ยืนยันการอนุมัติคืนเงิน"
        description={(
          <div className="space-y-3 text-sm text-slate-700 text-left">
            <p className="text-center text-slate-600">คุณต้องการอนุมัติคำขอคืนเงินสำหรับใบคืนสินค้านี้ใช่หรือไม่?</p>
            {returnItem && (
              <div className="bg-[#f6f3f2] p-3 space-y-2 mt-2">
                <div className="flex justify-between gap-4 text-xs">
                  <span className="text-slate-500">เลขที่ใบคืนสินค้า</span>
                  <span className="font-semibold text-slate-900">{returnItem.return_number || '-'}</span>
                </div>
                <div className="flex justify-between gap-4 text-xs">
                  <span className="text-slate-500">อ้างอิง Order</span>
                  <span className="font-semibold text-slate-900">{orderNumber}</span>
                </div>
                <div className="flex justify-between gap-4 text-xs">
                  <span className="text-slate-500">ลูกค้า</span>
                  <span className="font-semibold text-slate-900">{customerName}</span>
                </div>
                <div className="flex justify-between gap-4 text-xs">
                  <span className="text-slate-500">จำนวนสินค้าที่คืน</span>
                  <span className="font-semibold text-slate-900">{totalQuantity} ชิ้น</span>
                </div>
                <div className="flex justify-between gap-4 text-xs">
                  <span className="text-slate-500">ยอดเงินคืน</span>
                  <span className="font-semibold text-[#e51c23]">
                    ฿ {returnItem.refund_amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between gap-4 text-xs">
                  <span className="text-slate-500">ช่องทางคืนเงิน</span>
                  <span className="font-medium text-slate-900">{returnItem.refund_method || '-'}</span>
                </div>
              </div>
            )}
          </div>
        )}
        onConfirm={async () => {
          setIsApproveModalOpen(false);
          await handleStatusUpdate('APPROVED');
        }}
        confirmText="ยืนยันอนุมัติ"
        cancelText="ยกเลิก"
        variant="success"
        icon={CircleCheck}
        isSubmitting={isUpdating}
      />

      {/* Modal ยืนยันการปฏิเสธคำขอคืนเงิน */}
      <ConfirmDialog
        isOpen={isRejectModalOpen}
        onClose={() => !isUpdating && setIsRejectModalOpen(false)}
        title="ยืนยันการปฏิเสธคำขอคืนเงิน"
        description={(
          <div className="space-y-3 text-sm text-slate-700 text-left">
            <p className="text-center text-slate-600">คุณต้องการปฏิเสธคำขอคืนเงินสำหรับใบคืนสินค้านี้ใช่หรือไม่?</p>
            {returnItem && (
              <div className="bg-[#f6f3f2] p-3 space-y-2 mt-2">
                <div className="flex justify-between gap-4 text-xs">
                  <span className="text-slate-500">เลขที่ใบคืนสินค้า</span>
                  <span className="font-semibold text-slate-900">{returnItem.return_number || '-'}</span>
                </div>
                <div className="flex justify-between gap-4 text-xs">
                  <span className="text-slate-500">ยอดเงินคืน</span>
                  <span className="font-semibold text-[#e51c23]">
                    ฿ {returnItem.refund_amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
        onConfirm={async () => {
          setIsRejectModalOpen(false);
          await handleStatusUpdate('REJECTED');
        }}
        confirmText="ยืนยันปฏิเสธ"
        cancelText="ยกเลิก"
        variant="danger"
        icon={XCircle}
        isSubmitting={isUpdating}
      />
    </div>
  );
};

export default ReturnDetailPage;
