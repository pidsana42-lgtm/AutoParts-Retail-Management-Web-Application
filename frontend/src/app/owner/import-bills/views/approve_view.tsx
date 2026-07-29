import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, RotateCcw, Loader2, FileImage, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Heading from '../../../../components/elements/heading';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../../components/elements/table';
import type { SavedBill, Supplier, Product } from '../../../../interface/import';

interface ApproveViewProps {
  bill: SavedBill;
  suppliers: Supplier[];
  products: Product[];
  onApprove: (billId: number) => Promise<void>;
  onReject: (billId: number) => Promise<void>;
  onBack: () => void;
  formatDate: (dateStr: string) => string;
  getSupplierName: (id: number) => string;
}

export default function ApproveView({
  bill,
  suppliers,
  products,
  onApprove,
  onReject,
  onBack,
  formatDate,
  getSupplierName,
}: ApproveViewProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);
  const [imgError, setImgError] = useState(false);

  const handleApprove = async () => {
    setLoading('approve');
    try { await onApprove(bill.id); } finally { setLoading(null); }
  };

  const handleReject = async () => {
    setLoading('reject');
    try { await onReject(bill.id); } finally { setLoading(null); }
  };

  const imageUrl = bill.bill_image?.image_url
    ? `http://localhost:8080/${bill.bill_image.image_url}`
    : null;

  const totalNetAmount = (bill.bill_items || []).reduce((s, i) => s + (i.net_amount || 0), 0);

  const productCostMap = new Map<number, number>();
  products.forEach(p => { if (p.cost_price != null) productCostMap.set(p.id, p.cost_price); });

  const handleViewProduct = (item: NonNullable<SavedBill['bill_items']>[number]) => {
    const allBillItems = (bill.bill_items || [])
      .filter(i => i.product_id)
      .map(i => ({
        productId: i.product_id,
        billPrice: i.price_per_unit,
        companyProductName: i.company_product_name,
        productName: i.company_product_name,
      }));
    navigate(`/owner/import-bills/edit-stock-bill?productId=${item.product_id}`, {
      state: { mismatchedItems: allBillItems, returnFrom: 'approve', returnBillId: bill.id },
    });
  };

  return (
    <div className="p-8 max-w-full mx-auto w-full animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onBack}
          className="p-2 rounded-none hover:bg-gray-100 text-gray-500 hover:text-[#1C1B1B] transition-colors cursor-pointer"
        >
          <ArrowLeft size={22} />
        </button>
        <div>
          <Heading level="h1" className="font-extrabold text-[#1C1B1B]">
            อนุมัติบิลนำเข้าสินค้า
          </Heading>
          <p className="text-sm text-gray-500 mt-0.5">ตรวจสอบรายละเอียดบิลก่อนอนุมัติ</p>
        </div>
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
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">ข้อมูลบิล</p>
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
                <p className="text-xs text-gray-400 mb-0.5">ครบกำหนดชำระ</p>
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
              รายการสินค้า ({(bill.bill_items || []).length} รายการ)
            </p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50 text-[#5F5E5E]">
                  <TableRow>
                    <TableHead className="pl-6 w-10">#</TableHead>
                    <TableHead>ชื่อสินค้า</TableHead>
                    <TableHead className="text-center">จำนวน</TableHead>
                    <TableHead className="text-right">ราคาทุนเดิม (DB)</TableHead>
                    <TableHead className="text-right">ราคาในบิลใหม่</TableHead>
                    <TableHead className="text-center">เปลี่ยนแปลง</TableHead>
                    <TableHead className="text-right pr-6">ยอดสุทธิ</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-sm text-gray-700">
                  {(bill.bill_items || []).map((item) => {
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
                        <TableCell className="text-center">{item.order_quantity} {item.unit}</TableCell>
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

          {/* Action buttons */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={onBack}
              disabled={!!loading}
              className="flex items-center gap-2 px-6 py-3 border border-gray-300 text-[#5F5E5E] font-bold rounded-none hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleReject}
              disabled={!!loading}
              className="flex items-center gap-2 px-6 py-3 border-2 border-[#e51c23] text-[#e51c23] font-bold rounded-none hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading === 'reject' ? <Loader2 size={18} className="animate-spin" /> : <RotateCcw size={18} />}
              ส่งกลับแก้ไข
            </button>
            <button
              onClick={handleApprove}
              disabled={!!loading}
              className="flex items-center gap-2 px-8 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-none transition-colors cursor-pointer disabled:opacity-50 shadow-md"
            >
              {loading === 'approve' ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              อนุมัติบิล
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
