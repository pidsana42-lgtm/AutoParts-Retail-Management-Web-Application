import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, CheckCircle, Clock, XCircle, 
  Calendar, Phone, User, Package, Lock
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContexts';
import Heading from '../../../components/elements/heading';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/elements/card';
import Button from '../../../components/elements/button';

interface ReturnItem {
  id: number;
  return_no: string;
  return_date: string;
  customer_name: string;
  customer_phone: string;
  quantity: number;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  reason?: string;
  remarks?: string;
}

const DEFAULT_RETURNS: ReturnItem[] = [
  {
    id: 1,
    return_no: 'RTN-2026-0001',
    return_date: '2026-07-01T09:00:00Z',
    customer_name: 'บริษัท สมหวังไอที จำกัด',
    customer_phone: '02-345-6789',
    quantity: 1,
    amount: 12500,
    status: 'PENDING',
    reason: 'ORDER_ERROR',
    remarks: 'ลูกค้าแจ้งสั่งซื้อเครื่องพิมพ์รุ่นผิด ต้องการเปลี่ยนเป็นรุ่น PRO-X2'
  },
  {
    id: 2,
    return_no: 'RTN-2026-0002',
    return_date: '2026-07-05T16:45:00Z',
    customer_name: 'คุณกิตติศักดิ์ พรหมดี',
    customer_phone: '081-234-5678',
    quantity: 2,
    amount: 25090,
    status: 'COMPLETED',
    reason: 'QUALITY_ISSUE',
    remarks: 'สินค้ามีตำหนิและรอยบุบจากการขนส่ง'
  },
  {
    id: 3,
    return_no: 'RTN-2026-0003',
    return_date: '2026-07-06T11:20:00Z',
    customer_name: 'อู่สงวนอะไหล่ยนต์',
    customer_phone: '089-876-5432',
    quantity: 50,
    amount: 2250,
    status: 'CANCELLED',
    reason: 'CUSTOMER_CHANGE_MIND',
    remarks: 'เปลี่ยนใจยกเลิกความต้องการคืน'
  },
];

