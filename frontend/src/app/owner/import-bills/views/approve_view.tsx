import { useState } from 'react';
import { CheckCircle2, FileImage, ExternalLink, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Heading from '../../../../components/elements/heading';
import Button from '../../../../components/elements/button';
import Badge from '../../../../components/elements/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../../components/elements/table';
import type { SavedBill, Supplier, Product } from '../../../../interface/import';
import { resolveImageUrl } from '../../../../service/http/import/import_service';

interface ApproveViewProps {
  bill: SavedBill;
  suppliers: Supplier[];
  products: Product[];
  onApprove: (billId: number) => Promise<void>;
  onReject: (billId: number) => Promise<void>;
  onBack: () => void;
  formatDate: (dateStr: string) => string;
  getSupplierName: (id: number) => string;
  isEmployee?: boolean;
}

export default function ApproveView({
  bill,
  products,
  onApprove,
  onReject,
  onBack,
  formatDate,
  getSupplierName,
  isEmployee = false,
}: ApproveViewProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(false);
  const [rejecting, setRejecting] = useState<boolean>(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  const handleApprove = async () => {
    setLoading(true);
    try { await onApprove(bill.id); } finally { setLoading(false); }
  };

  const handleReject = () => {
    setIsRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    setIsRejectModalOpen(false);
    setRejecting(true);
    try { await onReject(bill.id); } finally { setRejecting(false); }
  };

  const imageUrl = resolveImageUrl(bill.bill_image?.image_url || bill.evidence_file_url);

  const totalNetAmount = (bill.bill_items || []).reduce((s, i) => s + (i.net_amount || 0), 0);

  const productCostMap = new Map<number, number>();
  products.forEach(p => { if (p.cost_price != null) productCostMap.set(p.id, p.cost_price); });

  // แสดงเฉพาะรายการที่ราคาทุนต่างจากระบบจริงๆ — ถ้าไม่มีเลย (เช่นบิลที่เจ้าของนำเข้าเองไม่มีราคาเปลี่ยน) ให้ fallback
  // กลับไปโชว์ทุกรายการ กันตารางว่างเปล่าดูเหมือนหน้าพัง
  const changedBillItems = (bill.bill_items || []).filter((item) => {
    const oldCost = item.product_id ? productCostMap.get(item.product_id) : undefined;
    return item.price_per_unit > 0 && oldCost != null && oldCost !== item.price_per_unit;
  });
  const displayItems = changedBillItems.length > 0 ? changedBillItems : (bill.bill_items || []);

  const handleViewProduct = (item: NonNullable<SavedBill['bill_items']>[number]) => {
    const allBillItems = displayItems
      .filter(i => i.product_id)
      .map(i => ({
        productId: i.product_id,
        billPrice: i.price_per_unit,
        companyProductName: i.company_product_name,
        productName: i.company_product_name,
      }));
    navigate(`/owner/import-bills/edit-stock-bill?productId=${item.product_id}`, {
      state: { mismatchedItems: allBillItems, returnFrom: 'approve', returnBillId: bill.id, billNo: bill.bill_no },
    });
  };

  return (
    <div className="p-8 max-w-full mx-auto w-full animate-in fade-in duration-300">
      {/* Breadcrumbs Navigation */}
      <nav className="flex items-center gap-2 text-xs text-gray-500 mb-4">
        <button type="button" onClick={onBack} className="hover:text-[#e51c23] transition-colors cursor-pointer font-bold">
          นำเข้าสินค้าจากบิล
        </button>
        <ChevronRight size={14} className="text-gray-400" />
        <span className="text-[#1C1B1B] font-bold">{bill.is_verified ? 'รายละเอียดบิลนำเข้าสินค้า' : 'อนุมัติบิลนำเข้าสินค้า'} (เลขที่: {bill.bill_no || '-'})</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <Heading level="h1" className="font-extrabold text-[#1C1B1B]">
          {bill.is_verified ? 'รายละเอียดบิลนำเข้าสินค้า' : 'อนุมัติบิลนำเข้าสินค้า'}
        </Heading>
        <p className="text-sm text-gray-500 mt-0.5">
          {bill.is_verified ? 'รายละเอียดข้อมูลบิลและรายการสินค้า' : 'ตรวจสอบรายละเอียดบิลก่อนอนุมัติ'}
        </p>
      </div>

      <div className={`grid grid-cols-1 gap-6 ${imageUrl && !imgError ? 'xl:grid-cols-3' : ''}`}>
        {/* Left: bill image — only shown when bill was imported via scan */}
        {imageUrl && !imgError && (
          <div className="xl:col-span-1">
            <div className="bg-white border border-gray-200 rounded-none shadow-sm p-4 h-full flex flex-col">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <FileImage size={14} /> รูปภาพบิล
              </p>
              <img
                src={imageUrl}
                alt="bill"
                className="w-full object-contain border border-gray-100"
                onError={() => setImgError(true)}
              />
            </div>
          </div>
        )}

        {/* Right: details */}
        <div className={`flex flex-col gap-6 ${imageUrl && !imgError ? 'xl:col-span-2' : ''}`}>
          {/* Bill metadata card */}
          <div className="bg-white border border-gray-200 rounded-none shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">ข้อมูลบิล</p>
              {!bill.is_verified && isEmployee && (
                <Badge variant="warning" size="md">รอเจ้าของร้านอนุมัติ</Badge>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">เลขที่บิล</p>
                <p className="font-bold text-[#1C1B1B]">{bill.bill_no}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">ผู้จัดจำหน่าย</p>
                <p className="font-bold text-[#1C1B1B]">{getSupplierName(bill.supplier_id)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">วันที่นำเข้า</p>
                <p className="font-medium text-[#1C1B1B]">{formatDate(bill.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">วันที่ในบิล</p>
                <p className="font-medium text-[#1C1B1B]">{formatDate(bill.due_date)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">เครดิต</p>
                <p className="font-medium text-[#1C1B1B]">{bill.credit_term || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">ขนส่งโดย</p>
                <p className="font-medium text-[#1C1B1B]">{bill.transport_by || '-'}</p>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Subtotal</p>
                <p className="font-semibold">฿{(bill.subtotal || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">ส่วนลด</p>
                <p className="font-semibold text-amber-700">-฿{(bill.discount_total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">VAT</p>
                <p className="font-semibold">฿{(bill.vat_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">ยอดรวมสุทธิ</p>
                <p className="font-extrabold text-[#e51c23] text-base">฿{(bill.grand_total || bill.total_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>

          {/* Items table */}
          <div className="bg-white border border-gray-200 rounded-none shadow-sm overflow-hidden">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider px-6 py-4 border-b border-gray-100">
              รายการสินค้าที่ราคาเปลี่ยนแปลง ({displayItems.length} รายการ)
            </p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50 text-[#5F5E5E]">
                  <TableRow>
                    <TableHead className="pl-6 w-20 text-center">ลำดับที่</TableHead>
                    <TableHead>ชื่อสินค้า</TableHead>
                    <TableHead className="text-center">จำนวน</TableHead>
                    <TableHead className="text-right">ราคาทุนเดิม</TableHead>
                    <TableHead className="text-right">ราคาในบิลใหม่</TableHead>
                    <TableHead className="text-center">เปลี่ยนแปลง</TableHead>
                    <TableHead className="text-right pr-6">ยอดสุทธิ</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-sm text-gray-700">
                  {displayItems.map((item) => {
                    const oldCost = item.product_id ? productCostMap.get(item.product_id) : undefined;
                    const newPrice = item.price_per_unit;
                    const hasDiff = oldCost != null && oldCost !== newPrice;
                    const isUp = oldCost != null && newPrice > oldCost;
                    const isDown = oldCost != null && newPrice < oldCost;
                    return (
                      <TableRow key={item.id} className={`hover:bg-gray-50/60 ${hasDiff ? 'bg-amber-50/40' : ''}`}>
                        <TableCell className="pl-6 text-gray-400 font-mono">{item.item_sequence}</TableCell>
                        <TableCell>
                          <p className="font-medium text-[#1C1B1B]">{item.company_product_name}</p>
                          <p className="text-[10px] font-mono text-gray-400">{item.company_product_code || ''}</p>
                        </TableCell>
                        <TableCell className="text-center">
                          {item.order_quantity} {item.unit}
                        </TableCell>
                        <TableCell className="text-right text-gray-500">
                          {oldCost != null ? `฿${oldCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })}` : <span className="text-gray-300 text-xs">ไม่มีข้อมูล</span>}
                        </TableCell>
                        <TableCell className={`text-right font-bold ${isUp ? 'text-red-600' : isDown ? 'text-emerald-600' : 'text-[#1C1B1B]'}`}>
                          ฿{newPrice.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-center">
                          {isUp && <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5">+฿{(newPrice - oldCost!).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>}
                          {isDown && <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5">-฿{(oldCost! - newPrice).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>}
                          {!hasDiff && <span className="text-gray-300 text-xs">-</span>}
                        </TableCell>
                        <TableCell className="text-right pr-6 font-bold">฿{item.net_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="pr-2">
                          {item.product_id ? (
                            <button
                              onClick={() => handleViewProduct(item)}
                              className="text-gray-400 hover:text-[#1C1B1B] transition-colors cursor-pointer"
                              title="ดูและแก้ไขรายละเอียดสินค้า"
                            >
                              <ExternalLink size={14} />
                            </button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-gray-50 font-bold border-t-2 border-gray-200">
                    <TableCell colSpan={7} className="pl-6 text-right text-gray-500 text-xs uppercase tracking-wider">ยอดรวมรายการ</TableCell>
                    <TableCell className="text-right pr-6 text-[#1C1B1B]">฿{totalNetAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Button Actions */}
          {bill.is_verified ? (
            <div className="sticky bottom-0 z-20 flex justify-end border-t border-gray-200 bg-white py-4">
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 size={16} /> บิลนี้ได้รับการอนุมัติแล้ว
              </span>
            </div>
          ) : !isEmployee ? (
            <div className="sticky bottom-0 z-20 flex flex-col gap-2 border-t border-gray-200 bg-white py-4 sm:flex-row sm:justify-end">
              <Button
                variant="secondary"
                className="w-full sm:w-40"
                isLoading={rejecting}
                disabled={loading || rejecting}
                onClick={handleReject}
              >
                {rejecting ? 'กำลังดำเนินการ...' : 'ปฏิเสธ / ส่งกลับแก้ไข'}
              </Button>
              <Button
                variant="primary"
                className="w-full sm:w-40"
                isLoading={loading}
                disabled={loading || rejecting}
                onClick={handleApprove}
              >
                {loading ? 'กำลังอนุมัติ...' : 'อนุมัติบิล'}
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Reject Confirm Modal — เหมือน pattern ของหน้าใบสั่งซื้อ (po_detail.tsx) */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsRejectModalOpen(false)} />
          <div className="relative bg-white rounded-sm shadow-xl w-full max-w-md mx-4 p-6 space-y-5">
            <Heading level="h4" weight="semibold" className="text-black">ปฏิเสธบิลนี้</Heading>
            <p className="text-sm text-gray-600">
              บิลจะถูกส่งกลับไปเป็นแบบร่าง (Draft) พนักงานจะต้องแก้ไขรายการและส่งเข้ามาให้ตรวจสอบใหม่อีกครั้ง ยืนยันหรือไม่?
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" className="w-28" onClick={() => setIsRejectModalOpen(false)}>
                ยกเลิก
              </Button>
              <Button variant="primary" className="w-36" onClick={handleConfirmReject}>
                ยืนยัน
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