export default function ReturnDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useAuth() as any;
  const isManager = role === 'OWNER' || role === 'ADMIN';

  const [returns, setReturns] = useState<ReturnItem[]>([]);
  const [returnItem, setReturnItem] = useState<ReturnItem | null>(null);

  // Load returns from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('mock_returns');
    let loadedReturns = DEFAULT_RETURNS;
    if (saved) {
      try {
        loadedReturns = JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    } else {
      localStorage.setItem('mock_returns', JSON.stringify(DEFAULT_RETURNS));
    }
    setReturns(loadedReturns);

    const found = loadedReturns.find(r => r.id === Number(id));
    if (found) {
      setReturnItem(found);
    }
  }, [id]);

  // Handle status update
  const handleStatusUpdate = (newStatus: 'COMPLETED' | 'CANCELLED') => {
    if (!returnItem) return;
    const updatedReturns = returns.map(r => 
      r.id === returnItem.id ? { ...r, status: newStatus } : r
    );
    setReturns(updatedReturns);
    localStorage.setItem('mock_returns', JSON.stringify(updatedReturns));
    setReturnItem({ ...returnItem, status: newStatus });
    
    alert(`ดำเนินการ ${newStatus === 'COMPLETED' ? 'อนุมัติคืนเงินสำเร็จ' : 'ยกเลิกคำขอคืนเงิน'} เรียบร้อยแล้ว`);
    navigate('/owner/returns');
  };

  if (!returnItem) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-slate-500 font-bold">ไม่พบข้อมูลใบคืนสินค้าที่คุณระบุ</p>
        <Button onClick={() => navigate('/owner/returns')} variant="outline">กลับหน้าหลัก</Button>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 bg-gray-50 min-h-screen font-sans">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <button 
            type="button" 
            onClick={() => navigate('/owner/returns')} 
            className="p-2 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
          >
            <ChevronLeft size={24} className="text-slate-600" />
          </button>
          <div>
            <Heading level="h2" weight="semibold" className="mb-0 text-gray-800">
              รายละเอียดเอกสารการรับคืน
            </Heading>
            <Heading level="h6" weight="light" className="m-0 text-slate-500 mt-1">
              เลขที่ใบรับคืน: {returnItem.return_no}
            </Heading>
          </div>
        </div>
        
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
          returnItem.status === 'COMPLETED' 
            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
            : returnItem.status === 'CANCELLED' 
              ? 'bg-red-50 text-red-600 border border-red-100' 
              : 'bg-amber-50 text-amber-600 border border-amber-100'
        }`}>
          {returnItem.status === 'COMPLETED' ? (
            <CheckCircle size={14} />
          ) : returnItem.status === 'CANCELLED' ? (
            <XCircle size={14} />
          ) : (
            <Clock size={14} />
          )}
          {returnItem.status === 'COMPLETED' ? 'คืนเงินสำเร็จ' : returnItem.status === 'CANCELLED' ? 'ยกเลิก' : 'รอตรวจสอบ'}
        </span>
      </div>

      {/* Grid Layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        
        {/* Left Side: Main Info (2/3) */}
        <div className="w-full lg:w-3/4 flex flex-col gap-6">
          
          {/* Card: Customer Details */}
          <Card className="border-l-[5px] border-l-red-800">
            <CardHeader className="items-center justify-start gap-4">
              <CardTitle className="text-lg">ข้อมูลลูกค้า</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                <div className="flex items-center gap-3">
                  <User className="text-slate-400" size={18} />
                  <div>
                    <p className="text-xs text-slate-400 font-bold">ชื่อลูกค้า</p>
                    <p className="font-bold text-slate-800">{returnItem.customer_name}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Phone className="text-slate-400" size={18} />
                  <div>
                    <p className="text-xs text-slate-400 font-bold">เบอร์โทรศัพท์</p>
                    <p className="font-bold text-slate-800">{returnItem.customer_phone}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:col-span-2 border-t border-slate-100 pt-3">
                  <Calendar className="text-slate-400" size={18} />
                  <div>
                    <p className="text-xs text-slate-400 font-bold">วันที่ส่งคำขอคืน</p>
                    <p className="font-semibold text-slate-600 text-xs">
                      {new Date(returnItem.return_date).toLocaleDateString('th-TH', {
                        year: 'numeric', month: 'long', day: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card: Summary of return */}
          <Card className="border-l-[5px] border-l-black">
            <CardHeader className="items-center justify-start gap-4 bg-slate-50/50">
              <CardTitle className="text-lg">รายการสินค้าและยอดเงินคืน</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 py-1 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-semibold flex items-center gap-2">
                    <Package className="text-slate-400" size={16} />
                    จำนวนสินค้าที่รับคืนรวม:
                  </span>
                  <span className="font-bold text-slate-800">{returnItem.quantity} ชิ้น</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                  <span className="text-slate-500 font-bold">ยอดรวมคืนเงินสุทธิ:</span>
                  <span className="font-extrabold text-lg text-[#e51c23]">฿{returnItem.amount.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card: Damaged Details & Notes */}
          <Card className="border-l-[5px] border-l-slate-400">
            <CardHeader className="items-center justify-start gap-4">
              <CardTitle className="text-lg">สาเหตุการคืนและรายละเอียดเพิ่มเติม</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-slate-700 bg-slate-100 p-4 rounded border border-slate-200 font-semibold italic">
                "{returnItem.remarks || 'ไม่มีหมายเหตุเพิ่มเติม'}"
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Right Side: Approval Panel (1/3) */}
        <div className="w-full lg:w-1/4 flex flex-col gap-6">
          <Card className="border-t-[5px] border-t-red-800">
            <CardHeader className="items-center justify-start gap-4">
              <CardTitle className="text-lg">ดำเนินการบิลคืนเงิน</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-xs">
                <div className="text-slate-500 font-bold">
                  * กรุณาตรวจสอบความถูกต้องของสินค้าและใบเสร็จก่อนอนุมัติคืนเงิน
                </div>

                {returnItem.status === 'PENDING' ? (
                  <div className="space-y-3 pt-2">
                    {isManager ? (
                      <>
                        <Button
                          type="button"
                          onClick={() => handleStatusUpdate('COMPLETED')}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 justify-center shadow-sm flex items-center gap-2"
                        >
                          <CheckCircle size={18} /> อนุมัติคืนเงินสำเร็จ
                        </Button>
                        <Button
                          type="button"
                          onClick={() => handleStatusUpdate('CANCELLED')}
                          className="w-full bg-red-700 hover:bg-red-800 text-white font-bold py-2.5 justify-center shadow-sm flex items-center gap-2"
                        >
                          <XCircle size={18} /> ยกเลิกคำขอคืนเงิน
                        </Button>
                      </>
                    ) : (
                      <div className="bg-slate-100 p-3 rounded text-center text-xs text-slate-400 font-bold flex items-center justify-center gap-1.5">
                        <Lock size={14} /> สิทธิ์การอนุมัติเฉพาะผู้จัดการหรือเจ้าของร้าน
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-slate-50 p-4 rounded border border-slate-150 text-center space-y-2">
                    <p className="text-xs text-slate-400 font-bold">ดำเนินการตรวจสอบเสร็จสิ้น</p>
                    <p className={`font-extrabold text-sm ${
                      returnItem.status === 'COMPLETED' ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {returnItem.status === 'COMPLETED' ? 'คืนเงินสำเร็จแล้ว' : 'ยกเลิกคำขอคืนเงินแล้ว'}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>

    </div>
  );
}
